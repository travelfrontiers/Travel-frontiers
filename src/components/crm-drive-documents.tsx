"use client";
import { useEffect, useState } from "react";
import { uploadCrmDriveFile } from "@/lib/crm-drive-upload";
type StoredFile = { id: string; drive_file_id: string; file_name: string; mime_type: string };
type AccessReply = { access_token?: string; expires_in?: number; error?: string };
type GoogleClient = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; hint: string; callback: (reply: AccessReply) => void; error_callback: () => void }) => { requestAccessToken: (options: { prompt: string }) => void } } } };
declare global { interface Window { google?: GoogleClient } }
let accessToken = "", validUntil = 0;
let loader: Promise<void> | null = null;
function loadGoogle() {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (!loader) loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { loader = null; reject(new Error("Não foi possível carregar a ligação Google.")); };
    document.head.appendChild(script);
  });
  return loader;
}
function authorize(clientId: string): Promise<string> {
  if (accessToken && Date.now() < validUntil) return Promise.resolve(accessToken);
  return new Promise((resolve, reject) => {
    if (!window.google) { reject(new Error("A ligação Google ainda não carregou. Tenta novamente.")); return; }
    window.google.accounts.oauth2.initTokenClient({ client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      hint: "tf.travel.frontiers@gmail.com",
      error_callback: () => reject(new Error("A ligação ao Google foi cancelada ou bloqueada pelo navegador.")),
      callback: async (reply) => {
        if (!reply.access_token || reply.error) { reject(new Error("Não foi possível autorizar o Google Drive.")); return; }
        try {
          const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${reply.access_token}` } });
          const identity = await response.json();
          if (!response.ok || identity.email !== "tf.travel.frontiers@gmail.com") throw new Error("Escolhe a conta tf.travel.frontiers@gmail.com para ligar o Drive.");
          accessToken = reply.access_token; validUntil = Date.now() + Math.max(0, Number(reply.expires_in || 3600) - 60) * 1000;
          resolve(accessToken);
        } catch (cause) { reject(cause); }
      },
    }).requestAccessToken({ prompt: "" });
  });
}
async function drive(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch("https://www.googleapis.com/drive/v3/" + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    if (response.status === 401) { accessToken = ""; validUntil = 0; }
    throw new Error(response.status === 403 ? "O Drive não permitiu a operação. Confirma a autorização e o espaço disponível na conta." : "Não foi possível concluir a operação no Google Drive.");
  }
  return response.json();
}
async function folder(token: string, entity: string, name: string, parent?: string) {
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='tfCrmFolder' and value='${entity}' }`;
  const result = await drive(token, "files?" + new URLSearchParams({ q, fields: "files(id)", pageSize: "1" }));
  if (result.files?.[0]) return result.files[0].id as string;
  const created = await drive(token, "files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.slice(0, 200), mimeType: "application/vnd.google-apps.folder", appProperties: { tfCrmFolder: entity }, ...(parent ? { parents: [parent] } : {}) }) });
  return created.id as string;
}
export default function CrmDriveDocuments({ authorizedFetch, tripId, clientId, title, initialFile, onUploaded }: {
  authorizedFetch: (url: string, init?: RequestInit) => Promise<Response>; tripId?: string; clientId?: string; title: string; initialFile?: File | null; onUploaded?: () => void;
}) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [selected, setSelected] = useState<File | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string; mimeType: string } | null>(null);
  useEffect(() => { if (initialFile) setSelected(initialFile); }, [initialFile]);
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    query.set(tripId ? "trip_id" : "client_id", tripId || clientId || "");
    authorizedFetch("/api/crm/drive?" + query).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os documentos.");
      if (cancelled) return;
      setFiles(result.files); setGoogleClientId(result.clientId);
      if (result.clientId) { await loadGoogle(); if (!cancelled) setReady(true); }
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível ligar ao Drive."); });
    return () => { cancelled = true; };
  }, [authorizedFetch, tripId, clientId]);
  async function upload() {
    if ((!selected && !pending) || !googleClientId) return;
    if (selected && (!["application/pdf","image/jpeg","image/png"].includes(selected.type) || selected.size > 20 * 1024 * 1024 || selected.size === 0)) { setError("Escolhe um PDF, JPG ou PNG até 20 MB."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      let uploaded = pending;
      if (!uploaded && selected) {
        const token = await authorize(googleClientId);
        const root = await folder(token, "root", "Travel Frontiers CRM");
        const destination = await folder(token, (tripId ? "trip-" + tripId : "client-" + clientId), (tripId ? "Viagem · " : "Cliente · ") + title, root);
        uploaded = await uploadCrmDriveFile(selected, token, destination);
        setPending(uploaded);
      }
      if (!uploaded) throw new Error("Seleciona um ficheiro.");
      const response = await authorizedFetch("/api/crm/drive", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId || null, client_id: clientId || null, drive_file_id: uploaded.id, file_name: uploaded.name.slice(0,240), mime_type: uploaded.mimeType }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível associar o ficheiro.");
      setFiles((current) => [result.file, ...current]); setPending(null); setSelected(null); setMessage("Ficheiro guardado no Drive e associado à ficha."); onUploaded?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o ficheiro."); }
    finally { setBusy(false); }
  }
  async function unlink(file: StoredFile) {
    if (!window.confirm("Retirar esta ligação da ficha? O ficheiro continua guardado no teu Google Drive.")) return;
    setBusy(true); setError("");
    try {
      const response = await authorizedFetch("/api/crm/drive", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: file.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível retirar a ligação."); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 border-t border-slate-200 pt-4"><h4 className="text-sm font-semibold">Ficheiros no Google Drive</h4>
    <p className="mt-1 text-xs text-slate-500">Pastas organizadas por ficha no teu Drive. A ligação Google é pedida ao guardar; os ficheiros não são partilhados publicamente pelo CRM.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm text-emerald-700">{message}</p>}
    <ul className="mt-3 space-y-2">{files.map((file) => <li key={file.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"><a className="min-w-0 break-all font-medium text-orange-800 underline" href={`https://drive.google.com/file/d/${file.drive_file_id}/view`} target="_blank" rel="noreferrer">{file.file_name}</a><button type="button" disabled={busy} onClick={() => void unlink(file)} className="shrink-0 text-xs text-slate-600 underline">Retirar ligação</button></li>)}</ul>
    {selected && <p className="mt-2 text-xs text-slate-600">Pronto a guardar: {selected.name}</p>}
    {!googleClientId ? <p className="mt-3 text-xs text-amber-800">A ligação ao Google Drive precisa de ser concluída na configuração do CRM.</p> :
      <div className="mt-3 flex flex-wrap items-center gap-2"><label className="min-w-0 flex-1 text-xs font-medium">PDF, JPG ou PNG · até 20 MB<input aria-label="Ficheiro para guardar no Drive" key={files.length} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy || Boolean(pending)} onChange={(event) => setSelected(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label><button type="button" disabled={busy || !ready || (!selected && !pending)} onClick={() => void upload()} className="rounded-full bg-orange-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? "A guardar…" : pending ? "Concluir associação" : "Guardar no Drive"}</button></div>}
  </section>;
}
