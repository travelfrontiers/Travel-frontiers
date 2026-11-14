import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  try {
    const leadResponse = await fetch(`${config.url}/rest/v1/crm_leads?id=eq.${encodeURIComponent(id)}&select=*`, {
      headers: config.headers, cache: "no-store",
    });
    if (!leadResponse.ok) return NextResponse.json({ error: "Não foi possível carregar o pedido." }, { status: 502 });
    const leadRows = await leadResponse.json();
    const lead = leadRows[0] as Record<string, unknown> | undefined;
    if (!lead) return NextResponse.json({ error: "O pedido já não existe." }, { status: 404 });
    if (typeof lead.client_id === "string") {
      const existing = await fetch(`${config.url}/rest/v1/crm_clients?id=eq.${encodeURIComponent(lead.client_id)}&select=*`, { headers: config.headers, cache: "no-store" });
      if (!existing.ok) return NextResponse.json({ error: "Não foi possível carregar o cliente associado." }, { status: 502 });
      const clients = await existing.json();
      return NextResponse.json({ client: clients[0], lead }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const linkResponse = await fetch(config.url + "/rest/v1/rpc/crm_link_request_client", {
      method: "POST", headers: config.headers,
      body: JSON.stringify({ p_lead_id: id }),
      cache: "no-store",
    });
    if (!linkResponse.ok) {
      console.error("CRM lead-to-client link failed", linkResponse.status);
      return NextResponse.json({ error: "Não foi possível associar o cliente ao pedido." }, { status: 502 });
    }
    const updated = await linkResponse.json();
    return NextResponse.json(updated, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
