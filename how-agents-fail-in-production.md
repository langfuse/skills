# How agents fail in production

*A field guide for practitioners. Sources checked on July 5, 2026.*

Most teams do not need a grand taxonomy of agent failure. They need help answering four practical questions:

1. What does failure actually look like in production?
2. How do I tell whether this is a prompt problem, tool problem, memory problem, eval problem, or something else?
3. Which issues matter enough to act on now?
4. What is the right first move: contain, measure, fix, narrow scope, or hand off to a human?

This note is written for that use case.

It draws from engineering field reports from [Anthropic](https://www.anthropic.com/engineering/building-effective-agents) and [OpenAI](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/), plus recent research on multi-agent failure, evaluation, and prompt injection. The common lesson across those sources is simple: **agents fail less like chatbots and more like distributed systems with ambiguous specs, unstable dependencies, and silent failure modes.**

It is also meant to pair with the Langfuse skills in this repo:

- use this guide to understand **what** production issues look like and **where** they usually live
- use [`langfuse-trace-triage`](https://github.com/langfuse/skills) when you want to **find and rank those issues** in your own Langfuse traces
- use [`langfuse-improvement-loop`](https://github.com/langfuse/skills) when you already have a concrete symptom and want to root-cause, fix, and prove the improvement
- use [`langfuse-production-loop`](https://github.com/langfuse/skills) when you want the full discover -> prioritize -> fix -> prove workflow

## The operator's view: what failure looks like

In production, agent failures usually do **not** look like stack traces.

They look like this:

- users keep re-asking because the first response was incomplete
- the agent loops, retries, or keeps researching after enough evidence is already available
- a tool call succeeds, but the answer is still wrong
- quality drops after many turns, long tasks, or handoffs
- eval dashboards look green while users complain or churn
- one release, prompt version, or user cohort suddenly gets worse while the aggregate looks fine
- the agent attempts a sensitive or destructive action in the wrong context
- latency and cost climb before correctness alarms fire

That is the central production pattern: **the worst failures are often silent, plausible, and cumulative.**

## Why agent failures feel different from normal software failures

Practitioners usually feel the difference before they can name it. The system is "working," but not reliably helping.

There are four reasons this happens:

### 1. Errors compound across loops

Agents do not just answer. They plan, call tools, inspect results, revise, and continue. A small early mistake becomes bad context for the next step, which becomes bad evidence for the step after that.

### 2. The environment is part of the system

Production agents depend on tools, indexes, websites, APIs, permissions, and retrieved content that can change under them. A benchmark task is static. Production is not.

### 3. The boundary between data and instructions is weak

Security research on indirect prompt injection, including [Not what you've signed up for](https://arxiv.org/abs/2302.12173), [InjecAgent](https://arxiv.org/abs/2403.02691), [AgentDojo](https://arxiv.org/abs/2406.13352), [ToolHijacker](https://arxiv.org/abs/2504.19793), and [EIA](https://arxiv.org/abs/2409.11295), shows that external content can steer agent behavior in ways ordinary software teams do not expect.

### 4. The real system is socio-technical

The production artifact is not "the model." It is the model plus prompts, tools, memory, orchestration, evaluators, permissions, product constraints, and human escalation paths. Most failures live in the seams between those pieces.

## Where failures usually live

When practitioners say "the agent failed," the next useful question is: **where is the failure most likely living?**

### 1. Specification and policy

The agent solves the wrong problem, follows the wrong local instruction, or optimizes for something that looks complete instead of something that is actually complete.

This includes:

- answering a neighboring question instead of the user's real question
- following a subtask while violating a global rule
- returning a plausible summary instead of taking the required action

Research taxonomies like [MAST](https://arxiv.org/abs/2503.13657) frame this as disobeying task or role specifications. In production, it usually feels like "the agent did something reasonable, but not what we needed."

### 2. Planning and loop control

The plan is bad, the agent cannot recover from a bad plan, or it does not know when to stop.

This includes:

- retry storms and no-progress loops
- endless browsing or research
- premature "done" states
- step repetition
- unrealistic plans that downstream tools or subagents cannot execute

This pattern shows up in [Exploring Autonomous Agents](https://arxiv.org/abs/2508.13143), in [MAST](https://arxiv.org/abs/2503.13657), and in Anthropic's posts on [multi-agent research systems](https://www.anthropic.com/engineering/multi-agent-research-system) and [long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

### 3. Tools and retrieval

The agent picks the wrong tool, passes bad arguments, or gets results that are technically returned but not actually useful.

This is one of the most important practitioner categories because it often looks healthy in traces:

- `ok: true` with irrelevant results
- the same documents returned for unrelated queries
- token-heavy responses that bury the useful signal
- broad or overlapping tools that make selection ambiguous

Anthropic's [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) and [tooling guidance](https://www.anthropic.com/engineering/writing-tools-for-agents) are especially strong here. A common production mistake is treating retrieval or tool quality problems as prompt problems.

### 4. Memory and context management

The agent degrades over long tasks because the state it depends on is lost, compressed badly, or no longer salient.

This includes:

- forgetting earlier constraints halfway through a session
- redoing already completed work
- losing the plan but keeping scraps of evidence
- giving up early near context limits
- context resets without structured handoff

Anthropic's [harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) and [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) are the most useful references here.

### 5. Multi-agent coordination

Adding more agents can help, but it also creates more places for work to drift.

This includes:

- role confusion
- ignored input from other agents
- information not getting handed forward
- one agent optimizing locally while the global task drifts
- too many subagents for too little value

Both [MAST](https://arxiv.org/abs/2503.13657) and Anthropic's [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) describe this clearly. OpenAI's [practical guide](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) is also notable for warning teams not to jump to multi-agent designs too early.

### 6. Verification and evals

The system is not being checked properly, or the checks themselves are misleading.

This includes:

- brittle evals that reject valid alternative paths
- graders that are miswired or non-discriminating
- dashboards that only measure easy proxies
- "green" evals while transcripts or user feedback look bad

[Evaluation-Driven Development and Operations of LLM Agents](https://arxiv.org/abs/2411.13768) and Anthropic's [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) are the key sources here.

### 7. Security and permissions

The agent is too easily influenced by untrusted input or too powerful relative to its controls.

This includes:

- indirect prompt injection
- malicious tool or retrieval content
- privacy leakage through web or GUI environments
- side effects triggered from contaminated context

The security literature repeatedly points toward the same practitioner lesson: treat tool access and side effects as privilege boundaries, not just convenience features.

### 8. Operations: latency, cost, drift, and cohorts

The agent might be "correct enough" in isolation and still fail the product in production.

This includes:

- latency tails that make the workflow unusable
- cost blowups from loops, verbose tools, or over-orchestration
- cohort-specific regressions
- prompt-version or release regressions
- divergence between product signals and model-side evals

This is where continuous monitoring matters more than benchmark scores.

## Symptom -> likely layer -> what to inspect first

This is the most useful mental model for practitioners: start from the symptom, not from an abstract category.

| Symptom | Likely layer | Inspect first | Safe first move |
| --- | --- | --- | --- |
| Users keep re-asking or clarifying | specification, output quality, missing tool context | transcripts, first-turn outputs, missing fields | instrument and sample traces before rewriting prompts |
| Agent loops or retries without progress | planning, termination logic, tool ergonomics | step sequences, repeated tool calls, stop conditions | cap loops, add guardrails, then diagnose |
| Tool calls succeed but answers are wrong | retrieval, tool quality, tool selection | actual tool inputs and returned content | repair tool semantics or ranking before prompt edits |
| Quality drops after many turns | memory, context compaction, handoff design | summaries, checkpoint artifacts, truncation patterns | add structured state handoff or reset strategy |
| Eval drops but transcripts still look good | grader, harness, benchmark mismatch | grader outputs, false negatives, changed assumptions | validate the eval before assuming the agent regressed |
| Users are unhappy but evals are green | proxy metric failure, missing monitoring coverage | user feedback, abandonment, cohort slices | add direct user-grounded signals and segment results |
| Unsafe or destructive action is attempted | permissions, security, missing approvals | tool access, side-effect path, triggering context | contain first with approvals or narrower permissions |
| Latency or cost spikes | orchestration, tool responses, loop control | per-step timings, token usage, repeated calls | cap expensive paths and inspect the dominant step |
| Only one release or cohort looks broken | regression, segmentation issue, prompt/model drift | by-version and by-user slices | isolate and roll back or route around the bad slice |

## The main practitioner mistake: prompt-fix bias

A lot of teams reach for prompt edits first because prompts are easy to change and easy to blame.

That is often the wrong layer.

If a tool returns irrelevant context, no prompt wording fixes missing truth. If the issue appears after turn 20, the problem may be memory, not instructions. If users are unhappy while evals stay green, the issue may be with monitoring, not generation quality. If the agent attempts an unsafe action, the first response should usually be permission narrowing or approval gating, not "better prompting."

When in doubt, ask:

1. Is this a **reasoning** problem, or a **system design** problem?
2. If the model were perfect, would the current tools, memory, permissions, and evals still allow this failure?

If the answer to the second question is yes, the failure is probably not primarily a model problem.

## A practical way to decide what to do about an issue

Once you find a problem, the next challenge is decision quality. Not every issue should get the same response.

### Step 1. Write the issue as evidence

Do not start with "retrieval seems bad." Start with a checkable statement:

- affected workflow or cohort
- observed symptom
- estimated prevalence
- evidence source
- example traces or conversations

Example:

"In the billing workflow, 14% of refund requests in the last seven days required a second clarification turn because the first response did not collect the required order identifier."

### Step 2. Score it on six axes

| Axis | Question |
| --- | --- |
| User impact | How bad is it when this happens? |
| Prevalence | How much traffic or business value is affected? |
| Silence | Will anyone notice without explicit monitoring? |
| Exploitability / irreversibility | Could this lead to security harm, money movement, privacy risk, or destructive side effects? |
| Confidence | How sure are we about the diagnosis and the failing layer? |
| Fix cost / reversibility | How hard is the intervention, and how easy is rollback? |

### Step 3. Choose the response type

Most issues fit one of these:

| Response | Use when |
| --- | --- |
| Contain | Risk is high and blast radius must be reduced now |
| Repair | Root cause is clear and the fix is bounded |
| Instrument | Symptom is real but diagnosis is still weak |
| Restrict scope | The task or input class is too risky or too variable |
| Compensate | A full fix is expensive, but a fallback or validator can reduce harm |
| Accept and document | Impact is low and fixing it is not worth the cost right now |

### Step 4. Default rule of thumb

- **High severity, high confidence:** contain if needed, then repair
- **High severity, low confidence:** contain first, instrument second
- **Low severity, high confidence:** batch into normal improvement work
- **Low severity, low confidence:** monitor or improve instrumentation before changing behavior

If the issue involves security, destructive actions, privacy, or compliance, override the matrix and treat it as urgent.

### Step 5. Define the success check before changing anything

Name:

- the leading signal you expect to move
- the lagging user or business signal that should improve
- the canary or cohort where you will judge success
- the rollback condition

This is the easiest way to avoid "fixing" a proxy while leaving the real problem intact.

## What mature teams do differently

Across the sources, the same patterns show up in stronger teams.

### They keep the design as simple as they can

OpenAI and Anthropic both push teams toward minimum viable agentic design: a simpler workflow or single agent first, then more autonomy only where it earns its keep.

### They make tool boundaries sharp

Tools are small, explicit, and not overly overlapping. Responses are concise. Error messages help the agent recover instead of dumping opaque failures.

### They treat memory as part of correctness

For long-running work, plans, progress, and next steps live in structured artifacts outside the immediate context window.

### They verify outcomes, not just paths

They do not assume one exact tool-call order is the only valid behavior. They check whether the job was actually completed.

### They guard side effects

They use approvals, permission narrowing, and tool-specific guardrails before irreversible actions. OpenAI's current [guardrails and human review guidance](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) is very explicit on this point.

### They monitor live traffic by slice, not just in aggregate

They look by version, release, prompt, model, tool, and user cohort. Silent regressions often hide in one slice while the top-line average looks healthy.

## Where this guidance comes from

The most useful sources for practitioners are:

- Anthropic on [building effective agents](https://www.anthropic.com/engineering/building-effective-agents), [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps), [multi-agent research systems](https://www.anthropic.com/engineering/multi-agent-research-system), and [agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- OpenAI's [practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) and [guardrails and human review docs](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)
- Research on [MAST](https://arxiv.org/abs/2503.13657), [Exploring Autonomous Agents](https://arxiv.org/abs/2508.13143), [Evaluation-Driven Development and Operations of LLM Agents](https://arxiv.org/abs/2411.13768), and the prompt-injection literature

Two caveats:

- Benchmarks are useful for revealing recurring structure, but they are not the same as production reality.
- Some newer production-evaluation framing, such as [Evaluating Agentic AI in the Wild](https://arxiv.org/abs/2605.01604), is conceptually useful but not based on open proprietary production logs.

## How to use this with the repo skills

The intended flow is:

1. Read this guide to build the right mental model for production failure.
2. Run `langfuse-trace-triage` to inspect recent traffic and surface concrete issues ranked by severity.
3. Use the symptom-to-layer framing in this guide to understand what each finding probably means.
4. Run `langfuse-improvement-loop` on the issue that is most worth fixing.
5. If you want one agentic path that does the whole cycle, use `langfuse-production-loop`.

In short: this document helps practitioners understand **how agents fail in production**; the issue-detection skill helps them find **which of those failures are happening in their own system right now**.

## Bottom line

For practitioners, the right question is not "what is the full taxonomy of agent failure?"

It is:

- what does this failure look like when it hits production?
- where does it probably live?
- what evidence do I inspect first?
- what is the safest first move?

If you can answer those questions quickly, you are already doing the hard part of production agent engineering.
