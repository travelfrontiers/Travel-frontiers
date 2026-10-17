import { NextResponse } from 'next/server';
import { client } from '../../../sanity/client';
import { GoogleGenAI } from '@google/genai';
import {
    Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer,
    BorderStyle, PageBreak, ShadingType, ExternalHyperlink, Table, TableRow,
    TableCell, WidthType, VerticalAlign, PageNumber
} from 'docx';
import mammoth from 'mammoth';

// Polyfill for libraries expecting browser-only DOMMatrix in a Node environment (fixes Vercel build)
if (typeof global !== 'undefined' && typeof (global as any).DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class {};
}

// ── Brand Constants (Condé Nast Traveller / 5-Star Hotel Magazine Palette) ──
const CHARCOAL_DARK = '141414'; // Near-black charcoal for ribbons & section titles
const CHARCOAL_CARD = '1C1C1C'; // Dark charcoal for dining & practical tips cards
const GOLD_WARM     = 'C9A24B'; // Warm accent gold for kickers, borders, time markers, icons
const CREAM_BG      = 'FBF8F2'; // Off-white cream for cover title box, section backgrounds & alternating rows
const WHITE         = 'FFFFFF'; // Crisp white text on dark backgrounds
const MUTED_GRAY    = '8A8A8A'; // Secondary gray text for details/addresses
const LIGHT_GRAY    = 'D0D0D0'; // Light gray text for italic descriptions on dark cards
const FONT_SERIF    = 'Georgia';// Serif font throughout for luxury magazine aesthetic

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
            const photo = data.photos[0];
            const imgUrl = photo.src.large2x || photo.src.large || photo.src.original;
            const imgResponse = await fetch(imgUrl);
            if (imgResponse.ok) {
                return { buffer: Buffer.from(await imgResponse.arrayBuffer()), type: 'jpg' };
            }
        }
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

// ── Magazine Layout Helpers ──

function cleanDayTitle(rawTitle: string): string {
    if (!rawTitle) return '';
    // Strip leading "Dia 1:", "DIA 01 -", "Day 1:", "Dia 1", etc. to avoid duplicate "DIA 01 DIA 1"
    const cleaned = rawTitle.replace(/^(dia|day)\s*\d+[\s:\-–—]*/i, '').trim();
    return cleaned || rawTitle;
}

function renderDarkRibbon(kicker: string, title: string, subtitle?: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Kicker paragraph (only if provided and non-empty)
    if (kicker && kicker.trim()) {
        paragraphs.push(new Paragraph({
            shading: { type: ShadingType.SOLID, color: CHARCOAL_DARK, fill: CHARCOAL_DARK },
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 40 },
            children: [
                new TextRun({ text: kicker.toUpperCase(), bold: true, size: 18, color: GOLD_WARM, font: FONT_SERIF })
            ]
        }));
    }

    // Title paragraph
    paragraphs.push(new Paragraph({
        shading: { type: ShadingType.SOLID, color: CHARCOAL_DARK, fill: CHARCOAL_DARK },
        alignment: AlignmentType.CENTER,
        spacing: { before: kicker && kicker.trim() ? 40 : 180, after: subtitle ? 40 : 180 },
        children: [
            new TextRun({ text: title.toUpperCase(), bold: true, size: 32, color: WHITE, font: FONT_SERIF })
        ]
    }));

    // Subtitle paragraph (optional)
    if (subtitle) {
        paragraphs.push(new Paragraph({
            shading: { type: ShadingType.SOLID, color: CHARCOAL_DARK, fill: CHARCOAL_DARK },
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 180 },
            children: [
                new TextRun({ text: subtitle, italics: true, size: 20, color: GOLD_WARM, font: FONT_SERIF })
            ]
        }));
    }

    return paragraphs;
}

function goldDivider(): Paragraph {
    return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD_WARM } },
        spacing: { before: 160, after: 160 },
        children: []
    });
}

function sectionSpacer(size: number = 300): Paragraph {
    return new Paragraph({ spacing: { before: size, after: 0 }, children: [] });
}

// ── Clean Footer (Cell top gold rule on brand cells only, zero vertical lines, page number size 10 right-aligned) ──

