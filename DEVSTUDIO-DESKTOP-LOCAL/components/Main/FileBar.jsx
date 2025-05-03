import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    FiFolder, FiFile, FiChevronRight, FiChevronDown, FiPlusSquare, FiFilePlus, FiX, FiTrash2
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
        console.error(`electronAPI.${funcName} is not available.`);
        throw new Error(`File system operation (${funcName}) is not available.`);
    }
};

const DirectoryItem = ({
    item,
    level = 0,
    onRefreshNeeded,
    onSelectItem,
    onFileSelect,
    selectedItemPath,
    onShowContextMenu,
    onDragStartItem,
    onDragOverItem,
    onDragLeaveItem,
    onDropItem,
    dragOverPath,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const itemRef = useRef(null);

    const isDirectory = item.type === 'directory';
    const isSelected = item.path === selectedItemPath;
    const isDragOverTarget = item.path === dragOverPath && isDirectory && item.path !== onDragStartItem?.currentDraggedPath;

    const handleToggle = (e) => {
        e.stopPropagation();
        if (isDirectory) {
            setIsOpen(!isOpen);
        }
        onSelectItem(item.path, isDirectory);
    };

    const handleClick = (e) => {
        e.stopPropagation();
        onSelectItem(item.path, isDirectory);
        if (!isDirectory) {
            onFileSelect({ path: item.path, name: item.name });
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onShowContextMenu(e.pageX, e.pageY, item);
        onSelectItem(item.path, isDirectory);
    };

    const handleDragStart = (e) => {
        e.stopPropagation();
        onDragStartItem(e, item.path);
    };

    const handleDragOver = (e) => {
        if (isDirectory) {
            e.preventDefault();
            e.stopPropagation();
            onDragOverItem(e, item.path);
        }
    };

    const handleDragLeave = (e) => {
        e.stopPropagation();
        onDragLeaveItem(e, item.path);
    };

    const handleDrop = (e) => {
        if (isDirectory) {
            e.preventDefault();
            e.stopPropagation();
            onDropItem(e, item.path);
        }
    };

    const itemClasses = `
      group flex items-center px-2 py-1 rounded cursor-pointer text-sm transition-colors duration-100 ease-in-out
      ${level > 0 ? `ml-${level * 4}` : ''}
      ${isSelected ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
      ${isDragOverTarget ? 'outline outline-2 outline-offset-[-1px] outline-blue-500 bg-blue-50 dark:bg-blue-900/50' : ''}
    `;

    return (
        <div ref={itemRef}>
            <div
                className={itemClasses}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                draggable="true"
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                title={item.path}
            >
                {isDirectory && (
                    <button
                        onClick={handleToggle}
                        className="mr-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${item.name} folder` : `Expand ${item.name} folder`}
                    >
                        {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    </button>
                )}
                {isDirectory ? (
                    <FiFolder role="img" aria-label="Folder" size={16} className={`mr-2 flex-shrink-0 ${isOpen ? 'text-blue-500 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-500'}`} />
                ) : (
                    <FiFile role="img" aria-label="File" size={16} className={`mr-2 flex-shrink-0 text-gray-500 dark:text-gray-400 ${isDirectory ? '' : 'ml-[22px]'}`} />
                )}
                <span className="truncate flex-grow">
                    {item.name}
                </span>
            </div>

            {isDirectory && isOpen && item.children && (
                <div className={`border-l border-gray-200 dark:border-gray-600 ${level > 0 ? 'ml-[18px]' : 'ml-[10px]'} pl-2`}>
                    {item.children.length > 0 ? (
                        item.children.map((child) => (
                            <DirectoryItem
                                key={child.path}
                                item={child}
                                level={level + 1}
                                onRefreshNeeded={onRefreshNeeded}
                                onSelectItem={onSelectItem}
                                onFileSelect={onFileSelect}
                                selectedItemPath={selectedItemPath}
                                onShowContextMenu={onShowContextMenu}
                                onDragStartItem={onDragStartItem}
                                onDragOverItem={onDragOverItem}
                                onDragLeaveItem={onDragLeaveItem}
                                onDropItem={onDropItem}
                                dragOverPath={dragOverPath}
                            />
                        ))
                    ) : (
                        <div className={`text-xs text-gray-400 dark:text-gray-500 italic px-2 py-0.5 ml-${(level + 1) * 4}`}>
                            (empty)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ContextMenu = ({ x, y, item, onClose, onDelete }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        onDelete(item);
        onClose();
    };

    if (!item) return null;

    return (
        <div
            ref={menuRef}
            className="absolute z-50 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 text-sm py-1"
            style={{ top: `${y}px`, left: `${x}px` }}
            role="menu"
        >
            <button
                onClick={handleDeleteClick}
                className="w-full flex items-center px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-100 ease-in-out"
                role="menuitem"
            >
                <FiTrash2 className="mr-2" size={16}/>
                Delete
            </button>
        </div>
    );
};

const FileBar = ({
    directoryTree,
    selectedFolderPath,
    onRefreshNeeded,
    onError,
    onFileSelect
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [creationType, setCreationType] = useState(null);
    const [newItemName, setNewItemName] = useState('');
    const [inputError, setInputError] = useState(null);
    const inputRef = useRef(null);

    const [selectedItemPath, setSelectedItemPath] = useState(null);
    const [selectedItemIsDir, setSelectedItemIsDir] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });
    const [draggedPath, setDraggedPath] = useState(null);
    const [dragOverPath, setDragOverPath] = useState(null);
    const currentDraggedPath = useRef(null);

    useEffect(() => {
        if (isCreating && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isCreating]);

    useEffect(() => {
        setSelectedItemPath(null);
        setSelectedItemIsDir(false);
        setIsCreating(false);
        setContextMenu((prev) => ({ ...prev, visible: false }));
    }, [selectedFolderPath]);

    const getTargetDirectoryForCreation = useCallback(async () => {
        if (!selectedFolderPath) return null;
        let targetDir = selectedFolderPath;
        if (selectedItemPath) {
            if (selectedItemIsDir) {
                targetDir = selectedItemPath;
            } else {
                const dirname = await callElectronApi('pathDirname', selectedItemPath);
                if (dirname) targetDir = dirname;
            }
        }
        return targetDir;
    }, [selectedFolderPath, selectedItemPath, selectedItemIsDir]);

    const handleSelectItem = useCallback((path, isDir) => {
        setSelectedItemPath(path);
        setSelectedItemIsDir(isDir);
        if (contextMenu.visible) {
            setContextMenu((prev) => ({ ...prev, visible: false }));
        }
    }, [contextMenu.visible]);

    const startCreateItem = async (type) => {
        if (!selectedFolderPath) {
            onError("Cannot create item: No project folder selected.");
            return;
        }
        const targetDir = await getTargetDirectoryForCreation();
        if (!targetDir) {
             onError("Could not determine target directory for creation.");
             return;
        }
        setCreationType(type);
        setNewItemName('');
        setInputError(null);
        setIsCreating(true);
    };

    const cancelCreateItem = useCallback(() => {
        setIsCreating(false);
        setCreationType(null);
        setNewItemName('');
        setInputError(null);
    }, []);

    const confirmCreateItem = async () => {
        if (!isCreating || !newItemName || !creationType) return;
        const trimmedName = newItemName.trim();
        if (trimmedName === '') { setInputError('Name cannot be empty.'); return; }
        if (/[\\/:*?"<>|]/.test(trimmedName)) { setInputError('Name contains invalid characters.'); return; }
        setInputError(null);

        const targetDir = await getTargetDirectoryForCreation();
        if (!targetDir) {
            onError("Could not determine target directory for creation.");
            cancelCreateItem();
            return;
        }

        let fullPath;
        try {
            fullPath = await callElectronApi('pathJoin', targetDir, trimmedName);
        } catch (error) {
             onError(error.message || "Could not construct item path.");
             cancelCreateItem();
             return;
        }

        console.log(`Attempting to create ${creationType} at: ${fullPath}`);
        try {
            const apiFunction = creationType === 'file' ? 'createFile' : 'createDirectory';
            const result = await callElectronApi(apiFunction, fullPath);
            if (result && result.success) {
                console.log(`${creationType} created successfully.`);
                cancelCreateItem();
                onRefreshNeeded();
            } else {
                console.error(`Failed to create ${creationType}:`, result?.error);
                onError(result?.error || `Failed to create ${creationType}.`);
                if (inputRef.current) inputRef.current.focus();
            }
        } catch (err) {
            console.error(`Error during ${creationType} creation IPC:`, err);
            onError(err.message || `An unexpected error occurred during creation.`);
            cancelCreateItem();
        }
    };

    const handleInputChange = (event) => {
        setNewItemName(event.target.value);
        if (inputError) setInputError(null);
    };

    const handleInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmCreateItem();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelCreateItem();
        }
    };

    const handleShowContextMenu = useCallback((x, y, item) => {
        setContextMenu({ visible: true, x, y, item });
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setTimeout(() => setContextMenu({ visible: false, x: 0, y: 0, item: null }), 150);
    }, []);

    const handleDeleteItem = useCallback(async (itemToDelete) => {
        if (!itemToDelete || !itemToDelete.path) return;

        const userConfirmed = window.confirm(`Are you sure you want to delete "${itemToDelete.name}"? This action cannot be undone.`);
        if (!userConfirmed) {
            handleCloseContextMenu();
            return;
        }

        console.log(`Requesting delete for: ${itemToDelete.path}`);
        try {
            const result = await callElectronApi('deleteItem', itemToDelete.path);
            if (result && result.success) {
                console.log("Item deleted successfully.");
                onRefreshNeeded();
                if (selectedItemPath === itemToDelete.path) {
                    setSelectedItemPath(null);
                    setSelectedItemIsDir(false);
                }
            } else {
                console.error("Failed to delete item:", result?.error);
                onError(result?.error || "Failed to delete item.");
            }
        } catch (err) {
            console.error("Error calling deleteItem IPC:", err);
            onError(err.message || `Error deleting item.`);
        }
        handleCloseContextMenu();
    }, [onRefreshNeeded, onError, selectedItemPath, handleCloseContextMenu]);

    const handleDragStartItem = useCallback((event, path) => {
        event.dataTransfer.setData('text/plain', path);
        event.dataTransfer.effectAllowed = 'move';
        setDraggedPath(path);
        currentDraggedPath.current = path;
        console.log('Drag Start:', path);
    }, []);

    const handleDragOverItem = useCallback((event, path) => {
        if (path !== currentDraggedPath.current) {
             setDragOverPath(path);
        }
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDragLeaveItem = useCallback((event, path) => {
        if (dragOverPath === path) {
           setDragOverPath(null);
        }
    }, [dragOverPath]);

    const handleDropItem = useCallback(async (event, targetFolderPath) => {
        const sourcePath = event.dataTransfer.getData('text/plain');
        const cleanupDragState = () => {
            setDragOverPath(null);
            setDraggedPath(null);
            currentDraggedPath.current = null;
        };

        if (!sourcePath || sourcePath === targetFolderPath) {
             console.log("Drop cancelled: No source path or dropping onto self.");
             cleanupDragState();
             return;
        }

        let isDroppingIntoSelfOrChild = false;
        try {
            const sep = await callElectronApi('pathJoin', 'a', 'b').then(p => p.includes('/') ? '/' : '\\');
            if (targetFolderPath.startsWith(sourcePath + sep)) {
                 isDroppingIntoSelfOrChild = true;
            }
        } catch (e) { /* Ignore */ }

        if (isDroppingIntoSelfOrChild) {
            onError("Cannot move a folder into itself or one of its subfolders.");
            cleanupDragState();
            return;
        }

        console.log(`Requesting move: ${sourcePath} -> ${targetFolderPath}`);
        try {
            const result = await callElectronApi('moveItem', sourcePath, targetFolderPath);
            if (result && result.success) {
                console.log("Item moved successfully.");
                onRefreshNeeded();
                 if (selectedItemPath === sourcePath) {
                    try {
                       const newItemName = await callElectronApi('pathBasename', sourcePath);
                       const newPath = await callElectronApi('pathJoin', targetFolderPath, newItemName);
                       setSelectedItemPath(newPath);
                    } catch(pathError) {
                       console.error("Error updating selection path after move:", pathError);
                       setSelectedItemPath(null);
                       setSelectedItemIsDir(false);
                    }
                 }
            } else {
                console.error("Failed to move item:", result?.error);
                onError(result?.error || "Failed to move item.");
            }
        } catch (err) {
            console.error("Error calling moveItem IPC:", err);
            onError(err.message || `Error moving item.`);
        } finally {
             cleanupDragState();
        }
    }, [onRefreshNeeded, onError, selectedItemPath]);

    return (
        <div
           className="w-64 h-full bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden p-2 flex flex-col shrink-0 relative"
           onDragLeave={(e) => { if(e.target === e.currentTarget) { setDragOverPath(null); console.log("Drag left sidebar container");} }}
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { if(e.target === e.currentTarget) { setDragOverPath(null); setDraggedPath(null); currentDraggedPath.current = null; console.log("Dropped on sidebar background");} }}
        >
            <div className="flex justify-between items-center px-2 mb-2 mt-1 flex-shrink-0">
                <h2 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 select-none">
                    Project Explorer
                </h2>
                {selectedFolderPath && !isCreating && (
                    <div className="flex items-center space-x-1">
                        <button
                           onClick={() => startCreateItem('file')}
                           title="Create New File (in selected or root)"
                           className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                           aria-label="Create New File"
                        >
                            <FiFilePlus size={16} />
                        </button>
                        <button
                           onClick={() => startCreateItem('folder')}
                           title="Create New Folder (in selected or root)"
                           className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                           aria-label="Create New Folder"
                        >
                            <FiPlusSquare size={16} />
                        </button>
                    </div>
                )}
            </div>

            {isCreating && selectedFolderPath && (
                <div className="px-2 py-1 mb-2 flex-shrink-0 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-900 shadow-sm ring-1 ring-blue-500 ring-opacity-50">
                    <div className="flex items-center space-x-2">
                        {creationType === 'file'
                           ? <FiFile size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                           : <FiFolder size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        }
                        <input
                            ref={inputRef}
                            type="text"
                            value={newItemName}
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            placeholder={`Enter ${creationType} name...`}
                            className={`flex-grow px-1 py-0.5 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500`}
                            aria-label={`New ${creationType} name`}
                            aria-invalid={!!inputError}
                            aria-describedby={inputError ? "creation-error" : undefined}
                        />
                        <button
                            onClick={cancelCreateItem}
                            title="Cancel Creation"
                            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 transition-colors"
                            aria-label="Cancel Creation"
                        >
                           <FiX size={18}/>
                        </button>
                    </div>
                    {inputError && (
                       <p id="creation-error" className="text-xs text-red-600 dark:text-red-400 mt-1 ml-7" role="alert">
                          {inputError}
                       </p>
                    )}
                </div>
            )}

            <div className="flex-grow overflow-y-auto sidebar-tree-scroll">
                {directoryTree && directoryTree.children ? (
                    directoryTree.children.length > 0 ? (
                        directoryTree.children.map((item) => (
                            <DirectoryItem
                                key={item.path}
                                item={item}
                                level={0}
                                onRefreshNeeded={onRefreshNeeded}
                                onSelectItem={handleSelectItem}
                                onFileSelect={onFileSelect}
                                selectedItemPath={selectedItemPath}
                                onShowContextMenu={handleShowContextMenu}
                                onDragStartItem={handleDragStartItem}
                                onDragOverItem={handleDragOverItem}
                                onDragLeaveItem={handleDragLeaveItem}
                                onDropItem={handleDropItem}
                                dragOverPath={dragOverPath}
                            />
                        ))
                    ) : (
                         !isCreating && (
                            <div className="text-sm text-gray-400 dark:text-gray-500 px-2 py-1 italic select-none">
                               Project folder is empty.
                            </div>
                         )
                    )
                ) : (
                     !isCreating && (
                        <div className="text-sm text-gray-400 dark:text-gray-500 px-2 py-1 italic select-none">
                           No folder selected or structure loading...
                        </div>
                     )
                )}
            </div>

            {contextMenu.visible && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onClose={handleCloseContextMenu}
                    onDelete={handleDeleteItem}
                />
            )}
        </div>
    );
};

export default FileBar;