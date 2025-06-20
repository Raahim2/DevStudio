'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FiSend, FiCpu, FiAlertCircle, FiX, FiUser, FiFileText } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock'; // Assuming CodeBlock.js is in the same directory or path is correct

const callElectronApi = async (funcName, ...args) => {
    if (window.electronAPI && typeof window.electronAPI[funcName] === 'function') {
        try {
            const result = await window.electronAPI[funcName](...args);
            return result;
        } catch (error) {
            console.error(`Error calling electronAPI.${funcName}:`, error);
            throw error;
        }
    } else {
        const errorMsg = `Electron API function (${funcName}) is not available. Check preload script.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
};

const ChatSection = ({
    chatHistory,
    isSending,
    geminiError,
    isApiKeyMissing,
    inputMessage,
    mentionedFiles,
    allProjectFiles,
    selectedFolderPath,
    selectedFile,
    clearGeminiError,
    stopGenerating,
    setInputMessage,
    setMentionedFiles,
    onSendMessage,
    onClearMentionedFiles,
}) => {
    const chatContainerRef = useRef(null);
    const textareaRef = useRef(null);
    const suggestionsRef = useRef(null);

    const [mentionQuery, setMentionQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [pathSeparator, setPathSeparator] = useState('/'); // Default to '/'

    useEffect(() => {
        const getSep = async () => {
            if (window.electronAPI && window.electronAPI.pathSep) {
                try {
                    const sep = await window.electronAPI.pathSep();
                    setPathSeparator(sep);
                } catch (e) {
                    console.error("Failed to get path separator:", e);
                }
            }
        };
        getSep();
    }, []);


    const handleSendMessageInternal = useCallback(() => {
         onSendMessage(inputMessage, mentionedFiles);
    }, [inputMessage, mentionedFiles, onSendMessage]);


    const handleInputChange = (e) => {
        const value = e.target.value;
        const textarea = e.target;
        setInputMessage(value);

        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const mentionMatch = textBeforeCursor.match(/@([\w./-]*)$/);

        if (mentionMatch && allProjectFiles && allProjectFiles.length > 0 && selectedFolderPath) {
            const query = mentionMatch[1].toLowerCase();
            setMentionQuery(query);
            setActiveSuggestionIndex(-1);

            const filtered = allProjectFiles.filter(file => {
                const relativePath = file.path.startsWith(selectedFolderPath + pathSeparator)
                    ? file.path.substring(selectedFolderPath.length + pathSeparator.length)
                    : file.path;

                const segments = relativePath.split(pathSeparator);

                // Exclude files in dot-folders or node_modules
                if (segments.some(segment => segment.startsWith('.') || segment === 'node_modules')) {
                    return false;
                }

                return file.name.toLowerCase().includes(query) ||
                       relativePath.toLowerCase().includes(query);
            }).slice(0, 7);

            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setShowSuggestions(false);
            setMentionQuery('');
        }
    };

     const selectSuggestion = useCallback(async (file) => {
        if (!file || !textareaRef.current) return;

        const currentValue = textareaRef.current.value;
        const cursorPos = textareaRef.current.selectionStart;
        const textBeforeCursor = currentValue.substring(0, cursorPos);
        const mentionMatch = textBeforeCursor.match(/@([\w./-]*)$/);

        if (mentionMatch) {
            const startIndex = mentionMatch.index;
            const textAfterCursor = currentValue.substring(cursorPos);
            const newFileNameWithSpace = `${file.name} `;
            const newValue = `${currentValue.substring(0, startIndex)}@${newFileNameWithSpace}${textAfterCursor}`;
            setInputMessage(newValue);

            let contentToStore;
            try {
                const fetchedFileContent = await callElectronApi('readFileContent', file.path);
                // console.log(`ChatSection: Fetched content for "${file.name}" (${file.path}):`, typeof fetchedFileContent === 'string' ? fetchedFileContent.substring(0,100) + '...' : fetchedFileContent);

                const knownErrorString = "Error: Could not load file content for chat context.";

                if (typeof fetchedFileContent === 'string') {
                    if (fetchedFileContent === knownErrorString) {
                        // console.warn(`ChatSection: readFileContent for "${file.name}" returned the specific error string. Using placeholder.`);
                        contentToStore = `[LINFO: Content load failed for ${file.name} - specific error signature matched]`;
                    } else if (fetchedFileContent.trim() === '') {
                        // console.warn(`ChatSection: readFileContent for "${file.name}" was empty. Using placeholder.`);
                        contentToStore = `[LINFO: File ${file.name} is empty or contains only whitespace]`;
                    }
                     else {
                        contentToStore = fetchedFileContent;
                    }
                } else if (fetchedFileContent === null || typeof fetchedFileContent === 'undefined') {
                    // console.warn(`ChatSection: readFileContent for "${file.name}" was null/undefined. Using placeholder.`);
                    contentToStore = `[LINFO: Content for ${file.name} is null or undefined]`;
                } else {
                    // console.warn(`ChatSection: Unexpected content type for "${file.name}". Received:`, fetchedFileContent, `Type: ${typeof fetchedFileContent}. Using placeholder.`);
                    contentToStore = `[LINFO: Content for ${file.name} has unexpected type: ${typeof fetchedFileContent}]`;
                }

            } catch (error) {
                // console.error(`ChatSection: Error fetching content for @mention "${file.name}":`, error);
                contentToStore = `[LINFO: Error loading content for ${file.name}. Details: ${error.message || 'Unknown error'}]`;
            }

            setMentionedFiles(prev => {
                const existingFileIndex = prev.findIndex(f => f.path === file.path);
                const newFileEntry = { path: file.path, name: file.name, content: contentToStore };

                if (existingFileIndex > -1) {
                    // console.log(`Updating existing mentioned file: ${file.name}`);
                    const updatedFiles = [...prev];
                    updatedFiles[existingFileIndex] = newFileEntry;
                    return updatedFiles;
                } else {
                    // console.log(`Adding new mentioned file: ${file.name}`);
                    return [...prev, newFileEntry];
                }
            });

            setShowSuggestions(false);
            setMentionQuery('');
            setActiveSuggestionIndex(-1);

            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newCursorPos = startIndex + `@${newFileNameWithSpace}`.length;
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
            }, 0);
        }
    }, [setInputMessage, setMentionedFiles, setShowSuggestions, setMentionQuery, setActiveSuggestionIndex /* removed callElectronApi from deps as it's stable */]);


    const handleKeyDown = (event) => {
        if (showSuggestions) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveSuggestionIndex(prev => Math.max(prev - 1, 0));
            } else if (event.key === 'Enter' || event.key === 'Tab') {
                 if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
                    event.preventDefault();
                    selectSuggestion(suggestions[activeSuggestionIndex]);
                 } else if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSendMessageInternal();
                 }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                setShowSuggestions(false);
            }
        } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessageInternal();
        }
    };

    const handleSaveCodeBlock = async (filePath, codeString) => {
       try {
           await callElectronApi('saveFileContent', filePath, codeString);
       } catch (error) {
           console.error(`Parent failed to save ${filePath}:`, error);
           throw error;
       }
    };

     const handleStopGenerating = useCallback(() => stopGenerating(), [stopGenerating]);
     const handleClearMentionedFiles = useCallback(() => {
        if (onClearMentionedFiles) {
            onClearMentionedFiles();
        } else {
            // Fallback if onClearMentionedFiles is not provided, though it should be
            setMentionedFiles([]);
        }
     }, [onClearMentionedFiles, setMentionedFiles]);

    useEffect(() => {
        if (chatContainerRef.current) {
            const { scrollHeight, clientHeight, scrollTop } = chatContainerRef.current;
            const isScrolledToBottom = scrollHeight - clientHeight <= scrollTop + 50;
            if (isScrolledToBottom || isSending) {
                 requestAnimationFrame(() => {
                     if (chatContainerRef.current) {
                         chatContainerRef.current.scrollTo({
                             top: chatContainerRef.current.scrollHeight,
                             behavior: 'smooth'
                         });
                     }
                 });
            }
        }
    }, [chatHistory, isSending]);

    useEffect(() => {
         const textarea = textareaRef.current;
         if (textarea) {
             textarea.style.height = 'auto';
             textarea.style.height = `${textarea.scrollHeight}px`;
         }
     }, [inputMessage]);

    const markdownComponents = useMemo(() => ({
         pre: ({ node, children, ...props }) => {
            const codeChild = node?.children?.[0];
            if (codeChild && codeChild.tagName === 'code') {
                const codeProps = codeChild.properties || {};
                const className = codeProps.className || [];
                const languageMatch = className.find(cls => cls.startsWith('language-'));
                const language = languageMatch ? languageMatch.split('-')[1] : 'plaintext';
                const codeString = codeChild.children?.[0]?.value || '';
                return <CodeBlock language={language} codeString={codeString.replace(/\n$/, '')} currentFilePath={selectedFile?.path || null} onSave={handleSaveCodeBlock}/>;
            }
            return <pre className="bg-neutral-200 [.dark_&]:bg-neutral-700 p-2 rounded overflow-x-auto text-sm my-2" {...props}>{children}</pre>;
        },
        code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
                return (
                    <code
                        className="bg-neutral-200 [.dark_&]:bg-neutral-700 text-purple-700 [.dark_&]:text-purple-300 font-mono text-[0.85em] px-1.5 py-0.5 rounded-md mx-0.5"
                        {...props}
                    >
                        {children}
                    </code>
                );
            }
            return null;
        },
        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
        a: ({ node, ...props }) => <a className="text-blue-500 [.dark_&]:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 pl-4 space-y-1" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 pl-4 space-y-1" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-neutral-300 [.dark_&]:border-neutral-600 pl-3 italic text-neutral-600 [.dark_&]:text-neutral-400 my-2" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-1.5" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
        hr: ({ node, ...props }) => <hr className="my-3 border-neutral-300 [.dark_&]:border-neutral-600" {...props} />,
        table: ({ node, ...props }) => <div className="overflow-x-auto my-2"><table className="table-auto w-full border-collapse border border-neutral-300 [.dark_&]:border-neutral-600 text-xs" {...props} /></div>,
        thead: ({ node, ...props }) => <thead className="bg-neutral-200 [.dark_&]:bg-neutral-700/60" {...props} />,
        tbody: ({ node, ...props }) => <tbody className="divide-y divide-neutral-200 [.dark_&]:divide-neutral-600" {...props} />,
        tr: ({ node, ...props }) => <tr className="[.dark_&]:hover:bg-neutral-700/30" {...props} />,
        th: ({ node, ...props }) => <th className="px-2 py-1 text-left text-xs font-medium text-neutral-600 [.dark_&]:text-neutral-300 uppercase tracking-wider border border-neutral-300 [.dark_&]:border-neutral-600" {...props} />,
        td: ({ node, ...props }) => <td className="px-2 py-1 text-xs text-neutral-800 [.dark_&]:text-neutral-200 border border-neutral-300 [.dark_&]:border-neutral-600" {...props} />,
    }), [selectedFile?.path, handleSaveCodeBlock]); // Added selectedFile.path to dependencies

    const isInteractionDisabled = isApiKeyMissing || isSending || !selectedFolderPath;
    const displayError = geminiError;
    const placeholderText = isApiKeyMissing ? "Cannot chat: Gemini API Key missing."
                           : !selectedFolderPath ? "Select a folder to enable chat and file mentions."
                           : isSending ? "Generating response..."
                           : "Ask Gemini anything or type @ to mention files...";

    return (
        <div className="flex flex-col h-full bg-white [.dark_&]:bg-neutral-900 overflow-hidden border-l border-neutral-200 [.dark_&]:border-neutral-700">
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-neutral-300 [.dark_&]:scrollbar-thumb-neutral-600 scrollbar-track-transparent"
            >
                 {chatHistory.length === 0 && !isSending && !isApiKeyMissing && selectedFolderPath && (
                     <div className="flex flex-col items-center justify-center text-center text-neutral-500 [.dark_&]:text-neutral-400 px-4 h-full min-h-[200px]">
                        <img src="logo.svg" alt="Logo" className="[.dark_&]:invert w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium text-neutral-700 [.dark_&]:text-neutral-300 mb-1">Gemini Chat Ready</p>
                        <p className="text-sm">Folder selected. Type a message or use @ to mention files.</p>
                        <p className="text-xs mt-1 italic break-all px-4" title={selectedFolderPath}>({selectedFolderPath})</p>
                     </div>
                 )}
                 {chatHistory.length === 0 && !isSending && !isApiKeyMissing && !selectedFolderPath && (
                     <div className="flex flex-col items-center justify-center text-center text-neutral-500 [.dark_&]:text-neutral-400 px-4 h-full min-h-[200px]">
                        <img src="logo.svg" alt="Logo" className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium text-neutral-700 [.dark_&]:text-neutral-300 mb-1">Select a Folder</p>
                        <p className="text-sm">Please select a project folder using the sidebar to start chatting.</p>
                     </div>
                 )}
                 {isApiKeyMissing && chatHistory.length === 0 && (
                     <div className="flex flex-col items-center justify-center text-center text-red-600 [.dark_&]:text-red-400 p-4 rounded border border-red-300 [.dark_&]:border-red-700 bg-red-50 [.dark_&]:bg-red-900/20 m-4">
                         <FiAlertCircle size={28} className="mb-2"/>
                         <span className="font-medium">Gemini API Key missing or invalid.</span>
                         <span className="text-sm mt-1">Please configure the API key.</span>
                     </div>
                 )}

                {chatHistory.map((message) => (
                     <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-start gap-2.5 max-w-[85%] lg:max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                             <div className={`flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0 mt-1 ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-indigo-500 text-white'}`}>
                                 {message.role === 'user' ? <FiUser size={16}/> : <FiCpu size={16}/>}
                             </div>
                             <div className={`p-3 rounded-xl shadow-sm ${message.role === 'user' ? 'bg-blue-100 [.dark_&]:bg-blue-900/60 text-neutral-900 [.dark_&]:text-white rounded-br-none' : 'bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-900 [.dark_&]:text-white rounded-bl-none'}`}>
                                <div className="text-sm font-normal leading-relaxed chat-content">
                                    {/* The message.content is rendered here. If it's malformed for user messages,
                                        it's because the parent component set it that way in chatHistory. */}
                                    <ReactMarkdown
                                        components={markdownComponents}
                                        remarkPlugins={[remarkGfm]}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                    {isSending && message.role === 'model' && message.id === chatHistory[chatHistory.length - 1]?.id && !message.content?.trim() && (
                                         <span className="inline-block w-2 h-2 ml-1 bg-blue-500 rounded-full animate-pulse"></span>
                                    )}
                                </div>
                             </div>
                         </div>
                     </div>
                ))}

                 {displayError && !isSending && (
                     <div className="sticky bottom-2 px-2 z-10">
                      <div className="flex items-center p-3 mx-auto w-full max-w-lg bg-red-100 [.dark_&]:bg-red-900/40 text-red-700 [.dark_&]:text-red-200 rounded-lg text-sm border border-red-200 [.dark_&]:border-red-700/50 shadow-md">
                          <FiAlertCircle className="mr-2 flex-shrink-0" size={18}/>
                          <span className="flex-1 text-center">{displayError}</span>
                          <button
                              onClick={clearGeminiError}
                              className="ml-2 p-1 text-red-500 hover:text-red-700 [.dark_&]:text-red-300 [.dark_&]:hover:text-red-100 rounded-full hover:bg-red-200 [.dark_&]:hover:bg-red-800/60 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                              aria-label="Dismiss error"
                              title="Dismiss error"
                          >
                            <FiX size={16}/>
                          </button>
                      </div>
                    </div>
                 )}
            </div>

            <div className="flex-shrink-0  [.dark_&]:bg-neutral-850 p-3 sm:p-4 border-t border-neutral-200 [.dark_&]:border-neutral-700 shadow-inner relative">
                 {isSending && (
                    <div className="flex justify-center mb-2.5">
                        <button
                            onClick={handleStopGenerating}
                            className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-md shadow-sm flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 [.dark_&]:focus:ring-offset-neutral-850"
                            title="Stop generating response"
                         >
                            <FiCpu size={14}/> Stop Generating
                        </button>
                    </div>
                 )}

                 {mentionedFiles.length > 0 && (
                    <div className="mb-2 px-2 flex flex-wrap items-center justify-between gap-y-1 text-xs text-neutral-600 [.dark_&]:text-neutral-400 bg-neutral-100 [.dark_&]:bg-neutral-700/60 rounded-md py-1.5">
                        <div className="flex items-center flex-wrap gap-1 overflow-hidden pl-1">
                             <FiFileText className="mr-1.5 flex-shrink-0 text-purple-500 [.dark_&]:text-purple-400" size={14}/>
                             <span className="font-medium mr-1 flex-shrink-0">Mentioned:</span>
                             {mentionedFiles.map(file => (
                                <span
                                    key={file.path}
                                    className="truncate font-mono text-neutral-700 [.dark_&]:text-neutral-300 bg-purple-100 [.dark_&]:bg-purple-900/50 px-1.5 py-0.5 rounded"
                                    title={`${file.path} ${file.content && file.content.startsWith('[LINFO:') ? `(${file.content})` : '' }`}
                                >
                                    @{file.name}
                                </span>
                             ))}
                        </div>
                        <button
                            onClick={handleClearMentionedFiles}
                            className="ml-2 mr-1 p-0.5 text-neutral-500 hover:text-red-600 [.dark_&]:text-neutral-400 [.dark_&]:hover:text-red-400 rounded-full hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-600/50 focus:outline-none transition-colors"
                            title="Clear mentioned files"
                            aria-label="Clear mentioned files"
                         >
                            <FiX size={15} />
                         </button>
                    </div>
                 )}

                 {showSuggestions && (
                    <div ref={suggestionsRef} className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto bg-white [.dark_&]:bg-neutral-700 border border-neutral-300 [.dark_&]:border-neutral-600 rounded-md shadow-lg z-20 p-1">
                        {suggestions.map((file, index) => (
                            <div
                                key={file.path}
                                onClick={() => selectSuggestion(file)}
                                onMouseEnter={() => setActiveSuggestionIndex(index)}
                                className={`px-3 py-1.5 text-sm cursor-pointer rounded ${
                                    index === activeSuggestionIndex
                                        ? 'bg-blue-100 [.dark_&]:bg-blue-800 text-blue-900 [.dark_&]:text-blue-100'
                                        : 'text-neutral-800 [.dark_&]:text-neutral-200 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-600'
                                } flex items-center gap-2`}
                            >
                                <FiFileText size={14} className="flex-shrink-0 text-neutral-500 [.dark_&]:text-neutral-400" />
                                <div className="flex-grow overflow-hidden">
                                    <span className="font-medium block truncate">{file.name}</span>
                                    <span className="text-xs text-neutral-500 [.dark_&]:text-neutral-400 block truncate">
                                        {file.path.startsWith(selectedFolderPath + pathSeparator)
                                            ? file.path.substring(selectedFolderPath.length + pathSeparator.length)
                                            : file.path
                                        }
                                    </span>
                                </div>
                            </div>
                        ))}
                         {suggestions.length === 0 && mentionQuery && (
                             <div className="px-3 py-1.5 text-sm text-neutral-500 [.dark_&]:text-neutral-400 italic">
                                 No files found matching "@{mentionQuery}"
                             </div>
                         )}
                    </div>
                 )}

                <div className="[.dark_&]:bg-neutral-700 relative flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        placeholder={placeholderText}
                        value={inputMessage}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        className="flex-1 py-2.5 pl-4 pr-10 bg-neutral-100 [.dark_&]:bg-neutral-700 rounded-lg border border-neutral-300 [.dark_&]:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out placeholder-neutral-500 [.dark_&]:placeholder-neutral-400 [.dark_&]:text-white shadow-sm focus:shadow-md"
                        disabled={isInteractionDisabled}
                        style={{ minHeight: '50px', maxHeight: '100px' }}
                        aria-label="Chat input message"
                    />
                    <div className="absolute bottom-[7px] right-[7px]">
                        <button
                            onClick={handleSendMessageInternal}
                            className="p-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 [.dark_&]:focus:ring-offset-neutral-850 disabled:bg-neutral-400 [.dark_&]:disabled:bg-neutral-500 disabled:cursor-not-allowed transition-all duration-150 ease-in-out transform active:scale-90"
                            disabled={isInteractionDisabled || !inputMessage.trim()}
                            title="Send message (Enter)"
                            aria-label="Send message"
                        >
                            <FiSend size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center px-4 py-1 border-t border-neutral-200 [.dark_&]:border-neutral-700">
                 {selectedFolderPath && (
                    <span className="text-xs text-neutral-500 [.dark_&]:text-neutral-400 truncate max-w-[50%]" title={selectedFolderPath}>
                        Context: {selectedFolderPath}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ChatSection;