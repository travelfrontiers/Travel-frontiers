import { optionalDate } from "@/lib/crm-office-api";
import { bookingStates, bookingTextFields, flightFields, hotelFields, type BookingDetails } from "./crm-booking-details";

const serviceTypes = ["flight", "accommodation", "activity", "transfer", "insurance", "other"];
const timePattern = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

function secureUrl(value: string, driveOnly = false) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (!driveOnly || url.host === "drive.google.com");
  } catch {
    return false;
  }
}

function validZone(value: string) {
  if (value !== "UTC" && !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  try { new Intl.DateTimeFormat("pt-PT", { timeZone: value }); return true; }
  catch { return false; }
}

function normalizeBooking(value: unknown, type: string): BookingDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = type === "flight" ? flightFields : type === "accommodation" ? hotelFields : [];
  const allowed = new Set<string>([...fields, "status", "drive_url"]);
  const result: BookingDetails = {};
  for (const [key, input] of Object.entries(value)) {
    if (!allowed.has(key) || typeof input !== "string") return null;
    const text = input.trim();
    if (!text) continue;
    if (key === "status") {
      if (!Object.hasOwn(bookingStates, text)) return null;
      result.status = text as BookingDetails["status"];
      continue;
    }
    const field = key as keyof typeof bookingTextFields;
    if (text.length > bookingTextFields[field] ||
      (field.endsWith("_time") && !timePattern.test(text)) ||
      (field.endsWith("_zone") && !validZone(text)) ||
      (field === "confirmed_on" && !optionalDate(text)) ||
      (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) ||
      (field === "phone" && !/^\+?[0-9][0-9 ().-]{2,49}$/.test(text)) ||
      (field === "drive_url" && !secureUrl(text, true)) ||
      (field === "checkin_verified" && text !== "yes") ||
      (field === "checkin_url" && !secureUrl(text))) return null;
    result[field] = text;
  }
  if (result.checkin_url && result.checkin_verified !== "yes") return null;
  if (result.checkin_local && (!result.departure_zone || result.checkin_local[10] !== "T" ||
    !optionalDate(result.checkin_local.slice(0, 10)) || !timePattern.test(result.checkin_local.slice(11)))) return null;
  return result;
}

export function normalizeTripService(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const service = value as Record<string, unknown>;
  const title = typeof service.title === "string" ? service.title.trim() : "";
  const provider = typeof service.provider === "string" ? service.provider.trim() : "";
  const reference = typeof service.reference === "string" ? service.reference.trim() : "";
  const details = typeof service.details === "string" ? service.details.trim() : "";
  const startsOn = service.starts_on || null;
  const endsOn = service.ends_on || null;
  const type = service.service_type;
  if (typeof type !== "string" || !serviceTypes.includes(type) || !title || title.length > 240 ||
    provider.length > 160 || reference.length > 100 || details.length > 4000 ||
    !optionalDate(startsOn) || !optionalDate(endsOn) ||
    (type !== "flight" && typeof startsOn === "string" && typeof endsOn === "string" && endsOn < startsOn)) return null;
  const booking = service.booking === undefined ? undefined : normalizeBooking(service.booking, type);
  if (booking === null) return null;
  return { service_type: type, title, provider: provider || null, reference: reference || null,
    starts_on: startsOn, ends_on: endsOn, details: details || null, ...(booking && { booking }) };
}

export function normalizeTripServices(rawServices: unknown) {
  if (!Array.isArray(rawServices) || rawServices.length > 40) return null;
  const services = rawServices.map(normalizeTripService);
  return services.every(service => service !== null) ? services : null;
}
