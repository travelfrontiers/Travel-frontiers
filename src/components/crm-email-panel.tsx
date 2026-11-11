"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { emailAttachmentLabels, fillEmailTemplate, missingEmailFields, type EmailAttachmentRole, type EmailScope, type EmailTemplateKey } from "@/lib/crm-email-templates";
import { emailSignatureImage, emailSignatureName, quoteBodyWithLinks, quoteDocumentItems, type QuoteDocumentLinks } from "@/lib/crm-email-signature";
import type { EmailContext } from "@/lib/crm-email-context";
import { officeButton as button, officeInput as input, officeSecondary as secondary, type AuthorizedFetch } from "@/lib/crm-office-types";
import { downloadCrmDrivePdf, loadGoogle } from "@/lib/crm-drive-client";

export type CrmEmailMessage = {
  id: string; direction: "in" | "out"; state: string; occurred_at: string;
  sender: string; recipient: string; cc: string | null; subject: string; body: string;
  attachments: { filename: string }[]; proposal_version: number | null;
};
type Template = { key: EmailTemplateKey; label: string; subject: string; body: string; required: EmailAttachmentRole[] };
type EmailData = { context: EmailContext; templates: Template[]; history: CrmEmailMessage[]; quoteDocuments: QuoteDocumentLinks | null; driveClientId: string | null };
type Candidate = { key: string; subject: string; date: string };
type Draft = { template: Template; subject: string; body: string; operationId: string; reply?: CrmEmailMessage };
const states: Record<string, string> = { sent: "Enviado", received: "Recebido", sending: "Envio pendente de confirmação", uncertain: "Confirma a entrega no Roundcube", failed: "Falhou" };
const languageNames = { pt: "Português", en: "Inglês", fr: "Francês" };
const roles = Object.keys(emailAttachmentLabels) as EmailAttachmentRole[];
const formatDate = (date: string) => new Date(date).toLocaleString("pt-PT");

