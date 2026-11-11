import { useState } from "react";
import { type DocumentActionProps, useClient } from "sanity";
import { studioFetch } from "../studio-fetch";

export function DeleteLegacyItinerariesAction({ draft, published }: DocumentActionProps) {
    const client = useClient({ apiVersion: "2024-01-18" });
    const [busy, setBusy] = useState(false);
    const document = draft ?? published;
    if (!document?.sourceFile || document.privateSource) return null;

    return {
        label: busy ? "A apagar roteiros antigos…" : "Apagar roteiros antigos e ficheiros",
        tone: "critical" as const,
        disabled: busy,
        onHandle: async () => {
            if (!window.confirm("Apagar definitivamente todos os roteiros antigos e os ficheiros usados apenas por eles?")) return;
            setBusy(true);
            try {
                const response = await studioFetch(client, "/api/itinerary-source?action=delete-legacy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ confirmed: true }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                const retained = result.retainedFiles ? ` Ficheiros partilhados mantidos: ${result.retainedFiles}.` : "";
                alert(`Roteiros apagados: ${result.documents}. Ficheiros apagados: ${result.files}.${retained}`);
                window.location.assign("/admin/structure/roteiro");
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível apagar os roteiros antigos.");
            } finally {
                setBusy(false);
            }
        },
    };
}
