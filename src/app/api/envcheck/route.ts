import { NextResponse } from 'next/server';

export async function GET() {
  // Return presence flags ONLY, never values
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    NEXT_PUBLIC_MAPBOX_TOKEN: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  });
}
