import { Inter } from "next/font/google";
import { ThemeProvider } from '../../context/ThemeContext'; 
import "./globals.css"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "DevStudio",
  description: "A developer's playground",
  // icons: {
  //   icon: "/favicon.ico",
  //   shortcut: "/favicon.ico",
  //   apple: "/apple-touch-icon.png",
  // },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>  
          {children}
        </ThemeProvider>
        </body>
    </html>
  );
}

