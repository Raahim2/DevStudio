'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VscSourceControl, VscError } from 'react-icons/vsc';

// Import Child Components (ensure these paths are correct for your structure)
import LoadingIndicator from './LoadingIndicator';
import ErrorDisplay from './ErrorDisplay';
import RepoSetup from './RepoSetup';
import CommitPanelHeader from './CommitPanelHeader';
import ChangesList from './ChangesList';
import DiffViewerPanel from './DiffViewerPanel';
import CommitMessageArea from './CommitMessageArea';
import GitHubLogin from './Login'

// Helper function to call Electron API (ensure this is defined/imported correctly)
const callElectronApi = async (funcName, ...args) => {
    if (typeof window.electronAPI?.[funcName] !== 'function') {
        const msg = `electronAPI.${funcName} is not available. Ensure it's exposed from preload.`;
        console.error(msg);
        throw new Error(msg);
    }
    try {
        const result = await window.electronAPI[funcName](...args);
        // Assuming main process returns { success: boolean, data?: any, error?: string }
        if (result && typeof result === 'object' && result.success === true) {
            return result.data; // Return the actual data payload on success
        } else if (result && typeof result === 'object' && result.success === false) {
            // Main process returned an explicit error object
            console.error(`Electron API returned error for ${funcName}:`, result.error);
            throw new Error(result.error || `Electron API call failed for ${funcName}`);
        } else {
            // Unexpected return format or simple return (like boolean)
            console.warn(`Electron API call ${funcName} returned potentially unexpected format:`, result);
            return result; // Allow simple returns
        }
    } catch (error) {
        // Catches errors from IPC layer or handler errors before formatting
        console.error(`Error during electronAPI.${funcName} IPC communication or unexpected handler error:`, error);
        throw error; // Re-throw original error
    }
};


