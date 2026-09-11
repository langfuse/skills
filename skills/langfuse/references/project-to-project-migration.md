---
name: langfuse-project-to-project-migration
description: Move data between Langfuse projects, regions, or deployments — including from a self-hosted OSS v2 instance to Langfuse Cloud via direct Postgres extraction.
metadata:
  required_access:
    - LANGFUSE_PROJECT_SCRIPT
    - LANGFUSE_PROJECT_INTERFACE
---

# Migrate data between Langfuse deployments

Interview first: source (Langfuse version, still running or not, access available — API keys, a Postgres connection string, or a DB backup), destination (Cloud region or self-hosted), scope (traces, scores, prompts, datasets, custom models, score configs; everything or from a cutoff date), and mode (plan only or execute). Before executing, tell the user: migrated data is billed as new ingestion in the destination, and LLM-as-a-Judge configs, dashboards, users/RBAC, project settings, and historical dataset run items must be recreated manually.

Fetch and follow the [self-hosted to Cloud migration guide](https://langfuse.com/faq/all/self-hosting-migrate-v2-to-langfuse-cloud) — it routes by source version (v3+: public API via the data-migration cookbook; OSS v2: direct Postgres extraction) and carries the schema links, table and attribute mappings, and idempotency guidance. Follow the links it gives (cookbook, v2 Prisma schema); never guess endpoints or column names.

## Execution protocol

1. **Sample first**: migrate ~10 traces spanning the date range, print direct destination links, and stop until the user confirms hierarchy, timestamps, usage/cost, and scores look correct.
2. **Full run**: paginate the source, print progress per page, collect failures with source IDs into a retry file instead of aborting, and skip trace IDs already sent in the sample.
3. **Reconcile**: compare source vs destination counts per data type and report the table.

Verify credentials by presence only; never print secret values.
