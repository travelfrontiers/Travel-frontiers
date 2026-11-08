import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const serviceTypes = ["flight", "accommodation", "activity", "transfer", "insurance", "other"] as const;
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validDate = (value: unknown) => {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

async function readPayload(request: NextRequest) {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
}

function validService(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const startsOn = body.starts_on === "" ? null : body.starts_on;
  const endsOn = body.ends_on === "" ? null : body.ends_on;
  if (typeof body.service_type !== "string" || !serviceTypes.includes(body.service_type as (typeof serviceTypes)[number]) || title.length < 1 || title.length > 240 || provider.length > 160 || reference.length > 100 || details.length > 4000 || !validDate(startsOn) || !validDate(endsOn) || typeof startsOn === "string" && typeof endsOn === "string" && endsOn < startsOn) return null;
  return { service_type: body.service_type, title, provider: provider || null, reference: reference || null, starts_on: startsOn, ends_on: endsOn, details: details || null };
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  const body = await readPayload(request);
  if (!body || !isUuid(body.trip_id) || !validService(body)) return NextResponse.json({ error: "Revê os dados do serviço e as datas." }, { status: 400 });
  const service = validService(body)!;
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_services?select=*`, { method: "POST", headers: { ...config.headers, Prefer: "return=representation" }, body: JSON.stringify({ trip_id: body.trip_id, ...service }), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível guardar o serviço." }, { status: 502 });
    const rows = await response.json();
    return NextResponse.json({ service: rows[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 }); }
}

export async function PATCH(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  const body = await readPayload(request);
  if (!body || !isUuid(body.id) || !validService(body)) return NextResponse.json({ error: "Revê os dados do serviço e as datas." }, { status: 400 });
  const service = validService(body)!;
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_services?id=eq.${encodeURIComponent(body.id as string)}&select=*`, { method: "PATCH", headers: { ...config.headers, Prefer: "return=representation" }, body: JSON.stringify({ ...service, updated_at: new Date().toISOString() }), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível atualizar o serviço." }, { status: 502 });
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
