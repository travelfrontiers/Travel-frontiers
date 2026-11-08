import { NextRequest, NextResponse } from "next/server";
import { dateOnly } from "@/lib/crm-office-api";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Viagem inválida." }, { status: 400 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const dueDate = body.due_date;
  if (!title || title.length > 240 || !(dueDate === null || dateOnly(dueDate))) {
    return NextResponse.json({ error: "Indica uma tarefa válida." }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_trip_tasks`, {
      method: "POST", headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ trip_id: id, title, due_at: dueDate ? `${dueDate}T12:00:00Z` : null, completed: false, sort_order: 100 }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível adicionar a tarefa." }, { status: 502 });
    const rows = await response.json();
    return NextResponse.json({ task: rows[0] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

