"use client";

import React from "react";
import Image from "next/image";

// Placeholder Logo
const LogoIcon = () => (
  <div className="relative w-32 h-32">
    {/* Light Logo */}
    <Image
      src="/logo-dark.png"
      alt="Logo Light"
      fill
      className="block dark:hidden object-contain"
      priority
    />
    {/* Dark Logo */}
    <Image
      src="/logo-light.png"
      alt="Logo Dark"
      fill
      className="hidden dark:block object-contain"
      priority
    />
  </div>
);

// Icons
const WindowsIcon = () => (
  <svg
    className="w-5 h-5 mr-2"
    viewBox="0 0 448 512"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 93.7l183.6-24.6v171.5H0V93.7zM0 418.3l183.6 24.6V271.5H0v146.8zM204.8 69.1L448 32v208.6H204.8V69.1zM448 480l-243.2-37.1V271.5H448V480z" />
  </svg>
);

const EnvelopeIcon = () => (
  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const HammerIcon = () => (
  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 21.42a1 1 0 01-1.41 0l-7-7a1 1 0 010-1.41l7-7a1 1 0 011.41 0l7 7a1 1 0 010 1.41l-7 7zM12 8l.01 0M12 12l.01 0M12 16l.01 0M17.6 11l-3.4-3.4M6.4 13l3.4 3.4M15 3l6 6M3 15l6 6" />
  </svg>
);

const DownloadDevStudio = () => {
  const currentVersion = "2.1.1";

  return (
    <div className="w-full bg-white dark:bg-black py-16 md:py-24 px-4 sm:px-6 lg:px-8 text-center transition-colors">
      <div className="flex flex-col items-center z-10 relative">
        {/* Logo */}
        <div className="mb-6 md:mb-8">
          <LogoIcon />
        </div>

        {/* Heading */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white mb-8 md:mb-10">
          Get Started with DevStudio
        </h2>

        {/* Download Button */}
        <button
          onClick={() => window.location.href = 'https://github.com/Raahim2/DevStudio/releases/download/DevStudiov2/DevStudio.Setup.2.2.1.exe'} 
          className="inline-flex items-center justify-center px-5 py-3 md:px-6 md:py-3.5 rounded-lg
                     bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
                     text-white font-semibold text-base md:text-lg shadow-lg
                     transition-all duration-200 transform hover:scale-105 mb-4"
        >
          <WindowsIcon />
          <span>Download DevStudio for Windows</span>
          <span className="ml-2 text-xs bg-white/20 text-white/80 px-1.5 py-0.5 rounded-full">
            {currentVersion}
          </span>
        </button>

        {/* Terms Text */}
        <p className="text-xs sm:text-sm text-gray-600 dark:text-neutral-400 mb-8 md:mb-10">
          By using DevStudio, you agree to its{' '}
          <a href="#" className="underline hover:text-gray-800 dark:hover:text-neutral-300 transition-colors">
            terms of use
          </a>
          .
        </p>

        {/* Bottom Links */}
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8">
          <a href="#" className="inline-flex items-center text-sm text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors">
            <EnvelopeIcon />
            <span className="underline">Sign up for email updates</span>
          </a>
          <a href="#" className="inline-flex items-center text-sm text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors">
            <HammerIcon />
            <span className="underline">Sign up for beta versions</span>
          </a>
        </div>

       
      </div>
    </div>
  );
};

export default DownloadDevStudio;
