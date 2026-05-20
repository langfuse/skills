---
name: langfuse-judge-calibration
description: Calibrate and validate LLM-as-a-Judge evaluators against dataset ground truth. Runs the judge prompt as a Langfuse dataset experiment, compares judge outputs with dataset item expected outputs, and reports simple accuracy or advanced confusion-matrix metrics.
---

# Judge Calibration (LLM-as-a-Judge)

Use this guide whenever a user asks if their LLM judge is actually useful,
aligned with human judgment, or safe to trust for monitoring decisions.

## When this guide is mandatory

Always use this flow when the request involves:
- "is my LLM judge helpful / reliable / doing the right thing?"
- calibration of judge outputs against human labels
- simple accuracy checks for judge outputs
- confusion matrices, Accuracy, Precision, Recall, F1, TPR, or TNR
- choosing thresholds or deciding whether to ship judge-based automation

## Goal

Validate judge outputs against human labels using the smallest reliable workflow
for the user's goal.

Default to a **Langfuse dataset experiment** when the user has a Langfuse
dataset or wants results in the Langfuse Experiments UI.

Default to **simple calibration** unless the user asks for deeper metrics,
split-based validation, thresholding, or production automation.

## 1) Choose the calibration mode

### Simple calibration

Use this when the user wants a quick answer like "does this judge basically
match human labels?" or explicitly asks for accuracy only.

- No train/dev/test split is required.
- Compute `exact_match` for each valid row.
- Report valid sample size, invalid-label count, accuracy, and a short
  recommendation.
- Do not include Precision/Recall/F1, TPR/TNR, denominator notes, or top failure
  direction unless the user asks for advanced metrics.

### Advanced calibration

Use this when the user asks for confusion matrix metrics, thresholds,
production monitoring, high-stakes automation, or train/test-style validation.

- If split labels exist, keep train/dev/test separate.
- If no split exists, compute metrics on the provided rows and state that this is
  not a held-out final quality claim.
- Compute TP/FP/FN/TN and derived metrics.
- Use `references/error-analysis.md` for qualitative diagnosis of disagreements.

## 2) Primary workflow

1. Confirm the dataset name, ground-truth label location in `expectedOutput`,
   judge prompt name/version, judge model, and label vocabulary.
2. Choose simple or advanced mode. If ambiguous, use simple mode.
3. Run the judge prompt against each dataset item input as a Langfuse experiment.
4. Compare the judge output to `item.expected_output` in evaluator functions.
5. Return the matching report format from section 7.

## 3) Langfuse experiment workflow

Use the SDK experiment runner as the default implementation. A Langfuse-hosted
dataset automatically creates a dataset run that can be inspected and compared
in the Langfuse UI.

```python
from datetime import datetime, timezone
from langfuse import Evaluation, get_client

langfuse = get_client()
dataset = langfuse.get_dataset("<dataset_name>")
prompt = langfuse.get_prompt("eval_template.prompt", label="production")

POSITIVE = "ESCALATE"
NEGATIVE = "RESOLVE"
ALLOWED = {POSITIVE, NEGATIVE}


def normalize(label):
    return str(label).strip().upper()


def extract_ground_truth(expected_output):
    # Adjust this to the dataset schema, e.g. expected_output["label"].
    return normalize(expected_output)


def compile_prompt(item_input):
    if isinstance(item_input, dict):
        return prompt.compile(**item_input)
    return prompt.compile(input=item_input)


def call_judge_model(messages_or_prompt):
    # Call the LLM provider here. The response must be one strict label.
    raise NotImplementedError


def judge_task(*, item, **kwargs):
    # Do not read item.expected_output here; the task is the judge under test.
    compiled = compile_prompt(item.input)
    return normalize(call_judge_model(compiled))


def exact_match_evaluator(*, output, expected_output, **kwargs):
    expected = extract_ground_truth(expected_output)
    actual = normalize(output)
    if expected not in ALLOWED or actual not in ALLOWED:
        return Evaluation(
            name="judge-exact-match",
            value=0,
            data_type="BOOLEAN",
            metadata={
                "valid": 0,
                "expected_label": expected,
                "actual_label": actual,
            },
        )
    return Evaluation(
        name="judge-exact-match",
        value=int(actual == expected),
        data_type="BOOLEAN",
        metadata={
            "valid": 1,
            "expected_label": expected,
            "actual_label": actual,
        },
    )


def accuracy_run_evaluator(*, item_results, **kwargs):
    matches = []
    invalid = 0

    for item_result in item_results:
        for evaluation in item_result.evaluations:
            if evaluation.name != "judge-exact-match":
                continue
            if evaluation.metadata and evaluation.metadata.get("valid") == 0:
                invalid += 1
                continue
            matches.append(int(evaluation.value))

    valid_rows = len(matches)
    accuracy = sum(matches) / valid_rows if valid_rows else 0

    return Evaluation(
        name="judge-accuracy",
        value=accuracy,
        comment=(
            f"{sum(matches)}/{valid_rows} exact matches"
            if valid_rows
            else "Undefined: no valid labels"
        ),
        metadata={
            "valid_rows": valid_rows,
            "invalid_labels": invalid,
            "defined": int(valid_rows > 0),
        },
    )


run_name = f"judge-calibration-{datetime.now(timezone.utc).isoformat()}"
result = dataset.run_experiment(
    name=run_name,
    description="Calibrate eval_template.prompt against dataset expected outputs",
    task=judge_task,
    evaluators=[exact_match_evaluator],
    run_evaluators=[accuracy_run_evaluator],
    max_concurrency=5,
    metadata={
        "calibration_mode": "simple",
        "judge_prompt": "eval_template.prompt",
        "positive_label": POSITIVE,
        "negative_label": NEGATIVE,
    },
)

print(result.format())
print(result.dataset_run_url)
```

