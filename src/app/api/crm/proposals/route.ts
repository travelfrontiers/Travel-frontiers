import { normalizeTripServices } from "@/lib/crm-trip-services";
import { NextRequest } from "next/server";
import { crmConfig,payload,failure,privateJson,rpc,uuid,nullableId,optionalDate,CrmError } from "@/lib/crm-office-api";
export const runtime="nodejs";
export async function GET(request:NextRequest) { try {
 const config=await crmConfig(request),q=request.nextUrl.searchParams,id=q.get("id");
 if(id) {
  if(!uuid(id))throw new CrmError("Proposta inválida.");
  const response=await fetch(config.url+"/rest/v1/crm_proposals?id=eq."+id+"&select=*",{headers:config.headers,cache:"no-store"});
  if(!response.ok)throw new CrmError("Não foi possível carregar a proposta.",502);
  const proposal=(await response.json())[0];if(!proposal)throw new CrmError("A proposta já não existe.",404);
  const filesFilter=[proposal.client_id?"client_id.eq."+proposal.client_id:null,proposal.trip_id?"trip_id.eq."+proposal.trip_id:null].filter(Boolean).join(",");
  const [v,files]=await Promise.all([
   fetch(config.url+"/rest/v1/crm_proposal_versions?proposal_id=eq."+id+"&select=*&order=version.desc",{headers:config.headers,cache:"no-store"}),
   filesFilter?fetch(config.url+"/rest/v1/crm_drive_files?or=("+filesFilter+")&select=id,file_name,drive_file_id&order=created_at.desc",{headers:config.headers,cache:"no-store"}):Promise.resolve(null)
  ]);
  if(!v.ok || files && !files.ok)throw new CrmError("Não foi possível carregar as versões.",502);
  return privateJson({proposal,versions:await v.json(),files:files?await files.json():[]});
 }
 const offset=Number(q.get("offset")||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new CrmError("Página inválida.");
 const params=new URLSearchParams({select:"*",order:"updated_at.desc,id",limit:"30",offset:String(offset)});
 const status=q.get("status");if(status){if(!["draft","sent","accepted","declined","archived"].includes(status))throw new CrmError("Estado inválido.");params.set("status","eq."+status);}
 const client=q.get("client_id");if(client){if(!uuid(client))throw new CrmError("Cliente inválido.");params.set("client_id","eq."+client);}
 const search=(q.get("q")||"").trim().slice(0,120).replace(/[*,%()]/g,"");if(search)params.set("title","ilike.*"+search+"*");
 const response=await fetch(config.url+"/rest/v1/crm_proposals_overview?"+params,{headers:{...config.headers,Prefer:"count=exact"},cache:"no-store"});
 if(!response.ok)throw new CrmError("Não foi possível carregar propostas.",502);
 return privateJson({proposals:await response.json(),total:Number(response.headers.get("content-range")?.split("/")[1]||0)});
 }catch(cause){return failure(cause);} }
export async function POST(request:NextRequest) { try {
 const config=await crmConfig(request),body=await payload(request);
 if(body.action==="save") {
  if(!nullableId(body.id)||!uuid(body.client_id)||!nullableId(body.lead_id)||!nullableId(body.trip_id)||!Number.isInteger(body.expected_version)||Number(body.expected_version)<0)throw new CrmError("Revê as associações e a versão.");
  const data=body.data as Record<string,unknown>;if(!data||typeof data!=="object"||Array.isArray(data))throw new CrmError("Dados inválidos.");
  const limits:Record<string,number>={title:240,destination:240,operator:160,conditions:4000,inclusions:4000,exclusions:4000,notes:4000};
  const clean:Record<string,unknown>={};for(const [key,max]of Object.entries(limits)){if(data[key]!==undefined&&data[key]!==null&&typeof data[key]!=="string")throw new CrmError("Texto inválido.");const value=typeof data[key]==="string"?(data[key] as string).trim():"";if(value.length>max)throw new CrmError("Um dos textos é demasiado longo.");clean[key]=value||null;}
  const amount=Number(data.total_amount);const currency=String(data.currency||"").trim().toUpperCase();
  if(!clean.title||data.total_amount===null||data.total_amount===""||!Number.isFinite(amount)||amount<0||amount>9999999999.99||!/^[A-Z]{3}$/.test(currency))throw new CrmError("Revê título, valor total e moeda.");
  for(const key of ["valid_until","departure_date","return_date"]){if(!optionalDate(data[key]))throw new CrmError("Indica datas válidas.");clean[key]=data[key]||null;}
  if(clean.departure_date&&clean.return_date&&String(clean.return_date)<String(clean.departure_date))throw new CrmError("O regresso não pode ser anterior à partida.");
  if(!nullableId(data.document_id))throw new CrmError("Documento inválido.");
  if (data.imported != null) {
   const imported = data.imported as Record<string, unknown>;
   const services = normalizeTripServices(imported.services);
   const reference = typeof imported.reference === "string" ? imported.reference.trim() : "";
   const adults = String(imported.adults ?? "");
   const children = String(imported.children_count ?? "");
   if (!services || reference.length > 80 || !/^(|[1-9]|1[0-9]|20)$/.test(adults) || !/^(|[0-9]|[12][0-9]|30)$/.test(children)) throw new CrmError("Revê os dados extraídos do PDF.");
   clean.imported = { reference, adults, children_count: children, services };
  }
  Object.assign(clean,{total_amount:amount,currency,document_id:data.document_id||null});
  const proposal=await rpc(config,"crm_save_proposal",{p_id:body.id||null,p_client_id:body.client_id,p_lead_id:body.lead_id||null,p_trip_id:body.trip_id||null,p_expected_version:body.expected_version,p_data:clean});
  return privateJson({proposal},body.id?200:201);
 }
 if(!uuid(body.id)||!Number.isInteger(body.version)||Number(body.version)<1)throw new CrmError("Proposta ou versão inválida.");
 if(body.action==="status"){
  if(!["draft","sent","accepted","declined","archived"].includes(String(body.status))||typeof body.note!=="string"||body.note.length>2000)throw new CrmError("Revê o estado e a confirmação.");
  return privateJson({proposal:await rpc(config,"crm_set_proposal_status",{p_id:body.id,p_version:body.version,p_status:body.status,p_note:body.note})});
 }
 if(body.action==="create_trip")return privateJson({trip_id:await rpc(config,"crm_proposal_to_trip",{p_id:body.id,p_version:body.version})});
 throw new CrmError("Ação inválida.");
 }catch(cause){return failure(cause);} }

