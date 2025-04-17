'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FiLoader, FiAlertCircle, FiCode, FiX, FiSave, FiCheckCircle } from 'react-icons/fi';
import { callGeminiForEdit } from '../hooks/geminiUtils';
import Terminal from './Terminal'; // Make sure this import is correct
import { useGitHubApi } from '../hooks/useGitHubApi'; // Import the hook

// Helper: Base64 Decode (needed for fetching content)
const decodeBase64 = (base64Str) => {
    if (!base64Str) return ''; // Handle null or empty input
    try {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(base64Str, 'base64').toString('utf-8');
        }
        // Browser fallback
        return decodeURIComponent(escape(window.atob(base64Str)));
    } catch (e) {
        console.error("Base64 decoding failed:", e);
        return null; // Indicate failure
    }
};


const getLanguageForMonaco = (filename) => {
    if (!filename) return 'plaintext';
    const extension = filename.split('.').pop()?.toLowerCase();
    // Added some common ones, expand as needed
    switch (extension) {
        case 'js': case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'py': return 'python';
        case 'java': return 'java';
        case 'c': case 'h': return 'c';
        case 'cpp': case 'hpp': return 'cpp';
        case 'cs': return 'csharp';
        case 'go': return 'go';
        case 'rb': return 'ruby';
        case 'php': return 'php';
        case 'html': return 'html';
        case 'css': return 'css';
        case 'scss': return 'scss';
        case 'json': return 'json';
        case 'yaml': case 'yml': return 'yaml';
        case 'md': return 'markdown';
        case 'sh': case 'bash': return 'shell';
        case 'sql': return 'sql';
        case 'xml': return 'xml';
        case 'dockerfile': return 'dockerfile';
        case 'gitignore': return 'gitignore'; // Added
        case 'env': return 'ini'; // Often highlighted as ini
        default: return 'plaintext';
    }
};

