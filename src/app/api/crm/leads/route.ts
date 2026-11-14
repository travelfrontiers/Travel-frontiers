import { crmConfig, CrmError, failure, payload, privateJson, rows } from "@/lib/crm-office-api";
import { manualLeadFields } from "@/lib/crm-manual-lead-api";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const fields = manualLeadFields(await payload(request));
    const response = await fetch(config.url + "/rest/v1/crm_leads?select=*", {
      method: "POST", headers: { ...config.headers, Prefer: "return=representation" },
      body: JSON.stringify({ ...fields, status: "new" }), cache: "no-store",
    });
    if (response.status === 409) throw new CrmError("O cliente selecionado já não está disponível.", 409);
    if (!response.ok) throw new CrmError("Não foi possível guardar o pedido.", 502);
    const [lead] = await response.json();
    return privateJson({ lead }, 201);
  } catch (error) { return failure(error); }
}

export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  try {
    const records = await rows<Record<string, unknown>>(config, "crm_leads", new URLSearchParams({ select: "*", order: "created_at.desc,id" }));
    const leads = records.map((lead) => ({
      ...lead,
      // Keep older saved requests visible after simplifying the commercial pipeline.
      status: lead.status === "qualifying" ? "new" : lead.status === "research" ? "quote_preparing" : lead.status,
    }));
    return NextResponse.json({ leads }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}
