import React from 'react';
import { FiCheckSquare, FiRefreshCw } from 'react-icons/fi';

const CommitMessageArea = ({
    commitMessage,
    isCommitting,
    stagedFilesCount,
    currentBranch,
    onCommitMessageChange,
    onCommit,
}) => {
    const canCommit = !isCommitting && commitMessage.trim() && stagedFilesCount > 0;

    return (
        <div className="p-3 border-t border-gray-300 [.dark_&]:border-neutral-700 bg-white [.dark_&]:bg-neutral-800 shadow-inner">
            <textarea
                value={commitMessage}
                onChange={onCommitMessageChange}
                placeholder={`Commit message${stagedFilesCount > 0 ? ' (required)' : ' (stage files first)'}`}
                rows="3"
                className="w-full p-2 border border-gray-300 [.dark_&]:border-neutral-700 rounded mb-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 [.dark_&]:bg-neutral-800 [.dark_&]:text-neutral-200 [.dark_&]:disabled:bg-neutral-900"
                disabled={isCommitting || stagedFilesCount === 0}
            />
            <button
                onClick={onCommit}
                disabled={!canCommit}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 [.dark_&]:disabled:bg-neutral-700 disabled:cursor-not-allowed flex items-center justify-center font-medium text-sm"
            >
                {isCommitting ? <FiRefreshCw className="animate-spin mr-2" /> : <FiCheckSquare className="mr-2"/>}
                Commit {stagedFilesCount > 0 ? `(${stagedFilesCount}) to ${currentBranch || 'branch'}` : ''}
            </button>
            {stagedFilesCount === 0 && !isCommitting && (
                <p className="text-xs text-orange-600 [.dark_&]:text-orange-400 mt-1 text-center">Stage files before committing.</p>
            )}
        </div>
    );
};

export default CommitMessageArea;