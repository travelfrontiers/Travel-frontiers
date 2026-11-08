import {NextRequest} from "next/server";
import {crmConfig,payload,failure,privateJson,rpc,rows,uuid,nullableId,travelTypes,CrmError} from "@/lib/crm-office-api";
export const runtime="nodejs";
export async function GET(request:NextRequest){try{
 const config=await crmConfig(request);
 const [templates,items]=await Promise.all([
 rows<Record<string,unknown>>(config,"crm_checklist_templates",new URLSearchParams({select:"*",order:"name.asc,id"})),
 rows<{template_id:string;active:boolean}>(config,"crm_checklist_items",new URLSearchParams({select:"*",active:"eq.true",order:"sort_order.asc,id"}))
 ]);
 return privateJson({templates:templates.map(t=>({...t,items:items.filter(i=>i.template_id===t.id)}))});
}catch(cause){return failure(cause);}}
export async function POST(request:NextRequest){try{
 const config=await crmConfig(request),body=await payload(request);
 if(body.action==="apply"){
  if(!uuid(body.trip_id)||!uuid(body.template_id))throw new CrmError("Viagem ou template inválido.");
  await rpc(config,"crm_sync_trip_checklists",{p_trip_id:body.trip_id,p_template_id:body.template_id});return privateJson({ok:true});
 }
 if(body.action==="reset_task"){
  if(!uuid(body.task_id))throw new CrmError("Tarefa inválida.");
  await rpc(config,"crm_reset_template_task",{p_id:body.task_id});return privateJson({ok:true});
 }
 if(body.action!=="save"||!nullableId(body.id)||typeof body.name!=="string"||body.name.trim().length<2||body.name.trim().length>160||
 !["all",...travelTypes].includes(String(body.travel_type))||typeof body.active!=="boolean"||typeof body.auto_apply!=="boolean"||!Array.isArray(body.items)||body.items.length<1||body.items.length>40)throw new CrmError("Revê o nome, o tipo de viagem e os itens.");
 const ids=new Set<string>();
 const items=body.items.map((raw:unknown,index:number)=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new CrmError("Item inválido.");const item=raw as Record<string,unknown>;
  if(!nullableId(item.id)||typeof item.title!=="string"||item.title.trim().length<1||item.title.trim().length>240||
   !["departure","return","manual"].includes(String(item.anchor))||!["before","during","after"].includes(String(item.phase))||
   !Number.isInteger(item.offset_days)||Number(item.offset_days)<-365||Number(item.offset_days)>365)throw new CrmError("Revê as tarefas e os prazos do template.");
  if(item.id){if(ids.has(String(item.id)))throw new CrmError("Há itens repetidos.");ids.add(String(item.id));}
  return {id:item.id||null,title:item.title.trim(),anchor:item.anchor,phase:item.phase,offset_days:item.offset_days,sort_order:(index+1)*10};
 });
 const id=await rpc(config,"crm_save_checklist_template",{p_id:body.id||null,p_name:body.name.trim(),p_travel_type:body.travel_type,p_active:body.active,p_auto_apply:body.auto_apply,p_items:items});
 return privateJson({id});
}catch(cause){return failure(cause);}}

