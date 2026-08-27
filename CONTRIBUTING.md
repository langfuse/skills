# Contributing

## Proposing a change as external contributor

- **Small, self-contained changes** (typo fixes, clarifications, a tightly scoped reference improvement): open a pull request directly. Explain what the change improves and how you verified it. Read the `AGENTS.md` file for guidance on best practices.
- **Anything larger** (a new reference file, routing changes, a new skill, behavior changes): open a [GitHub issue](https://github.com/langfuse/skills/issues) first.

## Contributing for Langfuse team members

Follow the full testing flow below before merging. It assumes you have access to:

- the [evaluation harness repo](https://github.com/langfuse/coding-agent-testing),
- the internal [Langfuse project](https://cloud.langfuse.com/project/cmq89cdm501bvad0d3ffeadia) that holds the skill-testing datasets and experiments (not publicly accessible),
- the Modal webhook that runs the agents.

If you think you should have access but don't, reach out to @Lotte-Verheyden.

## Testing a skill change (Langfuse team)

The harness runs code agents (Claude Code and Codex) headlessly on Modal against a Langfuse dataset and traces every run back to Langfuse. You trigger a run by pointing it at a dataset and a **commit** of your skill. See the harness repo's `README` and `runtime-skills/README.md` for detailed mechanics.

### 0. Before starting on your skill changes, read `AGENTS.md` first

Skim [`AGENTS.md`](./AGENTS.md) and the skill you are changing. It documents the best practices your change must follow, and your change is reviewed against it.

### 1. Create or reuse a dataset in the Langfuse project

Tests run against a Langfuse **dataset**. Each item is one task handed verbatim to the agent, plus an `expected_output` that says what "good" looks like.

```json
{ "input":           {"prompt": "the task handed verbatim to the agent"},
  "expected_output": {"contains": ["substrings the answer must include"],
                      "tool": "optional-tool-to-score-discovery-of",
                      "invoked_reference_file": "optional-skill-reference.md"},
  "metadata":        {"env_folder": "optional-starter-workspace-under-envs/"} }
```

**First check whether a suitable dataset already exists in Langfuse.** Skill-testing datasets are under a `skill-testing/` folder — e.g. `skill-testing/prompt-migration`.

> [!TIP]
> **Folder conventions: always follow these.** Every skill-testing dataset lives under the skill-testing folder: `skill-testing/<name>`

### 2. Environments

Some tasks need a realistic starting codebase ("instrument *this application*" only makes sense if there's an application). Those live under `envs/` in the harness repo, referenced by a dataset item's `metadata.env_folder`.

> [!IMPORTANT]
> **Environments must be merged and deployed before a dataset can reference them.** `envs/` is bundled into the agent image (`images.py` adds it via `add_local_dir`), so a new or changed environment only reaches the sandbox after the image is rebuilt on a deploy. The `metadata.env_folder` path must match exactly.

> [!TIP]
> **Folder conventions: always follow these.** Every skill-testing env lives under a skill-testing folder: `envs/<name>-skill-testing/`

### 3. Commit your skill version on a branch

You test a skill by its **commit hash**. Modal fetches the skill from the Github repo at the exact commit and path you give it.

```bash
# add your skill version under runtime-skills/ in the harness repo
git add runtime-skills/my-skill
git commit -m "test: my-skill variation for experiment"
git push -u origin HEAD
git rev-parse HEAD          # copy the full 40-char SHA
```

The commit **must be pushed** but **does not need to be merged**. Keep the branch until the experiment finishes.

> [!TIP]
> **You never merge the skill versions you are testing.** Committing on a branch is only so Modal can fetch it. The skills themselves live in this repo; `runtime-skills/` in the harness repo is just a staging area for experiments.

### 4. Trigger the experiment

In the Langfuse project: open the dataset → Start Experiment → From Webhook → the ⚡ trigger → select the existing company Modal webhook → paste the payload:

```json
{
  "run_configs": ["claude-code", "codex"],
  "run_name": "my-skill-<short-sha>",
  "skill": {
    "commit": "<full-40-character-sha>",
    "path": "runtime-skills/my-skill"
  },
  "reset_sandbox": true
}
```

**First run an experiment on the skill version before your changes as a baseline. Then run an experiment with your changes to compare with.**

It can take several minutes after you click Run for the experiment to show up.

> [!TIP]
> Company infrastructure (Modal, credentials, the webhook) is maintained centrally. If the webhook is unavailable, ask a harness-repo maintainer.

#### Always test on both GPT and Claude

`run_configs: ["claude-code", "codex"]` runs both agents. **Always keep both.** Claude and GPT behave *wildly* differently, a skill that looks great on one can regress on the other.

### 5. Review the results

You do not always need an automated evaluator, especially early on. For a new use case it's often more useful to open the traces and read what the agent actually did.

Working through the results with a coding agent usually tells you more than a pre-built scorer, and it's fine to stay manual until it makes sense to automate something.

### 6. If you are creating a new reference file: test file invocation

When you are creating a new reference file, **always test on the reference file invocation dataset.** This is to test whether your routing addition to the main `SKILL.md` file is working as expected. You are testing two things:

1. **The file is invoked when it should be**
2. **It does not break invocations of other files in other scenarios.** A new reference file (or a broadened description) can start hijacking prompts that should route elsewhere

Add 2-3 items to the dataset with scenarios where you want your reference file to be invoked, and set the expected output to your file:

```json
{ "input":           {"prompt": "a realistic user question for this reference file"},
  "expected_output": {"invoked_reference_file": "my-new-reference.md"} }
```

`reference_file_invoked` is scored deterministically from the **skill reads detected on the trace.**

> [!IMPORTANT]
> **Changing an existing item to point at your new file → stop and get review.** If you find yourself wanting to change an *existing* dataset item so it invokes your new reference file instead of the one previously specified, that is a signal to get review before touching the dataset. Involve @Lotte-Verheyden before making that change.

#### Do not overfit routing descriptions to the dataset

What often happens is overfitting to the specific scenarios of your datasets, especially in frontmatter `description` fields. This produces a high experiment score but tells you nothing about generalised use of the skill. Avoid this and focus on improving the score with generalised routing rules.

## Checklist

Before a skill change counts as tested, you should have done all of the following:

- [ ] Read `AGENTS.md` and confirmed the skill behaves accordingly.
- [ ] If you added a new reference file **or** changed any routing: tested reference file invocation.
- [ ] If you added a new reference file: added 2-3 examples to the reference file invocation dataset.
- [ ] Committed and pushed the skill on a branch.
- [ ] Merged any new environments you need for testing.
- [ ] Run the experiment on **both** Claude Code and Codex, with a baseline to compare against.
- [ ] Reviewed the results and found them acceptable.
