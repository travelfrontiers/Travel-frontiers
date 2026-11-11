import { NextResponse } from "next/server";
import { isAuthorizedStudioUser } from "./crm-api";

type Tool = "story" | "translate" | "itinerary" | "itinerary-source";
const limits: Record<Tool, number> = { story: 20, translate: 10, itinerary: 6, "itinerary-source": 30 };
const attempts = new Map<Tool, { count: number; reset: number }>();

export async function authorizeTool(request: Request, tool: Tool) {
    if (!await isAuthorizedStudioUser(request)) {
        return NextResponse.json({ error: "Inicia sessão no Admin para continuar." }, { status: 401 });
    }
    const now = Date.now();
    const current = attempts.get(tool);
    const bucket = current && current.reset > now ? current : { count: 0, reset: now + 60_000 };
    attempts.set(tool, bucket);
    if (bucket.count >= limits[tool]) {
        return NextResponse.json({ error: "Aguarda antes de voltar a tentar." }, {
            status: 429, headers: { "Retry-After": String(Math.ceil((bucket.reset - now) / 1000)) },
        });
    }
    bucket.count++;
    return null;
}

export async function readBounded(stream: ReadableStream<Uint8Array> | null, maxBytes: number) {
    if (!stream) return Buffer.alloc(0);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) return Buffer.concat(chunks, size);
            size += value.byteLength;
            if (size > maxBytes) {
                await reader.cancel();
                throw new RangeError("O pedido excede o tamanho permitido.");
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

export async function studioJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
    const value: unknown = JSON.parse((await readBounded(request.body, maxBytes)).toString("utf-8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Pedido inválido.");
    return value as Record<string, unknown>;
}
