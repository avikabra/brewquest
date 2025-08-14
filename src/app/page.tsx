'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Map, Plus, BarChart3, Star } from 'lucide-react';

type Stats = { total: number; uniqueBars: number; uniqueBeers: number; byDay: { d: string | Date; c: number }[]; recent: any[] };
type TopBar = { bar_id: string; name: string; address?: string | null; count: number; avg: number };

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topBars, setTopBars] = useState<TopBar[]>([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.replace('/sign-in');
        return;
      }
      const [s, t] = await Promise.all([
        fetch('/api/me/stats', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.ok?r.json():null),
        fetch('/api/me/top-bars', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.ok?r.json():{ top:[] })
      ]);
      if (s) setStats(s);
      setTopBars(t.top ?? []);
    })();
  }, []);

  const Spark = ({ points }: { points: number[] }) => {
    const w = 160, h = 40, pad = 6;
    const max = Math.max(1, ...points);
    const step = (w - pad*2) / Math.max(1, points.length - 1);
    const y = (v: number) => h - pad - (v / max) * (h - pad*2);
    const path = points.map((v,i)=>`${i===0?'M':'L'} ${pad + i*step} ${y(v)}`).join(' ');
    return <svg width={w} height={h} className="block"><path d={path} fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-gradient-to-r from-sky-100 to-indigo-100 border text-stone-800">
        <div className="text-sm">Welcome back 👋</div>
        <div className="text-xl font-semibold">Your BeerBuddy at a glance</div>
        <div className="mt-3 flex gap-2">
          <Link href="/map"><Button className="rounded-xl"><Map className="mr-2" size={16}/>Map</Button></Link>
          <Link href="/checkin"><Button variant="secondary" className="rounded-xl"><Plus className="mr-2" size={16}/>Quick check-in</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs text-stone-500">Total check-ins</div><div className="text-2xl font-semibold">{stats?.total ?? '—'}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs text-stone-500">Unique bars</div><div className="text-2xl font-semibold">{stats?.uniqueBars ?? '—'}</div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><div className="text-xs text-stone-500">Unique beers</div><div className="text-2xl font-semibold">{stats?.uniqueBeers ?? '—'}</div></CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">Last 7 days</div>
            <BarChart3 size={16} className="text-stone-500"/>
          </div>
          <div className="mt-2 text-stone-700">
            <Spark points={(stats?.byDay ?? []).map(d=>d.c)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="font-medium mb-2">Top bars</div>
          {topBars.length ? (
            <ul className="space-y-2">
              {topBars.map(tb => (
                <li key={tb.bar_id} className="border rounded-xl p-3 bg-stone-50 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{tb.name}</div>
                    <div className="text-xs text-stone-600">{tb.address ?? ''}</div>
                    <div className="text-xs mt-1">{tb.count} check-ins</div>
                  </div>
                  <div className="flex items-center gap-1 text-sky-700">
                    <Star size={16} /><span className="text-sm">{tb.avg}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-stone-600">No favorites yet — go explore!</div>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="font-medium mb-2">Recent check-ins</div>
          {(stats?.recent ?? []).length ? (
            <ul className="space-y-2">
              {stats!.recent.map((r:any)=>(
                <li key={r.id} className="border rounded-xl p-3 bg-stone-50">
                  <div className="text-sm opacity-70">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="font-medium">{r.beer_name ?? 'Untitled'}</div>
                  <div className="text-sm">Overall: {r.overall ?? '—'}</div>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-stone-600">No recent activity yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
