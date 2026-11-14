import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { supabaseAdminConfig } from "@/lib/crm-api";
import { renewalMessage, type RenewalDelivery } from "@/lib/crm-document-renewal";
import { emailAddress } from "@/lib/crm-email-recipients";
import { formatCrmEmail } from "@/lib/crm-email-signature";
import { readStoredTemplates, type StoredTemplate } from "@/lib/crm-email-template-store";
import type { EmailLanguage } from "@/lib/crm-email-templates";
import { smtpTransport } from "@/lib/crm-mailbox";
import { privateJson, rpc } from "@/lib/crm-office-api";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return privateJson({ error: "Acesso não autorizado." }, 401);
  }
  if (process.env.VERCEL_ENV !== "production") return privateJson({ skipped: true });

  const config = supabaseAdminConfig();
  const notificationTo = process.env.CRM_NOTIFICATION_TO?.trim();
  if (!config || !emailAddress(notificationTo)) return privateJson({ error: "Lembretes não configurados." }, 503);

  const totals = { sent: 0, failed: 0, uncertain: 0 };
  const started = Date.now();
  try {
    const signature = await readFile(join(process.cwd(), "public", "email-signature-inline.jpg"));
    const templates = new Map<EmailLanguage, StoredTemplate | undefined>();
    const { smtp, user } = smtpTransport();

    const send = async (delivery: RenewalDelivery): Promise<keyof typeof totals> => {
      const to = delivery.audience === "internal" ? notificationTo : delivery.email;
      if (!emailAddress(to)) return "failed";
      const { language } = delivery;
      if (delivery.audience === "customer" && !templates.has(language)) {
        const overrides = await readStoredTemplates(config, language).catch(() => []);
        templates.set(language, overrides.find(template => template.template_key === "document_renewal"));
      }
      const message = renewalMessage(delivery, templates.get(language));
      const messageId = "tf-document-renewal-" + delivery.id + "@" + user.split("@")[1];
      const signatureCid = "signature-" + messageId;
      const { text, html } = formatCrmEmail(message.body, message.language, null, signatureCid);
      try {
        const result = await smtp.sendMail({
          from: { name: "Tiago Ferreira · Travel Frontiers", address: user },
          to, subject: message.subject, text, html, messageId: "<" + messageId + ">",
          attachments: [{ filename: "assinatura-travel-frontiers.jpg", content: signature,
            contentType: "image/jpeg", contentDisposition: "inline", cid: signatureCid }],
        });
        return result.accepted.length ? "sent" : result.rejected.length ? "failed" : "uncertain";
      } catch (cause) {
        const error = cause as { responseCode?: number; code?: string };
        const rejected = typeof error.responseCode === "number" && error.responseCode >= 400 && error.responseCode < 600;
        return rejected || error.code === "EAUTH" || error.code === "EENVELOPE" ? "failed" : "uncertain";
      }
    };

    try {
      for (let i = 0; i < 60 && Date.now() - started < 85_000; i++) {
        const delivery = await rpc<RenewalDelivery | null>(config, "crm_claim_document_renewal", {});
        if (!delivery) break;
        const state = await send(delivery);
        await rpc(config, "crm_finish_document_renewal", { p_id: delivery.id, p_state: state });
        totals[state]++;
      }
    } finally { smtp.close(); }

    if (totals.failed || totals.uncertain) console.error("Document renewal delivery incomplete", totals);
    return privateJson(totals, totals.failed || totals.uncertain ? 502 : 200);
  } catch {
    console.error("Document renewal job failed", totals);
    return privateJson({ error: "Não foi possível concluir os lembretes de renovação.", ...totals }, 502);
  }
}
