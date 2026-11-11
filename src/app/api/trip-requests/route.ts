import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createHmac } from "node:crypto";
import { supabaseAdminConfig } from "@/lib/crm-api";

export const runtime = "nodejs";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Honeypot: bots tend to fill this hidden field; accept without storing.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const full_name = clean(body.full_name, 160);
  const language = body.language === "en" || body.language === "fr" ? body.language : "pt";
  const email = clean(body.email, 255)?.toLowerCase() ?? null;
  const phone = clean(body.phone, 40);
  const destination = clean(body.destination, 240);
  const travel_style = clean(body.travel_style, 120);
  const budget = clean(body.budget, 120);
  const notes = clean(body.notes, 4000);
  const adults = Number(body.adults);
  const rawChildrenAges = Array.isArray(body.children_ages) ? body.children_ages : [];
  const children_ages = rawChildrenAges.map(Number);
  const children_count = body.children_count === undefined ? rawChildrenAges.length : Number(body.children_count);
  const validChildrenAges = rawChildrenAges.length <= 12 && children_count === rawChildrenAges.length &&
    rawChildrenAges.every((age) => (typeof age === "number" || typeof age === "string" && age.trim() !== "") &&
      Number.isInteger(Number(age)) && Number(age) >= 0 && Number(age) <= 17);
  const departure_date = clean(body.departure_date, 10);
  const return_date = clean(body.return_date, 10);
  const date_flexible = body.date_flexible === true;
  const travel_period = date_flexible && typeof body.travel_period === "string" ? body.travel_period.trim() || null : null;
  const consent_privacy = body.consent_privacy === true;

  if (!full_name || full_name.length < 2 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.warn("Trip request rejected: invalid contact");
    return NextResponse.json({ error: "invalid_request", field: "contact" }, { status: 400 });
  }
  if (!destination) {
    console.warn("Trip request rejected: missing destination");
    return NextResponse.json({ error: "invalid_request", field: "destination" }, { status: 400 });
  }
  const budgetLabels: Record<string, Record<string, string>> = {
    under_500: { pt: "Até 500 €", en: "Up to €500", fr: "Jusqu’à 500 €" },
    "500_1000": { pt: "500 € – 1.000 €", en: "€500 – €1,000", fr: "500 € – 1 000 €" },
    "1000_1500": { pt: "1.000 € – 1.500 €", en: "€1,000 – €1,500", fr: "1 000 € – 1 500 €" },
    "1500_2000": { pt: "1.500 € – 2.000 €", en: "€1,500 – €2,000", fr: "1 500 € – 2 000 €" },
    over_2000: { pt: "Mais de 2.000 €", en: "Over €2,000", fr: "Plus de 2 000 €" },
    undecided: { pt: "Ainda não defini", en: "I haven’t decided yet", fr: "Je n’ai pas encore décidé" },
  };
  if (!Number.isInteger(adults) || adults < 1 || adults > 20 || !validChildrenAges) {
    console.warn("Trip request rejected: invalid travelers or child ages");
    return NextResponse.json({ error: "invalid_request", field: "travelers" }, { status: 400 });
  }
  if (!budget || !budgetLabels[budget]) {
    console.warn("Trip request rejected: invalid budget");
    return NextResponse.json({ error: "invalid_request", field: "budget" }, { status: 400 });
  }
  if (!consent_privacy) {
    console.warn("Trip request rejected: missing privacy consent");
    return NextResponse.json({ error: "invalid_request", field: "privacy" }, { status: 400 });
  }
  if ((departure_date && !validDate(departure_date)) || (return_date && !validDate(return_date)) ||
      travel_period !== null && (travel_period.length < 3 || travel_period.length > 120) ||
      (!departure_date || !return_date) && !travel_period ||
      departure_date && return_date && return_date <= departure_date) {
    console.warn("Trip request rejected: invalid dates");
    return NextResponse.json({ error: "invalid_request", field: "dates" }, { status: 400 });
  }

  const config = supabaseAdminConfig();
  const hashSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !hashSecret) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const lead = { full_name, email, language, phone, destination, departure_date, return_date,
    date_flexible, travel_period, adults, children_ages, travel_style, budget, notes, consent_privacy };
  const hash = (value: string) => createHmac("sha256", hashSecret).update(value).digest("hex");
  const address = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/crm_submit_public_request`, {
      method: "POST", headers: config.headers,
      body: JSON.stringify({ p_client_hash: hash("ip:" + address), p_request_hash: hash("request:" + JSON.stringify(lead)), p_lead: lead }),
      cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { message?: string } | null;
      if (failure?.message?.includes("rate_limited")) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "3600" } });
      console.error("Lead insert failed", response.status);
      return NextResponse.json({ error: "save_failed" }, { status: 502 });
    }
    const result = await response.json() as { duplicate?: boolean };
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    const smtpHost = process.env.CRM_SMTP_HOST;
    const smtpUser = process.env.CRM_SMTP_USER;
    const smtpPassword = process.env.CRM_SMTP_PASSWORD;
    const notificationTo = process.env.CRM_NOTIFICATION_TO;
    if (!smtpHost || !smtpUser || !smtpPassword || !notificationTo) {
      console.error("Lead stored but CRM SMTP notification is not configured");
      return NextResponse.json({ ok: true, notificationPending: true });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.CRM_SMTP_PORT || 587),
        secure: process.env.CRM_SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPassword },
      });
      const languageLabel = language === "pt" ? "Português" : language === "en" ? "Inglês" : "Francês";
      const lines = [
        `Novo pedido de viagem — ${full_name}`,
        `Idioma do formulário: ${languageLabel}`,
        `Email: ${email}`,
        phone ? `Telefone: ${phone}` : null,
        destination ? `Destino: ${destination}` : null,
        `Flexibilidade nas datas: ${date_flexible ? "Sim" : "Não"}`,
        travel_period ? `Período aproximado: ${travel_period}` : null,
        departure_date ? `Partida: ${departure_date}` : null,
        return_date ? `Regresso: ${return_date}` : null,
        `Adultos: ${adults}`,
        children_ages.length ? `Idades das crianças: ${children_ages.join(", ")}` : null,
        travel_style ? `Estilo: ${travel_style}` : null,
        budget ? `Orçamento: ${budgetLabels[budget]?.[language] ?? budget}` : null,
        notes ? `Notas: ${notes}` : null,
      ].filter(Boolean).join("\n");
      await transporter.sendMail({
        from: `Travel Frontiers <${smtpUser}>`,
        to: notificationTo,
        replyTo: email,
        subject: `Novo pedido de viagem — ${full_name}`,
        text: lines,
      });
    } catch (mailError) {
      console.error("Lead stored but SMTP notification failed", mailError);
      // The lead is safely stored; don't encourage the visitor to resubmit and create a duplicate.
      return NextResponse.json({ ok: true, notificationPending: true });
    }
    return NextResponse.json({ ok: true, notificationPending: false });
  } catch (error) {
    console.error("Supabase request failed", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
}
