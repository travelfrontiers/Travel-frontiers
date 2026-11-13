"use client";

import { useRef, useState, type FormEvent } from "react";
import { lisbonDay } from "@/lib/crm-calendar";
import { missingIdentityFields, type DocumentReading } from "@/lib/crm-document-ocr";
import { officeButton, officeInput, officeSecondary, type AuthorizedFetch } from "@/lib/crm-office-types";
import CrmDocumentScanner from "./crm-document-scanner";
import CrmClientBillingFields from "./crm-client-billing-fields";

const field = "block space-y-1 text-sm font-semibold";

export default function CrmNewClientForm({ saving, onSave, authorizedFetch }: {
  saving: boolean;
  authorizedFetch: AuthorizedFetch;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [identity, setIdentity] = useState({ full_name: "", birth_date: "" });
  const [document, setDocument] = useState<{ reading: DocumentReading; revision: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const revision = useRef(0);

  function applyReading(reading: DocumentReading | null) {
    setIdentity(current => ({
      full_name: reading?.full_name || (current.full_name === document?.reading.full_name ? "" : current.full_name),
      birth_date: reading?.birth_date || (current.birth_date === document?.reading.birth_date ? "" : current.birth_date),
    }));
    setDocument(reading ? { reading, revision: ++revision.current } : null);
  }

  const missing = document ? missingIdentityFields(document.reading) : [];

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-semibold">Novo cliente</h3>
    <CrmDocumentScanner authorizedFetch={authorizedFetch} onRead={applyReading} onScanning={setScanning} disabled={saving} />
    <form onSubmit={event => { if (scanning) event.preventDefault(); else void onSave(event); }}
      className="grid gap-4 sm:grid-cols-2">
      <label className={field}>Nome completo *<input name="full_name" required minLength={2} maxLength={160} autoComplete="name" value={identity.full_name} onChange={event => setIdentity(current => ({ ...current, full_name: event.target.value }))} className={officeInput} /></label>
      <label className={field}>Data de nascimento{document ? " *" : ""}<input name="birth_date" type="date" value={identity.birth_date} onChange={event => setIdentity(current => ({ ...current, birth_date: event.target.value }))} required={Boolean(document)} max={lisbonDay(new Date().toISOString())} className={officeInput} /></label>
      <label className={field}>Email<input name="email" type="email" maxLength={254} autoComplete="email" className={officeInput} /></label>
      <label className={field}>Telefone<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={officeInput} /></label>
      <label className={field}>Idioma<select name="language" defaultValue="pt" className={officeInput}><option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option></select></label>
      <CrmClientBillingFields inputClass={officeInput} labelClass={field} />
      <label className={field + " sm:col-span-2"}>Notas internas<textarea name="internal_notes" rows={3} maxLength={4000} className={officeInput} placeholder="Preferências ou notas úteis sobre o cliente" /></label>
      {document && <fieldset key={document.revision} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
        <legend className="px-2 text-sm font-semibold">Documento de identificação</legend>
        <p className="text-sm text-slate-600">Compara os dados preenchidos com o documento.{missing.length > 0 && <> A leitura deixou por preencher {missing.join(", ")}.</>}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={field}>Tipo *<select name="document_type" required defaultValue={document.reading.document_type || ""} className={officeInput}>
            <option value="">Seleciona</option><option value="passport">Passaporte</option><option value="identity_card">Cartão de Cidadão</option>
          </select></label>
          <label className={field}>Número/ID *<input name="document_number" required maxLength={80} defaultValue={document.reading.document_number} className={officeInput} /></label>
          <label className={field}>Validade *<input name="expires_on" required type="date" defaultValue={document.reading.expires_on} className={officeInput} /></label>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <input name="reviewed" type="checkbox" required className="mt-0.5 size-[18px] shrink-0 appearance-auto accent-orange-800"
            onInvalid={event => event.currentTarget.setCustomValidity("Assinala esta caixa para confirmar os dados antes de guardar.")}
            onChange={event => event.currentTarget.setCustomValidity("")}/>
          <span>Confirmei os dados da ficha e do documento. *</span>
        </label>
        <button type="button" className={officeSecondary} onClick={() => setDocument(null)}>Retirar documento da ficha</button>
      </fieldset>}
      <div className="flex justify-end sm:col-span-2">
        <button disabled={saving || scanning} className={officeButton}>{saving ? "A guardar…" : document ? "Guardar cliente e documento" : "Guardar cliente"}</button>
      </div>
    </form>
  </section>;
}
