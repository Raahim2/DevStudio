// src/app/main/components/ChatMessage.js
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

const ChatMessage = ({
    message,
    markdownComponents // Accepts the config from ChatSection
}) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isModel = message.role === 'model';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isModel ? 'w-full' : ''}`}>
            <div
                className={`px-0 py-0 rounded-lg ${
                    isUser
                        ? 'bg-blue-500 text-white max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 shadow-sm'
                        : isSystem
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs italic text-center w-full max-w-xl mx-auto my-2 px-4 py-1'
                        : 'bg-transparent dark:bg-transparent text-gray-900 dark:text-white w-full' // Model messages have no padding/bg here
                } ${isSystem ? '' : 'my-1'}`}
            >
                {isModel || isSystem ? (
                    // Render model/system messages using Markdown processor
                    <ReactMarkdown components={markdownComponents}>
                        {message.text || (isModel ? '...' : '')}
                    </ReactMarkdown>
                ) : (
                    // Render user messages simply
                     <p className="px-4 py-2">{message.text}</p>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;