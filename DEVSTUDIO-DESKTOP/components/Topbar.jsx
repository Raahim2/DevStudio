import React, { useState, useEffect } from 'react';
import {
  FiCpu,
  FiChevronDown,
  FiUploadCloud, // Keep this icon for the button
  FiBox,
  FiPlus,
  FiGithub,
  FiLogOut,
  FiLogIn
} from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';
import NewRepoModal from './NewRepoModal'; // Import the modal

// Receive props from parent: userRepos, selectedRepo, setSelectedRepo, userInfo
const Topbar = ({
    userRepos,
    selectedRepo,
    setSelectedRepo,
    userInfo,
    accessToken
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // --- Add state for the modal ---
  const [isNewRepoModalOpen, setIsNewRepoModalOpen] = useState(false);
  // ---

  useEffect(() => {
    const token = localStorage.getItem('github_access_token');
    setIsSignedIn(!!token);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close repo dropdown if clicking inside the modal
      if (showDropdown && event.target && typeof event.target.closest === 'function' && !event.target.closest('.repo-dropdown-container') && !event.target.closest('.new-repo-modal-container')) { // Check modal too
        setShowDropdown(false);
      }
      if (showUserDropdown && event.target && typeof event.target.closest === 'function' && !event.target.closest('.user-dropdown-container')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, showUserDropdown]); // Note: Modal open state doesn't need to be dependency here

  const handleSignOut = () => {
    localStorage.removeItem('github_access_token');
    setIsSignedIn(false);
    setShowUserDropdown(false);
    window.location.reload();
  };

  const handleSignIn = () => {
    window.open('https://devstudio-ai.vercel.app/api/auth/github/login', '_blank');
  };

  // --- Function to open the modal ---
  const openNewRepoModal = () => {
    setIsNewRepoModalOpen(true);
    // Optionally close the repo dropdown if it's open
    setShowDropdown(false);
  };

  // --- Function to close the modal (passed to the modal component) ---
  const closeNewRepoModal = () => {
    setIsNewRepoModalOpen(false);
  };


  return (
    // Add relative positioning to the main div if needed for absolute positioned children like dropdowns
    <div className="relative [.dark_&]:bg-gray-800 [.dark_&]:text-white h-14 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shrink-0">
      {/* Left Section */}
      <div className="flex items-center space-x-2 ">
        {/* Repository Dropdown */}
        <div className="relative repo-dropdown-container">
          {/* ... (dropdown button code remains the same) ... */}
             <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={!userRepos || userRepos.length === 0}
                className="flex items-center space-x-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                title={selectedRepo ? selectedRepo.full_name : 'Select a repository'}
             >
                 <FiCpu size={18} className="flex-shrink-0"/>
                 <span className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-[250px]">
                     {selectedRepo ? selectedRepo.full_name : 'Select Repository'}
                 </span>
                 <FiChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}/>
             </button>

          {/* Dropdown Menu */}
          {showDropdown && userRepos && userRepos.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 focus:outline-none ring-1 ring-black ring-opacity-5">
              {userRepos.map((repo) => (
                  <button
                  key={repo.id}
                  onClick={() => {
                      console.log("Topbar selecting repo:", repo.full_name);
                      setSelectedRepo(repo);
                      setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors duration-100 ${
                      selectedRepo?.id === repo.id
                      ? 'bg-blue-100 dark:bg-blue-900 font-medium text-blue-800 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={repo.full_name}
                  >
                  <span className="truncate">{repo.owner.login}/{repo.name}</span>
                  </button>
              ))}
              </div>
          )}
        </div>

        {/* --- Modified Create New Repo Button --- */}
        <button
          onClick={openNewRepoModal} // Call the function to open the modal
          title="Create New Repository" // Updated title
          className="[.dark_&]:text-white flex items-center space-x-1 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-colors duration-150"
        >
          <FiUploadCloud size={16} />
          <span>Create New Repo</span>
        </button>
      </div>

      {/* Middle Section */}
      <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
        <span className="font-semibold text-gray-900 dark:text-gray-200 [.dark_&]:text-white">Chats</span>
      </div>

      <div className="new-repo-modal-container">
         <NewRepoModal
           accessToken={accessToken}
           isOpen={isNewRepoModalOpen}
           onClose={closeNewRepoModal}
         />
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-1 md:space-x-2">
        {/* ... (Action buttons, Theme Toggle, Separator, User Avatar Dropdown remain the same) ... */}
         {/* Action Buttons */}
         <button
          onClick={() => { console.log("Folder action clicked (placeholder)"); }}
          title="Folder action (placeholder)"
          className="p-1.5 md:p-2 rounded text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          <FiBox size={18}/>
        </button>
        <button
          onClick={() => { console.log("New Chat clicked (placeholder)"); }}
          title="New Chat"
          className="p-1.5 md:p-2 rounded text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          <FiPlus size={18} />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Separator */}
        <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        {/* User Avatar with Dropdown */}
        <div className="relative user-dropdown-container">
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="cursor-pointer"
          >
            {userInfo?.image ? (
              <img
                src={userInfo.image}
                alt={userInfo.name || 'User avatar'}
                title={userInfo.name || 'User'}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div
                title="User"
                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"
              >
                <FiGithub className="text-gray-500 dark:text-gray-400"/>
              </div>
            )}
          </div>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50">
              {isSignedIn ? (
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FiLogOut className="mr-2" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FiLogIn className="mr-2" />
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      
      

    </div> // Close main Topbar div
  );
};

export default Topbar;