export const clientFieldLimits = { nif: 32, address: 500 } as const;

export function readOptionalClientFields(input: Record<string, unknown>) {
  const fields: { nif?: string | null; address?: string | null } = {};
  for (const key of ["nif", "address"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "string" || value.trim().length > clientFieldLimits[key])) {
      return null;
    }
    fields[key] = typeof value === "string" ? value.trim() || null : null;
  }
  return fields;
}
