# Agent Instructions

## Adding or Improving a Skill Use Case

FOLLOW THESE INSTRUCTIONS RELIGIOUSLY. After every edit you make, come back to these principles and judge critically whether you adhered to them. Fix your edits if not.

- **Only add a use case if it beats the docs.** If an agent can already serve the user by fetching the Langfuse docs, add nothing. Reserve new content for where docs fall short and the agent needs extra context. *Every addition is maintenance surface and dilutes the skill.*

- **You should almost never touch the top-level frontmatter `description` in `SKILL.md`.** It only controls whether the skill is invoked, and a user asking about a use case already mentions Langfuse or evaluation — which triggers it. Keep it short; in-skill routing handles the rest.

- **Put "when to use" guidance in exactly two places:** exactly one one-line entry per reference in the `## Use case specific references` list in `SKILL.md`, and the `description` in the reference file's frontmatter. Nowhere else — no prose routing section, no "when to use" section in the reference body. *A reference body is read only after the agent already chose to open it, so routing text there is dead weight.*

- **Every reference file's frontmatter must declare a `metadata.required_access` list** — the kinds of access an agent needs to execute that reference. Use only these tokens, and reuse them consistently across files:
  - `CODEBASE` — reads or edits the user's source code
  - `LANGFUSE_PROJECT_INTERFACE` — reaches the Langfuse project via CLI / API / MCP commands
  - `LANGFUSE_PROJECT_SCRIPT` — runs SDK code that connects to the Langfuse backend (needs network)
  - `GITHUB` — operates on GitHub via the `gh` CLI

- **Every line must earn its place.** Add only what's useful or what an agent couldn't infer on its own. Cut filler, restatements, self-explanatory steps, and anything the agent will already have from the relevant docs or task context. Keep new use-case references at 100 lines or fewer, including frontmatter; this is a maximum, if you exceed this length, you are likely producing slop.

- **Never commit code.** Link to the relevant Langfuse docs page so the agent fetches current code; use pseudo-code only for logic-specific bits. *Committed code goes stale.*

- **Be cautious with `allowed-tools`.** A tool not in the list still works — the user just grants permission the first time. Only auto-allow commands users would find a no-brainer (today: read-only langfuse-specific commands only). *A risky auto-allow can make people hesitate to install the skill at all.*

## Langfuse Skill Path Changes

When changing the path to any Langfuse skill in this repo, you must also update the corresponding path reference in the [CLI repo](https://github.com/langfuse/langfuse-cli) so that it points to the new location. Failing to do so will break the CLI's ability to resolve the skill.

## Plugin Version Bumps

The repo ships as a plugin to two marketplaces, each with its own manifest:
- `.claude-plugin/plugin.json` (Claude Code)
- `.cursor-plugin/plugin.json` (Cursor)

Both manifests have a `version` field and **must stay in lockstep** — always bump them together to the same value, in the same PR as the change.

When to bump (follow semver):
- **Patch** (`1.0.0` → `1.0.1`): bug fixes in a skill, clarifications to skill instructions, small content corrections.
- **Minor** (`1.0.0` → `1.1.0`): adding a new skill, adding meaningful new capability to an existing skill, non-breaking behavior changes.
- **Major** (`1.0.0` → `2.0.0`): removing a skill, renaming a skill in a way that breaks `/skill-name` invocations, or any change that breaks how existing users interact with the plugin.

When **not** to bump:
- Typo fixes, formatting, comment-only changes.
- Changes to repo tooling, CI, or files outside the published skills (e.g. this `AGENTS.md`, READMEs, GitHub workflows).
- Internal refactors that don't change observable skill behavior.

If unsure whether a change warrants a bump, err on the side of bumping patch.

## Reviewing Pull Requests

When reviewing a PR (e.g. triggered by `@claude review`), enforce the principles above — they are the review criteria, not just authoring advice. Do not restate them in the review; call out where the diff violates them. Focus on:

- **Docs checked, and the addition beats them.** Fetch every docs page named or linked in the changed skill content, then search the Langfuse docs for the use case even if the diff links no page. Compare the proposed content directly with those sources. Flag anything an agent could get from the docs; almost no product guidance should be duplicated. Prefer moving generally useful guidance to the docs and linking to it from the skill.
- **Does this need a new reference?** After removing docs duplication, check whether the remaining non-obvious workflow belongs in an existing reference. Flag a new file when extending an existing reference—or adding nothing—would serve the agent as well.
- **Is the reference ruthlessly concise?** Flag filler, self-explanatory instructions, repeated guidance, and details the agent will already have from the fetched docs or task context. New use-case references should be at most 100 lines including frontmatter; anything longer needs specific, convincing justification and should still be cut as far as possible.
- **No committed code.** Flag committed code samples that should instead link to a Langfuse docs page; pseudo-code for logic-specific bits is fine.
- **`metadata.required_access` present and correct.** Every reference file's frontmatter must declare it, using only the allowed tokens.
- **Routing is proportional and lives in exactly two places.** Require exactly one compact `## Use case specific references` entry per reference file plus its frontmatter `description`. Flag multiple `SKILL.md` bullets pointing to the same reference, redundant prose routing, and extra prominence given to a newly added workflow.
- **Version bumps in lockstep.** If published skill behavior changed, both `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json` must be bumped to the same version in the PR (and no bump for tooling/docs-only changes).
- **CLI path sync.** If a skill's path changed, the [CLI repo](https://github.com/langfuse/langfuse-cli) reference must be updated too.

Prioritize correctness and adherence to these principles over style nits. If the diff is clean against all of the above, say so plainly.
