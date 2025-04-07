// components/Chatsbar.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { FiFolder, FiFile, FiLoader, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';

// Helper to determine icon based on type
const getIcon = (type) => {
  return type === 'dir' ? <FiFolder size={16} className="flex-shrink-0 text-blue-500 dark:text-blue-400" /> : <FiFile size={16} className="flex-shrink-0 text-gray-600 dark:text-gray-400" />;
};

const Chatsbar = ({ selectedRepo, onFileSelect, selectedFile }) => {
  const [contents, setContents] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Fetch Contents Function ---
  // Use useCallback to memoize the function if needed, especially if passed down
  // Dependencies: selectedRepo (since it's used in the URL)
  const fetchContents = useCallback(async (path) => {
    // Ensure path is defined (it can be an empty string for root)
    if (typeof path !== 'string') {
        console.error("fetchContents called with invalid path:", path);
        setError("Internal error: Invalid path requested.");
        return;
    }

    if (!selectedRepo) {
      // Don't set an error here, just do nothing if no repo is selected
      // setError('No repository selected.'); // This might be annoying if transient
      setContents([]); // Clear contents if no repo
      return;
    }

    console.log(`Chatsbar Fetching: Repo="${selectedRepo}", Path="${path}"`);
    setIsLoading(true);
    setError(null); // Clear previous errors for this fetch attempt

    const apiUrl = `https://api.github.com/repos/${selectedRepo}/contents/${path}`;

    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      console.log(`Chatsbar Response Status for Path="${path}": ${response.status}`);

      if (!response.ok) {
        let errorMsg = `GitHub API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg += ` - ${errorData.message || 'No details provided.'}`;
          if (response.status === 404) errorMsg = `Repository or path not found: ${selectedRepo}/${path}`;
          if (response.status === 403) errorMsg = `Access forbidden. Check permissions or API rate limits.`;
        } catch (e) { /* Ignore non-JSON errors */ }
        console.error(`Chatsbar Fetch Error for Path="${path}": ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const sortedData = Array.isArray(data) ? data.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      }) : [];

       console.log(`Chatsbar Success for Path="${path}", Items: ${sortedData.length}`);
       setContents(sortedData); // Update contents

    } catch (err) {
      console.error(`Chatsbar Exception during fetch for Path="${path}":`, err);
      setError(err.message || 'Failed to fetch repository contents.');
      setContents([]); // Clear contents on error
    } finally {
       console.log(`Chatsbar Fetch Finished for Path="${path}"`);
       setIsLoading(false); // Ensure loading is always turned off
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo]); // Recreate fetchContents only if selectedRepo changes


  // --- Effect for Initial Load / Repo Change ---
  useEffect(() => {
    // Reset state completely when the repo changes
    setCurrentPath(''); // Go back to root path
    setContents([]);    // Clear current contents
    setError(null);     // Clear any previous errors
    setIsLoading(false); // Reset loading (though fetch will set it)

    if (selectedRepo) {
      console.log(`Chatsbar Effect [Repo Change]: Triggering initial fetch for ${selectedRepo}`);
      fetchContents(''); // Fetch the root directory ('')
    }
  }, [selectedRepo, fetchContents]); // Depend on selectedRepo and the memoized fetchContents

  // --- Click Handlers ---

  // Handle clicking on a directory
  const handleDirectoryClick = (itemPath) => {
    setCurrentPath(itemPath);
    fetchContents(itemPath); // Fetch the new path directly
  };

  // Handle clicking on a file - call the onFileSelect prop
  const handleFileClick = (file) => {
    if (onFileSelect) {
      onFileSelect({ path: file.path, name: file.name, sha: file.sha });
    } else {
      console.warn("Chatsbar: onFileSelect prop is missing!");
    }
  };

  // Handle clicking the "Go Up" button
  const handleGoUp = () => {
    const lastSlashIndex = currentPath.lastIndexOf('/');
    const parentPath = lastSlashIndex >= 0 ? currentPath.substring(0, lastSlashIndex) : '';
    setCurrentPath(parentPath);
    fetchContents(parentPath); // Fetch the parent path (which can be '') directly
  };


  // --- Render Logic ---
  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 flex flex-col h-full border-r border-gray-300 dark:border-gray-700">
      {/* Header - Path Navigation & Go Up Button */}
      <div className="p-2 border-b border-gray-300 dark:border-gray-700 flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400 min-h-[37px]">
        {/* Show Go Up button ONLY if not at the root */}
        {selectedRepo && currentPath && (
          <button
            onClick={handleGoUp}
            title="Go up one level"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading} // Disable while loading
          >
            <FiArrowLeft size={14} />
          </button>
        )}
        {/* Display selected repo and current path */}
        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
          {selectedRepo ? `${selectedRepo}` : 'No Repo'}
        </span>
        {selectedRepo && <span className="truncate">/{currentPath}</span>}
      </div>

      {/* File/Folder List Area */}
      <div className="flex-grow overflow-y-auto p-2 space-y-1 relative">
        {/* Loading State Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/50 z-10">
            <FiLoader size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Error State Message */}
        {!isLoading && error && (
          <div className="error-msg">
            <FiAlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* No Repository Selected State */}
        {!isLoading && !error && !selectedRepo && (
          <div className="msg">Please select a repository.</div>
        )}

        {/* Empty Directory State (and repo exists) */}
        {!isLoading && !error && selectedRepo && contents.length === 0 && (
          <div className="msg">
            Directory is empty or inaccessible.
          </div>
        )}

        {/* Content List (only if not loading, no error, repo selected, and content exists) */}
        {!isLoading && !error && selectedRepo && contents.length > 0 && contents.map((item) => {
          const isSelectedFile = selectedFile && item.type === 'file' && item.path === selectedFile.path;

          return (
            <div
              key={item.sha}
              title={item.name}
              className={`
                group flex justify-between items-center p-2 rounded-md text-sm
                text-gray-700 dark:text-gray-300 cursor-pointer
                hover:bg-gray-200 dark:hover:bg-gray-700
                ${item.type === 'dir' ? 'font-medium' : ''}
                ${isSelectedFile ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''}
              `}
              onClick={
                item.type === 'dir'
                  ? () => handleDirectoryClick(item.path)
                  : () => handleFileClick(item)
              }
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                {getIcon(item.type)}
                <span className="truncate">{item.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helper styles */}
      <style jsx>{`
        /* ... (styles remain the same) ... */
        .msg { text-align: center; color: #6b7280; font-size: 0.875rem; padding: 1rem; margin-top: 1rem; }
        .dark .msg { color: #9ca3af; }
        .error-msg { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem; margin: 0.5rem; border: 1px solid #fca5a5; background-color: #fee2e2; color: #b91c1c; border-radius: 0.375rem; font-size: 0.875rem; word-break: break-word; }
        .dark .error-msg { border-color: #ef4444; background-color: #450a0a; color: #fca5a5; }
      `}</style>
    </div>
  );
};

export default Chatsbar;