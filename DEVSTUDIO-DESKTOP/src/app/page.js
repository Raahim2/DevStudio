'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import TabSelectorSidebar from '../../components/Main/TabSelectorSidebar';
import FileBar from '../../components/Main/FileBar';
import Topbar from '../../components/Main/Topbar';
import ChatSection from '../../components/Chat/ChatSection';
import Bottombar from '../../components/Main/Bottombar';
import HomeTabContent from '../../components/Main/HomeTabContent';
import CodeEditor from '../../components/Code/CodeEditor';
import AutomationTab from '../../components/Automate/Automation';
import CommitTab from '../../components/Commit/CommitTab';
import { FiX, FiLoader } from 'react-icons/fi'; // Added FiLoader for example
import { useGeminiChat } from '../../hooks/useGeminiChat';

const GITHUB_ACCESS_TOKEN_KEY = 'github_access_token';

const callElectronApi = async (funcName, ...args) => {
    if (window.electronAPI && typeof window.electronAPI[funcName] === 'function') {
        try {
            if (['startWatchingFolder', 'stopWatchingFolder'].includes(funcName)) {
                 window.electronAPI[funcName](...args); // These might not return a promise or be awaited
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
    if (typeof string !== 'string') return '';
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
    const [accessToken, setAccessToken] = useState(null);

    const {
        chatHistory,
        sendMessage: sendChatMessageHook, // Expects (promptForAI, userDisplayMessageForHistory)
        isSending: isChatSending,
        error: geminiChatError,
        clearError: clearGeminiChatError,
        isApiKeyMissing: isGeminiApiKeyMissing,
        stopGenerating: stopChatGenerating,
    } = useGeminiChat(); // Assuming your hook handles user message display internally based on second arg

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
        // if (errorMsg) setError(errorMsg); // You might want to set an error
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
                flatList.push({ name: name, path: currentNode.path, type: 'file' }); // Ensure type is included
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
            // Using getFolderStructure and flatten for consistency, or listProjectFiles if it's more direct
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

    // CORRECTED CHAT SEND MESSAGE HANDLER
    const handleChatSendMessage = useCallback(async (messageTypedByUser, filesAttachedByChatSection) => {
        const trimmedMessage = messageTypedByUser.trim();

        if ((!trimmedMessage && filesAttachedByChatSection.length === 0) || isChatSending || isGeminiApiKeyMissing) {
            return;
        }

        const messageForHistoryDisplay = trimmedMessage || (filesAttachedByChatSection.length > 0 ? `Attached ${filesAttachedByChatSection.length} file(s)` : "");

        let promptForAI = trimmedMessage;

        if (filesAttachedByChatSection.length > 0) {
            let fileContextForAI = "\n\n--- Attached Files Context ---";
            let pathSep = '/'; // Default
            if (window.electronAPI?.pathSep) {
                try { pathSep = await callElectronApi('pathSep'); } catch(e) { console.warn("Failed to get pathSep for chat message"); }
            }

            for (const file of filesAttachedByChatSection) {
                const contentForAI = file.content || `[LINFO: Content for ${file.name} was not available or empty.]`;
                let displayPath = file.path;
                if (selectedFolderPath && file.path.startsWith(selectedFolderPath + pathSep)) {
                    displayPath = file.path.substring(selectedFolderPath.length + pathSep.length);
                }

                fileContextForAI += `\n[File: ${file.name} (Path: ${displayPath})]\n`;
                if (contentForAI.startsWith('[LINFO:')) {
                    fileContextForAI += `${contentForAI}\n`;
                } else {
                    const extension = file.name.split('.').pop()?.toLowerCase() || 'text';
                    fileContextForAI += `\`\`\`${extension}\n${contentForAI}\n\`\`\`\n`;
                }
            }
            fileContextForAI += "--- End Attached Files Context ---\nUser Query:\n";
            promptForAI = fileContextForAI + promptForAI;
        }

        // Assuming useGeminiChat's sendMessage hook:
        // - First argument: the full prompt for the AI.
        // - Second argument: the message content to display for the user in chatHistory.
        sendChatMessageHook(promptForAI, messageForHistoryDisplay);

        setChatInputMessage('');
        setChatMentionedFiles([]);
    }, [isChatSending, isGeminiApiKeyMissing, sendChatMessageHook, selectedFolderPath]);


    const fetchDirectoryStructure = useCallback(async (folderPath, isExternalRefresh = false) => {
         if (!folderPath) {
             setError("No folder path provided."); return;
         }
         if (!isExternalRefresh) {
             setOpenFiles([]);
             setActiveFilePath(null);
             setFileStates({});
             setChatMentionedFiles([]); // Clear chat mentions when folder changes
         }

         setGlobalFileLoadingError(null);
         setIsLoadingStructure(true);

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
                // Also refresh chat project files on external refresh
                fetchChatProjectFiles(folderPath);

            } else if (!isExternalRefresh) {
                if (!structure) {
                    setOpenFiles([]);
                    setActiveFilePath(null);
                    setFileStates({});
                }
                // Fetch for chat files on initial, non-external load
                fetchChatProjectFiles(folderPath);
            }

             if (!structure) {
                 let folderName = folderPath; try { folderName = await callElectronApi('pathBasename', folderPath); } catch(e) {/* ignore */}
                 setError(`Could not load structure for "${folderName}". Check permissions or path.`);
             } else {
                setError(null);
             }
         } catch (err) {
             setError(`Failed to load folder structure: ${err.message || 'Unknown error'}`);
             setDirectoryTree(null);
             setChatAllProjectFiles([]); // Clear chat files if structure fails
         } finally { setIsLoadingStructure(false); }
    }, [activeFilePath, flattenDirectoryTree, fetchChatProjectFiles]); // Added fetchChatProjectFiles


    useEffect(() => {
        let cleanupFileSystemListener = () => {};
        if (selectedFolderPath && window.electronAPI?.startWatchingFolder && window.electronAPI?.onFileSystemChange) {
            callElectronApi('startWatchingFolder', selectedFolderPath);
            cleanupFileSystemListener = window.electronAPI.onFileSystemChange((changeDetails) => {
                // Ensure changeDetails and watchedFolderPath are defined before comparing
                if (changeDetails && typeof changeDetails.watchedFolderPath === 'string' && changeDetails.watchedFolderPath === selectedFolderPath) {
                    if (refreshDebounceTimeoutRef.current) clearTimeout(refreshDebounceTimeoutRef.current);
                    refreshDebounceTimeoutRef.current = setTimeout(() => {
                        fetchDirectoryStructure(selectedFolderPath, true);
                    }, 750);
                }
            });
        }
        return () => {
            if (selectedFolderPath && window.electronAPI?.stopWatchingFolder) {
                callElectronApi('stopWatchingFolder', selectedFolderPath); // Pass folder path to stop
            }
            if (typeof cleanupFileSystemListener === 'function') cleanupFileSystemListener();
            if (refreshDebounceTimeoutRef.current) clearTimeout(refreshDebounceTimeoutRef.current);
        };
    }, [selectedFolderPath, fetchDirectoryStructure]);

    const fetchFileContent = useCallback(async (filePath, fileName) => {
        setFileStates(prev => ({
            ...prev,
            [filePath]: { ...prev[filePath], isLoading: true, error: null, name: fileName, content: prev[filePath]?.content ?? '' }
        }));
        setGlobalFileLoadingError(null);

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
                    content: null, cleanContent: null,
                    isDirty: false, isLoading: false, error: errorMsg,
                }
            }));
            setGlobalFileLoadingError(errorMsg);
        }
    }, []);

    const handleFileSelect = useCallback(async (file) => {
        if (!file || !file.path) return;
        setError(null);

        let ensuredFileName = file.name;
        if (!ensuredFileName && window.electronAPI?.pathBasename) {
            try { ensuredFileName = await callElectronApi('pathBasename', file.path); }
            catch (e) { ensuredFileName = file.path.split(/[\\/]/).pop(); }
        } else if (!ensuredFileName) {
             ensuredFileName = file.path.split(/[\\/]/).pop();
        }

        const fileWithEnsuredName = {...file, name: ensuredFileName};

        const existingFile = openFiles.find(f => f.path === fileWithEnsuredName.path);
        if (!existingFile) {
            setOpenFiles(prev => [...prev, fileWithEnsuredName]);
            setFileStates(prev => ({
                ...prev,
                [fileWithEnsuredName.path]: { content: '', cleanContent: '', isDirty: false, isLoading: true, error: null, name: fileWithEnsuredName.name }
            }));
            fetchFileContent(fileWithEnsuredName.path, fileWithEnsuredName.name);
        } else {
            const currentState = fileStates[fileWithEnsuredName.path];
            if (currentState?.error && !currentState.isLoading) {
                 fetchFileContent(fileWithEnsuredName.path, fileWithEnsuredName.name);
            }
        }
        setActiveFilePath(fileWithEnsuredName.path);
    }, [openFiles, fetchFileContent, fileStates]);

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
                    const nextIndex = Math.max(0, currentIndexInOldList -1);
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
            if (closedFileState?.error && closedFileState.error === globalFileLoadingError) {
                setGlobalFileLoadingError(null);
            }
            return newState;
        });
    }, [activeFilePath, globalFileLoadingError]);

     const handleContentChange = useCallback((filePath, newContent) => {
        setFileStates(prev => {
            const currentState = prev[filePath];
            if (!currentState) return prev;
            return {
                ...prev,
                [filePath]: { ...currentState, content: newContent, isDirty: newContent !== currentState.cleanContent }
            };
        });
         const currentFileState = fileStates[filePath];
         if (currentFileState?.error && currentFileState.error === globalFileLoadingError) {
             setGlobalFileLoadingError(null);
         }
     }, [globalFileLoadingError, fileStates]);

    const handleSaveFile = useCallback(async (filePathToSave, currentContent) => {
        const state = fileStates[filePathToSave];
        const contentToSave = currentContent === undefined ? state?.content : currentContent;

        if (contentToSave === undefined || contentToSave === null) return;
        if (!state || (contentToSave === state.cleanContent && !state.isDirty) || state.isLoading) return;

        setError(null);
        if (state.error === globalFileLoadingError) setGlobalFileLoadingError(null);

        try {
            await callElectronApi('saveFileContent', filePathToSave, contentToSave);
            setFileStates(prev => ({
                ...prev,
                [filePathToSave]: {
                    ...prev[filePathToSave],
                    content: contentToSave,
                    cleanContent: contentToSave, isDirty: false, error: null,
                }
            }));
        } catch (err) {
            const errorMsg = `Failed to save ${state.name || 'file'}: ${err.message || 'Unknown error'}`;
            setFileStates(prev => ({
                ...prev,
                [filePathToSave]: { ...prev[filePathToSave], error: errorMsg, isDirty: true }
            }));
             setGlobalFileLoadingError(errorMsg);
        }
    }, [fileStates, globalFileLoadingError]);

    const handleFolderSelect = async () => {
         setError(null);
         setGlobalFileLoadingError(null);
         setDirectoryTree(null);

         if (selectedFolderPath && window.electronAPI?.stopWatchingFolder) {
            await callElectronApi('stopWatchingFolder', selectedFolderPath); // Pass path to stop
         }

         try {
             const folderPath = await callElectronApi('selectFolder');
             if (folderPath) {
                 setSelectedFolderPath(folderPath); // Triggers watcher & fetchDirectoryStructure(folderPath, false)
                 // fetchDirectoryStructure is now called inside useEffect for selectedFolderPath or directly if needed
             } else {
                 setSelectedFolderPath(null);
                 setDirectoryTree(null); // Ensure tree is cleared if no folder selected
                 setOpenFiles([]);
                 setActiveFilePath(null);
                 setFileStates({});
                 setChatAllProjectFiles([]);
             }
         } catch (err) {
             setError(`Failed to open folder dialog: ${err.message || 'Unknown error'}`);
             setSelectedFolderPath(null);
         }
    };

    // Effect to fetch directory structure when selectedFolderPath changes
    useEffect(() => {
        if (selectedFolderPath) {
            fetchDirectoryStructure(selectedFolderPath, false);
        } else {
            // Clear related state when no folder is selected
            setDirectoryTree(null);
            setOpenFiles([]);
            setActiveFilePath(null);
            setFileStates({});
            setError(null);
            setGlobalFileLoadingError(null);
            setChatAllProjectFiles([]);
        }
    }, [selectedFolderPath, fetchDirectoryStructure]);


    const handleRefreshNeeded = useCallback(() => {
        if (selectedFolderPath) {
            fetchDirectoryStructure(selectedFolderPath, true);
        }
    }, [selectedFolderPath, fetchDirectoryStructure]);

    const handleSetError = useCallback((errorMessage) => {
        setError(errorMessage);
    }, []);

    const renderTabContent = () => {
        const tabWrapperBaseClasses = "flex flex-1 flex-col overflow-hidden";

        if (!selectedFolderPath) {
            return <div className={tabWrapperBaseClasses}><HomeTabContent onFolderSelect={handleFolderSelect} /></div>;
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
                isLoading={isLoadingStructure && !activeFile } // Show loading in editor if structure is loading AND no file is active (or active file is still loading)
                loadError={fileStates[activeFilePath]?.error || globalFileLoadingError} // Prioritize active file error
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
                    <div className={tabWrapperBaseClasses}><HomeTabContent onFolderSelect={handleFolderSelect} /></div>
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
                                 onError={handleSetError}
                                 onFileSelect={handleFileSelect}
                                 isLoading={isLoadingStructure}
                             />
                         )}
                        <main className="flex-1 flex flex-col overflow-hidden relative">
                             {isLoadingStructure && !directoryTree && (!openFiles.length || !activeFilePath) && (
                                 <div className="absolute inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center z-50">
                                     <div className="text-white bg-black bg-opacity-70 px-4 py-2 rounded flex items-center">
                                        <FiLoader className="animate-spin mr-2" size={20} />
                                        Loading Project Structure...
                                     </div>
                                 </div>
                             )}
                            {error && (
                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-auto max-w-md z-50 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded shadow-lg flex justify-between items-center">
                                    <span>{error}</span>
                                    <button onClick={() => setError(null)} className="ml-3 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300">
                                       <FiX size={18}/>
                                    </button>
                                </div>
                            )}
                          {renderTabContent()}
                        </main>
                    </div>
                </div>
            </div>
            <Bottombar />
        </div>
    );
}