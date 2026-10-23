# Halo skill publishing

Run **Sync Halo skills** manually from GitHub Actions. Staging can publish from
any branch; EU, US, JP, and HIPAA publish only from `main`.
The `prepare` job converts
`skills/langfuse/references/*.md` to `<skill-name>/SKILL.md` and uploads a
`halo-skills` artifact. It also installs `@langfuse/cli@1.3.0-beta.3` once using
`npm ci` and the lockfile in `halo-skill-publishing`, then uploads
that package as `halo-cli`. Preparation has no project credentials.

Five regional jobs download both artifacts through the shared
[publishing action](../.github/actions/publish-halo-skills/action.yml). The
action calls `skills push --recursive --no-lockfile --label production`
directly, then uses `api skills update` to add `in-app-agent`, preserving other
tags. The CLI handles version creation, unchanged-content detection, snapshot
verification, and labels. The action fails if the CLI skips any skill.

The CLI package is self-contained and has no runtime dependencies. Sharing the
installed package avoids five npm installs; each runner still sets up Node.js.
Regions run independently. A failed job can be rerun without creating duplicate
versions. Removed references do not delete hosted skills: remove the old
skill's `in-app-agent` tag in each project to stop Halo loading it.

Configure these repository secrets in `langfuse/skills`, using the same
AI-features project credentials configured for Halo in each region:

| Region  | Public key secret                         | Secret key secret                         |
| ------- | ----------------------------------------- | ----------------------------------------- |
| STAGING | `LANGFUSE_AI_FEATURES_STAGING_PUBLIC_KEY` | `LANGFUSE_AI_FEATURES_STAGING_SECRET_KEY` |
| EU      | `LANGFUSE_AI_FEATURES_EU_PUBLIC_KEY`      | `LANGFUSE_AI_FEATURES_EU_SECRET_KEY`      |
| US      | `LANGFUSE_AI_FEATURES_US_PUBLIC_KEY`      | `LANGFUSE_AI_FEATURES_US_SECRET_KEY`      |
| JP      | `LANGFUSE_AI_FEATURES_JP_PUBLIC_KEY`      | `LANGFUSE_AI_FEATURES_JP_SECRET_KEY`      |
| HIPAA   | `LANGFUSE_AI_FEATURES_HIPAA_PUBLIC_KEY`   | `LANGFUSE_AI_FEATURES_HIPAA_SECRET_KEY`   |

Halo's worker must have `LANGFUSE_IN_APP_AGENT_SKILLS_TAG=in-app-agent` to load
these skills. Repository content becomes the production version even if someone
has edited the skill in the UI.

## Local use

Install the CLI and prepare the skill directories (Node.js 24 required):

```sh
npm ci --prefix halo-skill-publishing --ignore-scripts --no-audit --no-fund
node halo-skill-publishing/prepare-halo-skills.mjs .halo-skills
```

Preparation validates the references and requires a new output directory.
Remove the previous `.halo-skills` directory before preparing again.

Copy [`.env.halo.example`](../.env.halo.example) to `.env.halo` and fill in the
target project's credentials. For a local instance:

```dotenv
LANGFUSE_BASE_URL=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Push directly with the CLI:

```sh
# npm install --global --ignore-scripts @langfuse/cli@1.3.0-beta.3
langfuse --env .env.halo skills push .halo-skills --recursive --no-lockfile --label production
```

Apply the Halo tag, preserving existing tags:

```sh
for skill in .halo-skills/*; do
  name="$(basename "$skill")"
  body="$(langfuse --env .env.halo api skills get "$name" --label production --json \
    | jq -c '{tags: (.body.tags + ["in-app-agent"] | unique)}')"
  langfuse --env .env.halo api skills update "$name" --body-json "$body"
done
```
