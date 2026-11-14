const primary = [
  ["dashboard", "Início"], ["pipeline", "Pedidos"], ["trips", "Viagens"], ["clients", "Clientes"], ["commissions", "Comissões"],
] as const;
const secondary = [
  ["calendar", "Calendário"], ["proposals", "Propostas"], ["email-templates", "Modelos de email"],
  ["activity", "Histórico"], ["templates", "Templates e checklists"], ["duplicates", "Duplicados"], ["payments", "Pagamentos"],
] as const;
export type CrmView = (typeof primary | typeof secondary)[number][0];

export default function CrmWorkspaceNavigation({ view, onNavigate }: { view: CrmView; onNavigate: (view: CrmView) => void }) {
  return <div className="mb-7 space-y-3">
    <nav aria-label="Menu principal do CRM" className="flex flex-wrap gap-2">
      {primary.map(([id, label]) => <button key={id} type="button" onClick={() => onNavigate(id)}
        aria-current={view === id ? "page" : undefined}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
        {label}
      </button>)}
    </nav>
    <nav aria-label="Ferramentas do CRM" className="flex flex-wrap gap-x-2 gap-y-1 border-b border-slate-200 pb-3">
      {secondary.map(([id, label]) => <button key={id} type="button" onClick={() => onNavigate(id)}
        aria-current={view === id ? "page" : undefined}
        className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
        {label}
      </button>)}
    </nav>
  </div>;
}
