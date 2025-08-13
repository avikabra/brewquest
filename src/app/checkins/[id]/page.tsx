'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Star } from 'lucide-react';

type Checkin = {
  id: string; created_at: string;
  beer_name: string | null; description: string | null; ai_review: string | null; ai_model: string | null;
  taste:number|null; bitterness:number|null; aroma:number|null; smoothness:number|null; carbonation:number|null; temperature:number|null;
  music:number|null; lighting:number|null; crowd_vibe:number|null; cleanliness:number|null; decor:number|null;
  day_of_week:number|null; group_size:number|null; company_type:string|null; beers_already:number|null;
  overall:number|null;
  bars?: { id:string; name:string; address:string|null };
};

export default function CheckinDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<Checkin | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/checkins/${params.id}`);
      if (res.ok) {
        const j = await res.json();
        setC(j.checkin);
      }
    })();
  }, [params.id]);

  if (!c) return <div>Loading…</div>;

  const factors = [
    ['taste', c.taste], ['bitterness', c.bitterness], ['aroma', c.aroma], ['smoothness', c.smoothness], ['carbonation', c.carbonation], ['temperature', c.temperature],
    ['music', c.music], ['lighting', c.lighting], ['crowd vibe', c.crowd_vibe], ['cleanliness', c.cleanliness], ['decor', c.decor],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={()=>router.back()}>← Back</Button>
        <div className="text-center flex-1">
          <div className="text-xs text-stone-500">{c.bars?.name ?? 'Bar'} {c.bars?.address ? `• ${c.bars.address}`:''}</div>
          <h1 className="text-lg font-semibold">{c.beer_name ?? 'Untitled beer'}</h1>
        </div>
        <div className="w-16" />
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="text-sm opacity-70">{new Date(c.created_at).toLocaleString()}</div>
          <div className="mt-1 flex items-center gap-1 text-sky-700"><Star size={18}/><span className="text-lg font-semibold">{c.overall ?? '—'}</span></div>
          {c.ai_review && <div className="text-sm mt-2">{c.ai_review}</div>}
          {c.description && <div className="text-sm text-stone-700 mt-2">{c.description}</div>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="font-medium mb-2">Ratings</div>
          <div className="grid grid-cols-1 gap-2">
            {factors.map(([k,v])=>(
              <div key={k} className="flex items-center gap-3">
                <div className="w-36 capitalize">{k}</div>
                <div className="h-2 bg-stone-200 rounded-full flex-1 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${((v ?? 0)/10)*100}%` }} />
                </div>
                <div className="w-8 text-right">{v ?? '—'}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Link href={`/checkin?barId=${c.bars?.id}`} className="w-full">
          <Button className="w-full rounded-xl">Check in again</Button>
        </Link>
      </div>
    </div>
  );
}
