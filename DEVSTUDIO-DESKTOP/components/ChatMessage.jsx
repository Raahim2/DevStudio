// src/components/ChatMessage.js
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FiUser, FiZap } from 'react-icons/fi';


const ChatMessage = ({ message, markdownComponents }) => { // Receive components config as prop

    if (message.role === 'system') {
        return (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 my-2 px-4 py-1 bg-gray-100 dark:bg-gray-800 rounded-full max-w-md mx-auto break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: 'span' }}>
                    {message.text}
                </ReactMarkdown>
            </div>
        );
    }

    const isUser = message.role === 'user';

    return (
        <div className={`flex items-start space-x-2 max-w-[90%] sm:max-w-[80%] ${
            isUser ? 'flex-row-reverse space-x-reverse self-end' : 'self-start' // Align messages
        }`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mt-1 ${
                isUser ? 'bg-blue-500' : 'bg-indigo-500'
            }`}>
                {isUser ? <FiUser size={16} className="text-white" /> : <FiZap size={16} className="text-white" />}
            </div>
            {/* Message Bubble */}
            <div className={`px-4 py-3 rounded-xl shadow-sm relative ${
                isUser
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-600'
            }`}>
                {/* Typing Indicator (Handled by checking empty text in parent now) */}
                 {message.role === 'model' && message.text === '' && (
                     <div className="flex items-center space-x-1.5 px-2 py-1">
                         <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                         <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                         <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                     </div>
                 )}
                {/* Render Markdown Content */}
                {/* Pass the memoized markdownComponents config from ChatSection */}
                <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.text || ''}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default ChatMessage;