import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";
export class CrmError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const dateOnly = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value + "T00:00:00Z").getTime()) && new Date(value + "T00:00:00Z").toISOString().slice(0,10) === value;
export const optionalDate = (value: unknown) => value === null || value === "" || value === undefined || dateOnly(value);
export const nullableId = (value: unknown) => value === null || value === "" || value === undefined || uuid(value);
export const travelTypes = ["general","beach","circuit","city","honeymoon","family","business","custom"] as const;
export async function crmConfig(request: NextRequest) {
 if (!await isAuthorizedStudioUser(request)) throw new CrmError("Acesso não autorizado.",401);
 const config = supabaseAdminConfig(); if (!config) throw new CrmError("A base de dados não está configurada.",503);
 return config;
}
export async function payload(request: NextRequest): Promise<Record<string, unknown>> {
 try { const raw = await request.text(); if(raw.length>100000) throw new Error(); const body: unknown=JSON.parse(raw); if(!body || typeof body!=="object" || Array.isArray(body)) throw new Error(); return body as Record<string,unknown>; }
 catch { throw new CrmError("Pedido inválido."); }
}
export function failure(cause: unknown) { return NextResponse.json({error: cause instanceof CrmError ? cause.message : "Não foi possível concluir a operação. Tenta novamente."},{status: cause instanceof CrmError ? cause.status : 502,headers:{"Cache-Control":"private, no-store"}}); }
export const privateJson = (body: unknown, status=200) => NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
type Config=NonNullable<ReturnType<typeof supabaseAdminConfig>>;
const messages: Record<string,[string,number]> = {
 client_identity_stale:["A ficha foi alterada. Atualiza o CRM e volta a confirmar os dados do documento.",409],
 invalid_document_identity:["Revê o nome e as datas do documento.",400],
 finance_stale_version:["A viagem ou os pagamentos mudaram. Atualiza a ficha antes de voltar a guardar.",409],
 finance_currency_locked:["A moeda está associada ao plano ou aos movimentos desta viagem.",409],
 payment_plan_exceeds_total:["As prestações excedem o total da reserva. Ajusta primeiro o plano.",409],
 payment_total_required:["Define primeiro o valor total da reserva.",400],
 service_not_found:["O serviço já não existe nesta viagem.",404],
 payment_not_found:["Este registo já não existe nesta viagem.",404],
 payment_plan_exists:["Já existe um plano. Edita as prestações existentes.",409],
 invalid_deposit:["O sinal deve estar entre zero e o valor total da reserva.",400],
 invalid_payment_dates:["O prazo do restante valor tem de ser igual ou posterior ao prazo do sinal.",400],
 payment_future_receipt:["A data do movimento não pode estar no futuro.",400],
 refund_exceeds_received:["O reembolso excede o valor recebido. Revê os movimentos.",409],
 commission_eur_only:["A calculadora usa reservas em euros.",400],
 stale_version:["Esta proposta já foi alterada. Reabre a ficha antes de guardar.",409],
 client_not_found:["O cliente já não existe.",404], lead_not_found:["O pedido já não existe.",404],
 proposal_not_found:["A proposta já não existe.",404], trip_not_found:["A viagem já não existe.",404],
 template_not_found:["O template já não existe ou está desativado.",404], task_not_found:["A tarefa já não existe.",404],
 manual_confirmation_required:["Regista a confirmação manual do cliente antes de continuar.",400],
 lead_client_mismatch:["O pedido pertence a outro cliente.",400],trip_client_mismatch:["O cliente não está associado à viagem.",400],trip_lead_mismatch:["O pedido não corresponde à viagem.",400],
 document_mismatch:["Escolhe um documento da ficha deste cliente ou viagem.",400],flight_managed_task:["Este lembrete é gerido pelo voo.",409],
 same_client:["Escolhe duas fichas diferentes.",400],invalid_template:["Revê os campos do template.",400],item_not_found:["Um item do template já não existe.",409],duplicate_item:["Há itens repetidos no template.",400],
 not_template_task:["Esta tarefa não está ligada a um template.",400]
};
export async function rpc<T>(config: Config, name: string, body: unknown): Promise<T> {
 const response=await fetch(config.url + "/rest/v1/rpc/" + name,{method:"POST",headers:config.headers,body:JSON.stringify(body),cache:"no-store"});
 if(!response.ok) {
  const error=await response.json().catch(()=>({})) as {message?:string;code?:string};
  const match=Object.keys(messages).find(key=>error.message?.includes(key));
  if(match)throw new CrmError(...messages[match]);
  if(error.code==="23505")throw new CrmError("Já existe um registo com estes dados.",409);
  if(["23514","23502","22P02","22007","22008"].includes(error.code || ""))throw new CrmError("Revê os campos e as datas.");
  throw new CrmError("Não foi possível guardar as alterações.",502);
 }
 return response.status===204 ? undefined as T : response.json() as Promise<T>;
}
export async function setArchived(config: Config, table: "crm_leads" | "crm_trips", id: string, archived: boolean) {
  const updatedAt = new Date().toISOString();
  const query = new URLSearchParams({ id: "eq." + id, select: "archived_at" });
  const response = await fetch(config.url + "/rest/v1/" + table + "?" + query, {
    method: "PATCH",
    headers: { ...config.headers, Prefer: "return=representation" },
    body: JSON.stringify({ archived_at: archived ? updatedAt : null, updated_at: updatedAt }),
    cache: "no-store",
  });
  if (!response.ok) throw new CrmError("Não foi possível atualizar o arquivo.", 502);
  const [record] = await response.json() as { archived_at: string | null }[];
  if (!record) throw new CrmError("O registo já não existe.", 404);
  return privateJson(record);
}

export async function rows<T>(config: Config, table: string, query: URLSearchParams): Promise<T[]> {
  const result: T[] = [];
  const pageSize = 500;
  let total: number | undefined;
  while (total === undefined || result.length < total) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set("limit", String(pageSize));
    pageQuery.set("offset", String(result.length));
    const response = await fetch(config.url + "/rest/v1/" + table + "?" + pageQuery, {
      headers: result.length ? config.headers : { ...config.headers, Prefer: "count=exact" }, cache: "no-store",
    });
    if (!response.ok) throw new CrmError("Não foi possível carregar os registos.", 502);
    const page = await response.json() as T[];
    if (!page.length) return result;
    result.push(...page);
    const count = response.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
    if (count !== undefined) total = Number(count);
    if (total === undefined && !response.headers.has("content-range") && page.length < pageSize) return result;
  }
  return result;
}
