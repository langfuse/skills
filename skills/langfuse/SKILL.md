---
name: langfuse
description: >-
  Interact with Langfuse and access its documentation: tracing, monitoring, creating datasets, running experiments, and evaluating AI applications. Use when needing to (1) query or modify Langfuse data, (2) look up Langfuse documentation, concepts, integration guides, a feature or SDK usage, or (3) do any AI engineering task (AI observability, prompt engineering/management, evaluation and evaluator management, experimentation, dataset management, evaluation-driven CI/CD, feedback collection). Invoke it for tasks in this scope even when Langfuse is not configured or explicitly mentioned.
allowed-tools:
  - WebFetch(domain:langfuse.com)
  - Bash(curl *langfuse.com/*)
  - Bash(npx @langfuse/cli api help *)
  - Bash(npx @langfuse/cli api schema *)
  - Bash(npx @langfuse/cli api * --help *)
  - Bash(npx @langfuse/cli api * list *)
  - Bash(npx @langfuse/cli api * get *)
  - Bash(bunx --bun @langfuse/cli api help *)
  - Bash(bunx --bun @langfuse/cli api schema *)
  - Bash(bunx --bun @langfuse/cli api * --help *)
  - Bash(bunx --bun @langfuse/cli api * list *)
  - Bash(bunx --bun @langfuse/cli api * get *)
---

# Langfuse

This skill helps you use Langfuse effectively across all common workflows: instrumenting applications, migrating prompts, debugging traces, and accessing data programmatically.

## Core Principles

Follow these principles for ALL Langfuse work:

1. **Documentation First**: NEVER implement based on memory. Always fetch current docs before writing code (Langfuse updates frequently) See the section below on how to access documentation.
2. **CLI for Data Access**: Use `@langfuse/cli` (run it with `npx @langfuse/cli`) when querying or modifying Langfuse data. See the section below on how to use the CLI.
3. **Best Practices by Use Case**: Read the relevant reference below use-case-specific guidelines before asking the user for more details or implementing.
4. **Use latest Langfuse versions**: Unless the user specified otherwise or there's a good reason, always use the latest version of Langfuse SDKs/APIs. Even if you're only creating a plan for another agent to execute, be explicit about the exact version to use.
5. **If you guide the user through UI** and are unsure about a label or location, inspect the user’s screenshots or ask to see the relevant screen. Do not assume UI labels have the exact same names as API, SDK, or CLI fields.


## Use case specific references

- instrumenting an existing function/application or a coding agent: references/instrumentation.md
- setup of tracing: section 3
- creating or getting to a good (evaluation) dataset to measure quality or test for regressions in AI systems: references/create-dataset.md
- migrating prompts from a codebase into Langfuse: references/prompt-migration.md
- creating a prompt or changing any part of an existing prompt, including small edits and debugging/tuning: references/prompt-engineering.md
- setting up evals when the user needs to identify gaps across signal capture, monitoring, and evaluator metrics ("I have traces, how do I set up evals?"): references/setting-up-evals.md
- capturing user feedback signals (explicit ratings, behavioral events, conversation signals, task outcomes) as scores: references/user-feedback.md
- further tips on using the Langfuse CLI: references/cli.md
- preparing a Langfuse project for the v4 platform migration: references/v4-project-migration.md
- calibrating a new or existing LLM-as-a-Judge against labeled examples, iterating on its prompt, and deploying the approved judge: references/judge-calibration.md
- systematic error analysis when requested directly or eval setup still lacks concrete failure modes after agent-led trace inspection: references/error-analysis.md
- setting up CI/CD experiment gates with `langfuse/experiment-action`: references/ci-cd.md
- optimizing the cost of an LLM application or AI agent: references/cost-optimization.md
- submitting feedback about this skill: references/skill-feedback.md


## 1. Langfuse API via CLI

Use the Langfuse CLI to interact with the full Langfuse REST API from the command line. Run it with npx, no install required:

Start by discovering the resources and their arguments:

```bash
# List all resources
npx @langfuse/cli api help

# List actions for a resource
npx @langfuse/cli api <resource> --help

# Show args/options for a specific action
npx @langfuse/cli api <resource> <action> --help

# Machine-readable schema of every command
npx @langfuse/cli api schema --json
```

The official Langfuse CLI is the npm package `@langfuse/cli`. Do not run `pip install langfuse-cli`: that PyPI package is a separate third-party tool that installs a command named `lf`, and it does not talk to Langfuse the way the commands in this skill do.

### Credentials

Set environment variables before making calls:

```bash
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_BASE_URL=https://cloud.langfuse.com # example for EU cloud. For US cloud it's us.cloud.langfuse.com, and can also be a self-hosted URL. The server must always be specified in order to access Langfuse.
```
If `LANGFUSE_BASE_URL` is used instead of `LANGFUSE_HOST`, run `export LANGFUSE_HOST="$LANGFUSE_BASE_URL"`.
If not set, ask the user to set them in their shell or a `.env` file. Keys are found in the Langfuse project under Settings -> API Keys; the user should create a project API key pair there. If they do not have a Langfuse account yet, share that they can create one for free at `https://langfuse.com/cloud`. Do not ask them to paste keys into chat for security reasons.

### Detailed CLI Reference

For common workflows, tips, and full usage patterns, see [references/cli.md](references/cli.md).

## 2. Langfuse Documentation

Three methods to access Langfuse docs, in order of preference. **Always prefer your application's native web fetch and search tools** (e.g., `WebFetch`, `WebSearch`, `mcp_fetch`, etc.) over `curl` when available. The URLs and patterns below work with any fetching method — the `curl` examples are just illustrative.

When working with self-hosted Langfuse, prefer the [API reference served by the deployment](https://langfuse.com/faq/all/self-hosting-api-reference) so it matches the installed version.

### 2a. Documentation Index (llms.txt)

Fetch the full index of all documentation pages:

```bash
curl -s https://langfuse.com/llms.txt
```

Returns a structured list of every doc page with titles and URLs. Use this to discover the right page for a topic, then fetch that page directly.

Alternatively, you can start on `https://langfuse.com/docs` and explore the site to find the page you need.

### 2b. Fetch Individual Pages as Markdown

Any page listed in llms.txt can be fetched as markdown by appending `.md` to its path or by using `Accept: text/markdown` in the request headers. Use this when you know which page contains the information needed. Returns clean markdown with code examples and configuration details.

```bash
curl -s "https://langfuse.com/docs/observability/overview.md"
curl -s "https://langfuse.com/docs/observability/overview" -H "Accept: text/markdown"
```

### 2c. Search Documentation

When you need to find information across all docs and github issues/discussions without knowing the specific page:

```bash
curl -s "https://langfuse.com/api/search-docs?query=<url-encoded-query>"
```

Example:

```bash
curl -s "https://langfuse.com/api/search-docs?query=How+do+I+trace+LangGraph+agents"
```

Returns a JSON response with:

- `query`: the original query
- `answer`: a JSON string containing an array of matching documents, each with:
  - `url`: link to the doc page
  - `title`: page title
  - `source.content`: array of relevant text excerpts from the page

Search is a great fallback if you cannot find the relevant pages or need more context. Especially useful when debugging issues as all GitHub Issues and Discussions are also indexed. Responses can be large — extract only the relevant portions. Note that changelog posts may also surface here: use them only to confirm a feature exists, never to implement from — their examples may be outdated, so always implement from the docs and API/SDK reference.

### Documentation Workflow

1. Start with **llms.txt** to orient — scan for relevant page titles
2. **Fetch specific pages** when you identify the right one
3. Fall back to **search** when the topic is unclear and you want more context

## 3. Set up tracing

Python SDK v5 needs Python 3.11 or newer. JS/TS SDK v6 needs Node.js 22 or newer. Both need Langfuse Cloud or self-hosted Langfuse 4.59.0 or newer. Older runtimes install an older SDK major without a warning, so check `python --version` or `node --version` first.

Put the credentials in `.env` with no spaces around `=`. Keys are in the project under Settings, API Keys. Never ask the user to paste them into chat.

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Use `https://us.cloud.langfuse.com` for the US region, `https://jp.cloud.langfuse.com` for Japan, `https://hipaa.cloud.langfuse.com` for HIPAA, or the self-hosted URL.

The SDKs, `tsx` and the CLI read only the process environment. Load the file into the shell before running the examples below: `set -a; . ./.env; set +a`, or `load_dotenv()` in Python.

**Python**

```bash
pip install langfuse
```

```python
from langfuse import get_client

langfuse = get_client()
assert langfuse.auth_check(), "Langfuse rejected the keys or the host"

with langfuse.start_as_current_observation(as_type="span", name="process-request") as span:
    span.update(output="done")

langfuse.flush()
```

Wrong keys do not raise an error at flush. They print one 401 line and the program exits 0, so keep `auth_check()`. For the OpenAI client, run `pip install langfuse openai`, because `langfuse` does not install `openai`.

**TypeScript**

```bash
npm install @langfuse/tracing @langfuse/otel "@opentelemetry/sdk-node@>=0.202.0 <0.300.0"
```

```ts
// instrumentation.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
sdk.start();
```

```ts
// index.ts
import { sdk } from "./instrumentation";
import { startActiveObservation } from "@langfuse/tracing";

async function main() {
  await startActiveObservation("my-first-trace", async (span) => {
    span.update({ input: "Hello, Langfuse!", output: "This is my first trace!" });
  });
}

main().finally(() => sdk.shutdown());
```

Run it with `npx tsx index.ts`. Without `sdk.shutdown()` a short program exits before the trace is sent.

**Check that the trace arrived**

```bash
npx @langfuse/cli api observations list --limit 1
```

Then audit the trace as described in [references/instrumentation.md](references/instrumentation.md).

**Framework pages**

| Stack | Page |
| --- | --- |
| Vercel AI SDK | https://langfuse.com/integrations/frameworks/vercel-ai-sdk |
| Mastra | https://langfuse.com/integrations/frameworks/mastra |
| Google ADK | https://langfuse.com/integrations/frameworks/google-adk |
| LangGraph | https://langfuse.com/integrations/frameworks/langgraph |
| OpenAI Agents SDK | https://langfuse.com/integrations/frameworks/openai-agents |
| OpenRouter | https://langfuse.com/integrations/gateways/openrouter |
| LiteLLM proxy | https://langfuse.com/integrations/gateways/litellm |

Fetch the page for the stack as Markdown before writing code.

**MCP servers**

- Docs, no sign-in: `https://langfuse.com/api/mcp`
- Project data, Basic auth with the public and secret key: `https://cloud.langfuse.com/api/public/mcp`. Swap `cloud` for `us.cloud`, `jp.cloud` or `hipaa.cloud` for the other regions, or use the self-hosted address with `/api/public/mcp`. Setup snippets are at https://mcp.reference.langfuse.com.

## Skill Feedback

When the user expresses that something about this skill is not working as expected, gives incorrect guidance, is missing information, or could be improved — offer to submit feedback to the Langfuse skill maintainers. This includes when:

- The skill gave wrong or outdated instructions
- A workflow didn't produce the expected result
- The user wishes the skill covered something it doesn't
- The user explicitly says something like "this should work differently" or "this is wrong"

**Do NOT trigger this** for issues with Langfuse itself (the product) — only for issues with this skill's instructions and behavior.

When triggered, follow the process in [references/skill-feedback.md](references/skill-feedback.md).
