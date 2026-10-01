---
name: langfuse-judge-calibration
description: Calibrate a new or existing LLM-as-a-Judge against labeled examples, analyze disagreements, iterate on its prompt with user approval, and deploy the approved version.
---

# Judge Calibration

## 1. Prepare the calibration

The calibration data must:

- match the information the judge receives in a real execution, based on a representative production trace, filter rules, and variable mappings;
- include a good distribution across every possible outcome;
- include known failure cases when badly judged traces prompted the calibration; and
- contain expected outputs in exactly the judge's output shape and vocabulary, without passing them to the judge.

1. Fetch the current docs for [LLM-as-a-Judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge), [datasets](https://langfuse.com/docs/evaluation/experiments/datasets), [experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk), [prompt versions and labels](https://langfuse.com/docs/prompt-management/data-model), and [LLM connections](https://langfuse.com/docs/administration/llm-connection). Use the current API schema and SDK rather than assuming fields or methods.
2. For a new judge, immediately create its evaluator, production filters, mappings, score definition, and model, but leave its rule inactive. If no LLM connection exists, ask the user to create one and explain that the judge needs it; otherwise use the default connection unless the user specified another one.
3. Use one dataset per judge. If it does not exist, create `judge-calibration/<judge-name>` from labeled examples or known good and bad traces. If an existing calibration dataset is not in a folder intended for future judge-calibration datasets, ask before moving it and leave it where it is if the user declines.
4. Save the candidate prompt as `judge-calibration/<judge-name>`. If the judge was calibrated before and its prompt already exists, create a new version for the change.

## 2. Run the calibration

Run every calibration directly with the Langfuse Experiments SDK; do not ask the user to trigger a Prompt Experiment in the UI. Each run must:

1. fetch `judge-calibration/<judge-name>` from Langfuse;
2. fetch the candidate prompt version from `judge-calibration/<judge-name>` in Prompt Management;
3. execute that prompt against every dataset item using the same model as the judge; and
4. define a Boolean evaluator named `<judge-name>-judge-output-correct` and run it together with the SDK experiment. It returns `true` only when the experiment output exactly equals the dataset item's expected output.

Wait for every task and evaluator execution to finish before reviewing results, checking periodically while work remains pending or delayed.

## 3. Review the results

1. Concisely explain what you did and link to the tested prompt version and that experiment run's results screen. On the first round only, also link to the dataset and, for a new judge, the inactive judge.
2. Inspect the accuracy and every mismatch. Treat 85% overall accuracy as quite good—about the same as human judgment—only if accuracy is also acceptable in every category; always state that benchmark and explain the mistakes, even when accuracy exceeds it.
3. Show all mistakes in a table with columns `Dataset input`, `Expected output`, and `Actual output`.
4. If some labels look like debatable edge cases, group those first as items whose expected labels the user may want to revisit. Otherwise, or when the user is confident in the labels, group mistakes by actual output category.

## 4. Iterate until the judge is approved

1. Wait for the user's response. It may be specific label guidance, a request to fix the failures, or approval of the judge.
2. If you want to change the judge prompt, follow `references/prompt-engineering.md`. This is important. Show the prompt change to the user before applying it.
3. After the user approves the proposed change, create a new version of `judge-calibration/<judge-name>` and rerun the SDK experiment from section 2.
4. Wait for the run to finish, review the results again, and repeat until the user approves the judge.

## 5. Deploy the approved judge

Only deploy after the user approves the judge.

Copy the approved prompt into the actual evaluator, assign its Prompt Management version the `production` label, and confirm that the model, mappings, output definition, and filters match what was calibrated. For a new judge, activate its rule.
