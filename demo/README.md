# Capability Profile Demo

A one-page test harness: a parent observation goes to Jev, Jev returns 43 capability support scores, and a Bayesian belief update turns them into a per-child capability profile.

```
node demo/server.js        # Node 18+, no npm install needed
open http://localhost:3000  (?child=<name> preselects a child)
```

## Jev setup

`demo/.env` (git-ignored) holds the TypeSafe Jev config:

- `JEV_API_URL` is `https://api.typesafe.ai/v1/systemone`.
- The key is sent as a Bearer token.
- `JEV_EXTRA_BODY={"model":"jev-latest"}` adds the model name to each request.

`.env.example` is the template. Without a URL, the demo falls back to a keyword **mock scorer**, which the header badge marks in red.

- **Request:** `{ model, state: { parent_observation, child_age }, questions: <the 43-question noul block> }`. The child's name is never sent. Use "Preview Jev payload" to see the exact body.
- **Response:** `answers.<capability id>.noul` holds P(true), and `jev_parse.js` reads it. A call takes about 0.3–0.7 s and about 8k input tokens.

## Belief model: Capability Belief Tracing

`belief.js` implements it; `../Capability_Belief_Model_Research.md` has the full rationale and next research steps.

- Each capability has a hidden level: Not yet, Emerging, Developing, Secure or Consistent. The model keeps a probability for each level.
- Maturity = E[level] / 4.
- Jev's P(true) updates the belief as soft (virtual) evidence: `λ_ℓ = 1 + κ·e_ℓ·(r − 1)`, where `r = odds(s)/odds(π)`.
- Scores at or below the noise floor π carry no evidence, and evidence is never negative.
- Between evidence events, a slow learning drift and a staleness diffusion apply.
- The parameters are editable in the UI; changing them replays the whole history.
- **Parent correction:** click a capability bar and use the slider. This re-anchors that capability's belief so its mean is the slider value, and it is logged as an event you can remove.

## Storage (`demo/data/`, git-ignored)

- `children/<name>.json` holds the profile (the belief over levels, maturity, confidence and status for each capability), the model parameters, every observation (with its 43 scores, belief changes, raw Jev response and gold labels), and the parent adjustments.
- `logs/<name>.md` is an append-only log. Each entry has the datetime, the observation text, the scores ≥ 0.05, and the maturity change per capability.

## Testing Jev accuracy

In the scoring panel, tick **Expected** for the capabilities an observation really supports, then click **Save labels**. The panel then shows precision and recall at P ≥ 0.5, for that observation and for all labeled observations. It also marks each miss and false positive.
