import {
    AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, Packer,
    PageNumber, Paragraph, TextRun, Table, TableCell, TableRow, WidthType,
} from "docx";
import type { ItineraryPhoto } from "./itinerary-images";

import { guideSections, transportDetails, type Stay } from "./itinerary-guide";

type Meal = { nome: string; porque: string; morada: string; preco: string; maps: string };
export type Transport = { route: string; departure: string; arrival: string; tips: string };
type Day = {
    number: number; date: string; title: string; base: string; highlight: string; logistics: string;
    transports?: Transport[];
    morning: string[]; afternoon: string[]; evening: string[]; alternatives: string[]; lunch: Meal | null; dinner: Meal | null;
};
export type Itinerary = { title: string; introduction: string; route: string[]; tips: string[]; days: Day[] };

const ink = "0D2334";
const muted = "456071";
const accent = "9C410D";
const border = "E8E3DC";

function text(value: string, options: { color?: string; size?: number; bold?: boolean; font?: string } = {}) {
    return new TextRun({ text: value, font: "Calibri", size: 21, color: ink, ...options });
}

function label(value: string, after = 120) {
    return new Paragraph({ keepNext: true, spacing: { before: 150, after },
        children: [text(value, { size: 19, color: accent, bold: true })] });
}

function link(value: string, url: string) {
    return new ExternalHyperlink({ link: url,
        children: [new TextRun({ text: value, font: "Calibri", size: 18, color: "35596A", underline: {} })] });
}

function photo(image: ItineraryPhoto, maxHeight: number) {
    const width = 615;
    const scale = Math.max(width / image.width, maxHeight / image.height);
    const horizontal = 50 * (1 - width / (image.width * scale));
    const vertical = 50 * (1 - maxHeight / (image.height * scale));
    return [
        new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 },
            children: [new ImageRun({ type: image.type, data: image.buffer,
                altText: { name: image.location, title: image.location, description: image.location },
                crop: { left: horizontal, right: horizontal, top: vertical, bottom: vertical },
                transformation: { width, height: maxHeight } })] }),
        new Paragraph({ spacing: { after: 160 },
            children: [text(image.location, { size: 17, color: muted })] }),
    ];
}

function formatDate(date: string, long = false) {
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-PT", {
        day: "numeric", month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}), timeZone: "UTC",
    }).format(new Date(date + "T00:00:00Z"));
}

function meal(caption: string, value: Meal | null) {
    if (!value) return [];
    const details = [value.porque, value.morada, value.preco].filter(Boolean);
    return [new Paragraph({ keepLines: true, spacing: { after: 100 }, children: [
        text(caption + " · ", { bold: true, color: accent, size: 20 }),
        text(value.nome, { bold: true, size: 20 }),
        ...(details.length ? [text("  " + details.join(" · "), { size: 20 })] : []),
        ...(value.maps ? [text("  "), link("Abrir no Google Maps", value.maps)] : []),
    ] })];
}

function bullet(value: string) {
    return new Paragraph({ bullet: { level: 0 }, keepLines: true, spacing: { after: 100, line: 290 },
        children: [text(value)] });
}

function period(title: string, items: string[]) {
    const entries = items.filter(item => item.trim());
    return entries.length ? [label(title, 100), ...entries.map(value => {
        const separator = value.indexOf(" — ");
        const hasTitle = separator > 0 && separator < 110;
        return new Paragraph({ keepLines: true, spacing: { after: 100, line: 265 },
            children: hasTitle
                ? [text(value.slice(0, separator), { bold: true }), text("  " + value.slice(separator + 3))]
                : [text(value)] });
    })] : [];
}

function panel(columns: Paragraph[][], fill: string) {
    const width = Math.floor(9906 / columns.length);
    const none = { style: BorderStyle.NONE };
    return new Table({
        width: { size: 9906, type: WidthType.DXA }, columnWidths: columns.map(() => width),
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [new TableRow({ children: columns.map(children => new TableCell({
            width: { size: width, type: WidthType.DXA }, shading: { fill },
            margins: { top: 130, bottom: 130, left: 200, right: 200 }, children,
        })) })],
    });
}

function heading(title: string) {
    return new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, keepNext: true,
        spacing: { after: 240 }, children: [text(title, { size: 44, bold: true })] });
}

function card(caption: string, title: string, detail: string) {
    return [panel([[label(caption, 40), new Paragraph({ keepNext: true, children: [text(title, { size: 26, bold: true })] }),
        new Paragraph({ spacing: { after: 160 }, children: [text(detail, { color: muted })] })]], "F8F5ED"), new Paragraph({ spacing: { after: 0, line: 100 } })];
}

function photoCredits(images: (ItineraryPhoto | null)[]) {
    const unique = [...new Map(images.filter((image): image is ItineraryPhoto => Boolean(image)).map(image => [image.source, image])).values()];
    return unique.length ? [label("Créditos das fotografias"), ...unique.map(image => new Paragraph({
        spacing: { after: 100 }, children: [
            text([image.location, image.author].filter(Boolean).join(" · ") + " · ", { size: 17, color: muted }),
            link("Wikimedia Commons", image.source), text(" · ", { size: 17 }),
            image.licenseUrl ? link(image.license, image.licenseUrl) : text(image.license, { size: 17 }),
        ],
    }))] : [];
}

