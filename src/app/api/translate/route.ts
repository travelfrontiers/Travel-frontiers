import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Translation Strategy: Gemma 4 (primary) -> DeepL (secondary) -> MyMemory (last resort) -> Copy (fallback)

/**
 * Translate text using Gemma 4 via Google Generative AI
 */
async function translateWithGemma(text: string, targetLang: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemma-4' });

    const langName = targetLang === 'en' ? 'English' : 'French';
    const prompt = `You are a professional travel content translator. Translate the following Portuguese text to ${langName}.\nReturn ONLY the translated text, with no explanations, no quotes, and no extra commentary.\n\n${text}`;

    const result = await model.generateContent(prompt);
    const translated = result.response.text().trim();

    if (!translated) throw new Error('Gemma 4 returned an empty translation');
    return translated;
}

/**
 * Translate text using DeepL API
 */
async function translateWithDeepL(text: string, targetLang: string): Promise<string> {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) throw new Error('DEEPL_API_KEY not configured');

    const deeplLang = targetLang === 'en' ? 'EN-US' : targetLang.toUpperCase();

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: [text],
            source_lang: 'PT',
            target_lang: deeplLang,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepL API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.translations[0].text;
}

/**
 * Translate text using MyMemory (fallback)
 */
async function translateWithMyMemory(text: string, targetLang: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt|${targetLang}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`MyMemory API error (${response.status})`);

    const data = await response.json();
    if (data.responseStatus !== 200) {
        throw new Error(`MyMemory returned error: ${data.responseDetails || 'Unknown error'}`);
    }

    return data.responseData.translatedText;
}

/**
 * Translate text with automatic failover
 */
async function translateText(text: string, targetLang: string): Promise<string> {
    if (!text || text.trim() === '') return '';

    // --- Tier 1: Gemma 4 ---
    try {
        const result = await translateWithGemma(text, targetLang);
        console.log(`✓ Gemma 4 translated: "${text.substring(0, 30)}..."`);
        return result;
    } catch (gemmaError: any) {
        console.warn(`Gemma 4 failed: ${gemmaError.message}. Trying DeepL...`);

        // --- Tier 2: DeepL ---
        try {
            const result = await translateWithDeepL(text, targetLang);
            console.log(`✓ DeepL translated: "${text.substring(0, 30)}..."`);
            return result;
        } catch (deeplError: any) {
            console.warn(`DeepL failed: ${deeplError.message}. Trying MyMemory...`);

            // --- Tier 3: MyMemory ---
            try {
                const result = await translateWithMyMemory(text, targetLang);
                console.log(`✓ MyMemory translated: "${text.substring(0, 30)}..."`);
                return result;
            } catch (myMemoryError: any) {
                console.error(`All providers failed (Gemma 4, DeepL, MyMemory). Returning original text.`);
                console.error(`  - DeepL: ${deeplError.message}`);
                console.error(`  - MyMemory: ${myMemoryError.message}`);
                return text;
            }
        }
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, description, subtitle, location, duration, highlights, inclusions } = body;

        if (!title || !description) {
            return NextResponse.json({ error: "Missing title or description" }, { status: 400 });
        }

        const descText = Array.isArray(description)
            ? description.map(block => block.children?.map((c: any) => c.text).join('')).join('\n')
            : description;

        const translateArray = async (arr: string[] | undefined, lang: string) => {
            if (!arr || !Array.isArray(arr)) return [];
            return Promise.all(arr.map(item => translateText(item, lang)));
        };

        const enResults = {
            title: await translateText(title, 'en'),
            description: await translateText(descText, 'en'),
            subtitle: subtitle ? await translateText(subtitle, 'en') : '',
            location: location ? await translateText(location, 'en') : '',
            duration: duration ? await translateText(duration, 'en') : '',
            highlights: await translateArray(highlights, 'en'),
            inclusions: await translateArray(inclusions, 'en'),
        };

        const frResults = {
            title: await translateText(title, 'fr'),
            description: await translateText(descText, 'fr'),
            subtitle: subtitle ? await translateText(subtitle, 'fr') : '',
            location: location ? await translateText(location, 'fr') : '',
            duration: duration ? await translateText(duration, 'fr') : '',
            highlights: await translateArray(highlights, 'fr'),
            inclusions: await translateArray(inclusions, 'fr'),
        };

        return NextResponse.json({
            en: enResults,
            fr: frResults
        });
    } catch (error: any) {
        console.error("Translation error details:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
