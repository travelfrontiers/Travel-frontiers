import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const languages = ["pt", "en", "fr"] as const;

export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_clients?select=*&order=full_name.asc`, { headers: config.headers, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar os clientes." }, { status: 502 });
    return NextResponse.json({ clients: await response.json() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const language = typeof body.language === "string" ? body.language : "pt";
  const internalNotes = typeof body.internal_notes === "string" ? body.internal_notes.trim() || null : null;
  if (fullName.length < 2 || fullName.length > 160 || (email !== null && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      (phone !== null && phone.length > 40) || !languages.includes(language as (typeof languages)[number]) ||
      (internalNotes !== null && internalNotes.length > 4000)) {
    return NextResponse.json({ error: "Revê o nome, email, telefone e notas do cliente." }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_clients?select=*`, {
      method: "POST",
      headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ full_name: fullName, email, phone, language, internal_notes: internalNotes, source: "manual" }),
      cache: "no-store",
    });
    if (response.status === 409) return NextResponse.json({ error: "Já existe um cliente com este email." }, { status: 409 });
    if (!response.ok) {
      console.error("CRM client create failed", response.status);
      return NextResponse.json({ error: "Não foi possível guardar o cliente." }, { status: 502 });
    }
    const rows = await response.json();
    return NextResponse.json({ client: rows[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
