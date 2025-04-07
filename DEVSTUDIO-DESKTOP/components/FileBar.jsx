import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Buffer } from 'buffer';
import { FiFolder, FiFile, FiLoader, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';

// Helper function to get the correct icon based on item type
const getIcon = (type) => {
  return type === 'dir' ? <FiFolder size={16} className="flex-shrink-0 text-blue-500 dark:text-blue-400" /> : <FiFile size={16} className="flex-shrink-0 text-gray-600 dark:text-gray-400" />;
};

const FileBar = ({ selectedRepo, onFileSelect, selectedFile, onFileContentLoaded , accessToken }) => {

  const [contents, setContents] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isDirLoading, setIsDirLoading] = useState(false); // Loading state for directory listing
  const [dirError, setDirError] = useState(null); // Error state for directory listing

  // --- Fetch Directory Contents ---
  const fetchDirectoryContents = useCallback(async (path) => {
    if (typeof path !== 'string') {
        console.error("fetchDirectoryContents called with invalid path:", path);
        setDirError("Internal error: Invalid path requested.");
        setIsDirLoading(false); // Ensure loading state is reset
        return;
    }
    if (!selectedRepo) {
      setContents([]);
      setDirError(null); // Clear any previous error
      return;
    }

    setIsDirLoading(true);
    setDirError(null);
    setContents([]); // Clear current contents before fetching new ones

    const apiUrl = `https://api.github.com/repos/${selectedRepo}/contents/${path}`;
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      // Conditionally add Authorization header if accessToken is provided
      ...(accessToken ? { Authorization: `token ${accessToken}` } : {})
    };

    try {
      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        let errorMsg = `GitHub API Error: ${response.status} ${response.statusText}`;
         try {
           const errorData = await response.json();
           errorMsg += ` - ${errorData.message || 'No details provided.'}`;
           if (response.status === 404) errorMsg = `Repo/path not found: ${selectedRepo}/${path}`;
           if (response.status === 403) {
               errorMsg = accessToken
                 ? `Access forbidden. Check token permissions or repo access.`
                 : `Access forbidden. Private repo or rate limit exceeded? Provide an access token for private repos.`;
           }
           if (response.status === 401) {
               errorMsg = `Authentication failed. Check if the provided access token is valid and has 'repo' scope.`;
           }
         } catch (e) { /* Ignore if response body isn't JSON */ }
        console.error(`FileBar Dir Fetch Error for Path="${path}": ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      // Ensure data is an array before sorting (GitHub API returns object for single file paths)
      const sortedData = Array.isArray(data) ? data.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      }) : []; // If not an array (e.g., error or single item response), default to empty

       setContents(sortedData);

    } catch (err) {
      console.error(`FileBar Dir Exception during fetch for Path="${path}":`, err);
      setDirError(err.message || 'Failed to fetch directory contents.');
      setContents([]); // Clear contents on error
    } finally {
       setIsDirLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, accessToken]); // Recreate fetcher if selectedRepo or accessToken changes


  // --- Fetch File Content ---
  const fetchFileContent = useCallback(async (file) => {
      if (!file || !file.path || !selectedRepo) {
          console.warn("fetchFileContent called without necessary info", { file, selectedRepo });
          onFileContentLoaded(null, 'Missing file information to fetch content.');
          return;
      }

      // We now rely solely on the accessToken prop.
      // If it's not provided, the fetch will proceed without Authorization,
      // which works for public repos but will fail for private ones.
      // No need to check sessionStatus anymore.

      const apiUrl = `https://api.github.com/repos/${selectedRepo}/contents/${file.path}`;

      const headers = {
          Accept: 'application/vnd.github.v3+json',
          // Conditionally add Authorization header
          ...(accessToken ? { Authorization: `token ${accessToken}` } : {})
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
                       errorMsg = accessToken
                         ? `Access forbidden to file. Check token permissions or repo access.`
                         : `Access forbidden. Is the repository private? Provide an access token.`;
                   } else if (response.status === 401) {
                       errorMsg = `Authentication failed. Check if the provided access token is valid and has 'repo' scope.`;
                   }
              } catch (e) { /* Ignore non-JSON response body */ }
              throw new Error(errorMsg);
          }

          const data = await response.json();

          // Check if the response is actually a file and has content
          if (data.type !== 'file' || typeof data.content !== 'string') {
              // Handle cases where the path might be a submodule or something unexpected
              if (data.type === 'submodule') {
                 throw new Error(`Cannot display content: '${file.name}' is a submodule.`);
              }
               if (data.type === 'dir') {
                 throw new Error(`Path points to a directory, not a file.`);
              }
              throw new Error(`Path exists but is not a file or content is missing.`);
          }
          if (data.encoding !== 'base64') {
              // GitHub API primarily uses base64 for file content via this endpoint
              throw new Error(`Unexpected encoding: ${data.encoding}. Expected base64.`);
          }

          const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
          onFileContentLoaded(decodedContent, null); // Success: content, no error

      } catch (err) {
          console.error("Error fetching file content:", err);
          onFileContentLoaded(null, err.message || 'Failed to fetch file content.'); // Failure: null content, error message
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, accessToken, onFileContentLoaded]); // Dependencies now include accessToken prop


  // --- Effect for Initial Load / Repo Change ---
  useEffect(() => {
    // Reset state when the selected repository changes
    setCurrentPath('');
    setContents([]);
    setDirError(null);
    setIsDirLoading(false);
    // Trigger fetch for the root directory if a repo is selected
    if (selectedRepo) {
      fetchDirectoryContents('');
    }
    // Intentionally *not* including fetchDirectoryContents in deps here,
    // as we only want this specific effect to run on selectedRepo change.
    // The fetchDirectoryContents callback itself depends on accessToken and handles it.
  }, [selectedRepo]); // Only re-run when selectedRepo changes


  // --- Click Handlers ---
  const handleDirectoryClick = (itemPath) => {
    setCurrentPath(itemPath);
    fetchDirectoryContents(itemPath); // fetchDirectoryContents uses the latest accessToken via useCallback
  };

  const handleFileClick = (file) => {
    if (onFileSelect) {
      // 1. Tell parent which file is selected (updates UI immediately)
      onFileSelect({ path: file.path, name: file.name, sha: file.sha });
      // 2. Start fetching the content for this file
      fetchFileContent(file); // fetchFileContent uses the latest accessToken via useCallback
    } else {
      console.warn("FileBar: onFileSelect prop is missing!");
    }
  };

  const handleGoUp = () => {
    const lastSlashIndex = currentPath.lastIndexOf('/');
    const parentPath = lastSlashIndex >= 0 ? currentPath.substring(0, lastSlashIndex) : '';
    setCurrentPath(parentPath);
    fetchDirectoryContents(parentPath); // fetchDirectoryContents uses the latest accessToken via useCallback
  };

  // --- Render Logic ---
  // Memoize repo owner/name calculation
  const { repoOwner, repoName } = useMemo(() => {
      if (!selectedRepo || typeof selectedRepo !== 'string') {
          return { repoOwner: null, repoName: null };
      }
      const parts = selectedRepo.split('/');
      return parts.length === 2 ? { repoOwner: parts[0], repoName: parts[1] } : { repoOwner: null, repoName: null };
  }, [selectedRepo]);


  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 flex flex-col h-full border-r border-gray-300 dark:border-gray-700 flex-shrink-0">
      {/* Header */}
      <div className="p-2 border-b border-gray-300 dark:border-gray-700 flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400 min-h-[37px]">
        {/* Show "Go Up" button only if not at the root and a repo is selected */}
        {selectedRepo && currentPath && (
          <button
            onClick={handleGoUp}
            title="Go up one level"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDirLoading} // Disable while loading directory contents
          >
            <FiArrowLeft size={14} />
          </button>
        )}
        {/* Display Repo Name and Path */}
        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
          {/* Show repo owner/name if parsed, otherwise show full selectedRepo or placeholder */}
          {repoName ? `${repoOwner}/${repoName}` : selectedRepo || 'No Repo Selected'}
        </span>
        {/* Show current path only if not at the root */}
        {selectedRepo && currentPath && <span className="truncate text-gray-500 dark:text-gray-400">/{currentPath}</span>}
      </div>

      {/* File/Folder List Area */}
      <div className="flex-grow overflow-y-auto p-2 space-y-1 relative">
        {/* Loading Spinner Overlay */}
        {isDirLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/50 z-10">
            <FiLoader size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Error Message Display */}
        {!isDirLoading && dirError && (
          <div className="error-msg">
            <FiAlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{dirError}</span>
          </div>
        )}

        {/* Placeholder Messages */}
        {!isDirLoading && !dirError && !selectedRepo && (
          <div className="msg">Please select a repository.</div>
        )}

        {/* Empty Directory/Repo Messages */}
        {!isDirLoading && !dirError && selectedRepo && contents.length === 0 && !currentPath && (
             <div className="msg">Repository root is empty or inaccessible.</div>
        )}
        {!isDirLoading && !dirError && selectedRepo && contents.length === 0 && currentPath && (
             <div className="msg">Directory is empty.</div>
        )}

        {/* File and Folder List Items */}
        {!isDirLoading && !dirError && selectedRepo && contents.length > 0 && contents.map((item) => {
          const isSelected = selectedFile && item.type === 'file' && item.path === selectedFile.path;
          const isClickable = !isDirLoading; // Items are clickable only when not loading directory

          return (
            <div
              key={item.sha || item.path} // Use path as fallback key if sha missing (unlikely but safe)
              title={item.name}
              className={`
                group flex justify-between items-center p-2 rounded-md text-sm
                text-gray-700 dark:text-gray-300
                ${isClickable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700' : 'cursor-default'}
                ${item.type === 'dir' ? 'font-medium' : ''}
                ${isSelected ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''}
                ${!isClickable ? 'opacity-50' : ''}
              `}
              onClick={
                isClickable // Only attach onClick handler if clickable
                  ? item.type === 'dir'
                    ? () => handleDirectoryClick(item.path)
                    : () => handleFileClick(item)
                  : undefined // No action if not clickable
              }
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                {getIcon(item.type)}
                <span className="truncate">{item.name}</span>
              </div>
              {/* Removed per-file loading indicator as it wasn't part of original request */}
            </div>
          );
        })}
      </div>

      {/* Helper styles (scoped CSS using styled-jsx) */}
      <style jsx>{`
        .msg { text-align: center; color: #6b7280; font-size: 0.875rem; padding: 1rem; margin-top: 1rem; }
        .dark .msg { color: #9ca3af; }
        .error-msg { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem; margin: 0.5rem; border: 1px solid #fca5a5; background-color: #fee2e2; color: #b91c1c; border-radius: 0.375rem; font-size: 0.875rem; word-break: break-word; }
        .dark .error-msg { border-color: #ef4444; background-color: #450a0a; color: #fca5a5; }
      `}</style>
    </div>
  );
};

export default FileBar;