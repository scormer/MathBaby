// Capability Belief Tracing (CBT) — a BKT-like hidden-state model for sparse, piece-meal parent evidence.
// Full rationale and research notes: ../Capability_Belief_Model_Research.md
//
// Per capability, the hidden state is a mastery LEVEL (not BKT's binary known/unknown):
//   0 Not yet · 1 Emerging · 2 Developing · 3 Secure · 4 Consistent
// The belief b is a probability distribution over those levels. Displayed maturity = E[level] / 4.
//
// Evidence: Jev's P(true) = s is treated as SOFT (virtual) evidence about a latent event
// D = "this observation genuinely demonstrates the capability". Pearl's virtual-evidence rule gives
//   λ_ℓ ∝ P(D|ℓ)·r + P(¬D|ℓ),  r = odds(s) / odds(π)   (π = Jev's noise floor / base rate)
// With P(D|ℓ) = κ·e_ℓ this is λ_ℓ = 1 + κ·e_ℓ·(r − 1). Only r > 1 is used: a low score means
// "this observation says nothing positive", never negative evidence (canonical v1.2 rule; parents choose
// what to write about, so absence of mention is not missing-at-random).
//
// Dynamics between evidence events (the BKT "transition" analogue), in continuous time:
//   learning  — probability mass moves up one level at rate 1/τ_learn (children develop between observations)
//   staleness — mass diffuses to neighbouring levels at rate 1/τ_stale (confidence decays, mean roughly kept)
// Both apply only to capabilities that already have evidence, so unobserved capabilities stay at the prior.
//
// Parent adjustment (slider v ∈ [0,1]) re-anchors the belief to Binomial(4, v) (mean exactly v), mixed with
// a little uniform mass so later evidence can still move it.
'use strict';

const LEVELS = ['Not yet', 'Emerging', 'Developing', 'Secure', 'Consistent'];
const K = LEVELS.length;
// e_ℓ: chance that a child at level ℓ, given a relevant situation, shows a genuine demonstration a parent would report.
// Level 0 > 0 plays the role of BKT "guess"; level 4 < 1 plays the role of "slip".
const EMIT = [0.03, 0.25, 0.55, 0.8, 0.95];

const DEFAULT_PARAMS = {
  prior_p0: 0.95,       // prior P(level = Not yet); the rest spread evenly
  kappa: 0.15,          // informativeness of one observation (P(D|ℓ) = κ·e_ℓ)
  noise_floor: 0.25,    // π: Jev scores at/below this carry no evidence
  score_cap: 0.95,      // Jev scores are capped here (1.0 would be treated as infinitely certain)
  tau_learn_days: 365,  // learning drift time constant
  tau_stale_days: 120,  // confidence decay time constant
  adjust_floor: 0.02,   // uniform mass mixed into a parent adjustment
};
const PARAM_INFO = {
  prior_p0: 'Prior P(Not yet)', kappa: 'Informativeness κ', noise_floor: 'Noise floor π',
  score_cap: 'Score cap', tau_learn_days: 'Learning τ (days)', tau_stale_days: 'Staleness τ (days)',
};

