import type { NextRequest } from "next/server";
import { crmConfig, CrmError, failure, payload, privateJson, rows, rpc, uuid } from "@/lib/crm-office-api";
import { serviceStatusLabels, commissionMethodLabels, type ServiceFinanceEvent } from "@/lib/crm-service-finance";

function amount(value: unknown, signed = false) {
  if (value === null || value === "" || value === undefined) return null;
  const pattern = signed ? /^-?\d{1,10}(?:\.\d{1,2})?$/ : /^\d{1,10}(?:\.\d{1,2})?$/;
  if ((typeof value !== "number" && typeof value !== "string") || !pattern.test(String(value))) {
    throw new CrmError("Indica montantes com até duas casas decimais.");
  }
  return Number(value);
}

export async function GET(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const tripId = request.nextUrl.searchParams.get("trip_id");
    if (!uuid(tripId)) throw new CrmError("Viagem inválida.");
    return privateJson({ events: await rows<ServiceFinanceEvent>(config, "crm_service_finance_history",
      new URLSearchParams({ trip_id: "eq." + tripId, select: "id,service_id,action,recorded_at,snapshot", order: "id.desc" })) });
  } catch (cause) { return failure(cause); }
}

export async function POST(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const body = await payload(request);
    if (!uuid(body.id) || !uuid(body.trip_id) || typeof body.version !== "number" || !Number.isInteger(body.version) ||
        body.version < 0 || body.version > 2147483647) throw new CrmError("Serviço ou versão inválida.");
    const serviceStatus = String(body.service_status);
    if (!Object.hasOwn(serviceStatusLabels, serviceStatus)) throw new CrmError("Seleciona o estado do serviço.");
    const sale = amount(body.sale_price);
    const cost = amount(body.net_cost);
    const commission = amount(body.service_commission);
    const adjustment = amount(body.service_adjustment, true);
    const basis = body.finance_basis || null;
    const quantity = basis === "booking" ? 1 : body.finance_quantity ? Number(body.finance_quantity) : null;
    const currency = typeof body.finance_currency === "string" ? body.finance_currency.trim().toUpperCase() : "";
    const source = typeof body.finance_source === "string" ? body.finance_source.trim() : "";
    const method = body.commission_method || null;
    const hasAmounts = [sale, cost, commission, adjustment].some(value => value !== null);
    if (basis !== null && basis !== "booking" && basis !== "person" ||
        quantity !== null && (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) ||
        currency && !/^[A-Z]{3}$/.test(currency) || source.length > 240 ||
        method !== null && (typeof method !== "string" || !Object.hasOwn(commissionMethodLabels, method))) {
      throw new CrmError("Revê os dados financeiros do serviço.");
    }
    if (hasAmounts && (!basis || !quantity || !currency || !source)) throw new CrmError("Indica a origem, a moeda e a base dos valores.");
    if (commission !== null && !method) throw new CrmError("Indica o método de comissão.");
    if (adjustment !== null && (sale === null || Math.round(sale * 100) + Math.round(adjustment * 100) < 0)) throw new CrmError("O ajuste exige um preço de venda e o resultado não pode ser negativo.");
    await rpc(config, "crm_save_service_finance", { p_id: body.id, p_trip_id: body.trip_id, p_version: body.version, p_data: {
      service_status: serviceStatus, sale_price: sale, net_cost: cost, service_commission: commission, service_adjustment: adjustment,
      finance_basis: basis, finance_quantity: quantity, finance_currency: currency || null, finance_source: source || null, commission_method: method,
    } });
    return privateJson({ ok: true });
  } catch (cause) { return failure(cause); }
}
