"use client";

import { useEffect, useState, type FormEvent } from "react";
import { baseEmailTemplate, emailLanguages, emailTemplateKeys, emailTemplates, emailTemplateBodyLimit, missingEmailFields, type EmailLanguage, type EmailTemplateKey } from "@/lib/crm-email-templates";
import { officeButton, officeInput, officeSecondary, type AuthorizedFetch } from "@/lib/crm-office-types";

type TemplateCopy = { key: EmailTemplateKey; subject: string; body: string };
const api = "/api/crm/email/templates";
const sectionLabels = { lead: "Pedidos", proposal: "Propostas", trip: "Viagens" };

export default function CrmEmailTemplateEditor({ authorizedFetch }: { authorizedFetch: AuthorizedFetch }) {
  const [language, setLanguage] = useState<EmailLanguage>("pt");
  const [key, setKey] = useState<EmailTemplateKey>("received");
  const [templates, setTemplates] = useState<TemplateCopy[]>([]);
  const [draft, setDraft] = useState<TemplateCopy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setTemplates([]);
      try {
        const response = await authorizedFetch(api + "?language=" + language, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os modelos.");
        if (!controller.signal.aborted) setTemplates(result.templates);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os modelos.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [authorizedFetch, language]);

  const current = templates.find(template => template.key === key);
  const editing = draft ?? current;
  const changed = Boolean(editing && current && (editing.subject !== current.subject || editing.body !== current.body));
  const fields = editing ? missingEmailFields(editing.subject + "\n" + editing.body) : [];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !changed) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await authorizedFetch(api, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, language }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar o modelo.");
      setTemplates(items => items.map(item => item.key === key ? result.template : item));
      setDraft(null);
      setNotice("Modelo guardado. O novo texto será usado nos próximos rascunhos neste idioma.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o modelo.");
    } finally { setBusy(false); }
  }

  function switchSelection(change: () => void) {
    if (changed && !window.confirm("Descartar as alterações que ainda não guardaste?")) return;
    setDraft(null); setNotice("");
    change();
  }

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
    <div>
      <h2 className="text-xl font-semibold">Modelos de email</h2>
      <p className="mt-1 text-sm text-slate-600">Edita o assunto e o texto reutilizável de cada modelo por idioma.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1 text-sm font-semibold">Modelo
        <select className={officeInput} value={key} disabled={busy} onChange={event => {
          const next = event.currentTarget.value as EmailTemplateKey;
          switchSelection(() => setKey(next));
        }}>
          {emailTemplateKeys.map(item => <option key={item} value={item}>{emailTemplates[item].label}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-semibold">Idioma
        <select className={officeInput} value={language} disabled={busy} onChange={event => {
          const next = event.currentTarget.value as EmailLanguage;
          switchSelection(() => { setLoading(true); setTemplates([]); setLanguage(next); });
        }}>
          {Object.entries(emailLanguages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <p className="text-sm text-slate-600">Disponível em {emailTemplates[key].scopes.map(scope => sectionLabels[scope]).join(" e ")}.</p>
    {loading && <p role="status" className="text-sm">A carregar modelos…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-orange-800">{notice}</p>}
    {editing && !loading && <form onSubmit={save} className="space-y-4">
      <fieldset disabled={busy} className="space-y-3">
        <label className="block space-y-1 text-sm font-semibold">Assunto
          <input required maxLength={240} className={officeInput} value={editing.subject}
            onChange={event => setDraft({ ...editing, subject: event.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-semibold">Mensagem
          <textarea required maxLength={emailTemplateBodyLimit} rows={13} className={officeInput} value={editing.body}
            onChange={event => setDraft({ ...editing, body: event.target.value })} />
        </label>
      </fieldset>
      <p className="text-sm text-slate-600">Os campos entre chavetas, como {"{{cliente}}"}, são preenchidos com os dados da ficha ou completados no rascunho.</p>
      {fields.length > 0 && <p className="break-words text-xs text-slate-600">Campos neste modelo: {fields.map(value => "{{" + value + "}}").join(", ")}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={officeButton} disabled={!changed || busy}>{busy ? "A guardar…" : "Guardar modelo"}</button>
        <button type="button" className={officeSecondary} disabled={busy} onClick={() => {
          setDraft({ key, ...baseEmailTemplate(key, language) }); setNotice("");
        }}>Repor texto original</button>
      </div>
    </form>}
  </section>;
}
