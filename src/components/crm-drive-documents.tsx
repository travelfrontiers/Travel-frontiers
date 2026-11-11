"use client";
import { useEffect, useRef, useState } from "react";
import { chooseDriveFiles, driveDocumentTypes, type DrivePickerConfig } from "@/lib/crm-drive-picker";
import { officeSecondary } from "@/lib/crm-office-types";
import { authorizeDrive, drive, loadGoogle } from "@/lib/crm-drive-client";
import { uploadCrmDriveFile } from "@/lib/crm-drive-upload";
type StoredFile = { id: string; drive_file_id: string; file_name: string; mime_type: string };
type DriveSelection = { id: string; name: string; mimeType: string; source: "upload" | "picker" };
async function folder(token: string, entity: string, name: string, parent?: string) {
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='tfCrmFolder' and value='${entity}' }`;
  const result = await drive(token, "files?" + new URLSearchParams({ q, fields: "files(id)", pageSize: "1" }));
  if (result.files?.[0]) return result.files[0].id as string;
  const created = await drive(token, "files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.slice(0, 200), mimeType: "application/vnd.google-apps.folder", appProperties: { tfCrmFolder: entity }, ...(parent ? { parents: [parent] } : {}) }) });
  return created.id as string;
}
export default function CrmDriveDocuments({ authorizedFetch, tripId, clientId, title, initialFile, onUploaded }: {
  authorizedFetch: (url: string, init?: RequestInit) => Promise<Response>; tripId?: string; clientId?: string; title: string; initialFile?: File | null; onUploaded?: (file: StoredFile) => void;
}) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picker, setPicker] = useState<DrivePickerConfig | null>(null);
  const pickerRequest = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [selected, setSelected] = useState<File | null>(null);
  const [pending, setPending] = useState<DriveSelection | null>(null);
  useEffect(() => { if (initialFile) setSelected(initialFile); }, [initialFile]);
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    query.set(tripId ? "trip_id" : "client_id", tripId || clientId || "");
    authorizedFetch("/api/crm/drive?" + query).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os documentos.");
      if (cancelled) return;
      setFiles(result.files); setGoogleClientId(result.clientId); setPicker(result.picker || null);
      if (result.clientId) { await loadGoogle(); if (!cancelled) setReady(true); }
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível ligar ao Drive."); });
    return () => { cancelled = true; pickerRequest.current?.abort(); };
  }, [authorizedFetch, tripId, clientId]);
  async function associate(file: DriveSelection) {
    setPending(file);
    const existing = files.find(item => item.drive_file_id === file.id);
    let saved = existing;
    if (!saved) {
      const response = await authorizedFetch("/api/crm/drive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId || null, client_id: clientId || null, drive_file_id: file.id,
          file_name: file.name.slice(0, 240), mime_type: file.mimeType }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível associar o ficheiro.");
      const linkedFile = result.file as StoredFile;
      saved = linkedFile;
      setFiles(current => [linkedFile, ...current.filter(item => item.id !== linkedFile.id)]);
    }
    setPending(null);
    if (file.source === "upload") setSelected(null);
    setMessage(existing ? "Este ficheiro já está nesta ficha." : file.source === "picker" ? "Ficheiro do Drive associado à ficha." : "Ficheiro guardado no Drive e associado à ficha.");
    onUploaded?.(saved);
  }

  async function upload() {
    if ((!selected && !pending) || !googleClientId) return;
    if (!pending && selected && (!driveDocumentTypes.includes(selected.type) || selected.size > 20 * 1024 * 1024 || selected.size === 0)) {
      setError("Escolhe um PDF, JPG ou PNG até 20 MB."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      if (pending) await associate(pending);
      else if (selected) {
        const token = await authorizeDrive(googleClientId);
        const root = await folder(token, "root", "Travel Frontiers CRM");
        const destination = await folder(token, (tripId ? "trip-" + tripId : "client-" + clientId), (tripId ? "Viagem · " : "Cliente · ") + title, root);
        const uploaded = await uploadCrmDriveFile(selected, token, destination);
        await associate({ ...uploaded, source: "upload" });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar o ficheiro."); }
    finally { setBusy(false); }
  }

  async function pick() {
    if (!picker || !googleClientId || pickerRequest.current) return;
    const request = new AbortController();
    pickerRequest.current = request;
    setPicking(true);
    setBusy(true); setError(""); setMessage("");
    try {
      const selectedFile = await chooseDriveFiles(picker, authorizeDrive(googleClientId, request.signal), request.signal);
      if (!selectedFile) return;
      const result = await drive(selectedFile.token, "files/" + encodeURIComponent(selectedFile.ids[0]) +
        "?supportsAllDrives=true&fields=id,name,mimeType,trashed", { signal: request.signal });
      if (request.signal.aborted) return;
      if (result.trashed || typeof result.name !== "string" || !result.name.trim() || !driveDocumentTypes.includes(result.mimeType)) {
        throw new Error("Escolhe um PDF, JPG ou PNG disponível no Drive.");
      }
      setPicking(false);
      await associate({ id: selectedFile.ids[0], name: result.name, mimeType: result.mimeType, source: "picker" });
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível escolher o ficheiro do Drive.");
    } finally {
      pickerRequest.current = null;
      setPicking(false);
      setBusy(false);
    }
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
    <p className="mt-1 text-xs text-slate-500">Pastas organizadas por ficha no teu Drive. Escolhe um ficheiro já no Drive ou envia um novo do teu dispositivo.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm text-emerald-700">{message}</p>}
    <ul className="mt-3 space-y-2">{files.map((file) => <li key={file.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"><a className="min-w-0 break-all font-medium text-orange-800 underline" href={`https://drive.google.com/file/d/${file.drive_file_id}/view`} target="_blank" rel="noreferrer">{file.file_name}</a><button type="button" disabled={busy} onClick={() => void unlink(file)} className="shrink-0 text-xs text-slate-600 underline">Retirar ligação</button></li>)}</ul>
    {picker && <button type="button" className={"mt-3 " + officeSecondary} disabled={!ready || busy || Boolean(pending)} onClick={() => void pick()}>Escolher do Google Drive</button>}
    {picking && <button type="button" className={"ml-2 mt-3 " + officeSecondary} onClick={() => pickerRequest.current?.abort()}>Cancelar seleção</button>}
    {pending && <p className="mt-2 text-xs text-slate-600">Por associar: {pending.name} <button type="button" disabled={busy} className="underline" onClick={() => { setPending(null); setError(""); }}>Cancelar associação</button></p>}
    {selected && <p className="mt-2 text-xs text-slate-600">Pronto a guardar: {selected.name}</p>}
    {!googleClientId ? <p className="mt-3 text-xs text-amber-800">A ligação ao Google Drive precisa de ser concluída na configuração do CRM.</p> :
      <div className="mt-3 flex flex-wrap items-center gap-2"><label className="min-w-0 flex-1 text-xs font-medium">PDF, JPG ou PNG · até 20 MB<input aria-label="Ficheiro para guardar no Drive" key={files.length} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy || Boolean(pending)} onChange={(event) => setSelected(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label><button type="button" disabled={busy || !ready || (!selected && !pending)} onClick={() => void upload()} className="rounded-full bg-orange-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? "A guardar…" : pending ? "Concluir associação" : "Guardar no Drive"}</button></div>}
  </section>;
}
