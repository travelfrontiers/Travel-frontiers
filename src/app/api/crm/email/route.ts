import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { crmConfig, CrmError, failure, payload, privateJson, rpc, uuid } from "@/lib/crm-office-api";
import { emailRest, emailScopeFilter, isEmailScope, loadEmailContext, validEmail, type EmailConfig, type EmailContext } from "@/lib/crm-email-context";
import { archiveSentMessage, mailboxSettings, mailBodyLimit, smtpTransport, verifyMailbox, withInbox } from "@/lib/crm-mailbox";
import { baseEmailTemplate, emailAttachmentLabels, emailTemplates, missingEmailFields, type EmailAttachmentRole, type EmailTemplateKey } from "@/lib/crm-email-templates";
import { configuredQuoteDocuments, formatCrmEmail, quoteBodyWithLinks } from "@/lib/crm-email-signature";
import { readBounded } from "@/lib/studio-request";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxUploadBytes = 4 * 1024 * 1024;
const maxAttachmentBytes = 3_800_000;
const roles = Object.keys(emailAttachmentLabels) as EmailAttachmentRole[];
const columns = "id,direction,state,template_key,occurred_at,subject,body,sender,recipient,cc,attachments,archive_state,proposal_version,internet_message_id";

type StoredTemplate = { template_key: EmailTemplateKey; subject: string; body: string };
type EmailRow = {
  id: string; direction: "in" | "out"; state: string; template_key: EmailTemplateKey | null;
  client_id: string | null; lead_id: string | null; proposal_id: string | null; proposal_version: number | null; trip_id: string | null;
  internet_message_id: string; recipient: string; sender: string; subject: string; occurred_at: string;
};

function validTemplate(key: unknown): key is EmailTemplateKey {
  return typeof key === "string" && Object.hasOwn(emailTemplates, key);
}

function verifyText(subject: unknown, body: unknown) {
  if (typeof subject !== "string" || !subject.trim() || subject.length > 240 || /[\r\n\u0000]/.test(subject) ||
      typeof body !== "string" || !body.trim() || body.length > mailBodyLimit || body.includes("\u0000")) {
    throw new CrmError("Revê o assunto e a mensagem.");
  }
  return { subject: subject.trim(), body: body.trim() };
}

async function contextFor(config: EmailConfig, scope: unknown, id: unknown, version: unknown) {
  if (!isEmailScope(scope) || !uuid(id)) throw new CrmError("Ficha inválida.");
  if (version !== undefined && version !== null && (!Number.isInteger(version) || Number(version) < 1)) {
    throw new CrmError("Versão inválida.");
  }
  return loadEmailContext(config, scope, id, Number(version) || undefined);
}

function templateFor(context: EmailContext, key: unknown) {
  if (!validTemplate(key) || !emailTemplates[key].scopes.includes(context.scope)) {
    throw new CrmError("Este modelo não está disponível nesta ficha.");
  }
  return key;
}

function associations(context: EmailContext) {
  return {
    client_id: context.client_id, lead_id: context.lead_id, proposal_id: context.proposal_id,
    proposal_version: context.proposal_version, trip_id: context.trip_id,
  };
}

export async function GET(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const params = request.nextUrl.searchParams;
    const context = await contextFor(config, params.get("scope"), params.get("id"), params.has("version") ? Number(params.get("version")) : undefined);
    const [history, stored] = await Promise.all([
      emailRest<EmailRow[]>(config, "crm_emails", {
        ...emailScopeFilter(context), select: columns, order: "occurred_at.desc,id", limit: "60",
      }),
      emailRest<StoredTemplate[]>(config, "crm_email_templates", {
        language: "eq." + context.language, select: "template_key,subject,body",
      }),
    ]);
    const quoteDocuments = configuredQuoteDocuments();
    const templates = Object.entries(emailTemplates).flatMap(([key, template]) => {
      if (!template.scopes.includes(context.scope) || key === "quote" && (context.currentVersion !== context.proposal_version || context.proposalStatus !== "draft" && context.proposalStatus !== "sent")) return [];
      const edited = stored.find(entry => entry.template_key === key);
      const copy = edited ?? baseEmailTemplate(key as EmailTemplateKey, context.language);
      const linkedQuote = key === "quote" && quoteDocuments;
      return [{ key, label: template.label, required: linkedQuote ? ["quote"] : template.required ?? [], subject: copy.subject,
        body: copy.body }];
    });
    return privateJson({ context, templates, history, quoteDocuments, driveClientId: process.env.GOOGLE_DRIVE_CLIENT_ID || null });
  } catch (error) { return failure(error); }
}

