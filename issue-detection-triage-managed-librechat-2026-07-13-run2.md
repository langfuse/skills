# Issue Detection Triage — Managed LibreChat (ClickHouse Agents)

> Second run on 2026-07-13 (window last 7 days ending 12:06 UTC). A prior, more
> observation-complete run from earlier today lives in
> `issue-detection-triage-managed-librechat-2026-07-13.md`.

## Method & scope

- **Window:** `2026-07-06T12:06 UTC` → `2026-07-13T12:06 UTC` (last 7 days)
- **Project:** `cmo09hyuk01ttad079ljvue6w` · host `https://cloud.langfuse.com`
- **Environment included:** `default` (the only environment present)
- **Traffic profile:** 2,787 traces across **227 tenants** / 301 users / 584 sessions. This is a multi-tenant LibreChat platform running Bedrock-Claude data-analysis agents against ClickHouse (MCP SQL tools). Dominant agent: `ClickHouse Agent` (sonnet-5) 2,063 traces + (sonnet-4-6) 249. Inputs are **organic and varied** (real German/English data questions) — **not** synthetic/demo-dominated, so the rates below are trustworthy.
- **Volume examined:** all 2,787 traces (core/metrics); all **665 ERROR-level observations**; a 1,200-generation sample (models/tokens/latency); a 400-tool-call sample (content/retrieval quality); full conversation reads on outlier traces.
- **Excluded:** none — no evaluator/LLM-judge runs, no dataset/playground traffic exist in this project.

### Headline metrics

| Metric | Value |
|---|---|
| Total traces | 2,787 (`AgentRun` 2,777 / `TitleRun` 10) |
| Error-trace rate (any ERROR obs) | 119 / 2,787 = **4.3%** |
| — of which genuine failures | 39 / 2,787 = **1.4%** |
| — of which user/client aborts | 80 / 2,787 = **2.9%** |
| End-to-end latency (root) | p50 **53s** · p90 **238s** · p99 **753s** · max **1,711s (28.5 min)** |
| Per-generation latency | p50 13s · p90 46s · TTFT p50 5s |
| Total cost | **$2,447** (~$127/day) · mean **$0.88**/trace · max **$23.89** |
| Cost concentration | 84% ($2,052) from the sonnet-5 ClickHouse Agent |
| Models | sonnet-5 (75%) · sonnet-4-6 (20%) · haiku-4-5 (5%, titles) |
| **Scores / evals / user feedback** | **0 — nothing is evaluated** |

## Findings (ranked)

| # | Issue | Category | Priority | Traces | Description | Root-cause hypothesis | Example | Proposed fix |
|---|---|---|---|---|---|---|---|---|
| 1 | **No quality measurement at all** | Coverage | **P0** | 2787 / 2787 | Zero scores, evaluators, or user-feedback signals exist over the entire window. For a text-to-SQL agent handing numeric answers to Marketing/Ops/C-level, **correctness is completely unmeasured** — a confidently wrong query result is invisible to everyone. | No online evaluators configured; no thumbs/rating capture wired from LibreChat. | — | Add an online evaluator on `AgentRun` (SQL-answer faithfulness / did-it-answer), and capture LibreChat 👍/👎 as scores. Start with the evaluator-monitors + dataset-construction skills. |
| 2 | **Severe end-to-end latency** | Latency | **P1** | ~all | p50 **53s**, p90 238s, p99 753s, max **28.5 min**. On an interactive chat product this is felt on the *median* turn, not just the tail. Driven by many sequential LLM calls (13s each) per agent turn. sonnet-5 ClickHouse agent p50 63s. | Long agentic loops (multi-step SQL exploration), each step a full ~13s generation; no step budget / early-stop. | [4ffba7…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/4ffba7feacbbbc32dc49da7e0de05cc0) (1711s) · [b7968f…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/b7968fe183c2ae617765bd10d02ff870) | Cap agent steps; parallelize independent tool calls; stream partial progress; consider haiku for planning sub-steps. |
| 3 | **User aborts / cancellations** | User friction | P2 | 80 / 2787 (2.9%) | 449 `AbortError`/`Request aborted` obs across 80 traces. A chunk are benign cancelled title-generation sub-calls; the rest are users cancelling mid-request — strongly correlated with #2 (long waits). | Users abandon slow turns; title sub-calls cancelled when parent completes. | [2a11b4…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/2a11b4e671eced72a2ee5dcbcd6de8bb) | Reduce latency (#2); make title-gen fire-and-forget so its abort isn't logged as ERROR. |
| 4 | **Context window blowout >1M tokens** | Cost | P2 | 9 / 2787 (0.3%) | 9 traces hard-fail with `prompt is too long: >1,000,000 tokens` (one generation hit **863k input tokens**). Request errors out; also inflates cost. | Unbounded context growth across long sessions / large tool outputs appended verbatim. | [19641865…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/19641865e8abdffc16c5c352ae956bbe) | Add context compaction/truncation before the Bedrock call; summarize or `_refKey` large tool outputs instead of inlining. |
| 5 | **Bedrock ServiceUnavailable** | Reliability | P2 | 11 / 2787 (0.4%) | 66 `ServiceUnavailableException: Bedrock is unable to process your request` obs → user sees a failed turn. | Upstream Bedrock throttling/capacity; likely no retry-with-backoff or model fallback. | [9dde72…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/9dde72c397e819b5928f90fcd5f59045) | Add exponential-backoff retry + cross-region/model fallback on 503. |
| 6 | **Agent looping / no-progress** | Tool/Agent | P2 | ≥1 confirmed | `GraphRecursionError: Recursion limit of 75 reached` — one Analista BET trace ran **38+ generations** hunting across tables and never produced an answer. Symptom of the same loop pattern driving #2/#4. | Agent can't find requested data, keeps trying tables instead of declining; no no-progress detector. | [e2144b…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/e2144be91eb6c1a86b0adb2b07fc0e35) | Lower recursion limit + detect repeated failed queries → stop and tell the user the data isn't available. |
| 7 | **`>5 documents` ValidationException** | Reliability | P2 | 8 / 2787 (0.3%) | 48 obs: `You can't include more than 5 documents in a request`. Agent attaches too many files/docs to a Bedrock call → failed turn. | File/document handling doesn't cap attachments to Bedrock's limit of 5. | [55b670…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/55b670ab890d7a3a380dfcf110775305) | Batch/limit documents to ≤5 per request, or summarize extras. |
| 8 | **Trace-level I/O not captured** | Coverage | P2 | 2787 / 2787 | 100% of traces have `input`/`output` = null (I/O only on nested observations). Blocks trace-level evals, feedback attachment, and quick UI inspection — compounds #1. | LibreChat Langfuse integration doesn't set root-span I/O. | any trace | Set root-trace input/output in the tracing integration so evaluators and reviewers can read the turn. |
| 9 | **Poor error hygiene** | Reliability | P3 | ~11 | 24 `[object Object]` (errors not serialized), 30 `InvalidCharacterError`, 6 `Unsupported MIME type: image/png`. Debuggability + minor input-handling gaps. | Error objects stringified wrong; PNG uploads rejected by Bedrock. | [4d41d2…](https://cloud.langfuse.com/project/cmo09hyuk01ttad079ljvue6w/traces/4d41d2599fcd3e302c8d652c6102710f) | Serialize error `.message`; convert/reject PNGs with a clear user message. |

### Agent prompts (paste-ready for a coding agent)

- **#2/#6 (latency + loops):** "Our LibreChat Bedrock ClickHouse agent averages 53s/turn (p90 238s, max 28min), driven by long sequential LangGraph loops of ~13s generations. One trace ran 38+ steps and hit GraphRecursionError(75) without answering (trace e2144be91eb6c1a86b0adb2b07fc0e35). Add: a per-turn step budget, parallel execution of independent tool calls, and a no-progress detector that stops and tells the user when repeated queries fail, instead of exhausting the recursion limit."
- **#4 (context):** "Agent turns intermittently fail with Bedrock `prompt is too long: >1,000,000 tokens` (e.g. trace 19641865e8abdffc16c5c352ae956bbe; one generation reached 863k input tokens). Implement context compaction before the model call: summarize or reference-key (`_refKey`) large tool/SQL outputs instead of inlining full result sets, and cap accumulated history."
- **#5 (Bedrock 503):** "Handle `ServiceUnavailableException: Bedrock is unable to process your request` (66 occurrences/11 traces this week) with exponential-backoff retry and a cross-region or sonnet-4-6 fallback so transient Bedrock capacity errors don't surface to users."

## Verified non-issues (checked, clean)

- **Tool / retrieval content quality** — SQL/MCP tool outputs are substantive and relevant; genuine tool errors are rare and the agent self-corrects (e.g. retries after `read_file` miss). The 36/400 "failure signatures" were false positives (words like "exception" inside legitimate ClickHouse doc search results).
- **Empty/null final outputs** — only from cancelled title sub-calls, not real answers.
- **Truncation** — output tokens max ~31k; no `length` finish-reason cutoffs observed.
- **Synthetic-traffic skew** — none; inputs are organic and varied across 227 tenants.

## Suggested order of action

1. **#1** — stand up *any* quality signal (evaluator + user feedback). Everything else is currently invisible.
2. **#2/#6** — latency & loop control (biggest UX + cost lever; also reduces #3 aborts and #4 blowouts).
3. **#4, #5, #7** — the three concrete hard-failure classes (cheap, well-scoped fixes).
4. **#8, #9** — instrumentation/hygiene.

## Not covered / open questions

- **Answer correctness (faithfulness)** — the single biggest unknown. With 0 evals and null trace I/O, I could not verify whether SQL results are *right*, only that tools return *something*. This is exactly what finding #1 would surface.
- Token/latency percentiles for generations are from a 1,200-gen sample; error counts are the full 665 ERROR obs; tool content is a 400-call sample (last ~4 days). I did not walk all 81,228 observations.
- Per-tenant quality/latency breakdown not done (top tenant = 361 traces).
