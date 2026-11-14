export const manualLeadSources = {
  whatsapp: "WhatsApp", phone: "Telefone", email: "Email", referral: "Referência", manual: "Outro",
} as const;
export type ManualLeadSource = keyof typeof manualLeadSources;

export function isManualLeadSource(value: unknown): value is ManualLeadSource {
  return typeof value === "string" && Object.hasOwn(manualLeadSources, value);
}
