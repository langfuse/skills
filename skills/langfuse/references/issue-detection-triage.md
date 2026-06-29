---
name: langfuse-issue-detection-triage
description: Issue detection triage for a Langfuse project's recent production traffic — find problems and report them ranked by severity. Use when the user wants to "find issues / problems / anomalies", "audit", "triage", "health-check", or "see what's going wrong" in their Langfuse traces/observations/scores over a time window — failed tool calls, cost spikes, latency, bad scores, user friction, retrieval quality, etc.
---

# Issue Detection Triage

## Table of contents

- [Workflow](#workflow)
- [Principles](#principles)
- [Dimensions checklist](#dimensions-checklist)
- [CLI recipes & gotchas](#cli-recipes--gotchas)

Systematically inspect recent traffic, find what's going wrong **across every dimension where issues can hide** (not just the obvious ones), rank by severity, and report. The goal is to surface *silent* problems — things that don't throw errors but still degrade the product.

Key gotchas and ready-to-run recipes are in [CLI recipes & gotchas](#cli-recipes--gotchas). The full dimension checklist is in [Dimensions checklist](#dimensions-checklist) — consult it so you don't miss a dimension.

## Workflow

### 0. Connect

Credentials and CLI basics: follow the **`langfuse` skill** CLI section and [cli.md](cli.md). Do not ask the user to paste keys into chat.

Discover vars in this order: existing env → project `.env` (`LANGFUSE_*`; host is often `LANGFUSE_BASE_URL`) → ask the user to set them locally. Then:

```bash
export LANGFUSE_HOST="${LANGFUSE_BASE_URL:-$LANGFUSE_HOST}"
npx langfuse-cli api traces list --limit 1   # verify before proceeding
```

### 1. Scope: time window + which traces are "the product"

- **Window:** default to the user's ask ("last hour", "today"). Get current UTC, compute `--from-timestamp`. If unsure of data recency, list the latest traces first and anchor on the most recent timestamp.
- **Separate real app traffic from machinery.** This is critical and easy to get wrong. Langfuse projects mix:
  - Real application traces (what you want).
  - **Evaluator executions** — LLM-as-a-judge runs, usually `environment = "langfuse-llm-as-a-judge"` and named `"Execute evaluator: <name>"`. **Exclude these** unless the user is asking about the evaluators themselves.
  - Dataset/experiment runs, playground, other environments.
  - Summarize traces by `environment` and `name` first, then pick the environment(s)/name(s) that are the product. Confirm the choice with the user if it's ambiguous. Report counts so the user sees what was included/excluded.

### 2. Pull the data

Pull, for the chosen window + environment(s): traces (`core,io,metrics`), observations (`core,basic,usage,model,metrics`, add `io` for tools/generations you inspect), and scores. **Mind the pagination gotchas** (cursor vs page, score IDs vs objects, no rapid parallel CLI calls) — see [CLI recipes & gotchas](#cli-recipes--gotchas). Save raw pulls to `/tmp` so you can re-analyze without re-fetching.

### 3. Sweep every dimension

Go through [Dimensions checklist](#dimensions-checklist) one by one. For each: compute the signal, decide present/absent, keep evidence (counts, %, example trace IDs). **A dimension that is clean is a finding too** — note it as verified-not-an-issue so the user knows it was checked, not skipped. **Don't trust status flags alone:** a tool returning `ok:true` / 3 results can still be returning irrelevant garbage — inspect content, not just success codes.

### 4. Rank

Score each real finding by **severity** (user/business impact) × **prevalence** (% of traffic affected) × **silence** (does it error loudly, or pass unnoticed? silent issues rank higher because no one else will catch them). Bucket into:

- **P0** — broken or harmful, often silent, affecting many requests.
- **P1** — clear quality/friction degradation on a meaningful slice.
- **P2** — real but lower impact or lower prevalence.
- **P3** — worth a look / hygiene / "verify this can even fire".

### 5. Report

Produce a markdown report with: method (window, what was included/excluded, counts), headline metrics table, findings ordered by priority (each with evidence + example trace IDs + why it matters + suggested fix + root-cause hypothesis), an explicit **"verified non-issues"** section (dimensions checked and clean), suggested order of action, and open questions. Link traces as `<host>/project/<projectId>/traces/<traceId>` when useful.

### 6. Offer to save

**Ask the user** whether to save the report as a markdown file, and where/what name (suggest one, e.g. `issue-detection-triage-<date>.md`). Don't write the file unsilently unless they already told you to.

## Principles

- **Comprehensive over fast.** The point is to catch what a quick glance misses. Walk the whole checklist.
- **Evidence, not vibes.** Every finding carries numbers and example trace IDs.
- **Silent issues first.** Crashes get noticed; degraded retrieval, dead evaluators, and creeping latency don't.
- **Segment before concluding.** An aggregate that looks fine can hide one broken user/version/tool/release. Slice by `version`, `release`, `userId`, tool name, and prompt version before declaring a dimension clean.

---

## Dimensions checklist

Walk **every** dimension. For each, compute the signal, mark present/absent, and keep evidence (count, %, example trace IDs). A clean dimension is still a finding — record it as "verified, no issue" so the user knows it was checked.

The dimensions are grouped. The first group is what naive triage usually covers; the later groups are where issues **silently hide** — do not skip them.

### A. Reliability & errors (the obvious ones)

1. **Hard errors** — observations with `level` in (`ERROR`, `WARNING`); non-empty `statusMessage`. Group by name/type.
2. **Tool-call failures** — tool outputs with `ok:false`, error fields, exceptions, HTTP non-2xx, stack traces in output.
3. **Empty / null outputs** — traces or generations with empty/`null` output, or output that is just whitespace.
4. **Truncation** — generations stopped by length limit (`finish_reason: length`, `max_tokens` hit); answers cut off mid-sentence.
5. **Timeouts / retries** — duplicated observations, retry markers, abnormally long single calls that look like a hung dependency.

### B. Latency

6. **End-to-end** (AGENT/root) — median, p90, p99, max. Is the tail acceptable for this product?
7. **Per-step** — which observation type/step dominates (sequential LLM calls? slow tool? retrieval?). Time-to-first-token for generations.
8. **Outliers** — slowest N traces; is slowness correlated with a tool, model, input size, or user?

### C. Cost & tokens

9. **Total & per-trace cost** — sum, mean, distribution, costliest N. Any single-trace explosion?
10. **Token usage** — input/output token distribution; runaway prompts; context growing across a session.
11. **Waste** — tokens spent on content that adds no value (e.g. irrelevant retrieved context fed to the model every call — cross-check with retrieval relevance, D14).

### D. Tool / agent behavior

12. **Tool failure rate & loops** — same tool called many times in one trace (retry storm), tool-call loops, no-progress cycles.
13. **Malformed tool args** — arguments that don't match the question, missing required fields, schema violations.
14. **Retrieval / RAG relevance (silent killer)** — for search/retrieval tools: do returned results actually match the query? Check **content**, not just `ok` and result count. Signals: same few documents returned for unrelated queries; zero keyword/semantic overlap; tiny library returning the same items regardless of input; empty result sets. A tool can be "100% successful" and useless.
15. **Tool coverage gaps** — questions that should trigger a tool but didn't, or for which no suitable tool/content exists.

### E. Scores & evaluators

16. **Score distributions** — per evaluator: pass/fail %, value histogram. Which dimensions are failing and how often.
17. **Dead / non-discriminating evaluators** — an evaluator stuck at a single constant value (100% True or 100% False). Could be legitimately quiet OR mis-wired / never fires. Flag for a known-positive sanity check.
18. **Missing scores** — real traces with no scores attached (not being evaluated at all) → blind spots in monitoring.
19. **Score regressions** — pass rate dropping vs an earlier window or a previous release/version.

### F. User friction & conversation quality

20. **Follow-up / clarification rate** — turns where the user has to re-ask ("where is that?", "I don't understand", "that didn't work"). High rate = first answers underspecified.
21. **Disagreement / frustration** — user pushback, corrections, all-caps, profanity, "no", "that's wrong", repeated rephrasing.
22. **Multi-turn loops & repetition** — sessions where the user asks the same thing repeatedly; long sessions that never resolve; same question recurring across many sessions (systemic gap).
23. **Abandonment** — sessions that stop right after a bad/non-answer (drop-off after a specific failure).

### G. Output quality & safety

24. **Refusals / non-answers** — "I can't help with that", deflections, hedging where a direct answer was expected.
25. **Format / contract violations** — invalid JSON when JSON is required, missing fields, broken markdown, wrong language/locale vs the user.
26. **Faithfulness / hallucination risk** — answer asserts specifics not supported by retrieved context or tools (especially when retrieval is broken — D14).
27. **Safety / PII / compliance** — leaked secrets or PII in inputs/outputs, unsafe instructions, prompt-injection attempts in user input, guardrail observations firing or that *should* have fired.

### H. Inputs & scope

28. **Out-of-scope requests** — questions outside the product's intended domain; how the agent handles them.
29. **Malformed / adversarial inputs** — empty messages, garbage, injection attempts, extreme length.
30. **Language / generation mismatch** — user writes in language X, agent answers in Y.

### I. Segmentation & regressions (don't conclude from aggregates)

31. **By version / release** — slice every metric by `version`/`release`. A deploy may have regressed one slice while the aggregate looks fine. Compare before/after a release tag.
32. **By user / session segment** — is a problem concentrated in a few users or sessions?
33. **By prompt version** — correlate `promptName`/`promptVersion` with scores, latency, cost — did a prompt change regress quality?
34. **By model / config** — multiple models in use? fallback model firing unexpectedly? model version drift? temperature/params anomalies?
35. **By tool / environment / tag** — concentration of issues in one tool, environment, or tag.

### J. Volume & coverage meta

36. **Traffic volume** — spike or drop vs expected; new vs returning users.
37. **Monitoring coverage** — % of traffic with scores/evals; environments present; anything un-instrumented.
38. **What you did NOT cover** — be explicit about sampling caps, pagination limits, or dimensions you couldn't evaluate (e.g. faithfulness without ground truth). Silent truncation of analysis reads as "all clear" when it isn't.

---

## CLI recipes & gotchas

Uses `npx langfuse-cli` (see [cli.md](cli.md) for discovery, credentials, and general tips). Workflow-specific patterns and traps below. Run with `LANGFUSE_HOST` exported (see [Connect](#0-connect)).

### Gotchas (learned the hard way)

- **Observations use CURSOR pagination, not `--page`.** The next cursor is in `meta.cursor` (NOT `meta.nextCursor`). Pass it back via `--cursor`. `traces` and `scores` DO use `--page` + `meta.totalPages`.
- **Trace `scores` field returns score IDs (strings), not score objects.** To get values, pull scores separately via `scores list` and join on `traceId`.
- **Do NOT fire many `npx langfuse-cli` calls rapidly in a shell loop / in parallel / in the background** — they intermittently hang or write empty output. Drive pagination from a single sequential **Python subprocess** script instead (template below). One call at a time.
- **`ok:true` ≠ good.** Tool/retrieval success flags say nothing about content quality. Pull `io` and inspect the actual output for relevance/correctness.
- **Field groups** keep payloads small: traces → `core,io,metrics` (`scores` returns IDs only); observations → `core,basic,usage,model,metrics` and add `io` only when inspecting content. Use `--type` to filter observations (`GENERATION`, `TOOL`, `AGENT`, `SPAN`, `EVENT`, ...).
- **Filters:** the `--filter` JSON array (`[{type,column,operator,value,key}]`) is the most reliable way to combine time + environment + numeric thresholds. It takes precedence over the convenience flags.

### Step 1 — orient: what environments/names exist

```bash
npx langfuse-cli api traces list --limit 100 --order-by "timestamp.desc" \
  --from-timestamp "<ISO>" --fields "core" \
  | python3 -c "import sys,json;from collections import Counter;d=json.load(sys.stdin)['data'];\
print('env:',Counter(r['environment'] for r in d).most_common());\
print('name:',Counter(r['name'] for r in d).most_common())"
```

Identify and EXCLUDE evaluator executions (`environment=langfuse-llm-as-a-judge`, name `Execute evaluator: …`). Pick the product environment(s).

### Step 2 — pull app traces (page-based)

```bash
FILTER='[{"type":"datetime","column":"timestamp","operator":">=","value":"<ISO>"},
         {"type":"string","column":"environment","operator":"=","value":"default"}]'
npx langfuse-cli api traces list --limit 100 --order-by "timestamp.desc" \
  --filter "$FILTER" --fields "core,io,metrics" > /tmp/app_traces.json
# meta.totalPages tells you if you need more --page N calls
```

### Step 3 — pull scores (page-based) and join

```bash
npx langfuse-cli api scores list --limit 100 --page <N> \
  --from-timestamp "<ISO>" --environment "default" > /tmp/scores_pN.json
```

Join `score.traceId → score.name → score.stringValue/value` onto traces. Summarize per evaluator: count + value distribution. Watch for evaluators stuck at one constant value (dead-evaluator check).

### Step 4 — pull observations (CURSOR pagination) via Python driver

Write this to `/tmp/fetch_obs.py` and run it (set env first). Adjust `--type`, `--fields`, filters as needed; reuse for TOOL-only pulls by adding `--type TOOL` and `io` to fields.

```python
import subprocess, json, os, sys
base = ["npx","langfuse-cli","api","observations","list","--limit","100",
        "--from-start-time","<ISO>","--environment","default",
        "--fields","core,basic,usage,model,metrics"]   # add "io" / "--type","TOOL" as needed
rows=[]; cursor=None
for i in range(50):                                     # generous page cap
    cmd=list(base)+(["--cursor",cursor] if cursor else [])
    p=subprocess.run(cmd,capture_output=True,text=True,env=dict(os.environ))
    if p.returncode!=0: sys.stderr.write(p.stderr[:300]); break
    d=json.loads(p.stdout); rows+=d.get("data",[])
    cursor=(d.get("meta") or {}).get("cursor")
    sys.stderr.write(f"iter{i} total={len(rows)}\n")
    if not cursor or not d.get("data"): break
json.dump(rows,open("/tmp/obs_all.json","w")); sys.stderr.write(f"DONE {len(rows)}\n")
```

### Analysis snippets

- **Latency/cost percentiles:** load the JSON, sort, compute median/p90/p99/max per observation type and at trace level.
- **Retrieval relevance:** for each search tool call, tokenize the question (drop stopwords) and the returned titles; flag calls with zero overlap. Count distinct documents ever returned — a tiny set returned for unrelated queries = broken retrieval.
- **Session loops:** group traces by `input.sessionId`, sort by timestamp, print each turn's last user message + which scores fired. Look for "where is that?" / repeated questions.
- **Segmentation:** before concluding a dimension is clean, recompute it grouped by `version`, `release`, `promptVersion`, `model`, and top `userId`s.

### Useful columns for `--filter`

Traces: `timestamp, environment, name, userId, sessionId, tags, version, release, latency, totalCost, totalTokens, inputTokens, outputTokens, metadata`.

Observations: `type, name, level, statusMessage, startTime, latency, timeToFirstToken, totalCost, inputTokens, outputTokens, model, promptName, promptVersion, traceName, traceTags, metadata`.
