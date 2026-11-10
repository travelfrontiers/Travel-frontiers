"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {addDays,lisbonDay} from "@/lib/crm-calendar";
import {roundEuro,type CommissionInputs} from "@/lib/commission";
import {formatMoney,formatFinanceDate,receiptKinds,receiptMethods,receiptParties,type FinanceDetail,type FinanceSummary,type PaymentSchedule,type Receipt} from "@/lib/crm-finance";
import {officeInput as input,officeButton as primary,officeSecondary as secondary,type AuthorizedFetch} from "@/lib/crm-office-types";
import {TripCommissionCalculator} from "./commission-calculator";
import CrmDriveDocuments from "./crm-drive-documents";

const panel="rounded-2xl border border-slate-200 bg-white p-5";
const field="block space-y-1 text-sm font-medium";
const todayInLisbon=()=>lisbonDay(new Date().toISOString());
const tripLabel=(trip:FinanceSummary)=>[trip.destination||"Destino por definir",trip.client_name,trip.reference].filter(Boolean).join(" · ");
type Mutation=(action:string,data?:Record<string,unknown>)=>Promise<void>;
type Editor={type:"total"}|{type:"plan"}|{type:"commission"}|{type:"schedule";item?:PaymentSchedule}|{type:"receipt";item?:Receipt;commission?:boolean};

