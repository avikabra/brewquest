import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const admin = supabaseAdmin();
    
    // First check if image_paths column exists
    const { data: _checkins, error } = await admin
      .from('checkins')
      .select('id, image_paths, created_at, profiles(username)')
      .eq('bar_id', id)
      .limit(1); // Just check if the query works
      
    if (error) {
      console.error('Photos query error (image_paths column may not exist):', error);
      // If image_paths column doesn't exist, return empty photos
      if (error.message.includes('column "image_paths" does not exist')) {
        return NextResponse.json({ photos: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Now get the actual data
    const { data: allCheckins, error: fetchError } = await admin
      .from('checkins')
      .select('id, image_paths, created_at, profiles(username)')
      .eq('bar_id', id)
      .not('image_paths', 'eq', '{}')
      .order('created_at', { ascending: false })
      .limit(20);

    if (fetchError) {
      console.error('Photos fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    // Flatten all image paths with metadata
    const photos = [];
    for (const checkin of allCheckins || []) {
      if (checkin.image_paths && checkin.image_paths.length > 0) {
        for (const imagePath of checkin.image_paths) {
          photos.push({
            image_path: imagePath,
            checkin_id: checkin.id,
            username: (checkin as any).profiles?.username || 'Anonymous', // Fixed: match expected field name
            uploaded_at: checkin.created_at
          });
        }
      }
    }

    return NextResponse.json({ photos: photos.slice(0, 12) }); // Limit to 12 photos
  } catch (err) {
    console.error('Photos API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
