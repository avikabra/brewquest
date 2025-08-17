import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: authUser, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const userId = authUser.user.id;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ users: [] });

  // Search profiles by username with ilike pattern
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('user_id, username')
    .ilike('username', `%${q}%`)
    .neq('user_id', userId) // exclude self
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ users: profiles || [] });
}
