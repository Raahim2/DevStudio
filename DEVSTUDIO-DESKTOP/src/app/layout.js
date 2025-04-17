import { ThemeProvider } from '../../context/ThemeContext'; 
import "./globals.css"; 


export const metadata = {
  title: "DevStudio",
  description: "An ultimate AI powered code generator for vibe coders",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        </body>
    </html>
  );
}

