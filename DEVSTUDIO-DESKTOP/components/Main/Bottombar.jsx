import React from 'react';
import { FiCpu, FiDatabase, FiSettings } from 'react-icons/fi';

const Bottombar = () => {
  
  return (
    <div className="
      h-8 flex items-center justify-between px-4 text-xs shrink-0
      bg-gray-100 border-t border-gray-200 text-gray-700 /* Light mode: light gray bg, default text */
      [.dark_&]:bg-neutral-900 [.dark_&]:border-t [.dark_&]:border-neutral-700 [.dark_&]:text-neutral-400 /* [.dark_&] mode: VSCode-like status bar */
    ">
      {/* Left Side - Version Info */}
      <div className="flex items-center space-x-1">
        <span className="font-mono text-purple-600 [.dark_&]:text-purple-400">👾</span>
        {/* Text color will be inherited: text-gray-700 [.dark_&]:text-neutral-400 */}
        <span>DevStudio 2.2.1 (Build 1)</span>
      </div>

      {/* Center - User Modes */}
      <div className="flex items-center space-x-1">
        <button className="
          px-2 py-0.5 rounded transition-colors duration-150
          text-gray-600 hover:bg-gray-200 /* Light mode: inactive */
          [.dark_&]:text-neutral-300 [.dark_&]:hover:bg-neutral-700 /* [.dark_&] mode: inactive, brighter text */
        ">
          User
        </button>
        <button className="
          px-2 py-0.5 rounded transition-colors duration-150
          bg-blue-600 text-white /* Active: works for both light/[.dark_&] */
          [.dark_&]:bg-blue-600 [.dark_&]:text-white
        ">
          Power User
        </button>
        <button className="
          px-2 py-0.5 rounded transition-colors duration-150
          text-gray-600 hover:bg-gray-200 /* Light mode: inactive */
          [.dark_&]:text-neutral-300 [.dark_&]:hover:bg-neutral-700 /* [.dark_&] mode: inactive, brighter text */
        ">
          Developer
        </button>
      </div>

      {/* Right Side - System Usage */}
      <div className="flex items-center space-x-3">
         {/* Text color inherited: "SYSTEM RESOURCES USAGE:" */}
         <span>SYSTEM RESOURCES USAGE:</span>

         {/* RAM Info Badge */}
         <div className="
           flex items-center space-x-1 px-2 py-0.5 rounded
           bg-blue-100 text-blue-700 /* Light mode: blue badge */
           [.dark_&]:bg-neutral-700 [.dark_&]:text-sky-300 /* [.dark_&] mode: subtle bg, cyan-ish text */
         ">
            <FiDatabase size={12}/>
            <span>RAM: 1.10 GB</span>
         </div>

         {/* CPU Info Badge */}
         <div className="
           flex items-center space-x-1 px-2 py-0.5 rounded
           bg-gray-200 text-gray-600 /* Light mode: gray badge */
           [.dark_&]:bg-neutral-700 [.dark_&]:text-neutral-300 /* [.dark_&] mode: subtle bg, light gray text */
         ">
            <FiCpu size={12}/>
            <span>CPU: 0.00 %</span>
         </div>

         {/* Settings Icon Button */}
         <button className="
           transition-colors duration-150
           text-gray-600 hover:text-gray-800 /* Light mode: icon */
           [.dark_&]:text-neutral-400 [.dark_&]:hover:text-neutral-100 /* [.dark_&] mode: icon, brightens on hover */
         ">
            <FiSettings size={14} />
         </button>
      </div>
    </div>
  );
};

export default Bottombar;