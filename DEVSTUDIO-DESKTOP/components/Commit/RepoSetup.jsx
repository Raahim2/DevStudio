import React, { useState, useEffect } from 'react';
import { FiGithub, FiPlusSquare, FiRefreshCw, FiGitBranch, FiAlertCircle } from 'react-icons/fi';

// Simplified Error Display for setup
const SetupError = ({ error }) => {
    if (!error) return null;
    return (
        <div className="p-3 mb-4 text-red-600 bg-red-50 border border-red-200 rounded text-sm">
            <h4 className="font-bold flex items-center mb-1"><FiAlertCircle className="inline mr-1" /> Setup Error</h4>
            <p>{error}</p>
        </div>
    );
}

const RepoSetup = ({
    isRepo, // boolean: Is the current folder already a repo?
    isInitializing, // boolean: Is an init/link/create action in progress?
    accessToken, // string | null
    userRepos = [], // array: List of fetched GitHub repos
    setupError, // string | null: Specific error during setup actions
    onInitializeRepo, // function
    onFetchUserRepos, // function
    onLinkExistingRepo, // function(cloneUrl)
    onCreateAndLinkRepo, // function(repoName, isPrivate)
    onCloseSetup, // function
}) => {
    const [selectedRemoteRepo, setSelectedRemoteRepo] = useState('');
    const [newRepoName, setNewRepoName] = useState('');
    const [isPrivateRepo, setIsPrivateRepo] = useState(false);
    const [internalError, setInternalError] = useState(null); // For form validation

    // Clear internal error if setupError changes from parent
    useEffect(() => {
        setInternalError(null);
    }, [setupError]);

    // Clear selections/inputs when component mounts or repo status changes
     useEffect(() => {
        setSelectedRemoteRepo('');
        setNewRepoName('');
        setIsPrivateRepo(false);
     }, [isRepo]);

    const handleLinkClick = () => {
        if (!selectedRemoteRepo) {
            setInternalError("Please select a repository to link.");
            return;
        }
        setInternalError(null);
        onLinkExistingRepo(selectedRemoteRepo);
    };

    const handleCreateClick = () => {
        if (!newRepoName.trim()) {
            setInternalError("Please enter a name for the new repository.");
            return;
        }
         if (!accessToken) {
             setInternalError("GitHub Access Token is missing. Cannot create repository.");
             return;
         }
        setInternalError(null);
        onCreateAndLinkRepo(newRepoName.trim(), isPrivateRepo);
    };

    const handleSelectChange = (e) => {
        setInternalError(null); // Clear error on change
        setSelectedRemoteRepo(e.target.value);
    };

    const handleInputChange = (e) => {
         setInternalError(null); // Clear error on change
         setNewRepoName(e.target.value);
    }


    return (
        <div className="p-6 bg-gray-50 [.dark_&]:bg-neutral-900 flex-1 overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-700 [.dark_&]:text-neutral-200 mb-4">Repository Setup</h2>
            <SetupError error={setupError || internalError} />

            {!isRepo ? (
                // Option 1: Initialize
                <div className="mb-6 p-4 border rounded-md bg-white [.dark_&]:bg-neutral-800 [.dark_&]:border-neutral-700 shadow-sm">
                    <h3 className="font-semibold text-lg text-gray-700 [.dark_&]:text-neutral-200 mb-3">Initialize Local Repository</h3>
                    <p className="text-gray-600 [.dark_&]:text-neutral-400 mb-4">Turn this folder into a Git repository to start tracking changes.</p>
                    <button
                        onClick={onInitializeRepo}
                        disabled={isInitializing}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center text-sm"
                    >
                        {isInitializing ? <FiRefreshCw className="animate-spin mr-2" /> : <FiPlusSquare className="mr-2"/>}
                        Initialize Repository
                    </button>
                    {isInitializing && <p className="text-sm text-gray-500 [.dark_&]:text-neutral-400 mt-2">Initializing...</p>}
                </div>
            ) : (
                // Options 2 & 3: Link/Create Remote
                <div className="mb-6 p-4 border rounded-md bg-white [.dark_&]:bg-neutral-800 [.dark_&]:border-neutral-700 shadow-sm">
                    <h3 className="font-semibold text-lg text-gray-700 [.dark_&]:text-neutral-200 mb-3">Connect to GitHub Remote</h3>
                     <p className="text-gray-700 [.dark_&]:text-neutral-300 font-medium mb-1">Local repository exists.</p>
                    <p className="text-gray-600 [.dark_&]:text-neutral-400 mb-4">Link it to a GitHub repository to push, pull, and collaborate.</p>

                    {/* Link Existing */}
                    <div className="mb-5 p-4 border rounded bg-gray-100 [.dark_&]:bg-neutral-700 [.dark_&]:border-neutral-600">
                        <h4 className="font-semibold text-gray-700 [.dark_&]:text-neutral-200 mb-2 flex items-center"><FiGithub className="mr-2"/> Link to Existing GitHub Repository</h4>
                        {!accessToken ? (
                             <p className="text-sm text-orange-600 [.dark_&]:text-orange-400">Add your GitHub Personal Access Token in settings to list your repositories.</p>
                        ) : isInitializing && userRepos.length === 0 ? (
                             <p className="text-sm text-gray-500 [.dark_&]:text-neutral-400 flex items-center"><FiRefreshCw className="animate-spin mr-2"/> Loading repositories...</p>
                        ) : (
                            <>
                                <select
                                    value={selectedRemoteRepo}
                                    onChange={handleSelectChange}
                                    className="w-full p-2 border rounded mb-3 text-sm bg-white [.dark_&]:bg-neutral-700 [.dark_&]:border-neutral-600 [.dark_&]:text-neutral-200 disabled:bg-gray-100 [.dark_&]:disabled:bg-neutral-800"
                                    disabled={isInitializing}
                                >
                                    <option value="">Select your repository...</option>
                                    {userRepos.map(repo => (
                                        <option key={repo.id} value={repo.clone_url}>{repo.full_name}</option>
                                    ))}
                                </select>
                                {userRepos.length === 0 && !isInitializing && (
                                     <p className="text-sm text-gray-500 [.dark_&]:text-neutral-400 mb-3">No repositories found or failed to load. Try refreshing setup.</p>
                                )}
                                <button
                                    onClick={handleLinkClick}
                                    disabled={isInitializing || !selectedRemoteRepo}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm flex items-center"
                                >
                                    {isInitializing ? <FiRefreshCw className="animate-spin mr-2" /> : <FiGitBranch className="mr-2"/>}
                                    Link Selected Repository
                                </button>
                            </>
                        )}
                    </div>

                    {/* Create and Link New */}
                    <div className="p-4 border rounded bg-gray-100 [.dark_&]:bg-neutral-700 [.dark_&]:border-neutral-600">
                        <h4 className="font-semibold text-gray-700 [.dark_&]:text-neutral-200 mb-2 flex items-center"><FiGithub className="mr-2"/> Create & Link New GitHub Repository</h4>
                         {!accessToken ? (
                              <p className="text-sm text-orange-600 [.dark_&]:text-orange-400">Add your GitHub Personal Access Token in settings to create repositories.</p>
                         ) : (
                             <>
                                <input
                                    type="text"
                                    placeholder="New repository name (e.g., my-project)"
                                    value={newRepoName}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded mb-2 text-sm bg-white [.dark_&]:bg-neutral-700 [.dark_&]:border-neutral-600 [.dark_&]:text-neutral-200 disabled:bg-gray-100 [.dark_&]:disabled:bg-neutral-800"
                                    disabled={isInitializing}
                                />
                                <label className="flex items-center mb-3 text-sm text-gray-600 [.dark_&]:text-neutral-400">
                                    <input
                                        type="checkbox"
                                        checked={isPrivateRepo}
                                        onChange={(e) => setIsPrivateRepo(e.target.checked)}
                                        className="mr-2 disabled:opacity-50"
                                        disabled={isInitializing}
                                    />
                                    Private repository
                                </label>
                                <button
                                    onClick={handleCreateClick}
                                    disabled={isInitializing || !newRepoName.trim()}
                                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center"
                                >
                                    {isInitializing ? <FiRefreshCw className="animate-spin mr-2" /> : <FiPlusSquare className="mr-2"/>}
                                    Create and Link Repository
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

             <button
                onClick={onCloseSetup}
                className="mt-4 text-sm text-blue-600 [.dark_&]:text-blue-400 hover:underline"
                disabled={isInitializing}
            >
                Close Setup & Refresh Status
            </button>
        </div>
    );
};

export default RepoSetup;