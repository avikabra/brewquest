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

  // Pull up to 500 recent checkins and compute stats
  const { data: rows, error } = await admin
    .from('checkins')
    .select('id, bar_id, beer_name, overall, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const total = rows?.length ?? 0;
  const uniqueBars = new Set(rows?.map(r => r.bar_id)).size;
  const uniqueBeers = new Set(rows?.map(r => (r.beer_name ?? '').trim()).filter(Boolean)).size;

  // Last 7 days counts
  const today = new Date(); today.setHours(0,0,0,0);
  const byDay = Array.from({length:7}, (_,i)=>({ d: new Date(today.getTime() - (6-i)*86400000), c: 0 }));
  rows?.forEach(r => {
    const dt = new Date(r.created_at); dt.setHours(0,0,0,0);
    const idx = Math.floor((dt.getTime() - byDay[0].d.getTime())/86400000);
    if (idx >=0 && idx < 7) byDay[idx].c += 1;
  });

  return NextResponse.json({ total, uniqueBars, uniqueBeers, byDay, recent: rows?.slice(0,5) ?? [] });
}
