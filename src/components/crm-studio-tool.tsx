"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useClient, useCurrentUser } from "sanity";
import { ArrowUpRight, Moon, Sun, BellRing, CalendarDays, FileWarning, Inbox, ListTodo, Plane, Send, ShieldCheck, Users } from "lucide-react";
import styles from "./crm-studio-tool.module.css";
import CrmDriveDocuments from "./crm-drive-documents";
import type { TripPdfFields } from "@/lib/crm-trip-pdf";

const adminEmail = "tf.travel.frontiers@gmail.com";
const leadStatuses = [
  { id: "new", label: "Novos pedidos" }, { id: "quote_preparing", label: "A preparar orçamento" },
  { id: "quote_sent", label: "Orçamento enviado" }, { id: "awaiting_reply", label: "A aguardar resposta" },
  { id: "won", label: "Ganho" }, { id: "lost", label: "Perdido" },
] as const;
const tripStatuses = [
  { id: "planning", label: "Em preparação" }, { id: "confirmed", label: "Confirmada" },
  { id: "travelling", label: "Em viagem" }, { id: "completed", label: "Concluída" }, { id: "cancelled", label: "Cancelada" },
] as const;

type LeadStatus = (typeof leadStatuses)[number]["id"];
type Lead = {
  id: string; created_at: string; full_name: string; email: string; language: "pt" | "en" | "fr";
  phone: string | null; destination: string | null; departure_date: string | null; return_date: string | null;
  date_flexible: boolean; client_id: string | null; adults: number; children_ages: number[]; travel_style: string | null;
  budget: string | null; notes: string | null; status: LeadStatus; internal_notes: string | null; follow_up_date: string | null; lost_reason: string | null;
};
type Client = { id: string; full_name: string; email: string | null; phone: string | null; language: "pt" | "en" | "fr"; internal_notes: string | null; source: string; created_at: string; updated_at: string };

