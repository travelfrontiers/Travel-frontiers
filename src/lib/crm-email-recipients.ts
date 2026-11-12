export const agencyCopyAddress = "geral@gupitravel.pt";
export const maxEmailRecipients = 30;

const addressPattern = /^[\w.!#$%&'*+/=?^`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export function emailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && addressPattern.test(value);
}

export function parseEmailRecipients(value: string) {
  const entries = [...new Set(value.split(/[,;\n]+/).map(address => address.trim().toLowerCase()).filter(Boolean))];
  return {
    addresses: entries.filter(emailAddress),
    invalid: entries.some(address => !emailAddress(address)) || entries.length > maxEmailRecipients,
  };
}
