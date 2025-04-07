// components/HomeTabContent.jsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    FiGithub, FiStar, FiGitBranch, FiExternalLink, FiLoader, FiAlertCircle,
    FiBox, FiSearch, FiEye, FiCode, FiFileText, FiFolder, FiBookOpen
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Helper Functions (Unchanged) ---
const getLanguageColor = (language) => {
  switch (language?.toLowerCase()) {
    case 'javascript': return 'bg-yellow-400';
    case 'typescript': return 'bg-blue-500';
    case 'python': return 'bg-green-500';
    case 'html': return 'bg-orange-500';
    case 'css': return 'bg-purple-500';
    case 'java': return 'bg-red-500';
    case 'ruby': return 'bg-red-600';
    case 'go': return 'bg-cyan-400';
    case 'c#': return 'bg-purple-600';
    case 'php': return 'bg-indigo-400';
    case 'shell': return 'bg-gray-500';
    default: return 'bg-gray-400';
  }
};

const decodeBase64 = (base64) => {
    // Using Buffer is generally more robust for Base64 in Node/Electron env
    try {
       return Buffer.from(base64, 'base64').toString('utf-8');
    } catch (e) {
        console.error("Base64 decoding failed:", e);
        // Fallback just in case Buffer isn't available or fails strangely
        try {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (e2) {
            console.error("Fallback Base64 decoding failed:", e2);
            return "Error decoding content.";
        }
    }
};

// --- Main Component ---
const HomeTabContent = ({
    userRepos,          // Array of repo objects
    selectedRepo,       // The currently selected repo object (or null)
    setSelectedRepo,    // Function to update selectedRepo in parent
    isRepoListLoading,  // Boolean indicating if the list is loading (passed from parent)
    repoListError,      // Error message if list loading failed (passed from parent)
    sessionStatus,      // Status like 'loading', 'authenticated', 'unauthenticated' (passed from parent)
    accessToken,        // The GitHub Access Token (passed from parent)
    onLoginClick        // Function provided by parent to trigger login (e.g., call window.electronAPI.loginGithub)
}) => {
    // Removed useSession hook

    const [searchQuery, setSearchQuery] = useState('');

    // --- State for Right Panel Details (README/Files) ---
    const [repoDetailContent, setRepoDetailContent] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [detailContentType, setDetailContentType] = useState('none'); // 'readme', 'files', 'error', 'loading', 'none'

    // --- Memoized Filtered Repositories ---
    const filteredRepos = useMemo(() => {
        if (!searchQuery) {
            return userRepos || [];
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return (userRepos || []).filter(repo =>
            repo.name.toLowerCase().includes(lowerCaseQuery) ||
            (repo.description && repo.description.toLowerCase().includes(lowerCaseQuery))
        );
    }, [userRepos, searchQuery]);

    // --- Effect: Fetch Repo Details (README or Files) ---
    useEffect(() => {
        if (!selectedRepo) {
            setRepoDetailContent(null);
            setDetailError(null);
            setIsDetailLoading(false);
            setDetailContentType('none');
            return;
        }

        // Use the accessToken prop for authentication check
        if (!accessToken) {
             console.log("Skipping detail fetch: No access token provided via props.");
             // Decide if this is an error or just needs login based on sessionStatus
             if (sessionStatus === 'authenticated' && !accessToken) {
                 // This case is weird: parent says authenticated but no token provided? Log warning.
                 console.warn("Session status is authenticated, but no accessToken provided to HomeTabContent.");
                 setDetailError("Authentication token missing despite status.");
                 setDetailContentType('error');
             } else if (sessionStatus !== 'loading') {
                 // If not loading and no token, likely needs login
                 setDetailError("Login required to load repository details.");
                 setDetailContentType('error'); // Or could be 'needs-login' if you want specific UI
             } else {
                 // Still loading auth status from parent
                 setDetailContentType('loading');
             }
             setRepoDetailContent(null);
             setIsDetailLoading(false); // Not technically loading the *detail*, waiting for auth/token
             return;
        }

        const fetchDetails = async () => {
            const { full_name } = selectedRepo;
            console.log(`Fetching details for ${full_name} using provided token...`);
            setIsDetailLoading(true);
            setDetailError(null);
            setRepoDetailContent(null);
            setDetailContentType('loading');

            const apiUrlBase = `https://api.github.com/repos/${full_name}`;
            const headers = {
                // Use the accessToken prop here
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
            };

            try {
                // 1. Attempt to fetch README
                console.log(`Fetching README for ${full_name}`);
                const readmeResponse = await fetch(`${apiUrlBase}/readme`, { headers });

                if (readmeResponse.ok) {
                    const readmeData = await readmeResponse.json();
                    console.log(`README found for ${full_name}`);
                    setRepoDetailContent(decodeBase64(readmeData.content));
                    setDetailContentType('readme');
                } else if (readmeResponse.status === 404) {
                    // 2. README not found, attempt to fetch root directory contents
                    console.log(`README not found for ${full_name}, fetching root contents...`);
                    const contentsResponse = await fetch(`${apiUrlBase}/contents/`, { headers });

                    if (contentsResponse.ok) {
                        const contentsData = await contentsResponse.json();
                        console.log(`Root contents fetched for ${full_name}`);
                        setRepoDetailContent(Array.isArray(contentsData) ? contentsData : []);
                        setDetailContentType('files');
                    } else {
                        // Handle potential rate limits or permission issues on contents fetch
                        const errorData = await contentsResponse.json().catch(() => ({}));
                         if (contentsResponse.status === 401 || contentsResponse.status === 403) {
                             throw new Error(`Authentication/Authorization error fetching contents (Status: ${contentsResponse.status}). Check token validity/permissions.`);
                         }
                        throw new Error(`Failed to fetch contents (Status: ${contentsResponse.status}): ${errorData.message || 'Unknown error'}`);
                    }
                } else {
                    // Handle potential rate limits or permission issues on readme fetch
                    const errorData = await readmeResponse.json().catch(() => ({}));
                     if (readmeResponse.status === 401 || readmeResponse.status === 403) {
                        throw new Error(`Authentication/Authorization error fetching README (Status: ${readmeResponse.status}). Check token validity/permissions.`);
                     }
                    throw new Error(`Failed to fetch README (Status: ${readmeResponse.status}): ${errorData.message || 'Unknown error'}`);
                }

            } catch (error) {
                console.error(`Error fetching details for ${full_name}:`, error);
                setDetailError(error.message);
                setDetailContentType('error');
            } finally {
                setIsDetailLoading(false);
                console.log(`Finished fetching details for ${full_name}`);
            }
        };

        fetchDetails();
    // Depend on selectedRepo object and the accessToken prop
    // sessionStatus is NOT needed for the fetch itself, only for the initial guard clause logic
    }, [selectedRepo, accessToken]); // Removed sessionStatus dependency here

    // --- Render Login Prompt ---
    // Use sessionStatus prop passed from parent to decide whether to show login
    if (sessionStatus === 'unauthenticated') {
        return (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                <FiGithub size={48} className="mb-4 text-gray-400 dark:text-gray-500" />
                <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Connect GitHub</h2>
                <p className="text-center mb-6 max-w-md">
                    Connect your GitHub account to view and interact with your repositories.
                </p>
                <button
                    // Use the onLoginClick prop provided by the parent
                    onClick={onLoginClick}
                    className="flex items-center justify-center px-6 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-md font-medium hover:bg-gray-700 dark:hover:bg-gray-300 transition duration-150 ease-in-out shadow-sm"
                >
                    <FiGithub className="mr-2" />
                    Login with GitHub
                </button>
            </div>
        );
    }

     // --- Render Loading State for Repo List (or initial auth loading) ---
     // Uses isRepoListLoading OR sessionStatus === 'loading' prop from parent
    if (isRepoListLoading || sessionStatus === 'loading') {
        return (
             <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <FiLoader size={32} className="animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">
                    {sessionStatus === 'loading' ? 'Authenticating...' : 'Loading repositories...'}
                </span>
            </div>
        );
    }

    // --- Render Main Content (Two Columns) ---
    return (
        <div className="flex flex-1 h-full overflow-hidden bg-gray-100 dark:bg-gray-800">

            {/* Left Column: Search and Repository List */}
            <div className="w-1/3 max-w-xs flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850">
                {/* Search Bar */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                     <div className="relative">
                        <input
                            type="search"
                            placeholder="Search repositories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <FiSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={14}/>
                    </div>
                </div>

                {/* Repository List */}
                <div className="flex-1 overflow-y-auto">
                    {/* Display error from repo list fetch (prop) */}
                    {repoListError && (
                        <div className="p-4 text-center text-red-500">
                            <FiAlertCircle className="inline-block mr-1" /> {repoListError}
                        </div>
                    )}

                    {/* Display empty/no results based on filteredRepos */}
                    {/* Ensure userRepos exists before checking length */}
                    {!repoListError && filteredRepos.length === 0 && !isRepoListLoading && (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            {searchQuery
                                ? 'No repositories match your search.'
                                : (userRepos && userRepos.length > 0
                                    ? 'No matching repositories found.' // Should only happen if search doesn't match anything
                                    : 'No repositories found.' // This implies the initial fetch returned empty
                                  )
                            }
                        </div>
                    )}


                    {/* Render list using filteredRepos */}
                    {!repoListError && filteredRepos.map(repo => (
                        <button
                            key={repo.id}
                            // Call setSelectedRepo prop from parent on click
                            onClick={() => {
                                console.log("HomeTabContent selecting repo:", repo.full_name);
                                setSelectedRepo(repo);
                            }}
                            // Highlight based on selectedRepo prop
                            className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition duration-100 ease-in-out ${
                                selectedRepo?.id === repo.id ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-transparent'
                            }`}
                            title={repo.description || repo.name}
                        >
                            <h3 className={`font-medium text-sm truncate ${
                                selectedRepo?.id === repo.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'
                            }`}>
                                {repo.name} {/* Display just the name */}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {repo.description || <span className="italic">No description</span>}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Column: Repository Details */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-hidden">
                {/* Use selectedRepo prop to determine if details should be shown */}
                {selectedRepo ? (
                    <>
                        {/* Header Section - Uses selectedRepo prop */}
                        <div className="p-6 flex-shrink-0">
                            <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                <div>
                                     {/* Use data from selectedRepo prop */}
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">{selectedRepo.name}</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedRepo.description || "No description provided."}</p>
                                </div>
                                <a
                                    href={selectedRepo.html_url} // Use data from selectedRepo prop
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 ml-4 px-3 py-1.5 text-xs font-medium text-white bg-gray-700 dark:bg-gray-600 rounded-md hover:bg-gray-800 dark:hover:bg-gray-500 transition duration-150 ease-in-out flex items-center"
                                    title="View on GitHub"
                                >
                                    <FiGithub className="mr-1.5" size={14}/> GitHub <FiExternalLink className="ml-1.5" size={12}/>
                                </a>
                            </div>
                            {/* Metadata Grid - Uses selectedRepo prop */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                {/* Language */}
                                <div className="flex items-center text-gray-700 dark:text-gray-300">
                                    <FiCode size={16} className="mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0"/>
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Language</span>
                                        {selectedRepo.language ? (
                                            <span className="flex items-center mt-0.5">
                                                <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${getLanguageColor(selectedRepo.language)}`}></span>
                                                {selectedRepo.language}
                                            </span>
                                        ) : (
                                            <span className="italic text-gray-500 dark:text-gray-400 mt-0.5">N/A</span>
                                        )}
                                    </div>
                                </div>
                                {/* Stars */}
                                 <div className="flex items-center text-gray-700 dark:text-gray-300">
                                    <FiStar size={16} className="mr-2 text-yellow-500 flex-shrink-0"/>
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Stars</span>
                                        <span className="mt-0.5">{selectedRepo.stargazers_count?.toLocaleString() ?? 0}</span>
                                    </div>
                                </div>
                                {/* Forks */}
                                <div className="flex items-center text-gray-700 dark:text-gray-300">
                                    <FiGitBranch size={16} className="mr-2 text-blue-500 flex-shrink-0"/>
                                     <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Forks</span>
                                        <span className="mt-0.5">{selectedRepo.forks_count?.toLocaleString() ?? 0}</span>
                                    </div>
                                </div>
                                {/* Watchers */}
                                <div className="flex items-center text-gray-700 dark:text-gray-300">
                                    <FiEye size={16} className="mr-2 text-green-500 flex-shrink-0"/>
                                     <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Watchers</span>
                                        <span className="mt-0.5">{selectedRepo.watchers_count?.toLocaleString() ?? 0}</span>
                                    </div>
                                </div>
                                {/* Last Updated */}
                                <div className="flex items-center text-gray-700 dark:text-gray-300 col-span-2 md:col-span-1">
                                    <FiGithub size={16} className="mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0"/>
                                     <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Last Updated</span>
                                        <span className="mt-0.5">{selectedRepo.updated_at ? new Date(selectedRepo.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detail Content Area (README or Files) */}
                        {/* Uses local state: isDetailLoading, detailError, detailContentType, repoDetailContent */}
                        <div className="flex-1 p-6 pt-0 overflow-y-auto">
                            {isDetailLoading && (
                                <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                                    <FiLoader size={24} className="animate-spin mr-2" />
                                    Loading details...
                                </div>
                            )}
                            {/* Show detailError ONLY if not currently loading */}
                            {detailError && !isDetailLoading && (
                                <div className="flex flex-col items-center justify-center h-40 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                                    <FiAlertCircle size={24} className="mb-2" />
                                    <span className="font-medium mb-1">Error loading details</span>
                                    <span className="text-sm text-center">{detailError}</span>
                                    {/* Optional: Add a retry button if applicable */}
                                </div>
                            )}
                            {!isDetailLoading && !detailError && (
                                <>
                                    {/* Render README */}
                                    {detailContentType === 'readme' && repoDetailContent && (
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-gray-800 shadow-sm">
                                            <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 flex items-center">
                                                <FiBookOpen className="mr-2" /> README.md
                                            </h3>
                                            <article className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {repoDetailContent}
                                                </ReactMarkdown>
                                            </article>
                                        </div>
                                    )}

                                    {/* Render File/Folder List */}
                                    {detailContentType === 'files' && Array.isArray(repoDetailContent) && (
                                         <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                                            <h3 className="text-sm font-semibold p-3 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 flex items-center">
                                                <FiFolder className="mr-2" /> Root Directory
                                            </h3>
                                            {repoDetailContent.length > 0 ? (
                                                <ul className="divide-y divide-gray-100 dark:divide-gray-750">
                                                    {repoDetailContent.sort((a, b) => { /* sort unchanged */
                                                        if (a.type === 'dir' && b.type !== 'dir') return -1;
                                                        if (a.type !== 'dir' && b.type === 'dir') return 1;
                                                        return a.name.localeCompare(b.name);
                                                     }).map(item => (
                                                        <li key={item.sha} className="px-3 py-2 flex items-center text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-100">
                                                            {item.type === 'dir' ? (
                                                                <FiFolder className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                                                            ) : (
                                                                <FiFileText className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                                            )}
                                                            <a href={item.html_url} title={`View ${item.name} on GitHub`} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                                                {item.name}
                                                            </a>
                                                            {/* Maybe add size for files? item.size */}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                 <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center italic">Repository root is empty.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Message if neither loaded and not error/loading */}
                                    {detailContentType === 'none' && !isDetailLoading && !detailError && (
                                        <div className="flex items-center justify-center h-40 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md">
                                            Successfully loaded repository data, but no README found and could not load file list.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    // Placeholder when no repo is selected (uses userRepos prop)
                    <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 p-6">
                        <FiBox size={40} className="mb-3"/>
                        <p className="font-medium">
                            {/* Adjust message based on props */}
                            {(userRepos && userRepos.length > 0)
                                ? 'Select a repository from the list.'
                                : (repoListError // Use the prop passed from parent
                                    ? 'Could not load repositories.'
                                    // Check sessionStatus *after* repoListError
                                    : (sessionStatus === 'authenticated'
                                        ? 'No repositories found for your account.'
                                        : 'Login to see your repositories.' // Fallback if not authenticated and no error
                                      )
                                  )
                            }
                        </p>
                         {/* Show GitHub link only if authenticated and no repos found */}
                         {(userRepos?.length === 0) && !repoListError && sessionStatus === 'authenticated' && (
                             <p className="text-sm mt-1">You can create one on <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GitHub</a>.</p>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeTabContent;