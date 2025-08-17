import "./globals.css";
import PWARegister from '@/components/PWARegister';
import NavBar from '@/components/NavBar';
import { Suspense } from 'react';

export const metadata = {
  title: 'BrewQuest',
  description: 'Modern beer/bar catalog as a mobile-first PWA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-stone-50">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#38bdf8" />
      </head>
      <body className="min-h-dvh antialiased text-stone-900">
        <div className="mx-auto max-w-screen-sm p-4 pb-28"> {/* Increased from pb-24 to pb-28 for navbar space */}
          <header className="sticky top-0 z-20 mb-4 rounded-2xl bg-white/80 backdrop-blur shadow-sm border border-stone-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="font-semibold">🍺 Brew Quest</div>
              <nav className="text-sm opacity-75">v0</nav>
            </div>
          </header>
          <main className="rounded-2xl bg-white shadow-sm border border-stone-200 p-4">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </main>
        </div>
        <Suspense fallback={null}>
          <NavBar />
        </Suspense>
        <PWARegister />
      </body>
    </html>
  );
}
