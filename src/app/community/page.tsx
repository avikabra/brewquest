'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Item { checkin: any; bar: any; user: any; likes_count: number; liked_by_me: boolean; }

export default function CommunityPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supa = supabaseBrowser();
      const { data: { session } } = await supa.auth.getSession();
      if (!session) return; setToken(session.access_token);
      const res = await fetch('/api/community/activity?limit=50', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json().catch(()=>({ items: [] }));
      setItems(j.items || []);
    })();
  }, []);

  const toggleLike = async (id: string, liked: boolean) => {
    if (!token) return;
    await fetch(`/api/checkins/like${liked?'?checkin_id='+id:''}`, { method: liked ? 'DELETE':'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: liked?undefined:JSON.stringify({ checkin_id: id }) });
    setItems(it=> it.map(x => x.checkin.id===id ? { ...x, liked_by_me: !liked, likes_count: x.likes_count + (liked?-1:1)} : x));
  };

  return <div className="p-4 space-y-3">
    <h1 className="text-xl font-semibold">Community</h1>
    {items.map(a => (
      <Card key={a.checkin.id} className="rounded-2xl">
        <CardContent className="p-4 space-y-1">
          <div className="text-sm text-stone-500">{new Date(a.checkin.created_at).toLocaleString()}</div>
          <div className="font-medium">{a.user.username || 'User'} @ {a.bar.name}</div>
          <div className="text-sm">{a.checkin.beer_name || 'Drink'} · Overall {a.checkin.overall ?? '—'}</div>
          <Button size="sm" variant={a.liked_by_me ? 'secondary':'outline'} onClick={()=>toggleLike(a.checkin.id, a.liked_by_me)}>
            {a.liked_by_me ? 'Unlike':'Like'} ({a.likes_count})
          </Button>
        </CardContent>
      </Card>
    ))}
    {!items.length && <div className="text-sm text-stone-600">No community activity yet.</div>}
  </div>;
}
