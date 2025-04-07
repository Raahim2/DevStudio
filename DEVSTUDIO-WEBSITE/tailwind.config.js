// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class', // <--- Make sure this is 'class'
    content: [
      './pages/**/*.{js,ts,jsx,tsx,mdx}',
      './components/**/*.{js,ts,jsx,tsx,mdx}',
      './app/**/*.{js,ts,jsx,tsx,mdx}', // Important for App Router
    ],
    theme: {
      extend: {
        // ... your theme extensions
      },
    },
    plugins: [],
  }