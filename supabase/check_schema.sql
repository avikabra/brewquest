-- Quick check for required tables and columns
-- Run this in Supabase SQL Editor to see what's missing

-- Check if tables exist
SELECT 'friend_edges' as table_name, EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'friend_edges'
) as exists;

SELECT 'checkin_likes' as table_name, EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'checkin_likes'
) as exists;

-- Check if image_paths column exists on checkins table
SELECT 'image_paths column' as check_name, EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'checkins' AND column_name = 'image_paths'
) as exists;

-- Check if AI columns exist on bars table
SELECT 'ai_summary column' as check_name, EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bars' AND column_name = 'ai_summary'
) as exists;

-- Show current checkins table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'checkins'
ORDER BY ordinal_position;
