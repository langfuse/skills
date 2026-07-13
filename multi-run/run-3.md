# Langfuse Issue-Detection Triage — Run #3

**Project:** `clkpwwm0m000gmm094odg11gi` (EU cloud, https://cloud.langfuse.com)
**Generated:** 2026-07-08 (UTC)
**Analyst:** independent full triage run (run 3 of 5)

---

## Overall stats

### Method & scope
- **Window analyzed:** `2026-07-01T16:57:43Z` → `2026-07-08T16:57:43Z` (last 7 days, UTC).
- **Product environment(s) included:** `default` only. Within it, four apps: **QA-Chatbot** (265), **Image-Generator** (42), **Sentiment-Classifier** (20), **livekit-voice-agent** (9). One self-generated connectivity-test trace excluded → **336 product traces**.
- **Excluded (machinery):**
  - `langfuse-llm-as-a-judge` — **1,565** evaluator executions (`Execute evaluator: …`).
  - `sdk-experiment` — **170** dataset/experiment runs (`experiment-item-run`).
  - 1 `claude-code-test-trace` (my own connectivity check).
  - Total pulled across all environments: 2,072 traces.

### Volume examined
- **Traces:** 2,072 pulled (core+metrics); 336 product traces analyzed in depth (all 265 QA-Chatbot conversations pulled with `io`).
- **Observations:** 2,644 for `default` env (core/basic/usage/model/metrics); 487 TOOL observations pulled with `io` for retrieval-content inspection.
- **Scores:** 1,379 pulled; **1,208 attached to product traces** (1,207 EVAL + 1 API).

### Headline metrics (product traffic, `default`)

| Metric | Value |
|---|---|
| Total product traces | 336 |
| Hard trace failures (empty/null final output) | 2 (0.6%) |
| Tool errors — searchLangfuseDocs HTTP 504 | 21 / 240 calls (8.75%); only 5 logged at ERROR level |
| End-to-end latency (all) | p50 19.2s · p90 38.6s · p99 143.5s · **max 6,116.7s** |
| End-to-end latency (QA-Chatbot) | p50 20.5s · p90 40.8s · max 156.2s |
| Total cost | **$9.54** (QA-Chatbot $9.08 = 95%) |
| Mean / max trace cost | $0.028 / $0.166 |
| % product traces with any quality score | 265/336 = 79% (all non-QA apps unscored) |
| user-feedback scores captured | **1** in 7 days |

### Score inventory & polarity (product traces)

| Score | Type | Source | n | Negative signal | Distribution |
|---|---|---|---|---|---|
| user-intent | categorical | EVAL | 336 | (classifier, not pass/fail) | 140 irrelevant-to-langfuse, 130 conceptual, 46 impl, 8 ui, 7 pricing, 5 self-host |
| Language & style | numeric | EVAL | 265 | 0 (but see F/E findings — degenerate) | 241× `0`, 24× `1` |
| is_cursing | boolean | EVAL | 265 | True | **265× False (100%)** |
| out_of_scope | boolean | EVAL | 230 | True | 212 False, 18 True |
| User disagreement customer support | boolean | EVAL | 111 | True | 110 False, 1 True |
| user-feedback | numeric | API | 1 | low | 1× `1` |

---

## Findings

| # | Issue | Category | Priority | Traces affected | Description | Root-cause hypothesis | Example traces | Proposed fix | Agent prompt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Non-functional "Language & style" evaluator | Scores/Evals | **P1** | ≥196 / 265 QA | The `Language & style` judge scored all 265 QA traces, but **74–82% of its own comments say "there is no prior assistant message… only a system prompt and the user's message"** — i.e. it never received the assistant's answer. Both the `0` and `1` values carry this admission, so the whole score is noise. QA quality on language/style is effectively **unmonitored** while the dashboard shows a green-looking 91% `0`. | Evaluator variable mapping captures only the trace input (system + user message) and not the trace **output** (assistant response). Classic eval-wiring bug: the judge is asked to grade a response it can't see. | `059732ae0fdc58a9aa352940137a8f83`, `b10025a73d7d3e8fad71f442f18872c3` → https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/059732ae0fdc58a9aa352940137a8f83 | Fix the evaluator's input mapping so the assistant response (trace `output` / last assistant turn) is passed into the judge prompt. Re-run on a backfill window and confirm the "no assistant message" comments disappear. | The Langfuse evaluator "Language & style" is producing garbage: ~80% of its reasoning comments say "there is no prior assistant message in the conversation history — only a system prompt and the user's message," so it is grading nothing. See trace 059732ae0fdc58a9aa352940137a8f83. Root cause is almost certainly that the evaluator's variable/input mapping only feeds it the trace input (system+user) and omits the assistant response (trace output / final assistant turn). Fix the evaluator config so the assistant's actual reply is injected into the judge prompt, then backfill-run it and verify the degenerate "no assistant message" comments are gone. |
| 2 | Three of four products have zero quality monitoring | Coverage | **P1** | 71 / 336 | **Image-Generator (42), Sentiment-Classifier (20), livekit-voice-agent (9)** carry no quality/eval score at all — only `user-intent`, which (being Langfuse-QA-specific) mislabels **100% of them "irrelevant-to-langfuse."** Additionally, QA-Chatbot has **no production Correctness score** — the `Correctness` evaluator only runs on `sdk-experiment` dataset runs (169), never on live traffic. So there is no live faithfulness/correctness signal anywhere. | Evaluators were configured for QA-Chatbot only; the other apps and live correctness were never wired. `user-intent` was scoped to Langfuse-QA intents and left running against unrelated apps, producing meaningless labels. | Image: `…/traces/` (all 42 unscored); voice: `868a86e11bbc22a10e50885a2c040e0c` | Add product-appropriate evaluators: image quality/prompt-adherence for Image-Generator, label-accuracy/confidence sanity for Sentiment-Classifier, transcript-quality for voice. Restrict `user-intent` to QA-Chatbot only. Enable a live (sampled) Correctness eval on QA-Chatbot production traces, not just experiments. | In Langfuse project clkpwwm0m000gmm094odg11gi, three production apps (Image-Generator, Sentiment-Classifier, livekit-voice-agent) have no quality evaluators, and the QA-Chatbot's Correctness evaluator only runs on dataset experiments, not live traffic. Also the user-intent evaluator is scoped to Langfuse-QA intents but runs against all apps, labeling every image/sentiment/voice trace "irrelevant-to-langfuse." Restrict user-intent to QA-Chatbot (trace name filter), add per-app evaluators, and enable a sampled live Correctness eval on QA-Chatbot production traces. |
| 3 | Silent retrieval-backend 504 failures | Retrieval / Reliability | **P2** | 21 / 265 QA | **21 of 240 `searchLangfuseDocs` calls (8.75%)** returned `HTTP 504 "An error occurred with your deployment"` from the inkeep-rag backend. Only **5** were logged at `level=ERROR`; the other 16 came back at `level=DEFAULT` with the 504 embedded in the tool output body → silent. The agent recovered (non-empty answer) in all 21 by falling back to `getLangfuseOverview`/`getLangfuseDocsPage`, but those answers are grounded on less/no retrieved context (faithfulness risk). | The docs-search vendor endpoint (inkeep) intermittently times out; the tool wrapper swallows the 504 into the normal output payload instead of raising, so observability under-reports it. | `1cc9bb8ff85dfdc628193b99ae150cfc`, `7642f253f8a5493318a7d92c5b6c1f76` → https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/7642f253f8a5493318a7d92c5b6c1f76 | Add retry-with-backoff on 504 for `searchLangfuseDocs`; set observation `level=ERROR` when the backend returns non-2xx so it surfaces in monitoring; consider a secondary retrieval provider for failover. | The searchLangfuseDocs tool (inkeep-rag backend) returns HTTP 504 on ~9% of calls (21/240) in project clkpwwm0m000gmm094odg11gi; example trace 7642f253f8a5493318a7d92c5b6c1f76. Most are logged at DEFAULT level with the 504 buried in the tool output, so monitoring under-counts them. In the tool wrapper: detect non-2xx from the retrieval endpoint, set the Langfuse observation level to ERROR with a statusMessage, add retry-with-backoff, and fall back gracefully. |
| 4 | Users occasionally get an empty answer | Reliability | **P2** | 2 / 265 QA | Two QA-Chatbot traces produced **`null` final output** — the user got nothing back. One (`1fb27ea7…`) coincides with a `searchLangfuseDocs` 504 (ties to finding #3); the other (`736d251f…`, "What can I use Langfuse for?") had no obvious error, so a step failed silently. | Downstream failure (retrieval 504 or generation error) not caught, leaving the response pipeline to emit null instead of a fallback message. | `1fb27ea7a8c14caec44a06e66a19c80d`, `736d251fa4b277633b2bedd9dc244887` → https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/736d251fa4b277633b2bedd9dc244887 | Guarantee a user-facing fallback string whenever the generation/tool chain fails; add an alert on null trace output. | Two QA-Chatbot traces in Langfuse (1fb27ea7a8c14caec44a06e66a19c80d and 736d251fa4b277633b2bedd9dc244887) returned null final output — the user saw nothing. One overlaps a retrieval 504. Add a guaranteed fallback message when any step in the chatbot pipeline fails/returns null, and instrument an error-level observation so these are alertable. |
| 5 | Off-topic traffic + evaluator disagreement | Usage drift / Scores | **P2** | 69 / 265 QA | **26% of QA-Chatbot traffic (69/265) is classified `irrelevant-to-langfuse`** (World Cup scores, weather, etc.). The bot handles them gracefully (declines + redirects to Langfuse), so no user-facing bug — but the `out_of_scope` evaluator flags only 18 True total and **52 of the 69 irrelevant questions are NOT flagged out_of_scope.** The two evaluators disagree, so off-scope monitoring is unreliable and a quarter of spend/latency goes to non-product questions. | `user-intent` and `out_of_scope` use different definitions/thresholds; `out_of_scope` is under-triggering. Real usage includes a large off-domain tail no one is tracking. | `1a3acadb8baaa089be8daa5eae99d537` (World Cup) → https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/1a3acadb8baaa089be8daa5eae99d537 | Reconcile the two evaluators (or drop one); decide product policy for off-topic (redirect vs. short refusal to save cost); add a dashboard on the irrelevant-to-langfuse share over time. | In Langfuse, the QA-Chatbot's user-intent evaluator labels 26% of traffic "irrelevant-to-langfuse," but the out_of_scope evaluator only flags 18 of those and misses 52. Align the two evaluators on one off-scope definition, and decide whether off-topic questions should get a brief redirect (cheaper) rather than a full helpful answer. Example trace 1a3acadb8baaa089be8daa5eae99d537 (World Cup question). |
| 6 | Voice-agent reliability & instrumentation | Reliability / Latency | **P2** | 9 / 9 voice | The livekit-voice-agent (9 traces) shows: **one 6,116s (1.7h) `agent_session` span** and a 191s session; the primary LLM adapter **fell back to `FallbackAdapter` 16 times**; and **all 9 traces have null trace-level input/output** and no quality scores. Low volume, but every dimension is red. | Voice sessions aren't being closed/ended cleanly (runaway span duration); primary model provider failing over to a fallback; instrumentation doesn't capture transcript I/O at trace level. | `868a86e11bbc22a10e50885a2c040e0c` (6116s), `e8395fe8e95d774939e04db9fcc1c784` (191s) → https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/868a86e11bbc22a10e50885a2c040e0c | Ensure sessions end/flush deterministically (cap span duration); investigate why the primary voice model fails over; capture transcript input/output on the trace; add a voice-quality eval. | The livekit-voice-agent in Langfuse has a 6,116-second (1.7h) agent_session span (trace 868a86e11bbc22a10e50885a2c040e0c), fell back to FallbackAdapter 16 times, and logs no trace-level input/output. Investigate why sessions don't close (runaway span), why the primary model fails over to fallback, and instrument transcript I/O so the traces are reviewable. |
| 7 | Multi-turn friction on setup questions | User friction | **P3** | ≥1 session (28 turns) | One session (`chat_c2bbf548…`, 28 turns over ~50 min) shows a user repeatedly re-asking about tracing setup ("Give full code", "How to go to traces table", "Say me steps in ui"). Overall friction is low (5/265 turns contain re-ask phrases; 166/196 sessions are single-turn), but this one long session indicates first answers underspecified for hands-on setup. | Answers give doc links rather than the exact copy-paste code/steps the user wanted; user with limited English struggles to extract the answer. | session `chat_c2bbf548-517c-42ea-83b7-093b9a479f54`, trace `c572196c24ef4e405b05ff757a526c0b` → https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi/traces/c572196c24ef4e405b05ff757a526c0b | For implementation-question intent, front-load a complete runnable code block before doc links; detect repeated follow-ups in a session and offer a step-by-step walkthrough. | In Langfuse, QA-Chatbot session chat_c2bbf548-517c-42ea-83b7-093b9a479f54 ran 28 turns as a user struggled to get working tracing-setup code. For implementation-question intent, lead with a complete copy-paste code block (not just doc links), and consider detecting repeated in-session follow-ups to switch into a guided walkthrough. |
| 8 | Dead / non-discriminating evaluators | Scores/Evals | **P3** | 376 evals | `is_cursing` = **100% False (265/265)** and `User disagreement customer support` = **110/111 False**. Could be legitimately quiet (polite users) or mis-wired so they never fire True. Cannot be trusted as live guards until a known-positive check confirms they can return True. | Constant-output evaluators — either the data genuinely never triggers them, or the prompt/threshold never yields the positive class. | (constant across all QA traces) | Run a known-positive sanity check (feed a cursing / clearly-disagreeing message) and confirm each returns True; otherwise fix the prompt/mapping. | In Langfuse project clkpwwm0m000gmm094odg11gi, the is_cursing evaluator returns False on 100% of 265 traces and "User disagreement customer support" returns False on 110/111. Verify they can fire True by running each against a deliberately cursing / disagreeing input; if they can't, the prompt or input mapping is broken. |
| 9 | Missing version/release/prompt metadata | Coverage | **P3** | 336 / 336 | **No product trace carries `version`, `release`, `promptName`, or `promptVersion`** (all null across 336 traces / 1,101 generations). Regression analysis by deploy or prompt version is impossible — a bad release or prompt change would be invisible. | Instrumentation doesn't set version/release tags or link prompts via Langfuse prompt management. | (all traces) | Tag traces with `release`/`version` at ingestion and use Langfuse-managed prompts so `promptName`/`promptVersion` populate, enabling before/after release comparisons. | Traces in Langfuse project clkpwwm0m000gmm094odg11gi have no version, release, promptName, or promptVersion set, so we can't detect regressions by deploy or prompt change. Set release/version on the SDK client and route prompts through Langfuse prompt management so promptName/promptVersion are captured. |

---

## Verified non-issues (checked, clean)

- **Retrieval content relevance (D14):** `searchLangfuseDocs` returns relevant results — median 9 query↔result token overlap, only 1/214 with zero overlap, **408 distinct doc URLs** returned (not a tiny recycled set). Retrieval quality is healthy where the backend responds. Contrast with the 504 *availability* issue (finding #3).
- **Language/generation match (G25/H30):** 19 QA inputs contained CJK (Chinese); **0** were answered in the wrong language — Chinese in, Chinese out. Clean.
- **Refusals / non-answers (G24):** 0/265 QA outputs matched refusal patterns; off-topic questions are redirected gracefully, not hard-refused.
- **Out-of-scope handling (H28):** off-domain questions are declined and redirected to Langfuse politely; no over-reach, no leakage, no crashes observed.
- **Truncation (A4):** output tokens p90=487, max=1,783 — no length-limit truncation; answers complete.
- **Cost (C9–11):** total $9.54 over 7 days, max single trace $0.166, input tokens p90=21k/max=33k, gpt-5 reasoning tokens modest (max 640). No cost explosion or runaway context.
- **Safety / cursing (G27):** no PII/secret leakage seen in sampled I/O; no profanity in sampled inputs (though the `is_cursing` guard is unverified — finding #8).
- **Sentiment-Classifier output contract (G25):** returns well-formed JSON (`sentiment`/`confidence`/`explanation`); no malformed outputs in sample.
- **Hard error rate (A1):** only 5 ERROR-level observations in 2,644 (all the same 504); no stack traces, no crashes.

---

## Suggested order of action

1. **Fix the "Language & style" evaluator mapping (finding #1)** — it's silently reporting on nothing; highest cheap-win for monitoring integrity.
2. **Close the quality-monitoring gaps (finding #2)** — add evals for the 3 unmonitored apps and enable live Correctness on QA-Chatbot; scope `user-intent` to QA only.
3. **Handle retrieval 504s + null outputs (findings #3, #4)** — surface them at ERROR level, add retry/fallback, guarantee a user-facing message.
4. **Reconcile off-scope evaluators & review the 26% off-topic tail (finding #5).**
5. **Investigate the voice agent (finding #6)** — runaway sessions + model fallback + no I/O.
6. **Hygiene (findings #7–9):** setup-answer UX, dead-evaluator sanity checks, add version/release/prompt metadata.

## Open questions

- Is the ~26% off-topic QA traffic real users or demo/testing? (Several repeated identical inputs suggest some synthetic traffic.)
- Are `is_cursing` / `User disagreement` genuinely quiet or mis-wired? (Needs a known-positive test.)
- What does `Language & style` value `0` vs `1` *intend* to mean once it actually sees the response? (Polarity can't be validated while the eval is broken.)
- Is the voice agent in active use or experimental? (Only 9 traces, all poorly instrumented.)

## Not covered / limitations

- **Faithfulness/hallucination (G26):** not verifiable without ground truth; especially uncertain on the 21 traces where retrieval 504'd and the model answered from fallback context — flagged as risk, not measured.
- **Image-Generator output quality:** trace-level output is null for all 42 (image likely stored in child observation/binary); did not fetch/inspect generated images, so image quality is unassessed.
- **Segmentation by release/prompt version:** impossible — that metadata is absent (finding #9).
- **user-feedback:** only 1 API feedback score exists in 7 days, so real user-satisfaction signal is essentially unavailable; friction was inferred from transcripts and re-ask phrasing, not direct ratings.
- **Latency deep-dive on the 6,116s voice span:** identified but not root-caused (would require child-observation timing detail).
