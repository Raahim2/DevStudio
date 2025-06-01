'use client';

import { useState, useCallback, useRef } from 'react';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import crypto from "crypto";


async function fetchAndDecryptApiKey() {
  try {
    const res = await fetch("http://localhost:3001/api/token", { method: "POST" });
    if (!res.ok) throw new Error("Failed to fetch token");
    const { encrypted, salt, iv } = await res.json();

    const key = Buffer.from(salt, "hex");
    const ivBuffer = Buffer.from(iv, "hex");

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuffer);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted; 
  } catch (e) {
    console.error("Failed to fetch/decrypt token:", e);
    return null;
  }
}

const API_KEY =  await fetchAndDecryptApiKey();

export const useGeminiChat = () => {
    const [chatHistory, setChatHistory] = useState([]);
    

    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const [isApiKeyMissing, setIsApiKeyMissing] = useState(!API_KEY);
    const generationController = useRef(null); // To control stopping

    const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const sendMessage = useCallback(async (userInput) => {
        if (!genAI) {
            setError("Gemini API Key is missing or invalid.");
            setIsApiKeyMissing(true);
            return;
        }
        if (isSending) return;

        clearError();
        setIsSending(true);

        const userMessage = {
            id: Date.now() + '-user',
            role: 'user',
            content: userInput,
        };
        const modelMessagePlaceholder = {
            id: Date.now() + '-model',
            role: 'model',
            content: '', // Start empty, will be filled by stream
        };

        setChatHistory(prev => [...prev, userMessage, modelMessagePlaceholder]);

        generationController.current = new AbortController();
        const signal = generationController.current.signal;

        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                 safetySettings: [ // Basic safety settings
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 ],
            });

            // Construct history for the API call
            const historyPayload = chatHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }));

            const chat = model.startChat({ history: historyPayload });

            const result = await chat.sendMessageStream(userInput, { signal });

            let accumulatedContent = '';
            for await (const chunk of result.stream) {
                 if (signal.aborted) {
                     console.log("Streaming stopped by user.");
                     break; // Exit loop if aborted
                 }
                const chunkText = chunk.text();
                accumulatedContent += chunkText;
                // Update the last message (model's response) in the history
                setChatHistory(prev => prev.map((msg, index) =>
                    index === prev.length - 1
                        ? { ...msg, content: accumulatedContent }
                        : msg
                ));
            }
             // Final update in case the last chunk didn't trigger a state update somehow
             setChatHistory(prev => prev.map((msg, index) =>
                index === prev.length - 1
                    ? { ...msg, content: accumulatedContent || (signal.aborted ? "[Response stopped]" : "[No content received]") } // Add stopped message if applicable
                    : msg
             ));

        } catch (err) {
            console.error("Gemini API Error:", err);
             if (err.name === 'AbortError') {
                 setError("Response generation stopped.");
                 // Ensure the last message indicates it was stopped
                 setChatHistory(prev => prev.map((msg, index) =>
                    index === prev.length - 1 && msg.role === 'model'
                        ? { ...msg, content: (msg.content || "") + "\n[Response stopped by user]" }
                        : msg
                 ));
             } else if (err.message.includes('API key not valid')) {
                 setError("Gemini API Key is invalid. Please check your configuration.");
                 setIsApiKeyMissing(true);
             } else {
                 setError(`An error occurred: ${err.message || 'Unknown error'}`);
             }
              // Remove the placeholder if an error occurred before receiving content
             setChatHistory(prev => {
                 const lastMsg = prev[prev.length - 1];
                 if (lastMsg && lastMsg.role === 'model' && lastMsg.content === '') {
                     return prev.slice(0, -1);
                 }
                 return prev;
             });

        } finally {
            setIsSending(false);
            generationController.current = null; // Clear controller
        }
    }, [genAI, isSending, chatHistory, clearError]);

    const stopGenerating = useCallback(() => {
        if (generationController.current) {
            generationController.current.abort();
            console.log("Stop generation requested.");
        }
        setIsSending(false); // Update state immediately for UI feedback
    }, []);

    return {
        chatHistory,
        sendMessage,
        isSending,
        error,
        clearError,
        isApiKeyMissing,
        stopGenerating,
    };
};

