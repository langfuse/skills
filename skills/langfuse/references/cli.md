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
export LANGFUSE_HOST=https://cloud.langfuse.com  
```

## Tips

- Use `--json` for machine-readable JSON output
- Use `--curl` to preview the HTTP request without executing
- Pagination: use `--limit` and `--page` on list endpoints
- All list commands support filtering — check `<resource> <action> --help` for available options
- Prefer `observations` over `legacy-observations-v1s` (the modern endpoint is exposed as `observations`; `legacy-observations-v1s` is the deprecated v1)
- Prefer `metrics` over `legacy-metrics-v1s`
- Prefer `scores` over `legacy-score-v1s` for list/get operations
- The legacy `traces list` endpoint on Langfuse Cloud times out on broad queries — use `observations list` (with `--trace-id` if you need to traverse from a known trace) instead.
  Server returns: *"This legacy endpoint can be slow. Please migrate to the high-performance Observations API v2."*
