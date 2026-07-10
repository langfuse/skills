---
name: langfuse-trace-structure
description: Get trace nesting and chat rendering right — nest each tool call under the generation that triggered it (not as a flat sibling), avoid the parent-id hazard that silently flattens observations to the trace root, and shape generation input/output so Langfuse's UI renders tool calls as chat instead of raw JSON. Use when a trace looks flat, costs seem double-counted, or tool-call-bearing generations render as JSON blobs instead of chat bubbles.
---

# Trace Structure and Chat Rendering

Two things determine whether a trace is readable: whether the tree is nested correctly, and whether
each observation's `input`/`output` is shaped the way Langfuse's UI expects. Both apply to any trace
with tool calls — single-agent or multi-agent. (For dispatched-subagent-specific nesting, see
[multi-agent-tracing.md](multi-agent-tracing.md); for which observation type to use in the first
place, see [observation-types.md](observation-types.md).)

## Nesting: what should contain what

**The core rule**: a tool call nests under the generation that decided to make it — not flat as a
sibling next to that generation, both dangling under some shared container.

```
trace
└─ request (span or chain)
   ├─ generation (turn 1 — reasoned, decided to call a tool)
   │  └─ tool call (the action that turn 1 triggered)
   └─ generation (turn 2 — final answer, no tool calls)
```

The common mistake is nesting a turn's tool calls and its generation as siblings under a shared
container, associated only by which turn happened to run around the same time — that flattens the
tree and makes it impossible to tell, just by looking at the structure, which action came from which
decision.

## The parent-ID hazard

If you build an index mapping some intermediate key (a message ID, a call ID) to the observation ID
you're about to set as a parent, and that index can have collisions (e.g. a retried or duplicated
event sharing a key with an earlier one), always resolve first-match-wins, never last-match-wins.
Langfuse silently re-parents an observation to the trace root if its declared parent ID doesn't
correspond to an observation that was actually sent — so if your index points at something that got
skipped or overwritten, children don't error, they just silently flatten to root, and if any
cost/usage got attributed through that same broken link, it can be double-counted. This is the kind of
bug that's invisible until you're specifically looking at trace shape and total cost together.

## Making tool calls render as chat, not raw JSON

Langfuse's "pretty" view tries to parse an observation's `input`/`output` as a chat-message array; if
the parse succeeds you get role-labeled bubbles and dedicated cards for tool calls, if it fails you get
plain JSON. This is **shape-keyed, not type-keyed** — it applies the same check regardless of
observation type, so this matters for any `generation` output that includes tool calls.

The schema is strict on one point that's easy to get wrong: a tool call inside a chat message must be
`{"id": "<string>", "name": "<string>", "arguments": "<JSON-encoded string>"}` — flat, and `arguments`
must be a **string** (JSON-encoded), not a nested object. A very natural first attempt is something
like `{"name": "search", "input": {...}}` (no `id`, wrong key name, and a raw object instead of an
encoded string) — this fails the schema, and because failing a *recognized* key fails parsing for the
whole message (not just that field), the entire observation silently falls back to raw JSON instead of
the chat view you were expecting. If tool-call-bearing generations in your traces render as raw JSON
blobs instead of chat cards, this shape mismatch is the first thing to check.

A few adjacent details from the same schema:

- `role` accepts any string, not just `user`/`assistant`/`system`/`tool` — so a custom role name won't
  break parsing.
- Every generation should have both an input and an output, even when a turn made no tool calls and
  produced no visible text — represent "did nothing visible" explicitly (e.g. omit the field, or use a
  minimal placeholder) rather than a broken shape. A tool-call-only turn (no text, only actions) should
  still populate output with the tool call(s) it made, not leave output empty.
- Reconstructing a running "input" (the conversation as it stood right before each turn, not just a
  repeat of the original prompt) makes each generation's input meaningfully different from every
  other's, instead of all showing the same static seed value. Cap this at a reasonable size (well under
  Langfuse's own ~300KB parse ceiling for input/output) with an explicit truncation marker if you hit
  it, rather than sending unbounded payloads or truncating silently mid-structure.

## Anti-Patterns

| Anti-pattern | What it looks like | Fix |
| --- | --- | --- |
| Tool calls flat next to their triggering generation | Tree shows a turn's generation and the tool calls it made as unindented siblings, connected only by proximity | Nest each tool call under the generation that triggered it |
| Tool-call-bearing generation renders as raw JSON | Expected chat bubbles and tool-call cards, got a JSON blob instead | Check the `tool_calls` shape against the schema in "Making tool calls render as chat" above |
