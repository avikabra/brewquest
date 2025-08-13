import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/checkin', '/me'];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PROTECTED.some(p => path.startsWith(p))) {
    const hasSupabaseCookies =
      req.cookies.has('sb-access-token') || req.headers.get('authorization')?.startsWith('Bearer ');
    if (!hasSupabaseCookies) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
