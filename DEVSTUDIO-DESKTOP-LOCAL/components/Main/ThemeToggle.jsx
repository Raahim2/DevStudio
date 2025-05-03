'use client'; // Need this for onClick and useTheme

import React from 'react';
import { useTheme } from '../../context/ThemeContext'; // Adjust path
import { FiSun, FiMoon } from 'react-icons/fi';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      
      className="p-2 rounded-lg text-gray-600 [.dark_&]:text-gray-300 hover:bg-gray-200 [.dark_&]:hover:bg-gray-700"
      title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
    >
      {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
    </button>
  );
};

export default ThemeToggle;