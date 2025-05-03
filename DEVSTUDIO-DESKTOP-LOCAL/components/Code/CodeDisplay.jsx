'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FiLoader, FiAlertCircle, FiCode, FiX, FiCircle } from 'react-icons/fi';
import { callGeminiForEdit } from '../../hooks/geminiUtils';
import Terminal from './Terminal';

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
        case 'gitignore': return 'gitignore';
        case 'env': return 'ini';
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

const CodeDisplayInternal = ({
    openFiles = [],
    activeFilePath,
    fileStates = {},
    currentFileState,
    onTabSelect,
    onCloseTab,
    onContentChange,
    onSaveFile,
    isLoading: isFileLoading,
    loadError,
}) => {

    const monaco = useMonaco();
    const editorRef = useRef(null);
    const tabsContainerRef = useRef(null);

    const latestProps = useRef({ onSaveFile, activeFilePath });
    useEffect(() => {
        latestProps.current = { onSaveFile, activeFilePath };
    }, [onSaveFile, activeFilePath]);

    const editorContent = currentFileState?.content ?? '';
    const activeFileName = useMemo(() => openFiles.find(f => f.path === activeFilePath)?.name, [openFiles, activeFilePath]);
    const language = useMemo(() => getLanguageForMonaco(activeFileName), [activeFileName]);

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

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_GEMINI_API;
        setIsApiKeyMissing(!key || key === 'YOUR_GEMINI_API_KEY' || key.trim() === '');
     }, []);
    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', checkDarkMode);
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => { mediaQuery.removeEventListener('change', checkDarkMode); observer.disconnect(); };
     }, []);
    useEffect(() => {
        if (activeFilePath && tabsContainerRef.current) {
            const activeTabElement = tabsContainerRef.current.querySelector(`[data-path="${CSS.escape(activeFilePath)}"]`);
            activeTabElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
     }, [activeFilePath, openFiles]);


    const handleEditorChange = useCallback((value) => {
        if (latestProps.current.activeFilePath) {
            onContentChange(latestProps.current.activeFilePath, value ?? '');
        }
        if (geminiError) setGeminiError(null);
    }, [onContentChange, geminiError]);

    const editorOptions = useMemo(() => ({
        readOnly: !activeFilePath || isFileLoading || !!loadError || isGeminiLoading || isPromptInputOpen,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: 'off',
        lineNumbers: 'on',
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: 'gutter',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    }), [activeFilePath, isFileLoading, loadError, isGeminiLoading, isPromptInputOpen]);
    const editorTheme = isDarkMode ? 'vs-dark' : 'vs';

    const handleOpenPromptInput = useCallback(() => {
        if (isApiKeyMissing) {
             setGeminiError("Gemini API key is missing or invalid. Please configure NEXT_PUBLIC_GEMINI_API in your environment.");
             setPromptPosition({ top: 20, left: 20 });
             setIsPromptInputOpen(true);
             return;
         }
        if (!editorRef.current || !monaco) return;

        const editor = editorRef.current;
        const selection = editor.getSelection();

        if (!selection || selection.isEmpty()) return;

        const selectedText = editor.getModel().getValueInRange(selection);
        setSelectedTextForPrompt(selectedText);
        setSelectionRange(selection);
        setPromptInput('');
        setGeminiError(null);

        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;
        const editorLayout = editor.getLayoutInfo();
        const contentWidgetPosition = editor.getScrolledVisiblePosition({ lineNumber: startLineNumber, column: startColumn });

        if (!contentWidgetPosition || !editorLayout) return;

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

    }, [monaco, isApiKeyMissing]);

    const handleClosePromptInput = useCallback(() => {
        setIsPromptInputOpen(false);
        if (!geminiError) setPromptInput('');
        setSelectedTextForPrompt('');
        setSelectionRange(null);
        setPromptPosition(null);
        if (editorRef.current && !geminiError) {
             setTimeout(() => editorRef.current?.focus(), 0);
        }
    }, [geminiError]);

    const handlePromptSubmit = useCallback(async () => {
        const currentActiveFilePath = latestProps.current.activeFilePath;
        if (isApiKeyMissing || !promptInput || !selectionRange || !currentActiveFilePath) return;

        const editor = editorRef.current;
        if (!editor || !editor.getModel()) { setGeminiError("Editor is not ready."); return; }

        setIsGeminiLoading(true);
        setGeminiError(null);
        try {
            const selectedText = editor.getModel().getValueInRange(selectionRange);
            const modifiedCode = await callGeminiForEdit(selectedText, promptInput, language);

            const currentFullContent = editor.getModel().getValue();
            const model = editor.getModel();
            const startOffset = model.getOffsetAt(selectionRange.getStartPosition());
            const endOffset = model.getOffsetAt(selectionRange.getEndPosition());
            const newFullContent = currentFullContent.substring(0, startOffset) + modifiedCode + currentFullContent.substring(endOffset);

            onContentChange(currentActiveFilePath, newFullContent);
            handleClosePromptInput();
        } catch (error) {
            console.error("Gemini edit failed:", error);
            const message = error instanceof Error ? error.message : "Unknown AI edit error.";
            setGeminiError(message);
        } finally {
            setIsGeminiLoading(false);
            if (!geminiError && editorRef.current) {
                 setTimeout(() => editorRef.current?.focus(), 0);
            }
        }
     }, [ promptInput, selectionRange, language, isApiKeyMissing, handleClosePromptInput, onContentChange, geminiError]);

    const handleOpenTerminal = useCallback(() => { setIsTerminalOpen(prev => !prev); }, []);

    const handleEditorDidMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;

        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
            const currentContent = editorRef.current?.getModel()?.getValue();
            const path = latestProps.current.activeFilePath;
            const saveHandler = latestProps.current.onSaveFile;

            if (path && currentContent !== undefined && typeof saveHandler === 'function') {
                saveHandler(path, currentContent);
            } else {
                console.warn("Save aborted: Missing path, content, or save handler.");
            }
        });

        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, handleOpenPromptInput);
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyJ, handleOpenTerminal);

        if (!isFileLoading && !loadError && latestProps.current.activeFilePath) {
             editor.focus();
        }
    }, [handleOpenPromptInput, handleOpenTerminal, isFileLoading, loadError]);


    const showEditor = activeFilePath && !isFileLoading && !loadError;
    const showNoFilesOpen = openFiles.length === 0 && !activeFilePath;
    const showLoading = isFileLoading && activeFilePath;
    const showError = loadError && activeFilePath;

    return (
        <div className="flex flex-1 flex-col bg-white dark:bg-gray-900 overflow-hidden">
             <div
                ref={tabsContainerRef}
                className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex-shrink-0 h-[36px] overflow-x-auto overflow-y-hidden no-scrollbar"
                role="tablist"
             >
                {openFiles.map(file => {
                    const isActive = file.path === activeFilePath;
                    const state = fileStates[file.path] || {};
                    const isDirty = state.isDirty ?? false;
                    const fileLoadError = state.error ?? null;
                    const isLoadingThisTab = state.isLoading ?? false;

                    return (
                        <div
                            key={file.path}
                            data-path={file.path}
                            onClick={() => onTabSelect(file.path)}
                            title={`${file.path}${isDirty ? ' (unsaved)' : ''}${fileLoadError ? ` (Error: ${fileLoadError})`: ''}`}
                            className={`flex items-center justify-between h-full px-3 py-1 border-r border-gray-200 dark:border-gray-700 cursor-pointer text-sm whitespace-nowrap group ${
                                isActive
                                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-500 relative top-[-1px]'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            } ${fileLoadError ? 'text-red-600 dark:text-red-400' : ''}`}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls="editor-panel"
                        >
                             {isLoadingThisTab ? (
                                 <FiLoader className="animate-spin mr-1.5 flex-shrink-0" size={14} />
                             ) : fileLoadError ? (
                                 <FiAlertCircle className="mr-1.5 flex-shrink-0 text-red-500" size={14} />
                             ) : (
                                 <FiCode className="mr-1.5 flex-shrink-0" size={14} />
                             )}

                            <span className="truncate max-w-[150px]">{file.name}</span>

                            <button
                                onClick={(e) => { e.stopPropagation(); onCloseTab(file.path); }}
                                title={isDirty ? "Close (unsaved changes)" : "Close"}
                                className={`ml-2 p-0.5 rounded flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 w-[16px] h-[16px] ${
                                    isActive ? '' : 'opacity-0 group-hover:opacity-100'
                                } transition-opacity duration-100`}
                                aria-label={`Close ${file.name}`}
                            >
                                {isDirty ? <FiCircle size={10} className="fill-current" /> : <FiX size={14} />}
                            </button>
                        </div>
                    );
                })}
             </div>

             <div id="editor-panel" role="tabpanel" className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-[#1e1e1e]">
                 {showLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10 backdrop-blur-sm">
                        <div className="flex flex-col items-center p-4 rounded bg-gray-200/90 dark:bg-gray-700/90 shadow-md">
                            <FiLoader className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={24} />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Loading {activeFileName}...</span>
                        </div>
                    </div>
                )}
                 {showError && !showLoading && (
                    <div className="m-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm flex items-start space-x-2 break-words z-10 relative">
                        <FiAlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                        <span>{loadError}</span>
                    </div>
                )}
                 {showNoFilesOpen && (
                    <div className="flex flex-1 flex-col items-center justify-center h-full p-6 text-gray-500 dark:text-gray-400">
                        <img src="logo.svg" alt="No file selected" className="w-16 h-16 mb-4 opacity-50" />
                        <p>Select a file from the list on the left to open it.</p>
                         <p className="text-xs mt-2">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+S</kbd> to save changes)</p>
                         <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+K</kbd> to edit with AI)</p>
                         <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">Cmd/Ctrl+J</kbd> to toggle Terminal)</p>
                    </div>
                )}

                {showEditor && (
                    <Editor
                        height="100%"
                        language={language}
                        theme={editorTheme}
                        value={editorContent}
                        options={editorOptions}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        loading={
                           <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                               <FiLoader className="animate-spin text-blue-500 mr-2" size={20} /> Initializing Editor...
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
            </div>

             {isTerminalOpen && (
                 <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 h-48 md:h-64">
                     <Terminal />
                 </div>
             )}
        </div>
    );
};

export default memo(CodeDisplayInternal);