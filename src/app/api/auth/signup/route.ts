import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(1).max(80)
});

function normEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function GET() {
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: Request) {
  const admin = supabaseAdmin();

  try {
    const raw = await req.json();
    const { email, password, username } = Body.parse(raw);
    const emailNorm = normEmail(email);

    // 1) Try to create as confirmed
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emailNorm,
      password,
      email_confirm: true,
      user_metadata: { username }
    });

    if (createErr) {
      // If Supabase says "already registered", fall back to find that user and proceed idempotently
      const msg = (createErr.message || '').toLowerCase();
      if (createErr.status === 409 || msg.includes('already')) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (!listErr) {
          const existing = list?.users?.find(u => (u.email || '').toLowerCase() === emailNorm);
          if (existing) {
            // Ensure profile exists
            await admin.from('profiles').upsert({ user_id: existing.id, username }).select('user_id');
            return NextResponse.json({ ok: true, reason: 'exists' }); // let client sign in
          }
        }
        // Could not find existing user; bubble original error
        return NextResponse.json(
          { ok: false, reason: 'exists', message: createErr.message },
          { status: 409 }
        );
      }

      // Other errors (validation, weak password, etc.)
      return NextResponse.json({ error: createErr.message }, { status: createErr.status || 400 });
    }

    // 2) New user path — upsert profile
    const userId = created.user?.id;
    if (userId) {
      await admin.from('profiles').upsert({ user_id: userId, username }).select('user_id');
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Bad Request' }, { status: 400 });
  }
}
