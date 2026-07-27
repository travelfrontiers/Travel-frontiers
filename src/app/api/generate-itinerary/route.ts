import { NextResponse } from 'next/server';
import { client } from '../../../sanity/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer, BorderStyle, PageBreak, ShadingType, ExternalHyperlink, Tab, TabStopPosition, TabStopType, Header } from 'docx';
import mammoth from 'mammoth';

// Polyfill for libraries expecting browser-only DOMMatrix in a Node environment (fixes Vercel build)
if (typeof global !== 'undefined' && typeof (global as any).DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class {};
}

// ── Brand Constants ──
const GOLD = 'B8963E';
const DARK = '1A1A2E';
const GRAY = '6B7280';
const LIGHT_BG = 'F9F7F3';
const WHITE = 'FFFFFF';

// ── Image Fetching: Pexels API (high-quality travel photos) ──

async function fetchPexelsImage(query: string, orientation: 'landscape' | 'portrait' = 'landscape'): Promise<{ buffer: Buffer; type: 'jpg' | 'png' } | null> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
        console.warn('PEXELS_API_KEY not set, falling back to Wikimedia');
        return fetchWikimediaImage(query);
    }

    try {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=3&size=large`;
        const response = await fetch(url, {
            headers: { 'Authorization': apiKey }
        });

        if (!response.ok) {
            console.warn(`Pexels API error (${response.status}), falling back to Wikimedia`);
            return fetchWikimediaImage(query);
        }

        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            // Pick the first result, use the "large" size (940px wide — good for DOCX)
            const photo = data.photos[0];
            const imgUrl = photo.src.large2x || photo.src.large || photo.src.original;
            const imgResponse = await fetch(imgUrl);
            if (imgResponse.ok) {
                return { buffer: Buffer.from(await imgResponse.arrayBuffer()), type: 'jpg' };
            }
        }
        // Fallback if no Pexels results
        return fetchWikimediaImage(query);
    } catch (e) {
        console.warn('Pexels fetch failed, falling back to Wikimedia:', e);
        return fetchWikimediaImage(query);
    }
}

async function fetchWikimediaImage(query: string): Promise<{ buffer: Buffer; type: 'jpg' | 'png' } | null> {
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
        console.warn('Wikimedia fetch failed:', e);
        return null;
    }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image from ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

// ── DOCX Helpers ──

function goldDivider(): Paragraph {
    return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
        spacing: { before: 120, after: 120 },
        children: []
    });
}

function sectionSpacer(size: number = 300): Paragraph {
    return new Paragraph({ spacing: { before: size, after: 0 }, children: [] });
}

function renderInfoRow(icon: string, label: string, value: string): Paragraph {
    return new Paragraph({
        spacing: { before: 80, after: 80 },
        indent: { left: 360 },
        children: [
            new TextRun({ text: `${icon}  `, size: 22, font: 'Calibri' }),
            new TextRun({ text: `${label}: `, bold: true, size: 22, font: 'Calibri', color: DARK }),
            new TextRun({ text: value, size: 22, font: 'Calibri', color: GRAY }),
        ]
    });
}

function renderRestaurantCard(mealIcon: string, mealLabel: string, s: any): Paragraph[] {
    if (!s) return [];
    const paragraphs: Paragraph[] = [];

    // Meal type header with icon
    paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        shading: { type: ShadingType.SOLID, color: LIGHT_BG, fill: LIGHT_BG },
        indent: { left: 360 },
        children: [
            new TextRun({ text: `${mealIcon}  ${mealLabel}`, bold: true, size: 22, color: GOLD, font: 'Calibri' }),
        ]
    }));

    if (s.nome) {
        paragraphs.push(new Paragraph({
            spacing: { before: 40, after: 40 },
            indent: { left: 720 },
            children: [
                new TextRun({ text: '▸ ', size: 20, color: GOLD, font: 'Calibri' }),
                new TextRun({ text: s.nome, bold: true, size: 21, font: 'Calibri', color: DARK }),
                ...(s.preco ? [new TextRun({ text: `  (${s.preco})`, size: 20, font: 'Calibri', color: GRAY })] : []),
            ]
        }));
    }
    if (s.porque) {
        paragraphs.push(new Paragraph({
            spacing: { before: 20, after: 40 },
            indent: { left: 720 },
            children: [new TextRun({ text: s.porque, italics: true, size: 20, font: 'Calibri', color: GRAY })]
        }));
    }
    if (s.morada) {
        paragraphs.push(new Paragraph({
            spacing: { before: 20, after: 20 },
            indent: { left: 720 },
            children: [new TextRun({ text: `📍 ${s.morada}`, size: 19, font: 'Calibri', color: GRAY })]
        }));
    }
    if (s.maps) {
        paragraphs.push(new Paragraph({
            spacing: { before: 20, after: 60 },
            indent: { left: 720 },
            children: [
                new ExternalHyperlink({
                    link: s.maps,
                    children: [new TextRun({ text: '🗺 Ver no Google Maps', size: 19, color: '1155CC', underline: {}, font: 'Calibri' })]
                })
            ]
        }));
    }

    return paragraphs;
}

// ── Main API Route ──

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

        // 3. TWO-STEP AI APPROACH
        const genAI = new GoogleGenerativeAI(apiKey);

        // ── STEP 1: Extract key travel facts ──
        const extractorModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }, { apiVersion: 'v1beta' });

        const extractionPrompt = `Extrai APENAS os dados concretos (Destino, Datas, Viajantes, Hotéis, Voos, Atividades) desta reserva.
É absolutamente essencial que resumas tudo em menos de 200 palavras.

<SOURCE_DOCUMENT>
${extractedText.substring(0, 30000)}
</SOURCE_DOCUMENT>`;

        const extractionResult = await extractorModel.generateContent(extractionPrompt);
        let travelFacts = extractionResult.response.text();

        // Failsafe: clip if too long
        if (travelFacts.length > 2000) {
            travelFacts = travelFacts.substring(0, 2000) + '... (truncated)';
        }

        // ── STEP 2: Generate itinerary JSON with enriched structure ──
        const itineraryModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }, { apiVersion: 'v1beta' });

        const itineraryPrompt = `És um planeador de viagens de luxo da "Travel Frontiers" (Portugal).
Escreve EXCLUSIVAMENTE em Português de Portugal.
O TEU OUTPUT DEVE SER APENAS UM OBJETO JSON VÁLIDO. NÃO ESCREVAS MAIS NADA ANTES NEM DEPOIS DO JSON.

<TRAVEL_DATA>
${travelFacts}
Notas adicionais: ${notes || 'Nenhuma'}
</TRAVEL_DATA>

Gera um objeto JSON com esta estrutura OBRIGATÓRIA:
{
  "resumo": {
    "destino": "Nome do destino principal",
    "datas": "Ex: 15 a 22 de Setembro 2026",
    "viajantes": "Ex: 2 adultos",
    "hotel": "Nome do hotel principal",
    "duracao": "Ex: 7 noites / 8 dias"
  },
  "imagem_capa_ingles": "Pesquisa específica em inglês para a foto de capa (ex: 'Santorini sunset blue domes Greece aerial')",
  "introducao": "2-3 frases entusiastas sobre o destino, num tom de luxo e exclusividade. Deve fazer o cliente sentir que vai ter uma experiência única.",
  "dicas": [
    {
      "icone": "🚗",
      "titulo": "Transporte",
      "texto": "Como se mover no destino..."
    },
    {
      "icone": "💰",
      "titulo": "Moeda",
      "texto": "Moeda local e dicas de câmbio..."
    },
    {
      "icone": "🗣",
      "titulo": "Língua",
      "texto": "Idioma local e 3 frases úteis..."
    },
    {
      "icone": "☀️",
      "titulo": "Clima",
      "texto": "O que esperar do clima..."
    },
    {
      "icone": "🛡",
      "titulo": "Segurança",
      "texto": "Dicas de segurança..."
    },
    {
      "icone": "👔",
      "titulo": "Vestuário",
      "texto": "Como se vestir..."
    },
    {
      "icone": "🚨",
      "titulo": "Emergências",
      "texto": "Números de emergência locais..."
    }
  ],
  "dias": [
    {
      "titulo_dia": "DIA 1: Roma - Cidade Antiga",
      "imagem_pesquisa_ingles": "Colosseum Rome Italy golden hour travel photography",
      "atividades": [
        {
          "hora": "09:00",
          "descricao": "Visita guiada ao Coliseu com acesso prioritário"
        },
        {
          "hora": "11:30",
          "descricao": "Passeio pelo Fórum Romano e Palatino"
        }
      ],
      "sugestao_almoco": {
        "nome": "Trattoria Romana",
        "porque": "Pasta artesanal com ingredientes locais frescos",
        "morada": "Via del Corso, 12",
        "maps": "https://www.google.com/maps/search/?api=1&query=Trattoria+Romana+Roma",
        "preco": "€€"
      },
      "sugestao_jantar": {
        "nome": "Osteria da Fortunata",
        "porque": "Conhecida pela melhor cacio e pepe de Roma",
        "morada": "Via del Pellegrino, 11",
        "maps": "https://www.google.com/maps/search/?api=1&query=Osteria+da+Fortunata+Roma",
        "preco": "€€€"
      }
    }
  ]
}

IMPORTANTE: Para "imagem_pesquisa_ingles" de cada dia, escreve uma query ESPECÍFICA em inglês que produza fotos bonitas do local principal visitado nesse dia (ex: "Amalfi Coast colorful houses cliffside Italy", NÃO apenas "Amalfi").
Para "imagem_capa_ingles", escreve uma query panorâmica e icónica do destino principal.

Responde APENAS com o JSON FINAL correspondente a esta viagem, sem backticks e sem comentários.`;

        const itineraryResult = await itineraryModel.generateContent(itineraryPrompt);
        const aiText = itineraryResult.response.text();

        // Extract JSON
        const jsonMatch = aiText.match(/\{[\s\S]*\}$/m);
        if (!jsonMatch) {
            throw new Error("A Inteligência Artificial falhou ao formatar o itinerário.");
        }

        let itineraryData: any;
        try {
            itineraryData = JSON.parse(jsonMatch[0]);
        } catch (err) {
            throw new Error("A Inteligência Artificial gerou um formato JSON inválido.");
        }

        // 4. Fetch Images — Pexels (with Wikimedia fallback)
        const coverQuery = itineraryData.imagem_capa_ingles || (title ? (title.split(/[-–—|,]/)[1] || title).trim() : 'beautiful travel destination');
        const dayImageQueries = (itineraryData.dias || []).map((d: any) => d.imagem_pesquisa_ingles || d.imagem_nome_ingles).filter(Boolean);

        const [coverResult, ...dailyResults] = await Promise.all([
            fetchPexelsImage(coverQuery, 'landscape'),
            ...dayImageQueries.map((q: string) => fetchPexelsImage(q, 'landscape'))
        ]);

        const logoBuffer = await fetchImageBuffer("https://www.travelfrontiers.pt/img/logo-newTF.png").catch(() => null);

        // 5. Build Premium DOCX
        const children: any[] = [];

        // ══════════════════════════════════════════
        // ── COVER PAGE ──
        // ══════════════════════════════════════════

        // Top gold accent line
        children.push(new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 24, color: GOLD } },
            spacing: { before: 0, after: 200 },
            children: []
        }));

        // Full-width cover image
        if (coverResult?.buffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new ImageRun({ data: coverResult.buffer, transformation: { width: 680, height: 420 }, type: coverResult.type })]
            }));
        }

        // Gold divider under image
        children.push(goldDivider());

        // Logo
        if (logoBuffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 80 },
                children: [new ImageRun({ data: logoBuffer, transformation: { width: 90, height: 90 }, type: 'png' })]
            }));
        }

        // Trip title
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 40 },
            children: [new TextRun({
                text: (title || 'Itinerário de Viagem').toUpperCase(),
                bold: true, size: 56, color: DARK, font: 'Georgia'
            })]
        }));

        // Trip dates & travelers subtitle
        const resumo = itineraryData.resumo || {};
        const subtitleParts = [resumo.datas, resumo.duracao, resumo.viajantes].filter(Boolean);
        if (subtitleParts.length > 0) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 40 },
                children: [new TextRun({
                    text: subtitleParts.join('  ·  '),
                    size: 24, color: GRAY, font: 'Calibri', italics: true
                })]
            }));
        }

        // Tagline
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 100 },
            children: [new TextRun({
                text: 'Travel Frontiers  ·  Viagens Personalizadas',
                italics: true, size: 20, color: GOLD, font: 'Calibri'
            })]
        }));

        // Bottom gold accent
        children.push(new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: GOLD } },
            spacing: { before: 0, after: 0 },
            children: []
        }));

        children.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }));

        // ══════════════════════════════════════════
        // ── TRIP OVERVIEW PAGE ──
        // ══════════════════════════════════════════

        // Introduction
        if (itineraryData.introducao) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
                children: [new TextRun({
                    text: itineraryData.introducao,
                    size: 24, font: 'Georgia', color: DARK, italics: true
                })]
            }));
            children.push(goldDivider());
        }

        // Trip summary info box
        if (resumo.destino || resumo.hotel) {
            children.push(new Paragraph({
                spacing: { before: 200, after: 120 },
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'RESUMO DA VIAGEM', bold: true, size: 28, color: GOLD, font: 'Calibri' })]
            }));

            if (resumo.destino) children.push(renderInfoRow('✈️', 'Destino', resumo.destino));
            if (resumo.datas) children.push(renderInfoRow('📅', 'Datas', resumo.datas));
            if (resumo.duracao) children.push(renderInfoRow('⏱', 'Duração', resumo.duracao));
            if (resumo.viajantes) children.push(renderInfoRow('👥', 'Viajantes', resumo.viajantes));
            if (resumo.hotel) children.push(renderInfoRow('🏨', 'Alojamento', resumo.hotel));

            children.push(sectionSpacer(200));
            children.push(goldDivider());
        }

        // Practical Tips
        const dicas = itineraryData.dicas;
        if (Array.isArray(dicas) && dicas.length > 0) {
            children.push(new Paragraph({
                spacing: { before: 200, after: 160 },
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'DICAS PRÁTICAS', bold: true, size: 28, color: GOLD, font: 'Calibri' })]
            }));

            dicas.forEach((dica: any) => {
                if (typeof dica === 'string') {
                    // Backward compat: old format (plain strings)
                    children.push(new Paragraph({
                        spacing: { before: 60, after: 60 },
                        indent: { left: 360 },
                        children: [new TextRun({ text: `• ${dica}`, size: 21, font: 'Calibri', color: DARK })]
                    }));
                } else {
                    // New format: { icone, titulo, texto }
                    children.push(new Paragraph({
                        spacing: { before: 100, after: 40 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `${dica.icone || '•'}  `, size: 22, font: 'Calibri' }),
                            new TextRun({ text: dica.titulo || '', bold: true, size: 22, font: 'Calibri', color: DARK }),
                        ]
                    }));
                    if (dica.texto) {
                        children.push(new Paragraph({
                            spacing: { before: 20, after: 60 },
                            indent: { left: 720 },
                            children: [new TextRun({ text: dica.texto, size: 20, font: 'Calibri', color: GRAY })]
                        }));
                    }
                }
            });
        }

        children.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }));

        // ══════════════════════════════════════════
        // ── DAY-BY-DAY ITINERARY ──
        // ══════════════════════════════════════════

        let currentImageIndex = 0;
        if (Array.isArray(itineraryData.dias)) {
            itineraryData.dias.forEach((dia: any, dayIndex: number) => {

                // Day hero image (full width)
                const imgRes = dailyResults[currentImageIndex++];
                if (imgRes?.buffer) {
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: dayIndex === 0 ? 0 : 100, after: 0 },
                        children: [new ImageRun({ data: imgRes.buffer, transformation: { width: 680, height: 340 }, type: imgRes.type })]
                    }));
                }

                // Day title banner
                if (dia.titulo_dia) {
                    children.push(new Paragraph({
                        spacing: { before: imgRes?.buffer ? 0 : 300, after: 200 },
                        shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            text: '  ' + dia.titulo_dia.toUpperCase() + '  ',
                            bold: true, size: 28, color: WHITE, font: 'Calibri'
                        })]
                    }));
                }

                // Activities with styled time
                const atividades = dia.atividades;
                if (Array.isArray(atividades)) {
                    atividades.forEach((ativ: any) => {
                        if (typeof ativ === 'string') {
                            // Backward compat: plain string format
                            children.push(new Paragraph({
                                spacing: { before: 60, after: 60 },
                                indent: { left: 360 },
                                children: [new TextRun({ text: `• ${ativ}`, size: 21, font: 'Calibri', color: DARK })]
                            }));
                        } else {
                            // New format: { hora, descricao }
                            children.push(new Paragraph({
                                spacing: { before: 80, after: 80 },
                                indent: { left: 360 },
                                children: [
                                    new TextRun({ text: `${ativ.hora || ''}`, bold: true, size: 22, font: 'Calibri', color: GOLD }),
                                    new TextRun({ text: ativ.hora ? '  ' : '', size: 22, font: 'Calibri' }),
                                    new TextRun({ text: ativ.descricao || '', size: 21, font: 'Calibri', color: DARK }),
                                ]
                            }));
                        }
                    });
                }

                // Restaurant suggestions
                children.push(...renderRestaurantCard('🍽', 'Sugestão para Almoço', dia.sugestao_almoco));
                children.push(...renderRestaurantCard('🌙', 'Sugestão para Jantar', dia.sugestao_jantar));

                // Gold divider between days
                children.push(sectionSpacer(200));
                if (dayIndex < itineraryData.dias.length - 1) {
                    children.push(goldDivider());
                }
            });
        }

        // ══════════════════════════════════════════
        // ── BUILD DOCUMENT ──
        // ══════════════════════════════════════════

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 800, right: 800, bottom: 900, left: 800 }
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
                                    ...(logoBuffer ? [new ImageRun({ data: logoBuffer, transformation: { width: 24, height: 24 }, type: 'png' })] : []),
                                    new TextRun({ text: '  Travel Frontiers', bold: true, size: 18, color: GOLD, font: 'Calibri' }),
                                    new TextRun({ text: '   |   www.travelfrontiers.pt   |   @tf.travel.frontiers', size: 16, color: GRAY, font: 'Calibri' }),
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
