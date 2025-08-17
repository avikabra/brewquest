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

  // Fetch accepted edges involving user
  const { data: edges, error: edgeErr } = await admin
    .from('friend_edges')
    .select('user_id, friend_id, created_at, status')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (edgeErr) return NextResponse.json({ error: edgeErr.message }, { status: 400 });
  const friendIds = Array.from(new Set(edges.map(e => e.user_id === userId ? e.friend_id : e.user_id)));
  if (!friendIds.length) return NextResponse.json({ friends: [] });
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('user_id, username')
    .in('user_id', friendIds);
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });
  const byId = Object.fromEntries((profiles||[]).map(p => [p.user_id, p]));
  const friends = friendIds.map(fid => ({ user_id: fid, username: byId[fid]?.username || null, since: edges.find(e => e.user_id === fid || e.friend_id === fid)?.created_at || null }));
  return NextResponse.json({ friends });
}
