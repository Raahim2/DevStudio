// components/HomeTabContent.jsx
'use client';

import React from 'react';

const HomeTabContent = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full text-center text-gray-500 [.dark_&]:text-gray-400 bg-gray-50 [.dark_&]:bg-gray-900 p-6">
      <img
        src="logo.svg" // Assuming you have this logo
        alt="No Folder Selected"
        className="w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] mb-4 text-gray-400 [.dark_&]:text-gray-600 opacity-50"
      />
      <h2 className="text-xl font-semibold mb-2 text-gray-700 [.dark_&]:text-gray-300">Welcome to DevStudio</h2>
      <p className="text-lg">
        Please select a project folder using the button in the top bar to get started.
      </p>
    </div>
  );
};

export default HomeTabContent;