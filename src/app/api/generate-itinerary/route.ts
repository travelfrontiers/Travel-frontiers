import { NextResponse } from 'next/server';
import { client } from '../../../sanity/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Footer, BorderStyle, PageBreak, ShadingType } from 'docx';
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

async function fetchFreeTravelImage(query: string): Promise<Buffer | null> {
    try {
        // Fallback or cleanup the query for better search results
        const cleanQuery = query.replace(/professional travel photo of/i, '').trim();
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(cleanQuery + " travel landmark")}&gsrlimit=1&pithumbsize=1000`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.query && data.query.pages) {
            const pages = Object.values(data.query.pages) as any[];
            if (pages.length > 0 && pages[0].thumbnail) {
                const imgUrl = pages[0].thumbnail.source;
                const imgResponse = await fetch(imgUrl);
                if (imgResponse.ok) {
                    return Buffer.from(await imgResponse.arrayBuffer());
                }
            }
        }
        return null;
    } catch (e) {
        console.warn("Failed to fetch Wikimedia image:", e);
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

        const textPrompt = `
You are an expert travel luxury planner for "Travel Frontiers". 
Create an immersive, professional, and high-quality itinerary based on these details:
${extractedText.substring(0, 50000)}

User Notes: ${notes || 'None'}

STYLE GUIDELINES (FOLLOW EXACTLY):
- Start with a short, enthusiastic introduction about the trip.
- Use a day-by-day structure. Format: "DIA X: [CITY NAME] - [MAIN THEME]"
- Within each day, use a TIMELINE format (e.g., • 09:00: [Activity], • 10:30: [Next]).
- Include detailed Restaurant Suggestions for Lunch and Dinner for EACH day:
  o Sugestão: [Name]
  o Porquê: [Detailed reason why it's special]
  o Preço: [€, €€, or €€€]
- Throughout the text, insert this exact tag where a photo should be: [IMAGE: Landmark or City Exact Name]. Make the name inside the brackets a simple 2-4 word search term (e.g. [IMAGE: Prague Charles Bridge]).
- Language: Portuguese (Portugal).
- Tone: Premium, expert, inspiring.
- NO Markdown (no ** or #).
`;

        const result = await model.generateContent(textPrompt);
        const aiText = result.response.text();

        // 4. Image Fetching Logic (Wikimedia Commons Free API)
        const imageTags = Array.from(aiText.matchAll(/\[IMAGE:\s*(.*?)\]/g));
        // Add a simple cover image search term based on the title
        const coverPrompt = `${title || "Europe"} landmark`;
        
        const allImageQueries = [coverPrompt, ...imageTags.map(m => m[1])];
        const allImageBuffers = await Promise.all(
            allImageQueries.map(query => fetchFreeTravelImage(query))
        );

        const coverBuffer = allImageBuffers[0];
        const dailyBuffers = allImageBuffers.slice(1);
        const logoBuffer = await fetchImageBuffer("https://www.travelfrontiers.pt/img/logo-newTF.png").catch(() => null);

        // 5. Strip any prompt echo - keep only content from the first real paragraph or DIA heading
        const cleanedAiText = (() => {
            // Remove lines that look like instructions echoed back
            const lines = aiText.split('\n');
            let startIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim();
                // Skip blank lines, and lines that are instructions echoed back
                if (l.match(/^(you are|create|style guidelines|user notes|STYLE|based on|return only|write a|format:|language:|tone:|note:|no markdown)/i)) {
                    startIndex = i + 1;
                }
            }
            return lines.slice(startIndex).join('\n').trim();
        })();

        // 6. Build DOCX with professional layout
        const GOLD = 'B8963E';
        const DARK = '1A1A2E';
        const GRAY = '6B7280';
        const children: any[] = [];

        // ── COVER PAGE ──
        if (coverBuffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: coverBuffer, transformation: { width: 600, height: 380 }, type: 'jpg' })],
                spacing: { before: 0, after: 400 }
            }));
        }

        // Title block
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: (title || 'Itinerário de Viagem').toUpperCase(), bold: true, size: 48, color: DARK, font: 'Georgia' })]
        }));

        // Gold divider line
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
            children: []
        }));

        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 600 },
            children: [new TextRun({ text: 'Travel Frontiers — Viagens de Luxo', italics: true, size: 22, color: GRAY, font: 'Calibri' })]
        }));

        // Page break after cover
        children.push(new Paragraph({ children: [new PageBreak()] }));

        // ── BODY: Parse AI text and render each line ──
        let currentImageIndex = 0;
        const bodyLines = cleanedAiText.split('\n');

        for (const line of bodyLines) {
            const cleanLine = line.replace(/\[IMAGE:.*?\]/g, '').trim();

            if (cleanLine) {
                if (cleanLine.match(/^DIA \d+/i)) {
                    // Day heading – gold background bar style
                    children.push(new Paragraph({
                        spacing: { before: 520, after: 160 },
                        shading: { type: ShadingType.SOLID, color: DARK, fill: DARK },
                        children: [new TextRun({ text: '  ' + cleanLine.toUpperCase() + '  ', bold: true, size: 26, color: 'FFFFFF', font: 'Calibri' })]
                    }));
                } else if (cleanLine.startsWith('•') || cleanLine.startsWith('-') || cleanLine.match(/^\d{2}:\d{2}/)) {
                    // Timeline items
                    children.push(new Paragraph({
                        spacing: { before: 60, after: 60 },
                        indent: { left: 360 },
                        children: [new TextRun({ text: cleanLine, size: 21, font: 'Calibri', color: DARK })]
                    }));
                } else if (cleanLine.startsWith('o Sugestão') || cleanLine.startsWith('o Porquê') || cleanLine.startsWith('o Preço')) {
                    // Restaurant card sub-items
                    children.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 720 },
                        children: [new TextRun({ text: cleanLine, size: 20, italics: cleanLine.startsWith('o Porquê'), font: 'Calibri', color: GRAY })]
                    }));
                } else if (cleanLine.length < 80 && cleanLine.includes(':') && !cleanLine.startsWith('http')) {
                    // Sub-headings (Sugestão para Almoço, etc.)
                    children.push(new Paragraph({
                        spacing: { before: 240, after: 80 },
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
                const imgBuffer = dailyBuffers[currentImageIndex++];
                if (imgBuffer) {
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 240, after: 240 },
                        children: [new ImageRun({ data: imgBuffer, transformation: { width: 520, height: 290 }, type: 'jpg' })]
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
