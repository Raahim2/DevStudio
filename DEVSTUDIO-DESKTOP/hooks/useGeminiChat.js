// src/hooks/useGeminiChat.js
import { useState, useCallback, useEffect, useRef } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API;
const API_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest';
const API_STREAM_GENERATE_CONTENT_URL = `${API_ENDPOINT_BASE}:streamGenerateContent`;

const safetySettings = [ /* ... safety settings ... */ ];
const generationConfig = { candidateCount: 1 };

// Helper function inside the hook or imported
const formatHistoryForAPI = (history) => {
    return history
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(message => ({
            role: message.role,
            parts: [{ text: message.text }]
        }));
};


export const useGeminiChat = (initialHistory = []) => {
    const [chatHistory, setChatHistory] = useState(initialHistory);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null); // Errors related to Gemini API
    const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
    const abortControllerRef = useRef(null);
    const contextAddedForPathRef = useRef(null); // Keep track of context prepending

    // Check API Key
    useEffect(() => {
        if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY' || API_KEY.trim() === '') {
            setError("Gemini API key not found. Set NEXT_PUBLIC_GEMINI_API.");
            setIsApiKeyMissing(true);
        } else {
            setIsApiKeyMissing(false);
            if (error && error.startsWith("Gemini API key not found")) {
                setError(null);
            }
        }
        return () => { abortControllerRef.current?.abort(); }; // Cleanup on unmount
     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

     // Effect to handle file context changes signaled from parent
     const setFileContext = useCallback((selectedFile) => {
          const currentFilePath = selectedFile?.path;
          if (currentFilePath) {
              if (contextAddedForPathRef.current !== currentFilePath) {
                   console.log(`Hook: File context changed to: ${currentFilePath}`);
                   setChatHistory([]); // Clear history on context change
                   setError(null);
                   contextAddedForPathRef.current = null; // Reset flag
                   // Add system message via setChatHistory
                   setChatHistory([{ id: `system-${Date.now()}`, role: 'system', text: `Context: **${selectedFile.name}**`}]);
              }
          } else {
               if (contextAddedForPathRef.current !== null) {
                    console.log("Hook: File context cleared.");
                    contextAddedForPathRef.current = null;
                    // Optionally clear history or add system message
                    // setChatHistory([]);
               }
          }
     }, []); // Return this function

    // The core message sending logic
    const sendMessage = useCallback(async (userQuery, selectedFile, selectedFileContent) => {
        if (!userQuery || isSending || isApiKeyMissing) {
            console.warn("Hook: Send message blocked.", { isSending, isApiKeyMissing });
            return;
        }

        setError(null);
        setIsSending(true);

        const userMessageId = `user-${Date.now()}`;
        const modelMessageId = `model-${Date.now()}`;

        // Context Prepending Logic
        const shouldPrependContext = selectedFile && selectedFileContent && contextAddedForPathRef.current !== selectedFile.path;
        let textToSendToApi = userQuery;
        if (shouldPrependContext) {
            const fileHeader = `--- File Context: ${selectedFile.name} (${selectedFile.path}) ---\n\n`;
            const fileFooter = "\n\n--- End File Context ---";
            const maxContextLength = 15000;
            const truncatedContent = selectedFileContent.length > maxContextLength
                ? selectedFileContent.substring(0, maxContextLength) + "\n... (truncated) ..."
                : selectedFileContent;
            textToSendToApi = `${fileHeader}${truncatedContent}${fileFooter}\n\nMy question:\n${userQuery}`;
            contextAddedForPathRef.current = selectedFile.path; // Mark context as sent
            console.log(`Hook: Prepending context for ${selectedFile.path}`);
        } else {
             console.log("Hook: Sending query without prepended context.");
        }

        const previousMessagesForApi = formatHistoryForAPI(chatHistory);
        const currentUserApiPart = { role: 'user', parts: [{ text: textToSendToApi }] };
        const requestBody = { contents: [...previousMessagesForApi, currentUserApiPart], safetySettings, generationConfig };
        const fullApiUrl = `${API_STREAM_GENERATE_CONTENT_URL}?key=${API_KEY}&alt=sse`;

        // Update UI immediately
        const newUserMessageForDisplay = { id: userMessageId, role: 'user', text: userQuery };
        setChatHistory(prev => [...prev, newUserMessageForDisplay, { id: modelMessageId, role: 'model', text: '' }]);

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(fullApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: abortControllerRef.current.signal });

            if (!response.ok) { /* ... Gemini API error handling (same as before) ... */
                 let errorData; try { errorData = await response.json(); } catch (e) {}
                const errorDetails = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;
                if (response.status === 400 && errorDetails.includes("API key not valid")) throw new Error("Invalid Gemini API Key.");
                if (response.status === 403) throw new Error("Gemini API Key lacks permission.");
                if (response.status === 429) throw new Error("API Rate Limit Exceeded.");
                if (response.status === 400 && errorDetails.toLowerCase().includes('request payload size')) throw new Error("Request size limit exceeded.");
                if (response.status === 400 && errorDetails.toLowerCase().includes('user location')) throw new Error("API access restricted for region.");
                throw new Error(errorDetails);
            }
            if (!response.body) throw new Error("Response body stream missing.");

            // Stream processing logic (same as before)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedText = '';
            let streamError = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonString = line.substring(6).trim();
                        if (!jsonString) continue;
                        try {
                            const chunkData = JSON.parse(jsonString);
                            if (chunkData.error) { streamError = `API error in stream: ${chunkData.error.message}`; break; }
                            const blockReason = chunkData.promptFeedback?.blockReason;
                            const finishReasonSafety = chunkData.candidates?.[0]?.finishReason === 'SAFETY';
                            if (blockReason || finishReasonSafety) { streamError = `Content blocked by API: ${blockReason || "Safety Settings"}.`; break; }
                            const textChunk = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (typeof textChunk === 'string') {
                                accumulatedText += textChunk;
                                // Update history incrementally
                                setChatHistory(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, text: accumulatedText } : msg ));
                            }
                        } catch (parseError) { console.warn("Stream parsing error:", parseError); }
                    }
                }
                if (streamError) break;
            }

            if (streamError) throw new Error(streamError);
            if (accumulatedText === '' && !error && !streamError) {
                 setChatHistory(prev => prev.map(msg => msg.id === modelMessageId ? { ...msg, text: "[Model provided no response]" } : msg ));
            }

        } catch (err) {
            if (shouldPrependContext) { contextAddedForPathRef.current = null; } // Reset if failed
            setChatHistory(prev => prev.filter(msg => msg.id !== modelMessageId)); // Remove placeholder
            if (err.name === 'AbortError') { setError("Message generation cancelled."); }
            else { setError(err.message || "An unknown chat error occurred."); console.error("Chat Hook Error:", err); }
        } finally {
            setIsSending(false);
            abortControllerRef.current = null;
        }
    }, [isSending, isApiKeyMissing, chatHistory, error]); // Dependencies for sendMessage

    // Function to stop generation
    const stopGenerating = useCallback(() => {
        if (isSending && abortControllerRef.current) {
            abortControllerRef.current.abort();
            console.log("Hook: Abort requested.");
            // Note: isSending will be set to false in the finally block of sendMessage
        }
    }, [isSending]);

     // Function to clear the error manually
     const clearError = useCallback(() => {
         setError(null);
     }, []);

    return {
        chatHistory,
        sendMessage,
        isSending,
        error,
        clearError,
        isApiKeyMissing,
        stopGenerating,
        setFileContext, // Expose function to signal context change
    };
};