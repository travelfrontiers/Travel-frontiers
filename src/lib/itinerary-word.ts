import {
    AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun, Packer,
    PageNumber, Paragraph, ShadingType, TextRun,
} from "docx";
import type { ItineraryPhoto } from "./itinerary-images";

type Meal = { nome: string; porque: string; morada: string; preco: string; maps: string };
type Day = {
    number: number; date: string; title: string; base: string; highlight: string; logistics: string;
    morning: string[]; afternoon: string[]; evening: string[]; alternatives: string[]; lunch: Meal | null; dinner: Meal | null;
};
type Itinerary = { title: string; introduction: string; route: string[]; tips: string[]; days: Day[] };

const ink = "232527";
const muted = "505961";
const accent = "875E20";
const border = "E6DED1";

function text(value: string, options: { color?: string; size?: number; bold?: boolean; font?: string } = {}) {
    return new TextRun({ text: value, font: "Calibri", size: 22, color: ink, ...options });
}

function label(value: string, after = 120) {
    return new Paragraph({ keepNext: true, spacing: { before: 220, after },
        children: [text(value, { size: 19, color: accent, bold: true })] });
}

function link(value: string, url: string) {
    return new ExternalHyperlink({ link: url,
        children: [new TextRun({ text: value, font: "Calibri", size: 18, color: "35596A", underline: {} })] });
}

function photo(image: ItineraryPhoto, maxHeight: number) {
    const scale = Math.min(555 / image.width, maxHeight / image.height, 1);
    return [
        new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 },
            children: [new ImageRun({ type: image.type, data: image.buffer,
                altText: { name: image.location, title: image.location, description: image.location },
                transformation: { width: Math.round(image.width * scale), height: Math.round(image.height * scale) } })] }),
        new Paragraph({ spacing: { after: 185 },
            children: [
                text([image.location, image.author].filter(Boolean).join(" · ") + " · ", { size: 17, color: muted }),
                link("Wikimedia Commons", image.source),
                text(" · ", { size: 17, color: muted }),
                image.licenseUrl ? link(image.license, image.licenseUrl) : text(image.license, { size: 17, color: muted }),
            ] }),
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
    return entries.length ? [label(title, 90), ...entries.map(bullet)] : [];
}

export async function createItineraryWord(itinerary: Itinerary, images: (ItineraryPhoto | null)[], logo: Buffer | null) {
    const [coverImage, ...dayImages] = images;
    const fallback = coverImage ? -1 : dayImages.findIndex(Boolean);
    const cover = coverImage ?? dayImages[fallback];
    if (fallback >= 0) dayImages[fallback] = null;
    const firstDate = formatDate(itinerary.days[0]?.date ?? "", true);
    const lastDate = formatDate(itinerary.days.at(-1)?.date ?? "", true);
    const dates = [...new Set([firstDate, lastDate].filter(Boolean))].join(" – ");
    const bases = [...new Set(itinerary.route.map(base => base.trim()).filter(Boolean))];
    const overview = new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true,
        spacing: { before: 0, after: 240 }, children: [text("O itinerário dia a dia", { font: "Georgia", size: 44, bold: true })] });
    const children: Paragraph[] = [
        ...(logo ? [new Paragraph({ keepNext: true, children: [new ImageRun({ data: logo, type: "png", transformation: { width: 62, height: 62 } })] })] : []),
        label("Roteiro de viagem"),
        new Paragraph({ style: "Title", keepNext: true, spacing: { before: 100, after: 220 },
            children: [text(itinerary.title, { font: "Georgia", size: 58, color: "000000", bold: true })] }),
        new Paragraph({ keepNext: true, spacing: { after: 110 }, children: [text([dates, itinerary.days.length + " dias"].filter(Boolean).join(" · "), { size: 23, color: accent, bold: true })] }),
        ...(bases.length ? [new Paragraph({ spacing: { after: 230 }, children: [text(bases.join("  →  "), { size: 21, color: muted })] })] : []),
        ...(cover ? photo(cover, 285) : []),
        new Paragraph({ spacing: { before: 110, after: 110, line: 310 }, children: [text(itinerary.introduction, { size: 23 })] }),
        overview,
    ];
    for (const [index, day] of itinerary.days.entries()) {
        const image = dayImages[index];
        children.push(
            new Paragraph({ keepNext: true, spacing: { before: index === 0 ? 80 : 380, after: 95 },
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: border, space: 9 } },
                children: [text(["Dia " + day.number, formatDate(day.date), day.base].filter(Boolean).join(" · "), { size: 19, color: accent, bold: true })] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { after: 145 },
                children: [text(day.title, { font: "Georgia", size: 34, bold: true })] }),
        );
        if (day.highlight) children.push(new Paragraph({ keepLines: true, keepNext: Boolean(image),
            spacing: { after: 170, line: 295 }, children: [text(day.highlight, { color: muted })] }));
        if (image) children.push(...photo(image, 242));
        children.push(...period("Manhã", day.morning), ...period("Tarde", day.afternoon), ...period("Noite", day.evening));
        if (day.lunch || day.dinner) children.push(label("Onde comer", 90), ...meal("Almoço", day.lunch), ...meal("Jantar", day.dinner));
        children.push(...period("Alternativas", day.alternatives));
        if (day.logistics) children.push(new Paragraph({ keepLines: true, spacing: { before: 130, after: 160, line: 285 },
            shading: { type: ShadingType.CLEAR, fill: "F4F0E8" }, indent: { left: 160, right: 160 },
            children: [text("A ter em conta · ", { bold: true, color: accent, size: 20 }), text(day.logistics, { size: 20 })] }));
    }
    if (itinerary.tips.length) children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 350, after: 160 },
            children: [text("Antes de partir", { font: "Georgia", size: 38, bold: true })] }),
        ...itinerary.tips.map(bullet),
    );
    const document = new Document({
        title: itinerary.title, creator: "Travel Frontiers",
        styles: { paragraphStyles: [{ id: "Title", name: "Title", basedOn: "Normal" }] },
        sections: [{
            properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1060, left: 1000 } } },
            children,
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
