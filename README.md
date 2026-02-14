# Langfuse Skills

[Agent Skills](https://github.com/anthropics/skills) that teach AI coding assistants (Claude Code, Cursor, etc.) how to work with [Langfuse](https://langfuse.com) — the open-source LLM engineering platform for tracing, prompt management, and evaluation.

## Skills

| Skill                                                           | Description                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [langfuse](./skills/langfuse)                                   | Query and manage traces, prompts, datasets, and scores via the Langfuse API; look up documentation |
| [langfuse-observability](./skills/langfuse-observability)       | Add Langfuse tracing to LLM applications with framework-specific best practices                    |
| [langfuse-prompt-migration](./skills/langfuse-prompt-migration) | Migrate hardcoded prompts to Langfuse for version control and deployment-free iteration            |

## Installation

Install via the [skills CLI](https://github.com/anthropics/skills):

```bash
npx skills add langfuse/skills --skill "langfuse"
npx skills add langfuse/skills --skill "langfuse-observability"
npx skills add langfuse/skills --skill "langfuse-prompt-migration"
```

## Prerequisites

You need a Langfuse account ([cloud](https://cloud.langfuse.com) or [self-hosted](https://langfuse.com/docs/deployment/self-host)) and API keys:

```bash
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_HOST=https://cloud.langfuse.com  # or https://us.cloud.langfuse.com, or self-hosted URL
```

API keys are found in your Langfuse project under **Settings > API Keys**.

## Usage

Once installed, the agent will automatically use these skills when relevant — for example:

- Setting up Langfuse tracing in a project
- Auditing existing instrumentation
- Migrating prompts to Langfuse prompt management
- Querying traces, prompts, or datasets via the API
- Looking up Langfuse docs, SDK usage, or integration guides
