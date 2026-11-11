import { useState } from "react";
import { Archive } from "lucide-react";
import { type DocumentActionProps, useClient } from "sanity";
import { studioFetch } from "../studio-fetch";

export function ArchiveAction({ id, draft, published, onComplete }: DocumentActionProps) {
    const [busy, setBusy] = useState(false);
    const client = useClient({ apiVersion: "2024-01-18" });
    const document = draft ?? published;
    if (document?.language !== "pt" || document.status === "archived") return null;

    return {
        label: busy ? "A arquivar…" : "Arquivar promoção",
        icon: Archive,
        disabled: busy,
        onHandle: async () => {
            if (!window.confirm("Arquivar a promoção e as traduções disponíveis?")) return;
            setBusy(true);
            try {
                const response = await studioFetch(client, "/api/expire-promotions", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
                });
                if (!response.ok) throw new Error("Não foi possível arquivar a promoção.");
                onComplete();
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível arquivar.");
            } finally {
                setBusy(false);
            }
        },
    };
}
