import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('checkins')
    .select(`
      id, user_id, created_at,
      beer_id, beer_name, description, ai_review, ai_model,
      taste, bitterness, aroma, smoothness, carbonation, temperature,
      music, lighting, crowd_vibe, cleanliness, decor,
      day_of_week, group_size, company_type, beers_already,
      overall, image_paths,
      bars(id, name, address, lat, lng)
    `)
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ checkin: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();

  // Identify user
  const { data: authUser, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const userId = authUser.user.id;

  // Fetch row first for ownership & bar_id (for refresh)
  const { data: row, error: fetchErr } = await admin
    .from('checkins')
    .select('id, user_id, bar_id')
    .eq('id', id)
    .single();

  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Delete by id
  const { error: delErr } = await admin.from('checkins').delete().eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // Best-effort aggregates refresh
  try{
    await admin.rpc('refresh_checkin_aggregates', { bar_id: row.bar_id });
  } catch {}
  return NextResponse.json({ ok: true });
}

const UpdateBody = z.object({
  image_paths: z.array(z.string()).max(6).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: authUser, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const userId = authUser.user.id;

  // Parse body
  const body = UpdateBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // Check ownership
  const { data: checkin, error: fetchErr } = await admin
    .from('checkins')
    .select('user_id')
    .eq('id', id)
    .single();
  if (fetchErr || !checkin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (checkin.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Update
  const updateData: any = {};
  if (body.data.image_paths !== undefined) updateData.image_paths = body.data.image_paths;

  const { error: updateErr } = await admin
    .from('checkins')
    .update(updateData)
    .eq('id', id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
