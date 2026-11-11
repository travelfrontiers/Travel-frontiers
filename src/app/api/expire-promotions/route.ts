import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthorizedStudioUser } from "@/lib/crm-api";
import { promotionDay, promotionGroupId } from "@/lib/promotions";
import { studioJson } from "@/lib/studio-request";
import { writeClient } from "@/sanity/client";

type Promotion = { _id: string; _rev: string; language: string; status?: string; validUntil?: string };
export const runtime = "nodejs";

async function archivePromotions(promotionId?: string) {
    const client = writeClient.withConfig({ perspective: "raw" });
    try {
        const documents = await client.fetch<Promotion[]>(
            `*[_type=="promotion" && !(_id in path("versions.**"))]{_id,_rev,language,status,validUntil}`,
        );
        const groups = new Map<string, Promotion[]>();
        for (const document of documents) {
            const id = promotionGroupId(document._id);
            const group = groups.get(id) ?? [];
            group.push(document);
            groups.set(id, group);
        }

        const today = promotionDay();
        let archived = 0;
        let errors = 0;
        for (const [id, group] of groups) {
            const source = group.find(doc => doc._id === id) ?? group.find(doc => doc._id === `drafts.${id}`);
            const expired = source
                ? Boolean(source.validUntil && source.validUntil < today)
                : group.some(doc => doc.validUntil && doc.validUntil < today);
            if (promotionId ? id !== promotionId : !expired) continue;
            const changes = group.filter(doc => doc.status !== "archived");
            if (!changes.length) continue;
            try {
                const transaction = client.transaction();
                for (const doc of changes) {
                    transaction.patch(doc._id, patch => patch.ifRevisionId(doc._rev).set({ status: "archived" }));
                }
                await transaction.commit();
                archived += changes.length;
            } catch {
                errors++;
            }
        }
        return NextResponse.json({ success: errors === 0, archived, errors }, { status: errors ? 502 : 200 });
    } catch {
        return NextResponse.json({ error: "Não foi possível arquivar as promoções." }, { status: 502 });
    }
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    const supplied = Buffer.from(request.headers.get("authorization") || "");
    const expected = Buffer.from(`Bearer ${secret ?? ""}`);
    if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    return archivePromotions();
}

export async function POST(request: Request) {
    if (!await isAuthorizedStudioUser(request)) {
        return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    try {
        const { id } = await studioJson(request, 1024);
        if (id !== undefined && (typeof id !== "string" || !/^[\w.-]{1,128}$/.test(id))) throw new Error();
        return archivePromotions(typeof id === "string" ? promotionGroupId(id) : undefined);
    } catch {
        return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
}
