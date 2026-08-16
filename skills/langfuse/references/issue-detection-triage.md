---
name: langfuse-issue-detection-triage
description: Issue detection triage for a Langfuse project's recent production traffic — find problems and report them ranked by severity. Use when the user wants to "find issues / problems / anomalies", "audit", "triage", "health-check", or "see what's going wrong" in their Langfuse traces/observations/scores over a time window — failed tool calls, cost spikes, latency, bad scores, user friction, retrieval quality, etc.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
---

# Issue Detection Triage

## Input

Pull a sample of observations from the connected Langfuse instance.

## Expected output

Create a prioritized issue table in the following format.

### Findings table

One row per distinct issue, ordered by priority (P0 first). Columns, in order:

| # | Column | Contents |
|---|---|---|
| 1 | **Issue** | One word / short phrase naming it — e.g. "Broken retrieval", "Follow-up storm", "Cost spike". |
| 2 | **Category** | Exactly one of: `Langfuse Setup` · `Reliability` · `Latency` · `Cost` · `Tool/Agent` · `Retrieval` · `Scores/Evals` · `User friction` · `Output quality/Safety` · `Input/Scope` · `Usage drift` · `Coverage`. |
| 3 | **Priority** | `P0` / `P1` / `P2` / `P3` — severity × prevalence × silence. |
| 4 | **Traces affected** | Count of traces you found exhibiting it over the number examined, e.g. `18 / 240`. You need not check every trace — report what you found and mark it a floor (`≥`). |
| 5 | **Description** | Concrete: the observable symptom + supporting evidence (counts, %, quoted output). |
| 6 | **Root-cause hypothesis** | Best explanation of *why*, stated as a hypothesis (not asserted fact). |
| 7 | **Example traces** | 1–3 links, `<host>/project/<projectId>/traces/<traceId>`, built from the **actual `LANGFUSE_HOST`** so the region is correct (e.g. `https://us.cloud.langfuse.com/...` for US cloud, `https://cloud.langfuse.com/...` for EU, or the self-hosted host). |
| 8 | **Fix direction** | The lever(s) most likely at fault (prompt / retrieval / code / model / eval / instrumentation) and one or more plausible ways to address it — offered as options, not a mandate. Say what you'd try and why, but leave the final call to whoever implements it. |

## Workflow

1. Inspect the shape of observations in the connected Langfuse project.
2. Pull at least 100 root observations, including their nested observations.
   - **Sampling priority:** Prioritize observations with scores and metrics indicating failure, such as a negative eval, high cost, or a very high number of observations.
3. Inspect the sample along the issue dimensions below.
   - **Implicit issue review:** Inspect a sample of the overall traces and review all inputs and outputs in detail.
4. For each identified issue, investigate the potential root cause and identify representative traces.
5. Create the output table in the specified format.

## Issue dimensions

### Setup

- Langfuse setup issues: quality of traces (e.g. flat traces or infrastructure spans), scoring setup (e.g. broken scores or judges), and related issues.

### Explicit health issues

- Cost spikes
- Latency spikes
- Errors on spans, e.g. tool-call errors

### Implicit health issues

- User friction (follow-up questions, disagreement, upset users, out-of-scope requests)
- Tool retry loops
