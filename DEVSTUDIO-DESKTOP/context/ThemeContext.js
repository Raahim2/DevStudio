'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Check localStorage only on the client-side
  const [theme, setTheme] = useState('dark'); // Default theme

  // Effect to read initial theme from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
        setTheme(storedTheme);
      } else {
        // Optional: could check system preference here
        setTheme('dark'); // Fallback default
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to apply the class and update localStorage when theme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement; // Get the <html> element
      // Remove previous theme class before adding the new one
      root.classList.remove('light', 'dark');
      // Add the current theme class
      root.classList.add(theme);
      // Persist theme choice
      localStorage.setItem('theme', theme);
    }
  }, [theme]); // Re-run this effect whenever the theme state changes

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);