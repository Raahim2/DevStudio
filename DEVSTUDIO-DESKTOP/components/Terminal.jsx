'use client';

import React from 'react';
import { FiTerminal } from 'react-icons/fi'; // Keep only necessary imports

// --- Terminal Component (Dummy UI) ---

const Terminal = () => {
    // No state or props needed for a dummy UI

    // --- Render ---
    return (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"> {/* Ensures component takes space */}
            {/* Header */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-semibold flex items-center text-gray-700 dark:text-gray-300">
                    <FiTerminal className="mr-2 text-gray-500 dark:text-gray-400" />
                    Output / Terminal
                </h3>
                {/* Optionally keep a disabled clear button for visual representation */}
                <button
                    disabled // Always disabled
                    className="p-1 rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Clear Logs (Disabled)"
                >
                    {/* You might need FiTrash2 if you keep the button */}
                    {/* <FiTrash2 size={14} /> */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>

            {/* Body / Log Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                {/* Placeholder content */}
                <div className="whitespace-pre-wrap break-words">
                    [INFO] Terminal ready...
                </div>
                <div className="whitespace-pre-wrap break-words text-gray-400 dark:text-gray-600">
                    $ Waiting for task execution...
                </div>
                 {/* Add more placeholder lines if desired */}
                 {/* <div className="whitespace-pre-wrap break-words text-green-500 dark:text-green-400">
                    [SUCCESS] Placeholder task completed.
                 </div>
                 <div className="whitespace-pre-wrap break-words text-red-500 dark:text-red-400">
                    [ERROR] Placeholder error occurred.
                 </div> */}
                 <div className="h-full flex items-end pb-2">
                     <span className="animate-pulse">_</span> {/* Blinking cursor simulation */}
                 </div>
            </div>
        </div>
    );
};

export default Terminal;