// --- PromptInput component remains the same ---
const PromptInput = ({ isOpen, onClose, onSubmit, prompt, setPrompt, isLoading, error, position }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading && prompt) {
            e.preventDefault();
            onSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    if (!isOpen || !position) return null;

    return (
        <div
            className="absolute z-30 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-300 dark:border-gray-600 w-full max-w-lg p-3"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
            onClick={(e) => e.stopPropagation()}
        >
            {error && (
                <div className="mb-2 p-1.5 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-xs flex items-center space-x-1.5">
                    <FiAlertCircle size={14} className="flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                rows="2"
                placeholder="Describe how to change the selection (Enter to submit, Esc to cancel)"
                disabled={isLoading}
            />
            <div className="mt-2 flex justify-end space-x-2">
                <button
                    onClick={onClose}
                    className="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    className={`px-3 py-1 text-xs rounded flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                        isLoading
                            ? 'bg-gray-400 dark:bg-gray-500 text-white dark:text-gray-300'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    disabled={!prompt || isLoading}
                >
                    {isLoading ? (
                        <>
                            <FiLoader className="animate-spin mr-1.5" size={12} />
                            Processing...
                        </>
                    ) : (
                        'Generate Edit'
                    )}
                </button>
            </div>
        </div>
    );
};
// --- End of PromptInput ---


const CodeDisplay = ({
    selectedFile,       // Contains { name, path, sha? (initial sha, optional) }
    onClearFile,        // Function to call when closing the file view
    accessToken,        // GitHub Access Token
    repoFullName,       // Full repository name (e.g., "owner/repo")
}) => {

    const monaco = useMonaco();
    const editorRef = useRef(null);
    const editorContainerRef = useRef(null);
    const fileName = useMemo(() => selectedFile?.name, [selectedFile]);
    const filePath = useMemo(() => selectedFile?.path, [selectedFile]);
    const language = useMemo(() => getLanguageForMonaco(fileName), [fileName]);

    // --- State for Editor and File ---
    const [editorContent, setEditorContent] = useState(''); // Content currently in the editor
    const [cleanContentState, setCleanContentState] = useState(''); // Content as fetched or last saved
    const [currentSha, setCurrentSha] = useState(null); // The SHA required for the next update
    const [isDirty, setIsDirty] = useState(false); // editorContent !== cleanContentState
    const [isFileLoading, setIsFileLoading] = useState(false); // Loading initial file content
    const [fileFetchError, setFileFetchError] = useState(null); // Error during initial fetch

    // --- State for UI and Integrations ---
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isPromptInputOpen, setIsPromptInputOpen] = useState(false);
    const [promptInput, setPromptInput] = useState('');
    const [selectedTextForPrompt, setSelectedTextForPrompt] = useState('');
    const [selectionRange, setSelectionRange] = useState(null);
    const [promptPosition, setPromptPosition] = useState(null);
    const [isGeminiLoading, setIsGeminiLoading] = useState(false);
    const [geminiError, setGeminiError] = useState(null);
    const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [commitMessage, setCommitMessage] = useState(''); // State for commit message

    // --- Initialize GitHub API Hook ---
    const {
        commitCode,         // Use this for saving (create/update)
        isOperating: isCommitting, // Renamed for clarity in this component
        operationError: commitError,
        operationSuccess: commitSuccess,
        clearOperationError: clearCommitError,
    } = useGitHubApi(accessToken, repoFullName);

    // --- Effect for Gemini API Key Check ---
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_GEMINI_API;
        setIsApiKeyMissing(!key || key === 'YOUR_GEMINI_API_KEY' || key.trim() === '');
    }, []);

    // --- Effect for Dark Mode Detection ---
    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', checkDarkMode);
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => {
            mediaQuery.removeEventListener('change', checkDarkMode);
            observer.disconnect();
        };
    }, []);

    // --- Effect to Fetch File Content and SHA ---
    const fetchFileContentAndSha = useCallback(async () => {
        if (!filePath || !repoFullName || !accessToken) {
            setEditorContent('');
            setCleanContentState('');
            setCurrentSha(null);
            setIsDirty(false);
            setFileFetchError(null);
            setIsFileLoading(false);
            return;
        }

        console.log(`Fetching content for: ${repoFullName}/${filePath}`);
        setIsFileLoading(true);
        setFileFetchError(null);
        clearCommitError(); // Clear previous operation errors too
        setCommitMessage(`Update ${fileName || filePath}`); // Default commit message

        try {
            const response = await fetch(
                `https://api.github.com/repos/${repoFullName}/contents/${filePath}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    console.log("File not found (404). Assuming new file.");
                    setEditorContent(''); // Start empty for new file
                    setCleanContentState('');
                    setCurrentSha(null); // No SHA for new file
                    setIsDirty(false); // New file starts clean
                    setFileFetchError(null); // Don't treat 404 as error for editing
                    setCommitMessage(`Create ${fileName || filePath}`); // Adjust commit message
                } else {
                     throw new Error(` ${response.status} ${data.message || response.statusText}`);
                }
            } else {
                // File exists, decode content and set SHA
                const decodedContent = decodeBase64(data.content);
                if (decodedContent === null) {
                    throw new Error("Failed to decode file content.");
                }
                setEditorContent(decodedContent);
                setCleanContentState(decodedContent); // Initial clean state
                setCurrentSha(data.sha); // <<<<<< STORE THE SHA >>>>>>
                setIsDirty(false); // Start clean
                console.log("File fetched successfully. SHA:", data.sha);
            }
        } catch (error) {
            console.error("Error fetching file content:", error);
            setFileFetchError(`Failed to load file. ${error.message}`);
            setEditorContent('');
            setCleanContentState('');
            setCurrentSha(null);
            setIsDirty(false);
        } finally {
            setIsFileLoading(false);
        }
    }, [filePath, repoFullName, accessToken, clearCommitError, fileName]); // Dependencies for fetch

    // --- Trigger Fetch when Selected File Changes ---
    useEffect(() => {
        fetchFileContentAndSha();
    }, [fetchFileContentAndSha]); // fetch function depends on filePath, repo, token

    // --- Handle Editor Content Change ---
    const handleEditorChange = useCallback((value) => {
        const currentVal = value ?? '';
        setEditorContent(currentVal); // Update editor state

        // Update dirtiness based on comparison with the last known clean state
        setIsDirty(currentVal !== cleanContentState);

        // Clear commit errors when user starts typing again
        if (commitError) clearCommitError?.();
        if (geminiError) setGeminiError(null); // Also clear AI errors

    }, [cleanContentState, commitError, clearCommitError, geminiError]);

    // --- Handle Save (Commit) Click ---
    const handleSaveClick = useCallback(async () => {
        if (!isDirty || isCommitting || !selectedFile || fileFetchError || !filePath || !commitMessage) {
            console.warn("Save conditions not met:", { isDirty, isCommitting, selectedFile, fileFetchError, commitMessage });
            if (!commitMessage && isDirty) {
                alert("Please provide a commit message.");
            }
            return;
        }

        console.log(`Attempting save for ${filePath} with SHA: ${currentSha}`);

        // Call the hook's commit function
        const result = await commitCode(
            editorContent,      // The current content from the editor
            commitMessage,      // Commit message from state
            filePath,           // Path of the file
            currentSha          // <<<<<< PASS THE CURRENT SHA >>>>>>
        );

        if (result.success && result.data?.content?.sha) {
            // --- IMPORTANT: Update SHA and clean state on success ---
            const newSha = result.data.content.sha;
            console.log(`Commit successful! Updating SHA from ${currentSha} to ${newSha}`);
            setCurrentSha(newSha);                  // Store the new SHA
            setCleanContentState(editorContent);    // Current content is now the clean state
            setIsDirty(false);                      // No longer dirty
            setCommitMessage(`Update ${fileName}`); // Reset commit message suggestion
            // Hook handles success state (operationSuccess)
        } else {
            // Hook handles error state (operationError)
            console.error("Commit failed:", result.error);
             // Maybe offer to refetch on 409? The error message already suggests this.
             // UI will show operationError from the hook.
        }
    }, [
        isDirty,
        isCommitting,
        selectedFile,
        fileFetchError,
        filePath,
        commitCode,
        editorContent,
        commitMessage,
        currentSha,
        fileName // Added fileName for commit message reset
    ]);

    // --- Editor Options ---
    const editorOptions = useMemo(() => ({
        readOnly: isCommitting || isFileLoading || !!fileFetchError || isGeminiLoading || isPromptInputOpen,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: 'off', // Or 'on' based on preference
        lineNumbers: 'on',
        automaticLayout: true, // Important for resizing
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: 'gutter',
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
        },
    }), [isCommitting, isFileLoading, fileFetchError, isGeminiLoading, isPromptInputOpen]);

    // --- Editor Theme ---
    const editorTheme = isDarkMode ? 'vs-dark' : 'vs';

    // --- AI Prompt Handling (handleOpenPromptInput, handleClosePromptInput) ---
    // (These remain largely the same as your original code, ensure monaco dependency is correct)
    const handleOpenPromptInput = useCallback(() => {
         if (isApiKeyMissing) {
             setGeminiError("Gemini API key is missing or invalid. Please configure NEXT_PUBLIC_GEMINI_API.");
             setPromptPosition({ top: 20, left: 20 }); // Show error near top
             setIsPromptInputOpen(true);
             return;
         }
        if (!editorRef.current || !monaco) return;

        const editor = editorRef.current;
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) return; // Need selection

        const selectedText = editor.getModel().getValueInRange(selection);
        setSelectedTextForPrompt(selectedText);
        setSelectionRange(selection);
        setPromptInput('');
        setGeminiError(null);

        // Calculate position (your existing logic seems reasonable)
        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;
        const editorLayout = editor.getLayoutInfo();
        const contentWidgetPosition = editor.getScrolledVisiblePosition({ lineNumber: startLineNumber, column: startColumn });

        if (!contentWidgetPosition) return;

        const estimatedLineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        let top = contentWidgetPosition.top + estimatedLineHeight;
        let left = contentWidgetPosition.left;
        const promptWidthEstimate = 500;
        const promptHeightEstimate = 100;

        if (left + promptWidthEstimate > editorLayout.width - 20) left = Math.max(10, editorLayout.width - promptWidthEstimate - 20);
        if (left < 10) left = 10;
        if (top + promptHeightEstimate > editorLayout.height - 20) top = contentWidgetPosition.top - promptHeightEstimate - 5;
        if (top < 10) top = 10;

        setPromptPosition({ top, left });
        setIsPromptInputOpen(true);

    }, [monaco, isApiKeyMissing]); // Added monaco dependency

    const handleClosePromptInput = useCallback(() => {
        setIsPromptInputOpen(false);
        // Don't clear promptInput immediately if there was an error
        if (!geminiError) setPromptInput('');
        setSelectedTextForPrompt('');
        setSelectionRange(null);
        setPromptPosition(null);
        // Keep geminiError visible until user dismisses or tries again
        if (editorRef.current) {
             setTimeout(() => editorRef.current?.focus(), 0);
        }
    }, [geminiError]); // Keep prompt if error occurred

    // --- Handle AI Edit Submission ---
    // Updated to correctly set dirtiness after AI edit
    const handlePromptSubmit = useCallback(async () => {
        if (isApiKeyMissing) {
            setGeminiError("Gemini API key is missing or invalid.");
            return;
        }
        if (!promptInput || !selectionRange || selectedTextForPrompt === null || selectedTextForPrompt === undefined) {
             setGeminiError("Missing data for AI edit (selection or prompt).");
             return;
        }
        const editor = editorRef.current;
        if (!editor || !editor.getModel()) {
            setGeminiError("Editor is not ready.");
            return;
        }

        setIsGeminiLoading(true);
        setGeminiError(null); // Clear previous errors on new attempt

        try {
            const modifiedCode = await callGeminiForEdit(
                selectedTextForPrompt,
                promptInput,
                language // Pass detected language
            );

            const model = editor.getModel();
            // Apply the edit using Monaco's API
            editor.executeEdits('gemini-ai-edit', [{
                range: selectionRange,
                text: modifiedCode,
                forceMoveMarkers: true
            }]);

           
            const oldContent = model.getValue();
            const newFullContent = oldContent.replace(selectedTextForPrompt, modifiedCode);
            setEditorContent(newFullContent);
            // Check dirtiness against the clean state *before* this AI edit
            setIsDirty(newFullContent !== cleanContentState);

            handleClosePromptInput(); // Close on success

        } catch (error) {
            console.error("Gemini edit failed:", error);
            const message = error instanceof Error ? error.message : "Unknown AI edit error.";
            setGeminiError(message);
            // Keep prompt open on error
        } finally {
            setIsGeminiLoading(false);
            if (!geminiError && editorRef.current) { // Re-focus only if prompt closed
                setTimeout(() => editorRef.current?.focus(), 0);
            }
        }
    }, [
        promptInput, selectionRange, selectedTextForPrompt, language, isApiKeyMissing,
        handleClosePromptInput, cleanContentState, // Added cleanContentState
        geminiError // Added geminiError dependency
    ]);

    // --- Terminal Toggle ---
    const handleOpenTerminal = useCallback(() => {
         setIsTerminalOpen(prev => !prev);
    }, []);

    // --- Editor Mount and Keyboard Shortcuts ---
    const handleEditorDidMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

        // Save command (Ctrl/Cmd + S)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
            // Prevent default browser save action if necessary (usually handled by Monaco)
            // e.preventDefault();
            handleSaveClick(); // Trigger our save function
        });

        // AI Edit command (Ctrl/Cmd + K)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, () => {
             handleOpenPromptInput();
        });

         // Toggle Terminal command (Ctrl/Cmd + J)
         editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyJ, () => {
            handleOpenTerminal();
        });


        // Focus the editor when it mounts and file is ready
        if (!isFileLoading && !fileFetchError) {
             editor.focus();
        }

    }, [handleSaveClick, handleOpenPromptInput, handleOpenTerminal, isFileLoading, fileFetchError]); // Dependencies for mount


    // --- RENDER LOGIC ---
    const showNoFileSelected = !selectedFile && !isFileLoading && !fileFetchError;
    const showEditor = selectedFile && !fileFetchError;
    const showCommitError = commitError && !isCommitting;
    const showCommitSuccess = commitSuccess && !isCommitting && !isDirty; // Show success briefly

    // Calculate repo URL for Terminal
    const repoUrl = repoFullName ? `https://github.com/${repoFullName}` : '';

    return (
        <>
            {/* Container for Editor and Terminal */}
            <div className="flex flex-1 flex-col bg-white dark:bg-gray-900 overflow-hidden">
                 {/* Top Bar */}
                 <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0 min-h-[41px] space-x-2">
                    {/* File Info and Status */}
                    {selectedFile ? (
                        <>
                            <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
                                <FiCode className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={16} aria-hidden="true" />
                                <span
                                    className={`text-sm font-medium text-gray-800 dark:text-gray-200 truncate ${isDirty ? 'italic' : ''}`}
                                    title={filePath}
                                >
                                    {fileName}
                                    {isDirty && '*'} {/* Simple dirty indicator */}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
                                    ({filePath})
                                </span>

                                {/* Status Indicators */}
                                {isFileLoading && <FiLoader title="Loading file..." className="animate-spin text-blue-500 dark:text-blue-400 flex-shrink-0 ml-2" size={16} />}
                                {isCommitting && <FiLoader title="Committing..." className="animate-spin text-green-500 dark:text-green-400 flex-shrink-0 ml-2" size={16} />}
                                {showCommitSuccess && <FiCheckCircle title="Commit successful!" className="text-green-500 dark:text-green-400 flex-shrink-0 ml-2" size={16} />}
                                {fileFetchError && !isFileLoading && <FiAlertCircle title={`File loading error: ${fileFetchError}`} className="text-red-500 dark:text-red-400 flex-shrink-0 ml-2" size={16} />}
                                {showCommitError && (
                                    <div className="flex items-center ml-2 space-x-1" title={`Commit error: ${commitError}`}>
                                        <FiAlertCircle className="text-red-500 dark:text-red-400 flex-shrink-0" size={16} />
                                        {/* Optional: Button to dismiss error, uses clearCommitError from hook */}
                                        <button
                                            onClick={clearCommitError}
                                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            aria-label="Dismiss commit error"
                                        >
                                            <FiX size={12} className="text-red-600 dark:text-red-300" />
                                        </button>
                                        {/* Optional: Refetch button for 409 errors */}
                                        {commitError.includes('(409)') && (
                                            <button onClick={fetchFileContentAndSha} className="ml-1 text-xs text-blue-600 dark:text-blue-400 underline">Refetch</button>
                                        )}
                                    </div>
                                )}
                                {isGeminiLoading && <FiLoader title="AI processing..." className="animate-spin text-purple-500 dark:text-purple-400 flex-shrink-0 ml-2" size={16} />}
                                {isApiKeyMissing && !isPromptInputOpen && <FiAlertCircle title="Gemini API key missing! Press Cmd/Ctrl+K to see details." className="text-orange-500 dark:text-orange-400 flex-shrink-0 ml-2" size={16} />}
                            </div>

                            {/* Commit Message Input & Action Buttons */}
                            <div className="flex items-center flex-shrink-0 space-x-1">
                                {/* Commit Message Input */}
                                <input
                                    type="text"
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    placeholder="Commit message"
                                    className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hidden md:inline-block" // Hide on small screens maybe
                                    disabled={isCommitting || isFileLoading || !!fileFetchError || isGeminiLoading || isPromptInputOpen}
                                    aria-label="Commit message"
                                />
                                {/* Save Button */}
                                {isDirty && (
                                    <button
                                        onClick={handleSaveClick}
                                        title={`Commit changes to GitHub ${commitMessage ? `(${commitMessage})` : ''} (Ctrl/Cmd+S)`}
                                        aria-label="Commit changes"
                                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={!isDirty || isCommitting || isFileLoading || !!fileFetchError || isGeminiLoading || isPromptInputOpen || !commitMessage}
                                    >
                                        <FiSave size={16} />
                                    </button>
                                )}
                                {/* Close Button */}
                                <button
                                    onClick={onClearFile}
                                    title="Close file"
                                    aria-label="Close file"
                                    className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                    disabled={isCommitting /* Maybe allow closing even if committing? Optional */}
                                >
                                    <FiX size={16} />
                                </button>
                            </div>
                        </>
                    ) : (
                         // Placeholder when no file is selected
                        <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
                            {isFileLoading ? 'Loading...' : 'Select a file to view its content.'}
                        </span>
                    )}
                </div>

                 {/* Editor Area */}
                 <div ref={editorContainerRef} className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {/* Loading Overlay (for initial fetch) */}
                     {isFileLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10 backdrop-blur-sm">
                            <div className="flex flex-col items-center p-4 rounded bg-gray-200/90 dark:bg-gray-700/90 shadow-md">
                                <FiLoader className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={24} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Loading content...</span>
                            </div>
                        </div>
                    )}
                     {/* File Fetch Error Display */}
                     {fileFetchError && !isFileLoading && (
                        <div className="m-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm flex items-start space-x-2 break-words">
                            <FiAlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <span>{fileFetchError}</span>
                             {/* Add refetch button directly here too */}
                             <button onClick={fetchFileContentAndSha} className="ml-auto text-xs text-blue-600 dark:text-blue-400 underline px-2 py-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800">Retry Fetch</button>
                        </div>
                    )}
                     {/* No File Selected Placeholder */}
                     {showNoFileSelected && (
                        <div className="flex flex-1 flex-col items-center justify-center h-full p-6 text-gray-500 dark:text-gray-400">
                            {/* <FiCode size={48} className="mb-4 opacity-50" /> */}
                            <img src="logo.svg" alt="No file selected" className="w-16 h-16 mb-4 opacity-50" />
                            <p>Select a file from the list on the left to edit.</p>
                             <p className="text-xs mt-2">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+K</kbd> to edit selection with AI)</p>
                             <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+S</kbd> to commit changes)</p>
                             <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+J</kbd> to toggle Terminal)</p>
                        </div>
                    )}

                     {/* Monaco Editor Instance */}
                    {showEditor && (
                        <Editor
                            key={filePath} // Ensures editor remounts on file change
                            height="100%"
                            language={language}
                            theme={editorTheme}
                            value={editorContent} // Controlled component using editor state
                            options={editorOptions}
                            onChange={handleEditorChange} // Updates editorContent and isDirty
                            onMount={handleEditorDidMount}
                            loading={ // Show specific loading for editor initialization
                               <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                   <FiLoader className="animate-spin text-blue-500 mr-2" size={20} />
                                   Loading Editor...
                               </div>
                            }
                        />
                    )}

                    {/* AI Prompt Input - Absolute Positioned */}
                    <PromptInput
                        isOpen={isPromptInputOpen}
                        onClose={handleClosePromptInput}
                        onSubmit={handlePromptSubmit}
                        prompt={promptInput}
                        setPrompt={setPromptInput}
                        isLoading={isGeminiLoading}
                        error={geminiError} // Display Gemini-specific errors here
                        position={promptPosition}
                    />
                </div>

                 {/* Terminal Area (Conditionally Rendered) */}
                 {isTerminalOpen && repoUrl && accessToken && (
                     <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 h-48 md:h-64">
                         <Terminal repoUrl={repoUrl} accessToken={accessToken}/>
                     </div>
                 )}
            </div>
        </>
    );
};

export default CodeDisplay;