import { NextResponse } from 'next/server';
import { client } from '../../../sanity/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Footer } from 'docx';
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

async function generateImagenImage(prompt: string, apiKey: string): Promise<Buffer | null> {
    try {
        // Use v1 endpoint for stable connection
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/imagen-3.0-generate-001:generateImages?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                number_of_images: 1,
            }),
        });

        if (!response.ok) {
            // Fallback to v1beta if v1 is not available for Imagen
            const fallbackResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, number_of_images: 1 }),
            });
            if (!fallbackResponse.ok) return null;
            const data = await fallbackResponse.json();
            const base64 = data.generatedImages?.[0]?.image?.imageBytes;
            return base64 ? Buffer.from(base64, 'base64') : null;
        }

        const data = await response.json();
        const base64 = data.generatedImages?.[0]?.image?.imageBytes;
        if (!base64) return null;
        return Buffer.from(base64, 'base64');
    } catch (e) {
        console.error("Imagen error:", e);
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

        // 3. Generate Detailed Itinerary with Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        // FORCE 'v1' stable API version and use requested model
        const model = genAI.getGenerativeModel({ model: 'gemma-4-31b-it' }, { apiVersion: 'v1' });

        const textPrompt = `
You are an expert travel planner for "Travel Frontiers". 
Create an immersive, professional itinerary based on these details:
${extractedText.substring(0, 50000)}

User Notes: ${notes || 'None'}

Return ONLY a structured itinerary in Portuguese with these exact markers for every day (e.g. "DIA 1: City", "DIA 2: Beach").
For every day, include a detailed description of activities.
`;

        const result = await model.generateContent(textPrompt);
        const aiText = result.response.text();

        // 4. Image Generation Tasks (Parallel)
        // a. Cover Image
        const coverPromise = generateImagenImage(`A stunning, inviting travel landscape or landmark photograph for an itinerary titled ${title || "a new adventure"}. High professional quality, natural colors.`, apiKey);
        
        // b. Daily Images (Parse the text to find days)
        const daySections = aiText.split(/DIA \d+/i);
        const intro = daySections[0] || "";
        const days = daySections.slice(1);
        
        // Match day titles for prompt generation
        const dayHeaders = Array.from(aiText.matchAll(/DIA (\d+):?\s*(.*)/gi)).map(m => m[2] || `Dia ${m[1]}`);
        
        const dailyImagePromises = dayHeaders.map((header, i) => {
            const context = days[i]?.substring(0, 300) || "";
            return generateImagenImage(`A beautiful travel photo of ${header}. ${context}. Realistic, professional travel photography.`, apiKey);
        });

        const [coverBuffer, logoBuffer, ...dailyBuffers] = await Promise.all([
            coverPromise,
            fetchImageBuffer("https://www.travelfrontiers.pt/img/logo-newTF.png").catch(() => null),
            ...dailyImagePromises
        ]);

        // 5. Build DOCX
        const children = [];

        // Cover
        if (coverBuffer) {
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: coverBuffer, transformation: { width: 550, height: 350 }, type: 'png' })],
                spacing: { after: 400 }
            }));
        }

        children.push(new Paragraph({
            text: title || "Your Travel Frontiers Itinerary",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
        }));

        // Intro
        if (intro) {
            intro.split('\n').filter(l => l.trim()).forEach(line => {
                children.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })], spacing: { after: 200 } }));
            });
        }

        // Days
        days.forEach((dayContent, i) => {
            const header = dayHeaders[i] || `Dia ${i + 1}`;
            const dayBuffer = dailyBuffers[i];

            // Day Title
            children.push(new Paragraph({
                text: `DIA ${i + 1}: ${header.toUpperCase()}`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 }
            }));

            // Daily Image
            if (dayBuffer) {
                children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({ data: dayBuffer, transformation: { width: 500, height: 250 }, type: 'png' })],
                    spacing: { after: 300 }
                }));
            }

            // Day Content
            dayContent.split('\n').filter(l => l.trim()).forEach(line => {
                children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 150 } }));
            });
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: children as any,
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    logoBuffer ? new ImageRun({ data: logoBuffer, transformation: { width: 40, height: 40 }, type: 'png' }) : new TextRun({ text: "TF" }),
                                    new TextRun({ text: "  Travel Frontiers", bold: true, size: 24, color: "D4AF37" }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: "www.instagram.com/tf.travel.frontiers  |  www.travelfrontiers.pt", size: 18 }),
                                ],
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
        console.error("API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