function normalizeParams(p = {}) {
  const out = { ...DEFAULT_PARAMS };
  for (const k of Object.keys(DEFAULT_PARAMS)) if (p[k] !== undefined && p[k] !== '' && !isNaN(+p[k])) out[k] = +p[k];
  out.prior_p0 = clamp(out.prior_p0, 0.01, 0.999);
  out.noise_floor = clamp(out.noise_floor, 0.01, 0.9);
  out.score_cap = clamp(out.score_cap, out.noise_floor + 0.01, 0.999);
  out.kappa = clamp(out.kappa, 0.001, 1);
  return out;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const odds = x => x / (1 - x);
const norm = b => { const z = b.reduce((a, x) => a + x, 0); return b.map(x => x / z); };

function priorBelief(p) {
  const rest = (1 - p.prior_p0) / (K - 1);
  return LEVELS.map((_, l) => l === 0 ? p.prior_p0 : rest);
}

function likelihood(s, p) {
  const r = odds(Math.min(s, p.score_cap)) / odds(p.noise_floor);
  if (!(r > 1)) return null;
  return EMIT.map(e => 1 + p.kappa * e * (r - 1));
}

function drift(b, dtDays, p) {
  if (!(dtDays > 0)) return b;
  // learning: one-level-up transition
  const q = 1 - Math.exp(-dtDays / p.tau_learn_days);
  let out = b.map((x, l) => x * (l < K - 1 ? 1 - q : 1));
  for (let l = 0; l < K - 1; l++) out[l + 1] += b[l] * q;
  // staleness: diffuse to neighbours (reflecting edges)
  const phi = 1 - Math.exp(-dtDays / p.tau_stale_days);
  const d = out.map(() => 0);
  out.forEach((x, l) => {
    d[l] += x * (1 - phi);
    d[Math.max(0, l - 1)] += x * phi / 2;
    d[Math.min(K - 1, l + 1)] += x * phi / 2;
  });
  return norm(d);
}

function binomialBelief(v, floor) {
  const C = [1, 4, 6, 4, 1];
  const b = C.map((c, l) => c * v ** l * (1 - v) ** (K - 1 - l));
  return norm(b.map(x => (1 - floor) * x + floor / K));
}

function summarize(st) {
  const b = st.belief;
  const maturity = b.reduce((a, x, l) => a + x * l, 0) / (K - 1);
  const H = -b.reduce((a, x) => a + (x > 0 ? x * Math.log(x) : 0), 0);
  const confidence = 1 - H / Math.log(K);
  let status = 'UNKNOWN';
  if (st.evidence_count > 0) {
    if (b[3] + b[4] >= 0.6) status = 'CONSISTENT';
    // Free-text evidence is positive-only, so it can never show "not yet"; only a parent adjustment can.
    else if (b[0] >= 0.5) status = st.adjusted ? 'NOT_YET' : 'UNKNOWN';
    else status = 'DEVELOPING';
  }
  // No evidence => shown as 0% (status UNKNOWN), not as the prior mean.
  return { ...st, maturity: st.evidence_count > 0 ? maturity : 0, confidence, status };
}

const days = (a, b) => (new Date(b) - new Date(a)) / 86400000;

// Replays all events (observations + parent adjustments) in time order.
// Returns { capabilities, deltasByEvent } where deltas = { capId: {before, after, lr?, support?} }.
function replay(capIds, observations, adjustments, rawParams) {
  const p = normalizeParams(rawParams);
  const state = Object.fromEntries(capIds.map(id => [id,
    { belief: priorBelief(p), evidence_count: 0, last_evidence_at: null, adjusted: false }]));
  const events = [
    ...observations.map(o => ({ kind: 'obs', at: o.datetime, ev: o })),
    ...adjustments.map(a => ({ kind: 'adjust', at: a.datetime, ev: a })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const deltasByEvent = {};
  for (const { kind, at, ev } of events) {
    const deltas = {};
    const ids = kind === 'obs' ? capIds : [ev.capability_id];
    for (const id of ids) {
      const st = state[id];
      if (!st) continue;
      const before = summarize(st).maturity;
      if (kind === 'obs') {
        const s = ev.scores[id];
        const lam = typeof s === 'number' ? likelihood(s, p) : null;
        if (!lam) continue;
        if (st.last_evidence_at) st.belief = drift(st.belief, days(st.last_evidence_at, at), p);
        st.belief = norm(st.belief.map((x, l) => x * lam[l]));
        st.evidence_count++;
        st.last_evidence_at = at;
        deltas[id] = { support: s, lr: lam[K - 1] / lam[0], before, after: summarize(st).maturity };
      } else {
        st.belief = binomialBelief(clamp(ev.value, 0, 1), p.adjust_floor);
        st.evidence_count++;
        st.last_evidence_at = at;
        st.adjusted = true;
        deltas[id] = { adjust: ev.value, before, after: summarize(st).maturity };
      }
    }
    deltasByEvent[ev.id] = deltas;
  }
  const capabilities = Object.fromEntries(capIds.map(id => [id, summarize(state[id])]));
  return { capabilities, deltasByEvent, params: p };
}

module.exports = { replay, normalizeParams, DEFAULT_PARAMS, PARAM_INFO, LEVELS, EMIT };
