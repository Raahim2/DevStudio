"use client"; 
import './globals.css';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';

const inter = Inter({ subsets: ['latin'] });



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className}`}> 
          <SessionProvider>
            {children}
          </SessionProvider>
      </body>
    </html>
  );
}