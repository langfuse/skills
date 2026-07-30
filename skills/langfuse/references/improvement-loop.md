---
name: langfuse-improvement-loop
description: Symptom-to-fix Langfuse workflow. Use when the user reports an LLM or agent application problem and wants to identify the root cause, choose the right fix, encode failures as evaluation coverage, and prove improvement with dataset runs before promotion.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_INTERFACE
    - LANGFUSE_PROJECT_SCRIPT
---

# Langfuse Improvement Loop

## Current Sources

Fetch current Langfuse docs before implementation. Use the docs for tracing, scores, datasets, dataset runs, evaluations, and prompt management when the candidate fix touches prompts.

Use CLI schema/help discovery for current Langfuse API mechanics. Do not hard-code CLI recipes here.

## Workflow

Run the improvement loop step by step:

1. Restate the reported symptom as a measurable trace, score, evaluator, or user-feedback pattern over a defined time window.
2. Inspect Langfuse project data to find concrete examples and confirm whether the symptom repeats.
3. Identify the likely root cause from traces and, when available, source code or prompt behavior.
4. Propose fix options with tradeoffs: prompt, retrieval, context assembly, tool wiring, application logic, model choice, or measurement first.
5. Get the user's approval for the selected fix path and any live project mutation.
6. Make the candidate change behind a reversible boundary such as a branch, feature flag, non-production prompt label, or isolated runner setting.
7. Encode the failing cases as dataset items or a targeted evaluator, reusing the dataset-construction reference when dataset design is involved.
8. Compare baseline and candidate runs on the same dataset. Inspect per-item regressions, not only aggregate scores.
9. Report verified evidence, residual risk, and whether the fix should ship. Ask before promoting anything to production.

## Critical Rules

- Start from real examples; do not jump from a vague symptom to a fix.
- Keep diagnosis, implementation, and measurement separate enough that the result is interpretable.
- Prefer the smallest reversible fix that addresses the repeated pattern.
- Do not publish prompts to production, mutate production configuration, or change live routing without explicit user approval.
- If the project lacks a meaningful dataset, evaluator, or score for the symptom, create the measurement plan before recommending a product change.
- Treat production traces as evidence, not ground truth. Review sensitive data handling before adding traces to datasets.
- Verify any dataset, prompt, score, or run changes by reading them back from Langfuse before reporting them as done.
