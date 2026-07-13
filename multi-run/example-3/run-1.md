# Langfuse Issue-Detection Triage — `langfuse-in-app-agent` (Run #1)

**Project:** `cmfzimu6801jbad079856b07r` (EU cloud, `https://cloud.langfuse.com`)
**Generated:** 2026-07-08 (UTC)

---

## Overall stats

### Method & scope
- **Window analyzed:** `2026-07-01T19:01:23Z` → `2026-07-08T19:01:16Z` (last 7 days, UTC). Actual data spans `2026-07-01T23:28Z` → `2026-07-08T18:41Z`.
- **Environments present:**
  - `langfuse-in-app-agent` — **221 traces** = the product (a Langfuse in-app observability assistant: it answers users' questions about their own Langfuse data via tools, builds widgets/datasets/evaluators, searches docs).
  - `langfuse-natural-language-filter` — **33 traces** = an adjacent "search-bar filter" feature (NL → filter translation). Reported separately below; not the pinned app.
- **Excluded machinery:** none. There are **no** `langfuse-llm-as-a-judge` evaluator-execution traces, no dataset/experiment/playground runs in the window. (The two LLM-as-judge *evaluators* that exist write `source=EVAL` scores directly onto product traces — analyzed in dimension E, not excluded.)

### Volume examined
| Item | Pulled / inspected |
|---|---|
| Traces | **254** (221 product + 33 NL-filter), all 3 pages |
| Observations | **865** (799 product) — full cursor walk, 9 pages. Types: 330 TOOL, 281 GENERATION, 254 SPAN |
| TOOL observations with `io` | **330** (100%) inspected for content-level failures |
| `agent-turn` generations with `io` | **79** (100%) — user inputs + assistant outputs read |
| Scores | **147** all-time (join by traceId); **2** fall in the 7-day window |

### Product trace structure (important)
The product's main conversational turn was **renamed on 2026-07-03 ~14:20 UTC**:
- **Before 07-03:** trace/span `in-app-agent` (25 traces) containing generation **`agent-run`** (52).
- **After 07-03:** trace/span `agent-turn` (79 traces) containing generation **`agent-turn`** (79).
- `in-app-agent-conversation-title` (117) = a cheap title-generation side-call. This rename is the root cause of the P0 below.

### Headline metrics (interactive `agent-turn`, n=79 unless noted)
| Metric | Value |
|---|---|
| Interactive turns | 79 (in 34 sessions, 25 distinct users) |
| End-to-end latency p50 / p90 / p99 / max | **13.9s / 55.1s / 82.2s / 100.0s** |
| Hard errors (agent generation, ERROR level) | 1 / 79 (1.3%) — 1M-token context overflow |
| Tool-arg validation errors | 5 tool calls across 3 traces / 330 tool calls (1.5%) — self-recovered |
| Turns with no final text answer | 4 / 79 (5.1%) |
| Cost — measured | **$1.52 total**, but `agent-turn`/`agent-run` = **$0 (uninstrumented)**; $1.32 is `search-bar-filter`, $0.18 title-gen |
| Scores in-window | **2** (both user thumbs-up); **0 automated EVAL scores** → ~0.8% coverage |
| Sessions with identical consecutive re-asks | **5 / 34 (15%)**, 10 duplicate turns |

**Input distribution (trust check):** 65 distinct first-questions out of 79 turns — **no synthetic/canned dominance**. Genuine organic usage (build widgets, create datasets, set up evaluators, analyze failure modes; mix of English and Italian). All rates below are on real traffic and trustworthy; **no synthetic skew to condition on.**

---

## Findings

| # | Issue | Category | Priority | Traces affected | Description | Root-cause hypothesis | Example traces | Proposed fix | Agent prompt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Quality evaluators dark | Scores/Evals | **P0** | 0 / 79 scored (whole window) | Both LLM-as-judge evaluators — `in-app-agent-usable-answer` (numeric 0–1) and `in-app-agent-mcp-incorrect-call` (bool) — produced **0 scores in the 7-day window**. All 71+71 scores each date to a single 1-minute burst on 2026-06-26 (creation-time backfill). The **only** in-window scores are 2 user thumbs-up annotations. So the product's primary automated quality signal is invisible for **every** current turn. The evaluators are correctly wired (I read their `comment` fields — they clearly reason about the actual assistant response; the historical batch found ~15% of answers ≤0.5 and 7% incorrect tool calls, so they *work*). | The eval rules are `enabled:true, sampling:1` but their filter is `type=GENERATION AND name="agent-run"`. The main generation was **renamed `agent-run`→`agent-turn` on 2026-07-03**, so the filter now matches **zero** current traffic. Additionally, even the 52 matching `agent-run` gens from 07-01→07-03 got no live scores (only the 06-26 backfill exists), suggesting live evaluation was not firing before the rename either. | `arun_f0mwsa9a66y2acarvqrjuo4m-trace` (recent unscored agent-turn) · eval rules `cmqv1js9l00gkad0d5r7ssjva`, `cmqv1jpru00imad0clt0ivf60` | Update both evaluation-rule filters to target `name any of ["agent-turn","agent-run"]` (or the current generation name). Verify a fresh `agent-turn` produces a live score, then backfill the window. Add a known-positive canary so a future rename fails loudly. | The two Langfuse LLM-as-judge evaluators `in-app-agent-usable-answer` and `in-app-agent-mcp-incorrect-call` (project `cmfzimu6801jbad079856b07r`) stopped scoring on 2026-07-03 because the target generation was renamed from `agent-run` to `agent-turn` while the eval-rule filter still says `name="agent-run"`. Update rule IDs `cmqv1js9l00gkad0d5r7ssjva` and `cmqv1jpru00imad0clt0ivf60` to match `agent-turn`, re-run over the last 7 days, and add a synthetic known-positive trace so the rules can't silently match nothing again. Confirm scores appear on new `agent-turn` observations. |
| 2 | Slow interactive turns | Latency | **P1** | ~High p50 on all 79 | Median turn takes **13.9s**, p90 **55s**, p99/max **~82–100s** — for a chat assistant this is felt on most turns. Corroborated directly: the one in-window user comment is *"nice worked but was slow"*, and 5/34 sessions show identical consecutive re-asks (users re-sending because nothing came back fast enough). | Multi-step agent loop: sequential tool calls (listObservations/queryMetrics/getObservation) each add seconds, plus opus-4-8 reasoning. No streaming/progress signal visible, so slow turns read as hung. | `arun_twv32urios0djamn0ut8efkg-trace` (100s) · `arun_zyppu3qhdqilir0bdwtfm7wq-trace` (82s) · session `aconv_eezdndyapxhrbllb8ubktqzp` (11 turns, user re-asked 4×) | Stream tokens / show tool-progress in UI; parallelize independent tool calls; cap tool result sizes to cut re-feeding latency; consider haiku for simple turns. | The in-app agent (project `cmfzimu6801jbad079856b07r`) has p50 13.9s / p90 55s / p99 82s per turn and users complain it is slow and re-send the same message. Investigate the `agent-turn` loop: are tool calls sequential when they could be parallel? Is there any streaming/progress to the client? Reduce per-turn wall time and surface intermediate progress. See slow trace `arun_twv32urios0djamn0ut8efkg-trace` and re-ask session `aconv_eezdndyapxhrbllb8ubktqzp`. |
| 3 | Context-overflow turn failure | Reliability | **P1** | ≥2 / 79 (2.5%) | 1 turn hard-errored: `AI_APICallError: prompt is too long: 1371258 tokens > 1000000 maximum` — a `langfuse_listObservations` result was fed back and blew past the 1M context limit; the user got no answer. A 2nd turn ("create 1 dataset based on production data") has output `<truncated due to size exceeding limit>` and no text answer — same oversized-payload failure mode. | Tool results (esp. `listObservations`/`getObservation` with full io) are returned un-capped and re-injected into the prompt; a large query balloons context until the model call fails. | `arun_k18etm6x5d5bedxno83tbmwg-trace` (1.37M tokens) · `arun_k6kjd87uunn29gwt43yqp7t5-trace` (truncated) | Cap/paginate tool outputs (max rows + truncate large `input`/`output` fields); enforce a token budget before the model call; on overflow, summarize or ask to narrow rather than error. | In the in-app agent, `langfuse_listObservations`/`langfuse_getObservation` can return payloads large enough to push the prompt over 1,000,000 tokens, causing `AI_APICallError: prompt is too long`. Add hard caps on tool-result size (row limit + per-field truncation) and a pre-call token budget check that summarizes or re-prompts instead of failing. Repro: trace `arun_k18etm6x5d5bedxno83tbmwg-trace`. |
| 4 | Core agent cost/token blind | Coverage / Cost | **P2** | 131 / 131 core gens | Every `agent-turn` (79) and `agent-run` (52) generation records **no model, $0 cost, 0 tokens**. Only the auxiliary `conversation-title` and `search-bar-filter` gens are instrumented. So the reported $1.52 total **excludes the entire agent** — you cannot see the cost of your own product, and cannot segment quality/cost by model. | The agent's LLM calls are logged as generations without `usageDetails`/`model` populated (SDK usage/model not passed through for the main call). | `arun_twv32urios0djamn0ut8efkg-trace` (agent-turn gen, empty usage) | Populate `model` + `usageDetails` (input/output tokens) on the `agent-turn` generation so cost is computed. Confirm model attribution (haiku vs opus per turn). | The in-app agent's `agent-turn`/`agent-run` generations in project `cmfzimu6801jbad079856b07r` log no model and no token usage, so cost is $0 and un-monitorable. Ensure the tracing wrapper passes `model` and `usage` (input/output tokens) for the main agent LLM call so Langfuse computes cost. Verify on a new `agent-turn` trace. |
| 5 | Malformed tool arguments | Tool/Agent | **P2** | 3 / 79 (5 tool calls) | 5 ERROR-level tool calls, all **input-validation failures** the model generated: `langfuse_listScores` with `operator:"&lt;"` (HTML-escaped `<` leaked into args), and `getObservationFilterValues`/`listObservations` sending disallowed props (`environment`, `observationType`, `hasParentObservation` → "must NOT have additional properties"). Agent retries and recovers, but each wastes a round-trip (latency/cost). | (a) HTML-entity encoding of `<`/`>` somewhere in tool-arg serialization; (b) tool JSON-schemas / prompt don't clearly enumerate allowed operators and forbid extra keys, so the model guesses. | `arun_twv32urios0djamn0ut8efkg-trace` (`&lt;` operator) · `arun_vhj5xlowigc87satggpv8u9x-trace` (extra props) | Fix HTML-escaping in the tool-arg path; tighten tool descriptions to list allowed `operator` enum values and mark schemas `additionalProperties:false` with clear error hints. | The in-app agent emits malformed tool args: `langfuse_listScores` received `operator:"&lt;"` (HTML entity instead of `<`), and `langfuse_getObservationFilterValues`/`langfuse_listObservations` were called with properties their schema forbids. Find where tool arguments are serialized and stop HTML-escaping operator values; update the tool prompts/schemas to enumerate valid operators and reject unknown fields with actionable messages. See traces `arun_twv32urios0djamn0ut8efkg-trace` and `arun_vhj5xlowigc87satggpv8u9x-trace`. |
| 6 | Turns that end on a tool action, no closing text | Output quality | **P2** | 4 / 79 (5%) | 4 turns produced no final natural-language answer. 2 are the oversized-output failures (finding 3). The other 2 ("create a dataset with 1 random trace", the Italian widget request) **end on a successful tool call** (`upsertDataset`, `createDashboardWidget`) with no confirming assistant message — the user may see the action happen but gets no textual "done / here's what I did". | Agent loop terminates after a terminal tool call without a required summarizing turn; or the final assistant text isn't captured in the trace output. | `arun_yep4kltbrhejvfru4nouohym-trace` · `arun_ng3rpcns3pr7e0iqv7z3mxjr-trace` | Require a closing natural-language turn after action tools (confirm what was created + link). Verify the final assistant message is persisted to trace output. | Some in-app agent turns finish immediately after a write tool (`upsertDataset`, `createDashboardWidget`) with no closing message to the user. Add a final summarization step confirming the action and linking the created resource, and confirm the final assistant text is written to the trace output. Examples: `arun_yep4kltbrhejvfru4nouohym-trace`, `arun_ng3rpcns3pr7e0iqv7z3mxjr-trace`. |
| 7 | Expensive model for NL search-filter | Cost | **P3** | 32 / 32 (adjacent feature) | The `search-bar-filter` feature (env `langfuse-natural-language-filter`) uses **opus-4-8** at **$0.041/call, ~7.8k tokens/call** ($1.32 total) to translate a search bar query into a filter — a comparatively simple task. | Default model = opus for a task a cheaper/faster model likely handles. | (env `langfuse-natural-language-filter`) | A/B a smaller model (haiku) for filter translation; measure accuracy vs the current opus baseline. | The `search-bar-filter` / natural-language-filter feature uses claude-opus-4-8 at ~7.8k tokens and $0.041 per call for NL→filter translation. Trial claude-haiku for this task and compare filter-correctness; opus is likely overkill for the bulk of these. |

---

## Verified non-issues (checked, held up)

- **Input distribution / synthetic skew:** clean — 65/79 distinct questions, no canned/CI flood. Rates are trustworthy.
- **Machinery contamination:** clean — no LLM-judge/dataset/playground traces polluting the product env.
- **Tool `ok:false` / error envelopes:** clean beyond finding 5 — tools return real data, no hidden `ok:false` bodies (the many "error"/"failure"/"504" strings in tool outputs are *the user's own trace data*, since this agent analyzes failures — not tool failures).
- **Retrieval relevance (docs search):** spot-checked `langfuseDocs_searchLangfuseDocs` (11 calls) — returned on-topic pages (e.g. the error-analysis guide for an error-analysis question). No same-doc-for-everything pattern. (Small n — limited confidence.)
- **Safety / PII / injection:** no leaks or injections seen. Inputs contain users' own emails/project data (expected). Agent correctly declined cross-project access: *"I can only query data for the currently active project."*
- **Language matching:** Italian questions answered in Italian — no language mismatch in the sample.
- **Refusals:** the 6 "can't/unable" matches were honest capability limits (redacted tool output, single-project scope), not unhelpful deflection.
- **Out-of-scope:** requests are on-domain (Langfuse usage/analytics); the one edge case ("can Chinese mainland reach Langfuse Cloud API?") is a legit docs question.

## Suggested order of action
1. **Finding 1 (P0):** re-point the eval-rule filters to `agent-turn` and backfill — restore the quality signal first; everything else is easier to see once it's on.
2. **Finding 3 (P1):** cap tool-result size — stops user-facing hard failures.
3. **Finding 2 (P1):** latency + progress UX — the most-felt friction.
4. **Finding 4 (P2):** instrument agent cost/tokens/model.
5. Findings 5–7 (P2/P3) as cleanup.

## Open questions
- Was the `agent-run`→`agent-turn` rename intentional, and were other filters/dashboards/monitors also pinned to the old name?
- Are the 4 "no final text" turns truly answer-less to the user, or is the final assistant message dropped from the trace (instrumentation)? Confirm against the live UI.
- Is tool output being `[tool output redacted]` by design (privacy)? It appears in 8/330 tool outputs and the agent itself flagged it limits its analysis.

## Not covered
- **Faithfulness/hallucination:** not verifiable without ground truth; compounded by `[tool output redacted]` blanking content the agent (and I) would need to check answers against.
- **Regression vs prior window:** only 7 days pulled; the 06-26 eval backfill is the sole historical quality baseline.
- **Full transcript read:** sampled ~15 conversations end-to-end + all 79 outputs programmatically; did not read all 79 in full.
- **Scores endpoint quirk:** `scores list --from-timestamp` returned 2 vs 147 unfiltered — I filtered client-side; if that flag is used elsewhere it may under-report.
- **`in-app-agent` container spans** show max ~99 min duration — treated as session/container wall-clock, not per-turn latency (per-turn measured on `agent-turn`).
