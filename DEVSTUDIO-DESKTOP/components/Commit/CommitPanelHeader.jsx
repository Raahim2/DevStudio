import React from 'react';
import { FiGithub, FiGitBranch, FiAlertCircle, FiRefreshCw, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { VscCloudDownload, VscSync, VscRepoPush, VscRepoPull } from 'react-icons/vsc'; // Removed unused icons

const CommitPanelHeader = ({
    gitStatus, // The whole status object
    isLoading, // General loading (e.g., initial status fetch)
    isFetching, // Fetch/Pull in progress
    isPushing, // Push in progress
    isCommitting, // Commit in progress
    isInitializing, // Init/Link/Create in progress
    onFetch,
    onPull,
    onPush, // This is the combined handlePushOrPublish
    onRefreshStatus,
    onConfigureRemote, // Function to trigger showing setup
}) => {
    // Default gitStatus to an empty object for safe destructuring if it's null initially
    const {
        current = null,
        tracking = null,
        remoteUrl = null,
        ahead = 0,
        behind = 0
    } = gitStatus || {};

    const remoteName = 'origin'; // Assuming 'origin'

    // Combine all possible loading states that should disable buttons
    const anyLoading = isLoading || isFetching || isPushing || isCommitting || isInitializing;

    // Helper to shorten tracking branch name for display
    const getShortTrackingName = (trackingName) => {
        if (!trackingName) return '';
        return trackingName.replace(`refs/remotes/${remoteName}/`, ''); // Attempt to shorten
    }

    return (
        <div className="p-3 border-b border-neutral-300 [.dark_&]:border-neutral-700 bg-white [.dark_&]:bg-neutral-800 flex items-center justify-between text-sm flex-wrap gap-y-2 gap-x-4">
            {/* Branch Info Section */}
            <div className="flex items-center flex-wrap gap-x-3">
                {current ? (
                     <span className="flex items-center font-semibold [.dark_&]:text-neutral-200" title={`Current branch: ${current}`}>
                        <FiGitBranch className="mr-1.5 text-neutral-600 [.dark_&]:text-neutral-400 flex-shrink-0" />
                        {current}
                    </span>
                ) : gitStatus ? (
                     <span className="flex items-center font-semibold text-orange-600 [.dark_&]:text-orange-400" title="Detached HEAD state">
                         <FiAlertCircle className="mr-1.5 flex-shrink-0" />
                         Detached HEAD
                     </span>
                 ) : null}

                {tracking && (
                    <span className="text-neutral-500 [.dark_&]:text-neutral-400 flex items-center" title={`Tracking remote branch: ${tracking}`}>
                        <VscSync className="inline mr-1 flex-shrink-0"/> {getShortTrackingName(tracking)}
                         {ahead > 0 && <span className="text-blue-500 [.dark_&]:text-blue-400 ml-1.5 flex items-center" title={`${ahead} commit(s) ahead of remote`}> <FiArrowUp className="inline mr-0.5"/> {ahead}</span>}
                         {behind > 0 && <span className="text-blue-500 [.dark_&]:text-blue-400 ml-1.5 flex items-center" title={`${behind} commit(s) behind remote`}> <FiArrowDown className="inline mr-0.5"/> {behind}</span>}
                    </span>
                )}

                {remoteUrl && (
                    <a
                        href={remoteUrl.replace(/\.git$/, '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open remote repository on GitHub"
                        className="text-blue-600 [.dark_&]:text-blue-400 hover:underline flex items-center"
                    >
                        <FiGithub className="inline mr-1 flex-shrink-0"/> GitHub
                    </a>
                )}

                {!remoteUrl && isRepo && current && (
                     <button
                        onClick={onConfigureRemote}
                        className="text-blue-600 [.dark_&]:text-blue-400 hover:underline text-xs flex items-center"
                        title="Configure the remote repository URL (e.g., origin)"
                        disabled={anyLoading}
                     >
                        <FiGithub className="mr-1"/> Configure Remote
                     </button>
                 )}
            </div>

            {/* Sync Actions Section */}
            <div className="flex items-center space-x-2 flex-shrink-0">
                 <button
                    onClick={onPull}
                    disabled={anyLoading || !remoteUrl}
                    title={!remoteUrl ? "Configure remote first" : "Fetch changes from remote"}
                    className="p-1.5 rounded hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed [.dark_&]:text-neutral-200"
                >
                    {isFetching ? <FiRefreshCw className="animate-spin" /> : <VscCloudDownload size={18}/>}
                </button>
                
                <button
                    onClick={onPush}
                    disabled={anyLoading || !remoteUrl || behind > 0 || (tracking && ahead === 0)}
                    title={!remoteUrl ? "Configure remote first" : anyLoading ? "Action in progress..." : behind > 0 ? `Pull ${behind} changes before pushing` : !tracking ? `Push to Github` : ahead > 0 ? `Push ${ahead} commit(s) to ${remoteName}/${current || ''}` : "Push (already up-to-date)"}
                    className="px-3 py-1.5 bg-blue-600 [.dark_&]:bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-700 [.dark_&]:hover:bg-blue-800 disabled:bg-neutral-400 [.dark_&]:disabled:bg-neutral-600 disabled:cursor-not-allowed flex items-center"
                >
                    {isPushing ? <FiRefreshCw className="animate-spin mr-1" /> : <VscRepoPush className="mr-1" size={16}/>}
                    {!tracking ? 'Push' : (ahead > 0 ? `Push (${ahead})` : 'Push')}
                </button>

                 <button
                    onClick={onRefreshStatus}
                    title="Refresh Git status"
                    className="p-1.5 rounded hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed [.dark_&]:text-neutral-200"
                    disabled={anyLoading}
                >
                    <FiRefreshCw className={isLoading && !isFetching && !isPushing && !isCommitting && !isInitializing ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
    );
};

export default CommitPanelHeader;