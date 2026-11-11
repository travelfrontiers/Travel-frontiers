import { useState } from "react";
import { Clock } from "lucide-react";
import { useClient } from "sanity";
import { studioFetch } from "../studio-fetch";

export function ProcessExpiredAction() {
    const [busy, setBusy] = useState(false);
    const client = useClient({ apiVersion: "2024-01-18" });
    return {
        label: busy ? "A verificar validades…" : "Arquivar promoções expiradas",
        icon: Clock,
        disabled: busy,
        onHandle: async () => {
            if (!window.confirm("Arquivar as promoções expiradas e as respetivas traduções?")) return;
            setBusy(true);
            try {
                const response = await studioFetch(client, "/api/expire-promotions", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Houve promoções que não foi possível arquivar.");
                alert(`Registos arquivados: ${result.archived}.`);
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível arquivar.");
            } finally {
                setBusy(false);
            }
        },
    };
}
