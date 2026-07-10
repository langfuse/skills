---
name: langfuse-multi-agent-tracing
description: Trace systems that dispatch subagents — coding agents (Claude Code, Codex, and similar), research agents, or any orchestrator/worker architecture. Covers the `agent` observation type, nesting a subagent's own execution under the generation that dispatched it, avoiding duplicate dispatch+execution nodes, naming subagents distinctly, and how the Agent Graph visualizes a multi-agent trace. For observation type selection in general, see observation-types.md; for tool-call nesting and chat rendering that apply to any trace, see trace-structure.md.
---

# Multi-Agent Tracing

Guidance specific to tracing systems where one agent's execution involves dispatching OTHER agents —
coding agents (Claude Code, Codex, and similar), research agents, or any orchestrator/worker
architecture. This builds on two general references: [observation-types.md](observation-types.md) for
the full type vocabulary (this doc only adds detail on the `agent` type) and
[trace-structure.md](trace-structure.md) for the base nesting/chat-rendering rules that apply
regardless of whether subagents are involved.

## When to Use

- An agent dispatches subagents (worker/explorer/researcher patterns, orchestrator-and-tools
  architectures)
- A trace mixes LLM reasoning, tool calls, and delegated sub-tasks, and the delegation itself is
  invisible or flattened into an opaque tool call
- You want subagents to show up as their own nodes in the
  [Agent Graph](https://langfuse.com/docs/observability/features/agent-graphs), not as opaque tool
  calls

## Typing a subagent's dispatch

Per [observation-types.md](observation-types.md), `agent` is "a component that decides on flow and
uses tools under LLM guidance" — that's a dispatched subagent's own reasoning-and-acting loop, not the
same thing as a bare tool call that happens to spawn something. Type the subagent's actual execution
as `agent`; a plain `tool`/`span` for a dispatch hides all of its internal structure.

**One structural collapse to watch for**: if you emit both (a) a bare `tool`-typed span for the literal
"dispatch a subagent" call, AND (b) a separate `agent`-typed observation for what that subagent
actually did, as *siblings* — you now have two representations of the same event side by side, which
reads as if one might be the parent of the other (it isn't; they're duplicates). Emit only the
`agent`-typed observation when you have the subagent's actual execution to show; keep the bare tool
span only as a fallback for when you dispatched something and don't (yet, or ever) have visibility
into what it did internally.

**Name subagents distinctly.** Many frameworks default every dispatched subagent to the same generic
role name, making every subagent in a trace indistinguishable in the tree/graph. Derive a more
specific name from the subagent's actual task/role (its dispatch description, its assigned area) when
the framework doesn't already provide one.

## Nesting: subagent dispatch extends the same rule

[trace-structure.md](trace-structure.md)'s core rule — a tool call nests under the generation that
triggered it — extends recursively when what a generation decided to do is dispatch a subagent rather
than call a tool directly:

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

This is recursive and uniform at every level: a subagent's own tool calls and further dispatches
follow the identical parent-child rule its parent did.

## The Agent Graph

The [Agent Graph](https://langfuse.com/docs/observability/features/agent-graphs) is a separate
flow-diagram view of a trace, alongside the tree view. Two things worth knowing that aren't obvious
from the docs alone:

- **The panel only appears at all if the trace has at least one observation typed something other
  than `span`, `generation`, or `event`** — i.e. at least one `tool`, `agent`, `chain`, `retriever`,
  `evaluator`, `embedding`, or `guardrail`. A trace built entirely from `span`/`generation`
  observations won't show a graph at all — this is one more reason multi-agent systems benefit from
  using the fuller type vocabulary in [observation-types.md](observation-types.md).
- **Once the panel appears, every observation in the trace becomes a graph node, regardless of type**
  — including `span` and `generation` nodes. A `generation` sitting between two other nodes in the
  parent chain does not get skipped or cause its child to appear disconnected; it just renders as a
  node like anything else. In other words: get the nesting right per the rule above, and the graph
  takes care of itself — there's no separate set of graph-specific nesting rules to satisfy.
- The graph has two view modes. The default collapses the whole trace into one straight chain ordered
  by start time, which hides branching entirely — a trace with several things happening in parallel
  (e.g. multiple dispatched subagents) will look misleadingly linear in this view. The alternate
  "expanded" mode shows the real tree with branches. If a multi-agent trace looks like a flat line in
  the Agent Graph, check whether you're looking at the default view before concluding the trace itself
  is poorly structured.

## Anti-Patterns (multi-agent specific)

These are specific to agent-dispatching systems, on top of the general anti-patterns in
[trace-structure.md](trace-structure.md) and [observation-types.md](observation-types.md).

| Anti-pattern | What it looks like | Fix |
| --- | --- | --- |
| Subagent dispatch typed as generic `tool`/`span` | A dispatched subagent's work is invisible or shows as one opaque action with no internal structure | Type the subagent's own execution as `agent`; nest its generations/tools underneath it |
| Duplicate dispatch + execution nodes | Two sibling observations represent the same "spawn a subagent" event — one a bare tool call, one the subagent's actual work | Collapse to one: the `agent`-typed observation, when you have it |
| All subagents named identically | Every dispatched subagent shows the same generic name (e.g. its framework's default worker type), indistinguishable in the tree/graph | Derive a more specific name from the subagent's actual task/role when the framework doesn't provide one already |
