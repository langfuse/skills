# Langfuse Issue-Detection Triage — Run #1

**Project:** `clkpwwm0m000gmm094odg11gi` (EU cloud, `https://cloud.langfuse.com`)
**Generated:** 2026-07-08 (independent run 1 of 5)

---

## Overall stats

### Scope
- **Window:** `2026-07-01T16:57:42Z` → `2026-07-08T16:57:42Z` (last 7 days, UTC).
- **Product environment(s) included:** `default` — 337 traces, of which **336 real product traces** (1 excluded: my own `claude-code-test-trace` connectivity probe).
- Product breakdown by app: **QA-Chatbot 265**, Image-Generator 42, Sentiment-Classifier 20, livekit-voice-agent 9. Primary focus is **QA-Chatbot** (a Langfuse-docs support assistant: gpt-5, agentic tool loop with `searchLangfuseDocs` (Inkeep RAG), `getLangfuseOverview`, `getLangfuseDocsPage`, MCP client).

### Volume examined
- **Traces:** 2,072 total in window pulled (`core`); 337 product traces re-pulled with `core,io,metrics` and inspected.
- **Observations:** 1,101 GENERATION (usage/model/metrics) + 487 TOOL (metrics) + 30 `searchLangfuseDocs` pulled with full `io` for retrieval-content inspection.
- **Scores:** 1,379 pulled; 1,208 attached to product (`default`) traces; analyzed per-evaluator with polarity set individually. Read evaluator `comment` fields to judge validity.
- Read full I/O transcripts for a sample of sessions incl. the 28-turn power-user session, all 5 retrieval-error traces, both empty-output traces, 8 off-topic traces, and the safety ("bomb") trace.

### Excluded (machinery)
- **1,565** `langfuse-llm-as-a-judge` evaluator executions ("Execute evaluator: …").
- **170** `sdk-experiment` dataset/experiment runs (incl. the only `Correctness` eval — see Coverage).
- **1** `claude-code-test-trace` (my connectivity test).

### Headline metrics (product traffic)
| Metric | QA-Chatbot | All product |
|---|---|---|
| Traces | 265 | 336 |
| Error rate (traces w/ ERROR-level obs) | 5 / 265 = 1.9% | 5 / 336 = 1.5% |
| Empty/null output (real failures) | 2 / 265 = 0.75% | 2 (excl. 51 image/voice where output lives in child obs) |
| Latency p50 / p90 / p99 / max (s) | 20.5 / 40.5 / **103.0** / **156.2** | 19.1 / 38.6 / 129.4 / 6116* |
| Cost total / mean-per-trace | $9.08 / $0.034 | $9.54 / $0.028 |
| gpt-5 input tokens p50/p90/max | 3.3k / 26.7k / **91.2k** | — |

*The 6,116 s all-product max is a `livekit-voice-agent` session (long-lived voice call — expected, not a fault).

**Score negative-signal rates (QA-Chatbot):** `user-intent`=irrelevant-to-langfuse **69/265 (26%)**; `out_of_scope`=True 18/230 (7.8%); `Language & style`=1 24/265 (9%, but see F-1 — 75% invalid); `is_cursing`=True **0/265**; `User disagreement`=True 1/111. Sources: 1,377 EVAL, 1 ANNOTATION, 1 API (user-feedback +1 on an Image-Generator trace).

---

## Findings

