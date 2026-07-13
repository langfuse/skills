# Langfuse Issue-Detection Triage — Run #2

**Project:** `clkpwwm0m000gmm094odg11gi` · EU cloud (`https://cloud.langfuse.com`)
**Window:** `2026-07-01T16:57:43Z` → `2026-07-08T16:57:43Z` (last 7 days, UTC)
**Run date:** 2026-07-08 · Independent run (no coordination with other runs)

---

## Overall stats

### Method & scope
Pulled **all 2,072 traces** in the window, tallied by `environment` + `name`, then isolated real product traffic.

**Environments seen:** `langfuse-llm-as-a-judge` (1,565), `default` (337), `sdk-experiment` (170).

**Included — product traffic = `environment: default`, 336 traces** (excluded my own connectivity-test trace `claude-code-test-trace`):

| Product (name) | Traces | Cost $ | Cost mean | Lat p50 | p90 | p99 | max |
|---|--:|--:|--:|--:|--:|--:|--:|
| QA-Chatbot (Langfuse docs support bot) | 265 | 9.08 | 0.0343 | 20.5s | 40.8s | 103.3s | 156.1s |
| Image-Generator | 42 | 0.45 | 0.0107 | 12.9s | 17.2s | 20.1s | 20.8s |
| Sentiment-Classifier | 20 | 0.001 | 0.00007 | 3.1s | 4.3s | 6.1s | 6.4s |
| livekit-voice-agent | 9 | 0.010 | 0.0011 | 20.3s | 1376s | 5643s | 6117s |

**Excluded:** `langfuse-llm-as-a-judge` = 1,565 evaluator executions ("Execute evaluator: …"); `sdk-experiment` = 170 dataset/experiment runs (`experiment-item-run`); 1 connectivity-test trace of my own.

