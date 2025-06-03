// src/components/Main/TitleBar.js (or your chosen path)
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
    VscCode, 
    VscChromeMinimize, 
    VscChromeMaximize, 
    VscChromeRestore, 
    VscChromeClose 
} from 'react-icons/vsc'; // VS Code icons



const TitleBar = () => {
    const [isMaximized, setIsMaximized] = useState(false);

    const updateMaximizedState = useCallback(async () => {
        if (window.electronWindowControls && typeof window.electronWindowControls.isMaximized === 'function') {
            try {
                const maximized = await window.electronWindowControls.isMaximized();
                setIsMaximized(maximized);
            } catch (error) {
                console.error("Error fetching maximized state:", error);
            }
        } else {
            // console.warn("electronWindowControls.isMaximized not available at mount.");
        }
    }, []);

    useEffect(() => {
        updateMaximizedState(); // Call on initial mount

        let cleanupFunction = () => {}; // Default to a no-op function

        if (window.electronWindowControls && typeof window.electronWindowControls.onMaximizedStatusChanged === 'function') {
            // The onMaximizedStatusChanged in preload should return a function to remove the listener
            cleanupFunction = window.electronWindowControls.onMaximizedStatusChanged(setIsMaximized);
        }

        // This cleanup will be called when the component unmounts
        return () => {
            if (typeof cleanupFunction === 'function') {
                cleanupFunction(); // Call the cleanup function returned by preload
            }
        };
    }, [updateMaximizedState]); // updateMaximizedState is stable due to useCallback

    const handleMinimize = () => {
        window.electronAPI?.minimize();
    };

    const handleToggleMaximize = () => {
        window.electronAPI?.toggleMaximize();
        // The 'maximize'/'unmaximize' events from main process will update `isMaximized` state via onMaximizedStatusChanged
    };

    const handleClose = () => {
        window.electronAPI?.close();
    };

    // Placeholder menu items. In a real app, clicking these would open dropdowns.
    const menuItems = [
        { id: 'file', label: 'File', action: () => console.log('File menu clicked') },
        { id: 'edit', label: 'Edit', action: () => console.log('Edit menu clicked') },
        { id: 'selection', label: 'Selection', action: () => console.log('Selection menu clicked') },
        { id: 'view', label: 'View', action: () => console.log('View menu clicked') },
        { id: 'go', label: 'Go', action: () => console.log('Go menu clicked') },
        { id: 'run', label: 'Run', action: () => console.log('Run menu clicked') },
    ];

    const baseInteractiveElementClasses = "h-full flex items-center justify-center outline-none focus:outline-none transition-colors duration-150 ease-in-out";
    const menuItemHoverClasses = "hover:bg-neutral-300 [.dark_&]:hover:bg-neutral-700/70";
    const windowControlButtonHoverClasses = "hover:bg-neutral-300 [.dark_&]:hover:bg-neutral-600";
    const closeButtonHoverClasses = "hover:bg-red-500 [.dark_&]:hover:bg-red-600 hover:text-white [.dark_&]:hover:text-white";


    return (
        <div
            className="h-8 bg-neutral-100 [.dark_&]:bg-neutral-900 text-neutral-900 [.dark_&]:text-neutral-200 flex items-center justify-between select-none shadow-sm border-b border-neutral-200 [.dark_&]:border-neutral-700"
            style={{ WebkitAppRegion: 'drag' }} // Makes the entire bar draggable
            onDoubleClick={handleToggleMaximize} // Double-click to maximize/restore
        >
            {/* Left Section: App Icon and Menu Items */}
            <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>
                <div className={`${baseInteractiveElementClasses} px-3 ${menuItemHoverClasses}`} >
                    <img
                        src="icon.png"
                        className="w-[20px] h-[20px]"
                    />
                </div>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        className={`${baseInteractiveElementClasses} px-2.5 text-xs ${menuItemHoverClasses} text-neutral-700 [.dark_&]:text-neutral-300`}
                        title={item.label}
                    >
                        {item.label}
                    </button>
                ))}
                {/* "More" button - functionality to be implemented if needed */}
                <button 
                    className={`${baseInteractiveElementClasses} px-2 ${menuItemHoverClasses} text-neutral-700 [.dark_&]:text-neutral-300`} 
                    title="More options"
                    onClick={() => console.log("More options clicked")}
                >
                    {/* <VscEllipsis size={16} /> or <FiMoreHorizontal size={16} /> */}
                     <span className="text-xs leading-none pb-0.5">...</span>
                </button>
            </div>

            {/* Center Section: Project Name (Draggable by default due to parent) */}
            <div 
                className="flex-1 flex items-center justify-center min-w-0 px-4 text-xs h-full"
            >
                
            </div>

            {/* Right Section: Window Controls */}
            <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>
                <button 
                    onClick={handleMinimize} 
                    className={`${baseInteractiveElementClasses} px-3.5 ${windowControlButtonHoverClasses} text-neutral-700 [.dark_&]:text-neutral-200`} 
                    title="Minimize"
                >
                    <VscChromeMinimize size={16} />
                </button>
                <button 
                    onClick={handleToggleMaximize} 
                    className={`${baseInteractiveElementClasses} px-3.5 ${windowControlButtonHoverClasses} text-neutral-700 [.dark_&]:text-neutral-200`} 
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? <VscChromeRestore size={16} /> : <VscChromeMaximize size={16} />}
                </button>
                <button 
                    onClick={handleClose} 
                    className={`${baseInteractiveElementClasses} px-3.5 ${closeButtonHoverClasses} text-neutral-700 [.dark_&]:text-neutral-200`} 
                    title="Close"
                >
                    <VscChromeClose size={16} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;