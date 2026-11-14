import { useEffect, useState } from "react";
import { formatFinanceDate } from "@/lib/crm-finance";
import { officeSecondary, type AuthorizedFetch, type OpenTarget } from "@/lib/crm-office-types";
import type { TripAlert } from "@/lib/crm-trip-alerts";

export default function CrmTripAlerts({ active, tripId, today, localAlerts, authorizedFetch, onOpen }: {
  active: boolean; tripId: string; today: string; localAlerts: TripAlert[];
  authorizedFetch: AuthorizedFetch; onOpen: (target: OpenTarget) => void;
}) {
  const [remote, setRemote] = useState<TripAlert[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void authorizedFetch("/api/crm/trip-alerts?trip_id=" + encodeURIComponent(tripId), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("alert load");
        const result = await response.json();
        if (!controller.signal.aborted) { setRemote(result.alerts); setError(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [active, tripId, today, authorizedFetch, retry]);

  const alerts = [...localAlerts, ...remote ?? []].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return <section aria-labelledby="trip-alerts-heading" className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h4 id="trip-alerts-heading" className="font-semibold">Pendências e datas da viagem</h4>
    {error && <p role="status" className="text-sm text-red-700">Não foi possível carregar as prestações e as propostas.{" "}
      <button type="button" className="underline" onClick={() => { setError(false); setRetry(attempt => attempt + 1); }}>Tentar novamente</button></p>}
    {!remote && !error && active && <p role="status" className="text-sm text-slate-600">A carregar prestações e propostas…</p>}
    {remote && !alerts.length && !error && <p className="text-sm text-slate-600">Sem pendências ou datas próximas.</p>}
    {!!alerts.length && <ul className="space-y-2">{alerts.map(alert => <li key={alert.kind + alert.id}>
      <button type="button" onClick={() => onOpen(alert.target)}
        className={officeSecondary + " flex min-h-11 w-full flex-wrap justify-between gap-x-3 gap-y-1 rounded-xl text-left"}>
        <span>{alert.kind} · {alert.title}</span>
        <span className={alert.date < today ? "text-red-700" : "text-slate-600"}>{formatFinanceDate(alert.date)}</span>
      </button>
    </li>)}</ul>}
  </section>;
}
