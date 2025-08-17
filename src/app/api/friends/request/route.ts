import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkLimit } from '@/lib/rateLimit';

const Body = z.object({ to_user: z.string().uuid() });

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: authUser, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const userId = authUser.user.id;

  const body = Body.safeParse(await req.json().catch(()=>({})));
  if (!body.success) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  if (body.data.to_user === userId) return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 });

  const rl = await checkLimit(`friend-req:${userId}`);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  // Ensure no existing edge (either direction)
  const { data: existing, error: exErr } = await admin
    .from('friend_edges')
    .select('id, status, user_id, friend_id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${body.data.to_user}),and(user_id.eq.${body.data.to_user},friend_id.eq.${userId})`)
    .limit(1)
    .maybeSingle();
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
  if (existing) {
    // If existing pending and current user was requester, just return; if reversed, maybe auto-accept? We'll let them accept separately.
    return NextResponse.json({ id: existing.id, status: existing.status }, { status: 200 });
  }

  const { data, error } = await admin
    .from('friend_edges')
    .insert({ user_id: userId, friend_id: body.data.to_user, status: 'pending' })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
