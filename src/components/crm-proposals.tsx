"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {officeInput as input,officeButton as button,officeSecondary as secondary,proposalStatusLabels,type AuthorizedFetch,type OfficeClient,type OfficeLead,type OfficeTrip,type Proposal,type ProposalVersion,type EntityContext,type OpenTarget} from "@/lib/crm-office-types";
import CrmEmailPanel, { type CrmEmailMessage } from "./crm-email-panel";
import CrmDriveDocuments from "./crm-drive-documents";
import type { TripPdfFields } from "@/lib/crm-trip-pdf";
type Document={id:string;file_name:string;drive_file_id:string};
type Draft={imported:Pick<TripPdfFields,"reference"|"services"|"adults"|"children_count">|null;client_id:string;lead_id:string;trip_id:string;title:string;total_amount:string;currency:string;valid_until:string;destination:string;departure_date:string;return_date:string;operator:string;conditions:string;inclusions:string;exclusions:string;notes:string;document_id:string};
type Props={authorizedFetch:AuthorizedFetch;clients:OfficeClient[];leads:OfficeLead[];trips:OfficeTrip[];initialId:string;tripFilter?:string;initialStatus?:string;initialContext:EntityContext|null;onChanged:()=>Promise<void>;onOpen:(target:OpenTarget)=>void;onHistory:(context:EntityContext)=>void};
const empty:Draft={imported:null,client_id:"",lead_id:"",trip_id:"",title:"",total_amount:"",currency:"EUR",valid_until:"",destination:"",departure_date:"",return_date:"",operator:"",conditions:"",inclusions:"",exclusions:"",notes:"",document_id:""};
const money=(amount:number|string|undefined,currency="EUR")=>{try{return new Intl.NumberFormat("pt-PT",{style:"currency",currency}).format(Number(amount||0));}catch{return String(amount)+" "+currency;}};
export default function CrmProposals({authorizedFetch,clients,leads,trips,initialId,tripFilter,initialStatus="",initialContext,onChanged,onOpen,onHistory}:Props){
 const [list,setList]=useState<Proposal[]>([]),[count,setCount]=useState(0),[offset,setOffset]=useState(0),[status,setStatus]=useState(initialStatus),[clientFilter,setClientFilter]=useState(""),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[proposal,setProposal]=useState<Proposal|null>(null),[versions,setVersions]=useState<ProposalVersion[]>([]),[version,setVersion]=useState(0),[files,setFiles]=useState<Document[]>([]),[draft,setDraft]=useState<Draft|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const [draftPdf, setDraftPdf] = useState<File | null>(null);
 const [proposalPdf, setProposalPdf] = useState<{ id: string; version: number; file: File } | null>(null);
 const statusForm = useRef<HTMLFormElement>(null);
 const loadList=useCallback(async()=>{setLoading(true);try{const q=new URLSearchParams({offset:String(offset),status,client_id:clientFilter,q:query,trip_id:tripFilter||""});const r=await authorizedFetch("/api/crm/proposals?"+q),d=await r.json();if(!r.ok)throw new Error(d.error);setList(d.proposals);setCount(d.total);}catch(c){setError(c instanceof Error?c.message:"Não foi possível carregar propostas.");}finally{setLoading(false);}},[authorizedFetch,offset,status,clientFilter,query,tripFilter]);
 useEffect(()=>{void loadList();},[loadList]);
 const open=useCallback(async(id:string)=>{setError("");setDraft(null);setDraftPdf(null);setBusy(true);try{const r=await authorizedFetch("/api/crm/proposals?id="+id),d=await r.json();if(!r.ok)throw new Error(d.error);setProposal(d.proposal);setVersions(d.versions);setVersion(d.proposal.current_version);setFiles(d.files);}catch(c){setError(c instanceof Error?c.message:"Não foi possível abrir a proposta.");}finally{setBusy(false);}},[authorizedFetch]);
 const contextType=initialContext?.type,contextId=initialContext?.id;
 useEffect(()=>{if(initialId){void open(initialId);return;}if(contextType&&contextId){
 const l=contextType==="lead"?leads.find(x=>x.id===contextId):null,t=contextType==="trip"?trips.find(x=>x.id===contextId):null;
 setProposal(null);setVersions([]);setFiles([]);setDraftPdf(null);setDraft({...empty,client_id:contextType==="client"?contextId:l?.client_id||t?.client_id||"",lead_id:l?.id||t?.lead_id||"",trip_id:t?.id||"",title:"Proposta · "+(l?.destination||t?.destination||"Nova viagem"),destination:l?.destination||t?.destination||"",departure_date:l?.departure_date||t?.departure_date||"",return_date:l?.return_date||t?.return_date||""});
 }},[initialId,contextType,contextId,open]); // Context is an explicit navigation request; later parent refreshes must not discard the draft.
 const draftClient=draft?.client_id,draftTrip=draft?.trip_id;
 useEffect(()=>{if(!draftClient&&!draftTrip)return;let active=true;
 const queries:URLSearchParams[]=[];if(draftClient)queries.push(new URLSearchParams({client_id:draftClient}));if(draftTrip)queries.push(new URLSearchParams({trip_id:draftTrip}));
 Promise.all(queries.map(async q=>{const r=await authorizedFetch("/api/crm/drive?"+q),d=await r.json();if(!r.ok)throw new Error(d.error);return d.files as Document[];})).then(groups=>{if(active)setFiles(Array.from(new Map(groups.flat().map(f=>[f.id,f])).values()));}).catch(c=>{if(active)setError(c.message||"Não foi possível carregar os documentos.");});return()=>{active=false;};},[authorizedFetch,draftClient,draftTrip]);
 async function post(body:unknown){const r=await authorizedFetch("/api/crm/proposals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw new Error(d.error);return d;}
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!draft)return;setBusy(true);setError("");setMessage("");try{let clientId = draft.client_id;
 if (!clientId && draft.lead_id) {
   const response = await authorizedFetch("/api/crm/leads/" + draft.lead_id + "/client", { method: "POST" });
   const result = await response.json();
   if (!response.ok || !result.client?.id) throw new Error(result.error || "Não foi possível associar o cliente do pedido.");
   clientId = result.client.id;
   setDraft(current => current ? { ...current, client_id: clientId } : current);
 }
 const d=await post({action:"save",id:proposal?.id||null,expected_version:proposal?.current_version||0,client_id:clientId,lead_id:draft.lead_id||null,trip_id:draft.trip_id||null,data:draft});
 if (draftPdf) setProposalPdf({ id: d.proposal.id, version: d.proposal.current_version, file: draftPdf });
 await open(d.proposal.id);await loadList();await onChanged();setMessage("Nova versão guardada. As versões anteriores mantêm-se disponíveis.");}catch(c){setError(c instanceof Error?c.message:"Não foi possível guardar.");}finally{setBusy(false);}}
 async function changeStatus(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!proposal)return;const d=new FormData(e.currentTarget);setBusy(true);setError("");try{await post({action:"status",id:proposal.id,version:proposal.current_version,status:d.get("status"),note:d.get("note")||""});await open(proposal.id);await loadList();await onChanged();setMessage("Estado atualizado.");}catch(c){setError(c instanceof Error?c.message:"Não foi possível atualizar.");}finally{setBusy(false);}}
 async function manageProposal(action:"archive"|"restore"|"delete") {
   if (!proposal || busy) return;
   if (action==="delete" && !window.confirm(`Apagar definitivamente a proposta “${proposal.title}” e as suas versões?`)) return;
   setBusy(true); setError(""); setMessage("");
   try {
     const result=await post({action,id:proposal.id,version:proposal.current_version,status:proposal.status});
     if (action==="delete") {
       setProposal(null); setVersions([]); setFiles([]); setProposalPdf(null);
     } else {
       setProposal(result.proposal);
     }
     setMessage({archive:"Proposta arquivada. Podes consultá-la no filtro Arquivadas.",restore:"Proposta restaurada.",delete:"Proposta apagada."}[action]);
     if (offset && list.length===1 && list[0].id===proposal.id) setOffset(Math.max(0,offset-30));
     else await loadList();
     await onChanged();
   } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a proposta."); }
   finally { setBusy(false); }
 }
 async function createTrip(){if(!proposal)return;setBusy(true);setError("");try{const d=await post({action:"create_trip",id:proposal.id,version:proposal.current_version});await onChanged();onOpen({type:"trip",id:d.trip_id});}catch(c){setError(c instanceof Error?c.message:"Não foi possível criar a viagem.");}finally{setBusy(false);}}
 function update(key:keyof Draft,value:string){setDraft(d=>d?{...d,[key]:value}:null);}
 async function importPdf(file: File) {
   setBusy(true);
   setError("");
   try {
     const form = new FormData();
     form.set("file", file);
     const response = await authorizedFetch("/api/crm/trips", { method: "POST", body: form });
     const result = await response.json();
     if (!response.ok) throw new Error(result.error);
     const fields = result.fields as TripPdfFields;
     setDraftPdf(file);
     setDraft(current => current ? {
       ...current, document_id: "", imported: { reference: fields.reference, services: fields.services, adults: fields.adults, children_count: fields.children_count },
       destination: fields.destination || current.destination, operator: fields.operator || current.operator,
       departure_date: fields.departure_date || current.departure_date, return_date: fields.return_date || current.return_date,
       total_amount: fields.total_amount || current.total_amount, currency: fields.currency || current.currency,
       title: current.title || "Proposta · " + (fields.destination || file.name),
     } : current);
     setMessage("PDF lido. Confirma os dados preenchidos antes de guardar.");
   } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler o PDF."); }
   finally { setBusy(false); }
 }
 function prepareAcceptance(message: CrmEmailMessage) {
   const form = statusForm.current;
   const statusField = form?.elements.namedItem("status");
   const noteField = form?.elements.namedItem("note");
   if (!(statusField instanceof HTMLSelectElement) || !(noteField instanceof HTMLTextAreaElement)) return;
   statusField.value = "accepted";
   noteField.value = ("Resposta de " + message.sender + " em " + new Date(message.occurred_at).toLocaleString("pt-PT") +
     "\nAssunto: " + message.subject + "\n\n" + message.body).slice(0, 2000);
   form?.scrollIntoView({ block: "nearest" });
   noteField.focus({ preventScroll: true });
 }
 function edit(){const v=versions.find(v=>v.version===proposal?.current_version);if(!proposal||!v)return;setDraftPdf(null);setDraft({...empty,...Object.fromEntries(Object.keys(empty).filter(key=>key!=="imported").map(key=>[key,String(v[key as keyof ProposalVersion]??"")])),imported:v.imported,client_id:proposal.client_id||"",lead_id:proposal.lead_id||"",trip_id:proposal.trip_id||""});}
 const viewed=versions.find(v=>v.version===version);
 const previousStatus=proposal?.status==="archived"?proposal.status_before_archive:proposal?.status;
 const showDelete=proposal && !proposal.trip_id && !proposal.confirmation_note && (previousStatus==="draft"||previousStatus==="declined");
 return <section className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold">Propostas e versões</h2><p className="text-sm text-slate-500">Valores, condições e validade em cada versão. A aceitação continua a ser confirmada por resposta manual ao email.</p></div><button className={button} disabled={busy} onClick={()=>{setProposal(null);setVersions([]);setFiles([]);setDraftPdf(null);setDraft({...empty});setMessage("");}}>Nova proposta</button></div>
 {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p role="status" className="text-orange-800">{message}</p>}
 <form onSubmit={e=>{e.preventDefault();setOffset(0);setQuery(search);}} className="grid gap-3 sm:grid-cols-4"><label className="text-sm">Pesquisar título<input value={search} onChange={e=>setSearch(e.target.value)} className={input}/></label><label className="text-sm">Estado<select value={status} onChange={e=>{setOffset(0);setStatus(e.target.value);}} className={input}><option value="">Todas exceto arquivadas</option>{Object.entries(proposalStatusLabels).map(([id,label])=><option key={id} value={id}>{id==="archived"?"Arquivadas":label}</option>)}</select></label><label className="text-sm">Cliente<select value={clientFilter} onChange={e=>{setOffset(0);setClientFilter(e.target.value);}} className={input}><option value="">Todos</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><button className={secondary}>Filtrar</button></form>
 {loading?<p role="status">A carregar…</p>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map(p=><button key={p.id} className={"rounded-2xl border bg-white p-5 text-left "+(proposal?.id===p.id?"border-orange-700":"border-slate-200")} onClick={()=>void open(p.id)}><span className="text-xs font-semibold uppercase text-orange-800">{proposalStatusLabels[p.status]} · v{p.current_version}</span><span className="mt-2 block font-bold">{p.title}</span><span className="block text-sm text-slate-500">{p.client_name||"Sem cliente"}{p.destination?" · "+p.destination:""}</span><span className="mt-3 block text-xl font-bold">{money(p.total_amount,p.currency)}</span>{p.valid_until&&<span className="block text-xs text-slate-500">Validade: {p.valid_until.split("-").reverse().join("/")}</span>}</button>)}{!list.length&&<p className="text-sm text-slate-500">Sem propostas para estes filtros.</p>}</div>}
 <div className="flex items-center gap-3"><button className={secondary} disabled={loading||!offset} onClick={()=>setOffset(Math.max(0,offset-30))}>Anterior</button><span className="text-sm">{count?offset+1:0}–{Math.min(offset+list.length,count)} de {count}</span><button className={secondary} disabled={loading||offset+30>=count} onClick={()=>setOffset(offset+30)}>Seguinte</button></div>
 {proposal&&!draft&&<article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h3 className="text-xl font-bold">{proposal.title}</h3><div className="flex flex-wrap gap-2">{proposal.status!=="archived" && <button className={secondary} disabled={busy} onClick={edit}>Criar nova versão</button>}
 {proposal.status!=="archived" && <button type="button" className={secondary} disabled={busy} onClick={()=>void manageProposal("archive")}>Arquivar proposta</button>}
 {proposal.status==="archived" && proposal.status_before_archive && <button type="button" className={secondary} disabled={busy} onClick={()=>void manageProposal("restore")}>Restaurar proposta</button>}
 {showDelete && <button type="button" className={secondary+" text-red-700"} disabled={busy} onClick={()=>void manageProposal("delete")}>Apagar proposta</button>}<button className={secondary} onClick={()=>onHistory({type:"proposal",id:proposal.id,label:proposal.title})}>Histórico</button>{proposal.client_id&&<button className={secondary} onClick={()=>onOpen({type:"client",id:proposal.client_id!})}>Cliente</button>}{proposal.trip_id&&<button className={secondary} onClick={()=>onOpen({type:"trip",id:proposal.trip_id!})}>Abrir viagem</button>}</div></div>
 <label className="block max-w-md text-sm">Versão a consultar<select value={version} onChange={e=>setVersion(Number(e.target.value))} className={input}>{versions.map(v=><option key={v.id} value={v.version}>Versão {v.version} · {new Date(v.created_at).toLocaleDateString("pt-PT")} · {money(v.total_amount,v.currency)}</option>)}</select></label>
 {viewed&&<div className="space-y-3 rounded-xl bg-slate-50 p-4"><p className="text-2xl font-bold">{money(viewed.total_amount,viewed.currency)}</p><p className="text-sm">{viewed.destination||"Destino por definir"} · {viewed.departure_date||"Partida por definir"} → {viewed.return_date||"Regresso por definir"}</p><p className="text-sm text-slate-500">Validade: {viewed.valid_until||"Não definida"} · Operador: {viewed.operator||"Não definido"}</p>{(["conditions","inclusions","exclusions","notes"] as const).map((key,i)=>viewed[key]&&<div key={key}><h4 className="text-sm font-semibold">{["Condições","Incluído","Excluído","Notas"][i]}</h4><p className="whitespace-pre-wrap text-sm text-slate-600">{viewed[key]}</p></div>)}{viewed.document_id&&(()=>{const file=files.find(f=>f.id===viewed.document_id);return file?<a className="text-sm font-semibold text-orange-800 underline" href={"https://drive.google.com/file/d/"+encodeURIComponent(file.drive_file_id)+"/view"} target="_blank" rel="noreferrer">Abrir {file.file_name} no Drive ↗</a>:<p className="text-xs text-slate-500">Documento já não associado à ficha.</p>;})()}</div>}
 <CrmEmailPanel key={proposal.id + ":" + version} authorizedFetch={authorizedFetch} scope="proposal" id={proposal.id} version={version}
   suggestedPdf={proposalPdf?.id === proposal.id && proposalPdf.version === version ? proposalPdf.file : null}
   onSent={async quoteSent => {
     if (quoteSent && version === proposal.current_version) setProposal(current => current?.status === "draft" ? { ...current, status: "sent" } : current);
     await loadList(); await onChanged();
   }}
   onAcceptReply={version === proposal.current_version && proposal.status === "sent" ? prepareAcceptance : undefined} />
 {(proposal.status!=="archived" || !proposal.status_before_archive) && <form ref={statusForm} key={proposal.id+"-"+proposal.status+"-"+proposal.current_version} onSubmit={changeStatus} className="space-y-3 border-t border-slate-200 pt-4"><p className="text-sm font-semibold">Estado da versão atual (v{proposal.current_version})</p><label className="block text-sm">Estado<select name="status" defaultValue={proposal.status} className={input}>{Object.entries(proposalStatusLabels).filter(([id])=>id!=="archived"||proposal.status==="archived").map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="block text-sm">Registo da confirmação por email<textarea name="note" maxLength={2000} defaultValue={proposal.confirmation_note||""} rows={2} className={input} placeholder="Obrigatório para marcar como aceite. Ex.: confirmado pelo cliente por email em…"/></label><button disabled={busy} className={button}>Guardar estado</button></form>}{proposal.status==="accepted"&&<button className={button} disabled={busy} onClick={()=>void createTrip()}>{proposal.trip_id?"Abrir viagem associada":"Criar viagem a partir desta proposta"}</button>}
 </article>}
 {draft&&<form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-xl font-bold">{proposal?"Nova versão "+(proposal.current_version+1):"Nova proposta"}</h3><label className="block text-sm">Preencher a partir do PDF<input type="file" className={input} accept=".pdf,application/pdf" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void importPdf(file); }} /></label>
 {draftPdf && <p className="text-sm break-all">PDF pronto para anexar ao email desta versão · {draftPdf.name}</p>}
 {draft.imported && <details className="rounded-lg border border-slate-200 p-3 text-sm">
   <summary className="cursor-pointer">Dados operacionais do PDF · {draft.imported.services.length} serviço(s)</summary>
   {draft.imported.reference && <p>Referência: {draft.imported.reference}</p>}
   <ul className="my-2 space-y-1">{draft.imported.services.map((service,index) => <li key={index}>{service.title}{service.reference ? " · " + service.reference : ""}{service.starts_on ? " · " + service.starts_on : ""} <button type="button" className="underline" onClick={() => setDraft(current => current?.imported ? { ...current, imported: { ...current.imported, services: current.imported.services.filter((_,i) => i !== index) } } : current)}>Retirar</button></li>)}</ul>
 </details>}
 <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Cliente *<select required={!draft.lead_id} value={draft.client_id} disabled={Boolean(proposal)} onChange={e=>{setDraft({...draft,client_id:e.target.value,lead_id:"",trip_id:"",document_id:""});}} className={input}><option value="">Seleciona</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><label className="text-sm">Pedido associado<select value={draft.lead_id} disabled={Boolean(proposal)} onChange={e=>{const lead=leads.find(item=>item.id===e.target.value);setDraft({...draft,lead_id:e.target.value,client_id:lead?.client_id||draft.client_id});}} className={input}><option value="">Sem pedido</option>{leads.filter(l=>!draft.client_id||!l.client_id||l.client_id===draft.client_id).map(l=><option key={l.id} value={l.id}>{l.full_name} · {l.destination||"Sem destino"}</option>)}</select></label><label className="text-sm">Viagem associada<select value={draft.trip_id} disabled={Boolean(proposal)} onChange={e=>update("trip_id",e.target.value)} className={input}><option value="">Sem viagem</option>{trips.filter(t=>t.client_id===draft.client_id||t.client_ids.includes(draft.client_id)).map(t=><option key={t.id} value={t.id}>{t.destination||t.reference||"Viagem"}</option>)}</select></label>
 {(["title","total_amount","currency","valid_until","destination","departure_date","return_date","operator"] as const).map((key,index)=><label key={key} className="text-sm">{["Título *","Valor total *","Moeda *","Validade","Destino","Partida","Regresso","Operador"][index]}<input required={["title","total_amount","currency"].includes(key)} type={key==="total_amount"?"number":key.includes("date")||key==="valid_until"?"date":"text"} min={key==="total_amount"?0:key==="return_date"?draft.departure_date:undefined} max={key==="total_amount"?9999999999.99:undefined} step={key==="total_amount"?"0.01":undefined} maxLength={key==="currency"?3:key==="operator"?160:240} value={draft[key]} onChange={e=>update(key,e.target.value)} className={input}/></label>)}
 {(["conditions","inclusions","exclusions","notes"] as const).map((key,index)=><label key={key} className="text-sm sm:col-span-2">{["Condições","Incluído","Excluído","Notas"][index]}<textarea rows={3} maxLength={4000} value={draft[key]} onChange={e=>update(key,e.target.value)} className={input}/></label>)}
 <label className="text-sm sm:col-span-2">Documento no Drive<select value={draft.document_id} onChange={e=>update("document_id",e.target.value)} className={input}><option value="">Sem documento associado</option>{files.map(f=><option key={f.id} value={f.id}>{f.file_name}</option>)}</select></label></div>
 {!draft.client_id && draft.lead_id && <p className="text-sm text-slate-600">O cliente será associado com os dados do pedido ao guardar.</p>}
 {draftPdf && (draft.trip_id || draft.client_id) && <CrmDriveDocuments key={draft.trip_id || draft.client_id} authorizedFetch={authorizedFetch}
   tripId={draft.trip_id || undefined} clientId={draft.trip_id ? undefined : draft.client_id} title={draft.destination || draft.title || "Proposta"} initialFile={draftPdf}
   onUploaded={file => { setFiles(current => [file, ...current.filter(existing => existing.id !== file.id)]); update("document_id", file.id); }} />}
 <div className="flex gap-3"><button disabled={busy} className={button}>{busy?"A guardar…":"Guardar versão"}</button><button type="button" className={secondary} disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button></div></form>}
 </section>;
}
