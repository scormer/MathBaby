// MathBaby capability demo server. Zero dependencies: `node demo/server.js`.
// Serves the one-page UI, calls Jev (or a mock), keeps per-child JSON profiles and .md logs.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { classifyMock } = require('./mock_jev');
const { extractScores } = require('./jev_parse');
const { replay, DEFAULT_PARAMS, PARAM_INFO, LEVELS, EMIT } = require('./belief');
const { createStore } = require('./storage');

const ROOT = path.resolve(__dirname, '..');

// ---------- config (.env in demo/, env vars win) ----------
function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const CFG = {
  port: +(process.env.PORT || 3000),
  jevUrl: process.env.JEV_API_URL || '',
  jevKey: process.env.JEV_API_KEY || '',
  authHeader: process.env.JEV_AUTH_HEADER || 'Authorization',
  authPrefix: process.env.JEV_AUTH_PREFIX ?? 'Bearer ',
  extraBody: process.env.JEV_EXTRA_BODY ? JSON.parse(process.env.JEV_EXTRA_BODY) : {},
  timeoutMs: +(process.env.JEV_TIMEOUT_MS || 90000),
};
CFG.mode = process.env.JEV_MODE || (CFG.jevUrl ? 'live' : 'mock');
const store = createStore(path.join(__dirname, 'data'));

// ---------- ontology ----------
const MODEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'APP_Capability_Model_v0.1.json'), 'utf8'));
const QUESTIONS = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'JEV_43_Capability_Questions (Only the question part of query).json'), 'utf8')).questions;
const CAPS = MODEL.capabilities.map(c => ({
  id: c.capability_id, name: c.name, domain: c.domain, family: c.family,
  definition: c.formal_definition, boundary: c.boundary_exclusion, indicator: c.sample_parent_indicator,
}));
const CAP_IDS = CAPS.map(c => c.id);
const CAP_BY_ID = Object.fromEntries(CAPS.map(c => [c.id, c]));
const missing = CAP_IDS.filter(id => !QUESTIONS[id]);
if (missing.length) console.warn('WARNING: no Jev question for', missing.join(', '));

// ---------- Bayesian capability belief (see belief.js) ----------
function recompute(child) {
  child.adjustments = child.adjustments || [];
  const { capabilities, deltasByEvent, params } = replay(CAP_IDS, child.observations, child.adjustments, child.model_params);
  child.model_params = params;
  child.capabilities = capabilities;
  for (const o of child.observations) o.deltas = deltasByEvent[o.id] || {};
  for (const a of child.adjustments) a.deltas = deltasByEvent[a.id] || {};
}

// ---------- storage ----------
const slugify = name => name.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, '_').slice(0, 60);
const readChild = slug => store.readChild(slug);
function writeChild(child) {
  child.updated_at = new Date().toISOString();
  return store.writeChild(child);
}
const stamp = iso => iso.replace('T', ' ').slice(0, 19);
const appendLog = (child, text) => store.appendLog(child.slug, `# Observation log — ${child.name}\n\n`, text);
function logObservation(child, obs) {
  const ranked = CAP_IDS.map(id => [id, obs.scores[id]]).filter(([, s]) => s >= 0.05).sort((a, b) => b[1] - a[1]);
  let md = `## ${stamp(obs.datetime)} · obs \`${obs.id}\`\n\n`;
  md += `**Parent observation** (age ${obs.child_age ?? '?'}):\n\n> ${obs.text.replace(/\n/g, '\n> ')}\n\n`;
  md += `**Jev scoring** (${obs.jev.mode}, ${obs.jev.ms} ms) — P(true) ≥ 0.05; ✔ = counted as evidence (above noise floor ${child.model_params.noise_floor}):\n\n`;
  if (!ranked.length) md += '_No capability received meaningful support._\n\n';
  else {
    md += '| Capability | P(true) | Maturity |\n|---|---:|---|\n';
    for (const [id, s] of ranked) {
      const d = obs.deltas[id];
      md += `| ${d ? '✔ ' : ''}${id} ${CAP_BY_ID[id].name} | ${s.toFixed(2)} | ${d ? `${pct(d.before)} → ${pct(d.after)}` : '—'} |\n`;
    }
    md += '\n';
  }
  return appendLog(child, md + '---\n\n');
}
const pct = x => Math.round(x * 100) + '%';

