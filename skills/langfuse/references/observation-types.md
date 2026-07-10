---
name: langfuse-observation-types
description: Choose the correct Langfuse observation type for a span — the full vocabulary beyond generation/tool (agent, chain, retriever, evaluator, embedding, guardrail, event), what each is for, and why a retrieval call should be typed retriever rather than generic tool. Use when instrumenting any non-trivial trace, auditing existing observation types, or deciding how to label a call that doesn't obviously fit generation or tool.
---

# Observation Types

Most instrumentation only ever sets `generation` (an LLM call) and `tool` (an action). Langfuse has
**10 observation types** in total, and the other 8 exist to represent things those two don't capture
well — a retrieval step, a subagent's own reasoning loop, a safety check, an embedding call. Using the
semantically correct type (not whichever "renders close enough") is what makes filtering, cost
attribution, and the [Agent Graph](https://langfuse.com/docs/observability/features/agent-graphs) (see
[trace-structure.md](trace-structure.md) and [multi-agent-tracing.md](multi-agent-tracing.md)) actually
useful.

| Type | What it's for | Example |
| --- | --- | --- |
| `span` | Generic unit of work — the default when nothing more specific applies | The root of one request, or a container that groups several sub-steps that don't fit another type |
| `generation` | An LLM call — carries model, token usage, cost | Each reasoning/response turn a model makes |
| `agent` | A component that decides on flow and uses tools under LLM guidance | A dispatched subagent's own execution loop — see [multi-agent-tracing.md](multi-agent-tracing.md) for nesting and naming it |
| `tool` | A single action, e.g. a function/API call | Shell commands, file writes, most function calls |
| `chain` | A link between application steps, e.g. passing context from a retriever to an LLM call | A container that ties several sequential steps together into one logical flow |
| `retriever` | A data-retrieval step — vector store, database, or knowledge-base lookup | A search/query/read call against a knowledge source: full-text search over a chat/wiki tool, a query to a docs/notes tool, a call to a vector-search or internal knowledge-base system |
| `evaluator` | Assesses relevance/correctness/helpfulness of an output | An in-line quality check run on a model's own output |
| `embedding` | An embedding-model call — carries model, usage, cost like `generation` | A call that generates embeddings for a knowledge base, semantic cache, or similar index |
| `guardrail` | Protects against malicious content or jailbreaks | An input/output safety check |
| `event` | The basic building block for a discrete, instantaneous event | A point-in-time marker that isn't itself a unit of work |

**A gap worth checking for**: if your application writes facts into a knowledge base for later
retrieval and that writeback involves generating embeddings, check whether that call is traced at
all. It's easy for this to happen in a background job or async pipeline that's architecturally
separate from the live request trace — which means it never gets instrumented by whatever captures
the main request loop. If you have such a pipeline, it's a legitimate candidate for its own
`embedding`-typed trace, rather than squeezing it into the conversational one.

## Retrieval vs. action calls

A tool call that fundamentally *looks something up* (a knowledge-base query, a document search, a
database read) is better typed `retriever` than generic `tool`. This isn't just semantics:

- Analytics that count "tool calls" as a proxy for "actions taken" get skewed if lookups are mixed in
  with actual mutations/side-effecting calls.
- It's the correct type per Langfuse's own definition ("data retrieval steps, such as a call to a
  vector store or a database").

Concrete examples: a chat-search or forum-search call, a query against a notes/wiki tool, a read from
a shared drive/document store, a call to a vector-search or internal knowledge-base system. If you're
not sure, ask: "did this call change any state, or did it just fetch something that already existed?"
— retrieval if the latter.
