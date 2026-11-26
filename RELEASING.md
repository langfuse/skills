# Releasing the Langfuse skills plugin

Merging to `main` ships GitHub, the skills CLI, and new clones. It does **not** update the Claude, Codex/ChatGPT, or Cursor marketplaces. Those listings are pinned and need a human step after the version bump.

Bump the three manifests together in the same PR as the skill change. Semver rules: [`AGENTS.md`](./AGENTS.md#plugin-version-bumps).

This repo has no git tags, GitHub Releases, or `marketplace.json`. None of the marketplaces below require a tag.

## After merge (checklist)

After every version bump:

1. Confirm `main` has the same `version` in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, and `.cursor-plugin/plugin.json`.
2. Copy the merge commit SHA (`git rev-parse origin/main`).
3. Walk each channel below.
4. Optionally run **Sync Halo skills** (separate product surface; see below).

## Channels

### Claude Code / Anthropic — **manual (SHA pin + directory publish)**

Listed:

- Directory: [claude.com/marketplace/plugins/langfuse](https://claude.com/marketplace/plugins/langfuse)
- Claude Code: `/plugin install langfuse@claude-plugins-official`
- Also listed in [`anthropics/knowledge-work-plugins`](https://github.com/anthropics/knowledge-work-plugins)

Both Anthropic catalogs currently pin `langfuse/skills` to a **git SHA** in their `marketplace.json` (not `main`). A push does not move that pin.

Do:

1. Open [claude.ai/directory/manage](https://claude.ai/directory/manage) on the Claude org that owns the listing. Needs a paid plan and GitHub push access to `langfuse/skills`. Docs: [Submit a plugin](https://claude.com/docs/plugins/submit), [Update a published plugin](https://claude.com/docs/plugins/submit#update-a-published-plugin).
2. **Check for new commits** (or rely on the GitHub push webhook / scheduled check if those are on). The skill PR must already have raised `version` in `.claude-plugin/plugin.json`, or installed copies will not see an update.
3. **Publish** the passing version unless auto-publish is on for later versions. Until it is published, the directory keeps serving the last live version.
4. If the official marketplace SHA did not move, ask the Anthropic partner contact to point `claude-plugins-official` and `knowledge-work-plugins` at the new SHA. Official marketplace listings are not self-serve; [Anthropic says](https://code.claude.com/docs/en/plugins/publish) `claude-plugins-official` does not take directory-portal submissions.

### OpenAI Codex / ChatGPT plugin directory — **manual ZIP**

`.codex-plugin/plugin.json` (`interface`, legal URLs, logo) is the ChatGPT/Codex directory package. Langfuse is **not** in the curated [`openai/plugins`](https://github.com/openai/plugins) repo.

Skill and metadata updates are **not** picked up from GitHub. Docs: [Upload and submit](https://developers.openai.com/plugins/deploy/submission), [Package your plugin](https://developers.openai.com/plugins/build/plugins).

Do:

1. Open the Plugins page for the verified OpenAI org that owns the listing (org owner, or Apps Management Write).
2. Zip from the merged SHA (manifest, `skills/`, `assets/`). Do not change `version`.
3. **Upload plugin** onto the existing listing (not a new plugin). Resolve automated metadata/skill findings.
4. Submit for review if required, then **Publish** the approved package. Publishing replaces the previous ZIP.

### Cursor Marketplace — **manual re-index**

Listed: [cursor.com/marketplace/langfuse/langfuse](https://cursor.com/marketplace/langfuse/langfuse) (`/add-plugin langfuse`). Separate listing: [Langfuse Observability](https://cursor.com/marketplace/langfuse/langfuse-observability) (different repo; ignore for this skill).

Official Marketplace plugins are **pinned to a commit**. Pushing `main` does nothing. Do **not** resubmit [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish). A GitHub tag is not required.

Do: email [marketplace-publishing@cursor.com](mailto:marketplace-publishing@cursor.com) with plugin name `langfuse`, repo `https://github.com/langfuse/skills`, and the commit SHA to put live. Cursor reviews the update and re-syncs. Source: [publisher terms](https://cursor.com/marketplace-publisher-terms) §2.1, [Cursor staff on updates](https://forum.cursor.com/t/how-do-we-publish-a-plugin-update/176372).

Team-marketplace Auto Refresh does **not** apply to the public Marketplace.

### skills CLI / skills.sh — **automatic from GitHub**

New installs already get `main`: `npx skills add langfuse/skills --skill langfuse`. Existing installs need `npx skills update` ([CLI update docs](https://github.com/vercel-labs/skills/blob/main/docs/commands.md)). No publisher action.

[skills.sh/langfuse/skills/langfuse](https://www.skills.sh/langfuse/skills/langfuse) is telemetry from those installs, not a submission form. The page can lag the repo.

### Not a plugin marketplace: Halo

[Halo skill publishing](./halo-skill-publishing/README.md) pushes a derived `langfuse` skill into Langfuse Cloud via **Actions → Sync Halo skills** (`workflow_dispatch`). Staging from any branch; EU/US/JP/HIPAA from `main` only. Unrelated to Claude/Codex/Cursor. Run it when Halo should pick up the same skill fix.

## What this repo does not do

- No workflow publishes to Claude, Codex, or Cursor.
- No tags or GitHub Releases.
- No `.claude-plugin/marketplace.json` / `.cursor-plugin/marketplace.json` (a self-hosted marketplace would auto-update on `claude plugin update` / Cursor team Auto Refresh; we are listed on the vendors' catalogs instead).