function buildAlignedFooter(logoBuffer: Buffer | null): Footer {
    const noBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    };

    const goldTopBorder = {
        top: { style: BorderStyle.SINGLE, size: 4, color: GOLD_WARM },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    };

    const pageNumberParagraph = new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
            new TextRun({ children: [PageNumber.CURRENT], size: 20, color: '8A8A8A', font: 'Calibri' })
        ]
    });

    const footerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        borders: noBorders,
        rows: [
            new TableRow({
                children: [
                    ...(logoBuffer ? [
                        new TableCell({
                            width: { size: 5, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            margins: { top: 60, bottom: 40, left: 0, right: 10 },
                            borders: goldTopBorder,
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    spacing: { before: 0, after: 0 },
                                    children: [
                                        new ImageRun({ data: logoBuffer, transformation: { width: 18, height: 18 }, type: 'png' })
                                    ]
                                })
                            ]
                        })
                    ] : []),
                    new TableCell({
                        width: { size: logoBuffer ? 80 : 85, type: WidthType.PERCENTAGE },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 60, bottom: 40, left: 10, right: 0 },
                        borders: goldTopBorder,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                spacing: { before: 0, after: 0 },
                                children: [
                                    new TextRun({ text: 'Travel Frontiers', bold: true, size: 18, color: GOLD_WARM, font: 'Calibri' }),
                                    new TextRun({ text: '   |   www.travelfrontiers.pt   |   @tf.travel.frontiers', size: 16, color: '6B7280', font: 'Calibri' }),
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 15, type: WidthType.PERCENTAGE },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 60, bottom: 40, left: 0, right: 0 },
                        borders: noBorders,
                        children: [pageNumberParagraph]
                    })
                ]
            })
        ]
    });

    return new Footer({ children: [footerTable] });
}

// ── Trip Summary Alternating Row Table ──

