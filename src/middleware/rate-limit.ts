import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../utils/errors.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function createRateLimiter(windowMs: number, max: number) {
  return createMiddleware(async (c, next) => {
    const key =
      c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      'global';

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      throw new RateLimitError();
    }

    await next();
  });
}
