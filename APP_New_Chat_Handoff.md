# APP Design — New Chat Handoff

**Canonical version:** v1.2 · 24 Sep 2026

Attach `APP_Product_Inception_Research.html`; for ontology-level work also attach `APP_Capability_Model_v0.1.json`; for Jev observation-classification work attach `JEV_43_Capability_Questions_Simple.json`. Then paste:

> We are continuing the design of my commercial personalized math/logic learning app for children.
> Read the attached `APP_Product_Inception_Research.html` **in full** and treat it as the canonical product-inception context from my previous long conversation.
> If `APP_Capability_Model_v0.1.json` is attached, treat it as the machine-readable first draft of the Capability ontology.
> Do not restart discovery or revert to the older assessment-heavy architecture.
> Before proposing a major architecture change, briefly restate the current canonical model and explicitly identify what existing decision you propose to change.
> Do not incorporate Dan Wolczuk collaboration/contract research unless I explicitly ask for it.

## Current canonical product decisions

- Parent is the economic customer; **parent burden must remain very low**.
- Initial focus is likely ages **4–8**, extensible roughly **3–10**.
- Capability families are **Math Content, Mathematical Thinking, and Metacognition**.
- There is **no separate Communication/Social capability family**. Explain/teach-back/error-critique are activity mechanisms.
- Parent observation is **detached from individual activities**. Activities are primarily for learning.
- Parent input is sparse/adaptive check-ins, normally **YES / NO / NOT_SURE**, plus optional free text.
- Capability is the primary learner-state primitive.
- Parent-facing Capability status: `UNKNOWN / NOT_YET / DEVELOPING / CONSISTENT`. Internally retain belief probabilities, confidence, recency/staleness and evidence history.
- Skills are narrower instructional/pedagogical components. Each Skill has **one owner Capability**; it may support others. Full per-child SkillState is optional/future.
- **Indicator** = predefined parent-observable manifestation. **Evidence** = actual dated answer/observation/signal. These are not synonyms.
- Capability definitions should be semantically as exclusive as practical, but one Evidence event may support **multiple** Capabilities.
- Capability model is DAG-ish. Only `REQUIRES` must be acyclic. Other relations include `FACILITATES`, `SUPPORTS`, `TRANSFER_RELATED`, `PART_OF`, `RELATED_TO`.
- The graph is a **prior/readiness structure, not a law**. Direct evidence may update a Capability whose predecessor state is unknown.
- Activities map N:M to Capabilities and are not compulsory assessments.
- Use **Bayesian thinking / a Capability Belief Model** for sparse irregular evidence. **Do not use classical BKT as the top-level v1 learner model.**
- BKT/knowledge tracing can later become a specialized evidence source underneath the Capability model where dense repeated attempts are reliably tagged to Skills.
- Missing data should mostly reduce confidence/increase staleness, not automatically lower capability status.
- Jev is the preferred runtime structured classifier for sparse parent signals and candidate scoring. **Jev classifies; the capability model remembers; ordinary code constrains; the policy engine decides.**
- **Generic Jev observation schema (v1.2):** flatten all 43 Capabilities into 43 independent yes/no (`noul`) questions. Use each answer's `P(true)` as the **positive-support percentage of that observation for that Capability**.
- Do **not** use the earlier `SUPPORTS / CONTRADICTS / MIXED / INSUFFICIENT` four-way schema for the generic observation classifier.
- A low Jev `P(true)` means “this observation does not positively support this Capability,” **not** “the child lacks this Capability.” Low support should normally cause no negative learner-state update.
- A targeted parent questionnaire `NO` is different: because the Indicator was explicitly probed, it may be used as conservative negative evidence. `NOT_SURE` is no evidence.
- Use full LLMs selectively for optional free text/narrative/offline content and ontology work.
- Recommender: Capability belief + graph readiness + uncertainty/staleness + downstream value → `VERIFY / INTRODUCE / PRACTICE / EXTEND / REVIEW` → deterministic activity filtering → optional Jev scoring → recommendation.
- Differentiation is parent-visible insight into mathematical development and thinking, not generic “AI personalized math.”

## Foundational object boundaries

