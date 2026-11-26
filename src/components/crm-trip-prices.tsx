import { formatMoney } from "@/lib/crm-finance";

export function TripPrices({ gross, net, currency, onCommission }: {
  gross: number | null; net: number | null; currency: string; onCommission: () => void;
}) {
  return <dl className="my-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
    <div><dt className="text-slate-600">Valor bruto</dt><dd className="font-semibold tabular-nums">{formatMoney(gross, currency)}</dd></div>
    <div><dt className="text-slate-600">Valor net</dt><dd><button type="button" onClick={onCommission}
      className="text-left font-semibold tabular-nums underline">{net == null ? "Por calcular" : formatMoney(net, currency)}</button></dd></div>
  </dl>;
}
