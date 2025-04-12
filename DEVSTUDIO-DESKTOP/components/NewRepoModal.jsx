// components/NewRepoModal.jsx
import React, { useState } from 'react';

// Accept isOpen, onClose, and accessToken props
function NewRepoModal({ isOpen, onClose, accessToken }) {
  // Form fields state
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [template, setTemplate] = useState('blank'); // We'll use this conceptually for auto_init

  // State for loading and errors during API call
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // --- Helper Functions ---

  // Resets form fields and error state
  const resetForm = () => {
    setRepoName('');
    setDescription('');
    setVisibility('public');
    setTemplate('blank');
    setError(null); // Clear any previous errors
    setIsSubmitting(false); // Ensure submitting state is reset
  };

  // Closes the modal and resets the form
  const handleCloseAndReset = () => {
    resetForm();
    onClose(); // Call the onClose function passed from the parent
  };

  // Handles clicks outside the modal panel
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCloseAndReset();
    }
  };

  // --- Main Submit Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    if (!accessToken) {
      setError('Authentication token is missing. Cannot create repository.');
      return;
    }

    if (!repoName.trim()) {
        setError('Repository name is required.');
        return; // Or rely on the 'required' attribute
    }

    setIsSubmitting(true);

    // Prepare data for GitHub API
    const repoData = {
      name: repoName.trim(),
      description: description.trim(),
      private: visibility === 'private', // GitHub API uses 'private' (boolean)
      auto_init: template !== 'blank', // Initialize with a README if a template (even conceptual) is selected
      // Note: For full template cloning (Flask, React etc.), you'd use a different endpoint:
      // POST /repos/{template_owner}/{template_repo}/generate
      // This requires mapping 'template' state to actual owner/repo names.
      // The 'auto_init' here is a simpler placeholder.
    };

    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          // Use Bearer token - preferred method
          Authorization: `Bearer ${accessToken}`,
          // 'Accept' header is good practice
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repoData),
      });

      // Check if the request was successful
      if (response.ok) {
        const newRepo = await response.json(); // Get data about the created repo
        console.log('Repository created successfully:', newRepo);
        alert(`Repository "${newRepo.full_name}" created successfully!`); // Simple success feedback
        // TODO: Optionally, trigger a refresh of the repo list in the parent component here
        handleCloseAndReset(); // Close modal on success
      } else {
        // Handle errors from GitHub API
        const errorData = await response.json();
        console.error('GitHub API Error:', errorData);
        setError(
          `Failed to create repository: ${
            errorData.message || 'Unknown error'
          }${errorData.errors ? ` (${errorData.errors[0]?.message})` : ''}`
        );
      }
    } catch (networkError) {
      // Handle network errors (fetch failed)
      console.error('Network error:', networkError);
      setError(`Network error: ${networkError.message}`);
    } finally {
      // Always stop the loading indicator
      setIsSubmitting(false);
    }
  };

  // Conditional rendering based on isOpen prop
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-40 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 transition-opacity duration-300 ease-out opacity-100`}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Modal Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden transform max-w-lg w-full z-50 transition-all duration-300 ease-out opacity-100 translate-y-0 sm:scale-100`}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white" id="modal-title">
            Create a New Repository
          </h3>
          <button
            onClick={handleCloseAndReset}
            disabled={isSubmitting} // Disable close button while submitting
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition duration-150 ease-in-out disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body - Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* --- Form fields remain the same as previous version --- */}

            {/* Repository Name */}
            <div>
              <label htmlFor="repo-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Repository name <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="text"
                  name="repo-name"
                  id="repo-name"
                  required
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={isSubmitting} // Disable input while submitting
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 disabled:opacity-70"
                  placeholder="my-awesome-project"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Great repository names are short and memorable.</p>
            </div>

            {/* Description (Optional) */}
            <div>
              <label htmlFor="repo-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description <span className="text-gray-500 dark:text-gray-400">(optional)</span>
              </label>
              <div className="mt-1">
                <textarea
                  id="repo-description"
                  name="repo-description"
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 disabled:opacity-70"
                  placeholder="A short description of your new project"
                ></textarea>
              </div>
            </div>

            {/* Visibility */}
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-gray-900 dark:text-gray-200">Visibility</legend>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0">
                    {/* Public Option */}
                    <div className="flex items-start">
                    <input
                        id="visibility-public"
                        name="visibility"
                        type="radio"
                        value="public"
                        checked={visibility === 'public'}
                        onChange={() => setVisibility('public')}
                        disabled={isSubmitting}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 mt-0.5 disabled:opacity-70"
                    />
                    <div className="ml-2">
                        <label htmlFor="visibility-public" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Public
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Anyone on the internet can see this repository.</p>
                    </div>
                    </div>
                    {/* Private Option */}
                    <div className="flex items-start">
                    <input
                        id="visibility-private"
                        name="visibility"
                        type="radio"
                        value="private"
                        checked={visibility === 'private'}
                        onChange={() => setVisibility('private')}
                        disabled={isSubmitting}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 mt-0.5 disabled:opacity-70"
                    />
                    <div className="ml-2">
                        <label htmlFor="visibility-private" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Private
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">You choose who can see and commit.</p>
                    </div>
                    </div>
                </div>
            </fieldset>

            {/* Template Selection */}
            <div>
              <label htmlFor="repo-template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Initialize this repository with a template:
              </label>
              <select
                id="repo-template"
                name="repo-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm bg-white disabled:opacity-70"
              >
                <option value="blank">Blank (No template)</option>
                <option value="flask">Flask (Adds README)</option> {/* Clarify template effect */}
                <option value="django">Django (Adds README)</option>
                <option value="react">React (Adds README)</option>
                <option value="nextjs">Next.js (Adds README)</option>
                <option value="vue">Vue.js (Adds README)</option>
                <option value="angular">Angular (Adds README)</option>
                <option value="react-native">React Native (Adds README)</option>
                <option value="node-express">Node.js + Express (Adds README)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Choosing a template currently initializes with a README.md.</p>
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row-reverse sm:space-x-reverse sm:space-x-3 space-y-2 sm:space-y-0">
            <button
              type="submit"
              disabled={isSubmitting} // Disable button while submitting
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  {/* Basic spinner */}
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Repository'
              )}
            </button>
            <button
              type="button"
              onClick={handleCloseAndReset}
              disabled={isSubmitting} // Disable cancel button while submitting
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