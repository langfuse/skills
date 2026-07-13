# Production Trace Triage — Langfuse project `clkpwwm0m000gmm094odg11gi`

_Generated 2026-07-08_

## Method
- **Trace-level sweep:** 30 days (2026-06-08 → 07-08), all **1,669** `environment=default` traces (`core,io,metrics`).
- **Deep dive (scores + observations):** last 7 days (07-01 → 07-08) — **407 traces, 3,170 observations, 1,641 scores**.
- **Excluded:** 82%+ of raw traffic is LLM-as-a-judge evaluator runs (`environment=langfuse-llm-as-a-judge`) — correctly excluded as machinery.
- **Products found:** QA-Chatbot (1,278), Image-Generator (233), Sentiment-Classifier (112), livekit-voice-agent (44).

## Headline metrics

| App | n (30d) | Latency med / p90 / p99 / max | Cost mean | Empty output |
|---|---|---|---|---|
| QA-Chatbot | 1,278 | 21s / 47s / **106s / 274s** | $0.033 | 1.1% |
| Image-Generator | 233 | 13s / 17s / 27s | $0.011 | 100%* |
| Sentiment-Classifier | 112 | 2.9s / 4.5s / 8s | $0.00006 | 0% |
| livekit-voice-agent | 44 | 20s / 239s / **6117s** | $0.002 | 100%* |

