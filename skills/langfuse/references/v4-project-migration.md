---
name: langfuse-v4-project-migration
description: Prepare a Langfuse project for the v4 platform by inventorying active evaluation rules, migrating legacy trace and dataset evaluators to observation and experiment targets, and moving exports to the enriched observation schema.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
---

# Langfuse v4 project migration

Use this as the canonical v4 platform migration workflow. A coding agent should execute the SDK and code changes; the Langfuse in-app agent can execute the project steps and produce the same code handoff.

## Sources of truth

Fetch the applicable pages before taking action:

- [Langfuse v4 overview](https://langfuse.com/docs/v4)
- [Langfuse CLI](https://langfuse.com/docs/api-and-data-platform/features/cli)
- [SDK upgrade paths](https://langfuse.com/docs/observability/sdk/upgrade-path)
- [Evaluator migration guide](https://langfuse.com/faq/all/llm-as-a-judge-migration)
- [Observation evaluator context](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge#observation-evaluator-context)
- [Evaluators API](https://api.reference.langfuse.com/#tag/unstableevaluators)
- [Evaluation Rules API](https://api.reference.langfuse.com/#tag/unstableevaluationrules)
- [Blob storage export migration](https://langfuse.com/docs/api-and-data-platform/features/export-to-blob-storage#export-source-fast-preview)
- [Export field reference](https://langfuse.com/docs/api-and-data-platform/features/blob-storage-export-fields#enriched-vs-legacy-differences)
- [Mixpanel export migration](https://langfuse.com/integrations/analytics/mixpanel#migrate-export-source)
- [PostHog export migration](https://langfuse.com/integrations/analytics/posthog#migrate-export-source)

Discover the current API or tool schema before writes; the evaluator endpoints are unstable.

## 1. Set up project access

- Prefer an available Langfuse project interface. Otherwise recommend the [Langfuse CLI](https://langfuse.com/docs/api-and-data-platform/features/cli) and run it directly with `npx langfuse-cli` or `bunx langfuse-cli`; a global installation is optional.
- Ask the user to configure `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` in their environment. Never ask them to paste secrets into the conversation or commit credentials.
- Verify access and discover the current resources with `npx langfuse-cli api __schema`. Inspect each resource and action with `--help` before use, and request machine-readable output with `--json`.
- Confirm the project and host before any read or write. If credentials or a project interface are unavailable, continue with the code migration and report project-side checks as blocked.

## 2. Upgrade SDKs and instrumentation

- For a coding agent with repository access, execute the repository-wide SDK upgrade in the steps below — using the version-specific breaking-changes guide under [SDK upgrade paths](https://langfuse.com/docs/observability/sdk/upgrade-path) as the docs reference — before declaring the platform migration ready.
- Inventory every Langfuse SDK, integration package, direct OpenTelemetry exporter, initialization site, and lockfile across the repository. Upgrade each ingestion path to the latest stable release in the major required by the current v4 migration docs, unless the repository has a documented compatibility constraint.
- Apply every applicable SDK migration step, update removed tracing APIs, and replace deprecated Observations, Scores, and Metrics API routes using the current docs. A dependency-only update is incomplete.
- Use the evaluator migration contract below to consolidate all required evaluation input, output, metadata, tool calls, and propagated filter attributes onto the single target observation.
- Verify the resolved versions and representative ingestion behavior. If the agent cannot access or edit the codebase, return an exact SDK and instrumentation handoff and keep this area blocked rather than marking it ready.

## 3. Inventory active evaluation rules

- Confirm the project, host, and whether it is Cloud or self-hosted.
- Page through all available evaluators and evaluation rules. Inspect each referenced evaluator definition, not only its name.
- Migrate rules whose effective `status` is `active`. Report paused/inactive rules separately; do not reactivate or migrate them unless requested.
- Do not infer that the project has no legacy rules from the public list alone. Verify which targets the interface returns; if it omits legacy trace or dataset rules, use the UI check below.
- Open the [Evaluators UI](https://cloud.langfuse.com/project/~/evals) and check for active rows marked **Legacy** whenever the interface cannot list those targets. In the in-app agent, redirect the user there. Treat this confirmation as required before declaring the project ready.

## 4. Build an evaluator migration contract

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

## 5. Create and cut over successor rules

- Reuse the existing evaluator definition when it remains valid. Create a new evaluator version only when the prompt, output definition, or variable contract must change.
- Update an existing successor rule instead of creating a duplicate with the same name.
- Create the observation or experiment successor disabled first when the interface supports it. Validate its target, filters, mappings, sampling, and evaluator-variable coverage against real project data.
- Enable the successor only after the user approves the write. Verify it on newly ingested data; public evaluation rules are live-ingestion rules and do not perform historical backfills.
- Compare resulting scores and execution logs. Keep the legacy rule available for rollback until the successor is proven.
- Disable the active legacy rule in the UI after verification. Do not delete legacy rules or historical scores by default.
- Re-list rules and re-check the UI. Completion requires no unintended active legacy trace/dataset rule and an active verified successor for every migrated rule.

If the available project interface cannot read or update a legacy rule, provide the exact [Evaluators UI](https://cloud.langfuse.com/project/~/evals) action and retain it as an explicit blocker rather than claiming completion.

## 6. Migrate exports

Switching an integration to enriched-only output is a breaking change for downstream consumers; enabling the dual source (legacy plus enriched observations) is additive and safe. Fetch the documented upgrade paths and follow them instead of restating export mechanics from memory:

- [Blob Storage upgrade path](https://langfuse.com/docs/api-and-data-platform/features/export-to-blob-storage#upgrade-path) and the [enriched vs. legacy field differences](https://langfuse.com/docs/api-and-data-platform/features/blob-storage-export-fields#enriched-vs-legacy-differences)
- [Mixpanel export migration](https://langfuse.com/integrations/analytics/mixpanel#migrate-export-source) and the [legacy vs. enriched event changes](https://langfuse.com/integrations/analytics/mixpanel#legacy-vs-enriched)
- [PostHog export migration](https://langfuse.com/integrations/analytics/posthog#migrate-export-source) and the [legacy vs. enriched event changes](https://langfuse.com/integrations/analytics/posthog#legacy-vs-enriched)

Key takeaways:

- Inventory configured Blob Storage, Mixpanel, PostHog, and other export integrations in **Project Settings > Integrations**.
- Check eligibility first: many integrations can no longer select legacy sources (Langfuse Cloud date cutoffs; self-hosted deployments that completed the v4 migration — see the docs for the exact rules). An integration that already exports enriched observations only is complete by default.
- Follow the documented dual-export transition per integration. Switching from legacy to legacy plus enriched observations is additive and needs no downstream sign-off — apply it directly. The switch from the dual source to enriched observations only stops the legacy output and requires the user's explicit confirmation that downstream owners are prepared. Never switch a legacy integration directly to enriched-only.
- A source change applies to future exports only; already-exported history keeps the legacy shape and is not re-exported.
- Change only the export source. Leave credentials, schedules, prefixes, file formats, field groups, and integration secrets untouched. Apply the change in the integration settings UI — for Blob Storage the documented public API (project-scoped keys) also works; Mixpanel and PostHog have no API migration path.

Effects outside Langfuse — spell these out per configured integration before the enriched-only cutover:

- **Blob Storage:** the exported tables, file paths, and column sets change (scores are unaffected). Warehouse loaders, table schemas, trace-observation joins, dashboards, and any storage-event automation keyed on the legacy file paths must be updated — the integration setting is the smallest part of the migration. After the switch the legacy directories receive no further files, so pipelines still watching them go silent without an error signal.
- **Mixpanel and PostHog:** the source determines which events and properties are sent, so dashboards, transformations, funnels, and alerts built on the legacy events in those systems must be revalidated.
- **Dual mode** exports the same data in both the legacy and the enriched shape by design. Downstream counts, costs, and metrics are inflated only where a consumer ingests both — for example a warehouse model loading both observation tables, or analytics queries matching both event sets. Keep each consumer on exactly one shape during the transition.
- Because history is not re-exported, downstream consumers must either keep handling the legacy schema for historical data or the user must re-export history as documented.
- Treat the downstream consumer update as part of the migration. Report this area as `manual action`, not `ready`, until the user confirms consumers handle the new schema.

## 7. Report readiness

Return one row per area with `ready`, `changed`, `manual action`, or `blocked`:

- CLI or project-interface setup
- SDK versions and instrumentation migration, including any code handoff
- active trace-to-observation evaluator migrations
- active dataset-to-experiment evaluator migrations
- deprecated API code handoff
- Blob Storage and analytics export migrations
- verification and rollback status

Include direct UI links and the evaluator migration contract so an off-platform coding agent and the in-app agent can continue from the same facts.
