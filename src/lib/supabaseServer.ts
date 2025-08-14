import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables for server client');
  }
  
  // cookies() returns a Promise, so we need to handle it asynchronously
  return createServerClient(url, anonKey, {
    cookies: {
      // Must return string | undefined
      async get(name: string) {
        const cookieStore = await cookies();
        return cookieStore.get(name)?.value;
      },
      // Next.js cookies().set expects a single object (not positional args)
      async set(name: string, value: string, options: CookieOptions) {
        const cookieStore = await cookies();
        cookieStore.set({ name, value, ...options });
      },
      // Remove by setting an empty value with the provided options
      async remove(name: string, options: CookieOptions) {
        const cookieStore = await cookies();
        cookieStore.set({ name, value: '', ...options });
        // (Alternatively: cookieStore.delete?.(name) in newer Next versions)
      },
    },
  });
}
