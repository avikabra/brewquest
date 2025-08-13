import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type BarRow = {
  id: string; name: string; address: string | null;
  lat: number; lng: number; provider: string; provider_place_id: string;
};

function generateFakeBars(lat: number, lng: number, n = 8): BarRow[] {
  const out: BarRow[] = [];
  for (let i = 0; i < n; i++) {
    const dLat = (Math.random() - 0.5) * 0.01;
    const dLng = (Math.random() - 0.5) * 0.01;
    out.push({
      id: `mock-${i + 1}`,
      name: `Test Bar ${i + 1}`,
      address: `#${100 + i} Demo St`,
      lat: lat + dLat,
      lng: lng + dLng,
      provider: 'mock',
      provider_place_id: `mock-${i + 1}`
    });
  }
  return out;
}

async function searchboxCategory(category: string, lat: number, lng: number, limit: number, token: string) {
  // Search Box Category endpoint, see docs
  // https://docs.mapbox.com/api/search/search-box/  (Category Search)
  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}`);
  url.searchParams.set('proximity', `${lng},${lat}`); // lon,lat
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('language', 'en');
  url.searchParams.set('access_token', token);
  const r = await fetch(url.toString());
  if (!r.ok) {
    const text = await r.text();
    console.error('[nearby] SearchBox error', r.status, text.slice(0, 200));
    return [];
  }
  const gj = await r.json();
  const feats = Array.isArray(gj.features) ? gj.features : [];
  console.log(`[nearby] category="${category}" features=${feats.length}`);

  // Normalize to our schema
  const rows = feats.map((f: any) => ({
    name: f.properties?.name ?? f.text ?? 'Unnamed',
    address: f.properties?.full_address ?? f.properties?.address ?? f.properties?.place_formatted ?? null,
    lat: f.geometry?.coordinates?.[1],
    lng: f.geometry?.coordinates?.[0],
    provider: 'mapbox_searchbox',
    provider_place_id: f.properties?.mapbox_id ?? String(f.id ?? '')
  }));
  return rows.filter((b: any) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && b.provider_place_id);
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20);
  const mock = req.nextUrl.searchParams.get('mock') === '1';

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }

  if (mock) {
    const bars = generateFakeBars(lat, lng);
    console.log('[nearby] mock mode → bars=', bars.length);
    return NextResponse.json({ bars, aggregates: [], mock: true });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error('[nearby] Missing NEXT_PUBLIC_MAPBOX_TOKEN on server');
    return NextResponse.json({ error: 'Server missing Mapbox token' }, { status: 500 });
  }

  try {
    // Prefer precise categories; widen if needed
    const categories = ['bar', 'pub', 'brewery', 'beer_garden', 'food_and_drink'];
    let rows: Omit<BarRow, 'id'>[] = [];
    for (const cat of categories) {
      const r = await searchboxCategory(cat, lat, lng, limit, token);
      rows = r;
      if (rows.length) break;
    }

    console.log('[nearby] normalized rows=', rows.length);
    if (!rows.length) {
      // Still nothing? Return mocks to unblock UX.
      const fake = generateFakeBars(lat, lng, 6);
      console.warn('[nearby] no real bars found; returning mock fallback');
      return NextResponse.json({ bars: fake, aggregates: [], mock: true });
    }

    const admin = supabaseAdmin();
    const { data: up, error: upErr } = await admin
      .from('bars')
      .upsert(rows, { onConflict: 'provider,provider_place_id' })
      .select('id, name, address, lat, lng, provider, provider_place_id');

    if (upErr) {
      console.error('[nearby] Supabase upsert error', upErr.message);
      // Return temporary ids so map can still render
      const fallback = rows.map((r) => ({ id: `temp-${r.provider_place_id}`, ...r }));
      return NextResponse.json({ bars: fallback, aggregates: [], warn: 'db-upsert-failed' }, { status: 200 });
    }

    const ids = (up ?? []).map(b => b.id);
    let aggregates: any[] = [];
    if (ids.length) {
      const { data: ag, error: agErr } = await admin
        .from('bar_aggregates')
        .select('bar_id, checkin_count, avg_overall')
        .in('bar_id', ids);
      if (agErr) console.error('[nearby] aggregates error', agErr.message);
      if (ag) aggregates = ag;
    }

    return NextResponse.json({ bars: up ?? [], aggregates });
  } catch (e: any) {
    console.error('[nearby] unexpected error', e?.message);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