export default function CrmEmailPanel({ authorizedFetch, scope, id, version, suggestedPdf, onSent, onAcceptReply }: {
  authorizedFetch: AuthorizedFetch; scope: EmailScope; id: string; version?: number; suggestedPdf?: File | null;
  onSent?: (quoteSent: boolean) => Promise<void>; onAcceptReply?: (message: CrmEmailMessage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<EmailData | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [model, setModel] = useState<Template | null>(null);
  const [attachments, setAttachments] = useState<Partial<Record<EmailAttachmentRole, File[]>>>({});
  const [unmatched, setUnmatched] = useState<Candidate[]>([]);
  const [driveReady, setDriveReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const query = new URLSearchParams({ scope, id, ...(version ? { version: String(version) } : {}) });
    const response = await authorizedFetch("/api/crm/email?" + query);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    return result as EmailData;
  }, [authorizedFetch, scope, id, version]);

  useEffect(() => {
    if (!open || data) return;
    void load().catch(cause => setError(cause.message));
  }, [open, data, load]);
  const canDownload = Boolean(data?.driveClientId && data?.context.driveId);
  useEffect(() => {
    if (canDownload) void loadGoogle().then(() => setDriveReady(true), () => setDriveReady(false));
  }, [canDownload]);

  function compose(template: Template, reply?: CrmEmailMessage) {
    if (!data) return;
    setModel(null);
    setError("");
    setDraft({
      template, operationId: crypto.randomUUID(), reply,
      subject: reply ? ( /^re:/i.test(reply.subject) ? reply.subject : "Re: " + reply.subject).slice(0, 240) : fillEmailTemplate(template.subject, data.context.fields),
      body: reply ? "" : fillEmailTemplate(template.key === "quote" && data.quoteDocuments ? quoteBodyWithLinks(template.body, data.context.language) : template.body, data.context.fields),
    });
    setAttachments(template.key === "quote" && suggestedPdf ? { quote: [suggestedPdf] } : {});
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação."); }
    finally { setBusy(false); }
  }
  async function request(body: object | FormData) {
    const isForm = body instanceof FormData;
    const response = await authorizedFetch("/api/crm/email", {
      method: "POST", ...(isForm ? { body } : {
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, id, version, ...body }),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
    return result;
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !data?.context.recipient) return;
    await run(async () => {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        id, scope, version: version ? String(version) : "", template: draft.template.key, operation_id: draft.operationId,
        subject: draft.subject, body: draft.body, reply_id: draft.reply?.id || "",
      })) form.set(key, value);
      for (const role of roles) for (const file of attachments[role] ?? []) form.append("file_" + role, file);
      const result = await request(form).catch(async cause => { await load().catch(() => {}); throw cause; });
      setDraft(null);
      setAttachments({});
      const sentNotice = result.archived ? "Email enviado e guardado na pasta de enviados do Roundcube."
          : "Email enviado. O histórico está no CRM. Não foi possível guardar uma cópia na pasta de enviados do Roundcube.";
      setNotice(sentNotice);
      try { await load(); await onSent?.(result.quoteSent === true); }
      catch { setNotice(sentNotice + " Atualiza a ficha para veres o histórico mais recente."); }
    });
  }
  async function sync(candidate?: Candidate) {
    await run(async () => {
      const result = await request(candidate ? { action: "link", mailbox_key: candidate.key } : { action: "sync" });
      setUnmatched(result.unmatched);
      await load();
      setNotice(result.imported ? `${result.imported} email(s) associado(s) à ficha.` : "Sem novas respostas associadas.");
    });
  }
  const missing = draft ? missingEmailFields(draft.subject + "\n" + draft.body) : [];
  const missingAttachments = draft?.template.required.filter(role => !attachments[role]?.length) ?? [];
  const allFiles = Object.values(attachments).flat();
  const oversized = allFiles.length > 10 || allFiles.reduce((sum, file) => sum + file.size, 0) > 3_800_000;

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <button type="button" aria-expanded={open} className="w-full text-left font-semibold text-slate-900" onClick={() => setOpen(!open)}>
      Email e modelos <span aria-hidden="true" className="float-right">{open ? "−" : "+"}</span>
    </button>
    {open && <>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm font-medium text-slate-700">{notice}</p>}
      {!data && (error ? <button type="button" className={secondary} onClick={() => void run(async () => { await load(); })}>Tentar novamente</button> : <p role="status" className="text-sm">A carregar emails…</p>)}
      {data && <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grow text-sm">Modelo em {languageNames[data.context.language]}
            <select className={input} value={draft?.template.key || ""} disabled={busy} onChange={event => {
              const template = data.templates.find(item => item.key === event.target.value);
              if (template && (!draft || window.confirm("Substituir o rascunho atual pelo novo modelo?"))) compose(template);
            }}>
              <option value="" disabled>Escolhe um modelo</option>
              {data.templates.map(template => <option key={template.key} value={template.key}>{template.label}</option>)}
            </select>
          </label>
          <button type="button" className={secondary} disabled={busy || !data.context.recipient} onClick={() => void sync()}>Sincronizar respostas</button>
        </div>
        <button type="button" className="text-xs text-slate-600 underline" disabled={busy} onClick={() => void run(async () => {
          const { smtp, imap } = await request({ action: "verify" });
          setNotice(`Envio SMTP: ${smtp ? "ligado" : "indisponível"}. Receção IMAP: ${imap ? "ligada" : "indisponível"}.`);
        })}>Verificar ligação ao Roundcube</button>
        {!data.context.recipient && <p className="text-sm text-slate-600">Adiciona um email válido à ficha para enviar ou sincronizar.</p>}
        {draft && !model && <form className="space-y-3" onSubmit={send}>
          <p className="text-sm"><strong>Para</strong> {data.context.recipient || "Email em falta"}{draft.reply && <> · Em resposta a «{draft.reply.subject}»</>}</p>
          <label className="block text-sm">Assunto<input required maxLength={240} className={input} value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} /></label>
          <label className="block text-sm">Mensagem<textarea required maxLength={16000} rows={12} className={input} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Assinatura</p>
            {/* The same remote image is used by email clients. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emailSignatureImage} alt={emailSignatureName} width={600} className="h-auto max-w-full" />
            {draft.template.key === "quote" && quoteDocumentItems(data.context.language, data.quoteDocuments).map(({ label, url }) =>
              <a className="block text-sm underline" key={url} href={url} target="_blank" rel="noreferrer">{label}</a>)}
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Anexos · até 3,8 MB no total</legend>
            {roles.filter(role => role === "other" || draft.template.required.includes(role)).map(role => <div key={role}>
              <label className="block text-sm">{emailAttachmentLabels[role]}{draft.template.required.includes(role) ? " *" : ""}
                <input type="file" accept={role === "other" ? ".pdf,.jpg,.jpeg,.png" : ".pdf"} multiple={role === "other"} disabled={busy} className={input}
                  onChange={event => setAttachments(current => ({ ...current, [role]: Array.from(event.target.files || []) }))} />
              </label>
              {attachments[role]?.length ? <p className="break-all text-xs">{attachments[role]?.map(file => file.name).join(", ")} <button type="button" className="underline" onClick={() => setAttachments(current => ({ ...current, [role]: [] }))}>Retirar</button></p> : null}
              {role === "quote" && canDownload && <button type="button" className="text-sm underline" disabled={!driveReady || busy} onClick={() => void run(async () => {
                const file = await downloadCrmDrivePdf(data.driveClientId!, data.context.driveId!, data.context.driveFileName || "Proposta.pdf");
                setAttachments(current => ({ ...current, quote: [file] }));
              })}>Usar PDF associado no Drive</button>}
            </div>)}
          </fieldset>
          {missing.length > 0 && <p className="text-sm text-orange-800">Completa no texto os campos assinalados: {missing.map(field => field.replaceAll("_", " ")).join(", ")}.</p>}
          {oversized && <p className="text-sm text-red-700">O limite é de 10 ficheiros e 3,8 MB no total.</p>}
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || oversized || data.context.archived || !data.context.recipient || Boolean(missing.length || missingAttachments.length)}>Enviar email</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => setModel(draft.template)}>Editar modelo</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => setDraft(null)}>Fechar rascunho</button>
          </div>
        </form>}
        {model && <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            await request({ action: "template", template: model.key, subject: model.subject, body: model.body });
            const refreshed = await load();
            const saved = refreshed.templates.find(template => template.key === model.key);
            if (saved) {
              const reply = draft?.reply;
              const draftFiles = attachments;
              compose(saved, reply);
              setAttachments(draftFiles);
            }
            setNotice("Modelo guardado para futuras mensagens neste idioma.");
          });
        }}>
          <p className="text-sm">Edita o texto reutilizável. Os campos entre chavetas são preenchidos a partir da ficha.</p>
          <label className="block text-sm">Assunto do modelo<input required maxLength={240} className={input} value={model.subject} onChange={event => setModel({ ...model, subject: event.target.value })} /></label>
          <label className="block text-sm">Texto do modelo<textarea required maxLength={16000} rows={12} className={input} value={model.body} onChange={event => setModel({ ...model, body: event.target.value })} /></label>
          <button className={button} disabled={busy}>Guardar e aplicar modelo</button>{" "}
          <button type="button" className={secondary} disabled={busy} onClick={() => setModel(null)}>Voltar ao rascunho</button>
        </form>}
        {unmatched.length > 0 && <div className="space-y-2 text-sm"><h4 className="font-semibold">Mensagens do cliente por associar</h4>
          {unmatched.map(candidate => <div key={candidate.key} className="flex flex-wrap items-center justify-between gap-2"><span>{candidate.subject} · {formatDate(candidate.date)}</span>
            <button type="button" className={secondary} disabled={busy} onClick={() => void sync(candidate)}>Associar a esta ficha</button>
          </div>)}</div>}
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <h4 className="text-sm font-semibold">Histórico de email</h4>
          {data.history.length === 0 && <p className="text-sm text-slate-500">Ainda sem mensagens associadas.</p>}
          {data.history.map(message => <details key={message.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <summary className="cursor-pointer break-words"><strong>{message.subject}</strong> · {states[message.state]} · {formatDate(message.occurred_at)}{message.proposal_version ? " · v" + message.proposal_version : ""}</summary>
            <p className="mt-2 break-all text-xs text-slate-600">{message.sender} → {message.recipient}{message.cc ? " · CC " + message.cc : ""}</p>
            <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words">{message.body}</p>
            {!!message.attachments.length && <p className="mt-2 break-all text-xs">Anexos: {message.attachments.map(file => file.filename).join(", ")}</p>}
            {message.direction === "in" && (scope !== "proposal" || message.proposal_version === version) && <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={busy || Boolean(draft) || !data.context.recipient} onClick={() => {
                const template = data.templates.find(item => !item.required.length);
                if (template) compose(template, message);
              }}>Responder</button>
              {onAcceptReply && <button type="button" className={secondary} disabled={busy} onClick={() => onAcceptReply(message)}>Preparar registo de aceitação</button>}
            </div>}
          </details>)}
        </div>
      </>}
    </>}
  </section>;
}
