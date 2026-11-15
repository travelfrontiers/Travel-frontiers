import type { EmailConfig } from "./crm-email-context";
import { emailTemplateBodyLimit } from "./crm-email-templates";
import { readBounded } from "./studio-request";

const storagePath = "/storage/v1/object/authenticated/crm-email-templates/";

export function fetchPrecontractFile(config: EmailConfig, filename: string) {
  return fetch(config.url + storagePath + encodeURIComponent(filename), {
    headers: config.headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
}

export async function readPrecontractTemplate(config: EmailConfig) {
  try {
    const response = await fetchPrecontractFile(config, "modelo.json");
    if (!response.ok) return null;
    const { subject, body, attachments } = JSON.parse((await readBounded(response.body, 100_000)).toString("utf8"));
    if (typeof subject !== "string" || !subject.trim() || subject.length > 240 || /[\r\n\u0000]/.test(subject) ||
        typeof body !== "string" || !body.trim() || body.length > emailTemplateBodyLimit || body.includes("\u0000") ||
        !Array.isArray(attachments) || !attachments.length || attachments.length > 10 ||
        attachments.some(name => typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,160}\.pdf$/.test(name)) ||
        new Set(attachments).size !== attachments.length) return null;
    return { subject, body, attachments: attachments as string[] };
  } catch {
    return null;
  }
}
