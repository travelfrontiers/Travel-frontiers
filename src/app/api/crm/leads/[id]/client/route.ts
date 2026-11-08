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

    const email = String(lead.email).trim().toLowerCase();
    const matchingResponse = await fetch(`${config.url}/rest/v1/crm_clients?email=eq.${encodeURIComponent(email)}&select=*`, { headers: config.headers, cache: "no-store" });
    if (!matchingResponse.ok) return NextResponse.json({ error: "Não foi possível verificar clientes existentes." }, { status: 502 });
    let matching = await matchingResponse.json();
    let client = matching[0] as Record<string, unknown> | undefined;
    if (!client) {
      const createResponse = await fetch(`${config.url}/rest/v1/crm_clients?select=*`, {
        method: "POST",
        headers: { ...config.headers, Prefer: "return=representation" },
        body: JSON.stringify({
          full_name: lead.full_name, email, phone: lead.phone, language: lead.language,
          source: "lead",
        }),
        cache: "no-store",
      });
      if (createResponse.ok) {
        const created = await createResponse.json();
        client = created[0] as Record<string, unknown> | undefined;
      } else if (createResponse.status === 409) {
        const retry = await fetch(`${config.url}/rest/v1/crm_clients?email=eq.${encodeURIComponent(email)}&select=*`, { headers: config.headers, cache: "no-store" });
        if (retry.ok) client = (await retry.json())[0] as Record<string, unknown> | undefined;
      } else {
        console.error("CRM lead-to-client create failed", createResponse.status);
        return NextResponse.json({ error: "Não foi possível criar o cliente." }, { status: 502 });
      }
    }
    if (!client || typeof client.id !== "string") return NextResponse.json({ error: "Não foi possível criar o cliente." }, { status: 502 });

    const linkResponse = await fetch(`${config.url}/rest/v1/crm_leads?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ client_id: client.id, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    if (!linkResponse.ok) {
      console.error("CRM lead-to-client link failed", linkResponse.status);
      return NextResponse.json({ error: "O cliente foi criado, mas não foi possível associá-lo ao pedido." }, { status: 502 });
    }
    const updated = await linkResponse.json();
    return NextResponse.json({ client, lead: updated[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
