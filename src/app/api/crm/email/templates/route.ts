import type { NextRequest } from "next/server";
import { crmConfig, CrmError, failure, payload, privateJson } from "@/lib/crm-office-api";
import { baseEmailTemplate, emailTemplateKeys } from "@/lib/crm-email-templates";
import { readStoredTemplates, saveStoredTemplate, templateLanguage, validTemplate } from "@/lib/crm-email-template-store";
import { readPrecontractTemplate } from "@/lib/crm-precontract-email";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const language = templateLanguage(request.nextUrl.searchParams.get("language") ?? "pt");
    const [overrides, precontract] = await Promise.all([readStoredTemplates(config, language), readPrecontractTemplate(config)]);
    return privateJson({ templates: emailTemplateKeys.flatMap(key => {
      const custom = overrides.find(entry => entry.template_key === key);
      const defaults = key === "precontract" ? precontract : baseEmailTemplate(key, language);
      if (!defaults) return [];
      const copy = custom ?? defaults;
      return [{ key, subject: copy.subject, body: copy.body, defaultSubject: defaults.subject, defaultBody: defaults.body }];
    }) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const data = await payload(request);
    const language = templateLanguage(data.language);
    if (!validTemplate(data.key)) throw new CrmError("Seleciona um modelo válido.");
    const { subject, body } = await saveStoredTemplate(config, data.key, language, data);
    return privateJson({ template: { key: data.key, subject, body } });
  } catch (error) { return failure(error); }
}
