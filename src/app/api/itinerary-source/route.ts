import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeTool, readBounded } from "@/lib/studio-request";
import { isRecognizedSource, loadPrivateSource, readOldSource, savePrivateSource, sourceExtension, uploadLimit } from "@/lib/itinerary-source";
import { writeClient } from "@/sanity/client";

export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
    const denied = await authorizeTool(request, "itinerary-source");
    if (denied) return denied;
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !sourceExtension(key)) return NextResponse.json({ error: "Ficheiro inválido." }, { status: 400 });
    try {
        return new Response(new Uint8Array(await loadPrivateSource(key)), {
            headers: { ...privateHeaders, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="roteiro.${sourceExtension(key)}"` },
        });
    } catch {
        return NextResponse.json({ error: "Não foi possível descarregar o ficheiro privado." }, { status: 502 });
    }
}

type OldRoteiro = {
    _id: string; _rev: string; title?: string; notes?: string; privateSource?: string;
    asset?: { _id: string; url: string; extension: string };
};

async function migrateSources() {
    const client = writeClient.withConfig({ perspective: "raw" });
    const { projectId, dataset } = client.config();
    if (!projectId || !dataset) throw new Error("Sanity indisponível.");
    const docs = await client.fetch<OldRoteiro[]>(
        `*[_type=="roteiro" && !(_id in path("versions.**"))]{_id,_rev,title,notes,privateSource,"asset":sourceFile.asset->{_id,url,extension}}`,
    );
    const groups = new Map<string, OldRoteiro[]>();
    const migrated = new Map<string, string>();
    for (const doc of docs) {
        const base = doc._id.replace(/^drafts\./, "");
        groups.set(base, [...(groups.get(base) ?? []), doc]);
        if (!doc.asset || migrated.has(doc.asset._id)) continue;
        const { extension, _id, url } = doc.asset;
        if (!["pdf", "docx", "txt", "doc"].includes(extension)) throw new Error("Formato de origem desconhecido.");
        const bytes = await readOldSource(url, projectId, dataset);
        if (!bytes.length) throw new Error("Ficheiro de origem vazio.");
        const hash = createHash("sha256").update(bytes).digest("hex");
        const key = `${hash}.${extension}`;
        await savePrivateSource(key, bytes);
        const verified = await loadPrivateSource(key);
        if (createHash("sha256").update(verified).digest("hex") !== hash) throw new Error("A cópia privada não pôde ser validada.");
        migrated.set(_id, key);
    }
    const transaction = client.transaction();
    for (const [base, versions] of groups) {
        const live = versions.find(doc => doc._id === base);
        const draft = versions.find(doc => doc._id === `drafts.${base}`);
        if (!live && !draft?.asset) continue;
        const draftKey = draft?.asset ? migrated.get(draft.asset._id) : draft?.privateSource;
        const liveKey = live?.asset ? migrated.get(live.asset._id) : live?.privateSource;
        const key = draftKey ?? liveKey;
        if (!key || !sourceExtension(key)) throw new Error("Falta validar o ficheiro de um roteiro.");
        if (draft && draftKey && liveKey && draftKey !== liveKey) {
            // Preserve the earlier version as a separate private draft.
            transaction.createIfNotExists({
                _id: `drafts.${base}-origem-anterior`, _type: "roteiro",
                title: `${live?.title ?? "Roteiro"} (origem anterior)`, notes: live?.notes, privateSource: liveKey,
            });
        }
        if (draft) {
            transaction.patch(draft._id, patch => patch.ifRevisionId(draft._rev).set({ privateSource: key }).unset(["sourceFile"]));
        } else {
            transaction.create({
                _id: `drafts.${base}`, _type: "roteiro", title: live?.title, notes: live?.notes, privateSource: key,
            });
        }
        if (live) {
            transaction.patch(live._id, patch => patch.ifRevisionId(live._rev).unset(["sourceFile"]));
            transaction.delete(live._id);
        }
    }
    for (const id of migrated.keys()) transaction.delete(id);
    if (transaction.toJSON().length) await transaction.commit();
    return { documents: docs.filter(doc => !doc._id.startsWith("drafts.")).length, files: migrated.size };
}

export async function POST(request: Request) {
    const denied = await authorizeTool(request, "itinerary-source");
    if (denied) return denied;
    const query = new URL(request.url).searchParams;
    if (query.get("action") === "migrate") {
        try { return NextResponse.json(await migrateSources(), { headers: privateHeaders }); }
        catch { return NextResponse.json({ error: "Não foi possível concluir a migração. A remoção no Sanity só avança depois de confirmar as cópias privadas." }, { status: 502 }); }
    }
    const extension = query.get("extension");
    if (!extension || !["pdf", "docx", "txt"].includes(extension)) {
        return NextResponse.json({ error: "Escolhe um PDF, DOCX ou TXT." }, { status: 400 });
    }
    try {
        const bytes = await readBounded(request.body, uploadLimit);
        if (!isRecognizedSource(bytes, extension)) return NextResponse.json({ error: "O conteúdo não corresponde ao formato indicado." }, { status: 400 });
        const key = `${randomUUID()}.${extension}`;
        await savePrivateSource(key, bytes);
        return NextResponse.json({ key }, { status: 201, headers: privateHeaders });
    } catch (error) {
        return NextResponse.json({ error: error instanceof RangeError ? "O limite por ficheiro é 4 MB." : "Não foi possível guardar o ficheiro privado." }, { status: error instanceof RangeError ? 413 : 502 });
    }
}
