---
name: langfuse-ci-cd
description: Set up or extend agent regression checks / gating in GitHub Actions CI/CD using `langfuse/experiment-action`.
---

# Langfuse CI/CD

Use this reference when setting up a Langfuse experiment gate in CI/CD to catch regressions before they reach production / main branch.

## Workflow

### 1. Confirm GitHub and the Target Repository

1. Inspect the local repo with `git remote -v`, `git rev-parse --show-toplevel`, and existing `.github/workflows/` files.
2. Determine whether the user is using GitHub. If yes, continue with `langfuse/experiment-action`. If not, do not use `langfuse/experiment-action` or `RunnerContext`; suggest a platform-native CI gate using Langfuse SDK experiments instead. Fetch the CI/CD docs and look for the "Other CI/CD systems" / Pytest-Vitest assertion pattern: `https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd#other-cicd-systems`, plus SDK details: `https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk`.
3. Determine which repository should own the check. In monorepos or split app/evals repos, ask before editing if the answer is not obvious.

### 2. Gather Gate Requirements

Ask only for missing information that cannot be inferred from the repo. Collect:

- Trigger: `pull_request`, `workflow_dispatch`, `push` to specific branches, `release` with `types: [published]`, or a combination.
- Langfuse dataset name and optional dataset version.
- Langfuse base URL if not the default cloud host.
- Existing experiment script path, or whether to create one.
- If creating a script: Python or TypeScript/JavaScript, and the application task to run for each dataset item.
- Item-level evaluators the user actually wants, for example exact match, accuracy, factuality, conciseness, LLM-as-judge, or a custom rule.
- Whether run-level evaluators are needed, which aggregate metric should gate CI, and which condition should count as a regression.
- Required extra secrets for the experiment task, such as model provider API keys.
- Whether the user will set GitHub secrets themselves or wants you to set them with `gh secret set`.

Never ask the user to paste secrets into chat.

### 3. Validate the Dataset and Design the Experiment

First validate the dataset item shape with the Langfuse CLI so the task and evaluators match the actual `input`, `expected_output`, and metadata fields. Ensure `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and non-default `LANGFUSE_HOST` are available before running it:

```bash
npx langfuse-cli api dataset-items list --dataset-name <dataset> --limit 5 --json
```

Use the returned items to confirm the script reads the right fields, handles missing expected outputs, and maps any item metadata needed by evaluators. `expected_output` may be an object such as `{"answer": "London"}` rather than a string; evaluators must extract the relevant field instead of comparing the full object.

Choose evaluator types deliberately:

- Use exact match for canonical short answers with stable formatting.
- Use LLM-as-judge, rubric, semantic, or custom evaluators for free-form answers, reasoning, style, conciseness, or partially correct responses.
- If the user wants an aggregate gate, add a run-level evaluator that computes the metric the regression policy will read.

### 4. Validate or Create the Experiment Script

If the user already has a script, verify:

- The path matches `experiment_path` and has a supported extension: `.py`, `.ts`, `.js`, `.mjs`, or `.cjs`.
- The script defines `experiment(context)` in Python or exports `experiment(context)` in TypeScript/JavaScript.
- The script uses the action-provided context via `context.run_experiment(...)` in Python or `context.runExperiment(...)` in TypeScript/JavaScript so dataset, dataset version, metadata, and the Langfuse client come from the workflow.
- The script raises `RegressionError` with the experiment result when the user-defined regression condition is met.
- Secrets are read from environment variables, not hardcoded.

If creating a script, integrate with existing app code when available. If the app entry point is unclear, create the smallest useful skeleton with explicit TODOs at the task boundary and tell the user what they must connect.

For the recommended Python and TypeScript script shape, fetch and use the canonical examples in the Langfuse docs instead of relying on copied snippets here:

- CI/CD script contract and `RegressionError` examples: `https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd#experiment-definition`
- Evaluator and run-level evaluator patterns: `https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk#evaluators`
- Full action input/output behavior: `https://github.com/langfuse/experiment-action#script-contract`

### 5. Calibrate the Regression Gate

- Do not set thresholds blindly. Run the experiment once against a known-good baseline, inspect the item-level and run-level scores, then set the threshold below the healthy baseline with enough slack for expected variance.
- Small datasets have coarse score granularity. With 3 items, each item is worth 33 percentage points, so thresholds between `0.67` and `1.0` may be misleading or impossible to satisfy reliably.
- To read back runs and scores with the CLI:
    ```bash
    npx langfuse-cli api datasets get-get-runs --dataset-name <dataset> --json  # find the dataset run ID
    npx langfuse-cli api scores list --dataset-run-id <dataset-run-id> --json  # inspect score names/values for that run
    npx langfuse-cli api scores-v-2 --help  # use if the needed score data is not exposed by `scores list`
    ```

### 6. Add or Update the GitHub Actions Workflow

