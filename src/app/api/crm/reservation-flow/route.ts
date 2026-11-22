import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { crmConfig, CrmError, failure, payload, privateJson, rows, uuid } from "@/lib/crm-office-api";
import { savePrivateSource } from "@/lib/itinerary-source";
import type { BookingDetails } from "@/lib/crm-booking-details";

import { deliveryTaskId } from "@/lib/crm-reservation-flow";

export async function GET(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const messages = await rows<{trip_id:string;template_key:string;state:string;occurred_at:string;recipient:string;proposal_version:number|null}>(config,"crm_emails",
      new URLSearchParams({select:"trip_id,template_key,state,occurred_at,recipient,proposal_version",trip_id:"not.is.null",direction:"eq.out",
        template_key:"in.(quote,precontract,booking)",state:"in.(sent,uncertain,sending)",order:"occurred_at.desc,id.desc"}));
    return privateJson({messages});
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const {trip_id:id,action} = await payload(request);
    if (!uuid(id) || !["prepare","delivered"].includes(String(action))) throw new CrmError("Ação inválida.");
    const [trip] = await rows<{destination:string;departure_date:string;return_date:string;customer_received:number;status:string;archived_at:string|null}>(
      config,"crm_commission_overview",new URLSearchParams({select:"destination,departure_date,return_date,customer_received,status,archived_at",trip_id:"eq."+id}));
    if (!trip || trip.archived_at || trip.status==="cancelled" || !(trip.customer_received>0)) throw new CrmError("É necessário um primeiro pagamento do cliente numa viagem ativa.",409);
    if (action==="delivered") {
      const response=await fetch(config.url+"/rest/v1/crm_trip_tasks?on_conflict=id",{method:"POST",headers:{...config.headers,Prefer:"resolution=merge-duplicates,return=minimal"},
        body:JSON.stringify({id:deliveryTaskId(id),trip_id:id,title:"Roteiro entregue ao cliente",completed:true,sort_order:100}),cache:"no-store"});
      if(!response.ok) throw new CrmError("Não foi possível registar a entrega.",502);
      return privateJson({ok:true});
    }
    const services=await rows<{title:string;service_type:string;provider:string;starts_on:string;ends_on:string;booking:BookingDetails|null}>(config,"crm_trip_services",
      new URLSearchParams({trip_id:"eq."+id,select:"title,service_type,provider,starts_on,ends_on,booking",order:"starts_on.asc.nullslast,sort_order,id"}));
    const source=JSON.stringify({destino:trip.destination,partida:trip.departure_date,regresso:trip.return_date,
      servicos:services.filter(s=>s.booking?.status!=="cancelled").map(s=>{
        const b=s.booking??{};
        return {tipo:s.service_type,nome:s.title,fornecedor:s.provider,inicio:s.starts_on,fim:s.ends_on,estado:b.status??"pending",
          cidade:b.city,origem:b.origin,destino:b.destination_airport??b.destination,voo:b.flight_number,partida:b.departure_time,
          chegada:b.arrival_time,fuso_partida:b.departure_zone,fuso_chegada:b.arrival_zone,regime:b.board};
      })},null,2);
    const key=createHash("sha256").update(id).update(source).digest("hex")+".txt";
    await savePrivateSource(key,Buffer.from(source));
    return privateJson({key});
  } catch(error){return failure(error);}
}
