// One-off: copy local demo/data (children JSON + .md logs) into Upstash Redis.
// Usage: set KV_REST_API_URL and KV_REST_API_TOKEN (from Vercel → Storage → your Redis → .env.local tab), then
//   node demo/migrate_to_redis.js
'use strict';
const fs = require('fs');
const path = require('path');
const { fileStore, redisStore } = require('./storage');

(async () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { console.error('Set KV_REST_API_URL and KV_REST_API_TOKEN first.'); process.exit(1); }
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const src = fileStore(dir), dst = redisStore(url, token);
  for (const child of await src.listChildren()) {
    if (await dst.readChild(child.slug)) { console.log(`skip ${child.slug} (already in Redis)`); continue; }
    await dst.writeChild(child);
    const log = await src.readLog(child.slug);
    if (log) await dst.appendLog(child.slug, '', log);
    console.log(`copied ${child.slug}: ${child.observations.length} observations${log ? ' + log' : ''}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
