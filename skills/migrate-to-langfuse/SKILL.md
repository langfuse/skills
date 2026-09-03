---
name: migrate-to-langfuse
description: >-
  Migrate to Langfuse from another LLM observability/evals platform (LangSmith, Arize AX, Phoenix, Braintrust, Helicone, Promptfoo, ...). A one-off vendor switch: live tracing cutover plus transfer of historical traces, datasets, prompts, and evaluators. Not for anything Langfuse-to-Langfuse — SDK or version upgrades, project/region moves, self-hosted to Cloud — and not for moving in-code prompts into Langfuse; the main langfuse skill covers those.
allowed-tools:
  - WebFetch(domain:langfuse.com)
  - Bash(curl *langfuse.com/*)
---

# Migrate to Langfuse

You are running a one-off vendor switch to Langfuse. Interview first, plan second, execute only after confirmation. Never implement from memory — fetch the current Langfuse docs listed below at execution time.

## 1. Interview (always, before any code)

Ask only what you cannot detect. Inspect the repo first: dependencies and imports usually reveal the source platform (`langsmith`, `arize`, `phoenix`, `braintrust`, `openinference`, old `langfuse` pins).

1. **Source** — which platform and version? Cloud or self-hosted? What access exists: API keys, a database connection, or only the application repo?
2. **Destination** — Langfuse Cloud (which region) or self-hosted? Verify credentials by presence only (e.g. `[ -n "$LANGFUSE_SECRET_KEY" ]`); never ask for secrets in chat, and never access `.env` contents or key values by any means — no shell commands that echo them, no reading `.env` with file tools, no grepping for values. Detect which variable names are set, nothing more.
3. **Scope** — which of: live tracing cutover, historical traces, datasets, prompts, evaluators/LLM judges, experiment code. For history: everything or from a cutoff date?
4. **Mode** — plan only (a written runbook) or execute?

If the request contradicts the repository (it names a platform that is not present, or asks to upgrade an SDK that is not installed), stop and reconcile with the user first — never reinterpret the request as a different migration and start executing it.

Present the resulting plan (scope table plus order of operations) and get the user's confirmation before changing any file. However imperative the request sounds, it does not authorize removing or replacing the existing vendor's instrumentation before the plan is confirmed.

## 2. Defaults to apply

- **Live cutover first.** Historical data migration is optional and billed as new ingestion in Langfuse — say so before migrating history. If the source already emits OTel/OpenInference spans, repoint the exporter instead of re-instrumenting.
- **Datasets and prompts copy. Evaluators and judges are recreated.** Experiment code is rewritten and re-run against the migrated dataset; never import old experiment scores.
- **Test on a sample before the full run.** Migrate ~10 traces first, link the destination traces, and wait for the user to confirm they look correct before migrating everything.
- **Show progress** (pages/counts) during long runs and make re-runs idempotent (deterministic destination IDs).
- **Parallel-run window.** Keep the old exporter until the user confirms the destination data, then remove it in a separate, explicit step. This binds the implementation, not just the plan: after your edits, the old vendor's exporter/instrumentation must still be present and active. Before showing a diff, re-check that no vendor import or register call was deleted or replaced. Implement parallel export as **one instrumentation with two exporters** (both span processors on the same tracer provider) — never instrument the application twice. Duplicated generations and double-counted costs in the destination are the symptom of a second capture path.

## 3. Route by scenario

Fetch and follow; do not reproduce their content:

| Scenario | Source of truth |
| --- | --- |
| Vendor with a published guide (Arize AX, Phoenix, Braintrust, Helicone, Promptfoo, ...) | `https://langfuse.com/resources/engineering/migrate-from-<vendor>.md` — check `https://langfuse.com/llms.txt` for the current list |
| Vendor without a published guide, or historical data from any vendor | references/reingest-history.md, plus the vendor's own export API docs |

Historical-trace reingestion is never improvised: read references/reingest-history.md in full before writing or running any reingestion code, even when a vendor guide exists. The vendor guide covers extraction; the reference governs reingestion — deterministic IDs, raw OTLP payloads, original timestamps, the cutover-time bound, and the warning that imported history is billed as new ingestion.

If the source turns out to be another Langfuse deployment (an older version, a different project, region, or host), stop — that is not a vendor switch. Point the user to the main langfuse skill (its SDK-upgrade and v4-migration references) and the [project-to-project migration cookbook](https://langfuse.com/guides/cookbook/example_data_migration).

For the live instrumentation cutover, use the integration guide matching the user's framework or SDK from https://langfuse.com/llms.txt. For deep Langfuse-side work (prompt creation, dataset APIs, experiment code), defer to the main langfuse skill if installed.

## 4. Verify and close

- Sample check confirmed by the user in the destination UI before the full run.
- Before asking the user to confirm a live-cutover sample, audit it yourself via the Langfuse API or CLI: one trace per request; the root span named after the agent/app (and the trace named after the root); every span type present (generations **and** tool/chain spans); each LLM call captured exactly once; token usage and cost populated. Only then send the user the trace links.
- Counts match per migrated data type (source vs destination); report a summary table including failures.
- Live traffic arrives in the destination; the old exporter is removed only after the parallel-run window the user chose.
