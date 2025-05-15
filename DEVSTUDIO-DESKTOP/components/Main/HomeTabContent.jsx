// components/HomeTabContent.jsx
'use client';

import React from 'react';

const HomeTabContent = () => {
  return (
    <div className="
      flex flex-1 flex-col items-center justify-center h-full text-center p-6
      bg-gray-50 text-gray-500
      [.dark_&]:bg-neutral-900 [.dark_&]:text-neutral-400
    ">
      <img
        src="logo.svg"
        alt="No Folder Selected"
        className="
          w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] mb-4 opacity-50
          text-gray-400
          [.dark_&]:text-neutral-600 [.dark_&]:invert
        "
      />
      <h2 className="
        text-xl font-semibold mb-2
        text-gray-700
        [.dark_&]:text-neutral-200
      ">
        Welcome to DevStudio
      </h2>
      <p className="text-lg">
        Please select a project folder using the button in the top bar to get started.
      </p>
    </div>
  );
};

export default HomeTabContent;