For advanced calibration, add an evaluator that returns `Evaluation` objects for
`judge-is-tp`,
`judge-is-fp`, `judge-is-fn`, and `judge-is-tn`, plus a run evaluator that
computes aggregate Precision/Recall/F1, TPR, and TNR from all item results.

Rules:
- Use a Langfuse-hosted dataset when the user wants a real Langfuse experiment.
  Local SDK datasets create traces and scores, but not Langfuse dataset runs.
- The dataset item `input` must contain everything needed to run the judge
  prompt. The dataset item `expectedOutput` must contain the ground-truth label.
- Never pass `expectedOutput` into the judge prompt or task. That would leak the
  answer and invalidate calibration.
- Return `Evaluation(...)` objects from item and run evaluators for stable SDK
  formatting and score ingestion.
- Store prompt name/version, judge model, label vocabulary, dataset version, and
  calibration mode in run metadata.
- Use a unique run name so the experiment appears as a separate dataset run.

## 4) Label validation

Never silently treat unknown labels as negative.

- For binary judges, define the positive and negative labels before computing
  confusion-matrix metrics.
- Normalize only deterministic differences such as surrounding whitespace or
  casing, and mention that normalization was applied.
- Rows where `expected` or `actual` is outside the allowed label set are invalid.
  Exclude them from metric denominators and report the invalid count.
- For multi-class judges, use simple `exact_match` / accuracy unless the user
  defines one positive class for binary metrics.

Example binary labels:
- Positive: `ESCALATE`
- Negative: `RESOLVE`

## 5) Simple metrics

For each valid row:

- `exact_match = 1 if actual == expected else 0`

Aggregate:

- `accuracy = sum(exact_match) / valid_rows`

If `valid_rows == 0`, report that accuracy is undefined and ask for valid
expected/actual labels.

## 6) Advanced metrics

### Dataset and split discipline

Use split discipline only when the user asks for advanced validation or final
quality claims.

- **Train**: optional few-shot examples for the judge prompt
- **Dev**: iterative prompt/model refinement
- **Test**: single final calibration pass

Do not tune on the same rows used to claim final quality. Use balanced classes
in dev/test when possible so both error directions are measurable.

### Per-row classification mapping

For each row with `expected` and `actual` labels:

- **TP**: expected = positive and actual = positive
- **FP**: expected = negative and actual = positive
- **FN**: expected = positive and actual = negative
- **TN**: expected = negative and actual = negative

Also compute:
- `exact_match = 1 if actual == expected else 0`

### Aggregate metrics

From aggregate counts:
- `accuracy = (TP + TN) / valid_rows`
- `precision = TP / (TP + FP)`
- `recall = TP / (TP + FN)`
- `f1 = 2 * precision * recall / (precision + recall)`
- `TPR = TP / (TP + FN)`
- `TNR = TN / (TN + FP)`

