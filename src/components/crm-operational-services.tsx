import type { FormEvent, ReactNode } from "react";
import { bookingClock, bookingStates, type BookingDetails } from "@/lib/crm-booking-details";
import { officeButton, officeInput, officeSecondary } from "@/lib/crm-office-types";
import { CrmBookingFields } from "./crm-booking-fields";

type Service = {
  id: string; title: string; service_type: string; provider: string | null; reference: string | null;
  starts_on: string | null; ends_on: string | null; details: string | null; booking?: BookingDetails;
  departure_at?: string | null; checkin_opens_at?: string | null; updated_at?: string;
};
type Task = { id: string; source_service_id?: string | null; due_at: string | null; completed: boolean };

const date = (value: string | null | undefined) => value?.split("-").reverse().join("/") || "Por definir";
const formattedOpening = (at: string, zone: string | undefined) =>
  new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: zone || "Europe/Lisbon" }).format(new Date(at));

export function CrmOperationalServices<T extends Service>({ type, items, tasks, saving, onSave, onDelete, onCheckin, finance, now }: {
  type: "flight" | "accommodation"; items: T[]; tasks: Task[]; saving: boolean; now: number;
  onSave: (event: FormEvent<HTMLFormElement>, service?: T) => void;
  onDelete: (service: T) => void; onCheckin: (id: string, completed: boolean) => void;
  finance: (service: T) => ReactNode;
}) {
  const flight = type === "flight";
  const ordered = items.filter(item => item.service_type === type).sort((first, second) =>
    (first.departure_at || first.starts_on || "9999").localeCompare(second.departure_at || second.starts_on || "9999") ||
    (first.booking?.departure_time || "").localeCompare(second.booking?.departure_time || "") || first.title.localeCompare(second.title));
  const tasksByService = new Map(tasks.map(task => [task.source_service_id, task]));
  const pending = ordered.filter(item => !["confirmed", "cancelled"].includes(item.booking?.status || ""));
  const label = flight ? "voo" : "hotel";
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="text-lg font-bold">{flight ? "Voos" : "Hotéis"}</h4>
        <p className="text-sm text-slate-600">{pending.length} {pending.length === 1 ? "reserva requer atenção" : "reservas requerem atenção"}</p></div>
    </div>
    {!ordered.length && <p className="text-sm text-slate-600">{flight ? "Sem voos registados." : "Sem alojamentos registados."}</p>}
    {ordered.map(item => {
      const info = item.booking || {};
      const task = tasksByService.get(item.id);
      const status = info.status || "pending";
      const departed = item.departure_at && Date.parse(item.departure_at) <= now;
      const nights = item.starts_on && item.ends_on ? (Date.parse(item.ends_on) - Date.parse(item.starts_on)) / 86400000 : null;
      return <article key={item.id} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 break-words">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><h5 className="font-bold">{item.title}</h5>
            <p className="text-sm text-slate-600">{(flight ? [item.provider, info.flight_number, [info.origin, info.destination_airport].filter(Boolean).join(" → ")] :
              [info.city, info.destination, item.provider]).filter(Boolean).join(" · ")}</p></div>
          <span className={status === "confirmed" || status === "cancelled" ? "text-sm text-slate-600" : "text-sm font-semibold text-amber-800"}>{bookingStates[status]}</span>
        </header>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-600">{flight ? "Partida" : "Check-in"}</dt>
            <dd>{date(item.starts_on)} {flight && [info.departure_time, info.departure_zone].filter(Boolean).join(" · ")}</dd></div>
          <div><dt className="text-slate-600">{flight ? "Chegada" : "Check-out"}</dt>
            <dd>{date(item.ends_on)} {flight && [info.arrival_time, info.arrival_zone].filter(Boolean).join(" · ")}</dd></div>
          <div><dt className="text-slate-600">{flight ? "Localizador / PNR" : "Referência da reserva"}</dt><dd>{(flight ? info.pnr : item.reference) || "Por definir"}</dd></div>
          {flight && item.reference && <div><dt className="text-slate-600">Referência do serviço</dt><dd>{item.reference}</dd></div>}
          {!flight && <div><dt className="text-slate-600">Estadia</dt><dd>{[
            nights !== null ? nights + (nights === 1 ? " noite" : " noites") : "", info.board, info.room,
          ].filter(Boolean).join(" · ") || "Por definir"}</dd></div>}
          {!flight && info.confirmed_on && <div><dt className="text-slate-600">Última confirmação</dt><dd>{date(info.confirmed_on)}</dd></div>}
        </dl>
        {flight && status !== "cancelled" && <div className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="font-semibold">Check-in · {departed && !task?.completed ? "Encerrado" : bookingClock(task, now)}</p>
          {item.checkin_opens_at && <p>Abertura confirmada · {formattedOpening(item.checkin_opens_at, info.departure_zone)}</p>}
          {!item.checkin_opens_at && task?.due_at && <p>{item.departure_at ?
            "Estimativa (48 h antes) · " + formattedOpening(task.due_at, info.departure_zone) :
            "Data estimada · " + new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(task.due_at))}</p>}
          {task?.due_at && <button type="button" className={officeSecondary + " mt-1 min-h-11"}
            disabled={saving} onClick={() => onCheckin(task.id, !task.completed)}>{task.completed ? "Reabrir check-in" : "Concluir check-in"}</button>}
        </div>}
        <div className="flex flex-wrap gap-x-4 text-sm font-semibold text-orange-800">
          {info.email && <a className="inline-flex min-h-11 items-center underline" href={"mailto:" + info.email}>Enviar email</a>}
          {info.phone && <a className="inline-flex min-h-11 items-center underline" href={"tel:" + info.phone.replace(/[^+\d]/g, "")}>Ligar ao hotel</a>}
          {info.checkin_url && info.checkin_verified === "yes" && status !== "cancelled" && !departed && <a className="inline-flex min-h-11 items-center underline" href={info.checkin_url} target="_blank" rel="noreferrer">Abrir check-in da companhia</a>}
          {info.drive_url && <a className="inline-flex min-h-11 items-center underline" href={info.drive_url} target="_blank" rel="noreferrer">Abrir documento no Drive</a>}
        </div>
        {item.details && <details className="text-sm"><summary className="cursor-pointer font-semibold">Observações</summary><p className="whitespace-pre-wrap">{item.details}</p></details>}
        <details><summary className="cursor-pointer py-2 text-sm font-semibold">Editar {label}</summary>
          <ServiceForm key={item.updated_at} item={item} type={type} saving={saving} onSave={event => onSave(event, item)}
            onDelete={() => onDelete(item)} />
          {finance(item)}
        </details>
      </article>;
    })}
    <details className="rounded-xl border border-slate-300 p-3 sm:p-4">
      <summary className="cursor-pointer py-2 font-semibold">Adicionar {label}</summary>
      <ServiceForm type={type} saving={saving} onSave={event => onSave(event)} />
    </details>
  </section>;
}