// ---------- Jev ----------
function jevPayload(text, age) {
  const state = { parent_observation: text };
  if (age) state.child_age = age; // the child's name is deliberately not sent to the external service
  return { ...CFG.extraBody, state, questions: QUESTIONS };
}

async function classify(text, age) {
  const t0 = Date.now();
  if (CFG.mode !== 'live') {
    return { scores: classifyMock(text, CAPS), mode: 'mock', ms: Date.now() - t0, raw: null };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (CFG.jevKey) headers[CFG.authHeader] = CFG.authPrefix + CFG.jevKey;
  const res = await fetch(CFG.jevUrl, {
    method: 'POST', headers, body: JSON.stringify(jevPayload(text, age)),
    signal: AbortSignal.timeout(CFG.timeoutMs),
  });
  const bodyText = await res.text();
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}: ${bodyText.slice(0, 500)}`);
  let raw;
  try { raw = JSON.parse(bodyText); } catch { throw new Error('Jev returned non-JSON: ' + bodyText.slice(0, 500)); }
  const scores = extractScores(raw, CAP_IDS);
  return { scores, mode: 'live', ms: Date.now() - t0, raw };
}

// ---------- HTTP ----------
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
async function readBody(req) {
  let s = '';
  for await (const chunk of req) s += chunk;
  return s ? JSON.parse(s) : {};
}
async function listChildren() {
  return (await store.listChildren())
    .map(c => ({ name: c.name, slug: c.slug, age: c.age, observations: c.observations.length, updated_at: c.updated_at }))
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const routes = [
  ['GET', /^\/$/, () => [200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8']],
  ['GET', /^\/api\/meta$/, () => [200, {
    capabilities: CAPS, mode: CFG.mode, jev_configured: !!CFG.jevUrl, default_params: DEFAULT_PARAMS,
    storage: store.kind, storage_ephemeral: !!store.ephemeral,
    param_info: PARAM_INFO, levels: LEVELS, emit: EMIT,
    ontology_version: MODEL.version,
  }]],
  ['GET', /^\/api\/payload-preview$/, (req, m, url) =>
    [200, jevPayload(url.searchParams.get('text') || '<parent observation>', +url.searchParams.get('age') || undefined)]],
  ['GET', /^\/api\/children$/, async () => [200, await listChildren()]],
  ['POST', /^\/api\/children$/, async req => {
    const { name, age } = await readBody(req);
    if (!name || !name.trim()) return [400, { error: 'Name required' }];
    const slug = slugify(name);
    if (!slug) return [400, { error: 'Invalid name' }];
    let child = await readChild(slug);
    if (!child) {
      const now = new Date().toISOString();
      child = { name: name.trim(), slug, age: age ? +age : null, created_at: now, updated_at: now,
        ontology_version: MODEL.version, model_params: { ...DEFAULT_PARAMS },
        capabilities: {}, observations: [], adjustments: [] };
      recompute(child);
      await writeChild(child);
      await appendLog(child, `_Profile created ${stamp(now)} — all 43 capabilities at 0%._\n\n---\n\n`);
    }
    return [200, child];
  }],
  ['GET', /^\/api\/children\/([^/]+)$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    recompute(child);
    return [200, child];
  }],
  ['PATCH', /^\/api\/children\/([^/]+)$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    const body = await readBody(req);
    if ('age' in body) child.age = body.age ? +body.age : null;
    if (body.model_params) {
      child.model_params = body.model_params === 'default' ? { ...DEFAULT_PARAMS } : body.model_params;
      recompute(child);
      await appendLog(child, `_${stamp(new Date().toISOString())} — model params changed to ${JSON.stringify(child.model_params)}; profile replayed from history._\n\n---\n\n`);
    }
    await writeChild(child);
    return [200, child];
  }],
  ['POST', /^\/api\/children\/([^/]+)\/observations$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    const { text } = await readBody(req);
    if (!text || !text.trim()) return [400, { error: 'Observation text required' }];
    let result;
    try { result = await classify(text.trim(), child.age); }
    catch (e) { return [502, { error: String(e.message || e) }]; }
    const obs = { id: newId(), datetime: new Date().toISOString(), text: text.trim(), child_age: child.age,
      jev: { mode: result.mode, ms: result.ms }, scores: result.scores, raw: result.raw, expected: null };
    child.observations.push(obs);
    recompute(child);
    await writeChild(child);
    await logObservation(child, obs);
    return [200, { child, observation_id: obs.id }];
  }],
  ['DELETE', /^\/api\/children\/([^/]+)\/observations\/([^/]+)$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    const obs = child.observations.find(o => o.id === m[2]);
    if (!obs) return [404, { error: 'Observation not found' }];
    child.observations = child.observations.filter(o => o !== obs);
    recompute(child);
    await writeChild(child);
    await appendLog(child, `_${stamp(new Date().toISOString())} — observation \`${obs.id}\` removed; profile replayed from history._\n\n---\n\n`);
    return [200, child];
  }],
  // Parent correction: set a capability's maturity directly (re-anchors the belief; later evidence continues from it).
  ['POST', /^\/api\/children\/([^/]+)\/adjustments$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    const { capability_id, value, note } = await readBody(req);
    if (!CAP_BY_ID[capability_id]) return [400, { error: 'Unknown capability' }];
    const v = +value;
    if (!(v >= 0 && v <= 1)) return [400, { error: 'value must be 0..1' }];
    child.adjustments = child.adjustments || [];
    const adj = { id: newId(), datetime: new Date().toISOString(), capability_id, value: v, note: note || '' };
    child.adjustments.push(adj);
    recompute(child);
    await writeChild(child);
    const d = adj.deltas[capability_id];
    await appendLog(child, `## ${stamp(adj.datetime)} · parent adjustment \`${adj.id}\`

` +
      `**${capability_id} ${CAP_BY_ID[capability_id].name}** set to ${pct(v)} (was ${pct(d.before)}, now ${pct(d.after)})` +
      `${adj.note ? ' — ' + adj.note : ''}

---

`);
    return [200, child];
  }],
  ['DELETE', /^\/api\/children\/([^/]+)\/adjustments\/([^/]+)$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    const adj = (child.adjustments || []).find(a => a.id === m[2]);
    if (!adj) return [404, { error: 'Adjustment not found' }];
    child.adjustments = child.adjustments.filter(a => a !== adj);
    recompute(child);
    await writeChild(child);
    await appendLog(child, `_${stamp(new Date().toISOString())} — parent adjustment \`${adj.id}\` (${adj.capability_id} → ${pct(adj.value)}) removed; profile replayed._

---

`);
    return [200, child];
  }],
  // Gold labels for Jev accuracy testing: which capabilities the tester believes the observation supports.
  ['PUT', /^\/api\/children\/([^/]+)\/observations\/([^/]+)\/expected$/, async (req, m) => {
    const child = await readChild(decodeURIComponent(m[1]));
    if (!child) return [404, { error: 'Not found' }];
    const obs = child.observations.find(o => o.id === m[2]);
    if (!obs) return [404, { error: 'Observation not found' }];
    const { expected } = await readBody(req);
    obs.expected = Array.isArray(expected) ? expected.filter(id => CAP_BY_ID[id]) : null;
    await writeChild(child);
    return [200, child];
  }],
  ['GET', /^\/api\/children\/([^/]+)\/log$/, async (req, m) => {
    const log = await store.readLog(decodeURIComponent(m[1]));
    return log ? [200, log, 'text/markdown; charset=utf-8'] : [404, 'No log'];
  }],
];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    for (const [method, re, handler] of routes) {
      const m = url.pathname.match(re);
      if (m && req.method === method) return send(res, ...(await handler(req, m, url)));
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(CFG.port, () => {
  console.log(`MathBaby capability demo → http://localhost:${CFG.port}`);
  console.log(`Storage: ${store.kind}${store.dir ? ' (' + store.dir + ')' : ''}${store.ephemeral ? ' — EPHEMERAL, set up Upstash Redis to persist' : ''}`);
  console.log(`Jev mode: ${CFG.mode}${CFG.mode === 'live' ? ' (' + CFG.jevUrl + ')' : ' — set JEV_API_URL in demo/.env for live scoring'}`);
});
