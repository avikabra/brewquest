import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkLimit } from '@/lib/rateLimit';

const Body = z.object({ request_id: z.string().uuid(), action: z.enum(['accept','reject','block']) });

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

  const rl = await checkLimit(`friend-resp:${userId}`);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { data: edge, error: edgeErr } = await admin
    .from('friend_edges')
    .select('*')
    .eq('id', body.data.request_id)
    .single();
  if (edgeErr) return NextResponse.json({ error: edgeErr.message }, { status: 400 });
  if (![edge.user_id, edge.friend_id].includes(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let status = edge.status;
  if (body.data.action === 'accept') status = 'accepted';
  else if (body.data.action === 'block') status = 'blocked';
  else if (body.data.action === 'reject') {
    // Delete pending request
    if (edge.status === 'pending') {
      await admin.from('friend_edges').delete().eq('id', edge.id);
      return NextResponse.json({ status: 'rejected' });
    }
    return NextResponse.json({ status: edge.status });
  }

  const { error: updErr } = await admin
    .from('friend_edges')
    .update({ status })
    .eq('id', edge.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  return NextResponse.json({ status });
}
