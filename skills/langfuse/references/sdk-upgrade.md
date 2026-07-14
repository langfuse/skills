---
name: langfuse-sdk-upgrade
description: Upgrade Langfuse SDKs and instrumentation to current versions. Use when migrating Python SDK v2/v3 to v4, JS/TS SDK v3/v4 to v5, or preparing application code for the Langfuse v4 platform.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_SCRIPT
---

# Langfuse SDK upgrade

## Sources of truth

Fetch the applicable pages in full before editing. Do not implement from this file or memory alone.

- [Langfuse v4 overview](https://langfuse.com/docs/v4)
- [Python v3 to v4](https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4)
- [JS/TS v4 to v5](https://langfuse.com/docs/observability/sdk/upgrade-path/js-v4-to-v5)
- [Direct OpenTelemetry setup](https://langfuse.com/integrations/native/opentelemetry)
- [Observations API](https://langfuse.com/docs/api-and-data-platform/features/observations-api)
- [Metrics API](https://langfuse.com/docs/metrics/features/metrics-api)

Use the exact minimum versions and migration requirements in the current docs. Prefer the latest stable release in the required major unless the repository has an explicit compatibility constraint.

## Workflow

### 1. Inventory before editing

- Find every Langfuse SDK, integration package, direct OpenTelemetry exporter, initialization site, instrumentation wrapper, trace-update call, and direct Langfuse API call across the whole repository.
- Record the installed and resolved versions for every application/package. Include lockfiles, workspace overrides, and peer dependencies.
- Identify tests, examples, workers, and scripts that initialize Langfuse independently; do not assume the main application is the only ingestion path.
- If this is part of the v4 platform migration, also follow `references/v4-project-migration.md` and use its active-evaluator migration contract to drive the instrumentation changes below.

### 2. Upgrade the ingestion path

- Update dependencies with the repository's package manager and follow every applicable item in the current SDK migration guide.
- For direct OpenTelemetry ingestion, apply the current v4 ingestion header and attribute-propagation requirements from the docs.
- Preserve deliberate custom span-export behavior. Verify whether the application relies on non-LLM spans before accepting a new default span filter.
- Replace removed or deprecated tracing APIs using the current guide. Do not retain deprecated trace input/output setters unless an active legacy trace evaluator still needs them during a staged cutover.
- Keep correlating attributes inside the documented propagation scope so the target observations receive the attributes used by filters and analytics.

### 3. Make observation evaluators self-contained

For every active legacy evaluator being replaced:

- Choose one stable target observation by name/type and confirm it exists in representative traces.
- Put the complete evaluation payload on that observation. Observation evaluators can map only that observation's input, output, metadata, and tool calls; they do not read sibling or child observations.
- When judging an end-to-end application or agent invocation, use a root observation that records the overall input/output and any additional context the judge requires.
- Ensure trace-level attributes used by evaluator filters are propagated onto the target observation.
- Keep the payload intentional and minimal. Do not copy an entire trace into metadata when the evaluator needs only a small subset.

### 4. Replace deprecated API usage

- Search both SDK resource namespaces and raw HTTP paths; include generated clients, fixtures, shell scripts, dashboards, and data pipelines.
- Use the current SDK migration guide and API docs to replace transitional aliases and legacy Observations, Scores, or Metrics routes.
- Check deployment availability before changing a self-hosted client to an endpoint that is Cloud-only or not yet available in that deployment.
- Update pagination, selected field groups, filters, and response parsing together with the endpoint. A path-only replacement is not a complete migration.

### 5. Verify

- Run the repository's focused formatting, type, lint, and test checks.
- Exercise every changed ingestion path with representative application behavior. Confirm observation hierarchy, target observation input/output/context, propagated attributes, and absence of unexpected dropped spans.
- If Langfuse project access is available, inspect the resulting observations and verify that each new evaluator rule matches the intended observation and can populate every variable.
- Do not claim live verification when credentials or a runnable environment are unavailable. Report the exact remaining check.

## Completion report

Report:

- exact SDK/package versions before and after
- instrumentation and API call sites changed
- active legacy evaluators that still temporarily require trace input/output
- verification run and observed result
- project or UI actions that remain
