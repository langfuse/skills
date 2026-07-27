---
name: langfuse-dataset-construction
description: Collaborative Langfuse dataset creation workflow. Use when the user needs to create, design, seed, reshape, review, or upload a Langfuse dataset or dataset version; especially when they need a minimal but complete dataset with agreed input, expected output, metadata, sources, and coverage dimensions before live mutation.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_INTERFACE
    - LANGFUSE_PROJECT_SCRIPT
---

# Langfuse Dataset Construction

## Primary Guide

Follow the [Langfuse Academy datasets guide](https://langfuse.com/academy/datasets) as the human-readable source of truth for dataset design. Do not duplicate the guide here; fetch current docs before implementation.

Use CLI schema/help discovery for current Langfuse API mechanics. Do not hard-code CLI recipes for dataset operations in this reference.

## Workflow

Run the dataset workflow step by step:

1. Read the primary guide and relevant current Langfuse docs.
2. Inspect the codebase, if available, to understand the production path.
3. Inspect the Langfuse project, if available, for existing datasets, traces, prompts, scores, monitors, and user feedback.
4. Clarify the user's goal, using the guide as the interview frame.
5. Clarify available sources: production traces, existing assets, expert examples, user feedback, tickets, synthetic gap-fills, or benchmark data.
6. Propose one or more dataset directions with tradeoffs.
7. Let the user choose the direction before live mutation.
8. Confirm runtime, environment, credentials availability, and cost/rate-limit expectations before running SDK code.
9. Build the smallest approved draft, run or upload it, audit the result, then review and repeat.

## Rules

- Do not create, upsert, reshape, or upload a live Langfuse dataset until the user has approved the dataset goal, source mix, item schema, and first minimal draft, unless the user already gave those details and explicitly asked for immediate mutation.
- Design the smallest complete dataset version that can serve the goal. Prefer a minimal reviewable v0 over broad coverage. A first draft is usually 5-12 high-signal items unless the user asks for a different size.
- Inspect real code and traces when available to understand the production path. Explain whether the proposed dataset input is literal production-shaped input or a normalized experiment input, and why.
- Agree on the input shape before writing or uploading items. The input must be readable, stable, and directly mappable into the experiment runner or application path.
- Agree on the expected output shape before writing or uploading items. The expected output must support the planned evaluator or review rubric.
- Agree on the metadata shape before writing or uploading items. Include at least source, category or dimension labels, difficulty when useful, dataset_role, provenance, and review status when applicable.
- Propose input distribution dimensions and ask the user to edit them. Common dimensions: intent, topic, source, difficulty, language, context availability, edge case, failure mode, risk level, and dataset_role.
- Ask the user to confirm the goal, input shape, expected output shape, metadata fields, distribution dimensions, and source mix before upload.
- After approved upload, verify dataset name, version or schema metadata, item count, schema presence, source distribution, and a sample item. Report only verified state.
