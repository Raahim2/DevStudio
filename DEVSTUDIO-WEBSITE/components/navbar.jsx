import React from 'react';
import Link from 'next/link'; // Use Next.js Link for navigation

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
    <path d="M12 1.99988L17.5 9.99988L12 17.9999L6.5 9.99988L12 1.99988Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 1.99988L17.5 9.99988L21.5 1.99988" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 1.99988L6.5 9.99988L2.5 1.99988" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 17.9999L17.5 9.99988L21.5 17.9999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 17.9999L6.5 9.99988L2.5 17.9999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg> 
);


const Navbar = () => {
  const navItems = [
    { name: 'GROK', href: '/grok' }, // Adjust hrefs as needed
    { name: 'API', href: '/api' },
    { name: 'COMPANY', href: '/company' },
    { name: 'COLOSSUS', href: '/colossus' },
    { name: 'CAREERS', href: '/careers' },
    { name: 'NEWS', href: '/news' },
  ];

  return (
    <nav className="w-full px-6 sm:px-10 py-4 flex items-center justify-between absolute top-0 left-0 z-50"> {/* Absolute positioning */}
      <div className="flex items-center space-x-8"> {/* Increased space */}
        {/* Logo */}
        <Link href="/" className="flex items-center">
            <Logo />
        </Link>

        {/* Navigation Links */}
        <ul className="hidden md:flex items-center space-x-6"> {/* Hide on small screens, adjust spacing */}
          {navItems.map((item) => (
            <li key={item.name}>
              <Link href={item.href} className="text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-neutral-100 transition-colors duration-200">
                  {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Right Side Button */}
      <div>
        <Link href="/try-grok" className="inline-block text-xs font-medium uppercase tracking-wider text-neutral-200 hover:text-white border border-neutral-600 hover:border-neutral-300 rounded-full px-5 py-2 transition-all duration-200"> {/* Adjust href */}
            Install Devstudio
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;