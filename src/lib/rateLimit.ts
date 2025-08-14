import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Avoid touching Upstash at module load (local builds may not have envs)
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const memory: Map<string, { count: number; resetAt: number }> | null =
  hasUpstash ? null : new Map();

export async function checkLimit(key: string) {
  if (hasUpstash) {
    const rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(30, '1 h'),
      analytics: false,
    });
    return rl.limit(key);
  }
  // Dev/local fallback: simple in-memory fixed window
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const slot = memory!.get(key);
  if (!slot || now > slot.resetAt) {
    memory!.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, reset: now + windowMs };
  }
  if (slot.count >= 30) return { success: false, reset: slot.resetAt };
  slot.count++;
  return { success: true, reset: slot.resetAt };
}