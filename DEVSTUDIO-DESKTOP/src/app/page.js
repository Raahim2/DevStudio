'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../components/Sidebar'; // Adjust path as needed
import FileBar from '../../components/FileBar'; // Adjust path as needed
import Topbar from '../../components/Topbar'; // Adjust path as needed
import ChatSection from '../../components/ChatSection'; // Adjust path as needed
import Bottombar from '../../components/Bottombar'; // Adjust path as needed
import HomeTabContent from '../../components/HomeTabContent'; // Adjust path as needed
import CodeDisplay from '../../components/CodeDisplay'; // Adjust path as needed
import CommitModal from '../../components/CommitModal'; // Adjust path as needed
import { FiLoader } from 'react-icons/fi';
import { useGitHubApi } from '../../hooks/useGitHubApi'; // Adjust path as needed

// Define a key for localStorage
const GITHUB_ACCESS_TOKEN_KEY = 'github_access_token';

// Placeholder view
const PlaceholderView = ({ tabName }) => (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-2">Welcome to {tabName}</h2>
        <p>Content for {tabName} will be displayed here.</p>
    </div>
);

export default function Home() {
    // --- Authentication State ---
    const [accessToken, setAccessToken] = useState(null);
    const [sessionStatus, setSessionStatus] = useState('loading');
    const [userInfo, setUserInfo] = useState(null);

    // --- UI and Data State ---
    const [activeTab, setActiveTab] = useState('Home');
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [userRepos, setUserRepos] = useState([]);
    const [isRepoListLoading, setIsRepoListLoading] = useState(false);
    const [repoListError, setRepoListError] = useState(null);

    const [selectedFile, setSelectedFile] = useState(null); // Object: { name, path, sha, ... } or null
    const [fileContent, setFileContent] = useState(null); // String content or null
    const [isFileLoading, setIsFileLoading] = useState(false);
    const [fileError, setFileError] = useState(null);

    // --- State for Commit Modal ---
    const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
    const [fileToCommit, setFileToCommit] = useState(null); // Stores { file: selectedFileObject, content: editorContent } temporarily

    // Ref to track previous repo ID to clear file state on change
    const prevRepoIdRef = useRef(null);

    // --- GitHub API Hook for Committing ---
    const {
        commitCode,        // Function returned by the hook
        isCommitting,      // Loading state for commit operation
        commitError,       // Error state from commit operation
        commitSuccess,     // Success state from commit operation
        clearCommitError   // Function to clear commit error state
    } = useGitHubApi(accessToken, selectedRepo?.full_name); // Initialize hook with token and repo

    // --- File Handling Logic ---
    const handleClearFile = useCallback(() => {
        // Clear all file-related state, including commit modal if open
        if (selectedFile || fileContent || fileError || isFileLoading || isCommitModalOpen) {
            console.log("Page: Clearing selected file state.");
            setSelectedFile(null);
            setFileContent(null);
            setFileError(null);
            setIsFileLoading(false);
            clearCommitError(); // Clear any commit errors associated with the closed file
            setIsCommitModalOpen(false); // Ensure commit modal is closed
            setFileToCommit(null);     // Clear data staged for commit
        }
    }, [selectedFile, fileContent, fileError, isFileLoading, isCommitModalOpen, clearCommitError]);

    // --- Auth State Clearing ---
    const clearAuthState = useCallback((errorMsg = null) => {
        console.log("Page: Clearing authentication state.", errorMsg ? `Reason: ${errorMsg}` : '');
        try {
          localStorage.removeItem(GITHUB_ACCESS_TOKEN_KEY);
        } catch (e) {
          console.error("Failed to remove token from localStorage:", e);
        }
        setAccessToken(null);
        setUserInfo(null);
        setSessionStatus('unauthenticated');
        setUserRepos([]);
        setSelectedRepo(null);
        setRepoListError(errorMsg); // Set general error/reason for clearing state
        handleClearFile(); // Clear file and commit modal state too
    }, [handleClearFile]);

    // --- Login Handling ---
    const handleLogin = useCallback(() => {
        if (window.electronAPI && typeof window.electronAPI.loginGithub === 'function') {
          console.log("Page: Requesting GitHub login via Electron...");
          clearAuthState(); // Clear previous state before login attempt
          window.electronAPI.loginGithub();
        } else {
          console.error('Electron API (window.electronAPI or loginGithub) not found.');
          clearAuthState("Could not initiate login: Electron API unavailable.");
        }
    }, [clearAuthState]);

    // --- Effect for Token Management (localStorage & Electron listener) ---
    useEffect(() => {
        let unsubscribe = null;
        let cleanupPerformed = false;
        let initialToken = null;

        try {
          initialToken = localStorage.getItem(GITHUB_ACCESS_TOKEN_KEY);
          if (initialToken) {
            console.log("Page: Found existing token in localStorage on mount.");
            setAccessToken(initialToken);
            setSessionStatus('authenticated');
          } else {
            console.log("Page: No token found in localStorage on mount.");
            setSessionStatus('unauthenticated');
          }
        } catch (e) {
          console.error("Failed to access localStorage on mount:", e);
          setSessionStatus('unauthenticated'); // Assume unauthenticated if localStorage fails
        }

        const handleToken = (token) => {
          if (cleanupPerformed) return; // Avoid state updates after unmount
          console.log('Page: Token received/updated via Electron listener:', token ? 'Yes' : 'No');
          if (token) {
            try {
              localStorage.setItem(GITHUB_ACCESS_TOKEN_KEY, token);
            } catch (e) {
              console.error("Failed to save token to localStorage:", e);
              // Continue even if localStorage fails, state is primary
            }
            setAccessToken(token);
            setSessionStatus('authenticated');
            setRepoListError(null); // Clear potential errors on successful token update
          } else {
            // Token is null or undefined, indicating logout or invalidation
            clearAuthState("Logged out or token became invalid.");
          }
        };

        // Set up listener if Electron API is available
        if (window.electronAPI && typeof window.electronAPI.onGithubToken === 'function') {
          console.log('Page: Setting up GitHub token listener...');
          unsubscribe = window.electronAPI.onGithubToken(handleToken);
        } else {
          console.warn('Page: Electron API or onGithubToken function not found. Persistence/Login might not work correctly.');
          // If no listener and no initial token, explicitly set to unauthenticated
          if (!initialToken) {
              setSessionStatus('unauthenticated');
          }
        }

        // Cleanup function for the effect
        return () => {
          cleanupPerformed = true;
          if (unsubscribe && typeof unsubscribe === 'function') {
            console.log('Page: Cleaning up GitHub token listener...');
            unsubscribe();
          }
        };
    }, [clearAuthState]); // Depend on clearAuthState for consistent clearing logic

    // --- Effect to Fetch User Info ---
    useEffect(() => {
        const fetchUserInfo = async () => {
          if (!accessToken || sessionStatus !== 'authenticated') {
            setUserInfo(null); return; // Don't fetch if not authenticated
          }
          console.log("Page: Fetching user info...");
          try {
            const response = await fetch('https://api.github.com/user', {
              headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
            });
            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                console.error(`Page: Invalid token fetching user info (${response.status}). Clearing auth state.`);
                clearAuthState("Authentication failed (token invalid). Please log in again.");
              } else {
                // Handle other errors without clearing auth unless necessary
                throw new Error(`Failed to fetch user info (Status: ${response.status} ${response.statusText})`);
              }
              return;
            }
            const data = await response.json();
            setUserInfo({ name: data.name || data.login, image: data.avatar_url });
            console.log("Page: User info fetched:", data.login);
          } catch (err) {
            console.error('Page: Error fetching user info:', err);
            // Clear local user info state on error if authenticated, but don't clear auth token
            if (sessionStatus === 'authenticated') { setUserInfo(null); }
          }
        };
        fetchUserInfo();
    }, [accessToken, sessionStatus, clearAuthState]);

    // --- Effect to Fetch User Repositories ---
    useEffect(() => {
        const fetchUserRepos = async () => {
          if (accessToken && sessionStatus === 'authenticated') {
            console.log("Page: Fetching user repos...");
            setIsRepoListLoading(true);
            setRepoListError(null); // Clear previous repo errors

            try {
              const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
              });
              if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                  console.error(`Page: Invalid token during repo fetch (${response.status}). Clearing auth state.`);
                  clearAuthState("Authentication failed fetching repositories. Please log in again.");
                  return; // Exit early, auth state is cleared
                }
                // Handle other potential errors (rate limiting, server issues)
                let errorMsg = `Failed to fetch repositories (Status: ${response.status})`;
                try { const errorData = await response.json(); errorMsg = `${errorMsg}: ${errorData.message || response.statusText}`; } catch (_) {}
                throw new Error(errorMsg);
              }
              const data = await response.json();
              console.log("Page: Repos fetched:", data.length);
              setUserRepos(data);

              // Check if the currently selected repo is still valid
              if (selectedRepo && !data.some(repo => repo.id === selectedRepo.id)) {
                 console.log("Page: Previously selected repo not found in updated list. Clearing selection.");
                 setSelectedRepo(null);
                 handleClearFile(); // Also clear file if repo becomes invalid
               } else if (data.length === 0) {
                  setSelectedRepo(null); // Clear selection if no repos available
               }
               // Otherwise, keep the current valid selection

            } catch (err) {
              // Only set repo-specific error if still authenticated
              if (sessionStatus === 'authenticated') {
                console.error('Page: Error fetching repos:', err);
                setRepoListError(err.message);
                setUserRepos([]); // Clear repo list on error
                setSelectedRepo(null); // Clear selection
                handleClearFile(); // Clear associated file
              }
            } finally {
              // Only update loading state if still authenticated
              if (sessionStatus === 'authenticated') {
                setIsRepoListLoading(false);
              }
            }
          } else if (sessionStatus !== 'loading') {
              // Explicitly clear repo state if not authenticated and not loading
              setUserRepos([]);
              setSelectedRepo(null);
              setRepoListError(null);
              setIsRepoListLoading(false);
              // handleClearFile(); // Already handled by clearAuthState or repo change effect
          }
        };
        fetchUserRepos();
    // Re-fetch repos if token or session status changes. Also check selectedRepo validity.
    }, [accessToken, sessionStatus, clearAuthState, handleClearFile, selectedRepo]);

    // --- File Selection Handler (from FileBar) ---
    const handleFileSelect = useCallback((file) => {
        console.log("Page: File selected:", file?.path, "SHA:", file?.sha);
        if (file?.path && file?.name && file?.sha) {
            // Prevent reload if the same file (identified by path AND sha) is clicked again
            if (selectedFile?.path === file.path && selectedFile?.sha === file.sha) {
                console.log("Page: Same file version selected, not reloading.");
                return;
            }
            // New file or different version selected
            setSelectedFile(file);
            setFileContent(null); // Clear old content immediately
            setFileError(null);   // Clear old errors
            setIsFileLoading(true); // Indicate loading has started
            clearCommitError();     // Clear any commit status from previous file
            setIsCommitModalOpen(false); // Ensure commit modal is closed
            setFileToCommit(null);     // Clear commit staging
        } else {
            console.warn("Page: Invalid file object received for selection:", file);
            handleClearFile(); // Clear everything if file object is invalid
        }
    }, [handleClearFile, clearCommitError, selectedFile?.path, selectedFile?.sha]);

    // --- File Content Loaded Handler (Callback from FileBar/fetch logic) ---
    const handleFileContentLoaded = useCallback((content, error, newSha) => {
        // This function should be called *after* the fetch attempt completes
        console.log(`Page: File content loaded. Error: ${error ? `"${error}"` : 'None'}. SHA received: ${newSha ?? 'Not Provided'}`);
        setIsFileLoading(false); // Loading finished (success or fail)

        if (error) {
            setFileError(error);
            setFileContent(null); // Ensure no stale content is shown on error
        } else {
            setFileContent(content);
            setFileError(null); // Clear any previous error
            // Update the selected file's SHA if a new one was provided and it's different
            if (newSha && selectedFile && newSha !== selectedFile.sha) {
                console.log(`Page: Updating selected file SHA from ${selectedFile.sha} to ${newSha}`);
                setSelectedFile(prevFile =>
                    // Important: Create a new object to trigger state updates correctly
                    prevFile ? { ...prevFile, sha: newSha } : null
                );
            } else if (newSha && selectedFile && newSha === selectedFile.sha) {
                 console.log("Page: Fetched content SHA matches current SHA. No update needed.");
            }
        }
    }, [selectedFile]); // Depends on selectedFile to compare/update its SHA

    // --- Save/Commit Workflow Handlers ---

    // Step 1: Initiate Save (Called by CodeDisplay save button/shortcut)
    const handleInitiateSave = useCallback((fileDetails, currentContent) => {
        // Basic validation
        if (!fileDetails || currentContent === null || currentContent === undefined) {
            console.warn("Page: Initiate save cancelled - invalid file or content provided.");
            return;
        }
         if (isCommitting) {
            console.warn("Page: Initiate save cancelled - commit already in progress.");
            return;
         }
        if (!selectedRepo || !accessToken) {
             console.error("Page: Initiate save cancelled - missing repository context or authentication.");
             // Set a general error state, perhaps?
             setRepoListError("Cannot save: Repository context or authentication missing.");
             return;
         }

        console.log(`Page: Initiating save for ${fileDetails.path}. Staging data and opening commit modal.`);
        clearCommitError(); // Clear previous commit errors before showing modal
        setRepoListError(null); // Clear general repo errors

        // Store the file details (including the crucial SHA) and current content
        setFileToCommit({ file: fileDetails, content: currentContent });
        // Open the modal
        setIsCommitModalOpen(true);

    }, [accessToken, selectedRepo, isCommitting, clearCommitError]);

    // Step 2: Submit Commit (Called by CommitModal on submit)
    const handleCommitSubmit = useCallback(async (commitMessage) => {
        // Validate required data from the modal/staged state
        if (!fileToCommit?.file || !fileToCommit?.content || !commitMessage) {
            console.error("Page: Commit submission failed - missing required data (file, content, or message).");
            // Close modal even on this type of error
            setIsCommitModalOpen(false);
            setFileToCommit(null);
            // Set an error? commitError state might be appropriate
            // setCommitError("Internal error: Missing data for commit."); // Example
            return;
        }

        const { file, content } = fileToCommit;
        console.log(`Page: Submitting commit for ${file.path} with client SHA ${file.sha}`);

        // Call the hook function, which handles the API call and state updates (isCommitting, commitError, commitSuccess)
        const commitResult = await commitCode(
            content,        // The edited content from the editor
            commitMessage,  // The message from the modal
            file.path,      // The path of the file being committed
            file.sha        // The SHA of the file version the client *thinks* it's editing
        );

        // Handle the result from the commit hook
        if (commitResult.success) {
            console.log("Page: Commit successful via modal.");

            // 1. Immediately update the local `fileContent` state to match what was committed.
            //    This prevents the editor showing the old content briefly and resets `isDirty`.
            setFileContent(content);

            // 2. **CRITICAL:** Update the `selectedFile` state with the **new SHA** returned by the API.
            if (commitResult.newSha) {
                setSelectedFile(prevFile =>
                    // Create a new object with the updated SHA
                    prevFile ? { ...prevFile, sha: commitResult.newSha } : null
                );
                console.log(`Page: Updated selected file SHA to ${commitResult.newSha} after successful commit.`);
            } else {
                // Should not happen often on success, but log if it does
                console.warn("Page: Commit successful, but the new file SHA was not returned. Future commits might face 409 conflicts until the file is refreshed.");
                // Consider prompting user to refresh or implementing auto-refresh here.
            }

            // 3. Close the commit modal.
            setIsCommitModalOpen(false);
            setFileToCommit(null); // Clear the staged commit data

            // The `commitSuccess` state (for the checkmark) is handled by the hook.

        } else {
            console.error("Page: Commit failed via modal. Error state is set by the hook and displayed in the modal.");
            // **Keep the modal open** on failure so the user sees the error message within the modal context.
            // The `commitError` state is set by the hook.
        }
    }, [commitCode, fileToCommit, setFileContent, setSelectedFile]); // Dependencies for the callback

    // Step 3: Close Commit Modal (Called by CommitModal's close/cancel)
    const handleCommitModalClose = useCallback(() => {
        // Only allow closing if a commit isn't actively being processed
        if (!isCommitting) {
             setIsCommitModalOpen(false);
             setFileToCommit(null); // Clear staged data
             // Decide if commitError should be cleared here or left visible in CodeDisplay header
             // clearCommitError();
        }
    }, [isCommitting]);

    // --- Effect to Clear File on Repository Change ---
    useEffect(() => {
        const currentRepoId = selectedRepo?.id;
        // Only clear if the repo ID actually changes *and* there was a previous repo selected
        if (currentRepoId !== prevRepoIdRef.current && prevRepoIdRef.current !== null) {
            console.log(`Page: Repository changed from ${prevRepoIdRef.current || 'none'} to ${currentRepoId || 'none'}. Clearing file state.`);
            handleClearFile(); // Clears file, commit modal, errors etc.
        }
        // Update the ref *after* the check
        prevRepoIdRef.current = currentRepoId;
    }, [selectedRepo, handleClearFile]); // Depend on repo object and clear handler

    // --- Effect for Tab Change Logic ---
    useEffect(() => {
        // If user navigates away from Code/Chat while commit modal is open, close it (if not committing)
        if (isCommitModalOpen && activeTab !== 'Code' && activeTab !== 'Chat') {
             console.log("Page: Closing commit modal due to tab change.");
             handleCommitModalClose(); // Use handler that checks isCommitting
        }

        // Optional: Add logic here to warn user about unsaved changes in CodeDisplay
        // before clearing the file if they switch tabs. Requires checking CodeDisplay's internal dirty state.
        // For now, switching tabs doesn't automatically clear the file unless the repo changes.

    }, [activeTab, isCommitModalOpen, handleCommitModalClose]); // Dependencies


    // --- Main Render Function ---
    const renderTabContent = () => {
        // --- Initial Loading State ---
        if (sessionStatus === 'loading') {
             return (
                <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <FiLoader size={32} className="animate-spin text-blue-500" />
                </div>
             );
        }
        if (sessionStatus === 'authenticated' && isRepoListLoading && userRepos.length === 0 && !repoListError) {
            return (
                <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <FiLoader size={32} className="animate-spin text-blue-500" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading repositories...</span>
                </div>
            );
        }

        // --- Unauthenticated State ---
        if (sessionStatus === 'unauthenticated') {
            // Ensure Home tab is active
            if (activeTab !== 'Home') {
                setTimeout(() => setActiveTab('Home'), 0); // Schedule switch
                return null; // Render nothing briefly
            }
            return (
              <HomeTabContent
                userRepos={[]} selectedRepo={null} setSelectedRepo={() => {}}
                isRepoListLoading={false} repoListError={repoListError}
                sessionStatus={sessionStatus} accessToken={null} onLoginClick={handleLogin}
              />
            );
        }

        // --- Authenticated State: Render based on activeTab ---
        switch (activeTab) {
            case 'Home':
                return (
                    <HomeTabContent
                      userRepos={userRepos} selectedRepo={selectedRepo} setSelectedRepo={setSelectedRepo}
                      isRepoListLoading={isRepoListLoading} repoListError={repoListError}
                      sessionStatus={sessionStatus} accessToken={accessToken}
                      onLoginClick={handleLogin} // Should likely be Logout here
                    />
                );

            case 'Chat':
            case 'Code':
                // Check if a repository is selected
                if (!selectedRepo) {
                    return (
                        <div className="flex flex-1 items-center justify-center p-6 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                            {isRepoListLoading
                                ? <FiLoader size={24} className="animate-spin text-blue-500" />
                                : repoListError
                                    ? <span className="text-red-500">Error loading repositories: {repoListError}</span>
                                    : userRepos.length > 0
                                        ? 'Please select a repository from the dropdown in the top bar.'
                                        : 'No repositories found or you may not have access.'
                            }
                        </div>
                    );
                }
                // Render FileBar and the active content (Chat or Code)
                return (
                    <div className="flex flex-1 overflow-hidden">
                        <FileBar
                            // Use repo ID as key to force re-render when repo changes
                            key={selectedRepo.id}
                            selectedRepo={selectedRepo.full_name}
                            onFileSelect={handleFileSelect}
                            selectedFile={selectedFile}
                            onFileContentLoaded={handleFileContentLoaded}
                            accessToken={accessToken}
                        />
                        <div className="flex-1 flex flex-col overflow-hidden"> {/* Container for Chat/Code */}
                            {activeTab === 'Chat' ? (
                                <ChatSection
                                    // Use file path as key to reset chat state if file changes
                                    key={selectedFile?.path ?? 'chat-no-file'}
                                    selectedRepoFullName={selectedRepo.full_name}
                                    accessToken={accessToken}
                                    selectedFile={selectedFile}
                                    selectedFileContent={fileContent} // Pass original fetched content
                                    isLoading={isFileLoading}
                                    error={fileError}
                                />
                            ) : ( // activeTab === 'Code'
                                <CodeDisplay
                                    // Use file path as key to reset editor state if file changes
                                    key={selectedFile?.path ?? 'code-no-file'}
                                    selectedFile={selectedFile}
                                    fileContent={fileContent} // Pass original fetched content
                                    onClearFile={handleClearFile}
                                    isLoading={isFileLoading}
                                    error={fileError}
                                    // --- Commit related props ---
                                    onSave={handleInitiateSave} // Triggers commit modal
                                    isCommitting={isCommitting} // Status for UI feedback/disabling
                                    commitError={commitError}   // Error message for header display
                                    commitSuccess={commitSuccess} // Success status for header display
                                    clearCommitError={clearCommitError} // Function to clear error display
                                />
                            )}
                        </div>
                    </div>
                );

            // Placeholder for other tabs
            case 'Notifications':
            case 'Settings':
            case 'Automation':
                return <PlaceholderView tabName={activeTab} />;

            // Default case: Should not happen, fallback to Home
            default:
                console.warn("Page: Rendering unknown tab:", activeTab, "- falling back to Home.");
                setActiveTab('Home');
                return null;
        }
    };

    // --- Component Structure Return ---
    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">
            {/* Main Layout: Sidebar + Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Top Bar */}
                    <Topbar
                        userRepos={userRepos}
                        selectedRepo={selectedRepo}
                        setSelectedRepo={setSelectedRepo}
                        userInfo={userInfo}
                        isRepoListLoading={isRepoListLoading} // Pass loading state for potential indicator
                        // Add Logout handler here if needed
                    />
                    {/* Main Content Area (renders based on tab) */}
                    <div className="flex flex-1 overflow-hidden">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
            {/* Bottom Bar */}
            <Bottombar />

            {/* Commit Modal (rendered outside main layout, controlled by state) */}
            <CommitModal
                isOpen={isCommitModalOpen}
                onClose={handleCommitModalClose}
                onSubmit={handleCommitSubmit}
                fileName={fileToCommit?.file?.name} // Display filename in modal for context
                isCommitting={isCommitting} // Pass loading state to modal for button state/indicator
                commitError={commitError}   // Pass error to display within the modal
            />
        </div>
    );
}