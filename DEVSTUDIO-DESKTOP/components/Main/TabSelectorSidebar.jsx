import {
  FiMessageSquare,
  FiCode,
  FiZap,
  FiDownload,
  FiGitCommit,
} from 'react-icons/fi';

const TabSelectorSidebar = ({ activeTab, setActiveTab }) => {
  const sidebarItems = [
    { icon: FiCode, label: 'Code' },
    { icon: FiMessageSquare, label: 'Chat' },
    { icon: FiGitCommit, label: 'Commit' },
    { icon: FiZap, label: 'Automation' },
  ];


  return (
    <div className="
      not-only:w-16 flex flex-col items-center py-4 space-y-6 h-full
      bg-gray-100  /* Light mode: slightly off-white */
      [.dark_&]:bg-neutral-900 /* [.dark_&] mode: VS Code like very [.dark_&] gray/off-black */
      border-r border-gray-300 /* Light mode: light gray */
      [.dark_&]:border-neutral-700 /* [.dark_&] mode: dark gray */">
      {sidebarItems.map((item, index) => (
        <button
          key={index}
          title={item.label}
          onClick={() => setActiveTab(item.label)}
          className={`p-2 rounded-lg transition-colors duration-150 ease-in-out ${
            activeTab === item.label
              ? 'bg-blue-600 text-white' // Active state: vibrant blue, white text (same for light/[.dark_&])
              : `
                text-gray-600 hover:bg-gray-200  /* Light mode: inactive */
                [.dark_&]:text-neutral-400 [.dark_&]:hover:bg-neutral-700 /* [.dark_&] mode: inactive */
              `
          }`}
        >
          <item.icon size={24} />
        </button>
      ))}

      {/* Spacer to push the download button to the bottom */}
      <div className="flex-grow"></div>

      {/* Bottom Download Button */}
      <div className="mb-2">
        <button
          title="Download"
          className="
            p-2 rounded-full transition-colors duration-150 ease-in-out
            border
            text-gray-600 border-gray-400 hover:bg-gray-200 /* Light mode */
            [.dark_&]:text-neutral-400 [.dark_&]:border-neutral-600 [.dark_&]:hover:bg-neutral-700 /* [.dark_&] mode */
          "
        >
          <FiDownload size={20} />
        </button>
      </div>
    </div>
  );
};

export default TabSelectorSidebar;