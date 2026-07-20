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

## 1. Upgrade SDK and instrumentation first

Before changing any evaluator configuration, ask the user which legacy evaluators they still need. Evaluators that are no longer needed should not drive SDK or instrumentation changes. Recommend deactivating or deleting their evaluation rules instead, but do not change project configuration without explicit approval.

For every retained evaluator, inspect all variable mappings before doing anything else. Skip the SDK and instrumentation prerequisite only when **every retained evaluator** meets all of these conditions:

- every variable maps to one existing Langfuse observation, such as a span, generation, or event;
- all variables for an evaluator map to the same observation;
- no variable maps to trace input, trace output, trace metadata, or a second observation.

This is the configuration-only upgrade path and does not require an SDK upgrade. If its filters use trace attributes that are not already present on the target observation, make that targeted propagation change before creating the successor rule.

In every other case, upgrading the SDK or OpenTelemetry ingestion path and application instrumentation is a hard prerequisite:

1. Follow `references/sdk-upgrade.md` and the current SDK or OpenTelemetry upgrade guide.
2. Confirm the repository uses a supported v4 ingestion path and that a representative newly ingested trace contains the expected observations. Do not rely only on a dependency declaration or lockfile.
3. Do not create or update observation-level evaluator rules until this upgrade is complete.

Keep legacy evaluators running while the instrumentation changes are deployed. If they read trace input or output, retain the documented deprecated trace I/O calls temporarily and remove them only after the successor rules are validated and the legacy rules are disabled.

### Select the target and update instrumentation

Locate the code that creates the representative trace and its observations. Match observation names and types from real project context to their creation sites. Do not treat trace-level values shown through UI aggregation as proof that the same values exist on an individual observation.

Use the first applicable path:

1. **All variables already use one observation:** Keep that observation as the target. Confirm the observation's own fields and filter attributes are complete. If the observation filters on trace attributes but the instrumentation does not propagate them, add the missing trace attributes to the observation.
2. **All variables use trace input, output, or metadata:** Prefer the root observation that represents the end-to-end invocation. Confirm that its input and output are semantically equivalent to the former trace input and output, then add only missing evaluation context to that observation. If the root observation does not match the former trace I/O, inspect an example trace against which the evaluator ran in v3 and check whether another observation carried the same I/O. If so, use that observation. If not, or if the required I/O was spread across multiple observations, create one dedicated evaluation observation containing only the required values. Do not emulate multi-span reads or serialize the whole trace into metadata.
3. **Variables mix trace data with one observation:** Target that observation when it represents the evaluated operation. Add the required trace-sourced values to its metadata without changing unrelated payloads.
4. **Variables use multiple observations:** First look for an existing root or parent observation that already contains the combined result. Otherwise create one dedicated evaluation observation containing only the required values. Do not emulate multi-span reads or serialize the whole trace into metadata.

For every instrumentation change:

- set end-to-end input and output directly on the selected root or workflow observation;
- put extra judge context on the target observation using intentional, stable metadata keys;
- enter the trace-attribute propagation scope before creating the target observation and every descendant that must carry those attributes;
- keep observation names and types stable across executions and avoid selectors based on generated names or incidental framework spans.

If a dedicated evaluation observation is required, explain the instrumentation change to the user. Make clear that v4 does not currently support one evaluation reading multiple observations and that consolidating the required values onto one observation is the recommended upgrade path for now.

Keep code changes scoped to the evaluator contract. Do not create or update Langfuse project rules from application code.

Do not proceed to step 2 until the SDK and instrumentation upgrade is deployed and confirmed on newly ingested data, or every retained evaluator qualifies for the configuration-only exception.

## 2. Record the upgrade contract

For each retained legacy evaluator, record:

| Field             | Required evidence                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisite      | Confirmed SDK/ingestion upgrade, or the exact configuration-only exception                                                      |
| Legacy behavior   | Evaluator and score names, filters, variable mappings and JSONPaths, sampling, delay, and expected one-score-per-trace behavior |
| Candidate target  | One stable observation name/type and whether it is the root observation                                                         |
| Variable coverage | Where every required input, output, metadata, or tool-call value exists on that observation                                     |
| Filter coverage   | Where every filter value exists on that observation, including propagated trace attributes                                      |
| Code change       | Exact instrumentation site and fields that must be added or moved                                                               |
| Successor rule    | Observation selector, filters, and one mapping for every evaluator variable                                                     |
| Validation        | Representative execution and expected score count                                                                               |

Inspect every variable and filter. Do not change the evaluator prompt, model, output definition, sampling, or delay unless the existing contract cannot be preserved and the user approves that semantic change. Continue using the same linked evaluator template for the new observation-level evaluator.

## 3. Translate filters and mappings

- Add a stable observation selector. Prefer a unique observation `name` plus `type`; use root-observation status when root semantics are part of the contract.
- A legacy trace `name` filter becomes `traceName` on the observation rule. It does not select the target observation by itself; add the observation selector separately.
- Preserve observation-level filters such as name, type, and environment only after confirming the target observation carries those values.
- Trace attributes used by filters, including user ID, session ID, tags, metadata, version, or trace name, must be propagated to the target observation using the current SDK or OpenTelemetry guidance. Configure environment and release using their documented SDK-specific mechanisms and confirm they exist on the target observation.
- Map every evaluator variable exactly once from the target observation's input, output, metadata, or tool-call fields. Preserve JSONPath semantics against the new payload shape.
- Preserve sampling, delay, and new-data time scope. Observation evaluation rules run on newly ingested observations and do not backfill historical data.

Check cardinality explicitly. A trace-level rule produces one score per matching trace; an observation rule produces one score per matching observation. If the existing behavior requires one score per trace, the selector must match at most one observation in each representative trace.

## 4. Verify and hand off

Run focused repository checks and one representative instrumented execution when credentials and a runnable environment are available. Verify:

- the intended observation exists exactly once per trace when one-score-per-trace behavior is required;
- its own input, output, metadata, and tool-call fields satisfy every variable mapping;
- every retained filter attribute exists directly on the observation;
- the proposed selector matches the intended observation and excludes siblings;
- no required spans are dropped by SDK export filtering.

Do not claim live verification when project access or a runnable path is unavailable. Return the exact project-side successor configuration and manual checks to complete in Langfuse. Project writes require explicit user approval.

## Output

Return valid Markdown with:

1. SDK/ingestion confirmation or the exact configuration-only exception;
2. a per-evaluator upgrade table using the contract above;
3. code files changed and why;
4. exact successor selector, filters, and variable mappings;
5. checks run and observed results;
6. temporary legacy trace I/O calls still present;
7. project actions or blockers remaining.

Check links, tables, lists, and code fences for valid Markdown before returning.
