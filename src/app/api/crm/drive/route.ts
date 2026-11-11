import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";
export const runtime = "nodejs";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function driveConfig() {
  const apiKey = process.env.GOOGLE_DRIVE_PICKER_API_KEY;
  const appId = process.env.GOOGLE_DRIVE_PICKER_APP_ID;
  const picker = apiKey && appId && /^\d+$/.test(appId) ? { apiKey, appId } : null;
  return { clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || null, picker };
}
export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  if (request.nextUrl.searchParams.get("picker") === "1") {
    return NextResponse.json(driveConfig(), { headers: { "Cache-Control": "private, no-store" } });
  }
  const tripId = request.nextUrl.searchParams.get("trip_id"), clientId = request.nextUrl.searchParams.get("client_id");
  if (Boolean(tripId) === Boolean(clientId) || !uuid(tripId || clientId)) return NextResponse.json({ error: "Ficha inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "Base de dados não configurada." }, { status: 503 });
  try {
    const field = tripId ? "trip_id" : "client_id";
    const response = await fetch(`${config.url}/rest/v1/crm_drive_files?${field}=eq.${encodeURIComponent(tripId || clientId!)}&select=*&order=created_at.desc`, { headers: config.headers, cache: "no-store" });
    if (!response.ok) throw new Error("query_failed");
    return NextResponse.json({ files: await response.json(), ...driveConfig() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível carregar os ficheiros do Drive." }, { status: 502 }); }
}
export async function POST(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  let body: Record<string, unknown>;
  try { const parsed = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); body = parsed; } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  if (Boolean(body.trip_id) === Boolean(body.client_id) || !uuid(body.trip_id || body.client_id) ||
      typeof body.drive_file_id !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(body.drive_file_id) ||
      typeof body.file_name !== "string" || !body.file_name.trim() || body.file_name.length > 240 ||
      !["application/pdf","image/jpeg","image/png"].includes(String(body.mime_type))) return NextResponse.json({ error: "Ficheiro inválido." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "Base de dados não configurada." }, { status: 503 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_drive_files?select=*`, {
      method: "POST", headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ trip_id: body.trip_id || null, client_id: body.client_id || null, drive_file_id: body.drive_file_id, file_name: body.file_name.trim(), mime_type: body.mime_type }), cache: "no-store",
    });
    if (response.status === 409) return NextResponse.json({ error: "Este ficheiro já está associado a uma ficha." }, { status: 409 });
    if (!response.ok) throw new Error("save_failed");
    const rows = await response.json();
    return NextResponse.json({ file: rows[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "O ficheiro está no Drive, mas não foi possível associá-lo à ficha. Tenta concluir a associação novamente." }, { status: 502 }); }
}
export async function DELETE(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  let id: unknown; try { id = (await request.json()).id; } catch { /* Invalid below. */ }
  if (!uuid(id)) return NextResponse.json({ error: "Ligação inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "Base de dados não configurada." }, { status: 503 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_drive_files?id=eq.${encodeURIComponent(id)}&select=id`, { method: "DELETE", headers: { ...config.headers, Prefer: "return=representation" }, cache: "no-store" });
    if (!response.ok) throw new Error("delete_failed");
    const rows = await response.json();
    if (!rows.length) return NextResponse.json({ error: "A ligação já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível retirar a ligação." }, { status: 502 }); }
}
