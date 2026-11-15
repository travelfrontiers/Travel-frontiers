import { useState } from "react";
import type { TripPdfService } from "@/lib/crm-trip-pdf";
import { readBookingForm } from "@/lib/crm-booking-details";
import { officeInput } from "@/lib/crm-office-types";
import { CrmBookingFields } from "./crm-booking-fields";

const serviceLabels: Record<TripPdfService["service_type"], string> = {
  flight: "Voo", accommodation: "Alojamento", transfer: "Transfer", activity: "Atividade ou bilhete",
  insurance: "Seguro", other: "Outro serviço",
};

export function readPdfServices(data: FormData) {
  return Array.from(data.keys()).flatMap(key => {
    const match = /^service_\d+_type$/.exec(key);
    if (!match) return [];
    const prefix = key.slice(0, -4);
    const type = data.get(key) as TripPdfService["service_type"];
    const read = (field: string) => String(data.get(prefix + field) || "");
    return [{ service_type: type, title: read("title"), provider: read("provider"), reference: read("reference"),
      starts_on: read("starts_on"), ends_on: read("ends_on"), details: read("details"),
      booking: readBookingForm(data, type, prefix) }];
  });
}

export function CrmPdfServiceFields({ service, index, onRemove }: { service: TripPdfService; index: number; onRemove?: () => void }) {
  const [excluded, setExcluded] = useState(false);
  const prefix = `service_${index}_`;
  const flight = service.service_type === "flight";
  const hotel = service.service_type === "accommodation";
  return <>
    {excluded && <button type="button" className="min-h-11 text-sm underline" onClick={() => setExcluded(false)}>Repor {service.title}</button>}
    <fieldset hidden={excluded} disabled={excluded} className={excluded ? "hidden" :"grid min-w-0 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"}>
    <legend className="break-words text-sm font-semibold">{serviceLabels[service.service_type]} · {service.title}</legend>
    <input type="hidden" name={prefix + "type"} value={service.service_type} />
    <label className="min-w-0 text-sm">Nome<input name={prefix + "title"} className={officeInput} required maxLength={240} defaultValue={service.title} /></label>
    <label className="min-w-0 text-sm">Companhia ou fornecedor<input name={prefix + "provider"} className={officeInput} maxLength={160} defaultValue={service.provider} /></label>
    <label className="min-w-0 text-sm">Referência do serviço<input name={prefix + "reference"} className={officeInput} maxLength={100} defaultValue={service.reference} /></label>
    <label className="min-w-0 text-sm">{flight ? "Data de partida" : hotel ? "Check-in" : "Data de início"}<input name={prefix + "starts_on"} className={officeInput} type="date" defaultValue={service.starts_on} /></label>
    <label className="min-w-0 text-sm">{flight ? "Data de chegada" : hotel ? "Check-out" : "Data de fim"}<input name={prefix + "ends_on"} className={officeInput} type="date" defaultValue={service.ends_on} /></label>
    <details className="sm:col-span-2">
      <summary className="cursor-pointer py-2 text-sm font-semibold">Rever detalhes da reserva</summary>
      <div className="grid gap-3 sm:grid-cols-2"><CrmBookingFields prefix={prefix} type={service.service_type} booking={service.booking} /></div>
    </details>
    <label className="text-sm sm:col-span-2">Observações<textarea name={prefix + "details"} className={officeInput} rows={2} maxLength={4000} defaultValue={service.details} /></label>
    <button type="button" className="min-h-11 justify-self-start text-sm text-red-700 underline" onClick={onRemove || (() => setExcluded(true))}>Retirar serviço da importação</button>
  </fieldset></>;
}