### Volume examined
- **336 product traces** (full I/O read for a large sample; every trace's core+metrics).
- **2,644 observations** on those traces (1,101 GENERATION, 1,031 SPAN, 487 TOOL, 25 AGENT) — full pull with core/basic/usage/model/metrics.
- **1,379 scores** pulled; **1,208** attached to product traces, aggregated per evaluator.
- **204 TOOL observations with I/O** across a 40-trace QA sample (all tool-heavy traces + a spread of lighter ones) for retrieval-content inspection.

### Headline metrics (product)
- Total cost **$9.54**; QA-Chatbot dominates at **$9.08** (95%).
- QA end-to-end latency p99 **103s**, max **156s** — slow for a support chatbot.
- Hard-error observations (`level=ERROR`): **5** (all HTTP 504 from the retrieval tool).
- **Silent empty answers:** 2/265 QA traces returned no answer to a valid question.
- **Score coverage:** QA-Chatbot 100% (every trace has ≥1 eval score); Image-Generator/Sentiment/Voice also carry scores. **User feedback: only 1** explicit feedback score across all 336 traces.
- Primary model: `gpt-5-2025-08-07` (QA); `gpt-image-1` (images); `gpt-4o-mini` (sentiment); voice uses `FallbackAdapter` + `gpt-4.1-mini`.

---

## Findings

| # | Issue | Category | Priority | Traces affected | Description | Root-cause hypothesis | Example traces | Proposed fix | Agent prompt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Silent doc-retrieval failures & tool loops | Retrieval | **P0** | ≥11/40 tool-using QA sampled (~27%); 2/265 end in empty answer | The QA bot's `getDocsPage(pathOrUrl)` tool repeatedly returns `"Error fetching docs page markdown: Failed to fetch …"` because the model **guesses doc URLs that 404** (e.g. it tried `/docs/metrics/monitors-and-alerts`, then `/docs/metrics/features/monitors-and-alerts`, then `/docs/metrics/features/monitors-alerts` in one trace). The Inkeep search backend also intermittently 504s (5 ERROR-level obs). These errors are buried in DEFAULT-level tool output (not surfaced as `level=ERROR`), so they're silent. The agent burns 6–10 tool calls looping over path variants; in the worst cases it exhausts its step budget and the **final generation returns `{}` → user gets a blank answer**. | The doc-fetch tool takes a free-form path and the LLM hallucinates plausible-but-wrong paths instead of resolving them from search results; no guardrail converts a fetch failure into a graceful fallback, and hitting max-steps yields empty output instead of a best-effort answer. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/1fb27ea7a8c14caec44a06e66a19c80d` (empty, incl. 504) · `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/736d251fa4b277633b2bedd9dc244887` (empty, 10 tools) | Make `getDocsPage` resolve/validate paths from search hits (or accept only URLs returned by the search tool); on fetch failure, fall back to the search snippet instead of retrying path variants; cap doc-fetch retries; and guarantee a final answer even when the step budget is hit (never emit empty content). Add a code eval flag when trace output is empty. | The QA docs chatbot (trace name `QA-Chatbot`, model gpt-5, Vercel AI SDK) sometimes returns an empty answer. In trace `736d251fa4b277633b2bedd9dc244887` and `1fb27ea7a8c14caec44a06e66a19c80d` the agent called the `getDocsPage` tool 8–10 times with guessed paths like `/docs/metrics/monitors-and-alerts` that returned `"Error fetching docs page markdown: Failed to fetch"`, hit the max-step limit, and produced a final generation with `content:""`. Fix: (1) only allow `getDocsPage` to fetch URLs that came back from the docs-search tool, never model-invented paths; (2) on a fetch error, fall back to the search result snippet rather than retrying path variants; (3) ensure the agent always emits a non-empty final answer even at the step cap. Look at the tool definition for the docs-page fetcher and the agent's max-steps handling. |
| 2 | "Language & style" evaluator is dead / mis-wired | Scores/Evals | **P1** | 241/265 QA scored 0 (91%) | The `Language & style` numeric evaluator returns **0 for 91% of QA traces**. Its own comments explain why: *"There is no prior assistant message in the conversation history to evaluate; only system instructions and the initial user question are present."* The evaluator is fed the input/system prompt but **not the assistant's response**, so it defaults to 0 every time. The language/style quality dimension is therefore effectively **unmeasured** — a green/low dashboard that means nothing. | The evaluator's variable mapping captures `input`/conversation history but omits the trace `output` (assistant message), so the judge sees no assistant turn to score. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/059732ae0fdc58a9aa352940137a8f83` (representative QA trace scored 0 for "no assistant message") | Fix the evaluator's variable mapping so the assistant's final response (trace `output`) is passed into the judge prompt as the message being evaluated; re-run over the window and re-baseline. | In the Langfuse project the `Language & style` LLM-as-a-judge evaluator scores 0 on 91% of `QA-Chatbot` traces, with comments saying "there is no prior assistant message in the conversation history to evaluate." The judge is only receiving the system prompt + user message, not the assistant's answer. Fix the evaluator configuration's variable mapping so the assistant/final `output` of the trace is injected as the response under evaluation, then verify the score distribution becomes discriminating (not constant 0). |
| 3 | Off-topic / irrelevant traffic is a large, growing share | Usage drift | **P1** | 69/265 QA (26%) intent = `irrelevant-to-langfuse`; +71 non-QA also labeled irrelevant | The `user-intent` classifier labels **26% of QA questions `irrelevant-to-langfuse`** (weather, world-cup scores, "how are you", "what do you know about me", non-English greetings). The bot mostly declines gracefully and redirects — good — but this is now the single largest non-conceptual intent, larger than implementation questions (46). No eval measures whether these are handled well; the quality evals still target Langfuse Q&A. | Public/unauthenticated exposure of the docs bot draws a lot of off-topic chatter; the eval set hasn't been updated to cover "graceful decline of off-topic," so quality on the biggest slice of odd traffic is unmeasured. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/1a3acadb…` (world-cup, declined) — see `user-intent=irrelevant-to-langfuse` traces | Add an eval case / evaluator for "correct graceful decline + redirect" on off-topic inputs; consider a lightweight up-front intent gate to skip retrieval on clearly off-topic messages (saves cost/latency — several irrelevant traces still ran full tool loops). | The `QA-Chatbot` receives ~26% off-topic messages (classified `irrelevant-to-langfuse`: weather, sports, greetings). It usually declines politely, but there's no evaluator confirming that and some off-topic messages still trigger expensive doc-retrieval loops. Add (a) an evaluator that checks off-topic inputs get a brief graceful decline + Langfuse redirect without hallucinating, and (b) an early intent check that short-circuits retrieval when the message is clearly not about Langfuse. |
| 4 | QA latency tail | Latency | **P2** | ~27/265 QA > 60s | QA-Chatbot p90 **40.8s**, p99 **103s**, max **156s**. Slowness tracks the number of tool calls (median 2, up to 10) and gpt-5 reasoning generations (per-gen p90 ~14s, and 2–3 generations per trace). A support chatbot answering in 40–100s is a friction risk. | gpt-5 reasoning latency × multiple sequential tool→generation rounds; retrieval loops (finding #1) add rounds and inflate the tail. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/241aa03fac…` (102.8s) · `a37bb42640…` (99.4s) | Reduce tool rounds (fix #1), consider a faster model for simple/off-topic intents, parallelize independent doc fetches, and stream partial answers. | The `QA-Chatbot` has p99 end-to-end latency of ~103s (max 156s), driven by sequential gpt-5 generations plus up to 10 doc-fetch tool rounds. Reduce round-trips: batch/parallelize doc fetches, cap retrieval loops, and route trivial/off-topic messages to a cheaper fast path so users aren't waiting 40–100s. |
| 5 | Token & cost inflation from context + loops | Cost | **P2** | gpt-5 input tokens p90 26.7k, **max 91.2k**; costliest trace $0.166 | A single gpt-5 generation reached **91,196 input tokens**; QA input tokens p90 = 26.7k. Fetched doc markdown is stuffed into context each round, and failed-fetch retries re-inject content. Cost is modest in absolute terms ($9.08 for 265 traces) but per-trace cost is dominated by a few token-heavy tool-loop traces. | Full doc-page markdown accumulates in the prompt across tool rounds without trimming; retrieval loops multiply the context. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/a37bb42640…` ($0.166) | Trim/summarize retrieved doc content before feeding to the model, drop failed-fetch error blobs from context, and cap total retrieved tokens per turn. | `QA-Chatbot` gpt-5 calls hit up to 91k input tokens because full doc-page markdown is concatenated into the prompt over multiple tool rounds (including failed-fetch error text). Add context trimming: summarize or truncate fetched docs, exclude tool-error outputs from the model context, and enforce a per-turn retrieved-token budget. |
| 6 | `user-intent` evaluator runs on non-QA products | Scores/Evals | **P2** | 71 non-QA traces mislabeled | The `user-intent` evaluator fires on **all** `default`-env traces, so Image-Generator (42), Sentiment-Classifier (20) and voice (9) traces are all labeled `irrelevant-to-langfuse` — inflating the "irrelevant" count (140 total → only 69 are real QA) and adding evaluator noise/cost. | Evaluator target filter is set to the environment, not to `name=QA-Chatbot`; it's scored against products it wasn't designed for. | (any Image-Generator trace carries a `user-intent=irrelevant-to-langfuse` score) | Scope the `user-intent` evaluator's target filter to `name = QA-Chatbot` (or the QA tag) so it doesn't run on image/sentiment/voice traces. | The `user-intent` LLM-judge evaluator is running on every `default`-environment trace, including `Image-Generator`, `Sentiment-Classifier`, and `livekit-voice-agent`, which it labels `irrelevant-to-langfuse`. Restrict the evaluator's target/filter to the `QA-Chatbot` traces only so metrics and cost aren't polluted by products it wasn't built to score. |
| 7 | Bot misreports its own model | Output quality | **P3** | ≥1 observed | Asked "which model do you use?" (TR), the bot answered *"I'm a GPT-4o-based assistant"* — but the traces run on `gpt-5-2025-08-07`. Minor self-knowledge inaccuracy that could mislead users. | System prompt hard-codes an outdated model name, or the model confabulates its identity. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/` (out_of_scope=True TR "hangi modeli kullanıyorsun?") | Either instruct the bot not to disclose the backing model, or update the system prompt to the correct/intended name. | The `QA-Chatbot` tells users it is "GPT-4o based" but actually runs on gpt-5-2025-08-07. Update the system prompt so it either declines to reveal its model or states the correct one. |
| 8 | Voice agent: fallback adapter + extreme latency + no I/O | Reliability/Coverage | **P3** | 9/9 voice traces | Every `livekit-voice-agent` trace uses `FallbackAdapter` (not the primary model), has **null input and output** at trace level, and shows wild trace latency (one 6,117s ≈ 102 min, one 191s). Likely session-duration artifacts + audio not captured, but the universal fallback + zero I/O visibility means the voice path is essentially un-monitored. | Voice pipeline is routing through a fallback adapter (primary provider failing?), and audio I/O isn't instrumented into Langfuse traces. | `https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/868a86e11b…` (6117s) | Confirm whether `FallbackAdapter` firing on 100% of sessions is expected; instrument voice transcripts (STT/TTS text) into trace I/O; verify latency reflects response time, not session length. | The `livekit-voice-agent` traces all use `FallbackAdapter` and have null input/output and latencies up to 6117s. Investigate whether the primary voice model is failing over on every call, add STT/TTS transcript capture to the traces, and confirm the latency metric isn't just session duration. Only 9 traces — low volume, verify before deep work. |

---

## Verified non-issues (checked, clean)

- **Hard error rate:** only 5 ERROR-level observations, all HTTP 504 from the retrieval backend (covered in #1). No stack traces, exceptions, or crash loops elsewhere.
- **Truncation:** no `finish_reason: length` / max_tokens truncation observed; gpt-5 output tokens p90 ~664, well under limits.
- **Image-Generator output:** the ~38 null trace-level outputs are an **instrumentation artifact** — the generation observation carries the real image (`@@@langfuseMedia:type=image/png…@@@`). Images are produced; only the trace-level `output` isn't propagated. (Coverage note below.)
- **Profanity (`is_cursing`):** 265/265 `False` — constant, but plausibly legitimate (spot-checked inputs are civil). Low risk; flagged only as a dead-evaluator candidate to sanity-check with a known-positive.
- **User disagreement/frustration:** 1/111 `True` — low; conversations sampled read as cooperative.
- **Off-topic handling:** sampled `out_of_scope=True` traces (world cup, weather, current time) — the bot **declines gracefully and redirects to Langfuse**. Good behavior (the concern is the *volume*, #3, not the handling).
- **Malformed/adversarial inputs:** garbage inputs ("as", "hgi", "发呆") handled with a safe clarify-and-redirect; no crashes or hijacks.
- **Language matching (behavioral):** bot replies in the user's language (Chinese, Spanish, Turkish, Korean seen) — no obvious language mismatch, despite finding #2's broken evaluator.

---

## Suggested order of action

1. **#1 Retrieval failures / empty answers (P0)** — highest user impact and silent; fix path-resolution + guarantee non-empty final answers.
2. **#2 Fix the "Language & style" evaluator (P1)** — you are currently flying blind on a whole quality dimension; cheap config fix.
3. **#3 Off-topic handling + eval coverage (P1)** — largest odd-traffic slice is unmeasured; add decline eval + intent gate (also helps #4/#5).
4. **#6 Re-scope `user-intent` evaluator (P2)** — quick filter fix that de-noises all intent metrics.
5. **#4/#5 Latency & token trimming (P2)** — largely fall out of fixing #1.
6. **#7/#8 (P3)** — model self-report and voice instrumentation, lower priority.

## Open questions

- Is the QA bot deliberately public/unauthenticated? That would explain the 26% off-topic rate and informs whether to add rate-limiting or an intent gate.
- Is `FallbackAdapter` on 100% of voice sessions expected, or is the primary voice provider down?
- Are the Inkeep 504s transient (5 in 7 days) or a recurring capacity issue with the docs backend?
- What is the intended latency SLA for the support bot? (Determines whether p99=103s is acceptable.)

## Not covered / limitations

- **No `version`/`release` tags** on any product trace (all null), so **segmentation by release was impossible** — a regression tied to a specific deploy could not be detected. Recommend adding `release`/`version` to traces.
- **Retrieval-error prevalence (#1) is from a 40-trace sample** (all tool-heavy + a spread), not all 265 QA traces — the 27% figure is a reasonable estimate, not an exact census. The `--type TOOL` bulk cursor pull hung repeatedly (known CLI gotcha), so I sampled per-trace instead.
- **Faithfulness / hallucination** was not rigorously evaluated — no ground-truth answer set; I read transcripts for plausibility only. The broken `Language & style` evaluator means one quality dimension has no trustworthy signal at all.
- **Observation pull** covered all 336 product traces (2,644 obs) but the bulk cursor loop timed out mid-run; coverage was confirmed complete by trace-id count, not by exhausting the cursor.
- Voice-agent latency figures may reflect session duration rather than response latency; treated as P3 pending confirmation.
