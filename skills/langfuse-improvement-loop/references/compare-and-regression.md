# Compare & Regression — CLI recipes

Concrete, copy-paste recipes for Steps ③ and ⑤. Assumes credentials are loaded and `LANGFUSE_HOST` is exported (see SKILL.md Setup).

---

## A. Publish a prompt to a `candidate` label (NOT production)

The in-repo `SYSTEM_PROMPT` is usually the source of truth; the publish script reads it. The label normally comes from `LANGFUSE_PROMPT_LABEL`.

**The trap:** many projects load env with dotenv `config({ override: true })`, which makes `.env` values *overwrite* anything you export in the shell. So this does **not** work:

```bash
LANGFUSE_PROMPT_LABEL=candidate npm run prompt:publish   # ❌ .env's "production" wins
```

**Reliable approach — set the label in `.env` for the run, then restore:**

```bash
# 1. edit .env: LANGFUSE_PROMPT_LABEL=candidate   (use the Edit tool, then:)
npm run typecheck && npm run prompt:publish
# 2. restore .env: LANGFUSE_PROMPT_LABEL=production
```

**Verify it landed on candidate, not production:**

```bash
npx langfuse-cli api prompts list --name <name>   # labels per version
```

## B. Recover if you published to `production` by accident

Labels are unique pointers; publishing moves `production` to the new version. To undo, move it back and relabel yours. The CLI ignores `--prompt-version` on `get` in some versions, so use raw REST to inspect, and `PATCH` to set labels:

```bash
# inspect each version (raw newlines break strict JSON → strict=False)
for v in 1 2 3 4; do
  curl -s -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
    "$LANGFUSE_HOST/api/public/v2/prompts/<name>?version=$v" > /tmp/v$v.json
  python3 -c "import json;d=json.loads(open('/tmp/v$v.json').read(),strict=False);\
print('v$v',d['labels'],len(d['prompt']))"
done

# move production back to the prior good version (e.g. 3)
curl -s -X PATCH -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
  -H "Content-Type: application/json" -d '{"newLabels":["production"]}' \
  "$LANGFUSE_HOST/api/public/v2/prompts/<name>/versions/3"

# put your new version (e.g. 4) on candidate
curl -s -X PATCH -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
  -H "Content-Type: application/json" -d '{"newLabels":["candidate"]}' \
  "$LANGFUSE_HOST/api/public/v2/prompts/<name>/versions/4"
```

`latest` is auto-managed (always the highest version number) and is fine to leave on your new version — the live app fetches by the `production` label.

---

## C. Run baseline + candidate over the same dataset

Make the run name carry the label so the two runs are distinguishable in the UI (one-line change in the runner):

```js
const runName = `myapp-${env.langfusePromptLabel}-${new Date().toISOString()}`;
```

Then run twice, flipping the label in `.env` between runs (same dotenv trap as above). These are real LLM calls — they take minutes; run in the background and wait for completion.

```bash
# .env label = production
npm run dataset:run        # → baseline run, prints avg scores + run URL
# edit .env label = candidate
npm run dataset:run        # → candidate run
# restore .env label = production
```

Each run prints `Average Scores` and a Dataset Run URL. Note both run names.

---

## D. Per-item regression diff (the part aggregates hide)

Map `datasetItemId → traceId` for both runs, pull the scores in the window, and diff every score per item.

```bash
# 1. fetch both runs' items
npx langfuse-cli api datasets get-get-run "<dataset>" "<baseline-run-name>"  > /tmp/run_base.json
npx langfuse-cli api datasets get-get-run "<dataset>" "<candidate-run-name>" > /tmp/run_cand.json

# 2. pull scores in the window (paginate; 100/page)
for p in 1 2 3; do
  npx langfuse-cli api scores list --from-timestamp <ISO> --limit 100 --page $p > /tmp/sc$p.json
done
```

```python
# 3. diff. python3 - <<'EOF'
import json, glob, statistics as st
base = {it['datasetItemId']: it['traceId'] for it in json.load(open('/tmp/run_base.json'))['datasetRunItems']}
cand = {it['datasetItemId']: it['traceId'] for it in json.load(open('/tmp/run_cand.json'))['datasetRunItems']}
scores = {}
for f in glob.glob('/tmp/sc*.json'):
    for s in json.load(open(f)).get('data', []):
        scores.setdefault(s['traceId'], {})[s['name']] = s['value']
items = sorted(set(base) & set(cand))
names = sorted({n for t in scores.values() for n in t})
def g(m, it, n): return scores.get(m.get(it), {}).get(n)
regress = []
for it in items:
    row = []
    for n in names:
        a, b = g(base, it, n), g(cand, it, n)
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            row.append(f"{n}:{a:.2f}->{b:.2f}")
            if b < a - 0.001: regress.append((it, n, a, b))
    print(it, '|', '  '.join(row))
for n in names:
    bv = [g(base, it, n) for it in items if isinstance(g(base, it, n), (int, float))]
    cv = [g(cand, it, n) for it in items if isinstance(g(cand, it, n), (int, float))]
    if bv and cv: print(f"AVG {n}: {st.mean(bv):.3f} -> {st.mean(cv):.3f}")
print("REGRESSIONS:", regress or "NONE")
# EOF
```

For every entry in `REGRESSIONS`, fetch the candidate answer and read it before judging:

```bash
npx langfuse-cli api traces get <candidate-traceId>   # inspect output.answer
```

Classify each: **real regression** (fix/reconsider) · **measurement artifact** (`expectedKeywords` phrasing shifted but correctness held) · **LLM-judge noise** (±0.05–0.1 single-pass). Ship only if the intent-evaluator rose on the target slice and no item's correctness guard dropped beyond noise.
