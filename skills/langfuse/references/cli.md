---
name: langfuse-cli
description: Langfuse CLI usage reference — invocation, configuration, score creation, and command discovery.
---

# Langfuse CLI Reference

Documentation: https://langfuse.com/docs/api-and-data-platform/features/cli

## Install

```bash
# Run directly (recommended)
npx @langfuse/cli api <resource> <action>
bunx --bun @langfuse/cli api <resource> <action>

# Or install globally
npm i -g @langfuse/cli
langfuse api <resource> <action>
```

`@langfuse/cli` is the package; `langfuse` is its executable and the name printed
in help. Substitute `npx @langfuse/cli` or `bunx --bun @langfuse/cli` for
`langfuse` when running without a global installation. Keep the `api` subcommand.

## Discovery

```bash
# List all resources and auth info
langfuse api schema --json

# List actions for a resource
langfuse api <resource> --help

# Show args/options for a specific action
langfuse api <resource> <action> --help

# Preview the curl command without executing
langfuse api <resource> <action> --curl
```

## Credentials

Use the project credentials and regional host described in [Credentials](../SKILL.md#credentials).
For a file, pass `--env` explicitly:

```bash
langfuse --env .env api prompts list
```

## Create scores

Run `langfuse api scores create --help` for a body example matching the selected
API snapshot. Use `--body-json` or `--body-file`; score body fields are not
individual flags. The current API takes an array even for one score. Older
self-hosted snapshots take an object; retain the matching `--api-version`.

See the [score creation examples](https://github.com/langfuse/langfuse-cli#create-scores)
for numeric, boolean, categorical, and file-based requests. Preview with `--curl`.
Numeric and boolean values are numbers (boolean: 0 or 1); categorical values are
strings. HTTP 202 accepts a batch asynchronously; for 207, inspect the rejected
items and errors before retrying. With `--json`, the response is under `body`.

## Tips

- Use `--json` for machine-readable JSON output
- Use `--curl` to preview the HTTP request without executing
- All list commands support filtering — check `<resource> <action> --help` for available options
- Prefer `observations` over `legacy-observations-v1s` — `observations` is the modern high-performance endpoint (cursor pagination, selective field groups); `legacy-observations-v1s` is the deprecated v1
- Prefer `metrics` over `legacy-metrics-v1s` for the same reason
- Prefer `scores` over `legacy-score-v1s` for list/get operations
- Always query via `observations`, not `traces`, even when the user phrases the request in terms of traces — the `traces` endpoints are outdated (add `--trace-id` to scope to a known trace). See the [Observations API docs](https://langfuse.com/docs/api-and-data-platform/features/observations-api) for the v1 → v2 mapping.
- Per-trace name, timestamp, and total cost come from those observation rows. Group by `traceId` and sum `totalCost` — that sum is the legacy trace `totalCost`. Timestamp is the earliest `startTime`. Name is `traceName`, or the root observation's `name` when `traceName` is empty (`parentObservationId` null). Pass `fields` including `usage`: the default response is `core,basic` and has no `totalCost`.
- For the most expensive traces, or the cost of trace IDs you already have, use `metrics` v2 with dimension `traceId` only: explicit `config.row_limit` (max 1000), `orderBy` `sum_totalCost` desc, and no `timeDimension` ([high-cardinality dimensions](https://langfuse.com/docs/metrics/features/metrics-api#high-cardinality-dimensions)). For known IDs, filter `traceId` as `stringOptions` with operator `any of`, in batches of at most 1000, and set `row_limit` to the batch size. This is top-N or known-ID cost, not a full export.
- To find patterns across many traces (what users ask for, recurring problems, representative examples), first check whether the project has Langfuse Topics (closed beta), which summarizes traces and groups them into topics per facet. `unstable-topic-facets list` returns 404 when Langfuse Topics is not enabled. If it has topics, start from the `unstable-topic*` resources and open individual traces only to drill in, unless the user explicitly asks you to review traces manually.
- Pagination: legacy v1 endpoints use `--limit` and `--page`; modern endpoints (`observations`, `metrics`, `scores`) use cursor-based pagination — pass `--limit`, then thread `meta.cursor` from the response into the next request's `--cursor`