Guardrails:
- if `TP + FP == 0`, precision is undefined (report null + note)
- if `TP + FN == 0`, recall and TPR are undefined (report null + note)
- if `TN + FP == 0`, TNR is undefined (report null + note)
- if `precision + recall == 0`, set `f1 = 0`

### Advanced quality gates

Before trusting the judge on production traffic:

1. **Split integrity**: no leakage from held-out rows into prompt examples.
2. **Confusion matrix sanity**: `TP + FP + FN + TN == valid_rows`.
3. **Metric recomputation check**: recompute aggregate stats from row-level
   flags and compare.
4. **TPR/TNR review**: inspect both directions for class-direction bias.
5. **Threshold**: target `TPR > 0.90` and `TNR > 0.90` before high-stakes
   automation.

## 7) Report format

### Simple report

Return only:
- dataset name and dataset run URL when available
- valid rows / total rows
- invalid-label count
- accuracy
- one-sentence recommendation

### Advanced report

Add:
- confusion matrix: TP, FP, FN, TN
- accuracy, precision, recall, F1, TPR, TNR
- denominator notes for undefined metrics
- top failure direction: false positives or false negatives
- recommendation: ship, iterate, collect more labels, or do not automate

## 8) Langfuse implementation notes

Prefer SDK experiment evaluators for score creation. They attach item-level
scores to the experiment traces and run-level scores to the dataset run.

Use manual REST score creation only as a fallback when not using the SDK
experiment runner, or for local smoke tests. Do not use the current
`langfuse-cli` score-create wrapper unless `--help` shows a usable `value`
argument; `langfuse-cli@0.0.10` exposes `legacy-score-v1s create` but cannot
pass the required score `value`.

Simple mode:
- `judge-exact-match`
- `judge-accuracy`

Advanced mode:
- `judge-exact-match`
- `judge-is-tp`
- `judge-is-fp`
- `judge-is-fn`
- `judge-is-tn`

Recommended metadata:
- `expected_label`, `actual_label`
- calibration mode: `simple` or `advanced`
- positive/negative labels when binary metrics are used
- evaluator prompt name+version
- dataset/split version when used
- run identifier

Minimal REST example:

```bash
curl -sS -X POST "$LANGFUSE_HOST/api/public/scores" \
  -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "traceId": "trace-id",
    "name": "judge-exact-match",
    "value": 1,
    "dataType": "BOOLEAN",
    "metadata": {
      "calibration_mode": "simple",
      "expected_label": "ESCALATE",
      "actual_label": "ESCALATE",
      "run_id": "calibration-2026-05-21"
    }
  }'
```

## 9) Minimal Python skeleton

```python
POSITIVE = "ESCALATE"
NEGATIVE = "RESOLVE"
ALLOWED = {POSITIVE, NEGATIVE}


def normalize(label: str) -> str:
    return str(label).strip().upper()


def classify(expected: str, actual: str):
    expected = normalize(expected)
    actual = normalize(actual)

    if expected not in ALLOWED or actual not in ALLOWED:
        return {
            "valid": 0,
            "invalid": 1,
            "expected_label": expected,
            "actual_label": actual,
        }

    return {
        "valid": 1,
        "invalid": 0,
        "exact_match": int(expected == actual),
        "is_tp": int(expected == POSITIVE and actual == POSITIVE),
        "is_fp": int(expected == NEGATIVE and actual == POSITIVE),
        "is_fn": int(expected == POSITIVE and actual == NEGATIVE),
        "is_tn": int(expected == NEGATIVE and actual == NEGATIVE),
        "expected_label": expected,
        "actual_label": actual,
    }
```

## 10) Common failure modes

- label vocabulary not constrained (judge outputs free text instead of strict
  labels)
- positive/negative label inversion between annotators and evaluator code
- leaking `expectedOutput` into the judge task instead of only the evaluator
- using local SDK data when the user expects a Langfuse dataset run in the UI
- reporting only accuracy when classes are imbalanced and error direction matters
- calculating F1 without explicit zero-denominator handling
- using advanced validation claims without a held-out split

## 11) What to do after calibration

- If simple accuracy is enough: report it and stop.
- If metrics are weak and advanced validation is needed: iterate prompt and
  few-shots on dev data only.
- If metrics pass: freeze the baseline and monitor drift over time.
- For qualitative diagnosis of disagreements, switch to
  `references/error-analysis.md`.
