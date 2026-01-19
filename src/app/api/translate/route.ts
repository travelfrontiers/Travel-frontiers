import { NextResponse } from "next/server";

// Using MyMemory free translation API - no API key needed, 1000 words/day free
async function translateText(text: string, targetLang: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt|${targetLang}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.responseData.translatedText;
}

export async function POST(request: Request) {
    try {
        const { title, description } = await request.json();

        if (!title || !description) {
            return NextResponse.json({ error: "Missing title or description" }, { status: 400 });
        }

        const descText = Array.isArray(description)
            ? description.map(block => block.children?.map((c: any) => c.text).join('')).join('\n')
            : description;

        // Translate to English
        const enTitle = await translateText(title, 'en');
        const enDesc = await translateText(descText, 'en');

        // Translate to French
        const frTitle = await translateText(title, 'fr');
        const frDesc = await translateText(descText, 'fr');

        return NextResponse.json({
            en: { title: enTitle, description: enDesc },
            fr: { title: frTitle, description: frDesc }
        });
    } catch (error: any) {
        console.error("Translation error details:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
