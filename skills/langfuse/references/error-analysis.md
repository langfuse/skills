---
name: langfuse-error-analysis
description: Systematic error analysis of an LLM pipeline using Langfuse traces. Use when the user wants to understand how their system fails, build a failure category taxonomy, prioritise what to fix, and decide which failures need evaluators.
---

# Error Analysis

## Primary Guide

**1. Fetch the guide in this blogpost**

https://langfuse-docs-git-update-error-analysis-blogpost-langfuse.vercel.app/guides/cookbook/error-analysis-llm-applications

Read it in full. It defines the authoritative 5-step process (sample selection → open coding → clustering → labelling → deciding what to fix).

**2. Guide the user through this step by step**

You as a coding agent and the user go through this together to perform a full error analysis with their data in langfuse. Do everything you can achieve via CLI (look up traces, create annotation queues, ...) for the user. Provide them with direct links to UI wherever their action is required. Be proactive and narrate what is going on for the user. 

## Rules CRITICAL
Use Langfuse CLI wherever possible
Use charts where possible to display data

---

## Langfuse Implementation Notes

The guide describes the process. These notes cover the Langfuse-specific API and CLI mechanics required to execute it.

### Credentials

```bash
echo $LANGFUSE_PUBLIC_KEY   # pk-lf-...
echo $LANGFUSE_SECRET_KEY   # sk-lf-...
echo $LANGFUSE_HOST         # https://cloud.langfuse.com (EU), https://us.cloud.langfuse.com (US), or self-hosted
```

If not set, check `.env` in the project root: `export $(grep -v '^#' .env | xargs)`. If `LANGFUSE_BASE_URL` is used instead of `LANGFUSE_HOST`, run `export LANGFUSE_HOST="$LANGFUSE_BASE_URL"`.

```bash
AUTH=$(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)
```

### Annotation target: OBSERVATION not TRACE

> **CRITICAL:** In OpenTelemetry-instrumented apps, trace-level `input`/`output` is null — content lives in a GENERATION observation. Always add `objectType: OBSERVATION` pointing to the GENERATION observation ID to annotation queues. Adding `objectType: TRACE` shows nothing in the UI.

Inspect the observation tree of a sample trace to confirm which observation to target:

```bash
npx langfuse-cli@latest api observations list \
  --trace-id <traceId> --type GENERATION --fields core,basic,io --json 2>&1 \
  | jq '.body.data[] | {id, name, type, input: (.input // "" | .[0:200]), output: (.output // "" | .[0:200])}'
```

### Score configs

Check before creating — configs cannot be deleted:

```bash
curl -s -H "Authorization: Basic $AUTH" "${LANGFUSE_HOST}/api/public/score-configs" \
  | jq '[.data[] | {name, dataType, description}]'
```

Create open-coding configs:

```bash
# open_coding (TEXT)
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "open_coding",
    "dataType": "TEXT",
    "description": "Describe what is happening in this trace and what (if anything) seems wrong. Focus on observable behaviour — do not diagnose root causes."
  }' "${LANGFUSE_HOST}/api/public/score-configs"

# pass_fail_assessment (CATEGORICAL) — use curl, not CLI (CLI lacks categories flag)
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "pass_fail_assessment",
    "dataType": "CATEGORICAL",
    "description": "Overall judgement: did the assistant handle this interaction well?",
    "categories": [{"label": "Pass", "value": 1}, {"label": "Fail", "value": 0}]
  }' "${LANGFUSE_HOST}/api/public/score-configs"
```

Create one `BOOLEAN` config per failure category (Step 4 of the guide):

```bash
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "<category_name>",
    "dataType": "BOOLEAN",
    "description": "<one sentence: what does true mean for this trace?>"
  }' "${LANGFUSE_HOST}/api/public/score-configs"
```

### Annotation queues

> **CRITICAL:** Queues cannot be updated or deleted after creation. Create score configs first, then the queue with all config IDs. To add new configs later, create a new queue.

