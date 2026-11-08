import { NextRequest, NextResponse } from "next/server";
import { travelTypes } from "@/lib/crm-office-api";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const tripStatuses = ["planning", "confirmed", "travelling", "completed", "cancelled"] as const;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Viagem inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const travelType = typeof body.travel_type === "string" ? body.travel_type : "general";
  const { status, destination, departure_date, return_date } = body;
  const clientIds = body.client_ids;
  const validDate = (value: unknown) => {
    if (value === null) return true;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const operator = typeof body.operator === "string" ? body.operator.trim() : "";
  const adults = body.adults === "" || body.adults === null || body.adults === undefined ? null : Number(body.adults);
  const childrenCount = body.children_count === "" || body.children_count === null || body.children_count === undefined ? null : Number(body.children_count);
  const totalAmount = body.total_amount === "" || body.total_amount === null || body.total_amount === undefined ? null : Number(body.total_amount);
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "EUR";
  const tripNotes = typeof body.trip_notes === "string" ? body.trip_notes.trim() : "";
  const validClientIds = Array.isArray(clientIds) && clientIds.length > 0 && clientIds.length <= 30 && clientIds.every((clientId) => typeof clientId === "string" && isUuid(clientId));
  if (!travelTypes.includes(travelType as (typeof travelTypes)[number]) || !validClientIds || typeof status !== "string" || !tripStatuses.includes(status as (typeof tripStatuses)[number]) ||
      !(destination === null || typeof destination === "string" && destination.length <= 240) ||
      !validDate(departure_date) ||
      !validDate(return_date) ||
      typeof departure_date === "string" && typeof return_date === "string" && return_date < departure_date ||
      operator.length > 160 || adults !== null && (!Number.isInteger(adults) || adults < 1 || adults > 20) ||
      childrenCount !== null && (!Number.isInteger(childrenCount) || childrenCount < 0 || childrenCount > 30) ||
      totalAmount !== null && (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 9999999999.99) ||
      !/^[A-Z]{3}$/.test(currency) || tripNotes.length > 4000) {
    return NextResponse.json({ error: "Revê o estado, o destino, as datas e os dados de viagem." }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/crm_update_trip`, {
      method: "POST", headers: config.headers,
      body: JSON.stringify({
        p_trip_id: id, p_client_ids: [...new Set(clientIds as string[])],
        p_fields: { travel_type: travelType, status, destination, departure_date, return_date, operator, adults,
          children_count: childrenCount, total_amount: totalAmount, currency, trip_notes: tripNotes },
      }), cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { message?: string } | null;
      if (failure?.message?.includes("trip_not_found")) return NextResponse.json({ error: "A viagem já não existe." }, { status: 404 });
      if (failure?.message?.includes("client_not_found")) return NextResponse.json({ error: "Um dos clientes selecionados já não existe. Nenhuma alteração foi guardada." }, { status: 409 });
      return NextResponse.json({ error: "Não foi possível guardar a viagem. Nenhuma alteração foi guardada." }, { status: 502 });
    }
    return NextResponse.json({ trip: await response.json() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Viagem inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trips?id=eq.${encodeURIComponent(id)}&select=id`, {
      method: "DELETE",
      headers: { ...config.headers, Prefer: "return=representation" },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("CRM trip delete failed", response.status);
      return NextResponse.json({ error: "Não foi possível apagar a viagem." }, { status: 502 });
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "A viagem já não existe." }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

