---
name: langfuse-error-analysis
description: Systematic error analysis of an LLM pipeline using Langfuse traces. Use when the user wants to understand how their system fails, build a failure category taxonomy, prioritise what to fix, and decide which failures need evaluators.
---

# Error Analysis

Systematic workflow for reading LLM pipeline traces, building a failure taxonomy, and deciding what to fix.

## When to Use

- User wants to understand how their LLM app fails in practice
- Before building evaluators — to avoid building the wrong ones
- After a prompt rewrite, model switch, or production incident
- Early on in building your system as a first systematic failure evaulation
- When failure categories are unknown and need to emerge from data

## Prerequisites

**Credentials:**
```bash
[ -n "$LANGFUSE_PUBLIC_KEY" ] && echo "LANGFUSE_PUBLIC_KEY set" || echo "LANGFUSE_PUBLIC_KEY not set"
[ -n "$LANGFUSE_SECRET_KEY" ] && echo "LANGFUSE_SECRET_KEY set" || echo "LANGFUSE_SECRET_KEY not set"
[ -n "$LANGFUSE_HOST" ] && echo "LANGFUSE_HOST set" || echo "LANGFUSE_HOST not set"
```
Never print credential values — only check whether they are set. If not set, check for a `.env` file in the project root and load with `export $(grep -v '^#' .env | xargs)`. If still not found, ask the user. Keys are in Langfuse UI → Settings → API Keys.

> **Do not blank credentials in output.** Show actual key values when echoing or printing them — the user needs to verify the correct keys are loaded. Never replace with `****` or `[REDACTED]` unless the user explicitly asks for it.

> **Note:** If the project uses `LANGFUSE_BASE_URL` instead of `LANGFUSE_HOST`, set `export LANGFUSE_HOST="$LANGFUSE_BASE_URL"` before running CLI commands.

**Data requirements:**
- At least ~100 traces in Langfuse (fewer works, but categories may not saturate)
- User available to review first 30–50 traces themselves — categories must be grounded in domain knowledge, not generated upfront

---

## Before Starting

Before doing anything, give the user a short plain-language summary of what you're about to do together. Two to four sentences. Cover: what the workflow produces, roughly how many steps there are, and what their role is (they review traces, you handle the data). Then ask if they're ready to begin.

Example:
> "We're going to run an error analysis on your LLM app. I'll pull traces from Langfuse, help you select a representative sample, and set up an annotation queue for you to review. You'll read through ~50 traces and write short observations about what you see. From there we'll cluster those into failure categories, compute failure rates, and decide what to fix. Ready to start?"

Don't list every sub-step. Keep it short enough that the user can skim it in ten seconds.

**Throughout the workflow:** whenever you present a list of options for the user to choose from, list the options as a plain numbered or bulleted list. Don't ask in free text when you already know the options. Examples: which environments to include, which observation to target, which signals to use for sampling, which proposed failure categories to keep.

## Workflow

```
1. Discover observation structure: sessions? which observations to annotate?
2. Explore existing signals, then sample ~100 representative traces
3. Create score configs + annotation queue → send to user
4. User open-codes first ~50 traces
5. Cluster open-coding notes into failure categories
6. Create binary score configs for each category; update queue
7. User labels all 100 traces against categories
8. Compute failure rates
9. Decide: fix vs. evaluator per category
```

---

### Step 1 — Discover What to Annotate (Interactive)

Don't assume a session structure or observation layout. The goal is to figure out together with the user which observations to target. Different apps have different shapes — session-based chatbots, single-call pipelines, multi-step agents — so probe the data before committing to a filter.

**Before pulling anything, ask:** Does the user already know which observation type they want to annotate? If they have a specific trace ID or observation ID in mind, ask them to share it — you can inspect it directly and skip or shorten the discovery steps below. If not, proceed with 1a.

**1a. Pull a small sample and look at the shape**

```bash
npx langfuse-cli@latest api traces list \
  --order-by timestamp.desc --limit 5 --json 2>&1 \
  | jq '.body.data[] | {id, sessionId, name, environment,
      input: (.input // "null" | .[0:120]),
      output: (.output // "null" | .[0:120])}'
```

Show the result to the user and ask:
- Are sessions used in your app? (`sessionId` populated and consistent?)
- What does one trace represent — a full conversation, or a single API call?
- Which `environment` values should be included? Render a multiselect of the distinct values found. (Watch for `development` or synthetic data.)

**1b. If sessions are used: deduplicate to last interaction per session**

