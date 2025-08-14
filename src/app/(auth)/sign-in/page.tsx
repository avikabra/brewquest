'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SignInPage() {
  const sp = useSearchParams();
  const redirected = sp.get('confirmed') === '1';
  const nextPath = sp.get('next') || '/';
  const [tab, setTab] = useState<'signin'|'signup'>('signin');

  const router = useRouter();

  // === Sign in form state ===
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siBusy, setSiBusy] = useState(false);
  const [siErr, setSiErr] = useState<string | null>(null);

  // === Sign up form state ===
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suBusy, setSuBusy] = useState(false);
  const [suMsg, setSuMsg] = useState<string | null>(null);
  const [suErr, setSuErr] = useState<string | null>(null);

  // Optional: if already logged in, bounce home
  useEffect(() => {
    (async () => {
      const supa = supabaseBrowser();
      const { data: { session } } = await supa.auth.getSession();
      if (session) router.replace('/');
    })();
  }, [router]);

  // === handlers ===
  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiErr(null); setSiBusy(true);
    const supa = supabaseBrowser();
    const { error } = await supa.auth.signInWithPassword({ email: siEmail, password: siPassword });
    setSiBusy(false);
    if (error) {
      // Helpful errors
      if (/email/i.test(error.message) && /not confirmed/i.test(error.message)) {
        setSiErr('Email not confirmed yet. Check your inbox for the confirmation link.');
      } else {
        setSiErr(error.message || 'Invalid credentials.');
      }
      return;
    }
    // success: cookies set, middleware can see them
  router.replace(nextPath);
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuErr(null); setSuMsg(null); setSuBusy(true);

    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: suEmail.trim(), password: suPassword, username: suName.trim() })
        });

        const j = await res.json().catch(() => ({}));

        // Helper to finish by signing in
        const finishBySignin = async () => {
        const supa = supabaseBrowser();
        const { error } = await supa.auth.signInWithPassword({ email: suEmail.trim(), password: suPassword });
        if (error) {
            setSuErr(`Signed up, but sign-in failed: ${error.message}`);
            setTab('signin');
            setSiEmail(suEmail.trim());
            return;
        }
  router.replace(nextPath);
        };

        if (res.ok || res.status === 207) {
        // Created (or profile upsert warned). Sign in immediately.
        await finishBySignin();
        return;
        }

        if (res.status === 409) {
        // Account exists. Try to sign in with the provided password automatically.
        const supa = supabaseBrowser();
        const { error } = await supa.auth.signInWithPassword({ email: suEmail.trim(), password: suPassword });
  if (!error) { router.replace(nextPath); return; }
        // Wrong password
        setTab('signin');
        setSiEmail(suEmail.trim());
        setSuErr('An account with this email already exists, but that password is incorrect. Please sign in with the correct password or reset it.');
        return;
        }

        // Other server errors
        setSuErr(`Sign up failed: ${j.message || res.statusText}`);
    } catch (err: any) {
        setSuErr(err?.message || 'Network error during sign up.');
    } finally {
        setSuBusy(false);
    }
  };

  // small helper for banner
  const banner = useMemo(() => {
    if (redirected) return 'Email confirmed ✅ You can sign in now.';
    if (suMsg) return suMsg;
    if (siErr) return null;
    return null;
  }, [redirected, suMsg, siErr]);

  return (
    <Suspense fallback={null}>
  <div className="p-4">
  <style>{`header.sticky{display:none !important}`}</style>
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-xl font-semibold">Welcome to Brew Quest</h1>
          {banner && <p className="text-sm text-emerald-600">{banner}</p>}

          <Tabs value={tab} onValueChange={(v)=>setTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 rounded-xl">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form className="space-y-3" onSubmit={onSignIn}>
                <Input type="email" placeholder="you@example.com" value={siEmail} onChange={e=>setSiEmail(e.target.value)} required />
                <Input type="password" placeholder="••••••••" value={siPassword} onChange={e=>setSiPassword(e.target.value)} required minLength={6} />
                {siErr && <p className="text-sm text-rose-600">{siErr}</p>}
                <Button className="rounded-xl w-full" type="submit" disabled={siBusy}>{siBusy ? 'Signing in…' : 'Sign in'}</Button>
              </form>
              <p className="text-xs text-stone-500 mt-2">Use the email & password you registered with.</p>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form className="space-y-3" onSubmit={onSignUp}>
                <Input placeholder="Your name" value={suName} onChange={e=>setSuName(e.target.value)} required />
                <Input type="email" placeholder="you@example.com" value={suEmail} onChange={e=>setSuEmail(e.target.value)} required />
                <Input type="password" placeholder="Choose a password (min 6 chars)" value={suPassword} onChange={e=>setSuPassword(e.target.value)} required minLength={6} />
                {suErr && <p className="text-sm text-rose-600">{suErr}</p>}
                <Button className="rounded-xl w-full" type="submit" disabled={suBusy}>{suBusy ? 'Creating…' : 'Create account'}</Button>
              </form>
              <p className="text-xs text-stone-500 mt-2">We’ll email you a confirmation link. After confirming, come back here to sign in.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
   </Suspense>
  );
}
