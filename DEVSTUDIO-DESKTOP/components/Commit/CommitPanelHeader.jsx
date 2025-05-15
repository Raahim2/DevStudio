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
        <div className="p-3 border-b border-gray-300 bg-white flex items-center justify-between text-sm flex-wrap gap-y-2 gap-x-4">
            {/* Branch Info Section */}
            <div className="flex items-center flex-wrap gap-x-3">
                {current ? (
                     <span className="flex items-center font-semibold" title={`Current branch: ${current}`}>
                        <FiGitBranch className="mr-1.5 text-gray-600 flex-shrink-0" />
                        {current}
                    </span>
                ) : gitStatus ? ( // Only show detached head if status object exists but no current branch
                     <span className="flex items-center font-semibold text-orange-600" title="Detached HEAD state">
                         <FiAlertCircle className="mr-1.5 flex-shrink-0" />
                         Detached HEAD
                     </span>
                 ) : null /* Don't show anything if status isn't loaded */}

                {tracking && (
                    <span className="text-gray-500 flex items-center" title={`Tracking remote branch: ${tracking}`}>
                        <VscSync className="inline mr-1 flex-shrink-0"/> {getShortTrackingName(tracking)}
                         {ahead > 0 && <span className="text-blue-500 ml-1.5 flex items-center" title={`${ahead} commit(s) ahead of remote`}> <FiArrowUp className="inline mr-0.5"/> {ahead}</span>}
                         {behind > 0 && <span className="text-blue-500 ml-1.5 flex items-center" title={`${behind} commit(s) behind remote`}> <FiArrowDown className="inline mr-0.5"/> {behind}</span>}
                    </span>
                )}

                {/* Link to GitHub Repo */}
                {remoteUrl && (
                    <a
                        href={remoteUrl.replace(/\.git$/, '')} // Attempt to create browseable URL
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open remote repository on GitHub"
                        className="text-blue-600 hover:underline flex items-center"
                    >
                        <FiGithub className="inline mr-1 flex-shrink-0"/> GitHub
                    </a>
                )}

                {/* Configure Remote Button (Show if repo exists, has branch, but no remote URL) */}
                 {!remoteUrl && isRepo && current && (
                     <button
                        onClick={onConfigureRemote}
                        className="text-blue-600 hover:underline text-xs flex items-center"
                        title="Configure the remote repository URL (e.g., origin)"
                        disabled={anyLoading}
                     >
                        <FiGithub className="mr-1"/> Configure Remote
                     </button>
                 )}

                 {/* Branch Not Tracking Hint (Show if remote exists, no tracking info, AND not behind)
                 {!tracking && current && remoteUrl && behind === 0 && (
                     <span className="text-orange-500 text-xs flex items-center" title="Push to publish this branch and set up tracking information">
                        <FiAlertCircle className="mr-1"/> Branch not tracking remote
                     </span>
                 )} */}
            </div>

            {/* Sync Actions Section */}
            <div className="flex items-center space-x-2 flex-shrink-0">
                 {/* Fetch Button */}
                 <button
                    onClick={onPull}
                    disabled={anyLoading || !remoteUrl} // Disable if busy or no remote configured
                    title={!remoteUrl ? "Configure remote first" : "Fetch changes from remote"}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isFetching ? <FiRefreshCw className="animate-spin" /> : <VscCloudDownload size={18}/>}
                </button>
                
                {/* Push / Publish Button */}
                <button
                    onClick={onPush} // Calls handlePushOrPublish
                    disabled={
                        anyLoading ||
                        !remoteUrl ||
                        behind > 0 || // Cannot push if behind
                        (tracking && ahead === 0) // Cannot push if tracking and up-to-date
                    }
                    title={ // Provide informative title based on state
                        !remoteUrl ? "Configure remote first" :
                        anyLoading ? "Action in progress..." :
                        behind > 0 ? `Pull ${behind} changes before pushing` :
                        !tracking ? `Push to Github` : 
                        ahead > 0 ? `Push ${ahead} commit(s) to ${remoteName}/${current || ''}` :
                        "Push (already up-to-date)"
                    }
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                    {isPushing ? <FiRefreshCw className="animate-spin mr-1" /> : <VscRepoPush className="mr-1" size={16}/>}
                    {/* Button Text Logic: Publish or Push */}
                    {!tracking ? 'Push' : (ahead > 0 ? `Push (${ahead})` : 'Push')}
                </button>

                 {/* Refresh Status Button */}
                 <button
                    onClick={onRefreshStatus}
                    title="Refresh Git status"
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={anyLoading} // Disable refresh during any other action
                >
                    {/* Show spin only during general loading (initial fetch), not other actions */}
                    <FiRefreshCw className={isLoading && !isFetching && !isPushing && !isCommitting && !isInitializing ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
    );
};

export default CommitPanelHeader;