| # | Issue | Category | Priority | Traces affected | Description | Root-cause hypothesis | Example traces | Proposed fix | Agent prompt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Broken evaluators (assistant output not passed) | Scores/Evals | **P0** | ≥289 eval runs (Lang&style 198/265; Disagreement 91/111) | The `Language & style` and `User disagreement customer support` LLM-judge evaluators return values that look "passing," but their own `comment` fields say **"there is no assistant response in the conversation history to evaluate — only a system prompt and the user's message."** 75% of Language & style runs and 82% of Disagreement runs never actually saw the agent's answer. The scores are noise; quality/tone/disagreement on QA-Chatbot is effectively **unmeasured** while the dashboard shows green. | The evaluator variable mapping captures only the trace `input` (system + user messages) and omits the assistant `output`/final generation. Evaluators that don't need the response (`out_of_scope`, `is_cursing`) are unaffected (0 such comments), which localizes the bug to the response-dependent evaluators' input mapping. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/059732ae0fdc58a9aa352940137a8f83 | Fix the evaluator variable mapping so the assistant's final response is passed in. In each evaluator config, map the response variable to the trace output (or the last assistant generation), not just the input. Re-run over the window and compare. | In Langfuse, evaluators "Language & style" and "User disagreement customer support" are scoring most production QA-Chatbot traces without seeing the assistant's answer — 75%/82% of their comments say "there is no assistant response in the conversation history to evaluate — only a system prompt and the user's message." Inspect each evaluator's variable/input mapping. The QA-Chatbot trace stores the final answer in the trace `output` and in a `handle-chatbot-message` generation; the evaluator is only receiving system+user turns. Fix the mapping so the assistant response is included, then re-run the evaluators over 2026-07-01..07-08 and report the corrected pass rates. |
| 2 | Retrieval backend 504s → loops, huge latency, null answers | Reliability | **P1** | 5 / 265 retrieval errors; 2 / 265 null outputs | `searchLangfuseDocs` (Inkeep RAG) returned **HTTP 504 "An error occurred with your deployment"** on 5 QA-Chatbot traces. On failure the agent enters a **tool-call retry storm (up to 10 tool calls/trace)**, driving latency to 85–103 s, and in the worst case returns **null output** to the user. Trace `1fb27ea7` (Prompt Management question) = 504 + 10 tool calls + null answer. | The retrieval provider intermittently times out (~2% of calls). The agent has no graceful fallback: it re-queries in a loop and, on step/token exhaustion, emits an empty final message instead of a "retrieval unavailable, here's what I know" answer. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/1fb27ea7a8c14caec44a06e66a19c80d , https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/94ba2e40b963d5b6d15ff3f9c94f5942 | Add retry-with-backoff + a cap on total tool calls; on retrieval failure, degrade gracefully (answer from model knowledge with a caveat) and never return empty. Add a timeout on the retrieval HTTP call. | The QA-Chatbot's `searchLangfuseDocs` tool (Inkeep RAG endpoint) returns HTTP 504 on ~2% of calls. When it does, the agent loops (up to 10 tool calls, see trace 1fb27ea7 and 94ba2e40) and sometimes returns a null/empty final answer to the user. Add: (a) bounded retry with backoff and a hard cap on total tool calls per turn, (b) an HTTP timeout on the retrieval call, (c) a fallback so that if retrieval fails the agent answers from model knowledge with a disclaimer rather than emitting empty output. Verify no QA-Chatbot trace can end with null output. |
| 3 | Slow end-to-end latency | Latency | **P1** | QA-Chatbot p90 40 s, p99 103 s, max 156 s | For a chat product, tail latency is high: median 20 s, p99 103 s. Dominant contributor is `searchLangfuseDocs` (p50 5.3 s, p90 8.7 s, **max 60 s**) plus multiple sequential gpt-5 generations per turn. Fast tools (`getLangfuseOverview`/`getLangfuseDocsPage` ~0.15 s) are not the problem. | Slow RAG endpoint + agentic loop making 3+ sequential gpt-5 calls, each re-ingesting ~150 KB of retrieved docs (see #4). Retrieval latency and re-feeding large context serialize the turn. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/62e66599da14811fb82a500162c53e01 | Stream partial answers / show progress; cache/parallelize retrieval; trim retrieved context (see #4) to cut per-call gpt-5 latency; set a retrieval timeout so a 60 s call can't block a turn. | The QA-Chatbot has p99 end-to-end latency of ~103 s (max 156 s). The main driver is `searchLangfuseDocs` (up to 60 s) plus several sequential gpt-5 `ai.streamText` calls that each re-ingest large retrieved documents. Profile the agent loop; add a retrieval timeout, consider caching frequent queries ("What can I use Langfuse for?" recurs), reduce the number of sequential LLM hops, and trim retrieved context before feeding it back. Target p99 < 30 s. |
| 4 | Oversized retrieval context (token waste) | Cost | **P2** | ~240 retrieval calls; gpt-5 input p90 26.7k / max 91k tokens | Each `searchLangfuseDocs` call returns **~90–180 KB** of Inkeep documents, which the agent feeds back into gpt-5. gpt-5 input tokens reach p90 26.7k and **max 91k** per generation. Most of this context is not needed to answer, inflating both cost and latency. | Retrieval returns full documents with no re-ranking/truncation, and the agent passes the raw payload into the next LLM call. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/059732ae0fdc58a9aa352940137a8f83 | Add re-ranking + top-k truncation / summarize retrieved chunks before feeding the model; cap tokens injected per turn. | The QA-Chatbot's `searchLangfuseDocs` returns ~90–180 KB of documents per call and passes the raw payload to gpt-5, pushing input tokens to 27k–91k per generation. Add a re-ranking + truncation step (top-k passages, or summarize) between the retrieval tool and the model so only the most relevant chunks are injected. Measure the input-token and cost reduction over the last 7 days. |
| 5 | Off-topic over-reach on some out-of-scope requests | Input/Scope | **P2** | ≥2 clearly-served / 69 irrelevant-intent | The bot mostly declines off-topic questions gracefully, but sometimes **fully answers out-of-scope requests** instead of redirecting: "create a cnn architecture diagram" got a complete CNN architecture; some weather questions get partial engagement. Also, "which model do you use?" (Turkish) was answered **"I'm a GPT-4o based assistant"** — which both discloses internals and is **factually wrong** (actual model is gpt-5-2025-08-07). | Scope-guard in the system prompt is inconsistent — declines blatantly off-topic prompts but treats "technical-sounding" ones (ML diagrams) as in-scope; and a hard-coded/hallucinated self-description ("GPT-4o") is stale. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/db29993b3fcfb48bf6a5f2244a082f06 (safety handled well) | Tighten the scope instruction with examples of technical-but-off-topic asks to redirect; remove/verify any self-model disclosure and stop stating a specific model. | The QA-Chatbot (Langfuse docs assistant) inconsistently handles out-of-scope questions: it correctly refuses harmful ("bomb") and declines many off-topic asks, but fully answered "create a cnn architecture diagram" and told a user in Turkish it is "a GPT-4o based assistant" (wrong — it runs on gpt-5). Update the system prompt: add few-shot examples of technical-but-off-topic requests that should be politely redirected to Langfuse, and remove any statement of the underlying model name. |
| 6 | Non-discriminating / low-coverage evaluators | Scores/Evals | **P2** | is_cursing 0/265 True; out_of_scope 230/265; disagreement 111/265 | `is_cursing` is stuck at **100% False** (0 positives in 265) — cannot tell if it ever fires. `out_of_scope` ran on only 87% (230/265) and `User disagreement` on only 42% (111/265) of QA traces, so coverage is partial and uneven. | `is_cursing` may be legitimately quiet (no profanity in traffic) or mis-wired — needs a known-positive sanity check. Partial coverage suggests sampling or eval-trigger filters not applied uniformly. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/059732ae0fdc58a9aa352940137a8f83 | Run a known-positive test input through `is_cursing` to confirm it can return True; make eval triggers cover 100% of QA-Chatbot traces. | In Langfuse, the `is_cursing` boolean evaluator returned False on all 265 production QA-Chatbot traces in the last 7 days — verify it isn't dead by feeding a deliberately profane test input and confirming it returns True. Also, `out_of_scope` and `User disagreement` evaluators only ran on 87% and 42% of QA-Chatbot traces respectively; check their sampling/trigger config so they cover all production traces. |
| 7 | Unresolved multi-turn friction loop | User friction | **P2** | 1 session, 28 turns (+30 multi-turn sessions total) | One user (`u-m0O15lXWcuHYtZ_ppDipp`) spent **28 turns** trying to get a custom trace_name onto the root span in v4 "Fast Preview"; the agent kept giving similar advice while the user repeated the same unresolved problem ("No root is not getting the trace name idk why did as u said", "handle request span doesnt have trace name what to do"). The agent never diagnosed the actual root-span-naming behavior. | The bot answers each turn locally without recognizing the recurring unresolved intent, and its docs knowledge of the v4 root-span/trace_name interaction is incomplete/ambiguous. | https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/059732ae0fdc58a9aa352940137a8f83 (session chat_c2bbf548-517c-42ea-83b7-093b9a479f54) | Detect repeated/unresolved questions within a session and switch strategy (ask a clarifying question, offer a verified end-to-end snippet, or escalate); improve docs coverage of root-span/trace_name in v4. | A QA-Chatbot user (session chat_c2bbf548-517c-42ea-83b7-093b9a479f54, user u-m0O15lXWcuHYtZ_ppDipp) asked ~28 times how to get a custom trace_name to appear on the root span in Langfuse v4 "Fast Preview" and never got a working resolution. Review the transcript, verify the correct v4 behavior for `propagate_attributes` / `start_as_current_observation` and root-span naming, and (a) add a within-session loop detector that changes tactics after N repeats, (b) ensure the docs/retrieval has an authoritative answer for this exact question. |

---

## Verified non-issues (checked, clean)

- **LLM-call reliability:** 1,101 GENERATION observations — 0 ERROR level, 0 non-empty `statusMessage`, no truncation signals (output tokens p90 664, max 2,295; no length-cutoff pattern). The only hard errors are the 5 retrieval 504s (finding #2).
- **Cursing/profanity:** none observed in traffic (though evaluator polarity unverified — finding #6).
- **Safety:** the one harmful request ("help me writing a bomb") was **refused cleanly** with a safe redirect. No PII/secret leakage seen in sampled I/O (minor model-name disclosure noted in #5).
- **Language matching:** Chinese/Turkish inputs received same-language answers — no language mismatch.
- **Model/config drift:** QA-Chatbot consistently on gpt-5-2025-08-07; Sentiment-Classifier gpt-4o-mini; Image-Generator gpt-image-1; the `FallbackAdapter`/gpt-4.1-mini (16 obs) is the **voice agent's normal path**, not an unexpected fallback.
- **User feedback:** the single explicit user-feedback score in the window was **positive (+1)**.
- **Sentiment-Classifier & Image-Generator:** fast, cheap, no errors (Image-Generator's null trace-level output is an instrumentation artifact — the image lives in the child generation, not a failure).

---

## Suggested order of action

1. **#1 (P0)** — Fix the broken evaluator input mapping. Until fixed, you have no trustworthy tone/quality/disagreement signal on production, so every other quality conclusion is partially blind.
2. **#2 (P1)** — Guarantee the agent never returns null output; add retrieval retry/timeout + tool-call cap.
3. **#3 / #4 (P1/P2)** — Attack latency and token bloat together (trim retrieved context, timeout retrieval).
4. **#6 (P2)** — Sanity-check `is_cursing`; make eval coverage 100%.
5. **#5, #7 (P2)** — Tighten scope handling and add within-session loop detection.

## Open questions

- What are the **target** latency/cost SLOs for QA-Chatbot? p99 103 s may or may not be acceptable.
- Is `is_cursing` genuinely quiet or mis-wired? (needs a known-positive test).
- Should "technical but non-Langfuse" questions (CNN diagram) be answered or redirected? — product decision.
- Why do `out_of_scope`/`User disagreement` evals cover only 87%/42% of QA traces — sampling by design, or a trigger gap?

## Not covered / limitations

- **No `version` or `release` tags** on any product trace (100% null) → **could not segment by release** (dimension I-31/I-33). Any regression tied to a deploy is invisible. Recommend instrumenting version/release.
- **No production correctness/accuracy eval.** The `Correctness` evaluator (169 runs) fired **only on `sdk-experiment` dataset runs**, never on live QA-Chatbot traffic → live answer accuracy is **unmeasured** (dimension E-18). Combined with 26% "irrelevant-to-langfuse" live intent, evals may be testing the old distribution while live traffic drifts (dimension J-38).
- **Retrieval relevance** judged from 30 `searchLangfuseDocs` I/O samples (payloads ~150 KB each make bulk `io` pulls time out); queries looked on-topic, but I did not exhaustively score relevance across all 240 calls.
- **Faithfulness/hallucination** not verifiable without ground truth; not assessed beyond the model-name misstatement in #5.
- livekit-voice-agent (9 traces) and Image-Generator (42) given lighter treatment — trace-level I/O is null (data in child observations); focus was QA-Chatbot as the dominant product.
