# Triage dimensions checklist

Walk **every** dimension. For each, compute the signal, mark present/absent, and keep evidence (count, %, example trace IDs). A clean dimension is still a finding — record it as "verified, no issue" so the user knows it was checked.

The dimensions are grouped. The first group is what naive triage usually covers; the later groups are where issues **silently hide** — do not skip them.

## A. Reliability & errors (the obvious ones)
1. **Hard errors** — observations with `level` in (`ERROR`, `WARNING`); non-empty `statusMessage`. Group by name/type.
2. **Tool-call failures** — tool outputs with `ok:false`, error fields, exceptions, HTTP non-2xx, stack traces in output.
3. **Empty / null outputs** — traces or generations with empty/`null` output, or output that is just whitespace.
4. **Truncation** — generations stopped by length limit (`finish_reason: length`, `max_tokens` hit); answers cut off mid-sentence.
5. **Timeouts / retries** — duplicated observations, retry markers, abnormally long single calls that look like a hung dependency.

## B. Latency
6. **End-to-end** (AGENT/root) — median, p90, p99, max. Is the tail acceptable for this product?
7. **Per-step** — which observation type/step dominates (sequential LLM calls? slow tool? retrieval?). Time-to-first-token for streaming.
8. **Outliers** — slowest N traces; is slowness correlated with a tool, model, input size, or user?

## C. Cost & tokens
9. **Total & per-trace cost** — sum, mean, distribution, costliest N. Any single-trace explosion?
10. **Token usage** — input/output token distribution; runaway prompts; context growing across a session.
11. **Waste** — tokens spent on content that adds no value (e.g. irrelevant retrieved context fed to the model every call — cross-check with retrieval relevance, D14).

## D. Tool / agent behavior
12. **Tool failure rate & loops** — same tool called many times in one trace (retry storm), tool-call loops, no-progress cycles.
13. **Malformed tool args** — arguments that don't match the question, missing required fields, schema violations.
14. **Retrieval / RAG relevance (silent killer)** — for search/retrieval tools: do returned results actually match the query? Check **content**, not just `ok` and result count. Signals: same few documents returned for unrelated queries; zero keyword/semantic overlap; tiny library returning the same items regardless of input; empty result sets. A tool can be "100% successful" and useless.
15. **Tool coverage gaps** — questions that should trigger a tool but didn't, or for which no suitable tool/content exists.

## E. Scores & evaluators
16. **Score distributions** — per evaluator: pass/fail %, value histogram. Which dimensions are failing and how often.
17. **Dead / non-discriminating evaluators** — an evaluator stuck at a single constant value (100% True or 100% False). Could be legitimately quiet OR mis-wired / never fires. Flag for a known-positive sanity check.
18. **Missing scores** — real traces with no scores attached (not being evaluated at all) → blind spots in monitoring.
19. **Score regressions** — pass rate dropping vs an earlier window or a previous release/version.

## F. User friction & conversation quality
20. **Follow-up / clarification rate** — turns where the user has to re-ask ("where is that?", "I don't understand", "that didn't work"). High rate = first answers underspecified.
21. **Disagreement / frustration** — user pushback, corrections, all-caps, profanity, "no", "that's wrong", repeated rephrasing.
22. **Multi-turn loops & repetition** — sessions where the user asks the same thing repeatedly; long sessions that never resolve; same question recurring across many sessions (systemic gap).
23. **Abandonment** — sessions that stop right after a bad/non-answer (drop-off after a specific failure).

## G. Output quality & safety
24. **Refusals / non-answers** — "I can't help with that", deflections, hedging where a direct answer was expected.
25. **Format / contract violations** — invalid JSON when JSON is required, missing fields, broken markdown, wrong language/locale vs the user.
26. **Faithfulness / hallucination risk** — answer asserts specifics not supported by retrieved context or tools (especially when retrieval is broken — D14).
27. **Safety / PII / compliance** — leaked secrets or PII in inputs/outputs, unsafe instructions, prompt-injection attempts in user input, guardrail observations firing or that *should* have fired.

## H. Inputs & scope
28. **Out-of-scope requests** — questions outside the product's intended domain; how the agent handles them.
29. **Malformed / adversarial inputs** — empty messages, garbage, injection attempts, extreme length.
30. **Language / locale mismatch** — user writes in language X, agent answers in Y.

## I. Segmentation & regressions (don't conclude from aggregates)
31. **By version / release** — slice every metric by `version`/`release`. A deploy may have regressed one slice while the aggregate looks fine. Compare before/after a release boundary.
32. **By user / session segment** — is a problem concentrated in a few users or sessions?
33. **By prompt version** — correlate `promptName`/`promptVersion` with scores, latency, cost — did a prompt change regress quality?
34. **By model / config** — multiple models in use? fallback model firing unexpectedly? model version drift? temperature/params anomalies?
35. **By tool / environment / tag** — concentration of issues in one tool, environment, or tag.

## J. Volume & coverage meta
36. **Traffic volume** — spike or drop vs expected; new vs returning users.
37. **Monitoring coverage** — % of traffic with scores/evals; environments present; anything un-instrumented.
38. **What you did NOT cover** — be explicit about sampling caps, pagination limits, or dimensions you couldn't evaluate (e.g. faithfulness without ground truth). Silent truncation of analysis reads as "all clear" when it isn't.
