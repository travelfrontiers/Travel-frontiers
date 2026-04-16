import { NextResponse } from 'next/server';
import { client } from '../../../sanity/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer, BorderStyle, PageBreak, ShadingType, ExternalHyperlink } from 'docx';
import mammoth from 'mammoth';

// Polyfill for libraries expecting browser-only DOMMatrix in a Node environment (fixes Vercel build)
if (typeof global !== 'undefined' && typeof (global as any).DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class {};
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image from ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

async function fetchFreeTravelImage(query: string): Promise<{ buffer: Buffer; type: 'jpg' | 'png' } | null> {
    try {
        const cleanQuery = query.replace(/professional travel photo of/i, '').trim();
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(cleanQuery + " landmark")}&gsrlimit=1&pithumbsize=1200`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data?.query?.pages) {
            const pages = Object.values(data.query.pages) as any[];
            if (pages.length > 0 && pages[0].thumbnail) {
                const imgUrl: string = pages[0].thumbnail.source;
                const imgResponse = await fetch(imgUrl);
                if (imgResponse.ok) {
                    const type = imgUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
                    return { buffer: Buffer.from(await imgResponse.arrayBuffer()), type };
                }
            }
        }
        return null;
    } catch (e) {
        console.warn('Failed to fetch Wikimedia image:', e);
        return null;
    }
}

export async function POST(request: Request) {
    const pdfParse = require('pdf-parse');
    try {
        const body = await request.json();
        const { fileRef, title, notes } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

        // 1. Fetch file from Sanity
        const asset = await client.fetch('*[_id == $id][0]{ url, extension }', { id: fileRef });
        if (!asset || !asset.url) throw new Error("Could not find file asset.");

        const fileResponse = await fetch(asset.url);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extract Text
        let extractedText = "";
        if (asset.extension === 'pdf') {
            const data = await pdfParse(buffer);
            extractedText = data.text;
        } else if (asset.extension === 'docx' || asset.extension === 'doc') {
            const docxData = await mammoth.extractRawText({ buffer });
            extractedText = docxData.value;
        } else if (asset.extension === 'txt') {
            extractedText = buffer.toString('utf-8');
        }

        if (!extractedText.trim()) throw new Error("Empty source file.");

        // 3. Generate Detailed Itinerary with Gemini (Official 2026 Gemma 4 Config)
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemma-4-31b-it' }, { apiVersion: 'v1beta' });

        // The model MUST start with ===INÍCIO=== — we split on it to guarantee
        // no prompt echo or source document text ever appears in the output.
        const textPrompt = `És um planeador de viagens de luxo da "Travel Frontiers" (Portugal).
Responde EXCLUSIVAMENTE em Português de Portugal. Nem uma única palavra em inglês.
A tua resposta DEVE começar OBRIGATORIAMENTE com ===INÍCIO=== na primeira linha, sem espaço antes.
Não escrevas NADA antes de ===INÍCIO===.

REGRAS DE FORMATAÇÃO:

SECÇÃO 1 — INTRODUÇÃO:
Escreve um parágrafo entusiasta sobre o destino (3-4 frases inspiradoras).

SECÇÃO 2 — DICAS PRÁTICAS:
Inclui uma secção "DICAS PRÁTICAS" com estes tópicos em linhas separadas:
  Transporte: [como se mover - metro, autocarro, táxi, à pé]
  Moeda: [moeda local e dicas de pagamento]
  Língua: [idioma local e 3 frases úteis]
  Clima: [melhor época e o que esperar]
  Segurança: [dicas de segurança para turistas]
  Vestuário: [como se vestir, locais religiosos]
  Emergências: [número de emergência e hospital mais próximo do centro]

SECÇÃO 3 — ITINERÁRIO DIA A DIA:
- Formato obrigatório do título do dia: DIA X: [CIDADE] - [TEMA DO DIA]
- Dentro de cada dia usa horários: • HH:MM: [Atividade com dica prática]
- Em cada dia inclui Almoço e Jantar com este formato exacto:
  Sugestão para Almoço:
  o Sugestão: [Nome do restaurante]
  o Porquê: [Razão detalhada]
  o Morada: [Endereço completo]
  o Maps: https://www.google.com/maps/search/?q=[Nome+Restaurante+Cidade]
  o Preço: [€, €€, ou €€€]
- Insere tags de fotografia: [IMAGE: ExactEnglishLocationName]
  Exemplo: [IMAGE: Colosseum Rome]

===INÍCIO===

DADOS DA VIAGEM (usa apenas como referência para criar o itinerário):
---
${extractedText.substring(0, 40000)}
---
Notas do utilizador: ${notes || 'Nenhuma'}
`;

        const result = await model.generateContent(textPrompt);
        const rawAiText = result.response.text();

        // Split on the ===INÍCIO=== marker — everything before it is discarded.
        // This is the only reliable way to strip prompt echo and source document text.
        const markerIndex = rawAiText.indexOf('===INÍCIO===');
        const aiText = markerIndex >= 0
            ? rawAiText.slice(markerIndex + '===INÍCIO==='.length).trim()
            : rawAiText.trim();

        // 4. Image Fetching Logic (Wikimedia Commons Free API)
        const imageTags = Array.from(aiText.matchAll(/\[IMAGE:\s*(.*?)\]/g));
        // Extract the destination city from the title for the cover image.
        // e.g. "Diana Granja - Roma" → "Roma", "Lisbon Tour" → "Lisbon Tour"
        const destinationFromTitle = title
            ? (title.split(/[-–—|,]/)[1] || title).trim()
            : 'Europe';
        const coverQuery = destinationFromTitle;

        const allImageQueries = [coverQuery, ...imageTags.map(m => m[1])];
        const allImageResults = await Promise.all(
            allImageQueries.map(query => fetchFreeTravelImage(query))
        );

        const coverResult = allImageResults[0];
        const dailyResults = allImageResults.slice(1);
        const logoBuffer = await fetchImageBuffer("https://www.travelfrontiers.pt/img/logo-newTF.png").catch(() => null);

        // aiText is already clean — the ===INÍCIO=== marker stripped everything before the itinerary.

        // 6. Build DOCX with professional layout
        const GOLD = 'B8963E';
        const DARK = '1A1A2E';
        const GRAY = '6B7280';
        const children: any[] = [];

        // ── COVER PAGE: Large photo + logo + branded title block ──
        if (coverResult?.buffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new ImageRun({
                    data: coverResult.buffer,
                    transformation: { width: 620, height: 380 },
                    type: coverResult.type
                })]
            }));
        }

        // Gold border under photo
        children.push(new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 18, color: GOLD } },
            spacing: { before: 160, after: 200 },
            children: []
        }));

        // Logo on cover page
        if (logoBuffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 140 },
                children: [new ImageRun({ data: logoBuffer, transformation: { width: 100, height: 100 }, type: 'png' })]
            }));
        }

        // Destination title
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({
                text: (title || 'Itinerário de Viagem').toUpperCase(),
                bold: true, size: 52, color: DARK, font: 'Georgia'
            })]
        }));

        // Subtitle
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 160 },
            children: [new TextRun({
                text: 'Travel Frontiers  ·  Viagens de Luxo',
                italics: true, size: 22, color: GRAY, font: 'Calibri'
            })]
        }));

        // Gold bottom border bar
        children.push(new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GOLD } },
            spacing: { before: 0, after: 0 },
            children: []
        }));

        // Page break after cover
        children.push(new Paragraph({
            spacing: { before: 400 },
            children: [new PageBreak()]
        }));

        // ── BODY: Parse AI text and render each line ──
        let currentImageIndex = 0;
        const bodyLines = aiText.split('\n');

        for (const line of bodyLines) {
            const cleanLine = line.replace(/\[IMAGE:.*?\]/g, '').trim();

            if (cleanLine) {
                if (cleanLine.match(/^DIA \d+/i)) {
                    // Day heading – dark bar
                    children.push(new Paragraph({
                        spacing: { before: 520, after: 160 },
                        shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
                        children: [new TextRun({ text: '  ' + cleanLine.toUpperCase() + '  ', bold: true, size: 26, color: 'FFFFFF', font: 'Calibri' })]
                    }));
                } else if (cleanLine.startsWith('•') || cleanLine.match(/^\d{2}:\d{2}/)) {
                    // Timeline items
                    children.push(new Paragraph({
                        spacing: { before: 80, after: 80 },
                        indent: { left: 360 },
                        children: [new TextRun({ text: cleanLine, size: 21, font: 'Calibri', color: DARK })]
                    }));
                } else if (cleanLine.startsWith('o Morada:')) {
                    // Restaurant address
                    children.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 720 },
                        children: [new TextRun({ text: cleanLine, size: 20, font: 'Calibri', color: GRAY })]
                    }));
                } else if (cleanLine.startsWith('o Maps:')) {
                    // Google Maps link — rendered as clickable hyperlink
                    const url = cleanLine.replace('o Maps:', '').trim();
                    children.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 720 },
                        children: [
                            new TextRun({ text: 'o  ', size: 20, font: 'Calibri', color: GRAY }),
                            new ExternalHyperlink({
                                link: url,
                                children: [new TextRun({ text: '📍 Ver no Google Maps', size: 20, color: '1155CC', underline: {}, font: 'Calibri' })]
                            })
                        ]
                    }));
                } else if (cleanLine.startsWith('o Sugestão') || cleanLine.startsWith('o Porquê') || cleanLine.startsWith('o Preço')) {
                    // Restaurant card sub-items
                    children.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 720 },
                        children: [new TextRun({ text: cleanLine, size: 20, italics: cleanLine.startsWith('o Porquê'), font: 'Calibri', color: GRAY })]
                    }));
                } else if (cleanLine.length < 80 && cleanLine.includes(':') && !cleanLine.startsWith('http') && !cleanLine.startsWith('o ')) {
                    // Sub-headings (Sugestão para Almoço, DICAS PRÁTICAS, etc.)
                    children.push(new Paragraph({
                        spacing: { before: 280, after: 80 },
                        children: [new TextRun({ text: cleanLine, bold: true, size: 22, color: GOLD, font: 'Calibri' })]
                    }));
                } else {
                    // Regular paragraph
                    children.push(new Paragraph({
                        spacing: { before: 60, after: 60 },
                        children: [new TextRun({ text: cleanLine, size: 21, font: 'Calibri', color: DARK })]
                    }));
                }
            }

            // Insert Wikimedia photo after image tags
            if (line.includes('[IMAGE:')) {
                const imgRes = dailyResults[currentImageIndex++];
                if (imgRes?.buffer) {
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 200 },
                        children: [new ImageRun({
                            data: imgRes.buffer,
                            transformation: { width: 520, height: 290 },
                            type: imgRes.type
                        })]
                    }));
                }
            }
        }

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1000, right: 900, bottom: 1000, left: 900 }
                    }
                },
                children,
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 120, after: 60 },
                                children: [
                                    ...(logoBuffer ? [new ImageRun({ data: logoBuffer, transformation: { width: 30, height: 30 }, type: 'png' })] : []),
                                    new TextRun({ text: '  Travel Frontiers', bold: true, size: 20, color: GOLD, font: 'Calibri' }),
                                    new TextRun({ text: '   |   www.travelfrontiers.pt   |   @tf.travel.frontiers', size: 18, color: GRAY, font: 'Calibri' }),
                                ]
                            })
                        ]
                    })
                }
            }]
        });

        const docxBuffer = await Packer.toBuffer(doc);
        return new NextResponse(new Uint8Array(docxBuffer) as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename=Itinerary_${(title || 'Trip').replace(/\s/g, '_')}.docx`
            }
        });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
