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
- Prefer `observations` over `legacy-observations-v1s` — `observations` is the modern high-performance endpoint (cursor pagination, selective field groups); `legacy-observations-v1s` is the deprecated v1
- Prefer `metrics` over `legacy-metrics-v1s` for the same reason
- Prefer `scores` over `legacy-score-v1s` for list/get operations
- Always query via `observations`, not `traces`, even when the user phrases the request in terms of traces — the `traces` endpoints are outdated (add `--trace-id` to scope to a known trace). See the [Observations API docs](https://langfuse.com/docs/api-and-data-platform/features/observations-api) for the v1 → v2 mapping.
- Pagination: legacy v1 endpoints use `--limit` and `--page`; modern endpoints (`observations`, `metrics`, `scores`) use cursor-based pagination — pass `--limit`, then thread `meta.cursor` from the response into the next request's `--cursor`
- `observations list` returns the `core,basic` field groups by default, which leave out inputs and outputs; add groups only when needed, for example `--fields core,basic,io` (`io` is usually most of the payload)
- Find failures across traces in one call: `observations list --level ERROR --from-start-time <iso>`; each row carries `traceId`, `name` and `statusMessage`
- With the `metadata` field group, values longer than 200 characters come back truncated; pass `--expand-metadata <key>` for the keys you need in full
- Read a whole conversation with `observations list --session-id <id>`
- For totals and trends (cost, tokens, latency percentiles, error counts) use `metrics get --query '<json>'` instead of listing observations: one request returns the aggregate. `fromTimestamp` and `toTimestamp` are required. `config.row_limit` defaults to 100, so a time series with more buckets (a week by hour) is cut off; set it up to 1000. Adding `orderBy` drops the empty time buckets, and observation latency is in milliseconds. Example: `{"view":"observations","metrics":[{"measure":"count","aggregation":"count"}],"filters":[{"column":"level","operator":"=","value":"ERROR","type":"string"}],"timeDimension":{"granularity":"hour"},"fromTimestamp":"2026-10-20T00:00:00Z","toTimestamp":"2026-10-27T00:00:00Z","config":{"row_limit":1000}}`
