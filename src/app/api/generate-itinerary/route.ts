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

        // 3. TWO-STEP APPROACH with systemInstruction to eliminate ALL echo.
        const genAI = new GoogleGenerativeAI(apiKey);

        // ── STEP 1: Extract key travel facts (simple model, no system instruction needed) ──
        const extractorModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }, { apiVersion: 'v1beta' });

        const extractionPrompt = `Extrai APENAS os dados concretos (Destino, Datas, Viajantes, Hotéis, Voos, Atividades) desta reserva.
É absolutamente essencial que resumas tudo em menos de 200 palavras.

<SOURCE_DOCUMENT>
${extractedText.substring(0, 30000)}
</SOURCE_DOCUMENT>`;

        const extractionResult = await extractorModel.generateContent(extractionPrompt);
        let travelFacts = extractionResult.response.text();
        
        // Failsafe: if the model still dumps 4 pages, forcefully clip it so step 2 isn't overwhelmed.
        if (travelFacts.length > 2000) {
            travelFacts = travelFacts.substring(0, 2000) + '... (truncated)';
        }

        // ── STEP 2: Generate itinerary JSON ──
        const itineraryModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }, { apiVersion: 'v1beta' });

        const itineraryPrompt = `És um planeador de viagens de luxo da "Travel Frontiers" (Portugal).
Escreve EXCLUSIVAMENTE em Português de Portugal.
O TEU OUTPUT DEVE SER APENAS UM OBJETO JSON VÁLIDO. NÃO ESCREVAS MAIS NADA ANTES NEM DEPOIS DO JSON.

<TRAVEL_DATA>
${travelFacts}
Notas adicionais: ${notes || 'Nenhuma'}
</TRAVEL_DATA>

Exemplo de estrutura JSON OBRIGATÓRIA que deves gerar baseada apenas nos dados acima:
{
  "introducao": "Um parágrafo entusiasta sobre o destino (3-4 frases, garantindo um tom de luxo).",
  "dicas": [
    "Transporte: como se mover...",
    "Moeda: moeda local...",
    "Língua: idioma e 3 frases...",
    "Clima: o que esperar...",
    "Segurança: dicas...",
    "Vestuário: como se vestir...",
    "Emergências: número local..."
  ],
  "dias": [
    {
      "titulo_dia": "DIA 1: Roma - Cidade Antiga",
      "atividades": [
        "09:00: Visita ao Coliseu",
        "11:30: Fórum Romano"
      ],
      "sugestao_almoco": {
        "nome": "Trattoria Romana",
        "porque": "Razão descritiva",
        "morada": "Via del Corso, 12",
        "maps": "https://www.google.com/maps/search/?api=1&query=Trattoria+Romana+Roma",
        "preco": "€€"
      },
      "sugestao_jantar": {
        "nome": "Osteria da Fortunata",
        "porque": "Razão descritiva",
        "morada": "Via del Pellegrino, 11",
        "maps": "https://www.google.com/maps/search/?api=1&query=Osteria+da+Fortunata+Roma",
        "preco": "€€€"
      },
      "imagem_nome_ingles": "Colosseum Rome"
    }
  ]
}

Responde APENAS com o JSON FINAL correspondente a esta viagem, sem backticks e sem comentários.`;

        const itineraryResult = await itineraryModel.generateContent(itineraryPrompt);
        const aiText = itineraryResult.response.text();

        // Extract JSON to strictly avoid any surrounding garbage text
        const jsonMatch = aiText.match(/\{[\s\S]*\}$/m);
        if (!jsonMatch) {
            throw new Error("A Inteligência Artificial falhou ao formatar o itinerário.");
        }

        let itineraryData;
        try {
            itineraryData = JSON.parse(jsonMatch[0]);
        } catch (err) {
            throw new Error("A Inteligência Artificial gerou um formato JSON inválido.");
        }

        // 4. Image Fetching Logic (Wikimedia Commons Free API)
        const imageTags = (itineraryData.dias || []).map((d: any) => d.imagem_nome_ingles).filter(Boolean);
        const destinationFromTitle = title ? (title.split(/[-–—|,]/)[1] || title).trim() : 'Europe';
        const coverQuery = destinationFromTitle;

        const allImageQueries = [coverQuery, ...imageTags];
        const allImageResults = await Promise.all(
            allImageQueries.map(query => fetchFreeTravelImage(query))
        );

        const coverResult = allImageResults[0];
        const dailyResults = allImageResults.slice(1);
        const logoBuffer = await fetchImageBuffer("https://www.travelfrontiers.pt/img/logo-newTF.png").catch(() => null);

        // 6. Build DOCX with professional layout
        const GOLD = 'B8963E';
        const DARK = '1A1A2E';
        const GRAY = '6B7280';
        const children: any[] = [];

        // ── COVER PAGE ──
        if (coverResult?.buffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new ImageRun({ data: coverResult.buffer, transformation: { width: 620, height: 380 }, type: coverResult.type })]
            }));
        }
        children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 18, color: GOLD } }, spacing: { before: 160, after: 200 }, children: [] }));
        if (logoBuffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 140 },
                children: [new ImageRun({ data: logoBuffer, transformation: { width: 100, height: 100 }, type: 'png' })]
            }));
        }
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({ text: (title || 'Itinerário de Viagem').toUpperCase(), bold: true, size: 52, color: DARK, font: 'Georgia' })]
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 160 },
            children: [new TextRun({ text: 'Travel Frontiers  ·  Viagens de Luxo', italics: true, size: 22, color: GRAY, font: 'Calibri' })]
        }));
        children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GOLD } }, spacing: { before: 0, after: 0 }, children: [] }));
        children.push(new Paragraph({ spacing: { before: 400 }, children: [new PageBreak()] }));

        // ── BODY: Programmatic Rendering ──

        // Introdução
        if (itineraryData.introducao) {
            children.push(new Paragraph({
                spacing: { before: 60, after: 120 },
                children: [new TextRun({ text: itineraryData.introducao, size: 22, font: 'Calibri', color: DARK, italics: true })]
            }));
        }

        // Dicas
        if (Array.isArray(itineraryData.dicas) && itineraryData.dicas.length > 0) {
            children.push(new Paragraph({
                spacing: { before: 240, after: 120 },
                children: [new TextRun({ text: "DICAS PRÁTICAS:", bold: true, size: 22, color: GOLD, font: 'Calibri' })]
            }));
            itineraryData.dicas.forEach((dica: string) => {
                children.push(new Paragraph({
                    spacing: { before: 60, after: 60 },
                    children: [new TextRun({ text: dica, size: 21, font: 'Calibri', color: DARK })]
                }));
            });
        }

        // Dias
        let currentImageIndex = 0;
        if (Array.isArray(itineraryData.dias)) {
            itineraryData.dias.forEach((dia: any) => {
                // Título
                if (dia.titulo_dia) {
                    children.push(new Paragraph({
                        spacing: { before: 520, after: 160 },
                        shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
                        children: [new TextRun({ text: '  ' + dia.titulo_dia.toUpperCase() + '  ', bold: true, size: 26, color: 'FFFFFF', font: 'Calibri' })]
                    }));
                }

                // Atividades
                if (Array.isArray(dia.atividades)) {
                    dia.atividades.forEach((ativ: string) => {
                        children.push(new Paragraph({
                            spacing: { before: 80, after: 80 },
                            indent: { left: 360 },
                            children: [new TextRun({ text: `• ${ativ}`, size: 21, font: 'Calibri', color: DARK })]
                        }));
                    });
                }

                // Restaurantes helper function
                const renderRestaurant = (mealType: string, s: any) => {
                    if (!s) return;
                    children.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({ text: mealType, bold: true, size: 22, color: GOLD, font: 'Calibri' })]
                    }));
                    if (s.nome) children.push(new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720 }, children: [new TextRun({ text: `o Sugestão: ${s.nome}`, size: 20, font: 'Calibri', color: GRAY })] }));
                    if (s.porque) children.push(new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720 }, children: [new TextRun({ text: `o Porquê: ${s.porque}`, size: 20, italics: true, font: 'Calibri', color: GRAY })] }));
                    if (s.morada) children.push(new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720 }, children: [new TextRun({ text: `o Morada: ${s.morada}`, size: 20, font: 'Calibri', color: GRAY })] }));
                    if (s.maps) children.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 720 },
                        children: [
                            new TextRun({ text: 'o  ', size: 20, font: 'Calibri', color: GRAY }),
                            new ExternalHyperlink({ link: s.maps, children: [new TextRun({ text: '📍 Ver no Google Maps', size: 20, color: '1155CC', underline: {}, font: 'Calibri' })] })
                        ]
                    }));
                    if (s.preco) children.push(new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720 }, children: [new TextRun({ text: `o Preço: ${s.preco}`, size: 20, font: 'Calibri', color: GRAY })] }));
                };

                renderRestaurant("Sugestão para Almoço:", dia.sugestao_almoco);
                renderRestaurant("Sugestão para Jantar:", dia.sugestao_jantar);

                // Imagem
                if (dia.imagem_nome_ingles) {
                    const imgRes = dailyResults[currentImageIndex++];
                    if (imgRes?.buffer) {
                        children.push(new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 300, after: 300 },
                            children: [new ImageRun({ data: imgRes.buffer, transformation: { width: 520, height: 290 }, type: imgRes.type })]
                        }));
                    }
                }
            });
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
