---
name: langfuse-judge-calibration
description: Calibrate and validate LLM-as-a-Judge evaluators against human labels before relying on them for product decisions. Use when users ask whether a judge is helpful/reliable, or when they need Accuracy/Precision/Recall/F1 ingestion and reporting.
---

# Judge Calibration (LLM-as-a-Judge)

Use this guide whenever a user asks if their LLM judge is actually useful, aligned with human judgment, or safe to trust for monitoring decisions.

## When this guide is mandatory

Always use this flow when the request involves:
- "is my LLM judge helpful / reliable / doing the right thing?"
- calibration of judge outputs against human labels
- ingesting or interpreting Accuracy, Precision, Recall, F1 for a judge
- choosing thresholds or deciding whether to ship judge-based automation

## Goal

Validate a **binary judge** against human labels and instrument per-item signals so aggregate metrics are reliable.

- Positive label example: `ESCALATE`
- Negative label example: `RESOLVE`
- Base per-item metric: `exact_match` (0/1)

## 1) Dataset and split discipline (from `validate-evaluator`)

Do not calibrate on the same examples used to claim final quality.

Use three disjoint splits:
- **Train (10–20%)**: few-shot examples for the judge prompt
- **Dev (40–45%)**: iterative prompt/model refinement
- **Test (40–45%)**: single final calibration pass

Use balanced classes in dev+test when possible so both error directions are measurable.

## 2) Deterministic per-item classification mapping

For each row with `expected` and `actual` labels:

- **TP**: expected = positive and actual = positive
- **FP**: expected = negative and actual = positive
- **FN**: expected = positive and actual = negative
- **TN**: expected = negative and actual = negative

Also compute:
- `exact_match = 1 if actual == expected else 0`

## 3) Ingestion contract (per interaction)

Ingest at least these scores:
- `exact_match` (0/1)
- `is_tp` (0/1)
- `is_fp` (0/1)
- `is_fn` (0/1)
- optional: `is_tn` (0/1)

Recommended metadata:
- `expected_label`, `actual_label`
- evaluator prompt name+version
- dataset/split version (train/dev/test)
- run identifier

## 4) Aggregate metrics

From aggregate counts:
- `accuracy = (TP + TN) / total`
- `precision = TP / (TP + FP)`
- `recall = TP / (TP + FN)`
- `f1 = 2 * precision * recall / (precision + recall)`

Guardrails:
- if `TP + FP == 0`, precision is undefined (report null + note)
- if `TP + FN == 0`, recall is undefined (report null + note)
- if `precision + recall == 0`, set `f1 = 0`

## 5) Judge-calibration quality gates

Before trusting the judge on production traffic:

1. **Dev/Test split integrity**: no leakage from dev/test into prompt examples.
2. **Confusion matrix sanity**: `TP + FP + FN + TN == total`.
3. **Metric recomputation check**: recompute aggregate stats from row-level flags and compare.
4. **TPR/TNR review** (from validate-evaluator):
   - `TPR = TP / (TP + FN)`
   - `TNR = TN / (TN + FP)`
5. **Threshold**: target `TPR > 0.90` and `TNR > 0.90` before high-stakes automation.

Why include TPR/TNR in addition to precision/recall/F1? They directly expose class-direction bias and are foundational for bias correction methods used in evaluator validation.

## 6) Minimal Python skeleton

```python
POSITIVE = "ESCALATE"


def classify(expected: str, actual: str):
    tp = int(expected == POSITIVE and actual == POSITIVE)
    fp = int(expected != POSITIVE and actual == POSITIVE)
    fn = int(expected == POSITIVE and actual != POSITIVE)
    tn = int(expected != POSITIVE and actual != POSITIVE)
    exact_match = int(expected == actual)
    return exact_match, tp, fp, fn, tn
```

## 7) Common failure modes

- label vocabulary not constrained (judge outputs free text instead of strict labels)
- positive/negative label inversion between annotators and evaluator code
- reporting only accuracy on imbalanced datasets
- calculating F1 without explicit zero-denominator handling
- reusing dev examples as prompt few-shots (data leakage)

## 8) What to do after calibration

- If metrics are weak: iterate prompt and few-shots on **dev only**.
- If metrics pass: run once on **test**, freeze baseline, and monitor drift over time.
- For qualitative diagnosis of disagreements, switch to `references/error-analysis.md`.
