import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const admin = supabaseAdmin();
  const { data: bar, error } = await admin.from('bars')
    .select('id, name, address, lat, lng').eq('id', id).single();
  if (error || !bar) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: agg } = await admin.from('bar_aggregates')
    .select('bar_id, checkin_count, avg_overall').eq('bar_id', id).maybeSingle();

  return NextResponse.json({ bar, aggregates: agg ?? null });
}
