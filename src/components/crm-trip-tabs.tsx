import { useRef, type KeyboardEvent, type ReactNode } from "react";

const tabs = [
  ["summary", "Resumo"], ["services", "Serviços"], ["payments", "Pagamentos"],
  ["documents", "Documentos"], ["tasks", "Tarefas"], ["communications", "Comunicações e Alertas"], ["commission", "Comissão"],
] as const;
export type TripTab = typeof tabs[number][0];
export type TripFinanceTab = Extract<TripTab, "payments" | "commission">;

export function CrmTripTabs({ id, active, onChange }: { id: string; active: TripTab; onChange: (tab: TripTab) => void }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  function move(event: KeyboardEvent, index: number) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
      event.key === "ArrowRight" ? (index + 1) % tabs.length :
      event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next][0]);
    buttons.current[next]?.focus();
  }
  return <div role="tablist" aria-label="Secções da viagem" className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
    {tabs.map(([tab, label], index) => <button key={tab} ref={button => { buttons.current[index] = button; }}
      type="button" role="tab" id={id + "-tab-" + tab} aria-controls={id + "-panel-" + tab}
      aria-selected={active === tab} tabIndex={active === tab ? 0 : -1}
      onClick={() => onChange(tab)} onKeyDown={e => move(e, index)}
      className={`min-h-11 rounded-lg px-3 py-2 text-left text-sm ${active === tab ? "bg-orange-800 font-semibold text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
      {label}
    </button>)}
  </div>;
}

// Keep mounted editors alive when switching sections of the same trip.
export function CrmTripPanel({ id, tab, active, children }: { id: string; tab: TripTab; active: TripTab; children: ReactNode }) {
  return <div role="tabpanel" id={id + "-panel-" + tab} aria-labelledby={id + "-tab-" + tab}
    hidden={active !== tab} tabIndex={0}>{children}</div>;
}
