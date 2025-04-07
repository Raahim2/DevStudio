'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FiLoader, FiAlertCircle, FiCode, FiX, FiSave, FiCheckCircle } from 'react-icons/fi';
import { callGeminiForEdit } from '../hooks/geminiUtils';

const getLanguageForMonaco = (filename) => {
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
    clearCommitError
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
    }, [fileContent, selectedFile?.path, selectedFile?.sha]);

    const handleEditorChange = useCallback((value) => {
        const currentVal = value ?? '';
        setEditorContent(currentVal);

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
             setIsPromptInputOpen(true);
             setPromptPosition({top: 20, left: 20});
             return;
        }
        if (!editorRef.current || !editorContainerRef.current) return;

        const editor = editorRef.current;
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) {
            return;
        }

        const selectedText = editor.getModel().getValueInRange(selection);
        setSelectedTextForPrompt(selectedText);
        setSelectionRange(selection);
        setPromptInput('');
        setGeminiError(null);

        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;
        const editorLayout = editor.getLayoutInfo();
        const visiblePos = editor.getScrolledVisiblePosition({ lineNumber: startLineNumber, column: startColumn });

        const estimatedLineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        let top = visiblePos.top + estimatedLineHeight;
        let left = visiblePos.left;

        const promptWidthEstimate = 500;
        const promptHeightEstimate = 90;

        if (left + promptWidthEstimate > editorLayout.width - 10) {
            left = editorLayout.width - promptWidthEstimate - 10;
        }
        if (left < 10) left = 10;

        if (top + promptHeightEstimate > editorLayout.height - 10) {
            top = visiblePos.top - promptHeightEstimate - 10;
            if (top < 10) top = 10;
        }

        setPromptPosition({ top, left });
        setIsPromptInputOpen(true);

    }, [monaco, isApiKeyMissing]);

    const handleClosePromptInput = useCallback(() => {
        setIsPromptInputOpen(false);
        setPromptInput('');
        setSelectedTextForPrompt('');
        setSelectionRange(null);
        setPromptPosition(null);
        if (editorRef.current) {
             setTimeout(() => editorRef.current?.focus(), 0);
        }
    }, []);

    // --- UPDATED handlePromptSubmit ---
    const handlePromptSubmit = useCallback(async () => {
        if (isApiKeyMissing) {
            setGeminiError("Gemini API key is missing or invalid.");
            return;
        }
        if (!promptInput || !selectionRange || !selectedTextForPrompt) {
             setGeminiError("Missing data for AI edit.");
             return;
        }
        const editor = editorRef.current;
        if (!editor || !editor.getModel()) {
            setGeminiError("Editor is not available.");
            return; // Guard against editor not being ready
        }

        setIsGeminiLoading(true);
        setGeminiError(null);


        try {
            const modifiedCode = await callGeminiForEdit(
                selectedTextForPrompt,
                promptInput,
                language
            );

            // 1. Apply the edit to the internal model
            editor.executeEdits('gemini-ai-edit', [{
                range: selectionRange,
                text: modifiedCode,
                forceMoveMarkers: true
            }]);

            // 2. Read the *full* updated content back from the model
            const fullNewContent = editor.getModel().getValue();

            // 3. Update React state ONLY IF the content actually changed
            if (editorContent !== fullNewContent) {
                setEditorContent(fullNewContent);
                setIsDirty(fullNewContent !== fileContent); // Compare with original

                // 4. FORCE REFRESH: Reset the model value *after* state update cycle
                setTimeout(() => {
                    // Check if editor and model still exist (component might unmount quickly)
                    if (editorRef.current && editorRef.current.getModel()) {
                         // Check if model value differs from state (optional safety)
                         if (editorRef.current.getModel().getValue() !== fullNewContent) {
                            console.log("Forcing editor model value reset."); // Debug log
                            editorRef.current.getModel().setValue(fullNewContent);
                         }
                    }
                }, 0); // setTimeout 0 pushes execution to the end of the event loop queue

            } else {
                 // Content didn't change after edit/readback (maybe Gemini returned identical code)
                 // Still close the prompt if it was just an identical return
                 console.log("Model value matches current state after edit, skipping state update.");
            }

            handleClosePromptInput(); // Close prompt on success

        } catch (error) {
            console.error("Gemini edit failed:", error);
            setGeminiError(error.message || "An unknown error occurred during AI edit.");
            // Do not close prompt on error
        } finally {
            setIsGeminiLoading(false);
        }
    }, [
        promptInput,
        selectionRange,
        selectedTextForPrompt,
        language,
        handleClosePromptInput,
        fileContent, // Original content for dirty check
        editorContent, // Current state content for comparison
        isApiKeyMissing
    ]);
    // --- END UPDATED handlePromptSubmit ---

    const handleEditorDidMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
            handleSaveClick();
        });

        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, () => {
             handleOpenPromptInput();
        });

        editor.focus();
    }, [handleSaveClick, handleOpenPromptInput]); // Keep dependencies


    return (
        <>
            <div className="flex flex-1 flex-col bg-white dark:bg-gray-900 overflow-hidden">
                 <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0 min-h-[41px] space-x-2">
                    {selectedFile ? (
                        <>
                            <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
                                <FiCode className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={16} aria-hidden="true" />
                                <span
                                    className={`text-sm font-medium text-gray-800 dark:text-gray-200 truncate ${isDirty ? 'italic' : ''}`}
                                    title={filePath}
                                >
                                    {fileName}
                                    {isDirty && !isCommitting ? '*' : ''}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
                                    ({filePath})
                                </span>

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
                                {isApiKeyMissing && !isPromptInputOpen && <FiAlertCircle title="Gemini API key missing or invalid!" className="text-orange-500 dark:text-orange-400 flex-shrink-0 ml-2" size={16} />}
                            </div>

                            <div className="flex items-center flex-shrink-0 space-x-1">
                                {isDirty && !isCommitting && (
                                    <button
                                        onClick={handleSaveClick}
                                        title="Save changes (Commit to GitHub)"
                                        aria-label="Save changes"
                                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                        disabled={!isDirty || isCommitting || isGeminiLoading || isPromptInputOpen}
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
                        <span className="text-sm text-gray-500 dark:text-gray-400 px-2 [.dark_&]:text-white">
                            Select a file to view its content.
                        </span>
                    )}
                </div>

                <div ref={editorContainerRef} className="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-800">
                     {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-gray-900/30 z-10">
                            <div className="flex flex-col items-center p-4 rounded bg-gray-200/80 dark:bg-gray-700/80 shadow">
                                <FiLoader className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={24} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Loading content...</span>
                            </div>
                        </div>
                    )}
                     {fileError && !isLoading && (
                        <div className="m-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm flex items-start space-x-2 break-words">
                            <FiAlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <span>Error loading file: {fileError}</span>
                        </div>
                    )}
                     {!selectedFile && !isLoading && !fileError && (
                        <div className="[.dark_&]:text-white [.dark_&]:bg-gray-800 flex flex-1 flex-col items-center justify-center h-full p-6 text-gray-500 dark:text-gray-400">
                            <FiCode size={48} className="mb-4 opacity-50" />
                            <p>Select a file from the list on the left to edit.</p>
                        </div>
                    )}

                    {selectedFile && !fileError && (
                        <Editor
                            key={filePath}
                            height="100%"
                            language={language}
                            theme={editorTheme}
                            value={editorContent}
                            options={editorOptions}
                            onChange={handleEditorChange}
                            onMount={handleEditorDidMount}
                            loading={
                               <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                   <FiLoader className="animate-spin text-blue-500 mr-2" size={20} />
                                   Loading Editor...
                               </div>
                            }
                        />
                    )}

                    <PromptInput
                        isOpen={isPromptInputOpen}
                        onClose={handleClosePromptInput}
                        onSubmit={handlePromptSubmit}
                        prompt={promptInput}
                        setPrompt={setPromptInput}
                        isLoading={isGeminiLoading}
                        error={geminiError}
                        position={promptPosition}
                    />

                     {isGeminiLoading && !isPromptInputOpen && (
                         <div className="absolute bottom-4 right-4 flex items-center p-2 rounded bg-white/80 dark:bg-gray-800/80 shadow-md border border-gray-300 dark:border-gray-600 z-20">
                             <FiLoader className="animate-spin text-purple-600 dark:text-purple-400 mr-2" size={16} />
                             <span className="text-sm text-gray-700 dark:text-gray-300">AI Processing...</span>
                         </div>
                     )}
                </div>
            </div>
        </>
    );
};

export default CodeDisplay;