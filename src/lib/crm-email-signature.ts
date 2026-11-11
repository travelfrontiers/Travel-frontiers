import type { EmailLanguage } from "./crm-email-templates";

export const emailSignatureImage = "https://promo.travelfrontiers.pt/email-signature.png";
export const emailSignatureName = "Tiago Ferreira · Travel Frontiers · GupiTravel";
export const emailSignatureSite = "https://www.travelfrontiers.pt";

const documentCopy = {
  pt: { fin: "FIN · Ficha de Informação Normalizada", terms: "Condições gerais de venda" },
  en: { fin: "Standard Information Form (FIN)", terms: "General terms of sale" },
  fr: { fin: "Formulaire d’information standard (FIN)", terms: "Conditions générales de vente" },
};

export type QuoteDocumentLinks = { fin: string; terms: string };

export function configuredQuoteDocuments(): QuoteDocumentLinks | null {
  const httpsLink = (value: string | undefined) => {
    const trimmed = value?.trim();
    const url = trimmed && trimmed.length <= 2000 ? URL.parse(trimmed) : null;
    return url?.protocol === "https:" && !url.username && !url.password ? url.href : null;
  };
  const fin = httpsLink(process.env.CRM_QUOTE_FIN_URL);
  const terms = httpsLink(process.env.CRM_QUOTE_TERMS_URL);
  return fin && terms && fin !== terms ? { fin, terms } : null;
}

export function quoteDocumentItems(language: EmailLanguage, links: QuoteDocumentLinks | null) {
  return links ? (["fin", "terms"] as const).map(role => ({ label: documentCopy[language][role], url: links[role] })) : [];
}

const originalQuoteEnding = {
  pt: "Junto envio a FIN e as condições gerais de venda. Para aceitares, responde a este email a indicar que leste e aceitas a proposta desta versão e os documentos anexos.",
  en: "The standard information form and general terms are attached. To accept, please reply confirming that you have read and accept this version of the proposal and its attachments.",
  fr: "Le formulaire d’information standard et les conditions générales sont joints. Pour accepter, réponds à cet e-mail en confirmant que tu as lu et accepté cette version de la proposition et les pièces jointes.",
};
const linkedQuoteEnding = {
  pt: "Podes consultar a FIN e as condições gerais de venda nos links abaixo. Para aceitares, responde a este email a confirmar que leste e aceitas esta versão da proposta e esses documentos.",
  en: "You can read the Standard Information Form and General Terms of Sale using the links below. To accept, reply confirming that you have read and accept this version of the proposal and those documents.",
  fr: "Le formulaire d’information standard et les conditions générales de vente sont accessibles via les liens ci-dessous. Pour accepter, réponds à cet e-mail en confirmant que tu as lu et accepté cette version de la proposition et ces documents.",
};

export function quoteBodyWithLinks(body: string, language: EmailLanguage) {
  return body.replace(originalQuoteEnding[language], linkedQuoteEnding[language]);
}

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => escapes[character]);

export function formatCrmEmail(body: string, language: EmailLanguage, links: QuoteDocumentLinks | null, signatureCid: string) {
  const documents = quoteDocumentItems(language, links);
  const textSignature = /Tiago Ferreira\s+Travel Frontiers\s*$/i.test(body) ? emailSignatureSite : emailSignatureName + "\n" + emailSignatureSite;
  const text = [body, textSignature,
    ...documents.map(({ label, url }) => label + ": " + url)].join("\n\n");
  const html = `<!doctype html><html lang="${language}"><body>
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55">${escapeHtml(body).replace(/\r\n|\r|\n/g, "<br>")}</div>
<div style="margin-top:20px">
  <a href="${emailSignatureSite}"><img src="cid:${escapeHtml(signatureCid)}" alt="${emailSignatureName}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a>
  ${documents.map(({ label, url }) => `<div style="font-family:Arial,sans-serif;font-size:14px;margin-top:6px"><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></div>`).join("")}
</div></body></html>`;
  return { text, html };
}
