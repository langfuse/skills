# Multi-Run Comparison — Issue-Detection Triage (5 independent runs)

**Project:** `clkpwwm0m000gmm094odg11gi` (EU cloud) · **Window:** last 7 days, `2026-07-01 → 2026-07-08` UTC
**Setup:** 5 `general-purpose` agents, each running the full `langfuse-issue-detection-triage` skill independently, no coordination, identical pinned scope. Reports in `run-1.md … run-5.md`.

> Purpose: measure run-to-run consistency and derive changes to make the skill more deterministic. Each run also spawned ~3 nested investigation sub-agents (per the skill's dimension-checklist instruction), so the true agent tree was ~20 agents.

---

## 1. Where the runs agreed (scope — near-zero variance)

| Dimension | R1 | R2 | R3 | R4 | R5 |
|---|:--:|:--:|:--:|:--:|:--:|
| Window (7d) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product env = `default` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product split (QA 265 / Image 42 / Sentiment 20 / Voice 9 = 336) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Excluded 1565 judge + 170 experiment + 1 self-test | ✓ | ✓ | ✓ | ✓ | ✓ |
| Headline metrics ($9.54 cost, p50 20.5s, p99 ~103s, max 156s) | ✓ | ✓ | ✓ | ✓ | ✓ |

**Takeaway:** the machinery-exclusion + scoping workflow and the pinned window produced consistent results. Remaining divergence is in **judgment** (severity, root-cause, clean-vs-finding), not data gathering.

## 2. Findings matrix (priority per run)

`—` not surfaced · `clean` explicitly declared a verified non-issue · `lim` relegated to "not covered"

| Issue | R1 | R2 | R3 | R4 | R5 |
|---|:--:|:--:|:--:|:--:|:--:|
| "Language & style" evaluator invalid | **P0** | P1 | P1 | P1 | **P2** |
| …root cause diagnosed | mapping | mapping | mapping | mapping | **"noisy judge"** |
| "User disagreement" evaluator *also* broken | **P0** | — | P3(dead) | — | — |
| `getDocsPage` hallucinated-URL loops | (in 504) | **P0** | — | P1 | — |
| `searchLangfuseDocs` 504s | P1 | P0 | P2 | clean-ish | P2 |
| …504 rate reported | 5 traces | 5 (ERROR) | **8.75%** | 2.5% | **2.1%** |
| Empty/null answers (2 traces) | P1 | P0 | P2 | P1 | P2 |
| High latency (p99 103s) | P1 | P2 | **—** | P2 | P1 |
| Token/cost waste | P2 | P2 | **clean** | P2 | **clean** |
| …max tokens reported | 91k | 91k | — | **505k** | (bounded) |
| Off-topic **handling** | P2 over-reach | clean | clean | clean | **P1 over-serving** |
| Off-topic **volume / drift** | — | P1 | P2 | P2 | (in synth) |
| Model misreport ("GPT-4o") | P2 | P3 | — | — | P1 |
| `is_cursing` dead evaluator | P2 | clean | P3 | P3 | P2 |
| 28-turn friction session | P2 | **—** | P3 | P2 | P1 |
| No prod correctness / apps unmonitored | lim | — | **P1** | P2 | P2 |
| Voice agent (fallback / runaway / null I/O) | **clean** | P3 | **P2** | open-q | P3 |
| Missing version/release tags | lim | lim | P3 | P3 | P2 |
| **Synthetic 47% canned traffic** | — | — | (open-q) | — | **P3 (only R5)** |
| Retrieval precision on generic queries | — | — | clean | clean | **P3 (only R5)** |

## 3. The divergences that matter

**A. Severity is unstable — same defect, different bucket.** Broken primary evaluator: P0/P1/P1/P1/P2. Latency: P1/P2/—/P2/P1. Off-topic: P2/P1/P2/P2/P1. The `severity × prevalence × silence` formula is too qualitative; everyone multiplied differently.

**B. Same symptom, opposite root cause (most dangerous).** On `Language & style`, runs 1–4 read the score *comments* ("there is no prior assistant message… score 0") → **broken input mapping** (config fix). Run 5 read the score *values* → **miscalibrated noisy judge** ("calibrate against human labels"). Same evaluator, contradictory fixes; Run 5 prescribed the wrong one because it never read the reasoning text.

**C. "Verified clean" vs "finding" flat contradictions.**
- Voice agent: R1 *clean, "normal path"* vs R3 *P2, "every dimension red."*
- Cost/tokens: R3, R5 *clean, "no runaway"* vs R1, R2, R4 *P2 waste.*
- Off-topic handling: R2/R3/R4 *"declines gracefully"* vs R5 *P1, serves full AWS Lambda tutorials.*

**D. Same metric, different numbers.** 504 rate 2.1%→8.75% because R3 parsed 504s buried at `DEFAULT` level in tool bodies while others counted only `level=ERROR`. Max-tokens 91k vs 505k = per-generation input vs per-trace total. No shared metric definitions.

**E. Coverage lottery — big findings only one run caught.** Only R5 caught that **47% of traffic is one repeated canned prompt** (silently skewing every aggregate the other four trusted). Only R1 caught the **second** broken evaluator. R2 missed the 28-turn friction session. R3/R4 missed the model misreport.

## 4. Skill changes to improve consistency (each tied to a divergence)

1. **Concrete P0–P3 rubric + worked examples** *(fixes A)* — testable thresholds and a decision tree; pin worked examples so a broken primary evaluator lands in one bucket every time. Highest leverage.
2. **Mandate reading evaluator reasoning/`comment` fields before interpreting a score** *(fixes B)* — comments referencing missing data ⇒ wiring bug (fix mapping), not miscalibration. Never diagnose from score values alone.
3. **Count errors from output bodies, not just `level=ERROR`** *(fixes D)* — report N at ERROR vs M in bodies; the gap is itself a finding (silent errors).
4. **Define core metrics once** *(fixes D)* — latency at root level; tokens as both per-trace total and per-generation, labeled; error rate = affected traces / examined.
5. **Mandatory input-distribution step before computing aggregates** *(fixes E's biggest miss)* — tally distinct input strings; flag dominant templated inputs as likely synthetic and report their share; all rates are conditioned on this.
6. **Judge out-of-scope handling from a sample of actual outputs, not the intent label** *(fixes off-topic contradiction in C)* — one fully-served off-topic request among graceful declines is still a finding.
7. **Define the "verified clean" bar for low-volume / null-I/O apps** *(fixes voice contradiction in C)* — null I/O + 100% fallback + runaway span = "unmonitored / insufficient data" (coverage finding), never "clean."
8. *(Lower priority)* **One finding per root cause** — file the cause, list downstream symptoms in its description (Run 4 did this well; others fragmented).

**What already works:** don't touch machinery-exclusion / scoping — 5/5 convergence proves pinning *parameters* works. The remaining variance is in *judgment*, so the fixes convert judgment calls into explicit procedures.
