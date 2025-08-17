'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Star, Plus, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Checkin = {
  id: string; created_at: string; user_id: string;
  beer_name: string | null; description: string | null; ai_review: string | null; ai_model: string | null;
  taste:number|null; bitterness:number|null; aroma:number|null; smoothness:number|null; carbonation:number|null; temperature:number|null;
  music:number|null; lighting:number|null; crowd_vibe:number|null; cleanliness:number|null; decor:number|null;
  day_of_week:number|null; group_size:number|null; company_type:string|null; beers_already:number|null;
  overall:number|null; image_paths?: string[] | null;
  bars?: { id:string; name:string; address:string|null };
};

export default function CheckinDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<Checkin | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/checkins/${params.id}`);
      if (res.ok) {
        const j = await res.json();
        setC(j.checkin);
        
        // Check if current user owns this checkin
        const supa = supabaseBrowser();
        const { data: { session } } = await supa.auth.getSession();
        setIsOwner(session?.user.id === j.checkin.user_id);
      }
    })();
  }, [params.id]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    setNewImages(prev => [...prev, ...validFiles].slice(0, 6));
  };

  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imagePath: string) => {
    if (!c || !isOwner) return;
    const updatedPaths = (c.image_paths || []).filter(p => p !== imagePath);
    await updateImages(updatedPaths);
  };

  const updateImages = async (imagePaths: string[]) => {
    const supa = supabaseBrowser();
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/checkins/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ image_paths: imagePaths })
    });

    if (res.ok) {
      setC(prev => prev ? { ...prev, image_paths: imagePaths } : null);
    }
  };

  const uploadAndSave = async () => {
    if (!c || !isOwner || !newImages.length) return;
    
    setUploading(true);
    const supa = supabaseBrowser();
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    // Upload new images
    const uploadedPaths: string[] = [];
    for (const file of newImages) {
      const name = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { error } = await supa.storage.from('checkin-images').upload(name, file);
      if (!error) uploadedPaths.push(name);
    }

    // Update checkin with all image paths
    const allPaths = [...(c.image_paths || []), ...uploadedPaths];
    await updateImages(allPaths);
    
    setNewImages([]);
    setEditing(false);
    setUploading(false);
  };

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

      {/* Images Section */}
      {(c.image_paths?.length || isOwner) && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Photos</div>
              {isOwner && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setEditing(!editing)}
                  className="rounded-xl"
                >
                  {editing ? 'Cancel' : 'Edit'}
                </Button>
              )}
            </div>

            {/* Existing Images */}
            {c.image_paths && c.image_paths.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {c.image_paths.map((path, i) => (
                  <div key={path} className="relative">
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/checkin-images/${path}`}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-32 object-cover rounded-xl border"
                    />
                    {editing && (
                      <button
                        onClick={() => removeExistingImage(path)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New Images (editing mode) */}
            {editing && newImages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {newImages.map((file, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`New ${i + 1}`}
                      className="w-full h-32 object-cover rounded-xl border border-blue-200"
                    />
                    <button
                      onClick={() => removeNewImage(i)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                      New
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Photos (editing mode) */}
            {editing && (c.image_paths || []).length + newImages.length < 6 && (
              <div className="mb-3">
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-stone-400">
                  <Plus size={24} className="text-stone-400" />
                  <span className="text-sm text-stone-600 mt-1">Add photos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={e => addImages(e.target.files)}
                  />
                </label>
              </div>
            )}

            {/* Save Changes */}
            {editing && newImages.length > 0 && (
              <Button
                onClick={uploadAndSave}
                disabled={uploading}
                className="w-full rounded-xl"
              >
                {uploading ? 'Uploading...' : 'Save Changes'}
              </Button>
            )}

            {/* Empty state for non-owner */}
            {!c.image_paths?.length && !isOwner && (
              <div className="text-sm text-stone-600">No photos yet.</div>
            )}
          </CardContent>
        </Card>
      )}

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
