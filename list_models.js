const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function listModels() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        // Note: genAI.listModels() was deprecated in some versions, 
        // in newer ones it might be on the client.
        // Actually, the easiest way to find valid models is to try a known one or check docs.
        // But let's try the REST API directly via fetch to be sure.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        fs.writeFileSync('models_list.json', JSON.stringify(data, null, 2));
        console.log('Successfully wrote models_list.json');
    } catch (e) {
        console.error('List failed:', e.message);
    }
}

listModels();