function useFinanceList(authorizedFetch:AuthorizedFetch,alerts=false) {
  const [trips,setTrips]=useState<FinanceSummary[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    setError("");
    authorizedFetch("/api/crm/finance"+(alerts?"?alerts=true":""),{signal:controller.signal})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok) throw new Error(data.error);
        if(!controller.signal.aborted) setTrips(data.trips);
      })
      .catch(cause=>{if(!controller.signal.aborted)setError(cause.message||"Não foi possível carregar os pagamentos.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[authorizedFetch,alerts]);
  return {trips,loading,error};
}

export function CrmPaymentAlerts({authorizedFetch,onOpen}:{authorizedFetch:AuthorizedFetch;onOpen:(tripId:string)=>void}) {
  const {trips,loading,error}=useFinanceList(authorizedFetch,true);
  return <section className={panel}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-bold">Pagamentos a acompanhar</h3>
        <p className="text-sm text-slate-500">Prestações atrasadas ou com prazo nos próximos 7 dias.</p></div>
      <button className={secondary} onClick={()=>onOpen("")}>Ver pagamentos</button>
    </div>
    {loading?<p className="mt-3 text-sm text-slate-500" role="status">A carregar prazos…</p>:error?<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>:
      trips.length===0?<p className="mt-3 text-sm text-slate-500">Sem pagamentos a acompanhar.</p>:
      <ul className="mt-4 space-y-2">
        {trips.slice(0,6).map(trip=><li key={trip.trip_id}>
          <button onClick={()=>onOpen(trip.trip_id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left">
            <span><strong className="block text-sm">{tripLabel(trip)}</strong><span className="text-xs text-slate-500">Prazo {trip.next_due_on?formatFinanceDate(trip.next_due_on):"por definir"}</span></span>
            <span className={trip.overdue_amount>0?"text-sm font-semibold text-red-700":"text-sm font-semibold text-orange-800"}>
              {trip.overdue_amount>0?formatMoney(trip.overdue_amount,trip.currency)+" em atraso":formatMoney(trip.due_soon_amount,trip.currency)+" a vencer"}
            </span>
          </button>
        </li>)}
      </ul>}
  </section>;
}

function FinanceOverview({authorizedFetch,onOpen}:{authorizedFetch:AuthorizedFetch;onOpen:(id:string)=>void}) {
  const {trips,loading,error}=useFinanceList(authorizedFetch);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const currencies=Array.from(new Set(trips.filter(trip=>trip.status!=="cancelled").map(trip=>trip.currency))).sort();
  const visible=trips.filter(trip=>{
    const text=tripLabel(trip).toLocaleLowerCase("pt-PT");
    if(!text.includes(query.trim().toLocaleLowerCase("pt-PT"))) return false;
    if(filter==="overdue") return trip.status!=="cancelled"&&trip.overdue_amount>0;
    if(filter==="upcoming") return trip.status!=="cancelled"&&trip.due_soon_amount>0;
    if(filter==="pending") return trip.status!=="cancelled"&&Number(trip.balance)>0;
    return true;
  });
  return <section className="space-y-5">
    <div><h2 className="text-2xl font-bold">Pagamentos e comissão</h2>
      <p className="text-sm text-slate-500">Abre uma viagem para gerir as prestações, os recebimentos e o cálculo da comissão.</p></div>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {currencies.map(currency=>{
      const group=trips.filter(trip=>trip.currency===currency&&trip.status!=="cancelled");
      const total=(getValue:(trip:FinanceSummary)=>number)=>formatMoney(roundEuro(group.reduce((sum,trip)=>sum+getValue(trip),0)),currency);
      return <div key={currency} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyCard label="Recebido de clientes" value={total(trip=>trip.customer_net)}/>
        <MoneyCard label="Saldo de clientes em falta" value={total(trip=>Math.max(0,trip.balance??0))}/>
        <MoneyCard label="Prestações em atraso" value={total(trip=>trip.overdue_amount)} warning={group.some(trip=>trip.overdue_amount>0)}/>
        <MoneyCard label="Comissão recebida" value={total(trip=>trip.commission_net)}/>
      </div>;
    })}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={field}>Pesquisar viagem<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Destino, cliente ou referência" className={input}/></label>
      <label className={field}>Situação<select value={filter} onChange={event=>setFilter(event.target.value)} className={input}>
        <option value="all">Todas</option><option value="pending">Com saldo em falta</option><option value="overdue">Em atraso</option><option value="upcoming">A vencer em 7 dias</option>
      </select></label>
    </div>
    {loading?<p role="status">A carregar pagamentos…</p>:!error&&visible.length===0?<p className={panel+" text-sm text-slate-500"}>{trips.length?"Sem viagens para estes filtros.":"Cria uma viagem em «Viagens e checklist» para começar."}</p>:
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(trip=><li key={trip.trip_id}>
          <button className={panel+" w-full text-left hover:border-orange-300"} onClick={()=>onOpen(trip.trip_id)}>
            <span className="block font-semibold">{tripLabel(trip)}</span>
            <span className="mt-2 block text-sm text-slate-500">{trip.status==="cancelled"?"Cancelada · ":""}Reserva {formatMoney(trip.total_amount,trip.currency)}</span>
            <span className="mt-2 block font-semibold text-orange-800">{trip.balance!==null&&trip.balance<0?"Excedente "+formatMoney(-trip.balance,trip.currency):"Em falta "+formatMoney(trip.balance,trip.currency)}</span>
            {trip.overdue_amount>0&&trip.status!=="cancelled"&&<span className="text-sm text-red-700">{formatMoney(trip.overdue_amount,trip.currency)} em atraso</span>}
          </button>
        </li>)}
      </ul>}
  </section>;
}

function MoneyCard({label,value,warning=false}:{label:string;value:string;warning?:boolean}) {
  return <div className={panel}><p className="text-sm text-slate-500">{label}</p>
    <p className={"mt-2 text-xl font-bold tabular-nums "+(warning?"text-red-700":"")}>{value}</p></div>;
}

function PaymentEditor({editor,detail,busy,onSubmit,onClose}:{editor:Exclude<Editor,{type:"commission"}>;detail:FinanceDetail;busy:boolean;onSubmit:Mutation;onClose:()=>void}) {
  const total=detail.summary.total_amount??0;
  const [deposit,setDeposit]=useState("0");
  const [kind,setKind]=useState<Receipt["kind"]>(editor.type==="receipt"?editor.item?.kind||(editor.commission?"commission_payment":"customer_payment"):"customer_payment");
  const currency=detail.summary.currency;
  const today=todayInLisbon();
  const titles={total:"Valor total da reserva",plan:"Criar plano de pagamento",schedule:editor.type==="schedule"&&editor.item?"Editar prestação":"Adicionar prestação",receipt:editor.type==="receipt"&&editor.item?"Editar movimento":"Registar movimento"};
  const actions={total:"total_save",plan:"build_plan",schedule:"schedule_save",receipt:"receipt_save"};
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.currentTarget).entries());
    const id=("item" in editor)?editor.item?.id:undefined;
    await onSubmit(actions[editor.type],{...values,id}).catch(()=>{});
  }
  return <form onSubmit={submit} className={panel+" space-y-4"}>
    <h3 className="text-lg font-semibold">{titles[editor.type]}</h3>
    {editor.type==="total"&&<label className={field}>Total ({currency})<input name="amount" type="number" min="0" max="9999999999.99" step="0.01" required defaultValue={detail.summary.total_amount??""} className={input}/></label>}
    {editor.type==="plan"&&<div className="grid gap-3 sm:grid-cols-3">
      <label className={field}>Sinal ({currency})<input name="deposit_amount" type="number" required min="0" max={total} step="0.01" value={deposit} onChange={event=>setDeposit(event.target.value)} className={input}/></label>
      {Number(deposit)>0&&<label className={field}>Prazo do sinal<input name="deposit_due_on" type="date" required className={input}/></label>}
      {Number(deposit)<total&&<label className={field}>Prazo de {formatMoney(roundEuro(total-Number(deposit)),currency)}<input name="balance_due_on" type="date" required className={input}/></label>}
    </div>}
    {editor.type==="schedule"&&<div className="grid gap-3 sm:grid-cols-3">
      <label className={field}>Designação<input name="label" required maxLength={160} defaultValue={editor.item?.label||""} placeholder="Ex.: segunda prestação" className={input}/></label>
      <label className={field}>Valor ({currency})<input name="amount" required type="number" min="0.01" step="0.01" max={total} defaultValue={editor.item?.amount??""} className={input}/></label>
      <label className={field}>Prazo<input name="due_on" type="date" required defaultValue={editor.item?.due_on||""} className={input}/></label>
    </div>}
    {editor.type==="receipt"&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className={field}>Tipo<select name="kind" value={kind} onChange={event=>setKind(event.target.value as Receipt["kind"])} className={input}>
        {Object.entries(receiptKinds).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className={field}>Valor ({currency})<input name="amount" required type="number" min="0.01" max="9999999999.99" step="0.01" defaultValue={editor.item?.amount??""} className={input}/></label>
      <label className={field}>Data do movimento<input name="paid_on" required type="date" max={today} defaultValue={editor.item?.paid_on||today} className={input}/></label>
      <label className={field}>Confirmado por<select name="received_by" defaultValue={editor.item?.received_by||"agency"} className={input}>{Object.entries(receiptParties).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className={field}>Meio<select name="method" defaultValue={editor.item?.method||"transfer"} className={input}>{Object.entries(receiptMethods).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className={field}>Referência<input name="reference" maxLength={160} defaultValue={editor.item?.reference||""} className={input}/></label>
      <label className={field+" sm:col-span-2"}>Comprovativo no Drive<select name="document_id" defaultValue={editor.item?.document_id||""} className={input}><option value="">Sem comprovativo associado</option>{detail.files.map(file=><option key={file.id} value={file.id}>{file.file_name}</option>)}</select></label>
      <label className={field+" sm:col-span-2 lg:col-span-3"}>Notas<textarea name="notes" maxLength={2000} rows={2} defaultValue={editor.item?.notes||""} className={input}/></label>
    </div>}
    <div className="flex gap-2"><button disabled={busy} className={primary}>{busy?"A guardar…":"Guardar"}</button><button type="button" disabled={busy} className={secondary} onClick={onClose}>Cancelar</button></div>
  </form>;
}

function FinanceTrip({authorizedFetch,tripId,theme,onChanged,onBack,onOpenTrip}:{authorizedFetch:AuthorizedFetch;tripId:string;theme:"light"|"dark";onChanged:()=>Promise<void>;onBack:()=>void;onOpenTrip:()=>void}) {
  const [detail,setDetail]=useState<FinanceDetail|null>(null);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const editorRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(editor&&editor.type!=="commission") editorRef.current?.scrollIntoView({block:"nearest",behavior:"smooth"});
  },[editor]);
  const getDetail=useCallback(async(signal?:AbortSignal)=>{
    const response=await authorizedFetch("/api/crm/finance?trip_id="+encodeURIComponent(tripId),{signal});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||"Não foi possível carregar a ficha financeira.");
    if(!signal?.aborted) setDetail(data);
  },[authorizedFetch,tripId]);
  useEffect(()=>{
    const controller=new AbortController();
    getDetail(controller.signal).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[getDetail]);

  async function mutate(action:string,data:Record<string,unknown>={}) {
    if(!detail||busy) return;
    setBusy(true);setError("");setMessage("");
    try {
      const response=await authorizedFetch("/api/crm/finance",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...data,action,trip_id:tripId,expected_version:detail.summary.version})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Não foi possível guardar.");
      setEditor(null);
      setMessage("Alterações guardadas.");
      await Promise.all([getDetail(),onChanged()]);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Não foi possível guardar.");
      throw cause;
    } finally {setBusy(false);}
  }
  function remove(action:string,id?:string) {
    if(window.confirm("Remover este registo da ficha financeira? Os saldos serão recalculados.")) void mutate(action,{id}).catch(()=>{});
  }
  async function reload() {
    setError("");setLoading(true);
    try{await getDetail();}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível atualizar.");}
    finally{setLoading(false);}
  }
  const back=<div className="flex flex-wrap gap-2"><button className={secondary} onClick={onBack}>← Todos os pagamentos</button><button className={secondary} onClick={onOpenTrip}>Abrir viagem</button><button className={secondary} disabled={loading||busy} onClick={()=>void reload()}>Atualizar ficha</button></div>;
  if(!detail) return <div className="space-y-4">{back}{loading?<p role="status">A carregar ficha…</p>:<p role="alert" className="text-red-700">{error}</p>}</div>;
  const summary=detail.summary,currency=summary.currency;
  const today=todayInLisbon(),soon=addDays(today,7);
  const people=(detail.adults??0)+(detail.children_count??0)||detail.traveler_count||1;
  const initialValues:CommissionInputs=detail.commission?.inputs||{commission:0,travelerCount:people,
    travelerPrice:roundEuro((summary.total_amount??0)/people),selfTravels:false,costPerTraveler:0,shareSaving:false,cedeCommission:false,requestedCession:0};
  const previous=detail.commission?.source;
  const stale=Boolean(previous&&(previous.total_amount!==summary.total_amount||previous.adults!==detail.adults||previous.children_count!==detail.children_count));
  const receiptGroups=([false,true] as const).map(commission=>({commission,items:detail.receipts.filter(item=>item.kind.startsWith("commission_")===commission)}));
  return <section className="space-y-5">
    {back}
    <div><h2 className="text-2xl font-bold">{tripLabel(summary)}</h2><p className="text-sm text-slate-500">Ficha financeira · {currency}{summary.status==="cancelled"?" · Viagem cancelada":""}</p></div>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message&&<p role="status" className="text-sm text-orange-800">{message}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MoneyCard label="Total da reserva" value={formatMoney(summary.total_amount,currency)}/>
      <MoneyCard label="Recebido após reembolsos" value={formatMoney(summary.customer_net,currency)}/>
      <MoneyCard label={summary.balance!==null&&summary.balance<0?"Valor recebido a mais":"Saldo em falta"} value={formatMoney(summary.balance===null?null:Math.abs(summary.balance),currency)}/>
      <MoneyCard label="Prestações em atraso" value={formatMoney(summary.overdue_amount,currency)} warning={summary.overdue_amount>0}/>
    </div>
    <div className="flex flex-wrap gap-2">
      <button className={secondary} disabled={busy} onClick={()=>setEditor({type:"total"})}>Editar total da reserva</button>
      <button className={primary} disabled={busy||summary.total_amount===null} onClick={()=>setEditor({type:"receipt"})}>Registar pagamento</button>
    </div>
    {editor&&editor.type!=="commission"&&<div ref={editorRef}><PaymentEditor key={editor.type+("item" in editor?editor.item?.id||String(editor.type==="receipt"&&editor.commission):"")} editor={editor} detail={detail} busy={busy} onSubmit={mutate} onClose={()=>setEditor(null)}/></div>}
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg font-bold">Plano de prestações</h3>
          <p className="text-sm text-slate-500">Os pagamentos abatem às prestações por ordem de vencimento.</p>
          {Number(summary.unscheduled_amount)>0&&<p className="mt-1 text-sm text-orange-800">{formatMoney(summary.unscheduled_amount,currency)} ainda sem prazo.</p>}</div>
        <div className="flex flex-wrap gap-2">
          {detail.schedule.length===0&&<button className={secondary} disabled={busy||!summary.total_amount} onClick={()=>setEditor({type:"plan"})}>Criar sinal e restante valor</button>}
          <button className={secondary} disabled={busy||!summary.total_amount} onClick={()=>setEditor({type:"schedule"})}>Adicionar prestação</button>
        </div>
      </div>
      {detail.schedule.length===0?<p className="mt-4 text-sm text-slate-500">Ainda não há prestações.</p>:<ul className="mt-4 divide-y divide-slate-200">
        {detail.schedule.map(item=>{
          const settled=item.amount_remaining===0;
          const overdue=!settled&&item.due_on<today;
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-semibold">{item.label} · {formatMoney(item.amount,currency)}</p>
              <p className={"text-sm "+(overdue?"text-red-700":"text-slate-500")}>{formatFinanceDate(item.due_on)} · {settled?"Paga":overdue?"Em atraso":item.due_on<=soon?"A vencer":"Por pagar"}{!settled?" · "+formatMoney(item.amount_remaining,currency)+" em falta":""}</p></div>
            <div className="flex gap-2"><button className={secondary} disabled={busy} onClick={()=>setEditor({type:"schedule",item})}>Editar</button><button className={secondary} disabled={busy} onClick={()=>remove("schedule_delete",item.id)}>Remover</button></div>
          </li>;
        })}
      </ul>}
    </section>
    <section className={panel+" space-y-4"}>
      <div className="flex flex-wrap justify-between gap-3">
        <div><h3 className="text-lg font-bold">Comissão da viagem</h3>
          <p className="text-sm text-slate-500">{currency==="EUR"?"Usa a calculadora para guardar a estimativa nesta viagem.":"A calculadora está disponível para viagens em euros."}</p></div>
        {currency==="EUR"&&<button className={primary} disabled={busy} onClick={()=>setEditor(editor?.type==="commission"?null:{type:"commission"})}>{editor?.type==="commission"?"Fechar calculadora":detail.commission?"Rever cálculo":"Abrir calculadora"}</button>}
      </div>
      {stale&&<p role="status" className="text-sm text-orange-800">O total ou o número de viajantes mudou depois do cálculo. Revê os dados da comissão.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyCard label="Comissão líquida estimada" value={summary.commission_expected===null?"Por calcular":formatMoney(summary.commission_expected,currency)}/>
        <MoneyCard label="Comissão recebida" value={formatMoney(summary.commission_net,currency)}/>
        <MoneyCard label={Number(summary.commission_balance)<0?"Acima da estimativa":"Comissão por receber"} value={summary.commission_balance===null?"Por calcular":formatMoney(Math.abs(summary.commission_balance),currency)}/>
      </div>
      {editor?.type==="commission"&&<TripCommissionCalculator initialValues={initialValues} theme={theme}
        onSave={(inputs,apply_to_total)=>mutate("commission_save",{inputs,apply_to_total})}/>}
      {detail.commission&&<button className={secondary} disabled={busy} onClick={()=>remove("commission_clear")}>Remover cálculo guardado</button>}
    </section>
    {receiptGroups.map(({commission,items})=><section key={String(commission)} className={panel}>
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="text-lg font-bold">{commission?"Movimentos de comissão":"Pagamentos e reembolsos do cliente"}</h3>
        <button className={secondary} disabled={busy||(!commission&&summary.total_amount===null)} onClick={()=>setEditor({type:"receipt",commission})}>{commission?"Registar comissão":"Adicionar movimento"}</button>
      </div>
      {items.length===0?<p className="mt-3 text-sm text-slate-500">Sem movimentos registados.</p>:<ul className="mt-3 divide-y divide-slate-200">
        {items.map(item=>{
          const file=detail.files.find(entry=>entry.id===item.document_id);
          return <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{receiptKinds[item.kind]} · {formatMoney(item.amount,currency)}</p>
              <p className="text-sm text-slate-500">{formatFinanceDate(item.paid_on)} · {receiptMethods[item.method]} · Confirmado por {receiptParties[item.received_by]}{item.reference?" · "+item.reference:""}</p>
              {item.notes&&<p className="whitespace-pre-wrap text-sm">{item.notes}</p>}
              {file&&<a className="text-sm text-orange-800 underline" href={"https://drive.google.com/file/d/"+encodeURIComponent(file.drive_file_id)+"/view"} target="_blank" rel="noreferrer">Abrir comprovativo ↗</a>}
            </div>
            <div className="flex gap-2"><button className={secondary} disabled={busy} onClick={()=>setEditor({type:"receipt",item})}>Editar</button><button className={secondary} disabled={busy} onClick={()=>remove("receipt_delete",item.id)}>Remover</button></div>
          </li>;
        })}
      </ul>}
    </section>)}
    <section className={panel}>
      <h3 className="text-lg font-bold">Comprovativos</h3>
      <p className="text-sm text-slate-500">Carrega um comprovativo para o Drive e seleciona-o no movimento.</p>
      <CrmDriveDocuments authorizedFetch={authorizedFetch} tripId={tripId} title={summary.destination||"Viagem"} onUploaded={()=>void reload()}/>
    </section>
  </section>;
}

export default function CrmPayments({authorizedFetch,tripId,theme,onOpen,onChanged,onOpenTrip}:{
  authorizedFetch:AuthorizedFetch;tripId:string;theme:"light"|"dark";onOpen:(id:string)=>void;
  onChanged:()=>Promise<void>;onOpenTrip:(id:string)=>void;
}) {
  return tripId?<FinanceTrip key={tripId} authorizedFetch={authorizedFetch} tripId={tripId} theme={theme}
    onBack={()=>onOpen("")} onOpenTrip={()=>onOpenTrip(tripId)} onChanged={onChanged}/>:
    <FinanceOverview authorizedFetch={authorizedFetch} onOpen={onOpen}/>;
}
