"use client";

import { useState, type FormEvent } from "react";
import { isManualLeadSource, manualLeadSources } from "@/lib/crm-manual-lead";
import { officeButton, officeInput, officeSecondary, type AuthorizedFetch, type OfficeClient } from "@/lib/crm-office-types";

export type LeadDetails = {
  id: string; source: string; client_id: string | null; full_name: string; email: string | null;
  phone: string | null; language: string; destination: string | null; departure_date: string | null;
  return_date: string | null; date_flexible: boolean; travel_period: string | null; adults: number;
  children_ages: number[]; budget: string | null; notes: string | null; follow_up_date: string | null;
};

const field = "block space-y-1 text-sm font-semibold";

export default function CrmManualLeadForm<T extends LeadDetails>({ clients, existing, authorizedFetch, onSaved, onCancel }: {
  clients: OfficeClient[]; existing?: T; authorizedFetch: AuthorizedFetch; onSaved: (lead: T) => void; onCancel: () => void;
}) {
  const [contact, setContact] = useState({
    full_name: existing?.full_name ?? "", email: existing?.email ?? "", phone: existing?.phone ?? "", language: existing?.language ?? "pt",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const ages = String(data.children_ages).trim();
    const children_ages = ages ? ages.split(/[;,\s]+/).map(Number) : [];
    setError("");
    setBusy(true);
    try {
      const response = await authorizedFetch("/api/crm/leads" + (existing ? "/" + existing.id : ""), {
        method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data, action: existing ? "edit_details" : undefined, adults: Number(data.adults), children_ages, date_flexible: data.date_flexible === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.lead?.id) throw new Error(result.error || "Não foi possível guardar o pedido.");
      onSaved(result.lead);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o pedido.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={save} className="mb-5 space-y-4 rounded-xl border border-orange-100 bg-white p-4">
    <h3 className="font-semibold">{existing ? "Editar dados do pedido" : "Novo pedido"}</h3>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      <label className={field}>Cliente existente
        <select name="client_id" disabled={Boolean(existing)} defaultValue={existing?.client_id ?? ""} className={officeInput} onChange={event => {
          const client = clients.find(item => item.id === event.currentTarget.value);
          if (client) setContact({ full_name: client.full_name, email: client.email ?? "", phone: client.phone ?? "", language: client.language });
        }}>
          <option value="">Sem ficha associada</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.full_name}{client.email || client.phone ? " · " + (client.email || client.phone) : ""}</option>)}
        </select>
      </label>
      <label className={field}>Origem
        <select name="source" defaultValue={isManualLeadSource(existing?.source) ? existing.source : "whatsapp"} className={officeInput}>
          {Object.entries(manualLeadSources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className={field}>Nome *
        <input name="full_name" required minLength={2} maxLength={160} className={officeInput} value={contact.full_name}
          onChange={e => setContact({ ...contact, full_name: e.target.value })} />
      </label>
      <label className={field}>Telefone
        <input name="phone" type="tel" maxLength={40} className={officeInput} value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} />
      </label>
      <label className={field}>Email
        <input name="email" type="email" maxLength={254} className={officeInput} value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} />
      </label>
      <label className={field}>Idioma
        <select name="language" className={officeInput} value={contact.language} onChange={e => setContact({ ...contact, language: e.target.value })}>
          <option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option>
        </select>
      </label>
      <label className={field}>Destino<input name="destination" maxLength={240} defaultValue={existing?.destination ?? ""} className={officeInput} /></label>
      <label className={field}>Período aproximado<input name="travel_period" minLength={3} maxLength={120} defaultValue={existing?.travel_period ?? ""} className={officeInput} /></label>
      <label className={field}>Partida<input name="departure_date" type="date" defaultValue={existing?.departure_date ?? ""} className={officeInput} /></label>
      <label className={field}>Regresso<input name="return_date" type="date" defaultValue={existing?.return_date ?? ""} className={officeInput} /></label>
      <label className="flex items-center gap-2 text-sm"><input name="date_flexible" type="checkbox" defaultChecked={existing?.date_flexible} className="size-4 appearance-auto" /> Datas flexíveis</label>
      <label className={field}>Orçamento por pessoa<input name="budget" maxLength={120} defaultValue={existing?.budget ?? ""} className={officeInput} /></label>
      <label className={field}>Adultos<input name="adults" type="number" required min={1} max={20} defaultValue={existing?.adults ?? 1} className={officeInput} /></label>
      <label className={field}>Idades das crianças<input name="children_ages" maxLength={75} placeholder="Ex.: 4, 8" defaultValue={existing?.children_ages.join(", ")} className={officeInput} /></label>
      <label className={field}>Próximo contacto<input name="follow_up_date" type="date" defaultValue={existing?.follow_up_date ?? ""} className={officeInput} /></label>
      <label className={field + " sm:col-span-2"}>Detalhes do pedido<textarea name="notes" rows={3} maxLength={4000} defaultValue={existing?.notes ?? ""} className={officeInput} /></label>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button className={officeButton} disabled={busy}>{busy ? "A guardar…" : "Guardar pedido"}</button>
      <button className={officeSecondary} type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
    </div>
  </form>;
}
