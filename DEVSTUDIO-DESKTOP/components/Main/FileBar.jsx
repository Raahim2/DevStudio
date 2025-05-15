'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    FiFolder, FiFile, FiChevronDown, FiChevronRight, FiPlus, FiFolderPlus, FiTrash2, FiEdit2, FiRefreshCw
} from 'react-icons/fi';

const callElectronApi = async (funcName, ...args) => {
    if (window.electronAPI && typeof window.electronAPI[funcName] === 'function') {
        try {
            return await window.electronAPI[funcName](...args);
        } catch (error) {
            console.error(`Error calling electronAPI.${funcName}:`, error);
            throw error;
        }
    } else {
        const msg = `Electron API function (${funcName}) is not available.`;
        console.error(msg);
        throw new Error(msg);
    }
};

const DirectoryItem = React.memo(({
    item,
    level,
    onFileSelect,
    selectedFolderPath, // Path of the root folder being displayed in FileBar
    onError,
    setRenamingItem,
    setCreatingItem,
    renamingItem,
    creatingItem,
    pathSeparator,
    performRename,
    performCreate,
    performDelete,
    performMove,
    isOperatingParent
}) => {
    const [isOpen, setIsOpen] = useState(level === 0);
    const [inputValue, setInputValue] = useState(item.name); // Used for renaming this item OR creating a new child in it
    const [contextMenu, setContextMenu] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = React.useRef(null);

    const isRenamingThis = renamingItem && renamingItem.path === item.path;

    const isMyDesignatedParentForCreation = creatingItem && creatingItem.parentPath === item.path;
    const showMyInternalCreationInput =
        isMyDesignatedParentForCreation &&
        item.path !== selectedFolderPath && // IMPORTANT: Root creation is handled by FileBar's input
        isOpen &&
        creatingItem.type;


    useEffect(() => {
        let shouldFocus = false;
        if (isRenamingThis) {
            setInputValue(item.name);
            shouldFocus = true;
        } else if (showMyInternalCreationInput && creatingItem?.name === '') {
            setInputValue('');
            shouldFocus = true;
        }

        if (shouldFocus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenamingThis, showMyInternalCreationInput, creatingItem, item.name]);


    const toggleOpen = useCallback(() => {
        if (item.type === 'directory') {
            setIsOpen(prev => !prev);
        }
    }, [item.type]);

    const handleSelect = useCallback(() => {
        if (isRenamingThis || showMyInternalCreationInput) return;
        if (item.type === 'file') {
            onFileSelect(item);
        } else if (item.type === 'directory') {
            toggleOpen();
        }
    }, [item, onFileSelect, toggleOpen, isRenamingThis, showMyInternalCreationInput]);

    const handleRightClick = useCallback((event) => {
        if (isRenamingThis || showMyInternalCreationInput) return;
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY, itemPath: item.path, itemType: item.type });
    }, [item.path, item.type, isRenamingThis, showMyInternalCreationInput]);

    const handleInputChange = (e) => setInputValue(e.target.value);

    const handleRenameSubmit = useCallback(async () => {
        if (inputValue.trim() && inputValue.trim() !== item.name) {
            await performRename(item.path, inputValue.trim());
        }
        setRenamingItem(null);
    }, [item.name, item.path, inputValue, performRename, setRenamingItem]);

    const handleInternalCreateSubmit = useCallback(async () => {
        if (inputValue.trim() && creatingItem?.type) {
            await performCreate(item.path, inputValue.trim(), creatingItem.type);
        }
        // performCreate in FileBar calls setCreatingItem(null)
        setInputValue('');
    }, [item.path, inputValue, creatingItem, performCreate]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (isRenamingThis) handleRenameSubmit();
            else if (showMyInternalCreationInput) handleInternalCreateSubmit();
        } else if (e.key === 'Escape') {
            if (isRenamingThis) setRenamingItem(null);
            if (showMyInternalCreationInput) {
                setCreatingItem(null);
                setInputValue('');
            }
        }
    };

    const handleDelete = useCallback(async () => {
        if (window.confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) {
            await performDelete(item.path);
        }
    }, [item.name, item.path, performDelete]);

    const closeContextMenu = () => setContextMenu(null);
    useEffect(() => {
        window.addEventListener('click', closeContextMenu);
        return () => window.removeEventListener('click', closeContextMenu);
    }, []);


    const handleDragStart = useCallback((event) => {
        if (isRenamingThis || showMyInternalCreationInput || isOperatingParent) {
            event.preventDefault(); return;
        }
        event.dataTransfer.setData('application/json', JSON.stringify({ path: item.path, name: item.name, type: item.type }));
        event.dataTransfer.effectAllowed = 'move';
        closeContextMenu();
    }, [item, isRenamingThis, showMyInternalCreationInput, isOperatingParent]);

    const handleDragOver = useCallback((event) => {
        if (item.type === 'directory' && !isOperatingParent) {
            try {
                const draggedItemData = JSON.parse(event.dataTransfer.getData('application/json'));
                if (draggedItemData.path === item.path || item.path.startsWith(draggedItemData.path + pathSeparator)) {
                    event.dataTransfer.dropEffect = 'none';
                    setIsDragOver(false);
                    return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setIsDragOver(true);
            } catch (e) { /* ignore if data not ready */ }
        } else {
            event.dataTransfer.dropEffect = 'none';
        }
    }, [item, pathSeparator, isOperatingParent]);

    const handleDragLeave = useCallback(() => setIsDragOver(false), []);

    const handleDrop = useCallback(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        if (item.type !== 'directory' || isOperatingParent) return;
        try {
            const draggedItemData = JSON.parse(event.dataTransfer.getData('application/json'));
            const sourcePath = draggedItemData.path;
            const sourceName = draggedItemData.name;
            const targetDirPath = item.path;
            if (sourcePath === targetDirPath) return;
            if (targetDirPath.startsWith(sourcePath + pathSeparator)) {
                onError("Cannot move a folder into one of its own subfolders.");
                return;
            }
            const sourceParentPath = await callElectronApi('pathDirname', sourcePath);
            if (sourceParentPath === targetDirPath) {
                return; // Already in the target directory with same name (or logic handled by performMove if different name)
            }
            await performMove(sourcePath, targetDirPath, sourceName);
        } catch (e) {
            onError(e.message || "Failed to move item.");
        }
    }, [item, performMove, onError, pathSeparator, isOperatingParent]);


    const displayName = item.name || 'Unnamed';
    const itemIsDraggable = !isRenamingThis && !showMyInternalCreationInput && !isOperatingParent;

    const itemRowContent = isRenamingThis ? (
        <>
            {item.type === 'file' ? <FiFile size={13} className="mr-1.5 text-blue-500 [.dark_&]:text-white flex-shrink-0" /> : <FiFolder size={13} className="mr-1.5 text-yellow-500 [.dark_&]:text-yellow-400 flex-shrink-0" />}
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                className="flex-grow bg-white [.dark_&]:bg-neutral-800 text-black [.dark_&]:text-white border border-blue-500 rounded px-1 py-1 text-xs outline-none min-w-0"
                onClick={(e) => e.stopPropagation()}
            />
        </>
    ) : (
        <>
            {item.type === 'directory' && (isOpen ? <FiChevronDown size={14} className="mr-1 flex-shrink-0" /> : <FiChevronRight size={14} className="mr-1 flex-shrink-0" />)}
            {item.type === 'file' && <FiFile size={13} className="mr-1.5 text-blue-500 [.dark_&]:text-white flex-shrink-0" />}
            {item.type === 'directory' && !isOpen && <FiFolder size={13} className="mr-1.5 text-yellow-500 [.dark_&]:text-yellow-400 flex-shrink-0" />}
            {item.type === 'directory' && isOpen && <FiFolder size={13} className="mr-1.5 text-yellow-600 [.dark_&]:text-yellow-500 flex-shrink-0" />}
            <span className="truncate flex-grow">{displayName}</span>
        </>
    );

    return (
        <div className="text-sm">
            <div
                className={`flex items-center py-1 px-2 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-800 [.dark_&]:text-white  rounded cursor-pointer select-none group relative ${isDragOver && item.type === 'directory' ? 'bg-blue-100 [.dark_&]:bg-blue-700 ring-1 ring-blue-500' : ''}`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleSelect}
                onContextMenu={handleRightClick}
                title={item.path}
                draggable={itemIsDraggable}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={item.type === 'directory' ? handleDrop : undefined}
                onDragEnd={() => {}}
            >
                {itemRowContent}
            </div>

            {isOpen && item.children && item.children.map(child => (
                <DirectoryItem
                    key={child.path}
                    item={child}
                    level={level + 1}
                    onFileSelect={onFileSelect}
                    selectedFolderPath={selectedFolderPath}
                    onError={onError}
                    setRenamingItem={setRenamingItem}
                    setCreatingItem={setCreatingItem}
                    renamingItem={renamingItem}
                    creatingItem={creatingItem}
                    pathSeparator={pathSeparator}
                    performRename={performRename}
                    performCreate={performCreate}
                    performDelete={performDelete}
                    performMove={performMove}
                    isOperatingParent={isOperatingParent}
                />
            ))}

            {showMyInternalCreationInput && (
                <div className="flex items-center py-1" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
                    {creatingItem.type === 'file' ? <FiFile size={13} className="mr-1.5 text-blue-500 [.dark_&]:text-white flex-shrink-0" /> : <FiFolder size={13} className="mr-1.5 text-yellow-500 [.dark_&]:text-yellow-400 flex-shrink-0" />}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        placeholder={`New ${creatingItem.type}...`}
                        onChange={handleInputChange}
                        onBlur={() => {
                            if (inputValue.trim()) {
                                handleInternalCreateSubmit();
                            } else {
                                setCreatingItem(null);
                                setInputValue('');
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        className="flex-grow bg-white [.dark_&]:bg-neutral-800 text-black [.dark_&]:text-white border border-blue-500 rounded px-1 py-1 text-xs outline-none min-w-0"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {contextMenu && contextMenu.itemPath === item.path && (
                <div
                    className="absolute z-50 bg-white [.dark_&]:bg-neutral-800 border border-neutral-300 [.dark_&]:border-neutral-600 rounded shadow-lg py-1 text-xs"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {item.type === 'directory' && (
                        <>
                            <button onClick={() => { setRenamingItem(null); setCreatingItem({ parentPath: item.path, type: 'file', name: '' }); setIsOpen(true); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800 flex items-center"><FiPlus className="mr-2" /> New File</button>
                            <button onClick={() => { setRenamingItem(null); setCreatingItem({ parentPath: item.path, type: 'directory', name: '' }); setIsOpen(true); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800 flex items-center"><FiFolderPlus className="mr-2" /> New Folder</button>
                        </>
                    )}
                    <button onClick={() => { setCreatingItem(null); setRenamingItem({ path: item.path, name: item.name }); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800 flex items-center"><FiEdit2 className="mr-2" /> Rename</button>
                    <button onClick={() => { handleDelete(); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 hover:bg-red-100 [.dark_&]:hover:bg-red-700/50 text-red-600 [.dark_&]:text-red-400 flex items-center"><FiTrash2 className="mr-2" /> Delete</button>
                </div>
            )}
        </div>
    );
});
DirectoryItem.displayName = 'DirectoryItem';


const FileBar = ({ directoryTree, selectedFolderPath, onRefreshNeeded, onError, onFileSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [renamingItem, setRenamingItem] = useState(null);
    const [creatingItem, setCreatingItem] = useState(null);
    const [isOperating, setIsOperating] = useState(false);
    const [pathSeparator, setPathSeparator] = useState('/');
    const [isRootDragOver, setIsRootDragOver] = useState(false);
    const [topLevelInputValue, setTopLevelInputValue] = useState('');
    const topLevelInputRef = React.useRef(null);


    useEffect(() => {
        const getSep = async () => {
            if (window.electronAPI && window.electronAPI.pathSep) {
                try {
                    const sep = await window.electronAPI.pathSep();
                    setPathSeparator(sep);
                } catch (e) { console.error("Failed to get path separator:", e); }
            }
        };
        getSep();
    }, []);

    const performOperation = useCallback(async (operationFn, successMsg, errorMsgPrefix) => {
        if (isOperating) return;
        setIsOperating(true);
        onError(null);
        let success = false;
        try {
            const result = await operationFn();
            if (result && result.success === false) {
                throw new Error(result.error || 'Operation failed.');
            }
            console.log(successMsg);
            success = true;
        } catch (err) {
            console.error(`${errorMsgPrefix}:`, err);
            onError(err.message || 'An unknown error occurred.');
        } finally {
            setIsOperating(false);
            if (success) {
                onRefreshNeeded();
            }
        }
    }, [isOperating, onError, onRefreshNeeded]);

    const performCreate = useCallback(async (parentDirPath, itemName, type) => {
        if (!itemName.trim()) {
            onError(`Please enter a valid name for the new ${type}.`);
            setCreatingItem(null);
            return;
        }
        const newItemPath = await callElectronApi('pathJoin', parentDirPath, itemName.trim());
        const operationFn = type === 'file'
            ? () => callElectronApi('createFile', newItemPath)
            : () => callElectronApi('createDirectory', newItemPath);

        await performOperation(operationFn, `${type} "${itemName}" created successfully.`, `Failed to create ${type}`);
        setCreatingItem(null);
    }, [performOperation, onError]);


    const performRename = useCallback(async (oldPath, newName) => {
        if (!newName.trim()) {
            onError("New name cannot be empty.");
            setRenamingItem(null);
            return;
        }
        const parentDir = await callElectronApi('pathDirname', oldPath);
        const oldName = await callElectronApi('pathBasename', oldPath);
        if (newName.trim() === oldName) {
            setRenamingItem(null);
            return;
        }
        await performOperation(
            () => callElectronApi('moveItem', oldPath, parentDir, newName.trim()),
            `Renamed to "${newName}" successfully.`, "Failed to rename item"
        );
        setRenamingItem(null);
    }, [performOperation, onError]);


    const performDelete = useCallback(async (itemPath) => {
        await performOperation(
            () => callElectronApi('deleteItem', itemPath),
            `Item "${itemPath}" deleted successfully.`, "Failed to delete item"
        );
    }, [performOperation]);

    const performMove = useCallback(async (sourcePath, targetDirPath, itemName) => {
        await performOperation(
            () => callElectronApi('moveItem', sourcePath, targetDirPath, itemName),
            `Item "${itemName}" moved to "${targetDirPath}" successfully.`, `Failed to move item "${itemName}"`
        );
    }, [performOperation]);


    const handleCreateTopLevel = (type) => {
        if (!selectedFolderPath || isOperating) return;
        setRenamingItem(null);
        setCreatingItem({ parentPath: selectedFolderPath, type, name: '' });
        setTopLevelInputValue('');
    };

    useEffect(() => {
        if (creatingItem && creatingItem.parentPath === selectedFolderPath && creatingItem.name === '' && topLevelInputRef.current) {
            topLevelInputRef.current.focus();
            topLevelInputRef.current.select();
        }
    }, [creatingItem, selectedFolderPath]);


    const filterTree = useCallback((node, term) => {
        if (!node) return null;
        const normalizedTerm = term.toLowerCase();
        const nodeName = node.name || '';
        let matchesTerm = nodeName.toLowerCase().includes(normalizedTerm);
        if (node.type === 'directory') {
            const filteredChildren = node.children
                ?.map(child => filterTree(child, term))
                .filter(Boolean);
            if (matchesTerm || (filteredChildren && filteredChildren.length > 0)) {
                return { ...node, children: filteredChildren || [] };
            }
        } else if (node.type === 'file') {
            if (matchesTerm) {
                return { ...node };
            }
        }
        return null;
    }, []);

    const displayedTree = useMemo(() => {
        if (!directoryTree) return null;
        if (!searchTerm.trim()) return directoryTree;
        return filterTree(directoryTree, searchTerm.trim());
    }, [directoryTree, searchTerm, filterTree]);

    const handleRootDrop = async (event) => {
        event.preventDefault(); event.stopPropagation(); setIsRootDragOver(false); if (isOperating) return;
        try {
            const draggedItemData = JSON.parse(event.dataTransfer.getData('application/json'));
            const sourcePath = draggedItemData.path;
            const sourceName = draggedItemData.name;
            const targetDirPath = selectedFolderPath;
            if (sourcePath === targetDirPath) return;
            if (targetDirPath.startsWith(sourcePath + pathSeparator)) {
                onError("Cannot move a folder into one of its own subfolders.");
                return;
            }
            const sourceParentPath = await callElectronApi('pathDirname', sourcePath);
            if (sourceParentPath === targetDirPath) { return; }
            await performMove(sourcePath, targetDirPath, sourceName);
        } catch (e) { onError(e.message || "Failed to move item to root."); }
    };

    const handleRootDragOver = (event) => {
        if(isOperating) { event.dataTransfer.dropEffect = 'none'; return; }
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        try {
            const draggedItemData = JSON.parse(event.dataTransfer.getData('application/json'));
            if (draggedItemData.path === selectedFolderPath || selectedFolderPath.startsWith(draggedItemData.path + pathSeparator)) {
                 event.dataTransfer.dropEffect = 'none'; setIsRootDragOver(false); return;
            }
            setIsRootDragOver(true);
        } catch (e) { /* ignore if data not ready */ }
    };

    const handleRootDragLeave = () => setIsRootDragOver(false);


    if (!selectedFolderPath) {
        return (
            <aside className="w-64 bg-neutral-50 [.dark_&]:bg-neutral-800 border-r border-neutral-200 [.dark_&]:border-neutral-700 p-4 text-center text-neutral-500 [.dark_&]:text-neutral-400 text-sm">
                No folder selected.
            </aside>
        );
    }
    if (!directoryTree && !displayedTree && selectedFolderPath) {
         return (
             <aside className="w-64 bg-neutral-50 [.dark_&]:bg-neutral-800 border-r border-neutral-200 [.dark_&]:border-neutral-700 p-4 flex flex-col">
                 <div className="mb-3 flex justify-between items-center">
                     <h2 className="text-xs font-semibold uppercase text-neutral-600 [.dark_&]:text-neutral-400">
                         {selectedFolderPath ? selectedFolderPath.split(pathSeparator).pop() : 'Files'}
                     </h2>
                     <button
                         onClick={onRefreshNeeded}
                         className="p-1 text-neutral-500 hover:text-neutral-700 [.dark_&]:text-neutral-400 [.dark_&]:hover:text-white rounded focus:outline-none"
                         title="Refresh file tree"
                         disabled={isOperating}
                     >
                         <FiRefreshCw size={14} className={isOperating ? 'animate-spin' : ''}/>
                     </button>
                 </div>
                 <div className="text-center text-neutral-500 [.dark_&]:text-neutral-400 text-sm flex-1 flex items-center justify-center">
                     Loading tree data...
                 </div>
             </aside>
         );
    }

    const showTopLevelCreationInput = creatingItem && creatingItem.parentPath === selectedFolderPath && creatingItem.type;

    return (
        <aside className="w-64 bg-neutral-50 [.dark_&]:bg-neutral-800 border-r border-neutral-200 [.dark_&]:border-neutral-700 flex flex-col overflow-hidden">
            <div className="p-2 border-b border-neutral-200 [.dark_&]:border-neutral-700">
                <div className="flex justify-between items-center mb-1.5">
                     <h2 className="text-xs font-semibold uppercase text-neutral-600 [.dark_&]:text-neutral-400 truncate flex-1 pr-2" title={selectedFolderPath}>
                         {directoryTree?.name || selectedFolderPath.split(pathSeparator).pop() || 'Files'}
                     </h2>
                    <div className="flex items-center space-x-1">
                        <button onClick={() => handleCreateTopLevel('file')} title="New File in Root" className="p-1 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-800 [.dark_&]:text-neutral-200 rounded" disabled={isOperating || !!renamingItem || !!creatingItem}><FiPlus size={14} /></button>
                        <button onClick={() => handleCreateTopLevel('directory')} title="New Folder in Root" className="p-1 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-800 [.dark_&]:text-neutral-200 rounded" disabled={isOperating || !!renamingItem || !!creatingItem}><FiFolderPlus size={14} /></button>
                        <button onClick={onRefreshNeeded} title="Refresh Tree" className="p-1 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-800 [.dark_&]:text-neutral-200 rounded" disabled={isOperating}><FiRefreshCw size={14} className={isOperating ? 'animate-spin' : ''} /></button>
                    </div>
                </div>
                <input
                    type="text" placeholder="Search files..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="[.dark_&]:text-neutral-200 w-full px-2 py-1 text-xs bg-white [.dark_&]:bg-neutral-800 border border-neutral-300 [.dark_&]:border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isOperating || !!renamingItem || !!creatingItem}
                />
            </div>

            <div
                className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 [.dark_&]:scrollbar-thumb-neutral-600 scrollbar-track-transparent p-1 ${isRootDragOver ? 'bg-blue-100 [.dark_&]:bg-blue-900/30 ring-1 ring-inset ring-blue-500' : ''}`}
                onDrop={handleRootDrop} onDragOver={handleRootDragOver} onDragLeave={handleRootDragLeave}
            >
                {showTopLevelCreationInput && (
                     <div className="flex items-center py-1 px-2" style={{ paddingLeft: `8px` }}>
                         {creatingItem.type === 'file' ? <FiFile size={13} className="mr-1.5 text-blue-500 [.dark_&]:text-white flex-shrink-0" /> : <FiFolder size={13} className="mr-1.5 text-yellow-500 [.dark_&]:text-yellow-400 flex-shrink-0" />}
                         <input
                             ref={topLevelInputRef}
                             type="text"
                             value={topLevelInputValue}
                             placeholder={`New ${creatingItem.type}...`}
                             onChange={(e) => setTopLevelInputValue(e.target.value)}
                             onBlur={async () => {
                                 const val = topLevelInputValue.trim();
                                 if (val) {
                                    await performCreate(selectedFolderPath, val, creatingItem.type);
                                 } else {
                                     setCreatingItem(null);
                                 }
                                 setTopLevelInputValue('');
                             }}
                             onKeyDown={async (e) => {
                                 if (e.key === 'Enter') {
                                     const val = topLevelInputValue.trim();
                                     if (val) {
                                        await performCreate(selectedFolderPath, val, creatingItem.type);
                                     } else {
                                         setCreatingItem(null);
                                     }
                                     setTopLevelInputValue('');
                                 } else if (e.key === 'Escape') {
                                     setCreatingItem(null);
                                     setTopLevelInputValue('');
                                 }
                             }}
                             className="flex-grow bg-white [.dark_&]:bg-neutral-800 text-black [.dark_&]:text-white border border-blue-500 rounded px-1 py-0 text-xs outline-none min-w-0"
                             onClick={(e) => e.stopPropagation()}
                         />
                     </div>
                )}

                {displayedTree && !showTopLevelCreationInput ? (
                    <DirectoryItem
                        item={displayedTree}
                        level={0}
                        onFileSelect={onFileSelect}
                        selectedFolderPath={selectedFolderPath}
                        onError={onError}
                        setRenamingItem={setRenamingItem}
                        setCreatingItem={setCreatingItem}
                        renamingItem={renamingItem}
                        creatingItem={creatingItem}
                        pathSeparator={pathSeparator}
                        performRename={performRename}
                        performCreate={performCreate}
                        performDelete={performDelete}
                        performMove={performMove}
                        isOperatingParent={isOperating}
                    />
                ) : searchTerm && !displayedTree && !showTopLevelCreationInput ? (
                    <div className="p-4 text-center text-xs text-neutral-500 [.dark_&]:text-neutral-400">No files match "{searchTerm}".</div>
                ) : !displayedTree && !showTopLevelCreationInput ? (
                     <div className="p-4 text-center text-xs text-neutral-500 [.dark_&]:text-neutral-400">Project files will appear here.</div>
                ) : null }
            </div>
            {isOperating && (
                <div className="p-2 text-xs text-center text-blue-600 [.dark_&]:text-white border-t border-neutral-200 [.dark_&]:border-neutral-700">
                    Processing...
                </div>
            )}
        </aside>
    );
};

export default React.memo(FileBar);