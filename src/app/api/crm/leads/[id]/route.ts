import { crmConfig, CrmError, failure, privateJson, setArchived, uuid } from "@/lib/crm-office-api";
import { NextRequest, NextResponse } from "next/server";
import { CRM_LEAD_STATUSES, isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof body.archived === "boolean") {
    try { return await setArchived(config, "crm_leads", id, body.archived); }
    catch (cause) { return failure(cause); }
  }
  const status = body.status;
  const internalNotes = body.internal_notes;
  const followUpDate = body.follow_up_date === "" ? null : body.follow_up_date;
  const lostReason = typeof body.lost_reason === "string" ? body.lost_reason.trim() : "";
  const parsedFollowUp = typeof followUpDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(followUpDate) ? new Date(`${followUpDate}T00:00:00Z`) : null;
  const validDate = followUpDate === null || parsedFollowUp !== null && Number.isFinite(parsedFollowUp.getTime()) && parsedFollowUp.toISOString().slice(0, 10) === followUpDate;
  if (typeof status !== "string" || !CRM_LEAD_STATUSES.includes(status as (typeof CRM_LEAD_STATUSES)[number]) || typeof internalNotes !== "string" || internalNotes.length > 4000 || !validDate || lostReason.length > 500 || status !== "lost" && lostReason) {
    return NextResponse.json({ error: "Revê a fase, o seguimento, o motivo de perda e as notas internas." }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_leads?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH",
      headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ status, internal_notes: internalNotes.trim() || null, follow_up_date: followUpDate, lost_reason: status === "lost" ? lostReason || null : null, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("CRM lead update failed", response.status);
      return NextResponse.json({ error: "Não foi possível guardar as alterações." }, { status: 502 });
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) return NextResponse.json({ error: "O pedido já não existe." }, { status: 404 });
    return NextResponse.json({ lead: rows[0] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const config = await crmConfig(request);
    const { id } = await params;
    if (!uuid(id)) throw new CrmError("Pedido inválido.");
    const query = new URLSearchParams({ id: "eq." + id, select: "id" });
    const response = await fetch(config.url + "/rest/v1/crm_leads?" + query, {
      method: "DELETE", headers: { ...config.headers, Prefer: "return=representation" }, cache: "no-store",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { message?: string; code?: string } | null;
      if (error?.message?.includes("lead_has_links") || error?.code === "23503") {
        throw new CrmError("Este pedido tem uma proposta ou viagem associada. Podes arquivá-lo para conservar o histórico.", 409);
      }
      throw new CrmError("Não foi possível apagar o pedido.", 502);
    }
    if (!(await response.json() as { id: string }[]).length) throw new CrmError("O pedido já não existe.", 404);
    return privateJson({ ok: true });
  } catch (cause) { return failure(cause); }
}
