// Storage backends for child profiles (JSON) and observation logs (Markdown).
//   redis — Upstash Redis REST API (Vercel Marketplace "Upstash for Redis"). Used when its env vars are set.
//           Needed on Vercel: the deployed filesystem is read-only and /tmp is wiped per instance.
//   files — demo/data/children/<slug>.json + demo/data/logs/<slug>.md (local default; DATA_DIR overrides).
'use strict';
const fs = require('fs');
const path = require('path');

function redisStore(url, token) {
  const call = async cmds => {
    const res = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const out = await res.json();
    const err = out.find(r => r.error);
    if (err) throw new Error('Redis: ' + err.error);
    return out.map(r => r.result);
  };
  const K = { child: s => 'mb:child:' + s, log: s => 'mb:log:' + s, index: 'mb:children' };
  return {
    kind: 'redis',
    async readChild(slug) {
      const [v] = await call([['GET', K.child(slug)]]);
      return v ? JSON.parse(v) : null;
    },
    async writeChild(child) {
      await call([['SET', K.child(child.slug), JSON.stringify(child)], ['SADD', K.index, child.slug]]);
    },
    async listChildren() {
      const [slugs] = await call([['SMEMBERS', K.index]]);
      if (!slugs || !slugs.length) return [];
      const [vals] = await call([['MGET', ...slugs.map(K.child)]]);
      return vals.filter(Boolean).map(v => JSON.parse(v));
    },
    async appendLog(slug, header, text) {
      const [exists] = await call([['EXISTS', K.log(slug)]]);
      await call([['APPEND', K.log(slug), (exists ? '' : header) + text]]);
    },
    async readLog(slug) {
      const [v] = await call([['GET', K.log(slug)]]);
      return v;
    },
  };
}

function fileStore(dir) {
  const childDir = path.join(dir, 'children');
  const logDir = path.join(dir, 'logs');
  fs.mkdirSync(childDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  const childFile = slug => path.join(childDir, slug + '.json');
  const logFile = slug => path.join(logDir, slug + '.md');
  return {
    kind: 'files',
    dir,
    async readChild(slug) {
      return fs.existsSync(childFile(slug)) ? JSON.parse(fs.readFileSync(childFile(slug), 'utf8')) : null;
    },
    async writeChild(child) {
      fs.writeFileSync(childFile(child.slug), JSON.stringify(child, null, 2));
    },
    async listChildren() {
      return fs.readdirSync(childDir).filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(fs.readFileSync(path.join(childDir, f), 'utf8')));
    },
    async appendLog(slug, header, text) {
      const f = logFile(slug);
      if (!fs.existsSync(f)) fs.writeFileSync(f, header);
      fs.appendFileSync(f, text);
    },
    async readLog(slug) {
      return fs.existsSync(logFile(slug)) ? fs.readFileSync(logFile(slug), 'utf8') : null;
    },
  };
}

function createStore(defaultDir) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisStore(url, token);
  // On Vercel without Redis, fall back to /tmp so the app at least starts. Data will NOT persist.
  const dir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/mathbaby-data' : defaultDir);
  const store = fileStore(dir);
  store.ephemeral = !!process.env.VERCEL;
  return store;
}

module.exports = { createStore, fileStore, redisStore };
