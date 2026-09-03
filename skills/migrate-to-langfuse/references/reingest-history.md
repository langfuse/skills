---
name: migrate-to-langfuse-reingest-history
description: Write and run a script that extracts traces, scores, datasets, and prompts from a source system and reingests them into Langfuse with original timestamps.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_SCRIPT
---

# Reingest historical data into Langfuse

Build a one-off script: extract from the source, transform to the Langfuse observation model, reingest. Extract using the source vendor's **documented** export mechanism (SDK export client or documented API, as named in the matching migration guide on langfuse.com) — never guess REST endpoints or hostnames. If an export call fails with 404/405, stop and re-read the vendor guide instead of trying endpoint variants. Adapt the working implementation in the [project-to-project migration cookbook](https://langfuse.com/guides/cookbook/example_data_migration) — its OTLP reingestion, retry, and ID-mapping code applies to any source.

## Transform target

Fetch [migrate custom ingestion to v4](https://langfuse.com/integrations/native/opentelemetry/migration-to-v4) for the current span format and attributes. Non-negotiables:

- POST OTLP JSON to `/api/public/otel/v1/traces`, building the payload as plain JSON — the only path that preserves original `start_time`/`end_time`. Do not create the spans through an OTel or Langfuse SDK tracer: tracers assign new timestamps and random trace/span IDs, and offer no way to set either.
- Destination IDs must be OTel-shaped: 32-hex-char trace IDs, 16-hex-char span IDs. Derive them deterministically from source IDs (e.g. a sha256 prefix) so re-runs upsert instead of duplicating. Verify after the sample run that the destination trace IDs match the computed ones — if they do not, the spans went through a tracer.
- Map source spans to Langfuse observation types (generation, tool, agent, span) and set `gen_ai.usage.*` and model attributes so token usage and cost tracking work. Put user, session, tags, and metadata in the documented `langfuse.*` trace attributes; overall input/output goes on the root observation.

## Migration order

Dependencies dictate order: score configs → custom model definitions → prompts (all versions, in version order, then labels) → observations (traces) → scores → datasets (items, then run items linked to migrated traces). Skip whatever the user excluded in the interview.

Not migratable via API (tell the user; do not attempt): LLM-as-a-Judge evaluator configurations, custom dashboards, users/RBAC, project settings. Recreate evaluators in the destination instead, and re-run experiments rather than importing their scores.

## Execution protocol

1. **Cutoff filter** from the interview goes into the source extraction query, not post-hoc filtering. If the live cutover already happened, also bound the window at the cutover time — traces after it are already arriving in the destination, and reingesting them duplicates data.
2. **Sample run first**: ~10 traces spanning the date range. Print direct links to the destination traces and stop until the user confirms they look correct — hierarchy, timestamps, token usage and cost, scores attached.
3. **Full run**: paginate the source, batch the ingestion, print progress (`page X — N traces migrated, M failed`), and collect failures with their source IDs into a retry file instead of aborting. Skip the trace IDs already sent in the sample run — re-sending them is billed again and is wasteful even though deterministic IDs make it safe.
4. **Reconcile**: compare source vs destination counts per data type and report the table. Count **distinct observation IDs**, not rows: Langfuse deduplicates same-ID re-ingests asynchronously, so an API listing taken shortly after a re-send can show the same observation twice until the background merge collapses it. Same-ID doubles are transient, not a migration bug. Remind the user that reingested history is billed as new ingestion.

Historical cost may differ from what the source displayed: the destination recomputes cost from current model prices unless the source's actual cost is carried in the documented cost attributes.

Verify credentials by presence only (`[ -n "$LANGFUSE_SECRET_KEY" ]`); never print secret values.
