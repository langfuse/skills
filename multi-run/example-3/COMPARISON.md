# Multi-Run Comparison — Example 3 (in-app-agent project, revised skill)

**Project:** `cmfzimu6801jbad079856b07r` (EU cloud) — a *"langfuse-in-app-agent"* observability assistant.
**Window:** last 7 days, `2026-07-01 → 2026-07-08` UTC · **Skill:** revised version (post example-1 edits).
**Purpose:** generalization test — do the skill edits hold on a *different* workload they were never tuned against?

> Note: this batch was launched during a sustained Anthropic `529` overload; the first two attempts failed and wrote nothing. All 5 eventually completed after backoff. No partial/corrupt outputs resulted.

---

## 1. Scope convergence — effectively perfect (5/5)

| Dimension | r1 | r2 | r3 | r4 | r5 |
|---|:--:|:--:|:--:|:--:|:--:|
| Total traces (254) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Observations (865) | ✓ | ✓ | ✓ | ✓ | ✓ |
| In-window scores (2) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product = `langfuse-in-app-agent` (221; core `agent-turn` n=79) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Secondary `langfuse-natural-language-filter` (33) noted | ✓ | ✓ | ✓ | ✓ | ✓ |
| Machinery to exclude = none | ✓ | ✓ | ✓ | ✓ | ✓ |

## 2. The two procedures that failed in example-1 — both held here (5/5)

**Input-distribution step (example-1's biggest blind spot, caught by only 1/5 there):**
All 5 ran it and unanimously concluded **"diverse/organic, ~65 distinct inputs / 79 turns, not synthetic — rates trustworthy."** The exact *inverse* of example-1's "47% canned" verdict — proving the check *discriminates* rather than always crying synthetic.

**Evaluator-validity via comments (example-1's dangerous wrong-root-cause divergence):**
All 5 read the evaluator comments and correctly concluded the evaluators are **wired correctly but dormant** (a coverage/not-running problem), explicitly **not** a mapping bug. Run-1 went deepest and found the mechanism: the main generation was renamed `agent-run → agent-turn` on 2026-07-03, but the eval rules still filter `name="agent-run"`, so they match zero current traffic. **Zero misdiagnoses** (vs example-1 v1, where run-5 misread it as a "noisy judge").

## 3. Findings matrix (priority per run)

| Finding | r1 | r2 | r3 | r4 | r5 |
|---|:--:|:--:|:--:|:--:|:--:|
| Quality evals dark / not firing | **P0** | P1 | P1 | P1 | **P0** |
| Context-overflow crash (1.37M > 1M tokens) | P1 | P1 | P1 | P1 | P1 |
| High latency (all cite p50 **13.9s**) | P1 | P1 | P1 | P1 | P1 |
| Core-agent cost/tokens uninstrumented | P2/P3 | P1 | P1 | P1 | (minor) |
| Empty / no-final-answer turns | P2/P3 (4/79) | clean (2, verified) | **P0 (9/79)** | P1 (3/79) | P1 (2/79) |
| Malformed tool args (`&lt;` HTML-escape) | P2/P3 | P2/P3 | P2/P3 | P2/P3 | P2/P3 |
| Null release/version tags | P3 | P3 | P3 | P3 | P3 |

## 4. Consensus vs residual divergence

**Strong consensus:** all 5 caught the same real issues (dormant evals, context-overflow crash, latency, cost instrumentation gap, malformed args), agreed on scope, and applied every new procedure correctly. Latency numbers are identical across runs (metric-definition fix working).

**Residual divergence — two axes, both about *ranking/definition*, not *detection*:**

1. **Severity bucketing of secondary findings.** Eval-gap P0 (r1, r5) vs P1 (r2, r3, r4); cost-instrumentation P1 (r2,r3,r4) vs P2/P3 (r1). The rubric narrowed the spread vs example-1 but didn't eliminate it for findings near a bucket boundary.
2. **"What counts as an empty/failed turn"** — the widest gap: P0 9/79 (r3) vs P1 3/79 (r4) vs P1 2/79 (r5) vs verified-clean 2 (r2) vs P2/P3 4/79 (r1). Root: no shared definition of a "complete turn" for a **tool-using agent** — is a turn that ends on a tool action with no final text a failure or a legitimate completion? Each run drew the line differently, producing both a **count** spread (2→9) and a **severity** spread (clean→P0).

## 5. Verdict

The example-1 edits **generalize**: on a workload they were never tuned against, the two *dangerous* divergences (wrong root-cause diagnosis, synthetic-traffic blind spot) **did not recur** — 5/5 correct on both. Detection and procedure-application are highly consistent.

The **remaining** inconsistency is narrower and of a different kind: (a) severity bucketing near boundaries, and (b) a genuinely new **definitional gap** — "complete turn" for tool-using agents — that this workload exposed and the current skill doesn't address.

### Recommended next skill edits
1. **Sharpen the rank rubric for coverage/absence findings** — e.g. "a dormant/unmonitored *primary* quality signal = P0 (you are blind on the main metric); a *secondary* one = P1." Removes the eval P0-vs-P1 split.
2. **Define a "complete turn" for tool-using agents** in dimension A (empty/null outputs): a turn that ends on a tool action with no synthesized user-facing text **is** an empty-output candidate — count it, then judge whether the product expects a closing message. Pins both the count and the severity of the empty-turn finding.
