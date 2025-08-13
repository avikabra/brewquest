import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  bar_id: z.string().uuid(),
  beer_id: z.string().uuid().optional(),
  beer_name: z.string().optional(),
  description: z.string().optional(),
  ratings: z.object({
    taste: z.number().int().min(0).max(10),
    bitterness: z.number().int().min(0).max(10),
    aroma: z.number().int().min(0).max(10),
    smoothness: z.number().int().min(0).max(10),
    carbonation: z.number().int().min(0).max(10),
    temperature: z.number().int().min(0).max(10),
    music: z.number().int().min(0).max(10),
    lighting: z.number().int().min(0).max(10),
    crowd_vibe: z.number().int().min(0).max(10),
    cleanliness: z.number().int().min(0).max(10),
    decor: z.number().int().min(0).max(10),
  }),
  context: z.object({
    day_of_week: z.number().int().min(0).max(6),
    group_size: z.number().int().min(1).max(50),
    company_type: z.string(),
    beers_already: z.number().int().min(0).max(20)
  }),
  overall: z.number().int().min(0).max(10).optional(),
  ai_review: z.string().optional(),
  ai_model: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const input = Body.parse(await req.json());

    // Verify token and get user
    const admin = supabaseAdmin();
    const { data: authUser, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const userId = authUser.user.id;

    const { data, error } = await admin.from('checkins').insert({
      user_id: userId,
      bar_id: input.bar_id,
      beer_id: input.beer_id ?? null,
      beer_name: input.beer_name ?? null,
      description: input.description ?? null,
      ai_review: input.ai_review ?? null,
      ai_model: input.ai_model ?? null,
      taste: input.ratings.taste,
      bitterness: input.ratings.bitterness,
      aroma: input.ratings.aroma,
      smoothness: input.ratings.smoothness,
      carbonation: input.ratings.carbonation,
      temperature: input.ratings.temperature,
      music: input.ratings.music,
      lighting: input.ratings.lighting,
      crowd_vibe: input.ratings.crowd_vibe,
      cleanliness: input.ratings.cleanliness,
      decor: input.ratings.decor,
      overall: input.overall ?? null,
      ratings_json: input.ratings,
      context_json: input.context,
      day_of_week: input.context.day_of_week,
      group_size: input.context.group_size,
      company_type: input.context.company_type,
      beers_already: input.context.beers_already
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      await admin.rpc('refresh_bar_aggregates');
    } catch (_) {}
    return NextResponse.json({ id: data!.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Bad Request' }, { status: 400 });
  }
}
