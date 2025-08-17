import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
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

    console.log("authorized");

    let query = admin
      .from('checkins')
      .select('id, user_id, bar_id, beer_name, overall, created_at, bars(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (since) query = query.lt('created_at', since);
    
    const { data: checkins, error } = await query;
    if (error) {
      console.error('Community checkins query error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get user profiles separately to avoid relationship issues
    const userIds = [...new Set(checkins.map(c => c.user_id))];
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, username')
      .in('user_id', userIds);
      
    // Create a map of user_id to username
    const userMap = new Map<string, string>();
    for (const profile of profiles || []) {
      userMap.set(profile.user_id, profile.username);
    }

    const ids = checkins.map(c => c.id);
    let likes: { checkin_id: string; count: number; liked: boolean }[] = [];
    if (ids.length) {
      try {
        const { data: likeRows, error: likesError } = await admin
          .from('checkin_likes')
          .select('checkin_id, user_id')
          .in('checkin_id', ids);
          
        if (likesError) {
          console.error('Likes query error (table may not exist):', likesError);
          // Continue without likes data - table may not exist yet
          likes = ids.map(id => ({ checkin_id: id, count: 0, liked: false }));
        } else {
          const map = new Map<string, { count: number; liked: boolean }>();
          for (const l of likeRows || []) {
            const entry = map.get(l.checkin_id) || { count: 0, liked: false };
            entry.count += 1;
            if (l.user_id === userId) entry.liked = true;
            map.set(l.checkin_id, entry);
          }
          likes = ids.map(id => ({ checkin_id: id, count: map.get(id)?.count || 0, liked: !!map.get(id)?.liked }));
        }
      } catch (likeError) {
        console.error('Checkin likes table may not exist yet:', likeError);
        likes = ids.map(id => ({ checkin_id: id, count: 0, liked: false }));
      }
    }

    const items = checkins.map(c => ({
      checkin: { id: c.id, beer_name: c.beer_name, overall: c.overall, created_at: c.created_at },
      bar: { id: c.bar_id, name: (c as any).bars?.name },
      user: { id: c.user_id, username: userMap.get(c.user_id) || 'Unknown' },
      likes_count: likes.find(l => l.checkin_id === c.id)?.count || 0,
      liked_by_me: !!likes.find(l => l.checkin_id === c.id)?.liked
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error('Community activity error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
