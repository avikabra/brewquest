-- Migration: add image support to checkins
alter table public.checkins add column if not exists image_paths text[] not null default '{}';
comment on column public.checkins.image_paths is 'Array of storage object paths (bucket: checkin-images) for photos attached to this checkin';

-- (Optional) Create storage bucket manually if not present:
-- insert into storage.buckets (id, name, public) values ('checkin-images','checkin-images', true)
--   on conflict (id) do nothing;
-- Ensure public read policy (adjust as needed for privacy):
-- create policy "Public read checkin images" on storage.objects for select using ( bucket_id = 'checkin-images' );
-- create policy "Owner can upload checkin images" on storage.objects for insert with check (
--   bucket_id = 'checkin-images' and auth.role() = 'authenticated'
-- );