function ClientMultiSelect({ clients, fieldName = "client_ids", selectedIds = [], title = "Clientes *" }: { clients: Client[]; fieldName?: string; selectedIds?: string[]; title?: string }) {
  const [selected, setSelected] = useState<string[]>(selectedIds);
  return <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-semibold">{title}</legend><p className="text-xs font-normal text-slate-500">Seleciona uma ou várias pessoas que viajam juntas.</p><div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-300 p-3 sm:grid-cols-2">{clients.map((entry) => <label key={entry.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><input type="checkbox" name={fieldName} value={entry.id} checked={selected.includes(entry.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} className="size-4 accent-orange-800" /><span>{entry.full_name}{entry.email ? <span className="block text-xs font-normal text-slate-500">{entry.email}</span> : null}</span></label>)}</div></fieldset>;
}
type ClientDocument = { id: string; client_id: string; document_type: "passport" | "identity_card" | "residence_permit" | "other"; document_number: string; expires_on: string; created_at: string; updated_at: string };
type TripTask = { id: string; trip_id: string; title: string; due_at: string | null; completed: boolean; sort_order: number; source_service_id?: string | null };
type TripService = { id: string; trip_id: string; service_type: "flight" | "accommodation" | "activity" | "transfer" | "insurance" | "other"; title: string; provider: string | null; reference: string | null; starts_on: string | null; ends_on: string | null; details: string | null; sort_order: number };
type Trip = { id: string; client_id: string | null; client_ids: string[]; lead_id: string | null; reference: string | null; destination: string | null; departure_date: string | null; return_date: string | null; status: (typeof tripStatuses)[number]["id"]; operator: string | null; adults: number | null; children_count: number | null; total_amount: number | null; currency: string; trip_notes: string | null; services: TripService[]; tasks: TripTask[] };
type View = "dashboard" | "pipeline" | "clients" | "trips" | "calendar";
type CrmArea = "commercial" | "operational";

const budgetLabels: Record<string, string> = {
  under_500: "Até 500 €", "500_1000": "500 € – 1.000 €", "1000_1500": "1.000 € – 1.500 €",
  "1500_2000": "1.500 € – 2.000 €", over_2000: "Mais de 2.000 €", undecided: "Ainda não defini",
};
const documentTypeLabels: Record<ClientDocument["document_type"], string> = {
  passport: "Passaporte", identity_card: "Cartão de cidadão", residence_permit: "Título de residência", other: "Outro documento",
};
const tripServiceTypeLabels: Record<TripService["service_type"], string> = { flight: "Voo", accommodation: "Alojamento", activity: "Atividade/bilhete", transfer: "Transfer", insurance: "Seguro", other: "Outro serviço" };
const metricToneClasses: Record<string, { card: string; icon: string; value: string }> = {
  sky: { card: "border-sky-100 from-white to-sky-50 hover:border-sky-300", icon: "bg-sky-100 text-sky-800", value: "text-sky-950" },
  teal: { card: "border-orange-100 from-white to-orange-50 hover:border-orange-300", icon: "bg-orange-100 text-orange-800", value: "text-orange-950" },
  violet: { card: "border-violet-100 from-white to-violet-50 hover:border-violet-300", icon: "bg-violet-100 text-violet-800", value: "text-violet-950" },
  blue: { card: "border-blue-100 from-white to-blue-50 hover:border-blue-300", icon: "bg-blue-100 text-blue-800", value: "text-blue-950" },
  rose: { card: "border-rose-100 from-white to-rose-50 hover:border-rose-300", icon: "bg-rose-100 text-rose-800", value: "text-rose-950" },
  amber: { card: "border-amber-100 from-white to-amber-50 hover:border-amber-300", icon: "bg-amber-100 text-amber-800", value: "text-amber-950" },
  slate: { card: "border-slate-200 from-white to-slate-50 hover:border-slate-300", icon: "bg-slate-100 text-slate-700", value: "text-slate-950" },
};
const pipelineStageColors: Record<LeadStatus, string> = {
  new: "bg-sky-500", quote_preparing: "bg-indigo-500",
  quote_sent: "bg-violet-500", awaiting_reply: "bg-amber-500", won: "bg-emerald-500", lost: "bg-slate-400",
};
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-700 focus:ring-2 focus:ring-orange-700/20";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeZone: "Europe/Lisbon" }).format(new Date(value));
}

function localDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateAfterDays(days: number) {
  const today = new Date(`${localToday()}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() + days);
  return today.toISOString().slice(0, 10);
}

function daysUntilDate(value: string) {
  const today = new Date(`${localToday()}T00:00:00Z`).getTime();
  return Math.round((new Date(`${value}T00:00:00Z`).getTime() - today) / 86_400_000);
}

function activeLeadFollowups(leads: Lead[]) {
  return leads.filter((lead) => lead.status !== "won" && lead.status !== "lost" && lead.follow_up_date);
}

export default function CrmStudioTool() {
  const client = useClient({ apiVersion: "2021-06-07" });
  const user = useCurrentUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("travel-frontiers-crm-theme");
      setTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch { /* The theme still works when browser storage is unavailable. */ }
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { window.localStorage.setItem("travel-frontiers-crm-theme", next); } catch { /* Keep the current session preference. */ }
  }
  const [token, setToken] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [area, setArea] = useState<CrmArea>("commercial");
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<TripPdfFields | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfSource, setPdfSource] = useState<File | null>(null);
  const [pdfToArchive, setPdfToArchive] = useState<{ tripId: string; file: File } | null>(null);
  const [tripClientIds, setTripClientIds] = useState<string[]>([]);

  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<LeadStatus | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function goToView(nextView: View) {
    setView(nextView);
    setArea(nextView === "trips" || nextView === "calendar" ? "operational" : "commercial");
  }

  function goToArea(nextArea: CrmArea) {
    setArea(nextArea);
    setView(nextArea === "commercial" ? "dashboard" : "trips");
  }

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const clientToken = client.config().token;
    const storedValue = projectId ? window.localStorage.getItem(`__studio_auth_token_${projectId}`) : null;
    let storedToken = "";
    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as { token?: unknown };
        storedToken = typeof parsed.token === "string" ? parsed.token : storedValue;
      } catch {
        storedToken = storedValue;
      }
    }
    setToken(clientToken || storedToken || "");
  }, [client]);

  const authorizedFetch = useCallback((url: string, init: RequestInit = {}) => fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }), [token]);

  const refresh = useCallback(async () => {
    if (!token || user?.email?.toLowerCase() !== adminEmail) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [leadsResponse, clientsResponse, tripsResponse, documentsResponse] = await Promise.all([
        authorizedFetch("/api/crm/leads"), authorizedFetch("/api/crm/clients"), authorizedFetch("/api/crm/trips"), authorizedFetch("/api/crm/documents"),
      ]);
      const [leadsResult, clientsResult, tripsResult, documentsResult] = await Promise.all([leadsResponse.json(), clientsResponse.json(), tripsResponse.json(), documentsResponse.json()]);
      if (!leadsResponse.ok) throw new Error(leadsResult.error || "Não foi possível carregar os pedidos.");
      if (!clientsResponse.ok) throw new Error(clientsResult.error || "Não foi possível carregar os clientes.");
      if (!tripsResponse.ok) throw new Error(tripsResult.error || "Não foi possível carregar as viagens.");
      if (!documentsResponse.ok) throw new Error(documentsResult.error || "Não foi possível carregar os documentos.");
      setLeads(leadsResult.leads as Lead[]);
      setClients(clientsResult.clients as Client[]);
      setTrips(tripsResult.trips as Trip[]);
      setDocuments(documentsResult.documents as ClientDocument[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o CRM.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, token, user?.email]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!loading && user?.email?.toLowerCase() === adminEmail && !token) {
      setError("Não foi possível ler a credencial da sessão Google do Studio. Atualiza a página do Admin e tenta novamente.");
    }
  }, [loading, token, user?.email]);

  const visibleLeads = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-PT");
    if (!normalized) return leads;
    return leads.filter((lead) => `${lead.full_name} ${lead.email} ${lead.destination || ""}`.toLocaleLowerCase("pt-PT").includes(normalized));
  }, [leads, search]);

  const visibleClients = useMemo(() => {
    const normalized = clientSearch.trim().toLocaleLowerCase("pt-PT");
    if (!normalized) return clients;
    return clients.filter((client) => `${client.full_name} ${client.email || ""} ${client.phone || ""}`.toLocaleLowerCase("pt-PT").includes(normalized));
  }, [clients, clientSearch]);

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setSaved(false); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(`/api/crm/leads/${selected.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: data.get("status"), internal_notes: data.get("internal_notes"), follow_up_date: data.get("follow_up_date"), lost_reason: data.get("lost_reason") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar as alterações.");
      setLeads((current) => current.map((lead) => lead.id === selected.id ? result.lead as Lead : lead));
      setSelected(result.lead as Lead); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar as alterações."); }
    finally { setSaving(false); }
  }

  async function moveLead(leadId: string, status: LeadStatus) {
    const lead = leads.find((entry) => entry.id === leadId);
    if (!lead || lead.status === status || movingLeadId) return;
    setMovingLeadId(leadId); setError("");
    try {
      const response = await authorizedFetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, internal_notes: lead.internal_notes || "", follow_up_date: lead.follow_up_date || "", lost_reason: status === "lost" ? lead.lost_reason || "" : "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível mover o pedido.");
      const updatedLead = result.lead as Lead;
      setLeads((current) => current.map((entry) => entry.id === lead.id ? updatedLead : entry));
      setSelected((current) => current?.id === lead.id ? updatedLead : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível mover o pedido."); }
    finally { setMovingLeadId(null); setDraggingLeadId(null); }
  }

  async function createClientFromLead(lead: Lead) {
    if (lead.client_id) return;
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch(`/api/crm/leads/${lead.id}/client`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o cliente.");
      const savedClient = result.client as Client;
      const updatedLead = result.lead as Lead;
      setClients((current) => current.some((client) => client.id === savedClient.id)
        ? current.map((client) => client.id === savedClient.id ? savedClient : client)
        : [...current, savedClient].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-PT")));
      setLeads((current) => current.map((item) => item.id === updatedLead.id ? updatedLead : item));
      setSelected(updatedLead);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o cliente."); }
    finally { setSaving(false); }
  }

  async function convertLead(lead: Lead) {
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch("/api/crm/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: lead.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar a viagem.");
      await refresh(); setSelected(null); goToView("trips");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar a viagem."); }
    finally { setSaving(false); }
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const response = await authorizedFetch("/api/crm/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: data.get("full_name"), email: data.get("email"), phone: data.get("phone"), language: data.get("language"), internal_notes: data.get("internal_notes") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar o cliente.");
      setClients((current) => [...current, result.client as Client].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-PT")));
      setShowClientForm(false); form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o cliente."); }
    finally { setSaving(false); }
  }

  async function saveClient(event: FormEvent<HTMLFormElement>, client: Client) {
    event.preventDefault(); setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(`/api/crm/clients/${client.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: data.get("full_name"), email: data.get("email"), phone: data.get("phone"), language: data.get("language"), internal_notes: data.get("internal_notes") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o cliente.");
      setClients((current) => current.map((entry) => entry.id === client.id ? result.client as Client : entry).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-PT")));
      setEditingClientId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o cliente."); }
    finally { setSaving(false); }
  }

  async function deleteClient(client: Client) {
    const confirmed = window.confirm(`Apagar ${client.full_name}? A ficha, os documentos e os dados pessoais dos pedidos associados serão removidos. As viagens, tarefas e reservas ficam guardadas sem este cliente associado. Esta ação não pode ser anulada.`);
    if (!confirmed) return;
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch(`/api/crm/clients/${client.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível apagar o cliente.");
      setClients((current) => current.filter((entry) => entry.id !== client.id));
      setDocuments((current) => current.filter((entry) => entry.client_id !== client.id));
      setLeads((current) => current.map((lead) => lead.client_id === client.id ? { ...lead, client_id: null } : lead));
      setTrips((current) => current.map((trip) => {
        const clientIds = trip.client_ids.filter((id) => id !== client.id);
        return { ...trip, client_ids: clientIds, client_id: trip.client_id === client.id ? clientIds[0] || null : trip.client_id };
      }));
      setEditingClientId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível apagar o cliente."); }
    finally { setSaving(false); }
  }

  async function deleteClientDocument(document: ClientDocument) {
    if (!window.confirm("Apagar o registo deste documento? O tipo, número e validade serão removidos da ficha. Esta ação não pode ser anulada.")) return;
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch(`/api/crm/documents/${document.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível apagar o documento.");
      setDocuments((current) => current.filter((entry) => entry.id !== document.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível apagar o documento."); }
    finally { setSaving(false); }
  }

  async function saveClientDocument(event: FormEvent<HTMLFormElement>, clientId: string, document?: ClientDocument) {
    event.preventDefault(); setSaving(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const response = await authorizedFetch(document ? `/api/crm/documents/${document.id}` : "/api/crm/documents", {
        method: document ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, document_type: data.get("document_type"), document_number: data.get("document_number"), expires_on: data.get("expires_on") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar o documento.");
      const savedDocument = result.document as ClientDocument;
      setDocuments((current) => (document ? current.map((entry) => entry.id === document.id ? savedDocument : entry) : [...current, savedDocument]).sort((a, b) => a.expires_on.localeCompare(b.expires_on)));
      if (!document) form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o documento."); }
    finally { setSaving(false); }
  }

  async function createManualTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    if (data.getAll("client_ids").length === 0) { setError("Seleciona pelo menos um cliente para a viagem."); setSaving(false); return; }
    try {
      const response = await authorizedFetch("/api/crm/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_ids: data.getAll("client_ids"), reference: data.get("reference"), destination: data.get("destination"), departure_date: data.get("departure_date"), return_date: data.get("return_date"), status: data.get("status"), operator: data.get("operator"), adults: data.get("adults"), children_count: data.get("children_count"), total_amount: data.get("total_amount"), currency: data.get("currency"), trip_notes: data.get("trip_notes"), services: Array.from({ length: Math.min(40, Number(data.get("service_count") || 0)) }, (_, index) => ({ service_type: data.get(`service_${index}_type`), title: data.get(`service_${index}_title`), provider: data.get(`service_${index}_provider`), reference: data.get(`service_${index}_reference`), starts_on: data.get(`service_${index}_starts_on`) || null, ends_on: data.get(`service_${index}_ends_on`) || null, details: data.get(`service_${index}_details`) })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar a viagem.");
      setShowTripForm(false); setTripClientIds([]); form.reset();
      if (pdfPreview && pdfSource) setPdfToArchive({ tripId: result.trip_id, file: pdfSource });
      setShowPdfImport(false); setPdfPreview(null); setPdfSource(null);
      await refresh(); goToView("trips");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar a viagem."); }
    finally { setSaving(false); }
  }

  async function previewTripPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPdfPreview(null);
    const file = new FormData(event.currentTarget).get("pdf_file");
    if (!(file instanceof File) || !file.size) { setError("Seleciona um PDF de orçamento ou reserva."); return; }
    setPdfLoading(true); setPdfSource(null);
    try {
      const upload = new FormData(); upload.set("file", file);
      const response = await authorizedFetch("/api/crm/trips", { method: "POST", body: upload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível ler o PDF.");
      setPdfPreview(result.fields as TripPdfFields); setPdfSource(file);
      setTripClientIds([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler o PDF."); }
    finally { setPdfLoading(false); }
  }

  async function saveTrip(event: FormEvent<HTMLFormElement>, trip: Trip) {
    event.preventDefault(); setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    if (data.getAll("client_ids").length === 0) { setError("Seleciona pelo menos um cliente para a viagem."); setSaving(false); return; }
    try {
      const response = await authorizedFetch(`/api/crm/trips/${trip.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_ids: data.getAll("client_ids"), status: data.get("status"), destination: data.get("destination"), departure_date: data.get("departure_date") || null, return_date: data.get("return_date") || null, operator: data.get("operator"), adults: data.get("adults"), children_count: data.get("children_count"), total_amount: data.get("total_amount"), currency: data.get("currency"), trip_notes: data.get("trip_notes") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar a viagem.");
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...result.trip, tasks: item.tasks, services: item.services } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar a viagem."); }
    finally { setSaving(false); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>, trip: Trip) {
    event.preventDefault(); setSaving(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const response = await authorizedFetch(`/api/crm/trips/${trip.id}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.get("title"), due_date: data.get("due_date") || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível adicionar a tarefa.");
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...item, tasks: [...item.tasks, result.task as TripTask] } : item));
      form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível adicionar a tarefa."); }
    finally { setSaving(false); }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>, trip: Trip, task: TripTask) {
    event.preventDefault(); setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(`/api/crm/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.get("title"), due_date: data.get("due_date") || null, completed: data.get("completed") === "on" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar a tarefa.");
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...item, tasks: item.tasks.map((entry) => entry.id === task.id ? result.task as TripTask : entry) } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar a tarefa."); }
    finally { setSaving(false); }
  }

  async function reloadTrips() {
    const response = await authorizedFetch("/api/crm/trips");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "O serviço foi alterado, mas não foi possível atualizar os lembretes. Atualiza o CRM.");
    setTrips(result.trips as Trip[]);
  }

  async function saveTripService(event: FormEvent<HTMLFormElement>, trip: Trip, service?: TripService) {
    event.preventDefault(); setSaving(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    const serviceBody = { trip_id: trip.id, service_type: data.get("service_type"), title: data.get("title"), provider: data.get("provider"), reference: data.get("reference"), starts_on: data.get("starts_on") || null, ends_on: data.get("ends_on") || null, details: data.get("details") };
    try {
      const response = await authorizedFetch("/api/crm/trip-services", { method: service ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(service ? { ...serviceBody, id: service.id } : serviceBody) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar o serviço.");
      await reloadTrips();
      if (!service) form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o serviço."); }
    finally { setSaving(false); }
  }

  async function deleteTrip(trip: Trip) {
    const confirmed = window.confirm(`Apagar a viagem “${trip.destination || "Destino por definir"}”? A ficha da viagem, os ${trip.services.length} serviços/reservas e as ${trip.tasks.length} tarefas da checklist serão removidos. Os clientes e o pedido comercial associado permanecem. Esta ação não pode ser anulada.`);
    if (!confirmed) return;
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch(`/api/crm/trips/${trip.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível apagar a viagem.");
      setTrips((current) => current.filter((entry) => entry.id !== trip.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível apagar a viagem."); }
    finally { setSaving(false); }
  }

  async function deleteTripService(trip: Trip, service: TripService) {
    if (!window.confirm(`Remover o serviço “${service.title}”?`)) return;
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch("/api/crm/trip-services", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: service.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível remover o serviço.");
      await reloadTrips();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover o serviço."); }
    finally { setSaving(false); }
  }

  async function deleteTask(trip: Trip, task: TripTask) {
    if (task.source_service_id) { setError("Este lembrete é gerido automaticamente pelo voo. Edita ou remove o voo associado."); return; }
    if (!window.confirm(`Remover a tarefa “${task.title}”?`)) return;
    setSaving(true); setError("");
    try {
      const response = await authorizedFetch(`/api/crm/tasks/${task.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível remover a tarefa.");
      setTrips((current) => current.map((item) => item.id === trip.id ? { ...item, tasks: item.tasks.filter((entry) => entry.id !== task.id) } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover a tarefa."); }
    finally { setSaving(false); }
  }

  if (user && user.email?.toLowerCase() !== adminEmail) {
    return <main className="p-10"><h1 className="text-2xl font-bold">Acesso não autorizado</h1><p className="mt-2">Esta área CRM está reservada à conta autorizada.</p></main>;
  }

  const events = [
    ...trips.filter((trip) => trip.status !== "cancelled").flatMap((trip) => [
      ...(trip.departure_date ? [{ date: trip.departure_date, title: `Partida · ${trip.destination || "Viagem"}`, detail: tripClientName(trip, clients, leads), done: false }] : []),
      ...(trip.return_date ? [{ date: trip.return_date, title: `Regresso · ${trip.destination || "Viagem"}`, detail: tripClientName(trip, clients, leads), done: false }] : []),
      ...trip.tasks.filter((task) => task.due_at).map((task) => ({ date: task.due_at as string, title: task.title, detail: tripClientName(trip, clients, leads), done: task.completed })),
    ]),
    ...activeLeadFollowups(leads).map((lead) => ({ date: lead.follow_up_date!, title: `Seguimento · ${lead.full_name}`, detail: lead.destination || "Pedido de viagem", done: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const expiryAlerts = documents
    .filter((document) => daysUntilDate(document.expires_on) <= 30)
    .map((document) => ({ document, client: clients.find((entry) => entry.id === document.client_id), days: daysUntilDate(document.expires_on) }))
    .sort((a, b) => a.days - b.days);
  const activeLeads = leads.filter((lead) => lead.status !== "won" && lead.status !== "lost");
  const newLeads = leads.filter((lead) => lead.status === "new");
  const awaitingClient = leads.filter((lead) => lead.status === "quote_sent" || lead.status === "awaiting_reply");
  const activeTrips = trips.filter((trip) => trip.status !== "completed" && trip.status !== "cancelled");
  const tripStageCounts = tripStatuses.map((status) => ({ ...status, count: trips.filter((trip) => trip.status === status.id).length }));
  const maxTripStageCount = Math.max(1, ...tripStageCounts.map((status) => status.count));
  const today = localToday();
  const monthKey = today.slice(0, 7);
  const leadsThisMonth = leads.filter((lead) => lead.created_at.slice(0, 7) === monthKey).length;
  const upcomingDepartures = activeTrips
    .filter((trip) => trip.departure_date && trip.departure_date >= today && trip.departure_date <= dateAfterDays(30))
    .sort((a, b) => (a.departure_date || "").localeCompare(b.departure_date || ""));
  const dueItems = [
    ...activeLeadFollowups(leads).map((lead) => ({ date: lead.follow_up_date!, title: `Seguimento · ${lead.full_name}`, detail: lead.destination || "Pedido de viagem", kind: "Seguimento" as const })),
    ...trips.flatMap((trip) => trip.tasks
      .filter((task) => !task.completed && task.due_at)
      .map((task) => ({ date: task.due_at!.slice(0, 10), title: task.title, detail: tripClientName(trip, clients, leads), kind: "Tarefa" as const }))),
    ...activeTrips.flatMap((trip) => [
      ...(trip.departure_date ? [{ date: trip.departure_date, title: `Partida · ${trip.destination || "Viagem"}`, detail: tripClientName(trip, clients, leads), kind: "Viagem" as const }] : []),
      ...(trip.return_date ? [{ date: trip.return_date, title: `Regresso · ${trip.destination || "Viagem"}`, detail: tripClientName(trip, clients, leads), kind: "Viagem" as const }] : []),
    ]),
  ].filter((item) => item.date <= dateAfterDays(14) && (item.kind === "Tarefa" || item.kind === "Seguimento" || item.date >= today)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const overdueFollowups = activeLeadFollowups(leads).filter((lead) => lead.follow_up_date! < today).length;
  const overdueTasks = trips.reduce((count, trip) => count + trip.tasks.filter((task) => !task.completed && task.due_at && task.due_at.slice(0, 10) < today).length, 0);
  const attentionCount = overdueFollowups + overdueTasks;
  const recentLeads = [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const maxStageCount = Math.max(1, ...leadStatuses.map((status) => leads.filter((lead) => lead.status === status.id).length));
  const dashboardMetrics = [
    { label: "Novos pedidos", value: newLeads.length, note: `${leadsThisMonth} recebidos este mês`, icon: Inbox, tone: "sky", action: () => goToView("pipeline") },
    { label: "Em acompanhamento", value: activeLeads.length, note: "Pedidos ainda não ganhos nem perdidos", icon: Users, tone: "teal", action: () => goToView("pipeline") },
    { label: "À espera do cliente", value: awaitingClient.length, note: "Orçamentos enviados ou resposta pendente", icon: Send, tone: "violet", action: () => goToView("pipeline") },
    { label: "Viagens ativas", value: activeTrips.length, note: "Em preparação, confirmadas ou em viagem", icon: Plane, tone: "blue", action: () => goToView("trips") },
    { label: "Tarefas atrasadas", value: attentionCount, note: `${overdueTasks} tarefas · ${overdueFollowups} seguimentos`, icon: ListTodo, tone: attentionCount ? "rose" : "slate", action: () => goToView("calendar") },
    { label: "Documentos a verificar", value: expiryAlerts.length, note: "Vencidos ou a vencer nos próximos 30 dias", icon: FileWarning, tone: expiryAlerts.length ? "amber" : "slate", action: () => goToView("clients") },
  ];

  return (
    <main data-theme={theme} className={`${styles.root} min-h-screen bg-slate-50 text-slate-900`}>
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><img src="/travel-frontiers-logo-black.webp" alt="Travel Frontiers" width={150} height={80} className={styles.logo} /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-800">Travel Frontiers</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">CRM de viagens</h1><p className="mt-1 text-sm text-slate-500">Sessão Google: {user?.email || "a validar"}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} aria-pressed={theme === "dark"} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}{theme === "dark" ? "Modo claro" : "Modo escuro"}</button><a href="/admin" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Studio · Promoções</a></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8">
        <div className="mb-7 space-y-3">
          <nav aria-label="Vistas principais do CRM" className="flex flex-wrap gap-2">
            {([["commercial", "Vista comercial"], ["operational", "Vista operacional"]] as [CrmArea, string][]).map(([id, label]) => <button key={id} type="button" onClick={() => goToArea(id)} aria-pressed={area === id} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${area === id ? "bg-orange-950 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{label}</button>)}
          </nav>
          <nav aria-label={area === "commercial" ? "Secções comerciais" : "Secções operacionais"} className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {(area === "commercial" ? ([["dashboard", "Resumo comercial"], ["pipeline", "Kanban comercial"], ["clients", "Clientes"]] as [View, string][]) : ([["trips", "Viagens e checklist"], ["calendar", "Calendário"]] as [View, string][])).map(([id, label]) => <button key={id} type="button" onClick={() => goToView(id)} aria-current={view === id ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === id ? "bg-orange-800 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{label}</button>)}
          </nav>
        </div>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading && <p className="rounded-xl bg-white p-8 text-sm text-slate-500">A carregar CRM…</p>}

        {!loading && view === "dashboard" && <>
          <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#171717] via-[#29231b] to-[#563719] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-2 -top-10 size-52 rounded-full border border-white/10" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-100"><BellRing className="size-4" /> O teu negócio, num relance</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Olá, Tiago</h2>
                <p className="mt-2 text-sm text-orange-50 sm:text-base">O estado atual dos pedidos, clientes, viagens e próximos passos.</p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-orange-50"><CalendarDays className="size-4" />{dateLabel(today)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setShowClientForm(true); goToView("clients"); }} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-orange-950 shadow-sm transition hover:bg-orange-50"><Users className="size-4" /> Novo cliente</button>
                <button type="button" onClick={() => { setShowPdfImport(true); setShowTripForm(false); setPdfPreview(null); setTripClientIds([]); goToView("trips"); }} className="inline-flex items-center gap-2 rounded-full bg-orange-100/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/15"><Plane className="size-4" /> Importar orçamento</button>
                <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar dados" className="inline-flex items-center gap-2 rounded-full bg-orange-950/25 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-orange-950/40 disabled:opacity-60"><ArrowUpRight className="size-4" /> Atualizar</button>
              </div>
            </div>
          </section>

          <section aria-label="Estado atual do negócio" className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dashboardMetrics.map((metric) => {
              const Icon = metric.icon;
              const tones = metricToneClasses[metric.tone];
              return <button key={metric.label} type="button" onClick={metric.action} className={`group rounded-2xl border bg-gradient-to-br p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones.card}`}>
                <div className="flex items-start justify-between gap-3"><span className={`flex size-11 items-center justify-center rounded-2xl ${tones.icon}`}><Icon className="size-5" /></span><ArrowUpRight className="size-4 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-600" /></div>
                <p className={`mt-4 text-3xl font-bold tracking-tight ${tones.value}`}>{metric.value}</p>
                <p className="mt-1 font-semibold text-slate-800">{metric.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{metric.note}</p>
              </button>;
            })}
          </section>

          <div className="mb-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-800">Vista comercial</p><h3 className="mt-1 text-xl font-bold">Pipeline de pedidos</h3><p className="mt-1 text-sm text-slate-500">Cada cartão mostra quantos pedidos tens em cada fase.</p></div><button type="button" onClick={() => goToView("pipeline")} className="inline-flex items-center gap-1 text-sm font-semibold text-orange-800 hover:underline">Abrir Kanban <ArrowUpRight className="size-4" /></button></div>
              {leads.length === 0 && <p className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">O pipeline está pronto. Os pedidos do formulário aparecerão aqui à medida que chegarem.</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{leadStatuses.map((status) => { const count = leads.filter((lead) => lead.status === status.id).length; const share = leads.length ? Math.round((count / leads.length) * 100) : 0; return <button key={status.id} type="button" onClick={() => goToView("pipeline")} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:border-orange-300 hover:bg-white hover:shadow-sm"><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><span className={`size-2.5 shrink-0 rounded-full ${pipelineStageColors[status.id]}`} /><span className="truncate text-xs font-semibold text-slate-600">{status.label}</span></span><span className="text-lg font-bold text-slate-900">{count}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-all ${pipelineStageColors[status.id]}`} style={{ width: `${leads.length ? Math.max(count ? 8 : 0, share) : 0}%` }} /></div><p className="mt-2 text-[11px] text-slate-400">{share}% dos pedidos</p></button>; })}</div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">Vista operacional</p><h3 className="mt-1 text-xl font-bold">Estado das viagens</h3><p className="mt-1 text-sm text-slate-500">Acompanha o percurso de cada viagem.</p></div><button type="button" onClick={() => goToView("trips")} className="inline-flex items-center gap-1 text-sm font-semibold text-orange-800 hover:underline">Ver viagens <ArrowUpRight className="size-4" /></button></div>
              <div className="space-y-3">{tripStageCounts.map((status) => { const share = trips.length ? Math.round((status.count / trips.length) * 100) : 0; const statusTone = status.id === "completed" ? "bg-emerald-500" : status.id === "cancelled" ? "bg-slate-400" : status.id === "travelling" ? "bg-blue-500" : status.id === "confirmed" ? "bg-orange-500" : "bg-amber-500"; return <button key={status.id} type="button" onClick={() => goToView("trips")} className="group w-full rounded-xl px-2 py-2 text-left transition hover:bg-slate-50"><span className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-medium text-slate-700"><span className={`size-2.5 rounded-full ${statusTone}`} />{status.label}</span><span className="text-sm font-bold text-slate-900">{status.count}<span className="ml-2 text-xs font-normal text-slate-400">{share}%</span></span></span><span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${statusTone}`} style={{ width: `${trips.length ? Math.max(status.count ? 5 : 0, (status.count / maxTripStageCount) * 100) : 0}%` }} /></span></button>; })}</div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900"><Plane className="size-4 shrink-0" /><span>{activeTrips.length} {activeTrips.length === 1 ? "viagem ativa" : "viagens ativas"} · {upcomingDepartures.length} partida(s) nos próximos 30 dias</span></div>
            </section>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-1">
              <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-800">Agenda</p><h3 className="mt-1 text-lg font-bold">Próximos 14 dias</h3></div><button type="button" onClick={() => goToView("calendar")} aria-label="Abrir calendário" className="rounded-xl bg-violet-50 p-2 text-violet-800 transition hover:bg-violet-100"><CalendarDays className="size-5" /></button></div>
              {dueItems.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Sem tarefas ou marcos próximos. A agenda aparecerá aqui quando definires prazos.</p> : <ol className="space-y-2.5">{dueItems.map((item, index) => { const days = daysUntilDate(item.date); return <li key={`${item.date}-${item.title}-${index}`} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><span className={`flex min-h-10 min-w-10 items-center justify-center rounded-xl px-2 text-xs font-bold ${days < 0 ? "bg-rose-100 text-rose-800" : days === 0 ? "bg-amber-100 text-amber-900" : "bg-orange-100 text-orange-900"}`}>{days < 0 ? "!" : days === 0 ? "Hoje" : `${days}d`}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.detail} · {dateLabel(item.date)}</p></div></li>; })}</ol>}
              <button type="button" onClick={() => goToView("calendar")} className="mt-4 w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-700 hover:text-orange-800">Abrir calendário</button>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-1">
              <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-800">Entrada de pedidos</p><h3 className="mt-1 text-lg font-bold">Mais recentes</h3></div><button type="button" onClick={() => goToView("pipeline")} aria-label="Abrir Kanban comercial" className="rounded-xl bg-sky-50 p-2 text-sky-800 transition hover:bg-sky-100"><ArrowUpRight className="size-5" /></button></div>
              {recentLeads.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Ainda não chegaram pedidos pelo formulário público.</p> : <ul className="divide-y divide-slate-100">{recentLeads.map((lead) => <li key={lead.id}><button type="button" onClick={() => { setSelected(lead); setSaved(false); }} className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-50"><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{lead.full_name}</span><span className="mt-1 block truncate text-xs text-slate-500">{lead.destination || "Destino por definir"} · {dateLabel(lead.created_at)}</span></span><span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-900">{leadStatuses.find((status) => status.id === lead.status)?.label}</span></button></li>)}</ul>}
              <button type="button" onClick={() => goToView("pipeline")} className="mt-4 w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-700 hover:text-orange-800">Ver todos os pedidos</button>
            </section>

            <section className={`rounded-3xl border p-5 shadow-sm sm:p-6 xl:col-span-1 ${expiryAlerts.length ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white" : "border-slate-200 bg-white"}`}>
              <div className="mb-4 flex items-center justify-between gap-3"><div><p className={`text-xs font-bold uppercase tracking-[0.16em] ${expiryAlerts.length ? "text-amber-800" : "text-emerald-800"}`}>Proteção dos viajantes</p><h3 className="mt-1 text-lg font-bold">Documentação</h3></div><span className={`flex size-10 items-center justify-center rounded-xl ${expiryAlerts.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{expiryAlerts.length ? <FileWarning className="size-5" /> : <ShieldCheck className="size-5" />}</span></div>
              {expiryAlerts.length === 0 ? <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4"><p className="font-semibold text-emerald-900">Tudo em dia</p><p className="mt-1 text-sm text-emerald-800">Sem documentos vencidos ou a vencer nos próximos 30 dias.</p></div> : <><p className="mb-3 text-sm text-amber-900">{expiryAlerts.length} {expiryAlerts.length === 1 ? "documento requer" : "documentos requerem"} atenção.</p><ul className="space-y-2">{expiryAlerts.slice(0, 5).map(({ document, client: documentClient, days }) => <li key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{documentClient?.full_name || "Cliente"}</span><span className="mt-0.5 block text-xs text-slate-500">{documentTypeLabels[document.document_type]} · {dateLabel(document.expires_on)}</span></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${days < 0 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"}`}>{days < 0 ? `Vencido ${Math.abs(days)}d` : days === 0 ? "Hoje" : `${days}d`}</span></li>)}</ul>{expiryAlerts.length > 5 && <p className="mt-3 text-xs text-slate-500">Mais {expiryAlerts.length - 5} documentos na secção Clientes.</p>}</>}
              <p className="mt-3 text-xs text-slate-500">Os números/IDs dos documentos não aparecem no dashboard.</p><button type="button" onClick={() => goToView("clients")} className="mt-3 w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-700 hover:text-orange-800">Ver clientes</button>
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">Operação de viagens</p><h3 className="mt-1 text-xl font-bold">Partidas nos próximos 30 dias</h3><p className="mt-1 text-sm text-slate-500">Viagens ativas com uma data de partida próxima.</p></div><button type="button" onClick={() => goToView("trips")} className="inline-flex items-center gap-1 text-sm font-semibold text-orange-800 hover:underline">Gerir viagens <ArrowUpRight className="size-4" /></button></div>{upcomingDepartures.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Não há partidas marcadas para os próximos 30 dias.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{upcomingDepartures.map((trip) => <article key={trip.id} className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-4"><p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-800"><Plane className="size-4" />{dateLabel(trip.departure_date!)}</p><h4 className="mt-2 font-bold text-slate-900">{trip.destination || "Destino por definir"}</h4><p className="mt-1 text-sm text-slate-600">{tripClientName(trip, clients, leads)}</p><span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 ring-1 ring-blue-100">{tripStatuses.find((status) => status.id === trip.status)?.label}</span></article>)}</div>}</section>
        </>}

        {!loading && view === "pipeline" && <>
          {expiryAlerts.length > 0 && <section aria-labelledby="expiry-alerts-title" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Atenção à documentação</p><h2 id="expiry-alerts-title" className="mt-1 text-lg font-semibold text-amber-950">{expiryAlerts.length} {expiryAlerts.length === 1 ? "documento vencido ou a vencer" : "documentos vencidos ou a vencer"}</h2><p className="mt-1 text-sm text-amber-900">Inclui documentos já vencidos e os que expiram nos próximos 30 dias.</p></div><button type="button" onClick={() => goToView("clients")} className="rounded-full border border-amber-800 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">Ver clientes</button></div><ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{expiryAlerts.slice(0, 9).map(({ document, client: documentClient, days }) => <li key={document.id} className="rounded-xl border border-amber-200 bg-white/80 px-4 py-3"><p className="font-semibold text-slate-900">{documentClient?.full_name || "Cliente"} · {documentTypeLabels[document.document_type]}</p><p className={`mt-1 text-sm ${days < 0 ? "text-red-700" : "text-amber-800"}`}>{days < 0 ? `Vencido há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}` : days === 0 ? "Vence hoje" : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`} · {dateLabel(document.expires_on)}</p></li>)}</ul>{expiryAlerts.length > 9 && <p className="mt-3 text-sm text-amber-900">E mais {expiryAlerts.length - 9} documentos. Consulta a secção Clientes.</p>}</section>}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Kanban comercial</h2><p className="text-sm text-slate-500">Arrasta os pedidos entre fases ou muda a fase no cartão. Seleciona um cartão para ver os detalhes.</p></div><div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-500">{leads.length} {leads.length === 1 ? "pedido" : "pedidos"}</span><label className="w-full max-w-sm"><span className="sr-only">Pesquisar pedidos</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome, email ou destino" className={inputClass} /></label></div></div>
          {leads.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Ainda não há pedidos guardados. Quando alguém preencher o formulário público, o pedido aparecerá aqui.</p>}
          <div aria-label="Quadro Kanban de pedidos" className="grid auto-cols-[minmax(270px,310px)] grid-flow-col grid-rows-1 gap-4 overflow-x-auto pb-4">{leadStatuses.map((status) => {
            const columnLeads = visibleLeads.filter((lead) => lead.status === status.id);
            return <section key={status.id} aria-label={status.label} onDragOver={(event) => { event.preventDefault(); setDropTargetStatus(status.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTargetStatus((current) => current === status.id ? null : current); }} onDrop={(event) => { event.preventDefault(); const leadId = event.dataTransfer.getData("text/plain") || draggingLeadId; if (leadId) void moveLead(leadId, status.id); setDropTargetStatus(null); }} className={`min-h-[440px] rounded-2xl border p-3 transition-colors ${dropTargetStatus === status.id ? "border-orange-700 bg-orange-50 ring-2 ring-orange-700/20" : "border-slate-200 bg-slate-100/70"}`}><div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{status.label}</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">{columnLeads.length}</span></div><div className="space-y-3">{columnLeads.map((lead) => <article key={lead.id} draggable={movingLeadId !== lead.id} onDragStart={(event) => { setDraggingLeadId(lead.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", lead.id); }} onDragEnd={() => { setDraggingLeadId(null); setDropTargetStatus(null); }} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-700 hover:shadow ${draggingLeadId === lead.id ? "opacity-50" : ""} ${movingLeadId === lead.id ? "opacity-60" : "cursor-grab active:cursor-grabbing"}`}><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => { setSelected(lead); setSaved(false); }} className="min-w-0 text-left"><span className="block truncate font-semibold text-slate-900">{lead.full_name}</span><span className="mt-1 block truncate text-sm text-slate-600">{lead.destination || "Destino por definir"}</span></button><span aria-hidden="true" className="text-slate-300">⠿</span></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{lead.adults} {lead.adults === 1 ? "adulto" : "adultos"}{lead.children_ages.length ? ` · ${lead.children_ages.length} criança(s)` : ""}</span>{lead.date_flexible && <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Datas flexíveis</span>}{lead.budget && <span>{budgetLabels[lead.budget] || lead.budget}</span>}</div><p className="mt-3 text-xs text-slate-400">{dateLabel(lead.created_at)}</p><label className="mt-3 block text-xs font-medium text-slate-500">Mover para<select value={lead.status} disabled={movingLeadId === lead.id} onChange={(event) => void moveLead(lead.id, event.target.value as LeadStatus)} aria-label={`Mover ${lead.full_name} para outra fase`} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-orange-700 focus:outline-none">{leadStatuses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></article>)}{columnLeads.length === 0 && <div className={`rounded-xl border border-dashed p-4 text-center text-xs ${dropTargetStatus === status.id ? "border-orange-500 bg-white text-orange-800" : "border-slate-300 text-slate-400"}`}>{dropTargetStatus === status.id ? "Larga aqui para mover" : "Sem pedidos nesta fase"}</div>}</div></section>;
          })}</div>
        </>}

        {!loading && view === "clients" && <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Clientes</h2><p className="text-sm text-slate-500">Regista clientes manualmente e associa-lhes várias viagens.</p></div><div className="flex w-full flex-wrap gap-3 sm:w-auto"><label className="min-w-52 flex-1 sm:flex-none"><span className="sr-only">Pesquisar clientes</span><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Pesquisar cliente" className={inputClass} /></label><button type="button" onClick={() => setShowClientForm((open) => !open)} className="rounded-full bg-orange-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-900">{showClientForm ? "Fechar formulário" : "Adicionar cliente"}</button></div></div>
          {showClientForm && <form onSubmit={createClient} className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold">Nome completo *<input name="full_name" required minLength={2} maxLength={160} autoComplete="name" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Email<input name="email" type="email" maxLength={254} autoComplete="email" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Telefone<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Idioma<select name="language" defaultValue="pt" className={inputClass}><option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option></select></label>
            <label className="space-y-1 text-sm font-semibold sm:col-span-2">Notas internas<textarea name="internal_notes" rows={3} maxLength={4000} className={inputClass} placeholder="Preferências ou notas úteis sobre o cliente" /></label>
            <div className="sm:col-span-2 flex justify-end"><button disabled={saving} className="rounded-full bg-orange-800 px-6 py-3 font-semibold text-white hover:bg-orange-900 disabled:opacity-60">{saving ? "A guardar…" : "Guardar cliente"}</button></div>
          </form>}
          {visibleClients.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">{clients.length ? "Não encontrei clientes com essa pesquisa." : "Ainda não há clientes. Usa “Adicionar cliente” para registar o primeiro."}</p>}
          {visibleClients.length > 0 && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleClients.map((client) => {
            const clientTrips = trips.filter((trip) => trip.client_id === client.id || trip.client_ids.includes(client.id));
            const clientLeads = leads.filter((lead) => lead.client_id === client.id);
            return <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="text-lg font-semibold">{client.full_name}</h3><p className="mt-2 break-all text-sm text-slate-600">{client.email || "Sem email"}</p><p className="text-sm text-slate-600">{client.phone || "Sem telefone"}</p><p className="mt-2 text-xs text-slate-400">Idioma: {client.language.toUpperCase()} · Cliente desde {dateLabel(client.created_at)}</p></div>
                {editingClientId !== client.id && <div className="flex shrink-0 gap-2"><button type="button" onClick={() => setEditingClientId(client.id)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Editar</button><button type="button" disabled={saving} onClick={() => void deleteClient(client)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Apagar</button></div>}
              </div>
              {editingClientId === client.id && <form onSubmit={(event) => void saveClient(event, client)} className="mt-4 grid gap-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold">Nome completo *<input name="full_name" required minLength={2} maxLength={160} defaultValue={client.full_name} className={inputClass} /></label>
                <label className="space-y-1 text-xs font-semibold">Email<input name="email" type="email" maxLength={254} defaultValue={client.email || ""} className={inputClass} /></label>
                <label className="space-y-1 text-xs font-semibold">Telefone<input name="phone" type="tel" maxLength={40} defaultValue={client.phone || ""} className={inputClass} /></label>
                <label className="space-y-1 text-xs font-semibold">Idioma<select name="language" defaultValue={client.language} className={inputClass}><option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option></select></label>
                <label className="space-y-1 text-xs font-semibold sm:col-span-2">Notas internas<textarea name="internal_notes" rows={3} maxLength={4000} defaultValue={client.internal_notes || ""} className={inputClass} /></label>
                <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setEditingClientId(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button><button disabled={saving} className="rounded-full bg-orange-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? "A guardar…" : "Guardar alterações"}</button></div>
              </form>}
              {!editingClientId || editingClientId !== client.id ? <>{client.internal_notes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{client.internal_notes}</p>}
                <section className="mt-4 rounded-xl bg-slate-50 p-3"><h4 className="text-sm font-semibold">Relação com o cliente</h4><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200">{clientTrips.length} {clientTrips.length === 1 ? "viagem" : "viagens"}</span><span className="rounded-full bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200">{clientLeads.length} {clientLeads.length === 1 ? "pedido comercial" : "pedidos comerciais"}</span></div>
                  {(clientTrips.length > 0 || clientLeads.length > 0) && <ul className="mt-3 space-y-2">{clientTrips.slice(0, 3).map((trip) => <li key={trip.id} className="flex items-start justify-between gap-2 text-xs"><span className="font-medium text-slate-800">{trip.destination || "Destino por definir"}{trip.reference ? ` · ${trip.reference}` : ""}</span><span className="shrink-0 text-slate-500">{tripStatuses.find((status) => status.id === trip.status)?.label}</span></li>)}{clientLeads.slice(0, 2).map((lead) => <li key={lead.id} className="flex items-start justify-between gap-2 text-xs"><span className="font-medium text-slate-800">Pedido · {lead.destination || "Destino por definir"}</span><span className="shrink-0 text-slate-500">{leadStatuses.find((status) => status.id === lead.status)?.label}</span></li>)}</ul>}</section>
              </> : null}
              <section className="mt-5 border-t border-slate-200 pt-4"><h4 className="text-sm font-semibold">Documentação</h4><div className="mt-3 space-y-3">{documents.filter((document) => document.client_id === client.id).map((document) => <form key={document.id} onSubmit={(event) => saveClientDocument(event, client.id, document)} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><label className="space-y-1 text-xs font-semibold text-slate-600">Tipo<select name="document_type" defaultValue={document.document_type} className={inputClass}>{Object.entries(documentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1 text-xs font-semibold text-slate-600">Número/ID<input name="document_number" required maxLength={80} defaultValue={document.document_number} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Validade<input name="expires_on" type="date" required defaultValue={document.expires_on} className={inputClass} /></label><div className="flex items-end"><button disabled={saving} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">Guardar</button><button type="button" disabled={saving} onClick={() => void deleteClientDocument(document)} className="ml-2 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60">Apagar</button></div></form>)}</div><form onSubmit={(event) => saveClientDocument(event, client.id)} className="mt-3 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><label className="space-y-1 text-xs font-semibold text-slate-600">Novo tipo<select name="document_type" defaultValue="passport" className={inputClass}>{Object.entries(documentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1 text-xs font-semibold text-slate-600">Número/ID<input name="document_number" required maxLength={80} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Data de validade<input name="expires_on" type="date" required className={inputClass} /></label><div className="flex items-end"><button disabled={saving} className="rounded-full bg-orange-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Adicionar</button></div></form><p className="mt-2 text-xs text-slate-500">O número/ID é visível apenas nesta área CRM protegida.</p></section><CrmDriveDocuments authorizedFetch={authorizedFetch} clientId={client.id} title={client.full_name} />
              <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setTripClientIds([client.id]); setShowTripForm(true); goToView("trips"); }} className="rounded-full border border-orange-800 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50">Adicionar viagem</button>{clientLeads.length > 0 && <button type="button" onClick={() => goToView("pipeline")} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ver pedidos</button>}</div>
            </article>;
          })}</div>}
        </>}

        {!loading && view === "trips" && <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Viagens</h2><p className="text-sm text-slate-500">Cria uma viagem manualmente ou pré-preenche-a a partir de um PDF.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setShowPdfImport(false); setPdfPreview(null); setTripClientIds([]); setShowTripForm((open) => !open); }} className="rounded-full border border-orange-800 px-5 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-50">{showTripForm ? "Fechar formulário" : "Adicionar manualmente"}</button><button type="button" onClick={() => { setShowTripForm(false); setShowPdfImport((open) => !open); setPdfPreview(null); }} className="rounded-full bg-orange-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-900">{showPdfImport ? "Fechar importação" : "Ler PDF e criar viagem"}</button></div></div>
          {showPdfImport && <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/50 p-5 shadow-sm"><div className="mb-4"><h3 className="font-semibold">Pré-preencher a viagem pelo PDF</h3><p className="mt-1 text-sm text-slate-600">O PDF é processado no servidor e descartado após a leitura. Confirma os campos antes de guardar; o texto integral não é retido.</p></div><form onSubmit={previewTripPdf} className="flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 space-y-1 text-sm font-semibold">Orçamento ou documento de reserva (PDF, até 4 MB)<input name="pdf_file" type="file" accept="application/pdf,.pdf" required className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold`} /></label><button disabled={pdfLoading} className="rounded-full bg-orange-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pdfLoading ? "A ler PDF…" : "Extrair campos"}</button></form>{pdfPreview && <form onSubmit={createManualTrip} className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><div className="sm:col-span-2"><p className="font-semibold text-orange-900">Campos sugeridos extraídos</p><p className="mt-1 text-sm text-slate-600">Revê e corrige tudo. Só depois de carregares em “Confirmar e criar viagem” será criado o registo e a checklist.</p></div><ClientMultiSelect key={tripClientIds.join(",")} clients={clients} selectedIds={tripClientIds} /><label className="space-y-1 text-sm font-semibold">Operador<input name="operator" maxLength={160} defaultValue={pdfPreview.operator} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Referência<input name="reference" maxLength={80} defaultValue={pdfPreview.reference} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Destino<input name="destination" maxLength={240} defaultValue={pdfPreview.destination} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Estado da viagem<select name="status" defaultValue="planning" className={inputClass}>{tripStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label><label className="space-y-1 text-sm font-semibold">Partida<input name="departure_date" type="date" defaultValue={pdfPreview.departure_date} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Regresso<input name="return_date" type="date" defaultValue={pdfPreview.return_date} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Adultos<input name="adults" type="number" min={1} max={20} defaultValue={pdfPreview.adults} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Crianças<input name="children_count" type="number" min={0} max={30} defaultValue={pdfPreview.children_count} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Valor total<input name="total_amount" type="number" min={0} max={9999999999.99} step="0.01" defaultValue={pdfPreview.total_amount} className={inputClass} /></label><label className="space-y-1 text-sm font-semibold">Moeda<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" title="Código de moeda de 3 letras, por exemplo EUR" defaultValue={pdfPreview.currency || "EUR"} className={inputClass} /></label><div className="sm:col-span-2 rounded-xl border border-slate-200 p-4"><input type="hidden" name="service_count" value={pdfPreview.services.length} /><p className="font-semibold">Voos e hotéis sugeridos ({pdfPreview.services.length})</p>{pdfPreview.services.length === 0 ? <p className="mt-1 text-sm text-slate-600">Não detetei segmentos de voo ou alojamento neste PDF. Podes criá-los na ficha da viagem depois de confirmar.</p> : <div className="mt-3 space-y-3">{pdfPreview.services.map((service, index) => <div key={`${service.service_type}-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><input type="hidden" name={`service_${index}_type`} value={service.service_type} /><label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">{service.service_type === "flight" ? "Voo" : "Hotel/alojamento"}<input name={`service_${index}_title`} required maxLength={240} defaultValue={service.title} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Companhia/fornecedor<input name={`service_${index}_provider`} maxLength={160} defaultValue={service.provider} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">N.º do voo ou referência<input name={`service_${index}_reference`} maxLength={100} defaultValue={service.reference} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Início/check-in<input name={`service_${index}_starts_on`} type="date" defaultValue={service.starts_on} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Fim/check-out<input name={`service_${index}_ends_on`} type="date" defaultValue={service.ends_on} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Detalhes extraídos<textarea name={`service_${index}_details`} rows={2} maxLength={1000} defaultValue={service.details} className={inputClass} /></label></div>)}</div>}</div><label className="space-y-1 text-sm font-semibold sm:col-span-2">Notas da viagem<textarea name="trip_notes" rows={3} maxLength={4000} defaultValue={pdfPreview.trip_notes} className={inputClass} placeholder="Outros dados úteis extraídos" /></label><div className="sm:col-span-2 flex justify-end"><button disabled={saving || clients.length === 0} className="rounded-full bg-orange-800 px-6 py-3 font-semibold text-white disabled:opacity-60">{saving ? "A guardar…" : "Confirmar e criar viagem"}</button></div></form>}</section>}
          {showTripForm && <form onSubmit={createManualTrip} className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            <ClientMultiSelect key={tripClientIds.join(",")} clients={clients} selectedIds={tripClientIds} />
            <label className="space-y-1 text-sm font-semibold">Operador<input name="operator" maxLength={160} className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Referência<input name="reference" maxLength={80} className={inputClass} placeholder="Opcional" /></label>
            <label className="space-y-1 text-sm font-semibold">Destino<input name="destination" maxLength={240} className={inputClass} placeholder="Destino ou por definir" /></label>
            <label className="space-y-1 text-sm font-semibold">Partida<input name="departure_date" type="date" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Regresso<input name="return_date" type="date" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Estado<select name="status" defaultValue="planning" className={inputClass}>{tripStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
            <label className="space-y-1 text-sm font-semibold">Adultos<input name="adults" type="number" min={1} max={20} className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Crianças<input name="children_count" type="number" min={0} max={30} className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Valor total<input name="total_amount" type="number" min={0} max={9999999999.99} step="0.01" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold">Moeda<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" title="Código de moeda de 3 letras, por exemplo EUR" defaultValue="EUR" className={inputClass} /></label>
            <label className="space-y-1 text-sm font-semibold sm:col-span-2">Notas da viagem<textarea name="trip_notes" rows={3} maxLength={4000} className={inputClass} /></label>
            <div className="sm:col-span-2 flex justify-end"><button disabled={saving} className="rounded-full bg-orange-800 px-6 py-3 font-semibold text-white hover:bg-orange-900 disabled:opacity-60">{saving ? "A guardar…" : "Criar viagem e checklist"}</button></div>
          </form>}
          {clients.length === 0 && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Cria primeiro um cliente na secção Clientes para poderes associar-lhe uma viagem.</p>}
          {trips.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Ainda não há viagens. Podes converter um pedido ganho ou adicionar uma viagem a um cliente.</p>}
          <div className="grid gap-5 xl:grid-cols-2">{trips.map((trip) => <article key={trip.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-orange-800">{tripClientName(trip, clients, leads)}{trip.reference ? ` · ${trip.reference}` : ""}</p><h3 className="mt-1 text-xl font-bold">{trip.destination || "Destino por definir"}</h3></div><button type="button" disabled={saving} onClick={() => void deleteTrip(trip)} className="shrink-0 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Apagar viagem</button></div>
            <form key={`${trip.id}-${trip.status}-${trip.departure_date}-${trip.destination}-${trip.operator}-${trip.adults}-${trip.children_count}-${trip.total_amount}-${trip.client_ids?.join(",")}`} onSubmit={(event) => saveTrip(event, trip)} className="mb-6 grid gap-3 sm:grid-cols-2">
              <ClientMultiSelect clients={clients} selectedIds={trip.client_ids?.length ? trip.client_ids : trip.client_id ? [trip.client_id] : []} />
              <label className="space-y-1 text-xs font-semibold text-slate-600">Estado<select name="status" defaultValue={trip.status} className={inputClass}>{tripStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Operador<input name="operator" defaultValue={trip.operator || ""} maxLength={160} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Destino<input name="destination" defaultValue={trip.destination || ""} maxLength={240} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Partida<input name="departure_date" type="date" defaultValue={trip.departure_date || ""} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Regresso<input name="return_date" type="date" defaultValue={trip.return_date || ""} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Adultos<input name="adults" type="number" min={1} max={20} defaultValue={trip.adults ?? ""} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Crianças<input name="children_count" type="number" min={0} max={30} defaultValue={trip.children_count ?? ""} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Valor total<input name="total_amount" type="number" min={0} max={9999999999.99} step="0.01" defaultValue={trip.total_amount ?? ""} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">Moeda<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" title="Código de moeda de 3 letras, por exemplo EUR" defaultValue={trip.currency || "EUR"} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Notas da viagem<textarea name="trip_notes" rows={3} defaultValue={trip.trip_notes || ""} maxLength={4000} className={inputClass} /></label>
              <div className="sm:col-span-2"><button disabled={saving} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Guardar viagem</button></div>
            </form>
            <CrmDriveDocuments authorizedFetch={authorizedFetch} tripId={trip.id} title={trip.reference || trip.destination || "Viagem"} initialFile={pdfToArchive?.tripId === trip.id ? pdfToArchive.file : null} onUploaded={() => setPdfToArchive(null)} />
            <h4 className="mt-5 border-t border-slate-200 pt-5 text-sm font-semibold">Serviços e reservas</h4>
            {trip.services.length > 0 && <div className="mt-3 space-y-3">{trip.services.map((service) => <form key={service.id} onSubmit={(event) => saveTripService(event, trip, service)} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold text-slate-600">Tipo<select name="service_type" defaultValue={service.service_type} className={inputClass}>{Object.entries(tripServiceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1 text-xs font-semibold text-slate-600">Serviço<input name="title" required maxLength={240} defaultValue={service.title} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Fornecedor<input name="provider" maxLength={160} defaultValue={service.provider || ""} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Referência<input name="reference" maxLength={100} defaultValue={service.reference || ""} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Início<input name="starts_on" type="date" defaultValue={service.starts_on || ""} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Fim<input name="ends_on" type="date" defaultValue={service.ends_on || ""} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Detalhes<textarea name="details" rows={2} maxLength={4000} defaultValue={service.details || ""} className={inputClass} /></label><div className="sm:col-span-2 flex gap-2"><button disabled={saving} className="rounded-full bg-orange-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar serviço</button><button type="button" disabled={saving} onClick={() => void deleteTripService(trip, service)} className="rounded-full border border-slate-300 px-4 py-2 text-xs text-slate-600">Remover</button></div></form>)}</div>}
            <form onSubmit={(event) => saveTripService(event, trip)} className="mt-3 grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold text-slate-600">Tipo<select name="service_type" defaultValue="flight" className={inputClass}>{Object.entries(tripServiceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1 text-xs font-semibold text-slate-600">Serviço *<input name="title" required maxLength={240} className={inputClass} placeholder="Ex.: voo de ida" /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Fornecedor<input name="provider" maxLength={160} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Referência<input name="reference" maxLength={100} className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Início<input name="starts_on" type="date" className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600">Fim<input name="ends_on" type="date" className={inputClass} /></label><label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Detalhes<textarea name="details" rows={2} maxLength={4000} className={inputClass} /></label><div className="sm:col-span-2"><button disabled={saving} className="rounded-full border border-orange-800 px-4 py-2 text-xs font-semibold text-orange-800 disabled:opacity-60">Adicionar serviço</button></div></form>
            <h4 className="border-t border-slate-200 pt-5 text-sm font-semibold">Checklist <span className="font-normal text-slate-500">({trip.tasks.filter((task) => task.completed).length}/{trip.tasks.length})</span></h4><p className="mt-1 text-xs text-slate-500">O CRM cria uma tarefa dois dias antes de cada voo com data definida. Recebes também um lembrete diário por email quando há check-ins por concluir, sem repetir o mesmo aviso.</p>
            <div className="mt-3 space-y-3">{trip.tasks.map((task) => <form key={task.id} onSubmit={(event) => saveTask(event, trip, task)} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl bg-slate-50 p-3">
              <input type="checkbox" name="completed" defaultChecked={task.completed} aria-label={`Concluída: ${task.title}`} className="size-4 accent-orange-800" />
              <div className="space-y-2"><label className="sr-only" htmlFor={`task-title-${task.id}`}>Tarefa</label><input id={`task-title-${task.id}`} name="title" defaultValue={task.title} maxLength={240} readOnly={Boolean(task.source_service_id)} className={`${inputClass} ${task.completed ? "text-slate-400 line-through" : ""}`} /><label className="sr-only" htmlFor={`task-date-${task.id}`}>Prazo</label><input id={`task-date-${task.id}`} name="due_date" type="date" defaultValue={task.due_at ? localDateInput(task.due_at) : ""} readOnly={Boolean(task.source_service_id)} className={inputClass} /></div>
              <div className="flex flex-col gap-2"><button disabled={saving} className="rounded-lg bg-orange-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>{!task.source_service_id && <button type="button" disabled={saving} onClick={() => void deleteTask(trip, task)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">Remover</button>}</div>
            </form>)}</div>
            <form onSubmit={(event) => addTask(event, trip)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]"><label className="sr-only" htmlFor={`new-task-${trip.id}`}>Nova tarefa</label><input id={`new-task-${trip.id}`} name="title" required maxLength={240} placeholder="Adicionar tarefa à checklist" className={inputClass} /><label className="sr-only" htmlFor={`new-task-date-${trip.id}`}>Prazo da nova tarefa</label><input id={`new-task-date-${trip.id}`} name="due_date" type="date" className={inputClass} /><button disabled={saving} className="rounded-full bg-orange-800 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-900 disabled:opacity-60">Adicionar</button></form>
          </article>)}</div>
        </>}

        {!loading && view === "calendar" && <>
          <div className="mb-6"><h2 className="text-lg font-semibold">Calendário de viagens</h2><p className="text-sm text-slate-500">Partidas, regressos e prazos das tarefas registados nas viagens.</p></div>
          {events.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Ainda não há datas para mostrar. Adiciona datas de viagem ou prazos às tarefas.</p>}
          <ol className="space-y-3">{events.map((event, index) => <li key={`${event.date}-${event.title}-${index}`} className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-white p-4 ${event.done ? "border-slate-200 opacity-60" : "border-slate-200"}`}><time dateTime={event.date} className="min-w-32 text-sm font-semibold text-orange-800">{dateLabel(event.date)}</time><div><p className={`font-medium ${event.done ? "line-through" : ""}`}>{event.title}</p><p className="text-sm text-slate-500">{event.detail}</p></div></li>)}</ol>
        </>}
      </section>

      {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-labelledby="lead-title" className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Pedido de viagem</p><h2 id="lead-title" className="mt-1 text-2xl font-bold">{selected.full_name}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-full border border-slate-300 px-3 py-1 text-sm" aria-label="Fechar detalhes">Fechar</button></div>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div className="col-span-2"><dt className="text-slate-500">Email</dt><dd><a className="font-medium text-orange-800 underline" href={`mailto:${selected.email}`}>{selected.email}</a></dd></div>{selected.phone && <div><dt className="text-slate-500">Telefone</dt><dd><a className="font-medium" href={`tel:${selected.phone}`}>{selected.phone}</a></dd></div>}<div><dt className="text-slate-500">Idioma</dt><dd className="font-medium">{selected.language.toUpperCase()}</dd></div>{selected.destination && <div className="col-span-2"><dt className="text-slate-500">Destino</dt><dd className="font-medium">{selected.destination}</dd></div>}<div><dt className="text-slate-500">Partida</dt><dd className="font-medium">{selected.departure_date || "Por definir"}</dd></div><div><dt className="text-slate-500">Regresso</dt><dd className="font-medium">{selected.return_date || "Por definir"}</dd></div><div><dt className="text-slate-500">Flexibilidade nas datas</dt><dd className="font-medium">{selected.date_flexible ? "Sim" : "Não"}</dd></div><div><dt className="text-slate-500">Viajantes</dt><dd className="font-medium">{selected.adults} adultos · {selected.children_ages.length} crianças{selected.children_ages.length ? ` (${selected.children_ages.join(", ")} anos)` : ""}</dd></div><div><dt className="text-slate-500">Orçamento / pessoa</dt><dd className="font-medium">{selected.budget ? budgetLabels[selected.budget] || selected.budget : "—"}</dd></div>{selected.travel_style && <div className="col-span-2"><dt className="text-slate-500">Estilo de viagem</dt><dd className="font-medium">{selected.travel_style}</dd></div>}{selected.notes && <div className="col-span-2"><dt className="text-slate-500">Mais detalhes</dt><dd className="whitespace-pre-wrap font-medium">{selected.notes}</dd></div>}</dl>
        <div className="mt-6 rounded-xl border border-orange-100 bg-orange-50 p-4"><p className="text-sm text-slate-700">Podes criar o cliente com os dados deste pedido; nome, email, telefone e idioma são copiados automaticamente.</p><button type="button" disabled={saving || Boolean(selected.client_id)} onClick={() => void createClientFromLead(selected)} className="mt-3 rounded-full border border-orange-800 px-5 py-2.5 text-sm font-semibold text-orange-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "A guardar…" : selected.client_id ? "Cliente já associado" : "Criar cliente a partir do pedido"}</button></div>
        <form key={selected.id} onSubmit={saveLead} className="mt-8 space-y-5 border-t border-slate-200 pt-6"><label className="block space-y-2 text-sm font-semibold">Fase comercial<select name="status" defaultValue={selected.status} className={inputClass}>{leadStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label><label className="block space-y-2 text-sm font-semibold">Próximo contacto<input name="follow_up_date" type="date" defaultValue={selected.follow_up_date || ""} className={inputClass} /><span className="text-xs font-normal text-slate-500">Aparece no Dashboard e no calendário.</span></label>{selected.status === "lost" && <label className="block space-y-2 text-sm font-semibold">Motivo de perda<textarea name="lost_reason" defaultValue={selected.lost_reason || ""} rows={2} maxLength={500} className={inputClass} /></label>}<label className="block space-y-2 text-sm font-semibold">Notas internas<textarea name="internal_notes" defaultValue={selected.internal_notes || ""} rows={5} maxLength={4000} className={inputClass} placeholder="Acompanhamento e próximos passos" /></label>{saved && <p role="status" className="text-sm text-orange-800">Alterações guardadas.</p>}<div className="flex flex-wrap gap-3"><button disabled={saving} className="rounded-full bg-orange-800 px-6 py-3 font-semibold text-white hover:bg-orange-900 disabled:opacity-60">{saving ? "A guardar…" : "Guardar alterações"}</button>{selected.status === "won" && !trips.some((trip) => trip.lead_id === selected.id) && <button type="button" disabled={saving} onClick={() => void convertLead(selected)} className="rounded-full border border-orange-800 px-5 py-3 font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-60">Criar viagem e checklist</button>}</div></form>
      </aside></div>}
    </main>
  );
}

function leadName(leadId: string | null, leads: Lead[]) {
  return leadId ? leads.find((lead) => lead.id === leadId)?.full_name || "Cliente" : "Cliente";
}

function tripClientName(trip: Trip, clients: Client[], leads: Lead[]) {
  const ids = trip.client_ids?.length ? trip.client_ids : trip.client_id ? [trip.client_id] : [];
  const names = ids.map((id) => clients.find((client) => client.id === id)?.full_name).filter(Boolean);
  return names.length ? names.join(", ") : trip.lead_id ? leadName(trip.lead_id, leads) : "Cliente removido";
}
