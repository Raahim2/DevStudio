'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants ---
const GITHUB_API_BASE = 'https://api.github.com';

// --- Helper Functions ---

// Extracts owner and repo name from various GitHub URL formats
const parseRepoUrl = (url) => {
    if (!url) return null;
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== 'github.com') return null;
        const pathParts = parsedUrl.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
            return { owner: pathParts[0], repo: pathParts[1].replace('.git', '') };
        }
    } catch (e) {
        console.error("Error parsing repo URL:", e);
    }
    return null;
};

// Basic command parser
const parseCommand = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { command: '', args: [] };
    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    return {
        command: parts[0]?.toLowerCase() || '',
        args: parts.slice(1).map(arg => arg.replace(/^['"]|['"]$/g, '')),
    };
};

// Builds the nested filesystem structure from GitHub's flat tree API response
const buildFilesystemFromApi = (treeData) => {
    const fs = { '/': { type: 'directory', children: {}, path: '/', sha: null } }; // Root directory

    treeData.forEach(item => {
        const pathParts = item.path.split('/');
        let currentLevel = fs['/'];
        let currentPath = '';

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            currentPath = currentPath === '' ? part : `${currentPath}/${part}`;

            if (i === pathParts.length - 1) {
                // Last part: this is the actual file/directory item
                if (!currentLevel.children[part]) {
                     currentLevel.children[part] = {
                        type: item.type === 'tree' ? 'directory' : 'file',
                        sha: item.sha,
                        path: item.path,
                        size: item.size, // size is only present for blobs (files)
                        children: item.type === 'tree' ? {} : undefined, // Only directories have children
                        content: null, // Content fetched on demand for files
                     };
                 } else {
                     // Directory might have been implicitly created earlier
                     Object.assign(currentLevel.children[part], {
                         type: item.type === 'tree' ? 'directory' : 'file',
                         sha: item.sha,
                         path: item.path,
                         size: item.size,
                         children: item.type === 'tree' ? currentLevel.children[part].children || {} : undefined,
                         content: currentLevel.children[part].content || null,
                     });
                 }

            } else {
                // Intermediate part: ensure directory exists
                if (!currentLevel.children[part]) {
                    currentLevel.children[part] = {
                         type: 'directory',
                         children: {},
                         path: currentPath,
                         sha: null // Intermediate dirs don't have a SHA from the tree directly
                    };
                } else if (currentLevel.children[part].type !== 'directory') {
                    // Conflict: A file exists where a directory is needed in the path
                    console.error(`Filesystem build conflict: Expected directory at ${currentPath}, but found ${currentLevel.children[part].type}`);
                    // Handle error appropriately, maybe skip this item or mark as error
                    return; // Skip this problematic item from the tree
                }
                currentLevel = currentLevel.children[part];
            }
        }
    });
    return fs;
};

// Gets a node (file or directory object) from the filesystem state at a specific path
const getNode = (fs, path) => {
    if (path === '/') return fs['/'];
    const parts = path.split('/').filter(p => p);
    let node = fs['/'];
    for (const part of parts) {
        if (!node || node.type !== 'directory' || !node.children || !node.children[part]) {
            return null; // Path doesn't exist or traverses through a file
        }
        node = node.children[part];
    }
    return node;
};

// Navigate the virtual filesystem (handles ., .., absolute, relative)
const navigatePath = (fs, currentPath, targetPath) => {
    if (!targetPath) return { path: currentPath }; // No change

    let pathParts;
    let startNode = fs['/'];
    let resolvedPath = ['']; // Start building path from root

    if (targetPath.startsWith('/')) {
        // Absolute path
        pathParts = targetPath.split('/').filter(p => p);
    } else {
        // Relative path
        startNode = getNode(fs, currentPath);
         if (!startNode || startNode.type !== 'directory') {
              return { error: `cd: navigation error: current path ${currentPath} is invalid` };
         }
        pathParts = targetPath.split('/').filter(p => p);
        resolvedPath = currentPath === '/' ? [''] : currentPath.split('/').filter(p => p);
    }

    let tempNode = startNode;

    for (const part of pathParts) {
        if (part === '.') {
            continue; // Stay in current directory
        } else if (part === '..') {
            if (resolvedPath.length > 1) { // Can go up from '/sub' but not from '/'
                resolvedPath.pop();
            }
            // Need to re-evaluate tempNode based on new resolvedPath
            tempNode = getNode(fs, resolvedPath.join('/') || '/');
             if (!tempNode) {
                  // This should ideally not happen if fs structure is correct
                   return { error: `cd: navigation error: cannot resolve path after '..'` };
             }
        } else {
            if (!tempNode || tempNode.type !== 'directory' || !tempNode.children || !tempNode.children[part]) {
                return { error: `cd: no such file or directory: ${targetPath}` };
            }
            tempNode = tempNode.children[part];
            if (tempNode.type === 'directory') {
                resolvedPath.push(part);
            } else {
                // Trying to cd into a file
                return { error: `cd: not a directory: ${targetPath}` };
            }
        }
    }

    const finalPath = resolvedPath.join('/') || '/';
    // Final check: ensure the resolved path actually points to a directory in the fs state
    const finalNode = getNode(fs, finalPath);
    if (!finalNode || finalNode.type !== 'directory') {
         return { error: `cd: resolved path is not a valid directory: ${finalPath}` };
    }


    return { path: finalPath };
};

// --- Terminal Component ---

const Terminal = ({ repoUrl, accessToken }) => {
    const [history, setHistory] = useState([]);
    const [currentCommand, setCurrentCommand] = useState('');
    const [currentDirectory, setCurrentDirectory] = useState('/');
    const [filesystem, setFilesystem] = useState({ '/': { type: 'directory', children: {} } }); // Initial empty root
    const [repoMetadata, setRepoMetadata] = useState(null); // { owner, repo, defaultBranch }
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingContent, setIsFetchingContent] = useState(false); // For 'cat' command

    const inputRef = useRef(null);
    const historyEndRef = useRef(null);

    const prompt = repoMetadata ? `(${repoMetadata.repo})${currentDirectory}$ ` : `~$ `;

    // --- Add Output Helper ---
    const addHistoryEntry = useCallback((type, content) => {
        setHistory(prev => [...prev, { type, content }]);
    }, []);

     // --- Fetch Repo Metadata (including default branch) ---
     const fetchRepoMetadata = useCallback(async (owner, repo, token) => {
         const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
         const headers = { Accept: 'application/vnd.github.v3+json' };
         if (token) {
             headers['Authorization'] = `token ${token}`;
         }
         try {
             const response = await fetch(url, { headers });
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(`GitHub API Error (${response.status}): ${errorData.message || response.statusText}`);
             }
             const data = await response.json();
             return { owner, repo, defaultBranch: data.default_branch };
         } catch (error) {
             addHistoryEntry('error', `Error fetching repo metadata: ${error.message}`);
             return null;
         }
     }, [addHistoryEntry]);


    // --- Fetch Filesystem Tree ---
    const fetchFsTree = useCallback(async (meta, token) => {
        setIsLoading(true);
        addHistoryEntry('info', `Fetching file tree for branch '${meta.defaultBranch}'...`);
        const url = `${GITHUB_API_BASE}/repos/${meta.owner}/${meta.repo}/git/trees/${meta.defaultBranch}?recursive=1`;
        const headers = { Accept: 'application/vnd.github.v3+json' };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        try {
            const response = await fetch(url, { headers });
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(`GitHub API Error (${response.status}): ${errorData.message || response.statusText}`);
            }
            const data = await response.json();

            if (data.truncated) {
                addHistoryEntry('warning', 'Warning: Repository tree is too large and has been truncated by the GitHub API. Some files/directories may be missing.');
            }

            const newFs = buildFilesystemFromApi(data.tree);
            setFilesystem(newFs);
            setCurrentDirectory('/'); // Reset to root after loading
            setRepoMetadata(meta); // Set metadata now that we have the tree
            addHistoryEntry('success', `Repository tree loaded successfully.`);

        } catch (error) {
            addHistoryEntry('error', `Error fetching file tree: ${error.message}`);
            setRepoMetadata(null); // Clear metadata on error
            setFilesystem({ '/': { type: 'directory', children: {} } }); // Reset FS
        } finally {
            setIsLoading(false);
        }
    }, [addHistoryEntry]); // Dependencies: addHistoryEntry


    // --- Initial Load Effect ---
    useEffect(() => {
        setHistory([]); // Clear history on new repo load
        const parsed = parseRepoUrl(repoUrl);
        if (parsed) {
            const loadRepo = async () => {
                const meta = await fetchRepoMetadata(parsed.owner, parsed.repo, accessToken);
                 if (meta) {
                      await fetchFsTree(meta, accessToken);
                 } else {
                     setFilesystem({ '/': { type: 'directory', children: {} } }); // Reset FS if metadata fails
                     setRepoMetadata(null);
                 }
            };
            loadRepo();
        } else if (repoUrl) {
            addHistoryEntry('error', `Invalid GitHub repository URL: ${repoUrl}`);
            setFilesystem({ '/': { type: 'directory', children: {} } }); // Reset FS
            setRepoMetadata(null);
        } else {
             // No repo URL provided, show initial message
             addHistoryEntry('output', 'Welcome! Provide a GitHub repo URL to start.');
             setFilesystem({ '/': { type: 'directory', children: {} } });
             setRepoMetadata(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repoUrl, accessToken, fetchRepoMetadata, fetchFsTree]); // Rerun if URL or token changes


    // --- Scroll to Bottom ---
    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'auto' }); // Use 'auto' for faster scrolling
    }, [history]);

    // --- Focus Input ---
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleFocusInput = () => {
         inputRef.current?.focus();
    }

    // --- Fetch File Content for 'cat' ---
    const fetchFileContent = useCallback(async (filePath) => {
        const node = getNode(filesystem, filePath);
         if (!node || node.type !== 'file' || !node.sha || !repoMetadata) {
             addHistoryEntry('error', `cat: cannot get content for path: ${filePath}`);
             return;
         }

        // Return cached content if available
        if (node.content !== null) {
            node.content.split('\n').forEach(line => addHistoryEntry('output', line));
            return;
        }


        setIsFetchingContent(true);
        addHistoryEntry('info', `Fetching content for ${filePath.split('/').pop()}...`);

        const url = `${GITHUB_API_BASE}/repos/${repoMetadata.owner}/${repoMetadata.repo}/git/blobs/${node.sha}`;
        const headers = { Accept: 'application/vnd.github.v3+json' };
        if (accessToken) {
            headers['Authorization'] = `token ${accessToken}`;
        }

        try {
            const response = await fetch(url, { headers });
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(`GitHub API Error (${response.status}): ${errorData.message || response.statusText}`);
            }
            const data = await response.json();

            if (data.encoding !== 'base64') {
                throw new Error(`Unsupported encoding: ${data.encoding}`);
            }

            const decodedContent = atob(data.content); // Decode Base64

            // --- Update filesystem state immutably to cache content ---
            setFilesystem(prevFs => {
                const newFs = JSON.parse(JSON.stringify(prevFs)); // Deep copy for immutability
                const nodeToUpdate = getNode(newFs, filePath);
                if (nodeToUpdate && nodeToUpdate.type === 'file') {
                    nodeToUpdate.content = decodedContent;
                } else {
                     console.error("Error updating cache: Node not found after fetch for", filePath);
                }
                return newFs;
            });
            // ---

            decodedContent.split('\n').forEach(line => addHistoryEntry('output', line));

        } catch (error) {
            addHistoryEntry('error', `cat: error fetching content: ${error.message}`);
        } finally {
            setIsFetchingContent(false);
        }

    }, [filesystem, repoMetadata, accessToken, addHistoryEntry]);


    // --- Command Execution Logic ---
    const executeCommand = useCallback((input) => {
        const { command, args } = parseCommand(input);
        let outputAdded = false; // Track if any output was added for this command

        // Add command to history first
        addHistoryEntry('input', `${prompt}${input}`);

        if (!command) {
            return; // Empty command, do nothing else
        }

        if (!repoMetadata && !['help', 'clear'].includes(command)) {
             addHistoryEntry('error', 'No repository loaded. Please provide a valid GitHub URL.');
             return;
        }


        const addOutput = (content) => {
            addHistoryEntry('output', content);
            outputAdded = true;
        };
        const addError = (content) => {
            addHistoryEntry('error', content);
            outputAdded = true;
        };


        switch (command) {
            case 'help':
                addOutput("Available commands:");
                addOutput("  help          - Show this help message");
                addOutput("  ls [path]     - List directory contents");
                addOutput("  cd <dir>      - Change directory");
                addOutput("  cat <file>    - Display file content");
                addOutput("  pwd           - Print working directory");
                addOutput("  clear         - Clear the terminal screen");
                addOutput("  echo ...      - Display text");
                addOutput("  git status    - Show simulated status");
                addOutput("  git log       - Show simulated log (very basic)");
                break;

            case 'clear':
                setHistory([]); // Clear history immediately
                return; // Don't add any other output

            case 'pwd':
                 addOutput(currentDirectory);
                 break;

            case 'echo':
                addOutput(args.join(' '));
                break;

            case 'ls':
                {
                    const targetPathArg = args[0] || '.';
                    let pathToLs;
                    let nodeToList;

                     if (targetPathArg === '.') {
                         pathToLs = currentDirectory;
                         nodeToList = getNode(filesystem, currentDirectory);
                     } else if (targetPathArg.startsWith('/')) {
                          // Absolute path
                          pathToLs = targetPathArg;
                          nodeToList = getNode(filesystem, pathToLs);
                     } else {
                          // Relative path
                           const target = currentDirectory === '/'
                               ? `/${targetPathArg}`
                               : `${currentDirectory}/${targetPathArg}`;
                          // Use navigatePath to resolve potential '..' etc. but check the *node type* later
                           const navResult = navigatePath(filesystem, currentDirectory, targetPathArg);
                            if (navResult.error) {
                                // If navigation itself fails (e.g., '..' goes nowhere), it's an error
                                // But if it resolves to a file path, ls should still show the file name
                                // Let's try getNode directly on the resolved target
                                 nodeToList = getNode(filesystem, target);
                                 if (!nodeToList) {
                                     addError(`ls: cannot access '${targetPathArg}': No such file or directory`);
                                     break;
                                 }
                                 pathToLs = target; // Use the resolved target path
                            } else {
                                 // Navigation successful (implies it's a directory path)
                                 pathToLs = navResult.path;
                                 nodeToList = getNode(filesystem, pathToLs);
                            }
                     }


                    if (!nodeToList) {
                        addError(`ls: cannot access '${targetPathArg}': No such file or directory`);
                    } else if (nodeToList.type === 'directory') {
                        const entries = Object.entries(nodeToList.children || {});
                        if (entries.length === 0) {
                            // No output for empty dir, consistent with bash ls
                        } else {
                             entries.sort(([nameA], [nameB]) => nameA.localeCompare(nameB)).forEach(([name, details]) => {
                                addOutput(`${details.type === 'directory' ? name + '/' : name}`);
                            });
                        }
                    } else if (nodeToList.type === 'file') {
                         addOutput(pathToLs.split('/').pop()); // Show file name if ls targets a file
                    } else {
                         addError(`ls: cannot access '${targetPathArg}': Unknown node type`);
                    }
                }
                break;

            case 'cd':
                {
                     let target;
                     if (args.length === 0 || args[0] === '~') {
                         target = '/'; // Go to root
                     } else if (args.length > 1) {
                         addError("cd: too many arguments");
                         break;
                     } else {
                         target = args[0];
                     }

                    const { error, path } = navigatePath(filesystem, currentDirectory, target);
                    if (error) {
                        addError(error);
                    } else {
                        // Check if the final path is actually a directory before setting
                        const finalNode = getNode(filesystem, path);
                         if (finalNode && finalNode.type === 'directory') {
                              setCurrentDirectory(path);
                         } else {
                              addError(`cd: not a directory: ${target}`);
                         }
                    }
                }
                break;

             case 'cat':
                 {
                      if (args.length === 0) {
                          addError("cat: missing filename");
                          break;
                      }
                      if (isFetchingContent) {
                          addError("cat: already fetching content, please wait.");
                          break;
                      }

                       const targetFileArg = args[0];
                       let filePathToCat;

                       if (targetFileArg.startsWith('/')) {
                           filePathToCat = targetFileArg;
                       } else {
                            filePathToCat = currentDirectory === '/'
                               ? `/${targetFileArg}`
                               : `${currentDirectory}/${targetFileArg}`;
                       }

                        // Resolve potential '..' etc. in the path using navigatePath logic
                        // We want the *final* path string, even if it points to a file
                        const pathParts = filePathToCat.split('/').filter(p => p);
                        let resolvedPathParts = [''];
                        let currentFsLevel = filesystem['/'];
                        let resolutionOk = true;

                        for (const part of pathParts) {
                            if (part === '.') continue;
                            if (part === '..') {
                                if (resolvedPathParts.length > 1) resolvedPathParts.pop();
                            } else {
                                resolvedPathParts.push(part);
                            }
                             // Check if intermediate path exists during resolution
                             const intermediatePath = resolvedPathParts.join('/') || '/';
                             const intermediateNode = getNode(filesystem, intermediatePath);
                             if (!intermediateNode) {
                                 addError(`cat: ${targetFileArg}: No such file or directory`);
                                 resolutionOk = false;
                                 break;
                             }
                             // If it's the last part, it can be a file. If intermediate, must be dir.
                             const isLastPart = intermediatePath === (filePathToCat.startsWith('/') ? filePathToCat : `/${filePathToCat}`); // Needs careful check
                             if (!isLastPart && intermediateNode.type !== 'directory') {
                                  addError(`cat: ${targetFileArg}: Not a directory (in path)`);
                                  resolutionOk = false;
                                  break;
                             }
                        }

                        if (!resolutionOk) break;

                        const finalResolvedPath = resolvedPathParts.join('/') || '/';
                        const nodeToCat = getNode(filesystem, finalResolvedPath);


                        if (!nodeToCat) {
                             addError(`cat: ${targetFileArg}: No such file or directory`);
                        } else if (nodeToCat.type === 'directory') {
                            addError(`cat: ${targetFileArg}: Is a directory`);
                        } else if (nodeToCat.type === 'file') {
                            fetchFileContent(finalResolvedPath); // Async operation
                            outputAdded = true; // Mark output as handled (async)
                        } else {
                            addError(`cat: ${targetFileArg}: Not a file`);
                        }
                 }
                 break;

             case 'git':
                  const gitSubCommand = args[0]?.toLowerCase();
                  if (gitSubCommand === 'status') {
                      addOutput(`On branch ${repoMetadata?.defaultBranch || 'unknown'} (simulated)`);
                      addOutput("Working tree clean (simulated - based on fetched tree)");
                  } else if (gitSubCommand === 'log') {
                       addOutput("commit (latest - simulated)");
                       addOutput("Author: <GitHub API User>"); // Could potentially fetch latest commit info
                       addOutput("Date:   <Fetched Date>");
                       addOutput("\n    Simulated commit message (real log requires commit API call)");
                  } else {
                      addError(`git: '${args[0] || ''}' is not a supported git command in this simulation.`);
                      addOutput("Supported: git status, git log (simulated)");
                  }
                  break;

            default:
                addError(`command not found: ${command}. Type 'help' for available commands.`);
        }

        // If no specific output/error was added synchronously (e.g., for cd with no output)
        // we don't need an extra newline, handled by history structure.

    }, [addHistoryEntry, prompt, repoMetadata, currentDirectory, filesystem, isFetchingContent, fetchFileContent, accessToken]); // Added accessToken


    // --- Input Handling ---
    const handleInputChange = (e) => {
        setCurrentCommand(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !isLoading && !isFetchingContent) {
            e.preventDefault();
            executeCommand(currentCommand);
            setCurrentCommand('');
        }
        // Add history navigation (Up/Down arrows) here if desired
    };

    // --- Render ---
    return (
        <div
            className="flex flex-col h-full w-full bg-gray-900 text-white font-mono p-2 sm:p-4 text-xs sm:text-sm overflow-hidden"
            onClick={handleFocusInput} // Focus input when clicking anywhere
            >
            {/* Header (Optional but good) */}
             <div className="shrink-0 mb-2 pb-1 border-b border-gray-700">
                 <p className="text-center font-bold">
                     GitHub Repo Terminal Simulation
                     {repoMetadata && ` - ${repoMetadata.owner}/${repoMetadata.repo}`}
                  </p>
                 {repoUrl && <p className="text-center text-gray-400 text-xs truncate" title={repoUrl}>{repoUrl}</p>}
             </div>

             {/* History Area */}
             <div className="flex-grow overflow-y-auto mb-2 pr-2" > {/* Added pr-2 for scrollbar spacing */}
                {history.map((item, index) => (
                    <div key={index} className={`whitespace-pre-wrap break-words ${
                        item.type === 'input' ? 'text-green-400' :
                        item.type === 'error' ? 'text-red-400' :
                        item.type === 'warning' ? 'text-yellow-400' :
                        item.type === 'info' ? 'text-blue-400' :
                        item.type === 'success' ? 'text-teal-400' :
                         'text-gray-200' // output
                    }`}>
                        {/* Avoid rendering prompt for non-input lines */}
                        {item.content}
                     </div>
                ))}
                 {/* Status Indicators */}
                 {isLoading && <div className="text-yellow-400">Loading repository data...</div>}
                 {isFetchingContent && <div className="text-blue-400">Fetching file content...</div>}

                 {/* Dummy div to ensure scrolling to the bottom */}
                 <div ref={historyEndRef} style={{ height: '1px' }}/>
            </div>

            {/* Input Area */}
            <div className="flex items-center shrink-0">
                <span className="text-purple-400 mr-2 shrink-0">{prompt}</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={currentCommand}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="flex-grow bg-transparent border-none outline-none text-gray-100 disabled:opacity-50 w-full" // Added w-full
                    autoFocus
                    spellCheck="false"
                    autoComplete="off"
                    disabled={isLoading || isFetchingContent} // Disable input during loads
                />
            </div>
        </div>
    );
};

export default Terminal;