'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Friend { user_id: string; username?: string | null; since?: string | null }
interface ActivityItem { checkin: any; bar: any; user: any; likes_count: number; liked_by_me: boolean }

export default function FriendsPage() {
  const [tab, setTab] = useState<'activity'|'find'|'requests'>('activity');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState({ activity: false, friends: false, search: false, requests: false });
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => { (async () => {
    const supa = supabaseBrowser();
    const { data: { session } } = await supa.auth.getSession();
  if (!session) return;
  setToken(session.access_token);
  setMyUserId(session.user.id);
    loadFriends(session.access_token); loadActivity(session.access_token); loadRequests(session.access_token);
  })(); }, []);

  const loadFriends = async (t: string) => {
    setLoading(l => ({ ...l, friends: true }));
    const res = await fetch('/api/friends/list', { headers: { Authorization: `Bearer ${t}` } });
    const j = await res.json().catch(()=>({ friends: [] }));
    setFriends(j.friends || []); setLoading(l => ({ ...l, friends: false }));
  };
  const loadActivity = async (t: string) => {
    setLoading(l => ({ ...l, activity: true }));
    const res = await fetch('/api/friends/activity?limit=20', { headers: { Authorization: `Bearer ${t}` } });
    const j = await res.json().catch(()=>({ items: [] }));
    setActivity(j.items || []); setLoading(l => ({ ...l, activity: false }));
  };
  const loadRequests = async (t: string) => {
    setLoading(l => ({ ...l, requests: true }));
    // naive: fetch friend edges and filter client-side
    const supa = supabaseBrowser();
  const { data } = await supa.from('friend_edges').select('*');
    setRequests((data||[]).filter(r => r.status === 'pending'));
    setLoading(l => ({ ...l, requests: false }));
  };

  const doSearch = async (q: string) => {
    if (!token) return; setLoading(l=>({...l, search:true}));
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json().catch(()=>({ users: [] }));
    setResults(j.users||[]); setLoading(l=>({...l, search:false}));
  };

  const sendRequest = async (to: string) => {
    if (!token) return; await fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to_user: to }) });
    loadRequests(token); loadFriends(token);
  };
  const respond = async (id: string, action: 'accept'|'reject'|'block') => {
    if (!token) return; await fetch('/api/friends/respond', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_id: id, action }) });
    loadRequests(token); loadFriends(token);
  };
  const toggleLike = async (checkin_id: string, liked: boolean) => {
    if (!token) return; await fetch(`/api/checkins/like${liked?'?checkin_id='+checkin_id:''}`, { method: liked ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: liked ? undefined : JSON.stringify({ checkin_id }) });
    loadActivity(token);
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Friends</h1>
      <Tabs value={tab} onValueChange={v=>setTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 rounded-xl">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="find">Find Friends</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-4 space-y-3">
          {activity.map(a => (
            <Card key={a.checkin.id} className="rounded-2xl">
              <CardContent className="p-4 space-y-1">
                <div className="text-sm text-stone-500">{new Date(a.checkin.created_at).toLocaleString()}</div>
                <div className="font-medium">{a.user.username || 'Friend'} had {a.checkin.beer_name || 'a drink'} at {a.bar.name}</div>
                <div className="text-sm">Overall: {a.checkin.overall ?? '—'}</div>
                <Button size="sm" variant={a.liked_by_me ? 'secondary':'outline'} onClick={()=>toggleLike(a.checkin.id, a.liked_by_me)}>
                  {a.liked_by_me ? 'Unlike' : 'Like'} ({a.likes_count})
                </Button>
              </CardContent>
            </Card>
          ))}
          {!activity.length && <div className="text-sm text-stone-600">No activity yet.</div>}
        </TabsContent>
        <TabsContent value="find" className="mt-4 space-y-3">
          <div className="flex gap-2"><Input value={search} onChange={e=>{setSearch(e.target.value); if (e.target.value.length>=2) doSearch(e.target.value);}} placeholder="Search username" /> <Button onClick={()=>doSearch(search)} disabled={!search}>Search</Button></div>
          <ul className="space-y-2">
            {results.map(r => {
              const isFriend = friends.some(f => f.user_id === r.user_id);
              return <li key={r.user_id} className="flex items-center justify-between border rounded-xl p-3">
                <button disabled={isFriend} onClick={()=>!isFriend && sendRequest(r.user_id)} className="text-left flex-1">
                  <div className="font-medium">{r.username || 'User'}</div>
                  <div className="text-xs text-stone-500">Tap to {isFriend ? 'connected' : 'send friend request'}</div>
                </button>
                <Button size="sm" variant="secondary" disabled={isFriend} onClick={()=>sendRequest(r.user_id)}>{isFriend ? 'Friends' : 'Add'}</Button>
              </li>;
            })}
          </ul>
        </TabsContent>
        <TabsContent value="requests" className="mt-4 space-y-3">
          {requests.filter(r => r.status==='pending').map(r => {
            const incoming = r.friend_id === myUserId; // someone sent to me
            return <Card key={r.id} className="rounded-2xl"><CardContent className="p-4 flex items-center justify-between"><div className="font-medium">{incoming ? 'Incoming request' : 'Sent request'}</div><div className="flex gap-2">{incoming ? <><Button size="sm" onClick={()=>respond(r.id,'accept')}>Accept</Button><Button size="sm" variant="outline" onClick={()=>respond(r.id,'reject')}>Reject</Button></> : <Button size="sm" variant="outline" onClick={()=>respond(r.id,'reject')}>Cancel</Button>}</div></CardContent></Card>;
          })}
          {!requests.filter(r=>r.status==='pending').length && <div className="text-sm text-stone-600">No pending requests.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
