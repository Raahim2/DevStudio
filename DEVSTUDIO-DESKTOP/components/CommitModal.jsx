// src/app/main/components/CommitModal.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiGitCommit, FiLoader, FiAlertCircle } from 'react-icons/fi';

const CommitModal = ({
    isOpen,
    onClose, // Function to close the modal
    onSubmit, // Function to call with the commit message
    fileName, // To display in the modal for context
    isCommitting, // Pass loading state from parent
    commitError // Pass error state from parent
}) => {
    const [commitMessage, setCommitMessage] = useState('');

    // Reset message when modal opens/closes or filename changes
    useEffect(() => {
        if (isOpen) {
            // Suggest a default message when opening
            setCommitMessage(`Update ${fileName || 'file'}`);
        } else {
            setCommitMessage(''); // Clear on close
        }
    }, [isOpen, fileName]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault(); // Prevent default form submission
        if (!commitMessage.trim() || isCommitting) {
            return; // Don't submit if empty or already committing
        }
        onSubmit(commitMessage.trim());
        // Keep modal open during submission; parent decides when to close
    }, [commitMessage, onSubmit, isCommitting]);

    const handleClose = useCallback(() => {
        if (!isCommitting) { // Prevent closing during commit
            onClose();
        }
    }, [onClose, isCommitting]);

    // Close modal on Escape key press
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, handleClose]);


    if (!isOpen) {
        return null; // Don't render anything if closed
    }

    return (
        // Modal backdrop
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={handleClose} // Close on backdrop click
        >
            {/* Modal content area */}
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 mx-4 relative text-gray-800 dark:text-gray-200"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                    aria-label="Close commit dialog"
                    disabled={isCommitting}
                >
                    <FiX size={20} />
                </button>

                {/* Modal Header */}
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <FiGitCommit className="mr-2 text-blue-500" />
                    Commit Changes
                </h2>

                {/* Context Info */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Enter a message for committing changes to: <span className="font-medium">{fileName || 'the file'}</span>
                </p>

                {/* Commit Message Form */}
                <form onSubmit={handleSubmit}>
                    <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Enter commit message (e.g., Fix login bug)"
                        rows={3}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm disabled:opacity-70"
                        required
                        disabled={isCommitting}
                        autoFocus // Focus the textarea when modal opens
                    />

                    {/* Commit Error Display */}
                    {commitError && !isCommitting && (
                        <div className="mt-3 p-2 text-sm bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded border border-red-300 dark:border-red-600 flex items-center">
                            <FiAlertCircle className="mr-2 flex-shrink-0" size={16} />
                            <span>{commitError}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end items-center mt-5 space-x-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-400 disabled:opacity-50"
                            disabled={isCommitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-wait flex items-center"
                            disabled={!commitMessage.trim() || isCommitting}
                        >
                            {isCommitting ? (
                                <>
                                    <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Committing...
                                </>
                            ) : (
                                'Commit'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CommitModal;