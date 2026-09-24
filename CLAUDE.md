# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this folder is

This is a **product-design workspace** for a commercial personalized math/logic learning app for children (ages ~4–8, extensible to ~3–10). It has no code yet, and no build, lint, or test commands. It is not a git repository. The work here is design documents and machine-readable ontology drafts.

## Demo app (`demo/`)

`node demo/server.js` runs it at http://localhost:3000. It needs Node 18+ and has no dependencies. Jev is configured in `demo/.env` (see `.env.example`); without `JEV_API_URL` it falls back to a keyword mock. The server reads the model JSON and the Jev questions JSON from the repo root. Per-child data goes to `demo/data/`. The belief model is in `demo/belief.js` and is documented in `Capability_Belief_Model_Research.md` at the repo root. The Jev API is TypeSafe (`POST https://api.typesafe.ai/v1/systemone`, `model: jev-latest`); each answer comes back as `answers.<id>.noul`. See `demo/README.md` for details.

## Artifacts and their roles

| File | Role |
|---|---|
| `APP_Product_Inception_Research.html` | **Human-readable canonical source of truth.** Single self-contained HTML (no scripts). Read it in full before proposing design changes. |
| `APP_Capability_Model_v0.1.json` | Machine-readable Capability ontology draft: `{model, version, status, capability_count, capabilities[]}`. Each capability has `capability_id`, `family` (`MATH_CONTENT` / `MATH_THINKING` / `METACOGNITION`), `domain`, `name`, `formal_definition`, `owned_skill_families`, `boundary_exclusion`, `sample_parent_indicator`, `status`, `ontology_version`. |
| `JEV_43_Capability_Questions (Only the question part of query).json` | The Jev `questions` block for the generic observation classifier. It has one `noul` (yes/no) question per Capability ID, and each question's `instructions` embeds that capability's `formal_definition` and `boundary_exclusion` from the model JSON. `APP_New_Chat_Handoff.md` calls this file `JEV_43_Capability_Questions_Simple.json`; it is the same file. |
| `Capability_Belief_Model_Research.md` | Research notes on the per-child Capability Belief Model: the current CBT v0 design, its weaknesses, alternative models, and references. |
| `APP_New_Chat_Handoff.md` | Condensed summary of canonical decisions (currently v1.2, 24 Sep 2026) plus the prompt used to start new design threads. |

**Consistency rule:** the three artifacts are coupled. When you change a Capability's ID, name, definition, or boundary in the model JSON, regenerate or edit the matching Jev question and update the HTML and the handoff too. The capability ID sets in the two JSON files currently match exactly (43 IDs). Keep them that way. When a major decision changes, version the HTML and the JSON instead of editing silently, and record it in a "Decisions Changed Since vX" section.

## Working rules for design work

- Do not restart discovery. Do not go back to the older assessment-heavy architecture.
- Before proposing a major architecture change, briefly restate the current canonical model and name the decision you want to change.
- Do not bring in Dan Wolczuk collaboration or contract research unless the user explicitly asks. Keep research-advisor and contract material separate from product architecture.

## Core model (key invariants; full detail in the HTML)

- **Object boundaries:**
  - **Capability** is the primary learner-state primitive: a durable, transferable state.
  - **Skill** is narrower and has exactly one owner Capability.
  - **Indicator** is a predefined parent-observable behavior.
  - **Evidence** is an actual dated signal.
  - **Activity** is a learning experience that maps N:M to Capabilities and does not have to produce Evidence.
  - Indicator ≠ Evidence, and Activity ≠ assessment.
- **Capability families:** there are three: Math Content, Mathematical Thinking, and Metacognition. There is no Communication/Social family; explain, teach-back, and error-critique are activity mechanisms.
- **The 43 capabilities are DRAFT.** Stable IDs (`NQ-`, `AB-`, `MR-`, `RD-`, `PA-`, `GS-`, `ME-`, `DC-`, `MT-`, `MC-`) are not frozen yet. Check changes for coverage, overlap, whether parents can tell capabilities apart, and what each one means for recommendations.
- **Capability graph:** a DAG-ish graph. Only `REQUIRES` must be acyclic. The other relation types are `FACILITATES`, `SUPPORTS`, `TRANSFER_RELATED`, `PART_OF`, and `RELATED_TO`. The graph is a prior/readiness structure, not a law.
- **Learner model:** a Bayesian Capability Belief Model, not classical BKT at the top level. The demo implements it as a discrete-level HMM with Jev scores as soft evidence (CBT v0). Parents see `UNKNOWN / NOT_YET / DEVELOPING / CONSISTENT`. Internally the model keeps belief probabilities, confidence, staleness, and evidence history. Missing data lowers confidence; it does not lower status.
- **Parent input:** sparse, adaptive YES / NO / NOT_SURE check-ins plus optional free text, kept separate from activities. Parent burden must stay very low.
- **Jev (runtime classifier):** "Jev classifies; the capability model remembers; ordinary code constrains; the policy engine decides."
  - The generic observation schema has 43 independent yes/no questions. `P(true)` is observation-support, not mastery. A low `P(true)` means no positive support, so the model makes no negative update.
  - A targeted questionnaire `NO` can count as conservative negative evidence. `NOT_SURE` counts as no evidence.
  - Do **not** reintroduce the old `SUPPORTS / CONTRADICTS / MIXED / INSUFFICIENT` schema.
  - Use full LLMs only selectively: for free text, offline content, and ontology work.
- **Recommender:** belief + graph readiness + uncertainty/staleness + downstream value → one of `VERIFY / INTRODUCE / PRACTICE / EXTEND / REVIEW` → deterministic activity filtering → optional Jev scoring → recommendation.
