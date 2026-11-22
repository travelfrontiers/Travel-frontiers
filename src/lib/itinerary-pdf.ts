import PDFDocument from "pdfkit";
import type { ItineraryPhoto } from "./itinerary-images";
import type { Itinerary } from "./itinerary-word";

import { guideSections, transportDetails, type Stay } from "./itinerary-guide";

const navy = "#0D2334";
const muted = "#456071";
const orange = "#9C410D";
const sand = "#F8F5ED";
const teal = "#E5F1EF";
const margin = 42;
const width = 511;
const bottom = 785;
const shortDate = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function dateLabel(value: string, format = shortDate) {
    return value ? format.format(new Date(value + "T00:00:00Z")) : "";
}

export async function createItineraryPdf(
    itinerary: Itinerary, images: (ItineraryPhoto | null)[], logo: Buffer,
    stays: Stay[], transitDates: string[], photoQueries?: string[],
) {
    const pdf = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false,
        info: { Title: itinerary.title, Author: "Travel Frontiers" } });
    const chunks: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => {
        pdf.on("data", chunk => chunks.push(chunk));
        pdf.once("end", () => resolve(Buffer.concat(chunks)));
        pdf.once("error", reject);
    });
    let page = 0;
    let y = 0;
    let section = "";
    const write = (value: string, x: number, top: number, options: {
        size?: number; bold?: boolean; color?: string; width?: number; link?: string; align?: "left" | "right" | "center";
    } = {}) => {
        pdf.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.size ?? 11).fillColor(options.color ?? navy);
        const layout = { width: options.width ?? width, lineGap: 2, link: options.link, align: options.align };
        pdf.text(value, x, top, layout);
        return pdf.y;
    };
    function measure(value: string, size: number, textWidth: number, bold = false) {
        return pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size)
            .heightOfString(value, { width: textWidth, lineGap: 2 });
    }
    function addPage(label: string, background = "#FFFFFF") {
        pdf.addPage();
        page++;
        section = label;
        pdf.rect(0, 0, pdf.page.width, pdf.page.height).fill(background);
        pdf.rect(0, 0, pdf.page.width, 55).fill(navy);
        pdf.image(logo, 41, 6, { fit: [49, 43], align: "center", valign: "center" });
        write("TRAVEL FRONTIERS", 100, 23, { size: 10, bold: true, color: "#FFFFFF", width: 160 });
        write(label, 280, 24, { size: 9, color: "#F4D191", width: 273, align: "right" });
        pdf.moveTo(margin, 805).lineTo(margin + width, 805).strokeColor("#D2DDE0").stroke();
        write("TRAVEL FRONTIERS  /  GUIA DE VIAGEM", margin, 814, { size: 8, color: muted });
        write(String(page).padStart(2, "0"), margin, 814, { size: 8, color: orange, align: "right" });
        y = 77;
    }
    function fit(height: number) {
        if (y + height > bottom) addPage(section);
    }
    function heading(title: string, subtitle?: string) {
        y = write(title, margin, y, { size: 23, bold: true }) + 8;
        if (subtitle) y = write(subtitle, margin, y, { color: muted }) + 14;
    }
    function crop(image: ItineraryPhoto, x: number, top: number, w: number, height: number) {
        pdf.save().rect(x, top, w, height).clip();
        try {
            pdf.image(image.buffer, x, top, { cover: [w, height], align: "center", valign: "center" });
        } catch {
            // A photo may be unreadable even when its file signature is valid.
        } finally {
            pdf.restore();
        }
    }
    function card(label: string, title: string, detail: string, background = "#FFFFFF") {
        const inner = width - 32;
        const height = 44 + measure(title, 13, inner, true) + measure(detail, 10.5, inner);
        fit(height);
        pdf.roundedRect(margin, y, width, height, 10).fillAndStroke(background, "#D7E2E5");
        const titleTop = write(label, margin + 16, y + 11, { size: 9, bold: true, color: orange, width: inner }) + 5;
        const detailTop = write(title, margin + 16, titleTop, { size: 13, bold: true, width: inner }) + 3;
        if (detail) write(detail, margin + 16, detailTop, { size: 10.5, color: muted, width: inner });
        y += height + 10;
    }

    const usedPhotos = new Map<string, ItineraryPhoto>();
    function showPhoto(item: ItineraryPhoto, x: number, top: number, w: number, h: number) {
        crop(item, x, top, w, h);
        usedPhotos.set(item.source, item);
    }
    const first = itinerary.days[0]?.date;
    const last = itinerary.days.at(-1)?.date;
    const range = [...new Set([first, last].filter((value): value is string => Boolean(value)))]
        .map(value => dateLabel(value, longDate)).join(" – ");
    const cover = photoQueries ? images[0] : images[0] ?? images.find(Boolean);

    pdf.addPage();
    page++;
    pdf.rect(0, 0, pdf.page.width, pdf.page.height).fill(navy);
    if (cover) {
        showPhoto(cover, 0, 0, pdf.page.width, 500);
        pdf.save().fillOpacity(0.68).rect(0, 0, pdf.page.width, 500).fill(navy).restore();
    }
    pdf.image(logo, margin, 35, { fit: [85, 74], align: "center", valign: "center" });
    write("TRAVEL FRONTIERS", margin + 99, 62, { size: 16, bold: true, color: "#FFFFFF" });
    write("GUIA DE VIAGEM", margin, 149, { size: 12, bold: true, color: "#F4D191" });
    const title = itinerary.title.toLocaleUpperCase("pt-PT");
    const titleSize = measure(title, 39, 490, true) > 200 ? 30 : 39;
    const titleEnd = write(title, margin, 177, { size: titleSize, bold: true, color: "#FFFFFF", width: 490 });
    pdf.rect(margin, titleEnd + 15, 100, 3).fill("#F4C05D");
    const datesEnd = write(range, margin, 532, { size: 17, bold: true, color: "#FFFFFF" });
    const durationEnd = write(itinerary.days.length + " dias", margin, datesEnd + 9, { color: "#F4D191", bold: true });
    const route = itinerary.route.map(place => place.trim()).filter(Boolean).join("  ·  ");
    const routeEnd = route ? write(route, margin, durationEnd + 12, { size: 11, color: "#FFFFFF" }) : durationEnd;
    const introTop = routeEnd + 15;
    if (measure(itinerary.introduction, 12, width) + introTop <= bottom) {
        write(itinerary.introduction, margin, introTop, { size: 12, color: "#FFFFFF" });
    } else {
        addPage("APRESENTAÇÃO");
        heading("A tua viagem", itinerary.introduction);
    }

    addPage("CIRCUITO");
    heading("A viagem num relance");
    const { groups, hotels, transfers } = guideSections(itinerary, stays, transitDates);
    for (const group of groups) {
        const dates = [...new Set([group.from, group.to].filter(Boolean))].map(value => dateLabel(value)).join(" – ");
        card(dates || "PERCURSO", group.base || "Etapa da viagem", group.days.join(" · "));
    }

    if (stays.length) {
        addPage("ALOJAMENTO");
        heading("Onde vais ficar", "Alojamentos identificados no documento da viagem.");
        for (const stay of hotels) {
            const { nights } = stay;
            card("ALOJAMENTO", stay.nome, ["Entrada " + dateLabel(stay.entrada), "Saída " + dateLabel(stay.saida),
                nights > 0 ? nights + (nights === 1 ? " noite" : " noites") : ""].filter(Boolean).join("  ·  "));
        }
    }

    if (transfers.length) {
        addPage("TRANSPORTES");
        heading("De etapa em etapa", "Consulta os bilhetes para confirmar os horários e as ligações previstas.");
        for (const day of transfers) {
            const date = dateLabel(day.date);
            if (day.logistics) card(date, day.base || day.title, day.logistics);
            for (const segment of day.transports ?? []) card(date, segment.route, transportDetails(segment), teal);
        }
    }

    for (const [index, day] of itinerary.days.entries()) {
        addPage("DIA " + day.number, sand);
        const titleWidth = width - 69;
        pdf.roundedRect(margin, y, 54, 48, 10).fill("#A54413");
        write(String(day.number).padStart(2, "0"), margin, y + 12,
            { size: 21, bold: true, color: "#FFFFFF", width: 54, align: "center" });
        const placeTop = write(dateLabel(day.date), margin + 69, y, { size: 10, bold: true, color: muted, width: titleWidth }) + 3;
        y = Math.max(y + 48, write(day.base, margin + 69, placeTop, { size: 22, bold: true, width: titleWidth })) + 10;
        y = write(day.title, margin, y, { size: 16, bold: true }) + 8;
        const nearbyPhoto = images.slice(1, index + 2).findLast((item, photoIndex) =>
            item && itinerary.days[photoIndex].base === day.base);
        const picture = photoQueries ? images[index + 1] : images[index + 1] ?? nearbyPhoto;
        if (picture) {
            showPhoto(picture, margin, y, width, 70);
            y = write(picture.location, margin, y + 73, { size: 8, color: muted, align: "right" }) + 6;
        }
        if (day.highlight) y = write(day.highlight, margin, y, { color: muted }) + 8;
        for (const [label, items] of [["MANHÃ", day.morning], ["TARDE", day.afternoon], ["NOITE", day.evening],
            ["ALTERNATIVAS", day.alternatives]] as const) {
            if (!items.length) continue;
            for (const [itemIndex, item] of items.entries()) {
                const [name, ...rest] = item.split(" — ");
                const description = rest.join(" — ");
                const col = width - 79;
                const combined = description ? name + "  " + description : name;
                const itemHeight = measure(combined, 10.3, col, true);
                fit(itemHeight + 7);
                if (itemIndex === 0) write(label, margin, y, { size: 8.5, bold: true, color: orange, width: 76 });
                if (description) {
                    pdf.font("Helvetica-Bold").fontSize(10.3).fillColor(navy)
                        .text(name + "  ", margin + 79, y, { width: col, lineGap: 2, continued: true });
                    pdf.font("Helvetica").fillColor(muted).text(description);
                    y = pdf.y;
                } else {
                    y = write(name, margin + 79, y, { width: col, size: 10.3 });
                }
                y += 4;
            }
        }
        const meals = [["ALMOÇO", day.lunch], ["JANTAR", day.dinner]].flatMap(([label, meal]) =>
            typeof meal === "object" && meal ? [{ label: String(label), meal }] : []);
        if (meals.length) {
            const column = meals.length === 2 ? (width - 12) / 2 : width;
            const mealDetails = (meal: NonNullable<typeof day.lunch>) => [meal.porque, meal.morada, meal.preco].filter(Boolean).join(" · ");
            const height = Math.max(...meals.map(({ meal }) => 48 + measure(meal.nome, 11, column - 28, true)
                + measure(mealDetails(meal), 10, column - 28)));
            fit(height + 14);
            for (const [mealIndex, { label, meal }] of meals.entries()) {
                const x = margin + mealIndex * (column + 12);
                const opts = { width: column - 28 };
                pdf.roundedRect(x, y, column, height, 9).fillAndStroke("#FFFFFF", "#D7E2E5");
                const nameTop = write(label, x + 14, y + 11, { ...opts, size: 9, bold: true, color: orange }) + 3;
                const detailsTop = write(meal.nome, x + 14, nameTop, { ...opts, bold: true }) + 3;
                const linkTop = write(mealDetails(meal), x + 14, detailsTop, { ...opts, size: 10, color: muted }) + 4;
                if (meal.maps) write("Abrir no Google Maps", x + 14, linkTop, { ...opts, size: 10, color: "#174C73", link: meal.maps });
            }
            y += height + 8;
        }
        for (const segment of day.transports ?? []) card("TRANSPORTE", segment.route, transportDetails(segment), teal);
        if (day.logistics) {
            const height = measure(day.logistics, 10, width - 28) + 33;
            fit(height);
            pdf.roundedRect(margin, y, width, height, 9).fill(teal);
            const top = write("LOGÍSTICA", margin + 14, y + 10, { size: 9, bold: true, color: orange }) + 3;
            y = write(day.logistics, margin + 14, top, { size: 10, width: width - 28 });
        }
    }

    if (itinerary.tips.length || usedPhotos.size) {
        addPage("INFORMAÇÕES PRÁTICAS");
        if (itinerary.tips.length) {
            heading("Antes de partir");
            for (const tip of itinerary.tips) {
                fit(measure(tip, 11, width - 14) + 12);
                write("•", margin, y, { size: 11, color: orange });
                y = write(tip, margin + 14, y, { width: width - 14 }) + 11;
            }
        }
        if (usedPhotos.size) {
            fit(75);
            heading("Créditos das fotografias");
            for (const photo of usedPhotos.values()) {
                const credit = [photo.location, photo.author].filter(Boolean).join(" · ");
                fit(measure(credit, 10, width) + 30);
                y = write(credit, margin, y, { size: 10, color: muted, link: photo.source }) + 2;
                y = write(photo.license, margin, y, { size: 9, color: "#174C73", link: photo.licenseUrl }) + 9;
            }
        }
    }
    pdf.end();
    return result;
}
