// src/components/CreateFileModal.jsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiFilePlus, FiFolder, FiLoader, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
// Ensure this path is correct for your project structure
import { useGitHubApi } from '../hooks/useGitHubApi';

const CreateFileModal = ({
    isOpen,
    onClose,
    // Use the same prop name as the hook expects
    repoFullName, // e.g., "owner/repo-name"
    accessToken,
}) => {
    // Component state
    const [fileName, setFileName] = useState('');
    const [selectedDirPath, setSelectedDirPath] = useState('/'); // Default to root
    const [commitMessage, setCommitMessage] = useState('feat: Create new file');
    const [directoryOptions, setDirectoryOptions] = useState(['/']); // Start with root

    const fileNameInputRef = useRef(null);

    // --- GitHub API Hook ---
    // Ensure you pass the correct prop names: accessToken, repoFullName
    const {
        isOperating,
        operationError,
        // operationSuccess, // Not explicitly used here for feedback, relying on onClose(true)
        createFile,
        clearOperationError,
        // Directory fetching states/functions from the updated hook
        isFetchingDirs,
        fetchDirsError,
        getDirectories,
        clearFetchDirsError,
    } = useGitHubApi(accessToken, repoFullName); // Pass repoFullName here

    // --- Fetch Directories ---
    const fetchRepoDirectories = useCallback(async () => {
        // Use repoFullName prop
        if (!repoFullName || !accessToken) return;

        clearFetchDirsError();
        setDirectoryOptions(['/']); // Reset/show loading state
        setSelectedDirPath('/');

        // Fetch root directories
        const result = await getDirectories(''); // Call the hook function

        if (result.success) {
            const fetchedDirs = result.data || []; // data is now the array of paths
            // Combine root ('/') with fetched directory paths, sorted
            const sortedDirs = ['/', ...fetchedDirs.sort()];
            setDirectoryOptions(sortedDirs);
        } else {
            // Error is set in fetchDirsError state from the hook
            setDirectoryOptions(['/']); // Keep root even on error
        }
    }, [repoFullName, accessToken, getDirectories, clearFetchDirsError]); // Add dependencies

    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setFileName('');
            setSelectedDirPath('/');
            setCommitMessage('feat: Create new file');
            clearOperationError();
            clearFetchDirsError();

            fetchRepoDirectories(); // Fetch directories when modal opens

            setTimeout(() => fileNameInputRef.current?.focus(), 150);
        } else {
            setDirectoryOptions(['/']); // Reset on close
             setSelectedDirPath('/');
        }
    }, [isOpen, repoFullName, accessToken, fetchRepoDirectories, clearOperationError, clearFetchDirsError]);


    // --- Handlers ---
    const handleCreateFile = async () => {
        if (!fileName.trim() || !commitMessage.trim() || !repoFullName || !accessToken) {
             console.error("Missing required fields or props for file creation.");
             return;
        }
        clearOperationError();

        const normalizedDir = selectedDirPath === '/' ? '' : selectedDirPath.replace(/\/$/, '');
        const normalizedFileName = fileName.trim().replace(/^\//, '');
        const fullPath = normalizedDir ? `${normalizedDir}/${normalizedFileName}` : normalizedFileName;
        const fileContent = `// Initial content for ${normalizedFileName}\n`;

        console.log(`Attempting to create file: ${fullPath} in repo: ${repoFullName}`);
        const result = await createFile(fullPath, fileContent, commitMessage.trim());

        if (result.success) {
            console.log('File created successfully:', result.data);
            onClose(true); // Close modal and signal success
        } else {
            console.error('File creation failed:', result.error);
            // operationError is set by the hook
        }
    };

    const handleClose = () => {
        clearOperationError();
        clearFetchDirsError(); // Clear both errors on close
        onClose(false);
    };

    // --- Render Logic ---
    if (!isOpen) {
        return null;
    }

    const isFormValid = fileName.trim() && commitMessage.trim();
    // Combined loading state for disabling UI elements
    const isLoading = isOperating || isFetchingDirs;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 transition-opacity duration-300 ease-in-out"
            aria-labelledby="createFileModalTitle"
            role="dialog"
            aria-modal="true"
            onClick={handleClose}
        >
            <div
                className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 transform transition-all duration-300 ease-in-out sm:max-w-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 id="createFileModalTitle" className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <FiFilePlus className="mr-2 text-blue-500" /> Create New File
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-1 text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500"
                        aria-label="Close modal"
                        disabled={isLoading} // Disable during any loading
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* File Operation Error */}
                    {operationError && (
                         <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700/50 rounded-md text-sm text-red-700 dark:text-red-300 flex items-start justify-between">
                           <div className='flex items-center'>
                             <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                             <span className="flex-grow">{operationError}</span>
                           </div>
                            <button onClick={clearOperationError} className="ml-2 p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800/50">
                                <FiX size={16} />
                            </button>
                        </div>
                    )}

                    {/* Directory Fetch Error */}
                    {fetchDirsError && (
                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700/50 rounded-md text-sm text-yellow-700 dark:text-yellow-300 flex items-start justify-between">
                           <div className='flex items-center'>
                             <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                             <span className="flex-grow">{fetchDirsError}</span>
                           </div>
                           <div className='flex items-center space-x-2 ml-2'>
                               <button
                                   onClick={fetchRepoDirectories} // Retry button
                                   className="p-0.5 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800/50 disabled:opacity-50"
                                   title="Retry fetching directories"
                                   disabled={isFetchingDirs} // Disable retry while fetching
                                >
                                   <FiRefreshCw size={16} className={isFetchingDirs ? 'animate-spin' : ''}/>
                                </button>
                                <button onClick={clearFetchDirsError} className="p-0.5 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800/50">
                                    <FiX size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Directory Selector */}
                    <div>
                        <label htmlFor="directoryPath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Directory {isFetchingDirs && <FiLoader className="inline-block animate-spin ml-1 h-3 w-3 text-gray-500" />}
                        </label>
                        <div className="relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiFolder className="h-4 w-4 text-gray-400" />
                             </div>
                             <select
                                id="directoryPath"
                                name="directoryPath"
                                value={selectedDirPath}
                                onChange={(e) => setSelectedDirPath(e.target.value)}
                                // Disable if loading, error occurred, or only root available
                                disabled={isLoading || !!fetchDirsError || directoryOptions.length <= 1}
                                className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
                             >
                                {isFetchingDirs && directoryOptions.length <= 1 ? (
                                     <option value="/" disabled>Loading directories...</option>
                                ) : directoryOptions.length === 0 && !isFetchingDirs ? ( // Should ideally not happen with our logic, but safe fallback
                                     <option value="/" disabled>No directories found</option>
                                ): (
                                    directoryOptions.map(dirPath => (
                                        <option key={dirPath} value={dirPath}>
                                            {dirPath === '/' ? '/ (Root Directory)' : dirPath}
                                        </option>
                                    ))
                                )}
                            </select>
                             <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                 <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                     <path fillRule="evenodd" d="M10 3a.75.75 0 01.53.22l3.75 3.75a.75.75 0 01-1.06 1.06L10 4.81 6.78 8.03a.75.75 0 01-1.06-1.06l3.75-3.75A.75.75 0 0110 3zm-3.72 9.53a.75.75 0 011.06 0L10 15.19l3.22-3.22a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0l-3.75-3.75a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* File Name Input */}
                    <div>
                        <label htmlFor="fileName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            File Name <span className='text-red-500 text-xs'>*</span>
                        </label>
                        <input
                            ref={fileNameInputRef}
                            type="text"
                            id="fileName"
                            name="fileName"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && isFormValid && !isLoading) handleCreateFile(); }}
                            disabled={isLoading} // Disable during any loading
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-70 disabled:cursor-not-allowed"
                            placeholder="e.g., MyNewComponent.jsx"
                            required
                        />
                    </div>

                    {/* Commit Message Input */}
                    <div>
                        <label htmlFor="commitMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Commit Message <span className='text-red-500 text-xs'>*</span>
                        </label>
                        <input
                            type="text"
                            id="commitMessage"
                            name="commitMessage"
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && isFormValid && !isLoading) handleCreateFile(); }}
                            disabled={isLoading} // Disable during any loading
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-70 disabled:cursor-not-allowed"
                            placeholder="Enter commit message..."
                            required
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-x-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading} // Disable during any loading
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateFile}
                        // Disable if form invalid, loading, core props missing, OR if dir fetch failed
                        disabled={!isFormValid || isLoading || !repoFullName || !accessToken || !!fetchDirsError}
                        className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isOperating ? ( // Show create spinner only for file operation
                            <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        ) : (
                            <FiFilePlus className="-ml-1 mr-2 h-4 w-4" />
                        )}
                        {isOperating ? 'Creating...' : 'Create File'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateFileModal;