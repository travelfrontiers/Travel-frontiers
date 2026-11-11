import { supabaseAdminConfig } from "./crm-api";
import { readBounded } from "./studio-request";

export const uploadLimit = 4 * 1024 * 1024;
const migrationLimit = 20 * 1024 * 1024;
const bucket = "private-itinerary-sources";
const keyPattern = /^(?:[0-9a-f-]{36}|[0-9a-f]{64})\.(pdf|docx|txt|doc)$/;
const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    doc: "application/msword",
};

export function sourceExtension(key: unknown) {
    return typeof key === "string" ? keyPattern.exec(key)?.[1] : undefined;
}

function storage() {
    const config = supabaseAdminConfig();
    if (!config) throw new Error("Armazenamento indisponível.");
    return { url: config.url + "/storage/v1", headers: config.headers };
}

async function ensureBucket() {
    const { url, headers } = storage();
    const info = await fetch(`${url}/bucket/${bucket}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (info.ok) {
        const existing = await info.json();
        if (existing.public !== false) throw new Error("O armazenamento não é privado.");
        return;
    }
    if (info.status !== 404 && info.status !== 400) throw new Error("Armazenamento indisponível.");
    const created = await fetch(`${url}/bucket`, {
        method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: migrationLimit }),
    });
    if (created.ok) return;
    const retry = await fetch(`${url}/bucket/${bucket}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!retry.ok || (await retry.json()).public !== false) throw new Error("Não foi possível criar armazenamento privado.");
}

export async function savePrivateSource(key: string, bytes: Buffer) {
    const extension = sourceExtension(key);
    if (!extension || !bytes.length || bytes.length > migrationLimit) throw new Error("Ficheiro inválido.");
    await ensureBucket();
    const { url, headers } = storage();
    const response = await fetch(`${url}/object/${bucket}/${key}`, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
        headers: { ...headers, "Content-Type": contentTypes[extension], "x-upsert": "true", "Cache-Control": "private, no-store" },
        body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new Error("Não foi possível guardar o ficheiro privado.");
}

export async function loadPrivateSource(key: string) {
    if (!sourceExtension(key)) throw new Error("Ficheiro inválido.");
    const { url, headers } = storage();
    const response = await fetch(`${url}/object/authenticated/${bucket}/${key}`, {
        headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("Ficheiro privado indisponível.");
    return readBounded(response.body, migrationLimit);
}

export function isRecognizedSource(bytes: Buffer, extension: string) {
    if (!bytes.length) return false;
    if (extension === "pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    if (extension === "docx") return bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (extension !== "txt" || bytes.includes(0)) return false;
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; }
    catch { return false; }
}

export async function readOldSource(rawUrl: string, project: string, dataset: string) {
    const url = new URL(rawUrl);
    if (url.origin !== "https://cdn.sanity.io" || !url.pathname.startsWith(`/files/${project}/${dataset}/`)) {
        throw new Error("Origem do ficheiro inválida.");
    }
    const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Ficheiro de origem indisponível.");
    return readBounded(response.body, migrationLimit);
}
