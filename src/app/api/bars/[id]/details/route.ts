import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;

  const admin = supabaseAdmin();

  let userId: string | null = null;
  if (token) {
    const { data: authUser } = await admin.auth.getUser(token);
    userId = authUser?.user?.id ?? null;
  }

  // My check-ins at this bar
  let my_checkins: any[] = [];
  let my_top: any[] = [];
  let my_last_visit: string | null = null;

  if (userId) {
    const { data } = await admin
      .from('checkins')
      .select('id, beer_name, overall, ai_review, created_at')
      .eq('user_id', userId)
      .eq('bar_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    my_checkins = data ?? [];
    my_top = [...my_checkins].sort((a,b)=> (b.overall ?? 0) - (a.overall ?? 0)).slice(0, 3);
    my_last_visit = my_checkins?.[0]?.created_at ?? null;
  }

  // Community slice (limited columns, via security definer fn)
  const { data: community } = await admin.rpc('get_bar_feed', { p_bar_id: id, p_limit: 10 });

  return NextResponse.json({ my_checkins, my_top, my_last_visit, community: community ?? [] });
}
