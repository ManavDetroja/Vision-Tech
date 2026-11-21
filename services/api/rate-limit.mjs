import { createHmac } from 'node:crypto';
import { config } from './config.mjs';

export function clientHash(req) {
  const forwarded = config.trustedProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  return createHmac('sha256', config.rateSecret).update(forwarded || req.socket.remoteAddress || 'unknown').digest('hex');
}

export function createRateLimiter({ limit = 20, windowMs = 60000, maxEntries = 10000, now = Date.now } = {}) {
  const buckets = new Map();
  return (key) => {
    const time = now();
    for (const [id, bucket] of buckets) if (bucket.until <= time) buckets.delete(id);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxEntries) return false;
      bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= limit;
  };
}
