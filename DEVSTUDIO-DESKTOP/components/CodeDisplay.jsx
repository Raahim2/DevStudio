'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FiLoader, FiAlertCircle, FiCode, FiX, FiSave, FiCheckCircle } from 'react-icons/fi';
import { callGeminiForEdit } from '../hooks/geminiUtils';
import Terminal from './Terminal'; // Make sure this import is correct

// ... (getLanguageForMonaco remains the same)
const getLanguageForMonaco = (filename) => {
    // ... (implementation is correct)
    if (!filename) return 'plaintext';
    const extension = filename.split('.').pop()?.toLowerCase();
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
        default: return 'plaintext';
    }
};

// ... (PromptInput remains the same)
const PromptInput = ({ isOpen, onClose, onSubmit, prompt, setPrompt, isLoading, error, position }) => {
    // ... (implementation is correct)
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


const CodeDisplay = ({
    selectedFile,
    fileContent,
    onClearFile,
    isLoading,
    error: fileError,
    onSave,
    isCommitting,
    commitError,
    commitSuccess,
    clearCommitError,
    accessToken
}) => {

    const monaco = useMonaco();
    const editorRef = useRef(null);
    const editorContainerRef = useRef(null);
    const fileName = useMemo(() => selectedFile?.name, [selectedFile?.name]);
    const filePath = useMemo(() => selectedFile?.path, [selectedFile?.path]);
    const language = useMemo(() => getLanguageForMonaco(fileName), [fileName]);

    const [editorContent, setEditorContent] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    const [isPromptInputOpen, setIsPromptInputOpen] = useState(false);
    const [promptInput, setPromptInput] = useState('');
    const [selectedTextForPrompt, setSelectedTextForPrompt] = useState('');
    const [selectionRange, setSelectionRange] = useState(null);
    const [promptPosition, setPromptPosition] = useState(null);
    const [isGeminiLoading, setIsGeminiLoading] = useState(false);
    const [geminiError, setGeminiError] = useState(null);
    const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false); // State for terminal

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_GEMINI_API;
        if (!key || key === 'YOUR_GEMINI_API_KEY' || key.trim() === '') {
            console.error("Gemini API key not found or placeholder used. Set NEXT_PUBLIC_GEMINI_API in your .env.local file.");
            setIsApiKeyMissing(true);
        } else {
            setIsApiKeyMissing(false);
        }
    }, []);

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

    useEffect(() => {
        if (fileContent !== null && fileContent !== undefined) {
            if (fileContent !== editorContent) {
                 setEditorContent(fileContent);
                 setIsDirty(false);
            }
        } else if (selectedFile) {
            setEditorContent('');
            setIsDirty(false);
        } else {
            setEditorContent('');
            setIsDirty(false);
        }
        // Only run when fileContent or selectedFile identity changes
    }, [fileContent, selectedFile?.path, selectedFile?.sha]); // editorContent removed from deps

    const handleEditorChange = useCallback((value) => {
        const currentVal = value ?? '';
        setEditorContent(currentVal); // Update internal state

        // Determine dirtiness based on comparison with the original fetched content
        if (!commitSuccess && !isCommitting) {
            setIsDirty(currentVal !== fileContent);
        }

        if (commitError) clearCommitError?.();
        if (geminiError) setGeminiError(null);

    }, [fileContent, commitError, clearCommitError, commitSuccess, isCommitting, geminiError]);

    const handleSaveClick = useCallback(() => {
        if (!isDirty || isCommitting || !selectedFile) {
            return;
        }
        onSave?.(selectedFile, editorContent);
    }, [onSave, selectedFile, editorContent, isDirty, isCommitting]);

    const editorOptions = useMemo(() => ({
        readOnly: isCommitting || isLoading || !!fileError || isGeminiLoading || isPromptInputOpen,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: 'off',
        lineNumbers: 'on',
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: 'gutter',
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
        },
    }), [isCommitting, isLoading, fileError, isGeminiLoading, isPromptInputOpen]);

    const editorTheme = isDarkMode ? 'vs-dark' : 'vs';

    const handleOpenPromptInput = useCallback(() => {
        if (isApiKeyMissing) {
             setGeminiError("Gemini API key is missing or invalid. Please configure NEXT_PUBLIC_GEMINI_API.");
             // Position the error message somewhere visible even if editor isn't fully loaded
             setPromptPosition({top: 20, left: 20});
             setIsPromptInputOpen(true); // Open the input to show the error
             return;
        }
        if (!editorRef.current || !monaco) return; // Ensure monaco is available

        const editor = editorRef.current;
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) {
            // Optionally provide feedback that a selection is needed
            console.log("Please select text to edit with AI.");
            return;
        }

        const selectedText = editor.getModel().getValueInRange(selection);
        setSelectedTextForPrompt(selectedText);
        setSelectionRange(selection);
        setPromptInput('');
        setGeminiError(null);

        // Calculate position more reliably
        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;
        const editorLayout = editor.getLayoutInfo();

        // Get the position of the top-left corner of the selection in the viewport
        const contentWidgetPosition = editor.getScrolledVisiblePosition({ lineNumber: startLineNumber, column: startColumn });

        if (!contentWidgetPosition) return; // Cannot calculate position if selection is off-screen

        const estimatedLineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        let top = contentWidgetPosition.top + estimatedLineHeight; // Position below the start line
        let left = contentWidgetPosition.left; // Position at the start column

        // Adjust position to keep the prompt within the editor bounds
        const promptWidthEstimate = 500; // Approx width of the prompt input
        const promptHeightEstimate = 100; // Approx height

        if (left + promptWidthEstimate > editorLayout.width - 20) { // Check right boundary
            left = Math.max(10, editorLayout.width - promptWidthEstimate - 20);
        }
        if (left < 10) { // Check left boundary
            left = 10;
        }

        if (top + promptHeightEstimate > editorLayout.height - 20) { // Check bottom boundary
             // Try positioning above the selection instead
             top = contentWidgetPosition.top - promptHeightEstimate - 5;
             if (top < 10) { // If still too high, clamp to top
                 top = 10;
             }
        }
         if (top < 10) { // Ensure it doesn't go above the top viewport
             top = 10;
         }


        setPromptPosition({ top, left });
        setIsPromptInputOpen(true);

    }, [monaco, isApiKeyMissing]); // Include monaco in dependencies

    // --- IMPROVED: handleOpenTerminal ---
    const handleOpenTerminal = useCallback(() => {
         setIsTerminalOpen(prev => !prev); // Toggle state
    }, []); // No dependencies needed

    const handleClosePromptInput = useCallback(() => {
        setIsPromptInputOpen(false);
        setPromptInput('');
        setSelectedTextForPrompt('');
        setSelectionRange(null);
        setPromptPosition(null);
        setGeminiError(null); // Clear error on close
        if (editorRef.current) {
             // Short delay helps ensure focus works correctly after state updates
             setTimeout(() => editorRef.current?.focus(), 0);
        }
    }, []);

    // --- handlePromptSubmit remains mostly the same, ensure editor checks ---
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
        // Robust check for editor and model
        if (!editor || typeof editor.getModel !== 'function' || !editor.getModel()) {
            setGeminiError("Editor is not ready or model is unavailable.");
            return;
        }

        setIsGeminiLoading(true);
        setGeminiError(null);

        try {
            const modifiedCode = await callGeminiForEdit(
                selectedTextForPrompt,
                promptInput,
                language
            );

            const model = editor.getModel();

            // Apply the edit
            editor.executeEdits('gemini-ai-edit', [{
                range: selectionRange,
                text: modifiedCode,
                forceMoveMarkers: true // Important for subsequent edits/selections
            }]);

            // Get the *new* full content AFTER the edit is applied
            const newFullContent = model.getValue();


            // Update React state only if the content actually changed
            // This prevents unnecessary re-renders and potential loops
            if (newFullContent !== editorContent) {
                 setEditorContent(newFullContent); // Update state with the content from the model
                 setIsDirty(newFullContent !== fileContent); // Check dirtiness against original
            } else {
                console.log("Gemini edit resulted in identical content. State not updated.");
            }

            // Close prompt after successful execution
            handleClosePromptInput();

        } catch (error) {
            console.error("Gemini edit failed:", error);
            // Provide more specific error if possible
            const message = error instanceof Error ? error.message : "An unknown error occurred during AI edit.";
            setGeminiError(message);
            // Do not close prompt on error, let the user see the error message
        } finally {
            setIsGeminiLoading(false);
            // Re-focus editor after operation, unless prompt stays open due to error
            if (!geminiError && editorRef.current) {
                setTimeout(() => editorRef.current?.focus(), 0);
            }
        }
    }, [
        promptInput,
        selectionRange,
        selectedTextForPrompt,
        language,
        handleClosePromptInput,
        fileContent,
        editorContent, // Current React state content
        isApiKeyMissing,
        geminiError // Added to dependencies for the finally block focus logic
    ]);

    const handleEditorDidMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

        // Save command (Ctrl/Cmd + S)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
            handleSaveClick();
        });

        // AI Edit command (Ctrl/Cmd + K)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, () => {
             handleOpenPromptInput();
        });

        // Toggle Terminal command (Ctrl/Cmd + J)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyJ, () => {
            handleOpenTerminal();
       });

        // Focus the editor when it mounts
        editor.focus();

    }, [handleSaveClick, handleOpenPromptInput, handleOpenTerminal]); // Added handleOpenTerminal


    return (
        <>
            {/* Container for both Editor and Terminal */}
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
                                    {isDirty && !isCommitting && !commitSuccess ? '*' : ''} {/* Show * only when dirty and not just committed */}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
                                    ({filePath})
                                </span>

                                {/* Status Indicators */}
                                {isLoading && <FiLoader title="Loading file content..." className="animate-spin text-blue-500 dark:text-blue-400 flex-shrink-0 ml-2" size={16} />}
                                {isCommitting && <FiLoader title="Commit in progress..." className="animate-spin text-green-500 dark:text-green-400 flex-shrink-0 ml-2" size={16} />}
                                {commitSuccess && !isCommitting && <FiCheckCircle title="Commit successful!" className="text-green-500 dark:text-green-400 flex-shrink-0 ml-2" size={16} />}
                                {fileError && !isLoading && <FiAlertCircle title={`File loading error: ${fileError}`} className="text-red-500 dark:text-red-400 flex-shrink-0 ml-2" size={16} />}
                                {commitError && !isCommitting && (
                                    <div className="flex items-center ml-2 space-x-1" title={`Commit error: ${commitError}`}>
                                        <FiAlertCircle className="text-red-500 dark:text-red-400 flex-shrink-0" size={16} />
                                        <button
                                            onClick={clearCommitError}
                                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            aria-label="Dismiss commit error"
                                        >
                                            <FiX size={12} className="text-red-600 dark:text-red-300" />
                                        </button>
                                    </div>
                                )}
                                {isGeminiLoading && <FiLoader title="AI processing..." className="animate-spin text-purple-500 dark:text-purple-400 flex-shrink-0 ml-2" size={16} />}
                                {isApiKeyMissing && !isPromptInputOpen && <FiAlertCircle title="Gemini API key missing or invalid! Press Cmd/Ctrl+K to see details." className="text-orange-500 dark:text-orange-400 flex-shrink-0 ml-2" size={16} />}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center flex-shrink-0 space-x-1">
                                {isDirty && !isCommitting && !commitSuccess && ( // Hide save if just successfully committed
                                    <button
                                        onClick={handleSaveClick}
                                        title="Save changes (Commit to GitHub - Ctrl/Cmd+S)"
                                        aria-label="Save changes"
                                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                        disabled={!isDirty || isCommitting || isGeminiLoading || isPromptInputOpen || !!fileError}
                                    >
                                        <FiSave size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={onClearFile}
                                    title="Close file view"
                                    aria-label="Close file view"
                                    className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                    disabled={isCommitting || isGeminiLoading || isPromptInputOpen}
                                >
                                    <FiX size={16} />
                                </button>
                            </div>
                        </>
                    ) : (
                         // Placeholder when no file is selected
                        <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
                            Select a file to view its content.
                        </span>
                    )}
                </div>

                 {/* Editor Area */}
                 <div ref={editorContainerRef} className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {/* Loading Overlay */}
                     {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10 backdrop-blur-sm">
                            <div className="flex flex-col items-center p-4 rounded bg-gray-200/90 dark:bg-gray-700/90 shadow-md">
                                <FiLoader className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={24} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Loading content...</span>
                            </div>
                        </div>
                    )}
                     {/* File Error Display */}
                     {fileError && !isLoading && (
                        <div className="m-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm flex items-start space-x-2 break-words">
                            <FiAlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <span>Error loading file: {fileError}</span>
                        </div>
                    )}
                     {/* No File Selected Placeholder */}
                     {!selectedFile && !isLoading && !fileError && (
                        <div className="flex flex-1 flex-col items-center justify-center h-full p-6 text-gray-500 dark:text-gray-400">
                            <FiCode size={48} className="mb-4 opacity-50" />
                            <p>Select a file from the list on the left to edit.</p>
                            <p className="text-xs mt-2">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+K</kbd> to edit selection with AI)</p>
                            <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+J</kbd> to toggle Terminal)</p>
                        </div>
                    )}

                     {/* Monaco Editor Instance */}
                    {selectedFile && !fileError && (
                        <Editor
                            key={filePath} // Ensures editor remounts on file change
                            height="100%" // Takes full height of its container
                            language={language}
                            theme={editorTheme}
                            value={editorContent} // Controlled component
                            options={editorOptions}
                            onChange={handleEditorChange}
                            onMount={handleEditorDidMount}
                            loading={ // Loading indicator for the editor itself
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
                        error={geminiError}
                        position={promptPosition} // Calculated position
                    />

                     {/* Global AI Loading Indicator (when prompt is not open) */}
                     {isGeminiLoading && !isPromptInputOpen && (
                         <div className="absolute bottom-4 right-4 flex items-center p-2 rounded bg-white/80 dark:bg-gray-800/80 shadow-md border border-gray-300 dark:border-gray-600 z-20">
                             <FiLoader className="animate-spin text-purple-600 dark:text-purple-400 mr-2" size={16} />
                             <span className="text-sm text-gray-700 dark:text-gray-300">AI Processing...</span>
                         </div>
                     )}
                </div>

                 
                 {isTerminalOpen && (
                     <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 h-48 md:h-64">
                         {/* You might want a container with specific height */}
                         <Terminal repoUrl={"https://github.com/Raahim2/DevStudio"} accessToken={accessToken}/>
                     </div>
                 )}

            </div>
        </>
    );
};

export default CodeDisplay;