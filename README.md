# Langfuse Skills

AI agent skills for [Langfuse](https://langfuse.com) observability and prompt management.

## Skills

| Skill | Description |
|-------|-------------|
| [langfuse-observability](./skills/langfuse-observability) | Instrument LLM applications with Langfuse tracing |
| [langfuse-prompt-migration](./skills/langfuse-prompt-migration) | Migrate hardcoded prompts to Langfuse |
| [langfuse-cli](./skills/langfuse-cli) | Interact with the Langfuse REST API |

## Installation

```bash
npx skills add langfuse/skills --skill "langfuse-observability"
npx skills add langfuse/skills --skill "langfuse-prompt-migration"
npx skills add langfuse/skills --skill "langfuse-cli"
```

## Usage

These skills work with Claude Code, Cursor, and other AI coding agents that support the [Agent Skills](https://github.com/anthropics/skills) format.

Once installed, the agent will automatically use these skills when:
- Setting up Langfuse tracing in a project
- Migrating prompts to Langfuse prompt management
- Querying traces, prompts, or datasets via the API
- Auditing existing Langfuse instrumentation
