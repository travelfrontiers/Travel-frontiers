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

        // 3. TWO-STEP APPROACH to permanently eliminate prompt echo.
        // Step 1: Extract key facts from the source document.
        // Step 2: Generate itinerary from ONLY those facts (raw text never enters step 2).
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemma-4-31b-it' }, { apiVersion: 'v1beta' });

        // ── STEP 1: Extract key travel facts ──
        const extractionPrompt = `Extrai APENAS os dados concretos desta reserva de viagem. Responde APENAS com os campos abaixo, sem mais nada:

Destino:
Datas:
Duração:
Viajantes:
Hotéis:
Voos:
Atividades mencionadas:
Outras notas:

Documento:
${extractedText.substring(0, 30000)}`;

        const extractionResult = await model.generateContent(extractionPrompt);
        const travelFacts = extractionResult.response.text();

        // ── STEP 2: Generate the itinerary from ONLY the extracted facts ──
        // The raw source document text is NOT included here — impossible to echo.
        const itineraryPrompt = `És um planeador de viagens de luxo da "Travel Frontiers" (Portugal).
Escreve EXCLUSIVAMENTE em Português de Portugal. Nem uma única palavra em inglês.
Não escrevas instruções, introduções sobre o que vais fazer, ou comentários. Vai direto ao conteúdo.

Dados da viagem:
${travelFacts}

Notas adicionais: ${notes || 'Nenhuma'}

Escreve o itinerário completo com esta estrutura EXACTA:

INTRODUÇÃO
Um parágrafo entusiasta sobre o destino (3-4 frases).

DICAS PRÁTICAS
Transporte: [como se mover na cidade]
Moeda: [moeda local e dicas de pagamento]
Língua: [idioma local e 3 frases úteis]
Clima: [o que esperar]
Segurança: [dicas para turistas]
Vestuário: [como se vestir]
Emergências: [número de emergência e hospital central]

ITINERÁRIO DIA A DIA
Para cada dia usa esta estrutura:
DIA X: [CIDADE] - [TEMA DO DIA]
• HH:MM: [Atividade com dica prática]

Sugestão para Almoço:
o Sugestão: [Nome do restaurante]
o Porquê: [Razão detalhada]
o Morada: [Endereço completo real]
o Maps: https://www.google.com/maps/search/?api=1&query=[Nome+Restaurante+Cidade]
o Preço: [€, €€, ou €€€]

Sugestão para Jantar:
(mesmo formato)

Depois de cada local importante, insere: [IMAGE: English Location Name]
Exemplo: [IMAGE: Colosseum Rome]

NÃO uses Markdown. NÃO escrevas ** ou #.`;

        const itineraryResult = await model.generateContent(itineraryPrompt);
        const aiText = itineraryResult.response.text();


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

        // Post-process: strip any residual markdown or echoed instructions
        const cleanedText = aiText
            .replace(/\*\*/g, '')      // remove bold markdown
            .replace(/^#+\s*/gm, '')   // remove heading markdown
            .replace(/^---+$/gm, '')   // remove horizontal rules
            .replace(/^===.*===$/gm, '') // remove any marker lines
            .trim();

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

        // ── BODY: Parse cleaned AI text and render each line ──
        let currentImageIndex = 0;
        const bodyLines = cleanedText.split('\n');

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
