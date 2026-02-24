# Langfuse Skills

[Agent Skills](https://github.com/anthropics/skills) that teach AI coding assistants (Claude Code, Cursor, etc.) how to work with [Langfuse](https://langfuse.com) — the open-source LLM engineering platform for tracing, prompt management, and evaluation.

## Skills

| Skill                                                           | Description                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [langfuse](./skills/langfuse)                                   | Main skill to work with Langfuse. Query and manage traces, prompts, datasets, and scores via the Langfuse API; look up documentation; do things with best practices in mind. |

## Installation

### Cursor Plugin

Install as a [Cursor plugin](https://cursor.com/docs/plugins):

```
/add-plugin langfuse
```

### skills CLI

Install via the [skills CLI](https://github.com/anthropics/skills):

```bash
npx skills add langfuse/skills --skill "langfuse"
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
