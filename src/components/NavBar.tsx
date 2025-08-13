'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, User2 } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/map', label: 'Map', Icon: Map },
  { href: '/me', label: 'Me', Icon: User2 },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-screen-sm px-4 pb-safe">
      <div className="mb-3 rounded-2xl bg-white shadow-md border border-stone-200">
        <ul className="grid grid-cols-3">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex flex-col items-center justify-center py-2 text-xs ${active ? 'text-sky-600' : 'text-stone-600'}`}
                >
                  <Icon size={20} />
                  <span className="mt-1">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
