import type { SanityClient } from "sanity";

export function studioFetch(client: SanityClient, path: string, init: RequestInit) {
    const { token: configured, projectId } = client.config();
    let token = configured;
    if (!token && projectId) {
        const stored = window.localStorage.getItem(`__studio_auth_token_${projectId}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                token = typeof parsed === "string" ? parsed : parsed?.token;
            } catch { token = stored; }
        }
    }
    if (!token) throw new Error("Atualiza a página e volta a iniciar sessão no Admin.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(path, { ...init, headers, cache: "no-store" });
}
