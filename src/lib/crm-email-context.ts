import { CrmError, type crmConfig } from "./crm-office-api";
import { emailScopes, type EmailLanguage, type EmailScope } from "./crm-email-templates";
import { emailAddress } from "./crm-email-recipients";
import type { OfficeClient, Proposal, ProposalVersion } from "./crm-office-types";

export type EmailConfig = Awaited<ReturnType<typeof crmConfig>>;
export type EmailContact = { id: string; name: string; email: string | null };
export type EmailContext = {
  scope: EmailScope; id: string;
  client_id: string | null; lead_id: string | null; proposal_id: string | null; proposal_version: number | null; trip_id: string | null;
  recipient: string | null; contacts: EmailContact[]; language: EmailLanguage; fields: Record<string, string>;
  archived: boolean; driveId: string | null; driveFileName: string | null; currentVersion: number | null; proposalStatus: Proposal["status"] | null;
};
export const validEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value);

export function isEmailScope(value: unknown): value is EmailScope {
  return typeof value === "string" && emailScopes.some(scope => scope === value);
}

export async function emailRest<T>(config: EmailConfig, table: string, query: Record<string, string>, init?: RequestInit) {
  const response = await fetch(config.url + "/rest/v1/" + table + "?" + new URLSearchParams(query), {
    ...init, headers: { ...config.headers, ...init?.headers }, cache: "no-store",
  });
  if (!response.ok) throw new CrmError("Não foi possível consultar ou guardar o histórico de email.", 502);
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

async function row<T>(config: EmailConfig, table: string, id: string, select = "*") {
  const [item] = await emailRest<T[]>(config, table, { id: "eq." + id, select, limit: "1" });
  return item;
}

type Dossier = {
  full_name?: string; email?: string | null; language?: EmailLanguage; travel_period?: string | null;
  client_id: string | null; lead_id?: string | null; destination: string | null; reference?: string | null;
  departure_date: string | null; return_date: string | null; total_amount?: number | null; currency?: string;
  operator?: string | null; archived_at?: string | null;
};
type Finance = { customer_net: number; balance: number | null; next_due_on: string | null; currency: string };
type DriveFile = { drive_file_id: string; file_name: string };

export async function loadEmailContext(config: EmailConfig, scope: EmailScope, id: string, version?: number) {
  let proposal: Proposal | undefined;
  let document: ProposalVersion | undefined;
  let source: Dossier;
  if (scope === "proposal") {
    proposal = await row<Proposal>(config, "crm_proposals", id);
    if (!proposal) throw new CrmError("A proposta já não existe.", 404);
    const [stored] = await emailRest<ProposalVersion[]>(config, "crm_proposal_versions", {
      proposal_id: "eq." + id, version: "eq." + (version ?? proposal.current_version), select: "*", limit: "1",
    });
    if (!stored) throw new CrmError("A versão da proposta já não existe.", 404);
    document = stored;
    source = { ...stored, client_id: proposal.client_id, lead_id: proposal.lead_id };
  } else {
    source = await row<Dossier>(config, scope === "lead" ? "crm_leads" : "crm_trips", id);
    if (!source) throw new CrmError("A ficha já não existe.", 404);
  }

  const tripId = scope === "trip" ? id : proposal?.trip_id ?? null;
  const [client, finance, hotels, driveFile, travelers] = await Promise.all([
    source.client_id ? row<OfficeClient>(config, "crm_clients", source.client_id, "id,full_name,email,language") : null,
    tripId ? emailRest<Finance[]>(config, "crm_trip_finance_overview", {
      trip_id: "eq." + tripId, select: "customer_net,balance,next_due_on,currency", limit: "1",
    }).then(result => result[0]) : null,
    tripId ? emailRest<{ title: string }[]>(config, "crm_trip_services", {
      trip_id: "eq." + tripId, service_type: "eq.accommodation", select: "title", order: "sort_order.asc,id", limit: "5",
    }) : [],
    document?.document_id ? row<DriveFile>(config, "crm_drive_files", document.document_id, "drive_file_id,file_name") : null,
    tripId ? emailRest<{ client: Pick<OfficeClient, "id" | "full_name" | "email"> | null }[]>(config, "crm_trip_clients", {
      trip_id: "eq." + tripId, select: "client:crm_clients(id,full_name,email)", order: "client_id", limit: "30",
    }) : [],
  ]);
  const language = client?.language ?? source.language ?? "pt";
  const locale = { pt: "pt-PT", en: "en-GB", fr: "fr-FR" }[language];
  const dates = (date?: string | null) => date ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z")) : "";
  const money = (value?: number | null) => value == null ? "" : new Intl.NumberFormat(locale, { style: "currency", currency: source.currency || finance?.currency || "EUR" }).format(Number(value));
  const departure = dates(source.departure_date);
  const returning = dates(source.return_date);
  const primaryEmail = [client?.email, source.email].find(emailAddress) ?? null;
  const contacts: EmailContact[] = travelers.flatMap(({ client: traveler }) => traveler ? [{
    id: traveler.id, name: traveler.full_name, email: emailAddress(traveler.email) ? traveler.email.toLowerCase() : null,
  }] : []);
  if (!contacts.length && (client || source.full_name || primaryEmail)) {
    contacts.push({ id: client?.id ?? id, name: client?.full_name || source.full_name || "", email: primaryEmail?.toLowerCase() ?? null });
  }
  const recipient = contacts.find(contact => contact.email === primaryEmail?.toLowerCase())?.email
    ?? contacts.find(contact => contact.email)?.email ?? null;
  const context: EmailContext = {
    scope, id, client_id: source.client_id, lead_id: scope === "lead" ? id : source.lead_id ?? null,
    proposal_id: proposal?.id ?? null, proposal_version: document?.version ?? null, trip_id: tripId,
    archived: Boolean(source.archived_at || proposal?.status === "archived"), recipient, contacts, language,
    driveId: driveFile?.drive_file_id ?? null, driveFileName: driveFile?.file_name ?? null, currentVersion: proposal?.current_version ?? null,
    proposalStatus: proposal?.status ?? null,
    fields: {
      cliente: client?.full_name || source.full_name || "", destino: source.destination || "",
      periodo: departure && returning ? departure + " – " + returning : source.travel_period || departure || returning,
      partida: departure, regresso: returning, valor: money(source.total_amount),
      versao: document ? String(document.version) : "", validade: dates(document?.valid_until), operador: source.operator || "",
      referencia: source.reference || document?.imported?.reference || "",
      hotel_regime: (hotels.length ? hotels : document?.imported?.services.filter(service => service.service_type === "accommodation") ?? []).map(hotel => hotel.title).join(" / "),
      pago: money(finance?.customer_net), saldo: money(finance?.balance), prazo: dates(finance?.next_due_on),
      condicoes: document?.conditions || "", incluido: document?.inclusions || "", excluido: document?.exclusions || "",
    },
  };
  return context;
}

export function emailScopeFilter(context: EmailContext) {
  return { [context.scope + "_id"]: "eq." + context.id };
}
