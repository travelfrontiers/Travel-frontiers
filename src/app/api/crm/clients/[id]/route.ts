import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const languages = ["pt", "en", "fr"] as const;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const language = typeof body.language === "string" ? body.language : "";
  const internalNotes = typeof body.internal_notes === "string" ? body.internal_notes.trim() || null : null;

  if (fullName.length < 2 || fullName.length > 160 ||
      (email !== null && (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))) ||
      (phone !== null && phone.length > 40) || !languages.includes(language as (typeof languages)[number]) ||
      (internalNotes !== null && internalNotes.length > 4000)) {
    return NextResponse.json({ error: "Revê o nome, email, telefone, idioma e notas do cliente." }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_clients?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ full_name: fullName, email, phone, language, internal_notes: internalNotes, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    if (response.status === 409) return NextResponse.json({ error: "Já existe um cliente com este email." }, { status: 409 });
    if (!response.ok) {
      console.error("CRM client update failed", response.status);
      return NextResponse.json({ error: "Não foi possível guardar o cliente." }, { status: 502 });
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) return NextResponse.json({ error: "O cliente já não existe." }, { status: 404 });
    return NextResponse.json({ client: rows[0] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/crm_delete_client`, {
      method: "POST", headers: config.headers, body: JSON.stringify({ p_client_id: id }), cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { message?: string } | null;
      if (failure?.message?.includes("client_not_found")) return NextResponse.json({ error: "O cliente já não existe." }, { status: 404 });
      console.error("CRM client delete failed", response.status);
      return NextResponse.json({ error: "Não foi possível apagar o cliente." }, { status: 502 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
