import { useEffect, useState } from "react";
import { useClient } from "sanity";
import type { ItineraryDraft } from "@/lib/itinerary-draft";
import { studioFetch } from "../studio-fetch";

type Props = {
    id: string;
    title: string;
    source?: string;
    notes: string;
    onDirty: (dirty: boolean) => void;
};

const fieldClass = "w-full rounded border border-gray-500/40 bg-transparent p-2";
const buttonClass = "rounded border border-gray-500/40 px-3 py-2 text-sm disabled:opacity-50";
const emptyMeal = { nome: "", porque: "", morada: "", preco: "", maps: "" };

function Field({ label, value, onChange, multiline = false, type = "text" }: {
    label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string;
}) {
    return <label className="block space-y-1 text-sm">
        <span>{label}</span>
        {multiline
            ? <textarea className={fieldClass} value={value} rows={4} onChange={event => onChange(event.target.value)} />
            : <input className={fieldClass} type={type} value={value} onChange={event => onChange(event.target.value)} />}
    </label>;
}

export function ItineraryPdfReview({ id, title, source, notes, onDirty }: Props) {
    const client = useClient({ apiVersion: "2024-01-18" });
    const [draft, setDraft] = useState<ItineraryDraft | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState("");
    const [message, setMessage] = useState("");
    const [section, setSection] = useState("cover");
    const [preview, setPreview] = useState("");
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    async function operate(operation: "load" | "generate" | "save" | "preview") {
        setBusy(operation);
        setMessage("");
        try {
            const response = await studioFetch(client, "/api/generate-itinerary", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operation, draftId: id, key: source, title, notes, draft }),
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || "Não foi possível continuar.");
            }
            if (operation === "preview") {
                setPreview(URL.createObjectURL(await response.blob()));
                return;
            }
            const result = await response.json();
            setDraft(result.draft);
            if (operation === "generate") { setPreview(""); setSection("cover"); }
            setLoaded(true);
            onDirty(operation === "generate");
            if (operation === "save") setMessage("Rascunho guardado.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Não foi possível continuar.");
        } finally {
            setBusy("");
        }
    }

    function update(value: ItineraryDraft) {
        setDraft(value);
        setPreview("");
        setMessage("");
        onDirty(true);
    }

    const index = Number(section);
    const day = draft?.itinerary.days[index];
    const updateDay = (patch: Partial<NonNullable<typeof day>>) => {
        if (!draft) return;
        update({ ...draft, itinerary: { ...draft.itinerary,
            days: draft.itinerary.days.map((item, i) => i === index ? { ...item, ...patch } : item) } });
    };
    const updatePhoto = (index: number, value: string) => {
        if (!draft) return;
        update({ ...draft, photoQueries: draft.photoQueries.map((query, i) => i === index ? value : query) });
    };
    const lines = (value: string) => value.split("\n");
    const safeName = (draft?.itinerary.title || title).replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80);

    return <div className="mx-auto max-w-5xl space-y-4 p-4">
        {message && <p role="status">{message}</p>}
        {busy && <p role="status">{busy === "generate" ? "A gerar o rascunho. Pode demorar alguns minutos." : "A preparar a revisão…"}</p>}
        {!loaded && <button className={buttonClass} disabled={!!busy} onClick={() => void operate("load")}>Abrir revisão</button>}
        {loaded && !draft && <div className="space-y-3">
            <p>Gera um primeiro rascunho a partir do ficheiro da viagem. Depois podes corrigir e guardar o conteúdo antes de criar o PDF.</p>
            <button className={buttonClass} disabled={!!busy || !source} onClick={() => void operate("generate")}>Gerar rascunho</button>
            {!source && <p>Adiciona o ficheiro de origem ao roteiro para começares.</p>}
        </div>}
        {draft && <fieldset className="space-y-4" disabled={!!busy}>
            <label className="block space-y-1 text-sm">
                <span>Secção a rever</span>
                <select className={fieldClass} value={section} onChange={event => setSection(event.target.value)}>
                    <option value="cover">Capa e informações práticas</option>
                    <option value="stays">Alojamentos</option>
                    {draft.itinerary.days.map((item, i) => <option key={i} value={i}>Dia {item.number} · {item.title}</option>)}
                </select>
            </label>
            {section === "cover" && <>
                <Field label="Título" value={draft.itinerary.title} onChange={title => update({ ...draft, itinerary: { ...draft.itinerary, title } })} />
                <Field label="Introdução" multiline value={draft.itinerary.introduction} onChange={introduction => update({ ...draft, itinerary: { ...draft.itinerary, introduction } })} />
                <Field label="Destinos (um por linha)" multiline value={draft.itinerary.route.join("\n")} onChange={value => update({ ...draft, itinerary: { ...draft.itinerary, route: lines(value) } })} />
                <Field label="Dicas práticas (uma por linha)" multiline value={draft.itinerary.tips.join("\n")} onChange={value => update({ ...draft, itinerary: { ...draft.itinerary, tips: lines(value) } })} />
                <Field label="Pesquisa da fotografia da capa (local público em inglês)" value={draft.photoQueries[0]} onChange={value => updatePhoto(0, value)} />
            </>}
            {section === "stays" && <>
                {draft.stays.map((stay, i) => <div className="grid gap-2 rounded border border-gray-500/40 p-3 sm:grid-cols-2" key={i}>
                    <Field label="Alojamento" value={stay.nome} onChange={nome => update({ ...draft, stays: draft.stays.map((item, j) => i === j ? { ...item, nome } : item) })} />
                    <div className="grid grid-cols-2 gap-2">
                        {(["entrada", "saida"] as const).map(key => <Field key={key} label={key === "entrada" ? "Entrada" : "Saída"} type="date" value={stay[key]}
                            onChange={value => update({ ...draft, stays: draft.stays.map((item, j) => i === j ? { ...item, [key]: value } : item) })} />)}
                    </div>
                    <button className={buttonClass + " justify-self-start"} onClick={() => update({ ...draft, stays: draft.stays.filter((_, j) => i !== j) })}>Retirar alojamento</button>
                </div>)}
                <button className={buttonClass} onClick={() => update({ ...draft, stays: [...draft.stays, { nome: "", entrada: "", saida: "" }] })}>Adicionar alojamento</button>
            </>}
            {day && <>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Título do dia" value={day.title} onChange={title => updateDay({ title })} />
                    <Field label="Base ou percurso" value={day.base} onChange={base => updateDay({ base })} />
                </div>
                <Field label="Destaque" multiline value={day.highlight} onChange={highlight => updateDay({ highlight })} />
                {([["morning", "Manhã"], ["afternoon", "Tarde"], ["evening", "Noite"], ["alternatives", "Alternativas"]] as const).map(([key, label]) =>
                    <Field key={key} label={label + " (uma atividade por linha)"} multiline value={day[key].join("\n")} onChange={value => updateDay({ [key]: lines(value) })} />)}
                <div className="space-y-3 rounded border border-gray-500/40 p-3">
                    <h3 className="font-semibold">Transportes do dia</h3>
                    {(day.transports ?? []).map((segment, i) => <div key={i} className="grid gap-2 rounded border border-gray-500/40 p-3">
                        {([["route", "Transporte e percurso"], ["departure", "Partida (data e hora locais)"],
                            ["arrival", "Chegada (data e hora locais)"], ["tips", "Dicas para este transporte"]] as const).map(([key, label]) =>
                            <Field key={key} label={label} multiline={key === "tips"} value={segment[key]} onChange={value => updateDay({
                                transports: day.transports?.map((item, j) => i === j ? { ...item, [key]: value } : item),
                            })} />)}
                        <button className={buttonClass + " justify-self-start"} onClick={() => updateDay({
                            transports: day.transports?.filter((_, j) => i !== j),
                        })}>Retirar transporte</button>
                    </div>)}
                    <button className={buttonClass} disabled={(day.transports?.length ?? 0) >= 12} onClick={() => updateDay({
                        transports: [...day.transports ?? [], { route: "", departure: "", arrival: "", tips: "" }],
                    })}>Adicionar transporte</button>
                </div>
                <Field label="Logística do dia" multiline value={day.logistics} onChange={logistics => updateDay({ logistics })} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.transitDates.includes(day.date)}
                        onChange={event => update({ ...draft, transitDates: event.target.checked
                            ? [...draft.transitDates, day.date] : draft.transitDates.filter(date => date !== day.date) })} />
                    Mostrar a logística deste dia na secção de transportes
                </label>
                {([["lunch", "Almoço"], ["dinner", "Jantar"]] as const).map(([key, label]) =>
                    <details className="rounded border border-gray-500/40 p-3" key={key}>
                        <summary className="cursor-pointer">{label}{day[key]?.nome ? " · " + day[key].nome : ""}</summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {([["nome", "Restaurante"], ["porque", "Sugestão"], ["morada", "Morada"], ["preco", "Preço"], ["maps", "Link do Google Maps"]] as const)
                                .map(([field, title]) => <Field key={field} label={title} value={day[key]?.[field] ?? ""}
                                    onChange={value => updateDay({ [key]: { ...(day[key] ?? emptyMeal), [field]: value } })} />)}
                            <button className={buttonClass + " self-end"} onClick={() => updateDay({ [key]: null })}>Retirar sugestão de {label.toLowerCase()}</button>
                        </div>
                    </details>)}
                <Field label="Pesquisa da fotografia do dia (local público em inglês)" value={draft.photoQueries[index + 1]} onChange={value => updatePhoto(index + 1, value)} />
            </>}
            {(day || section === "cover") && <p className="text-sm">Deixa a pesquisa em branco para omitir a fotografia. O PDF usa até oito fotografias do Wikimedia Commons. Confirma o resultado na pré-visualização.</p>}
            <div className="flex flex-wrap gap-2">
                <button className={buttonClass} onClick={() => void operate("save")}>Guardar rascunho</button>
                <button className={buttonClass} onClick={() => void operate("preview")}>Pré-visualizar PDF</button>
                {source && <button className={buttonClass} onClick={() => {
                    if (window.confirm("Gerar um novo rascunho com as preferências atuais? O rascunho guardado só é substituído se guardares a nova versão.")) {
                        void operate("generate");
                    }
                }}>Gerar novo rascunho</button>}
                {preview && <a className={buttonClass} href={preview} download={`Itinerario_${safeName}.pdf`}>Descarregar este PDF</a>}
            </div>
            {preview && <>
                <a className="text-sm underline" href={preview} target="_blank" rel="noreferrer">Abrir a pré-visualização noutro separador</a>
                <iframe className="h-[65vh] w-full rounded border border-gray-500/40" src={preview} title="Pré-visualização do guia de viagem" />
            </>}
        </fieldset>}
    </div>;
}
