// components/NewRepoModal.jsx
import React, { useState, useCallback } from 'react';

// Template source details
const TEMPLATE_SOURCES = {
    // Key matches the 'value' in the select dropdown
    'blank': null, // Special case for no template
    'flask': { owner: 'Raahim2', repo: 'GitMax', path: 'templates/FLASK', branch: 'master' },
    'expo': { owner: 'Raahim2', repo: 'GitMax', path: 'templates/EXPO', branch: 'master' },
    'html_css_js': { owner: 'Raahim2', repo: 'GitMax', path: 'templates/HTML_CSS_JS', branch: 'master' },
    'nextjs': { owner: 'Raahim2', repo: 'GitMax', path: 'templates/NEXT', branch: 'master' },
};

// Helper Function to fetch content (handles potential errors)
async function fetchGitHubContent(url, accessToken) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
        },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Catch cases where body isn't JSON
        throw new Error(`GitHub API Error (${response.status}): ${errorData.message || 'Failed to fetch content'}`);
    }
    return response.json();
}

// Helper function to create/update file content
async function createGitHubFile(url, accessToken, commitMessage, base64Content) {
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: commitMessage,
            content: base64Content,
            // We could specify branch here if needed, defaults to default branch
        }),
    });
    if (!response.ok && response.status !== 201 && response.status !== 200) { // 201 Created, 200 Updated
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GitHub API Error (${response.status}): ${errorData.message || 'Failed to create file'}`);
    }
    return response.json();
}

// Recursive function to copy files from template source to target repo
async function copyTemplateFiles(
    sourceInfo, // { owner, repo, path, branch }
    targetOwner,
    targetRepo,
    accessToken,
    baseSourcePath, // The initial template path (e.g., 'templates/FLASK')
    currentSourcePath, // The path currently being processed
    setProgress // Function to update progress message
) {
    const contentsUrl = `https://api.github.com/repos/${sourceInfo.owner}/${sourceInfo.repo}/contents/${currentSourcePath}?ref=${sourceInfo.branch}`;
    console.log(`Fetching contents from: ${contentsUrl}`);
    setProgress(`Fetching template structure from ${currentSourcePath}...`);
    const contents = await fetchGitHubContent(contentsUrl, accessToken);

    for (const item of contents) {
        // Calculate the relative path within the template structure
        const relativePath = item.path.substring(baseSourcePath.length).replace(/^\//, ''); // Remove base path and leading slash
        const targetPath = relativePath; // Path in the new repo

        if (item.type === 'file') {
            console.log(`Processing file: ${item.path} -> ${targetPath}`);
            setProgress(`Copying file: ${targetPath}...`);

            // Fetch file content (which includes base64 data)
            const fileUrl = `https://api.github.com/repos/${sourceInfo.owner}/${sourceInfo.repo}/contents/${item.path}?ref=${sourceInfo.branch}`;
            const fileData = await fetchGitHubContent(fileUrl, accessToken);

            if (!fileData.content) {
                console.warn(`File ${item.path} seems to be empty or binary data not fetched correctly.`);
                continue; // Skip empty files or handle differently if needed
            }

            // Create the file in the target repository
            const targetFileUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo}/contents/${targetPath}`;
            await createGitHubFile(
                targetFileUrl,
                accessToken,
                `feat: Add ${targetPath} from template`, // Commit message
                fileData.content // Already base64 encoded
            );
            console.log(`Successfully created file: ${targetPath}`);

        } else if (item.type === 'dir') {
            console.log(`Processing directory: ${item.path}`);
            // Recursively process the subdirectory
            await copyTemplateFiles(
                sourceInfo,
                targetOwner,
                targetRepo,
                accessToken,
                baseSourcePath,
                item.path, // Use the full path for the next level fetch
                setProgress
            );
        }
    }
}


function NewRepoModal({ isOpen, onClose, accessToken, onCreateSuccess }) {
    const [repoName, setRepoName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [template, setTemplate] = useState('blank'); // Default to blank

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [progressMessage, setProgressMessage] = useState(''); // For feedback during multi-step process

    const resetForm = useCallback(() => {
        setRepoName('');
        setDescription('');
        setVisibility('public');
        setTemplate('blank');
        setError(null);
        setProgressMessage('');
        setIsSubmitting(false);
    }, []); // No dependencies needed if only setting static values

    const handleCloseAndReset = useCallback(() => {
        resetForm();
        onClose();
    }, [resetForm, onClose]);

    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            handleCloseAndReset();
        }
    }, [handleCloseAndReset]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setProgressMessage('');

        if (!accessToken) {
            setError('Authentication token is missing.');
            return;
        }
        if (!repoName.trim()) {
            setError('Repository name is required.');
            return;
        }

        setIsSubmitting(true);
        const selectedTemplateSource = TEMPLATE_SOURCES[template];
        const isTemplateClone = template !== 'blank' && selectedTemplateSource;

        try {
            // --- Step 1: Create the Repository ---
            setProgressMessage('Creating repository...');
            const createRepoUrl = 'https://api.github.com/user/repos';
            const repoData = {
                name: repoName.trim(),
                description: description.trim(),
                private: visibility === 'private',
                auto_init: false, // IMPORTANT: Create empty repo if cloning template
            };

            const createResponse = await fetch(createRepoUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(repoData),
            });

            const newRepoData = await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(`Failed to create repository (${createResponse.status}): ${newRepoData.message || 'Unknown error'}${newRepoData.errors ? ` (${newRepoData.errors[0]?.message})` : ''}`);
            }

            console.log('Repository created successfully:', newRepoData);
            const targetOwner = newRepoData.owner.login;
            const targetRepo = newRepoData.name;

            // --- Step 2: If a template was selected, copy its files ---
            if (isTemplateClone) {
                setProgressMessage('Starting template file copy...');
                console.log(`Cloning template from ${selectedTemplateSource.owner}/${selectedTemplateSource.repo}/${selectedTemplateSource.path}`);

                await copyTemplateFiles(
                    selectedTemplateSource,
                    targetOwner,
                    targetRepo,
                    accessToken,
                    selectedTemplateSource.path, // Base path for relative calculation
                    selectedTemplateSource.path, // Initial path to fetch
                    setProgressMessage // Pass updater function
                );

                setProgressMessage('Template files copied successfully!');
            } else {
                // If 'blank', just create a README optionally? Or leave truly blank?
                // Let's leave it truly blank as per auto_init: false
                // If you wanted a README for the 'blank' option, you'd add a PUT call here.
                 setProgressMessage('Blank repository created.');
            }


            // --- Step 3: Success ---
            alert(`Repository "${newRepoData.full_name}" ${isTemplateClone ? 'cloned from template' : 'created'} successfully!`);
            if (onCreateSuccess) {
                onCreateSuccess(newRepoData);
            }
            handleCloseAndReset();

        } catch (err) {
            console.error('Error during repository creation/cloning:', err);
            // Attempt to clean up if repo creation succeeded but cloning failed?
            // This is complex. For now, just show the error.
            // You might want to add a DELETE request here in a real-world scenario
            // if the repo was created but files couldn't be copied.
            setError(`Operation failed: ${err.message}`);
            setProgressMessage(''); // Clear progress on error
        } finally {
            setIsSubmitting(false);
            // Don't clear progress message immediately on success, maybe keep it for a second?
            // Or clear it in resetForm which is called on success.
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className={`fixed inset-0 z-40 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={handleBackdropClick}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden transform max-w-lg w-full z-50 transition-all duration-300 ease-out ${isOpen ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'}`}
            >
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white" id="modal-title">
                        Create a New Repository
                    </h3>
                    <button
                        onClick={handleCloseAndReset}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition duration-150 ease-in-out disabled:opacity-50"
                        aria-label="Close modal"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {/* Repository Name */}
                        <div>
                            <label htmlFor="repo-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Repository name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="repo-name"
                                id="repo-name"
                                required
                                value={repoName}
                                onChange={(e) => setRepoName(e.target.value)}
                                disabled={isSubmitting}
                                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 disabled:opacity-70"
                                placeholder="my-awesome-project"
                            />
                        </div>

                        {/* Description (Optional) */}
                        <div>
                            <label htmlFor="repo-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Description <span className="text-gray-500 dark:text-gray-400">(optional)</span>
                            </label>
                            <textarea
                                id="repo-description"
                                name="repo-description"
                                rows="3"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isSubmitting}
                                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 disabled:opacity-70"
                                placeholder="A short description of your new project"
                            ></textarea>
                        </div>

                        {/* Visibility */}
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-gray-900 dark:text-gray-200">Visibility</legend>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0">
                                {/* Public */}
                                <div className="flex items-start">
                                    <input id="visibility-public" name="visibility" type="radio" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} disabled={isSubmitting} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 mt-0.5 disabled:opacity-70" />
                                    <div className="ml-2">
                                        <label htmlFor="visibility-public" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Public</label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Anyone can see this repository.</p>
                                    </div>
                                </div>
                                {/* Private */}
                                <div className="flex items-start">
                                    <input id="visibility-private" name="visibility" type="radio" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} disabled={isSubmitting} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 mt-0.5 disabled:opacity-70" />
                                    <div className="ml-2">
                                        <label htmlFor="visibility-private" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Private</label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">You choose who can see/commit.</p>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Template Selection */}
                        <div>
                            <label htmlFor="repo-template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Initialize repository from template:
                            </label>
                            <select
                                id="repo-template"
                                name="repo-template"
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                                disabled={isSubmitting}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm bg-white disabled:opacity-70"
                            >
                                <option value="blank">Blank Repository</option>
                                <option value="flask">Flask Template</option>
                                <option value="expo">Expo Template</option>
                                <option value="html_css_js">HTML/CSS/JS Template</option>
                                <option value="nextjs">Next.js Template</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {template === 'blank'
                                    ? 'Creates an empty repository.'
                                    : `Creates a repository prepopulated with files from the ${template} template.`
                                }
                            </p>
                        </div>

                        {/* Progress Message */}
                        {isSubmitting && progressMessage && (
                            <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 rounded">
                                <p className="text-sm flex items-center">
                                    <svg className="animate-spin inline -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {progressMessage}
                                </p>
                            </div>
                        )}

                        {/* Error Message Display */}
                        {error && (
                            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
                                <p className="text-sm font-medium">Error:</p>
                                <p className="text-sm mt-1">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row-reverse sm:space-x-reverse sm:space-x-3 space-y-2 sm:space-y-0">
                        <button
                            type="submit"
                            disabled={isSubmitting || !repoName.trim()}
                            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                'Create Repository'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleCloseAndReset}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewRepoModal;