// components/HomeTabContent.jsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    FiGithub, FiStar, FiGitBranch, FiExternalLink, FiLoader, FiAlertCircle,
    FiBox, FiSearch, FiEye, FiCode, FiFileText, FiFolder, FiBookOpen
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Buffer } from 'buffer'; // Ensure Buffer is available

// --- Helper Functions (Unchanged) ---
const getLanguageColor = (language) => {
  // This function returns class names, dark mode is handled where these are used.
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
    onLoginClick        // Function provided by parent to trigger login
}) => {
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
        // Reset state if no repo is selected
        if (!selectedRepo) {
            setRepoDetailContent(null);
            setDetailError(null);
            setIsDetailLoading(false);
            setDetailContentType('none');
            return;
        }

        // Handle cases without an access token
        if (!accessToken) {
             console.log("Skipping detail fetch: No access token provided via props.");
             if (sessionStatus === 'authenticated') {
                 console.warn("Session status is authenticated, but no accessToken provided to HomeTabContent.");
                 setDetailError("Authentication token missing despite status.");
                 setDetailContentType('error');
             } else if (sessionStatus !== 'loading') {
                 setDetailError("Login required to load repository details.");
                 setDetailContentType('error');
             } else {
                 setDetailContentType('loading'); // Still waiting for auth status
             }
             setRepoDetailContent(null);
             setIsDetailLoading(false);
             return;
        }

        // Async function to perform the fetch
        const fetchDetails = async () => {
            const { full_name } = selectedRepo;
            console.log(`Fetching details for ${full_name} using provided token...`);
            setIsDetailLoading(true);
            setDetailError(null);
            setRepoDetailContent(null);
            setDetailContentType('loading');

            const apiUrlBase = `https://api.github.com/repos/${full_name}`;
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
            };

            try {
                // Attempt to fetch README
                console.log(`Fetching README for ${full_name}`);
                const readmeResponse = await fetch(`${apiUrlBase}/readme`, { headers });

                if (readmeResponse.ok) {
                    const readmeData = await readmeResponse.json();
                    console.log(`README found for ${full_name}`);
                    setRepoDetailContent(decodeBase64(readmeData.content));
                    setDetailContentType('readme');
                } else if (readmeResponse.status === 404) {
                    // README not found, fetch root directory contents
                    console.log(`README not found for ${full_name}, fetching root contents...`);
                    const contentsResponse = await fetch(`${apiUrlBase}/contents/`, { headers });

                    if (contentsResponse.ok) {
                        const contentsData = await contentsResponse.json();
                        console.log(`Root contents fetched for ${full_name}`);
                        setRepoDetailContent(Array.isArray(contentsData) ? contentsData : []);
                        setDetailContentType('files');
                    } else {
                        const errorData = await contentsResponse.json().catch(() => ({ message: 'Unknown error' }));
                        if (contentsResponse.status === 401 || contentsResponse.status === 403) {
                            throw new Error(`Authentication/Authorization error fetching contents (Status: ${contentsResponse.status}). Check token validity/permissions.`);
                        }
                        throw new Error(`Failed to fetch contents (Status: ${contentsResponse.status}): ${errorData.message}`);
                    }
                } else {
                    const errorData = await readmeResponse.json().catch(() => ({ message: 'Unknown error' }));
                     if (readmeResponse.status === 401 || readmeResponse.status === 403) {
                        throw new Error(`Authentication/Authorization error fetching README (Status: ${readmeResponse.status}). Check token validity/permissions.`);
                     }
                    throw new Error(`Failed to fetch README (Status: ${readmeResponse.status}): ${errorData.message}`);
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
    // Re-run when the selected repo or the access token changes
    }, [selectedRepo, accessToken, sessionStatus]); // Added sessionStatus back as it's used in the initial guard clause logic

    // --- Render Login Prompt ---
    if (sessionStatus === 'unauthenticated') {
        return (
            // Applied [.dark_&]: variants for background, text colors
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-gray-600 [.dark_&]:text-gray-400 bg-gray-50 [.dark_&]:bg-gray-900">
                {/* Icon color adapted */}
                <FiGithub size={48} className="mb-4 text-gray-400 [.dark_&]:text-gray-500" />
                {/* Text colors adapted */}
                <h2 className="text-xl font-semibold mb-2 text-gray-800 [.dark_&]:text-gray-200">Connect GitHub</h2>
                <p className="text-center mb-6 max-w-md">
                    Connect your GitHub account to view and interact with your repositories.
                </p>
                <button
                    onClick={onLoginClick}
                    // Applied [.dark_&]: variants for button background, text, hover background
                    className="flex items-center justify-center px-6 py-2 bg-gray-800 [.dark_&]:bg-gray-200 text-white [.dark_&]:text-gray-900 rounded-md font-medium hover:bg-gray-700 [.dark_&]:hover:bg-gray-300 transition duration-150 ease-in-out shadow-sm"
                >
                    <FiGithub className="mr-2" />
                    Login with GitHub
                </button>
            </div>
        );
    }

     // --- Render Loading State for Repo List / Auth ---
    if (isRepoListLoading || sessionStatus === 'loading') {
        return (
             // Applied [.dark_&]: variants for background and text color
             <div className="flex flex-1 items-center justify-center bg-gray-50 [.dark_&]:bg-gray-900">
                {/* Icon color can use standard dark: prefix for simplicity */}
                <FiLoader size={32} className="animate-spin text-blue-500 dark:text-blue-400" />
                {/* Text color adapted */}
                <span className="ml-3 text-gray-600 [.dark_&]:text-gray-400">
                    {sessionStatus === 'loading' ? 'Authenticating...' : 'Loading repositories...'}
                </span>
            </div>
        );
    }

    // --- Render Main Content (Two Columns) ---
    return (
        // Applied [.dark_&]: variant for main background
        <div className="flex flex-1 h-full overflow-hidden bg-gray-100 [.dark_&]:bg-gray-800">

            {/* Left Column: Search and Repository List */}
             {/* Applied [.dark_&]: variants for background and border */}
            <div className="[.dark_&]:bg-gray-900  w-1/3 max-w-xs flex flex-col border-r border-gray-200 [.dark_&]:border-gray-700 bg-white [.dark_&]:bg-gray-850">
                {/* Search Bar */}
                 {/* Applied [.dark_&]: variant for border */}
                <div className="p-3 border-b border-gray-200 [.dark_&]:border-gray-700">
                     <div className="relative">
                        <input
                            type="search"
                            placeholder="Search repositories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                             // Applied [.dark_&]: variants for border, background, text
                             // Placeholder styling requires specific pseudo-element targeting, often done via CSS or plugins.
                             // Let's rely on browser defaults or add a specific class if needed.
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 [.dark_&]:border-gray-600 rounded-md bg-gray-50 [.dark_&]:bg-gray-700 text-gray-900 [.dark_&]:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {/* Icon color adapted */}
                        <FiSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 [.dark_&]:text-gray-500" size={14}/>
                    </div>
                </div>

                {/* Repository List */}
                <div className="flex-1 overflow-y-auto">
                    {repoListError && (
                        // Error text color can be handled directly or with [.dark_&]: if needed for contrast
                        <div className="p-4 text-center text-red-600 dark:text-red-400">
                            <FiAlertCircle className="inline-block mr-1" /> {repoListError}
                        </div>
                    )}

                    {!repoListError && filteredRepos.length === 0 && !isRepoListLoading && (
                        // Applied [.dark_&]: variant for text color
                        <div className="p-4 text-center text-gray-500 [.dark_&]:text-gray-400">
                            {searchQuery
                                ? 'No repositories match your search.'
                                : (userRepos && userRepos.length > 0
                                    ? 'No matching repositories found.'
                                    : 'No repositories found.'
                                  )
                            }
                        </div>
                    )}

                    {!repoListError && filteredRepos.map(repo => (
                        <button
                            key={repo.id}
                            onClick={() => {
                                console.log("HomeTabContent selecting repo:", repo.full_name);
                                setSelectedRepo(repo);
                            }}
                            // Applied [.dark_&]: variants for border, hover background, selected background
                            className={`w-full text-left px-4 py-3 border-b border-gray-100 [.dark_&]:border-gray-750 hover:bg-gray-50 [.dark_&]:hover:bg-gray-700 focus:outline-none transition duration-100 ease-in-out ${
                                selectedRepo?.id === repo.id ? 'bg-blue-50 [.dark_&]:bg-blue-900/30' : 'bg-transparent'
                            }`}
                            title={repo.description || repo.name}
                        >
                             {/* Applied [.dark_&]: variants for text color in selected/default states */}
                            <h3 className={`font-medium text-sm truncate ${
                                selectedRepo?.id === repo.id ? 'text-blue-700 [.dark_&]:text-blue-300' : 'text-gray-800 [.dark_&]:text-gray-200'
                            }`}>
                                {repo.name}
                            </h3>
                             {/* Applied [.dark_&]: variant for description text color */}
                            <p className="text-xs text-gray-500 [.dark_&]:text-gray-400 truncate mt-0.5">
                                {repo.description || <span className="italic">No description</span>}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Column: Repository Details */}
            {/* Applied [.dark_&]: variant for background */}
            <div className="flex-1 flex flex-col bg-gray-50 [.dark_&]:bg-gray-900 overflow-y-hidden">
                {selectedRepo ? (
                    <>
                        {/* Header Section */}
                         {/* Applied [.dark_&]: variant for border */}
                        <div className="p-6 flex-shrink-0 border-b border-gray-200 [.dark_&]:border-gray-700">
                            <div className="flex justify-between items-start mb-4 pb-4"> {/* Removed bottom border here, applied to parent div */}
                                <div>
                                    {/* Applied [.dark_&]: variants for text colors */}
                                    <h2 className="text-xl font-semibold text-gray-800 [.dark_&]:text-gray-200 mb-1">{selectedRepo.name}</h2>
                                    <p className="text-sm text-gray-600 [.dark_&]:text-gray-400">{selectedRepo.description || "No description provided."}</p>
                                </div>
                                <a
                                    href={selectedRepo.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                     // Applied [.dark_&]: variants for background and hover background
                                    className="flex-shrink-0 ml-4 px-3 py-1.5 text-xs font-medium text-white bg-gray-700 [.dark_&]:bg-gray-600 rounded-md hover:bg-gray-800 [.dark_&]:hover:bg-gray-500 transition duration-150 ease-in-out flex items-center"
                                    title="View on GitHub"
                                >
                                    <FiGithub className="mr-1.5" size={14}/> GitHub <FiExternalLink className="ml-1.5" size={12}/>
                                </a>
                            </div>
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                {/* Language */}
                                {/* Applied [.dark_&]: variants for text and icon colors */}
                                <div className="flex items-center text-gray-700 [.dark_&]:text-gray-300">
                                    <FiCode size={16} className="mr-2 text-gray-500 [.dark_&]:text-gray-400 flex-shrink-0"/>
                                    <div>
                                        <span className="text-xs text-gray-500 [.dark_&]:text-gray-400 block">Language</span>
                                        {selectedRepo.language ? (
                                            <span className="flex items-center mt-0.5">
                                                {/* Language color dot - no dark mode needed */}
                                                <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${getLanguageColor(selectedRepo.language)}`}></span>
                                                {selectedRepo.language}
                                            </span>
                                        ) : (
                                            <span className="italic text-gray-500 [.dark_&]:text-gray-400 mt-0.5">N/A</span>
                                        )}
                                    </div>
                                </div>
                                {/* Stars */}
                                <div className="flex items-center text-gray-700 [.dark_&]:text-gray-300">
                                     {/* Icon color can use standard dark: prefix */}
                                    <FiStar size={16} className="mr-2 text-yellow-500 dark:text-yellow-400 flex-shrink-0"/>
                                    <div>
                                        <span className="text-xs text-gray-500 [.dark_&]:text-gray-400 block">Stars</span>
                                        <span className="mt-0.5">{selectedRepo.stargazers_count?.toLocaleString() ?? 0}</span>
                                    </div>
                                </div>
                                {/* Forks */}
                                <div className="flex items-center text-gray-700 [.dark_&]:text-gray-300">
                                     {/* Icon color can use standard dark: prefix */}
                                    <FiGitBranch size={16} className="mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0"/>
                                     <div>
                                        <span className="text-xs text-gray-500 [.dark_&]:text-gray-400 block">Forks</span>
                                        <span className="mt-0.5">{selectedRepo.forks_count?.toLocaleString() ?? 0}</span>
                                    </div>
                                </div>
                                {/* Watchers */}
                                <div className="flex items-center text-gray-700 [.dark_&]:text-gray-300">
                                     {/* Icon color can use standard dark: prefix */}
                                    <FiEye size={16} className="mr-2 text-green-500 dark:text-green-400 flex-shrink-0"/>
                                     <div>
                                        <span className="text-xs text-gray-500 [.dark_&]:text-gray-400 block">Watchers</span>
                                        <span className="mt-0.5">{selectedRepo.watchers_count?.toLocaleString() ?? 0}</span>
                                    </div>
                                </div>
                                {/* Last Updated */}
                                <div className="flex items-center text-gray-700 [.dark_&]:text-gray-300 col-span-2 md:col-span-1">
                                    {/* Icon color adapted */}
                                    <FiGithub size={16} className="mr-2 text-gray-500 [.dark_&]:text-gray-400 flex-shrink-0"/>
                                     <div>
                                        <span className="text-xs text-gray-500 [.dark_&]:text-gray-400 block">Last Updated</span>
                                        <span className="mt-0.5">{selectedRepo.updated_at ? new Date(selectedRepo.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detail Content Area (README or Files) */}
                        <div className="flex-1 p-6 pt-0 overflow-y-auto">
                            {isDetailLoading && (
                                // Applied [.dark_&]: variant for text color
                                <div className="flex items-center justify-center h-40 text-gray-500 [.dark_&]:text-gray-400">
                                    <FiLoader size={24} className="animate-spin mr-2" />
                                    Loading details...
                                </div>
                            )}
                            {detailError && !isDetailLoading && (
                                // Applied [.dark_&]: variants for text, border, background colors
                                <div className="flex flex-col items-center justify-center h-40 text-red-600 [.dark_&]:text-red-400 border border-red-200 [.dark_&]:border-red-700 rounded-md bg-red-50 [.dark_&]:bg-red-900/20 p-4">
                                    <FiAlertCircle size={24} className="mb-2" />
                                    <span className="font-medium mb-1">Error loading details</span>
                                    <span className="text-sm text-center">{detailError}</span>
                                </div>
                            )}
                            {!isDetailLoading && !detailError && (
                                <>
                                    {/* Render README */}
                                    {detailContentType === 'readme' && repoDetailContent && (
                                        // Applied [.dark_&]: variants for border, background
                                        <div className="border border-gray-200 [.dark_&]:border-gray-700 rounded-md p-4 bg-white [.dark_&]:bg-gray-800 shadow-sm">
                                            {/* Applied [.dark_&]: variant for heading text */}
                                            <h3 className="text-sm font-semibold mb-3 text-gray-700 [.dark_&]:text-gray-300 flex items-center">
                                                <FiBookOpen className="mr-2" /> README.md
                                            </h3>
                                             {/* prose-invert handles dark mode for markdown content */}
                                            <article className="prose prose-sm dark:prose-invert max-w-none [.dark_&]:text-gray-300">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {repoDetailContent}
                                                </ReactMarkdown>
                                            </article>
                                        </div>
                                    )}

                                    {/* Render File/Folder List */}
                                    {detailContentType === 'files' && Array.isArray(repoDetailContent) && (
                                         // Applied [.dark_&]: variants for border, background
                                         <div className="border border-gray-200 [.dark_&]:border-gray-700 rounded-md bg-white [.dark_&]:bg-gray-800 shadow-sm">
                                            {/* Applied [.dark_&]: variants for heading border and text */}
                                            <h3 className="text-sm font-semibold p-3 border-b border-gray-200 [.dark_&]:border-gray-700 text-gray-700 [.dark_&]:text-gray-300 flex items-center">
                                                <FiFolder className="mr-2" /> Root Directory
                                            </h3>
                                            {repoDetailContent.length > 0 ? (
                                                // Applied [.dark_&]: variant for divider color
                                                <ul className="divide-y divide-gray-100 [.dark_&]:divide-gray-750">
                                                    {repoDetailContent.sort((a, b) => {
                                                        if (a.type === 'dir' && b.type !== 'dir') return -1;
                                                        if (a.type !== 'dir' && b.type === 'dir') return 1;
                                                        return a.name.localeCompare(b.name);
                                                     }).map(item => (
                                                        // Applied [.dark_&]: variants for list item text and hover background
                                                        <li key={item.sha} className="px-3 py-2 flex items-center text-sm text-gray-700 [.dark_&]:text-gray-300 hover:bg-gray-50 [.dark_&]:hover:bg-gray-700/50 transition duration-100">
                                                            {item.type === 'dir' ? (
                                                                // Icon color can use standard dark: prefix
                                                                <FiFolder className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                                            ) : (
                                                                // Icon color adapted
                                                                <FiFileText className="w-4 h-4 mr-2 text-gray-500 [.dark_&]:text-gray-400 flex-shrink-0" />
                                                            )}
                                                            <a href={item.html_url} title={`View ${item.name} on GitHub`} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                                                {item.name}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                // Applied [.dark_&]: variant for empty directory text
                                                 <p className="p-4 text-sm text-gray-500 [.dark_&]:text-gray-400 text-center italic">Repository root is empty.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Message if neither loaded and not error/loading */}
                                    {detailContentType === 'none' && !isDetailLoading && !detailError && (
                                        // Applied [.dark_&]: variants for text and border color
                                        <div className="flex items-center justify-center h-40 text-center text-gray-500 [.dark_&]:text-gray-400 border-2 border-dashed border-gray-300 [.dark_&]:border-gray-700 rounded-md">
                                            Successfully loaded repository data, but no README found and could not load file list.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    // Placeholder when no repo is selected
                     // Applied [.dark_&]: variant for text color
                    <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-500 [.dark_&]:text-gray-400 p-6">
                        <p className="font-medium">
                            {(userRepos && userRepos.length > 0)
                                ? 
                                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                  <img
                                    src="logo.svg"
                                    alt="No Repo Selected"
                                    className="w-[300px] h-[300px] mb-4 text-gray-500 opacity-50"
                                  />
                                  <p className="text-lg">Please select a repository from the dropdown.</p>
                                </div>
                                : (repoListError
                                    ? 'Could not load repositories.'
                                    : (sessionStatus === 'authenticated'
                                        ? 'No repositories found for your account.'
                                        : 'Login to see your repositories.'
                                      )
                                  )
                            }
                        </p>
                         {/* Link color adapted */}
                         {(userRepos?.length === 0) && !repoListError && sessionStatus === 'authenticated' && (
                             <p className="text-sm mt-1">You can create one on <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="text-blue-600 [.dark_&]:text-blue-400 hover:underline">GitHub</a>.</p>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeTabContent;