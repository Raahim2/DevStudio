'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.gtag) {
      window.gtag('config', 'G-Y9TKTEM6QR', {
        page_path: pathname,
      });
    }
  }, [pathname]);

  return null;
}
