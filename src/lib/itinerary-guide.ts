import type { Itinerary, Transport } from "./itinerary-word";

export type Stay = { nome: string; entrada: string; saida: string };

export function guideSections(itinerary: Itinerary, stays: Stay[], transitDates: string[]) {
    const groups: { base: string; from: string; to: string; days: string[] }[] = [];
    for (const day of itinerary.days) {
        const stay = day.date && stays.find(item => day.date >= item.entrada && day.date < item.saida);
        const base = stay
            ? itinerary.days.find(item => item.date > stay.entrada && item.date < stay.saida
                && item.base && !transitDates.includes(item.date))?.base || stay.nome
            : day.base;
        const group = groups.at(-1);
        if (group && group.base === base) {
            group.to = day.date;
            group.days.push(day.title);
        } else {
            groups.push({ base, from: day.date, to: day.date, days: [day.title] });
        }
    }
    const hotels = stays.map(stay => ({
        ...stay, nights: Math.round((Date.parse(stay.saida) - Date.parse(stay.entrada)) / 86_400_000),
    }));
    const transfers = itinerary.days.filter(day => day.transports?.length || (transitDates.includes(day.date) && day.logistics));
    return { groups, hotels, transfers };
}


export function transportDetails(segment: Transport) {
    return [
        segment.departure && "Partida: " + segment.departure,
        segment.arrival ? "Chegada: " + segment.arrival : "Chegada: a confirmar",
        segment.tips && "Dica: " + segment.tips,
    ].filter(Boolean).join("\n");
}
