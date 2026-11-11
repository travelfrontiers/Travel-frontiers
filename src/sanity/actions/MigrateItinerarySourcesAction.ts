import { useState } from "react";
import { useClient } from "sanity";
import { studioFetch } from "../studio-fetch";

export function MigrateItinerarySourcesAction() {
    const client = useClient({ apiVersion: "2024-01-18" });
    const [busy, setBusy] = useState(false);
    return {
        label: busy ? "A proteger roteiros…" : "Migrar roteiros antigos para armazenamento privado",
        disabled: busy,
        onHandle: async () => {
            if (!window.confirm("Copiar e verificar os ficheiros num espaço privado, manter os roteiros como rascunhos e retirar as cópias públicas?")) return;
            setBusy(true);
            try {
                const response = await studioFetch(client, "/api/itinerary-source?action=migrate", { method: "POST" });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                alert(`Migração concluída. ${result.files} ficheiro(s) e ${result.documents} roteiro(s) publicado(s) processados.`);
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível proteger os roteiros.");
            } finally { setBusy(false); }
        },
    };
}
