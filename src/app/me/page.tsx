'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Row = {
  id: string;
  beer_name: string | null;
  ai_review: string | null;
  overall: number | null;
  created_at: string;
  bar_id: string;
  bars?: { name?: string | null; address?: string | null };
};

export default function MePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = supabaseBrowser();

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return setRows([]);
    const res = await fetch('/api/me/checkins', { headers: { Authorization: `Bearer ${token}` }});
    const j = await res.json();
    setRows(j.rows ?? []);
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/checkins/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setLoading(false);
    if (res.ok) setRows(r => r.filter(x => x.id !== id));
    else {
      const j = await res.json().catch(()=>({}));
      alert(`Delete failed: ${j.error ?? res.statusText}`);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">My Check-ins</h1>
      {rows.map(r => (
        <Card key={r.id} className="rounded-2xl">
          <CardContent className="p-4 space-y-1">
            <div className="text-sm opacity-70">{new Date(r.created_at).toLocaleString()}</div>
            <div className="font-medium">{r.beer_name ?? 'Untitled beer'}</div>
            <div className="text-sm text-stone-600">Bar: {r.bars?.name ?? 'Unknown'} {r.bars?.address ? `• ${r.bars.address}` : ''}</div>
            <div className="text-sm">Overall: {r.overall ?? '—'}</div>
            {r.ai_review && <div className="text-sm text-stone-600">{r.ai_review}</div>}
            <div className="pt-2 flex gap-2">
              <Link href={`/checkins/${r.id}`} className="grow">
                <Button size="sm" className="w-full rounded-xl" variant="secondary">Open</Button>
              </Link>
              <Button variant="destructive" size="sm" onClick={()=>del(r.id)} disabled={loading} className="rounded-xl">Delete</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {!rows.length && <div className="text-sm text-stone-600">No check-ins yet.</div>}
    </div>
  );
}
