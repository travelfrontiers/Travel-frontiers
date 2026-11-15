import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

import { normalizeTripService } from "@/lib/crm-trip-services";

export const runtime = "nodejs";
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function readPayload(request: NextRequest) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

async function invalidSchedule(response: Response) {
  const failure = await response.json().catch(() => null) as { message?: string } | null;
  if (failure?.message?.includes("invalid_flight_schedule")) {
    return NextResponse.json({ error: "Confirma as horas locais, os fusos e a ordem da partida, chegada e abertura do check-in." }, { status: 400 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  const body = await readPayload(request);
  const service = normalizeTripService(body);
  if (!body || !isUuid(body.trip_id) || !service) return NextResponse.json({ error: "Revê os dados do serviço e as datas." }, { status: 400 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_services?select=*`, { method: "POST", headers: { ...config.headers, Prefer: "return=representation" }, body: JSON.stringify({ trip_id: body.trip_id, ...service }), cache: "no-store" });
    if (!response.ok) return await invalidSchedule(response) ?? NextResponse.json({ error: "Não foi possível guardar o serviço." }, { status: 502 });
    const rows = await response.json();
    return NextResponse.json({ service: rows[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 }); }
}

export async function PATCH(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  const body = await readPayload(request);
  const service = normalizeTripService(body);
  if (!body || !isUuid(body.id) || !service) return NextResponse.json({ error: "Revê os dados do serviço e as datas." }, { status: 400 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_services?id=eq.${encodeURIComponent(body.id as string)}&select=*`, { method: "PATCH", headers: { ...config.headers, Prefer: "return=representation" }, body: JSON.stringify({ ...service, updated_at: new Date().toISOString() }), cache: "no-store" });
    if (!response.ok) return await invalidSchedule(response) ?? NextResponse.json({ error: "Não foi possível atualizar o serviço." }, { status: 502 });
    const rows = await response.json();
    if (!rows[0]) return NextResponse.json({ error: "O serviço já não existe." }, { status: 404 });
    return NextResponse.json({ service: rows[0] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 }); }
}

export async function DELETE(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  const body = await readPayload(request);
  if (!body || !isUuid(body.id)) return NextResponse.json({ error: "Serviço inválido." }, { status: 400 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_services?id=eq.${encodeURIComponent(body.id)}`, { method: "DELETE", headers: config.headers, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível remover o serviço." }, { status: 502 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 }); }
}
