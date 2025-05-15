// src/lib/geminiUtils.js (or similar location)

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API;
const API_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest';
const API_GENERATE_CONTENT_URL = `${API_ENDPOINT_BASE}:generateContent`; // Non-streaming endpoint

const safetySettings = [
    // Add your desired safety settings here, e.g.:
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const generationConfig = {
    // temperature: 0.7, // Example: Adjust creativity (0-1)
    // topP: 0.9,        // Example: Nucleus sampling
    // topK: 40,         // Example: Top-k sampling
    candidateCount: 1,
    // maxOutputTokens: 8192, // Model default is usually high enough
    // stopSequences: [],   // If needed
};

export const callGeminiForEdit = async (selectedCode, userPrompt, language) => {
    if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY' || API_KEY.trim() === '') {
        throw new Error("Gemini API key not configured. Set NEXT_PUBLIC_GEMINI_API.");
    }
    if (!selectedCode || !userPrompt) {
        throw new Error("Selected code and user prompt are required.");
    }

    // Construct a focused prompt for code modification
    const systemPrompt = `You are an expert programmer assisting with code editing.
Carefully analyze the user's instructions and the provided code block.
Modify the code block based *only* on the user's instructions.
Output *only* the modified code block. Do not include any explanations, introductions, comments about your changes, or markdown formatting like \`\`\` or \`\`\`${language}.
Ensure the output is syntactically correct for the given language.

Language: ${language || 'plaintext'}
User Instructions: ${userPrompt}
--- Code to Modify ---
${selectedCode}
--- End Code ---

Modified Code:`;

    const requestBody = {
        contents: [{
            role: 'user', // Single turn, treat the whole prompt as user input
            parts: [{ text: systemPrompt }]
        }],
        safetySettings,
        generationConfig,
    };

    const fullApiUrl = `${API_GENERATE_CONTENT_URL}?key=${API_KEY}`;

    try {
        const response = await fetch(fullApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (e) { /* ignore parsing error */ }
            const errorDetails = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;
            console.error("Gemini API Error Response:", errorData); // Log full error
            if (response.status === 400 && errorDetails.includes("API key not valid")) throw new Error("Invalid Gemini API Key.");
            if (response.status === 403) throw new Error("Gemini API Key lacks permission or API is not enabled.");
            if (response.status === 429) throw new Error("API Rate Limit Exceeded. Please try again later.");
            if (response.status === 400 && errorDetails.toLowerCase().includes('request payload size')) throw new Error("Code selection/prompt too large.");
             if (response.status === 400 && errorDetails.toLowerCase().includes('user location')) throw new Error("API access restricted for your region.");
             if (response.status === 500 || response.status === 503) throw new Error("Gemini service unavailable. Please try again later.");
            throw new Error(errorDetails);
        }

        const responseData = await response.json();
        console.log("Gemini API Response:", responseData); // Log the full response for debugging

        // Check for safety blocks or lack of content
        const candidate = responseData?.candidates?.[0];
        const blockReason = responseData?.promptFeedback?.blockReason;
        const finishReason = candidate?.finishReason;

        if (blockReason) {
             throw new Error(`Content blocked by API: ${blockReason}. Adjust safety settings or prompt.`);
        }
        if (finishReason === 'SAFETY') {
             throw new Error("Content blocked due to safety settings.");
        }
        if (finishReason === 'RECITATION') {
             throw new Error("Content blocked due to potential recitation.");
        }
        if (finishReason === 'OTHER') {
             throw new Error("Content generation stopped for an unknown reason.");
        }

        const modifiedCode = candidate?.content?.parts?.[0]?.text?.trim(); // Trim whitespace
        if (!modifiedCode) {
            console.warn("Gemini Response Missing Text:", responseData);
             if (finishReason === 'MAX_TOKENS') {
                throw new Error("Model reached maximum output length before finishing.");
             }
            throw new Error("Model did not return any modified code content.");
        }

        return modifiedCode;

    } catch (error) {
        console.error("Gemini Edit API Call Failed:", error);
        throw error;
    }
};

