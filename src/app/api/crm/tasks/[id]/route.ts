import {NextRequest} from "next/server";
import {crmConfig,payload,failure,privateJson,uuid,dateOnly,rpc,CrmError,rows} from "@/lib/crm-office-api";
import {lisbonDay} from "@/lib/crm-calendar";
export const runtime="nodejs";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const config=await crmConfig(request),{id}=await params;if(!uuid(id))throw new CrmError("Tarefa inválida.");
 const body=await payload(request),title=typeof body.title==="string"?body.title.trim():"",due=body.due_date;
 if(!title||title.length>240||typeof body.completed!=="boolean"||!(due===null||dateOnly(due)))throw new CrmError("Revê o nome, a data e o estado da tarefa.");
 const current=(await rows<{id:string;source_service_id:string|null;template_item_id:string|null;template_override:boolean;title:string;due_at:string|null}>(config,"crm_trip_tasks",new URLSearchParams({id:"eq."+id,select:"id,source_service_id,template_item_id,template_override,title,due_at"})))[0];
 if(!current)throw new CrmError("A tarefa já não existe.",404);
 const sameDay=(current.due_at?lisbonDay(current.due_at):null)===due,edited=current.title!==title||!sameDay;
 const fields=current.source_service_id?{completed:body.completed}:{title,completed:body.completed,due_at:sameDay?current.due_at:due?due+"T12:00:00Z":null,...(current.template_item_id?{template_override:current.template_override||edited}:{})};
 const r=await fetch(config.url+"/rest/v1/crm_trip_tasks?id=eq."+id+"&select=*",{method:"PATCH",headers:{...config.headers,Prefer:"return=representation"},body:JSON.stringify(fields),cache:"no-store"});
 if(!r.ok)throw new CrmError("Não foi possível guardar a tarefa.",502);
 const task=(await r.json())[0];if(!task)throw new CrmError("A tarefa já não existe.",404);
 return privateJson({task});
}catch(cause){return failure(cause);}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const config=await crmConfig(request),{id}=await params;if(!uuid(id))throw new CrmError("Tarefa inválida.");
 await rpc(config,"crm_delete_task",{p_id:id});return privateJson({ok:true});
}catch(cause){return failure(cause);}}
