import type { ReactNode } from "react";
import { formatMoney, type FinanceSummary } from "@/lib/crm-finance";
import { officeInput, officeSecondary } from "@/lib/crm-office-types";
import CrmTripList, { type TripListItem } from "./crm-trip-list";

const tabs = [
  ["all", "Todas"], ["pending", "Por regularizar"], ["received", "Recebidas"], ["settled", "Regularizadas"],
] as const;
export type CommissionView = typeof tabs[number][0];
export type CommissionSort = "confirmation" | "departure" | "destination";

export function hasOpenCommission(finance: FinanceSummary) {
  return Number(finance.commission_to_receive) > 0 ||
    (finance.commission_has_discrepancy === true && finance.commission_state !== "settled");
}

export default function CrmCommissionWorkspace({ items, tab, onTab, sort, onSort, query, onQuery, filters, status, onRetry, onOpen }: {
  items: TripListItem[]; tab: CommissionView; onTab: (tab: CommissionView) => void;
  sort: CommissionSort; onSort: (sort: CommissionSort) => void;
  query: string; onQuery: (query: string) => void; filters: ReactNode;
  status: "loading" | "ready" | "error"; onRetry: () => void; onOpen: (id: string) => void;
}) {
  const totals = new Map<string, { expected: number | null; confirmed: number | null; received: number; remaining: number | null }>();
  for (const item of items) {
    const finance = item.finance;
    if (!finance || finance.status === "cancelled") continue;
    const entry = totals.get(finance.currency) ?? { expected: null, confirmed: null, received: 0, remaining: null };
    if (finance.commission_expected != null) entry.expected = (entry.expected ?? 0) + Math.round(finance.commission_expected * 100);
    if (finance.commission_confirmed != null) {
      entry.confirmed = (entry.confirmed ?? 0) + Math.round(finance.commission_confirmed * 100);
      entry.remaining = (entry.remaining ?? 0) + Math.max(0, Math.round((finance.commission_to_receive ?? 0) * 100));
    }
    entry.received += Math.round(finance.commission_net * 100);
    totals.set(finance.currency, entry);
  }
  const visible = items.filter(({ finance }) => {
    if (tab === "all") return true;
    if (!finance || finance.status === "cancelled") return false;
    if (tab === "pending") return hasOpenCommission(finance);
    if (tab === "received") return finance.commission_net > 0;
    return finance.commission_state === "settled";
  }).sort((first, second) =>
    (sort === "confirmation" ? (second.finance?.commission_confirmed_on ?? "").localeCompare(first.finance?.commission_confirmed_on ?? "") :
      sort === "departure" ? (first.finance?.departure_date ?? "9999").localeCompare(second.finance?.departure_date ?? "9999") : 0) ||
    first.destination.localeCompare(second.destination, "pt-PT"));

  return <section aria-labelledby="crm-commissions-heading" className="min-w-0 space-y-5">
    <header>
      <h2 id="crm-commissions-heading" className="text-2xl font-bold">Comissões</h2>
      <p className="mt-1 text-sm text-slate-600">Acompanha as comissões por viagem, da previsão à regularização.</p>
    </header>
    {status === "ready" && [...totals.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([currency, total]) =>
      <dl key={currency} aria-label={`Resumo de comissões em ${currency}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["Prevista", total.expected], ["Confirmada pela agência", total.confirmed],
          ["Recebida", total.received], ["Por receber", total.remaining],
        ] as const).map(([label, amount]) => <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <dt className="text-sm font-medium text-slate-600">{label}</dt>
          <dd className="mt-2 break-words text-lg font-bold tabular-nums sm:text-2xl">{amount === null ? "—" : formatMoney(amount / 100, currency)}</dd>
        </div>)}
      </dl>)}
    <nav aria-label="Vistas de comissões" className="flex gap-4 overflow-x-auto border-b border-slate-200">
      {tabs.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id}
        onClick={() => onTab(id)} className={`min-h-11 shrink-0 border-b-2 px-1 text-sm font-semibold ${tab === id ? "border-orange-800 text-orange-800" : "border-transparent text-slate-600"}`}>
        {label}
      </button>)}
    </nav>
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-end gap-3">
        <label className="w-full text-sm sm:max-w-sm">Pesquisar comissão
          <input type="search" className={officeInput} placeholder="Cliente, destino, operador ou localizador"
            value={query} onChange={event => onQuery(event.currentTarget.value)} />
        </label>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer font-semibold">Filtros</summary>
        <div className="mt-3 space-y-3">
          {filters}
          <label className="block max-w-xs text-sm">Ordenar comissões
            <select className={officeInput} value={sort} onChange={event => onSort(event.currentTarget.value as CommissionSort)}>
              <option value="confirmation">Confirmação mais recente</option>
              <option value="departure">Data de partida</option>
              <option value="destination">Destino</option>
            </select>
          </label>
        </div>
      </details>
    </div>
    {status === "loading" && <p role="status" className="text-sm text-slate-600">A carregar comissões…</p>}
    {status === "error" && <div role="alert" className="text-sm text-slate-600">Dados financeiros indisponíveis.{" "}
      <button type="button" className={officeSecondary} onClick={onRetry}>Tentar novamente</button></div>}
    {status === "ready" && <>
      <p className="text-sm text-slate-600">{visible.length} {visible.length === 1 ? "viagem nesta vista" : "viagens nesta vista"}</p>
      <CrmTripList mode="commissions" items={visible} onOpen={onOpen} />
    </>}
  </section>;
}
