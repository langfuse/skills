---
name: langfuse-improvement-loop
description: Close the loop on an LLM/agent app — go from a reported production symptom to a measured improvement, grounded entirely in Langfuse data. Use when someone reports a production symptom ("too many follow-ups", "quality dropped", "answers get flagged", "users are confused") and wants it actually fixed and proven, not just diagnosed.
---

# Improvement Loop

## Table of contents

- [Cycle overview](#cycle-overview)
- [Setup](#setup)
- [① Find the root cause](#-find-the-root-cause-from-traces-not-guesses)
- [② Assess fix options](#-assess-the-fix-options--the-prompt-is-not-always-the-lever)
- [③ Make the change behind a safe boundary](#-make-the-change-behind-a-safe-boundary)
- [④ Encode failures as eval](#-encode-the-failures-as-dataset-cases--a-targeted-evaluator)
- [⑤ Compare and decide](#-compare-versions-and-decide)
- [Common mistakes](#common-mistakes)
- [Compare & regression CLI recipes](#compare--regression--cli-recipes)

The repeatable cycle for turning a vague production symptom into a change you can **prove** helped without regressing anything else. Works on any Langfuse-traced app.

## Cycle overview

```
  ① ROOT CAUSE      → ② ASSESS OPTIONS → ③ CHANGE (safe)   → ④ ENCODE AS EVAL  → ⑤ COMPARE & DECIDE
  read the traces     pick the lever     candidate label /    dataset cases +     baseline vs candidate,
  name the pattern    (not always prompt) branch, not prod     a targeted scorer   per-item regression check
```

The discipline that makes this worth doing: **every step is grounded in data, and the change is gated by a measurement, not a vibe.** Never jump from symptom to fix, and never promote a fix you only checked in aggregate.

This loop starts from *one* reported symptom. If you don't have a specific one yet — or aren't sure which issue is worth fixing first — run [issue-detection-triage.md](issue-detection-triage.md) first; its ranked P0/P1 findings (each with a one-line symptom and example trace IDs) drop straight into Step ① below.

## Setup

Credentials and CLI basics: follow the **`langfuse` skill** CLI section and [cli.md](cli.md). Do not ask the user to paste keys into chat.

The CLI reads `LANGFUSE_HOST`; projects often store the host as `LANGFUSE_BASE_URL`. Load project env if needed, map host, verify:

```bash
set -a; [ -f ./.env ] && . ./.env; set +a
export LANGFUSE_HOST="${LANGFUSE_BASE_URL:-$LANGFUSE_HOST}"
npx langfuse-cli api traces list --limit 1   # verify before proceeding
npx langfuse-cli api __schema               # discover resources
npx langfuse-cli api <resource> --help      # args for any call
```

You also need a **Langfuse dataset** + an **experiment runner** that executes each dataset item through the app and attaches scores (commonly a `dataset:run` script). If none exists, you build one in Step ④.

[Compare & regression CLI recipes](#compare--regression--cli-recipes) holds copy-paste CLI recipes for Steps ③ and ⑤.

---

## ① Find the root cause (from traces, not guesses)

**Quantify the symptom first.** Restate the complaint as a score rate or a measurable trace pattern over a defined window. Convert relative dates → absolute ISO (today's date is in context).

```bash
# Which signal is firing, and how often? Aggregate per score name.
npx langfuse-cli api scores list --from-timestamp <ISO> --limit 100 > /tmp/sc.json
python3 -c "import json,collections; d=json.load(open('/tmp/sc.json'))['data']; \
c=collections.Counter(s['name'] for s in d); print(c)"
```

A score whose rate matches the complaint (e.g. `asks_follow_up` ~15%) confirms the symptom; the other scores being clean rules out alternatives.

**Read the actual transcripts.** Numbers say *what*; only transcripts say *why*. Pull the **real app traces** (exclude evaluator/LLM-judge traces — filter by the app's tag, name, or `userId`):

```bash
npx langfuse-cli api traces list --name <app-trace-name> --environment default \
  --from-timestamp <ISO> --fields core,io --limit 100 --order-by timestamp.desc
```

Reconstruct each conversation in time order and lay every user turn next to the answer that preceded it. To follow multi-turn sessions, group by `sessionId` and fetch full detail with `npx langfuse-cli api sessions get <sessionId>`.

**A root cause is a repeating pattern, not an anecdote.** Confirm the same shape recurs, and **slice by the dimension the symptom hints at** (difficulty, category, model, etc.). If that dimension isn't on the traces yet, that's a finding — add it as trace `metadata` (Step ③) so you can slice next time. The strongest tell: *the system already does the right thing somewhere* (e.g. reactively on a follow-up) but not at the right time.

> Note on parsing: trace `output`/prompt strings contain raw newlines — load JSON with `json.loads(raw, strict=False)`. List endpoints cap `--limit` at 100; paginate with `--page`.

**State the root cause as one sentence**: behavior → consequence.
*"The agent assumes the user can already open Settings, so every deep-Settings task produces a 'where do I find that?' follow-up."*

Output: one-sentence root cause + the concrete failing examples (reuse them verbatim in Step ④).

## ② Assess the fix options — the prompt is not always the lever

Teams over-index on prompt edits. Map the root cause to the *kind* of fix it calls for, list the realistic options, then pick the **minimal, highest-leverage, most reversible** one.

| Root cause looks like… | Candidate levers (rough order of reach) |
|---|---|
| Model knows it but applies it inconsistently / at the wrong time | **Prompt rule** (add/sharpen/reorder), or a **few-shot example** |
| Behavior depends on missing/irrelevant context | **Retrieval / tool fix** (index coverage, ranking, empty-handling), **context assembly** |
| Logic, ordering, retries, tool wiring is wrong | **Code / implementation** change (control flow, tool defs, guardrails) |
| Right behavior, wrong cost/latency | **Model swap**, parallelize calls, trim context |
| Capability ceiling on hard inputs | **Stronger model** for the hard slice, or task decomposition |
| Can't even tell if it's broken | **Add an evaluator / metric first**, then re-enter the loop |

Choose on: *leverage* (hits the whole pattern?), *blast radius* (what else it touches), *reversibility* (one-move rollback?), *measurability* (can Step ⑤ detect it?). Ties → ship the smaller one. Often it's a **combination** (a prompt rule *and* dataset cases that lock it in) — fine; keep each change attributable. State the chosen option, the rejected ones, and why — briefly. Recommend; don't survey endlessly.

## ③ Make the change behind a safe boundary

Isolate the change so the live system is untouched until Step ⑤ says ship.

**Prompt change → publish to a NON-production label** (e.g. `candidate`), never straight to `production`:

1. Edit the in-repo source of truth (often a `SYSTEM_PROMPT` constant), then `npm run typecheck`.
2. Publish to a test label and confirm it landed there (not on `production`):
   ```bash
   npx langfuse-cli api prompts get <name> --label production   # note current prod version
   # publish to candidate (see the two traps below), then verify:
   npx langfuse-cli api prompts list --name <name>              # check labels per version
   ```
3. Ensure the app's fetch **honors the label**: `langfuse.prompt.get(name, { label })`. If it hardcodes `production`, the candidate never runs — wire the label through (default it to `production`).

**Code / implementation / retrieval change →** do it on a branch or behind a flag; keep it reviewable; `typecheck`/tests green before measuring.

**Adding trace dimensions** (to enable slicing from Step ①) → propagate string `metadata` onto the trace (e.g. `{ difficulty }`) and have the traffic/runner pass it.

**Get explicit confirmation before ever touching `production`.** Two traps that silently waste a run (full recovery in [Compare & regression CLI recipes](#compare--regression--cli-recipes)):

- **dotenv `override: true`** makes `.env` clobber shell-exported vars, so `LABEL=candidate npm run …` still uses `.env`'s label. Set the label *in `.env`* for the run, or move labels via the API afterward.
- If you accidentally publish to `production`, move the label back: `PATCH /api/public/v2/prompts/{name}/versions/{version}` with `{"newLabels":["production"]}` on the prior version, and `{"newLabels":["candidate"]}` on yours. (`latest` is auto-managed; the live app reads `production`.)

## ④ Encode the failures as dataset cases + a targeted evaluator

A fix with no test regresses silently. Two parts:

**Dataset cases** mirroring the Step ① failures. Match the dataset's existing item schema (typically `id`, `input.messages`, `expectedOutput.idealAnswer` + `expectedKeywords`, `metadata.category`/`difficulty`). Give the new cases a distinct slice (`difficulty: "hard"`, a new `category`) so you can read the target subset on its own. Add them to the seed file and upsert idempotently (`npm run dataset:seed` — creates items by `id`). To create from scratch via API: `langfuse.api.datasets.create({name})` then `datasetItems.create({...})` per item.

**An evaluator that captures the fix's *intent*** — not just generic keyword overlap, which usually can't see the improvement. If the fix is "ground where the app lives," add a `first_answer_grounding` scorer; if it's "refuse out-of-scope cleanly," score that. Keep the correctness/overlap scorer too — it's your regression guard. Prefer a **deterministic (code)** evaluator when the property is checkable; use an LLM-judge only for genuinely subjective properties.

```js
// In the experiment runner's evaluators array, alongside the correctness guard:
async ({ output }) => {
  const grounded = /home screen|gray gear|swipe down|search|→/i.test(output);
  return { name: "first_answer_grounding", value: grounded ? 1 : 0,
           comment: grounded ? "grounds the entry point" : "opens app without saying where" };
}
```

**Separate concerns:** put substantive steps in `expectedKeywords` (measures correctness → regression guard); let the intent-evaluator measure the new behavior. Do **not** stuff the fix's own words into `expectedKeywords` — that games the overlap metric and hides regressions.

## ⑤ Compare versions and decide

Run the **same dataset** through the **baseline** (current `production`) and the **candidate** as two named runs, then judge. Make the run name carry the label so they're distinguishable, e.g. `dad-it-support-${label}-${ISO}`.

```bash
# Baseline (.env label = production), then candidate (.env label = candidate). See CLI recipes section.
npm run dataset:run
```

- **Aggregate is necessary but not sufficient** — a higher average hides individual drops. Do a **per-item diff** across both runs for every score (recipe in [Compare & regression CLI recipes](#compare--regression--cli-recipes)).
- **Read the answer for every item that dipped** and classify each: (a) real regression → fix or reconsider; (b) measurement artifact (an `expectedKeywords` phrasing shift while correctness held); (c) LLM-judge noise (±0.05–0.1 on a single stochastic pass). Don't dismiss drops unread; don't panic over noise.
- **Verdict rule:** ship only if the intent-evaluator rose on the **target slice** *and* the correctness/overlap guard didn't drop on any item beyond noise. Otherwise iterate (back to ② or ④).
- **Name collateral behavior change** the dataset doesn't cover (e.g. a generalized rule making *easy* answers verbose) as a tradeoff, even if scores don't catch it.
- **Promote only on explicit confirmation** — moving `candidate` → `production` is outward-facing.

Report: the comparison table (aggregate + target slice), the per-item regression verdict, any tradeoff, and the Langfuse run links. Then ask before promoting.

---

## Common mistakes

- **Symptom → fix without reading traces.** You'll fix a guess.
- **Assuming the lever is the prompt.** Run Step ②; sometimes it's retrieval, code, or "add a metric first."
- **Counting evaluator traces as app traces.** LLM-judge runs share the score/trace lists — filter by app tag/name/`userId`.
- **One trace ≠ a root cause.** Confirm the pattern recurs; slice by the relevant dimension.
- **Publishing to `production` to "test."** Use a candidate label/branch; promote after Step ⑤ + confirmation.
- **Trusting the aggregate.** Always per-item diff and read the dips.
- **A generic evaluator that can't see the fix.** Add a scorer for the *intent*, or you'll measure noise.
- **Gaming `expectedKeywords`** with the fix's own words — keep them as an independent regression guard.
- **Prompt/fallback drift** — update both the Langfuse-managed prompt and the in-repo fallback, matching the current variant so you only add your change.
- **Forgetting the collateral tradeoff** — report behavior shifts the dataset doesn't score.

---

## Compare & regression — CLI recipes

Concrete, copy-paste recipes for Steps ③ and ⑤. Assumes [Setup](#setup) is done (`LANGFUSE_HOST` exported). For prompt label recovery, raw `curl` uses `$LANGFUSE_HOST` — same host var as the CLI.

### A. Publish a prompt to a `candidate` label (NOT production)

The in-repo `SYSTEM_PROMPT` is usually the source of truth; the publish script reads it. The label normally comes from `LANGFUSE_PROMPT_LABEL`.

**The trap:** many projects load env with dotenv `config({ override: true })`, which makes `.env` values *overwrite* anything you export in the shell. So this does **not** work:

```bash
LANGFUSE_PROMPT_LABEL=candidate npm run prompt:publish   # ❌ .env's "production" wins
```

**Reliable approach — set the label in `.env` for the run, then restore:**

```bash
# 1. edit .env: LANGFUSE_PROMPT_LABEL=candidate   (use the Edit tool, then:)
npm run typecheck && npm run prompt:publish
# 2. restore .env: LANGFUSE_PROMPT_LABEL=production
```

**Verify it landed on candidate, not production:**

```bash
npx langfuse-cli api prompts list --name <name>   # labels per version
```

### B. Recover if you published to `production` by accident

Labels are unique pointers; publishing moves `production` to the new version. To undo, move it back and relabel yours. The CLI ignores `--prompt-version` on `get` in some versions, so use raw REST to inspect, and `PATCH` to set labels:

```bash
# inspect each version (raw newlines break strict JSON → strict=False)
for v in 1 2 3 4; do
  curl -s -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
    "$LANGFUSE_HOST/api/public/v2/prompts/<name>?version=$v" > /tmp/v$v.json
  python3 -c "import json;d=json.loads(open('/tmp/v$v.json').read(),strict=False);\
print('v$v',d['labels'],len(d['prompt']))"
done

# move production back to the prior good version (e.g. 3)
curl -s -X PATCH -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
  -H "Content-Type: application/json" -d '{"newLabels":["production"]}' \
  "$LANGFUSE_HOST/api/public/v2/prompts/<name>/versions/3"

# put your new version (e.g. 4) on candidate
curl -s -X PATCH -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
  -H "Content-Type: application/json" -d '{"newLabels":["candidate"]}' \
  "$LANGFUSE_HOST/api/public/v2/prompts/<name>/versions/4"
```

`latest` is auto-managed (always the highest version number) and is fine to leave on your new version — the live app fetches by the `production` label.

### C. Run baseline + candidate over the same dataset

Make the run name carry the label so the two runs are distinguishable in the UI (one-line change in the runner):

```js
const runName = `myapp-${env.langfusePromptLabel}-${new Date().toISOString()}`;
```

Then run twice, flipping the label in `.env` between runs (same dotenv trap as above). These are real LLM calls — they take minutes; run in the background and wait for completion.

```bash
# .env label = production
npm run dataset:run        # → baseline run, prints avg scores + run URL
# edit .env label = candidate
npm run dataset:run        # → candidate run
# restore .env label = production
```

Each run prints `Average Scores` and a Dataset Run URL. Note both run names.

### D. Per-item regression diff (the part aggregates hide)

Map `datasetItemId → traceId` for both runs, pull the scores in the window, and diff every score per item.

```bash
# 1. fetch both runs' items
npx langfuse-cli api datasets get-get-run "<dataset>" "<baseline-run-name>"  > /tmp/run_base.json
npx langfuse-cli api datasets get-get-run "<dataset>" "<candidate-run-name>" > /tmp/run_cand.json

# 2. pull scores in the window (paginate; 100/page)
for p in 1 2 3; do
  npx langfuse-cli api scores list --from-timestamp <ISO> --limit 100 --page $p > /tmp/sc$p.json
done
```

```python
# 3. diff. python3 - <<'EOF'
import json, glob, statistics as st
base = {it['datasetItemId']: it['traceId'] for it in json.load(open('/tmp/run_base.json'))['datasetRunItems']}
cand = {it['datasetItemId']: it['traceId'] for it in json.load(open('/tmp/run_cand.json'))['datasetRunItems']}
scores = {}
for f in glob.glob('/tmp/sc*.json'):
    for s in json.load(open(f)).get('data', []):
        scores.setdefault(s['traceId'], {})[s['name']] = s['value']
items = sorted(set(base) & set(cand))
names = sorted({n for t in scores.values() for n in t})
def g(m, it, n): return scores.get(m.get(it), {}).get(n)
regress = []
for it in items:
    row = []
    for n in names:
        a, b = g(base, it, n), g(cand, it, n)
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            row.append(f"{n}:{a:.2f}->{b:.2f}")
            if b < a - 0.001: regress.append((it, n, a, b))
    print(it, '|', '  '.join(row))
for n in names:
    bv = [g(base, it, n) for it in items if isinstance(g(base, it, n), (int, float))]
    cv = [g(cand, it, n) for it in items if isinstance(g(cand, it, n), (int, float))]
    if bv and cv: print(f"AVG {n}: {st.mean(bv):.3f} -> {st.mean(cv):.3f}")
print("REGRESSIONS:", regress or "NONE")
# EOF
```

For every entry in `REGRESSIONS`, fetch the candidate answer and read it before judging:

```bash
npx langfuse-cli api traces get <candidate-traceId>   # inspect output.answer
```

Classify each: **real regression** (fix/reconsider) · **measurement artifact** (`expectedKeywords` phrasing shifted but correctness held) · **LLM-judge noise** (±0.05–0.1 single-pass). Ship only if the intent-evaluator rose on the target slice and no item's correctness guard dropped beyond noise.
