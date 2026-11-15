import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TripPdfFields } from "@/lib/crm-trip-pdf";
import { officeButton, officeInput, type AuthorizedFetch } from "@/lib/crm-office-types";
import { formatMoney, type FinanceSummary } from "@/lib/crm-finance";
import { CrmPdfServiceFields, readPdfServices } from "./crm-pdf-service-fields";

export default function CrmExistingTripPdf({ tripId, finance, authorizedFetch, onServicesImported, onTotalSaved }: {
  tripId: string; finance?: FinanceSummary; authorizedFetch: AuthorizedFetch;
  onServicesImported: () => Promise<void>; onTotalSaved?: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<TripPdfFields | null>(null);
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [reading, setReading] = useState<AbortController | null>(null);
  const activeRead = useRef<AbortController | null>(null);
  useEffect(() => () => activeRead.current?.abort(), []);

  async function read(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (activeRead.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    activeRead.current = controller;
    setReading(controller); setProgress("A ler o documento…");
    setBusy(true); setError(""); setMessage(""); setPreview(null); setRemoved([]);
    try {
      let fields: TripPdfFields | undefined;
      if (file.type === "application/pdf" && file.size <= 4 * 1024 * 1024) {
        data.set("text_only", "true");
        const response = await authorizedFetch("/api/crm/trips", { method: "POST", body: data, signal });
        const result = await response.json();
        if (response.ok) fields = result.fields;
        else if (response.status !== 422) throw new Error(result.error);
      }
      if (!fields?.services.length) {
        try {
          const [{ scanBookingDocument }, { extractTripFieldsFromPdfText }] = await Promise.all([
            import("@/lib/crm-document-scan"), import("@/lib/crm-trip-pdf"),
          ]);
          signal.throwIfAborted();
          const scanned = extractTripFieldsFromPdfText(await scanBookingDocument(file, signal, setProgress));
          fields = fields?.total_amount ? {
            ...scanned, total_amount: fields.total_amount, currency: fields.currency,
          } : scanned;
        } catch (cause) {
          if (!fields || signal.aborted) throw cause;
        }
      }
      signal.throwIfAborted();
      setPreview(fields ?? null);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível ler o documento.");
    } finally {
      activeRead.current = null;
      setReading(null); setBusy(false);
    }
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
      await onTotalSaved?.();
      setMessage("Valor total atualizado na ficha financeira.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o valor total."); }
    finally { setBusy(false); }
  }

  return <details className="rounded-xl border border-slate-200 p-3 sm:p-4">
    <summary className="cursor-pointer py-2 font-semibold">Ler documento de reserva (OCR)</summary>
    <form onSubmit={read} className="my-3 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">Orçamento, confirmação ou bilhete (PDF, JPG, PNG ou WebP até 15 MB)
        <input required name="file" type="file" disabled={busy} accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" className={officeInput} />
      </label>
      <button disabled={busy} className={officeButton + " min-h-11"}>Ler documento</button>
      {reading && <button type="button" className="min-h-11 text-sm underline" onClick={() => reading.abort()}>Cancelar leitura</button>}
    </form>
    {reading && <p role="status" className="text-sm">{progress}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {preview && onTotalSaved && <section className="my-3 rounded-xl bg-slate-50 p-3 text-sm">
      <h5 className="font-semibold">Valor total identificado no documento</h5>
      <p className="mt-1">{extractedTotal === null ? "Não foi possível identificar o total." : formatMoney(extractedTotal, preview.currency)}</p>
      {extractedTotal !== null && finance && <p className="mt-1 text-slate-600">Na viagem · {formatMoney(finance.total_amount, finance.currency)}</p>}
      {extractedTotal !== null && finance && finance.currency !== preview.currency &&
        <p className="mt-1 text-slate-600">A moeda do documento é diferente da moeda da viagem. Confirma os valores na ficha financeira.</p>}
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
        <p className="text-sm text-slate-600">Nenhum serviço selecionado ou identificado. Podes adicionar a reserva manualmente abaixo.</p>}
    </form>}
  </details>;
}