Each session has one or more traces (turns). Keep only the last trace per session to annotate the most complete interaction:

```bash
AUTH=$(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)

# Get total page count
curl -s -H "Authorization: Basic $AUTH" \
  "${LANGFUSE_HOST}/api/public/traces?limit=1" | jq '.meta.totalPages'

# Paginate all traces, deduplicate to last per session
for page in $(seq 1 $PAGES); do
  npx langfuse-cli@latest api traces list \
    --order-by timestamp.desc --limit 100 --page $page --json 2>&1 \
    | jq '.body.data[]'
done | jq -s '
  group_by(.sessionId)
  | map(sort_by(.timestamp) | last)
' > /tmp/candidate_traces.json
```

**If no sessions are used:** skip deduplication; use all traces directly. Optionally filter by environment or date range.

**1c. Inspect the observation tree of a sample trace**

Trace-level `input`/`output` may be null in OpenTelemetry-instrumented apps — the content lives in a GENERATION observation. Ask the user to paste one example trace ID, then show the observation tree:

```bash
npx langfuse-cli@latest api observations list \
  --trace-id <traceId> --fields core,basic,io --json 2>&1 \
  | jq '.body.data[] | {id, name, type,
      input: (.input // "" | .[0:200]),
      output: (.output // "" | .[0:200])}'
```

Show the result and ask: which observation contains the final response you want to evaluate? Render a multiselect of the distinct observation names found (filter to GENERATION type). Then ask:
- Is it always a direct child of the root span, or nested under a specific parent?

> **CRITICAL:** Use `objectType: OBSERVATION` pointing to the GENERATION observation ID when adding items to the annotation queue. Using `objectType: TRACE` shows nothing annotatable in the Langfuse UI when traces are instrumented via OpenTelemetry.

**1d. Derive the filter pattern from the sample**

Once the user confirms which observation to target, write the filter. Check whether the name is consistent across multiple traces:

```bash
# Check GENERATION observation names across 5 recent traces
for traceId in <id1> <id2> <id3> <id4> <id5>; do
  npx langfuse-cli@latest api observations list \
    --trace-id "$traceId" --type GENERATION --fields core --json 2>&1 \
    | jq -r '.body.data[] | "\(.name)"'
done | sort | uniq -c | sort -rn
```

Note the confirmed filter (observation type + name + any parent constraint) — you will use it in Steps 3 and 6 when adding items to the annotation queue.

---

### Step 2 — Explore Existing Signals, Then Sample

Before proposing sampling tiers, check what signals already exist. Existing scores, judges, tags, or known problem areas can produce a much richer sample than latency/cost alone.

**2a. Check for existing score configs and coverage**

```bash
AUTH=$(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)
curl -s -H "Authorization: Basic $AUTH" "${LANGFUSE_HOST}/api/public/score-configs" \
  | jq '[.data[] | {name, dataType, description}]'

# Also check what recent scores look like
curl -s -H "Authorization: Basic $AUTH" \
  "${LANGFUSE_HOST}/api/public/scores?limit=20" \
  | jq '[.data[] | {name, value, source, dataType: .dataType}]'
```

**2b. Check for trace tags**

```bash
npx langfuse-cli@latest api traces list \
  --order-by timestamp.desc --limit 100 --json 2>&1 \
  | jq '[.body.data[].tags // []] | flatten | group_by(.) | map({tag: .[0], count: length}) | sort_by(-.count)'
```

**2c. Present what you found and ask the user**

Summarise what you found, then render two multiselects:

1. **Tags to prioritise** — list all distinct tags found. Ask the user to select any that indicate problems (e.g. `error`, `flagged`, `complaint`).
2. **Score dimensions to prioritise** — list all score config names found. Ask the user to select any where low values indicate failures worth over-sampling.

Then ask in free text: are there any other known problem areas (specific trace names, time windows, user segments) to include?

**2d. Propose sampling tiers based on what exists**

Match the strategy to available signals:

| If you have… | Add this tier |
|--------------|---------------|
| Error/flagged tags | Include all tagged traces (failure-driven) |
| Low-scoring traces from an existing judge | Oversample below-threshold traces (uncertainty) |
| Human annotation with low pass rates on specific dimensions | Oversample those dimensions |
| No scores, no tags | Fall back to latency + cost tiers (see below) |

**Fallback — latency + cost tiers** (when no richer signal exists):

