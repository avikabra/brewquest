import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const rlPerUserHour = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(30, '1 h'), // 30 calls/hour/user
  analytics: false
});

export async function checkLimit(key: string) {
  const r = await rlPerUserHour.limit(key);
  return r;
}
