import { studioBearer } from "@/lib/crm-api";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeTool, readBounded, studioJson } from "@/lib/studio-request";
import { isRecognizedSource, loadPrivateSource, savePrivateSource, sourceExtension, uploadLimit } from "@/lib/itinerary-source";
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

type LegacyItinerary = { _id: string; _rev: string; assetId: string };

async function deleteLegacyItineraries(token: string) {
    const client = writeClient.withConfig({ perspective: "raw", token });
    const documents = await client.fetch<LegacyItinerary[]>(
        `*[_type=="roteiro" && defined(sourceFile.asset._ref) && !defined(privateSource) &&
            !(_id in path("versions.**"))]{_id,_rev,"assetId":sourceFile.asset._ref}`,
    );
    if (!documents.length) return { documents: 0, files: 0, retainedFiles: 0 };

    const ids = documents.map(document => document._id);
    const assetIds = [...new Set(documents.map(document => document.assetId))];
    const usage = await client.fetch<{ _id: string; shared: number }[]>(
        `*[_type=="sanity.fileAsset" && _id in $assets]{
            _id,"shared":count(*[!(_id in $ids) && references(^._id)])
        }`,
        { assets: assetIds, ids },
    );
    const removable = usage.filter(asset => asset.shared === 0);
    const transaction = client.transaction();
    for (const document of documents) {
        transaction.patch(document._id, patch => patch.ifRevisionId(document._rev).unset(["sourceFile"]));
        transaction.delete(document._id);
    }
    for (const asset of removable) transaction.delete(asset._id);
    await transaction.commit({ visibility: "sync" });
    return { documents: documents.length, files: removable.length, retainedFiles: usage.length - removable.length };
}

export async function POST(request: Request) {
    const denied = await authorizeTool(request, "itinerary-source");
    if (denied) return denied;
    const query = new URL(request.url).searchParams;
    if (query.get("action") === "delete-legacy") {
        const token = studioBearer(request);
        const body = await studioJson(request, 256).catch(() => null);
        if (!token || body?.confirmed !== true) {
            return NextResponse.json({ error: "Confirma a eliminação dos roteiros antigos." }, { status: 400 });
        }
        try {
            return NextResponse.json(await deleteLegacyItineraries(token), { headers: privateHeaders });
        } catch (error) {
            const status = typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined;
            console.warn("Legacy itinerary deletion rejected", typeof status === "number" ? status : "unknown");
            return NextResponse.json({ error: "Não foi possível apagar os roteiros antigos. Revê as ligações dos ficheiros e tenta novamente." }, { status: 502 });
        }
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
