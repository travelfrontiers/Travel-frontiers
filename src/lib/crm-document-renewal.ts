import { baseEmailTemplate, fillEmailTemplate, missingEmailFields, type EmailLanguage } from "./crm-email-templates";

const documentLabels = {
  passport: { pt: "Passaporte", en: "Passport", fr: "Passeport" },
  identity_card: { pt: "Cartão de Cidadão", en: "Citizen Card", fr: "Carte de citoyen portugais" },
  residence_permit: { pt: "Título de residência", en: "Residence permit", fr: "Titre de séjour" },
  other: { pt: "Documento de identificação", en: "Identity document", fr: "Document d’identité" },
} as const;

export type RenewalDelivery = {
  id: string;
  document_type: keyof typeof documentLabels;
  expires_on: string;
  full_name: string;
  language: EmailLanguage;
  audience: "customer" | "internal";
  email: string | null;
};
type Copy = { subject: string; body: string };
const locales = { pt: "pt-PT", en: "en-GB", fr: "fr-FR" } as const;

export function renewalMessage(delivery: RenewalDelivery, customized?: Copy) {
  const { full_name, document_type, expires_on } = delivery;
  const language = delivery.audience === "internal" ? "pt" : delivery.language;
  const document = documentLabels[document_type][language];
  const expiry = new Intl.DateTimeFormat(locales[language], { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(expires_on + "T00:00:00Z"));
  if (delivery.audience === "internal") return {
    language,
    subject: "CRM · Documento de cliente a vencer",
    body: [
      "Olá, Tiago,", "",
      "Há um documento a chegar ao fim da validade no CRM.", "",
      "Cliente: " + full_name,
      "Documento: " + document,
      "Data de validade: " + expiry, "",
      delivery.email ? "O lembrete do cliente segue num envio separado." : "O cliente não tem um email válido na ficha. Contacta-o por outra via.",
      "", "Consulta a ficha em https://promo.travelfrontiers.pt/admin/crm",
    ].join("\n"),
  };
  const fields = { cliente: full_name, tipo_documento: document, validade: expiry };
  const render = (copy: Copy) => ({
    subject: fillEmailTemplate(copy.subject, fields).replace(/[\r\n]+/g, " ").slice(0, 240),
    body: fillEmailTemplate(copy.body, fields),
  });
  const fallback = baseEmailTemplate("document_renewal", language);
  const rendered = render(customized ?? fallback);
  const message = !rendered.subject.trim() || !rendered.body.trim() || missingEmailFields(rendered.subject + "\n" + rendered.body).length
    ? render(fallback) : rendered;
  return { language, ...message };
}
