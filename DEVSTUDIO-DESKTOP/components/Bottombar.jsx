import React from 'react';
import { FiCpu, FiDatabase, FiSettings } from 'react-icons/fi';

const Bottombar = () => {
  return (
    // Base: bg-gray-100 border-gray-300 text-gray-600
    // Dark: bg-gray-900 border-gray-700 text-gray-400
    <div className="h-8 bg-gray-100 [.dark_&]:bg-gray-900 border-t border-gray-300 [.dark_&]:border-gray-700 flex items-center justify-between px-4 text-xs text-gray-600 [.dark_&]:text-gray-400 shrink-0">
      {/* Left Side */}
      <div className="flex items-center space-x-1">
        {/* Base: text-purple-600. Dark: text-purple-400 */}
        <span className="font-mono text-purple-600 [.dark_&]:text-purple-400">👾</span>
        <span>DevStudio 0.0.9 (Build 1)</span>
      </div>

      {/* Center - User Modes */}
      <div className="flex items-center space-x-1">
        {/* Base: hover:bg-gray-300. Dark: hover:bg-gray-700 */}
        <button className="px-2 py-0.5 rounded hover:bg-gray-300 [.dark_&]:hover:bg-gray-700">User</button>
        <button className="px-2 py-0.5 rounded bg-blue-500 text-white">Power User</button>
        <button className="px-2 py-0.5 rounded hover:bg-gray-300 [.dark_&]:hover:bg-gray-700">Developer</button>
      </div>

      {/* Right Side - System Usage */}
      <div className="flex items-center space-x-3">
         <span>SYSTEM RESOURCES USAGE:</span>
         {/* Base: bg-blue-100 text-blue-800. Dark: bg-blue-900 text-blue-200 */}
         <div className="flex items-center space-x-1 bg-blue-100 [.dark_&]:bg-blue-900 text-blue-800 [.dark_&]:text-blue-200 px-2 py-0.5 rounded">
            <FiDatabase size={12}/>
            <span>RAM: 1.10 GB</span>
         </div>
         {/* Base: bg-gray-200 text-gray-700. Dark: bg-gray-700 text-gray-300 */}
         <div className="flex items-center space-x-1 bg-gray-200 [.dark_&]:bg-gray-700 text-gray-700 [.dark_&]:text-gray-300 px-2 py-0.5 rounded">
            <FiCpu size={12}/>
            <span>CPU: 0.00 %</span>
         </div>
         {/* Base: hover:text-gray-900. Dark: hover:text-white */}
         <button className="hover:text-gray-900 [.dark_&]:hover:text-white">
            <FiSettings size={14} />
         </button>
      </div>
    </div>
  );
};

export default Bottombar;