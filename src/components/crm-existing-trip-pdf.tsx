import { useState, type FormEvent } from "react";
import type { TripPdfFields } from "@/lib/crm-trip-pdf";
import { officeButton, officeInput, type AuthorizedFetch } from "@/lib/crm-office-types";
import { formatMoney, type FinanceSummary } from "@/lib/crm-finance";
import { CrmPdfServiceFields, readPdfServices } from "./crm-pdf-service-fields";

export default function CrmExistingTripPdf({ tripId, finance, authorizedFetch, onServicesImported, onTotalSaved }: {
  tripId: string; finance?: FinanceSummary; authorizedFetch: AuthorizedFetch;
  onServicesImported: () => Promise<void>; onTotalSaved: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<TripPdfFields | null>(null);
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function read(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage(""); setPreview(null); setRemoved([]);
    try {
      const response = await authorizedFetch("/api/crm/trips", { method: "POST", body: new FormData(event.currentTarget) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result.fields);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler o PDF."); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const services = readPdfServices(new FormData(event.currentTarget));
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedFetch("/api/crm/trips/" + tripId, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_services", services }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(current => current && { ...current, services: [] });
      setMessage(result.imported === 0 ? "Nenhum serviço novo ou campo em falta para atualizar." :
        result.imported === 1 ? "1 serviço importado ou completado." : result.imported + " serviços importados ou completados.");
      await onServicesImported();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível importar os serviços."); }
    finally { setBusy(false); }
  }

  const extractedTotal = preview?.total_amount ? Number(preview.total_amount) : null;
  const canSaveTotal = Boolean(finance && extractedTotal !== null && finance.currency === preview?.currency &&
    finance.total_amount !== extractedTotal);

  async function saveTotal() {
    if (!canSaveTotal || !finance || extractedTotal === null) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedFetch("/api/crm/finance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "total_save", trip_id: tripId, expected_version: finance.version, amount: extractedTotal }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await onTotalSaved();
      setMessage("Valor total atualizado na ficha financeira.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o valor total."); }
    finally { setBusy(false); }
  }

  return <details className="rounded-xl border border-slate-200 p-3 sm:p-4">
    <summary className="cursor-pointer py-2 font-semibold">Ler total, voos e hotéis de um PDF</summary>
    <form onSubmit={read} className="my-3 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">Orçamento ou confirmação de reserva (PDF até 4 MB)
        <input required name="file" type="file" accept="application/pdf,.pdf" className={officeInput} />
      </label>
      <button disabled={busy} className={officeButton + " min-h-11"}>Ler PDF</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {preview && <section className="my-3 rounded-xl bg-slate-50 p-3 text-sm">
      <h5 className="font-semibold">Valor total da reserva no PDF</h5>
      <p className="mt-1">{extractedTotal === null ? "Não foi possível identificar o total." : formatMoney(extractedTotal, preview.currency)}</p>
      {extractedTotal !== null && finance && <p className="mt-1 text-slate-600">Na viagem · {formatMoney(finance.total_amount, finance.currency)}</p>}
      {extractedTotal !== null && finance && finance.currency !== preview.currency &&
        <p className="mt-1 text-slate-600">A moeda do PDF é diferente da moeda da viagem. Confirma os valores na ficha financeira.</p>}
      {extractedTotal !== null && !finance && <p className="mt-1 text-slate-600">Os dados financeiros da viagem ainda não estão disponíveis.</p>}
      {canSaveTotal && <button type="button" disabled={busy} className={officeButton + " mt-2 min-h-11"}
        onClick={() => void saveTotal()}>Guardar este valor na viagem</button>}
    </section>}
    {preview && <form onSubmit={save} className="space-y-3">
      <p className="text-sm text-slate-600">Revê os serviços antes de os associar. Podes guardar o original na secção Documentos.</p>
      {preview.services.map((service, index) => !removed.includes(index) &&
        <CrmPdfServiceFields key={index} service={service} index={index} onRemove={() => setRemoved(previous => [...previous, index])} />)}
      {removed.length < preview.services.length ?
        <button disabled={busy} className={officeButton + " min-h-11"}>Confirmar serviços</button> :
        <p className="text-sm text-slate-600">Sem serviços para importar.</p>}
    </form>}
  </details>;
}
