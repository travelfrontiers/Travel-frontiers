import { Button, Dialog, Flex } from "@sanity/ui";
import { useRef, useState } from "react";
import { type ObjectInputProps, useClient } from "sanity";
import { ItineraryPdfReview } from "./actions/ItineraryPdfReview";
import { studioFetch } from "./studio-fetch";

export function ItineraryDocumentInput(props: ObjectInputProps) {
    const client = useClient({ apiVersion: "2024-01-18" });
    const [review, setReview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const dirty = useRef(false);
    const id = String(props.value?._id ?? "").replace(/^drafts\./, "");
    const title = String(props.value?.title ?? "");
    const notes = String(props.value?.notes ?? "");
    const source = typeof props.value?.privateSource === "string" ? props.value.privateSource : undefined;

    async function downloadWord() {
        setBusy(true);
        setError("");
        try {
            const response = await studioFetch(client, "/api/generate-itinerary", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: source, title, notes, format: "docx" }),
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || "Não foi possível gerar o Word.");
            }
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = `Itinerario_${title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80)}.docx`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível gerar o Word.");
        } finally {
            setBusy(false);
        }
    }

    return <div className="space-y-4">
        <Flex gap={2} wrap="wrap">
            <Button text="Rever e exportar PDF" tone="primary" disabled={!id || busy} onClick={() => setReview(true)} />
            <Button text={busy ? "A gerar Word…" : "Gerar Word"} mode="ghost" disabled={!source || !title.trim() || busy}
                onClick={() => void downloadWord()} />
        </Flex>
        {error && <p role="alert">{error}</p>}
        {props.renderDefault(props)}
        {review && <Dialog id="itinerary-review" header="Rever guia de viagem" width={4}
            onClose={() => {
                if (dirty.current && !window.confirm("Fechar e perder as alterações ainda não guardadas?")) return;
                dirty.current = false;
                setReview(false);
            }}>
            <ItineraryPdfReview key={id} id={id} title={title} source={source} notes={notes}
                onDirty={value => { dirty.current = value; }} />
        </Dialog>}
    </div>;
}
