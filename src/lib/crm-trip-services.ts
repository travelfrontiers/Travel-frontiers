import { optionalDate } from "@/lib/crm-office-api";

const serviceTypes = ["flight", "accommodation", "activity", "transfer", "insurance", "other"];

export function normalizeTripServices(rawServices: unknown) {
  if (!Array.isArray(rawServices) || rawServices.length > 40) return null;
  const services = rawServices.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const service = value as Record<string, unknown>;
    const title = typeof service.title === "string" ? service.title.trim() : "";
    const provider = typeof service.provider === "string" ? service.provider.trim() : "";
    const reference = typeof service.reference === "string" ? service.reference.trim() : "";
    const details = typeof service.details === "string" ? service.details.trim() : "";
    const startsOn = service.starts_on === "" || service.starts_on === undefined ? null : service.starts_on;
    const endsOn = service.ends_on === "" || service.ends_on === undefined ? null : service.ends_on;
    if (typeof service.service_type !== "string" || !serviceTypes.includes(service.service_type) || title.length < 1 || title.length > 240 || provider.length > 160 || reference.length > 100 || details.length > 1000 || !optionalDate(startsOn) || !optionalDate(endsOn) || typeof startsOn === "string" && typeof endsOn === "string" && endsOn < startsOn) return null;
    return { service_type: service.service_type, title, provider: provider || null, reference: reference || null, starts_on: startsOn, ends_on: endsOn, details: details || null };
  });
  return services.every(service => service !== null) ? services : null;
}
