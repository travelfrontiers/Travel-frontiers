import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Honeypot: bots tend to fill this hidden field; accept without storing.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const full_name = clean(body.full_name, 160);
  const language = body.language === "en" || body.language === "fr" ? body.language : "pt";
  const email = clean(body.email, 254)?.toLowerCase() ?? null;
  const phone = clean(body.phone, 40);
  const destination = clean(body.destination, 240);
  const travel_style = clean(body.travel_style, 120);
  const budget = clean(body.budget, 120);
  const notes = clean(body.notes, 4000);
  const adults = Number(body.adults);
  const children_ages = Array.isArray(body.children_ages)
    ? body.children_ages.map(Number)
    : [];
  const validChildrenAges = children_ages.length <= 12 && children_ages.every((age) => Number.isInteger(age) && age >= 0 && age <= 17);
  const departure_date = clean(body.departure_date, 10);
  const return_date = clean(body.return_date, 10);
  const date_flexible = body.date_flexible === true;
  const consent_privacy = body.consent_privacy === true;

  if (!full_name || full_name.length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const budgetLabels: Record<string, Record<string, string>> = {
    under_500: { pt: "Até 500 €", en: "Up to €500", fr: "Jusqu’à 500 €" },
    500_1000: { pt: "500 € – 1.000 €", en: "€500 – €1,000", fr: "500 € – 1 000 €" },
    1000_1500: { pt: "1.000 € – 1.500 €", en: "€1,000 – €1,500", fr: "1 000 € – 1 500 €" },
    1500_2000: { pt: "1.500 € – 2.000 €", en: "€1,500 – €2,000", fr: "1 500 € – 2 000 €" },
    over_2000: { pt: "Mais de 2.000 €", en: "Over €2,000", fr: "Plus de 2 000 €" },
    undecided: { pt: "Ainda não defini", en: "I haven’t decided yet", fr: "Je n’ai pas encore décidé" },
  };
  if (!Number.isInteger(adults) || adults < 1 || adults > 20 || !validChildrenAges || !budget || !budgetLabels[budget] || !consent_privacy) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if ((departure_date && !/^\d{4}-\d{2}-\d{2}$/.test(departure_date)) || (return_date && !/^\d{4}-\d{2}-\d{2}$/.test(return_date))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (departure_date && return_date && return_date < departure_date) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonKey = publishableKey || legacyAnonKey;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/crm_leads`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        ...(publishableKey ? {} : { Authorization: `Bearer ${anonKey}` }),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        full_name, email, language, phone, destination, departure_date, return_date,
        date_flexible, adults, children_ages, travel_style, budget, notes,
        consent_privacy, privacy_consent_at: new Date().toISOString(),
        status: "new", source: "public_form",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Supabase lead insert failed", response.status, await response.text());
      return NextResponse.json({ error: "save_failed" }, { status: 502 });
    }
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
