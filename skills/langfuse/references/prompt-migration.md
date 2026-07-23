---
name: langfuse-prompt-migration
description: Migrate hardcoded prompts to Langfuse for version control and deployment-free iteration. Use when user wants to externalize prompts, move prompts to Langfuse, or set up prompt management.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_SCRIPT
---

# Langfuse Prompt Migration

Migrate hardcoded prompts into Langfuse-managed prompts. The API mechanics (`create_prompt`, `get_prompt`, `.compile()`, linking to traces) are in the docs — fetch them at execution time.

## Prerequisites

Verify credentials exist — check presence only, never print the secret key (its value would land in the agent's context and transcripts):

```bash
[ -n "$LANGFUSE_PUBLIC_KEY" ] && echo "public key: set" || echo "public key: missing"
[ -n "$LANGFUSE_SECRET_KEY" ] && echo "secret key: set" || echo "secret key: missing"
[ -n "$LANGFUSE_BASE_URL" ]   && echo "base url: $LANGFUSE_BASE_URL" || echo "base url: missing"
```

If missing, ask the user to set them in their shell or a `.env` file. Do not ask them to paste keys into chat.

## 1. Inventory every prompt (before writing any code)

For each prompt, record:

- **Name**: lowercase, hyphenated (e.g. `chat-assistant`)
- **Source file**: where the prompt text lives
- **Code file to refactor**: the file that USES the prompt. For asset files (`.txt`/`.yaml`/`.md`), this is the file that loads the asset, not the asset itself
- **Type**: `chat` (message array) or `text` (plain string)
- **Variables**: values interpolated in, converted to `{{var}}`
- **Content**: the actual text to upload

Prompts typically live in OpenAI message arrays, Anthropic system arguments, LangChain prompt templates, Vercel AI system/prompt fields, and raw multi-line strings near LLM calls.

## 2. Convert templating and decide structure

**Variable syntax:** Langfuse substitutes only double-brace `{{var}}`. Convert every single-brace form during upload — `{var}`, `${var}`, f-string `{var}`, `.format(var=...)`, and string concatenation all become `{{var}}`. Uploading `{var}` will silently fail to substitute.

**Complex templates:** Langfuse has no conditionals, loops, or filters. If the code uses them (e.g. Jinja `{% if %}`/`{% for %}`), either pre-compute the value in code and pass a plain `{{variable}}` (recommended), or store the raw template and compile client-side — which loses Playground preview and UI experiments. See https://langfuse.com/docs/prompt-management/features/variables and the [external templating FAQ](https://langfuse.com/faq/all/using-external-templating-libraries).

**What to make a variable vs. keep hardcoded:**

| Make variable | Keep hardcoded |
|---------------|----------------|
| User-specific (`{{user_name}}`) | Output format instructions |
| Dynamic content (`{{context}}`) | Safety guardrails |
| Per-request (`{{query}}`) | Persona / personality |
| Environment-specific (`{{company_name}}`) | Static examples |

**Naming:** lowercase-hyphenated, feature-based (`document-summarizer`), hierarchical for related prompts (`support/triage`), prefix subprompts with `_` (`_base-personality`). Extract a subprompt when the same text appears in 2+ prompts, forms a distinct component, or would change together.

## 3. Get approval, then create and refactor

Present the plan and get approval before writing anything — how many prompts across which files, proposed names, subprompts to extract, variables to add, and any complex templates you'll simplify.

Once approved:

- Create the prompts (label migrated prompts `production` — they're already live) and refactor call sites to fetch each prompt from Langfuse and compile its variables in. The SDK calls differ across Python and JS/TS — fetch the current docs: https://langfuse.com/docs/prompt-management/get-started
- Fetch by the `production` label
- If the codebase already has Langfuse tracing (decorators, an instrumented client, or manual spans), link prompts so you can see which version produced each response. See https://langfuse.com/docs/prompt-management/features/link-to-traces

## 4. Verify

- All prompts created with the `production` label; code fetches with `label="production"`
- Variables and subprompts compile without errors
- Application behavior is unchanged
- Generations show the linked prompt in the UI (if tracing enabled)
