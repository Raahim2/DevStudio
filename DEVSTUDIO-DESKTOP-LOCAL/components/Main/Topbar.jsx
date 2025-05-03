import React from 'react';
import {
    FiFolder, // Changed icon
    FiChevronDown,
    FiUploadCloud,
    FiCpu,
    FiBox,
    FiPlus,
    FiGithub,
    FiLogOut,
    FiLogIn
} from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';

// Props: onFolderSelect (function), selectedFolderPath (string or null)
const Topbar = ({ onFolderSelect, selectedFolderPath }) => {

  const handleSelectFolderClick = () => {
    if (onFolderSelect) {
      onFolderSelect(); // Call the function passed from the parent
    }
  };

  // Function to display a shortened path
  const getDisplayPath = (fullPath) => {
    if (!fullPath) return 'Select Project Folder';
    // Example: Show only the last part of the path (folder name)
    const parts = fullPath.split(/[\\/]/); // Split by slash or backslash
    return parts[parts.length - 1] || fullPath; // Return last part or full path if split fails
    // Or implement more sophisticated truncation if needed
  };

  return (
    <div className="relative [.dark_&]:bg-gray-800 [.dark_&]:text-white h-14 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shrink-0">
      {/* Left Section */}
      <div className="flex items-center space-x-2">
        {/* Folder Selection Button */}
        <button
          onClick={handleSelectFolderClick}
          className="flex items-center space-x-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 text-sm font-medium transition-colors duration-150"
          title={selectedFolderPath ? `Selected: ${selectedFolderPath}` : 'Select Project Folder'}
        >
          <FiFolder size={18} className="flex-shrink-0" />
          <span className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-[250px]">
            {getDisplayPath(selectedFolderPath)}
          </span>
          {/* Optional: Keep chevron if you plan other dropdowns later */}
          {/* <FiChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200`} /> */}
        </button>

        {/* You can add other buttons here if needed */}
      </div>

      {/* Middle Section */}
      <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
        <span className="font-semibold text-gray-900 dark:text-gray-200 [.dark_&]:text-white">DevStudio</span>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-1 md:space-x-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Add other right-side elements if needed, e.g., settings button */}
      </div>
    </div>
  );
};

export default Topbar;