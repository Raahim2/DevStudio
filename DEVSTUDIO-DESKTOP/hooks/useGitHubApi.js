// src/hooks/useGitHubApi.js
import { useState, useCallback } from 'react';

// Helper: Base64 Encode (ensure Buffer is available or use window.btoa)
const encodeBase64 = (str) => {
    try {
        // Node.js/Webpack Buffer method (more robust for UTF-8)
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(str, 'utf-8').toString('base64');
        }
        // Browser's btoa (might have issues with some Unicode chars)
        return window.btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error("Base64 encoding failed:", e);
        return null; // Indicate failure
    }
};

const GITHUB_API_BASE = 'https://api.github.com';

export const useGitHubApi = (accessToken, selectedRepoFullName) => {
    // Unified loading/error/success state for *any* content operation (create/update/delete)
    const [isOperating, setIsOperating] = useState(false);
    const [operationError, setOperationError] = useState(null);
    const [operationSuccess, setOperationSuccess] = useState(false); // Generic success state


    // --- Helper for API Calls ---
    const makeApiCall = useCallback(async (method, path, bodyData = null, operationVerb = 'operate') => {
        if (!selectedRepoFullName || !accessToken) {
            const errorMsg = !selectedRepoFullName ? "Repository not selected." : "Access token missing.";
            console.error(`GitHub API Hook Error (${operationVerb}): ${errorMsg}`);
            setOperationError(`Cannot ${operationVerb}: ${errorMsg}`);
            return { success: false, data: null, error: errorMsg };
        }

        setIsOperating(true);
        setOperationError(null);
        setOperationSuccess(false);

        const apiUrl = `${GITHUB_API_BASE}/repos/${selectedRepoFullName}/contents/${path}`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        };
        if (bodyData) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            console.log(`GitHub API Hook: ${method} ${apiUrl}`, bodyData ? 'with body' : '');
            const response = await fetch(apiUrl, {
                method: method,
                headers: headers,
                ...(bodyData && { body: JSON.stringify(bodyData) })
            });

            let responseData = null;
             // Handle 204 No Content specifically for DELETE success
            if (response.status === 204 && method === 'DELETE') {
                 responseData = { message: "Successfully deleted" }; // Synthesize success data
            } else {
                // Try to parse JSON for other responses, even errors
                 try {
                    responseData = await response.json();
                 } catch (e) {
                     // If response is not JSON (e.g., unexpected server error), create placeholder
                     responseData = { message: response.statusText || 'Could not parse response' };
                 }
            }


            if (!response.ok) {
                let errorMsg = `GitHub API Error (${response.status})`;
                errorMsg += `: ${responseData?.message || 'No specific message.'}`;

                // Add specific user-friendly messages
                if (response.status === 409 && method === 'PUT') errorMsg += ` (Conflict: File SHA mismatch. Content may have changed.)`;
                if (response.status === 409 && method === 'DELETE') errorMsg += ` (Conflict: File SHA mismatch or branch conflict.)`;
                if (response.status === 404) errorMsg += " (Not Found: Check path/permissions.)";
                if (response.status === 422 && method === 'PUT') errorMsg += " (Unprocessable: Data invalid, or file already exists/content identical?).";
                 if (response.status === 422 && method === 'DELETE') errorMsg += " (Unprocessable: SHA required or invalid?)";
                if (response.status === 401 || response.status === 403) errorMsg += " (Auth Error: Check token/permissions.)";

                console.error(`GitHub ${operationVerb} failed:`, errorMsg, { status: response.status, responseData });
                setOperationError(errorMsg);
                setIsOperating(false);
                return { success: false, data: responseData, error: errorMsg };
            }

            // --- SUCCESS ---
            console.log(`GitHub ${operationVerb} successful. Response:`, responseData);
            setOperationSuccess(true);
            setIsOperating(false);
            setOperationError(null);
            setTimeout(() => setOperationSuccess(false), 3000); // Auto-hide success
            return { success: true, data: responseData, error: null };

        } catch (error) {
            console.error(`Network/other error during GitHub ${operationVerb}:`, error);
            const errorMsg = `${operationVerb.charAt(0).toUpperCase() + operationVerb.slice(1)} failed: ${error.message || 'Check network connection.'}`;
            setOperationError(errorMsg);
            setIsOperating(false);
            return { success: false, data: null, error: errorMsg };
        }

    }, [accessToken, selectedRepoFullName]);


    /**
     * Creates a new file OR Updates an existing file in the repository.
     * If fileSha is provided, it attempts an update. Otherwise, it attempts creation.
     * @param {string} filePath - Path to the file.
     * @param {string} content - New content of the file.
     * @param {string} commitMessage - Commit message.
     * @param {string} [fileSha] - The current SHA (required for UPDATE, omit for CREATE).
     * @returns {Promise<{success: boolean, data: object | null, error: string | null}>}
     */
    const createFileOrUpdate = useCallback(async (filePath, content, commitMessage, fileSha = null) => {
        const encodedContent = encodeBase64(content);
        if (encodedContent === null) {
            setOperationError("Failed to encode file content.");
            return { success: false, data: null, error: "Encoding failed" };
        }

        const body = {
            message: commitMessage,
            content: encodedContent,
            ...(fileSha && { sha: fileSha }), // Add sha only if updating
             // branch: 'your-branch-name' // Optionally specify branch
        };

        const operationVerb = fileSha ? 'update' : 'create';
        return makeApiCall('PUT', filePath, body, operationVerb);

    }, [makeApiCall]);


    /**
     * Deletes a file from the repository.
     * @param {string} filePath - Path to the file to delete.
     * @param {string} fileSha - The current SHA of the file (required for deletion).
     * @param {string} commitMessage - Commit message for the deletion.
     * @returns {Promise<{success: boolean, data: object | null, error: string | null}>}
     */
    const deleteFile = useCallback(async (filePath, fileSha, commitMessage) => {
        if (!fileSha) {
            const errorMsg = "File SHA is required for deletion.";
            setOperationError(`Cannot delete: ${errorMsg}`);
             return { success: false, data: null, error: errorMsg };
        }
        const body = {
            message: commitMessage,
            sha: fileSha,
             // branch: 'your-branch-name' // Optionally specify branch
        };
        return makeApiCall('DELETE', filePath, body, 'delete');
    }, [makeApiCall]);

    // --- Exposed Functions and State ---

    // Specific function for clarity if needed, uses the generic one
    const commitCode = useCallback((codeContent, commitMessage, filePath, fileSha) => {
        return createFileOrUpdate(filePath, codeContent, commitMessage, fileSha);
    }, [createFileOrUpdate]);

    // Specific function for clarity, uses the generic one
     const createFile = useCallback((filePath, content, commitMessage) => {
         // Explicitly pass null for fileSha to ensure creation attempt
         return createFileOrUpdate(filePath, content, commitMessage, null);
     }, [createFileOrUpdate]);


    const clearOperationError = useCallback(() => {
        setOperationError(null);
    }, []);

    const clearCommitError = useCallback(() => {
        setOperationError(null);
    }, []);

    return {
        // State
        isOperating,        // Unified loading state for C/U/D operations
        operationError,     // Unified error state
        operationSuccess,   // Unified success state

        // Actions
        createFile,
        commitCode,         // Alias for update using createFileOrUpdate
        deleteFile,
        clearOperationError, // To manually clear errors
        clearCommitError

        // You might expose createFileOrUpdate directly if preferred
        // createFileOrUpdate,
    };
};