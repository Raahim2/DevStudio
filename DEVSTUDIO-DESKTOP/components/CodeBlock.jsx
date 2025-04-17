// src/components/CodeBlock.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiCopy, FiDownload, FiCheck, FiFilePlus, FiGitCommit, FiLoader, FiAlertCircle } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useGitHubApi } from '../hooks/useGitHubApi';
import CreateFileModal from './CreateFileModal'; // <-- Import the modal component

const CodeBlock = ({
    language,
    codeString,
    onCreateFile, // Keep this prop - it might be needed by the modal later, or we pass data back
    accessToken,
    selectedRepoFullName,
    selectedFile, // This is for COMMIT, not create
}) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    const [showCommitInput, setShowCommitInput] = useState(false);
    const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false); // <-- State for modal visibility

    console.log(selectedFile, "selectedFile in CodeBlock2 component"); // Keep for debugging commit if needed
    const {
        commitCode,
        isOperating: isCommitting,
        operationError: commitError,
        operationSuccess: commitSuccess,
        clearOperationError: clearCommitError
        // Note: You'll likely need a similar `createFile` function from your hook for the real modal logic
    } = useGitHubApi(accessToken, selectedRepoFullName);

    // --- Effects ---
    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // --- Handlers ---
    const handleCommitClick = () => {
        setShowCommitInput(!showCommitInput);
        clearCommitError();
        if (!showCommitInput && selectedFile) { // Only set default message if opening and file selected
             setCommitMessage(`Update ${selectedFile.name || 'file'} via AI Assistant`);
        }
    };

    const handleCommitSubmit = useCallback(async () => {
        if (!selectedFile || !selectedFile.path || !selectedFile.sha) {
            console.error("Commit aborted: Missing file path or SHA.");
            // TODO: Show user feedback
            return;
        }
        if (!commitMessage.trim()) {
            console.error("Commit aborted: Commit message cannot be empty.");
            // TODO: Show user feedback
            return;
        }
        if (!codeString) {
            console.warn("Commit aborted: Code content is empty.");
             // TODO: Show user feedback (maybe disable button?)
            return;
        }

        console.log(`Attempting commit: Path=${selectedFile.path}, SHA=${selectedFile.sha}`);

        const result = await commitCode(
            codeString,
            commitMessage.trim(),
            selectedFile.path,
            selectedFile.sha
        );

        if (result.success) {
            console.log("Commit successful:", result.data);
            setCommitMessage(''); // Clear on success
            // Optionally close input: setShowCommitInput(false); // Keep open to show success?
        } else {
            console.error("Commit failed:", result.error);
            // Error is displayed via commitError state
        }
    }, [commitCode, codeString, commitMessage, selectedFile]);

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }, (err) => {
            console.error('Failed to copy code:', err);
            // TODO: Show user feedback
        });
    };

     const handleDownload = () => {
         try {
            const blob = new Blob([codeString || ''], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeLanguage = (language || 'code').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `${safeLanguage}_${timestamp}.${safeLanguage === 'plaintext' ? 'txt' : safeLanguage}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download code:', err);
            // TODO: Show user feedback
        }
    };

    // MODIFIED: This now opens the modal
    const handleOpenCreateFileModal = () => {
        if (accessToken && selectedRepoFullName) { // Ensure we have repo context before opening
             setIsCreateFileModalOpen(true);
        } else {
             console.warn("Cannot open create file modal: Missing Access Token or Repo Full Name.");
             // TODO: Provide user feedback (e.g., disable the button, show a tooltip)
        }
    };

    // Handler to close the modal
    const handleCloseCreateFileModal = (created) => {
        setIsCreateFileModalOpen(false);
        if (created) {
             console.log("Modal closed after 'Create File' action (dummy for now).");
             // Later: Potentially trigger a refresh or show a success message
        } else {
             console.log("Create file modal closed without action.");
        }
    };

    const selectedTheme = isDarkMode ? vscDarkPlus : coy;
    const canCommit = !!accessToken && !!selectedRepoFullName && !!selectedFile?.path; // Simplified: SHA check happens in submit handler now
    const canCreateFile = !!accessToken && !!selectedRepoFullName; // Condition to enable the "Create File" button

    return (
         // Use Fragment to render modal as a sibling, not child of the styled div
         <>
             <div className="code-block-wrapper my-3 relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                 {/* Header: Language and Action Buttons */}
                 <div className="flex justify-between items-center px-4 py-1 bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">
                     <span className="font-medium">{language}</span>
                     {/* Action Buttons */}
                      <div className="flex items-center space-x-1.5">
                          {/* Create File Button (NOW OPENS MODAL) */}
                          {/* Only show if repo context is available */}
                          {canCreateFile && (
                              <button
                                 onClick={handleOpenCreateFileModal} // <-- Changed handler
                                 title="Create new file with this code..." // <-- Updated title
                                 className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none flex items-center"
                                 // Consider adding `disabled={!canCreateFile}` if you don't hide it
                             >
                                 <FiFilePlus size={14} />
                             </button>
                          )}
                          {/* Download Button */}
                          <button
                             onClick={handleDownload}
                             title="Download"
                             className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
                         >
                             <FiDownload size={14} />
                         </button>
                          {/* Copy Button */}
                          <button
                             onClick={handleCopy}
                             title={copied ? "Copied!" : "Copy"}
                             className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
                         >
                             {copied ? <FiCheck size={14} className="text-green-500"/> : <FiCopy size={14} />}
                         </button>
                          {/* Commit Button (Positioned last) */}
                          {/* Only show if a file is selected for commit */}
                          {selectedFile && canCommit && (
                             <button
                                 onClick={handleCommitClick}
                                 title={showCommitInput ? "Cancel Commit" : `Commit changes to ${selectedFile.name}`}
                                 disabled={isCommitting}
                                 className={`p-1 rounded ${showCommitInput ? 'bg-blue-200 dark:bg-blue-800' : 'hover:bg-gray-300 dark:hover:bg-gray-600'} focus:outline-none flex items-center text-blue-600 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed`}
                             >
                                 <FiGitCommit size={14} />
                             </button>
                          )}
                      </div>
                 </div>

                 {/* Inline Commit Input Area (Conditionally Rendered) */}
                 {/* Only show if commit button was clicked AND a file is selected */}
                 {showCommitInput && selectedFile && canCommit && (
                     <div className="px-3 py-2 border-t border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                         <div className="flex items-center gap-2">
                             <input
                                 type="text"
                                 placeholder="Commit message..."
                                 value={commitMessage}
                                 onChange={(e) => setCommitMessage(e.target.value)}
                                 disabled={isCommitting}
                                 className="flex-grow px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                                 aria-label="Commit message"
                                 onKeyDown={(e) => { if (e.key === 'Enter' && !isCommitting && commitMessage.trim() && codeString) handleCommitSubmit(); }} // Optional: Commit on Enter
                             />
                             <button
                                 onClick={handleCommitSubmit}
                                 disabled={isCommitting || !commitMessage.trim() || !codeString} // Disable if no message or empty code
                                 className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-750 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
                                 title={!commitMessage.trim() ? "Commit message required" : !codeString ? "Cannot commit empty code" : "Commit changes"}
                             >
                                 {isCommitting ? (
                                     <FiLoader className="animate-spin" size={14} />
                                 ) : commitSuccess ? (
                                     <FiCheck size={14} />
                                 ) : (
                                     "Commit"
                                 )}
                             </button>
                         </div>
                          {/* Commit Feedback Messages */}
                          {commitError && !isCommitting && (
                             <div className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                 <FiAlertCircle size={13}/>
                                 <span>Error: {commitError}</span>
                                 <button onClick={clearCommitError} className="ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs underline">Dismiss</button>
                             </div>
                          )}
                          {commitSuccess && !isCommitting && !commitError && (
                              <div className="mt-1.5 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <FiCheck size={13}/> Successfully committed!
                             </div>
                          )}
                          {/* Warning if trying to commit but info is missing (should be rare now with button logic) */}
                           {!canCommit && showCommitInput && (
                               <div className="mt-1.5 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                  <FiAlertCircle size={13}/> Cannot commit: Missing required info. Select a file.
                               </div>
                           )}
                     </div>
                 )}

                 {/* Syntax Highlighter */}
                 <SyntaxHighlighter
                    language={language}
                    style={selectedTheme}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '0.875rem',
                        backgroundColor: 'transparent',
                        overflowX: 'auto'
                    }}
                    codeTagProps={{ style: { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)' } }}
                    showLineNumbers={codeString?.split('\n').length > 1}
                    wrapLines={true}
                    wrapLongLines={true}
                >
                    {codeString || ''}
                </SyntaxHighlighter>

             </div>

             {/* Render the Modal (conditionally) */}
             <CreateFileModal
                 isOpen={isCreateFileModalOpen}
                 onClose={handleCloseCreateFileModal}
                 initialCode={codeString} 
                 repoFullName={selectedRepoFullName}
                 accessToken={accessToken}
                 // Pass current code for preview
                 // --- TODO LATER ---
                 // Pass necessary props for actual file creation:

                 // onCreateFileSubmit={handleActualCreateFile} // A function to call the API hook
                 // directoryList={/* fetched list of dirs */}
                 // isCreating={isCreatingFile} // State from API hook
                 // createError={createFileError} // State from API hook
             />
         </>
    );
};

export default CodeBlock;