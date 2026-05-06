---
name: langfuse-error-analysis
description: Systematic error analysis of an LLM pipeline using Langfuse traces. Use when the user wants to understand how their system fails, build a failure category taxonomy, prioritise what to fix, and decide which failures need evaluators.
last_verified: 2026-05-06
---

# Error Analysis

## Primary Guide

**Fetch and follow the guide at this URL before doing anything else:**

https://langfuse-docs-git-update-error-analysis-blogpost-langfuse.vercel.app/guides/cookbook/error-analysis-llm-applications.md

The blog is the single source of truth for the process. Read it in full and execute exactly as it describes — its phases, ordering, and decision rules win over anything in this file. This file only provides the Langfuse-specific mechanics the blog assumes you can already do.

Fallback: If the URL is not available, search for "langfuse error analysis guide".

## Narration

**At the very start, give one high-level overview** of what's about to happen — the goal (understand *how* the system fails before deciding what to fix) and the rough shape of the work. Keep it to a few sentences. Don't enumerate every phase upfront. Then move straight into exploration; don't ask the user permission to start.

**Reveal phases as you enter them**, not before. The phases come from the blog, not the skill. Don't number them like "Step 1, Step 2" (the blog owns sequencing; baked-in numbers go stale if the blog reorders).

**Within a phase, prefer recap + IDs/links + what's next** over long preambles. The user wants to see what you did, not what you're about to do. Don't stop after each phase waiting for permission — only stop when a human decision is genuinely required (see Operating mode).

## Operating mode

**Discover and execute in the same turn unless blocked.** Automation is the default. Run exploration and setup yourself, then narrate what you did and what's left. Don't hand steps back to the user — pause only when a human decision genuinely cannot be made any other way (subjective annotation, taxonomy approval, product/fix decisions, missing credentials or scopes).

**Exploration mandate.** On the first message of an error-analysis request, immediately — in the same turn — do the following before asking the user to confirm anything:

1. Load `.env` and verify Langfuse env vars (see Environment & credentials).
2. Run the CLI discovery batch (see Discovery) to load command shapes.
3. Hit Langfuse via CLI to learn the lay of the land: trace counts and names, environments/tags, latency/cost ranges, existing annotation queues, existing score configs.
4. Inspect at least one trace's observation tree to confirm the GENERATION-vs-trace shape — don't ask the user "should I annotate the trace or the generation?"; figure it out and tell them what you found.

Only after that do you orient the user — *with* findings, not as a question they need to answer first.

**Split responsibilities — automation is the default:**

| Agent (you) | User (only when needed) |
|---|---|
| Filter/list traces, pick a diverse sample | Subjective annotation: open coding (pass/fail + notes) |
| Resolve GENERATION vs trace, attach observations | Approve / refine the taxonomy you proposed |
| Create score configs & annotation queues via API where the API allows it | Decide which fixes to ship |
| Pull aggregates, summarize distributions, compute failure rates | Provide secrets/access if blocked |
| Propose taxonomy drafts from exported open-coding notes | |
| Generate user-facing UI links with real IDs | |

If the API supports it, do it. The user's role is the things automation genuinely cannot replace.

**Use `Your turn: …` sparingly.** Reserve it for the human-only column above. After the user replies, continue automatically into the next phase. Never use it to ask permission for something you could just do.

**No handwaving on setup.** Report IDs and clickable links built from `${LANGFUSE_HOST}` plus the actual project / queue / observation / trace IDs you touched. If a step is UI-only (e.g. Hobby-plan labelling), give click-by-click instructions with the direct link.

**Blockers.** If you hit one (plan limits, missing scopes, ambiguous trace shape, persistent rate limits), say what's blocked in one sentence and offer the smallest workaround. Don't silently retry forever; don't pretend the obstacle isn't there.

**Discover once, execute many.** Run the discovery batch below before any actions; after that, execute commands directly. Only re-check `--help` for a specific call if it fails with `unknown option`.

**Cluster from the open-coding text, not from re-fetched trace I/O.** The user already distilled the observation when writing the note. Only fetch I/O for a specific trace when one note is genuinely ambiguous.

