---
name: langfuse-trace-evaluator-upgrade
description: Upgrade legacy trace-level LLM-as-a-Judge evaluators to observation-level evaluators by selecting one stable target observation and making the required application instrumentation changes. Use when Langfuse recommends the coding-assistant evaluator upgrade path or provides an evaluator upgrade handoff.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_SCRIPT
---

# Trace-level evaluator upgrade

In the v4 data model, a trace is the logical group of observations sharing a trace ID, not a separate record with its own input and output. Observation-level evaluators run against one ingested observation without assembling the full trace, which makes execution real time and scalable. In most applications, a root or workflow observation already carries the same end-to-end input and output; the upgrade makes that observation the explicit evaluation target. Future multi-span evaluation support will also build on this observation-centric model. It is currently not possible to run a single evaluation that has access to multiple observations at once. 

## Sources of truth

Fetch the applicable pages in full before editing:

- [Trace-level evaluator upgrade guide](https://langfuse.com/faq/all/llm-as-a-judge-migration)
- [Langfuse v4 overview](https://langfuse.com/docs/v4)
- [Observation evaluator context](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge#observation-evaluator-context)
- [Python v3 to v4](https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4)
- [JS/TS v4 to v5](https://langfuse.com/docs/observability/sdk/upgrade-path/js-v4-to-v5)
- [Instrumentation and attribute propagation](https://langfuse.com/docs/observability/sdk/instrumentation#add-attributes-to-observations)

Use the project-specific evaluator context supplied by the Langfuse upgrade screen. It must include every active legacy evaluator's filters, variable mappings, sampling, and evaluator definition. If it is missing or incomplete, ask the user to reopen **Evaluation** and copy the coding-assistant context; do not reconstruct project configuration from application code.

## 1. Build the upgrade contract

For each active legacy evaluator, record:

| Field | Required evidence |
| --- | --- |
| Legacy behavior | Evaluator and score names, filters, variable mappings and JSONPaths, sampling, delay, and expected one-score-per-trace behavior |
| Candidate target | One stable observation name/type and whether it is the root observation |
| Variable coverage | Where every required input, output, metadata, or tool-call value exists on that observation |
| Filter coverage | Where every filter value exists on that observation, including propagated trace attributes |
| Code change | Exact instrumentation site and fields that must be added or moved |
| Successor rule | Observation selector, filters, and one mapping for every evaluator variable |
| Validation | Representative execution and expected score count |

Inspect every variable and filter. Do not change the evaluator prompt, model, output definition, sampling, or delay unless the existing contract cannot be preserved and the user approves that semantic change.

## 2. Find one target observation

Locate the code that creates the representative trace and its observations. Match observation names and types from real project context to their creation sites. Do not treat trace-level values shown through UI aggregation as proof that the same values exist on an individual observation.

Use the first applicable path:

1. **All variables already use one observation:** Keep that observation as the target. Move on to step 3 to translate filters and mappings. Confirm the observation's own fields and filter attributes are complete before deciding that no code change is needed. If the observation filters on trace attributes, but the instrumentation does not propagate them, add the missing trace attributes to the observation.
2. **All variables use trace input, output, or metadata:** Prefer the root or workflow observation that represents the end-to-end invocation. Confirm that its input and output are semantically equivalent to the former trace input and output, then add only missing evaluation context to that observation.
3. **Variables mix trace data with one observation:** Target that observation when it represents the evaluated operation. Add the required trace-sourced values to its input, output, or metadata without changing unrelated payloads.
4. **Variables use multiple observations:** First look for an existing root or parent observation that already contains the combined result. Otherwise update a root observation or create one dedicated evaluation observation containing only the required values. Do not emulate multi-span reads or serialize the whole trace into metadata.

If one observation cannot hold the required values when it ends, stop and report the evaluator as blocked. Explain which values become available too late or in a different process instead of producing a lossy upgrade.

## 3. Translate filters and mappings

- Add a stable observation selector. Prefer a unique observation `name` plus `type`; use root-observation status when root semantics are part of the contract.
- A legacy trace `name` filter becomes `traceName` on the observation rule. It does not select the target observation by itself; add the observation selector separately.
- Preserve observation-level filters such as name, type, and environment only after confirming the target observation carries those values.
- Trace attributes used by filters, including user ID, session ID, tags, metadata, version, or trace name, must be propagated to the target observation using the current SDK or OpenTelemetry guidance. Configure environment and release using their documented SDK-specific mechanisms and confirm they exist on the target observation.
- Map every evaluator variable exactly once from the target observation's input, output, metadata, or tool-call fields. Preserve JSONPath semantics against the new payload shape.
- Preserve sampling, delay, and new-data time scope. Observation evaluation rules run on newly ingested observations and do not backfill historical data.

Check cardinality explicitly. A trace-level rule produces one score per matching trace; an observation rule produces one score per matching observation. If the existing behavior requires one score per trace, the selector must match at most one observation in each representative trace.

## 4. Update instrumentation

- Follow `references/sdk-upgrade.md` first when the repository is not already on a supported SDK or v4 OpenTelemetry ingestion path.
- Set end-to-end input and output directly on the selected root or workflow observation.
- Put extra judge context on the target observation using intentional, stable metadata keys. Do not duplicate the full trace.
- Enter the trace-attribute propagation scope before creating the target observation and every descendant that must carry those attributes. Do not rely on propagation to retrofit observations created outside that scope.
- Keep observation names and types stable across executions. Avoid selectors based on generated names or incidental framework spans.
- If legacy evaluators that read trace input/output remain active during comparison, retain the documented deprecated trace I/O calls temporarily. Mark them as transition code and remove them after the observation-level rules are validated and the legacy rules are disabled.

Keep code changes scoped to the evaluator contract. Do not create or update Langfuse project rules from application code.

## 5. Verify and hand off

Run focused repository checks and one representative instrumented execution when credentials and a runnable environment are available. Verify:

- the intended observation exists exactly once per trace when one-score-per-trace behavior is required;
- its own input, output, metadata, and tool-call fields satisfy every variable mapping;
- every retained filter attribute exists directly on the observation;
- the proposed selector matches the intended observation and excludes siblings;
- no required spans are dropped by SDK export filtering.

Do not claim live verification when project access or a runnable path is unavailable. Return the exact project-side successor configuration and manual checks to complete in Langfuse. Project writes require explicit user approval.

## Output

Return valid Markdown with:

1. a per-evaluator upgrade table using the contract above;
2. code files changed and why;
3. exact successor selector, filters, and variable mappings;
4. checks run and observed results;
5. temporary legacy trace I/O calls still present;
6. project actions or blockers remaining.

Check links, tables, lists, and code fences for valid Markdown before returning.
