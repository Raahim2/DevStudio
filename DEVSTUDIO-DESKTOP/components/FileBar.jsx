import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Buffer } from 'buffer'; // Or use window.btoa/atob if Buffer isn't readily available/configured
import { FiFolder, FiFile, FiLoader, FiAlertCircle, FiArrowLeft, FiMoreHorizontal, FiTrash2, FiFilePlus, FiX } from 'react-icons/fi';
import { useGitHubApi } from '../hooks/useGitHubApi'; // Adjust path if necessary

//-----------------------------------------------------------------------------
// Helper function to get the correct icon based on item type
//-----------------------------------------------------------------------------
const getIcon = (type) => {
  return type === 'dir'
    ? <FiFolder size={16} className="flex-shrink-0 text-blue-500 dark:text-blue-400" />
    : <FiFile size={16} className="flex-shrink-0 text-gray-600 dark:text-gray-400" />;
};

//-----------------------------------------------------------------------------
// Simple Context Menu Component (Positioned relative to parent)
//-----------------------------------------------------------------------------
const ContextMenu = ({ onClose, children }) => {
    const menuRef = useRef(null);

    // Close menu if clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click is outside the menu itself
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        // Use mousedown to catch clicks before potential button clicks inside the menu might remove it
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            // Position relative to the parent list item (which needs `position: relative`)
            // top-full places it below, right-1 aligns near the trigger button, mt-1 adds margin
            className="absolute top-full right-1 mt-1 z-20 py-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600"
            // Prevent click on menu itself from propagating to the list item and potentially closing it
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );
};


