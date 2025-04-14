// src/app/main/components/CodeBlock.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiCopy, FiCheck, FiDownload, FiGitCommit, FiFilePlus, FiLoader } from 'react-icons/fi'; // Added FiLoader
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useGitHubApi } from '../hooks/useGitHubApi'; // Adjust path if necessary

// Helper to get a file extension (no changes needed here)
const getFileExtension = (lang) => {
    const langMap = {
        javascript: 'js',
        python: 'py',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        csharp: 'cs',
        go: 'go',
        html: 'html',
        css: 'css',
        scss: 'scss',
        ruby: 'rb',
        php: 'php',
        swift: 'swift',
        kotlin: 'kt',
        rust: 'rs',
        typescript: 'ts',
        sql: 'sql',
        bash: 'sh',
        shell: 'sh',
        json: 'json',
        yaml: 'yaml',
        markdown: 'md',
        xml: 'xml',
        // Add more mappings as needed
    };
    return langMap[lang?.toLowerCase()] || 'txt'; // Default to .txt
};

// Helper: Base64 Decode (needed for checking if content changed before committing)
const decodeBase64 = (base64) => {
    try {
        // Node.js/Webpack Buffer method (more robust for UTF-8)
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(base64, 'base64').toString('utf-8');
        }
        // Browser's atob (might have issues with some Unicode chars)
        return decodeURIComponent(escape(window.atob(base64)));
    } catch (e) {
        console.error("Base64 decoding failed:", e);
        return null; // Indicate failure
    }
};


