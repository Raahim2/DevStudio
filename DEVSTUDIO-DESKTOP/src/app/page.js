'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import TabSelectorSidebar from '../../components/Main/TabSelectorSidebar';
import FileBar from '../../components/Main/FileBar';
import Topbar from '../../components/Main/Topbar';
import ChatSection from '../../components/Chat/ChatSection';
import Bottombar from '../../components/Main/Bottombar';
import HomeTabContent from '../../components/Main/HomeTabContent';
import CodeEditor from '../../components/Code/CodeEditor'; // Ensure this path is correct
import AutomationTab from '../../components/Automate/Automation';
import CommitTab from '../../components/Commit/CommitTab'
import { FiX } from 'react-icons/fi';
import { useGeminiChat } from '../../hooks/useGeminiChat';

const GITHUB_ACCESS_TOKEN_KEY = 'github_access_token';

const callElectronApi = async (funcName, ...args) => {
    if (window.electronAPI && typeof window.electronAPI[funcName] === 'function') {
        try {
            if (['startWatchingFolder', 'stopWatchingFolder'].includes(funcName)) {
                 window.electronAPI[funcName](...args);
                 return; 
            }
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



const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export default function Home() {
    const [activeTab, setActiveTab] = useState('Code');
    const [selectedFolderPath, setSelectedFolderPath] = useState(null);
    const [directoryTree, setDirectoryTree] = useState(null);
    const [isLoadingStructure, setIsLoadingStructure] = useState(false); // Global loading for file tree
    const [error, setError] = useState(null); // General errors
    const [openFiles, setOpenFiles] = useState([]);
    const [activeFilePath, setActiveFilePath] = useState(null);
    const [fileStates, setFileStates] = useState({});
    const [globalFileLoadingError, setGlobalFileLoadingError] = useState(null); 
    const [accessToken, setAccessToken] = useState(null);

    const {
        chatHistory, sendMessage: sendChatMessageHook, isSending: isChatSending,
        error: geminiChatError, clearError: clearGeminiChatError,
        isApiKeyMissing: isGeminiApiKeyMissing, stopGenerating: stopChatGenerating,
    } = useGeminiChat();

    const [chatInputMessage, setChatInputMessage] = useState('');
    const [chatMentionedFiles, setChatMentionedFiles] = useState([]);
    const [chatAllProjectFiles, setChatAllProjectFiles] = useState([]);

    const refreshDebounceTimeoutRef = useRef(null);

    const activeFile = useMemo(() => {
        return openFiles.find(f => f.path === activeFilePath) || null;
    }, [openFiles, activeFilePath]);

    const clearAuthState = useCallback((errorMsg = null) => {
        try {
          localStorage.removeItem(GITHUB_ACCESS_TOKEN_KEY);
        } catch (e) {
          console.error("Failed to remove token from localStorage:", e);
        }
        setAccessToken(null);
       
    }, []);

    const handleGithubLogin = useCallback(() => {
        if (window.electronAPI && typeof window.electronAPI.loginGithub === 'function') {
          clearAuthState();
          window.electronAPI.loginGithub();
        } else {
          console.error('Electron API (window.electronAPI or loginGithub) not found.');
          clearAuthState("Could not initiate login: Electron API unavailable.");
        }
    }, [clearAuthState]);

    useEffect(() => {
        let unsubscribe = null;
        let cleanupPerformed = false;
        let initialToken = null;

        try {
          initialToken = localStorage.getItem(GITHUB_ACCESS_TOKEN_KEY);
          if (initialToken) {
            setAccessToken(initialToken);
          } else {
          }
        } catch (e) {
          console.error("Failed to access localStorage on mount:", e);
        }

        const handleToken = (token) => {
          if (cleanupPerformed) return;
          if (token) {
            try {
              localStorage.setItem(GITHUB_ACCESS_TOKEN_KEY, token);
            } catch (e) {
              console.error("Failed to save token to localStorage:", e);
            }
            setAccessToken(token);
          } else {
            clearAuthState("Logged out or token became invalid.");
          }
        };

        if (window.electronAPI && typeof window.electronAPI.onGithubToken === 'function') {
          unsubscribe = window.electronAPI.onGithubToken(handleToken);
        } else {
          console.warn('Page: Electron API or onGithubToken function not found. Persistence/Login might not work correctly.');
         
        }

        return () => {
          cleanupPerformed = true;
          if (unsubscribe && typeof unsubscribe === 'function') {
            unsubscribe();
          }
        };
    }, [clearAuthState]);

    


    const flattenDirectoryTree = useCallback((node) => {
        const flatList = [];
        function traverse(currentNode) {
            if (!currentNode) return;
            if (currentNode.type === 'file' && currentNode.path) {
                const name = currentNode.name || currentNode.path.split(/[\\/]/).pop();
                flatList.push({ name: name, path: currentNode.path });
            }
            if (currentNode.children && Array.isArray(currentNode.children)) {
                currentNode.children.forEach(child => traverse(child));
            }
        }
        traverse(node);
        return flatList;
    }, []);


    const fetchChatProjectFiles = useCallback(async (folderPath) => {
        if (!folderPath) {
            setChatAllProjectFiles([]);
            return;
        }
        try {
            const structure = await callElectronApi('getFolderStructure', folderPath);
            if (structure) {
                const flatFiles = flattenDirectoryTree(structure);
                setChatAllProjectFiles(flatFiles);
            } else {
                setChatAllProjectFiles([]);
            }
        } catch (fetchError) {
            console.error("Chat: Failed to get folder structure for mentions:", fetchError);
            setChatAllProjectFiles([]);
        }
    }, [flattenDirectoryTree]);

     useEffect(() => {
        if (selectedFolderPath) {
            fetchChatProjectFiles(selectedFolderPath);
        } else {
            setChatAllProjectFiles([]);
        }
    }, [selectedFolderPath, fetchChatProjectFiles]);

    const handleChatClearMentionedFiles = useCallback(() => {
        setChatMentionedFiles([]);
    }, []);

    const handleChatSendMessage = useCallback(async (messageToSend, filesAttached) => {
        const trimmedMessage = messageToSend.trim();
        if (!trimmedMessage || isChatSending || isGeminiApiKeyMissing) return;

        let promptToSend = trimmedMessage;
        let messageForHistory = trimmedMessage;

        if (filesAttached.length > 0) {
            let fileContextPrefix = '';
            for (const file of filesAttached) {
                const mentionRegex = new RegExp(`@${escapeRegex(file.name)}\\b`, 'g');
                promptToSend = promptToSend.replace(mentionRegex, file.name);
                const fileState = fileStates[file.path];
                const content = fileState && fileState.content !== null && fileState.content !== undefined 
                                ? fileState.content 
                                : "Error: Could not load file content for chat context."; // Provide a fallback
                fileContextPrefix += `File: ${file.name} (Path: ${file.path})\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
            promptToSend = `${fileContextPrefix}User Query:\n${promptToSend}`;
        }
        sendChatMessageHook(promptToSend, messageForHistory);
        setChatInputMessage('');
        setChatMentionedFiles([]);
    }, [isChatSending, isGeminiApiKeyMissing, sendChatMessageHook, fileStates]);


    const fetchDirectoryStructure = useCallback(async (folderPath, isExternalRefresh = false) => {
         if (!folderPath) {
             setError("No folder path provided."); return;
         }
         if (!isExternalRefresh) {
             setOpenFiles([]);
             setActiveFilePath(null);
             setFileStates({});
             setChatMentionedFiles([]);
         }

         setGlobalFileLoadingError(null); // Clear global file error on new fetch
         setIsLoadingStructure(true); // Set loading for directory structure

         try {
             const structure = await callElectronApi('getFolderStructure', folderPath);
             setDirectoryTree(structure || null);

             if (isExternalRefresh && structure) {
                const flatNewTree = flattenDirectoryTree(structure);
                const existingFilePaths = new Set(flatNewTree.map(f => f.path));

                setOpenFiles(prevOpenFiles => {
                    const newOpenFiles = prevOpenFiles.filter(f => existingFilePaths.has(f.path));
                    if (activeFilePath && !existingFilePaths.has(activeFilePath)) {
                        setActiveFilePath(newOpenFiles.length > 0 ? newOpenFiles[0].path : null);
                    }
                    return newOpenFiles;
                });

                setFileStates(prevFileStates => {
                    const newFileStates = {};
                    for (const path in prevFileStates) {
                        if (existingFilePaths.has(path)) {
                            newFileStates[path] = prevFileStates[path];
                        }
                    }
                    return newFileStates;
                });
            } else if (!isExternalRefresh) {
                // If it's a fresh load (not external refresh), ensure files are cleared if structure is null
                if (!structure) {
                    setOpenFiles([]);
                    setActiveFilePath(null);
                    setFileStates({});
                }
            }

             if (!structure) {
                 let folderName = folderPath; try { folderName = await callElectronApi('pathBasename', folderPath); } catch(e) {/* ignore */}
                 setError(`Could not load structure for "${folderName}". Check permissions or path.`);
             } else {
                setError(null); // Clear general error if structure loaded
                if (!isExternalRefresh) fetchChatProjectFiles(folderPath); // Fetch for chat on initial load
             }
         } catch (err) {
             setError(`Failed to load folder structure: ${err.message || 'Unknown error'}`);
             setDirectoryTree(null);
         } finally { setIsLoadingStructure(false); }
    }, [activeFilePath, fetchChatProjectFiles, flattenDirectoryTree]);


    useEffect(() => {
        let cleanupFileSystemListener = () => {};
        if (selectedFolderPath && window.electronAPI?.startWatchingFolder && window.electronAPI?.onFileSystemChange) {
            callElectronApi('startWatchingFolder', selectedFolderPath);
            cleanupFileSystemListener = window.electronAPI.onFileSystemChange((changeDetails) => {
                if (changeDetails && changeDetails.watchedFolderPath === selectedFolderPath) {
                    if (refreshDebounceTimeoutRef.current) clearTimeout(refreshDebounceTimeoutRef.current);
                    refreshDebounceTimeoutRef.current = setTimeout(() => {
                        fetchDirectoryStructure(selectedFolderPath, true);
                    }, 750);
                }
            });
        }
        return () => {
            if (selectedFolderPath && window.electronAPI?.stopWatchingFolder) {
                callElectronApi('stopWatchingFolder');
            }
            if (typeof cleanupFileSystemListener === 'function') cleanupFileSystemListener();
            if (refreshDebounceTimeoutRef.current) clearTimeout(refreshDebounceTimeoutRef.current);
        };
    }, [selectedFolderPath, fetchDirectoryStructure]);


    const fetchFileContent = useCallback(async (filePath, fileName) => {
        setFileStates(prev => ({
            ...prev,
            [filePath]: { ...prev[filePath], isLoading: true, error: null, name: fileName, content: prev[filePath]?.content ?? '' } // Preserve old content while loading
        }));
        setGlobalFileLoadingError(null); // Clear global file error for this specific attempt

        try {
            const content = await callElectronApi('readFileContent', filePath);
            setFileStates(prev => ({
                ...prev,
                [filePath]: {
                    ...prev[filePath],
                    content: content ?? '', cleanContent: content ?? '',
                    isDirty: false, isLoading: false, error: null,
                }
            }));
        } catch (err) {
            const errorMsg = `Failed to load ${fileName || 'file'}: ${err.message || 'Unknown error'}`;
            setFileStates(prev => ({
                ...prev,
                [filePath]: {
                    ...prev[filePath],
                    content: null, cleanContent: null, // Or keep old content if preferred on error
                    isDirty: false, isLoading: false, error: errorMsg,
                }
            }));
            setGlobalFileLoadingError(errorMsg); // Set global error if this specific file fails
        }
    }, []);

    const handleFileSelect = useCallback(async (file) => {
        if (!file || !file.path) return;
        setError(null); // Clear general error
        // Global file loading error is handled by fetchFileContent

        let ensuredFileName = file.name;
        if (!ensuredFileName) {
            try { ensuredFileName = await callElectronApi('pathBasename', file.path); }
            catch (e) { ensuredFileName = file.path.split(/[\\/]/).pop(); }
        }
        const fileWithEnsuredName = {...file, name: ensuredFileName};

        const existingFile = openFiles.find(f => f.path === fileWithEnsuredName.path);
        if (!existingFile) {
            setOpenFiles(prev => [...prev, fileWithEnsuredName]);
            // Initial state for new file, content will be fetched
            setFileStates(prev => ({
                ...prev,
                [fileWithEnsuredName.path]: { content: '', cleanContent: '', isDirty: false, isLoading: true, error: null, name: fileWithEnsuredName.name }
            }));
            fetchFileContent(fileWithEnsuredName.path, fileWithEnsuredName.name);
        } else {
            // If file already open, check if it had an error, if so, retry loading
            const currentState = fileStates[fileWithEnsuredName.path];
            if (currentState?.error && !currentState.isLoading) {
                 fetchFileContent(fileWithEnsuredName.path, fileWithEnsuredName.name);
            }
        }
        setActiveFilePath(fileWithEnsuredName.path);
    }, [openFiles, fetchFileContent, fileStates]); // Added fileStates

     const handleTabSelect = useCallback((filePath) => {
        setActiveFilePath(filePath);
     }, []);

    const handleCloseFileTab = useCallback((filePathToClose) => {
        setOpenFiles(prevOpenFiles => {
            const newOpenFiles = prevOpenFiles.filter(f => f.path !== filePathToClose);
            if (activeFilePath === filePathToClose) {
                const currentIndexInOldList = prevOpenFiles.findIndex(f => f.path === filePathToClose);
                let nextActivePath = null;
                if (newOpenFiles.length > 0) {
                    const nextIndex = Math.max(0, currentIndexInOldList -1); // Try to select previous tab
                    nextActivePath = newOpenFiles[nextIndex]?.path ?? newOpenFiles[0]?.path ?? null;
                }
                setActiveFilePath(nextActivePath);
            }
            return newOpenFiles;
        });

        setFileStates(prev => {
            const newState = { ...prev };
            const closedFileState = newState[filePathToClose];
            delete newState[filePathToClose];
            // If the closed tab's error was the global error, clear global error
            if (closedFileState?.error && closedFileState.error === globalFileLoadingError) {
                setGlobalFileLoadingError(null);
            }
            return newState;
        });
    }, [activeFilePath, globalFileLoadingError]); // Removed fileStates as prev is used. Removed openFiles, prevOpenFiles used.

     const handleContentChange = useCallback((filePath, newContent) => {
        setFileStates(prev => {
            const currentState = prev[filePath];
            if (!currentState) return prev; // Should not happen if file is open
            return {
                ...prev,
                [filePath]: { ...currentState, content: newContent, isDirty: newContent !== currentState.cleanContent }
            };
        });
         // If change clears an error state that was global
         const currentFileState = fileStates[filePath];
         if (currentFileState?.error && currentFileState.error === globalFileLoadingError) {
             setGlobalFileLoadingError(null);
         }
     }, [globalFileLoadingError, fileStates]); // fileStates needed to check current error

    const handleSaveFile = useCallback(async (filePathToSave, currentContent) => {
        const state = fileStates[filePathToSave];
        const contentToSave = currentContent === undefined ? state?.content : currentContent;

        if (contentToSave === undefined || contentToSave === null) return;
        if (!state || (contentToSave === state.cleanContent && !state.isDirty) || state.isLoading) return;

        // Clear relevant errors before saving
        setError(null);
        if (state.error === globalFileLoadingError) setGlobalFileLoadingError(null);

        try {
            await callElectronApi('saveFileContent', filePathToSave, contentToSave);
            setFileStates(prev => ({
                ...prev,
                [filePathToSave]: {
                    ...prev[filePathToSave],
                    content: contentToSave, // Ensure live content is also updated
                    cleanContent: contentToSave, isDirty: false, error: null,
                }
            }));
        } catch (err) {
            const errorMsg = `Failed to save ${state.name || 'file'}: ${err.message || 'Unknown error'}`;
            setFileStates(prev => ({
                ...prev,
                [filePathToSave]: { ...prev[filePathToSave], error: errorMsg, isDirty: true } // Remain dirty on save error
            }));
             setGlobalFileLoadingError(errorMsg); // Set global error on save failure
        }
    }, [fileStates, globalFileLoadingError]); // Added globalFileLoadingError

    const handleFolderSelect = async () => {
         setError(null);
         setGlobalFileLoadingError(null);
         setDirectoryTree(null);
         // Other state resets (openFiles, activeFilePath, fileStates) are handled by fetchDirectoryStructure(..., false)

         if (selectedFolderPath && window.electronAPI?.stopWatchingFolder) {
            await callElectronApi('stopWatchingFolder');
         }
         // setSelectedFolderPath(null); // This will trigger useEffect cleanup for watcher

         try {
             const folderPath = await callElectronApi('selectFolder');
             if (folderPath) {
                 setSelectedFolderPath(folderPath); // This triggers watcher setup & initial fetch
                 fetchDirectoryStructure(folderPath, false); 
             } else {
                 setSelectedFolderPath(null); // Ensure it's null if no folder selected
             }
         } catch (err) {
             setError(`Failed to open folder dialog: ${err.message || 'Unknown error'}`);
             setSelectedFolderPath(null);
         }
    };

    const handleRefreshNeeded = useCallback(() => {
        if (selectedFolderPath) {
            fetchDirectoryStructure(selectedFolderPath, false);
        }
    }, [selectedFolderPath, fetchDirectoryStructure]);

    const handleSetError = useCallback((errorMessage) => {
        setError(errorMessage);
    }, []);

    const renderTabContent = () => {
        const tabWrapperBaseClasses = "flex flex-1 flex-col overflow-hidden";

        if (!selectedFolderPath) {
            return <div className={tabWrapperBaseClasses}><HomeTabContent /></div>;
        }
        
        const codeTabContent = () => (
            <CodeEditor
                openFiles={openFiles}
                activeFilePath={activeFilePath}
                fileStates={fileStates}
                onTabSelect={handleTabSelect}
                onCloseTab={handleCloseFileTab}
                onContentChange={handleContentChange}
                onSaveFile={handleSaveFile}
                isLoading={isLoadingStructure} // Loading state for the overall folder structure
                loadError={globalFileLoadingError} // Global error specific to file operations
                rootDir={selectedFolderPath}
            />

            
        );
        

        const chatTabContent = () => (
            <ChatSection
                chatHistory={chatHistory} isSending={isChatSending}
                geminiError={geminiChatError} clearGeminiError={clearGeminiChatError}
                isApiKeyMissing={isGeminiApiKeyMissing} stopGenerating={stopChatGenerating}
                inputMessage={chatInputMessage} setInputMessage={setChatInputMessage}
                mentionedFiles={chatMentionedFiles} setMentionedFiles={setChatMentionedFiles}
                allProjectFiles={chatAllProjectFiles} onSendMessage={handleChatSendMessage}
                onClearMentionedFiles={handleChatClearMentionedFiles}
                selectedFolderPath={selectedFolderPath} selectedFile={activeFile}
            />
        );

        const commitTabContent = () => (
            <CommitTab selectedFolderPath={selectedFolderPath} accessToken={accessToken} activeTab={activeTab} onGithubLogin={handleGithubLogin}/>
        );

        const automationTabContent = () => (
            <AutomationTab selectedFolderPath={selectedFolderPath} />
        );

        return (
            <>
                <div className={`${tabWrapperBaseClasses} ${activeTab === 'Code' ? '' : 'hidden'}`}>
                    {codeTabContent()}
                </div>
                <div className={`${tabWrapperBaseClasses} ${activeTab === 'Chat' ? '' : 'hidden'}`}>
                    {chatTabContent()}
                </div>
                <div className={`${tabWrapperBaseClasses} ${activeTab === 'Commit' ? '' : 'hidden'}`}>
                    {commitTabContent()}
                </div>
                <div className={`${tabWrapperBaseClasses} ${activeTab === 'Automation' ? '' : 'hidden'}`}>
                    {automationTabContent()}
                </div>
                { !['Code', 'Chat', 'Commit', 'Automation'].includes(activeTab) && selectedFolderPath && (
                    <div className={tabWrapperBaseClasses}><HomeTabContent /></div> // Fallback if folder selected but unknown tab
                 )}
            </>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-black dark:text-white overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
                <TabSelectorSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <Topbar onFolderSelect={handleFolderSelect} selectedFolderPath={selectedFolderPath} />
                    <div className="flex flex-1 overflow-hidden">
                         {selectedFolderPath && (activeTab === 'Code' || activeTab === 'Chat') && (
                             <FileBar
                                 directoryTree={directoryTree}
                                 selectedFolderPath={selectedFolderPath}
                                 onRefreshNeeded={handleRefreshNeeded}
                                 onError={handleSetError} // For errors from FileBar itself
                                 onFileSelect={handleFileSelect}
                                 isLoading={isLoadingStructure} // Pass loading state to FileBar
                             />
                         )}
                        <main className="flex-1 flex flex-col overflow-hidden relative">
                             {isLoadingStructure && !directoryTree && ( // Show general loading only if no tree yet
                                 <div className="absolute inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center z-50">
                                     <div className="text-white bg-black bg-opacity-70 px-4 py-2 rounded flex items-center">
                                        {/* <FiLoader className="animate-spin mr-2" size={20} /> */}
                                        Loading Project Structure...
                                     </div>
                                 </div>
                             )}
                            {error && ( // General error display
                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-auto max-w-md z-50 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded shadow-lg flex justify-between items-center">
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)} className="ml-3 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300">
                                       <FiX size={18}/>
                                    </button>
                                </div>
                            )}
                             {/* Global file loading error is distinct and now passed to CodeEditor, which handles its display for the active file */}
                             {/* It could also be displayed here if needed for non-active file errors, but CodeEditor handles tab-specific errors. */}

                          {renderTabContent()}
                        </main>
                    </div>
                </div>
            </div>
            <Bottombar />
        </div>
    );
}