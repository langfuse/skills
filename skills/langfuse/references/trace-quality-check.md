---
name: langfuse-trace-quality-check
description: Analyze a sample of recent traces from a Langfuse project and suggest concrete instrumentation improvements. Use when a user wants to check their trace quality, debug poorly-structured traces, or improve their observability setup.
---

# Trace Quality Check

Fetch and analyze recent traces from a user's Langfuse project, then generate actionable instrumentation improvements.

## When to Use

- User says traces "look wrong" or aren't capturing what they expect
- User wants to verify their instrumentation is set up correctly
- User asks to improve their observability or trace quality
- Onboarding a new user who already has traces flowing

## Workflow

### 1. Fetch a Sample of Recent Traces

Use the Langfuse CLI to pull recent traces. Fetch enough to see a variety of trace shapes — aim for 20–50 traces.

```bash
# Fetch recent traces (adjust limit as needed)
npx langfuse-cli api traces list --limit 50
```

If the project has high volume, also sample across different time windows or use tags/names to get diverse trace shapes:

```bash
# Filter by name if the user reports issues with a specific flow
npx langfuse-cli api traces list --limit 20 --name "chat-response"
```

For each trace that looks potentially problematic, fetch its full observation tree:

```bash
npx langfuse-cli api traces get --id <trace-id>
```

### 2. Analyze Trace Structure

Check each trace against these anti-patterns:

| Anti-pattern | What it looks like | Severity |
| --- | --- | --- |
| Generic HTTP root span | Root observation is `POST /api/chat` or similar with no named children | High |
| Missing generation spans | No observations with type `GENERATION` — LLM calls aren't being tracked | High |
| Flat single-span trace | Trace contains only one observation for a multi-step operation | High |
| Over-instrumentation | 50+ child observations for a simple call — framework internals leaking through | Medium |
| Missing model name | Generation observations exist but `model` field is null | Medium |
| Missing token counts | Generation observations have no `usage` data (input/output tokens) | Medium |
| No user or session IDs | Traces lack `userId` and `sessionId` even though the app is user-facing or conversational | Medium |
| Generic trace names | Names like `trace-1`, `unnamed`, or auto-generated UUIDs | Low |
| Missing input/output | Observations have empty or null `input`/`output` fields | Medium |
| Leaking all function args as input | Trace input contains API keys, configs, or irrelevant parameters instead of just the user message | High |

**What a good trace looks like** (use as a reference when evaluating):

- Represents one self-contained unit of work (a single chat turn, one agent execution, one pipeline run)
- Uses correct observation types: LLM calls are `GENERATION`, tool calls are `SPAN` or have clear names
- Has descriptive, action-oriented names (`classify-intent`, `generate-response` — not model names like `gpt-4o`)
- Every observation has meaningful input and/or output
- Generations include model name and token usage
- Metadata, tags, user IDs, and session IDs are present where relevant
- Noisy HTTP spans, database queries, and framework internals are filtered out

### 3. Generate the Improvement Report

For each issue found, output a specific suggestion with:
- **What's wrong**: describe the anti-pattern observed, referencing specific trace IDs
- **Why it matters**: explain the impact on debugging/analytics
- **How to fix**: provide a concrete code snippet

Structure the report as a prioritized list, grouped by severity (high → medium → low).

#### Common suggestions and code snippets

**Missing OpenAI generation tracking (Python):**

```python
# Before: raw OpenAI client — calls won't appear as generations
from openai import OpenAI
client = OpenAI()

# After: Langfuse-wrapped client — calls are automatically tracked
from langfuse.openai import OpenAI
client = OpenAI()
```

**Missing OpenAI generation tracking (JS/TS):**

```typescript
// Before: raw OpenAI client
import OpenAI from "openai";
const client = new OpenAI();

// After: wrapped with Langfuse observeOpenAI
import OpenAI from "openai";
import { observeOpenAI } from "langfuse";
const client = observeOpenAI(new OpenAI());
```

**Flat traces — add nested spans (Python):**

```python
from langfuse.decorators import observe, langfuse_context

@observe()
def handle_request(user_message):
    context = retrieve_context(user_message)
    response = generate_response(user_message, context)
    return response

@observe()
def retrieve_context(query):
    # retrieval logic — appears as a child span
    ...

@observe()
def generate_response(query, context):
    # LLM call — appears as a child span
    ...
```

**Flat traces — add nested spans (JS/TS):**

```typescript
import { Langfuse } from "langfuse";
const langfuse = new Langfuse();

const trace = langfuse.trace({ name: "handle-request" });

const retrievalSpan = trace.span({ name: "retrieve-context" });
// ... retrieval logic
retrievalSpan.end();

const generationSpan = trace.generation({
  name: "generate-response",
  model: "gpt-4o",
  input: messages,
});
// ... LLM call
generationSpan.end({ output: result, usage: { input: 100, output: 50 } });
```

**Missing user/session IDs:**

```python
from langfuse.decorators import observe, langfuse_context

@observe()
def handle_request(user_message, user_id, session_id):
    langfuse_context.update_current_trace(
        user_id=user_id,
        session_id=session_id,
    )
    ...
```

**Generic trace names:**

```python
# Before: no name — trace will be auto-named after the function
@observe()
def main(input):
    ...

# After: descriptive name
@observe(name="chat-response")
def main(input):
    ...
```

**Leaking function args as input:**

```python
@observe()
def handle_request(user_message, api_key, config):
    # By default, @observe captures ALL args as input — including api_key and config
    # Fix: explicitly set the input to only the relevant data
    langfuse_context.update_current_observation(
        input={"message": user_message}
    )
    ...
```

**Over-instrumentation — disable noisy auto-tracing:**

If using a framework integration that captures too many internal spans, selectively disable or filter:

```python
# For OpenTelemetry-based integrations, configure span filtering
# to exclude low-level HTTP/DB spans
```

Point the user to the relevant framework integration docs for specific filtering options.

### 4. Present Results

Format the output as a clear, prioritized report. Example structure:

```
## Trace Quality Report

Analyzed 35 traces from the last 24 hours.

### High Priority

1. **OpenAI calls not captured as generations** (found in 28/35 traces)
   Your OpenAI calls are going through the raw client, so they don't appear
   as generation observations. This means no token tracking or cost calculation.

   Fix: [code snippet]

2. **All function args leaking into trace input** (found in 35/35 traces)
   Trace inputs contain API keys and config objects alongside the user message.

   Fix: [code snippet]

### Medium Priority

3. **No session IDs on conversational traces** (found in 35/35 traces)
   Your app handles multi-turn conversations but traces aren't grouped by session.
   This makes it impossible to follow a full conversation flow.

   Fix: [code snippet]

### Looking Good

- Trace names are descriptive and consistent
- Span hierarchy is well-structured for retrieval steps
```

Do NOT auto-apply any changes. Present the report for the user to review and decide what to implement.

## References

- What a good trace looks like: https://langfuse.com/faq/all/what-does-a-good-trace-look-like
- Tracing overview: https://langfuse.com/docs/tracing
- Framework integrations: https://langfuse.com/docs/integrations
