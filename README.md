<img width="2400" height="600" alt="hero-b" src="https://github.com/user-attachments/assets/c177a82d-334b-495c-81cb-9df69c521123" />

# Langfuse Skills

[Agent Skills](https://github.com/anthropics/skills) that teach AI coding assistants (Claude Code, Cursor, etc.) how to work with [Langfuse](https://langfuse.com) — the open-source LLM engineering platform for tracing, prompt management, and evaluation.

## Skills

| Skill                                                           | Description                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [langfuse](./skills/langfuse)                                   | Main skill to work with Langfuse. Query and manage traces, prompts, datasets, and scores via the Langfuse API; look up documentation; do things with best practices in mind. |
| [langfuse-improvement-loop](./skills/langfuse-improvement-loop) | Close the loop from a reported production symptom to a measured improvement, grounded in Langfuse data: root-cause from traces, assess fix options, make the change behind a safe boundary, encode failures as dataset cases + an evaluator, and decide via a candidate-vs-baseline experiment. |
| [langfuse-trace-triage](./skills/langfuse-trace-triage)         | Triage a Langfuse project's recent production traffic for issues and report them ranked by severity. Identifies the real application traces, sweeps a fixed set of dimensions (failed tool calls, cost spikes, latency, bad scores, user friction, retrieval quality, etc.), ranks findings P0–P3, and offers to save a markdown report. |
| [langfuse-production-loop](./skills/langfuse-production-loop)   | Umbrella skill that runs the full production-quality loop end to end — discover → prioritize → fix → prove — orchestrating `langfuse-trace-triage` and `langfuse-improvement-loop`. Use when you want to improve an app broadly rather than run a single phase. |

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

### Manual symlink

Clone this repo and symlink the skill into your agent's skills directory:

```bash
git clone https://github.com/langfuse/skills.git /path/to/langfuse-skills
ln -s /path/to/langfuse-skills/skills/langfuse /path/to/skills-directory/langfuse
```

## Prerequisites

You need a Langfuse account ([cloud](https://cloud.langfuse.com) or [self-hosted](https://langfuse.com/docs/deployment/self-host)) and API keys:

```bash
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_BASE_URL=https://cloud.langfuse.com  # or https://us.cloud.langfuse.com, or self-hosted URL
```

API keys are found in your Langfuse project under **Settings > API Keys**.

## Usage

Once installed, the agent will automatically use these skills when relevant — for example:

- Setting up Langfuse tracing in a project
- Setting up CI/CD experiment gates with `langfuse/experiment-action`
- Auditing existing instrumentation
- Migrating prompts to Langfuse prompt management
- Querying traces, prompts, or datasets via the API
- Looking up Langfuse docs, SDK usage, or integration guides

## Feedback & Requests

Something not working as expected, or want a new skill? [Start a discussion](https://github.com/langfuse/skills/discussions/new?category=ideas-improvements).
