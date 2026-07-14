---
name: langfuse-v4-project-migration
description: Prepare a Langfuse project for the v4 platform by inventorying active evaluation rules, migrating legacy trace and dataset evaluators to observation and experiment targets, and moving exports to the enriched observation schema.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
---

# Langfuse v4 project migration

Use this as the canonical project-side workflow. A coding agent should combine its output with the SDK upgrade workflow; the Langfuse in-app agent can execute the project steps and produce the same code handoff.

## Sources of truth

Fetch the applicable pages before taking action:

- [Langfuse v4 overview](https://langfuse.com/docs/v4)
- [Evaluator migration guide](https://langfuse.com/faq/all/llm-as-a-judge-migration)
- [Observation evaluator context](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge#observation-evaluator-context)
- [Evaluators API](https://api.reference.langfuse.com/#tag/unstableevaluators)
- [Evaluation Rules API](https://api.reference.langfuse.com/#tag/unstableevaluationrules)
- [Blob storage export migration](https://langfuse.com/docs/api-and-data-platform/features/export-to-blob-storage#export-source-fast-preview)
- [Export field reference](https://langfuse.com/docs/api-and-data-platform/features/blob-storage-export-fields#enriched-vs-legacy-differences)
- [Mixpanel export migration](https://langfuse.com/integrations/analytics/mixpanel#export-source-fast-preview-langfuse-v4)
- [PostHog export migration](https://langfuse.com/integrations/analytics/posthog#export-source-fast-preview-langfuse-v4)

Discover the current API or tool schema before writes; the evaluator endpoints are unstable.

## 1. Inventory active evaluation rules

- Confirm the project, host, and whether it is Cloud or self-hosted.
- Page through all available evaluators and evaluation rules. Inspect each referenced evaluator definition, not only its name.
- Migrate rules whose effective `status` is `active`. Report paused/inactive rules separately; do not reactivate or migrate them unless requested.
- Do not infer that the project has no legacy rules from the public list alone. Verify which targets the interface returns; if it omits legacy trace or dataset rules, use the UI check below.
- Open the [Evaluators UI](https://cloud.langfuse.com/project/~/evals) and check for active rows marked **Legacy** whenever the interface cannot list those targets. In the in-app agent, redirect the user there. Treat this confirmation as required before declaring the project ready.

## 2. Build an evaluator migration contract

For every active legacy rule, record:

| Field         | Required decision                                                                            |
| ------------- | -------------------------------------------------------------------------------------------- |
| Existing rule | Name, evaluator, active status, filters, sampling, and variable mappings                     |
| New target    | Trace to one observation; dataset/dataset run to experiment                                  |
| Selector      | Stable observation name/type plus any propagated trace-attribute filters                     |
| Mapping       | Every evaluator variable mapped exactly once to a supported source and optional JSONPath     |
| Required data | Exact input, output, metadata, or tool-call fields that must exist on the target observation |
| Code handoff  | Missing observation fields or attributes that the coding agent must add                      |
| Cutover       | How the new rule will be verified before the legacy rule is disabled                         |

- Inspect representative observations instead of guessing the target or data shape.
- Use observation sources for live rules. Experiment rules may additionally use expected output and experiment-item metadata; confirm the current schema before writing.
- Observation evaluators see only the matched observation. If the evaluator needs an end-to-end request, response, or summary assembled from multiple steps, target a root observation and require the application to write that context onto it.
- Rebuild filters and mappings deliberately. Do not assume the UI upgrade wizard semantically preserves a legacy rule.

## 3. Create and cut over successor rules

- Reuse the existing evaluator definition when it remains valid. Create a new evaluator version only when the prompt, output definition, or variable contract must change.
- Update an existing successor rule instead of creating a duplicate with the same name.
- Create the observation or experiment successor disabled first when the interface supports it. Validate its target, filters, mappings, sampling, and evaluator-variable coverage against real project data.
- Enable the successor only after the user approves the write. Verify it on newly ingested data; public evaluation rules are live-ingestion rules and do not perform historical backfills.
- Compare resulting scores and execution logs. Keep the legacy rule available for rollback until the successor is proven.
- Disable the active legacy rule in the UI after verification. Do not delete legacy rules or historical scores by default.
- Re-list rules and re-check the UI. Completion requires no unintended active legacy trace/dataset rule and an active verified successor for every migrated rule.

If the available project interface cannot read or update a legacy rule, provide the exact [Evaluators UI](https://cloud.langfuse.com/project/~/evals) action and retain it as an explicit blocker rather than claiming completion.

## 4. Migrate exports

- Inventory configured Blob Storage, Mixpanel, PostHog, and other export integrations in **Project Settings > Integrations**.
- For Blob Storage, inspect or update the integration through the API when organization-scoped credentials and the current schema are available. Otherwise direct the user to [Blob Storage settings](https://cloud.langfuse.com/project/~/settings/integrations/blobstorage).
- For Mixpanel and PostHog, use the UI and the linked migration guides. Do not claim an API migration path that the current interface does not provide.
- Prefer the documented dual-export transition: enable legacy plus enriched observations, update and validate downstream consumers against the field reference, then switch to enriched observations only.
- Do not overwrite bucket credentials, schedules, prefixes, file formats, field groups, or integration secrets while changing the export source.
- Treat the downstream consumer update as part of the migration. A source toggle without validating queries, joins, dashboards, and field parsing is incomplete.

## 5. Report readiness

Return one row per area with `ready`, `changed`, `manual action`, or `blocked`:

- SDK and instrumentation code handoff
- active trace-to-observation evaluator migrations
- active dataset-to-experiment evaluator migrations
- deprecated API code handoff
- Blob Storage and analytics export migrations
- verification and rollback status

Include direct UI links and the evaluator migration contract so an off-platform coding agent and the in-app agent can continue from the same facts.
