'use client';

import React, { useState, useCallback  , useEffect} from 'react';
import { FiClipboard, FiCheck, FiDownload, FiSave, FiLoader } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight  } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Light theme
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Dark theme


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
    const [isDarkMode, setIsDarkMode] = useState(false); // Example state for [.dark_&] mode

    useEffect(() => {
        const checkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkMode();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => checkMode();
        mediaQuery.addEventListener('change', handleChange);
        const observer = new MutationObserver(checkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            observer.disconnect();
        };
    }, []);

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
        <div className="code-block relative group bg-white rounded-md my-3 border border-neutral-300 overflow-hidden shadow-sm [.dark_&]:bg-neutral-800 [.dark_&]:border-neutral-600">
            {/* Header with Language and Buttons */}
            <div className="flex items-center justify-between px-3 py-1 bg-neutral-100 border-b border-neutral-300 [.dark_&]:bg-neutral-700 [.dark_&]:border-neutral-600">
                <span className="text-xs text-neutral-500 [.dark_&]:text-neutral-400 font-sans">{detectedLanguage}</span>
                <div className="flex items-center space-x-1">
                    {/* Save Button (Conditional) */}
                    {canSave && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isSaved}
                            className={`p-1 rounded text-neutral-500 [.dark_&]:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all duration-150 ${
                                isSaving ? 'animate-spin cursor-not-allowed' :
                                isSaved ? 'text-green-500 [.dark_&]:text-green-400 cursor-default' :
                                saveError ? 'text-red-500 [.dark_&]:text-red-400' :
                                'hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-600 hover:text-neutral-700 [.dark_&]:hover:text-neutral-200'
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
                        className="p-1 rounded text-neutral-500 [.dark_&]:text-neutral-400 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-600 hover:text-neutral-700 [.dark_&]:hover:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Download code snippet"
                        title="Download code snippet"
                    >
                       <FiDownload size={16} />
                    </button>

                    {/* Copy Button */}
                    <button
                        onClick={handleCopy}
                        className="p-1 rounded text-neutral-500 [.dark_&]:text-neutral-400 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-600 hover:text-neutral-700 [.dark_&]:hover:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={isCopied ? 'Copied!' : 'Copy code'}
                        title={isCopied ? 'Copied!' : 'Copy code'}
                    >
                        {isCopied ? <FiCheck size={16} className="text-green-500 [.dark_&]:text-green-400" /> : <FiClipboard size={16} />}
                    </button>
                </div>
            </div>

            {/* Code Area */}
            <SyntaxHighlighter
                language={detectedLanguage}
                style={isDarkMode ? vscDarkPlus : solarizedlight}
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












