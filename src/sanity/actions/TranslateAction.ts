import { type DocumentActionProps, useClient } from "sanity";
import { useState } from "react";
import { studioFetch } from "../studio-fetch";

type TextBlock = { children?: { text?: string }[] };

export function TranslateAction({ id, type, published, draft, onComplete }: DocumentActionProps) {
    const [busy, setBusy] = useState(false);
    const client = useClient({ apiVersion: "2024-01-18" });
    const doc = draft ?? published;
    if (type !== "promotion" || doc?.language !== "pt") return null;

    return {
        label: busy ? "A traduzir…" : "Criar rascunhos em inglês e francês",
        disabled: busy || !doc.title || !doc.slug,
        onHandle: async () => {
            if (!window.confirm("Criar ou atualizar os rascunhos em inglês e francês? As versões publicadas ficam disponíveis até publicares as traduções revistas.")) return;
            setBusy(true);
            try {
                const description = Array.isArray(doc.description)
                    ? (doc.description as TextBlock[]).map(block => block.children?.map(span => span.text ?? "").join("") ?? "").filter(Boolean)
                    : typeof doc.description === "string" ? [doc.description] : [];
                const response = await studioFetch(client, "/api/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: doc.title, description, subtitle: doc.subtitle ?? "",
                        location: doc.location ?? "", duration: doc.duration ?? "",
                        highlights: doc.highlights ?? [], inclusions: doc.inclusions ?? [],
                    }),
                });
                const translations = await response.json();
                if (!response.ok) throw new Error(translations.error);
                const base = id.replace(/^drafts\./, "");
                const slug = (doc.slug as { current: string }).current;
                const content = Object.fromEntries(Object.entries(doc).filter(([key]) => !key.startsWith("_")));
                const transaction = client.transaction();
                for (const language of ["en", "fr"] as const) {
                    const translation = translations[language];
                    transaction.createOrReplace({
                        ...content, ...translation, _type: "promotion", _id: `drafts.${base}-${language}`, language,
                        description: (translation.description as string[]).map((text, index) => ({
                            _type: "block", _key: `translation-${index}`, style: "normal", markDefs: [],
                            children: [{ _type: "span", _key: `text-${index}`, text, marks: [] }],
                        })),
                        slug: { _type: "slug", current: `${slug}-${language}` },
                    });
                }
                await transaction.commit();
                alert("Rascunhos em inglês e francês disponíveis para revisão no Studio.");
                onComplete();
            } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível traduzir.");
            } finally {
                setBusy(false);
            }
        },
    };
}
