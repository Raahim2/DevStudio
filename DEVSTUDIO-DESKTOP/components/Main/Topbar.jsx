import React from 'react';
import {
    FiFolder,
} from 'react-icons/fi';
import ThemeToggle from './ThemeToggle'; // Assuming this component handles its own styling or fits well

// Props: onFolderSelect (function), selectedFolderPath (string or null)
const Topbar = ({ onFolderSelect, selectedFolderPath }) => {

  const handleSelectFolderClick = () => {
    if (onFolderSelect) {
      onFolderSelect();
    }
  };

  const getDisplayPath = (fullPath) => {
    if (!fullPath) return 'Select Project Folder';
    const parts = fullPath.split(/[\\/]/);
    return parts[parts.length - 1] || fullPath;
  };



  return (
    <div className="
      relative h-14 flex items-center justify-between px-4 shrink-0
      bg-gray-100 border-b border-gray-200 /* Light mode: off-white bg, light gray border */
      [.dark_&]:bg-neutral-900 [.dark_&]:text-neutral-300 [.dark_&]:border-neutral-700 /* [.dark_&] mode: very [.dark_&] bg, lighter text, subtle border */
    ">
      {/* Left Section */}
      <div className="flex items-center space-x-2">
        {/* Folder Selection Button */}
        <button
          onClick={handleSelectFolderClick}
          className="
            flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150
            bg-blue-100 text-blue-700 hover:bg-blue-200 /* Light mode: blue theme */
            [.dark_&]:bg-neutral-700 [.dark_&]:text-neutral-100 [.dark_&]:hover:bg-neutral-600 /* [.dark_&] mode: muted gray theme */
          "
          title={selectedFolderPath ? `Selected: ${selectedFolderPath}` : 'Select Project Folder'}
        >
          <FiFolder size={18} className="flex-shrink-0" />
          <span className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-[250px]">
            {getDisplayPath(selectedFolderPath)}
          </span>
          {/* Optional: Keep chevron if you plan other dropdowns later */}
          {/* <FiChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200`} /> */}
        </button>
      </div>

      {/* Middle Section - "DevStudio" Title */}
      <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
        <span className="font-semibold text-gray-800 [.dark_&]:text-neutral-100"> {/* Brighter text for title in [.dark_&] mode */}
          DevStudio
        </span>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-1 md:space-x-2">
        <ThemeToggle />
        {/* Add other right-side elements if needed */}
      </div>
    </div>
  );
};

export default Topbar;