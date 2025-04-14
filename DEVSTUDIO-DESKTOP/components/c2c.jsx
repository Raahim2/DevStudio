'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FiSend, FiCpu, FiAlertCircle, FiX, FiZap, FiInfo, FiFileText } from 'react-icons/fi'; // Added FiFileText
import { useGeminiChat } from '../hooks/useGeminiChat'; // Ensure this path is correct
import CodeBlock from './c2ccode'; // Ensure this path is correct
import ChatMessage from './c2ccm'; // Ensure this path is correct

// Simple hash function (no changes needed here)
const hashString = (str) => {
    let hash = 0;
    if (!str || str.length === 0) return '0';
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
};

const ChatSection = ({
    selectedRepoFullName, 
    accessToken, 
    selectedFile,
    context, 
    onClearContext
}) => {
    const chatContainerRef = useRef(null);
    const {
        chatHistory,
        sendMessage,
        isSending,
        error: geminiError,
        clearError: clearGeminiError,
        isApiKeyMissing,
        stopGenerating,
        setFileContext,
    } = useGeminiChat(); // Potentially pass accessToken if hook needs it

    const [inputMessage, setInputMessage] = useState('');
    const [copiedStates, setCopiedStates] = useState({});

    // Effect to pass the file context content to the chat hook
    useEffect(() => {
        if (selectedFile && context !== null) {
            // Pass the file object (with content included or reference) to the hook
            // The hook might internally decide what to do with it.
            // We create a simplified object here for the hook if needed.
             const fileForHook = {
                 path: selectedFile.path,
                 name: selectedFile.name,
                 content: typeof context === 'string' ? context : null, // Ensure content is string or null
             };
            setFileContext(fileForHook);
        } else {
            setFileContext(null); // Clear context in the hook if no file or content
        }
    }, [selectedFile, context, setFileContext]);


    // Auto-scroll effect
    useEffect(() => {
        if (chatContainerRef.current) {
            // Use requestAnimationFrame for smoother scrolling after render
            requestAnimationFrame(() => {
                chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    }, [chatHistory]); // Trigger scroll on new messages

    const handleInputChange = (e) => setInputMessage(e.target.value);

    const handleSendMessage = useCallback(() => {
        if (!inputMessage.trim() || isSending || isApiKeyMissing) return;
        // Send message with reference to the selected file (name/path)
        // The hook uses the context already set via setFileContext
        sendMessage(inputMessage, selectedFile, selectedFile?.path); // Pass file object and path/identifier
        setInputMessage('');
    }, [inputMessage, isSending, isApiKeyMissing, sendMessage, selectedFile]);

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleStopGenerating = useCallback(() => stopGenerating(), [stopGenerating]);

    const handleCopyCode = useCallback((codeString, id) => {
        navigator.clipboard.writeText(codeString).then(() => {
            setCopiedStates(prev => ({ ...prev, [id]: true }));
            setTimeout(() => {
                setCopiedStates(prev => ({ ...prev, [id]: false }));
            }, 2000);
        }, (err) => {
            console.error('Failed to copy code:', err);
            // Optionally show a user-facing error message here
            setCopiedStates(prev => ({ ...prev, [id]: false }));
        });
    }, []);

    // Memoized Markdown components for performance
    const markdownComponents = useMemo(() => ({
        code: ({ node, inline, className, children, ...props }) => {
             const match = /language-(\w+)/.exec(className || '');
             const language = match?.[1] || 'plaintext';
             // Ensure children is processed correctly to get the code string
             const codeString = React.Children.toArray(children)
                .map(child => (typeof child === 'string' ? child : '')) // Handle potential non-string children if any
                .join('')
                .replace(/\n$/, ''); // Remove trailing newline
             const codeBlockId = `code-${language}-${hashString(codeString.substring(0, 50))}`;

             if (inline) {
                 // Style inline code
                 return <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono text-purple-700 dark:text-purple-300" {...props}>{children}</code>;
             } else {
                 // Use the dedicated CodeBlock component
                 return (
                    <CodeBlock
                        language={language}
                        codeString={codeString}
                        id={codeBlockId}
                        isCopied={!!copiedStates[codeBlockId]}
                        onCopyCode={handleCopyCode}
                    />
                 );
             }
        },
        // Standard markdown elements with basic styling
        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
        a: ({ node, ...props }) => <a className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 pl-4 space-y-1" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 pl-4 space-y-1" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-2" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
    }), [copiedStates, handleCopyCode]); // Dependencies for memoization

    const isInteractionDisabled = isApiKeyMissing || isSending;
    const displayError = geminiError;
    const placeholderText = isApiKeyMissing ? "Cannot chat: Gemini API Key missing."
                           : isSending ? "Generating response..."
                           : selectedFile?.name ? `Ask about ${selectedFile.name}...` // Use filename in placeholder
                           : "Type your message...";

    return (
        // Main container: flex column, full height, background, border
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden border-l border-gray-200 dark:border-gray-700">

            {/* Chat messages area: flex-grow, scrollable, padding */}
            {/* Added scrollbar styling (requires tailwind-scrollbar plugin or custom CSS) */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
                {/* --- Empty/Initial State --- */}
                {chatHistory.length === 0 && !isSending && !isApiKeyMissing && (
                     <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 px-4 h-full min-h-[200px]">
                         {selectedFile?.name ? (
                             <>
                                 <FiFileText size={36} className="mb-3 text-indigo-400"/>
                                 <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">File Context Active</p>
                                 <p className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded max-w-md mx-auto font-mono text-gray-600 dark:text-gray-300" title={selectedFile.path}>
                                     {selectedFile.name}
                                 </p>
                                 <p className="text-sm mt-2">Ask anything about this file.</p>
                             </>
                         ) : (
                            <>
                                <FiZap size={36} className="mb-3 text-indigo-400"/>
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">Chat Ready</p>
                                <p className="text-sm">Type a message below to start chatting.</p>
                             </>
                         )}
                     </div>
                 )}

                 {/* --- API Key Missing State --- */}
                {isApiKeyMissing && chatHistory.length === 0 && (
                     <div className="flex flex-col items-center justify-center text-center text-red-600 dark:text-red-400 p-4 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 m-4">
                         <FiAlertCircle size={28} className="mb-2"/>
                         <span className="font-medium">{geminiError || "Gemini API Key missing or invalid."}</span>
                         <span className="text-sm mt-1">Please configure the API key in settings.</span>
                     </div>
                 )}

                {/* --- Chat History --- */}
                {chatHistory.map((message) => (
                    <ChatMessage
                        key={message.id} // Ensure unique key
                        message={message}
                        markdownComponents={markdownComponents} // Pass memoized components
                    />
                ))}

                 {/* --- Error Display (Sticky at bottom within scroll area) --- */}
                 {displayError && !isSending && (
                     <div className="sticky bottom-2 px-2 z-10"> {/* Reduced padding */}
                      <div className="flex items-center p-3 mx-auto w-full max-w-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 rounded-lg text-sm border border-red-200 dark:border-red-700/50 shadow-md">
                          <FiAlertCircle className="mr-2 flex-shrink-0" size={18}/>
                          <span className="flex-1 text-center">{displayError}</span>
                          <button
                              onClick={clearGeminiError}
                              className="ml-2 p-1 text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100 rounded-full hover:bg-red-200 dark:hover:bg-red-800/60 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                              aria-label="Dismiss error"
                              title="Dismiss error"
                          >
                            <FiX size={16}/>
                          </button>
                      </div>
                    </div>
                 )}
            </div>

            {/* --- Bottom Input Area --- */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 shadow-inner">

                 {/* --- Stop Generating Button --- */}
                 {isSending && (
                    <div className="flex justify-center mb-2.5">
                        <button
                            onClick={handleStopGenerating}
                            className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-md shadow-sm flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
                            title="Stop generating response"
                         >
                            <FiCpu size={14}/> Stop Generating
                        </button>
                    </div>
                 )}

                {/* --- Active File Context Indicator --- */}
                {selectedFile && selectedFile.name && (
                    <div className="mb-2 px-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60 rounded-md py-1.5">
                        {/* Display Filename */}
                        <div className="flex items-center overflow-hidden pl-1">
                             <FiFileText className="mr-1.5 flex-shrink-0 text-blue-500 dark:text-blue-400" size={14}/>
                             <span className="font-medium mr-1 flex-shrink-0">File:</span>
                             {/* Use mono font for filename, truncate if long, show full path on hover */}
                             <span
                                className="truncate font-mono text-gray-700 dark:text-gray-300"
                                title={`Context File: ${selectedFile.path}`} // Show full path in tooltip
                             >
                                {selectedFile.name}
                             </span>
                        </div>
                         {/* Clear Context Button */}
                         {onClearContext && typeof onClearContext === 'function' && ( // Check if handler is provided
                             <button
                                 onClick={onClearContext} // Calls handleClearFile from parent
                                 className="ml-2 mr-1 p-0.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600/50 focus:outline-none transition-colors"
                                 title="Clear file context"
                                 aria-label="Clear file context"
                             >
                                 <FiX size={15} />
                             </button>
                         )}
                    </div>
                )}

                {/* --- Text Input and Send Button --- */}
                <div className="relative flex items-end gap-2"> {/* Use gap for spacing */}
                    <textarea
                        placeholder={placeholderText}
                        value={inputMessage}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        className="flex-1 py-2.5 pl-4 pr-10 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out placeholder-gray-500 dark:placeholder-gray-400 dark:text-white shadow-sm focus:shadow-md" // Added shadow, adjusted padding/rounding
                        disabled={isInteractionDisabled}
                        style={{ maxHeight: '150px', overflowY: 'auto' }} // Slightly increased max height
                        aria-label="Chat input message"
                    />
                    {/* Send Button positioned absolutely within the relative container */}
                    <div className="absolute bottom-[7px] right-[7px]"> {/* Fine-tune position */}
                        <button
                            onClick={handleSendMessage}
                            className="p-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-150 ease-in-out transform active:scale-90" // Adjusted rounding, added active scale
                            disabled={isInteractionDisabled || !inputMessage.trim()}
                            title="Send message (Enter)"
                            aria-label="Send message"
                        >
                            <FiSend size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatSection;