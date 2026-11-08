import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const documentTypes = ["passport", "identity_card", "residence_permit", "other"] as const;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const documentNumber = typeof body.document_number === "string" ? body.document_number.trim() : "";
  if (typeof body.document_type !== "string" || !documentTypes.includes(body.document_type as (typeof documentTypes)[number]) || documentNumber.length < 1 || documentNumber.length > 80 || !isDateOnly(body.expires_on)) {
    return NextResponse.json({ error: "Revê o tipo, o ID do documento e a data de validade." }, { status: 400 });
  }
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_client_documents?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH", headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ document_type: body.document_type, document_number: documentNumber, expires_on: body.expires_on, updated_at: new Date().toISOString() }), cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível atualizar o documento." }, { status: 502 });
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) return NextResponse.json({ error: "O documento já não existe." }, { status: 404 });
    return NextResponse.json({ document: rows[0] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