const CommitTab = ({ selectedFolderPath, accessToken, activeTab  , onGithubLogin}) => {
    // --- STATE ---
    const [isRepo, setIsRepo] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Main loading indicator
    const [error, setError] = useState(null); // General operational errors
    const [setupError, setSetupError] = useState(null); // Errors specifically during setup actions
    const [gitStatus, setGitStatus] = useState(null);
    const [stagedFiles, setStagedFiles] = useState(new Set());
    const [selectedFileForDiff, setSelectedFileForDiff] = useState(null);
    const [diffContent, setDiffContent] = useState({ oldCode: '', newCode: '' });
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [isPushing, setIsPushing] = useState(false); // Used for actual push part
    const [isFetching, setIsFetching] = useState(false); // Used for fetch/pull AND the fetch part of publish
    const [showRepoSetup, setShowRepoSetup] = useState(false);
    const [userRepos, setUserRepos] = useState([]);
    const [isInitializing, setIsInitializing] = useState(false); // For init/link/create repo actions

    const remoteName = 'origin'; // Assuming 'origin'
    const defaultBranchName = 'main'; // Assume 'main' as the default

    // Combine loading states relevant for disabling UI actions
    const anyActionLoading = isLoading || isCommitting || isPushing || isFetching || isInitializing;

    // --- DATA FETCHING and CORE LOGIC ---

    const clearErrors = () => {
        setError(null);
        setSetupError(null);
    };



    // Fetch status, with option to suppress main loading indicator and return status directly
    const fetchGitStatus = useCallback(async (path, suppressLoading = false) => {
        if (!path) {
            setIsRepo(false); setGitStatus(null); setStagedFiles(new Set());
            setSelectedFileForDiff(null); setDiffContent({ oldCode: '', newCode: '' });
            clearErrors(); setIsLoading(false); setShowRepoSetup(false);
            return null;
        }
        if (!suppressLoading) setIsLoading(true); // Only set global loading if not suppressed
        let fetchedStatus = null; // Variable to hold status for immediate use
        try {
            console.log(`[CommitTab] Checking if ${path} is repo...`);
            const isGitRepo = await callElectronApi('gitIsRepo', path);
            setIsRepo(isGitRepo);
             console.log(`[CommitTab] Is repo: ${isGitRepo}`);

            if (isGitRepo) {
                 console.log(`[CommitTab] Fetching status for ${path}...`);
                 fetchedStatus = await callElectronApi('gitGetStatus', path); // Store fetched status
                 console.log("[CommitTab] Received Git Status in Component:", fetchedStatus);

                 if (fetchedStatus && typeof fetchedStatus === 'object') {
                    if (Array.isArray(fetchedStatus.files)) {
                        const initiallyStaged = fetchedStatus.files
                            .filter(f => f.index !== ' ' && f.index !== '?')
                            .map(f => f.path);
                        setStagedFiles(new Set(initiallyStaged));
                    } else {
                        console.warn("[CommitTab] Received git status without a 'files' array:", fetchedStatus);
                        setStagedFiles(new Set());
                    }
                     setGitStatus(fetchedStatus); // Update state

                     // Only show setup automatically if it wasn't already explicitly shown for setup purposes
                    if (!fetchedStatus.remoteUrl && fetchedStatus.current && !showRepoSetup) {
                         console.warn("[CommitTab] No remote URL detected for existing repo.");
                        setShowRepoSetup(true); // Show setup if repo exists but no remote
                    }
                 } else {
                      console.error("[CommitTab] Received invalid status object:", fetchedStatus);
                      throw new Error("Received invalid status data from main process.");
                 }
            } else {
                setGitStatus(null); setStagedFiles(new Set()); setShowRepoSetup(true);
            }
            // Clear general error only on *successful* fetch. Setup errors are handled separately.
            if(!setupError) setError(null);
            return fetchedStatus; // Return the fetched status directly
        } catch (err) {
             setError(`Failed to get Git status: ${err.message}`); // Set general error
             console.error("[CommitTab] Fetch Git Status Error:", err);
             setGitStatus(null); setStagedFiles(new Set()); setSelectedFileForDiff(null);
             if (err.message.includes("not a git repository")) {
                setIsRepo(false);
                setShowRepoSetup(true);
            }
            return null; // Return null on error
        } finally {
             if (!suppressLoading) setIsLoading(false);
        }
    }, [showRepoSetup, setupError]); // Include setupError to prevent clearing it if fetch succeeds while setup error is shown



    // Effect to trigger initial status fetch and on path/tab changes
    useEffect(() => {
        console.log(`[CommitTab] Effect triggered: path=${selectedFolderPath}, tab=${activeTab}`);
        if (selectedFolderPath && activeTab === 'Commit') {
            fetchGitStatus(selectedFolderPath);
        } else {
            console.log("[CommitTab] Resetting state due to inactive tab or no path.");
            setIsRepo(false); setGitStatus(null); setStagedFiles(new Set());
            setSelectedFileForDiff(null); setDiffContent({ oldCode: '', newCode: '' });
            clearErrors(); setIsLoading(false); setShowRepoSetup(false);
        }
    }, [selectedFolderPath, activeTab, fetchGitStatus]);

    // Fetch Diff logic
    const fetchDiff = useCallback(async (filePath, isStaged) => {
        if (!selectedFolderPath || !filePath) {
             setDiffContent({ oldCode: '', newCode: '' });
             return;
        }
        console.log(`[CommitTab] Fetching diff for ${filePath} (staged: ${isStaged})`);
        // Don't clear general error when fetching diff
        try {
            const diff = await callElectronApi('gitGetDiff', selectedFolderPath, filePath, isStaged);
            let oldContent = '', newContent = '';
            if (typeof diff === 'string' && diff) {
                 const lines = diff.split('\n');
                 lines.forEach(line => {
                     if (line.startsWith('-') && !line.startsWith('---')) oldContent += line.substring(1) + '\n';
                     else if (line.startsWith('+') && !line.startsWith('+++')) newContent += line.substring(1) + '\n';
                     else if (!line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('@@') && line.trim() !== '') {
                         oldContent += line + '\n'; newContent += line + '\n';
                     }
                 });
            }
            setDiffContent({ oldCode: oldContent || " ", newCode: newContent || " " });
        } catch (err) {
            // Set general error if diff fails
            setError(`Failed to get diff for ${filePath}: ${err.message}`);
            console.error("[CommitTab] Fetch Diff Error:", err);
            setDiffContent({ oldCode: `Error loading diff: ${err.message}`, newCode: '' });
        }
    }, [selectedFolderPath]);

    // Effect for diff fetching on file selection change
    useEffect(() => {
        if (selectedFileForDiff) {
            fetchDiff(selectedFileForDiff.path, selectedFileForDiff.isStaged);
        } else {
            setDiffContent({ oldCode: '', newCode: '' });
        }
    }, [selectedFileForDiff, fetchDiff]);

    // --- ACTION HANDLERS ---

    // Generic API call wrapper
    const handleApiCall = async (actionAsync, loadingSetter, errorSetter = setError, suppressStatusRefresh = false) => {
        // Only clear the specific error this handler targets
        errorSetter(null);
        // Don't clear general error if we are setting setupError, etc.
        if (errorSetter === setError) setSetupError(null);
        if (errorSetter === setSetupError) setError(null);

        loadingSetter(true);
        let success = false;
        try {
            await actionAsync();
             success = true;
             // Refresh status after most successful actions unless suppressed
             if (!suppressStatusRefresh) {
                // Use await to ensure status is refreshed before loading is turned off if needed
                 await fetchGitStatus(selectedFolderPath, true);
             }
        } catch (err) {
            console.error("[CommitTab] API Call Error:", err);
            errorSetter(err.message || 'An unknown error occurred.');
             // Optionally re-fetch status even on error for state consistency
             // await fetchGitStatus(selectedFolderPath, true);
        } finally {
            loadingSetter(false);
        }
        return success; // Indicate if the action succeeded
    };

    // --- Stage / Unstage ---
    const handleStageFile = (filePath) => handleApiCall(
        async () => {
            if (!selectedFolderPath || !filePath) throw new Error("Missing path/file for staging");
            await callElectronApi('gitAdd', selectedFolderPath, [filePath]);
            setStagedFiles(prev => new Set(prev).add(filePath)); // Optimistic update
            if (selectedFileForDiff?.path === filePath && !selectedFileForDiff?.isStaged) {
                setSelectedFileForDiff(prev => ({...prev, isStaged: true})); // Trigger diff update via effect
            }
        },
        () => {}, // No specific loading indicator for single stage/unstage
        setError, // Set general error on failure
        false // Refresh status after
    );

     const handleUnstageFile = (filePath) => handleApiCall(
         async () => {
            if (!selectedFolderPath || !filePath) throw new Error("Missing path/file for unstaging");
             await callElectronApi('gitUnstage', selectedFolderPath, [filePath]);
             setStagedFiles(prev => { const next = new Set(prev); next.delete(filePath); return next; }); // Optimistic
             if (selectedFileForDiff?.path === filePath && selectedFileForDiff?.isStaged) {
                 setSelectedFileForDiff(prev => ({...prev, isStaged: false})); // Trigger diff update via effect
             }
         },
         () => {}, // No specific loading indicator
         setError, // Set general error on failure
         false // Refresh status after
     );

    const handleStageAll = () => handleApiCall(
        async () => {
            const filesToStage = unstagedChanges.map(f => f.path).filter(p => p);
            if (filesToStage.length === 0) {
                console.log("[CommitTab] Stage All: No files to stage.");
                // Return true to prevent status refresh if nothing happened? Or let it refresh.
                // Let's allow refresh for simplicity.
                 return;
            }
            if (!selectedFolderPath) throw new Error("Missing folder path for staging all");
            await callElectronApi('gitAdd', selectedFolderPath, filesToStage);
            setStagedFiles(prev => new Set([...prev, ...filesToStage])); // Optimistic
             // If selected file was just staged, update selection state
            if (selectedFileForDiff && !selectedFileForDiff?.isStaged && filesToStage.includes(selectedFileForDiff.path)) {
                 setSelectedFileForDiff(prev => ({...prev, isStaged: true}));
             }
        },
         setIsLoading, // Use general loading for stage/unstage all
         setError, // Set general error
         false // Refresh status after
    );

     const handleUnstageAll = () => handleApiCall(
         async () => {
             const filesToUnstage = Array.from(stagedFiles).filter(p => p);
             if (filesToUnstage.length === 0) {
                 console.log("[CommitTab] Unstage All: No files to unstage.");
                 return;
             }
             if (!selectedFolderPath) throw new Error("Missing folder path for unstaging all");
             await callElectronApi('gitUnstage', selectedFolderPath, filesToUnstage);
             setStagedFiles(new Set()); // Optimistic
             // If selected file was just unstaged, update selection state
            if (selectedFileForDiff && selectedFileForDiff?.isStaged && filesToUnstage.includes(selectedFileForDiff.path)) {
                setSelectedFileForDiff(prev => ({...prev, isStaged: false}));
            }
         },
         setIsLoading, // Use general loading for stage/unstage all
         setError, // Set general error
         false // Refresh status after
     );

    // --- Commit ---
    const handleCommit = () => {
        if (!commitMessage.trim()) { setError("Commit message is required."); return; }
        if (stagedFiles.size === 0) { setError("No files staged for commit."); return; }
        if (!selectedFolderPath) { setError("Folder path not selected."); return;}

        handleApiCall(
            async () => {
                await callElectronApi('gitCommit', selectedFolderPath, commitMessage.trim());
                setCommitMessage(''); // Clear message on success
                setSelectedFileForDiff(null); // Clear diff
                setDiffContent({ oldCode: '', newCode: '' });
                // Status will be refreshed by the wrapper
            },
            setIsCommitting, // Set committing state
            setError, // Set general error
            false // Refresh status after
        );
    };

    // --- Fetch ---
     const handleFetch = async () => {
        if (!selectedFolderPath) { setError("Folder path not selected."); return;}
        if (!gitStatus?.remoteUrl) { setError("Cannot fetch: Remote not configured."); if(isRepo) setShowRepoSetup(true); return; }
         // Don't use wrapper here, manage state explicitly
         setIsFetching(true);
         setError(null); // Clear general error
         try {
             console.log("[CommitTab] HandleFetch: Fetching remote status...");
             await callElectronApi('gitFetch', selectedFolderPath, remoteName, accessToken);
             console.log("[CommitTab] HandleFetch: Fetch successful. Getting updated status...");
             await fetchGitStatus(selectedFolderPath, true); // Fetch status after, suppress main loading
         } catch (err) {
             setError(`Fetch failed: ${err.message}`);
             console.error("[CommitTab] Fetch Error:", err);
         } finally {
             setIsFetching(false);
         }
     }

    // --- Pull ---
     const handlePull = () => {
         if (!selectedFolderPath) { setError("Folder path not selected."); return; }
         if (!gitStatus || !gitStatus.current) { setError("Cannot pull: Git status or current branch not available."); return; }
         if (!gitStatus.remoteUrl) { setError("Cannot pull: Remote not configured."); if(isRepo) setShowRepoSetup(true); return; }

         const currentBranch = gitStatus.current;
         const isTracking = !!gitStatus.tracking; // Check if tracking info exists

         // If tracking IS set up, only allow pull if behind
         if (isTracking && gitStatus.behind === 0) {
             setError("Cannot pull: Already up-to-date.");
             return;
         }

         // If not tracking, log warning but proceed with explicit pull attempt
         if (!isTracking) {
             console.warn(`[CommitTab] HandlePull: Branch "${currentBranch}" is not tracking. Attempting explicit pull from ${remoteName}/${currentBranch}.`);
         }

         // Parameters for the explicit pull API call
         const pullRemote = remoteName;
         const pullBranch = currentBranch;

         console.log(`[CommitTab] HandlePull: Attempting pull. Target: ${pullRemote}/${pullBranch}`);

         handleApiCall(
             async () => {
                  // The IPC gitPull handler needs to accept explicit remote & branch
                  await callElectronApi('gitPull', selectedFolderPath, pullRemote, pullBranch, accessToken);

                  // Explicitly refresh status *after* the pull attempt to check if tracking got set up
                  const statusAfterPull = await fetchGitStatus(selectedFolderPath, true); // Fetch silently
                  if (statusAfterPull && !statusAfterPull.tracking && isTracking) {
                       // This case shouldn't happen often if pull succeeded, but log if it does
                      console.warn(`[CommitTab] Pull Warning: Pull seemed successful but branch "${currentBranch}" lost tracking info.`);
                  } else if (statusAfterPull?.tracking) {
                       console.log(`[CommitTab] Pull successful, tracking confirmed for ${currentBranch} -> ${statusAfterPull.tracking}`);
                  } else if (!isTracking && statusAfterPull?.tracking) {
                       console.log(`[CommitTab] Pull successful, tracking likely established for ${currentBranch} -> ${statusAfterPull.tracking}`);
                  }

                  // Clear diff on successful pull
                  setSelectedFileForDiff(null);
                  setDiffContent({ oldCode: '', newCode: '' });
             },
             setIsFetching, // Reuse fetching state for pull visual
             setError, // Set general error state if API call fails
             true // Suppress the automatic status refresh inside handleApiCall, we did it manually above
         );
     }

    // --- Push / Publish ---
    const handlePushOrPublish = async () => {
        clearErrors(); // Clear errors before starting push/publish attempt

        // Ensure we have necessary info from status
        if (!selectedFolderPath) { setError("Folder path not selected."); return;}
        if (!gitStatus || !gitStatus.current || !gitStatus.remoteUrl) {
            setError("Cannot push: Current branch or remote URL is missing or status not loaded.");
            if (isRepo && !gitStatus?.remoteUrl) setShowRepoSetup(true); // Prompt setup if remote is missing
            return;
        }

        const { current, remoteUrl, tracking, ahead, behind } = gitStatus;

        // --- Publish Branch Scenario (No Tracking Info) ---
        if (!tracking) {
            console.log("[CommitTab] Executing Publish Branch flow...");
            setIsFetching(true); // Use fetching indicator for the initial fetch check
            setError(null);
            let fetchedOk = false;
            let statusAfterFetch = null;
            try {
                // Step 1: Fetch from remote to see if target branch exists/is ahead
                console.log("[CommitTab] Publishing: Fetching remote status first...");
                await callElectronApi('gitFetch', selectedFolderPath, remoteName, accessToken);
                fetchedOk = true;

                // Step 2: Get updated status *immediately* after fetch
                console.log("[CommitTab] Publishing: Fetch successful. Getting updated status...");
                statusAfterFetch = await fetchGitStatus(selectedFolderPath, true); // Suppress loading indicator, await result
                console.log("[CommitTab] Publishing: Updated status:", statusAfterFetch);

            } catch (fetchErr) {
                setError(`Publish failed: Could not fetch remote status before publishing. ${fetchErr.message}`);
                console.error("[CommitTab] Publish Fetch Error:", fetchErr);
                setIsFetching(false);
                return; // Stop if fetch fails
            }
            // Keep isFetching true until push starts or fails check

            // Step 3: Check status *after* fetch
            if (!statusAfterFetch) {
                 setError("Publish failed: Could not verify repository status after fetching.");
                 setIsFetching(false); // Turn off indicator
                 return; // Stop if status is invalid
            }

            // Step 4: Check if the branch is now behind (remote branch existed and diverged)
            if (statusAfterFetch?.behind > 0) {
                // IMPORTANT: Provide clear guidance when non-fast-forward happens during publish attempt
                setError(`Publish failed: Remote branch "${current}" already exists and contains work you do not have locally. Please Pull first to integrate changes (may require manual merge if histories diverged significantly).`);
                setIsFetching(false); // Turn off indicator now
                // No need to refresh status again, fetchGitStatus already updated it
                return; // Stop, user needs to pull
            }

             // Step 4.5: Check if there are commits to push (ahead > 0). Publish needs commits.
             // Use the status *after* fetch for the most up-to-date 'ahead' count relative to remote.
             if (statusAfterFetch?.ahead === 0) {
                  // Maybe the branch exists remotely and is identical, or maybe local has no commits.
                  // If local has no commits, push will fail anyway. Let's check local commits.
                  // This requires an extra check or assuming the user wouldn't publish an empty branch.
                  // For simplicity, let's proceed, the backend push will fail if nothing to push.
                  console.warn(`[CommitTab] Publishing: Branch "${current}" has no commits ahead of remote (or remote doesn't exist yet). Proceeding with push attempt.`);
                 // If you wanted to prevent pushing an empty branch:
                 // const localCommitsExist = statusAfterFetch?.files.length > 0 || ahead > 0 ; // Heuristic
                 // if (!localCommitsExist) { setError(`Publish failed: No local commits found on branch "${current}" to publish.`); setIsFetching(false); return;}
             }


            // Step 5: Proceed with the actual push if not behind
            console.log(`[CommitTab] Publishing: Attempting push for branch "${current}" with --set-upstream expected.`);
            setIsFetching(false); // Turn off fetch indicator
            setIsPushing(true); // Turn on push indicator
            setError(null);
            try {
                // The gitPush IPC handler should include '--set-upstream' based on its internal check
                await callElectronApi('gitPush', selectedFolderPath, remoteName, current, accessToken);
                console.log("[CommitTab] Publishing: Push successful.");
                // Refresh status after successful publish
                 await fetchGitStatus(selectedFolderPath, true); // Refresh status silently
            } catch (pushErr) {
                 // The IPC handler provides specific error messages (like unrelated histories)
                 setError(`Publish failed: ${pushErr.message}`);
                 console.error("[CommitTab] Publish Push Error:", pushErr);
            } finally {
                 setIsPushing(false); // Turn off push indicator
            }

        }
        // --- Regular Push Scenario (Branch is Tracking) ---
        else {
             console.log("[CommitTab] Executing Regular Push flow...");
             // Pre-checks for regular push
            if (behind > 0) {
                setError("Cannot push: Local branch is behind remote. Please Pull first.");
                return;
            }
            if (ahead === 0) {
                // It's possible to be tracking but have 0 ahead/behind if just pulled/cloned
                setError("Cannot push: Local branch is already up-to-date with the remote.");
                return;
            }

             // Use the standard wrapper for regular push
             handleApiCall(
                 () => callElectronApi('gitPush', selectedFolderPath, remoteName, current, accessToken),
                 setIsPushing, // Set pushing state
                 setError, // Set general error on failure
                 false // Refresh status after successful push
             );
        }
    };

    // --- Other UI Action Handlers ---
     const handleRefreshStatus = () => {
        if (!selectedFolderPath) return;
        // Don't use wrapper, just call fetch directly
        fetchGitStatus(selectedFolderPath);
     }

     const handleConfigureRemote = () => {
        clearErrors(); // Clear errors when opening setup
        setShowRepoSetup(true);
     }

     const handleCommitMessageChange = (e) => {
         setCommitMessage(e.target.value);
     }

     const handleFileSelectForDiff = (file, isStagedView = false) => {
         const path = file?.path;
         if (!path) return;
         // Toggle selection
         if (selectedFileForDiff && selectedFileForDiff.path === path && selectedFileForDiff.isStaged === isStagedView) {
             setSelectedFileForDiff(null);
         } else {
             setSelectedFileForDiff({ path, isStaged: isStagedView });
         }
     };


    // --- Setup Action Handlers ---
     const handleInitializeRepo = () => handleApiCall(
         () => {
             if (!selectedFolderPath) throw new Error("Missing folder path for init");
             return callElectronApi('gitInit', selectedFolderPath);
         },
         setIsInitializing,
         setSetupError, // Set setup-specific error
         false // Refresh status after init
     );

     const handleFetchUserRepos = useCallback(async () => {
        if (!accessToken) {
            setSetupError("GitHub Access Token is missing in application settings.");
            setUserRepos([]);
            return;
        }
         setIsInitializing(true); setSetupError(null); setUserRepos([]); // Clear previous repos and error
         try {
             console.log("[CommitTab] Fetching user repositories...");
             const repos = await callElectronApi('githubListUserRepos', accessToken);
             setUserRepos(Array.isArray(repos) ? repos : []);
             console.log(`[CommitTab] Fetched ${repos?.length || 0} repositories.`);
         } catch (err) {
             console.error("[CommitTab] Fetch User Repos Error:", err);
             setSetupError(err.message); // Show error in setup UI
             setUserRepos([]);
         } finally {
             setIsInitializing(false);
         }
     }, [accessToken]); // Depends only on token

     // Effect to fetch repos when setup is shown for linking
      useEffect(() => {
         if (showRepoSetup && isRepo && !gitStatus?.remoteUrl && accessToken) {
              handleFetchUserRepos();
         } else if (showRepoSetup && (!isRepo || gitStatus?.remoteUrl || !accessToken)) {
              // Clear list if setup shown but conditions not met (e.g., no token, already linked)
              setUserRepos([]);
         }
         // Clear setup error when setup visibility changes
         if (!showRepoSetup) {
             setSetupError(null);
         }
     }, [showRepoSetup, isRepo, gitStatus, accessToken, handleFetchUserRepos]);

     // Link Handler - Tries to set upstream after adding remote
     const handleLinkExistingRepo = (cloneUrl) => handleApiCall(
         async () => {
            if (!selectedFolderPath || !cloneUrl) throw new Error("Missing path/URL for linking");
             await callElectronApi('gitAddRemote', selectedFolderPath, remoteName, cloneUrl);
             console.log('[CommitTab] Remote added successfully.');

             try {
                 console.log(`[CommitTab] Attempting to set upstream for ${defaultBranchName} to ${remoteName}/${defaultBranchName}...`);
                 await callElectronApi('gitSetUpstream', selectedFolderPath, defaultBranchName, remoteName, defaultBranchName);
                 console.log(`[CommitTab] Upstream setting attempted for ${defaultBranchName}.`);
             } catch (upstreamError) {
                 console.warn(`[CommitTab] Non-critical error setting upstream after linking: ${upstreamError.message}`);
             }
         },
         setIsInitializing, // Set main initializing state
         setSetupError, // Set setup-specific error if gitAddRemote fails
         false // Let the wrapper refresh status *after* both steps attempt
     );

     // Create & Link Handler - Tries to set upstream after adding remote
     const handleCreateAndLinkRepo = (repoName, isPrivate) => handleApiCall(
         async () => {
            if (!selectedFolderPath || !repoName || !accessToken) throw new Error("Missing info for creating/linking repo");
             // Step 1: Create repo on GitHub
             const newRepo = await callElectronApi('githubCreateRepo', accessToken, repoName, isPrivate);
             console.log('[CommitTab] GitHub repo created successfully.');

             // Step 2: Add the remote locally
             await callElectronApi('gitAddRemote', selectedFolderPath, remoteName, newRepo.clone_url);
             console.log('[CommitTab] Remote added successfully.');

             // Step 3: *Attempt* to set upstream for the default branch
             try {
                console.log(`[CommitTab] Attempting to set upstream for ${defaultBranchName} to ${remoteName}/${defaultBranchName}...`);
                 await callElectronApi('gitSetUpstream', selectedFolderPath, defaultBranchName, remoteName, defaultBranchName);
                 console.log(`[CommitTab] Upstream setting attempted for ${defaultBranchName}.`);
             } catch (upstreamError) {
                 console.warn(`[CommitTab] Non-critical error setting upstream after creating/linking: ${upstreamError.message}`);
             }
             // Form fields should be cleared by RepoSetup component or parent state update
         },
         setIsInitializing, // Set main initializing state
         setSetupError, // Set setup-specific error if create or addRemote fails
         false // Let the wrapper refresh status *after* all steps attempt
     );

     const handleCloseSetup = () => {
        setShowRepoSetup(false);
        setSetupError(null);
        if (selectedFolderPath) {
            fetchGitStatus(selectedFolderPath); // Refresh status after closing setup
        }
     }


    // --- MEMOIZED VALUES for Child Components ---
    const unstagedChanges = useMemo(() => {
        if (!Array.isArray(gitStatus?.files)) return [];
        return gitStatus.files.filter(f =>
            !stagedFiles.has(f.path) &&
            ( (f.working_dir !== ' ' && f.working_dir !== '?') || (f.working_dir === '?' && f.index === '?') )
            && f.working_dir !== '!'
        );
    }, [gitStatus, stagedFiles]);

    const currentlyStagedFiles = useMemo(() => {
        if (!Array.isArray(gitStatus?.files)) return [];
         return gitStatus.files.filter(f => stagedFiles.has(f.path));
    }, [gitStatus, stagedFiles]);

    const hasAnyChanges = unstagedChanges.length > 0 || currentlyStagedFiles.length > 0;

    // --- RENDER LOGIC ---
        if (!accessToken && onGithubLogin && selectedFolderPath && activeTab === 'Commit') {
     return <GitHubLogin onLoginAttempt={onGithubLogin} />;
  }

    // 1. No Folder Selected Placeholder
    if (!selectedFolderPath) {
        return (
            <div className="p-4 text-gray-600 flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <VscSourceControl size={48} className="mx-auto mb-2 text-gray-400" />
                    <p>Please select a folder to manage commits.</p>
                </div>
            </div>
        );
    }

    // 2. Initial Loading State (only show if not also showing setup)
    if (isLoading && !showRepoSetup) {
        return <LoadingIndicator message="Loading Git status..." />;
    }

    // 3. General Error Display (only show if not showing setup)
    // Ensure error state is not null before rendering ErrorDisplay
    if (error && !showRepoSetup) {
        return (
            <ErrorDisplay
                error={error}
                onRetry={handleRefreshStatus}
                onSetup={() => { clearErrors(); setShowRepoSetup(true); }} // Clear general error when switching
                isLoading={isLoading}
                // Show setup option if error suggests it or if known not to be a repo
                showSetupOption={!isRepo || error.includes("remote") || error.includes("tracking") || error.includes("repository")}
            />
        );
    }

    // 4. Repository Setup Screen
    if (showRepoSetup) {
        return (
            <RepoSetup
                isRepo={isRepo}
                isInitializing={isInitializing}
                accessToken={accessToken}
                userRepos={userRepos}
                setupError={setupError} // Pass setup-specific error
                onInitializeRepo={handleInitializeRepo}
                onFetchUserRepos={handleFetchUserRepos} // Let RepoSetup trigger this if needed
                onLinkExistingRepo={handleLinkExistingRepo}
                onCreateAndLinkRepo={handleCreateAndLinkRepo}
                onCloseSetup={handleCloseSetup}
            />
        );
    }

    // 5. Fallback if Status is Null after loading/error checks (should be rare)
    // Ensure gitStatus is checked *before* trying to render main view
    if (!gitStatus) {
        // If it's not loading, and not showing setup, and status is null, show error/retry
        if (!isLoading) {
             return <div className="p-4 text-gray-600 flex-1 flex items-center justify-center bg-gray-100">
                 <VscError className="mr-2 text-red-500" size={24}/> Could not load Git information. Check logs.
                 <button onClick={handleRefreshStatus} className="ml-4 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"> Retry </button>
             </div>;
        } else {
            // It might still be loading in the background (e.g. silent refresh), show loading
             return <LoadingIndicator message="Loading Git status..." />;
        }
    }


    // 6. Render Main Commit View using Child Components
    return (
        <div className="flex flex-col h-full bg-gray-50 text-gray-800">
            <CommitPanelHeader
                gitStatus={gitStatus} // Pass full status object
                isLoading={isLoading} // Pass individual loading states
                isFetching={isFetching}
                isPushing={isPushing}
                isCommitting={isCommitting}
                isInitializing={isInitializing}
                onFetch={handleFetch}
                onPull={handlePull}
                onPush={handlePushOrPublish} // Use the combined handler
                onRefreshStatus={handleRefreshStatus}
                onConfigureRemote={handleConfigureRemote}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Changes Lists */}
                <div className="w-1/3 min-w-[280px] max-w-[450px] border-r border-gray-300 bg-white flex flex-col overflow-y-auto">
                    <ChangesList
                        title="Staged"
                        files={currentlyStagedFiles}
                        isStagedList={true}
                        selectedFileForDiff={selectedFileForDiff}
                        actionInProgress={anyActionLoading} // Disable actions during any loading state
                        onFileSelect={handleFileSelectForDiff}
                        onFileAction={handleUnstageFile} // Pass unstage handler
                        onActionAll={handleUnstageAll} // Pass unstageAll handler
                    />
                    <ChangesList
                        title="Changes"
                        files={unstagedChanges}
                        isStagedList={false}
                        selectedFileForDiff={selectedFileForDiff}
                        actionInProgress={anyActionLoading}
                        onFileSelect={handleFileSelectForDiff}
                        onFileAction={handleStageFile} // Pass stage handler
                        onActionAll={handleStageAll} // Pass stageAll handler
                    />
                </div>

                {/* Right Panel: Diff Viewer and Commit Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">
                    <DiffViewerPanel
                        selectedFileForDiff={selectedFileForDiff}
                        diffContent={diffContent}
                        hasChanges={hasAnyChanges}
                        isRepo={isRepo}
                    />
                    <CommitMessageArea
                        commitMessage={commitMessage}
                        isCommitting={isCommitting}
                        stagedFilesCount={currentlyStagedFiles.length}
                        currentBranch={gitStatus?.current}
                        onCommitMessageChange={handleCommitMessageChange}
                        onCommit={handleCommit}
                    />
                </div>
            </div>
        </div>
    );
};

export default CommitTab;