function renderTripSummaryTable(resumo: any): Table {
    const rowsData = [
        { icon: '✈️', label: 'DESTINO', value: resumo.destino },
        { icon: '📅', label: 'DATAS', value: resumo.datas },
        { icon: '⏱', label: 'DURAÇÃO', value: resumo.duracao },
        { icon: '👥', label: 'VIAJANTES', value: resumo.viajantes },
        { icon: '🏨', label: 'ALOJAMENTO', value: resumo.hotel },
    ].filter(r => Boolean(r.value));

    const tableRows = rowsData.map((item, index) => {
        const bg = index % 2 === 0 ? CREAM_BG : WHITE;
        return new TableRow({
            children: [
                new TableCell({
                    width: { size: 35, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' },
                        left: { style: BorderStyle.SINGLE, size: 12, color: GOLD_WARM },
                        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${item.icon}  `, size: 20, font: FONT_SERIF }),
                                new TextRun({ text: item.label, bold: true, size: 19, color: CHARCOAL_DARK, font: FONT_SERIF }),
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 65, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' },
                        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: item.value, size: 20, color: CHARCOAL_DARK, font: FONT_SERIF })
                            ]
                        })
                    ]
                }),
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        rows: tableRows
    });
}

// ── Practical Tips 2-Column Dark Card Grid ──

function renderPracticalTipsGrid(dicas: any[]): Table {
    const validDicas = dicas.filter(Boolean);
    const tableRows: TableRow[] = [];

    for (let i = 0; i < validDicas.length; i += 2) {
        const item1 = validDicas[i];
        const item2 = validDicas[i + 1];

        const createCardCell = (dica: any) => {
            if (!dica) {
                return new TableCell({
                    width: { size: 48, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    },
                    children: [new Paragraph({ children: [] })]
                });
            }

            const isString = typeof dica === 'string';
            const icon = isString ? '💡' : (dica.icone || '💡');
            const title = isString ? 'DICA PRÁTICA' : (dica.titulo || 'DICA');
            const text = isString ? dica : (dica.texto || '');

            return new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, color: CHARCOAL_CARD, fill: CHARCOAL_CARD },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 160, bottom: 160, left: 160, right: 160 },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 8, color: GOLD_WARM },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                },
                children: [
                    new Paragraph({
                        spacing: { before: 40, after: 60 },
                        children: [
                            new TextRun({ text: `${icon}  `, size: 20, font: FONT_SERIF }),
                            new TextRun({ text: title.toUpperCase(), bold: true, size: 19, color: GOLD_WARM, font: FONT_SERIF }),
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 20, after: 40 },
                        children: [
                            new TextRun({ text, size: 18, color: CREAM_BG, font: FONT_SERIF })
                        ]
                    })
                ]
            });
        };

        const spacerCell = new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [new Paragraph({ children: [] })]
        });

        tableRows.push(new TableRow({
            children: [
                createCardCell(item1),
                spacerCell,
                createCardCell(item2)
            ]
        }));
    }

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        rows: tableRows
    });
}

// ── Side-by-Side Dark Dining Cards Table ──

function renderDiningCardsTable(lunchData: any, dinnerData: any): Table | null {
    if (!lunchData && !dinnerData) return null;

    const buildDiningCell = (icon: string, label: string, s: any) => {
        if (!s) {
            return new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                },
                children: [new Paragraph({ children: [] })]
            });
        }

        const paragraphs: Paragraph[] = [
            // Header banner inside card
            new Paragraph({
                spacing: { before: 40, after: 80 },
                children: [
                    new TextRun({ text: `${icon}  ${label.toUpperCase()}`, bold: true, size: 19, color: GOLD_WARM, font: FONT_SERIF }),
                ]
            })
        ];

        if (s.nome) {
            paragraphs.push(new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                    new TextRun({ text: s.nome, bold: true, size: 21, color: WHITE, font: FONT_SERIF }),
                    ...(s.preco ? [new TextRun({ text: `  (${s.preco})`, size: 19, color: GOLD_WARM, font: FONT_SERIF })] : []),
                ]
            }));
        }

        if (s.porque) {
            paragraphs.push(new Paragraph({
                spacing: { before: 20, after: 40 },
                children: [
                    new TextRun({ text: s.porque, italics: true, size: 18, color: LIGHT_GRAY, font: FONT_SERIF })
                ]
            }));
        }

        if (s.morada) {
            paragraphs.push(new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                    new TextRun({ text: `📍 ${s.morada}`, size: 17, color: MUTED_GRAY, font: FONT_SERIF })
                ]
            }));
        }

        if (s.maps) {
            // Clean text without icon before Google Maps link as requested
            paragraphs.push(new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                    new ExternalHyperlink({
                        link: s.maps,
                        children: [
                            new TextRun({ text: 'Ver no Google Maps', size: 18, color: GOLD_WARM, underline: {}, font: FONT_SERIF })
                        ]
                    })
                ]
            }));
        }

        return new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: CHARCOAL_CARD, fill: CHARCOAL_CARD },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 160, bottom: 160, left: 160, right: 160 },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: GOLD_WARM },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: paragraphs
        });
    };

    const spacerCell = new TableCell({
        width: { size: 4, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        children: [new Paragraph({ children: [] })]
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        rows: [
            new TableRow({
                children: [
                    buildDiningCell('🍽', 'Sugestão para Almoço', lunchData),
                    spacerCell,
                    buildDiningCell('🌙', 'Sugestão para Jantar', dinnerData)
                ]
            })
        ]
    });
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
        const asset = await client.fetch('*[_id == $id][0]{ url, extension, originalFilename, mimeType }', { id: fileRef });
        if (!asset || !asset.url) throw new Error("Ficheiro de origem não encontrado no Sanity.");

        const fileResponse = await fetch(asset.url);
        if (!fileResponse.ok) throw new Error(`Falha ao descarregar o ficheiro de origem (${fileResponse.status}).`);
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine file extension safely (case-insensitive)
        let ext = (asset.extension || '').toLowerCase().replace(/^\./, '');
        if (!ext && asset.url) {
            const urlPath = asset.url.split('?')[0];
            ext = (urlPath.split('.').pop() || '').toLowerCase();
        }
        if (!ext && asset.originalFilename) {
            ext = (asset.originalFilename.split('.').pop() || '').toLowerCase();
        }

        // 2. Extract Text from Source File
        let extractedText = "";
        let isPdf = ext === 'pdf' || asset.mimeType === 'application/pdf';

        if (isPdf) {
            try {
                const data = await pdfParse(buffer);
                extractedText = (data.text || '').trim();
            } catch (err) {
                console.warn('pdf-parse failed:', err);
            }
        } else if (ext === 'docx' || asset.mimeType?.includes('wordprocessingml')) {
            try {
                const docxData = await mammoth.extractRawText({ buffer });
                extractedText = (docxData.value || '').trim();
            } catch (err) {
                console.warn('mammoth docx extraction failed:', err);
            }
        } else if (ext === 'doc' || asset.mimeType?.includes('msword')) {
            try {
                const docxData = await mammoth.extractRawText({ buffer });
                extractedText = (docxData.value || '').trim();
            } catch {
                extractedText = buffer.toString('utf-8').replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').trim();
            }
        } else {
            // Text or other format
            extractedText = buffer.toString('utf-8').trim();
        }

        // If extraction is empty and it's not a PDF that can be passed directly, throw error
        if (!extractedText && !isPdf) {
            throw new Error("O ficheiro de origem está vazio ou não contém texto legível.");
        }

        // 3. AI EXTRACTION & ITINERARY GENERATION
        const ai = new GoogleGenAI({ apiKey });

        // ── STEP 1: Extract complete, exhaustive travel facts & day-by-day plan from source ──
        const extractionPrompt = `És um especialista em reservas turísticas da "Travel Frontiers".
Analisa atentamente todo o documento de reserva anexado e extrai TODOS os detalhes concretos da viagem, sem omitir nada:

1. DESTINO E DATAS: Destino principal, destinos secundários, datas exatas de início e fim, duração (dias e noites).
2. VIAJANTES: Quantidade de adultos/crianças e nomes se mencionados.
3. ALOJAMENTO: Todos os hotéis contratados (nomes exatos, categoria e localização).
4. TRANSPORTES: Todos os voos (companhia, números de voo, horários de partida/chegada), transferes ou aluguer de viatura.
5. PROGRAMA / ITINERÁRIO CONTRATADO: Se o documento contiver um programa, passeios, excursões ou visitas dia a dia, extrai DETALHADAMENTE CADA UM DOS DIAS, locais a visitar, horários e pontos de encontro.
6. SERVIÇOS INCLUÍDOS E OBSERVAÇÕES: Guias, refeições incluídas, bilhetes para monumentos, etc.

Não inventes nada que não conste no documento. Extrai todos os factos reais com o máximo detalhe possível.`;

        let extractionResult: any;

        // If we have a PDF and extractedText is poor or missing, pass PDF natively to Gemini
        if (isPdf && (!extractedText || extractedText.length < 100)) {
            extractionResult = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        inlineData: {
                            data: buffer.toString('base64'),
                            mimeType: 'application/pdf'
                        }
                    },
                    extractionPrompt
                ]
            });
        } else {
            extractionResult = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `${extractionPrompt}\n\n<DOCUMENTO_ORIGEM>\n${extractedText.substring(0, 100000)}\n</DOCUMENTO_ORIGEM>`
            });
        }

        const travelFacts = extractionResult.text ?? '';
        if (!travelFacts.trim()) {
            throw new Error("Não foi possível extrair informações úteis do documento de origem.");
        }

        // ── STEP 2: Generate itinerary JSON respecting the actual booking ──
        const itineraryPrompt = `És um planeador de viagens de luxo da "Travel Frontiers" (Portugal).
Escreve EXCLUSIVAMENTE em Português de Portugal.
O TEU OUTPUT DEVE SER APENAS UM OBJETO JSON VÁLIDO. NÃO ESCREVAS MAIS NADA ANTES NEM DEPOIS DO JSON.

Com base nos dados reais extraídos da reserva, cria o documento oficial de itinerário em formato JSON.

REGRAS CRÍTICAS:
1. RIGOR TOTAL COM O DOCUMENTO:
   - Respeita rigorosamente o destino, os hotéis contratados, os voos e as datas.
   - Se o documento tiver visitas, passeios ou atividades contratadas/programadas para cada dia, ELAS SÃO OBRIGATÓRIAS e devem figurar no dia e horário correspondente.
   - O número de dias no array "dias" DEVE corresponder à duração real da viagem indicada no documento.
2. COMPLETA COM QUALIDADE:
   - Se algum dia estiver livre ou sem atividades pré-marcadas no documento, sugere experiências autênticas, visitas a monumentos icónicos e passeios adaptados ao perfil do destino.
3. GASTRONOMIA:
   - Para cada dia, inclui sugestões reais de almoço e jantar com nomes verídicos de restaurantes locais de qualidade.
4. TÍTULOS DOS DIAS:
   - Para "titulo_dia", NUNCA escrevas "Dia 1:" ou "DIA 1" no título; escreve apenas o tema/local principal (ex: "Chegada a Málaga e Passeio pelo Centro Histórico", "Desfiladeiro e Ponte Nova de Ronda").

<DADOS_DA_RESERVA>
${travelFacts}

NOTAS ADICIONAIS DO AGENTE:
${notes || 'Nenhuma'}
</DADOS_DA_RESERVA>

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
  "introducao": "2-3 frases entusiastas sobre o destino. Deve fazer o cliente sentir que vai ter uma experiência inesquecível.",
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
      "titulo_dia": "Cidade - Tema do Dia",
      "imagem_pesquisa_ingles": "Colosseum Rome Italy golden hour travel photography",
      "atividades": [
        {
          "hora": "09:00",
          "descricao": "Descrição da atividade detalhada com dicas práticas"
        }
      ],
      "sugestao_almoco": {
        "nome": "Nome do Restaurante",
        "porque": "Especialidade gastronómica e ambiente",
        "morada": "Morada real na cidade",
        "maps": "https://www.google.com/maps/search/?api=1&query=Restaurante+Cidade",
        "preco": "€€"
      },
      "sugestao_jantar": {
        "nome": "Nome do Restaurante",
        "porque": "Especialidade gastronómica e ambiente",
        "morada": "Morada real na cidade",
        "maps": "https://www.google.com/maps/search/?api=1&query=Restaurante+Cidade",
        "preco": "€€€"
      }
    }
  ]
}

Responde APENAS com o JSON FINAL correspondente a esta viagem, sem backticks e sem comentários.`;

        const itineraryResult = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: itineraryPrompt
        });
        const aiText = itineraryResult.text ?? '';

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

        // 5. Build Condé Nast Traveller Magazine DOCX
        const children: any[] = [];

        // ══════════════════════════════════════════
        // ── COVER PAGE ──
        // ══════════════════════════════════════════

        // Full-bleed hero image at top of cover
        if (coverResult?.buffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 120 },
                children: [new ImageRun({ data: coverResult.buffer, transformation: { width: 680, height: 400 }, type: coverResult.type })]
            }));
        }

        // Cover Title Block — Shaded box as requested in user screenshot
        const resumo = itineraryData.resumo || {};
        const titleText = (title || 'ITINERÁRIO DE VIAGEM').toUpperCase();
        const datesLine = [resumo.datas, resumo.duracao].filter(Boolean).join('  ·  ');
        const travelersLine = resumo.viajantes || '';

        children.push(new Paragraph({
            shading: { type: ShadingType.SOLID, color: CREAM_BG, fill: CREAM_BG },
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 60 },
            children: [
                new TextRun({ text: titleText, bold: true, size: 44, color: CHARCOAL_DARK, font: FONT_SERIF })
            ]
        }));

        if (datesLine) {
            children.push(new Paragraph({
                shading: { type: ShadingType.SOLID, color: CREAM_BG, fill: CREAM_BG },
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: travelersLine ? 20 : 200 },
                children: [
                    new TextRun({ text: datesLine, italics: true, size: 22, color: GOLD_WARM, font: FONT_SERIF })
                ]
            }));
        }

        if (travelersLine) {
            children.push(new Paragraph({
                shading: { type: ShadingType.SOLID, color: CREAM_BG, fill: CREAM_BG },
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 200 },
                children: [
                    new TextRun({ text: travelersLine, italics: true, size: 22, color: GOLD_WARM, font: FONT_SERIF })
                ]
            }));
        }

        // Generous vertical spacing to distribute content down the center of the cover page
        children.push(sectionSpacer(480));

        // Brand logo centered
        if (logoBuffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 80 },
                children: [new ImageRun({ data: logoBuffer, transformation: { width: 100, height: 100 }, type: 'png' })]
            }));
        }

        // Tagline below logo
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 240 },
            children: [
                new TextRun({ text: 'Travel Frontiers  ·  Viagens Personalizadas', italics: true, size: 22, color: GOLD_WARM, font: FONT_SERIF })
            ]
        }));

        children.push(goldDivider());
        children.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }));

        // ══════════════════════════════════════════
        // ── TRIP OVERVIEW PAGE ──
        // ══════════════════════════════════════════

        // Title translated to PT-PT without "SECTION 01"
        children.push(...renderDarkRibbon('', 'VISÃO GERAL DA VIAGEM', resumo.destino || 'Resumo & Dicas'));

        // Introduction Editorial Paragraph
        if (itineraryData.introducao) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 240 },
                children: [new TextRun({
                    text: itineraryData.introducao,
                    size: 24, font: FONT_SERIF, color: CHARCOAL_DARK, italics: true
                })]
            }));
            children.push(goldDivider());
        }



        // Trip Summary Table with Alternating Shading
        if (resumo.destino || resumo.hotel) {
            children.push(new Paragraph({
                spacing: { before: 160, after: 120 },
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: 'DETALHES DA RESERVA', bold: true, size: 22, color: GOLD_WARM, font: FONT_SERIF })
                ]
            }));

            children.push(renderTripSummaryTable(resumo));
            children.push(sectionSpacer(240));
            children.push(goldDivider());
        }

        // Practical Tips Grid (2-column dark cards)
        const dicas = itineraryData.dicas;
        if (Array.isArray(dicas) && dicas.length > 0) {
            children.push(new Paragraph({
                spacing: { before: 160, after: 160 },
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: 'DICAS PRÁTICAS DE VIAGEM', bold: true, size: 22, color: GOLD_WARM, font: FONT_SERIF })
                ]
            }));

            children.push(renderPracticalTipsGrid(dicas));
        }

        children.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }));

        // ══════════════════════════════════════════
        // ── DAY-BY-DAY ITINERARY ──
        // ══════════════════════════════════════════

        let currentImageIndex = 0;
        if (Array.isArray(itineraryData.dias)) {
            itineraryData.dias.forEach((dia: any, dayIndex: number) => {

                // Full-width photo at the top of each day
                const imgRes = dailyResults[currentImageIndex++];
                if (imgRes?.buffer) {
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: dayIndex === 0 ? 0 : 100, after: 0 },
                        children: [new ImageRun({ data: imgRes.buffer, transformation: { width: 680, height: 340 }, type: imgRes.type })]
                    }));
                }

                // Clean title to avoid duplicate "DIA 01 DIA 1"
                const dayKicker = `DIA ${String(dayIndex + 1).padStart(2, '0')}`;
                const rawTitle = dia.titulo_dia || `Dia ${dayIndex + 1}`;
                const cleanedTitle = cleanDayTitle(rawTitle);

                children.push(...renderDarkRibbon(dayKicker, cleanedTitle));

                // Cream-background Timeline List
                const atividades = dia.atividades;
                if (Array.isArray(atividades) && atividades.length > 0) {
                    children.push(new Paragraph({
                        spacing: { before: 120, after: 80 },
                        children: [
                            new TextRun({ text: ' ITINERÁRIO DO DIA', bold: true, size: 20, color: GOLD_WARM, font: FONT_SERIF })
                        ]
                    }));

                    atividades.forEach((ativ: any) => {
                        const isString = typeof ativ === 'string';
                        const time = isString ? '' : (ativ.hora || '');
                        const desc = isString ? ativ : (ativ.descricao || '');

                        children.push(new Paragraph({
                            shading: { type: ShadingType.SOLID, color: CREAM_BG, fill: CREAM_BG },
                            spacing: { before: 60, after: 60 },
                            indent: { left: 360 },
                            border: {
                                left: { style: BorderStyle.SINGLE, size: 12, color: GOLD_WARM },
                                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                            },
                            children: [
                                ...(time ? [new TextRun({ text: `  ${time}  `, bold: true, size: 21, color: GOLD_WARM, font: FONT_SERIF })] : [new TextRun({ text: '  • ', size: 21, color: GOLD_WARM, font: FONT_SERIF })]),
                                new TextRun({ text: desc, size: 20, color: CHARCOAL_DARK, font: FONT_SERIF }),
                            ]
                        }));
                    });

                    children.push(sectionSpacer(160));
                }

                // Side-by-Side Dark Dining Cards (Lunch & Dinner)
                const diningCardsTable = renderDiningCardsTable(dia.sugestao_almoco, dia.sugestao_jantar);
                if (diningCardsTable) {
                    children.push(diningCardsTable);
                }

                // Divider between days
                children.push(sectionSpacer(200));
                if (dayIndex < itineraryData.dias.length - 1) {
                    children.push(goldDivider());
                }
            });
        }

        // ══════════════════════════════════════════
        // ── BUILD DOCUMENT (TITLE PAGE = TRUE SUPPRESSES COVER FOOTER) ──
        // ══════════════════════════════════════════

        const doc = new Document({
            sections: [{
                properties: {
                    titlePage: true, // Suppresses footer on cover page (Page 1) while showing on remaining pages
                    page: {
                        margin: { top: 800, right: 800, bottom: 900, left: 800 }
                    }
                },
                children,
                // Perfectly vertically centered footer with 2-cell table
                footers: {
                    default: buildAlignedFooter(logoBuffer)
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
