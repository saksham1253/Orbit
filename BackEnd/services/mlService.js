const FormData = require("form-data");
require("dotenv").config();

/**
 * Analyzes the sentiment of a given text using Hugging Face's distilbert-base-uncased-finetuned-sst-2-english model.
 * @param {string} text The review or bio text to analyze.
 * @returns {Promise<number>} Sentiment score between -1.0 and 1.0. Returns 0 on failure.
 */
exports.analyzeSentiment = async (text) => {
    if (!text || text.trim() === "") return 0;
    
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
        console.warn("HUGGINGFACE_API_KEY is not set. Skipping sentiment analysis.");
        return 0; // Neutral fallback
    }

    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
            {
                headers: {
                    Authorization: `Bearer ${hfApiKey}`,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({ inputs: text }),
            }
        );

        if (!response.ok) {
            console.error("Hugging Face API Error:", await response.text());
            return 0;
        }

        const result = await response.json();
        
        // Response format is typically: [[{ label: 'POSITIVE', score: 0.99 }, { label: 'NEGATIVE', score: 0.01 }]]
        if (Array.isArray(result) && Array.isArray(result[0])) {
            const labels = result[0];
            const positiveObj = labels.find(l => l.label === "POSITIVE");
            const negativeObj = labels.find(l => l.label === "NEGATIVE");
            
            const posScore = positiveObj ? positiveObj.score : 0;
            const negScore = negativeObj ? negativeObj.score : 0;
            
            // Convert to a -1.0 to 1.0 scale
            return posScore - negScore;
        }

        return 0;

    } catch (err) {
        console.error("Sentiment Analysis Exception:", err);
        return 0;
    }
};

/**
 * Transcribes and checks for malicious content in an audio chunk using Groq Whisper API.
 * @param {Buffer} audioBuffer The chunk of audio from the video call
 * @returns {Promise<boolean>} True if malicious content is detected, false otherwise.
 */
exports.analyzeAudioChunkForMalcontent = async (audioBuffer) => {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        console.warn("GROQ_API_KEY is not set. Skipping audio analysis.");
        return false;
    }

    try {
        // Groq Whisper expects a multipart/form-data
        const form = new FormData();
        form.append("file", audioBuffer, {
            filename: "chunk.webm",
            contentType: "audio/webm",
        });
        form.append("model", "whisper-large-v3");
        form.append("response_format", "json");
        form.append("language", language);

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${groqApiKey}`,
                // form.getHeaders() is required when using form-data package with fetch
                ...form.getHeaders()
            },
            body: form,
        });

        if (!response.ok) {
            console.error("Groq API Error:", await response.text());
            return false;
        }

        const result = await response.json();
        const transcription = result.text || "";

        if (transcription.trim()) {
            console.log(`[Whisper Transcription]: "${transcription}"`);
        }

        // Basic Malcontent filtering logic
        // In a production app, we would use an LLM or toxicity classifier. 
        // Here we use a predefined list of flagged keywords/phrases indicating malicious intent.
        const restrictedKeywords = [
            "hack", "attack", "kill", "suicide", "bomb", "fraud", "scam", 
            "stolen", "malware", "virus", "illegal", "abuse"
        ];

        const lowercaseText = transcription.toLowerCase();
        for (let word of restrictedKeywords) {
            // Check for whole word match
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(lowercaseText)) {
                console.warn(`[ML Service] Malicious discussion detected. Trigger word: ${word}`);
                return true;
            }
        }

        return false;

    } catch (err) {
        console.error("Audio Analysis Exception:", err);
        return false;
    }
};
