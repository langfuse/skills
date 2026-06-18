# CLI recipes & gotchas for triage

Uses `langfuse-cli` via `npx` (see the `langfuse` skill for full CLI docs). These are the specific patterns and traps for pulling triage data. Always `export LANGFUSE_HOST=...` first.

## Gotchas (learned the hard way)
- **Observations use CURSOR pagination, not `--page`.** The next cursor is in `meta.cursor` (NOT `meta.nextCursor`). Pass it back via `--cursor`. `traces` and `scores` DO use `--page` + `meta.totalPages`.
- **Trace `scores` field returns score IDs (strings), not score objects.** To get values, pull scores separately via `scores list` and join on `traceId`.
- **Do NOT fire many `npx langfuse-cli` calls rapidly in a shell loop / in parallel / in the background** — they intermittently hang or write empty output. Drive pagination from a single sequential **Python subprocess** script instead (template below). One call at a time.
- **`ok:true` ≠ good.** Tool/retrieval success flags say nothing about content quality. Pull `io` and inspect the actual output for relevance/correctness.
- **Field groups** keep payloads small: traces → `core,io,metrics` (`scores` returns IDs only); observations → `core,basic,usage,model,metrics` and add `io` only when inspecting content. Use `--type` to filter observations (`GENERATION`, `TOOL`, `AGENT`, `SPAN`, `EVENT`, ...).
- **Filters:** the `--filter` JSON array (`[{type,column,operator,value,key}]`) is the most reliable way to combine time + environment + numeric thresholds. It takes precedence over the convenience flags.

## Step 1 — orient: what environments/names exist
```bash
npx langfuse-cli api traces list --limit 100 --order-by "timestamp.desc" \
  --from-timestamp "<ISO>" --fields "core" \
  | python3 -c "import sys,json;from collections import Counter;d=json.load(sys.stdin)['data'];\
print('env:',Counter(r['environment'] for r in d).most_common());\
print('name:',Counter(r['name'] for r in d).most_common())"
```
Identify and EXCLUDE evaluator executions (`environment=langfuse-llm-as-a-judge`, name `Execute evaluator: …`). Pick the product environment(s).

## Step 2 — pull app traces (page-based)
```bash
FILTER='[{"type":"datetime","column":"timestamp","operator":">=","value":"<ISO>"},
         {"type":"string","column":"environment","operator":"=","value":"default"}]'
npx langfuse-cli api traces list --limit 100 --order-by "timestamp.desc" \
  --filter "$FILTER" --fields "core,io,metrics" > /tmp/app_traces.json
# meta.totalPages tells you if you need more --page N calls
```

## Step 3 — pull scores (page-based) and join
```bash
npx langfuse-cli api scores list --limit 100 --page <N> \
  --from-timestamp "<ISO>" --environment "default" > /tmp/scores_pN.json
```
Join `score.traceId → score.name → score.stringValue/value` onto traces. Summarize per evaluator: count + value distribution. Watch for evaluators stuck at one constant value (dead-evaluator check).

## Step 4 — pull observations (CURSOR pagination) via Python driver
Write this to `/tmp/fetch_obs.py` and run it (set env first). Adjust `--type`, `--fields`, filters as needed; reuse for TOOL-only pulls by adding `--type TOOL` and `io` to fields.
```python
import subprocess, json, os, sys
base = ["npx","langfuse-cli","api","observations","list","--limit","100",
        "--from-start-time","<ISO>","--environment","default",
        "--fields","core,basic,usage,model,metrics"]   # add "io" / "--type","TOOL" as needed
rows=[]; cursor=None
for i in range(50):                                     # generous page cap
    cmd=list(base)+(["--cursor",cursor] if cursor else [])
    p=subprocess.run(cmd,capture_output=True,text=True,env=dict(os.environ))
    if p.returncode!=0: sys.stderr.write(p.stderr[:300]); break
    d=json.loads(p.stdout); rows+=d.get("data",[])
    cursor=(d.get("meta") or {}).get("cursor")
    sys.stderr.write(f"iter{i} total={len(rows)}\n")
    if not cursor or not d.get("data"): break
json.dump(rows,open("/tmp/obs_all.json","w")); sys.stderr.write(f"DONE {len(rows)}\n")
```

## Analysis snippets
- **Latency/cost percentiles:** load the JSON, sort, compute median/p90/p99/max per observation type and at trace level.
- **Retrieval relevance:** for each search tool call, tokenize the question (drop stopwords) and the returned titles; flag calls with zero overlap. Count distinct documents ever returned — a tiny set returned for unrelated queries = broken retrieval.
- **Session loops:** group traces by `input.sessionId`, sort by timestamp, print each turn's last user message + which scores fired. Look for "where is that?" / repeated questions.
- **Segmentation:** before concluding a dimension is clean, recompute it grouped by `version`, `release`, `promptVersion`, `model`, and top `userId`s.

## Useful columns for `--filter`
Traces: `timestamp, environment, name, userId, sessionId, tags, version, release, latency, totalCost, totalTokens, inputTokens, outputTokens, metadata`.
Observations: `type, name, level, statusMessage, startTime, latency, timeToFirstToken, totalCost, inputTokens, outputTokens, model, promptName, promptVersion, traceName, traceTags, metadata`.
