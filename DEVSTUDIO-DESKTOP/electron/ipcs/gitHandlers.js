const simpleGit = require('simple-git');
const { successResponse, errorResponse } = require('../utils');

const getGit = (folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') {
        console.error("[IPC getGit] Invalid folderPath:", folderPath);
        throw new Error("Folder path is required and must be a string for Git operations.");
    }
    return simpleGit(folderPath);
};

function setupGitHandlers(ipcMain) {
    ipcMain.handle('gitIsRepo', async (event, folderPath) => {
        try {
            const git = getGit(folderPath);
            const isRepoResult = await git.checkIsRepo('root');
            console.log(`[IPC gitIsRepo] Path: ${folderPath}, Is Repo: ${isRepoResult}`);
            return successResponse(isRepoResult);
        } catch (e) {
            if (e.message && (e.message.includes("Not a git repository") || e.message.includes("fatal: not a git repository"))) {
                console.log(`[IPC gitIsRepo] Path: ${folderPath}, Is Repo: false (Caught Error)`);
                return successResponse(false);
            }
            return errorResponse(`Failed to check repository status for ${folderPath}`, e);
        }
    });

    ipcMain.handle('gitGetStatus', async (event, folderPath) => {
        try {
            const git = getGit(folderPath);
            const status = await git.status();
            console.log(`[IPC gitGetStatus] Raw status for ${folderPath}:`, {
                current: status.current, tracking: status.tracking, ahead: status.ahead, behind: status.behind, isClean: status.isClean(), files: status.files.length
            });

            let remoteUrl = null;
            try {
                const remotes = await git.getRemotes(true);
                const origin = remotes.find(r => r.name === 'origin');
                if (origin && origin.refs) {
                    remoteUrl = origin.refs.fetch || origin.refs.push;
                }
                console.log(`[IPC gitGetStatus] Remote URL for ${folderPath}: ${remoteUrl}`);
            } catch (remoteError) {
                console.warn(`[IPC gitGetStatus] Could not get remote URL for ${folderPath}: ${remoteError.message}`);
            }

            const serializableStatus = {
                files: Array.isArray(status.files) ? status.files.map(f => ({
                    path: String(f.path),
                    index: String(f.index).trim() || ' ',
                    working_dir: String(f.working_dir).trim() || ' '
                })) : [],
                current: typeof status.current === 'string' ? status.current : null,
                tracking: typeof status.tracking === 'string' ? status.tracking : null,
                ahead: typeof status.ahead === 'number' ? status.ahead : 0,
                behind: typeof status.behind === 'number' ? status.behind : 0,
                detached: typeof status.detached === 'boolean' ? status.detached : false,
                isClean: typeof status.isClean === 'function' ? status.isClean() : (typeof status.isClean === 'boolean' ? status.isClean : false),
                remoteUrl: typeof remoteUrl === 'string' ? remoteUrl : null,
                conflicted: Array.isArray(status.conflicted) ? status.conflicted.map(String) : [],
            };
            return successResponse(serializableStatus);
        } catch (e) {
            return errorResponse(`Failed to get Git status for ${folderPath}`, e);
        }
    });

    ipcMain.handle('gitGetDiff', async (event, folderPath, filePath, isStaged) => {
        try {
            const git = getGit(folderPath);
            const options = isStaged ? ['--staged'] : [];
            console.log(`[IPC gitGetDiff] Path: ${folderPath}, File: ${filePath}, Staged: ${isStaged}`);
            const diffContent = await git.diff([...options, '--', filePath]);
            return successResponse(diffContent);
        } catch (e) {
            return errorResponse(`Failed to get diff for ${filePath}`, e);
        }
    });

    ipcMain.handle('gitAdd', async (event, folderPath, filePathsArray) => {
        try {
            const git = getGit(folderPath);
            if (!Array.isArray(filePathsArray) || filePathsArray.length === 0) {
                throw new Error("File paths array is required for staging.");
            }
            console.log(`[IPC gitAdd] Path: ${folderPath}, Files:`, filePathsArray);
            await git.add(filePathsArray);
            return successResponse();
        } catch (e) {
            return errorResponse(`Failed to stage files`, e);
        }
    });

    ipcMain.handle('gitUnstage', async (event, folderPath, filePathsArray) => {
        try {
            const git = getGit(folderPath);
            if (!Array.isArray(filePathsArray) || filePathsArray.length === 0) {
                throw new Error("File paths array is required for unstaging.");
            }
            console.log(`[IPC gitUnstage] Path: ${folderPath}, Files:`, filePathsArray);
            await git.reset(['--', ...filePathsArray]);
            return successResponse();
        } catch (e) {
            return errorResponse(`Failed to unstage files`, e);
        }
    });

    ipcMain.handle('gitCommit', async (event, folderPath, message) => {
        try {
            const git = getGit(folderPath);
            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                throw new Error("Commit message is required.");
            }
            console.log(`[IPC gitCommit] Path: ${folderPath}, Message: "${message}"`);
            const commitResult = await git.commit(message.trim());
            const serializableCommitResult = {
                commit: commitResult.commit || null,
                branch: commitResult.branch || null,
                summary: commitResult.summary ? {
                    changes: commitResult.summary.changes || 0,
                    insertions: commitResult.summary.insertions || 0,
                    deletions: commitResult.summary.deletions || 0
                } : { changes: 0, insertions: 0, deletions: 0 }
            };
            console.log(`[IPC gitCommit] Success:`, serializableCommitResult);
            return successResponse(serializableCommitResult);
        } catch (e) {
            let userMsg = e.message || 'Failed to commit changes.';
            if (userMsg.includes("nothing to commit")) {
                userMsg = "Commit failed: No changes added to commit.";
            } else if (userMsg.includes("conflicts")) {
                userMsg = "Commit failed: You have unmerged paths. Resolve conflicts first.";
            }
            return errorResponse(userMsg, e);
        }
    });

    ipcMain.handle('gitPush', async (event, folderPath, remoteName, branchName, token) => {
        try {
            const git = getGit(folderPath);
            if (!remoteName || !branchName) {
                throw new Error("Remote name and branch name are required for push.");
            }
            const status = await git.status();
            const needsUpstream = !status.tracking || status.tracking === '';
            console.log(`[IPC gitPush] Pushing branch '${branchName}' to remote '${remoteName}'. Needs upstream: ${needsUpstream}`);
            const remotes = await git.getRemotes(true);
            const targetRemote = remotes.find(r => r.name === remoteName);
            const remotePushUrl = targetRemote?.refs?.push;
            if (!targetRemote || !remotePushUrl) {
                throw new Error(`Push URL for remote '${remoteName}' not found.`);
            }
            let effectiveRemoteUrl = remotePushUrl;
            const pushArgs = [];
            if (remotePushUrl.startsWith('https://') && token) {
                try {
                    const url = new URL(remotePushUrl);
                    effectiveRemoteUrl = `https://${token}@${url.host}${url.pathname}${url.search}${url.hash}`;
                    console.log(`[IPC gitPush] Pushing to HTTPS URL with token: https://****@${url.host}${url.pathname}`);
                } catch (urlError){
                    throw new Error(`Invalid remote URL format for token injection: ${remotePushUrl}`);
                }
            } else {
                console.log(`[IPC gitPush] Pushing to: ${effectiveRemoteUrl} (SSH or no token)`);
            }
            if (needsUpstream) {
                console.log(`[IPC gitPush] Adding '--set-upstream' flag.`);
                pushArgs.push('--set-upstream');
            }
            console.log(`[IPC gitPush] Executing push: URL=${effectiveRemoteUrl.replace(token || '', '****')}, Branch=${branchName}, Args=`, pushArgs);
            await git.push(effectiveRemoteUrl, branchName, pushArgs);
            console.log(`[IPC gitPush] Push successful for ${folderPath} branch ${branchName}`);
            return successResponse();
        } catch (e) {
            console.error(`[IPC gitPush] Error for ${folderPath}:`, e);
            let userFriendlyError = e.message || 'Failed to push changes.';
            if (userFriendlyError.includes('src refspec') || userFriendlyError.includes('does not match any')) {
                userFriendlyError = 'Push failed: Local branch may not exist, have commits, or match remote. Ensure commits exist.';
            } else if (userFriendlyError.includes('authentication') || userFriendlyError.includes('remote: Invalid username or password')) {
                userFriendlyError = 'Push failed: Authentication error. Check GitHub token/permissions ("repo" scope) and remote URL.';
            } else if (userFriendlyError.includes('! [rejected]') || userFriendlyError.includes('non-fast-forward') || userFriendlyError.includes('fetch first')) {
                userFriendlyError = 'Push rejected (non-fast-forward): Remote has changes you do not have locally. Please Pull first to integrate changes.';
            } else if (userFriendlyError.includes('set-upstream') || userFriendlyError.includes('upstream branch not set')) {
                userFriendlyError = 'Push failed: Could not set upstream branch. Remote branch might not exist or push was rejected.';
            } else if (userFriendlyError.includes('nothing to push')) {
                userFriendlyError = 'Push failed: Nothing to push. Local branch is already up-to-date.';
            } else if (userFriendlyError.includes('could not read Username') || userFriendlyError.includes('Permission denied (publickey)')) {
                userFriendlyError = 'Push failed: Authentication error. Check SSH key setup or use HTTPS with a token.';
            } else if (userFriendlyError.includes('Could not resolve host')) {
                userFriendlyError = 'Push failed: Could not resolve remote host. Check network connection and remote URL.';
            } else if (userFriendlyError.includes('unrelated histories')) {
                userFriendlyError = 'Push rejected: Histories are unrelated. You may need to Pull with `--allow-unrelated-histories` first (use with caution).';
            }
            return errorResponse(userFriendlyError, e);
        }
    });

    ipcMain.handle('gitFetch', async (event, folderPath, remoteName, token) => {
        try {
            const git = getGit(folderPath);
            if (!remoteName) {
                throw new Error("Remote name is required for fetch.");
            }
            const remotes = await git.getRemotes(true);
            const targetRemote = remotes.find(r => r.name === remoteName);
            const remoteFetchUrl = targetRemote?.refs?.fetch;
            if (!targetRemote) {
                throw new Error(`Remote '${remoteName}' not found.`);
            }
            if (!remoteFetchUrl) {
                throw new Error(`Fetch URL for remote '${remoteName}' not found.`);
            }
            let effectiveRemoteUrl = remoteFetchUrl;
            let fetchOptions = { '--prune': null };
            if (remoteFetchUrl.startsWith('https://') && token) {
                try {
                    const url = new URL(remoteFetchUrl);
                    effectiveRemoteUrl = `https://${token}@${url.host}${url.pathname}${url.search}${url.hash}`;
                    console.log(`[IPC gitFetch] Fetching from HTTPS URL with token: https://****@${url.host}${url.pathname}`);
                } catch(urlError) {
                    throw new Error(`Invalid remote URL format for token injection: ${remoteFetchUrl}`);
                }
            } else {
                console.log(`[IPC gitFetch] Fetching from: ${effectiveRemoteUrl}`);
            }
            console.log(`[IPC gitFetch] Executing fetch: URL=${effectiveRemoteUrl.replace(token || '', '****')}, Options=`, fetchOptions);
            await git.fetch(effectiveRemoteUrl, undefined, fetchOptions);
            console.log(`[IPC gitFetch] Fetch successful for ${folderPath}`);
            return successResponse();
        } catch (e) {
            let userFriendlyError = e.message || 'Failed to fetch changes.';
            if (userFriendlyError.includes('authentication') || userFriendlyError.includes('remote: Invalid username or password')) {
                userFriendlyError = 'Fetch failed: Authentication error. Check GitHub token.';
            } else if (userFriendlyError.includes('Could not resolve host')) {
                userFriendlyError = 'Fetch failed: Could not resolve remote host. Check network connection and remote URL.';
            }
            return errorResponse(userFriendlyError, e);
        }
    });

    ipcMain.handle('gitPull', async (event, folderPath, remoteName, branchName, token) => {
        try {
            const git = getGit(folderPath);
            if (!remoteName || !branchName) {
                throw new Error("Remote name and branch name are required for pull.");
            }
            let effectiveRemote = remoteName;
            const pullOptions = {};
            console.log(`[IPC gitPull] Executing explicit pull: Remote=${effectiveRemote}, Branch=${branchName}, Options=`, pullOptions);
            await git.pull(effectiveRemote, branchName, pullOptions);
            console.log(`[IPC gitPull] Pull successful for ${folderPath} branch ${branchName}`);
            return successResponse();
        } catch (e) {
            console.error(`[IPC gitPull] Error for ${folderPath}:`, e);
            let userFriendlyError = e.message || 'Failed to pull changes.';
            if (userFriendlyError.includes('Merge conflict') || userFriendlyError.includes('needs merge')) {
                userFriendlyError = "Pull failed: Merge conflicts detected. Please resolve them manually.";
            } else if (userFriendlyError.includes('authentication') || userFriendlyError.includes('remote: Invalid username or password')) {
                userFriendlyError = "Pull failed: Authentication error. Check credentials/token and remote URL.";
            } else if (userFriendlyError.includes('no tracking information')) {
                userFriendlyError = `Pull failed: Could not determine upstream. Remote branch '${branchName}' might not exist on '${remoteName}'.`;
            } else if (userFriendlyError.includes('refusing to merge unrelated histories')) {
                userFriendlyError = 'Pull failed: Histories are unrelated. Merge manually using `git pull origin main --allow-unrelated-histories` in terminal if intended (use with caution).';
            } else if (userFriendlyError.includes('overwritten by merge') || (userFriendlyError.includes('local changes') && userFriendlyError.includes('would be overwritten'))) {
                userFriendlyError = 'Pull failed: Your local changes to tracked files would be overwritten by merge. Please commit or stash them first.';
            } else if (userFriendlyError.includes('Could not resolve host')) {
                userFriendlyError = 'Pull failed: Could not resolve remote host. Check network connection and remote URL.';
            } else if (userFriendlyError.includes(`couldn't find remote ref ${branchName}`)) {
                userFriendlyError = `Pull failed: Remote branch '${branchName}' not found on remote '${remoteName}'.`;
            }
            return errorResponse(userFriendlyError, e);
        }
    });

    ipcMain.handle('gitSetUpstream', async (event, folderPath, localBranch, remoteName, remoteBranch) => {
        try {
            const git = getGit(folderPath);
            if (!localBranch || !remoteName || !remoteBranch) {
                throw new Error("Local branch, remote name, and remote branch are required to set upstream.");
            }
            const remoteTrackingBranch = `${remoteName}/${remoteBranch}`;
            console.log(`[IPC gitSetUpstream] Attempting to set upstream for '${localBranch}' to '${remoteTrackingBranch}' in ${folderPath}`);
            await git.raw('branch', localBranch, '--set-upstream-to', remoteTrackingBranch);
            console.log(`[IPC gitSetUpstream] Successfully set upstream for '${localBranch}' to '${remoteTrackingBranch}'.`);
            return successResponse();
        } catch (e) {
            console.warn(`[IPC gitSetUpstream] Failed to set upstream for '${localBranch}' to track '${remoteName}/${remoteBranch}'. This is often okay if the local branch has no commits yet or remote branch is missing. Error: ${e.message}`);
            return errorResponse(`Could not automatically set upstream for branch '${localBranch}'. Tracking might be set up on first push.`, e);
        }
    });

    ipcMain.handle('gitInit', async (event, folderPath) => {
        try {
            console.log(`[IPC gitInit] Initializing Git repository in: ${folderPath}`);
            await getGit(folderPath).init();
            console.log(`[IPC gitInit] Git initialized successfully.`);
            return successResponse();
        } catch (e) {
            return errorResponse(`Failed to initialize git repository`, e);
        }
    });

    ipcMain.handle('gitAddRemote', async (event, folderPath, remoteName, remoteUrl) => {
        try {
            const git = getGit(folderPath);
            if (!remoteName || !remoteUrl) {
                throw new Error("Remote name and URL are required.");
            }
            console.log(`[IPC gitAddRemote] Path: ${folderPath}, Name: ${remoteName}, URL: ${remoteUrl}`);
            await git.addRemote(remoteName, remoteUrl);
            console.log(`[IPC gitAddRemote] Remote '${remoteName}' added successfully.`);
            return successResponse();
        } catch (e) {
            let userFriendlyError = e.message || `Failed to add remote '${remoteName}'.`;
            if (userFriendlyError.includes('already exists')) {
                userFriendlyError = `Remote '${remoteName}' already exists. Use a different name or manage remotes manually.`;
            }
            return errorResponse(userFriendlyError, e);
        }
    });
}

module.exports = { setupGitHandlers };