export const callGeminiForPlan = async (prompt) => {
    if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY' || API_KEY.trim() === '') {
        throw new Error("Gemini API key not configured. Set NEXT_PUBLIC_GEMINI_API.");
    }
    if (!prompt) {
        throw new Error("Prompt is required for plan generation.");
    }

    const requestBody = {
        contents: [{
            role: 'user',
            parts: [{ text: prompt }]
        }],
        safetySettings,
        generationConfig,
    };

    const fullApiUrl = `${API_GENERATE_CONTENT_URL}?key=${API_KEY}`;
    console.log("Calling Gemini for Plan:", fullApiUrl);

    try {
        const response = await fetch(fullApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            // ... (Keep your robust error handling) ...
             let errorData;
             try { errorData = await response.json(); } catch (e) { /* ignore */ }
             const errorDetails = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;
             console.error("Gemini API Error Response (Plan):", errorData);
             if (response.status === 400 && errorDetails.includes("API key not valid")) throw new Error("Invalid Gemini API Key.");
             // ... add other specific status checks ...
             throw new Error(errorDetails);
        }

        const responseData = await response.json();
        console.log("Gemini API Response (Plan):", responseData);

        const candidate = responseData?.candidates?.[0];
        const blockReason = responseData?.promptFeedback?.blockReason;
        const finishReason = candidate?.finishReason;

        // ... (Keep safety/finishReason checks) ...
        if (blockReason) { throw new Error(`Content blocked by API: ${blockReason}.`); }
        if (finishReason === 'SAFETY') { throw new Error("Content blocked due to safety settings."); }
        // ... other finish reasons ...

        const rawText = candidate?.content?.parts?.[0]?.text;
        if (!rawText) {
            console.warn("Gemini Response Missing Text:", responseData);
            throw new Error("Model did not return any plan content.");
        }

        console.log("Raw text from Gemini:", rawText); // Log raw output

        // --- START CORRECTED CLEANING LOGIC ---
        let jsonToParse = rawText.trim(); // Trim whitespace first

        // Use regex to find and extract content within ```json ... ``` or ``` ... ```
        const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/; // Matches optional "json" label
        const match = jsonToParse.match(fenceRegex);

        if (match && match[1]) {
            // If fences are found, use the captured content (match[1])
            jsonToParse = match[1].trim();
            console.log("Successfully extracted content from within markdown fences:", jsonToParse);
        } else {
            // If no fences found, log a warning but proceed, assuming the raw text might be the JSON
            console.log("Markdown fences not found. Attempting to parse the trimmed text directly:", jsonToParse);
            // Optional: Add a check if it starts/ends with braces as a sanity check
            if (!jsonToParse.startsWith('{') || !jsonToParse.endsWith('}')) {
                 console.warn("Text without fences doesn't start/end with braces. Parsing might fail.");
            }
        }
        // --- END CORRECTED CLEANING LOGIC ---

        // Attempt to parse the processed text
        try {
            const parsedPlan = JSON.parse(jsonToParse);

            // Basic validation (recommended)
            if (!parsedPlan["Project Overview"] || !parsedPlan["Daily Breakdown"]) {
                console.warn("Parsed JSON missing expected keys:", parsedPlan);
                throw new Error("Generated plan has an unexpected structure (missing required keys).");
            }
            console.log("Successfully parsed processed JSON.");
            return parsedPlan;

        } catch (parseError) {
            console.error("Failed to parse Gemini JSON response:", parseError);
            // Log the TEXT THAT FAILED parsing - this is crucial for debugging
            console.error("Final Text that failed parsing:", jsonToParse);
            console.error("Original Raw Text:", rawText); // Log original text for context
            // Provide a clearer error message indicating the likely cause
            throw new Error(`Failed to parse the generated plan. The model's output likely included non-JSON text (like markdown fences) that couldn't be fully removed. Parse Error: ${parseError.message}`);
        }

    } catch (error) {
        // Log the error coming from the try block OR the initial fetch/checks
        console.error("Gemini Plan API Call Failed:", error);
        throw error; // Re-throw to be caught by the calling component
    }
};