import { type DocumentActionComponent, useClient } from "sanity";
import { useState } from "react";
import { Download } from "lucide-react";
import { studioFetch } from "../studio-fetch";

export const GenerateStoryAction: DocumentActionComponent = ({ draft, published }) => {
    const doc = draft ?? published;
    const client = useClient({ apiVersion: "2024-01-18" });
    const [busy, setBusy] = useState(false);
    const asset = (doc?.heroImage as { asset?: { _ref?: string } } | undefined)?.asset?._ref;
    return {
        label: busy ? "A gerar imagem…" : "Descarregar story para Instagram",
        icon: Download,
        disabled: busy || !asset || !doc?.title,
        onHandle: async () => {
            setBusy(true);
            try {
                const response = await studioFetch(client, "/api/generate-story", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: doc?.title, price: doc?.price, regime: doc?.regime,
                        lang: doc?.language, subtitle: doc?.subtitle, assetId: asset,
                    }),
                });
                if (!response.ok) throw new Error("Não foi possível gerar a imagem.");
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url;
                link.download = "travel-frontiers-story.png";
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível gerar a imagem.");
            } finally {
                setBusy(false);
            }
        },
    };
};