const CodeBlock = ({
    language,
    codeString,
    id,
    isCopied,
    onCopyCode,
    // --- Props required for commit functionality ---
    accessToken,
    selectedRepoFullName,
    // Add a prop for the selected file's path, if available (can help pre-fill prompt)
    selectedFilePath // Optional: pass the path of the file currently being viewed/edited
}) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    // Local state for commit operation feedback (to avoid cluttering parent)
    const [commitStatus, setCommitStatus] = useState({ loading: false, error: null, success: false });

    // --- Instantiate the GitHub API Hook ---
    // Note: The hook manages its *own* isOperating/operationError/operationSuccess state.
    // We use `commitStatus` here mainly to control the button UI specifically for this block's commit action.
    const {
        createFile,
        commitCode,
        isOperating: isHookOperating, // Use hook's state for disabling etc.
        operationError: hookError,
        operationSuccess: hookSuccess,
        clearOperationError
    } = useGitHubApi(accessToken, selectedRepoFullName);

    // --- Dark Mode Detection ---
    useEffect(() => {
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') checkDarkMode();
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const selectedTheme = isDarkMode ? vscDarkPlus : coy;

    // --- Handlers ---

    const handleCopyClick = useCallback(() => {
        if (onCopyCode) {
            onCopyCode(codeString, id);
        }
    }, [onCopyCode, codeString, id]);

    const handleDownloadClick = useCallback(() => {
        // ... (keep existing download logic) ...
        if (!codeString) return;
        const extension = getFileExtension(language);
        const filename = `code_snippet_${id || Date.now()}.${extension}`;
        const blob = new Blob([codeString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        try {
            document.body.appendChild(a);
            a.click();
        } catch (e) {
            console.error("Download failed:", e);
        } finally {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, [codeString, language, id]);

    // --- Commit Handler (Functional) ---
    const handleCommitClick = useCallback(async () => {
        if (!accessToken || !selectedRepoFullName) {
            setCommitStatus({ loading: false, error: "Missing Access Token or Repository.", success: false });
            return;
        }
        if (!codeString) {
             setCommitStatus({ loading: false, error: "Nothing to commit (code is empty).", success: false });
            return;
        }

        // 1. Prompt for file path
        const filePath = window.prompt(
            `Enter the full path for the file in the repository '${selectedRepoFullName}' (e.g., 'src/components/MyComponent.js'):`,
            selectedFilePath || `new_file_${id || Date.now()}.${getFileExtension(language)}` // Pre-fill if possible
        );
        if (!filePath || filePath.trim() === '') {
            setCommitStatus({ loading: false, error: "File path cannot be empty.", success: false });
            return; // User cancelled or entered empty path
        }

        // 2. Prompt for commit message
        const commitMessage = window.prompt("Enter commit message:", `Commit code snippet from chat`);
        if (!commitMessage || commitMessage.trim() === '') {
            setCommitStatus({ loading: false, error: "Commit message cannot be empty.", success: false });
            return; // User cancelled or entered empty message
        }

        setCommitStatus({ loading: true, error: null, success: false });
        clearOperationError(); // Clear previous hook errors

        let currentSha = null;
        let currentContent = null;

        // 3. Fetch current file details (to get SHA for update)
        try {
            const getUrl = `https://api.github.com/repos/${selectedRepoFullName}/contents/${filePath.trim()}`;
            const response = await fetch(getUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                currentSha = data.sha;
                // Decode existing content to check if changes are needed
                if (data.content) {
                    currentContent = decodeBase64(data.content);
                }
                console.log(`File '${filePath}' exists. SHA: ${currentSha}`);
            } else if (response.status !== 404) {
                // Handle errors other than "Not Found"
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Failed to check file status (${response.status}): ${errorData.message || 'Unknown error'}`);
            } else {
                 console.log(`File '${filePath}' does not exist. Will attempt creation.`);
            }

        } catch (error) {
            console.error("Error fetching file details:", error);
            setCommitStatus({ loading: false, error: `Error checking file: ${error.message}`, success: false });
            return;
        }

        // Optional: Check if content is identical before committing (prevents unnecessary commits)
        if (currentSha && currentContent !== null && currentContent === codeString) {
            console.log("Content hasn't changed. Skipping commit.");
             setCommitStatus({ loading: false, error: null, success: true, message: "No changes detected." }); // Show success but indicate no change
             setTimeout(() => setCommitStatus({ loading: false, error: null, success: false }), 3000); // Clear status after a delay
            return;
        }


        // 4. Call the appropriate hook function
        let result;
        if (currentSha) {
            // Update existing file - pass the fetched SHA
            console.log(`Attempting to update file '${filePath}' with SHA: ${currentSha}`);
            result = await commitCode(codeString, commitMessage, filePath.trim(), currentSha);
        } else {
            // Create new file - pass null for SHA
            console.log(`Attempting to create new file '${filePath}'`);
            result = await createFile(filePath.trim(), codeString, commitMessage);
        }

        // 5. Update local status based on hook result
        setCommitStatus({
            loading: false, // Equivalent to !isHookOperating after await
            error: result.error, // Use error from hook result
            success: result.success,
        });

         // Auto-clear success/error message after a delay
         if(result.success || result.error) {
             setTimeout(() => {
                 setCommitStatus({ loading: false, error: null, success: false })
                 if(result.error) clearOperationError(); // Also clear hook error if we clear local
             }, 4000);
         }

    }, [
        accessToken,
        selectedRepoFullName,
        codeString,
        id,
        language,
        selectedFilePath,
        commitCode,
        createFile,
        clearOperationError
    ]);

    const handleCreateFileClick = useCallback(() => {
        // Dummy implementation remains
        alert(`Create File action triggered for block ${id}. (Implementation TBD)`);
        console.log("Create File action clicked. Code:\n", codeString);
    }, [codeString, id]);

    // --- Display Commit Status ---
    // Combine local status with hook's status for disabling/displaying feedback
    const isCommitInProgress = commitStatus.loading || isHookOperating;
    const commitDisplayError = commitStatus.error || hookError; // Show local error first, then hook's
    const commitDisplaySuccess = commitStatus.success || hookSuccess; // Show local success first

    return (
        <div className="code-block-wrapper my-3 relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm group">
            {/* Header */}
            <div className="flex justify-between items-center px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600 relative">
                <span className="font-medium uppercase tracking-wider">{language || 'code'}</span>

                 {/* Status Indicator Area - Absolute positioned */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center text-xs font-medium">
                    {isCommitInProgress && (
                        <span className="flex items-center text-blue-600 dark:text-blue-400">
                            <FiLoader size={14} className="animate-spin mr-1.5" />
                            Committing...
                        </span>
                    )}
                    {!isCommitInProgress && commitDisplayError && (
                        <span className="flex items-center text-red-600 dark:text-red-400 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">
                            Error: {commitDisplayError.length > 50 ? commitDisplayError.substring(0, 47) + '...' : commitDisplayError}
                        </span>
                    )}
                     {!isCommitInProgress && commitDisplaySuccess && !commitDisplayError && (
                        <span className="flex items-center text-green-600 dark:text-green-400 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
                           {commitStatus.message || "Commit Successful!"} {/* Show custom message if available */}
                        </span>
                    )}
                </div>


                {/* Button Group */}
                <div className="flex items-center gap-x-2">
                    {/* Commit Button */}
                    <button
                        onClick={handleCommitClick}
                        disabled={isCommitInProgress || !accessToken || !selectedRepoFullName || !codeString} // Disable conditions
                        title={!accessToken || !selectedRepoFullName ? "Setup token/repo first" : isCommitInProgress ? "Committing..." : "Commit this code"}
                        className={`p-1 rounded text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                            isCommitInProgress ? 'cursor-wait opacity-50' : 'hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-white'
                        } ${!accessToken || !selectedRepoFullName || !codeString ? 'opacity-40 cursor-not-allowed' : ''}`}
                        aria-label="Commit this code snippet"
                    >
                       {isCommitInProgress ? <FiLoader size={15} className="animate-spin" /> : <FiGitCommit size={15} />}
                    </button>

                    {/* Create File Button (Dummy) */}
                    <button
                        onClick={handleCreateFileClick}
                        disabled={isCommitInProgress} // Also disable if commit is happening
                        title="Create new file with this code (TBD)"
                        className={`p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${isCommitInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label="Create new file with this code snippet"
                    >
                        <FiFilePlus size={15} />
                    </button>

                    {/* Download Button */}
                    <button
                        onClick={handleDownloadClick}
                        disabled={isCommitInProgress} // Disable if commit is happening
                        title="Download code snippet"
                        className={`p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${isCommitInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label="Download code snippet"
                    >
                        <FiDownload size={15} />
                    </button>

                    {/* Copy Button */}
                    <button
                        onClick={handleCopyClick}
                         disabled={isCommitInProgress} // Disable if commit is happening
                        title={isCopied ? "Copied!" : "Copy code"}
                        className={`p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                            isCopied ? 'text-green-500 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                        } ${isCommitInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label={isCopied ? "Code copied" : "Copy code"}
                    >
                        {isCopied ? <FiCheck size={15} /> : <FiCopy size={15} />}
                    </button>
                </div>
            </div>

            {/* Syntax Highlighter (no changes needed here) */}
            <SyntaxHighlighter
                language={language}
                style={selectedTheme}
                customStyle={{ /* ... existing styles ... */ }}
                codeTagProps={{ /* ... existing props ... */ }}
                showLineNumbers={codeString?.split('\n').length > 1}
                wrapLines={true}
                wrapLongLines={false}
                lineNumberStyle={{ /* ... existing styles ... */ }}
            >
                {codeString || ''}
            </SyntaxHighlighter>
        </div>
    );
};

export default CodeBlock;
