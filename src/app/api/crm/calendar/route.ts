import {NextRequest} from "next/server";
import {crmConfig,failure,privateJson,rows,dateOnly,CrmError} from "@/lib/crm-office-api";
import {addDays,lisbonDay} from "@/lib/crm-calendar";
import type {CalendarEntry} from "@/lib/crm-office-types";
export const runtime="nodejs";
type TripRow={id:string;destination:string|null;client_id:string|null;departure_date:string|null;return_date:string|null;crm_trip_clients:{client_id:string}[]};
export async function GET(request:NextRequest){try{
 const config=await crmConfig(request),from=request.nextUrl.searchParams.get("from"),to=request.nextUrl.searchParams.get("to");
 if(!dateOnly(from)||!dateOnly(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>62)throw new CrmError("Escolhe um intervalo até 63 dias.");
 const [trips,tasks,leads,docs,proposals]=await Promise.all([
 rows<TripRow>(config,"crm_trips",new URLSearchParams({select:"id,destination,client_id,departure_date,return_date,crm_trip_clients(client_id)",status:"not.in.(cancelled)",or:"(and(departure_date.gte."+from+",departure_date.lte."+to+"),and(return_date.gte."+from+",return_date.lte."+to+"))",order:"id"})),
 rows<{id:string;title:string;due_at:string;completed:boolean;crm_trips:TripRow}>(config,"crm_trip_tasks",new URLSearchParams({select:"id,title,due_at,completed,crm_trips!inner(id,destination,client_id,crm_trip_clients(client_id))","crm_trips.status":"neq.cancelled",due_at:"gte."+addDays(from,-1)+"T00:00:00Z",and:"(due_at.lt."+addDays(to,2)+"T00:00:00Z)",order:"id"})),
 rows<{id:string;full_name:string;destination:string|null;client_id:string|null;follow_up_date:string}>(config,"crm_leads",new URLSearchParams({select:"id,full_name,destination,client_id,follow_up_date",status:"not.in.(won,lost)",follow_up_date:"gte."+from,and:"(follow_up_date.lte."+to+")",order:"id"})),
 rows<{id:string;client_id:string;document_type:string;expires_on:string;crm_clients:{full_name:string}}>(config,"crm_client_documents",new URLSearchParams({select:"id,client_id,document_type,expires_on,crm_clients(full_name)",expires_on:"gte."+from,and:"(expires_on.lte."+to+")",order:"id"})),
 rows<{id:string;title:string;client_id:string|null;client_name:string|null;valid_until:string}>(config,"crm_proposals_overview",new URLSearchParams({select:"id,title,client_id,client_name,valid_until",status:"in.(draft,sent)",valid_until:"gte."+from,and:"(valid_until.lte."+to+")",order:"id"}))
 ]);
 const entries:CalendarEntry[]=[];
 const ids=(t:TripRow)=>Array.from(new Set([t.client_id,...(t.crm_trip_clients||[]).map(c=>c.client_id)].filter((id):id is string=>Boolean(id))));
 for(const t of trips)for(const [kind,date] of [["departure",t.departure_date],["return",t.return_date]] as const)if(date)entries.push({id:kind+"-"+t.id,date,title:t.destination||"Viagem",detail:kind==="departure"?"Partida":"Regresso",kind,done:false,target:{type:"trip",id:t.id},clientIds:ids(t)});
 for(const t of tasks)entries.push({id:t.id,date:lisbonDay(t.due_at),title:t.title,detail:t.crm_trips.destination||"Viagem",kind:"task",done:t.completed,target:{type:"trip",id:t.crm_trips.id,taskId:t.id},clientIds:ids(t.crm_trips)});
 for(const l of leads)entries.push({id:"lead-"+l.id,date:l.follow_up_date,title:l.full_name,detail:l.destination||"Próximo contacto",kind:"followup",done:false,target:{type:"lead",id:l.id},clientIds:l.client_id?[l.client_id]:[]});
 for(const d of docs)entries.push({id:"doc-"+d.id,date:d.expires_on,title:d.crm_clients?.full_name||"Cliente",detail:"Documento a renovar",kind:"document",done:false,target:{type:"client",id:d.client_id},clientIds:[d.client_id]});
 for(const p of proposals)entries.push({id:"proposal-"+p.id,date:p.valid_until,title:p.title,detail:p.client_name||"Proposta",kind:"proposal",done:false,target:{type:"proposal",id:p.id},clientIds:p.client_id?[p.client_id]:[]});
 return privateJson({entries:entries.filter(e=>e.date>=from&&e.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title))});
}catch(cause){return failure(cause);}}
