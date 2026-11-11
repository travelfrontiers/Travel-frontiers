import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { CrmError } from "./crm-office-api";
import { validEmail } from "./crm-email-context";

export const mailBodyLimit = 24000;
const maxIncomingBytes = 5 * 1024 * 1024;
const scanDays = 45;
const scanCount = 80;

export function mailboxSettings() {
  const host = process.env.CRM_IMAP_HOST || process.env.CRM_SMTP_HOST;
  const user = process.env.CRM_IMAP_USER || process.env.CRM_SMTP_USER;
  const pass = process.env.CRM_IMAP_PASSWORD || process.env.CRM_SMTP_PASSWORD;
  const port = Number(process.env.CRM_IMAP_PORT || 993);
  if (!host || !user || !pass || !Number.isInteger(port)) throw new CrmError("A ligação IMAP ainda não está configurada.", 503);
  return { host, port, secure: true, auth: { user, pass }, logger: false as const, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 12000, disableAutoIdle: true };
}

export function smtpTransport() {
  const { CRM_SMTP_HOST: host, CRM_SMTP_USER: user, CRM_SMTP_PASSWORD: pass, CRM_SMTP_PORT, CRM_SMTP_SECURE } = process.env;
  if (!host || !validEmail(user) || !pass) throw new CrmError("O envio por email ainda não está configurado.", 503);
  return { user, smtp: nodemailer.createTransport({
    host, port: Number(CRM_SMTP_PORT || 465), secure: CRM_SMTP_SECURE !== "false", requireTLS: true,
    auth: { user, pass }, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 12000,
    disableFileAccess: true, disableUrlAccess: true,
  }) };
}

async function withMailbox<T>(operation: (imap: ImapFlow) => Promise<T>) {
  const imap = new ImapFlow(mailboxSettings());
  imap.on("error", () => {});
  try {
    await imap.connect();
    return await operation(imap);
  } catch (error) {
    if (error instanceof CrmError) throw error;
    throw new CrmError("Não foi possível ligar ou consultar a caixa de correio IMAP.", 502);
  } finally { imap.close(); }
}

export async function verifyMailbox() {
  const smtpReady = async () => {
    const { smtp } = smtpTransport();
    try { return await smtp.verify(); }
    finally { smtp.close(); }
  };
  const [smtp, imap] = await Promise.allSettled([
    smtpReady(),
    withMailbox(async connection => {
      await connection.mailboxOpen("INBOX", { readOnly: true });
      return true;
    }),
  ]);
  return { smtp: smtp.status === "fulfilled" && smtp.value, imap: imap.status === "fulfilled" && imap.value };
}

export async function archiveSentMessage(raw: Buffer) {
  return withMailbox(async imap => {
    const folders = await imap.list();
    const folder = folders.find(entry => entry.specialUse === "\\Sent") ??
      folders.find(entry => ["sent", "sent items", "enviados", "inbox.sent"].includes(entry.path.toLowerCase()));
    if (!folder) return false;
    return Boolean(await imap.append(folder.path, raw, ["\\Seen"]));
  });
}

export function normalizeMessageId(value: string | undefined) {
  const id = value?.trim().match(/^<?([^<>\s]{1,470})>?$/)?.[1];
  return id ? "<" + id + ">" : null;
}

export function replyReferences(headers: Buffer | undefined, inReplyTo?: string) {
  const normalized = (headers?.toString("utf8") || "").replace(/\r?\n[ \t]+/g, " ");
  const refs = normalized.match(/^references:\s*([^\r\n]+)/im)?.[1].match(/<[^<>\s]+>/g) || [];
  return [...new Set([normalizeMessageId(inReplyTo), ...refs.reverse().map(normalizeMessageId)].filter((value): value is string => Boolean(value)))].slice(0, 30);
}

export type MailCandidate = {
  uid: number; validity: string; key: string; messageId: string; sender: string;
  subject: string; date: string; references: string[]; size: number;
};

function envelope(message: FetchMessageObject, validity: string, customer: string): MailCandidate | null {
  const from = message.envelope?.from;
  const sender = from?.length === 1 ? from[0]?.address?.toLowerCase() : null;
  if (!sender || sender !== customer.toLowerCase()) return null;
  const key = "inbox:" + validity + ":" + message.uid;
  const date = message.envelope?.date || message.internalDate;
  const size = message.size ?? 0;
  return {
    uid: message.uid, validity, key, sender, size,
    messageId: normalizeMessageId(message.envelope?.messageId) || "<" + key + "@travel-frontiers.local>",
    subject: (message.envelope?.subject || "(Sem assunto)").replace(/[\r\n]+/g, " ").slice(0, 240),
    date: (date instanceof Date && Number.isFinite(date.valueOf()) ? date : new Date()).toISOString(),
    references: replyReferences(message.headers, message.envelope?.inReplyTo),
  };
}

const envelopeQuery = { envelope: true, internalDate: true, size: true, headers: ["references"] };

export async function withInbox<T>(customer: string, operation: (candidates: MailCandidate[], read: (candidate: MailCandidate) => Promise<{ body: string; attachments: { filename: string }[] }>) => Promise<T>) {
  return withMailbox(async imap => {
    const mailbox = await imap.mailboxOpen("INBOX", { readOnly: true });
    const validity = String(mailbox.uidValidity);
    const since = new Date(Date.now() - scanDays * 24 * 60 * 60 * 1000);
    const found = await imap.search({ from: customer, since }, { uid: true });
    const ids = Array.isArray(found) ? found.slice(-scanCount) : [];
    const messages = ids.length ? await imap.fetchAll(ids, envelopeQuery, { uid: true }) : [];
    const candidates = messages.flatMap(message => envelope(message, validity, customer) || []).reverse();
    return operation(candidates, async candidate => {
      if (!candidate.size || candidate.size > maxIncomingBytes) return {
        body: "Mensagem demasiado grande para copiar para o CRM. Consulta-a no Roundcube.", attachments: [],
      };
      const message = await imap.fetchOne(candidate.uid, { source: { start: 0, maxLength: maxIncomingBytes }, size: true }, { uid: true });
      if (!message || !message.source || message.size !== candidate.size || message.source.length > maxIncomingBytes) {
        throw new CrmError("A mensagem já não está disponível. Atualiza a caixa de correio.", 409);
      }
      const parsed = await simpleParser(message.source, { skipHtmlToText: false, skipTextToHtml: true, skipImageLinks: true });
      const body = (parsed.text?.trim() || "(Mensagem sem texto)").replace(/\u0000/g, "").slice(0, mailBodyLimit);
      return { body, attachments: parsed.attachments.slice(0, 20).map(attachment => ({
        filename: (attachment.filename || "Anexo").replace(/[\u0000-\u001f]/g, "").slice(0, 180),
      })) };
    });
  });
}
