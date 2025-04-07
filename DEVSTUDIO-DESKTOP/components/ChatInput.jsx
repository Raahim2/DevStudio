// src/components/ChatInput.js
'use client';

import React from 'react';
import { FiSend, FiCpu, FiAlertCircle, FiPaperclip, FiX } from 'react-icons/fi';

const ChatInput = ({
    inputValue,
    onInputChange,
    onSendMessage,
    isSending, // Is the AI processing?
    onStopGenerating,
    selectedFile, // Info about the selected file
    isFileLoading, // Is the selected file content being fetched?
    fileError, // Error related to loading the selected file
    isInteractionDisabled, // General flag to disable input (API key missing, file error, etc.)
}) => {

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSendMessage();
        }
    };

    const isDisabled = isInteractionDisabled || isSending; // Consolidate disabled state

    const placeholderText = isInteractionDisabled && !isSending ? "Cannot chat: Check API key or file errors."
                           : isFileLoading ? `Loading ${selectedFile?.name || 'file'}...`
                           : isSending ? "Generating response..."
                           : selectedFile ? `Ask about ${selectedFile.name}...`
                           : "Type your message...";

    return (
        <div className="[.dark_&]:bg-gray-800  flex-shrink-0 bg-white dark:bg-gray-800 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 shadow-md">
             {/* Selected File Context Indicator */}
             {selectedFile && (
                  <div className="[.dark_&]:text-white text-xs text-gray-600 dark:text-gray-400 mb-2 px-1 flex items-center justify-center truncate">
                     <FiPaperclip size={12} className="mr-1 flex-shrink-0 text-gray-500" />
                     <span className="font-medium mr-1">Context:</span>
                     {isFileLoading ? ( <span className="italic flex items-center text-gray-500"><FiCpu size={12} className="mr-1 animate-spin"/>Loading {selectedFile.name}...</span>)
                     : fileError ? (<span className="text-red-600 dark:text-red-400 flex items-center" title={fileError}><FiAlertCircle size={12} className="mr-1"/>Error loading</span>)
                     : (<span className="truncate" title={selectedFile.path}>{selectedFile.name}</span>)}
                 </div>
             )}

             {/* Stop Generating Button */}
             {isSending && (
                <div className="flex justify-center mb-2">
                    <button
                        onClick={onStopGenerating}
                        className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-md shadow-sm flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        title="Stop generating response"
                    >
                        <FiCpu size={14}/> Stop Generating
                    </button>
                </div>
             )}

             {/* Text Input & Send Button Wrapper */}
            <div className="relative flex items-end ">
                <textarea
                    placeholder={placeholderText}
                    value={inputValue}
                    onChange={onInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="[.dark_&]:bg-gray-800 [.dark_&]:text-white flex-1 py-2.5 pl-4 pr-12 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed transition-shadow focus:shadow-md placeholder-gray-500 dark:placeholder-gray-400"
                    disabled={isDisabled}
                    style={{ maxHeight: '120px', overflowY: 'auto' }}
                    aria-label="Chat input message"
                />
                <div className="absolute bottom-1 right-1.5 flex items-center">
                    <button
                        onClick={onSendMessage}
                        className="p-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-150 transform active:scale-95"
                        disabled={isDisabled || !inputValue.trim()} // Also disable if input is empty
                        title="Send message (Enter)"
                        aria-label="Send message"
                    >
                        <FiSend size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInput;