'use client';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Star, Users, CalendarClock, Music, Lamp, Paintbrush, Sparkles, Camera, Zap, ThumbsUp, AlertTriangle, ThumbsDown } from 'lucide-react';
import { Root as VisuallyHidden } from '@radix-ui/react-visually-hidden';

type Bar = { id: string; name: string; address?: string | null };
type Agg = { checkin_count: number; avg_overall: number };
type Photo = {
  image_path: string;
  checkin_id: string;
  username: string;
  uploaded_at: string;
};

export default function BarSheet({ barId, open, onOpenChange }: { barId: string | null, open: boolean, onOpenChange: (o:boolean)=>void }) {
  const [bar, setBar] = useState<Bar | null>(null);
  const [agg, setAgg] = useState<Agg | null>(null);
  const [details, setDetails] = useState<any>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof supabaseBrowser> | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') setSupabase(supabaseBrowser());
  }, []);

  useEffect(() => {
    if (!open || !barId || !supabase) return;
    (async () => {
      // Fetch basic bar data and details
      const base = await fetch(`/api/bars/${barId}`).then(r=>r.json());
      setBar(base.bar ?? null); setAgg(base.aggregates ?? null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const det = await fetch(`/api/bars/${barId}/details`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).then(r=>r.json());
      setDetails(det);

      // Fetch community photos
      try {
        const photosRes = await fetch(`/api/bars/${barId}/photos`);
        if (photosRes.ok) {
          const photosData = await photosRes.json();
          setPhotos(photosData.photos || []);
        } else {
          console.log('Photos API not ready yet (likely missing schema)');
          setPhotos([]);
        }
      } catch (photosError) {
        console.log('Photos fetch error:', photosError);
        setPhotos([]);
      }

      // Fetch AI summary
      try {
        const summaryRes = await fetch(`/api/bars/${barId}/summary`);
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setAiSummary(summaryData);
        } else {
          console.log('AI Summary API not ready yet (likely missing schema)');
          setAiSummary(null);
        }
      } catch (summaryError) {
        console.log('AI Summary fetch error:', summaryError);
        setAiSummary(null);
      }
    })();
  }, [open, barId, supabase]);

  // Helper function to render dynamic rating icon
  const getRatingIcon = (score: number) => {
    if (score >= 7.5) return <Zap className="text-green-600" size={18} />;
    if (score >= 6.5) return <ThumbsUp className="text-blue-600" size={18} />;
    if (score >= 4.5) return <Star className="text-yellow-600" size={18} />;
    if (score >= 2.5) return <AlertTriangle className="text-orange-600" size={18} />;
    return <ThumbsDown className="text-red-600" size={18} />;
  };

  const getRatingColor = (score: number) => {
    if (score >= 7.5) return 'bg-green-50 border-green-200 text-green-800';
    if (score >= 6.5) return 'bg-blue-50 border-blue-200 text-blue-800';
    if (score >= 4.5) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    if (score >= 2.5) return 'bg-orange-50 border-orange-200 text-orange-800';
    return 'bg-red-50 border-red-200 text-red-800';
  };

  const lastVisit = details.my_last_visit ? new Date(details.my_last_visit).toLocaleDateString() : '—';
  const myTop: any[] = details.my_top ?? [];
  const community: any[] = details.community ?? [];
  const aggregateScores = aiSummary?.aggregate_scores || {}

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-screen-sm w-full mx-auto h-[95vh] p-0 rounded-t-3xl flex flex-col">
        {/* Provide an accessible title for Dialog */}
        <SheetHeader className="shrink-0">
          <VisuallyHidden>
            <SheetTitle>{bar?.name ?? 'Bar'}</SheetTitle>
          </VisuallyHidden>
        </SheetHeader>

        {/* Hero */}
        <div className="shrink-0 bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 text-white p-5">
          <div className="text-sm opacity-90 truncate">{bar?.address ?? '—'}</div>
          <h2 className="text-2xl font-semibold mt-1">{bar?.name ?? 'Bar'}</h2>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-3 py-1">
              <Star size={16} />
              <span className="text-sm">Avg {agg?.avg_overall ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-3 py-1">
              <Users size={16} />
              <span className="text-sm">{agg?.checkin_count ?? 0} check-ins</span>
            </div>
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur rounded-full px-3 py-1">
              <CalendarClock size={16} />
              <span className="text-sm">Last: {lastVisit}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/checkin?barId=${barId}`} className="w-full">
              <Button className="w-full rounded-xl bg-white text-sky-700 hover:bg-white/90">Check in</Button>
            </Link>
            <SheetClose asChild>
              <Button variant="secondary" className="w-full rounded-xl bg-white/20 hover:bg-white/30 text-white border-white/20">
                Close
              </Button>
            </SheetClose>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Your top picks</div>
                <div className="text-xs text-stone-500">{myTop.length} items</div>
              </div>
              {myTop.length ? (
                <div className="grid grid-cols-1 gap-2">
                  {myTop.map((c:any)=>(
                    <div key={c.id} className="flex items-center justify-between bg-stone-50 rounded-xl p-3 border">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">🍺</span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.beer_name ?? 'Untitled'}</div>
                          {c.ai_review && <div className="text-xs text-stone-100/90 md:text-stone-600">{c.ai_review}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sky-700 shrink-0">
                        <Star size={16} /><span className="text-sm">{c.overall ?? '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-stone-600">No check-ins yet at this bar.</div>}
            </CardContent>
          </Card>

          {/* AI Summary */}
          {aiSummary?.summary && (
            <Card className="rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-purple-600" size={18} />
                  <span className="font-medium">AI Summary</span>
                  {aiSummary.cached && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Cached</span>}
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">{aiSummary.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Community Photos */}
          {photos.length > 0 && (
            <Card className="rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="text-blue-600" size={18} />
                    <span className="font-medium">Community Photos</span>
                  </div>
                  <div className="text-xs text-stone-500">{photos.length} photos</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 6).map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img
                        src={supabase?.storage.from('checkin-images').getPublicUrl(photo.image_path).data.publicUrl}
                        alt={`Bar photo by ${photo.username}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <div className="text-xs text-white truncate">{photo.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {photos.length > 6 && (
                  <p className="text-xs text-stone-500 text-center">+{photos.length - 6} more photos</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dynamic Rating Categories */}
          <div className="grid grid-cols-5 gap-2 text-stone-700">
            <div className={`border rounded-xl p-3 flex flex-col items-center text-xs ${aggregateScores.music ? getRatingColor(aggregateScores.music) : 'bg-stone-50 border-stone-200'}`}>
              {aggregateScores.music ? getRatingIcon(aggregateScores.music) : <Music size={18} />}
              <span className="mt-1">Music</span>
              {aggregateScores.music && <span className="text-xs font-medium">{aggregateScores.music}</span>}
            </div>
            <div className={`border rounded-xl p-3 flex flex-col items-center text-xs ${aggregateScores.lighting ? getRatingColor(aggregateScores.lighting) : 'bg-stone-50 border-stone-200'}`}>
              {aggregateScores.lighting ? getRatingIcon(aggregateScores.lighting) : <Lamp size={18} />}
              <span className="mt-1">Lighting</span>
              {aggregateScores.lighting && <span className="text-xs font-medium">{aggregateScores.lighting}</span>}
            </div>
            <div className={`border rounded-xl p-3 flex flex-col items-center text-xs ${aggregateScores.crowd_vibe ? getRatingColor(aggregateScores.crowd_vibe) : 'bg-stone-50 border-stone-200'}`}>
              {aggregateScores.crowd_vibe ? getRatingIcon(aggregateScores.crowd_vibe) : <Users size={18} />}
              <span className="mt-1">Crowd</span>
              {aggregateScores.crowd_vibe && <span className="text-xs font-medium">{aggregateScores.crowd_vibe}</span>}
            </div>
            <div className={`border rounded-xl p-3 flex flex-col items-center text-xs ${aggregateScores.decor ? getRatingColor(aggregateScores.decor) : 'bg-stone-50 border-stone-200'}`}>
              {aggregateScores.decor ? getRatingIcon(aggregateScores.decor) : <Paintbrush size={18} />}
              <span className="mt-1">Decor</span>
              {aggregateScores.decor && <span className="text-xs font-medium">{aggregateScores.decor}</span>}
            </div>
            <div className={`border rounded-xl p-3 flex flex-col items-center text-xs ${aggregateScores.overall ? getRatingColor(aggregateScores.overall) : 'bg-stone-50 border-stone-200'}`}>
              {aggregateScores.overall ? getRatingIcon(aggregateScores.overall) : <Star size={18} />}
              <span className="mt-1">Overall</span>
              {aggregateScores.overall && <span className="text-xs font-medium">{aggregateScores.overall}</span>}
            </div>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="font-medium">Community (recent)</div>
              {(community ?? []).length ? (
                <ul className="text-sm space-y-2">
                  {community.map((c:any)=>(
                    <li key={c.id} className="bg-white rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{c.beer_name ?? 'Untitled'}</div>
                        <div className="flex items-center gap-1 text-sky-700"><Star size={16}/><span>{c.overall ?? '—'}</span></div>
                      </div>
                      <div className="text-xs text-stone-600 mt-1">{c.username ?? 'Someone'} • {new Date(c.created_at).toLocaleDateString()}</div>
                      {c.ai_review && <div className="text-sm mt-1">{c.ai_review}</div>}
                    </li>
                  ))}
                </ul>
              ) : <div className="text-sm text-stone-600">No community check-ins yet.</div>}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
