'use client';

import React, { useState, useCallback } from 'react';
import { FiClipboard, FiCheck, FiDownload, FiSave, FiLoader } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Light theme

const CodeBlock = ({
    language,
    codeString,
    currentFilePath = null, // Optional: Path of the file this code might relate to
    onSave = null, // Optional: Function to call when saving
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // --- Copy Handler ---
    const handleCopy = useCallback(() => {
        if (!codeString) return;
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy code:', err);
            // Optionally show feedback to the user
        });
    }, [codeString]);

    // --- Download Handler ---
    const handleDownload = useCallback(() => {
        if (!codeString) return;
        const blob = new Blob([codeString], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Suggest a filename
        const filename = `code-snippet.${language || 'txt'}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [codeString, language]);



    // --- Save Handler ---
    const handleSave = useCallback(async () => {
        if (!currentFilePath || typeof onSave !== 'function' || !codeString || isSaving || isSaved) {
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        setIsSaved(false);

        try {
            // Call the onSave prop passed from the parent
            await onSave(currentFilePath, codeString);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2500); // Show saved state briefly
        } catch (error) {
            console.error(`Failed to save code to ${currentFilePath}:`, error);
            setSaveError(error.message || 'Failed to save');
            // Clear error after a while
            setTimeout(() => setSaveError(null), 4000);
        } finally {
            setIsSaving(false);
        }
    }, [currentFilePath, codeString, onSave, isSaving, isSaved]);

    const detectedLanguage = language || 'plaintext';
    const canSave = !!currentFilePath && typeof onSave === 'function';

    return (
        <div className="code-block relative group bg-white rounded-md my-3 border border-gray-300 overflow-hidden shadow-sm dark:bg-gray-800 dark:border-gray-600">
            {/* Header with Language and Buttons */}
            <div className="flex items-center justify-between px-3 py-1 bg-gray-100 border-b border-gray-300 dark:bg-gray-700 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-sans">{detectedLanguage}</span>
                <div className="flex items-center space-x-1">
                    {/* Save Button (Conditional) */}
                    {canSave && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isSaved}
                            className={`p-1 rounded text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all duration-150 ${
                                isSaving ? 'animate-spin cursor-not-allowed' :
                                isSaved ? 'text-green-500 dark:text-green-400 cursor-default' :
                                saveError ? 'text-red-500 dark:text-red-400' :
                                'hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
                            } opacity-0 group-hover:opacity-100 focus:opacity-100`}
                            aria-label={isSaving ? 'Saving...' : isSaved ? 'Saved!' : saveError ? `Error: ${saveError}` : `Save to ${currentFilePath.split(/[\\/]/).pop()}`}
                            title={isSaving ? 'Saving...' : isSaved ? 'Saved!' : saveError ? `Error: ${saveError}` : `Save to ${currentFilePath.split(/[\\/]/).pop()}`}
                        >
                            {isSaving ? <FiLoader size={16} className="animate-spin"/> :
                             isSaved ? <FiCheck size={16} /> :
                             saveError ? <FiX size={16} /> : // Or FiAlertCircle
                             <FiSave size={16} />}
                        </button>
                    )}

                    {/* Download Button */}
                    <button
                        onClick={handleDownload}
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Download code snippet"
                        title="Download code snippet"
                    >
                       <FiDownload size={16} />
                    </button>

                    {/* Copy Button */}
                    <button
                        onClick={handleCopy}
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={isCopied ? 'Copied!' : 'Copy code'}
                        title={isCopied ? 'Copied!' : 'Copy code'}
                    >
                        {isCopied ? <FiCheck size={16} className="text-green-500 dark:text-green-400" /> : <FiClipboard size={16} />}
                    </button>
                </div>
            </div>

            {/* Code Area */}
            <SyntaxHighlighter
                language={detectedLanguage}
                style={solarizedlight} // Use the imported theme
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    backgroundColor: 'transparent', // Background set on container
                    fontSize: '0.875rem', // text-sm
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap', // Allow wrapping
                    wordWrap: 'break-word', // Break long words/lines
                    color: '#657b83', // Base text color for solarized light
                }}
                codeTagProps={{
                    style: {
                        fontFamily: 'var(--font-mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)', // Tailwind mono or fallback
                    },
                }}
                wrapLongLines={true} // Enable line wrapping in highlighter
            >
                {codeString ?? ''}
            </SyntaxHighlighter>
        </div>
    );
};

export default CodeBlock;