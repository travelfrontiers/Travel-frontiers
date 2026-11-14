import { CrmError, dateOnly, uuid } from "./crm-office-api";
import { isManualLeadSource } from "./crm-manual-lead";

export function manualLeadFields(body: Record<string, unknown>) {
  function text(field: string, max: number, label: string) {
    const value = body[field];
    if (value == null) return null;
    if (typeof value !== "string" || value.trim().length > max) throw new CrmError("Revê o campo " + label + ".");
    return value.trim() || null;
  }
  function date(field: string, label: string) {
    const value = body[field];
    if (value == null || value === "") return null;
    if (!dateOnly(value)) throw new CrmError("Revê a data de " + label + ".");
    return value;
  }

  const full_name = text("full_name", 160, "Nome");
  const email = text("email", 254, "Email")?.toLowerCase() ?? null;
  const language = body.language ?? "pt";
  const source = body.source;
  const client_id = body.client_id || null;
  if (!full_name || full_name.length < 2) throw new CrmError("Indica o nome do cliente.");
  if (email && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) throw new CrmError("Indica um email válido.");
  if (!isManualLeadSource(source) || !["pt", "en", "fr"].includes(String(language)) || (client_id !== null && !uuid(client_id))) {
    throw new CrmError("Revê a origem, o idioma e o cliente associado.");
  }
  const departure_date = date("departure_date", "partida");
  const return_date = date("return_date", "regresso");
  if (departure_date && return_date && return_date < departure_date) throw new CrmError("O regresso deve ser na data de partida ou depois.");
  const travel_period = text("travel_period", 120, "Período aproximado");
  if (travel_period && travel_period.length < 3) throw new CrmError("Indica um período aproximado com pelo menos três caracteres.");
  const adults = body.adults ?? 1;
  const children_ages = body.children_ages ?? [];
  if (typeof adults !== "number" || !Number.isInteger(adults) || adults < 1 || adults > 20 ||
      !Array.isArray(children_ages) || children_ages.length > 19 ||
      children_ages.some(age => !Number.isInteger(age) || age < 0 || age > 17)) {
    throw new CrmError("Indica entre 1 e 20 adultos e idades das crianças entre 0 e 17 anos.");
  }
  return {
    full_name, email, language, source, client_id, adults, children_ages, departure_date, return_date,
    phone: text("phone", 40, "Telefone"),
    destination: text("destination", 240, "Destino"),
    date_flexible: body.date_flexible === true,
    travel_period,
    budget: text("budget", 120, "Orçamento por pessoa"),
    notes: text("notes", 4000, "Detalhes do pedido"),
    follow_up_date: date("follow_up_date", "próximo contacto"),
  };
}