| Tier | Criterion | Target |
|------|-----------|--------|
| High latency (>p75) | Tool use or complex reasoning — high-risk | ~25 |
| Low cost (<p25) | Short refusals or minimal replies | ~20 |
| High cost (>p75) | Long or verbose responses | ~15 |
| Mid (rest) | Typical interactions — baseline coverage | ~40 |

```bash
# Find p25/p75 of totalCost in your data
jq '[.[].totalCost] | sort | {p25: .[length * 0.25 | floor], p75: .[length * 0.75 | floor]}' \
  /tmp/candidate_traces.json

# Tag and sample — adjust thresholds to your actual percentiles
jq '
  map(. + { tier: (
    if .latency > 10 then "high-latency"
    elif .totalCost < <P25> then "low-cost"
    elif .totalCost > <P75> then "high-cost"
    else "mid" end
  )}) |
  group_by(.tier) | map(sort_by(.timestamp) | .[0:25]) | flatten | .[0:100]
' /tmp/candidate_traces.json > /tmp/sample_100.json
```

Save the final sample to a file (not in the workflow notes). Notes capture the sampling strategy; the trace list goes in a separate file.

---

### Step 3 — Create Score Configs + Annotation Queue

**Order matters: score configs must exist before creating the queue** (IDs are required at creation time; queues cannot be updated or deleted after).

**Check for existing configs first:**
```bash
AUTH=$(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)
curl -s -H "Authorization: Basic $AUTH" "${LANGFUSE_HOST}/api/public/score-configs" \
  | jq '[.data[] | {name, dataType}]'
```

**Create the two fixed open-coding scores** (these never change between runs):

```bash
# open_coding — free text observation field
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "open_coding",
    "dataType": "TEXT",
    "description": "Describe what is happening in this trace and what (if anything) seems wrong. Focus on observable behaviour — do not diagnose root causes."
  }' "${LANGFUSE_HOST}/api/public/score-configs"

# pass_fail_assessment — overall verdict
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "pass_fail_assessment",
    "dataType": "CATEGORICAL",
    "description": "Overall judgement: did the assistant handle this interaction well?",
    "categories": [{"label": "Pass", "value": 1}, {"label": "Fail", "value": 0}]
  }' "${LANGFUSE_HOST}/api/public/score-configs"
```

> **Note:** Score configs cannot be deleted via API. Always check for existing ones before creating to avoid duplicate clutter. Always include a clear `description` — it is shown to annotators in the UI.

**Valid dataType values:** `TEXT`, `NUMERIC`, `BOOLEAN`, `CATEGORICAL` (requires `categories` array). Use `curl`, not the CLI, for `CATEGORICAL` — the CLI does not expose the categories flag.

**Create the annotation queue** (CLI `--help` omits `scoreConfigIds` but it is required):

```bash
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "<YYYY-MM-DD> Open Coding - <Use Case Name>",
    "description": "Error analysis sample: ~100 representative traces. Open code and pass/fail.",
    "scoreConfigIds": ["<open_coding_id>", "<pass_fail_id>"]
  }' "${LANGFUSE_HOST}/api/public/annotation-queues" | jq '{id, name}'
```

Queue name convention: `<date> Open Coding - <use case>` where use case comes from the trace name (e.g. `dad-chat-request` → "Dad Tech Support").

**Add GENERATION observations** (not trace IDs — trace-level input/output is null):

> **CRITICAL:** Use `objectType: OBSERVATION` pointing to the GENERATION observation ID. Using `objectType: TRACE` shows nothing annotatable in the Langfuse UI when traces are instrumented via OpenTelemetry.

```bash
QUEUE_ID="<queue-id>"

# For each sample trace: get its GENERATION observation, then add to queue
while IFS= read -r traceId; do
  obsId=$(npx langfuse-cli@latest api observations list \
    --trace-id "$traceId" --type GENERATION --fields core --json 2>&1 \
    | jq -r '.body.data[0].id // empty')
  [ -z "$obsId" ] && continue
  npx langfuse-cli@latest api annotation-queues post-create-queue-item "$QUEUE_ID" \
    --objectId "$obsId" --objectType OBSERVATION --json 2>&1 | jq -r '.body.id'
  sleep 0.4   # avoid 429 rate limit
done < <(jq -r '.[].id' /tmp/sample_100.json)
```

**After creating the queue — give the user the link immediately.**

The link format depends on the host:

| Host | Link format |
|------|-------------|
| EU cloud (default) | `https://cloud.langfuse.com/project/<projectId>/annotation-queues/<queueId>` |
| US cloud | `https://us.cloud.langfuse.com/project/<projectId>/annotation-queues/<queueId>` |
| Self-hosted | `<LANGFUSE_HOST>/project/<projectId>/annotation-queues/<queueId>` |