```bash
curl -s -X POST -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
  --data '{
    "name": "<YYYY-MM-DD> Open Coding - <Use Case>",
    "description": "Error analysis sample: ~100 representative traces.",
    "scoreConfigIds": ["<id1>", "<id2>"]
  }' "${LANGFUSE_HOST}/api/public/annotation-queues" | jq '{id, name}'
```

Add GENERATION observations (not traces) to the queue, with rate limiting:

```bash
while IFS= read -r traceId; do
  obsId=$(npx langfuse-cli@latest api observations list \
    --trace-id "$traceId" --type GENERATION --fields core --json 2>&1 \
    | jq -r '.body.data[0].id // empty')
  [ -z "$obsId" ] && continue
  npx langfuse-cli@latest api annotation-queues post-create-queue-item "$QUEUE_ID" \
    --objectId "$obsId" --objectType OBSERVATION --json 2>&1 | jq -r '.body.id'
  sleep 0.4
done < <(jq -r '.[].id' /tmp/sample_100.json)
```

**Always give the user a direct link immediately after creating a queue:**

| Host | URL pattern |
|------|-------------|
| EU cloud | `https://cloud.langfuse.com/project/<projectId>/annotation-queues/<queueId>` |
| US cloud | `https://us.cloud.langfuse.com/project/<projectId>/annotation-queues/<queueId>` |
| Self-hosted | `<LANGFUSE_HOST>/project/<projectId>/annotation-queues/<queueId>` |

Instruction to give: *"Please open code the first ~50 examples. For each trace, write what you observe in the `open_coding` field (describe behaviour, don't diagnose root causes), then set `pass_fail_assessment` to Pass or Fail."*

### Pulling scores for clustering

```bash
curl -s -H "Authorization: Basic $AUTH" \
  "${LANGFUSE_HOST}/api/public/scores?queueId=${QUEUE_ID}&limit=100&page=1" \
  > /tmp/scores_p1.json

jq -s '[.[].data[]] | group_by(.observationId) | map({
  obsId: .[0].observationId,
  verdict: (map(select(.name == "pass_fail_assessment")) | .[0].stringValue),
  open_coding: (map(select(.name == "open_coding")) | .[0].stringValue)
})' /tmp/scores_p1.json
```

### Failure rate computation

```python
import json
from collections import defaultdict

with open('/tmp/all_scores.json') as f:
    scores = json.load(f)

category_cols = ['<cat1>', '<cat2>']  # your category names

labeled = defaultdict(dict)
for s in scores:
    if s['name'] in category_cols:
        labeled[s['observationId']][s['name']] = (s['value'] == 1)

fully_labeled = {k: v for k, v in labeled.items() if len(v) == len(category_cols)}
n = len(fully_labeled)

rates = {col: sum(1 for v in fully_labeled.values() if v.get(col)) / n
         for col in category_cols}

for name, rate in sorted(rates.items(), key=lambda x: -x[1]):
    print(f"{name:<35} {rate:.0%}  {'█' * round(rate * 20)}")
```

### Prompt fixes

When a category warrants a prompt fix, always offer the user two options:
1. Create it as a versioned prompt in Langfuse (tracked, usable via the prompt API)
2. Draft the specific text change for them to review and apply

### Setup evaluators

When a category warrants an evaluator setup, propose the type of evaluator and offer to set it up for user via CLI

### Common gotchas

| Mistake | Fix |
|---------|-----|
| `objectType: TRACE` in queue | Use `objectType: OBSERVATION` with GENERATION obs ID |
| Creating score config without checking existing | `GET /api/public/score-configs` first; can't delete |
| Queue created before score configs | Create configs → collect IDs → create queue |
| `--limit` > 100 on traces list | API hard cap; paginate with `--page` |
| No rate limiting on queue item creation | `sleep 0.4` between calls to avoid 429 |
