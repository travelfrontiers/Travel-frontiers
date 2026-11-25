import { useId, useState } from "react";
import { ArrowUpRight, CalendarDays, ChevronDown, ChevronUp, GripVertical, Plane } from "lucide-react";
import { commissionStates, formatFinanceDate, formatMoney } from "@/lib/crm-finance";
import { officeInput, officeSecondary, type OpenTarget, type TripBoardActivity } from "@/lib/crm-office-types";
import type { TripAlert } from "@/lib/crm-trip-alerts";
import type { TripTab } from "./crm-trip-tabs";
import type { TripListItem } from "./crm-trip-list";

export type TripBoardItem = TripListItem & {
  stage: string;
  flights: number;
  hotels: number;
  otherServices: number;
  completedTasks: number;
  totalTasks: number;
  alerts: TripAlert[];
  activity?: TripBoardActivity;
};
type Stage = { id: string; label: string };

export default function CrmTripBoard({ items, stages, busy, onMove, onOpen, onAlert, onProposals }: {
  items: TripBoardItem[];
  stages: readonly Stage[];
  busy: boolean;
  onMove: (tripId: string, status: string) => void;
  onOpen: (tripId: string, tab?: TripTab) => void;
  onAlert: (target: OpenTarget) => void;
  onProposals: (tripId: string) => void;
}) {
  const [dragged, setDragged] = useState("");
  const [dropStage, setDropStage] = useState("");
  const [expandedByDefault, setExpandedByDefault] = useState(false);
  const [cardOverrides, setCardOverrides] = useState<Record<string, boolean>>({});
  const detailsPrefix = useId();
  const fromStage = items.find(item => item.id === dragged)?.stage;
  if (!items.length) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Sem viagens para estes filtros.</p>;
  const anyExpanded = items.some(item => cardOverrides[item.id] ?? expandedByDefault);

  return <section aria-label="Kanban de viagens" className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-600">Arrasta um cartão para mudar o estado ou usa o seletor nos detalhes.</p>
      <button type="button" className={officeSecondary + " min-h-10"} onClick={() => {
        setExpandedByDefault(!anyExpanded);
        setCardOverrides({});
      }}>{anyExpanded ? "Recolher todos" : "Expandir todos"}</button>
    </div>
    <div role="region" tabIndex={0} aria-label="Colunas por estado da viagem"
      className="grid auto-cols-[minmax(16rem,19rem)] grid-flow-col grid-rows-1 gap-3 overflow-x-auto pb-4">
      {stages.map(stage => {
        const column = items.filter(item => item.stage === stage.id);
        const dropping = dropStage === stage.id && dragged && fromStage !== stage.id;
        return <section key={stage.id} aria-label={stage.label}
          onDragOver={event => {
            if (!dragged || busy || fromStage === stage.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (dropStage !== stage.id) setDropStage(stage.id);
          }}
          onDragLeave={event => {
            if (dropStage === stage.id && (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))) setDropStage("");
          }}
          onDrop={event => {
            if (!dragged || busy || fromStage === stage.id) return;
            event.preventDefault();
            onMove(dragged, stage.id);
            setDragged("");
            setDropStage("");
          }}
          className={`min-h-48 min-w-0 rounded-2xl border p-3 ${dropping ? "border-orange-700 bg-orange-50" : "border-slate-200 bg-slate-100"}`}>
          <h3 className="mb-3 flex items-center justify-between gap-2 px-1 text-sm font-semibold">
            {stage.label}<span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">{column.length}</span>
          </h3>
          {column.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            {dropping ? "Larga aqui para mover" : "Sem viagens neste estado"}
          </p> : <ul className="space-y-3">{column.map(item => {
            const expanded = cardOverrides[item.id] ?? expandedByDefault;
            const detailsId = `${detailsPrefix}-${item.id}`;
            const toggleLabel = expanded ? "Recolher detalhes" : "Expandir detalhes";
            const alertLabel = `${item.alerts.length} ${item.alerts.length === 1 ? "alerta a verificar" : "alertas a verificar"}`;
            return <li key={item.id}
              className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm ${dragged === item.id ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => onOpen(item.id)} className="min-h-11 min-w-0 break-words text-left font-semibold text-orange-800 hover:underline">
                  {item.destination}<ArrowUpRight aria-hidden="true" className="ml-0.5 inline size-4" />
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={`${toggleLabel} de ${item.destination}`} title={toggleLabel}
                    aria-expanded={expanded} aria-controls={detailsId}
                    className="grid size-9 place-items-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={() => setCardOverrides(previous => ({ ...previous, [item.id]: !expanded }))}>
                    {expanded ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
                  </button>
                  <span draggable={!busy} onDragStart={event => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                    setDragged(item.id);
                  }} onDragEnd={() => { setDragged(""); setDropStage(""); }}
                    aria-hidden="true" className="shrink-0 cursor-grab p-1 text-slate-500"><GripVertical className="size-4" /></span>
                </div>
              </div>
              <p className="break-words text-sm text-slate-600">{item.client}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />{item.dates}
              </p>
              {item.flightLocators && <button type="button" onClick={() => onOpen(item.id, "flights")} className="mt-1 text-left text-sm font-semibold underline">PNR · {item.flightLocators}</button>}
              {!expanded && item.alerts.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">{alertLabel}</p>}
              {!expanded && !!item.finance?.overdue_count && <button type="button" onClick={() => onOpen(item.id, "payments")}
                className="mt-1 min-h-8 text-left text-xs font-semibold text-red-700 underline">Pagamentos em atraso</button>}
              <div id={detailsId} hidden={!expanded}>
                {item.reference && <p className="mt-1 break-words text-xs text-slate-600">Localizador {item.reference}</p>}
                <div className="my-3 flex flex-wrap gap-x-3 gap-y-1 border-y border-slate-200 py-2 text-xs">
                  <button type="button" onClick={() => onOpen(item.id, "flights")} className="inline-flex min-h-7 items-center gap-1 underline">
                    <Plane aria-hidden="true" className="size-3.5" />{item.flights} {item.flights === 1 ? "voo" : "voos"}
                  </button>
                  <button type="button" onClick={() => onOpen(item.id, "hotels")} className="min-h-7 underline">{item.hotels} {item.hotels === 1 ? "hotel" : "hotéis"}</button>
                  <button type="button" onClick={() => onOpen(item.id, "services")} className="min-h-7 underline">{item.otherServices} {item.otherServices === 1 ? "outro serviço" : "outros serviços"}</button>
                  <button type="button" onClick={() => onOpen(item.id, "tasks")} className="min-h-7 underline">{item.completedTasks}/{item.totalTasks} tarefas concluídas</button>
                </div>
                {item.alerts.length > 0 && <div className="mb-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                  <p className="font-semibold">{alertLabel}</p>
                  <ul className="mt-1 space-y-1">
                    {item.alerts.slice(0, 2).map(alert => <li key={alert.kind + alert.id}>
                      <button type="button" className="min-h-7 break-words text-left underline" onClick={() => onAlert(alert.target)}>
                        {alert.kind} · {alert.title} · {formatFinanceDate(alert.date)}
                      </button>
                    </li>)}
                  </ul>
                  {item.alerts.length > 2 && <button type="button" className="min-h-7 underline" onClick={() => onOpen(item.id)}>Ver todos os alertas</button>}
                </div>}
                {!!item.finance?.overdue_count && <button type="button" onClick={() => onOpen(item.id, "payments")}
                  className="mb-2 min-h-8 text-left text-xs font-semibold text-red-700 underline">
                  Pagamentos em atraso · {formatMoney(item.finance.overdue_amount, item.finance.currency)}
                </button>}
                <div className="mb-3 text-sm">
                  <dl className="my-2 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-600">Total da reserva</dt><dd>{formatMoney(item.total, item.currency)}</dd></div>
                    <div><dt><button type="button" className="min-h-7 underline" onClick={() => onOpen(item.id, "payments")}>Saldo do cliente</button></dt>
                      <dd>{item.finance?.balance == null ? "Por definir" : formatMoney(item.finance.balance, item.finance.currency)}</dd>
                      {item.finance?.next_due_on && <dd>Próximo prazo · {formatFinanceDate(item.finance.next_due_on)}</dd>}
                    </div>
                    <div><dt><button type="button" className="min-h-7 underline" onClick={() => onOpen(item.id, "commission")}>Comissão</button></dt>
                      <dd>{item.finance?.commission_state ? commissionStates[item.finance.commission_state] : "Por definir"}</dd>
                      {item.finance?.commission_to_receive != null && <dd>Por receber · {formatMoney(item.finance.commission_to_receive, item.finance.currency)}</dd>}</div>
                  </dl>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={officeSecondary} onClick={() => onProposals(item.id)}>
                      {item.activity ? `Propostas (${item.activity.proposals})` : "Propostas"}
                    </button>
                    <button type="button" className={officeSecondary} onClick={() => onOpen(item.id, "communications")}>
                      {item.activity ? `Emails (${item.activity.emails})` : "Emails"}
                    </button>
                    <button type="button" className={officeSecondary} onClick={() => onOpen(item.id, "documents")}>{item.activity ? `Documentos (${item.activity.documents})` : "Documentos"}</button>
                  </div>
                </div>
                <label className="block text-xs font-medium text-slate-600">Estado da viagem
                  <select className={officeInput + " min-h-10"} aria-label={`Estado da viagem ${item.destination}`} value={item.stage}
                    disabled={busy} onChange={event => onMove(item.id, event.currentTarget.value)}>
                    {stages.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </li>;
          })}</ul>}
        </section>;
      })}
    </div>
  </section>;
}
