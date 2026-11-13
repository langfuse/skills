---
name: langfuse-cli
description: Langfuse CLI usage reference — install, resource/action discovery, credentials, and common usage tips for `langfuse-cli`. Use for further tips on using the Langfuse CLI.
---

# Langfuse CLI Reference

Documentation: https://langfuse.com/docs/api-and-data-platform/features/cli

## Install

```bash
# Run directly (recommended)
npx langfuse-cli api <resource> <action>
bunx langfuse-cli api <resource> <action>

# Or install globally
npm i -g langfuse-cli
langfuse api <resource> <action>
```

## Discovery

For self-hosted deployments, pass `--api-version auto` for discovery and subsequent reads, using the existing scoped helper when available. It detects the server via `/api/public/health` and selects a compatible bundled snapshot; the default uses the latest snapshot, not the running server's version. See the [CLI version-selection examples](https://github.com/langfuse/langfuse-cli#usage).

A v2 observations 404 or a locally blocked deprecated action can reflect a snapshot mismatch, not missing authentication or an unavailable legacy server endpoint. Rediscover commands under the compatible snapshot before proposing upgrades or a different client.

```bash
# List all resources and auth info
langfuse api __schema

# List actions for a resource
langfuse api <resource> --help

# Show args/options for a specific action
langfuse api <resource> <action> --help

# Preview the curl command without executing
langfuse api <resource> <action> --curl
```

## Credentials

Set environment variables:

```bash
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_BASE_URL=https://cloud.langfuse.com  
```

## Tips

- Use `--json` for machine-readable JSON output
- Use `--curl` to preview the HTTP request without executing
- All list commands support filtering — check `<resource> <action> --help` for available options
- Choose observation, trace, metric, and score commands from the selected snapshot's help; names and supported endpoints differ across versions. On self-hosted v3, `observations list` and `traces list` can be the supported v1 read paths.
- Rediscover filters, field selection, and pagination under that snapshot. V1 observations use `--limit` and `--page` without `--fields`; v2 observations support field groups and cursor pagination. Scope reads by trace ID or time and a small limit, and display only necessary fields locally when server-side field selection is unavailable.
- When the selected snapshot has v2 observations, query them instead of the outdated `traces` endpoints, even when the user phrases the request in terms of traces (add `--trace-id` to scope to a known trace). See the [Observations API docs](https://langfuse.com/docs/api-and-data-platform/features/observations-api) for the v1 → v2 mapping.
- Per-trace name, timestamp, and total cost come from those v2 observation rows. Group by `traceId` and sum `totalCost` — that sum is the legacy trace `totalCost`. Timestamp is the earliest `startTime`. Name is `traceName`, or the root observation's `name` when `traceName` is empty (`parentObservationId` null). Pass `fields` including `usage`: the default response is `core,basic` and has no `totalCost`.
- For the most expensive traces, or the cost of trace IDs you already have, use `metrics` v2 with dimension `traceId` only: explicit `config.row_limit` (max 1000), `orderBy` `sum_totalCost` desc, and no `timeDimension` ([high-cardinality dimensions](https://langfuse.com/docs/metrics/features/metrics-api#high-cardinality-dimensions)). For known IDs, filter `traceId` as `stringOptions` with operator `any of`, in batches of at most 1000, and set `row_limit` to the batch size. This is top-N or known-ID cost, not a full export.
- To find patterns across many traces (what users ask for, recurring problems, representative examples), first check whether the project has Langfuse Topics (closed beta), which summarizes traces and groups them into topics per facet. `unstable-topic-facets list` returns 404 when Langfuse Topics is not enabled. If it has topics, start from the `unstable-topic*` resources and open individual traces only to drill in, unless the user explicitly asks you to review traces manually.
