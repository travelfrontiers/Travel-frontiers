import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const dueDate = body.due_date;
  const completed = body.completed;
  if (!title || title.length > 240 || typeof completed !== "boolean" || !(dueDate === null || typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && Number.isFinite(new Date(`${dueDate}T00:00:00Z`).getTime()) && new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) === dueDate)) {
    return NextResponse.json({ error: "Revê o nome, a data e o estado da tarefa." }, { status: 400 });
  }

  try {
    const currentResponse = await fetch(`${config.url}/rest/v1/crm_trip_tasks?id=eq.${encodeURIComponent(id)}&select=source_service_id`, { headers: config.headers, cache: "no-store" });
    if (!currentResponse.ok) return NextResponse.json({ error: "Não foi possível consultar a tarefa." }, { status: 502 });
    const currentRows = await currentResponse.json();
    if (!Array.isArray(currentRows) || !currentRows[0]) return NextResponse.json({ error: "A tarefa já não existe." }, { status: 404 });
    const automatic = Boolean(currentRows[0].source_service_id);
    const response = await fetch(`${config.url}/rest/v1/crm_trip_tasks?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: "PATCH", headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify(automatic ? { completed } : { title, completed, due_at: dueDate ? `${dueDate}T12:00:00Z` : null }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível guardar a tarefa." }, { status: 502 });
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) return NextResponse.json({ error: "A tarefa já não existe." }, { status: 404 });
    return NextResponse.json({ task: rows[0] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });
  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_tasks?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE", headers: config.headers, cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível remover a tarefa." }, { status: 502 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