**Prompt fixes.** When a category warrants one, offer two paths — (a) versioned prompt in Langfuse, (b) drafted text change for the user to apply manually.

## Discovery (run once at the start)

Before executing any actions, load the CLI shape for the resources you'll touch in a single batch — this is the only `--help` walking you should do. After this, the command shapes stay in your working memory and you don't need to look them up again.

```bash
npx langfuse-cli api score-configs --help
npx langfuse-cli api score-configs create --help
npx langfuse-cli api annotation-queues --help
npx langfuse-cli api annotation-queues create --help
npx langfuse-cli api scores list --help
npx langfuse-cli api observations list --help
```

If any subcommand the blog assumes (e.g. a `delete` you need) is missing from a resource's `--help`, surface that to the user before proceeding.

## Environment & credentials

**Discover before asking.** At the start, check what's already available — only ask the user if everything below comes up empty.

1. **Project root:** `git rev-parse --show-toplevel` if in a git repo, otherwise the current working directory. Knowing the root lets you find `.env`, the app being analyzed, and any project-level docs (`CLAUDE.md`, `README.md`) that may name the bot/use case.
2. **Env vars:** check whether `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` are already exported.
3. **`.env` fallback:** if any are unset, source them from `.env` (or `.env.local`) at the project root.
4. **Host alias:** if the project uses `LANGFUSE_BASE_URL` instead of `LANGFUSE_HOST`, run `export LANGFUSE_HOST="$LANGFUSE_BASE_URL"`.

For curl fallbacks: `AUTH=$(echo -n "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" | base64)`.

User-facing queue link pattern: `${LANGFUSE_HOST}/project/<projectId>/annotation-queues/<queueId>` — never hardcode the host.

## Non-discoverable gotchas

These bite silently or in ways the CLI won't surface:

- **Annotate the GENERATION observation, not the trace.** In OpenTelemetry-instrumented apps, trace-level `input`/`output` is null. Add items to queues with `objectType: OBSERVATION` pointing to the GENERATION observation ID. `objectType: TRACE` shows nothing in the UI.
- **Score configs cannot be deleted.** List existing ones before creating.
- **Annotation queues cannot be updated or deleted.** Decide score configs *before* creating the queue.
- **Hobby plan caps queues at 1 per project.** A second `POST /api/public/annotation-queues` returns `405 "Maximum number of annotation queues reached on Hobby plan."`. When you need to add score configs after the queue already exists: create the configs at project level (they auto-appear in every trace's score panel) and tell the user to label from the **trace detail view** rather than the queue's side panel — that view surfaces all project-level configs.
- **CLI 429s look like success.** Response is `{ok: true, status: 429, body: "429 - rate limit exceeded"}`. Check `.status`, not `.ok`.
- **Sleep ≥1.5s between queue-item inserts** and retry on 429 with backoff. Lower values trigger 429s on EU Hobby.
- **`score-configs create --json` returns a null body** even on `status: 200`. Treat 200 as success and re-list to get the new ID.
- **`local status=...` is a reserved name** in macOS bash/zsh — use a different name (e.g. `code`).
- **`observations` has no `get` subcommand.** For single-observation lookups use `npx langfuse-cli api legacy-observations-v1s get <obsId> --json`.

## CLI gaps that force curl

Two creation operations have no CLI equivalent. Re-check `--help` for each before falling back — these blocks self-expire once the flags appear.

**CATEGORICAL score config** — `score-configs create` lacks `--categories`:

```bash
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "<config_name>",
    "dataType": "CATEGORICAL",
    "description": "<one sentence>",
    "categories": [{"label": "<labelA>", "value": 1}, {"label": "<labelB>", "value": 0}]
  }' "${LANGFUSE_HOST}/api/public/score-configs"
```

**Annotation queue creation** — `annotation-queues create` lacks `--scoreConfigIds`:

```bash
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "<descriptive name with date>",
    "description": "<optional>",
    "scoreConfigIds": ["<id1>", "<id2>"]
  }' "${LANGFUSE_HOST}/api/public/annotation-queues" | jq '{id, name}'
```
