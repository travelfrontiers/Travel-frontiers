import { dateOnly, failure, payload, privateJson, rows, rpc } from "@/lib/crm-office-api";
import { lisbonDay } from "@/lib/crm-calendar";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";
import { readOptionalClientFields } from "@/lib/crm-client-fields";

export const runtime = "nodejs";
const languages = ["pt", "en", "fr"] as const;

export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  try {
    const clients = await rows(config, "crm_clients", new URLSearchParams({ select: "*", order: "full_name.asc,id" }));
    return NextResponse.json({ clients }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await payload(request); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }

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

  const birthDate = body.birth_date === "" || body.birth_date == null ? null : body.birth_date;
  if (birthDate !== null && (!dateOnly(birthDate) || birthDate > lisbonDay(new Date().toISOString()))) {
    return privateJson({ error: "Indica uma data de nascimento válida." }, 400);
  }
  const optionalFields = readOptionalClientFields(body);
  if (!optionalFields) return privateJson({ error: "Revê o NIF e a morada do cliente." }, 400);
  const client = { full_name: fullName, email, phone, language, internal_notes: internalNotes, birth_date: birthDate, source: "manual", ...optionalFields };

  if (body.document != null) {
    const document = body.document as Record<string, unknown>;
    const number = typeof document.document_number === "string" ? document.document_number.trim() : "";
    if (!birthDate || document.reviewed !== true || !["passport", "identity_card"].includes(String(document.document_type)) ||
        number.length < 1 || number.length > 80 || !dateOnly(document.expires_on) || document.expires_on < birthDate) {
      return privateJson({ error: "Confirma o tipo, número e datas do documento antes de guardar." }, 400);
    }
    try {
      return privateJson(await rpc(config, "crm_create_client_with_document", {
        p_client: client, p_document_type: document.document_type, p_document_number: number, p_expires_on: document.expires_on,
      }), 201);
    } catch (cause) { return failure(cause); }
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_clients?select=*`, {
      method: "POST",
      headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify(client),
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
