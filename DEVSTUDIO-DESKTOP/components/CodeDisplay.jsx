'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { FiLoader, FiAlertCircle, FiCode, FiX, FiSave, FiCheckCircle } from 'react-icons/fi';

// Helper function to map file extensions to Monaco language identifiers
const getLanguageForMonaco = (filename) => {
    if (!filename) return 'plaintext';
    const extension = filename.split('.').pop()?.toLowerCase();
    // Map common extensions (add more as needed)
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
        case 'sh': case 'bash': return 'shell'; // Monaco uses 'shell'
        case 'sql': return 'sql';
        case 'xml': return 'xml';
        case 'dockerfile': return 'dockerfile';
        default: return 'plaintext';
    }
};

// --- Component ---
const CodeDisplay = ({
    selectedFile,
    fileContent, // Original content from parent (page.js)
    onClearFile, // Function from parent to close/clear the file view
    isLoading, // Boolean: Is the file content currently being loaded?
    error: fileError, // String: Error message from file loading, or null
    // --- Commit Props (Managed by parent hook, passed down) ---
    onSave, // Function in parent to call to INITIATE the save process (opens CommitModal)
    isCommitting, // Boolean: Is a commit API call currently in progress?
    commitError, // String: Any error message from the last commit attempt
    commitSuccess, // Boolean: Was the last commit attempt successful?
    clearCommitError // Function in parent to clear the commit error state
}) => {

    // Memoize file details to avoid unnecessary recalculations
    const fileName = useMemo(() => selectedFile?.name, [selectedFile?.name]);
    const filePath = useMemo(() => selectedFile?.path, [selectedFile?.path]);
    const language = useMemo(() => getLanguageForMonaco(fileName), [fileName]);

    // Local state for the editor's current text content
    const [editorContent, setEditorContent] = useState('');
    // Local state to track if the editor content differs from the original `fileContent` prop
    const [isDirty, setIsDirty] = useState(false);

    // State for detecting dark mode preference
    const [isDarkMode, setIsDarkMode] = useState(false);
    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', checkDarkMode);
        // Optional: Observer for direct class changes on <html>
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => {
            mediaQuery.removeEventListener('change', checkDarkMode);
            observer.disconnect();
        };
    }, []);

    // Effect to synchronize the editor content when the `fileContent` prop changes
    // (e.g., when a new file is loaded, or after a successful save updates the prop)
    // Also resets the 'isDirty' flag when external content is loaded.
    useEffect(() => {
        // console.log("CodeDisplay: fileContent prop effect running.", { fileContentProvided: fileContent !== null, currentEditorContent: editorContent });
        if (fileContent !== null && fileContent !== undefined) {
            // Only update the editor if the incoming content is different from what's already there
            // This prevents overwriting user edits if the parent re-renders but the content hasn't actually changed
            if (fileContent !== editorContent) {
                 // console.log("CodeDisplay: Updating editorContent from prop.");
                 setEditorContent(fileContent);
                 // Explicitly reset dirty flag because external content has arrived
                 setIsDirty(false);
            }
        } else if (selectedFile) {
            // File selected, but content is null/undefined (likely during initial load)
            setEditorContent(''); // Clear editor
            setIsDirty(false);
        } else {
            // No file selected at all
            setEditorContent('');
            setIsDirty(false);
        }
        // Dependencies: Re-run when the actual file content changes, or the selected file's path/sha changes
        // Removing editorContent from deps prevents loops where setting state triggers the effect again.
    }, [fileContent, selectedFile?.path, selectedFile?.sha]);

    // Handler for when the user types in the Monaco editor
    const handleEditorChange = useCallback((value) => {
        const currentVal = value ?? '';
        setEditorContent(currentVal);

        // Mark as dirty ONLY if the current editor value is different from the ORIGINAL fetched content (`fileContent` prop)
        // Also, don't mark as dirty immediately after a success or while committing.
        if (!commitSuccess && !isCommitting) {
             setIsDirty(currentVal !== fileContent);
        }

        // Clear any lingering commit status/error messages if the user starts typing again
        if (commitError) clearCommitError?.();
        // Note: commitSuccess has a timeout in the hook/parent, but modifying also clears its visual indicator implicitly via isDirty state change

    }, [fileContent, commitError, clearCommitError, commitSuccess, isCommitting]); // Dependencies

    // Handler for the SAVE button click in the header
    // This calls the `onSave` prop passed from `page.js`, initiating the commit process (opening the modal)
    const handleSaveClick = useCallback(() => {
        // Prevent initiating save if not dirty, already committing, or no file selected
        if (!isDirty || isCommitting || !selectedFile) {
            console.log("CodeDisplay: Save initiation prevented.", { isDirty, isCommitting, hasFile: !!selectedFile });
            return;
        }
        console.log(`CodeDisplay: Save button clicked for ${selectedFile.path}. Calling onSave prop.`);
        // Pass the full selectedFile object (containing path, sha, etc.) and the current editor content
        onSave?.(selectedFile, editorContent);
    }, [onSave, selectedFile, editorContent, isDirty, isCommitting]); // Dependencies

    // Configuration options for the Monaco Editor instance
    const editorOptions = useMemo(() => ({
        readOnly: isCommitting || isLoading || !!fileError, // Editor is read-only during API calls or file load errors
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: 'off', // 'on' or 'off' based on preference
        lineNumbers: 'on',
        automaticLayout: true, // Adjusts editor layout on container resize
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: 'gutter',
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
        },
    }), [isCommitting, isLoading, fileError]); // Recompute if these states change

    // Determine the Monaco theme based on dark mode state
    const editorTheme = isDarkMode ? 'vs-dark' : 'vs';

    // --- JSX Rendering ---
    return (
        <div className="flex flex-1 flex-col bg-white dark:bg-gray-900 overflow-hidden">
            {/* Header Area: Displays file info, status indicators, and action buttons */}
            <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0 min-h-[41px] space-x-2">
                {selectedFile ? (
                    <>
                        {/* Left side: File Icon, Name, Path, Status Indicators */}
                        <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
                             <FiCode className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={16} aria-hidden="true" />
                             <span
                                 className={`text-sm font-medium text-gray-800 dark:text-gray-200 truncate ${isDirty ? 'italic' : ''}`}
                                 title={filePath} // Show full path on hover
                             >
                                 {fileName}
                                 {isDirty && !isCommitting ? '*' : ''} {/* Asterisk indicates unsaved changes */}
                             </span>
                             <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
                                 ({filePath})
                             </span>

                             {/* Status Icons (Loading, Committing, Success, Error) */}
                             {isLoading && <FiLoader title="Loading file content..." className="animate-spin text-blue-500 dark:text-blue-400 flex-shrink-0 ml-2" size={16} />}
                             {isCommitting && <FiLoader title="Commit in progress..." className="animate-spin text-green-500 dark:text-green-400 flex-shrink-0 ml-2" size={16} />}
                             {commitSuccess && !isCommitting && <FiCheckCircle title="Commit successful!" className="text-green-500 dark:text-green-400 flex-shrink-0 ml-2" size={16} />}
                             {fileError && !isLoading && <FiAlertCircle title={`File loading error: ${fileError}`} className="text-red-500 dark:text-red-400 flex-shrink-0 ml-2" size={16} />}
                             {commitError && !isCommitting && (
                                 <div className="flex items-center ml-2 space-x-1" title={`Commit error: ${commitError}`}>
                                     <FiAlertCircle className="text-red-500 dark:text-red-400 flex-shrink-0" size={16} />
                                     {/* Optional: Button to clear commit error manually from header */}
                                     <button
                                         onClick={clearCommitError}
                                         className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                                         aria-label="Dismiss commit error"
                                     >
                                         <FiX size={12} className="text-red-600 dark:text-red-300" />
                                     </button>
                                 </div>
                             )}
                        </div>

                        {/* Right side: Action Buttons (Save, Close) */}
                        <div className="flex items-center flex-shrink-0 space-x-1">
                            {/* Show Save button only if dirty and not currently committing */}
                            {isDirty && !isCommitting && (
                                <button
                                    onClick={handleSaveClick} // Trigger the save initiation process
                                    title="Save changes (Commit to GitHub)"
                                    aria-label="Save changes"
                                    className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                    disabled={!isDirty || isCommitting} // Disable if not dirty or already committing
                                >
                                    <FiSave size={16} />
                                </button>
                            )}
                            {/* Close button */}
                            <button
                                onClick={onClearFile} // Call parent's clear function
                                title="Close file view"
                                aria-label="Close file view"
                                className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                disabled={isCommitting} // Prevent closing during commit operation
                            >
                                <FiX size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    // Placeholder text when no file is selected
                     <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
                         Select a file to view its content.
                     </span>
                 )}
            </div> {/* End Header Area */}

            {/* Content Area: Monaco Editor or placeholders */}
            <div className="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-800"> {/* Editor container */}
                 {/* File Loading Overlay */}
                 {isLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
                         <div className="flex flex-col items-center p-4 rounded bg-gray-200/80 dark:bg-gray-700/80 shadow">
                             <FiLoader className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={24} />
                             <span className="text-sm text-gray-700 dark:text-gray-300">Loading content...</span>
                         </div>
                     </div>
                 )}

                 {/* File Load Error Message Display */}
                 {fileError && !isLoading && (
                     <div className="m-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm flex items-start space-x-2 break-words">
                         <FiAlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                         <span>Error loading file: {fileError}</span>
                     </div>
                 )}

                 {/* Placeholder when no file is selected */}
                 {!selectedFile && !isLoading && !fileError && (
                     <div className="flex flex-1 flex-col items-center justify-center h-full p-6 text-gray-500 dark:text-gray-400">
                         <FiCode size={48} className="mb-4 opacity-50" />
                         <p>Select a file from the list on the left to edit.</p>
                     </div>
                 )}

                 {/* Monaco Editor Instance: Rendered only if a file is selected and there's no load error */}
                 {selectedFile && !fileError && (
                    <Editor
                        // Using filePath as key forces Monaco to re-initialize completely when the file changes,
                        // ensuring correct state and undo history for the new file.
                        key={filePath}
                        height="100%" // Essential for the editor to fill its container
                        language={language}
                        theme={editorTheme}
                        value={editorContent} // Bind editor value to local state
                        options={editorOptions} // Pass editor configuration
                        onChange={handleEditorChange} // Update local state on user input
                        onMount={(editor, monaco) => {
                            // You can store the editor instance if needed: editorRef.current = editor
                             // Add Ctrl+S / Cmd+S keyboard shortcut to trigger the save initiation
                             editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                                handleSaveClick(); // Call the same handler as the save button
                             });
                            // Focus the editor when it mounts
                            editor.focus();
                        }}
                        // Display a loading indicator specifically for Monaco itself loading its resources
                        loading={
                           <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                               <FiLoader className="animate-spin text-blue-500 mr-2" size={20} />
                               Loading Editor...
                           </div>
                        }
                    />
                 )}
            </div> {/* End Content Area */}
        </div> // End Component Root Div
    );
};

export default CodeDisplay;