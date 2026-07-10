---
name: langfuse-multi-agent-tracing
description: Structure Langfuse traces for multi-agent and autonomous coding-agent systems — observation type selection across the full vocabulary, nesting subagents and their tool calls, and the exact input/output shape Langfuse renders as chat. Use when instrumenting an agent that dispatches subagents or tool calls (coding agents, research agents, orchestrator/worker systems), or when a trace looks flat, has misnamed nodes, or doesn't show up in the Agent Graph as expected.
---

# Multi-Agent Tracing

Guidance for tracing systems where one agent's execution involves LLM calls, tool calls, AND dispatching other agents — coding agents (Claude Code, Codex, and similar), research agents, or any orchestrator/worker architecture. This goes deeper than [instrumentation.md](instrumentation.md)'s baseline checklist in two places that matter specifically for multi-agent systems: which of Langfuse's observation types to use beyond `generation`/`tool`, and how nesting should work when an agent's own generation is what triggers a tool call or spawns a subagent.

## When to Use

- An agent dispatches subagents (worker/explorer/researcher patterns, orchestrator-and-tools architectures)
- A trace mixes LLM reasoning, tool calls, and delegated sub-tasks, and looks flat or hard to follow
- You want subagents to show up as their own nodes in the [Agent Graph](https://langfuse.com/docs/observability/features/agent-graphs), not as opaque tool calls
- Tool calls aren't rendering as chat-style cards in the UI even though the observation type is correct

## The Full Observation Type Vocabulary

[instrumentation.md](instrumentation.md) and Langfuse's own attribute-mapping docs mostly talk about `generation` and `tool`. There are **10 observation types**, and for a multi-agent system the other 8 matter — several exist specifically to represent things a single-agent chatbot never needs. Use whichever is semantically correct for what the observation actually did, not whichever renders "close enough":

| Type | What it's for | Multi-agent example |
| --- | --- | --- |
| `span` | Generic unit of work — the default when nothing more specific applies | The root of one agent invocation, or a container that groups several sub-steps that don't fit another type |
| `generation` | An LLM call — carries model, token usage, cost | Each real reasoning/response turn the agent takes |
| `agent` | A component that decides on flow and uses tools under LLM guidance | A dispatched subagent's own execution — this is NOT the same as a bare tool call that happens to spawn something; it's the subagent's actual reasoning-and-acting loop |
| `tool` | A single action, e.g. a function/API call | Shell commands, file reads, most function calls |
| `chain` | A link between application steps, e.g. passing context from a retriever to an LLM call | A container that ties several sequential steps or invocations together into one logical flow |
| `retriever` | A data-retrieval step — vector store, database, or knowledge-base lookup | A search/query/read call against a knowledge source: full-text search over a chat/wiki tool, a query to a docs/notes tool, a call to a vector-search or internal knowledge-base system. Distinguishing these from generic `tool` calls matters beyond semantics — see "Retrieval vs. action calls" below |
| `evaluator` | Assesses relevance/correctness/helpfulness of an output | An in-line quality check the agent runs on its own or a subagent's output |
| `embedding` | An embedding-model call — carries model, usage, cost like `generation` | If your agent (or a background job it triggers) generates embeddings for a knowledge base, this is the type for that call — see the gap below |
| `guardrail` | Protects against malicious content or jailbreaks | An input/output safety check |
| `event` | The basic building block for a discrete, instantaneous event | A point-in-time marker that isn't itself a unit of work |

**A real gap worth checking for**: if your agent writes facts into a knowledge base (for later retrieval by itself or other agents) and that writeback involves generating embeddings, check whether that call is traced at all. It's easy for this to happen in a background job or async pipeline that's architecturally separate from the live conversational trace — which means it never gets instrumented by whatever captures the main agent loop. If you have such a pipeline, it's a legitimate candidate for its own `embedding`-typed trace.

### Retrieval vs. action calls

A tool call that fundamentally *looks something up* (a knowledge-base query, a document search, a database read) is better typed `retriever` than generic `tool`. This isn't just semantics:

- Analytics that count "tool calls" as a proxy for "actions the agent took" get skewed if lookups are mixed in with actual mutations/side-effecting calls.
- It's the correct type per Langfuse's own definition ("data retrieval steps, such as a call to a vector store or a database").

Concrete examples: a chat-search or forum-search call, a query against a notes/wiki tool, a read from a shared drive/document store, a call to a vector-search or internal knowledge-base system. If you're not sure, ask: "did this call change any state, or did it just fetch something that already existed?" — retrieval if the latter.

## Nesting: what should contain what

**The core rule**: a tool call (or a subagent dispatch) nests under the generation that decided to make it — not flat as a sibling next to that generation, both dangling under some shared container. Concretely:

```
trace
└─ agent invocation (span or chain)
   ├─ generation (turn 1 — reasoned, decided to call a tool)
   │  └─ tool call (the action that turn 1 triggered)
   ├─ generation (turn 2 — decided to dispatch a subagent)
   │  └─ agent (the subagent's own execution)
   │     ├─ generation (the subagent's own turn 1)
   │     │  └─ tool call
   │     └─ generation (the subagent's own turn 2 — dispatches ITS OWN subagent)
   │        └─ agent (recurses exactly the same way)
   └─ generation (turn 3 — final answer, no tool calls)
```

This is recursive and uniform at every level: a subagent's own tool calls and further dispatches follow the identical parent-child rule its parent did. The common mistake is nesting a turn's tool calls and its generation as siblings under a shared "agent" or "skill" container, associated only by which turn happened to run around the same time — that flattens the tree and makes it impossible to tell, just by looking at the structure, which action came from which decision.

**One structural collapse to watch for**: if you emit both (a) a bare `tool`-typed span for the literal "dispatch a subagent" call, AND (b) a separate `agent`-typed observation for what that subagent actually did, as *siblings* — you now have two representations of the same event side by side, which reads as if one might be the parent of the other (it isn't; they're duplicates). Emit only the `agent`-typed observation when you have the subagent's actual execution to show; keep the bare tool span only as a fallback for when you dispatched something and don't (yet, or ever) have visibility into what it did internally.

**A hazard when computing parent IDs programmatically**: if you build an index mapping some intermediate key (a message ID, a call ID) to the observation ID you're about to set as a parent, and that index can have collisions (e.g. a retried or duplicated event sharing a key with an earlier one), always resolve first-match-wins, never last-match-wins. Langfuse silently re-parents an observation to the trace root if its declared parent ID doesn't correspond to an observation that was actually sent — so if your index points at something that got skipped or overwritten, children don't error, they just silently flatten to root, and if any cost/usage got attributed through that same broken link, it can be double-counted. This is the kind of bug that's invisible until you're specifically looking at trace shape and total cost together.

## The Agent Graph

The [Agent Graph](https://langfuse.com/docs/observability/features/agent-graphs) is a separate flow-diagram view of a trace, alongside the tree view. Two things worth knowing that aren't obvious from the docs alone:

- **The panel only appears at all if the trace has at least one observation typed something other than `span`, `generation`, or `event`** — i.e. at least one `tool`, `agent`, `chain`, `retriever`, `evaluator`, `embedding`, or `guardrail`. A trace built entirely from `span`/`generation` observations (the pattern most single-agent chatbot instrumentation uses) won't show a graph at all — this is one more reason multi-agent systems benefit from using the fuller type vocabulary above.
- **Once the panel appears, every observation in the trace becomes a graph node, regardless of type** — including `span` and `generation` nodes. A `generation` sitting between two other nodes in the parent chain does not get skipped or cause its child to appear disconnected; it just renders as a node like anything else. In other words: get the nesting right per the rule above, and the graph takes care of itself — there's no separate set of graph-specific nesting rules to satisfy.
- The graph has two view modes. The default collapses the whole trace into one straight chain ordered by start time, which hides branching entirely — a trace with several things happening in parallel (e.g. multiple dispatched subagents) will look misleadingly linear in this view. The alternate "expanded" mode shows the real tree with branches. If a multi-agent trace looks like a flat line in the Agent Graph, check whether you're looking at the default view before concluding the trace itself is poorly structured.

## Making tool calls render as chat, not raw JSON

Langfuse's "pretty" view tries to parse an observation's `input`/`output` as a chat-message array; if the parse succeeds you get role-labeled bubbles and dedicated cards for tool calls, if it fails you get plain JSON. This is **shape-keyed, not type-keyed** — it applies the same check regardless of observation type, so this matters for `generation` output that includes tool calls, not just for making things "look nicer."

The schema is strict on one point that's easy to get wrong: a tool call inside a chat message must be `{"id": "<string>", "name": "<string>", "arguments": "<JSON-encoded string>"}` — flat, and `arguments` must be a **string** (JSON-encoded), not a nested object. A very natural first attempt is something like `{"name": "search", "input": {...}}` (no `id`, wrong key name, and a raw object instead of an encoded string) — this fails the schema, and because failing a *recognized* key fails parsing for the whole message (not just that field), the entire observation silently falls back to raw JSON instead of the chat view you were expecting. If tool-call-bearing generations in your traces render as raw JSON blobs instead of chat cards, this shape mismatch is the first thing to check.

A few adjacent details from the same schema:
- `role` accepts any string, not just `user`/`assistant`/`system`/`tool` — so a custom role name won't break parsing.
- Every generation should have both an input and an output, even when a turn made no tool calls and produced no visible text — represent "did nothing visible" explicitly (e.g. omit the field, or use a minimal placeholder) rather than a broken shape. A tool-call-only turn (no text, only actions) should still populate output with the tool call(s) it made, not leave output empty.
- Reconstructing a running "input" (the conversation as it stood right before each turn, not just a repeat of the original prompt) makes each generation's input meaningfully different from every other's, instead of all showing the same static seed value. Cap this at a reasonable size (well under Langfuse's own ~300KB parse ceiling for input/output) with an explicit truncation marker if you hit it, rather than sending unbounded payloads or truncating silently mid-structure.

## Common Anti-Patterns (multi-agent specific)

These are specific to agent-dispatching systems, on top of the general anti-patterns in [instrumentation.md](instrumentation.md):

| Anti-pattern | What it looks like | Fix |
| --- | --- | --- |
| Subagent dispatch typed as generic `tool`/`span` | A dispatched subagent's work is invisible or shows as one opaque action with no internal structure | Type the subagent's own execution as `agent`; nest its generations/tools underneath it |
| Tool calls flat next to their triggering generation | Tree shows a turn's generation and the 3 tool calls it made as unindented siblings, connected only by proximity | Nest each tool call under the generation that triggered it (see Nesting above) |
| Duplicate dispatch + execution nodes | Two sibling observations represent the same "spawn a subagent" event — one a bare tool call, one the subagent's actual work | Collapse to one: the `agent`-typed observation, when you have it |
| All subagents named identically | Every dispatched subagent shows the same generic name (e.g. its framework's default worker type), indistinguishable in the tree/graph | Derive a more specific name from the subagent's actual task/role when the framework doesn't provide one already |
| Retrieval calls typed as generic `tool` | Knowledge-base/vector-search/document-lookup calls mixed in with action calls under the same type | Type them `retriever` |
| Tool-call-bearing generation renders as raw JSON | Expected chat bubbles and tool-call cards, got a JSON blob instead | Check the `tool_calls` shape against the schema in "Making tool calls render as chat" above |
