# Agent Instructions

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
- Changes to repo tooling, CI, or files outside the published skills (e.g. this `agents.md`, READMEs, GitHub workflows).
- Internal refactors that don't change observable skill behavior.

If unsure whether a change warrants a bump, err on the side of bumping patch.
