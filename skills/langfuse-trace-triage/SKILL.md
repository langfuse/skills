---
name: langfuse-trace-triage
description: Triage a Langfuse project's recent production traffic for issues and report them ranked by severity. Use when the user wants to "find issues / problems / anomalies", "audit", "triage", "health-check", or "see what's going wrong" in their Langfuse traces/observations/scores over a time window — failed tool calls, cost spikes, latency, bad scores, user friction, retrieval quality, etc. Identifies the real application traces (excluding evaluator executions), sweeps a fixed set of dimensions, ranks findings P0–P3, and offers to save a markdown report.
---

# Langfuse Trace Triage

Systematically inspect a Langfuse project's recent traffic, find what's going wrong **across every dimension where issues can hide** (not just the obvious ones), rank by severity, and report. The goal is to surface *silent* problems — things that don't throw errors but still degrade the product.

This skill builds on the `langfuse` skill for CLI/credentials. **Read that skill's CLI section (`references/cli.md`) first** if credentials or the CLI aren't already set up. Key gotchas and ready-to-run recipes are in [references/cli-recipes.md](references/cli-recipes.md). The full dimension checklist is in [references/dimensions.md](references/dimensions.md) — consult it so you don't miss a dimension.

## Workflow

### 0. Connect
Get `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, host. Discover them in this order: existing env vars → project `.env` (look for `LANGFUSE_*`, host may be `LANGFUSE_BASE_URL`) → ask the user. Export `LANGFUSE_HOST`. Verify with a trivial `traces list --limit 1`.

### 1. Scope: time window + which traces are "the product"
- **Window:** default to the user's ask ("last hour", "today"). Get current UTC, compute `--from-timestamp`. If unsure of data recency, list the latest traces first and anchor on the most recent timestamp.
- **Separate real app traffic from machinery.** This is critical and easy to get wrong. Langfuse projects mix:
  - Real application traces (what you want).
  - **Evaluator executions** — LLM-as-a-judge runs, usually `environment = "langfuse-llm-as-a-judge"` and named `"Execute evaluator: <name>"`. **Exclude these** unless the user is asking about the evaluators themselves.
  - Dataset/experiment runs, playground, other environments.
  - Summarize traces by `environment` and `name` first, then pick the environment(s)/name(s) that are the product. Confirm the choice with the user if it's ambiguous. Report counts so the user sees what was included/excluded.

### 2. Pull the data
Pull, for the chosen window + environment(s): traces (`core,io,metrics`), observations (`core,basic,usage,model,metrics`, add `io` for tools/generations you inspect), and scores. **Mind the pagination gotchas** (cursor vs page, score IDs vs objects, no rapid parallel CLI calls) — see [references/cli-recipes.md](references/cli-recipes.md). Save raw pulls to `/tmp` so you can re-analyze without re-fetching.

### 3. Sweep every dimension
Go through [references/dimensions.md](references/dimensions.md) one by one. For each: compute the signal, decide present/absent, keep evidence (counts, %, example trace IDs). **A dimension that is clean is a finding too** — note it as verified-not-an-issue so the user knows it was checked, not skipped. **Don't trust status flags alone:** a tool returning `ok:true` / 3 results can still be returning irrelevant garbage — inspect content, not just success codes.

### 4. Rank
Score each real finding by **severity** (user/business impact) × **prevalence** (% of traffic affected) × **silence** (does it error loudly, or pass unnoticed? silent issues rank higher because no one else will catch them). Bucket into:
- **P0** — broken or harmful, often silent, affecting many requests.
- **P1** — clear quality/friction degradation on a meaningful slice.
- **P2** — real but lower impact or lower prevalence.
- **P3** — worth a look / hygiene / "verify this can even fire".

### 5. Report
Produce a markdown report with: method (window, what was included/excluded, counts), headline metrics table, findings ordered by priority (each with evidence + example trace IDs + why it matters + suggested fix + root-cause hypothesis), an explicit **"verified non-issues"** section (dimensions checked and clean), suggested order of action, and open questions. Link traces as `<host>/project/<projectId>/traces/<traceId>` when useful.

### 6. Offer to save
**Ask the user** whether to save the report as a markdown file, and where/what name (suggest one, e.g. `trace-triage-<date>.md`). Don't write the file unsilently unless they already told you to.

## Principles
- **Comprehensive over fast.** The point is to catch what a quick glance misses. Walk the whole checklist.
- **Evidence, not vibes.** Every finding carries numbers and example trace IDs.
- **Silent issues first.** Crashes get noticed; degraded retrieval, dead evaluators, and creeping latency don't.
- **Segment before concluding.** An aggregate that looks fine can hide one broken user/version/tool/release. Slice by `version`, `release`, `userId`, tool name, and prompt version before declaring a dimension clean.

## Next step: fix what you found
Triage stops at a ranked list of problems — it diagnoses, it doesn't fix. To actually resolve a finding and **prove** the fix worked, hand it to the **`langfuse-improvement-loop`** skill. A P0/P1 finding from this report — its one-line symptom plus the example trace IDs — is exactly the input that skill's Step ① expects: it root-causes from those traces, picks the right lever (prompt, code, retrieval, model — not always a prompt edit), makes the change behind a safe boundary, and gates it on a baseline-vs-candidate experiment. Offer this as the follow-up once the user picks an issue to act on.
