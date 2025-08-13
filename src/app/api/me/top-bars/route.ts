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

  // Aggregate by bar for this user
  const { data, error } = await admin
    .from('checkins')
    .select('bar_id, overall, bars(name, address)')
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const map = new Map<string, { name: string; address?: string | null; count: number; avg: number }>();
  for (const r of (data ?? [])) {
    const key = r.bar_id as string;
    const name = (r as any).bars?.name ?? 'Unknown bar';
    const address = (r as any).bars?.address ?? null;
    const entry = map.get(key) ?? { name, address, count: 0, avg: 0 };
    entry.count += 1;
    entry.avg += (r.overall ?? 0);
    map.set(key, entry);
  }
  const rows = Array.from(map.entries()).map(([bar_id, v]) => ({
    bar_id, name: v.name, address: v.address, count: v.count, avg: v.count ? Math.round(v.avg / v.count) : 0
  })).sort((a,b)=> b.count - a.count || b.avg - a.avg).slice(0, 5);

  return NextResponse.json({ top: rows });
}
