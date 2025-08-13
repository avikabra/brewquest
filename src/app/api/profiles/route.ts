import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: authUser, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const usernameFromBody = typeof body?.username === 'string' ? body.username : undefined;
  const metaUsername = (authUser.user.user_metadata as any)?.username as string | undefined;
  const username = usernameFromBody ?? metaUsername ?? null;

  const { data, error } = await admin
    .from('profiles')
    .upsert({ user_id: authUser.user.id, username })
    .select('user_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, user_id: data.user_id });
}