//-----------------------------------------------------------------------------
// Main FileBar Component
//-----------------------------------------------------------------------------
const FileBar = ({ selectedRepo, onFileSelect, selectedFile, onFileContentLoaded, accessToken }) => {
    const [contents, setContents] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [isDirLoading, setIsDirLoading] = useState(false);
    const [dirError, setDirError] = useState(null);

    // State for hover and context menu
    const [hoveredItemPath, setHoveredItemPath] = useState(null);
    const [contextMenuPath, setContextMenuPath] = useState(null); // Path of item whose menu is open

    // State for Inline File Creation
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [newFilename, setNewFilename] = useState('');
    const createInputRef = useRef(null); // Ref for the create input field

    // --- GitHub API Hook ---
    const {
        isOperating,         // Loading state for C/U/D
        operationError,      // Error state for C/U/D
        operationSuccess,    // Success state for C/U/D (optional feedback)
        createFile,
        deleteFile,
        clearOperationError, // Function to clear API errors
    } = useGitHubApi(accessToken, selectedRepo); // Pass token and repo

    // --- Fetch Directory Contents (Refreshes UI) ---
    const fetchDirectoryContents = useCallback(async (path, forceRefresh = false) => {
        if (typeof path !== 'string') {
            console.error("fetchDirectoryContents called with invalid path:", path);
            setDirError("Internal error: Invalid path requested.");
            setIsDirLoading(false);
            return;
        }
        if (!selectedRepo) {
            setContents([]);
            setDirError(null);
            return;
        }

        setIsDirLoading(true);
        setDirError(null);
        if (path !== currentPath || forceRefresh) {
            setContents([]); // Clear contents if path changes or refresh forced
        }

        // Add cache-busting parameter if forcing refresh
        const cacheBuster = forceRefresh ? `&t=${Date.now()}` : '';
        // Use HEAD ref to ensure fetching the latest commit on the default branch
        const apiUrl = `https://api.github.com/repos/${selectedRepo}/contents/${path}?ref=HEAD${cacheBuster}`;
        const headers = {
            Accept: 'application/vnd.github.v3+json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) // Use Bearer token
        };

        try {
            const response = await fetch(apiUrl, { headers });

            if (!response.ok) {
                let errorMsg = `GitHub API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg += ` - ${errorData.message || 'No details.'}`;
                    if (response.status === 404) errorMsg = `Repo/path not found: ${selectedRepo}/${path || '[root]'}`;
                    if (response.status === 403) errorMsg = accessToken ? `Access forbidden. Check token/permissions.` : `Access forbidden. Private repo/rate limit?`;
                    if (response.status === 401) errorMsg = `Authentication failed. Check token.`;
                } catch (e) { /* Ignore if response body isn't JSON */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            // Ensure data is an array before sorting (GitHub might return single object for file path)
            const sortedData = Array.isArray(data) ? data.sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir') return -1; // Dirs first
                if (a.type !== 'dir' && b.type === 'dir') return 1;  // Files after dirs
                return a.name.localeCompare(b.name); // Sort alphabetically within type
            }) : []; // If not an array (e.g., error or single file), result in empty array

            setContents(sortedData);
            setCurrentPath(path); // Update current path *after* successful fetch

        } catch (err) {
            console.error(`FileBar Dir Fetch Error for Path="${path}":`, err);
            setDirError(err.message || 'Failed to fetch directory contents.');
            setContents([]); // Clear contents on error
        } finally {
            setIsDirLoading(false);
        }
    }, [selectedRepo, accessToken, currentPath]); // currentPath dependency is needed

    // --- Fetch File Content ---
    const fetchFileContent = useCallback(async (file) => {
        if (!file || !file.path || !selectedRepo) {
            console.warn("fetchFileContent called without necessary info", { file, selectedRepo });
            onFileContentLoaded(null, 'Missing file information to fetch content.', null);
            return;
        }

        // Use HEAD ref for latest version
        const apiUrl = `https://api.github.com/repos/${selectedRepo}/contents/${file.path}?ref=HEAD`;
        const headers = {
            Accept: 'application/vnd.github.v3+json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) // Use Bearer token
        };

        try {
            const response = await fetch(apiUrl, { headers });

            if (!response.ok) {
                let errorMsg = `Error fetching file: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.message) errorMsg += ` - ${errorData.message}`;
                    if (response.status === 404) errorMsg = `File not found: ${selectedRepo}/${file.path}`;
                    if (response.status === 403 && errorData.message?.includes('larger than')) {
                        const sizeMatch = errorData.message.match(/is (\d+(\.\d+)?) ([KMG]B)/);
                        const sizeInfo = sizeMatch ? `(${sizeMatch[1]} ${sizeMatch[3]})` : '(large file)';
                        errorMsg = `File too large ${sizeInfo}. GitHub API limit (1MB).`;
                    } else if (response.status === 403) {
                        errorMsg = accessToken ? `Access forbidden. Check token/permissions.` : `Access forbidden. Private repo?`;
                    } else if (response.status === 401) {
                        errorMsg = `Auth failed. Check token.`;
                    }
                } catch (e) { /* Ignore non-JSON response body */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            // Validate response structure
            if (data.type !== 'file' || typeof data.content !== 'string') {
                 if (data.type === 'submodule') throw new Error(`Cannot display content: '${file.name}' is a submodule.`);
                 if (data.type === 'dir') throw new Error(`Path points to a directory.`);
                 // Handle cases like symlinks if necessary, otherwise treat as error
                 throw new Error(`Path exists but is not a file or content missing.`);
            }
            if (data.encoding !== 'base64') {
                throw new Error(`Unexpected encoding: ${data.encoding}. Expected base64.`);
            }

            // Decode Base64 content
            let decodedContent;
            if (typeof Buffer !== 'undefined') {
                decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
            } else {
                // Fallback for environments without Buffer (e.g., strict browser)
                try {
                     // This fallback might have issues with complex UTF-8 characters
                     decodedContent = decodeURIComponent(escape(window.atob(data.content)));
                } catch(e) {
                     console.error("Base64 decoding failed:", e);
                     throw new Error("Failed to decode file content.");
                }
            }

            // Success: Pass content AND sha
            onFileContentLoaded(decodedContent, null, data.sha);

        } catch (err) {
            console.error("Error fetching file content for path:", file.path, err);
            // Failure: Pass null content, error message, and null sha
            onFileContentLoaded(null, err.message || 'Failed to fetch file content.', null);
        }
    }, [selectedRepo, accessToken, onFileContentLoaded]);


    // --- Effect for Initial Load / Repo Change ---
    useEffect(() => {
        // Reset component state when the selected repository changes
        setContents([]);
        setDirError(null);
        setIsDirLoading(false);
        setHoveredItemPath(null);
        setContextMenuPath(null);
        setIsCreatingFile(false); // Reset creation state
        setNewFilename('');      // Reset filename input
        clearOperationError(); // Clear any lingering errors from the hook
        if (selectedRepo) {
            fetchDirectoryContents(''); // Fetch root of the new repo
        } else {
             setCurrentPath(''); // Clear path if no repo is selected
        }
    // Adding fetchDirectoryContents/clearOperationError might cause loops if they aren't stable.
    // Since they come from useCallback, they should be stable unless their own deps change.
    // Relying on selectedRepo as the primary trigger is usually sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRepo]);

    // --- Effect to focus the input when creation starts ---
    useEffect(() => {
        if (isCreatingFile && createInputRef.current) {
            createInputRef.current.focus();
            createInputRef.current.select(); // Select text for easy overwrite
        }
    }, [isCreatingFile]);

    // --- Navigation Handlers ---
    const handleDirectoryClick = useCallback((itemPath) => {
        if (isDirLoading || isOperating) return; // Prevent navigation while busy
        fetchDirectoryContents(itemPath);
    }, [isDirLoading, isOperating, fetchDirectoryContents]);

    const handleFileClick = useCallback((file) => {
        if (isDirLoading || isOperating) return; // Prevent selection while busy
        if (onFileSelect) {
            fetchFileContent(file); // Fetch content when selected

            // Pass the full file object including SHA, needed for updates/deletes later
            onFileSelect({ path: file.path, name: file.name, sha: file.sha });
        }
    }, [isDirLoading, isOperating, onFileSelect, fetchFileContent]);

    const handleGoUp = useCallback(() => {
        if (isDirLoading || isOperating) return;
        const lastSlashIndex = currentPath.lastIndexOf('/');
        const parentPath = lastSlashIndex >= 0 ? currentPath.substring(0, lastSlashIndex) : '';
        fetchDirectoryContents(parentPath);
    }, [isDirLoading, isOperating, currentPath, fetchDirectoryContents]);

    // --- UI Interaction Handlers (Hover, Context Menu) ---
    const handleMouseEnter = useCallback((path) => {
        setHoveredItemPath(path);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Don't hide hover effect if the context menu is open for the item being left
         if (contextMenuPath !== hoveredItemPath) {
             setHoveredItemPath(null);
        }
    }, [contextMenuPath, hoveredItemPath]);

    // Open/Close context menu for a specific item path
    const toggleContextMenu = useCallback((e, path) => {
        e.stopPropagation(); // Prevent triggering file/folder click
        setContextMenuPath(prevPath => (prevPath === path ? null : path)); // Toggle open/close for this path
        setHoveredItemPath(path); // Ensure hover state is active when menu opens
    }, []); // No external dependencies needed

    const closeContextMenu = useCallback(() => {
        if (contextMenuPath) { // Only update state if a menu is actually open
             setContextMenuPath(null);
        }
        // Always clear hover when explicitly closing (e.g., via click outside or action)
        setHoveredItemPath(null);
    }, [contextMenuPath]); // Depends on contextMenuPath to avoid unnecessary state sets

    // --- Delete Action ---
    const handleDeleteClick = useCallback(async (item) => {
        closeContextMenu(); // Close menu immediately
        if (!item || !item.path || !item.sha) {
             console.error("Delete failed: Invalid item data provided", item);
             alert("Error: Cannot delete item - missing required information (path or SHA).");
             return;
        }

        const confirmDelete = window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`);
        if (confirmDelete) {
            clearOperationError(); // Clear previous API errors
            const commitMessage = `chore: delete file ${item.name}`; // Standard commit message
            console.log(`Attempting to delete: ${item.path} with SHA: ${item.sha}`);
            const result = await deleteFile(item.path, item.sha, commitMessage);

            if (result.success) {
                console.log(`Successfully deleted ${item.path}`);
                // Refresh the current directory view forcefully
                fetchDirectoryContents(currentPath, true);

                // If the deleted file was the currently selected file, clear the selection and content view
                if (selectedFile && selectedFile.path === item.path) {
                    onFileSelect(null); // Clear selection in parent component
                    onFileContentLoaded(null, null, null); // Clear content and SHA in parent
                }
            } else {
                // Error state is set by the hook, show alert to user
                alert(`Failed to delete file: ${operationError || result.error || 'Unknown error'}`);
            }
        }
    }, [
        closeContextMenu, clearOperationError, deleteFile, fetchDirectoryContents,
        currentPath, selectedFile, onFileSelect, onFileContentLoaded, operationError
    ]); // Ensure all dependencies are listed

    // --- Create File Logic Handlers ---

    // 1. Start Creation Process (Plus button click)
    const startCreateFile = useCallback(() => {
        if (isOperating || isDirLoading) return; // Prevent action if already busy
        closeContextMenu(); // Ensure no context menu is open
        setNewFilename(''); // Reset input field value
        setIsCreatingFile(true); // Show the input field UI
        // Focus is handled by the useEffect hook reacting to isCreatingFile
    }, [isOperating, isDirLoading, closeContextMenu]);

    // 2. Cancel Creation (Escape key or Blur)
    const cancelCreateFile = useCallback(() => {
        setIsCreatingFile(false);
        setNewFilename('');
    }, []);

    // 3. Confirm Creation (Enter key in input)
    const confirmCreateFile = useCallback(async () => {
        if (isOperating) return; // Prevent double submission if already operating

        const trimmedFilename = newFilename.trim();

        // --- Input Validation ---
        if (!trimmedFilename) {
            // Silently cancel if name is empty after trimming
            cancelCreateFile();
            return;
        }
        if (trimmedFilename.includes('/') || trimmedFilename.includes('\\')) {
            alert("Filename cannot contain slashes.");
            createInputRef.current?.select(); // Keep focus for correction
            return;
        }
        // Basic check if file with the same name already exists in the *currently displayed* list
        if (contents.some(item => item.name.toLowerCase() === trimmedFilename.toLowerCase() && item.type === 'file')) {
             alert(`File "${trimmedFilename}" already exists in this directory.`);
             createInputRef.current?.select(); // Keep focus for correction
             return;
        }

        // --- Prepare API Call ---
        clearOperationError(); // Clear previous errors
        const newFilePath = currentPath ? `${currentPath}/${trimmedFilename}` : trimmedFilename;
        const commitMessage = `feat: create file ${trimmedFilename}`;
        const initialContent = trimmedFilename; // Content is the filename itself

        console.log(`Attempting to create file: ${newFilePath} with content: "${initialContent}"`);
        const result = await createFile(newFilePath, initialContent, commitMessage);

        // --- Handle API Result ---
        if (result.success) {
            setIsCreatingFile(false); // Hide input on success
            setNewFilename('');
            fetchDirectoryContents(currentPath, true); // Force refresh the directory view

            const newFileSha = result.data?.content?.sha;
             // Auto-select the newly created file after refresh potentially settles
            if (newFileSha) {
                 const newFileItem = { path: newFilePath, name: trimmedFilename, sha: newFileSha, type: 'file' };
                 // Use a slight delay to increase chance that fetchDirectoryContents updates state first
                 setTimeout(() => handleFileClick(newFileItem), 150);
            }
        } else {
            // More specific error handling based on observed GitHub responses
            let displayError = operationError || result.error || 'Unknown error';
             if (displayError.includes('422') && displayError.toLowerCase().includes('sha parameter must be')) {
                 // This usually means the PUT tried to overwrite an existing file without providing the correct SHA
                 displayError = `File "${trimmedFilename}" already exists.`;
             } else if (displayError.includes('422')) {
                 // Generic 422 could be invalid characters, path issues etc.
                 displayError = `Could not create file "${trimmedFilename}". (Check name/permissions).`;
             } else if (displayError.includes('409')) {
                 // Conflict usually means the branch ref was updated since the last fetch
                 displayError = `Conflict creating file "${trimmedFilename}". Branch may have been updated.`;
             }
             alert(`Failed to create file: ${displayError}`);
             // Keep the input open and selected on error for correction
             createInputRef.current?.select();
        }
    }, [
        isOperating, newFilename, cancelCreateFile, contents, clearOperationError,
        currentPath, createFile, fetchDirectoryContents, handleFileClick, operationError
    ]); // Ensure all dependencies are listed

    // 4. Input KeyDown Handler (Enter/Escape)
    const handleCreateInputKeyDown = useCallback((event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission behavior
            confirmCreateFile();
        } else if (event.key === 'Escape') {
            event.preventDefault(); // Prevent potentially closing modals etc.
            cancelCreateFile();
        }
    }, [confirmCreateFile, cancelCreateFile]);

     // 5. Input Blur Handler (Clicking away)
     const handleCreateInputBlur = useCallback(() => {
         // Use a small delay to allow Enter key press to potentially set isOperating
         // before the blur event cancels the operation.
         setTimeout(() => {
              // Only cancel if we are still in creating mode AND no API operation started
              if (isCreatingFile && !isOperating) {
                  console.log("Blur detected, cancelling file creation.");
                  cancelCreateFile();
              }
         }, 150); // Adjust delay if needed
     }, [isCreatingFile, isOperating, cancelCreateFile]);


    // --- Memoized Repo Name/Owner ---
    const { repoOwner, repoName } = useMemo(() => {
        if (!selectedRepo || typeof selectedRepo !== 'string') return { repoOwner: null, repoName: null };
        const parts = selectedRepo.split('/');
        return parts.length === 2 ? { repoOwner: parts[0], repoName: parts[1] } : { repoOwner: null, repoName: null };
    }, [selectedRepo]);

    // --- Render Component UI ---
    return (
        <div className="w-64 bg-gray-100 dark:bg-gray-800 flex flex-col h-full border-r border-gray-300 dark:border-gray-700 flex-shrink-0">
            {/* Header Section */}
            <div className="p-2 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between space-x-1 text-xs text-gray-600 dark:text-gray-400 min-h-[40px]">
                {/* Left: Navigation (Go Up Button + Path) */}
                 <div className="flex items-center space-x-1 overflow-hidden">
                    {selectedRepo && currentPath && (
                        <button
                            onClick={handleGoUp}
                            title="Go up one level"
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isDirLoading || isOperating}
                        >
                            <FiArrowLeft size={14} />
                        </button>
                    )}
                    <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                        {repoName ? `${repoOwner}/${repoName}` : selectedRepo || 'No Repo Selected'}
                    </span>
                    {/* Display current path only if not root */}
                    {selectedRepo && currentPath && <span className="truncate text-gray-500 dark:text-gray-400">/{currentPath}</span>}
                </div>
                {/* Right: Create File Button (shown only when repo selected and not currently creating) */}
                {selectedRepo && !isCreatingFile && (
                    <button
                        onClick={startCreateFile}
                        title="Create new file in current directory"
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isDirLoading || isOperating} // Disable if loading or operating
                    >
                        <FiFilePlus size={16} className="text-green-600 dark:text-green-500" />
                    </button>
                )}
            </div>

             {/* API Operation Status Area (Loading / Error) */}
            {isOperating && (
                 <div className="p-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center animate-pulse">
                    <FiLoader size={14} className="animate-spin mr-2" /> Processing...
                </div>
            )}
            {operationError && !isOperating && ( // Show error only when not operating
                <div className="p-2 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 break-words mr-1"> {/* Added mr-1 */}
                         <FiAlertCircle size={16} className="flex-shrink-0 text-red-500 dark:text-red-400" />
                         <span className="flex-1">{operationError}</span> {/* Added flex-1 */}
                    </div>
                    {/* Button to clear the error message */}
                    <button onClick={clearOperationError} title="Dismiss error" className="p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 flex-shrink-0">
                       <FiX size={14} />
                    </button>
                </div>
            )}
             {/* Optional Success Feedback (auto-hides via hook) */}
             {/* {operationSuccess && <div className="p-1 text-center text-xs text-green-600 dark:text-green-400">Success!</div>} */}


            {/* File/Folder List Area */}
            <div className="flex-grow overflow-y-auto p-1 space-y-px relative">
                {/* --- Inline Create File Input --- */}
                {isCreatingFile && (
                    <div className="flex items-center p-1.5 space-x-2 bg-white dark:bg-gray-700 rounded-md border border-blue-500 dark:border-blue-600 ring-1 ring-blue-500"> {/* Added ring for visibility */}
                        <FiFile size={16} className="flex-shrink-0 text-gray-600 dark:text-gray-400 ml-0.5" /> {/* Added ml */}
                        <input
                            ref={createInputRef}
                            type="text"
                            value={newFilename}
                            onChange={(e) => setNewFilename(e.target.value)}
                            onKeyDown={handleCreateInputKeyDown}
                            onBlur={handleCreateInputBlur} // Use blur to cancel
                            placeholder="Enter filename..."
                            className="flex-grow bg-transparent text-sm outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 py-0.5" // Added padding
                            disabled={isOperating} // Disable input while API call is running
                            aria-label="New file name"
                        />
                    </div>
                )}

                {/* --- Directory Loading Indicator --- */}
                {isDirLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/50 z-10">
                        <FiLoader size={24} className="animate-spin text-blue-500 dark:text-blue-400" />
                    </div>
                )}

                {/* --- Directory Fetch Error Message --- */}
                {!isDirLoading && dirError && (
                    <div className="flex items-start gap-2 p-3 m-2 border border-red-300 dark:border-red-500 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-md text-sm break-words">
                        <FiAlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
                        <span>{dirError}</span>
                    </div>
                )}

                {/* --- Placeholder Messages (No Repo / Empty Dir) --- */}
                {!isDirLoading && !dirError && !isCreatingFile && !selectedRepo && ( <div className="text-center text-gray-500 dark:text-gray-400 text-sm p-4 mt-4">Select a repository to view files.</div> )}
                {!isDirLoading && !dirError && !isCreatingFile && selectedRepo && contents.length === 0 && !currentPath && ( <div className="text-center text-gray-500 dark:text-gray-400 text-sm p-4 mt-4">Repository root is empty.</div> )}
                {!isDirLoading && !dirError && !isCreatingFile && selectedRepo && contents.length === 0 && currentPath && ( <div className="text-center text-gray-500 dark:text-gray-400 text-sm p-4 mt-4">This directory is empty.</div> )}

                {/* --- File and Folder List Items --- */}
                {!isDirLoading && !dirError && selectedRepo && contents.length > 0 && contents.map((item) => {
                    const isSelected = selectedFile && item.type === 'file' && item.path === selectedFile.path;
                    const isHovered = hoveredItemPath === item.path;
                    const isMenuOpen = contextMenuPath === item.path;
                    // Disable clicks if *anything* is loading/operating OR if create input is active
                    const isClickable = !isDirLoading && !isOperating && !isCreatingFile;

                    return (
                        // Add position: relative for the context menu positioning context
                        <div
                            key={item.sha || item.path} // Use unique key
                            title={item.name}
                            className={`
                                group flex justify-between items-center p-1.5 rounded-md text-sm relative
                                text-gray-700 dark:text-gray-300
                                ${isClickable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : 'cursor-default'}
                                ${item.type === 'dir' ? 'font-medium' : ''}
                                ${isSelected ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''}
                                ${!isClickable ? 'opacity-60' : ''}
                                ${isMenuOpen ? 'bg-gray-200 dark:bg-gray-700' : ''} /* Optional highlight */
                            `}
                            // Attach click handlers only if clickable
                            onClick={ isClickable ? (item.type === 'dir' ? () => handleDirectoryClick(item.path) : () => handleFileClick(item)) : undefined }
                            onMouseEnter={isClickable ? () => handleMouseEnter(item.path) : undefined} // Only track hover if clickable
                            onMouseLeave={isClickable ? handleMouseLeave : undefined} // Only track leave if clickable
                        >
                            {/* Left side: Icon and Name */}
                            <div className="flex items-center space-x-2 overflow-hidden pr-4"> {/* Padding prevents overlap with button */}
                                {getIcon(item.type)}
                                <span className="truncate">{item.name}</span>
                            </div>

                            {/* Right side: More Options Button (Files only, shown on hover or if menu open) */}
                             {item.type === 'file' && isClickable && (isHovered || isMenuOpen) && (
                                <button
                                    onClick={(e) => toggleContextMenu(e, item.path)}
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 z-10"
                                    title="More options"
                                >
                                    <FiMoreHorizontal size={16} />
                                </button>
                            )}

                            {/* Context Menu (Rendered inside the item div when open) */}
                             {isMenuOpen && (
                                <ContextMenu onClose={closeContextMenu}>
                                     <button
                                        onClick={() => handleDeleteClick(item)} // Pass the full item object
                                        disabled={isOperating} // Disable delete action if another operation is running
                                        className="flex items-center w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FiTrash2 size={14} className="mr-2" />
                                        Delete
                                    </button>
                                    {/* Add other menu items here (Rename, etc.) */}
                                </ContextMenu>
                            )}
                        </div>
                    );
                })}
            </div> {/* End File/Folder List Area */}
        </div> // End Main Component Div
    );
};

export default FileBar;