function createRateLimiter({ limit, windowMs, keyGenerator = (req) => req.ip || req.socket?.remoteAddress || "unknown" }) {
  const buckets = new Map();
  let requestsSinceCleanup = 0;

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = String(keyGenerator(req));
    let bucket = buckets.get(key);

    if (!bucket || bucket.expiresAt <= now) {
      if (buckets.size >= 10000 && ++requestsSinceCleanup % 64 === 0) {
        for (const [bucketKey, value] of buckets) {
          if (value.expiresAt <= now) buckets.delete(bucketKey);
        }
      }
      if (buckets.size >= 10000 && !bucket) {
        return res.status(429).json({ success: false, message: "Too many requests. Try again later." });
      }
      bucket = { count: 0, expiresAt: now + windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= limit) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000))));
      return res.status(429).json({ success: false, message: "Too many requests. Try again later." });
    }

    bucket.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
