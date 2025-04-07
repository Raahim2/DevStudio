// src/hooks/useGitHubApi.js
import { useState, useCallback } from 'react';

const GITHUB_API_BASE = 'https://api.github.com';

// Helper: Base64 Encode
const encodeBase64 = (str) => {
    try {
        // Use TextEncoder for reliable UTF-8 handling
        const bytes = new TextEncoder().encode(str);
        // Convert bytes to a binary string
        const binString = String.fromCodePoint(...bytes);
        // Base64 encode the binary string
        return btoa(binString);
    } catch (e) {
        console.error("Base64 encoding failed with TextEncoder:", e);
        // Fallback for environments where TextEncoder might not be available or fails
        try {
            // This fallback might have issues with certain Unicode characters
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e2) {
            console.error("Base64 encoding fallback failed:", e2);
            return null; // Indicate failure
        }
    }
};


export const useGitHubApi = (accessToken, selectedRepoFullName) => {
    const [isCommitting, setIsCommitting] = useState(false);
    const [commitError, setCommitError] = useState(null);
    const [commitSuccess, setCommitSuccess] = useState(false); // Tracks success for UI feedback

    /**
     * Attempts to commit code changes to a specific file in the selected GitHub repository.
     * @param {string} codeContent - The new content of the file.
     * @param {string} commitMessage - The message for the commit.
     * @param {string} filePath - The path to the file within the repository.
     * @param {string} fileSha - The *expected* current SHA of the file blob (required to prevent overwriting).
     * @returns {Promise<{success: boolean, newSha: string | null}>} - A promise resolving to an object indicating success and the new SHA if successful.
     */
    const commitCode = useCallback(async (codeContent, commitMessage, filePath, fileSha) => {
        // --- Precondition Checks ---
        if (!selectedRepoFullName) {
            console.error("Commit Hook Error: Repository not selected.");
            setCommitError("Cannot commit: Repository not selected.");
            return { success: false, newSha: null };
        }
        if (!accessToken) {
            console.error("Commit Hook Error: Access token missing.");
            setCommitError("Cannot commit: Authentication token missing.");
            return { success: false, newSha: null };
        }
        if (!filePath) {
            console.error("Commit Hook Error: File path missing.");
            setCommitError("Cannot commit: File path is required.");
            return { success: false, newSha: null };
        }
        if (!fileSha) {
            console.error("Commit Hook Error: File SHA missing.");
            // This is critical for preventing overwrites
            setCommitError("Cannot commit: Current file SHA is required (for conflict detection).");
            return { success: false, newSha: null };
        }

        // --- Start Commit Process ---
        setIsCommitting(true);
        setCommitError(null); // Clear previous errors
        setCommitSuccess(false); // Reset success state

        const apiUrl = `${GITHUB_API_BASE}/repos/${selectedRepoFullName}/contents/${filePath}`;
        const encodedContent = encodeBase64(codeContent);

        // Handle encoding failure
        if (encodedContent === null) {
            setCommitError("Failed to encode file content for commit.");
            setIsCommitting(false);
            return { success: false, newSha: null };
        }

        // --- Prepare Request Body ---
        const body = JSON.stringify({
            message: commitMessage, // The commit message
            content: encodedContent, // The new file content, base64 encoded
            sha: fileSha, // The SHA of the file blob being replaced
            // Optionally add branch, committer, author fields if needed
            // branch: 'main' // Example: Specify branch if not default
        });

        // --- Make API Call ---
        try {
            console.log(`Attempting commit via hook: PUT ${apiUrl} (Replacing SHA: ${fileSha})`);
            const response = await fetch(apiUrl, {
                method: 'PUT', // Use PUT to update existing file content
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: body,
            });

            // --- Handle API Response ---
            if (!response.ok) {
                // Attempt to parse error details from GitHub response
                let errorMsg = `GitHub API Error (${response.status})`;
                let errorData = null;
                try {
                    errorData = await response.json();
                    errorMsg += `: ${errorData.message || 'No specific message from GitHub.'}`;
                } catch (e) {
                    errorMsg += `: ${response.statusText || 'Could not parse error response.'}`;
                }

                // Add specific user-friendly messages for common errors
                if (response.status === 409) {
                    // CONFLICT: The SHA provided didn't match the file on the server
                    errorMsg += ` (Conflict: File SHA ${fileSha} didn't match remote. Content may have changed externally. Refresh file content.)`;
                } else if (response.status === 404) {
                    errorMsg += " (Not Found: Check file path and repository access permissions.)";
                } else if (response.status === 422) {
                    errorMsg += " (Unprocessable Entity: Request data might be invalid, or content is identical?)";
                } else if (response.status === 401 || response.status === 403) {
                    errorMsg += " (Authentication/Authorization Error: Check token validity and permissions.)";
                }

                console.error("GitHub Commit failed:", errorMsg, { status: response.status, responseData: errorData });
                setCommitError(errorMsg); // Set the error state for the UI
                setIsCommitting(false);
                setCommitSuccess(false);
                return { success: false, newSha: null }; // Return failure
            }

            // --- SUCCESS ---
            const responseData = await response.json();
            console.log("GitHub Commit successful via hook. Response:", responseData);

            // Extract the SHA of the newly created/updated content blob
            const newContentSha = responseData?.content?.sha;

            if (!newContentSha) {
                 // This shouldn't happen on a successful 200/201, but log a warning if it does
                 console.warn("Commit successful, but could not extract new content SHA from response. Response structure might have changed or be unexpected.", responseData);
            }

            // Update UI state for success
            setCommitSuccess(true);
            setIsCommitting(false);
            setCommitError(null); // Clear any previous errors

            // Automatically hide the success indicator after a short delay
            setTimeout(() => setCommitSuccess(false), 3500);

            // Return success status and the new SHA
            return { success: true, newSha: newContentSha };

        } catch (error) {
            // Handle network errors or other unexpected issues during fetch
            console.error("Network or other error during GitHub commit hook:", error);
            setCommitError(`Commit failed: ${error.message || 'Check network connection.'}`);
            setIsCommitting(false);
            setCommitSuccess(false);
            return { success: false, newSha: null }; // Return failure
        }
    }, [accessToken, selectedRepoFullName]); // Dependencies for the useCallback

    // Function to allow manual clearing of the commit error from the UI
    const clearCommitError = useCallback(() => {
        setCommitError(null);
    }, []);

    // Return the state and functions needed by the consuming component
    return {
        commitCode,        // The function to call to perform the commit
        isCommitting,      // Boolean indicating if a commit is in progress
        commitError,       // String containing the last commit error message, or null
        commitSuccess,     // Boolean indicating if the last commit was successful
        clearCommitError   // Function to manually clear the commit error message
    };
};