'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register('/sw.js');
          // optional: console.log('SW registered');
        } catch (e) {
          console.error('SW registration failed', e);
        }
      };
      register();
    }
  }, []);
  return null;
}
