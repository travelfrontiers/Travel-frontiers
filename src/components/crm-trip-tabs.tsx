import type { ReactNode } from "react";
import { officeInput } from "@/lib/crm-office-types";

const groups = [
  { label: "Viagem", sections: [["summary", "Resumo"], ["travelers", "Viajantes"], ["documents", "Documentos"]] },
  { label: "Reservas", sections: [["flights", "Voos"], ["hotels", "Hotéis"], ["services", "Outros serviços"]] },
  { label: "Financeiro", sections: [["payments", "Pagamentos"], ["commission", "Comissão"]] },
  { label: "Acompanhamento", sections: [["tasks", "Tarefas"], ["communications", "Comunicações e alertas"], ["history", "Histórico"]] },
] as const;
export type TripTab = typeof groups[number]["sections"][number][0];
export type TripFinanceTab = Extract<TripTab, "payments" | "commission">;
const sections = groups.flatMap(group => [...group.sections] as readonly (readonly [TripTab, string])[]);
const shortcuts: TripTab[] = ["summary", "flights", "hotels", "payments"];

export function CrmTripTabs({ id, active, onChange }: { id: string; active: TripTab; onChange: (tab: TripTab) => void }) {
  return <nav aria-label="Navegação da viagem" className="mb-4 flex flex-wrap items-end gap-2 border-b border-slate-200 pb-3">
    {shortcuts.map(tab => <button type="button" key={tab} aria-controls={id + "-panel-" + tab}
      aria-current={active === tab ? "page" : undefined} onClick={() => onChange(tab)}
      className={`hidden min-h-11 rounded-lg px-3 text-sm sm:block ${active === tab ? "bg-orange-800 font-semibold text-white" : "border border-slate-300 text-slate-700"}`}>
      {sections.find(([key]) => key === tab)?.[1]}
    </button>)}
    <label className="w-full text-xs font-semibold text-slate-600 sm:ml-auto sm:w-auto">Ir para
      <select value={active} className={officeInput + " min-h-11"} onChange={event => onChange(event.target.value as TripTab)}>
        {groups.map(group => <optgroup key={group.label} label={group.label}>
          {group.sections.map(([tab, label]) => <option key={tab} value={tab}>{label}</option>)}
        </optgroup>)}
      </select>
    </label>
  </nav>;
}

// Keep mounted editors alive when switching sections of the same trip.
export function CrmTripPanel({ id, tab, active, children }: { id: string; tab: TripTab; active: TripTab; children: ReactNode }) {
  return <section id={id + "-panel-" + tab} aria-label={sections.find(([key]) => key === tab)?.[1]}
    hidden={active !== tab}>{children}</section>;
}
