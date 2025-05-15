const { Octokit } = require("@octokit/rest");
const { successResponse, errorResponse } = require('../utils');

function setupGitHubApiHandlers(ipcMain) {
    ipcMain.handle('githubListUserRepos', async(event, token) => {
        if (!token) return errorResponse("GitHub token is required.");
        const octokit = new Octokit({
            auth: token,
            userAgent: 'DevStudioApp v1.0',
        });
        try {
            console.log("[IPC githubListUserRepos] Fetching repositories for authenticated user...");
            const response = await octokit.repos.listForAuthenticatedUser({
                type: 'owner',
                sort: 'updated',
                direction: 'desc',
                per_page: 100
            });
            console.log(`[IPC githubListUserRepos] Received ${response.data.length} repositories.`);
            const serializableRepos = Array.isArray(response.data) ? response.data.map(repo => ({
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                clone_url: repo.clone_url,
                private: repo.private,
                html_url: repo.html_url
            })) : [];
            return successResponse(serializableRepos);
        } catch (error) {
            let userFriendlyError = error.message || "Failed to list GitHub repositories";
            if (error.status === 401 || error.status === 403) {
                userFriendlyError = "Authentication failed. Check GitHub token and its permissions (needs 'repo' scope to list private/all repos).";
            } else if (error.response?.data?.message) {
                userFriendlyError = `GitHub API Error: ${error.response.data.message}`;
            }
            return errorResponse(userFriendlyError, error);
        }
    });

    ipcMain.handle('githubCreateRepo', async(event, token, repoName, isPrivate) => {
        if (!token) return errorResponse("GitHub token is required.");
        if (!repoName || typeof repoName !== 'string' || repoName.trim().length === 0) {
            return errorResponse("Repository name is required.");
        }
        const octokit = new Octokit({
            auth: token,
            userAgent: 'DevStudioApp v1.0',
        });
        try {
            console.log(`[IPC githubCreateRepo] Creating repo: Name=${repoName}, Private=${isPrivate}`);
            const response = await octokit.repos.createForAuthenticatedUser({
                name: repoName.trim(),
                private: !!isPrivate,
            });
            console.log(`[IPC githubCreateRepo] Repository created successfully: ${response.data.full_name}`);
            const serializableRepoData = {
                id: response.data.id,
                name: response.data.name,
                full_name: response.data.full_name,
                clone_url: response.data.clone_url,
                html_url: response.data.html_url
            };
            return successResponse(serializableRepoData);
        } catch (error) {
            let userFriendlyError = error.message || "Failed to create GitHub repository";
            if (error.status === 422) {
                userFriendlyError = `Could not create repository: Name "${repoName}" might already exist or is invalid.`;
            } else if (error.status === 401 || error.status === 403) {
                userFriendlyError = "Authentication failed. Check GitHub token and its permissions (needs 'repo' scope to create repositories).";
            } else if (error.response?.data?.message) {
                userFriendlyError = `GitHub API Error: ${error.response.data.message}`;
            }
            return errorResponse(userFriendlyError, error);
        }
    });
}

module.exports = { setupGitHubApiHandlers };