import { CrmError } from "./crm-office-api";
import { emailRest, type EmailConfig } from "./crm-email-context";
import { emailLanguages, emailTemplates, emailTemplateBodyLimit, type EmailLanguage, type EmailTemplateKey } from "./crm-email-templates";

export type StoredTemplate = { template_key: EmailTemplateKey; subject: string; body: string };

export function validTemplate(key: unknown): key is EmailTemplateKey {
  return typeof key === "string" && Object.hasOwn(emailTemplates, key);
}

export function templateLanguage(value: unknown): EmailLanguage {
  if (typeof value !== "string" || !Object.hasOwn(emailLanguages, value)) throw new CrmError("Seleciona um idioma válido.");
  return value as EmailLanguage;
}

export function readStoredTemplates(config: EmailConfig, language: EmailLanguage) {
  return emailRest<StoredTemplate[]>(config, "crm_email_templates", {
    language: "eq." + language, select: "template_key,subject,body",
  });
}

export async function saveStoredTemplate(config: EmailConfig, key: EmailTemplateKey, language: EmailLanguage, data: Record<string, unknown>) {
  const { subject, body } = data;
  if (typeof subject !== "string" || !subject.trim() || subject.length > 240 || /[\r\n\u0000]/.test(subject) ||
      typeof body !== "string" || !body.trim() || body.length > emailTemplateBodyLimit || body.includes("\u0000")) {
    throw new CrmError("Revê o assunto e o texto do modelo.");
  }
  const template = { template_key: key, language, subject: subject.trim(), body: body.trim() };
  await emailRest(config, "crm_email_templates", { on_conflict: "template_key,language" }, {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ ...template, updated_at: new Date().toISOString() }),
  });
  return template;
}
