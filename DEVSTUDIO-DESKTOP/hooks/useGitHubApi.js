// src/hooks/useGitHubApi.js
import { useState, useCallback } from 'react';

// Helper: Base64 Encode (ensure Buffer is available or use window.btoa)
const encodeBase64 = (str) => {
    try {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(str, 'utf-8').toString('base64');
        }
        return window.btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error("Base64 encoding failed:", e);
        return null;
    }
};

const GITHUB_API_BASE = 'https://api.github.com';

export const useGitHubApi = (accessToken, selectedRepoFullName) => {
    // State for C/U/D operations
    const [isOperating, setIsOperating] = useState(false);
    const [operationError, setOperationError] = useState(null);
    const [operationSuccess, setOperationSuccess] = useState(false);

    // --- NEW: State for directory fetching ---
    const [isFetchingDirs, setIsFetchingDirs] = useState(false);
    const [fetchDirsError, setFetchDirsError] = useState(null);
    // --- End NEW ---

    // --- Helper for API Calls (Modified slightly for clarity) ---
    const makeApiCall = useCallback(async (method, path, bodyData = null, options = {}) => {
        const {
            isFetchOperation = false, // Flag to distinguish fetch from C/U/D
            operationVerb = method === 'PUT' ? (bodyData?.sha ? 'update' : 'create') : (method === 'DELETE' ? 'delete' : 'fetch')
        } = options;

        if (!selectedRepoFullName || !accessToken) {
            const errorMsg = !selectedRepoFullName ? "Repository not selected." : "Access token missing.";
            console.error(`GitHub API Hook Error (${operationVerb}): ${errorMsg}`);
            // Use appropriate error state based on operation type
            if (isFetchOperation) setFetchDirsError(`Cannot ${operationVerb}: ${errorMsg}`);
            else setOperationError(`Cannot ${operationVerb}: ${errorMsg}`);
            return { success: false, data: null, error: errorMsg };
        }

        // Set appropriate loading state
        if (isFetchOperation) {
            setIsFetchingDirs(true);
            setFetchDirsError(null);
        } else {
            setIsOperating(true);
            setOperationError(null);
            setOperationSuccess(false);
        }

        // Construct URL - Ensure path doesn't start with / if selectedRepoFullName is used
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const apiUrl = `${GITHUB_API_BASE}/repos/${selectedRepoFullName}/contents/${cleanPath}`;

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        };
        if (bodyData && (method === 'PUT' || method === 'DELETE')) { // Only add Content-Type for PUT/DELETE with body
            headers['Content-Type'] = 'application/json';
        }

        try {
            console.log(`GitHub API Hook: ${method} ${apiUrl}`, bodyData ? 'with body' : '');
            const response = await fetch(apiUrl, {
                method: method,
                headers: headers,
                ...(bodyData && (method === 'PUT' || method === 'DELETE') && { body: JSON.stringify(bodyData) })
            });

            let responseData = null;
            // Handle 204 No Content specifically for DELETE success
            if (response.status === 204 && method === 'DELETE') {
                responseData = { message: "Successfully deleted" };
            } else if (response.status === 200 && method === 'GET') {
                 // Handle successful GET (likely directory listing)
                 responseData = await response.json(); // Assume JSON for GET success
            } else if (response.ok && (method === 'PUT' || method === 'POST')) { // Handle 200 or 201 for Create/Update
                 responseData = await response.json();
            }
            else {
                // Try to parse JSON for other responses, even errors
                try {
                    responseData = await response.json();
                } catch (e) {
                    responseData = { message: response.statusText || 'Could not parse error response' };
                }
            }

            if (!response.ok) {
                let errorMsg = `GitHub API Error (${response.status})`;
                errorMsg += `: ${responseData?.message || 'No specific message.'}`;

                // Add specific user-friendly messages (keep yours, maybe add GET specific)
                if (response.status === 409 && method === 'PUT') errorMsg += ` (Conflict: SHA mismatch?)`;
                if (response.status === 409 && method === 'DELETE') errorMsg += ` (Conflict: SHA mismatch?)`;
                if (response.status === 404) errorMsg += ` (Not Found: Check path/permissions.)`;
                if (response.status === 422 && method === 'PUT') errorMsg += " (Unprocessable: Data invalid, or file exists?).";
                if (response.status === 422 && method === 'DELETE') errorMsg += " (Unprocessable: SHA required?)";
                if (response.status === 401 || response.status === 403) errorMsg += " (Auth Error: Check token/permissions.)";
                // NEW: Handle 404 specifically for GET (empty repo case)
                if (response.status === 404 && method === 'GET' && cleanPath === '') {
                    console.warn("GitHub API: Root path not found, treating as empty repository.");
                    // Treat empty repo root as success with empty data
                    if (isFetchOperation) setIsFetchingDirs(false); else setIsOperating(false);
                    return { success: true, data: [], error: null }; // Return empty array for dir list
                }


                console.error(`GitHub ${operationVerb} failed:`, errorMsg, { status: response.status, responseData });
                // Set appropriate error state
                if (isFetchOperation) setFetchDirsError(errorMsg);
                else setOperationError(errorMsg);

                if (isFetchOperation) setIsFetchingDirs(false); else setIsOperating(false);
                return { success: false, data: responseData, error: errorMsg };
            }

            // --- SUCCESS ---
            console.log(`GitHub ${operationVerb} successful. Response:`, responseData);
            if (!isFetchOperation) {
                setOperationSuccess(true);
                setOperationError(null); // Clear error on subsequent success
                setTimeout(() => setOperationSuccess(false), 3000); // Auto-hide success
            }
            // Clear fetch error on successful fetch
            if (isFetchOperation) setFetchDirsError(null);

            if (isFetchOperation) setIsFetchingDirs(false); else setIsOperating(false);
            return { success: true, data: responseData, error: null };

        } catch (error) {
            console.error(`Network/other error during GitHub ${operationVerb}:`, error);
            const errorMsg = `${operationVerb.charAt(0).toUpperCase() + operationVerb.slice(1)} failed: ${error.message || 'Check network connection.'}`;
            // Set appropriate error state
            if (isFetchOperation) setFetchDirsError(errorMsg);
            else setOperationError(errorMsg);

            if (isFetchOperation) setIsFetchingDirs(false); else setIsOperating(false);
            return { success: false, data: null, error: errorMsg };
        }

    }, [accessToken, selectedRepoFullName]);


    // --- File/Content Operations (using makeApiCall) ---

    const createFileOrUpdate = useCallback(async (filePath, content, commitMessage, fileSha = null) => {
        const encodedContent = encodeBase64(content);
        if (encodedContent === null) {
            setOperationError("Failed to encode file content.");
            return { success: false, data: null, error: "Encoding failed" };
        }
        const body = {
            message: commitMessage,
            content: encodedContent,
            ...(fileSha && { sha: fileSha }),
        };
        return makeApiCall('PUT', filePath, body, { isFetchOperation: false });
    }, [makeApiCall]);

    const deleteFile = useCallback(async (filePath, fileSha, commitMessage) => {
        if (!fileSha) {
             const errorMsg = "File SHA is required for deletion.";
             setOperationError(`Cannot delete: ${errorMsg}`);
             return { success: false, data: null, error: errorMsg };
        }
        const body = { message: commitMessage, sha: fileSha };
        return makeApiCall('DELETE', filePath, body, { isFetchOperation: false });
    }, [makeApiCall]);

    const commitCode = useCallback((codeContent, commitMessage, filePath, fileSha) => {
        return createFileOrUpdate(filePath, codeContent, commitMessage, fileSha);
    }, [createFileOrUpdate]);

    const createFile = useCallback((filePath, content, commitMessage) => {
        return createFileOrUpdate(filePath, content, commitMessage, null);
    }, [createFileOrUpdate]);

    // --- NEW: Directory Fetching Operation ---
    const getDirectories = useCallback(async (path = '') => {
         // Use makeApiCall with GET method and fetch flag
         const result = await makeApiCall('GET', path, null, { isFetchOperation: true, operationVerb: 'fetch directories' });

         if (result.success && Array.isArray(result.data)) {
            // Filter results for directories and map to path
            const dirs = result.data
                .filter(item => item.type === 'dir')
                .map(item => item.path);
            return { ...result, data: dirs }; // Return the filtered list
         } else if (result.success && !Array.isArray(result.data)) {
             // If the response was successful but not an array (e.g., fetching a file accidentally)
             console.warn(`getDirectories received non-array data for path "${path}", returning empty array.`);
             return { success: true, data: [], error: null };
         }
         // If failed, return the original result (which includes the error)
         return { ...result, data: [] }; // Ensure data is an empty array on failure

    }, [makeApiCall]);
    // --- End NEW ---


    // --- Utility Functions ---
    const clearOperationError = useCallback(() => {
        setOperationError(null);
    }, []);

    // Alias for clarity if needed, does the same thing
    const clearCommitError = clearOperationError;

    // --- NEW: Clear directory fetch error ---
    const clearFetchDirsError = useCallback(() => {
        setFetchDirsError(null);
    }, []);
    // --- End NEW ---


    return {
        // State for C/U/D
        isOperating,
        operationError,
        operationSuccess,

        // --- NEW: State for directory fetch ---
        isFetchingDirs,
        fetchDirsError,
        // --- End NEW ---

        // Actions
        createFile,
        commitCode,
        deleteFile,
        // --- NEW: Directory fetch action ---
        getDirectories,
        // --- End NEW ---

        // Clear error functions
        clearOperationError,
        clearCommitError,
        // --- NEW: Clear directory fetch error func ---
        clearFetchDirsError,
        // --- End NEW ---
    };
};