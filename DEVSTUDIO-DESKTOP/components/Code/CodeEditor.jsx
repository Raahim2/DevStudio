'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { FiLoader, FiAlertCircle, FiCode, FiX, FiCircle, FiImage, FiTerminal, FiPlay } from 'react-icons/fi';
import { callGeminiForEdit } from '../../hooks/geminiUtils';
import dynamic from 'next/dynamic';
import ImageEditor from './ImageEditor';

const TerminalComponent = dynamic(() => import('./Terminal'), {
    ssr: false,
});

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'avif', 'tiff' , 'pdf' ];
const isImageFile = (filename) => {
    if (!filename) return false;
    const extension = filename.split('.').pop()?.toLowerCase();
    return IMAGE_EXTENSIONS.includes(extension ?? '');
};

const getLanguageForMonaco = (filename) => {
    if (!filename || isImageFile(filename)) return 'plaintext';
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

const getRunCommand = (filePath, fileName, rootDir) => {
    if (!fileName || !filePath || !rootDir) return null;
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    let relativePath = filePath;
    if (filePath.startsWith(rootDir)) {
        relativePath = filePath.substring(rootDir.length).replace(/^[\/\\]+/, '');
    }
    
    const quotedRelativePath = `"${relativePath}"`;

    switch (extension) {
        case 'py':
            return `python ${quotedRelativePath}`;
        case 'js':
            return `node ${quotedRelativePath}`;
        case 'ts':
            return `npx ts-node ${quotedRelativePath}`;
        case 'java':
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            const dirOfFile = relativePath.substring(0, relativePath.lastIndexOf('/') > -1 ? relativePath.lastIndexOf('/') : 0 );
            const compileCommand = `javac ${quotedRelativePath}`;
            const runCommand = `java -cp "${dirOfFile === '' ? '.' : dirOfFile}" ${baseName}`; 
            return `${compileCommand} && ${runCommand}`; 
        case 'go':
            return `go run ${quotedRelativePath}`;
        case 'rb':
            return `ruby ${quotedRelativePath}`;
        case 'php':
            return `php ${quotedRelativePath}`;
        case 'sh': case 'bash':
            return `bash ${quotedRelativePath}`;
        default:
            return null;
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
            className="absolute z-30 bg-white [.dark_&]:bg-neutral-800 rounded-md shadow-lg border border-neutral-300 [.dark_&]:border-neutral-600 w-full max-w-lg p-3"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
            onClick={(e) => e.stopPropagation()}
        >
            {error && (
                <div className="mb-2 p-1.5 bg-red-100 [.dark_&]:bg-red-900/50 border border-red-300 [.dark_&]:border-red-600 rounded-md text-red-700 [.dark_&]:text-red-300 text-xs flex items-center space-x-1.5">
                    <FiAlertCircle size={14} className="flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 border border-neutral-300 [.dark_&]:border-neutral-500 rounded bg-white [.dark_&]:bg-neutral-700 text-neutral-900 [.dark_&]:text-neutral-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                rows="2"
                placeholder="Describe how to change the selection (Enter to submit, Esc to cancel)"
                disabled={isLoading}
            />
            <div className="mt-2 flex justify-end space-x-2">
                <button
                    onClick={onClose}
                    className="px-3 py-1 text-xs rounded bg-neutral-200 [.dark_&]:bg-neutral-600 text-neutral-700 [.dark_&]:text-neutral-200 hover:bg-neutral-300 [.dark_&]:hover:bg-neutral-500 disabled:opacity-50"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    className={`px-3 py-1 text-xs rounded flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                        isLoading
                            ? 'bg-neutral-400 [.dark_&]:bg-neutral-500 text-white [.dark_&]:text-neutral-300'
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
PromptInput.displayName = 'PromptInput';

const CodeEditor = ({
    openFiles = [],
    activeFilePath,
    fileStates = {},
    onTabSelect,
    onCloseTab,
    onContentChange,
    onSaveFile,
    isLoading: isGlobalFileLoading,
    loadError: globalLoadError,
    rootDir
}) => {
    const monaco = useMonaco();
    const editorRef = useRef(null);
    const tabsContainerRef = useRef(null);

    const latestProps = useRef({ onSaveFile, activeFilePath, onContentChange });
    useEffect(() => {
        latestProps.current = { onSaveFile, activeFilePath, onContentChange };
    }, [onSaveFile, activeFilePath, onContentChange]);

    const activeFile = useMemo(() => openFiles.find(f => f.path === activeFilePath), [openFiles, activeFilePath]);
    const activeFileName = activeFile?.name;
    const activeFileIsImage = useMemo(() => isImageFile(activeFileName), [activeFileName]);

    const editorContent = useMemo(() => {
        if (activeFilePath && fileStates[activeFilePath] && !activeFileIsImage) {
            return fileStates[activeFilePath].content ?? '';
        }
        return '';
    }, [activeFilePath, fileStates, activeFileIsImage]);

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
    const [runnableCommand, setRunnableCommand] = useState(null);
    const [fontSize, setFontSize] = useState(16); // Initial font size

    useEffect(() => {
        if (activeFile && activeFile.path && activeFile.name && rootDir) {
            setRunnableCommand(getRunCommand(activeFile.path, activeFile.name, rootDir));
        } else {
            setRunnableCommand(null);
        }
    }, [activeFile, rootDir]);

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_GEMINI_API;
        setIsApiKeyMissing(!key || key === 'YOUR_GEMINI_API_KEY' || key.trim() === '');
    }, []);

    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => checkDarkMode();
        mediaQuery.addEventListener('change', handleChange);
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (activeFilePath && tabsContainerRef.current) {
            const activeTabElement = tabsContainerRef.current.querySelector(`[data-path="${CSS.escape(activeFilePath)}"]`);
            activeTabElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeFilePath, openFiles]);

    const handleEditorChange = useCallback((value) => {
        if (latestProps.current.activeFilePath && !isImageFile(activeFile?.name)) {
            latestProps.current.onContentChange(latestProps.current.activeFilePath, value ?? '');
        }
        if (geminiError) setGeminiError(null);
    }, [activeFile?.name, geminiError]);

    const editorOptions = useMemo(() => ({
        readOnly: !activeFilePath || !!isGlobalFileLoading || !!globalLoadError || isGeminiLoading || isPromptInputOpen || activeFileIsImage,
        minimap: { enabled: !activeFileIsImage },
        scrollBeyondLastLine: false, 
        fontSize: fontSize, // Controlled by React state
        wordWrap: 'off',
        lineNumbers: activeFileIsImage ? 'off' : 'on',
        automaticLayout: true, tabSize: 4, insertSpaces: true,
        renderLineHighlight: activeFileIsImage ? 'none' : 'gutter',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        glyphMargin: !activeFileIsImage, folding: !activeFileIsImage,
        lineDecorationsWidth: !activeFileIsImage ? 10 : 0,
        lineNumbersMinChars: !activeFileIsImage ? 5 : 0,
    }), [activeFilePath, isGlobalFileLoading, globalLoadError, isGeminiLoading, isPromptInputOpen, activeFileIsImage, fontSize]); // Added fontSize to dependency array

    const editorTheme = isDarkMode ? 'vs-dark' : 'vs';

    const handleOpenPromptInput = useCallback(() => {
        if (activeFileIsImage) return;
        if (isApiKeyMissing) {
             setGeminiError("Gemini API key is missing. Configure NEXT_PUBLIC_GEMINI_API.");
             setPromptPosition({ top: 20, left: 20 }); 
             setIsPromptInputOpen(true); return;
        }
        if (!editorRef.current || !monaco) return;
        const editor = editorRef.current;
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
            setGeminiError("Please select text to use AI edit."); return;
        }
        const selectedText = editor.getModel().getValueInRange(selection);
        setSelectedTextForPrompt(selectedText);
        setSelectionRange(selection);
        setPromptInput('');
        setGeminiError(null);
        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;
        const editorLayout = editor.getLayoutInfo();
        const contentWidgetPosition = editor.getScrolledVisiblePosition?.({ lineNumber: startLineNumber, column: startColumn });
        if (!contentWidgetPosition || !editorLayout) {
            setPromptPosition({ top: (editorLayout?.height || window.innerHeight) / 2 - 50, left: (editorLayout?.width || window.innerWidth) / 2 - 250 });
            setIsPromptInputOpen(true); return;
        }
        const estimatedLineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        let top = contentWidgetPosition.top + estimatedLineHeight;
        let left = contentWidgetPosition.left;
        const promptWidthEstimate = 500; const promptHeightEstimate = 100;
        if (left + promptWidthEstimate > editorLayout.width - 20) left = Math.max(10, editorLayout.width - promptWidthEstimate - 20);
        if (left < 10) left = 10;
        if (top + promptHeightEstimate > editorLayout.height - 20) top = contentWidgetPosition.top - promptHeightEstimate - 5;
        if (top < 10) top = 10;
        setPromptPosition({ top, left });
        setIsPromptInputOpen(true);
    }, [monaco, isApiKeyMissing, activeFileIsImage]);

    const handleClosePromptInput = useCallback(() => {
        setIsPromptInputOpen(false);
        if (!geminiError) setPromptInput('');
        setPromptPosition(null);
        if (editorRef.current && !geminiError && !activeFileIsImage) {
             setTimeout(() => editorRef.current?.focus(), 0);
        }
    }, [geminiError, activeFileIsImage]);

    const handlePromptSubmit = useCallback(async () => {
        const currentActiveFilePath = latestProps.current.activeFilePath;
        if (activeFileIsImage || isApiKeyMissing || !promptInput || !selectionRange || !currentActiveFilePath) return;
        const editor = editorRef.current;
        if (!editor || !editor.getModel()) { setGeminiError("Editor not ready."); return; }
        setIsGeminiLoading(true); setGeminiError(null);
        try {
            const selectedText = editor.getModel().getValueInRange(selectionRange);
            const modifiedCode = await callGeminiForEdit(selectedText, promptInput, language);
            const currentFullContent = editor.getModel().getValue();
            const model = editor.getModel();
            const startOffset = model.getOffsetAt(selectionRange.getStartPosition());
            const endOffset = model.getOffsetAt(selectionRange.getEndPosition());
            const newFullContent = currentFullContent.substring(0, startOffset) + modifiedCode + currentFullContent.substring(endOffset);
            latestProps.current.onContentChange(currentActiveFilePath, newFullContent);
            handleClosePromptInput();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown AI edit error.";
            setGeminiError(message);
        } finally {
            setIsGeminiLoading(false);
            if (!geminiError && editorRef.current && !activeFileIsImage) {
                 setTimeout(() => editorRef.current?.focus(), 0);
            }
        }
     }, [promptInput, selectionRange, language, isApiKeyMissing, handleClosePromptInput, activeFileIsImage, geminiError]);

    const toggleTerminal = useCallback(() => { setIsTerminalOpen(prev => !prev); }, []);

    const handleRunFile = useCallback(() => {
        if (!runnableCommand || !rootDir) {
            console.warn("Cannot run: No runnable command or rootDir."); return;
        }
        if (!window.electronAPI?.executeCommand) {
            console.error("electronAPI.executeCommand not available."); return;
        }
        if (!isTerminalOpen) setIsTerminalOpen(true);
        const delay = isTerminalOpen ? 0 : 150; 
        setTimeout(() => {
            window.electronAPI.executeCommand({ command: runnableCommand, cwd: rootDir });
        }, delay);
    }, [runnableCommand, rootDir, isTerminalOpen, setIsTerminalOpen]);

    const handleEditorDidMount = useCallback((editor, monacoInstance) => {
        editorRef.current = editor;
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
            const currentOpenFile = latestProps.current.activeFilePath ? openFiles.find(f => f.path === latestProps.current.activeFilePath) : null;
            if (currentOpenFile && isImageFile(currentOpenFile.name)) return;
            const currentContent = editorRef.current?.getModel()?.getValue();
            const path = latestProps.current.activeFilePath;
            const saveHandler = latestProps.current.onSaveFile;
            if (path && currentContent !== undefined && typeof saveHandler === 'function') {
                saveHandler(path, currentContent);
            }
        });
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, () => {
            const currentOpenFile = latestProps.current.activeFilePath ? openFiles.find(f => f.path === latestProps.current.activeFilePath) : null;
            if (currentOpenFile && !isImageFile(currentOpenFile.name)) {
                 handleOpenPromptInput();
             }
        });
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyJ, toggleTerminal);
        
        // Add font size increase command (Ctrl/Cmd + =)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Equal, () => {
            const currentEditor = editorRef.current;
            if (currentEditor && monacoInstance) { // Ensure monacoInstance is available
                const currentSize = currentEditor.getOption(monacoInstance.editor.EditorOption.fontSize);
                const newSize = Math.min(currentSize + 1, 40); // Max font size 40
                if (newSize !== currentSize) {
                    currentEditor.updateOptions({ fontSize: newSize });
                    setFontSize(newSize); // Sync React state
                }
            }
        });

        // Add font size decrease command (Ctrl/Cmd -)
        editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Minus, () => {
            const currentEditor = editorRef.current;
            if (currentEditor && monacoInstance) { // Ensure monacoInstance is available
                const currentSize = currentEditor.getOption(monacoInstance.editor.EditorOption.fontSize);
                const newSize = Math.max(currentSize - 1, 6); // Min font size 6
                if (newSize !== currentSize) {
                    currentEditor.updateOptions({ fontSize: newSize });
                    setFontSize(newSize); // Sync React state
                }
            }
        });

        // Initial focus logic
        const currentActiveFileIsImage = isImageFile(latestProps.current.activeFilePath ? openFiles.find(f => f.path === latestProps.current.activeFilePath)?.name : null);
        if (!isGlobalFileLoading && !globalLoadError && latestProps.current.activeFilePath && !currentActiveFileIsImage) {
             editor.focus();
        }
    }, [
        handleOpenPromptInput, 
        toggleTerminal, 
        isGlobalFileLoading, 
        globalLoadError, 
        openFiles, // For currentActiveFileIsImage logic
        // latestProps is a ref, its contents are accessed via .current so not needed in deps for value stability
        // setFontSize is stable from useState, not needed in deps
        // monacoInstance (from useMonaco or onMount) is also typically stable or available in scope
    ]);


    const activeFileState = activeFilePath ? fileStates[activeFilePath] : null;
    const isActiveFileLoading = activeFileState?.isLoading ?? (activeFilePath ? !!isGlobalFileLoading : false);
    const activeFileLoadError = activeFileState?.error ?? (activeFilePath ? globalLoadError : null);

    const showEditorArea = activeFilePath && !isActiveFileLoading && !activeFileLoadError;
    const showNoFilesOpen = openFiles.length === 0 && !activeFilePath;
    const showLoadingState = isActiveFileLoading && activeFilePath;
    const showErrorState = !!activeFileLoadError && activeFilePath && !isActiveFileLoading;

    // Effect for focusing editor when active file changes and is editable
    useEffect(() => {
        if (showEditorArea && !activeFileIsImage && !isPromptInputOpen && editorRef.current) {
            // A small delay can sometimes help if focus is lost immediately after content update
            setTimeout(() => editorRef.current?.focus(), 0);
        }
    }, [showEditorArea, activeFileIsImage, isPromptInputOpen, editorContent]);


    return (
        <div className="flex flex-1 flex-col bg-white [.dark_&]:bg-neutral-900 overflow-hidden">
             <div
                ref={tabsContainerRef}
                className="flex items-center justify-between border-b border-neutral-200 [.dark_&]:border-neutral-700 bg-neutral-100 [.dark_&]:bg-neutral-800 flex-shrink-0 h-[36px] no-scrollbar pr-2"
             >
                <div className="flex items-center overflow-x-auto overflow-y-hidden flex-grow no-scrollbar h-full">
                    {openFiles.map(file => {
                        const isActive = file.path === activeFilePath;
                        const state = fileStates[file.path] || {};
                        const isDirty = state.isDirty ?? false;
                        const fileLoadError = state.error ?? null;
                        const isLoadingThisTab = state.isLoading ?? false;
                        const tabIsImage = isImageFile(file.name);
                        const currentRunnableCommandForTab = getRunCommand(file.path, file.name, rootDir);


                        return (
                            <div
                                key={file.path} data-path={file.path}
                                onClick={() => onTabSelect(file.path)}
                                title={`${file.path}${isDirty && !tabIsImage ? ' (unsaved)' : ''}${fileLoadError ? ` (Error: ${fileLoadError})`: ''}`}
                                className={`flex items-center justify-between h-full px-3 py-1 border-r border-neutral-200 [.dark_&]:border-neutral-700 cursor-pointer text-sm whitespace-nowrap group ${
                                    isActive
                                    ? 'bg-white [.dark_&]:bg-neutral-900 text-blue-600 [.dark_&]:text-blue-400 border-t-2 border-t-blue-500 relative top-[-1px]'
                                    : 'bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-600 [.dark_&]:text-neutral-400 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-700'
                                } ${fileLoadError ? 'text-red-600 [.dark_&]:text-red-400' : ''}`}
                                role="tab" aria-selected={isActive} aria-controls="editor-panel"
                            >
                                {isLoadingThisTab ? ( <FiLoader className="animate-spin mr-1.5 flex-shrink-0" size={14} /> )
                                 : fileLoadError ? ( <FiAlertCircle className="mr-1.5 flex-shrink-0 text-red-500" size={14} /> )
                                 : tabIsImage ? ( <FiImage className="mr-1.5 flex-shrink-0" size={14} /> )
                                 : ( <FiCode className="mr-1.5 flex-shrink-0" size={14} /> )}
                                <span className="truncate max-w-[150px] mr-1">{file.name}</span>
                                {isActive && currentRunnableCommandForTab && ( // Use currentRunnableCommandForTab for the play button logic
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRunFile(); }}
                                        title={`Run ${file.name} (Cmd: ${currentRunnableCommandForTab})`}
                                        className="p-0.5 rounded hover:bg-green-200 [.dark_&]:hover:bg-green-700 text-green-600 [.dark_&]:text-green-400 flex-shrink-0 mx-1"
                                        aria-label={`Run ${file.name}`}
                                    > <FiPlay size={12} /> </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCloseTab(file.path); }}
                                    title={(isDirty && !tabIsImage) ? "Close (unsaved)" : "Close"}
                                    className={`p-0.5 rounded flex items-center justify-center text-neutral-500 [.dark_&]:text-neutral-400 hover:bg-neutral-300 [.dark_&]:hover:bg-neutral-600 hover:text-neutral-700 [.dark_&]:hover:text-neutral-200 flex-shrink-0 w-[16px] h-[16px] ${isActive ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                                    aria-label={`Close ${file.name}`}
                                > {(isDirty && !tabIsImage) ? <FiCircle size={10} className="fill-current" /> : <FiX size={14} />} </button>
                            </div>
                        );
                    })}
                </div>
                <div className="flex-shrink-0 ml-auto flex items-center h-full px-1">
                    <button
                        onClick={toggleTerminal}
                        title={isTerminalOpen ? "Close Terminal (Cmd+J)" : "Open Terminal (Cmd+J)"}
                        className={`p-1.5 rounded hover:bg-neutral-300 [.dark_&]:hover:bg-neutral-600 ${isTerminalOpen ? 'bg-neutral-200 [.dark_&]:bg-neutral-700' : ''}`}
                        aria-label={isTerminalOpen ? "Close Terminal" : "Open Terminal"}
                    > <FiTerminal size={16} className={isTerminalOpen ? "text-blue-500 [.dark_&]:text-blue-400" : "text-neutral-600 [.dark_&]:text-neutral-400"}/> </button>
                </div>
             </div>

             <div id="editor-panel" role="tabpanel" className="flex-1 relative overflow-hidden bg-neutral-50 [.dark_&]:bg-[#1e1e1e]">
                 {showLoadingState && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 [.dark_&]:bg-neutral-900/50 z-10 backdrop-blur-sm">
                        <div className="flex flex-col items-center p-4 rounded bg-neutral-200/90 [.dark_&]:bg-neutral-700/90 shadow-md">
                            <FiLoader className="animate-spin text-blue-600 [.dark_&]:text-blue-400 mb-2" size={24} />
                            <span className="text-sm text-neutral-700 [.dark_&]:text-neutral-300">Loading {activeFileName || 'file'}...</span>
                        </div>
                    </div>
                )}
                 {showErrorState && (
                    <div className="m-4 p-3 bg-red-100 [.dark_&]:bg-red-900/50 border border-red-300 [.dark_&]:border-red-600 rounded-md text-red-700 [.dark_&]:text-red-300 text-sm flex items-start space-x-2 break-words z-10 relative">
                        <FiAlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                        <span>Error loading {activeFileName || 'file'}: {activeFileLoadError}</span>
                    </div>
                )}
                 {showNoFilesOpen && !showLoadingState && !showErrorState && (
                    <div className="flex flex-1 flex-col items-center justify-center h-full p-6 text-neutral-500 [.dark_&]:text-neutral-400">
                        <img src="logo.svg" alt="No file selected" className="[.dark_&]:invert w-16 h-16 mb-4 opacity-50" /> {/* Assuming logo.svg is in public */}
                        <p>Select a file from the list on the left to open it.</p>
                         <p className="text-xs mt-2">(Use <kbd className="px-1 py-0.5 border [.dark_&]:border-neutral-600 rounded bg-neutral-100 [.dark_&]:bg-neutral-700">Cmd/Ctrl+S</kbd> to save)</p>
                         <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border [.dark_&]:border-neutral-600 rounded bg-neutral-100 [.dark_&]:bg-neutral-700">Cmd/Ctrl+K</kbd> for AI edit)</p>
                         <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border [.dark_&]:border-neutral-600 rounded bg-neutral-100 [.dark_&]:bg-neutral-700">Cmd/Ctrl+J</kbd> to toggle Terminal)</p>
                         <p className="text-xs mt-1">(Use <kbd className="px-1 py-0.5 border [.dark_&]:border-neutral-600 rounded bg-neutral-100 [.dark_&]:bg-neutral-700">Cmd/Ctrl +</kbd> / <kbd className="px-1 py-0.5 border [.dark_&]:border-neutral-600 rounded bg-neutral-100 [.dark_&]:bg-neutral-700">-</kbd> to zoom)</p>
                    </div>
                )}

                {showEditorArea && (
                    activeFileIsImage ? (
                        <div className="w-full h-full flex items-center justify-center p-2 bg-neutral-100 [.dark_&]:bg-neutral-800">
                            <ImageEditor initialFilePath={activeFilePath} className="max-w-full max-h-full border" /> {/* Removed border-black for theme consistency */}
                        </div>
                    ) : (
                        <Editor
                            height="100%" language={language} theme={editorTheme} value={editorContent}
                            options={editorOptions} onChange={handleEditorChange} onMount={handleEditorDidMount}
                            loading={ <div className="flex items-center justify-center h-full"><FiLoader className="animate-spin text-blue-500 mr-2" size={20} /> Initializing...</div> }
                        />
                    )
                )}
                {!activeFileIsImage && (
                    <PromptInput
                        isOpen={isPromptInputOpen} onClose={handleClosePromptInput} onSubmit={handlePromptSubmit}
                        prompt={promptInput} setPrompt={setPromptInput} isLoading={isGeminiLoading}
                        error={geminiError} position={promptPosition}
                    />
                )}
            </div>
        
            <div className={`flex-shrink-0  ${isTerminalOpen ? 'h-48 md:h-64' : 'h-0 hidden'} transition-all duration-300 ease-in-out overflow-hidden [.dark_&]:bg-[#2e2e2e] bg-neutral-100`}>
                 <TerminalComponent rootDir={rootDir} isVisible={isTerminalOpen} isDarkMode={isDarkMode}/>
            </div>
        </div>
    );
};

export default memo(CodeEditor);