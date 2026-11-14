export const serviceStatusLabels = { unspecified: "Por definir", quoted: "Orçamentado", confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado" } as const;
export const commissionMethodLabels = { included: "Comissão incluída", markup: "Markup sobre o custo", fixed: "Montante fixo", unknown: "Por confirmar" } as const;
export type ServiceFinance = {
  service_status: keyof typeof serviceStatusLabels;
  finance_version: number;
  sale_price: number | null;
  net_cost: number | null;
  service_commission: number | null;
  service_adjustment: number | null;
  finance_currency: string | null;
  finance_basis: "booking" | "person" | null;
  finance_quantity: number | null;
  commission_method: keyof typeof commissionMethodLabels | null;
  finance_source: string | null;
};
export type ServiceFinanceEvent = {
  id: number; service_id: string; recorded_at: string; action: "updated" | "removed";
  snapshot: Omit<ServiceFinance, "finance_version"> & { title: string; version: number };
};
export function summarizeServices(services: Partial<ServiceFinance>[]) {
  const totals: Record<string, { sales: number; costs: number; commissions: number; priced: number; costsKnown: number; commissionsKnown: number }> = {};
  let active = 0;
  for (const service of services) {
    if (service.service_status === "cancelled") continue;
    active++;
    const currency = service.finance_currency;
    const quantity = service.finance_quantity;
    if (!currency || !quantity) continue;
    const total = totals[currency] ??= { sales: 0, costs: 0, commissions: 0, priced: 0, costsKnown: 0, commissionsKnown: 0 };
    if (service.sale_price != null) {
      total.sales += (Math.round(service.sale_price * 100) + Math.round((service.service_adjustment ?? 0) * 100)) * quantity;
      total.priced++;
    }
    if (service.net_cost != null) { total.costs += Math.round(service.net_cost * 100) * quantity; total.costsKnown++; }
    if (service.service_commission != null) { total.commissions += Math.round(service.service_commission * 100) * quantity; total.commissionsKnown++; }
  }
  return { totals, active };
}
