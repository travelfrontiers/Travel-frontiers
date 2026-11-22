"use client";

import { useState } from "react";
import { ItineraryPdfReview } from "@/sanity/actions/ItineraryPdfReview";
import CrmEmailPanel from "./crm-email-panel";
import { officeSecondary, type AuthorizedFetch } from "@/lib/crm-office-types";

export type FlowEmail = { trip_id:string; template_key:string; state:string; recipient:string; occurred_at:string; proposal_version:number|null };

export function emailStatus(message?: FlowEmail) {
  if (!message) return "Por enviar";
  const state = message.state === "sent" ? "Enviado" : "A confirmar no correio";
  return [state, new Date(message.occurred_at).toLocaleDateString("pt-PT"), message.recipient,
    message.proposal_version && "v" + message.proposal_version].filter(Boolean).join(" · ");
}

export function ReservationFlow({id,title,paid,delivered,messages,authorizedFetch,onUpdated,onPayment,onProposals}:{
  id:string;title:string;paid:boolean|null;delivered:boolean;messages:FlowEmail[]|null;authorizedFetch:AuthorizedFetch;
  onUpdated:()=>Promise<void>;onPayment:()=>void;onProposals:()=>void;
}) {
  const [source,setSource]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function act(action:"prepare"|"delivered") {
    setBusy(true); setError("");
    try {
      const response=await authorizedFetch("/api/crm/reservation-flow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,trip_id:id})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error);
      if(action==="prepare") setSource(result.key);
      else await onUpdated();
    } catch(e){setError(e instanceof Error?e.message:"Não foi possível concluir a ação.");}
    finally{setBusy(false);}
  }
  const pre=messages?.find(m=>m.template_key==="precontract");
  const post=messages?.find(m=>m.template_key==="booking");
  const quote=messages?.find(m=>m.template_key==="quote");
  return <section className="mb-4 space-y-3 rounded-xl border border-slate-200 p-4">
    <h3 className="font-semibold">Proposta e entregas ao cliente</h3>
    <button type="button" className={officeSecondary} onClick={onProposals}>{quote?"Acompanhar proposta":"Abrir propostas da viagem"}</button>
    {quote && <p className="text-sm">Orçamento · {emailStatus(quote)}</p>}
    <p className="text-sm">Email pré-contratual obrigatório · {messages?emailStatus(pre):"Estado indisponível"}</p>
    <CrmEmailPanel scope="trip" id={id} authorizedFetch={authorizedFetch} shortcut="precontract" onSent={onUpdated} />
    {paid ? <>
      <p className="text-sm">Email pós-contratual obrigatório · {messages?emailStatus(post):"Estado indisponível"}</p>
      <CrmEmailPanel scope="trip" id={id} authorizedFetch={authorizedFetch} shortcut="booking" onSent={onUpdated} />
      <p className="text-sm">Roteiro · {delivered?"Entregue ao cliente":"Por entregar"}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={officeSecondary} disabled={busy} onClick={()=>void act("prepare")}>{source?"Atualizar dados de origem":"Preparar roteiro"}</button>
        {!delivered && <button type="button" className={officeSecondary} disabled={busy} onClick={()=>void act("delivered")}>Marcar roteiro como entregue</button>}
      </div>
      {source && <ItineraryPdfReview id={"crm-"+id} source={source} title={title} notes="" onDirty={()=>{}} />}
    </> : <p className="text-sm">{paid===null?"A confirmar os pagamentos.":"A aguardar o primeiro pagamento para preparar o roteiro e o email pós-contratual."} <button type="button" className="underline" onClick={onPayment}>Ver pagamentos</button></p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
