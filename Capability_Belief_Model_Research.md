# Capability Belief Model — Research Notes

**Status:** working notes, v0.1 · 24 Sep 2026
**Implemented in:** `demo/belief.js` ("Capability Belief Tracing", CBT v0)
**Related canonical decisions:** `APP_New_Chat_Handoff.md` v1.2. The model is a Capability Belief Model, not classical BKT. A low Jev score is not negative evidence. A targeted questionnaire NO can count as conservative negative evidence.

---

## 1. The problem, stated precisely

For each child and each of the 43 Capabilities we want a belief about the child's current mastery. The evidence it has to come from is:

- **Sparse and irregular.** A parent writes something every few days or weeks, not after every practice attempt.
- **Piece-meal and partial.** One observation touches 0–4 capabilities, usually only partly. "She counted to 14 but skipped 11" is partial evidence about counting.
- **Soft.** We never see a clean correct/incorrect. Jev gives `s = P(observation supports capability)`, a classifier probability of unknown calibration.
- **Selectively reported.** Parents write about what is notable, so a missing mention is **not missing-at-random** (MNAR, in Rubin's terms). The system cannot learn from silence.
- **Correlated.** A parent may retell the same event, or describe one event that touches several capabilities.
- **Correctable.** A parent can override a capability after a mistaken observation.

We need an **aggregation operator** `b_new = U(b_old, evidence, Δt)` that is not additive, not a max, and not a softmax. It should also have these properties:

1. **Monotone in evidence strength.** Stronger support moves the belief further.
2. **Diminishing returns plus a skeptical start.** One anecdote isn't mastery; repeated independent evidence is. That suggests an S-shaped accumulation.
3. **No negative update from silence or low support.**
4. **Order-robust.** Replaying the same evidence in a different order should give nearly the same belief when little time passes.
5. **Time-aware.** Children develop between observations, and old evidence becomes less certain.
6. **Explainable.** We can say "this observation moved AB-02 from 41% to 72% because…".
7. **Replayable.** The belief is a pure function of the event log, so any parameter change or deletion can be recomputed.

## 2. Why not classical BKT as-is

Classical BKT (Corbett & Anderson, 1995) is a 2-state HMM per skill with four parameters: P(L₀), P(T) learn, P(G) guess and P(S) slip. It is updated once per scored attempt. It doesn't fit here as-is:

| BKT assumption | Our reality |
|---|---|
| Binary known/unknown | We want graded maturity (Emerging → Consistent) |
| Every opportunity is observed and scored correct/incorrect | Observations are soft, partial and rare |
| "Incorrect" is informative | Silence is uninformative; we have almost no explicit negatives |
| One transition per practice opportunity | Development happens in continuous time, between observations |
| Parameters fit per skill from dense logs | No data yet; parameters must be priors first and fitted later |

We keep BKT's **structure**: a hidden mastery state, emission probabilities with guess/slip analogues, a transition model, and forward filtering. Each part is generalised.

## 3. CBT v0: the model in the demo

### 3.1 State

For each capability *c*, the hidden level is `L ∈ {0..4}`: Not yet, Emerging, Developing, Secure, Consistent. The belief is a categorical distribution `b = (b₀..b₄)`.

- **Displayed maturity:** `m = E[L]/4 ∈ [0,1]`
- **Confidence:** `1 − H(b)/ln 5`, one minus normalised entropy
- **Status:**
  - UNKNOWN when there is no evidence, or only weak evidence (b₀ ≥ 0.5)
  - CONSISTENT when P(L ≥ 3) ≥ 0.6
  - NOT_YET only when a parent correction put it there
  - DEVELOPING otherwise

**Prior:** `b₀ = 0.95` and the rest spread evenly. This is a skeptical prior: we assume nothing until we see it. With no evidence the UI shows "—" (UNKNOWN), not the prior mean.

### 3.2 Evidence: soft evidence through virtual evidence

Let D be the event "this observation genuinely demonstrates c". Jev reports `s ≈ P(D | text)`. Following Pearl's **virtual evidence** (1988), and not Jeffrey's rule, which would treat `s` as the new marginal and overwrite history, the likelihood of the observation given level ℓ is:

```
λ_ℓ ∝ P(D | ℓ)·r + P(¬D | ℓ),      r = odds(s) / odds(π)
```

Here π is Jev's effective base rate, the noise floor. With `P(D|ℓ) = κ·e_ℓ`:

```
λ_ℓ = 1 + κ · e_ℓ · (r − 1)          (used only when r > 1)
b_new ∝ b_old ⊙ λ
```

- `e = (0.03, 0.25, 0.55, 0.80, 0.95)` is the level-conditional demonstration probability. `e₀ > 0` plays the role of BKT's *guess*, and `e₄ < 1` the role of *slip*.
- `κ` is informativeness: how likely a parent observation is to demonstrate *c* at all, given a relevant context.
- When `r ≤ 1` (s ≤ π) the update is skipped. This is **censored virtual evidence**. Formally, λ would be slightly below 1 at high levels, a tiny negative update. Because of MNAR reporting we don't trust that direction, so the canonical rule "low support is no evidence" is implemented exactly, not approximately.
- Jev scores are capped (`s ≤ 0.95`). Otherwise `s = 1.0` gives r → ∞, and one observation would decide everything. Jev does return 1.0.

**Why this gives the properties in §1:**
- The update is multiplicative in likelihood space, so evidence **aggregates** as a product of likelihood ratios. It is not a sum or a max, and it is commutative when Δt = 0.
- The skeptical prior makes the posterior mean S-shaped in the number of observations. With the defaults, repeated strong observations (s ≈ 0.94) give 14% → 43% → 72% → 84% → 88%. Repeated medium ones (s ≈ 0.6) give 4 → 6 → 8 → 10 → 14%. Weak ones (0.3) barely move.
- Each update can be explained by a single number, the **strength ×(λ₄/λ₀)** shown in the UI.

### 3.3 Dynamics between evidence (the transition analogue)

These apply only to capabilities that already have evidence, lazily, at the next event for that capability:

- **Learning drift:** move up one level with probability `1 − exp(−Δt/τ_learn)`, with τ_learn = 365 days. This is BKT's P(T) in continuous time.
- **Staleness diffusion:** spread to neighbouring levels with probability `1 − exp(−Δt/τ_stale)`, with τ_stale = 120 days. This raises entropy, so confidence falls, while roughly keeping the mean. It implements "missing data reduces confidence, not status".

### 3.4 Parent correction

The slider value `v ∈ [0,1]` resets the belief to `Binomial(4, v)`, mixed with 2% uniform mass. The Binomial's mean is exactly `4v`, so displayed maturity equals v. The mixing keeps later evidence able to move it.

The correction is an **event in the log**, so it can be undone and replayed. It is a **re-anchoring**, not evidence. This is deliberate: the parent is asserting the state, not reporting an observation.

### 3.5 Parameters (UI-editable; every change replays the log)

| param | default | meaning |
|---|---|---|
| prior_p0 | 0.95 | skepticism of the prior |
| kappa κ | 0.15 | informativeness of one observation |
| noise_floor π | 0.25 | Jev scores ≤ π carry no evidence |
| score_cap | 0.95 | protects against over-confident Jev outputs |
| tau_learn_days | 365 | developmental drift |
| tau_stale_days | 120 | confidence decay |

## 4. Known weaknesses of v0, in priority order

1. **Jev calibration is unknown.** π, the cap and κ stand in for calibration. *Fix:* use the gold labels collected in the demo ("Expected" ticks) to fit **Platt scaling** or **isotonic regression** (Zadrozny & Elkan, 2002) per capability or per family. Then replace `s` with the calibrated `ŝ`, and π with the empirical base rate.
2. **No level information in the evidence.** "Counted to 5 with my help" and "counts any set to 20 confidently" both just give a high `s`. *Fix, likely the biggest accuracy gain:* send a second Jev pass, only for capabilities with s > π, with one **`score` question per capability**. The criteria would be ordered levels such as "only with substantial help / independently but inconsistently / independently and reliably / explains, generalises or transfers". Jev returns a distribution `q_k`. The likelihood becomes `λ_ℓ = Σ_k q_k · P(show level k | L = ℓ)` with a proper K×K emission matrix. This keeps the same machinery with a richer emission.
3. **Correlated or duplicate evidence.** Retelling the same event counts twice. Options:
   - **Tempered likelihoods** `λ^w`, with w < 1 for evidence within a short window. This is related to power posteriors and SafeBayes (Grünwald).
   - An LLM "same event?" dedup step.
   - A per-day evidence budget.
4. **No negative channel from free text.** "She still can't count past 10" produces no update. Options:
   - A second Jev noul per capability, "does the observation show the child *struggling with or lacking* c?", used as censored negative virtual evidence with a smaller κ.
   - The targeted questionnaire NO, as designed.
5. **Capabilities are independent.** The REQUIRES/FACILITATES graph isn't used. Options:
   - **Soft prerequisite priors:** the prior for *c* is shifted by the beliefs of its REQUIRES parents. This is cheap and keeps the factorised filter.
   - A **dynamic Bayesian network** over the capability graph, as in Käser et al. (2017) on skill hierarchies, using loopy belief propagation or particle filtering. More faithful, more complex.
   - Upward inference: evidence for MR-01 (multiplication) is weak evidence for AB-02 (addition). This can be written as `SUPPORTS` edges with a small κ.
6. **Parameters are hand-set.** Once there is data, fit `e`, κ, τ and the prior by **EM (Baum–Welch) with soft evidence**. The expected complete-data log-likelihood still factorises. Validate on held-out targeted questionnaire answers, which are the closest thing to ground truth: log-loss and calibration of P(parent answers YES | belief).
7. **Population and age priors.** Replace the flat skeptical prior with an age-conditional prior learned across children. This is hierarchical, empirical-Bayes, like BKT's individualised priors (Pardos & Heffernan, 2010). The design says age is a prior, not a rule.
8. **Staleness is not mean-preserving at the edges.** Reflecting diffusion slightly lowers a Consistent belief and raises a Not-yet one. That is acceptable for now; a truncated-Gaussian kernel in logit space would fix it.

## 5. Alternative formulations worth comparing

| Approach | Idea | Pros | Cons |
|---|---|---|---|
| **CBT (current)** | discrete-level HMM + virtual evidence | explainable, exact, cheap, replayable | hand-set emissions until data exists |
| **Latent-ability Kalman filter** | θ_c ~ Gaussian random walk; evidence via a probit/logistic link (like Glicko) | natural continuous maturity and uncertainty; time-decay is just variance growth | non-Gaussian likelihood needs a Laplace/EP approximation; less intuitive levels |
| **Elo-style updates** (Pelánek, 2016) | θ ← θ + K·(obs − expected) | trivial, proven in adaptive practice systems | ad hoc uncertainty; needs dense data |
| **Beta-Bernoulli pseudo-counts** (demo v0.1) | α += s | simplest | no levels, no time, grows without a principled prior shape |
| **Particle filter over the joint graph** | sample full 43-dim states | handles the graph and correlations | heavy; harder to explain |
| **Deep KT (Piech et al., 2015)** | RNN over evidence sequences | learns correlations | needs lots of data; opaque; Khajah et al. (2016) show BKT extensions often match it |
| **Half-life regression** (Settles & Meeder, 2016) | explicit forgetting model | good for the review/staleness policy | built for recall, not conceptual mastery |

**Recommended research path:**
1. Collect gold-labelled observations with the demo.
2. Calibrate Jev.
3. Add the level-`score` pass (weakness 2).
4. Add prerequisite priors.
5. Fit parameters by EM once there are hundreds of children.
6. Compare CBT with the latent-ability Kalman filter on held-out questionnaire prediction.

## 6. How to use the demo for this research

- **Jev accuracy:** tick "Expected" for each observation. The panel shows precision and recall at P ≥ 0.5. Export the labelled data from `demo/data/children/*.json` for calibration fitting.
- **Ontology checks:** look for recurring confusions between adjacent capabilities, for example AB-02 vs NQ-05 vs MT-02 on make-ten strategies. These are candidates for boundary rewrites or merges.
- **Belief dynamics:**
  - Replay the same history under different parameters with the Belief model panel's "Replay history" button.
  - Use each capability's evidence trail in its detail panel to check that each step "feels right" to a teacher or parent.

## 7. References

- Corbett, A. T., & Anderson, J. R. (1995). Knowledge tracing: Modeling the acquisition of procedural knowledge. *UMUAI*.
- Pardos, Z. A., & Heffernan, N. T. (2010). Modeling individualization in a Bayesian networks implementation of knowledge tracing. *UMAP*.
- Baker, R. S., Corbett, A. T., & Aleven, V. (2008). More accurate student modeling through contextual estimation of slip and guess probabilities in BKT. *ITS*.
- Piech, C., et al. (2015). Deep knowledge tracing. *NeurIPS*.
- Khajah, M., Lindsey, R. V., & Mozer, M. C. (2016). How deep is knowledge tracing? *EDM*.
- Käser, T., Klingler, S., Schwing, A. G., & Gross, M. (2017). Dynamic Bayesian networks for student modeling. *IEEE TLT*.
- Pelánek, R. (2016). Applications of the Elo rating system in adaptive educational systems. *Computers & Education*.
- Settles, B., & Meeder, B. (2016). A trainable spaced repetition model for language learning. *ACL*.
- Pearl, J. (1988). *Probabilistic Reasoning in Intelligent Systems* (virtual evidence).
- Chan, H., & Darwiche, A. (2005). On the revision of probabilistic beliefs using uncertain evidence. *AIJ* (Jeffrey vs. Pearl updating).
- Rubin, D. B. (1976). Inference and missing data. *Biometrika*.
- Zadrozny, B., & Elkan, C. (2002). Transforming classifier scores into accurate multiclass probability estimates. *KDD*.
- Glickman, M. E. (1999). Parameter estimation in large dynamic paired comparison experiments (Glicko). *JRSS C*.
- Grünwald, P., & van Ommen, T. (2017). Inconsistency of Bayesian inference for misspecified linear models, and a proposal for repairing it (SafeBayes / tempered likelihood). *Bayesian Analysis*.
