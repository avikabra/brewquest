import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths (besides "/") that should only be accessible to authenticated users
const PROTECTED = ['/checkin', '/me'];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Quick skips for public / framework / asset paths
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/icons') ||
    path.startsWith('/manifest') ||
    path.startsWith('/sw') ||
    path === '/favicon.ico' ||
    path.startsWith('/sign-in')
  ) {
    return NextResponse.next();
  }

  const needsAuth = path === '/' || PROTECTED.some(p => path.startsWith(p));
  if (needsAuth) {
    const hasSupabaseCookies =
      req.cookies.has('sb-access-token') || req.headers.get('authorization')?.startsWith('Bearer ');
    if (!hasSupabaseCookies) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      // Preserve original destination so we could redirect after login later if desired
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
