// src/components/CodeBlock.js
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiCopy, FiDownload, FiCheck, FiGitCommit, FiFilePlus, FiCpu, FiAlertCircle, FiX, FiSend } from 'react-icons/fi'; // Added FiSend
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({
    language,
    codeString,
    selectedRepoFullName,
    selectedFile,
    onCommit,
    onCreateFile,
}) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isCommittingFeedback, setIsCommittingFeedback] = useState(false);
    const [commitSuccessFeedback, setCommitSuccessFeedback] = useState(false);
    const [commitErrorFeedback, setCommitErrorFeedback] = useState(null);

    // --- State for Inline Commit Input Area ---
    const [showCommitInput, setShowCommitInput] = useState(false); // Toggle visibility of the input area
    const [commitMessageInput, setCommitMessageInput] = useState('');
    const commitInputRef = useRef(null);
    // ---

    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Focus input when it appears
    useEffect(() => {
        if (showCommitInput && commitInputRef.current) {
            setCommitMessageInput(`Update ${selectedFile?.name || 'file'} via AI assist`);
            setTimeout(() => commitInputRef.current?.focus(), 50);
        } else if (!showCommitInput) {
             // Clear error when input area is hidden
             setCommitErrorFeedback(null);
        }
    }, [showCommitInput, selectedFile?.name]);


    const handleCopy = () => { /* ... same ... */
        navigator.clipboard.writeText(codeString).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }, (err) => { console.error('Failed to copy code:', err); });
     };

    const handleDownload = () => { /* ... same ... */
        const blob = new Blob([codeString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code.${language === 'plaintext' ? 'txt' : language}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    // --- Commit Input Area Handling ---
    const toggleCommitInput = () => {
        if (!selectedFile?.path || !selectedFile?.sha) {
            setCommitErrorFeedback("File path or SHA missing.");
            setTimeout(() => setCommitErrorFeedback(null), 3000);
            return;
        }
        // If already showing, clicking again will hide it (handled by setShowCommitInput(!showCommitInput))
         // If currently committing, don't allow toggling off easily
         if (!isCommittingFeedback) {
             setShowCommitInput(!showCommitInput);
             // Clear success feedback when toggling input
             setCommitSuccessFeedback(false);
         }
    };

    // This is called when the user confirms the commit using the inline input
    const handleConfirmCommit = async () => {
        if (!commitMessageInput.trim()) {
             setCommitErrorFeedback("Commit message cannot be empty.");
             setTimeout(() => setCommitErrorFeedback(null), 3000);
             return;
        }

        setIsCommittingFeedback(true);
        setCommitSuccessFeedback(false);
        setCommitErrorFeedback(null);

        try {
            const success = await onCommit(
                codeString,
                commitMessageInput,
                selectedFile.path,
                selectedFile.sha
            );
            if (success) {
                 setCommitSuccessFeedback(true);
                 setShowCommitInput(false); // Hide input area on success
                 setCommitMessageInput(''); // Clear input
                 setTimeout(() => setCommitSuccessFeedback(false), 3000);
            } else {
                 setCommitErrorFeedback(commitErrorFeedback || "Commit failed. Check chat errors.");
                 // Keep input open on failure
                 setTimeout(() => setCommitErrorFeedback(null), 5000);
            }
        } catch (err) {
             console.error("Error during onCommit call from inline input:", err);
             setCommitErrorFeedback("Error triggering commit.");
             setTimeout(() => setCommitErrorFeedback(null), 5000);
        } finally {
             setIsCommittingFeedback(false);
        }
    };

    const handleCreateFileClick = () => { /* ... same ... */
         if (onCreateFile) {
            onCreateFile(codeString);
        } else {
            console.warn("onCreateFile handler not provided to CodeBlock component.");
        }
    };

    const selectedTheme = isDarkMode ? vscDarkPlus : coy;
    const canCommit = !!selectedFile?.path && !!selectedFile?.sha && !!selectedRepoFullName;

    return (
         <div className="code-block-wrapper my-3 relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            {/* Header: Language and Action Buttons */}
            <div className="flex justify-between items-center px-4 py-1 bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">{language}</span>
                {/* Action Buttons - Always visible unless committing/input shown */}
                 <div className={`flex items-center space-x-2 transition-opacity duration-150 ${showCommitInput ? 'opacity-0 pointer-events-none h-0' : 'opacity-100'}`}> {/* Hide buttons when input is shown */}
                    {/* Commit Success Feedback (shown when input is hidden) */}
                    {commitSuccessFeedback && !showCommitInput && (
                        <span className="text-green-500 text-xs flex items-center"><FiCheck size={14} className="mr-1"/> Committed</span>
                    )}
                    {/* Commit Error Feedback (shown when input is hidden) */}
                    {commitErrorFeedback && !showCommitInput && (
                        <span className="text-red-500 text-xs flex items-center"><FiAlertCircle size={14} className="mr-1"/> Error</span>
                    )}
                    {/* Commit Button (toggles input area) */}
                    <button
                        onClick={toggleCommitInput}
                        title={canCommit ? `Commit changes to ${selectedFile?.name}` : "Select file first"}
                        className={`p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center`}
                        disabled={!canCommit || isCommittingFeedback} // Disable if cannot commit or already loading
                    >
                        <FiGitCommit size={14} />
                    </button>
                    {/* Other buttons */}
                    <button onClick={handleCreateFileClick} title="Create new file" className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none flex items-center"> <FiFilePlus size={14} /> </button>
                    <button onClick={handleDownload} title="Download" className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"><FiDownload size={14} /></button>
                    <button onClick={handleCopy} title={copied ? "Copied!" : "Copy"} className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none">{copied ? <FiCheck size={14} className="text-green-500"/> : <FiCopy size={14} />}</button>
                </div>
            </div>

            {/* --- Inline Commit Input Area --- */}
            {showCommitInput && (
                 <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850"> {/* Slightly different bg */}
                     <label htmlFor={`commitMessage-${language}-${codeString.substring(0,10)}`} className="sr-only">Commit Message</label> {/* Screen reader label */}
                     <div className="relative flex items-center space-x-2">
                         <input
                            ref={commitInputRef}
                            type="text"
                            id={`commitMessage-${language}-${codeString.substring(0,10)}`} // Unique enough ID
                            value={commitMessageInput}
                            onChange={(e) => setCommitMessageInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCommit(); if (e.key === 'Escape') setShowCommitInput(false); }} // Enter to confirm, Esc to cancel
                            className="flex-grow px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-70"
                            placeholder="Commit message..."
                            disabled={isCommittingFeedback}
                         />
                         <button
                            onClick={handleConfirmCommit}
                            disabled={isCommittingFeedback || !commitMessageInput.trim()}
                            className="p-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-850 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            title="Confirm Commit (Enter)"
                         >
                             {isCommittingFeedback ? <FiCpu size={16} className="animate-spin"/> : <FiSend size={16} />}
                         </button>
                         <button
                            onClick={toggleCommitInput} // Use toggle to hide
                            disabled={isCommittingFeedback}
                            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 dark:focus:ring-offset-gray-850 disabled:opacity-50"
                            title="Cancel Commit (Esc)"
                         >
                             <FiX size={16} />
                         </button>
                     </div>
                     {/* Display commit error feedback within the input area */}
                     {commitErrorFeedback && (
                         <p className="text-xs text-red-500 mt-1 flex items-center">
                             <FiAlertCircle size={14} className="mr-1"/> {commitErrorFeedback}
                         </p>
                      )}
                 </div>
            )}
            {/* --- End Inline Commit Input Area --- */}


            {/* Syntax Highlighter */}
            <SyntaxHighlighter
                language={language}
                style={selectedTheme}
                // Add padding only if the commit input is NOT shown, otherwise padding is handled by the input area div
                customStyle={{
                    margin: 0,
                    paddingTop: '1rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    paddingBottom: showCommitInput ? '0.5rem' : '1rem', // Reduce bottom padding when input shown
                    fontSize: '0.875rem',
                    backgroundColor: 'transparent',
                    overflowX: 'auto'
                }}
                codeTagProps={{ style: { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)' } }}
                showLineNumbers={codeString.split('\n').length > 1}
                wrapLines={true}
                wrapLongLines={true}>
                {codeString}
            </SyntaxHighlighter>

        </div>
    );
};

export default CodeBlock;