---
name: langfuse-setting-up-evals
description: Set up evaluation by finding gaps across signal capture, monitoring, and evaluator metrics, then addressing the right one first.
---

# Setting up evals

Act as a PM, analyst, teacher, and at the end, an executor. The bulk of the work consists of probing the user to really understand what they are looking for, and get a clear picture of what would serve them best. This is not always exactly what they ask you for, and it's up to you to do your research, ask the right questions, and use your judgment. Only go into any implementation mode when it's crystal clear what the right solution for this user looks like.

## 1. Determine Online or Offline

Determine whether the user is looking for online or offline evaluation. If the goal is unclear, ask which decision the user is trying to make. If they need both, establish which one to address first.

## 2. Establish the Metric Set

If the user supplied metrics, review them against the application, available data, and intended decision. A useful metric names a specific observable behavior, is measurable, and changes a decision. Challenge vague or unhelpful metrics and propose sharper alternatives. Read [Choosing what to evaluate](https://langfuse.com/academy/evaluate/choosing-what-to-evaluate) to help you judge the metric.

If the user did not supply metrics:

- **Online:** The user likely doesn't know what they want. Execute the complete [User Feedback](user-feedback.md) workflow, backfill derivable signals where possible. Explain to the user why this is the right step to take. People often say they want evals without knowing what they actually need. This is one such case. You are completing their request by executing the user-feedback workflow.
- **Offline:** inspect existing datasets and experiment results, then ask questions to determine:
  1. is the user happy with their datasets, or do they want to evaluate something they don't have a dataset for?
  2. if they want to use an existing dataset, do they already manually review experiment outputs on that dataset, and if yes, what do they look for?
  These questions should help narrow down what's important to the user and what you should focus on. Read [Choosing what to evaluate](https://langfuse.com/academy/evaluate/choosing-what-to-evaluate) to come up with high quality metrics to evaluate.


Present the resulting metric set as one table with: Priority; Status (existing or new); Metric; Source or evidence; Why it matters and what decision it informs; and Measurability. Revise it with the user and do not proceed until they explicitly confirm it.

## 3. Implement and Verify

After the metric set is confirmed:

- **Online:** follow [Writing good evaluators](https://langfuse.com/academy/evaluate/writing-evaluators), then implement and verify the online evaluators.
- **Offline:** confirm that an appropriate dataset exists. If not, execute [Dataset Construction](create-dataset.md). Then implement the evaluators and run the experiment.

Do not default to an LLM-as-a-judge. When methods have significant trade-offs and none is clearly superior, present the options and let the user decide.

For evaluator functionality, use the unstable API endpoints.

- Before creating an evaluator, fetch the observations matched by its target filter and confirm that they are correct and will not be scored twice.
- Name the score after what is measured (`refusal`), not the evaluator (`refusal judge`).
- If an LLM-as-a-judge is the best fit, calibrate it on real examples before treating it as ready.
- Share a link to each evaluator.
