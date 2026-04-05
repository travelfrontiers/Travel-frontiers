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

async function generateGeminiImage(prompt: string, apiKey: string): Promise<Buffer | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use the 2026 native image model which is unrestricted in the EU/Portugal
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image-preview' });
        
        const result = await model.generateContent(prompt);
        const data = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        return data ? Buffer.from(data, 'base64') : null;
    } catch (e) {
        console.warn("Failed to generate native image:", e);
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
- Throughout the text, insert this exact tag where a beautiful photo should be: [IMAGE: description of a professional travel photo of the location/activity]
- Language: Portuguese (Portugal).
- Tone: Premium, expert, inspiring.
- NO Markdown (no ** or #).
`;

        const result = await model.generateContent(textPrompt);
        const aiText = result.response.text();

        // 4. Image Generation Logic (Tag-based)
        const imageTags = Array.from(aiText.matchAll(/\[IMAGE:\s*(.*?)\]/g));
        // Also add a cover image prompt
        const coverPrompt = `A stunning, inviting luxury travel landscape for an itinerary titled ${title || "Travel Frontiers"}. Professional travel photography.`;
        
        const allImagePrompts = [coverPrompt, ...imageTags.map(m => m[1])];
        const allImageBuffers = await Promise.all(
            allImagePrompts.map(prompt => generateGeminiImage(prompt, apiKey))
        );

        const coverBuffer = allImageBuffers[0];
        const dailyBuffers = allImageBuffers.slice(1);
        const logoBuffer = await fetchImageBuffer("https://www.travelfrontiers.pt/img/logo-newTF.png").catch(() => null);

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

        // Parse text and insert images where tags are
        let currentImageIndex = 0;
        const lines = aiText.split('\n');
        
        for (const line of lines) {
            const cleanLine = line.replace(/\[IMAGE:.*?\]/g, '').trim();
            
            if (cleanLine) {
                // Determine if it's a heading
                const isHeading = cleanLine.startsWith('DIA ');
                children.push(new Paragraph({
                    text: cleanLine,
                    heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
                    children: isHeading ? [] : [new TextRun({ text: cleanLine, size: 22 })],
                    spacing: { before: isHeading ? 400 : 0, after: 150 }
                }));
            }

            // If the original line had an image tag, insert the image buffer
            if (line.includes('[IMAGE:')) {
                const imgBuffer = dailyBuffers[currentImageIndex++];
                if (imgBuffer) {
                    children.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new ImageRun({ data: imgBuffer, transformation: { width: 500, height: 280 }, type: 'png' })],
                        spacing: { before: 200, after: 200 }
                    }));
                }
            }
        }

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
