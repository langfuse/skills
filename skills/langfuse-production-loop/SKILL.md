---
name: langfuse-production-loop
description: >
  Run the full Langfuse production-quality loop end to end — discover what's
  wrong, prioritize it, fix it, and prove the fix — orchestrating the
  `langfuse-trace-triage` and `langfuse-improvement-loop` skills. Use when
  someone wants to "improve my app", "make my agent better", "find and fix
  what's wrong", "do a quality pass", or otherwise own the whole journey
  rather than a single phase — especially when there's no specific symptom
  yet and the issue still has to be surfaced. If the user already named one
  concrete symptom to fix, skip straight to `langfuse-improvement-loop`; if
  they only want a diagnosis/report, use `langfuse-trace-triage` alone.
  Delegates all data access to those skills (which use `npx langfuse-cli`).
---

# Langfuse Production Loop

A thin orchestrator over two focused skills. It owns the **end-to-end arc** of improving a Langfuse-traced app and decides which sub-skill runs when — it does **not** re-implement their logic. Read the sub-skill it routes to and follow that skill's instructions; come back here to move between phases.

```
  DISCOVER & RANK                 PICK                 FIX & PROVE
  langfuse-trace-triage   ──▶   one P0/P1 finding  ──▶  langfuse-improvement-loop
  sweep traffic, P0–P3          (with user)             root-cause → lever →
  ranked report                                         safe change → eval → experiment
                                      ▲                          │
                                      └──── more findings ◀──────┘
                                       loop until the backlog is clear
```

This skill builds on the **`langfuse`** skill for CLI access and credentials — make sure those are set up first (see its `references/cli.md`). It adds no new CLI usage of its own.

## When to use which path

- **No specific symptom / "improve my app" / "what's wrong?"** → start at Phase 1 (triage), then loop through Phase 2–3 for each finding worth fixing. This is the default and the reason this skill exists.
- **User already named one concrete symptom to fix** ("answers get flagged ~15%") → skip triage; go straight to `langfuse-improvement-loop`. Don't run a full audit they didn't ask for.
- **User only wants a diagnosis / report, not changes** → run `langfuse-trace-triage` alone and stop. Don't start changing things.

## Phase 1 — Discover & rank (delegate to `langfuse-trace-triage`)

Invoke the **`langfuse-trace-triage`** skill and follow it fully: scope the window, separate real app traffic from evaluator/machinery traces, sweep every dimension, and produce the ranked P0–P3 report. The output you carry forward is the ranked findings list — each with a one-line symptom and example trace IDs.

## Phase 2 — Pick what to fix (with the user)

Triage diagnoses; it does not decide priorities for someone. Present the ranked findings and **let the user choose** what to act on (default: highest-severity, highest-prevalence, most-silent first). Confirm scope before mutating anything. A finding that's "verified clean" or pure hygiene may not be worth a fix cycle — say so.

## Phase 3 — Fix & prove (delegate to `langfuse-improvement-loop`)

For the chosen finding, invoke the **`langfuse-improvement-loop`** skill and follow it fully. The triage finding *is* the input its Step ① expects — pass the one-line symptom plus the example trace IDs straight in, so it re-grounds the root cause in those exact traces rather than starting from scratch. Let it run its own gate (baseline-vs-candidate experiment, per-item regression check) and its own promotion-confirmation step; this orchestrator does not promote anything itself.

## Phase 4 — Loop or stop

After a fix is proven (or shelved), return to the ranked list from Phase 1 and ask whether to take the next finding. Stop when the backlog the user cares about is clear, or when remaining findings aren't worth a cycle. **Re-running Phase 1** after a batch of fixes is the honest way to confirm nothing regressed and to catch issues that only surfaced once the loud ones were fixed.

## Principles

- **Orchestrate, don't duplicate.** Each sub-skill is the source of truth for its phase. This skill only sequences them and carries findings between phases.
- **Diagnosis before change; measurement before promotion.** Never let Phase 3 start changing things on a symptom Phase 1 hasn't grounded, and never promote a fix the improvement loop hasn't gated.
- **User owns prioritization and go-live.** The loop surfaces and proves; the human decides what's worth fixing and what ships.
- **One finding at a time.** Drive each finding through Phase 3 to a verdict before starting the next, so every change stays attributable.
