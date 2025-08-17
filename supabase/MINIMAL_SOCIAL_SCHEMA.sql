-- MINIMAL SOCIAL TABLES ADDITION
-- Run this in Supabase SQL Editor to add missing social tables
-- This assumes image_paths already exists on checkins table

-- 1. Create friend_edges table (new social feature)
CREATE TABLE IF NOT EXISTS public.friend_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

-- 2. Create checkin_likes table (new social feature)
CREATE TABLE IF NOT EXISTS public.checkin_likes (
  checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (checkin_id, user_id)
);

-- 3. Add AI summary columns to bars table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bars' AND column_name = 'ai_summary') THEN
        ALTER TABLE public.bars ADD COLUMN ai_summary TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bars' AND column_name = 'summary_updated_at') THEN
        ALTER TABLE public.bars ADD COLUMN summary_updated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bars' AND column_name = 'aggregate_scores') THEN
        ALTER TABLE public.bars ADD COLUMN aggregate_scores JSONB;
    END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS friend_edges_user_id_idx ON public.friend_edges(user_id);
CREATE INDEX IF NOT EXISTS friend_edges_friend_id_idx ON public.friend_edges(friend_id);
CREATE INDEX IF NOT EXISTS friend_edges_status_idx ON public.friend_edges(status);
CREATE INDEX IF NOT EXISTS checkin_likes_user_idx ON public.checkin_likes(user_id);

-- 5. Enable RLS on new tables
ALTER TABLE public.friend_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_likes ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for friend_edges
CREATE POLICY "friend_edges_select_participant" ON public.friend_edges FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "friend_edges_insert_self" ON public.friend_edges FOR INSERT WITH CHECK (
  auth.uid() = user_id AND user_id <> friend_id
);
CREATE POLICY "friend_edges_update_participant" ON public.friend_edges FOR UPDATE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
) WITH CHECK (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "friend_edges_delete_participant" ON public.friend_edges FOR DELETE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- 7. RLS policies for checkin_likes
CREATE POLICY "checkin_likes_select_visible" ON public.checkin_likes FOR SELECT USING (true);
CREATE POLICY "checkin_likes_insert_self" ON public.checkin_likes FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.checkins c WHERE c.id = checkin_id)
);
CREATE POLICY "checkin_likes_delete_self" ON public.checkin_likes FOR DELETE USING (auth.uid() = user_id);

-- 8. Update checkins RLS policy to allow community access
DROP POLICY IF EXISTS "checkins_read_own_and_friends" ON public.checkins;
CREATE POLICY "checkins_read_community" ON public.checkins FOR SELECT USING (true);

-- 9. Ensure profiles are readable for community features
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
