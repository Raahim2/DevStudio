'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'; // Added useRef
import TabSelectorSidebar from '../../components/Main/TabSelectorSidebar';
import FileBar from '../../components/Main/FileBar';
import Topbar from '../../components/Main/Topbar';
import ChatSection from '../../components/Chat/ChatSection';
import Bottombar from '../../components/Main/Bottombar';
import HomeTabContent from '../../components/Main/HomeTabContent';
import CodeDisplay from '../../components/Code/CodeDisplay';
import AutomationTab from '../../components/Automate/Automation';
import Browser from '../../components/Browse/Browser';
import { FiX } from 'react-icons/fi';

// Import the chat hook here
import { useGeminiChat } from '../../hooks/useGeminiChat'; // Adjust path as needed

const callElectronApi = async (funcName, ...args) => {
    if (window.electronAPI && typeof window.electronAPI[funcName] === 'function') {
        try {
            return await window.electronAPI[funcName](...args);
        } catch (error) {
            console.error(`Error calling electronAPI.${funcName}:`, error);
            throw error;
        }
    } else {
        console.error(`electronAPI.${funcName} is not available.`);
        throw new Error(`File system operation (${funcName}) is not available.`);
    }
};

// Utility to escape regex special characters (can be defined here or imported)
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export default function Home() {
    const [activeTab, setActiveTab] = useState('Code');
    const [selectedFolderPath, setSelectedFolderPath] = useState(null);
    const [directoryTree, setDirectoryTree] = useState(null);
    const [isLoadingStructure, setIsLoadingStructure] = useState(false);
    const [error, setError] = useState(null);

    const [openFiles, setOpenFiles] = useState([]);
    const [activeFilePath, setActiveFilePath] = useState(null);
    const [fileStates, setFileStates] = useState({});
    const [globalFileLoadingError, setGlobalFileLoadingError] = useState(null);

    // --- Chat State Lifted Up ---
    const {
        chatHistory,
        sendMessage: sendChatMessageHook, // Rename to avoid conflict with internal function name
        isSending: isChatSending,
        error: geminiChatError,
        clearError: clearGeminiChatError,
        isApiKeyMissing: isGeminiApiKeyMissing,
        stopGenerating: stopChatGenerating,
    } = useGeminiChat();

    const [chatInputMessage, setChatInputMessage] = useState('');
    const [chatMentionedFiles, setChatMentionedFiles] = useState([]); // Array of { path, name, content }
    const [chatAllProjectFiles, setChatAllProjectFiles] = useState([]); // Store flat list for @mentions { path, name }
    // --- End of Chat State ---

    const activeFile = useMemo(() => {
        return openFiles.find(f => f.path === activeFilePath) || null;
    }, [openFiles, activeFilePath]);

    const activeFileState = useMemo(() => {
        return activeFilePath ? fileStates[activeFilePath] : null;
    }, [activeFilePath, fileStates]);

    const activeFileContent = useMemo(() => {
        return (activeFileState && !activeFileState.isLoading && !activeFileState.error)
            ? activeFileState.content
            : null;
    }, [activeFileState]);


    // --- Chat Logic Lifted Up ---

    // Flatten directory structure recursively (used for chat mentions)
    const flattenDirectoryTree = useCallback((node, currentPath = '', flatList = []) => {
        if (!node) return flatList;
        if (node.type === 'file' && node.path) {
            // Ensure name exists, derive if necessary (though structure should provide it)
            const name = node.name || (window.electronAPI?.pathBasename ? window.electronAPI.pathBasename(node.path) : node.path.split(/[\\/]/).pop());
            flatList.push({ name: name, path: node.path });
        }
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(item => {
                if (!item || !item.path) {
                    console.warn("Skipping invalid item in directory tree:", item);
                    return;
                }
                if (item.type === 'file') {
                     const name = item.name || (window.electronAPI?.pathBasename ? window.electronAPI.pathBasename(item.path) : item.path.split(/[\\/]/).pop());
                    flatList.push({ name: name, path: item.path });
                } else if (item.type === 'directory') {
                    flattenDirectoryTree(item, item.path, flatList);
                }
            });
        }
        return flatList;
    }, []);

    // Fetch and flatten file structure when folder path changes (for chat mentions)
    const fetchChatProjectFiles = useCallback(async (folderPath) => {
        if (!folderPath) {
            setChatAllProjectFiles([]);
            return;
        }
        try {
            console.log(`Chat: Fetching folder structure for mentions: ${folderPath}`);
            const structure = await callElectronApi('getFolderStructure', folderPath);
            console.log("Chat: Raw structure for mentions:", structure);
            if (structure) {
                const flatFiles = flattenDirectoryTree(structure);
                console.log("Chat: Flattened files for mentions:", flatFiles);
                setChatAllProjectFiles(flatFiles);
            } else {
                setChatAllProjectFiles([]);
                console.warn("Chat: Received null structure for mentions.");
            }
        } catch (error) {
            console.error("Chat: Failed to get folder structure for mentions:", error);
            setChatAllProjectFiles([]);
        }
    }, [flattenDirectoryTree]); // Depends on flatten function

     // Effect to fetch chat project files when folder changes
     useEffect(() => {
        if (selectedFolderPath) {
            fetchChatProjectFiles(selectedFolderPath);
        } else {
            setChatAllProjectFiles([]); // Clear if no folder
        }
    }, [selectedFolderPath, fetchChatProjectFiles]);

    const handleChatClearMentionedFiles = useCallback(() => {
        setChatMentionedFiles([]);
    }, []);

    // Handler for sending chat message (called by ChatSection)
    const handleChatSendMessage = useCallback(async (messageToSend, filesAttached) => {
        const trimmedMessage = messageToSend.trim();
        if (!trimmedMessage || isChatSending || isGeminiApiKeyMissing) return;

        let promptToSend = trimmedMessage;
        let messageForHistory = trimmedMessage; // Use the message passed in from ChatSection

        if (filesAttached.length > 0) {
            let fileContextPrefix = '';
            filesAttached.forEach(file => {
                const mentionRegex = new RegExp(`@${escapeRegex(file.name)}\\b`, 'g');
                promptToSend = promptToSend.replace(mentionRegex, file.name);
                fileContextPrefix += `File: ${file.name} (Path: ${file.path})\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
            });
            promptToSend = `${fileContextPrefix}User Query:\n${promptToSend}`;
        }

        console.log("Sending prompt to API:", promptToSend);
        sendChatMessageHook(promptToSend, messageForHistory); // Send to hook, passing original message for history

        setChatInputMessage(''); // Clear input state held here
        setChatMentionedFiles([]); // Clear mentioned files state held here

    }, [isChatSending, isGeminiApiKeyMissing, sendChatMessageHook]); // Depends on hook state/functions

    // --- End of Chat Logic ---


    // --- Existing Logic for File Handling, Folder Selection etc. ---
    const fetchDirectoryStructure = useCallback(async (folderPath) => {
         if (!folderPath) {
             setError("No folder path provided."); return;
         }
         setOpenFiles([]);
         setActiveFilePath(null);
         setFileStates({});
         setGlobalFileLoadingError(null);
         // Also clear chat mentions and project files when main dir reloads
         setChatMentionedFiles([]);
         setChatAllProjectFiles([]);


         setIsLoadingStructure(true);
         setError(null);
         try {
             const structure = await callElectronApi('getFolderStructure', folderPath);
             setDirectoryTree(structure || null);
             if (!structure) {
                 let folderName = folderPath; try { folderName = await callElectronApi('pathBasename', folderPath); } catch(e) {}
                 setError(`Could not load structure for "${folderName}". Check permissions or path.`);
             } else {
                // Fetch files for chat mentions after successfully loading main structure
                fetchChatProjectFiles(folderPath);
             }
         } catch (err) {
             setError(`Failed to load folder structure: ${err.message || 'Unknown error'}`);
             setDirectoryTree(null);
         } finally { setIsLoadingStructure(false); }
    }, [fetchChatProjectFiles]); // Add dependency

    const fetchFileContent = useCallback(async (filePath, fileName) => {
        console.log(`Fetching content for: ${filePath}`);
        setFileStates(prev => ({
            ...prev,
            [filePath]: { ...prev[filePath], isLoading: true, error: null }
        }));
        setGlobalFileLoadingError(null);

        try {
            const content = await callElectronApi('readFileContent', filePath);
            setFileStates(prev => ({
                ...prev,
                [filePath]: {
                    ...prev[filePath],
                    content: content ?? '',
                    cleanContent: content ?? '',
                    isDirty: false,
                    isLoading: false,
                    error: null,
                }
            }));
        } catch (err) {
            console.error(`Error fetching content for ${filePath}:`, err);
            const errorMsg = `Failed to load ${fileName}: ${err.message || 'Unknown error'}`;
            setFileStates(prev => ({
                ...prev,
                [filePath]: {
                    ...prev[filePath],
                    content: null,
                    cleanContent: null,
                    isDirty: false,
                    isLoading: false,
                    error: errorMsg,
                }
            }));
            setGlobalFileLoadingError(errorMsg);
        }
    }, []);

    const handleFileSelect = useCallback((file) => {
        if (!file || !file.path) return;
        setError(null);
        setGlobalFileLoadingError(null);

        const existingFile = openFiles.find(f => f.path === file.path);

        if (!existingFile) {
            setOpenFiles(prev => [...prev, file]);
            setFileStates(prev => ({
                ...prev,
                [file.path]: { content: '', cleanContent: '', isDirty: false, isLoading: true, error: null, name: file.name } // Store name here too
            }));
            fetchFileContent(file.path, file.name);
        } else {
            const currentState = fileStates[file.path];
            if (currentState?.error && !currentState.isLoading) {
                 fetchFileContent(file.path, file.name);
            }
        }
        setActiveFilePath(file.path);
    }, [openFiles, fetchFileContent, fileStates]);

     const handleTabSelect = useCallback((filePath) => {
        setActiveFilePath(filePath);
     }, []);

    const handleCloseFileTab = useCallback((filePathToClose) => {
        setOpenFiles(prev => prev.filter(f => f.path !== filePathToClose));
        setFileStates(prev => {
            const newState = { ...prev };
            delete newState[filePathToClose];
            return newState;
        });

        if (activeFilePath === filePathToClose) {
            const currentIndex = openFiles.findIndex(f => f.path === filePathToClose);
            let nextActivePath = null;
            const remainingFiles = openFiles.filter(f => f.path !== filePathToClose);
            if (remainingFiles.length > 0) {
                 // Try to activate the tab to the left, or the first one if closing the first tab
                 const nextIndex = Math.max(0, currentIndex - 1);
                 nextActivePath = remainingFiles[nextIndex]?.path ?? remainingFiles[0]?.path ?? null;
            }
            setActiveFilePath(nextActivePath);
        }
        if (fileStates[filePathToClose]?.error === globalFileLoadingError) {
            setGlobalFileLoadingError(null);
        }
    }, [activeFilePath, openFiles, fileStates, globalFileLoadingError]);

     const handleContentChange = useCallback((filePath, newContent) => {
        setFileStates(prev => {
            const currentState = prev[filePath];
            if (!currentState) return prev;
            const isNowDirty = newContent !== currentState.cleanContent;
            return {
                ...prev,
                [filePath]: { ...currentState, content: newContent, isDirty: isNowDirty }
            };
        });
         if (globalFileLoadingError && fileStates[filePath]?.error === globalFileLoadingError) {
             setGlobalFileLoadingError(null);
         }
     }, [globalFileLoadingError, fileStates]);

    const handleSaveFile = useCallback(async (filePathToSave, currentContent) => {
        const state = fileStates[filePathToSave];
        const isActuallyDirty = state && currentContent !== state.cleanContent;

        if (!state || !isActuallyDirty || state.isLoading) {
            console.log("Save skipped:", { path: filePathToSave, hasState: !!state, isActuallyDirty, isLoading: state?.isLoading });
            return;
        }

        setError(null);
        setGlobalFileLoadingError(null);
        console.log(`Attempting to save: ${filePathToSave}`);

        try {
            await callElectronApi('saveFileContent', filePathToSave, currentContent);
            console.log(`Successfully saved: ${filePathToSave}`);
            setFileStates(prev => ({
                ...prev,
                [filePathToSave]: {
                    ...prev[filePathToSave],
                    cleanContent: currentContent,
                    content: currentContent,
                    isDirty: false,
                    error: null,
                }
            }));
        } catch (err) {
            console.error(`Error saving file ${filePathToSave}:`, err);
            const errorMsg = `Failed to save ${state.name || 'file'}: ${err.message || 'Unknown error'}`;
            setFileStates(prev => ({
                ...prev,
                [filePathToSave]: {
                    ...prev[filePathToSave],
                    error: errorMsg,
                }
            }));
             setGlobalFileLoadingError(errorMsg);
        }
    }, [fileStates]);

    const handleFolderSelect = async () => {
         setError(null);
         setGlobalFileLoadingError(null);
         setDirectoryTree(null);
         setSelectedFolderPath(null);
         setOpenFiles([]);
         setActiveFilePath(null);
         setFileStates({});
         // Reset chat state too
         setChatInputMessage('');
         setChatMentionedFiles([]);
         setChatAllProjectFiles([]);
         // Consider if chat history should be cleared too? Maybe not.

         try {
             const folderPath = await callElectronApi('selectFolder');
             if (folderPath) {
                 setSelectedFolderPath(folderPath);
                 fetchDirectoryStructure(folderPath); // This now also triggers fetchChatProjectFiles
             }
         } catch (err) { setError(`Failed to open folder dialog: ${err.message || 'Unknown error'}`); }
    };

    const handleRefreshNeeded = useCallback(() => {
        if (selectedFolderPath) {
            fetchDirectoryStructure(selectedFolderPath); // This now also triggers fetchChatProjectFiles
        }
    }, [selectedFolderPath, fetchDirectoryStructure]);

    const handleSetError = useCallback((errorMessage) => {
        setError(errorMessage);
    }, []);


    const renderTabContent = () => {
        const renderCodeTab = () => {
            if (!selectedFolderPath) return <HomeTabContent />;
            const isLoading = activeFileState?.isLoading ?? false;
            const loadError = activeFileState?.error ?? globalFileLoadingError;
            return (
                <CodeDisplay
                    key={activeFilePath || 'no-file'}
                    openFiles={openFiles}
                    activeFilePath={activeFilePath}
                    fileStates={fileStates}
                    currentFileState={activeFileState}
                    onTabSelect={handleTabSelect}
                    onCloseTab={handleCloseFileTab}
                    onContentChange={handleContentChange}
                    onSaveFile={handleSaveFile}
                    isLoading={isLoading}
                    loadError={loadError}
                />
            );
        };

        // Pass lifted chat state and handlers to ChatSection
        const renderChatTab = () => {
            if (!selectedFolderPath) return <HomeTabContent />;
            return (
                 <ChatSection
                    chatHistory={chatHistory}
                    isSending={isChatSending}
                    geminiError={geminiChatError}
                    clearGeminiError={clearGeminiChatError}
                    isApiKeyMissing={isGeminiApiKeyMissing}
                    stopGenerating={stopChatGenerating}
                    inputMessage={chatInputMessage}
                    setInputMessage={setChatInputMessage}
                    mentionedFiles={chatMentionedFiles}
                    setMentionedFiles={setChatMentionedFiles}
                    allProjectFiles={chatAllProjectFiles} // Pass the flattened list for suggestions
                    onSendMessage={handleChatSendMessage}
                    onClearMentionedFiles={handleChatClearMentionedFiles}

                    selectedFolderPath={selectedFolderPath}
                    selectedFile={activeFile} 
                 />
             );
        };

        const renderAutomationTab = () => {
             if (!selectedFolderPath) return <HomeTabContent />;
             return <AutomationTab selectedFolderPath={selectedFolderPath} />;
        };

        const renderBrowserTab = () => {
             if (!selectedFolderPath) return <HomeTabContent />;
             return <Browser/>;
        };


        // --- Conditional Rendering for Tabs ---
        // This part *doesn't* change, it just decides which content function to call
        // The key is that the state *lives* outside this rendering logic now.
        let contentToRender;
        switch (activeTab) {
            case 'Code':
                contentToRender = renderCodeTab();
                break;
            case 'Chat':
                contentToRender = renderChatTab();
                break;
            case 'Automation':
                contentToRender = renderAutomationTab();
                break;
            case 'Browser':
                 contentToRender = renderBrowserTab();
                 break;
            default:
                contentToRender = <HomeTabContent />;
                break;
        }
        // Wrap the content in a div that fills space
        return <div className="flex flex-1 flex-col overflow-hidden">{contentToRender}</div>;
    };

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-black dark:text-white overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
                <TabSelectorSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <Topbar onFolderSelect={handleFolderSelect} selectedFolderPath={selectedFolderPath} />
                    <div className="flex flex-1 overflow-hidden">
                         {selectedFolderPath && (
                             <FileBar
                                 directoryTree={directoryTree} // FileBar still needs the tree structure
                                 selectedFolderPath={selectedFolderPath}
                                 onRefreshNeeded={handleRefreshNeeded}
                                 onError={handleSetError}
                                 onFileSelect={handleFileSelect} // FileBar triggers file selection
                             />
                         )}
                        <main className="flex-1 flex flex-col overflow-hidden relative">
                             {isLoadingStructure && (
                                 <div className="absolute inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center z-50">
                                     <span className="text-white bg-black bg-opacity-70 px-4 py-2 rounded">Loading Structure...</span>
                                 </div>
                             )}
                            {error && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-2 w-auto max-w-lg z-50 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded shadow-lg flex justify-between items-center">
                                    <span>Error: {error}</span>
                                    <button onClick={() => setError(null)} className="ml-4 p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300">
                                       <FiX size={18}/>
                                    </button>
                                </div>
                            )}
                             {globalFileLoadingError && (
                                 <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-2 w-auto max-w-lg z-50 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded shadow-lg flex justify-between items-center">
                                     <span>{globalFileLoadingError}</span>
                                     <button onClick={() => setGlobalFileLoadingError(null)} className="ml-4 p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300">
                                       <FiX size={18}/>
                                    </button>
                                 </div>
                             )}
                            {/* Render the active tab's content */}
                            {renderTabContent()}
                        </main>
                    </div>
                </div>
            </div>
            <Bottombar />
        </div>
    );
}