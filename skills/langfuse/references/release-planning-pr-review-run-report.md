---
name: langfuse-release-planning-pr-review-run-report
description: Build deterministic release-planning-agents PR review run reports from saved Langfuse trace exports or native artifact directories. Use when inspecting UMG release-planning PR review bot traces and the local checkout includes `scripts/pr_review_run_report.py`.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_INTERFACE
---

# Release Planning PR Review Run Reports

Use the repo-local helper when investigating `release-planning-agents` PR review bot runs. It produces an offline operator report from saved evidence, so do not make ad hoc trace summaries when the helper is available.

From a `release-planning-agents` checkout that contains `scripts/pr_review_run_report.py`:

```bash
zsh -lc 'lf_release_planning_agents --json traces get <trace-id>' > /tmp/pr-review-trace.json
uv run python scripts/pr_review_run_report.py \
  --langfuse-trace-json /tmp/pr-review-trace.json \
  --format markdown \
  --strict
```

For native artifacts that were already downloaded or exported:

```bash
uv run python scripts/pr_review_run_report.py \
  --artifact-dir <native-artifacts-dir> \
  --format markdown \
  --strict
```

Notes:

- The helper reads local files only. It does not fetch Langfuse or Sentry data, call GitHub APIs, mutate GitHub, publish reviews, or retry runs.
- Use non-strict mode for exploratory dry-run artifact directories when no publish result should exist.
- A redacted `prompt_token_estimate` is insufficient for operator audit; real secret-bearing keys must still stay redacted.
