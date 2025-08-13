import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/sign-in?confirmed=1';
  const supa = supabaseServer();

  // 1) Exchange ?code=... for a session (works for signup/confirm)
  try {
    await supa.auth.exchangeCodeForSession(req.url);
  } catch {
    // If there's no code, continue; user may already be confirmed.
  }

  // 2) Upsert profile for the now-confirmed user (RLS uses this session)
  const { data: userRes } = await supa.auth.getUser();
  const user = userRes?.user;
  if (user) {
    const username = (user.user_metadata as any)?.username ?? null;
    await supa.from('profiles').upsert({ user_id: user.id, username }).select('user_id');
    // 3) Sign out so they follow the flow: confirm -> return to sign-in -> sign in with password
    await supa.auth.signOut();
  }

  // 4) Redirect to sign-in with a success query
  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}
