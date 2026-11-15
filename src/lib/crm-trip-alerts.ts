import { addDays, lisbonDay } from "./crm-calendar";
import { bookingStates, type BookingDetails } from "./crm-booking-details";
import type { OpenTarget } from "./crm-office-types";

export type TripAlert = {
  id: string;
  date: string;
  kind: "Hotel" | "Voo" | "Prestação" | "Validade de proposta" | "Check-in" | "Tarefa" | "Documento" | "Seguimento" | "Partida" | "Regresso";
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
    if (!task.due_at || task.completed || task.source_service_id) continue;
    const date = lisbonDay(task.due_at);
    if (date > deadline) continue;
    alerts.push({ id: task.id, date, kind: "Tarefa",
      title: task.title, target: { type: "trip", id: trip.id, taskId: task.id } });
  }
  for (const [kind, date] of [["Partida", trip.departure_date], ["Regresso", trip.return_date]] as const) {
    if (date && date >= today && date <= deadline) alerts.push({ id: kind, date, kind,
      title: kind + " da viagem", target: { type: "trip", id: trip.id } });
  }
  return alerts;
}

export function bookingAlerts(trip: TripDates & { services: {
  id: string; service_type: string; title: string; starts_on: string | null; ends_on: string | null;
  departure_at?: string | null; booking?: BookingDetails;
}[] }, today: string, now: number): TripAlert[] {
  if (trip.archived_at || ["cancelled", "completed"].includes(trip.status)) return [];
  const tasks = new Map(trip.tasks.filter(task => task.source_service_id).map(task => [task.source_service_id, task]));
  const deadline = addDays(today, 14);
  return trip.services.flatMap(service => {
    const flight = service.service_type === "flight";
    if (!flight && service.service_type !== "accommodation") return [];
    const status = service.booking?.status || "pending";
    const end = flight ? service.starts_on : service.ends_on || service.starts_on;
    if (status === "cancelled" || (end && end < today && !(flight && service.departure_at && Date.parse(service.departure_at) > now)) ||
      (flight && service.departure_at && Date.parse(service.departure_at) <= now)) return [];
    const target = { type: "trip", id: trip.id, tripTab: flight ? "flights" : "hotels" } as const;
    const results: TripAlert[] = [];
    if (status !== "confirmed") results.push({
      id: service.id, date: service.starts_on || today, kind: flight ? "Voo" : "Hotel",
      title: service.title + " · " + bookingStates[status], target,
    });
    const task = tasks.get(service.id);
    if (flight && task?.due_at && !task.completed && lisbonDay(task.due_at) <= deadline) results.push({
      id: task.id, date: lisbonDay(task.due_at), kind: "Check-in",
      title: service.title + (Date.parse(task.due_at) <= now ? " · Disponível" : " · Próximo"), target,
    });
    return results;
  }).sort((first, second) => first.date.localeCompare(second.date));
}
