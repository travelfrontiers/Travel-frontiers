export type UploadedCrmDriveFile = { id: string; name: string; mimeType: string };
export async function uploadCrmDriveFile(file: File, token: string, parentId: string, send: typeof fetch = fetch): Promise<UploadedCrmDriveFile> {
  const initial = await send("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type, "X-Upload-Content-Length": String(file.size) },
    body: JSON.stringify({ name: file.name, parents: [parentId] }),
  });
  if (!initial.ok) throw new Error("Não foi possível iniciar o envio ao Drive. Confirma a autorização Google e o espaço disponível.");
  const location = initial.headers.get("Location");
  if (!location) throw new Error("O Drive não devolveu uma sessão de envio.");
  const session = new URL(location);
  if (session.origin !== "https://www.googleapis.com" || !session.pathname.startsWith("/upload/drive/")) throw new Error("O Drive devolveu um destino de envio inesperado.");
  const response = await send(session.toString(), { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: file });
  if (!response.ok) throw new Error("Não foi possível guardar o ficheiro no Drive. Confirma o espaço disponível e a ligação Google.");
  const result = await response.json() as Partial<UploadedCrmDriveFile>;
  if (typeof result.id !== "string" || typeof result.name !== "string" || typeof result.mimeType !== "string") throw new Error("A resposta do Drive está incompleta.");
  return result as UploadedCrmDriveFile;
}
