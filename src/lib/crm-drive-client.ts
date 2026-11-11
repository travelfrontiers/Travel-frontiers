type AccessReply = { access_token?: string; expires_in?: number; error?: string };
type GoogleClient = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; hint: string; callback: (reply: AccessReply) => void; error_callback: () => void }) => { requestAccessToken: (options: { prompt: string }) => void } } } };
declare global { interface Window { google?: GoogleClient } }
let accessToken = "", validUntil = 0;
let loader: Promise<void> | null = null;
export function loadGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!loader) loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { loader = null; reject(new Error("Não foi possível carregar a ligação Google.")); };
    document.head.appendChild(script);
  });
  return loader;
}
export function authorizeDrive(clientId: string, signal?: AbortSignal): Promise<string> {
  if (accessToken && Date.now() < validUntil) return Promise.resolve(accessToken);
  return new Promise((resolve, reject) => {
    if (!window.google) { reject(new Error("A ligação Google ainda não carregou. Tenta novamente.")); return; }
    if (signal?.aborted) { reject(new DOMException("Autorização cancelada.", "AbortError")); return; }
    let finished = false;
    const finish = (error?: unknown, token?: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (token) resolve(token);
      else reject(error);
    };
    const abort = () => finish(new DOMException("Autorização cancelada.", "AbortError"));
    const timer = window.setTimeout(() => finish(new Error("A autorização Google ficou pendente. Permite a janela da Google e tenta novamente.")), 60_000);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
        hint: "tf.travel.frontiers@gmail.com",
        error_callback: () => finish(new Error("A ligação ao Google foi cancelada ou bloqueada pelo navegador.")),
        callback: async (reply) => {
          if (finished) return;
          if (!reply.access_token || reply.error) { finish(new Error("Não foi possível autorizar o Google Drive.")); return; }
          try {
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${reply.access_token}` }, signal,
            });
            const identity = await response.json();
            if (finished) return;
            if (!response.ok || identity.email !== "tf.travel.frontiers@gmail.com") throw new Error("Escolhe a conta tf.travel.frontiers@gmail.com para ligar o Drive.");
            accessToken = reply.access_token;
            validUntil = Date.now() + Math.max(0, Number(reply.expires_in || 3600) - 60) * 1000;
            finish(undefined, accessToken);
          } catch (error) { finish(error); }
        },
      }).requestAccessToken({ prompt: "" });
    } catch (error) { finish(error); }
  });
}
export async function drive(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch("https://www.googleapis.com/drive/v3/" + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    if (response.status === 401) { accessToken = ""; validUntil = 0; }
    throw new Error(response.status === 403 ? "O Drive não permitiu a operação. Confirma a autorização e o espaço disponível na conta." : "Não foi possível concluir a operação no Google Drive.");
  }
  return response.json();
}
export async function downloadCrmDrivePdf(clientId: string, fileId: string, name: string) {
  const token = await authorizeDrive(clientId);
  const file = await drive(token, "files/" + encodeURIComponent(fileId) + "?fields=size,mimeType");
  if (file.mimeType !== "application/pdf" || Number(file.size) > 3_800_000) throw new Error("Escolhe um PDF até 3,8 MB.");
  const response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media", {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível obter o PDF do Drive.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 3_800_000) throw new Error("Escolhe um PDF até 3,8 MB.");
  return new File([blob], name, { type: "application/pdf" });
}

export async function downloadDriveFile(token: string, id: string, allowedTypes: string[], maxBytes: number, signal: AbortSignal) {
  const path = "files/" + encodeURIComponent(id);
  const { name, mimeType, size, trashed } = await drive(token, path + "?supportsAllDrives=true&fields=name,mimeType,size,trashed", { signal });
  if (trashed || typeof name !== "string" || !name.trim() || !allowedTypes.includes(mimeType)) {
    throw new Error("Escolhe um PDF ou uma fotografia disponível no Drive.");
  }
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > maxBytes) {
    throw new Error("Cada ficheiro do Drive deve ter até 15 MB.");
  }
  const response = await fetch("https://www.googleapis.com/drive/v3/" + path + "?alt=media&supportsAllDrives=true", {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
  });
  if (!response.ok || !response.body) throw new Error("Não foi possível ler o ficheiro selecionado no Drive.");
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error("Cada ficheiro do Drive deve ter até 15 MB.");
      }
      chunks.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new Error("O ficheiro selecionado no Drive está vazio.");
  return new File(chunks, name, { type: mimeType });
}
