import React from 'react';
// Import the specific icons needed
import {
  FiHome,
  FiMessageSquare,
  FiCode,
  FiBell,
  FiSettings,
  FiZap, // Using FiZap for Automation
  FiDownload
} from 'react-icons/fi';

// Accept activeTab and setActiveTab as props
const Sidebar = ({ activeTab, setActiveTab }) => {
  // List of sidebar items without hardcoded active state
  const sidebarItems = [
    { icon: FiHome, label: 'Home' },
    { icon: FiMessageSquare, label: 'Chat' },
    { icon: FiCode, label: 'Code' },
    { icon: FiBell, label: 'Notifications' },
    { icon: FiSettings, label: 'Settings' },
    { icon: FiZap, label: 'Automation' },
  ];

  return (
    // Base: gray-200. Dark: gray-900 using [.dark_&]: prefix
    <div className="[.dark_&]:bg-gray-800 not-only:w-16 bg-gray-200  flex flex-col items-center py-4 space-y-6 h-full">
      {/* Map over the sidebarItems array */}
      {sidebarItems.map((item, index) => (
        <button
          key={index}
          title={item.label} // Tooltip text from label
          // Call setActiveTab when a button is clicked
          onClick={() => setActiveTab(item.label)}
          // Dynamically set active class based on the activeTab prop
          className={`p-2 rounded-lg ${
            activeTab === item.label // Check if this item's label matches the activeTab prop
              ? 'bg-blue-500 text-white' // Active state styling
              // Inactive state: base text-gray-600, dark text-gray-400
              // Hover: base bg-gray-300, dark bg-gray-700
              : 'text-gray-600 [.dark_&]:text-gray-400 hover:bg-gray-300 [.dark_&]:hover:bg-gray-700'
          }`}
        >
          {/* Render the icon component dynamically */}
          <item.icon size={24} />
        </button>
      ))}

      {/* Spacer to push the download button to the bottom */}
      <div className="flex-grow"></div>

      {/* Bottom Download Button - Kept as is */}
      <div className="mb-2"> {/* Added margin-bottom for spacing */}
         <button
          title="Download"
          // Styling with dark mode variants for text, hover, and border
          className="p-2 rounded-full text-gray-600 [.dark_&]:text-gray-400 hover:bg-gray-300 [.dark_&]:hover:bg-gray-700 border border-gray-400 [.dark_&]:border-gray-600"
        >
          <FiDownload size={20} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;