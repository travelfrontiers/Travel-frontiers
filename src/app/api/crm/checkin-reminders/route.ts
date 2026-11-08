import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { supabaseAdminConfig } from "@/lib/crm-api";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ skipped: true });
  const config = supabaseAdminConfig();
  const host = process.env.CRM_SMTP_HOST, user = process.env.CRM_SMTP_USER, pass = process.env.CRM_SMTP_PASSWORD, to = process.env.CRM_NOTIFICATION_TO;
  if (!config || !host || !user || !pass || !to) return NextResponse.json({ error: "Lembretes não configurados." }, { status: 503 });
  const claim = randomUUID();
  const finish = (sent: boolean) => fetch(`${config.url}/rest/v1/rpc/crm_finish_checkin_reminders`, { method: "POST", headers: config.headers, body: JSON.stringify({ p_token: claim, p_sent: sent }), cache: "no-store" });
  let delivered = false;
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/crm_claim_checkin_reminders`, { method: "POST", headers: config.headers, body: JSON.stringify({ p_token: claim }), cache: "no-store" });
    if (!response.ok) throw new Error("claim_failed");
    const tasks = await response.json() as { id: string; title: string; destination: string | null }[];
    if (!tasks.length) return NextResponse.json({ sent: 0 });
    const transport = nodemailer.createTransport({ host, port: Number(process.env.CRM_SMTP_PORT || 465), secure: process.env.CRM_SMTP_SECURE === "true", auth: { user, pass }, connectionTimeout: 15000, socketTimeout: 25000 });
    await transport.sendMail({ from: `Travel Frontiers <${user}>`, to, subject: "Travel Frontiers · Lembretes de check-in",
      text: ["Tens check-ins por concluir:", ...tasks.map((task) => `• ${task.destination || "Viagem"} — ${task.title}`), "", "Abre o CRM e assinala as tarefas concluídas:", "https://promo.travelfrontiers.pt/admin/crm"].join("\n") });
    delivered = true;
    const saved = await finish(true);
    if (!saved.ok) throw new Error("mark_failed");
    return NextResponse.json({ sent: tasks.length });
  } catch {
    if (!delivered) await finish(false).catch(() => null);
    console.error("Check-in reminders failed", { delivered });
    return NextResponse.json({ error: "Não foi possível concluir os lembretes." }, { status: 502 });
  }
}
