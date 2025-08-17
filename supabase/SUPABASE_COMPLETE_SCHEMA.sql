-- SOCIAL FEATURES ADDITION - Run this in Supabase SQL Editor
-- This adds social features (friends, likes, images) to existing BrewQuest schema
-- Preserves all existing data and tables

-- 1. Add image support to existing checkins table
-- Check if column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'checkins' AND column_name = 'image_paths') THEN
        ALTER TABLE public.checkins ADD COLUMN image_paths TEXT[] NOT NULL DEFAULT '{}';
    END IF;
END $$;

-- Add comment for new column
COMMENT ON COLUMN public.checkins.image_paths IS 'Array of storage object paths for photos';

-- Add AI summary and aggregates to bars table
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

COMMENT ON COLUMN public.bars.ai_summary IS 'AI-generated summary of bar atmosphere and experience';
COMMENT ON COLUMN public.bars.aggregate_scores IS 'Cached aggregate scores for different attributes';
COMMENT ON COLUMN public.bars.summary_updated_at IS 'When AI summary was last updated';

-- 2. Create friend_edges table (new social feature)
CREATE TABLE IF NOT EXISTS public.friend_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

-- 3. Create checkin_likes table (new social feature)
CREATE TABLE IF NOT EXISTS public.checkin_likes (
  checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (checkin_id, user_id)
);

-- 4. Create indexes for new tables and existing optimization
CREATE INDEX IF NOT EXISTS checkins_created_at_idx ON public.checkins(created_at DESC);
CREATE INDEX IF NOT EXISTS friend_edges_user_id_idx ON public.friend_edges(user_id);
CREATE INDEX IF NOT EXISTS friend_edges_friend_id_idx ON public.friend_edges(friend_id);
CREATE INDEX IF NOT EXISTS friend_edges_status_idx ON public.friend_edges(status);
CREATE INDEX IF NOT EXISTS checkin_likes_user_idx ON public.checkin_likes(user_id);

-- 5. Enable RLS on new tables (existing tables may already have RLS enabled)
ALTER TABLE public.friend_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_likes ENABLE ROW LEVEL SECURITY;

-- 6. Update RLS policies for existing tables (only if they don't exist or need updating)

-- Ensure existing tables have proper RLS policies for social features
-- Profiles: allow all users to read (for friend search), own users to modify
DO $$
BEGIN
    -- Drop and recreate profiles policies to ensure they support friend search
    DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
    CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
    CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
END $$;

-- Bars: ensure public read access
DO $$
BEGIN
    DROP POLICY IF EXISTS "bars_read_all" ON public.bars;
    DROP POLICY IF EXISTS "bars_insert_authenticated" ON public.bars;
    DROP POLICY IF EXISTS "bars_update_authenticated" ON public.bars;
    CREATE POLICY "bars_read_all" ON public.bars FOR SELECT USING (true);
    CREATE POLICY "bars_insert_authenticated" ON public.bars FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY "bars_update_authenticated" ON public.bars FOR UPDATE USING (auth.role() = 'authenticated');
END $$;

-- Checkins: allow reading own checkins + friends' checkins for social features
DO $$
BEGIN
    DROP POLICY IF EXISTS "checkins_read_own_and_friends" ON public.checkins;
    DROP POLICY IF EXISTS "checkins_insert_own" ON public.checkins;
    DROP POLICY IF EXISTS "checkins_update_own" ON public.checkins;
    DROP POLICY IF EXISTS "checkins_delete_own" ON public.checkins;
    
    -- Allow reading own checkins OR friends' checkins OR all for community feed
    CREATE POLICY "checkins_read_own_and_friends" ON public.checkins FOR SELECT USING (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.friend_edges fe
        WHERE fe.status = 'accepted'
          AND ((fe.user_id = auth.uid() AND fe.friend_id = checkins.user_id) 
               OR (fe.friend_id = auth.uid() AND fe.user_id = checkins.user_id))
      ) OR true -- Allow community feed access
    );
    CREATE POLICY "checkins_insert_own" ON public.checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "checkins_update_own" ON public.checkins FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "checkins_delete_own" ON public.checkins FOR DELETE USING (auth.uid() = user_id);
END $$;

-- 7. Create RLS policies for new social tables

-- Friend edges policies
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

-- Checkin likes policies
CREATE POLICY "checkin_likes_select_visible" ON public.checkin_likes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.checkins c WHERE c.id = checkin_id AND (
    c.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.friend_edges fe
        WHERE fe.status = 'accepted'
          AND ((fe.user_id = auth.uid() AND fe.friend_id = c.user_id) OR (fe.friend_id = auth.uid() AND fe.user_id = c.user_id))
    ) OR true -- Allow community access
  ))
);
CREATE POLICY "checkin_likes_insert_self" ON public.checkin_likes FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.checkins c WHERE c.id = checkin_id)
);
CREATE POLICY "checkin_likes_delete_self" ON public.checkin_likes FOR DELETE USING (auth.uid() = user_id);

-- 8. Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('checkin-images','checkin-images', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies for images
CREATE POLICY "Public read checkin images" ON storage.objects 
FOR SELECT USING (bucket_id = 'checkin-images');
CREATE POLICY "Owner can upload checkin images" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'checkin-images' 
  AND auth.role() = 'authenticated'
  AND (auth.uid()::text = (storage.foldername(name))[1])
);
CREATE POLICY "Owner can delete checkin images" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'checkin-images' 
  AND auth.role() = 'authenticated'
  AND (auth.uid()::text = (storage.foldername(name))[1])
);

-- 10. Helper view for accepted friendships
CREATE OR REPLACE VIEW public.friend_pairs AS
SELECT 
  CASE WHEN user_id < friend_id THEN user_id ELSE friend_id END AS a,
  CASE WHEN user_id < friend_id THEN friend_id ELSE user_id END AS b,
  status, created_at
FROM public.friend_edges
WHERE status = 'accepted';

-- 11. Grant permissions on new tables
GRANT ALL ON public.friend_edges TO anon, authenticated;
GRANT ALL ON public.checkin_likes TO anon, authenticated;
GRANT SELECT ON public.friend_pairs TO anon, authenticated;

-- Comments for new features
COMMENT ON TABLE public.friend_edges IS 'Friend relationships between users';
COMMENT ON TABLE public.checkin_likes IS 'Likes on checkins by users';

-- 11. Helper view for accepted friendships
CREATE OR REPLACE VIEW public.friend_pairs AS
SELECT 
  CASE WHEN user_id < friend_id THEN user_id ELSE friend_id END AS a,
  CASE WHEN user_id < friend_id THEN friend_id ELSE user_id END AS b,
  status, created_at
FROM public.friend_edges
WHERE status = 'accepted';

-- 12. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.bars TO anon, authenticated;
GRANT ALL ON public.checkins TO anon, authenticated;
GRANT ALL ON public.friend_edges TO anon, authenticated;
GRANT ALL ON public.checkin_likes TO anon, authenticated;
GRANT SELECT ON public.friend_pairs TO anon, authenticated;

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles with display names';
COMMENT ON TABLE public.bars IS 'Bar locations and details';
COMMENT ON TABLE public.checkins IS 'User check-ins with ratings and photos';
COMMENT ON TABLE public.friend_edges IS 'Friend relationships between users';
COMMENT ON TABLE public.checkin_likes IS 'Likes on checkins by users';
COMMENT ON COLUMN public.checkins.image_paths IS 'Array of storage object paths for photos';
