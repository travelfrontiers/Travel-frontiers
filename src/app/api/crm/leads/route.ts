import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  try {
    const response = await fetch(`${config.url}/rest/v1/crm_leads?select=*&order=created_at.desc`, {
      headers: config.headers,
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("CRM lead query failed", response.status);
      return NextResponse.json({ error: "Não foi possível carregar os pedidos." }, { status: 502 });
    }
    const rows = await response.json() as Array<Record<string, unknown>>;
    const leads = rows.map((lead) => ({
      ...lead,
      // Keep older saved requests visible after simplifying the commercial pipeline.
      status: lead.status === "qualifying" ? "new" : lead.status === "research" ? "quote_preparing" : lead.status,
    }));
    return NextResponse.json({ leads }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
