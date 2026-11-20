import {
    AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun, Packer,
    PageNumber, Paragraph, ShadingType, TextRun, Table, TableCell, TableRow, WidthType,
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
const accent = "A13D13";
const border = "E8E3DC";

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
        return new Paragraph({ keepLines: true, spacing: { after: 135, line: 290 },
            children: hasTitle
                ? [text(value.slice(0, separator), { bold: true }), text("  " + value.slice(separator + 3))]
                : [text(value)] });
    })] : [];
}

function journeyOverview(days: Day[]) {
    const widths = [1320, 2730, 5856];
    const row = (values: string[], heading = false) => new TableRow({
        tableHeader: heading, cantSplit: true,
        children: values.map((value, index) => new TableCell({
            width: { size: widths[index], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: heading ? "F1E9DF" : "FFFFFF" },
            margins: { top: 115, bottom: 115, left: 130, right: 130 },
            children: [new Paragraph({ spacing: { after: 0 },
                children: [text(value, { size: 19, bold: heading, color: heading ? accent : ink })] })],
        })),
    });
    return new Table({
        width: { size: 9906, type: WidthType.DXA }, columnWidths: widths,
        borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: border },
        },
        rows: [row(["Dia", "Base ou percurso", "O plano"], true),
            ...days.map(day => row([String(day.number) + (day.date ? "\n" + formatDate(day.date) : ""), day.base, day.title]))],
    });
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
        spacing: { before: 0, after: 240 }, children: [text("A viagem num relance", { font: "Georgia", size: 44, bold: true })] });
    const children: (Paragraph | Table)[] = [
        ...(logo ? [new Paragraph({ keepNext: true, children: [new ImageRun({ data: logo, type: "png", transformation: { width: 62, height: 62 } })] })] : []),
        label("Roteiro de viagem"),
        new Paragraph({ style: "Title", keepNext: true, spacing: { before: 100, after: 220 },
            children: [text(itinerary.title, { font: "Georgia", size: 58, color: "000000", bold: true })] }),
        new Paragraph({ keepNext: true, spacing: { after: 110 }, children: [text([dates, itinerary.days.length + " dias"].filter(Boolean).join(" · "), { size: 23, color: accent, bold: true })] }),
        ...(bases.length ? [new Paragraph({ spacing: { after: 230 }, children: [text(bases.join("  →  "), { size: 21, color: muted })] })] : []),
        ...(cover ? photo(cover, 285) : []),
        new Paragraph({ spacing: { before: 110, after: 110, line: 310 }, children: [text(itinerary.introduction, { size: 23 })] }),
        overview,
        journeyOverview(itinerary.days),
        new Paragraph({ spacing: { before: 180, after: 120, line: 280 }, children: [
            text("As propostas de visita e de restauração complementam os serviços da reserva. Confirma disponibilidade e horários antes de reservar atividades.", { size: 19, color: muted }),
        ] }),
    ];
    for (const [index, day] of itinerary.days.entries()) {
        const image = dayImages[index];
        const previousDay = itinerary.days[index - 1];
        const visits = day.morning.length + day.afternoon.length + day.evening.length;
        const previousVisits = previousDay ? previousDay.morning.length + previousDay.afternoon.length + previousDay.evening.length : 0;
        children.push(
            new Paragraph({ pageBreakBefore: visits >= 5 || previousVisits >= 5, keepNext: true,
                spacing: { before: index > 0 && visits < 5 && previousVisits < 5 ? 320 : 0, after: 95 },
                children: [text(["Dia " + day.number, formatDate(day.date), day.base].filter(Boolean).join(" · "), { size: 19, color: accent, bold: true })] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { after: 145 },
                children: [text(day.title, { font: "Georgia", size: 34, bold: true })] }),
        );
        if (day.highlight) children.push(new Paragraph({ keepLines: true, keepNext: Boolean(image),
            spacing: { after: 170, line: 295 }, children: [text(day.highlight, { color: muted })] }));
        if (image) children.push(...photo(image, 165));
        children.push(...period("Manhã", day.morning), ...meal("Pausa para almoço", day.lunch),
            ...period("Tarde", day.afternoon), ...meal("Onde jantar", day.dinner), ...period("Noite", day.evening));
        children.push(...period("Alternativas", day.alternatives));
        if (day.logistics) children.push(new Paragraph({ keepLines: true, spacing: { before: 130, after: 160, line: 285 },
            shading: { type: ShadingType.CLEAR, fill: "F4F0E8" }, indent: { left: 160, right: 160 },
            children: [text("A ter em conta · ", { bold: true, color: accent, size: 20 }), text(day.logistics, { size: 20 })] }));
    }
    if (itinerary.tips.length) children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true, spacing: { before: 0, after: 160 },
            children: [text("Antes de partir", { font: "Georgia", size: 38, bold: true })] }),
        ...itinerary.tips.map(bullet),
    );
    children.push(...photoCredits(images));
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
