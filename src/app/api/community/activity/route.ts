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
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
  const since = url.searchParams.get('since');

  let query = admin
    .from('checkins')
    .select('id, user_id, bar_id, beer_name, overall, created_at, bars(name), profiles(username)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (since) query = query.lt('created_at', since);
  const { data: checkins, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = checkins.map(c => c.id);
  let likes: { checkin_id: string; count: number; liked: boolean }[] = [];
  if (ids.length) {
    const { data: likeRows } = await admin
      .from('checkin_likes')
      .select('checkin_id, user_id')
      .in('checkin_id', ids);
    const map = new Map<string, { count: number; liked: boolean }>();
    for (const l of likeRows || []) {
      const entry = map.get(l.checkin_id) || { count: 0, liked: false };
      entry.count += 1;
      if (l.user_id === userId) entry.liked = true;
      map.set(l.checkin_id, entry);
    }
    likes = ids.map(id => ({ checkin_id: id, count: map.get(id)?.count || 0, liked: !!map.get(id)?.liked }));
  }

  const items = checkins.map(c => ({
    checkin: { id: c.id, beer_name: c.beer_name, overall: c.overall, created_at: c.created_at },
    bar: { id: c.bar_id, name: (c as any).bars?.name },
    user: { id: c.user_id, username: (c as any).profiles?.username || 'Unknown' },
    likes_count: likes.find(l => l.checkin_id === c.id)?.count || 0,
    liked_by_me: !!likes.find(l => l.checkin_id === c.id)?.liked
  }));

  return NextResponse.json({ items });
}