| Object | Canonical meaning |
|---|---|
| **Capability** | Durable, transferable mathematical or metacognitive state the product cares about. |
| **Skill** | Narrower teachable/practicable knowledge, strategy, procedure, or representation owned by one Capability. |
| **Indicator** | Predefined observable behavior that would be informative about a Capability. |
| **Evidence** | Actual dated parent questionnaire response, free-text observation, optional activity signal, or future telemetry. |
| **Activity** | Learning experience intended to introduce/practice/extend/review; does not have to produce Evidence. |

## Capability Model v0.1 — 43 first-draft Capabilities

### Number & Quantity
- `NQ-01` — Quantity as a Set Property
- `NQ-02` — Counting & Cardinality
- `NQ-03` — Numeral–Quantity Mapping
- `NQ-04` — Magnitude, Order & Number-Line Relations
- `NQ-05` — Number Composition & Part–Whole Structure
### Additive & Base-Ten Reasoning
- `AB-01` — Additive Situation Structure
- `AB-02` — Additive Relations & Calculation
- `AB-03` — Base-Ten Unitization & Place Value
- `AB-04` — Multi-Digit Additive Reasoning
### Multiplicative Reasoning
- `MR-01` — Equal Groups, Arrays & Multiplication
- `MR-02` — Division, Sharing & Grouping
- `MR-03` — Multiplicative Comparison & Scaling
### Fractions & Decimals
- `RD-01` — Equal Partition & Unit Fraction
- `RD-02` — Fraction as Number & Magnitude
- `RD-03` — Fraction Equivalence & Composition
- `RD-04` — Decimal Place Value & Magnitude
### Patterns & Early Algebra
- `PA-01` — Repeating Pattern Structure
- `PA-02` — Growing Pattern & Functional Change
- `PA-03` — Equality & Equivalence
- `PA-04` — Unknowns & Relational Expressions
### Geometry & Spatial Reasoning
- `GS-01` — Shape Properties & Classification
- `GS-02` — Shape Composition & Decomposition
- `GS-03` — Spatial Relations & Orientation
- `GS-04` — Spatial Transformation & Visualization
### Measurement
- `ME-01` — Length Reasoning
- `ME-02` — Area & Coverage Reasoning
- `ME-03` — Capacity & Volume Reasoning
- `ME-04` — Mass Reasoning
- `ME-05` — Time & Duration Reasoning
- `ME-06` — Angle & Turn Reasoning
### Data & Chance
- `DC-01` — Classification & Categorical Organization
- `DC-02` — Data Representation
- `DC-03` — Data Interpretation & Comparison
- `DC-04` — Chance & Probability Reasoning
### Mathematical Thinking
- `MT-01` — Problem Representation & Modeling
- `MT-02` — Strategy Planning & Mathematical Adaptation
- `MT-03` — Structural Noticing & Generalization
- `MT-04` — Mathematical Justification & Critique
- `MT-05` — Transfer & Analogy
### Metacognition
- `MC-01` — Understanding & Uncertainty Monitoring
- `MC-02` — Strategy Awareness & Progress Monitoring
- `MC-03` — Learning Regulation & Strategy Switching
- `MC-04` — Reflection, Review & Consolidation

The full definitions, exclusions, representative Skill families and sample parent-observable Indicators are in the HTML/JSON artifacts. Treat this list as **DRAFT**, to be pressure-tested for coverage, overlap, parent distinguishability and recommendation consequence before freezing stable IDs for production.

## Generic Jev 43-Capability observation classifier

Use `JEV_43_Capability_Questions_Simple.json` as the current reusable Jev `questions` block when testing arbitrary parent observations.

```text
parent_observation
    ↓
43 flat yes/no Jev questions
    ↓
P(true) for each Capability
    ↓
observation-support vector
    ↓
Capability Belief updater
```

Example interpretation:

```text
AB-02 = 0.91  → this observation strongly supports AB-02
MT-03 = 0.68  → this observation moderately supports MT-03
ME-02 = 0.01  → this observation provides essentially no positive evidence about ME-02
```

These are **observation-support probabilities, not mastery probabilities**.

## Recommended long-term workflow

1. Keep the HTML as the human-readable canonical source of truth.
2. Keep the JSON capability model as the machine-readable ontology draft.
3. When a major decision changes, version both rather than relying on chat memory.
4. Attach the latest artifacts at the start of each new major design thread.
5. Maintain a “Decisions Changed Since vX” section.
6. Keep research-advisor/contract material separate from product architecture.