type Attachment = { filename: string; content: Buffer; contentType: string; role: EmailAttachmentRole };
async function attachmentsFrom(form: FormData) {
  let size = 0;
  const attachments: Attachment[] = [];
  for (const role of roles) for (const file of form.getAll("file_" + role)) {
    if (!(file instanceof File) || !file.size) continue;
    size += file.size;
    if (size > maxAttachmentBytes || attachments.length >= 10) throw new CrmError("Os anexos excedem o limite de 3,8 MB no total ou dez ficheiros.", 413);
    const content = Buffer.from(await file.arrayBuffer());
    const pdf = content.subarray(0, 5).toString("ascii") === "%PDF-";
    const jpeg = content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!pdf && (role !== "other" || !jpeg && !png)) throw new CrmError("Os anexos da proposta, FIN e condições de venda têm de ser PDFs válidos.");
    const contentType = pdf ? "application/pdf" : jpeg ? "image/jpeg" : "image/png";
    const filename = file.name.replace(/[\u0000-\u001f/\\]/g, "_").trim().slice(0, 180) || (pdf ? "Documento.pdf" : "Imagem");
    attachments.push({ filename, content, contentType, role });
  }
  return attachments;
}

async function send(config: EmailConfig, request: Request, type: string) {
  let form: FormData;
  try {
    const bytes = await readBounded(request.body, maxUploadBytes);
    form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } }).formData();
  } catch (error) {
    throw new CrmError("Não foi possível ler a mensagem. O pedido tem um limite de 4 MB.", error instanceof RangeError ? 413 : 400);
  }
  if (form.getAll("cc").some(value => String(value).trim()) || form.getAll("bcc").some(value => String(value).trim())) {
    throw new CrmError("O envio de cópias está desativado. Atualiza a página.");
  }
  const id = form.get("operation_id");
  if (!uuid(id)) throw new CrmError("Pedido de envio inválido.");
  const context = await contextFor(config, form.get("scope"), form.get("id"), form.get("version") ? Number(form.get("version")) : undefined);
  const key = templateFor(context, form.get("template"));
  if (context.archived) throw new CrmError("Restaura a ficha antes de enviar.");
  if (!context.recipient) throw new CrmError("Adiciona um email válido à ficha antes de enviar.");
  const recipient = context.recipient;
  const { subject, body } = verifyText(form.get("subject"), form.get("body"));
  if (missingEmailFields(subject + "\n" + body).length) throw new CrmError("Preenche os campos pendentes do modelo antes de enviar.");
  const attachments = await attachmentsFrom(form);
  const quoteDocuments = key === "quote" ? configuredQuoteDocuments() : null;
  const required = quoteDocuments ? ["quote" as const] : emailTemplates[key].required;
  const missing = required?.filter(role => !attachments.some(file => file.role === role));
  if (missing?.length) throw new CrmError("Faltam anexos: " + missing.map(role => emailAttachmentLabels[role]).join(", ") + ".");
  const replyId = form.get("reply_id");
  let reply: EmailRow | undefined;
  if (replyId) {
    if (!uuid(replyId)) throw new CrmError("Resposta inválida.");
    [reply] = await emailRest<EmailRow[]>(config, "crm_emails", {
      ...emailScopeFilter(context), id: "eq." + replyId, select: "id,internet_message_id,sender,recipient,direction,state,proposal_version",
    });
    if (!reply || (reply.direction === "in" ? reply.sender : reply.recipient) !== recipient.toLowerCase() ||
      context.scope === "proposal" && reply.proposal_version !== context.proposal_version) {
      throw new CrmError("O email de referência não pertence a esta versão ou destinatário.");
    }
  }

  const signatureCid = `tf-signature-${id}@travelfrontiers.pt`;
  const message = formatCrmEmail(quoteDocuments ? quoteBodyWithLinks(body, context.language) : body, context.language, quoteDocuments, signatureCid);
  if ([...message.text].length > mailBodyLimit) throw new CrmError("Encurta a mensagem para incluir a assinatura e os links.");
  const signature = await readFile(join(process.cwd(), "public", "email-signature-inline.jpg")).catch(() => {
    throw new CrmError("Não foi possível incluir a assinatura. Tenta novamente.", 503);
  });
  const { user, smtp } = smtpTransport();
  const messageId = `<tf-${id}@${user.split("@").at(-1)}>`;
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, disableFileAccess: true, disableUrlAccess: true });
  const { message: raw } = await composer.sendMail({
    from: { name: "Tiago Ferreira · Travel Frontiers", address: user },
    to: recipient, subject, ...message, messageId,
    ...(reply ? { inReplyTo: reply.internet_message_id, references: [reply.internet_message_id] } : {}),
    attachments: [
      { filename: "assinatura-travel-frontiers.jpg", content: signature, contentType: "image/jpeg",
        contentDisposition: "inline", cid: signatureCid },
      ...attachments.map(({ filename, content, contentType }) => ({ filename, content, contentType })),
    ],
  });

  const started = await rpc<boolean>(config, "crm_begin_email_send", { p_message: {
    ...associations(context), id, template_key: key, internet_message_id: messageId,
    sender: user.toLowerCase(), recipient: recipient.toLowerCase(), subject, body: message.text,
    attachments: attachments.map(({ filename, role }) => ({ filename, role })),
  } });
  if (!started) throw new CrmError("Este envio já foi registado. Atualiza o histórico e confirma o estado no Roundcube.", 409);

  let state: "sent" | "failed" | "uncertain" = "uncertain";
  try {
    const result = await smtp.sendMail({ raw, envelope: { from: user, to: [recipient] } });
    state = result.accepted.some(address => String(address).toLowerCase() === recipient.toLowerCase()) ? "sent" : "uncertain";
  } catch (error) {
    const code = (error as { code?: string }).code;
    state = code === "EAUTH" || code === "EENVELOPE" ? "failed" : "uncertain";
  } finally { smtp.close(); }
  try {
    await rpc(config, "crm_finish_email_send", { p_id: id, p_state: state });
  } catch {
    throw new CrmError("O estado do envio não pôde ser gravado. Confirma no Roundcube antes de tentares outro envio.", 502);
  }
  if (state !== "sent") throw new CrmError(state === "failed"
    ? "O servidor recusou o envio. Confirma a configuração da caixa de correio."
    : "O servidor não confirmou a entrega ao destinatário. Verifica a pasta Enviados no Roundcube antes de repetir.", 502);

  const archived = await archiveSentMessage(raw as Buffer).catch(() => false);
  await emailRest(config, "crm_emails", { id: "eq." + id }, {
    method: "PATCH", body: JSON.stringify({ archive_state: archived ? "saved" : "unavailable" }),
  }).catch(() => {});
  return privateJson({ sent: true, archived, quoteSent: key === "quote" });
}