export async function createItineraryWord(itinerary: Itinerary, images: (ItineraryPhoto | null)[], logo: Buffer | null,
    stays: Stay[] = [], transitDates: string[] = []) {
    const cover = images[0] ?? images.find(Boolean);
    const dates = [...new Set([itinerary.days[0]?.date, itinerary.days.at(-1)?.date].filter(Boolean))]
        .map(date => formatDate(date!, true)).join(" – ");
    const { groups, hotels, transfers } = guideSections(itinerary, stays, transitDates);
    function coverLine(value: string, size: number, color = "FFFFFF", bold = false) {
        return new Paragraph({ spacing: { after: 150 }, children: [text(value, { size, color, bold })] });
    }
    const children: (Paragraph | Table)[] = [panel([[
        ...(logo ? [new Paragraph({ children: [new ImageRun({ data: logo, type: "png", transformation: { width: 68, height: 68 } })] })] : []),
        coverLine("TRAVEL FRONTIERS", 26, "FFFFFF", true), coverLine("GUIA DE VIAGEM", 20, "F4D191", true),
        coverLine(itinerary.title.toLocaleUpperCase("pt-PT"), 54, "FFFFFF", true),
        ...(cover ? photo(cover, 320).slice(0, 1) : []), coverLine(dates, 30),
        coverLine(itinerary.days.length + " dias", 22, "F4D191"), coverLine(itinerary.route.join("  ·  "), 22),
        coverLine(itinerary.introduction, 22),
    ]], ink), heading("A viagem num relance")];
    for (const group of groups) {
        const range = [...new Set([group.from, group.to].filter(Boolean))].map(date => formatDate(date)).join(" – ");
        children.push(...card(range || "Percurso", group.base || "Etapa da viagem", group.days.join(" · ")));
    }
    if (hotels.length) children.push(heading("Onde vais ficar"));
    for (const hotel of hotels) children.push(...card("Alojamento", hotel.nome,
        ["Entrada " + formatDate(hotel.entrada), "Saída " + formatDate(hotel.saida),
            hotel.nights > 0 ? hotel.nights + (hotel.nights === 1 ? " noite" : " noites") : ""].filter(Boolean).join(" · ")));
    if (transfers.length) children.push(heading("De etapa em etapa"));
    for (const day of transfers) {
        const date = formatDate(day.date);
        if (day.logistics) children.push(...card(date, day.base || day.title, day.logistics));
        for (const segment of day.transports ?? []) children.push(...card(date, segment.route, transportDetails(segment)));
    }
    for (const [index, day] of itinerary.days.entries()) {
        children.push(heading(["Dia " + day.number, formatDate(day.date), day.base].filter(Boolean).join(" · ")),
            new Paragraph({ keepNext: true, spacing: { after: 100 }, children: [text(day.title, { size: 30, bold: true })] }));
        const image = images[index + 1] ?? images.slice(1, index + 2).findLast((item, i) => item && itinerary.days[i].base === day.base);
        if (image) children.push(...photo(image, 100));
        if (day.highlight) children.push(new Paragraph({ children: [text(day.highlight, { color: muted })] }));
        children.push(...period("Manhã", day.morning), ...period("Tarde", day.afternoon),
            ...period("Noite", day.evening), ...period("Alternativas", day.alternatives));
        const meals = [meal("Almoço", day.lunch), meal("Jantar", day.dinner)].filter(items => items.length);
        if (meals.length) children.push(panel(meals, "F8F5ED"));
        for (const segment of day.transports ?? []) children.push(...card("Transporte", segment.route, transportDetails(segment)));
        if (day.logistics) children.push(panel([[label("Logística", 40),
            new Paragraph({ children: [text(day.logistics)] })]], "E5F1EF"));
    }
    if (itinerary.tips.length) children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true, spacing: { before: 0, after: 160 },
            children: [text("Antes de partir", { size: 38, bold: true })] }),
        ...itinerary.tips.map(bullet),
    );
    children.push(...photoCredits(images));
    const document = new Document({
        title: itinerary.title, creator: "Travel Frontiers",
        styles: { paragraphStyles: [{ id: "Title", name: "Title", basedOn: "Normal" }] },
        sections: [{
            properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1060, left: 1000 } } },
            children,
            headers: { default: new Header({ children: [new Paragraph({
                shading: { fill: ink }, spacing: { before: 0, after: 60 }, indent: { left: 120 },
                children: [text("TRAVEL FRONTIERS    /    GUIA DE VIAGEM", { size: 17, bold: true, color: "F4D191" })],
            })] }) },
            footers: { default: new Footer({ children: [new Paragraph({
                alignment: AlignmentType.RIGHT, spacing: { before: 120 },
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: border, space: 7 } },
                children: [text("Travel Frontiers  ·  ", { size: 18, color: muted }), link("travelfrontiers.pt", "https://www.travelfrontiers.pt"),
                    text("     /     ", { size: 18, color: muted }), new TextRun({ size: 18, color: muted, children: [PageNumber.CURRENT] })],
            })] }) },
        }],
    });
    return Packer.toBuffer(document);
}
