import { useState, type FormEvent } from "react";
import { formatMoney } from "@/lib/crm-finance";
import { officeButton as primary, officeInput as input, officeSecondary as secondary, type AuthorizedFetch } from "@/lib/crm-office-types";
import { commissionMethodLabels, serviceStatusLabels, summarizeServices, type ServiceFinance, type ServiceFinanceEvent } from "@/lib/crm-service-finance";

type Service = Partial<ServiceFinance> & { id: string; title: string };
const amountFields = [["sale_price", "Preço de venda"], ["net_cost", "Custo líquido"], ["service_commission", "Comissão estimada"], ["service_adjustment", "Ajuste à venda (±)"]] as const;
const financeFields = [...amountFields.map(([field]) => field), "service_status", "finance_currency", "finance_basis",
  "finance_quantity", "commission_method", "finance_source"];

export function CrmServiceFinanceSummary({ tripId, services, currency, contracted, authorizedFetch }: {
  tripId: string; services: Service[]; currency: string; contracted: number | null; authorizedFetch: AuthorizedFetch;
}) {
  const { totals, active } = summarizeServices(services);
  const [history, setHistory] = useState<ServiceFinanceEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggleHistory() {
    if (history) { setHistory(null); return; }
    setBusy(true);
    setError("");
    try {
      const response = await authorizedFetch("/api/crm/service-finance?trip_id=" + encodeURIComponent(tripId));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setHistory(data.events);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Histórico indisponível."); }
    finally { setBusy(false); }
  }
  const priced = Object.values(totals).reduce((count, total) => count + total.priced, 0);
  const comparable = active > 0 && totals[currency]?.priced === active && contracted != null;
  return <section className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h4 className="font-semibold">Totais dos serviços</h4>
    <p className="text-sm">Total contratado da viagem · {formatMoney(contracted, currency)}</p>
    <p className="text-sm text-slate-600">{priced} de {active} serviços ativos com preço de venda. As comissões e os custos são apresentados em separado. O total contratado é editado em Pagamentos.</p>
    {Object.entries(totals).map(([code, total]) => <div key={code} className="text-sm">
      <strong>{code}</strong> · Venda {total.priced ? formatMoney(total.sales / 100, code) : "—"} · Custos conhecidos {total.costsKnown ? formatMoney(total.costs / 100, code) : "—"} · Comissão estimada dos serviços {total.commissionsKnown ? formatMoney(total.commissions / 100, code) : "—"}
    </div>)}
    {comparable && <p className="text-sm">Diferença entre o contratado e a venda dos serviços · {formatMoney((Math.round(contracted * 100) - totals[currency].sales) / 100, currency)}</p>}
    {!comparable && priced > 0 && <p className="text-sm text-slate-600">A comparação exige o total contratado e todos os preços de venda na mesma moeda.</p>}
    <button type="button" className={secondary} disabled={busy} aria-expanded={history !== null} onClick={() => void toggleHistory()}>
      {busy ? "A carregar…" : history ? "Fechar histórico financeiro" : "Histórico financeiro dos serviços"}
    </button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {history && (history.length ? <ul className="space-y-2">{history.map(entry => <li key={entry.id} className="rounded-lg border border-slate-200 p-3 text-sm">
      <strong>{entry.snapshot.title}</strong> · {entry.action === "removed" ? "Serviço removido" : "Versão " + entry.snapshot.version} · {new Date(entry.recorded_at).toLocaleString("pt-PT", {timeZone: "Europe/Lisbon"})}
      <div>{amountFields.filter(([field]) => entry.snapshot[field] !== null).map(([field, label]) =>
        <span key={field} className="mr-3">{label} {formatMoney(entry.snapshot[field], entry.snapshot.finance_currency ?? currency)}</span>)}</div>
      <div className="text-slate-600">{[entry.snapshot.finance_source, entry.snapshot.finance_basis === "person" ? "Por pessoa × " + entry.snapshot.finance_quantity : entry.snapshot.finance_basis === "booking" ? "Por reserva" : "", entry.snapshot.commission_method && commissionMethodLabels[entry.snapshot.commission_method], serviceStatusLabels[entry.snapshot.service_status]].filter(Boolean).join(" · ")}</div>
    </li>)}</ul> : <p className="text-sm text-slate-600">Sem alterações financeiras registadas.</p>)}
  </section>;
}

export function CrmServiceFinanceEditor({ tripId, service, authorizedFetch, onChanged }: {
  tripId: string; service: Service; authorizedFetch: AuthorizedFetch; onChanged: () => Promise<void>;
}) {
  const [basis, setBasis] = useState(service.finance_basis ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await authorizedFetch("/api/crm/service-finance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: service.id, trip_id: tripId, version: service.finance_version ?? 0,
          ...Object.fromEntries(financeFields.map(field => [field, data.get(field)])) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Dados financeiros guardados.");
      try { await onChanged(); }
      catch { setNotice("Dados financeiros guardados. Atualiza a ficha para consultar o registo."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar."); }
    finally { setBusy(false); }
  }
  return <details className="rounded-xl border border-slate-200 px-4 py-3">
    <summary className="cursor-pointer text-sm font-semibold">Valores e estado · {service.title}</summary>
    <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={save}>
      <label className="text-sm">Estado<select name="service_status" className={input} defaultValue={service.service_status ?? "unspecified"}>
        {Object.entries(serviceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm">Moeda<input name="finance_currency" className={input} defaultValue={service.finance_currency ?? ""} placeholder="EUR" maxLength={3} pattern="[A-Za-z]{3}" /></label>
      <label className="text-sm">Base dos valores<select name="finance_basis" className={input} value={basis} onChange={event => setBasis(event.target.value as typeof basis)}>
        <option value="">Por definir</option><option value="booking">Por reserva</option><option value="person">Por pessoa</option>
      </select></label>
      {basis === "person" && <label className="text-sm">Quantidade de pessoas<input name="finance_quantity" className={input} type="number" min="1" max="50" required defaultValue={service.finance_quantity ?? ""} /></label>}
      {amountFields.map(([field, label]) => <label key={field} className="text-sm">{label}<input name={field} className={input} type="number" step="0.01"
        min={field === "service_adjustment" ? "-9999999999.99" : "0"} max="9999999999.99" placeholder="Por preencher" defaultValue={service[field] ?? ""} /></label>)}
      <label className="text-sm">Método de comissão<select name="commission_method" className={input} defaultValue={service.commission_method ?? ""}>
        <option value="">Por definir</option>{Object.entries(commissionMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="text-sm">Origem dos valores<input name="finance_source" className={input} maxLength={240} defaultValue={service.finance_source ?? ""} placeholder="Ex. orçamento do operador e referência" /></label>
      <div className="space-y-2 sm:col-span-2">
        <button type="submit" className={primary} disabled={busy}>Guardar valores e estado</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
      </div>
    </form>
  </details>;
}
