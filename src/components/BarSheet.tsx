'use client';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Star, Users, CalendarClock, Music, Lamp, Paintbrush } from 'lucide-react';
import { Root as VisuallyHidden } from '@radix-ui/react-visually-hidden';

type Bar = { id: string; name: string; address?: string | null };
type Agg = { checkin_count: number; avg_overall: number };

export default function BarSheet({ barId, open, onOpenChange }: { barId: string | null, open: boolean, onOpenChange: (o:boolean)=>void }) {
  const [bar, setBar] = useState<Bar | null>(null);
  const [agg, setAgg] = useState<Agg | null>(null);
  const [details, setDetails] = useState<any>({});
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (!open || !barId) return;
    (async () => {
      const base = await fetch(`/api/bars/${barId}`).then(r=>r.json());
      setBar(base.bar ?? null); setAgg(base.aggregates ?? null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const det = await fetch(`/api/bars/${barId}/details`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).then(r=>r.json());
      setDetails(det);
    })();
  }, [open, barId, supabase]);

  const lastVisit = details.my_last_visit ? new Date(details.my_last_visit).toLocaleDateString() : '—';
  const myTop: any[] = details.my_top ?? [];
  const community: any[] = details.community ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-screen-sm w-full mx-auto h-[90vh] p-0 rounded-t-3xl overflow-hidden">
        {/* Provide an accessible title for Dialog */}
        <SheetHeader>
          <VisuallyHidden>
            <SheetTitle>{bar?.name ?? 'Bar'}</SheetTitle>
          </VisuallyHidden>
        </SheetHeader>

        {/* Hero */}
        <div className="bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 text-white p-5">
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
        <div className="p-4 space-y-4">
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

          <div className="grid grid-cols-5 gap-2 text-stone-700">
            <div className="bg-stone-50 border rounded-xl p-3 flex flex-col items-center text-xs"><Music className="mb-1" size={18}/>Music</div>
            <div className="bg-stone-50 border rounded-xl p-3 flex flex-col items-center text-xs"><Lamp className="mb-1" size={18}/>Lighting</div>
            <div className="bg-stone-50 border rounded-xl p-3 flex flex-col items-center text-xs"><Users className="mb-1" size={18}/>Crowd</div>
            <div className="bg-stone-50 border rounded-xl p-3 flex flex-col items-center text-xs"><Paintbrush className="mb-1" size={18}/>Decor</div>
            <div className="bg-stone-50 border rounded-xl p-3 flex flex-col items-center text-xs"><Star className="mb-1" size={18}/>Overall</div>
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
