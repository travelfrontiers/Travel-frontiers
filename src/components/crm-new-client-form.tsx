"use client";

import { useRef, useState, type FormEvent } from "react";
import { lisbonDay } from "@/lib/crm-calendar";
import type { DocumentReading } from "@/lib/crm-document-ocr";
import { officeButton, officeInput, officeSecondary } from "@/lib/crm-office-types";
import CrmDocumentScanner from "./crm-document-scanner";

const field = "block space-y-1 text-sm font-semibold";

export default function CrmNewClientForm({ saving, onSave }: {
  saving: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [document, setDocument] = useState<{ reading: DocumentReading; revision: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const revision = useRef(0);

  function applyReading(reading: DocumentReading) {
    const fields = form.current?.elements;
    const name = fields?.namedItem("full_name");
    const birthDate = fields?.namedItem("birth_date");
    if (name instanceof HTMLInputElement && (reading.full_name || document)) name.value = reading.full_name;
    if (birthDate instanceof HTMLInputElement && (reading.birth_date || document)) birthDate.value = reading.birth_date;
    setDocument({ reading, revision: ++revision.current });
  }

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-semibold">Novo cliente</h3>
    <CrmDocumentScanner onRead={applyReading} onScanning={setScanning} disabled={saving} />
    <form ref={form} onSubmit={event => { if (scanning) event.preventDefault(); else void onSave(event); }}
      className="grid gap-4 sm:grid-cols-2">
      <label className={field}>Nome completo *<input name="full_name" required minLength={2} maxLength={160} autoComplete="name" className={officeInput} /></label>
      <label className={field}>Data de nascimento{document ? " *" : ""}<input name="birth_date" type="date" required={Boolean(document)} max={lisbonDay(new Date().toISOString())} className={officeInput} /></label>
      <label className={field}>Email<input name="email" type="email" maxLength={254} autoComplete="email" className={officeInput} /></label>
      <label className={field}>Telefone<input name="phone" type="tel" maxLength={40} autoComplete="tel" className={officeInput} /></label>
      <label className={field}>Idioma<select name="language" defaultValue="pt" className={officeInput}><option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option></select></label>
      <label className={field + " sm:col-span-2"}>Notas internas<textarea name="internal_notes" rows={3} maxLength={4000} className={officeInput} placeholder="Preferências ou notas úteis sobre o cliente" /></label>
      {document && <fieldset key={document.revision} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
        <legend className="px-2 text-sm font-semibold">Documento de identificação</legend>
        <p className="text-sm text-slate-600">Compara os dados com o documento e completa os campos em falta.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={field}>Tipo *<select name="document_type" required defaultValue={document.reading.document_type || ""} className={officeInput}>
            <option value="">Seleciona</option><option value="passport">Passaporte</option><option value="identity_card">Cartão de Cidadão</option>
          </select></label>
          <label className={field}>Número/ID *<input name="document_number" required maxLength={80} defaultValue={document.reading.document_number} className={officeInput} /></label>
          <label className={field}>Validade *<input name="expires_on" required type="date" defaultValue={document.reading.expires_on} className={officeInput} /></label>
        </div>
        <label className="flex items-start gap-2 text-sm"><input name="reviewed" type="checkbox" required className="mt-1" /> Confirmei os dados da ficha e do documento.</label>
        <button type="button" className={officeSecondary} onClick={() => setDocument(null)}>Retirar documento da ficha</button>
      </fieldset>}
      <div className="flex justify-end sm:col-span-2">
        <button disabled={saving || scanning} className={officeButton}>{saving ? "A guardar…" : document ? "Guardar cliente e documento" : "Guardar cliente"}</button>
      </div>
    </form>
  </section>;
}
