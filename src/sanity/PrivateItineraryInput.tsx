import { useState } from "react";
import { set, unset, type StringInputProps, useClient } from "sanity";
import { studioFetch } from "./studio-fetch";

export function PrivateItineraryInput({ value, onChange, readOnly, elementProps }: StringInputProps) {
    const client = useClient({ apiVersion: "2024-01-18" });
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);
    return <div className="space-y-3">
        <label htmlFor={elementProps.id}>Ficheiro privado de origem</label>
        <input id={elementProps.id} type="file" accept=".pdf,.docx,.txt" disabled={busy || readOnly} onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setFailed(false);
            if (file.size > 4 * 1024 * 1024) {
                setFailed(true); setMessage("O limite por ficheiro é 4 MB."); return;
            }
            setBusy(true); setMessage("A guardar o ficheiro…");
            try {
                const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
                const response = await studioFetch(client, `/api/itinerary-source?extension=${encodeURIComponent(extension)}`, {
                    method: "POST", body: file,
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                onChange(set(result.key));
                setMessage("Ficheiro privado guardado.");
            } catch (error) {
                setFailed(true); setMessage(error instanceof Error ? error.message : "Não foi possível guardar.");
            } finally { setBusy(false); }
        }} />
        {value && <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={async () => {
                setBusy(true); setFailed(false);
                try {
                    const response = await studioFetch(client, `/api/itinerary-source?key=${encodeURIComponent(value)}`, { method: "GET" });
                    if (!response.ok) throw new Error("Não foi possível descarregar o ficheiro.");
                    const url = URL.createObjectURL(await response.blob());
                    const link = document.createElement("a");
                    link.href = url; link.download = "roteiro." + value.split(".").at(-1); link.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (error) {
                    setFailed(true); setMessage(error instanceof Error ? error.message : "Não foi possível descarregar.");
                } finally { setBusy(false); }
            }}>Descarregar ficheiro</button>
            {!readOnly && <button type="button" disabled={busy} onClick={() => onChange(unset())}>Desassociar</button>}
        </div>}
        {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </div>;
}
