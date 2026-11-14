import { formatMoney, type FinanceSummary } from "@/lib/crm-finance";
import { officeSecondary } from "@/lib/crm-office-types";

export type TripListItem = {
  id: string; destination: string; client: string; dates: string; operator: string; reference: string;
  status: string; currency: string; total: number | null; finance?: FinanceSummary;
};
export type TripListMode = "trips" | "commissions";

export default function CrmTripList({ items, mode, onOpen }: { items: TripListItem[]; mode: TripListMode; onOpen: (id: string) => void }) {
  const getValues = (item: TripListItem) => {
    const money = (value: number | null | undefined) => value == null ? "—" : formatMoney(value, item.currency);
    const commission = [
      ["Prevista", money(item.finance?.commission_expected)],
      ["Recebida", money(item.finance?.commission_net)],
      ["Diferença face à estimativa", money(item.finance?.commission_balance)],
    ];
    return mode === "commissions" ? commission : [
      ["Total", money(item.total)], ["Saldo do cliente", money(item.finance?.balance)], ...commission,
    ];
  };
  const open = (item: TripListItem) => <button type="button" onClick={() => onOpen(item.id)}
    aria-label={`Abrir ${mode === "commissions" ? "comissão" : "viagem"}: ${item.destination}`}
    className={officeSecondary + " min-h-11 whitespace-nowrap"}>Abrir</button>;
  if (!items.length) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Sem viagens para estes filtros.</p>;
  return <>
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white xl:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{mode === "commissions" ? "Comissões por viagem" : "Lista de viagens"}</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-700"><tr>
          {["Cliente e destino", "Datas", "Operador e referência", "Estado", ...getValues(items[0]).map(([label]) => label), "Ações"].map(label =>
            <th key={label} scope="col" className="px-3 py-3">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-200">
          {items.map(item => <tr key={item.id}>
            <th scope="row" className="min-w-40 px-3 py-3"><span className="block font-semibold">{item.destination}</span><span className="font-normal text-slate-600">{item.client}</span></th>
            <td className="px-3 py-3">{item.dates}</td><td className="px-3 py-3">{item.operator}<span className="block text-slate-600">{item.reference}</span></td>
            <td className="px-3 py-3">{item.status}</td>
            {getValues(item).map(([label, value]) => <td key={label} className="whitespace-nowrap px-3 py-3 tabular-nums">{value}</td>)}
            <td className="px-3 py-3">{open(item)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <ul className="grid gap-3 sm:grid-cols-2 xl:hidden">
      {items.map(item => <li key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="break-words font-semibold">{item.destination}</h3>
        <p className="break-words text-sm text-slate-600">{item.client} · {item.status}</p>
        <p className="mt-1 break-words text-sm text-slate-600">{[item.dates, item.operator, item.reference].filter(Boolean).join(" · ")}</p>
        <dl className="my-3 grid grid-cols-2 gap-2 text-sm">
          {getValues(item).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
        {open(item)}
      </li>)}
    </ul>
  </>;
}
