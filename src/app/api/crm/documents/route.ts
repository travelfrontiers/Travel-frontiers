import { rows } from "@/lib/crm-office-api";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const documentTypes = ["passport", "identity_card", "residence_permit", "other"] as const;
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  try {
    const documents = await rows(config, "crm_client_documents", new URLSearchParams({ select: "*", order: "expires_on.asc,id" }));
    return NextResponse.json({ documents }, { headers: { "Cache-Control": "private, no-store" } });
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
  const documentNumber = typeof body.document_number === "string" ? body.document_number.trim() : "";
  if (!isUuid(body.client_id) || typeof body.document_type !== "string" || !documentTypes.includes(body.document_type as (typeof documentTypes)[number]) || documentNumber.length < 1 || documentNumber.length > 80 || !isDateOnly(body.expires_on)) {
    return NextResponse.json({ error: "Revê o cliente, o tipo, o ID do documento e a data de validade." }, { status: 400 });
  }
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_client_documents?select=*`, {
      method: "POST", headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ client_id: body.client_id, document_type: body.document_type, document_number: documentNumber, expires_on: body.expires_on }), cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 409 || response.status === 400) return NextResponse.json({ error: "O cliente já não existe ou os dados do documento são inválidos." }, { status: 400 });
      console.error("CRM document create failed", response.status);
      return NextResponse.json({ error: "Não foi possível guardar o documento." }, { status: 502 });
    }
    const rows = await response.json();
    return NextResponse.json({ document: rows[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
