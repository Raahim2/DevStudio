// Mark this component as a Client Component because it uses hooks (useState, useEffect, useTheme)
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes'; // Import useTheme

// --- Icons for the toggle button ---
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-6.364-.386 1.591-1.591M3 12h2.25m.386-6.364 1.591 1.591" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);
// --- End Icons ---


const Logo = () => (
  // Your Logo SVG remains the same
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
       className="text-black dark:text-white transition-colors duration-200"> {/* Added dark mode styling */}
    <path d="M12 1.99988L17.5 9.99988L12 17.9999L6.5 9.99988L12 1.99988Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 1.99988L17.5 9.99988L21.5 1.99988" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 1.99988L6.5 9.99988L2.5 1.99988" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 17.9999L17.5 9.99988L21.5 17.9999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 17.9999L6.5 9.99988L2.5 17.9999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


const Navbar = () => {
  const navItems = [
    { name: 'GROK', href: '/grok' },
    { name: 'API', href: '/api' },
    { name: 'COMPANY', href: '/company' },
    { name: 'COLOSSUS', href: '/colossus' },
    { name: 'CAREERS', href: '/careers' },
    { name: 'NEWS', href: '/news' },
  ];

  // --- Theme Toggle Logic ---
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  // --- End Theme Toggle Logic ---


  // Update nav link styling for dark mode
  const navLinkClasses = "text-xs font-medium uppercase tracking-wider text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-neutral-100 transition-colors duration-200";
  // Update button styling for dark mode
  const buttonLinkClasses = "inline-block text-xs font-medium uppercase tracking-wider text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white border border-neutral-400 dark:border-neutral-600 hover:border-black dark:hover:border-neutral-300 rounded-full px-5 py-2 transition-all duration-200";


  return (
    // Added background for visibility when scrolling, adjust as needed
    <nav className="w-full px-6 sm:px-10 py-4 flex items-center justify-between absolute top-0 left-0 z-50 bg-transparent transition-colors duration-200">
      <div className="flex items-center space-x-8">
        {/* Logo */}
        <Link href="/" className="flex items-center">
            <Logo />
        </Link>

        {/* Navigation Links */}
        <ul className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link href={item.href} className={navLinkClasses}>
                  {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Right Side: Button + Theme Toggle */}
      <div className="flex items-center space-x-4"> {/* Use flex to align items */}
        <Link href="/try-grok" className={buttonLinkClasses}>
            Install Devstudio
        </Link>

        {/* --- Theme Toggle Button --- */}
        <button
          aria-label="Toggle Dark Mode"
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:ring-2 ring-neutral-300 dark:hover:ring-neutral-600 transition-all duration-200"
          onClick={toggleTheme}
        >
           {/* Render button content only after component is mounted */}
           {mounted ? (
              theme === 'dark' ? <SunIcon /> : <MoonIcon />
           ) : (
             <div className="w-5 h-5"></div> // Placeholder to prevent layout shift
           )}
        </button>
         {/* --- End Theme Toggle Button --- */}
      </div>
    </nav>
  );
};

export default Navbar;