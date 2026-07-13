---
name: langfuse-issue-detection-triage
description: Issue detection triage for a Langfuse project's recent production traffic — find problems and report them ranked by severity. Use when the user wants to "find issues / problems / anomalies", "audit", "triage", "health-check", or "see what's going wrong" in their Langfuse traces/observations/scores over a time window — failed tool calls, cost spikes, latency, bad scores, user friction, retrieval quality, etc.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
---

# Issue Detection Triage

## Table of contents

- [Workflow](#workflow)
- [Report format](#report-format)
- [Principles](#principles)
- [Dimensions checklist](#dimensions-checklist)
- [CLI gotchas & analysis notes](#cli-gotchas--analysis-notes)

## Workflow

### 0. Connect

Credentials and CLI basics: follow the **`langfuse` skill** CLI section and [cli.md](cli.md). Verify the connection with a single one-row `traces list` before proceeding.

### 1. Scope: time window + which traces are "the product"

- **Window:** default to the user's ask ("last hour", "today"). Get current UTC, compute `--from-timestamp`. If unsure of data recency, list the latest traces first and anchor on the most recent timestamp.
- **Separate real app traffic from machinery.** This is critical and easy to get wrong. Langfuse projects mix:
  - Real application traces (what you want).
  - **Evaluator executions** — LLM-as-a-judge runs, usually `environment = "langfuse-llm-as-a-judge"` and named `"Execute evaluator: <name>"`. **Exclude these** unless the user is asking about the evaluators themselves.
  - Dataset/experiment runs, playground, other environments.
  - Summarize traces by `environment` and `name` first, then pick the environment(s)/name(s) that are the product. Confirm the choice with the user if it's ambiguous. Report counts so the user sees what was included/excluded.

### 2. Pull the data

Pull, for the chosen window + environment(s): traces (`core,io,metrics`), observations (`core,basic,usage,model,metrics`, add `io` for tools/generations you inspect), and scores. **Mind the pagination gotchas** (cursor vs page, score IDs vs objects, no rapid parallel CLI calls) — see [CLI gotchas & analysis notes](#cli-gotchas--analysis-notes). Save raw pulls to `/tmp` so you can re-analyze without re-fetching.

### 3. Sweep every dimension

**First, profile the input distribution — before computing any rate.** Tally the distinct input strings over the window. If a small set of identical or templated inputs dominates (e.g. the same question hundreds of times), it is almost certainly synthetic / CI / demo / landing-page traffic, and it **silently skews every aggregate below** (error rate, latency, cost-per-trace, and evaluator pass rates all get pulled toward the canned case while the real long tail goes unmeasured). Report the dominant inputs and what fraction of the window they are, and state that all rates are conditioned on this. Flag heavy synthetic traffic as a finding (it should be tagged or routed to a separate environment). This one check protects the trustworthiness of every number in the report.

Then go through [Dimensions checklist](#dimensions-checklist) one by one. For each: compute the signal, decide present/absent, keep evidence (counts, %, example trace IDs). **A dimension that is clean is a finding too** — note it as verified-not-an-issue so the user knows it was checked, not skipped. **Don't trust status flags alone:** a tool returning `ok:true` / 3 results can still be returning irrelevant garbage — inspect content, not just success codes.

### 4. Rank

Score each real finding by **severity** (user/business impact) × **prevalence** (% of traffic affected) × **silence** (does it error loudly, or pass unnoticed? silent issues rank higher because no one else will catch them). To keep this reproducible, assign the bucket with the **decision rule below** — take the *highest* bucket whose condition is met — not a gut multiply.

- **P0** — assign if **any** of: (a) user-facing harm or a safety/PII/compliance breach; (b) wrong, empty, or broken output reaching users on **> ~1%** of examined traffic; (c) the **primary** quality signal for the product is silently invalid (a broken/mis-wired evaluator on the metric that matters most, so no one can see the product degrade).
- **P1** — a clear quality, reliability, or friction degradation on a **meaningful slice (~1–10%)** that is *not* a P0; or a **secondary** quality signal that is invalid/unmeasured.
- **P2** — a real issue with **lower impact or < ~1% prevalence**, or one with an easy workaround / no user-facing symptom yet.
- **P3** — hygiene, instrumentation gaps, or "verify this can even fire" (e.g. a constant-value evaluator that might be legitimately quiet).

The percentage bands are guides, not gates — a single trace can be P0 if it is harmful — but state the number you used so the rank is auditable.

**Worked examples** (apply these verbatim so independent runs agree):
- *A primary-quality evaluator that never sees the assistant output (scores are noise) →* **P0** if it is the product's main quality metric and nothing else measures that dimension; **P1** if it is one of several and correctness is still measured elsewhere. It is **not** P2 — "the score is decorative" is a monitoring blind spot, not a minor issue.
- *Empty/null output reaching users on 2 of 265 traces (0.8%) →* **P1** (user-facing but rare). Only **P0** if the rate clears ~1% or the empties are concentrated in one important slice.
- *Elevated latency (p99 ~100s) with no errors →* **P1** if it is felt by most turns (high p50) on an interactive product; **P2** if only a tail is slow. Do not silently drop it — latency is a finding, not a headline stat.
- *A dead evaluator stuck at one value with no known-positive test →* **P3** (verify it can fire) unless you confirm it is mis-wired, which promotes it toward P1/P0 by the "invalid quality signal" rule above.

### 5. Report

Produce the markdown report in the structure defined in [Report format](#report-format): overall stats first, then the findings table (one row per issue, ordered by priority), then verified non-issues, order of action, and open questions.

### 6. Offer to save

**Ask the user** whether to save the report as a markdown file, and where/what name (suggest one, e.g. `issue-detection-triage-<date>.md`). Don't write the file unasked — only after they say yes or if they already told you to.

---

## Report format

Two parts: **overall stats** first (so the reader can trust the scope), then a **findings table** (one row per issue). Close with verified non-issues, order of action, and coverage gaps.

### Overall stats

Lead with method + headline numbers:

- **Window** analyzed (absolute ISO + timezone) and **environment(s)** included.
- **Volume examined** — how many traces / observations / scores you actually pulled and inspected. If you sampled or hit a pagination cap, say so; never imply coverage you didn't do.
- **Excluded** — evaluator/LLM-judge runs, dataset/playground, other environments, with counts and why.
- A small **headline metrics** table: total traces, error rate, p50/p90/p99 end-to-end latency, total & mean cost, % of traffic with scores, and the negative-signal rate for each key score.

### Findings table

One row per distinct issue, ordered by priority (P0 first). Columns, in order:

| # | Column | Contents |
|---|---|---|
| 1 | **Issue** | One word / short phrase naming it — e.g. "Broken retrieval", "Follow-up storm", "Cost spike". |
| 2 | **Category** | Exactly one of: `Reliability` · `Latency` · `Cost` · `Tool/Agent` · `Retrieval` · `Scores/Evals` · `User friction` · `Output quality/Safety` · `Input/Scope` · `Usage drift` · `Coverage`. |
| 3 | **Priority** | `P0` / `P1` / `P2` / `P3` — severity × prevalence × silence (see [Rank](#4-rank)). |
| 4 | **Traces affected** | Count of traces you found exhibiting it over the number examined, e.g. `18 / 240`. You need not check every trace — report what you found and mark it a floor (`≥`). |
| 5 | **Description** | Concrete: the observable symptom + supporting evidence (counts, %, quoted output). |
| 6 | **Root-cause hypothesis** | Best explanation of *why*, stated as a hypothesis (not asserted fact). |
| 7 | **Example traces** | 1–3 links, `<host>/project/<projectId>/traces/<traceId>`, built from the **actual `LANGFUSE_HOST`** so the region is correct (e.g. `https://us.cloud.langfuse.com/...` for US cloud, `https://cloud.langfuse.com/...` for EU, or the self-hosted host). |
| 8 | **Fix direction** | The lever(s) most likely at fault (prompt / retrieval / code / model / eval / instrumentation) and one or more plausible ways to address it — offered as options, not a mandate. Say what you'd try and why, but leave the final call to whoever implements it. |
| 9 | **Agent prompt** | A ready-to-paste prompt for a coding agent — enough context to fix it without re-triaging: the failing behavior, 1–2 concrete examples (trace link or quoted I/O), the root-cause hypothesis, and the specific prompt / tool name / file suspected to be at fault. Frame it as "here is the issue, here are examples, here are some ways it could be fixed — you decide the right fix," **not** a prescriptive step-by-step. Give the implementing agent the context and latitude to choose the fix, and write it as an instruction to a colleague LLM you trust to make the call. |

Long-form cells (5, 8, 9) can hold multiple sentences; keep the agent-prompt self-contained so it survives copy-paste out of the table.

### After the table

- **Verified non-issues** — dimensions checked and clean, so the reader knows they were covered, not skipped.
- **Suggested order of action** and **open questions**.
- **Not covered** — sampling caps, pagination limits, or dimensions you couldn't evaluate (e.g. faithfulness without ground truth). Silent truncation reads as "all clear" when it isn't.

## Principles

- **Comprehensive over fast.** The point is to catch what a quick glance misses. Walk the whole checklist.
- **Evidence, not vibes.** Every finding carries numbers and example trace IDs.
- **Silent issues first.** Crashes get noticed; degraded retrieval, dead evaluators, and creeping latency don't.
- **Segment before concluding.** An aggregate that looks fine can hide one broken user/version/tool/release. Slice by `version`, `release`, `userId`, tool name, and prompt version before declaring a dimension clean.
- **Clean means verified, not just quiet.** Only mark a dimension or app "verified non-issue" when you actually inspected it and it held up. A low-volume or poorly-instrumented app — e.g. null trace I/O, a 100%-fallback adapter, a runaway/never-closed span, or an evaluator you couldn't confirm can fire — is **not** clean; it is **unmonitored / insufficient data** and belongs in findings as a **coverage** issue. "I saw nothing" and "there is nothing to see" are different claims; never report the first as the second.

---

## Dimensions checklist

Walk **every** dimension. If subagents are available, spawn one per dimension group to analyze the saved raw pulls in parallel (don't have them each re-fetch — see the parallel-CLI gotcha). For each dimension, compute the signal, mark present/absent, and keep evidence (count, %, example trace IDs). A clean dimension is still a finding — record it as "verified, no issue" so the user knows it was checked.

The dimensions are grouped. The first group is what naive triage usually covers; the later groups are where issues **silently hide** — do not skip them.

### A. Reliability & errors (the obvious ones)

1. **Hard errors** — observations with `level` in (`ERROR`, `WARNING`); non-empty `statusMessage`. Group by name/type. **Do not count failures by `level` alone** — tools frequently swallow errors into a normal (`DEFAULT`-level) output body, so the ERROR count *under-reports*. Search output **content** for failure signatures too (`5xx`/`504`, `Failed to fetch`, `Error:`, `timed out`, `ok:false`, stack traces), and report **both** numbers: N surfaced at ERROR level vs M found only in output bodies. The gap between them is itself a finding (silent errors that monitoring misses). Pick one denominator and state it (e.g. failed calls / total calls of that tool).
2. **Tool-call failures** — tool outputs with `ok:false`, error fields, exceptions, HTTP non-2xx, stack traces in output (see the content-vs-level note in #1).
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

**First, enumerate every score that exists, then define what "bad" means for each — don't assume polarity.** List all distinct score names/types on the real traces (numeric, categorical, boolean) and split them by source: LLM-as-a-judge evaluators, **user-provided feedback** (thumbs up/down, star ratings, 👍/👎 reactions), and human/annotation scores. For **each** score, decide which value is the *negative signal* before tallying — it is not always "low" or "False": a `helpfulness` of 0 is bad but a `toxicity`/`risk`/`frustration` of 1 is bad, a categorical score's bad value might be `"incorrect"`/`"unsafe"`/`"off-topic"`, and any thumbs-down / 1-star / negative reaction is a direct user-supplied negative signal that ranks highly. Only after the polarity is set per score should you compute distributions.

**Evaluator validity comes BEFORE any distribution.** A score distribution is meaningless if the evaluator never saw the data it was supposed to grade. For every evaluator, **read a sample of its reasoning `comment` fields**, not just its values. If the comments reveal the judge is missing data — e.g. "there is no assistant response to evaluate", "only a system prompt and the user's message" — the evaluator is **mis-wired** (its variable mapping omits the trace `output`/assistant turn) and every value it produced is noise. That is a **wiring bug → fix the input mapping**; it is diagnosed *only* by reading comments. Do **not** read the values alone and conclude the judge is "noisy" or "miscalibrated" and prescribe calibration — that is the wrong fix for a mapping bug. A degenerate distribution (e.g. 91% one value) is a *symptom that triggers this check*, never the diagnosis by itself. Rank a broken primary-quality evaluator by the P0/P1 rule in [Rank](#4-rank).

16. **Score distributions** — after validity is confirmed, per score (using its defined negative-signal direction): rate of negative values, value histogram. Which dimensions are failing and how often. Treat user-feedback negatives (thumbs-down, low ratings) as first-class P0/P1 candidates — they are ground-truth dissatisfaction, not a proxy.
17. **Dead / non-discriminating evaluators** — an evaluator stuck at a single constant value (100% True or 100% False). Distinguish the causes via the comments (validity note above): **legitimately quiet** (data never triggers it → P3, flag for a known-positive sanity check) vs **mis-wired** (comments show it can't see the field it grades → broken, rank per Rank).
18. **Missing scores & monitoring coverage** — real traces with no scores attached (not being evaluated at all); the % of traffic carrying scores/evals; environments present; anything un-instrumented. All of these are blind spots in monitoring.
19. **Score regressions** — pass rate dropping vs an earlier window or a previous release/version.

### F. User friction & conversation quality

**Actually read a sample of full conversations end-to-end — don't infer quality only from derived signals.** Pull `io` and read the real user inputs and agent outputs turn by turn for a sample of sessions (prioritize: ones with negative scores, long/multi-turn ones, and a random baseline). Judge whether each exchange genuinely went well — a conversation can have no errors, good latency, and even a passing evaluator while the agent quietly misunderstood the user, answered a different question, or gave a technically-correct-but-useless reply. The signals below (20–23) are how you *quantify* friction across the window; reading transcripts is how you *catch* it in the first place.

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

28. **Out-of-scope requests** — questions outside the product's intended domain. Judge the *handling* by **reading a representative sample of the agent's actual outputs** on out-of-scope inputs — do **not** conclude "handles gracefully" from an intent-classifier label or one or two examples. Does the agent **decline/redirect gracefully**, or does it over-reach and fully answer anyway (write the off-topic code/tutorial), break, or leak internal detail (e.g. disclose its model)? Handling is often **inconsistent** — some declined, some fully served — so sample enough to catch both. A single fully-served off-topic request among graceful declines is still a finding, not noise.
29. **Malformed / adversarial inputs** — empty messages, garbage, injection attempts, extreme length. Does the agent **degrade gracefully** (safe refusal / sane fallback) rather than crash, comply, or get hijacked?
30. **Language / generation mismatch** — user writes in language X, agent answers in Y.

### I. Segmentation & regressions (a lens on every dimension above, not a separate check)

This is not one more box to tick — it is how you keep A–H honest. Before marking **any** dimension clean, re-run its signal sliced by `version`/`release` (did a deploy regress one slice while the aggregate looks fine? compare before/after a release tag), `promptName`/`promptVersion` (did a prompt change regress scores/latency/cost?), `model`/config (multiple models, an unexpected fallback firing, version drift, temperature/param anomalies?), top `userId`s / `sessionId`s (is the problem concentrated in a few?), and `tool`/`environment`/`tag` (issues clustered in one?). A clean aggregate routinely hides one broken slice.

### J. Volume & coverage meta

31. **Traffic volume** — spike or drop vs expected; new vs returning users.
32. **Usage drift from purpose** — cluster/topic the actual requests over the window and compare against (a) the product's *intended* purpose and (b) what the **eval dataset / evaluators actually cover**. Flag when real usage has moved: a new dominant intent, a rising share of a category the agent wasn't built for, or a use case that grew without anyone updating the system prompt, tools, or eval set. The silent failure: **evals stay green because they still test the old distribution** while live traffic has moved on, so quality on the *new* majority use case is unmeasured. Signals: a topic cluster with no matching eval case; out-of-scope requests (H28) increasingly *served* rather than declined; scores flat while user-friction (F) rises on one specific new intent.

---

## CLI gotchas & analysis notes

Uses `npx langfuse-cli` (see [cli.md](cli.md) for discovery, credentials, exact flags, and `--help` on any call). Run with `LANGFUSE_HOST` exported (see [Connect](#0-connect)). Exact syntax lives in the docs/CLI — this section is the non-obvious knowledge and the analysis logic.

### Metric definitions (report these the same way every time)

So two runs over the same data report the same numbers, define metrics consistently:

- **Latency** — measure end-to-end at the **root / AGENT** observation (the full turn), not a child span. Report p50/p90/p99/max. Note that a long-lived session span (e.g. a voice call left open) is *session duration*, not per-turn latency — say which you mean.
- **Tokens** — report **both** per-trace total and per-generation input/output, and **label which**. "Max 505k tokens/trace" and "max 91k input tokens/generation" are different metrics; don't conflate them.
- **Error rate** — affected items / items examined, with the denominator stated (traces, or calls of a specific tool). Count failures from output **content**, not just `level=ERROR` (see #1 in Reliability).
- **Prevalence** — "traces affected / traces examined" against the *product* traces you inspected, not the raw window count. If synthetic traffic dominates (workflow step 3), report the rate both including and excluding it when it changes the conclusion.

### Gotchas (learned the hard way)

- **Pagination differs per endpoint** (`traces`/`scores` are page-based, `observations` is cursor-based) — follow the pagination tip in [cli.md](cli.md) exactly.
- **Trace `scores` field returns score IDs (strings), not score objects.** To get values, pull scores separately and join on `traceId`.
- **Do NOT fire many `npx langfuse-cli` calls rapidly in a shell loop / in parallel / in the background** — they intermittently hang or write empty output. Drive pagination from a single sequential script, one call at a time.
- **`ok:true` ≠ good.** Tool/retrieval success flags say nothing about content quality. Pull `io` and inspect the actual output for relevance/correctness.
- **Field groups** keep payloads small: traces → `core,io,metrics` (`scores` returns IDs only); observations → `core,basic,usage,model,metrics`, add `io` only when inspecting content. Filter observations by `--type` (`GENERATION`, `TOOL`, `AGENT`, `SPAN`, `EVENT`, …).
- **Filters:** the `--filter` JSON array (`[{type,column,operator,value,key}]`) is the most reliable way to combine time + environment + numeric thresholds, and takes precedence over the convenience flags.

### Pull sequence

Save every raw pull to `/tmp` so you can re-analyze without re-fetching.

1. **Orient** — list recent traces (`core` fields, newest first) and tally `environment` and `name`. Identify and **exclude** evaluator executions (`environment=langfuse-llm-as-a-judge`, name `Execute evaluator: …`) and dataset/playground runs; pick the product environment(s).
2. **App traces** — page through `traces list` for the window + chosen environment (`--filter` with datetime + environment; `core,io,metrics` fields). `meta.totalPages` tells you how many `--page` calls you need.
3. **Scores** — page through `scores list` for the window, then join `score.traceId → score.name → score.value/stringValue` onto traces. Summarize per evaluator (count + value distribution); watch for evaluators stuck at one constant value (dead-evaluator check).
4. **Observations** — cursor-paginate `observations list` (pagination tip in [cli.md](cli.md)). Add `--type TOOL` and `io` fields for a tool-content pull. Because parallel CLI calls hang, walk the cursor in one sequential loop.

### Analysis snippets

- **Latency/cost percentiles:** load the JSON, sort, compute median/p90/p99/max per observation type and at trace level.
- **Retrieval relevance:** for each search tool call, tokenize the question (drop stopwords) and the returned titles; flag calls with zero overlap. Count distinct documents ever returned — a tiny set returned for unrelated queries = broken retrieval.
- **Session loops:** group traces by `input.sessionId`, sort by timestamp, print each turn's last user message + which scores fired. Look for "where is that?" / repeated questions.
- **Segmentation:** before concluding a dimension is clean, recompute it grouped by `version`, `release`, `promptVersion`, `model`, and top `userId`s.

### Columns for `--filter`

The filterable columns are whatever `<resource> <action> --help` lists — check there rather than trusting a copied list, which drifts. The ones this workflow leans on most: for traces `timestamp, environment, name` (scoping) and `version, release, userId, sessionId` (segmentation); for observations `type, level, name, model, promptVersion` plus the latency/cost/token metrics. Filter `metadata` by key.
