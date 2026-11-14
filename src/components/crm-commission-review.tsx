import { useState, type FormEvent } from "react";
import { commissionStates, formatFinanceDate, formatMoney, type FinanceDetail } from "@/lib/crm-finance";
import { officeButton as primary, officeInput as input, officeSecondary as secondary } from "@/lib/crm-office-types";

export default function CrmCommissionReview({detail,today,busy,onSave,onServices}:{
  detail:FinanceDetail;today:string;busy:boolean;
  onSave:(action:string,data:Record<string,unknown>)=>Promise<void>;onServices?:()=>void;
}) {
  const [editing,setEditing]=useState<"commission_confirm"|"commission_settle"|null>(null);
  const {summary,files,reviews=[]}=detail;
  const state=summary.commission_state ?? (summary.commission_expected == null ? "uncalculated" : "awaiting");
  const settlement=editing==="commission_settle";
  const isCorrection=summary.commission_confirmed != null && !settlement;
  const values = [
    ["Prevista",summary.commission_expected],["Confirmada pela agência",summary.commission_confirmed],
    ["Recebida líquida",summary.commission_net],["Confirmada por receber",summary.commission_to_receive],
    ["Prevista − confirmada",summary.commission_discrepancy],["Prevista − recebida",summary.commission_balance],
  ] as const;
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    try {
      await onSave(editing,Object.fromEntries(new FormData(event.currentTarget)));
      setEditing(null);
    } catch { /* FinanceTrip displays the failed mutation. */ }
  }
  return <section className="space-y-3" aria-label="Reconciliação da comissão">
    <h4 className="font-semibold">Reconciliação da comissão</h4>
    <p className="text-sm font-semibold">{commissionStates[state]}
      {summary.commission_has_discrepancy && <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">{state==="settled" ? "Divergência regularizada" : "Divergência"}</span>}
    </p>
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {values.map(([label,value])=><div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
        <dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 break-words font-semibold">{value==null?"—":formatMoney(value,summary.currency)}</dd>
      </div>)}
    </dl>
    {summary.commission_to_receive != null && summary.commission_to_receive < 0 &&
      <p className="text-sm text-amber-800">Recebido acima do confirmado em {formatMoney(-summary.commission_to_receive,summary.currency)}.</p>}
    <div className="flex flex-wrap gap-2">
      {!summary.archived_at && <button type="button" className={primary} disabled={busy}
        onClick={()=>setEditing(editing==="commission_confirm"?null:"commission_confirm")}>{summary.commission_confirmed == null ? "Registar confirmação da agência" : "Corrigir confirmação da agência"}</button>}
      {!summary.archived_at && summary.commission_to_receive===0 && state!=="settled" && <button type="button" className={secondary} disabled={busy}
        onClick={()=>setEditing(settlement?null:"commission_settle")}>Regularizar com comprovativo</button>}
      {onServices && <button type="button" className={secondary} onClick={onServices}>Ver valores por serviço</button>}
    </div>
    {editing && <form key={editing} onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <h5 className="font-semibold sm:col-span-2">{settlement?"Regularização de comissão":"Confirmação da agência"}</h5>
      {!settlement && <label className="text-sm">Montante confirmado ({summary.currency})
        <input type="number" name="amount" min="0" max="9999999999.99" step="0.01" className={input} required defaultValue={summary.commission_confirmed ?? ""}/></label>}
      <label className="text-sm">Data<input type="date" name="effective_on" className={input} required defaultValue={today} max={today}/></label>
      <label className="text-sm">Referência<input name="reference" maxLength={160} className={input} required/></label>
      <label className="text-sm">Comprovativo no Drive<select className={input} name="document_id" required={settlement} defaultValue="">
        <option value="">{settlement?"Escolhe um comprovativo":"Sem ficheiro associado"}</option>
        {files.map(file=><option key={file.id} value={file.id}>{file.file_name}</option>)}
      </select>{settlement && !files.length && <span className="text-slate-600">Adiciona o comprovativo em Documentos.</span>}</label>
      <label className="text-sm sm:col-span-2">{settlement||isCorrection?"Motivo":"Notas"}
        <textarea name="notes" maxLength={2000} rows={2} className={input} required={settlement||isCorrection}/></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className={primary} disabled={busy}>{busy?"A guardar…":"Guardar registo"}</button>
        <button type="button" className={secondary} disabled={busy} onClick={()=>setEditing(null)}>Cancelar</button>
      </div>
    </form>}
    <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Histórico de confirmações e regularizações</summary>
      {reviews.length ? <ol className="mt-3 divide-y divide-slate-200">{reviews.map(review=><li key={review.id} className="space-y-1 py-3 text-sm">
        <p className="font-semibold">{review.kind==="confirmation"?"Confirmação da agência":"Regularização"} · {formatMoney(review.amount,review.currency)}</p>
        <p>{formatFinanceDate(review.effective_on)} · {review.reference}</p>
        {review.notes && <p className="whitespace-pre-wrap">{review.notes}</p>}
        {review.document && <a className="text-orange-800 underline" href={"https://drive.google.com/file/d/"+encodeURIComponent(review.document.drive_file_id)+"/view"} target="_blank" rel="noreferrer">{review.document.file_name} ↗</a>}
      </li>)}</ol> : <p className="mt-2 text-sm text-slate-600">Sem confirmações ou regularizações registadas.</p>}
    </details>
  </section>;
}
