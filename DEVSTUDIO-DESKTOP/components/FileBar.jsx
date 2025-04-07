import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Buffer } from 'buffer';
import { FiFolder, FiFile, FiLoader, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';

// Helper function to get the correct icon based on item type
// We keep the dark: prefix here as it's concise for the icon color change
// and works well with the standard Tailwind dark mode setup.
const getIcon = (type) => {
  return type === 'dir'
    ? <FiFolder size={16} className="flex-shrink-0 text-blue-500 dark:text-blue-400" />
    : <FiFile size={16} className="flex-shrink-0 text-gray-600 dark:text-gray-400" />;
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
      const sortedData = Array.isArray(data) ? data.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      }) : [];

       setContents(sortedData);

    } catch (err) {
      console.error(`FileBar Dir Exception during fetch for Path="${path}":`, err);
      setDirError(err.message || 'Failed to fetch directory contents.');
      setContents([]); // Clear contents on error
    } finally {
       setIsDirLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, accessToken]);


  // --- Fetch File Content ---
  const fetchFileContent = useCallback(async (file) => {
      if (!file || !file.path || !selectedRepo) {
          console.warn("fetchFileContent called without necessary info", { file, selectedRepo });
          onFileContentLoaded(null, 'Missing file information to fetch content.');
          return;
      }

      const apiUrl = `https://api.github.com/repos/${selectedRepo}/contents/${file.path}`;
      const headers = {
          Accept: 'application/vnd.github.v3+json',
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

          if (data.type !== 'file' || typeof data.content !== 'string') {
              if (data.type === 'submodule') {
                 throw new Error(`Cannot display content: '${file.name}' is a submodule.`);
              }
               if (data.type === 'dir') {
                 throw new Error(`Path points to a directory, not a file.`);
              }
              throw new Error(`Path exists but is not a file or content is missing.`);
          }
          if (data.encoding !== 'base64') {
              throw new Error(`Unexpected encoding: ${data.encoding}. Expected base64.`);
          }

          const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
          onFileContentLoaded(decodedContent, null); // Success: content, no error

      } catch (err) {
          console.error("Error fetching file content:", err);
          onFileContentLoaded(null, err.message || 'Failed to fetch file content.'); // Failure: null content, error message
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, accessToken, onFileContentLoaded]);


  // --- Effect for Initial Load / Repo Change ---
  useEffect(() => {
    setCurrentPath('');
    setContents([]);
    setDirError(null);
    setIsDirLoading(false);
    if (selectedRepo) {
      fetchDirectoryContents('');
    }
  }, [selectedRepo]); // Only re-run when selectedRepo changes


  // --- Click Handlers ---
  const handleDirectoryClick = (itemPath) => {
    setCurrentPath(itemPath);
    fetchDirectoryContents(itemPath);
  };

  const handleFileClick = (file) => {
    if (onFileSelect) {
      onFileSelect({ path: file.path, name: file.name, sha: file.sha });
      fetchFileContent(file);
    } else {
      console.warn("FileBar: onFileSelect prop is missing!");
    }
  };

  const handleGoUp = () => {
    const lastSlashIndex = currentPath.lastIndexOf('/');
    const parentPath = lastSlashIndex >= 0 ? currentPath.substring(0, lastSlashIndex) : '';
    setCurrentPath(parentPath);
    fetchDirectoryContents(parentPath);
  };

  // --- Render Logic ---
  const { repoOwner, repoName } = useMemo(() => {
      if (!selectedRepo || typeof selectedRepo !== 'string') {
          return { repoOwner: null, repoName: null };
      }
      const parts = selectedRepo.split('/');
      return parts.length === 2 ? { repoOwner: parts[0], repoName: parts[1] } : { repoOwner: null, repoName: null };
  }, [selectedRepo]);


  return (
    // Applied [.dark_&]: variants for background and border
    <div className="w-64 bg-gray-100 [.dark_&]:bg-gray-800 flex flex-col h-full border-r border-gray-300 [.dark_&]:border-gray-700 flex-shrink-0">
      {/* Header */}
      {/* Applied [.dark_&]: variants for border and text */}
      <div className="p-2 border-b border-gray-300 [.dark_&]:border-gray-700 flex items-center space-x-2 text-xs text-gray-600 [.dark_&]:text-gray-400 min-h-[37px]">
        {selectedRepo && currentPath && (
          <button
            onClick={handleGoUp}
            title="Go up one level"
            // Applied [.dark_&]: variant for hover background
            className="p-1 rounded hover:bg-gray-200 [.dark_&]:hover:bg-gray-600 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDirLoading}
          >
            <FiArrowLeft size={14} />
          </button>
        )}
        {/* Applied [.dark_&]: variant for text */}
        <span className="truncate font-medium text-gray-800 [.dark_&]:text-gray-200">
          {repoName ? `${repoOwner}/${repoName}` : selectedRepo || 'No Repo Selected'}
        </span>
        {/* Applied [.dark_&]: variant for text */}
        {selectedRepo && currentPath && <span className="truncate text-gray-500 [.dark_&]:text-gray-400">/{currentPath}</span>}
      </div>

      {/* File/Folder List Area */}
      <div className="flex-grow overflow-y-auto p-2 space-y-1 relative">
        {isDirLoading && (
          // Applied [.dark_&]: variant for background overlay
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 [.dark_&]:bg-gray-800/50 z-10">
            {/* Icon color usually fine, but can add dark: if needed */}
            <FiLoader size={24} className="animate-spin text-blue-500 dark:text-blue-400" />
          </div>
        )}

        {/* Error Message Display - Using Tailwind classes directly */}
        {!isDirLoading && dirError && (
          // Applied [.dark_&]: variants for border, background, and text
          <div className="flex items-start gap-2 p-3 m-2 border border-red-300 [.dark_&]:border-red-500 bg-red-100 [.dark_&]:bg-red-950/80 text-red-700 [.dark_&]:text-red-300 rounded-md text-sm break-words">
             {/* Icon color adapted */}
            <FiAlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500 [.dark_&]:text-red-400" />
            <span>{dirError}</span>
          </div>
        )}

        {/* Placeholder Messages - Using Tailwind classes directly */}
        {!isDirLoading && !dirError && !selectedRepo && (
          // Applied [.dark_&]: variant for text
          <div className="text-center text-gray-500 [.dark_&]:text-gray-400 text-sm p-4 mt-4">
            Please select a repository.
          </div>
        )}
        {!isDirLoading && !dirError && selectedRepo && contents.length === 0 && !currentPath && (
           // Applied [.dark_&]: variant for text
           <div className="text-center text-gray-500 [.dark_&]:text-gray-400 text-sm p-4 mt-4">
             Repository root is empty or inaccessible.
           </div>
        )}
        {!isDirLoading && !dirError && selectedRepo && contents.length === 0 && currentPath && (
            // Applied [.dark_&]: variant for text
           <div className="text-center text-gray-500 [.dark_&]:text-gray-400 text-sm p-4 mt-4">
             Directory is empty.
           </div>
        )}

        {/* File and Folder List Items */}
        {!isDirLoading && !dirError && selectedRepo && contents.length > 0 && contents.map((item) => {
          const isSelected = selectedFile && item.type === 'file' && item.path === selectedFile.path;
          const isClickable = !isDirLoading;

          return (
            <div
              key={item.sha || item.path}
              title={item.name}
              className={`
                group flex justify-between items-center p-2 rounded-md text-sm
                ${/* Applied [.dark_&]: variants for text and hover background */''}
                text-gray-700 [.dark_&]:text-gray-300
                ${isClickable ? 'cursor-pointer hover:bg-gray-200 [.dark_&]:hover:bg-gray-700' : 'cursor-default'}
                ${item.type === 'dir' ? 'font-medium' : ''}
                ${/* Applied [.dark_&]: variant for selected background */''}
                ${isSelected ? 'bg-blue-100 [.dark_&]:bg-blue-900 font-semibold' : ''}
                ${!isClickable ? 'opacity-50' : ''}
              `}
              onClick={
                isClickable
                  ? item.type === 'dir'
                    ? () => handleDirectoryClick(item.path)
                    : () => handleFileClick(item)
                  : undefined
              }
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                {/* getIcon handles its own dark mode via dark: prefix */}
                {getIcon(item.type)}
                <span className="truncate">{item.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Removed <style jsx> block as styles are now inline Tailwind classes */}
    </div>
  );
};

export default FileBar;