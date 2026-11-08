import { NextRequest, NextResponse } from "next/server";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { isAuthorizedStudioUser, supabaseAdminConfig } from "@/lib/crm-api";
import { travelTypes } from "@/lib/crm-office-api";
import { extractTripFieldsFromPdfText } from "@/lib/crm-trip-pdf";

export const runtime = "nodejs";
const execFile = promisify(execFileCallback);

export async function GET(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  try {
    const [tripsResponse, tasksResponse, servicesResponse, tripClientsResponse] = await Promise.all([
      fetch(`${config.url}/rest/v1/crm_trips?select=*&order=departure_date.asc.nullslast`, { headers: config.headers, cache: "no-store" }),
      fetch(`${config.url}/rest/v1/crm_trip_tasks?select=*&order=sort_order.asc,created_at.asc`, { headers: config.headers, cache: "no-store" }),
      fetch(`${config.url}/rest/v1/crm_trip_services?select=*&order=sort_order.asc,created_at.asc`, { headers: config.headers, cache: "no-store" }),
      fetch(`${config.url}/rest/v1/crm_trip_clients?select=trip_id,client_id`, { headers: config.headers, cache: "no-store" }),
    ]);
    if (!tripsResponse.ok || !tasksResponse.ok || !servicesResponse.ok || !tripClientsResponse.ok) {
      console.error("CRM trips query failed", tripsResponse.status, tasksResponse.status, servicesResponse.status, tripClientsResponse.status);
      return NextResponse.json({ error: "Não foi possível carregar as viagens." }, { status: 502 });
    }
    const [trips, tasks, services, tripClients] = await Promise.all([tripsResponse.json(), tasksResponse.json(), servicesResponse.json(), tripClientsResponse.json()]);
    const tasksByTrip = new Map<string, unknown[]>();
    for (const task of tasks as { trip_id: string }[]) {
      const existing = tasksByTrip.get(task.trip_id) || [];
      existing.push(task);
      tasksByTrip.set(task.trip_id, existing);
    }
    const servicesByTrip = new Map<string, unknown[]>();
    for (const service of services as { trip_id: string }[]) {
      const existing = servicesByTrip.get(service.trip_id) || [];
      existing.push(service);
      servicesByTrip.set(service.trip_id, existing);
    }
    const clientsByTrip = new Map<string, string[]>();
    for (const relation of tripClients as { trip_id: string; client_id: string }[]) clientsByTrip.set(relation.trip_id, [...(clientsByTrip.get(relation.trip_id) || []), relation.client_id]);
    const tripsWithTasks = (trips as { id: string; client_id: string }[]).map((trip) => ({ ...trip, client_ids: clientsByTrip.get(trip.id) || (trip.client_id ? [trip.client_id] : []), tasks: tasksByTrip.get(trip.id) || [], services: servicesByTrip.get(trip.id) || [] }));
    return NextResponse.json({ trips: tripsWithTasks }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedStudioUser(request)) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) return previewTripPdf(request);
  const config = supabaseAdminConfig();
  if (!config) return NextResponse.json({ error: "A ligação segura à base de dados não está configurada." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const leadId = body.lead_id;
  if (leadId !== undefined) {
    if (!isUuid(leadId)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    return convertWonLead(config, leadId);
  }

  const clientIds = Array.isArray(body.client_ids) ? body.client_ids : body.client_id ? [body.client_id] : [];
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const departureDate = body.departure_date === "" ? null : body.departure_date;
  const returnDate = body.return_date === "" ? null : body.return_date;
  const status = typeof body.status === "string" ? body.status : "planning";
  const operator = typeof body.operator === "string" ? body.operator.trim() : "";
  const adults = body.adults === "" || body.adults === null || body.adults === undefined ? null : Number(body.adults);
  const childrenCount = body.children_count === "" || body.children_count === null || body.children_count === undefined ? null : Number(body.children_count);
  const totalAmount = body.total_amount === "" || body.total_amount === null || body.total_amount === undefined ? null : Number(body.total_amount);
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "EUR";
  const tripNotes = typeof body.trip_notes === "string" ? body.trip_notes.trim() : "";
  const travelType = typeof body.travel_type === "string" ? body.travel_type : "general";
  const statuses = ["planning", "confirmed", "travelling", "completed", "cancelled"];
  const serviceTypes = ["flight", "accommodation", "activity", "transfer", "insurance", "other"];
  const validDate = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
  const rawServices = body.services === undefined ? [] : body.services;
  if (!Array.isArray(rawServices) || rawServices.length > 40) return NextResponse.json({ error: "A lista de voos e hotéis é inválida." }, { status: 400 });
  const services = rawServices.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const service = value as Record<string, unknown>;
    const title = typeof service.title === "string" ? service.title.trim() : "";
    const provider = typeof service.provider === "string" ? service.provider.trim() : "";
    const reference = typeof service.reference === "string" ? service.reference.trim() : "";
    const details = typeof service.details === "string" ? service.details.trim() : "";
    const startsOn = service.starts_on === "" || service.starts_on === undefined ? null : service.starts_on;
    const endsOn = service.ends_on === "" || service.ends_on === undefined ? null : service.ends_on;
    if (typeof service.service_type !== "string" || !serviceTypes.includes(service.service_type) || title.length < 1 || title.length > 240 || provider.length > 160 || reference.length > 100 || details.length > 1000 || !validDate(startsOn) || !validDate(endsOn) || typeof startsOn === "string" && typeof endsOn === "string" && endsOn < startsOn) return null;
    return { service_type: service.service_type, title, provider: provider || null, reference: reference || null, starts_on: startsOn, ends_on: endsOn, details: details || null };
  });
  if (services.some((service) => service === null)) return NextResponse.json({ error: "Revê os dados dos voos e alojamentos extraídos." }, { status: 400 });
  if (!travelTypes.includes(travelType as (typeof travelTypes)[number]) || clientIds.length < 1 || clientIds.length > 30 || !clientIds.every(isUuid) || reference.length > 80 || destination.length > 240 || !statuses.includes(status) ||
      !validDate(departureDate) || !validDate(returnDate) ||
      typeof departureDate === "string" && typeof returnDate === "string" && returnDate < departureDate ||
      operator.length > 160 || adults !== null && (!Number.isInteger(adults) || adults < 1 || adults > 20) ||
      childrenCount !== null && (!Number.isInteger(childrenCount) || childrenCount < 0 || childrenCount > 30) ||
      totalAmount !== null && (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 9999999999.99) ||
      !/^[A-Z]{3}$/.test(currency) || tripNotes.length > 4000) {
    return NextResponse.json({ error: "Revê o cliente, a referência, o destino, o estado e as datas." }, { status: 400 });
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/crm_create_typed_trip`, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify({
        p_client_ids: clientIds,
        p_travel_type: travelType,
        p_data: {
        reference: reference || null,
        destination: destination || null,
        departure_date: departureDate,
        return_date: returnDate,
        status: status,
        operator: operator || null,
        adults: adults,
        children_count: childrenCount,
        total_amount: totalAmount,
        currency: currency,
        trinotes: tripNotes || null,
        },
        p_services: services,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { message?: string; code?: string } | null;
      if (failure?.message?.includes("client_not_found")) return NextResponse.json({ error: "O cliente selecionado já não existe." }, { status: 404 });
      if (failure?.code === "23505") return NextResponse.json({ error: "Já existe uma viagem com esta referência." }, { status: 409 });
      console.error("CRM manual trip create failed", response.status);
      return NextResponse.json({ error: "Não foi possível criar a viagem." }, { status: 502 });
    }
    const tripId = await response.json();
    return NextResponse.json({ trip_id: tripId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

async function previewTripPdf(request: NextRequest) {
  const maxPdfBytes = 4 * 1024 * 1024;
  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "Não foi possível ler o ficheiro enviado." }, { status: 400 }); }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Seleciona um ficheiro PDF." }, { status: 400 });
  if (file.type !== "application/pdf" || file.size < 8 || file.size > maxPdfBytes) {
    return NextResponse.json({ error: "O ficheiro tem de ser PDF e não pode ultrapassar 4 MB." }, { status: 400 });
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "O ficheiro selecionado não parece ser um PDF válido." }, { status: 400 });
    const pdfParse = require("pdf-parse") as (input: Buffer) => Promise<{ text?: string; numpages?: number }>;
    const parsed = await pdfParse(buffer);
    let text = typeof parsed.text === "string" ? parsed.text : "";
    if (text.trim().length < 40 && parsed.numpages) text = await tryLocalOcr(buffer, Math.min(parsed.numpages, 10));
    if (text.trim().length < 40) return NextResponse.json({ error: "Não consegui ler texto neste PDF. Confirma que não está protegido por palavra-passe e que a leitura OCR local está disponível." }, { status: 422 });
    const fields = extractTripFieldsFromPdfText(text);
    const found = Object.entries(fields).filter(([key, value]) => key !== "currency" && key !== "operator" && key !== "trip_notes" && (key !== "services" || Array.isArray(value) && value.length > 0) && value !== "" && value !== null).length;
    if (found === 0) return NextResponse.json({ error: "Não encontrei campos de viagem reconhecíveis. Podes preencher os dados manualmente nesta ficha." }, { status: 422 });
    return NextResponse.json({ fields, message: "Confirma e corrige todos os campos antes de criar a viagem. O texto original do PDF não é guardado nem devolvido." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("CRM PDF preview failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Não consegui interpretar este PDF. Podes criar a viagem preenchendo os dados manualmente." }, { status: 422 });
  }
}

async function tryLocalOcr(buffer: Buffer, pageCount: number) {
  const folder = await mkdtemp(join(tmpdir(), "travel-frontiers-crm-pdf-"));
  try {
    const input = join(folder, "source.pdf");
    const prefix = join(folder, "page");
    await writeFile(input, buffer, { mode: 0o600 });
    await execFile(process.env.PDFTOPPM_BIN || "pdftoppm", ["-f", "1", "-l", String(pageCount), "-r", "150", "-png", input, prefix], { timeout: 25000, maxBuffer: 1024 * 1024 });
    const pages = (await readdir(folder)).filter((name) => /^page-\d+\.png$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    const textPages: string[] = [];
    for (const page of pages) {
      const imagePath = join(folder, page);
      const result = await execFile(process.env.TESSERACT_BIN || "tesseract", [imagePath, "stdout", "-l", "por+eng", "--psm", "6"], { timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
      textPages.push(result.stdout);
    }
    return textPages.join("\n");
  } catch (error) {
    console.warn("CRM local OCR unavailable", error instanceof Error ? error.name : "unknown");
    return "";
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

async function convertWonLead(config: NonNullable<ReturnType<typeof supabaseAdminConfig>>, leadId: string) {
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/crm_convert_lead_to_trip`, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify({ p_lead_id: leadId }),
      cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { message?: string } | null;
      if (failure?.message?.includes("lead_not_found")) return NextResponse.json({ error: "O pedido já não existe." }, { status: 404 });
      if (failure?.message?.includes("lead_not_confirmed")) return NextResponse.json({ error: "Só podes criar uma viagem a partir de um pedido ganho." }, { status: 409 });
      console.error("CRM lead conversion failed", response.status);
      return NextResponse.json({ error: "Não foi possível criar a viagem." }, { status: 502 });
    }
    const tripId = await response.json();
    return NextResponse.json({ trip_id: tripId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível ligar à base de dados." }, { status: 502 });
  }
}

