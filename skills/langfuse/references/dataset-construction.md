---
name: langfuse-dataset-construction
description: Collaborative Langfuse dataset creation workflow. Use when the user needs to create, design, seed, reshape, review, or upload a Langfuse dataset or dataset version; especially when they need a minimal but complete dataset with agreed input, expected output, metadata, sources, and coverage dimensions before live mutation.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
    - LANGFUSE_PROJECT_SCRIPT
---

# Langfuse Dataset Construction

## Primary Guide

Follow the [Langfuse Academy datasets guide](https://langfuse.com/academy/datasets) as the human-readable source of truth for dataset design. Do not duplicate the guide here; fetch current docs before implementation.

Use CLI schema/help discovery for current Langfuse API mechanics. Do not hard-code CLI recipes for dataset operations in this reference.

## Workflow

Guide the user through dataset creation as an interview, proposal, approval, implementation loop:

1. Read the primary guide and relevant current Langfuse docs.
2. Inspect available context: the user's goal, the application path or codebase when available, existing datasets, traces, prompts, scores, monitors, user feedback, tickets, expert examples, existing eval assets, and synthetic gaps.
3. Clarify the release or evaluation decision the dataset should support.
4. Propose the source mix, input distribution, input shape, expected output shape, metadata fields, evaluator or run plan, and minimal v0 size.
5. Get the user's approval before creating, reshaping, uploading, or running live project data.
6. Build the smallest approved draft, run or upload it, verify readback, review results with the user, and iterate.

## Critical Rules

- Interview the user on available source data beyond traces.
- Interview the user about the goal they are trying to achieve and the problem they face.
- Do not create, upsert, reshape, or upload a live Langfuse dataset until the user has approved the dataset goal, source mix, item schema, and first minimal draft, unless the user already gave those details and explicitly asked for immediate mutation.
- Design the smallest complete dataset version that can serve the goal. Prefer a minimal reviewable v0 over broad coverage. A first draft is usually 5-12 high-signal items unless the user asks for a different size.
- Inspect real code and traces when available to understand the production path. Explain whether the proposed dataset input is literal production-shaped input or a normalized experiment input, and why.
- Keep `input`, `expectedOutput`, and `metadata` responsibilities separate. Put additional information, notes, and comments into `metadata`, not into `input` or `expectedOutput`.
