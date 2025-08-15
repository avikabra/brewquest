'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

const keys = ['taste','bitterness','aroma','smoothness','carbonation','temperature','music','lighting','crowd_vibe','cleanliness','decor'] as const;
type Key = typeof keys[number];
type Bar = { id: string; name: string };

export default function CheckinPage() {
  const sp = useSearchParams();
  const barId = sp.get('barId') ?? '';
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof supabaseBrowser> | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') setSupabase(supabaseBrowser());
  }, []);

  const [beerName, setBeerName] = useState('');
  const [description, setDescription] = useState('');
  const [companyType, setCompanyType] = useState('friends');
  const [groupSize, setGroupSize] = useState(2);
  const [beersAlready, setBeersAlready] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState<number>(new Date().getDay());
  const [ratings, setRatings] = useState<Record<Key, number>>(() =>
    keys.reduce((acc, k) => ({ ...acc, [k]: 5 }), {} as Record<Key, number>)
  );
  const [overall, setOverall] = useState<number | null>(null);
  const [aiReview, setAiReview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  useEffect(() => {
    if (!barId) alert('Missing barId in URL. Example: /checkin?barId=<uuid>');
  }, [barId]);

  const generateAI = async () => {
    setAiLoading(true);
    if (!supabase) { setAiLoading(false); return alert('Please wait…'); }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setAiLoading(false); return alert('Not signed in'); }

    const res = await fetch('/api/ai/categorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        context: { day_of_week: dayOfWeek, group_size: groupSize, company_type: companyType, beers_already: beersAlready },
        beerMeta: { name: beerName || undefined }
      })
    });
    
    setAiLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(()=>({ error: 'AI error' }));
      return alert(`AI failed: ${j.error}`);
    }
    const j = await res.json();
    if (j?.ratings) setRatings((r)=>({ ...r, ...j.ratings }));
    if (Number.isFinite(j?.overall)) setOverall(j.overall);
    if (j?.ai_review) setAiReview(j.ai_review);
  };

  const save = async () => {
    setSaving(true);
    if (!supabase) { setSaving(false); return alert('Please wait…'); }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setSaving(false); return alert('Not signed in'); }

    // Upload images first
    let paths = uploadedPaths;
    if (images.length && !paths.length) {
      setUploading(true);
      const ups: string[] = [];
      for (const f of images.slice(0,6)) {
        const name = `${session!.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}_${f.name.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`;
        const { error: upErr } = await supabase.storage.from('checkin-images').upload(name, f, { upsert: false });
        if (upErr) { console.warn('upload failed', upErr.message); continue; }
        ups.push(name);
      }
      setUploadedPaths(ups);
      paths = ups;
      setUploading(false);
    }

    const payload = {
      bar_id: barId,
      beer_name: beerName || undefined,
      description: description || undefined,
      ratings,
      context: {
        day_of_week: dayOfWeek,
        group_size: groupSize,
        company_type: companyType,
        beers_already: beersAlready
      },
      overall: overall ?? undefined,
      ai_review: aiReview || undefined,
      ai_model: 'gpt-5'
    };
  if (paths.length) (payload as any).image_paths = paths;

    const res = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (res.ok) {
      alert('Check-in saved!');
      router.push('/me');
    } else {
      const j = await res.json().catch(()=>({}));
      alert(`Save failed: ${j.error ?? res.statusText}`);
    }
  };

  const [bar, setBar] = useState<Bar | null>(null);

  useEffect(() => {
    if (!barId) return;
    (async () => {
      const j = await fetch(`/api/bars/${barId}`).then(r=>r.json());
      setBar(j.bar ?? null);
    })();
  }, [barId]);

  return (
    <div className="p-1 space-y-3">
      <div className="flex items-center">
        <Link href="/map" className="text-sky-600 text-sm">← Back to Map</Link>
      </div>

      <div className="text-center text-lg font-semibold">{bar?.name ?? 'Bar'}</div>
      
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <Input placeholder="Beer name" value={beerName} onChange={(e)=>setBeerName(e.target.value)} />
          <Textarea placeholder="Describe taste, aroma, ambiance..." value={description} onChange={(e)=>setDescription(e.target.value)} />
          <div>
            <div className="text-xs mb-1">Photos (max 6)</div>
            <Input type="file" multiple accept="image/*" onChange={e=> setImages(Array.from(e.target.files||[]).slice(0,6))} />
            {images.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">
              {images.map((img,i)=> <div key={i} className="text-[10px] truncate border p-1 rounded-lg bg-stone-50">{img.name}</div> )}
            </div>}
            {uploadedPaths.length > 0 && <div className="mt-2 text-xs text-emerald-600">{uploadedPaths.length} uploaded.</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
                <div className="text-xs mb-1">Day of week</div>
                <Select value={String(dayOfWeek)} onValueChange={(v)=>setDayOfWeek(Number(v))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Day" /></SelectTrigger>
                <SelectContent>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>(
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>

            <div>
                <div className="text-xs mb-1">Group size</div>
                <Select value={String(groupSize)} onValueChange={(v)=>setGroupSize(Number(v))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Group size" /></SelectTrigger>
                <SelectContent>
                    {Array.from({length:10},(_,i)=>i+1).map(n=>(
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>

            <div>
                <div className="text-xs mb-1">Company</div>
                <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Company" /></SelectTrigger>
                <SelectContent>
                    {['solo','friends','date','coworkers','family'].map(c=>(
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>

            <div>
                <div className="text-xs mb-1">Beers so far</div>
                <Select value={String(beersAlready)} onValueChange={(v)=>setBeersAlready(Number(v))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="0" /></SelectTrigger>
                <SelectContent>
                    {Array.from({length:21},(_,i)=>i).map(n=>(
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            </div>
          <div className="grid gap-3">
            {keys.map(k => (
              <div key={k} className="flex items-center gap-3">
                <div className="w-36 capitalize">{k.replace('_',' ')}</div>
                <Slider value={[ratings[k]]} min={0} max={10} step={1}
                        onValueChange={(v)=>setRatings(r => ({...r, [k]: v[0]}))}/>
                <span className="w-6 text-right">{ratings[k]}</span>
              </div>
            ))}
          </div>

          <div className="text-sm text-stone-600">
            {overall !== null && <>Overall suggestion: <b>{overall}</b></>}
            {aiReview && <div className="mt-1">AI: {aiReview}</div>}
          </div>

          <div className="flex gap-2">
            <Button onClick={generateAI} className="rounded-xl" type="button" disabled={aiLoading}>
              {aiLoading ? 'Generating…' : 'Generate AI ratings'}
            </Button>
            <Button onClick={save} variant="secondary" className="rounded-xl" disabled={saving || uploading}>{saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
