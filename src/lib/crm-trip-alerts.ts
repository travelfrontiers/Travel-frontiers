import { addDays, lisbonDay } from "./crm-calendar";
import type { OpenTarget } from "./crm-office-types";

export type TripAlert = {
  id: string;
  date: string;
  kind: "Prestação" | "Validade de proposta" | "Check-in" | "Tarefa" | "Documento" | "Seguimento" | "Partida" | "Regresso";
  title: string;
  target: OpenTarget;
};

type TripDates = {
  id: string; status: string; archived_at: string | null; departure_date: string | null; return_date: string | null;
  tasks: { id: string; title: string; due_at: string | null; completed: boolean; source_service_id?: string | null }[];
};

export function tripContextAlerts(trip: TripDates, today: string, documents: TripAlert[], followUp: TripAlert | null) {
  if (trip.archived_at || trip.status === "cancelled") return [];
  const deadline = addDays(today, 14);
  const upcomingExpiry = addDays(today, 30);
  const documentDeadline = trip.return_date && trip.return_date > upcomingExpiry ? trip.return_date : upcomingExpiry;
  const alerts = documents.filter(item => item.date <= documentDeadline);
  if (followUp && followUp.date <= deadline) alerts.push(followUp);
  for (const task of trip.tasks) {
    if (!task.due_at || task.completed) continue;
    const date = lisbonDay(task.due_at);
    if (date > deadline) continue;
    alerts.push({ id: task.id, date, kind: task.source_service_id ? "Check-in" : "Tarefa",
      title: task.title, target: { type: "trip", id: trip.id, taskId: task.id } });
  }
  for (const [kind, date] of [["Partida", trip.departure_date], ["Regresso", trip.return_date]] as const) {
    if (date && date >= today && date <= deadline) alerts.push({ id: kind, date, kind,
      title: kind + " da viagem", target: { type: "trip", id: trip.id } });
  }
  return alerts;
}
