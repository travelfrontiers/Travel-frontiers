import { bookingStates, bookingTextFields, flightFields, hotelFields, type BookingDetails } from "@/lib/crm-booking-details";
import { officeInput } from "@/lib/crm-office-types";

const labels = {
  city: "Cidade", destination: "Destino", board: "Regime", room: "Tipo de quarto",
  email: "Email do hotel", phone: "Telefone do hotel", confirmed_on: "Última confirmação",
  flight_number: "N.º do voo", origin: "Aeroporto de origem", destination_airport: "Aeroporto de destino",
  pnr: "Localizador do voo / PNR", departure_time: "Hora local de partida", arrival_time: "Hora local de chegada",
  departure_zone: "Fuso da partida", arrival_zone: "Fuso da chegada", checkin_local: "Abertura confirmada do check-in (hora da partida)",
  checkin_url: "Link oficial de check-in", checkin_verified: "Confirmei que é o site oficial da companhia", drive_url: "Link do documento no Google Drive",
};
const inputTypes: Partial<Record<keyof typeof labels, string>> = {
  confirmed_on: "date", email: "email", phone: "tel", departure_time: "time", arrival_time: "time",
  checkin_local: "datetime-local", checkin_url: "url", drive_url: "url",
};

export function CrmBookingFields({ type, booking, prefix = "" }: { type: string; booking?: BookingDetails; prefix?: string }) {
  const fields = type === "flight" ? flightFields : type === "accommodation" ? hotelFields : [];
  return <>
    {type === "flight" && !prefix && <p className="text-sm text-slate-600 sm:col-span-2">Usa a hora local de cada aeroporto e um fuso IANA, por exemplo Europe/Lisbon ou Asia/Hong_Kong.</p>}
    {!!fields.length && <label className="text-sm">Estado da reserva<select name={prefix + "status"} defaultValue={booking?.status || "pending"} className={officeInput}>
      {Object.entries(bookingStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>}
    {[...fields, "drive_url" as const].map(field => field === "checkin_verified" ?
      <label className="flex min-h-11 items-center gap-2 text-sm" key={field}>
        <input name={prefix + field} type="checkbox" value="yes" defaultChecked={booking?.[field] === "yes"} className="size-5 accent-orange-800" />
        {labels[field]}
      </label> : <label className="min-w-0 text-sm" key={field}>{labels[field]}
      <input name={prefix + field} className={officeInput} type={inputTypes[field] || "text"}
        maxLength={bookingTextFields[field]} defaultValue={booking?.[field] || ""}
        placeholder={field === "departure_zone" ? "Europe/Lisbon" : field === "arrival_zone" ? "Asia/Hong_Kong" : undefined} />
    </label>)}
  </>;
}
