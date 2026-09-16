---
name: langfuse-user-feedback
description: Capture user feedback as Langfuse scores. Use when choosing or implementing explicit ratings, behavioral signals, conversation signals, or task outcomes.
---

# User Feedback

## Workflow

### 1. Determine What Feedback to Capture

If the user has asked for something specific, go with that. Otherwise, look at the application and **present a few UX options** for how feedback could work, then ask the user which they prefer before implementing.

Before presenting options, read [Capturing signals](https://langfuse.com/academy/monitoring/capturing-signals) and inspect the relevant application flow and existing scores. Present findings specific to the application rather than repeating examples from the docs.

Present every set of proposed signals or metrics as a table with:

- Priority: P0, P1, ..
- Status: whether the score or signal is already implemented or newly proposed
- Signal name: Name the score after the observed signal, not the quality you hope it represents: draft_edited, not quality. Reuse the same name for the same signal throughout the application.
- Explanation: what it indicates, its limitations and biases, and why it fits the application
- Effort: XS-L
- Implementation: a very short description such as “Langfuse evaluator” or “application code”. When a signal can be captured deterministically in both application code and a Langfuse code evaluator, present both as options.

When multiple signals can be captured by one evaluator, group them and reflect this in the Implementation and Effort columns.

When proposing an outcome signal, explicitly include the implementation complexity in its effort and explanation; unless the supporting workflow and data already exist or the expected value clearly justifies building them, recommend deferring it.

### 2. Implement the Feedback

Read the [user feedback loop guide](https://langfuse.com/guides/user-feedback-loop) and follow its links to the current SDK documentation before editing code.

### 3. Verify

Trigger each implemented signal and confirm that its score has the intended name, value, data type, and attachment.