Get the `projectId` from the Langfuse UI URL (it appears in the path when you're anywhere inside the project) or from the API response. The `queueId` comes from the `id` field in the queue creation response.

Construct the full URL and give it to the user as a clickable link — do not just print the queue ID and expect them to find it.

Instruction to give: *"Please open code the first ~50 examples. For each trace, write what you observe in the `open_coding` field (describe behaviour, don't diagnose root causes), then set `pass_fail_assessment` to Pass or Fail."*

---

### Step 4 — User Reviews First 30–50 Traces

**Do not skip this step.** The user must do the initial read — categories must be grounded in domain knowledge, not generated by an LLM from thin air.

The user annotates directly in the Langfuse annotation queue. When ~50 are done, proceed.

---

### Step 5 — Cluster into Failure Categories

Pull scores and extract open-coding notes:

```bash
AUTH=$(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)
curl -s -H "Authorization: Basic $AUTH" \
  "${LANGFUSE_HOST}/api/public/scores?queueId=${QUEUE_ID}&limit=100&page=1" \
  > /tmp/scores_p1.json
# Repeat for additional pages if needed

jq -s '[.[].data[]] | group_by(.observationId) | map({
  obsId: .[0].observationId,
  verdict: (map(select(.name == "pass_fail_assessment")) | .[0].stringValue),
  open_coding: (map(select(.name == "open_coding")) | .[0].stringValue)
})' /tmp/scores_p1.json
```

Print all failure notes to the conversation, then cluster with the user:

```
Present the raw annotations to the LLM.
Ask: group these into 5–10 distinct failure categories.
For each category: a clear name, one-sentence definition, which annotations belong to it.
```

**Rules for good categories:**
- Distinct — each failure belongs to one category
- Named after what broke, not generic scores ("identity_not_disclosed" not "quality_issue")
- Actionable — each points toward a specific fix
- 5–10 total; split when root causes differ, group when they share a root cause

**Always review LLM-suggested groupings with the user** before finalising. LLMs cluster by surface similarity; the user catches domain-specific distinctions. Present the proposed categories as a multiselect and ask the user to confirm which to keep, then follow up on any they removed or want to split/merge.

**Anti-patterns:**
- Brainstorming categories before reading traces — let them emerge
- Pre-defined lists — causes confirmation bias
- Generic names like "hallucination score" or "helpfulness" — not actionable

---

### Step 6 — Create Binary Score Configs + Updated Queue

Create one `BOOLEAN` score config per failure category. Check for existing ones first.

```bash
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "<category_name>",
    "dataType": "BOOLEAN",
    "description": "<one sentence: what does true mean for this trace?>"
  }' "${LANGFUSE_HOST}/api/public/score-configs"
```

> **CRITICAL:** Annotation queues cannot be updated or deleted after creation. To add new score configs, create a new queue with all config IDs (original + new). The existing annotation scores are stored on the observations and are not lost. Use a distinct name such as `<date> Open Coding + Labels - <Use Case>`.

Re-add all 100 observations to the new queue (same throttled loop as Step 3). Construct the full queue URL using the same format as Step 3 (host-dependent, see table there) and give it to the user as a clickable link. Instructions: *"Your previous open_coding notes and pass/fail scores are visible. Now apply the binary category labels — mark true for each failure category that applies."*

---

### Step 7 — Compute Failure Rates

Pull binary scores from the queue, compute rate per category:

```python
import json
from collections import defaultdict

with open('/tmp/all_scores.json') as f:
    scores = json.load(f)

category_cols = ['<cat1>', '<cat2>', ...]  # your category names

labeled = defaultdict(dict)
for s in scores:
    if s['name'] in category_cols:
        labeled[s['observationId']][s['name']] = (s['value'] == 1)

fully_labeled = {k: v for k, v in labeled.items() if len(v) == len(category_cols)}
n = len(fully_labeled)

rates = {col: sum(1 for v in fully_labeled.values() if v.get(col)) / n
         for col in category_cols}

for name, rate in sorted(rates.items(), key=lambda x: -x[1]):
    print(f"{name:<35} {rate:.0%}  {'█' * round(rate * 20)}")
```

The most frequent failure category is where to focus first. Re-run once all 100 are labeled.

**Dashboard widget in Langfuse:**
1. Dashboards → Add Widget → Data source: Scores → Metric: Average value
2. Filter: Score Name = `<category_name>` → Chart type: Number (shows rate as decimal)
3. For a combined overview: Group by Score Name, filter to all category names → Bar chart
4. Repeat per category, or use one combined bar chart for a single-glance overview

> Known Langfuse bug: multiple filters (Score Name + Score Value) may disappear after saving. Use one filter per widget if this occurs.

---

### Step 8 — Decide What to Do Per Category

Work top-to-bottom by failure rate. For each category, ask in order:

**1. Can we just fix it?**

| Root cause | Fix |
|------------|-----|
| Requirement missing from prompt | Add the instruction |
| Prompt has a contradicting instruction | Resolve conflict, clarify priority order |
| Tool missing or misconfigured | Add/fix the tool |
| Engineering bug in retrieval or integration | Fix the code |

If yes to any: fix first. Do not build an evaluator until you've confirmed the fix doesn't resolve it.

**2. Is an evaluator worth building?**
- Frequency: is the rate high enough to matter?
- Business impact: a rare failure with high impact can outrank a frequent but annoying one
- Iteration: will someone actually use this evaluator to improve the system, or is it checkbox work?

**3. What kind of evaluator?**

Use LLM-as-judge for all failure categories. Langfuse has a built-in online evaluation feature that runs automatically on new traces — always use this rather than writing custom code:
`https://langfuse.com/docs/scores/model-based-evals`

**For prompt fixes:** first check whether the user is already managing their prompts in Langfuse (e.g. does their code call `get_prompt()`? Are prompts visible under Langfuse UI → Prompts?). If not, ask: *"Are you currently using Langfuse prompt management? If not, would you like to set it up — it gives you version control and deployment-free iteration."* If they want to, follow the `langfuse-prompt-migration` skill before making changes.

Once prompt management is confirmed (existing or newly set up), offer the user two options:
1. Create/update the versioned prompt directly in Langfuse
2. Draft the specific text change for them to review and apply

After creating or updating a prompt in Langfuse, give the user a direct link to it:

| Host | Link format |
|------|-------------|
| EU cloud (default) | `https://cloud.langfuse.com/project/<projectId>/prompts/<promptName>` |
| US cloud | `https://us.cloud.langfuse.com/project/<projectId>/prompts/<promptName>` |
| Self-hosted | `<LANGFUSE_HOST>/project/<projectId>/prompts/<promptName>` |

---

### Stopping Criteria

Stop reviewing traces when no new failure categories appear in the last 20 traces reviewed. Target: ~100 traces total. Simpler systems saturate earlier.

---

## Sampling Strategies (Reference)

| Strategy | When to use | How |
|----------|-------------|-----|
| Random | Default starting point | Sample uniformly from recent traces |
| Outlier | Surface unusual behaviour | Sort by latency, response length, tool call count; review extremes |
| Failure-driven | After guardrail violations or user complaints | Prioritise flagged traces |
| Uncertainty | When automated judges already exist | Focus on traces where judges disagree or score low confidence |
| Stratified | Ensure coverage across user segments | Sample within each dimension (user type, env, query type) |

---

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Adding traces (`objectType: TRACE`) to annotation queue | Input/output is null in OTel-instrumented apps; annotators see nothing | Use `objectType: OBSERVATION` with the GENERATION observation ID |
| Creating score configs without checking existing ones | Configs can't be deleted; duplicate clutter accumulates | Always `GET /api/public/score-configs` first |
| Creating annotation queue before score configs | Queue requires `scoreConfigIds` at creation; can't be updated after | Create configs → note IDs → create queue |
| Brainstorming categories before reading traces | Confirmation bias; real failures don't fit the list | Read 30–50 traces first, let categories emerge |
| Building evaluators before fixing prompt gaps | Evaluator catches failures the prompt fix would have prevented | Fix obvious gaps first, then evaluate residual failures |
| Using generic category names | Not actionable; can't point to a specific fix | Name after what specifically broke, e.g. `identity_not_disclosed` |
| No rate limiting when adding queue items | 429 errors; partial queue population | `sleep 0.4` between `post-create-queue-item` calls |
| Setting `--limit` > 100 on traces list | API hard cap; returns 400 | Max 100 per page; paginate with `--page` |

---

## Out of Scope

- Writing or improving the LLM judge prompts (see `write-judge-prompt` skill)
- Instrumenting a new application with Langfuse (see `instrumentation.md`)
- Managing or migrating prompts in Langfuse (see `prompt-migration.md`)
- Generating synthetic traces when no real data exists (run the app with test inputs first)
