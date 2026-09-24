// Turns a Jev response into { capabilityId: P(true) }.
// TypeSafe Jev (POST https://api.typesafe.ai/v1/systemone) returns { answers: { "NQ-01": { type: "noul", noul: 0.03 } } }.
// The exact response shape is not pinned down yet, so this accepts the common layouts:
//   { "NQ-01": 0.03, ... }                                   (flat numbers, 0-1 or 0-100)
//   { answers|results|data|output|...: { "NQ-01": {...} } }   (nested one or more levels)
//   { "NQ-01": { "p_true"|"probability"|"true"|"confidence"|...: x } }
//   { "NQ-01": { "answer": true, "confidence": 0.8 } }
//   { "NQ-01": { "probabilities": { "true": 0.8, "false": 0.2 } } }
//   [ { "id"|"key"|"question": "NQ-01", ...value } ]
// If the real API differs, adjust toProb() / findContainer() — the raw response is saved with every observation.
'use strict';

const PROB_KEYS = ['noul', 'p_true', 'P(true)', 'prob_true', 'probability_true', 'true', 'yes',
  'probability', 'prob', 'p', 'score', 'likelihood', 'value'];

function toProb(v) {
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) return toProb(+v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (!v || typeof v !== 'object') return undefined;
  for (const k of ['probabilities', 'distribution', 'probs', 'result', 'output']) {
    if (v[k] !== undefined) { const p = toProb(v[k]); if (p !== undefined) return p; }
  }
  for (const k of PROB_KEYS) {
    if (typeof v[k] === 'number' || (typeof v[k] === 'string' && !isNaN(+v[k]))) return toProb(v[k]);
  }
  const ans = v.answer ?? v.label ?? v.prediction;
  const conf = v.confidence ?? v.certainty;
  if (ans !== undefined && typeof conf === 'number') {
    const c = conf > 1 ? conf / 100 : conf;
    const yes = ans === true || /^(true|yes)$/i.test(String(ans));
    return yes ? c : 1 - c;
  }
  return undefined;
}

function arrayToMap(arr, ids) {
  const out = {};
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const key = [item.id, item.key, item.question, item.question_id, item.name].find(k => ids.includes(k));
    if (key) out[key] = item;
  }
  return Object.keys(out).length ? out : null;
}

// Breadth-first search for the object that holds the most capability IDs as keys.
function findContainer(root, ids) {
  let best = null, bestHits = 0;
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    let node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      const asMap = arrayToMap(node, ids);
      if (asMap) node = asMap; else { queue.push(...node); continue; }
    }
    const hits = ids.filter(id => id in node).length;
    if (hits > bestHits) { best = node; bestHits = hits; }
    for (const v of Object.values(node)) if (v && typeof v === 'object') queue.push(v);
  }
  return best;
}

function extractScores(raw, ids) {
  const container = findContainer(raw, ids);
  if (!container) throw new Error('Could not find capability IDs in Jev response: ' + JSON.stringify(raw).slice(0, 400));
  const scores = {};
  const unparsed = [];
  for (const id of ids) {
    const p = toProb(container[id]);
    if (p === undefined) unparsed.push(id); else scores[id] = Math.max(0, Math.min(1, p));
  }
  if (unparsed.length === ids.length) {
    throw new Error('Found capability IDs but could not read probabilities, e.g. ' +
      JSON.stringify(container[ids[0]]).slice(0, 300));
  }
  for (const id of unparsed) scores[id] = 0;
  return scores;
}

module.exports = { extractScores, toProb };
