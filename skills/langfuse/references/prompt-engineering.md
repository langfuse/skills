---
name: langfuse-prompt-engineering
description: Write or change prompts in Langfuse or code. Use whenever the user asks to create, edit, rewrite, debug, tune, or otherwise modify a prompt, including a small wording or instruction change. Distinct from prompt-migration and judge-calibration.
metadata:
  required_access: []
---

# Prompt Engineering

## Establish the target

Before editing, identify:

- the exact model and version
- the complete prompt and message roles, including variables, examples, and injected context
- relevant model settings, tools, and structured-output schemas
- observable success criteria and representative test cases

Fetch the target model's current prompting guidance. Start with the [OpenAI prompting guide](https://developers.openai.com/api/docs/guides/prompt-engineering) and [reasoning-model guidance](https://developers.openai.com/api/docs/guides/reasoning-best-practices), or the [Anthropic prompting overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview) and [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices). For other providers, use their official model-specific guidance.

Do not transfer techniques between model families without testing them. In particular, do not ask a reasoning model to reveal chain-of-thought unless its current provider guidance explicitly recommends that technique.

## Write a new prompt

1. Translate the success criteria into explicit instructions, constraints, and an output contract.
2. Separate instructions, examples, and untrusted or variable context with clear labels or delimiters. Add a role only when it clarifies the desired behavior or tone.
3. Explain the reason behind important rules when it helps the model generalize to adjacent cases.
4. Start with the shortest prompt that covers the requirements. Add examples only when they teach behavior that the instructions do not reliably produce.
5. Test representative, boundary, and adversarial cases before treating the prompt as ready.

## Improve an existing prompt

1. **Observe the failure first.** Collect concrete inputs and misbehaving outputs, then name the observable failure mode. Do not infer a failure from the task or data alone.
2. **Verify the prompt is the cause.** Check whether the failure instead comes from missing context, retrieval, tool behavior, model settings, an output parser, or the selected model.
3. **Trace the failure to a prompt defect.** Locate a missing, ambiguous, or conflicting instruction.
4. **Fix the failure class.** Generalize the observed mistake into a rule that covers adjacent cases without encoding the failing example or inventing rules for unobserved problems. If the generalized rule does not help, report that result instead of narrowing it to the example.
5. **Preserve working behavior.** Identify what the surrounding instructions protect and keep regression cases for it.
6. **Make one testable change.** Compare the candidate against the same cases and success criteria. Do not substitute repetition, emphasis, or all-caps for a clearer instruction. Revert or revise the change if it does not improve results without unacceptable regressions.

When the prompt is managed in Langfuse, save each attempt as a new version, compare variants in the [Playground](https://langfuse.com/docs/prompt-management/features/playground) or a [dataset experiment](https://langfuse.com/docs/evaluation/experiments/experiments-via-ui), and move a deployment label only after validation. See [prompt version control](https://langfuse.com/docs/prompt-management/features/prompt-version-control).
