import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }
  
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};
