import { GoogleGenAI } from "@google/genai";

export async function generateText(prompt: string, options: { json?: boolean; maxTokens: number }) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    if (!apiKey) throw new Error("Gemini indisponível.");
    const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } });
    const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
            maxOutputTokens: options.maxTokens,
            ...(options.json ? { responseMimeType: "application/json" } : {}),
        },
    });
    if (!response.text?.trim()) throw new Error("Resposta Gemini vazia.");
    return response.text.trim();
}
