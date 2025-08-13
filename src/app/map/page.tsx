'use client';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import BarSheet from '@/components/BarSheet';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Bar = { id: string; name: string; address?: string | null; lat: number; lng: number };

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map>();
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      p => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords({ lat: 40.7128, lng: -74.0060 })
    );
  }, []);

  useEffect(() => {
    if (!coords || map.current) return;
    map.current = new mapboxgl.Map({
      container: mapRef.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [coords.lng, coords.lat],
      zoom: 13
    });

    (async () => {
      const res = await fetch(`/api/bars/nearby?lat=${coords.lat}&lng=${coords.lng}&limit=20`);
      const { bars } = await res.json();
      (bars as Bar[]).forEach((b) => {
        const marker = new mapboxgl.Marker().setLngLat([b.lng, b.lat]).addTo(map.current!);
        marker.getElement().addEventListener('click', () => { setSelected(b.id); setOpen(true); });
      });
    })();
  }, [coords]);

  return (
    <>
      <Card className="p-0 rounded-none md:rounded-2xl"><div ref={mapRef} className="w-full h-[calc(100dvh-64px)]" /></Card>
      <BarSheet barId={selected} open={open} onOpenChange={setOpen}/>
    </>
  );
}
