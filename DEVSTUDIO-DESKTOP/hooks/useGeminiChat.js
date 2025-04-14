import { useState, useCallback, useEffect, useRef } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API;
const API_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest';
const API_STREAM_GENERATE_CONTENT_URL = `${API_ENDPOINT_BASE}:streamGenerateContent`;

const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const generationConfig = {
    candidateCount: 1,
    // stopSequences: [], // Add stop sequences if needed
    // maxOutputTokens: 8192, // Adjust as needed, Flash supports up to 8192
    // temperature: 1.0, // Adjust creativity (0.0 - 1.0+)
    // topP: 0.95, // Adjust token sampling (0.0 - 1.0)
    // topK: 40, // Adjust token sampling
};

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
    const [error, setError] = useState(null);
    const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
    const abortControllerRef = useRef(null);
    const contextAddedForPathRef = useRef(null);

    useEffect(() => {
        if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY' || API_KEY.trim() === '') {
            setError("Gemini API key not found. Set NEXT_PUBLIC_GEMINI_API environment variable.");
            setIsApiKeyMissing(true);
        } else {
            setIsApiKeyMissing(false);
            if (error && error.startsWith("Gemini API key not found")) {
                setError(null);
            }
        }
        return () => { abortControllerRef.current?.abort(); };
     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

     const setFileContext = useCallback((selectedFile) => {
          const currentFilePath = selectedFile?.path;
          const currentFileName = selectedFile?.name ?? 'Provided Context';

          if (currentFilePath) {
              if (contextAddedForPathRef.current !== currentFilePath) {
                   console.log(`Hook: Context changed/set to: ${currentFilePath} (Name: ${currentFileName})`);
                   setError(null);
                   contextAddedForPathRef.current = null;
                   setChatHistory(prevHistory => [
                       ...prevHistory,
                       {
                           id: `system-${Date.now()}`,
                           role: 'system',
                           text: `Context updated: **${currentFileName}**`
                       }
                   ]);
              } else {
                   console.log("Hook: Context set, but path is the same. No history change.");
              }
          } else {
               if (contextAddedForPathRef.current !== null) {
                    console.log("Hook: Context cleared.");
                    contextAddedForPathRef.current = null;
                    // Optionally add system message for context removal
                    // setChatHistory(prevHistory => [
                    //     ...prevHistory,
                    //     { id: `system-${Date.now()}`, role: 'system', text: `Context removed.` }
                    // ]);
               }
          }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, []);

    const sendMessage = useCallback(async (userQuery, selectedFile, selectedFileContent) => {
        if (!userQuery || isSending || isApiKeyMissing) {
            console.warn("Hook: Send message blocked.", { isSending, isApiKeyMissing });
            return;
        }

        setError(null);
        setIsSending(true);

        const userMessageId = `user-${Date.now()}`;
        const modelMessageId = `model-${Date.now()}`;

        const shouldPrependContext = selectedFile && selectedFileContent && contextAddedForPathRef.current !== selectedFile.path;
        let textToSendToApi = userQuery;
        if (shouldPrependContext) {
            const fileHeader = `--- Context: ${selectedFile.name} ---\n\n`; // Simplified header
            const fileFooter = "\n\n--- End Context ---";
            const maxContextLength = 15000; // Adjust based on token limits and typical context size
            const truncatedContent = selectedFileContent.length > maxContextLength
                ? selectedFileContent.substring(0, maxContextLength) + "\n... (truncated) ..."
                : selectedFileContent;
            textToSendToApi = `${fileHeader}${truncatedContent}${fileFooter}\n\nMy question:\n${userQuery}`;
            contextAddedForPathRef.current = selectedFile.path;
            console.log(`Hook: Prepending context for ${selectedFile.path}`);
        } else {
             console.log("Hook: Sending query without prepended context.");
        }

        const previousMessagesForApi = formatHistoryForAPI(chatHistory);
        const currentUserApiPart = { role: 'user', parts: [{ text: textToSendToApi }] };
        const requestBody = { contents: [...previousMessagesForApi, currentUserApiPart], safetySettings, generationConfig };
        const fullApiUrl = `${API_STREAM_GENERATE_CONTENT_URL}?key=${API_KEY}&alt=sse`;

        const newUserMessageForDisplay = { id: userMessageId, role: 'user', text: userQuery };
        setChatHistory(prev => [...prev, newUserMessageForDisplay, { id: modelMessageId, role: 'model', text: '' }]);

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(fullApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: abortControllerRef.current.signal });

            if (!response.ok) {
                let errorData; try { errorData = await response.json(); } catch (e) {}
                const errorDetails = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;
                if (response.status === 400 && errorDetails.includes("API key not valid")) throw new Error("Invalid Gemini API Key.");
                if (response.status === 403) throw new Error("Gemini API Key lacks permission.");
                if (response.status === 429) throw new Error("API Rate Limit Exceeded. Please wait and try again.");
                if (response.status === 400 && errorDetails.toLowerCase().includes('request payload size')) throw new Error("Request size limit exceeded. Try a shorter query or context.");
                if (response.status === 400 && errorDetails.toLowerCase().includes('user location')) throw new Error("API access restricted for your region.");
                throw new Error(errorDetails);
            }
            if (!response.body) throw new Error("Response body stream missing.");

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
                            if (blockReason || finishReasonSafety) { streamError = `Content blocked by API: ${blockReason || "Safety Settings"}. Try rephrasing your query.`; break; }
                            const textChunk = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (typeof textChunk === 'string') {
                                accumulatedText += textChunk;
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
            if (shouldPrependContext) { contextAddedForPathRef.current = null; }
            setChatHistory(prev => prev.filter(msg => msg.id !== modelMessageId));
            if (err.name === 'AbortError') { setError("Message generation cancelled."); }
            else { setError(err.message || "An unknown chat error occurred."); console.error("Chat Hook Error:", err); }
        } finally {
            setIsSending(false);
            abortControllerRef.current = null;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSending, isApiKeyMissing, chatHistory, error]); // Removed explicit setError dependency as it's set within

    const stopGenerating = useCallback(() => {
        if (isSending && abortControllerRef.current) {
            abortControllerRef.current.abort();
            console.log("Hook: Abort requested.");
        }
    }, [isSending]);

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
        setFileContext,
    };
};