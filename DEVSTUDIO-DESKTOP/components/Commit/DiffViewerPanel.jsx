import React from 'react';
import DiffViewer from 'react-diff-viewer-continued';
import { FiGitBranch, FiAlertCircle } from 'react-icons/fi'; // Corrected import

const DiffViewerPanel = ({
    selectedFileForDiff, // { path, isStaged } | null
    diffContent, // { oldCode, newCode }
    hasChanges, // boolean: Are there any files listed in staged/unstaged?
    isRepo, // boolean
    isDark
}) => {
    const hasDiff = diffContent.oldCode || diffContent.newCode;
    const isLoadingError = diffContent.oldCode?.startsWith('Error loading diff:');

    return (
        <div className="flex-1 overflow-auto p-1 bg-white [.dark_&]:bg-neutral-900" style={{fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '12px', lineHeight: '1.5'}}>
             {selectedFileForDiff ? (
                 isLoadingError ? (
                      <div className="h-full flex items-center justify-center text-red-500 [.dark_&]:text-red-400 p-4 text-sm">
                         <FiAlertCircle className="mr-2"/> {diffContent.oldCode}
                     </div>
                 ) : hasDiff ? (
                     <DiffViewer
                        oldValue={diffContent.oldCode}
                        newValue={diffContent.newCode}
                        splitView={false}
                        hideLineNumbers={false}
                        showDiffOnly={false}
                        useDarkTheme={isDark}
                        key={selectedFileForDiff.path + '-' + selectedFileForDiff.isStaged}
                    />
                 ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 [.dark_&]:text-neutral-500 p-4 text-sm">
                         <FiAlertCircle className="mr-2"/> No differences to display for this file state.
                     </div>
                 )
             ) : (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500 [.dark_&]:text-neutral-400 p-4">
                    <FiGitBranch size={32} className="mb-2 text-gray-400 [.dark_&]:text-neutral-500"/>
                    <span className="text-sm text-center">
                        {hasChanges ? 'Select a file to view changes' : (isRepo ? 'No changes in the working directory.' : 'Initialize or open a repository.')}
                    </span>
                </div>
             )}
        </div>
    );
};

export default DiffViewerPanel;