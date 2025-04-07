// src/components/CreateFileModal.jsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiFilePlus, FiAlertCircle, FiCpu, FiFolder, FiRefreshCw } from 'react-icons/fi';
// Assuming useGitHubApi is NOT used directly here for creation, but helpers might be shared
// If useGitHubApi contained a generic 'fetchFromApi' function, that could be useful.

const GITHUB_API_BASE = 'https://api.github.com';

// Helper: Base64 Encode (Keep as before)
const encodeBase64 = (str) => {
    try {
        const bytes = new TextEncoder().encode(str);
        const binString = String.fromCodePoint(...bytes);
        return btoa(binString);
    } catch (e) { /* ... error handling ... */ return null; }
};

const CreateFileModal = ({
    isOpen,
    onClose,
    initialCode,
    accessToken,
    selectedRepoFullName
}) => {
    // --- State ---
    const [fileName, setFileName] = useState(''); // Just the name, e.g., MyComponent.jsx
    const [selectedDirPath, setSelectedDirPath] = useState('/'); // Default to root directory
    const [commitMessage, setCommitMessage] = useState(`feat: Create new file via AI assist`);
    const [isLoading, setIsLoading] = useState(false); // Loading state for the create *commit*
    const [error, setError] = useState(null); // Error state for the create *commit* / validation

    const [directories, setDirectories] = useState([{ path: '/', name: 'Root Directory (/)' }]); // Start with Root
    const [isFetchingDirs, setIsFetchingDirs] = useState(false);
    const [dirsError, setDirsError] = useState(null);

    const fileNameInputRef = useRef(null); // Focus filename input

    // --- Fetch Directories ---
    const fetchDirectories = useCallback(async () => {
        if (!accessToken || !selectedRepoFullName) {
            setDirsError("Cannot fetch directories: Missing token or repo name.");
            return;
        }
        setIsFetchingDirs(true);
        setDirsError(null);
        // Always reset to root + fetched dirs
        setDirectories([{ path: '/', name: 'Root Directory (/)' }]);

        // Fetch contents of the root directory
        const apiUrl = `${GITHUB_API_BASE}/repos/${selectedRepoFullName}/contents/`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });

            if (!response.ok) {
                let errorMsg = `Failed to fetch directories (${response.status})`;
                 try { const ed = await response.json(); errorMsg += `: ${ed.message || ''}`;} catch(e){}
                throw new Error(errorMsg);
            }

            const contents = await response.json();
            if (Array.isArray(contents)) {
                const fetchedDirs = contents
                    .filter(item => item.type === 'dir')
                    .map(item => ({ path: item.path, name: item.name })) // Keep only path and name
                     .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

                setDirectories(prev => [...prev, ...fetchedDirs]); // Add fetched dirs to the root
            } else {
                 console.warn("Received non-array response for directory contents:", contents);
                 // Handle case where root might be empty or response is unexpected
            }

        } catch (err) {
            console.error("Error fetching directories:", err);
            setDirsError(err.message || "An unknown error occurred while fetching directories.");
        } finally {
            setIsFetchingDirs(false);
        }
    }, [accessToken, selectedRepoFullName]);

    // --- Effects ---
    // Fetch directories when modal opens
    useEffect(() => {
        if (isOpen) {
            // Reset form fields and errors
            setFileName('');
            setSelectedDirPath('/'); // Reset to root
            setCommitMessage(`feat: Create new file via AI assist`);
            setError(null);
            setDirsError(null); // Clear previous directory errors
            setIsLoading(false);

            fetchDirectories(); // Fetch directories on open

            // Focus the filename input shortly after opening
            setTimeout(() => fileNameInputRef.current?.focus(), 100);
        }
    }, [isOpen, fetchDirectories]); // Rerun if isOpen changes or fetchDirectories changes

    // --- Render Logic ---
    if (!isOpen) {
        return null;
    }

    // --- Validation ---
    const isValidFilename = (name) => {
        if (!name || name.trim() === '') return false;
        // Basic check: disallow slashes in the filename itself
        if (name.includes('/')) return false;
        // Add more checks if needed (e.g., invalid characters for filenames)
        return true;
    };

    // --- Create File Handler ---
    const handleCreateFile = async () => {
        setError(null);
        setDirsError(null); // Clear dir error on attempting commit

        // --- Validation ---
        if (!isValidFilename(fileName)) {
            setError("Invalid file name. It cannot be empty or contain slashes.");
            return;
        }
        if (!commitMessage || commitMessage.trim() === '') {
             setError("Commit message cannot be empty.");
             return;
        }
        if (!initialCode) {
             setError("No code content provided.");
             return;
        }
        if (!selectedRepoFullName || !accessToken) {
            setError("Repository or authentication missing.");
            return;
        }
        // --- End Validation ---

        setIsLoading(true); // Start loading for commit process
        const encodedContent = encodeBase64(initialCode);

        if (encodedContent === null) {
            setError("Failed to encode file content.");
            setIsLoading(false);
            return;
        }

        // Construct the full path
        const trimmedFileName = fileName.trim();
        const fullPath = selectedDirPath === '/'
            ? trimmedFileName // If root, path is just the filename
            : `${selectedDirPath}/${trimmedFileName}`; // Otherwise, combine dir path and filename

        const apiUrl = `${GITHUB_API_BASE}/repos/${selectedRepoFullName}/contents/${fullPath}`;
        const body = JSON.stringify({
            message: commitMessage.trim(),
            content: encodedContent,
        });

        try {
            console.log(`Attempting to create file at: ${apiUrl}`);
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: body,
            });

            if (!response.ok) {
                let errorMsg = `GitHub API Error (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg += `: ${errorData.message || 'Unknown GitHub error'}`;
                    if (response.status === 422 && errorData.message?.includes('sha')) {
                         errorMsg = `File already exists at "${fullPath}". Cannot create.`;
                    } // Add other specific error handling if needed
                } catch (e) { /* Ignore JSON parse error */ }
                throw new Error(errorMsg); // Throw to be caught below
            }

            const responseData = await response.json();
            console.log("File created successfully:", responseData);
            setIsLoading(false);
            onClose(true); // Close modal, signal success

        } catch (err) {
            console.error("Create File failed:", err);
            setError(err.message || "An unknown error occurred during file creation.");
            setIsLoading(false);
            // Keep modal open on error
        }
    };

    // --- JSX ---
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 transition-opacity duration-300 ease-in-out" aria-labelledby="createFileModalTitle" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 transform transition-all duration-300 ease-in-out sm:max-w-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 id="createFileModalTitle" className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <FiFilePlus className="mr-2" /> Create New File
                    </h3>
                    <button onClick={() => onClose(false)} disabled={isLoading} className="p-1 text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Close modal">
                        <FiX size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Directory Selector */}
                    <div>
                        <label htmlFor="directoryPath" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Directory <span className='text-red-500'>*</span>
                        </label>
                        <div className="flex items-center space-x-2">
                            <select
                                id="directoryPath"
                                name="directoryPath"
                                value={selectedDirPath}
                                onChange={(e) => setSelectedDirPath(e.target.value)}
                                disabled={isLoading || isFetchingDirs}
                                className={`flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-70 ${isFetchingDirs ? 'animate-pulse' : ''}`}
                            >
                                {isFetchingDirs && <option value="">Loading directories...</option>}
                                {!isFetchingDirs && directories.map(dir => (
                                    <option key={dir.path} value={dir.path}>{dir.name}</option>
                                ))}
                                {/* Handle case where no dirs are fetched except root */}
                                {!isFetchingDirs && directories.length === 1 && <option value={directories[0].path}>{directories[0].name}</option> }
                            </select>
                            <button
                                onClick={fetchDirectories}
                                disabled={isFetchingDirs || isLoading}
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                title="Refresh directories"
                            >
                                {isFetchingDirs ? <FiCpu className="animate-spin" size={16}/> : <FiRefreshCw size={16}/>}
                            </button>
                        </div>
                         {dirsError && (
                              <p className="text-xs text-red-500 mt-1 flex items-center">
                                  <FiAlertCircle size={14} className="mr-1"/> {dirsError}
                              </p>
                         )}
                    </div>

                    {/* File Name Input */}
                    <div>
                        <label htmlFor="fileName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            File Name <span className='text-red-500'>*</span>
                        </label>
                        <input
                            ref={fileNameInputRef}
                            type="text"
                            id="fileName"
                            name="fileName"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            disabled={isLoading}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-70"
                            placeholder="e.g., MyNewComponent.jsx"
                            required
                        />
                         {!isValidFilename(fileName) && fileName && ( // Show validation warning inline
                             <p className="text-xs text-yellow-600 mt-1">Filename should not contain slashes.</p>
                         )}
                    </div>

                    {/* Commit Message Input */}
                    <div>
                        <label htmlFor="commitMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Commit Message <span className='text-red-500'>*</span>
                        </label>
                        <input
                            type="text"
                            id="commitMessage"
                            name="commitMessage"
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile(); }}
                            disabled={isLoading}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-70"
                            placeholder="Enter commit message..."
                            required
                        />
                    </div>

                    {/* Code Preview (Optional, simple version - unchanged) */}
                     <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Code Preview </label>
                          <pre className="text-xs p-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 max-h-32 overflow-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                              {initialCode || '(No code provided)'}
                          </pre>
                     </div>

                    {/* Error Display Area for commit/validation errors */}
                    {error && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600/30 rounded-md text-sm text-red-700 dark:text-red-300 flex items-start">
                            <FiAlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-x-3">
                    <button type="button" onClick={() => onClose(false)} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateFile}
                        disabled={isLoading || !isValidFilename(fileName) || !commitMessage.trim()} // Disable if loading or invalid inputs
                        className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? ( <><FiCpu className="animate-spin -ml-1 mr-2 h-4 w-4" /> Creating...</> )
                                   : ( <><FiFilePlus className="-ml-1 mr-2 h-4 w-4" /> Create File</> )
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateFileModal;