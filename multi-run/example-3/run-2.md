# Langfuse Issue-Detection Triage — Run #2

**Project:** `cmfzimu6801jbad079856b07r` ("langfuse-in-app-agent") · EU cloud (`https://cloud.langfuse.com`)
**Analyst:** independent triage run #2 of 5
**Generated:** 2026-07-08

---

## Overall stats

### Method & scope
- **Window analyzed:** `2026-07-01T19:07:23Z` → `2026-07-08T19:07:23Z` (last 7 days, UTC).
- **Environments present:** `langfuse-in-app-agent` (221 traces) and `langfuse-natural-language-filter` (33 traces).
- **Product traffic chosen:** `langfuse-in-app-agent` is the primary product (the in-app assistant). `langfuse-natural-language-filter` (the search-bar filter generator) is a **secondary** LLM feature — analyzed and reported alongside.
- **Excluded / machinery:** No `langfuse-llm-as-a-judge` evaluator runs, no dataset/experiment/playground traces appeared in the window — nothing excluded for that reason. Note: `in-app-agent-conversation-title` (117 traces) is a real product-support feature (auto-titles conversations with Haiku), kept in scope but treated as low-risk background traffic.

### Volume examined (fully pulled & inspected)
- **254 traces** (100% of the window — 3 pages).
- **865 observations** (`core,basic,usage,model,metrics`; 330 TOOL re-pulled with `io`).
- **2 scores** (the entire window — 147 exist all-time).

### Trace breakdown by name
| Environment | Name | Traces | Role |
|---|---|---|---|
| langfuse-in-app-agent | in-app-agent-conversation-title | 117 | Title generation (Haiku) — support |
| langfuse-in-app-agent | agent-turn | 79 | **Core agent turns (primary product)** |
| langfuse-in-app-agent | in-app-agent | 25 | Session/conversation wrapper (null I/O) |
| langfuse-natural-language-filter | search-bar-filter | 32 | NL→filter-JSON generator (Opus) |
| langfuse-natural-language-filter | natural-language-filter | 1 | Older filter generator |

### Input distribution (checked first)
Organic, diverse traffic — **no synthetic domination**. Most frequent `agent-turn` input appears 4/79 (5%). Real multi-user usage: 25 distinct users, 34 sessions across 79 agent-turns, English + Italian, all on-domain Langfuse-observability questions (dashboards, evals, datasets, SQL/ClickHouse, cost widgets). All rates below are computed on the 79 real `agent-turn` traces unless stated.

### Headline metrics
| Metric | Value |
|---|---|
| Total traces (window) | 254 |
| agent-turn ERROR-level obs | 1 hard failure (+5 tool-arg validation errors) |
| agent-turn per-turn latency | p50 **13.9s** · p90 58.0s · p99 100.0s · max 100.0s |
| in-app-agent (session-wrapper) duration | up to 5,943s (99 min) — *session duration, not per-turn* |
| Instrumented cost (window) | **$1.52** (search-bar-filter $1.32 = 87%; titles $0.18) |
| Main-agent cost/tokens/model | **$0 / 0 tokens / blank — not instrumented (131 gens)** |
| Traffic with any score | **2 / 254 (0.8%)** |
| Negative user-feedback signal | 0 (both feedback scores positive) |

---

## Findings

| # | Issue | Category | Priority | Traces affected | Description | Root-cause hypothesis | Example traces | Proposed fix | Agent prompt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Main agent has no cost/token/model instrumentation | Cost | **P1** | 131/131 main-agent generations | Every `agent-turn` and `agent-run` generation reports `model=""`, `totalCost=0`, and empty `usageDetails`. Trace-level `totalCost=0` for all 79 agent-turns and all 25 session wrappers. The product's own spend and token usage are completely invisible; only the Haiku titler and Opus filter feature carry cost. | The main agent's LLM calls are traced via a wrapper that does not pass model name / token usage into Langfuse (LangChain/Bedrock integration set for the sub-features but not the agent loop), so cost mapping never fires. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_f0mwsa9a66y2acarvqrjuo4m-trace` | Attach `model`, `usageDetails` (input/output tokens) and let Langfuse cost-map on the agent's generation spans; or set explicit `costDetails`. | The in-app agent's generations (trace name `agent-turn`/`agent-run`) log with empty `model` and zero tokens/cost in Langfuse, so we have no cost visibility on our main product. Find where the agent's LLM calls are instrumented (LangChain callback / Bedrock client wrapper) and ensure each generation span passes the model id (e.g. `eu.anthropic.claude-opus-4-8`) and token usage so Langfuse computes cost. Compare against the working `search-bar-filter` integration which does report cost. |
| 2 | Production traffic is unevaluated (no scores/evals) | Scores/Evals | **P1** | 252/254 unscored (99.2%) | Only 2 scores exist in 7 days, both manual `in_app_agent_feedback` = true (positive). No LLM-as-a-judge evaluator ran on any production trace. There is no automated quality signal on the primary product — regressions would be invisible. | Evaluators exist in the project (the agent can list `accuracy`, `compliance` evaluators) but none are wired to run on `agent-turn` production traffic; feedback is collected only sporadically via annotation. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_so61aeywm94leindtfsirou6-trace` | Attach at least one LLM-judge (helpfulness/task-completion) to the `langfuse-in-app-agent` environment on a sampled basis; surface the thumbs up/down more aggressively. | Our in-app agent (`agent-turn`) has essentially no evaluation coverage — 2 human scores in a week and no automated evaluator running on production. Set up a sampled LLM-as-a-judge evaluator (task-completion / helpfulness, variables mapped to trace `input` and `output`) on the `langfuse-in-app-agent` environment so we can detect quality regressions. Confirm the variable mapping includes the assistant `output`. |
| 3 | Context-window overflow → hard turn failure | Reliability | **P1** | ≥1/79 (1.3%) | One `agent-turn` failed with `AI_APICallError: prompt is too long: 1371258 tokens > 1000000 maximum`. The agent accumulated 1.37M tokens (loading large trace/observation payloads into context) and blew the model's 1M limit; the turn produced no answer (output truncated). Systemic risk as data grows. | The agent loads full observation/trace data into context without pagination or size caps; large `listObservations`/`getObservation` results balloon the prompt past the model limit. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_k18etm6x5d5bedxno83tbmwg-trace` | Cap/truncate tool-result payloads fed back to the model; summarize or page large result sets; add a pre-send token budget guard with graceful degradation. | An `agent-turn` hard-failed with `prompt is too long: 1371258 tokens > 1000000 maximum`. The agent pulls large Langfuse observation/trace results into context unbounded. Add a token-budget guard: truncate or summarize tool outputs (especially `langfuse_listObservations` / `getObservation`) before appending to the message history, and fall back to paged/summarized retrieval when the context would exceed ~800k tokens. |
| 4 | Slow interactive turns | Latency | **P1** | p50 13.9s across 79 turns | End-to-end `agent-turn` latency: p50 **13.9s**, p90 58s, p99 100s, max 100s. For an interactive in-app assistant a ~14s median wait is felt. One of only two user-feedback comments explicitly says "nice worked but was slow". | Multi-step tool-calling agent loop with sequential LLM+tool round-trips against the Langfuse API; no streaming-perceived speedup and large retrievals add latency (see #3). | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_f0mwsa9a66y2acarvqrjuo4m-trace` (58s) | Parallelize independent tool calls, stream partial output, trim retrieval payloads, and consider a faster model for planning steps. | Our in-app agent's per-turn latency is p50 14s / p99 100s and a user complained it was slow. Investigate the agent loop (trace name `agent-turn`): identify whether sequential tool calls or large retrievals dominate the wall-clock, parallelize independent `langfuse_*` tool calls, and stream the assistant response so the user sees progress before the full 14s+ completes. |
| 5 | Malformed tool arguments | Tool/Agent | **P2** | 5/330 tool calls (1.5%) | 5 tool calls failed schema validation: `langfuse_listScores` (bad `operator` enum value), `langfuse_getObservationFilterValues` and `langfuse_listObservations` (`root: must NOT have additional properties`). Tool returns `{"error":true,"message":"...validation failed..."}`; the agent must retry, adding latency. | The agent generates tool-call arguments that don't match the tool JSON schema (invented `operator` values, extra properties) — prompt/tool-schema drift. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_twv32urios0djamn0ut8efkg-trace` | Tighten tool schemas in the system prompt / add few-shot examples of valid `operator` enums; validate args client-side before the call. | The in-app agent intermittently sends invalid tool arguments (e.g. `langfuse_listScores` with an `operator` not in the allowed enum; `getObservationFilterValues`/`listObservations` with disallowed extra properties), triggering `"error":true` validation failures and retries. Review the tool schemas exposed to the model and add explicit allowed-value lists / examples so it stops inventing operators and adding extra props. |
| 6 | Duplicate consecutive user turns | User friction | **P2** | 10/79 turns across 5 sessions (13%) | In 5 sessions the identical user message repeats on consecutive turns (e.g. session `aconv_eezdndyapxhrbllb8ubktqzp` shows the same widget question 4× in a row). One of those repeated turns produced an empty assistant response. Looks like UI double-submission or turn re-segmentation, not distinct user intent. | Frontend re-submits the same user message on each agent step, or the agent loop re-emits the prior user turn — inflating turn counts and occasionally yielding an empty answer. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_ng3rpcns3pr7e0iqv7z3mxjr-trace` | Deduplicate consecutive identical user messages before dispatch; ensure each agent step doesn't re-log the user turn; investigate the empty-response turn. | In several sessions the same user message is logged 4× in a row as separate `agent-turn` traces, and one produced an empty assistant reply. Determine whether the frontend re-submits on each agent step or the turn is re-segmented, and dedupe so one user message = one turn. Check trace `arun_ng3rpcns3pr7e0iqv7z3mxjr-trace` which returned empty output content. |
| 7 | Filter generator leaks reasoning, breaks JSON contract | Output quality/Safety | **P2** | 1/32 search-bar-filter (3.1%) | The `search-bar-filter` feature must output only a filter JSON array, but one output appended prose after the array: `[...]\n\nWait — traceName is a stringOptions (enum) column and cannot express "starts with"...`. A strict JSON parser downstream would fail and the filter silently would not apply. | Opus emits chain-of-thought / self-correction after the JSON when it hits an edge case (a `starts with` request on an enum column), violating the "JSON only" instruction. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/b169158d1e83d90534d210ae71acfa82` | Enforce structured output (tool/JSON mode or a stop sequence); strip/parse only the first JSON array; add a validator + repair step. | The `search-bar-filter` feature is supposed to return only a JSON filter array but sometimes appends reasoning prose after it (see trace `b169158d1e83d90534d210ae71acfa82`, which added "Wait — traceName is a stringOptions..."), which breaks JSON parsing downstream. Switch to structured/JSON output mode or add a stop sequence, and validate/repair the output before use. |
| 8 | Opus for structured filter generation | Cost | **P3** | 32/32 search-bar-filter | `search-bar-filter` uses `eu.anthropic.claude-opus-4-8` at mean **$0.041/call** (max $0.063), = $1.32 = 87% of all instrumented spend for a low-volume structured-extraction task. Absolute cost is small today but scales poorly. | A high-cost frontier model is used for a constrained JSON-mapping task that a cheaper model likely handles. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/251403f19a415728b5ec783301e11bfa` | A/B a cheaper model (Haiku/Sonnet) for filter generation; keep Opus only if accuracy measurably drops. | The `search-bar-filter` (NL→Langfuse filter JSON) runs on Opus-4.8 at ~$0.04/call. Evaluate whether Haiku-4.5 or Sonnet produces equally valid filter arrays on a sample of real inputs; if quality holds, switch the model to cut per-call cost ~10-20×. |
| 9 | No version/release tags on agent traffic | Coverage | **P3** | 79/79 agent-turns | All `agent-turn` traces have `version=null` and `release=null`. Deploy-over-deploy regression analysis (skill dimension I) is impossible — a bad release couldn't be isolated. | The agent SDK is not populating `version`/`release` on trace creation. | `https://cloud.langfuse.com/project/cmfzimu6801jbad079856b07r/traces/arun_f0mwsa9a66y2acarvqrjuo4m-trace` | Set `release`/`version` (git SHA or semver) on the tracer so metrics can be sliced by deploy. | Our `agent-turn` traces carry no `version`/`release`, so we can't detect regressions across deploys. Populate the Langfuse trace `release` (git SHA) and `version` (prompt/agent version) at tracer init. |

---

## Verified non-issues (checked, held up)

- **Input distribution / synthetic traffic (skill step 3):** organic and diverse; top input only 5% of agent-turns. Aggregates are trustworthy. No CI/demo flooding.
- **Trace-level "empty" outputs:** the 2 flagged empty `agent-turn` outputs ended on a successful tool call (`upsertDataset`, `createDashboardWidget` — actions completed) with no trailing text; not broken answers reaching users. Minor UX nuance only, not counted as a failure.
- **`in-app-agent` 99-minute "latency":** these 25 traces are session/conversation wrappers (trace id == sessionId, null I/O). Their multi-thousand-second values are **session duration, not per-turn latency** — correctly excluded from the latency finding.
- **Retrieval relevance (langfuseDocs_searchLangfuseDocs, 11 calls):** returned doc titles match the query topics (monitors, multi-turn eval, etc.); no evidence of the same-docs-for-everything failure mode.
- **Out-of-scope / navigation handling:** `langfuse_proposeRedirect` (18 calls) cleanly returns redirect actions to the right UI pages; no over-reach or leakage observed. All inputs were on-domain Langfuse questions.
- **Safety / PII:** no leaked secrets, PII, or prompt-injection observed in sampled inputs/outputs.
- **Conversation-title feature:** fast (p50 1.0s), cheap ($0.0016/call), outputs clean concise titles matching the transcript intent.
- **Multi-turn conversation quality:** sampled sessions (e.g. the compliance-llmaj experiment-comparison session) show competent, resolving multi-turn work; only mild "so what is the answer?" underspecified-first-answer friction.
- **Hard error rate:** genuinely low — 6 ERROR-level obs total; only 5 real content-level tool failures (all validation, finding #5) and 1 context-overflow (finding #3). The 50 "empty data" tool results are mostly legitimate empty query matches, not failures.

## Suggested order of action
1. **#1 + #3** — instrument main-agent cost/tokens/model and cap context payloads (same integration surface; fixes the biggest blind spot and the hard failure).
2. **#2** — wire a sampled LLM-judge + push feedback so quality is observable.
3. **#4** — latency (parallelize tools, stream, trim retrieval) — reinforced by #3's fix.
4. **#5, #6, #7** — tool-arg validity, duplicate turns, filter JSON contract.
5. **#8, #9** — model cost tuning and release tagging (hygiene).

## Open questions
- Are the duplicate consecutive user messages (#6) a frontend bug or intended per-step re-logging?
- Is the main agent's model truly untracked, or tracked under a different provider integration not surfaced here?
- Why did the context-overflow trace load 1.37M tokens — a single huge `getObservation`, or accumulated history?

## Not covered / limitations
- **Faithfulness/hallucination** not verifiable without ground truth; not assessed beyond retrieval-relevance spot checks.
- **Cost/token analysis for the main agent is impossible** given the instrumentation gap (#1) — the reported $1.52 spend excludes all agent-turn LLM usage, so true spend is unknown and likely much higher.
- **Regression-over-deploy analysis** blocked by missing version/release tags (#9).
- Only 2 scores existed, so score-distribution / evaluator-validity analysis (reading judge comments) had no data to run against — the finding is the *absence* of evaluation (#2), not a mis-wired one.
- TOOL `io` inspected for all 330 tool obs; GENERATION `io` inspected only on sampled traces, not all 281.
