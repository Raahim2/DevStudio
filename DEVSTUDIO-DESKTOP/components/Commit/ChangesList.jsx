import React from 'react';
import { FiPlusSquare, FiXSquare } from 'react-icons/fi';

// Moved getFileStatusSymbol logic here as it's only used here
const getFileStatusSymbol = (file) => {
    if (!file || typeof file.index !== 'string' || typeof file.working_dir !== 'string') {
         return <span title="Unknown Status" className="text-gray-500 font-bold">?</span>;
    }
    const wdStatus = file.working_dir.trim(); const idxStatus = file.index.trim();
    if (idxStatus === 'A') return <span title="Added (Staged)" className="text-green-500 font-bold">A</span>;
    if (idxStatus === 'M') return <span title="Modified (Staged)" className="text-blue-500 font-bold">M</span>;
    if (idxStatus === 'D') return <span title="Deleted (Staged)" className="text-red-500 font-bold">D</span>;
    if (idxStatus === 'R') return <span title="Renamed (Staged)" className="text-purple-500 font-bold">R</span>;
    if (idxStatus === 'C') return <span title="Copied (Staged)" className="text-purple-500 font-bold">C</span>;
    if (idxStatus === 'U' || wdStatus === 'U') return <span title="Unmerged" className="text-orange-500 font-bold">U</span>;
    if (wdStatus === '?') return <span title="Untracked" className="text-yellow-500 font-bold">U</span>;
    if (wdStatus === 'M') return <span title="Modified" className="text-blue-500 font-bold">M</span>;
    if (wdStatus === 'D') return <span title="Deleted" className="text-red-500 font-bold">D</span>;
    if (wdStatus === 'A') return <span title="Added" className="text-green-500 font-bold">A</span>;
    if (wdStatus === '!') return <span title="Ignored" className="text-gray-400 font-bold">I</span>;
    return <span title={`Index: ${idxStatus}, WD: ${wdStatus}`} className="text-gray-500 font-bold">{idxStatus || wdStatus || '?'}</span>;
};


const ChangesList = ({
    title,
    files = [],
    isStagedList, // boolean: True for staged, false for unstaged
    selectedFileForDiff, // { path, isStaged } | null
    actionInProgress, // boolean: True if commit/push/pull/fetch active
    onFileSelect, // function(file, isStagedView)
    onFileAction, // function(filePath): Either stage or unstage handler
    onActionAll, // function(): Either stageAll or unstageAll handler
}) => {
    const ActionIcon = isStagedList ? FiXSquare : FiPlusSquare;
    const actionColor = isStagedList ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800';
    const actionTitle = isStagedList ? 'Unstage' : 'Stage';
    const actionAllText = isStagedList ? 'Unstage All' : 'Stage All';

    const handleFileClick = (file) => {
        onFileSelect(file, isStagedList);
    };

    const handleFileActionClick = (e, filePath) => {
        e.stopPropagation(); // Prevent row selection when clicking button
        onFileAction(filePath);
    };

    return (
        <div className={`p-2 ${isStagedList ? 'border-b border-gray-200' : 'flex-1'}`}>
            <div className="flex justify-between items-center mb-1 sticky top-0 bg-white z-10 py-1">
                <h3 className="font-semibold text-xs text-gray-700 uppercase tracking-wider">
                    {title} ({files.length})
                </h3>
                {files.length > 0 && (
                    <button
                        onClick={onActionAll}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        disabled={actionInProgress}
                    >
                        {actionAllText}
                    </button>
                )}
            </div>
            {files.length === 0 && (
                <p className="text-xs text-gray-500 italic px-1 py-2">
                    {isStagedList ? 'No staged changes.' : 'No unstaged changes.'}
                </p>
            )}
            <ul className="text-xs">
                {files.map(file => {
                    const isSelected = selectedFileForDiff?.path === file.path && selectedFileForDiff?.isStaged === isStagedList;
                    return (
                        <li
                            key={`${isStagedList ? 'staged' : 'unstaged'}-${file.path}`}
                            onClick={() => handleFileClick(file)}
                            title={file.path}
                            className={`p-1.5 rounded flex items-center justify-between cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-100 hover:bg-blue-100' : ''}`}
                        >
                            <span className="flex items-center flex-grow min-w-0"> {/* Allow truncation */}
                                <button
                                    onClick={(e) => handleFileActionClick(e, file.path)}
                                    className={`mr-2 p-0.5 ${actionColor} leading-none flex-shrink-0 disabled:opacity-50`}
                                    title={`${actionTitle} ${file.path}`}
                                    disabled={actionInProgress}
                                 >
                                    <ActionIcon size={14}/>
                                 </button>
                                {getFileStatusSymbol(file)}
                                <span className="ml-1.5 truncate flex-grow">{file.path}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ChangesList;