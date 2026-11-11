import { type DocumentActionProps, useClient } from "sanity";
import { useState } from "react";
import { studioFetch } from "../studio-fetch";

export function GenerateItineraryAction({ type, published, draft, onComplete }: DocumentActionProps) {
    const [busy, setBusy] = useState(false);
    const client = useClient({ apiVersion: "2024-01-18" });
    const doc = draft ?? published;
    if (type !== "roteiro" || !doc) return null;

    return {
        label: busy ? "A gerar roteiro…" : "Gerar roteiro com IA",
        disabled: busy || !doc.privateSource,
        dialog: busy ? {
            type: "dialog" as const,
            header: "A gerar roteiro",
            content: <p role="status" className="p-4">A preparar o documento. Pode demorar até um minuto.</p>,
            onClose: () => {},
        } : null,
        onHandle: async () => {
            setBusy(true);
            try {
                const response = await studioFetch(client, "/api/generate-itinerary", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: doc.privateSource, title: doc.title, notes: doc.notes ?? "" }),
                });
                if (!response.ok) {
                    const result = await response.json().catch(() => ({}));
                    throw new Error(result.error || "Não foi possível gerar o roteiro.");
                }
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url;
                link.download = `Itinerario_${String(doc.title ?? "viagem").replace(/[^\\p{L}\\p{N} _-]/gu, "").slice(0, 80)}.docx`;
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                onComplete();
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível gerar o roteiro.");
            } finally {
                setBusy(false);
            }
        },
    };
}
