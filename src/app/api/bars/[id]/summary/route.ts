import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const admin = supabaseAdmin();
  
  // Get current summary and last update
  const { data: bar, error: barError } = await admin
    .from('bars')
    .select('ai_summary, summary_updated_at, aggregate_scores')
    .eq('id', id)
    .single();
    
  if (barError) return NextResponse.json({ error: barError.message }, { status: 400 });
  
  // If summary is less than 7 days old, return cached version
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (bar.ai_summary && bar.summary_updated_at && new Date(bar.summary_updated_at) > weekAgo) {
    return NextResponse.json({ 
      summary: bar.ai_summary, 
      cached: true,
      aggregate_scores: bar.aggregate_scores || {}
    });
  }
  
  // Generate new summary - get recent checkin data
  const { data: checkins, error: checkinsError } = await admin
    .from('checkins')
    .select('ai_review, description, music, lighting, crowd_vibe, cleanliness, decor, overall')
    .eq('bar_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (checkinsError || !checkins || checkins.length === 0) {
    return NextResponse.json({ 
      summary: 'Not enough data available for this bar yet.', 
      cached: false,
      aggregate_scores: {}
    });
  }
  
  // Calculate aggregate scores
  const scores = {
    music: 0, lighting: 0, crowd_vibe: 0, cleanliness: 0, decor: 0, overall: 0
  };
  const counts = { music: 0, lighting: 0, crowd_vibe: 0, cleanliness: 0, decor: 0, overall: 0 };
  
  for (const c of checkins) {
    for (const key of Object.keys(scores)) {
      const value = c[key as keyof typeof c];
      if (typeof value === 'number' && value >= 0) {
        scores[key as keyof typeof scores] += value;
        counts[key as keyof typeof counts]++;
      }
    }
  }
  
  const aggregateScores = Object.fromEntries(
    Object.entries(scores).map(([key, sum]) => [
      key, 
      counts[key as keyof typeof counts] > 0 ? Number((sum / counts[key as keyof typeof counts]).toFixed(1)) : 0
    ])
  );
  
  // Generate AI summary (placeholder - in real app would call OpenAI/Claude)
  const topAspects = Object.entries(aggregateScores)
    .filter(([key]) => key !== 'overall')
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key, score]) => ({ key: key.replace('_', ' '), score }));
    
  const _reviews = checkins
    .filter(c => c.ai_review || c.description)
    .slice(0, 5)
    .map(c => c.ai_review || c.description)
    .join(' ');
    
  let summary = `This bar is known for its ${topAspects.map(a => a.key).join(', ')}. `;
  
  if (aggregateScores.overall >= 7) {
    summary += 'Patrons consistently rate this as a high-quality establishment. ';
  } else if (aggregateScores.overall >= 5) {
    summary += 'This spot offers a solid experience for most visitors. ';
  } else {
    summary += 'This location has mixed reviews from the community. ';
  }
  
  if (topAspects[0]?.score >= 7) {
    summary += `Particularly praised for excellent ${topAspects[0].key}. `;
  }
  
  // Add atmosphere based on scores
  if (aggregateScores.music >= 7 && aggregateScores.crowd_vibe >= 7) {
    summary += 'Great for social gatherings and enjoying good vibes.';
  } else if (aggregateScores.lighting >= 7 && aggregateScores.decor >= 7) {
    summary += 'Perfect for those who appreciate ambiance and aesthetic.';
  } else if (aggregateScores.cleanliness >= 8) {
    summary += 'Known for maintaining high cleanliness standards.';
  } else {
    summary += 'A casual spot for drinks and relaxation.';
  }
  
  // Cache the summary
  await admin
    .from('bars')
    .update({ 
      ai_summary: summary, 
      summary_updated_at: new Date().toISOString(),
      aggregate_scores: aggregateScores
    })
    .eq('id', id);
  
  return NextResponse.json({ 
    summary, 
    cached: false,
    aggregate_scores: aggregateScores
  });
}
