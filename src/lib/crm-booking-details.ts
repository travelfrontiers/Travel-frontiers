export const bookingStates = {
  pending: "Por confirmar",
  requested: "Confirmação solicitada",
  confirmed: "Confirmado",
  issue: "Problema identificado",
  cancelled: "Cancelado",
} as const;

export const bookingTextFields = {
  city: 160, destination: 240, board: 100, room: 160, email: 254, phone: 50,
  flight_number: 20, origin: 160, destination_airport: 160, pnr: 100,
  departure_time: 5, arrival_time: 5, departure_zone: 80, arrival_zone: 80,
  checkin_local: 16, checkin_url: 500, checkin_verified: 3, drive_url: 500, confirmed_on: 10,
} as const;

type TextField = keyof typeof bookingTextFields;
export type BookingDetails = Partial<Record<TextField, string>> & { status?: keyof typeof bookingStates };

export const hotelFields = ["city", "destination", "board", "room", "email", "phone", "confirmed_on"] as const;
export const flightFields = ["flight_number", "origin", "destination_airport", "pnr", "departure_time",
  "arrival_time", "departure_zone", "arrival_zone", "checkin_local", "checkin_url", "checkin_verified"] as const;

export function readBookingForm(data: FormData, type: unknown, prefix = "") {
  const fields = type === "flight" ? flightFields : type === "accommodation" ? hotelFields : [];
  return Object.fromEntries([...fields, "status", "drive_url"].flatMap(key => {
    const value = data.get(prefix + key);
    return typeof value === "string" && value.trim() ? [[key, value.trim()]] : [];
  }));
}

export function bookingClock(task: { due_at: string | null; completed: boolean } | undefined, now: number) {
  if (task?.completed) return "Concluído";
  if (!task?.due_at) return "Por agendar";
  return Date.parse(task.due_at) <= now ? "Disponível" : "Pendente";
}