function ServiceForm({ type, item, onSave, onDelete, saving }: {
  type: string; item?: Service; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete?: () => void; saving: boolean;
}) {
  const flight = type === "flight";
  return <form onSubmit={onSave} className="my-3 grid gap-3 sm:grid-cols-2 [&_input:not([type=checkbox])]:min-h-11 [&_select]:min-h-11 max-sm:[&_input]:text-base max-sm:[&_select]:text-base max-sm:[&_textarea]:text-base">
    <input type="hidden" name="service_type" value={type} />
    <label className="text-sm sm:col-span-2">{flight ? "Designação do segmento" : "Nome do hotel"}<input name="title" required maxLength={240} defaultValue={item?.title} className={officeInput} /></label>
    <label className="text-sm">{flight ? "Companhia aérea" : "Operador ou fornecedor"}<input name="provider" maxLength={160} defaultValue={item?.provider || ""} className={officeInput} /></label>
    <label className="text-sm">{flight ? "Referência adicional" : "Referência da reserva"}<input name="reference" maxLength={100} defaultValue={item?.reference || ""} className={officeInput} /></label>
    <label className="text-sm">{flight ? "Data de partida" : "Data de check-in"}<input name="starts_on" type="date" defaultValue={item?.starts_on || ""} className={officeInput} /></label>
    <label className="text-sm">{flight ? "Data de chegada" : "Data de check-out"}<input name="ends_on" type="date" defaultValue={item?.ends_on || ""} className={officeInput} /></label>
    <CrmBookingFields type={type} booking={item?.booking} />
    <label className="text-sm sm:col-span-2">Observações<textarea name="details" rows={3} maxLength={4000} defaultValue={item?.details || ""} className={officeInput} /></label>
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <button disabled={saving} className={officeButton + " min-h-11"}>{item ? "Guardar alterações" : "Adicionar à viagem"}</button>
      {onDelete && <button type="button" disabled={saving} className={officeSecondary + " min-h-11"} onClick={onDelete}>Remover serviço</button>}
    </div>
  </form>;
}
