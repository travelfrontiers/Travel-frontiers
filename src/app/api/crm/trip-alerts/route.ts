import type { NextRequest } from "next/server";
import { crmConfig, CrmError, failure, privateJson, rows, uuid } from "@/lib/crm-office-api";
import { addDays, lisbonDay } from "@/lib/crm-calendar";
import { formatMoney, type PaymentSchedule } from "@/lib/crm-finance";
import type { TripAlert } from "@/lib/crm-trip-alerts";

export async function GET(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const id = request.nextUrl.searchParams.get("trip_id");
    if (!uuid(id)) throw new CrmError("Viagem inválida.");
    const today = lisbonDay(new Date().toISOString());
    const [payments, proposals] = await Promise.all([
      rows<PaymentSchedule>(config, "crm_payment_deadlines", new URLSearchParams({
        trip_id: "eq." + id, select: "id,label,due_on,currency,amount_remaining",
        amount_remaining: "gt.0", due_on: "lte." + addDays(today, 7),
        status: "neq.cancelled", archived_at: "is.null", order: "due_on,id",
      })),
      rows<{ id: string; title: string; valid_until: string }>(config, "crm_proposals_overview", new URLSearchParams({
        trip_id: "eq." + id, select: "id,title,valid_until", status: "in.(draft,sent)",
        valid_until: "lte." + addDays(today, 14), order: "valid_until,id",
      })),
    ]);
    const alerts: TripAlert[] = [
      ...payments.map(item => ({ id: item.id, date: item.due_on,
        title: item.label + " · " + formatMoney(item.amount_remaining, item.currency) + " em falta",
        kind: "Prestação" as const, target: { type: "trip" as const, id, finance: true } })),
      ...proposals.map(item => ({ id: item.id, date: item.valid_until, title: item.title,
        kind: "Validade de proposta" as const, target: { type: "proposal" as const, id: item.id } })),
    ];
    return privateJson({ alerts });
  } catch (cause) { return failure(cause); }
}