The workflow and secrets sections below are GitHub Actions-specific. For GitLab, CircleCI, Jenkins, or other CI systems, reuse the dataset/evaluator/threshold design above, but implement the gate as a standalone SDK script or test that exits non-zero on regression and uses the platform's native secrets/triggers.

- Prefer `.github/workflows/langfuse-experiment.yml` unless the repo has a clear existing workflow for evaluation gates.
- Fetch the current README from `https://github.com/langfuse/experiment-action` before pinning the action. Prefer SHA-pinning with a human-readable version comment, matching the action README pattern.
- Include only the runtime setup required by the experiment script:
    - Python scripts: add `actions/setup-python`.
    - TypeScript/JavaScript scripts: add `actions/setup-node`.
    - The action can install Langfuse SDK defaults itself. The action README currently defaults to Python SDK `4.6.0` and JS SDK `5.3.0`; check current docs before overriding.
    - If the experiment needs project/provider dependencies, add the repo's normal dependency file such as `requirements.txt` or `package.json`, run the normal install command before the action, and set `should_skip_sdk_installation: "true"` only when that dependency file also includes the required Langfuse SDK dependencies.
- For the recommended workflow shape and current action inputs, use the canonical examples instead of copying a stale workflow snippet:
    - CI/CD workflow guide: `https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd#github-actions`
    - Action README and inputs: `https://github.com/langfuse/experiment-action#usage`
- Adjust permissions:
    - `pull-requests: write` is needed for PR comments.
    - `actions: read` lets comments link to the specific job logs.
    - If not commenting on PRs, omit `github_token`, set `should_comment_on_pr: "false"`, and reduce permissions.
- If the user wants regressions reported without failing CI, set `should_fail_on_regression: "false"`.

### 7. Configure Secrets

Required GitHub secrets:
    - `LANGFUSE_PUBLIC_KEY`
    - `LANGFUSE_SECRET_KEY`
    - Optional secrets depend on the experiment task, for example `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. Add them under `env:` on the action step.

If using `gh` to set secrets:

1. Verify `gh auth status`.
2. Prefer reading values from local environment variables, not chat.
3. If the values are already exported locally, use `--body "$NAME"`:

```bash
gh secret set LANGFUSE_PUBLIC_KEY --repo OWNER/REPO --body "$LANGFUSE_PUBLIC_KEY"
gh secret set LANGFUSE_SECRET_KEY --repo OWNER/REPO --body "$LANGFUSE_SECRET_KEY"
gh secret set ANTHROPIC_API_KEY --repo OWNER/REPO --body "$ANTHROPIC_API_KEY"
gh secret list --repo OWNER/REPO
```

If a value is not exported locally, tell the user to run the stdin form in their own terminal and paste the secret when prompted:

```bash
gh secret set ANTHROPIC_API_KEY --repo OWNER/REPO
```

The pasted value goes to `gh` via stdin. Do not ask the user to paste secret values into chat.

### 8. Verification

Before finishing, prefer an end-to-end workflow run over local-only validation. Ask before creating PRs, triggering CI, or running paid model experiments unless the user already requested it:

- If the trigger is `pull_request`, create or update a test PR so the workflow runs in GitHub Actions.
- If the repo has no default/base branch yet, create an initial empty commit on the intended default branch before relying on PR-triggered verification.
- If the trigger is `workflow_dispatch`, run it with `gh workflow run <workflow-file> --ref <branch>` and inspect the run.
- If the trigger is `push` or `release`, agree with the user on a safe branch/tag/release to exercise.
- Use `gh run list`, `gh run view --log`, and the GitHub Checks UI to confirm the action completed, posted PR comments when configured, and failed or passed according to the regression policy.
- Only run the full experiment when credentials are configured and the user understands any model/API cost implications.
- Use local checks as preflight validation: YAML syntax or `actionlint`, the repo formatter, and the repo typecheck/lint where available.
- Summarize the workflow run URL or run ID, any secrets still missing, and the exact trigger/dataset/regression condition configured.

## Common Issues

| Issue | Solution |
|-------|----------|
| `gh` is missing or not authenticated | Install the GitHub CLI if needed, then run `gh auth status` and `gh auth login` before using `gh secret` or `gh workflow` commands. |
| Local Langfuse environment variables are not set | Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` locally before using `langfuse-cli`; do not ask the user to paste secret values into chat. |
| Workflow secrets or action inputs are wrong | Verify `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `langfuse_base_url`, and provider secrets exist in the target repo/environment and are passed to the action step. |
| Forked PR cannot access secrets | GitHub restricts secret access for forked PRs. Document the limitation or choose a trusted trigger such as internal PR, trusted-branch `push`, or `workflow_dispatch`. |
| No default/base branch exists | Create an initial empty commit on the intended default branch before trying to verify a PR-triggered workflow. |
| Script fails reading dataset fields | Re-run `npx langfuse-cli api dataset-items list --dataset-name <dataset> --limit 5 --json`, inspect `input`, `expected_output`, and metadata, and extract fields from object-shaped outputs explicitly. |
