import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkLimit } from '@/lib/rateLimit';

const Body = z.object({ checkin_id: z.string().uuid() });

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

  const rl = await checkLimit(`like:${userId}`);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { error } = await admin
    .from('checkin_likes')
    .insert({ checkin_id: body.data.checkin_id, user_id: userId })
    .select('checkin_id')
    .maybeSingle();
  if (error && !/duplicate/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = supabaseAdmin();
  const { data: authUser, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const userId = authUser.user.id;

  const url = new URL(req.url);
  const checkin_id = url.searchParams.get('checkin_id');
  if (!checkin_id) return NextResponse.json({ error: 'Missing checkin_id' }, { status: 400 });

  const { error } = await admin
    .from('checkin_likes')
    .delete()
    .eq('checkin_id', checkin_id)
    .eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new Response(null, { status: 204 });
}