function sameDossier(message: EmailRow, context: EmailContext) {
  return (context.scope === "proposal" ? message.proposal_id : context.scope === "trip" ? message.trip_id : message.lead_id) === context.id;
}

async function sync(config: EmailConfig, context: EmailContext, selected: unknown) {
  if (!context.recipient) throw new CrmError("Adiciona um email válido à ficha antes de sincronizar.");
  const recipient = context.recipient.toLowerCase();
  const select = "id,direction,state,internet_message_id,client_id,lead_id,proposal_id,proposal_version,trip_id";
  const query = { select, order: "occurred_at.desc,id", limit: "500" };
  const [outbound, inbound] = await Promise.all([
    emailRest<EmailRow[]>(config, "crm_emails", { ...query, direction: "eq.out", recipient: "eq." + recipient }),
    emailRest<EmailRow[]>(config, "crm_emails", { ...query, direction: "eq.in", sender: "eq." + recipient }),
  ]);
  const known = new Map([...outbound, ...inbound].map(message => [message.internet_message_id, message]));
  const selectedKey = typeof selected === "string" && /^inbox:\d+:\d+$/.test(selected) ? selected : null;
  if (selected !== undefined && !selectedKey) throw new CrmError("Mensagem inválida.");
  const to = mailboxSettings().auth.user;
  return withInbox(recipient, async (candidates, read) => {
    const unmatched: { key: string; subject: string; date: string }[] = [];
    let imported = 0;
    let linkedSelection = false;
    for (const message of candidates) {
      if (known.has(message.messageId)) continue;
      const target = message.references.map(reference => known.get(reference)).find(Boolean);
      if (target && !sameDossier(target, context)) continue;
      if (!target && message.key !== selectedKey) {
        if (unmatched.length < 15) unmatched.push({ key: message.key, subject: message.subject, date: message.date });
        continue;
      }
      if (selectedKey ? message.key !== selectedKey : imported >= 8) continue;
      const content = await read(message);
      const links = target ? {
        client_id: target.client_id ?? context.client_id, lead_id: target.lead_id, proposal_id: target.proposal_id,
        proposal_version: target.proposal_version, trip_id: target.trip_id,
      } : associations(context);
      const [created] = await emailRest<EmailRow[]>(config, "crm_emails", { on_conflict: "internet_message_id", select }, {
        method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          ...links, direction: "in", state: "received", internet_message_id: message.messageId,
          mailbox_key: message.key, sender: message.sender, recipient: to.toLowerCase(),
          subject: message.subject, body: content.body, attachments: content.attachments, occurred_at: message.date,
        }),
      });
      if (created) { known.set(message.messageId, created); imported++; }
      if (selectedKey) linkedSelection = true;
    }
    if (selectedKey && !linkedSelection) throw new CrmError("Esta mensagem já foi associada ou deixou de estar disponível.", 409);
    return privateJson({ imported, unmatched });
  });
}

export async function POST(request: NextRequest) {
  try {
    const config = await crmConfig(request);
    const type = request.headers.get("content-type") || "";
    if (type.startsWith("multipart/form-data;")) return await send(config, request, type);
    const data = await payload(request);
    if (data.action === "verify") return privateJson(await verifyMailbox());
    const context = await contextFor(config, data.scope, data.id, data.version);
    if (data.action === "sync" || data.action === "link") return await sync(config, context, data.action === "link" ? data.mailbox_key ?? null : undefined);
    if (data.action === "template") {
      const key = templateFor(context, data.template);
      const { subject, body } = verifyText(data.subject, data.body);
      if (body.length > 16000) throw new CrmError("O modelo excede 16.000 caracteres.");
      await emailRest(config, "crm_email_templates", { on_conflict: "template_key,language" }, {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ template_key: key, language: context.language, subject, body, updated_at: new Date().toISOString() }),
      });
      return privateJson({ saved: true });
    }
    throw new CrmError("Ação inválida.");
  } catch (error) { return failure(error); }
}