\* Likely un-captured non-text output (see P3-#11), not necessarily failures.

## Issues at a glance

| # | Pri | Issue | App | Evidence / prevalence | Silent? | Suggested fix |
|---|-----|-------|-----|-----------------------|---------|---------------|
| 1 | 🔴 P1 | Agent tool-call loops → slow, costly, sometimes empty answers | QA-Chatbot | 12/323 turns (3.7%) hit 8–11 gpt-5 + up to 10 tool calls, avg 56s (max 274s), 3 return empty `{}`; 14/1278 empty over 30d | Yes | Cap steps with "best answer so far" fallback; add no-progress loop breaker |
| 2 | 🟠 P1 | High end-to-end latency across the board | QA-Chatbot | median 21s, p90 47s, p99 106s; ~2.8 sequential gpt-5 calls/turn @ ~7s + retrieval 5.4s | Partly | Limit/parallelize retrieval rounds; faster model for routing; stream partials |
| 3 | 🟠 P1 | "Language & style" evaluator mis-wired (false signal) | QA-Chatbot | 298/323 (92%) score 0 — comments say "no prior assistant message"; evaluating wrong turn | Yes | Fix evaluator input mapping to use assistant response; re-baseline |
| 4 | 🟠 P1 | Correctness low on a meaningful slice | QA-Chatbot | median 0.72, mean 0.63; 53/169 <0.6, 50 <0.5 (some 0.0) | Yes | Error-analyze low-correctness slice (overlaps #1) |
| 5 | 🟡 P2 | 26% of inputs off-topic | QA-Chatbot | `user-intent=irrelevant-to-langfuse` 85/323 (26%); correlates with loops | No | Early scope-guard to short-circuit off-topic queries |
| 6 | 🟡 P2 | `searchLangfuseDocs` returns HTTP 504s | QA-Chatbot | 9/292 calls (~3%), transient, mostly recovered | Loud | Investigate inkeep-rag backend reliability; add retry/backoff |
| 7 | 🟡 P2 | Hung voice sessions | livekit-voice-agent | single sessions 6117s / 3349s / 1499s (n=44) | Partly | Verify real hangs vs session aggregates; add timeouts |
| 8 | 🔵 P3 | No `version`/`release` on any trace | all | 1,669/1,669 null | Yes | Tag deploys so regressions become detectable |
| 9 | 🔵 P3 | User feedback near-zero | all | only 3 `user-feedback` scores (all positive) across thousands of traces | Yes | Instrument thumbs/ratings capture |
| 10 | 🔵 P3 | Empty user inputs produce empty traces | QA-Chatbot | 0 processing on blank input | No | Input validation / prompt for content |
| 11 | 🔵 P3 | 100% empty trace-level output | Image-Generator, voice | non-text output likely un-instrumented | Yes | Verify output capture instrumentation |

---

## Findings (detail)

### 🔴 P1 — #1 QA-Chatbot agent tool-call loops → slow, costly, sometimes empty
**3.7% of chatbot turns (12/323 in 7d)** spiral into **8–11 gpt-5 calls + up to 10 tool calls**, averaging **56s** (max 274s); **3 return an empty `{}`** with no answer. Step-limit exhaustion is **non-deterministic**: "What can I use Langfuse for?" answers cleanly in 2 tool calls on the normal path but loops on these. 14 QA traces (1.1%) returned empty output over 30 days.
- Evidence: traces `4dcdd85c485d`, `1fb27ea7a8c1` (11 gen / 10 tool, empty); loop triggers dominated by broad/off-topic queries.
- **Fix:** cap agent steps with a graceful "best answer so far" fallback instead of empty `{}`; add a loop/no-progress breaker; investigate why the same query sometimes needs 10 retrievals.

### 🟠 P1 — #2 QA-Chatbot end-to-end latency is high across the board
Median **21s**, p90 47s, p99 106s. Driven by **~2.8 sequential gpt-5 calls/turn @ ~7s each** (`ai.streamText.doStream`) plus `searchLangfuseDocs` at 5.4s median. TTFT is fast (0.69s), so it's total round-trips, not model warm-up.
- **Fix:** parallelize/limit retrieval rounds; consider a faster model for tool-routing steps; stream partial answers.

### 🟠 P1 — #3 "Language & style" evaluator is mis-wired (false signal)
**298/323 (92%)** score `0` — but the comments say *"there is no prior assistant message in the conversation history"*. The evaluator is looking at the wrong turn, **not measuring real style**. Currently a broken monitoring signal, not a 92% quality failure.
- **Fix:** correct the evaluator's input mapping (it needs the assistant response, not the system prompt) and re-baseline.

### 🟠 P1 — #4 Correctness ~31% below 0.6
`Correctness` (0–1, EVAL): median 0.72, mean 0.63, **53/169 below 0.6, 50 below 0.5 (some 0.0)**. A meaningful slice of answers is judged substantively wrong.
- **Fix:** run error analysis on the low-correctness slice (may overlap with #1).

### 🟡 P2 — #5 26% of chatbot inputs are off-topic
`user-intent` = `irrelevant-to-langfuse` on **85/323 (26%)** of QA turns (weather, World Cup, "发呆"). Handled gracefully in most cases, but off-topic/broad queries correlate with the #1 loops.
- **Fix:** early scope-guard to short-circuit off-topic queries — cuts cost and loop risk.

### 🟡 P2 — #6 `searchLangfuseDocs` returns HTTP 504s
9 errors / 292 calls (~3%), transient — most traces recovered and still answered. Dependency-reliability signal (inkeep-rag backend).

### 🟡 P2 — #7 livekit-voice-agent hung sessions
Single sessions at **6117s (102 min)**, 3349s, 1499s — catastrophic for real-time voice, though only 44 traces and possibly session-duration aggregates. **Verify** whether these are real hangs.

### 🔵 P3 — Hygiene / blind spots
- **No `version`/`release` on any trace (1,669/1,669 null)** → can't segment by deploy or detect regressions.
- **User feedback near-zero** — only **3** `user-feedback` scores (all positive, API) across thousands of traces.
- **Empty user inputs** produce empty traces with 0 processing.
- **Image-Generator / voice 100% empty trace-level output** — likely un-instrumented non-text output; verify capture.

---

## ✅ Verified non-issues (checked, clean)
- **Language matching** — non-English in → same-language out (Chinese verified). Clean.
- **`is_cursing`** 0/323, **`User disagreement`** 1/134 — no toxicity/frustration signal.
- **Retrieval content relevance** — inkeep-rag returns on-topic content; queries well-formed. No "same-docs-for-everything" failure.
- **Sentiment-Classifier** — fast (2.9s), cheap, 0 empties.
- **Per-trace cost** — modest ($0.033 mean QA); no cost explosions except the loop traces.

## Suggested order of action
1. Fix the agent step-limit fallback + loop breaker (#1) — stops silent empty answers.
2. Fix the "Language & style" evaluator mapping (#3) — you're flying blind on it now.
3. Error-analyze the low-Correctness slice (#4), likely overlapping #1.
4. Add `release`/`version` tags + collect user feedback (#8, #9) so regressions become visible.

## Open questions
- Are the voice-agent multi-thousand-second traces real hangs or session aggregates?
- Is Image-Generator/voice empty output expected (non-text) or a capture bug?
- What's the intended step budget for the QA agent?
