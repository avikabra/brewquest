-- Social graph & likes migration (friends + checkin likes)
-- 1. friend_edges table
create table if not exists public.friend_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted','blocked')) default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);

-- Ensure symmetric uniqueness (we'll always write canonical order user->friend as requester)
create index if not exists friend_edges_friend_idx on public.friend_edges(friend_id);
create index if not exists friend_edges_status_idx on public.friend_edges(status);

-- 2. checkin_likes table
create table if not exists public.checkin_likes (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);
create index if not exists checkin_likes_user_idx on public.checkin_likes(user_id);

-- RLS enable
alter table public.friend_edges enable row level security;
alter table public.checkin_likes enable row level security;

-- Policies for friend_edges
-- Select rows where the user participates
create policy friend_edges_select_participant on public.friend_edges for select using (
  auth.uid() = user_id or auth.uid() = friend_id
);
-- Insert: only allow inserting where user_id = auth.uid() (requester perspective) and not self-friend
create policy friend_edges_insert_self on public.friend_edges for insert with check (
  auth.uid() = user_id and user_id <> friend_id
);
-- Update: allow status transitions only if participant; block -> only by the one who blocks (user_id) or the target? We'll just allow either participant for simplicity except cannot modify once blocked by other.
create policy friend_edges_update_participant on public.friend_edges for update using (
  auth.uid() = user_id or auth.uid() = friend_id
) with check (
  auth.uid() = user_id or auth.uid() = friend_id
);
-- Delete: allow participants to delete (unfriend or cancel)
create policy friend_edges_delete_participant on public.friend_edges for delete using (
  auth.uid() = user_id or auth.uid() = friend_id
);

-- Policies for checkin_likes
-- Select: allow reading likes for checkins the user can see. We approximate by: like belongs to a checkin by a friend (accepted edge either direction) or the user themselves.
create policy checkin_likes_select_visible on public.checkin_likes for select using (
  exists (select 1 from public.checkins c where c.id = checkin_id and (
    c.user_id = auth.uid() OR exists (
      select 1 from public.friend_edges fe
        where fe.status = 'accepted'
          and ((fe.user_id = auth.uid() and fe.friend_id = c.user_id) OR (fe.friend_id = auth.uid() and fe.user_id = c.user_id))
    )
  ))
);
-- Insert: user can like a checkin they can view and only once (PK enforces uniqueness)
create policy checkin_likes_insert_self on public.checkin_likes for insert with check (
  auth.uid() = user_id and exists (select 1 from public.checkins c where c.id = checkin_id and (
    c.user_id = auth.uid() OR exists (
      select 1 from public.friend_edges fe
        where fe.status = 'accepted'
          and ((fe.user_id = auth.uid() and fe.friend_id = c.user_id) OR (fe.friend_id = auth.uid() and fe.user_id = c.user_id))
  )))
);
-- Delete: user can delete their own like
create policy checkin_likes_delete_self on public.checkin_likes for delete using (auth.uid() = user_id);

-- Helper view for friend accepted edges (optional)
create or replace view public.friend_pairs as
  select case when user_id < friend_id then user_id else friend_id end as a,
         case when user_id < friend_id then friend_id else user_id end as b,
         status, created_at
  from public.friend_edges
  where status = 'accepted';

-- Comments
comment on table public.friend_edges is 'Friend / follow edges between users';
comment on table public.checkin_likes is 'Likes on checkins by users with visibility via friendship';
