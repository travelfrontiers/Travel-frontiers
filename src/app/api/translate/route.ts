import { NextResponse } from "next/server";

// Hybrid Translation Strategy: DeepL (primary) -> MyMemory (fallback) -> Copy (last resort)

/**
 * Translate text using DeepL API
 * Free tier: 500,000 characters/month
 */
async function translateWithDeepL(text: string, targetLang: string): Promise<string> {
    const apiKey = process.env.DEEPL_API_KEY;

    if (!apiKey) {
        throw new Error('DEEPL_API_KEY not configured');
    }

    // Validate API key format (DeepL Free keys end with :fx and are 36+ chars)
    if (apiKey.length < 30) {
        throw new Error('Invalid DeepL API key format (key too short)');
    }

    // DeepL uses 'EN-US' or 'EN-GB' for English, 'FR' for French
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
 * Free, no API key required, 1000 words/day
 */
async function translateWithMyMemory(text: string, targetLang: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt|${targetLang}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`MyMemory API error (${response.status})`);
    }

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

    try {
        // Try DeepL first
        const result = await translateWithDeepL(text, targetLang);
        console.log(`✓ Translated with DeepL: "${text.substring(0, 30)}..."`);
        return result;
    } catch (deeplError: any) {
        console.warn(`DeepL failed: ${deeplError.message}. Trying MyMemory...`);

        try {
            // Fallback to MyMemory
            const result = await translateWithMyMemory(text, targetLang);
            console.log(`✓ Translated with MyMemory: "${text.substring(0, 30)}..."`);
            return result;
        } catch (myMemoryError: any) {
            console.error(`Both DeepL and MyMemory failed. Returning original text.`);
            console.error(`  - DeepL: ${deeplError.message}`);
            console.error(`  - MyMemory: ${myMemoryError.message}`);
            // Last resort: return original text (user will need to translate manually)
            return text;
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

        // Helper to translate arrays
        const translateArray = async (arr: string[] | undefined, lang: string) => {
            if (!arr || !Array.isArray(arr)) return [];
            return Promise.all(arr.map(item => translateText(item, lang)));
        };

        // Translate to English
        const enResults = {
            title: await translateText(title, 'en'),
            description: await translateText(descText, 'en'),
            subtitle: subtitle ? await translateText(subtitle, 'en') : '',
            location: location ? await translateText(location, 'en') : '',
            duration: duration ? await translateText(duration, 'en') : '',
            highlights: await translateArray(highlights, 'en'),
            inclusions: await translateArray(inclusions, 'en'),
        };

        // Translate to French
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
