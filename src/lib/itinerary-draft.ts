import type { Itinerary } from "./itinerary-word";
import type { Stay } from "./itinerary-guide";

export type ItineraryDraft = {
    itinerary: Itinerary;
    stays: Stay[];
    transitDates: string[];
    photoQueries: string[];
};

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Roteiro inválido.");
    return value as Record<string, unknown>;
}

function field(value: unknown, limit: number) {
    if (typeof value !== "string" || value.length > limit) throw new TypeError("Revê o comprimento dos campos do roteiro.");
    return value.trim();
}

function list<T>(value: unknown, limit: number, parse: (item: unknown) => T): T[] {
    if (!Array.isArray(value) || value.length > limit) throw new TypeError("Há demasiadas entradas numa secção do roteiro.");
    return value.map(parse);
}

function date(value: unknown) {
    const result = field(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) ||
        new Date(result).toISOString().slice(0, 10) !== result) throw new TypeError("Revê as datas do roteiro.");
    return result;
}

function meal(value: unknown) {
    if (value === null) return null;
    const data = record(value);
    const nome = field(data.nome, 200);
    if (!nome) return null;
    const maps = field(data.maps, 1800);
    const url = URL.parse(maps);
    if (maps && (url?.protocol !== "https:" || url.username || url.password ||
        !(url.hostname === "maps.app.goo.gl" || (["www.google.com", "maps.google.com", "www.google.pt"].includes(url.hostname) &&
            (url.pathname.startsWith("/maps") || url.hostname === "maps.google.com"))))) {
        throw new TypeError("Usa um link HTTPS do Google Maps no restaurante.");
    }
    return { nome, maps, porque: field(data.porque, 600), morada: field(data.morada, 250), preco: field(data.preco, 60) };
}

export function parseTransportSegments(value: unknown) {
    return list(value ?? [], 12, item => {
        const segment = record(item);
        return {
            route: field(segment.route, 220),
            departure: field(segment.departure, 100),
            arrival: field(segment.arrival, 100),
            tips: field(segment.tips, 550),
        };
    }).filter(segment => segment.route);
}

export function parseItineraryDraft(value: unknown): ItineraryDraft {
    const input = record(value);
    const itinerary = record(input.itinerary);
    const title = field(itinerary.title, 150);
    const days = list(itinerary.days, 24, item => {
        const day = record(item);
        const activity = (value: unknown) => list(value, 12, entry => field(entry, 800)).filter(Boolean);
        return {
            date: date(day.date), title: field(day.title, 180), base: field(day.base, 90),
            highlight: field(day.highlight, 900), logistics: field(day.logistics, 1200),
            morning: activity(day.morning), afternoon: activity(day.afternoon),
            evening: activity(day.evening), alternatives: activity(day.alternatives),
            lunch: meal(day.lunch), dinner: meal(day.dinner), transports: parseTransportSegments(day.transports),
        };
    }).map((day, index) => ({ ...day, number: index + 1 }));
    if (!title || !days.length || days.some((day, index) => !day.title || (index > 0 && day.date <= days[index - 1].date))) {
        throw new TypeError("Preenche o título do roteiro e de cada dia, com datas em ordem cronológica.");
    }
    const stays = list(input.stays, 24, value => {
        const stay = record(value);
        const nome = field(stay.nome, 200);
        const entrada = date(stay.entrada);
        const saida = date(stay.saida);
        if (!nome || saida < entrada) throw new TypeError("Revê o nome e as datas dos alojamentos.");
        return { nome, entrada, saida };
    });
    const photoQueries = list(input.photoQueries, 25, item => field(item, 150));
    if (photoQueries.length !== days.length + 1) throw new TypeError("Revê as fotografias do roteiro.");
    return {
        itinerary: { title, days, introduction: field(itinerary.introduction, 1200),
            route: list(itinerary.route, 10, item => field(item, 80)).filter(Boolean),
            tips: list(itinerary.tips, 20, item => field(item, 800)).filter(Boolean) },
        stays, photoQueries, transitDates: list(input.transitDates, 24, date),
    };
}
