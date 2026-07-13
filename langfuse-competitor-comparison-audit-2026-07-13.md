# Audit of competitor comparison pages about Langfuse

**Research date:** July 13, 2026  
**Scope:** Braintrust, LangSmith, Raindrop, Arize Phoenix, and PostHog pages that compare themselves with Langfuse or directly characterize Langfuse, plus a representative sample of public third-party comparison pages. Claims were checked against current Langfuse documentation and the Langfuse changelog.

## Executive summary

The most materially outdated pages are Arize Phoenix's and Braintrust's.

- **Arize Phoenix** still says the Langfuse Playground, LLM-as-a-Judge, prompt experiments, and annotation queues are paid-only when self-hosting. Langfuse open-sourced exactly those features under MIT in June 2025. The same page also omits several documented Langfuse capabilities from its comparison table and says Langfuse has no instrumentation layer despite its OpenTelemetry-native SDKs.
- **Braintrust** says Langfuse requires manual work to turn traces into eval cases and has no turnkey CI/CD or per-PR results. Langfuse has allowed dataset-item creation directly from traces since 2024 and launched an official GitHub Action with regression gates and PR comments in May 2026.
- **LangSmith's** page was mostly overtaken by launches after its April 2026 publication. Its claims that Langfuse lacks deterministic online evaluations and production alerting became false in May and June 2026. Its broad framing of Langfuse as an early-stage tracing and prompt tool is also inconsistent with the current evaluation, experiment, monitoring, and CI/CD product.
- **Raindrop** does not appear to have a dedicated Langfuse head-to-head page. Its Query SDK announcement reduces Langfuse's query surface to filters, counts, and CSV exports. That is now materially incomplete because Langfuse exposes metrics and observation APIs, a full API CLI, a read/write MCP surface, an in-product data assistant, and alert automations. Raindrop's narrower claim to semantic search remains a real distinction.
- **PostHog's** dedicated July 2026 head-to-head page is the most current and mostly accurate, but it incorrectly marks Langfuse prompt A/B testing as absent and understates cost analytics by user and feature. A secondary PostHog alternatives roundup also uses stale OpenTelemetry positioning and contradicts itself on trace summarization.
- **Only Arize Phoenix and PostHog currently expose the audited page source in public repositories that appear reachable for external corrections.** That means there are three concrete page-file PR targets: one Arize docs page and two PostHog blog posts. The other audited pages may still belong to companies with public repos, but I did not find a public source repository for the specific web pages audited.
- **Public third-party pages are generally more accurate than competitor-owned pages**, but four recurring maintenance gaps remain: pre-June-2026 descriptions of alerting, legacy “custom SDK plus OTel ingest” positioning, obsolete event-based pricing, and old plan prices. DataCamp needs only a narrow monitoring update; VIPS Learn, StackScout, Awesome Agents, and Leanware have clearer corrections. SmartDuke's May 2026 article is a useful current positive control.

## Method

I treated a claim as **outdated** only when current first-party Langfuse documentation or a dated Langfuse changelog entry directly contradicted it. I marked narrower issues as **incomplete** or **internally inconsistent** rather than forcing a binary verdict. Subjective statements such as “easier,” “deeper,” “basic,” or “best” were not treated as factual errors unless they depended on a false feature claim.

The main Langfuse sources used across the audit were:

- [Open-sourcing all remaining product features, June 4, 2025](https://langfuse.com/changelog/2025-06-04-open-sourcing-langfuse)
- [OpenTelemetry-native SDK documentation](https://langfuse.com/integrations/native/opentelemetry)
- [Experiments in CI/CD](https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd)
- [Code evaluators](https://langfuse.com/docs/evaluation/evaluation-methods/code-evaluators)
- [Monitors and alerts](https://langfuse.com/docs/metrics/features/monitors)
- [Current documentation index](https://langfuse.com/llms.txt) and [changelog](https://langfuse.com/changelog)

## Findings by competitor

### 1. Braintrust

**Page audited:** [“Langfuse alternative: Braintrust vs. Langfuse for LLM observability”](https://www.braintrust.dev/articles/langfuse-vs-braintrust), published October 27, 2025.

#### Confirmed outdated claims

| Braintrust claim | Current Langfuse evidence | Verdict |
|---|---|---|
| “One-click eval case creation: ❌ Manual process” and scripts are needed to transform traces into eval datasets | Langfuse has supported creating dataset items directly from traces with an **Add to dataset** action since [Datasets v2 in April 2024](https://langfuse.com/changelog/2024-04-25-datasets-v2). | **False even when published.** The workflow may differ from Braintrust's, but it is not only manual scripting. |
| “CI/CD integration: ❌ Requires custom setup” | Langfuse launched the official [`langfuse/experiment-action`](https://langfuse.com/changelog/2026-05-25-experiment-ci-cd-gates) on May 25, 2026. It runs experiments in GitHub Actions, fails workflows on regressions, links the Langfuse run, and comments on pull requests. | **Outdated since May 2026.** |
| “Eval results per commit: ❌ Build yourself” | The current [CI/CD guide](https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd) documents commit SHA/branch metadata, pass or regression status, run-level and item-level scores, PR comments, and experiment comparison links. | **Outdated since May 2026.** |
| “Langfuse stops at observability” | Current Langfuse covers [datasets and experiments](https://langfuse.com/docs/evaluation/experiments/datasets), LLM-as-a-Judge, deterministic code evaluators, human annotation, prompt management, CI gates, and monitoring in the same product. | **Materially inaccurate framing.** Langfuse may be less eval-centric than Braintrust, but it does not stop at observability. |

#### Claims that should not be called outdated

- Braintrust's gateway and managed workflow differentiation is still meaningful; Langfuse is not an AI gateway or managed agent runtime.
- “Unified PM/engineer workspace” is too subjective to fact-check cleanly. Langfuse does combine tracing, prompts, evaluations, datasets, and annotation, but the relative collaboration experience requires product testing rather than a docs comparison.

#### Recommended correction

Replace the three negative table cells with qualified support:

- Trace to dataset item: **Yes, from the trace UI**
- CI/CD integration: **Official GitHub Action; application-specific experiment code still required**
- Eval results per commit/PR: **Yes, via experiment-action PR comments and commit metadata**

### 2. LangSmith

**Page audited:** [“LangSmith vs. Langfuse”](https://www.langchain.com/resources/langsmith-vs-langfuse), published April 22, 2026.

#### Confirmed outdated claims

| LangSmith claim | Current Langfuse evidence | Verdict |
|---|---|---|
| “Online deterministic evals: ❌ On roadmap” | [Code evaluators](https://langfuse.com/changelog/2026-05-28-code-evaluators), launched May 28, 2026, run Python or TypeScript checks on live production observations as well as experiments. They support filters, sampling, and native Langfuse scores. | **Outdated since May 2026.** |
| “Production alerting: ❌” / “Langfuse has no equivalent capability” | [Monitors and Alerts](https://langfuse.com/changelog/2026-06-19-monitors), launched June 19, 2026, watch cost, quality, and latency and notify through Slack, signed webhooks, or GitHub Actions. | **Outdated since June 2026.** Important qualification: monitors are currently Langfuse Cloud-only. |
| “Automation rules: ❌” | Monitor automations now react to severity transitions and dispatch Slack messages, webhooks, or GitHub Actions. | **Partly outdated.** Langfuse has event-driven monitor automation, but this is narrower than a general-purpose production rule engine or LangSmith's full queue-routing surface. |
| Langfuse is suitable mainly for “tracing and prompt management for early-stage LLM applications” | Current Langfuse includes online and offline evaluators, experiments, annotation queues, agent graphs, CI/CD gates, custom dashboards, monitors, and an assistant over project data. | **Outdated product positioning.** The absence of a managed agent runtime remains real, but the evaluation and production-monitoring scope is no longer early-stage only. |

#### Likely stale or weakly supported claims

- **“Langfuse ships 8 built-in templates.”** Langfuse announced an expanded evaluator library with RAGAS-backed templates in [May 2025](https://langfuse.com/changelog/2025-05-24-langfuse-evaluator-library), and the platform has always allowed custom judge templates. The public docs do not expose a stable current template count, so “8” should be removed or re-verified in-product rather than repeated as a durable fact.
- **“Pre-built templates can't be modified directly, so customization means starting from scratch.”** Custom templates are documented, but whether a managed template can be cloned or edited in place is a UI-level distinction not established by the public docs reviewed here. This needs a product check, not a confident negative.

#### Claims that remain correct

- Langfuse still uses five predefined roles. Its [RBAC docs](https://langfuse.com/docs/administration/rbac) support organization- and project-level overrides, but not arbitrary custom roles. LangSmith's custom-RBAC distinction is valid.
- Langfuse does not provide managed agent deployment. Its current roadmap explicitly positions Langfuse as neutral in the execution layer.
- Queue routing and automatic assignment are not equivalent to Langfuse's current annotation-queue assignment feature; the LangSmith distinction should remain qualified rather than removed.

### 3. Raindrop

**Page audited:** [“Announcing the Query SDK”](https://www.raindrop.ai/blog/announcing-the-query-sdk/), published February 17, 2026.

No dedicated Raindrop-vs-Langfuse page surfaced in Raindrop's indexed site or blog. This post is the clearest first-party comparison because it names Langfuse directly.

#### Confirmed incomplete/outdated claim

Raindrop says Langfuse's query capabilities are “fundamentally just filters”: slice by timestamp/model/metadata, count, and export CSV.

That description omits capabilities available now:

- The [Metrics API](https://langfuse.com/changelog/2025-05-12-custom-metrics-api) supports custom dimensions, metrics, aggregations, time granularities, and metadata filters.
- The [Langfuse CLI](https://langfuse.com/changelog/2026-02-17-langfuse-cli), announced the same day as Raindrop's post, wraps the full API and can fetch traces, update prompts, create datasets, batch-score, and script CI workflows.
- The expanded [Langfuse MCP server](https://langfuse.com/changelog/2026-05-29-mcp-update) exposes observations, metrics, scores, comments, datasets, and annotation queues, including write operations.
- The [Langfuse Assistant](https://langfuse.com/changelog/2026-06-19-langfuse-assistant-public-beta) answers plain-language questions about project traces, observations, and metrics.
- Monitor automations can now dispatch to Slack, webhooks, and GitHub Actions.

**Verdict:** “filters, counts, and CSV” is now materially incomplete. Langfuse has a programmable data and workflow surface, not merely a dashboard filter layer.

#### Distinction that remains valid

Raindrop offers semantic vector search over user inputs and assistant outputs. Langfuse currently documents full-text search and natural-language generation of structured filters, not equivalent semantic-nearest-neighbor search. The report should preserve this difference rather than imply feature parity.

### 4. Arize Phoenix

**Page audited:** [“Langfuse alternative? Arize Phoenix vs Langfuse: Key differences”](https://arize.com/docs/phoenix/resources/frequently-asked-questions/langfuse-alternative-arize-phoenix-vs-langfuse-key-differences), current Phoenix documentation page; no publication date shown.

#### Confirmed outdated claims

| Arize claim | Current Langfuse evidence | Verdict |
|---|---|---|
| Playground and LLM-as-a-Judge are behind a paywall when self-hosting | Langfuse [open-sourced all remaining product features](https://langfuse.com/changelog/2025-06-04-open-sourcing-langfuse) in v3.65.0 under MIT. The changelog names Playground and LLM-as-a-Judge explicitly. | **False since June 2025.** |
| Prompt experiments and annotation queues are paid-only | The same open-sourcing release explicitly lists Prompt Experiments and Annotation/Data Labeling as MIT. | **False since June 2025.** |
| “Langfuse does not provide its own instrumentation layer” and requires an external instrumentation provider | Langfuse's current SDK is explicitly [OpenTelemetry-native](https://langfuse.com/integrations/native/opentelemetry): a thin layer over the official OTel client with first-class Langfuse helpers. The OTel-based Python SDK reached GA in [June 2025](https://langfuse.com/changelog/2025-06-05-python-sdk-v3-generally-available). | **False/incomplete since 2025.** Third-party OTel/OpenInference instrumentation remains optional for additional frameworks and languages, not mandatory for using Langfuse. |
| Feature table leaves “Run Prompts on Datasets” blank for Langfuse | [Experiments via UI](https://langfuse.com/docs/evaluation/experiments/experiments-via-ui) runs prompt/model variants on datasets and compares results side by side. | **False.** |
| Feature table leaves “Agent Evaluations” blank | Langfuse supports agent graphs, tool-call data, LLM-as-a-Judge, code evaluators, and experiments. The [Langfuse for Agents launch](https://langfuse.com/changelog/2025-11-05-langfuse-for-agents) explicitly introduced Agent Evals positioning. | **False.** |
| Feature table leaves “Human Annotations” blank | [Annotation Queues](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues) support manual scoring and comments on traces, observations, and sessions, user assignments, and API management. | **False.** |
| Feature table leaves “Custom Dashboards” blank | [Custom Dashboards](https://langfuse.com/changelog/2025-05-21-custom-dashboards) launched in May 2025 with multiple chart types, flexible metrics, rich filtering, and layouts. | **False since May 2025.** |
| Feature table leaves “Copilot Assistant” blank | The Langfuse Assistant became public beta on Langfuse Cloud in [June 2026](https://langfuse.com/changelog/2026-06-19-langfuse-assistant-public-beta). | **Outdated since June 2026.** It should be marked beta/Cloud-only rather than absent. |

#### Claim that remains substantially correct

Arize says Phoenix is simpler to self-host as one container while Langfuse operates PostgreSQL, ClickHouse, Redis/Valkey, and blob storage alongside web and worker containers. Langfuse's [scaling guide](https://langfuse.com/self-hosting/configuration/scaling) confirms those components. Official Docker Compose and Terraform modules reduce setup work, but the architectural complexity difference is real.

#### Recommended correction priority

This page needs a full refresh, not isolated edits. Its lead differentiator, the Feature Access section, and at least six cells in the comparison table are wrong. Because the page lives in Phoenix documentation rather than an old dated blog post, the stale claims carry extra credibility and should be treated as the highest-priority outreach target.

### 5. PostHog

**Primary page audited:** [“PostHog vs Langfuse in-depth tool comparison”](https://posthog.com/blog/posthog-vs-langfuse), published July 6, 2026.  
**Secondary page checked:** [“The best Langfuse alternatives & competitors, compared”](https://posthog.com/blog/best-langfuse-alternatives), published June 25, 2026.

#### Confirmed errors on the dedicated comparison page

| PostHog claim | Current Langfuse evidence | Verdict |
|---|---|---|
| “A/B test prompt versions”: Langfuse **✗** | Langfuse has a dedicated [A/B Testing of LLM Prompts](https://langfuse.com/docs/prompt-management/features/a-b-testing) feature. Teams label variants, alternate between them in application code, link the selected prompt to traces, and compare latency, token usage, cost, quality scores, and custom metrics by version. | **False at publication.** Langfuse should be marked at least **Partial/SDK-assisted**, not absent. PostHog still has the stronger packaged experience because it handles assignment with feature flags and applies a statistical experiment engine to product outcomes. |
| “Cost by user”: Langfuse **Partial** | Langfuse's current [Metrics overview](https://langfuse.com/docs/metrics/overview) says cost and latency are broken down by user and explicitly instructs users to add `userId` to track usage and cost per user. | **Incorrectly understated.** For the stated row, support is documented as full. Langfuse does not add PostHog's broader behavioral user profile, but that is a different capability. |
| “Cost by feature”: Langfuse **✗** | The same Metrics documentation explicitly lists **feature** as a cost and latency breakdown. Trace names, tags, metadata, prompt versions, releases, and other dimensions can be used in custom dashboards and the Metrics API. | **False at publication.** This row should be **✓**, with a qualification that the feature dimension must be instrumented rather than inferred from PostHog product events. |

#### Over-broad language that should be narrowed

- The page says PostHog can statistically A/B-test live product outcomes, “something Langfuse doesn't do at all.” The core distinction is valid: Langfuse is not a product experimentation platform with PostHog's feature-flag assignment and Bayesian/Frequentist engines. However, “doesn't do at all” conflicts with Langfuse's documented live prompt A/B workflow and its ability to compare custom metrics. Better wording would be: **Langfuse supports application-routed prompt A/B tests and compares LLM/custom metrics, but it does not provide PostHog's integrated product-experiment assignment and statistical analysis.**
- “SQL queries on traces: ✗” is accurate for the supported Langfuse product surface, but it should not be generalized into “no programmatic analytics.” Langfuse provides observation and metrics APIs, SDK queries, CLI access, custom dashboards, and MCP tools; it simply does not expose PostHog-style SQL across product events.

#### Issues on the secondary alternatives roundup

| PostHog claim | Current Langfuse evidence | Verdict |
|---|---|---|
| Phoenix is OTel-native while “Langfuse supports OpenTelemetry, but it is not built around it in the same way” | Langfuse explicitly calls its current SDK [OpenTelemetry-native](https://langfuse.com/integrations/native/opentelemetry) and describes it as a thin layer over the official OTel client. The Python SDK has been OTel-based and production-ready since June 2025. | **Outdated/overstated distinction.** Phoenix's OpenInference ecosystem remains a differentiator, but “Langfuse is not built around OTel” is no longer supportable. |
| Prose says twice that Langfuse has no direct built-in trace-summarization equivalent | The same roundup's feature table marks Langfuse trace summarization **✓**. | **Internally inconsistent.** Current Langfuse docs do not clearly market automatic per-trace summaries as a standalone feature, although the Cloud Assistant can answer questions about trace data. PostHog should either remove the checkmark or narrow the prose; both cannot stand. |

#### Claims that remain fair

- PostHog has a native product-analytics, session-replay, feature-flag, and experimentation stack that Langfuse does not replicate. Langfuse can export metrics to PostHog or Mixpanel, but that is not the same as owning those product surfaces.
- The dedicated page's explanation of billing units is consistent with Langfuse's [Billable Units documentation](https://langfuse.com/docs/administration/billable-units): Cloud units equal traces plus observations plus scores, including scores created by Langfuse features. The relative PostHog price calculations still depend on instrumentation depth and current vendor pricing, but the Langfuse unit definition is correct.
- Langfuse supports sentiment evaluation through configurable LLM-as-a-Judge or code evaluators, but PostHog's dedicated built-in sentiment classification is a narrower packaged feature. “No direct built-in equivalent” is therefore a defensible qualification for sentiment.
- Langfuse's agent tracing is more specialized, and PostHog correctly marks Langfuse as supporting evaluation datasets and human annotation.

## Public third-party pages

I also checked publicly accessible pages that are not controlled by the five vendors above. These carry less authority than official comparison pages, but they can rank for high-intent searches and are useful outreach targets. The sample deliberately includes accurate pages and pages with no product-capability claims so that “public page” is not treated as synonymous with “outdated.”

| Public page | Published/updated | Finding | Current Langfuse evidence and verdict |
|---|---|---|---|
| [DataCamp: “Langfuse vs. LangSmith”](https://www.datacamp.com/blog/langfuse-vs-langsmith) | June 24, 2026 | The production-monitoring section says Langfuse has spend alerts, but does not mention threshold monitors for quality and latency or Slack, webhook, and GitHub Actions notifications. | [Monitors and Alerts](https://langfuse.com/changelog/2026-06-19-monitors) launched five days before publication and covers cost, quality, and latency. **Narrow omission, otherwise mostly current.** The page correctly covers OTel-native tracing, open-source evaluators, code evaluators, CI/CD, and current unit pricing. |
| [VIPS Learn: “Arize Phoenix vs Langfuse”](https://learn.engineering.vips.edu/compare/arize-phoenix-vs-langfuse) | April 20, 2026 | It describes Langfuse instrumentation as “Custom SDK + OTel ingest supported,” says to pick Phoenix for an “OTel-first” stack, and contrasts that with Phoenix being OTel-native. | Langfuse's current SDK is explicitly [OpenTelemetry-native](https://langfuse.com/integrations/native/opentelemetry), not merely a proprietary SDK that can ingest OTel. **Outdated architecture framing.** Phoenix's OpenInference ecosystem and notebook emphasis remain valid distinctions. |
| [StackScout: “Best LLM Observability Tools in 2026”](https://stackscout.dev/best/llm-observability-tools/) | February 25, 2026 | It calls advanced alerting Langfuse's “main gap,” says teams needing complex monitors will outgrow it, and lists alerting as basic. | [Monitors and Alerts](https://langfuse.com/changelog/2026-06-19-monitors) now provide threshold monitoring and automations across cost, quality, and latency. **Outdated since June 2026.** A fair replacement would say that monitors are threshold-based and currently Cloud-only, rather than absent/basic. |
| [Awesome Agents: “Best LLM Observability Tools in 2026”](https://awesomeagents.ai/tools/best-llm-observability-tools-2026/) | March 4, 2026; page says updated April 25, 2026 | It repeatedly describes the free tier as “50K events,” says paid Langfuse starts with “Pro at $50/month,” and gives Pro 100K events. | Current [Langfuse pricing](https://langfuse.com/pricing) uses **billable units**, not generic events: Hobby includes 50K units, Core starts at $29/month with 100K units, and Pro is $199/month. The [unit definition](https://langfuse.com/docs/administration/billable-units) counts traces, observations, and scores, so its “two events per request” estimate is also too simplistic. **Materially outdated pricing and unit model.** Its product-capability description is otherwise strong, including live prompt A/B testing. |
| [Leanware: “Langfuse vs LangSmith”](https://leanware.co/insights/langfuse-vs-langsmith) | January 15, 2026 | It says native Langfuse alerting is limited, teams often need Datadog/Grafana, and LangSmith has built-in alerting while Langfuse does not present an equivalent. | This was reasonable when published, but [Langfuse monitors](https://langfuse.com/changelog/2026-06-19-monitors) have since added native cost, quality, and latency thresholds with Slack, webhook, and GitHub Actions delivery. **Outdated after publication.** External observability exports can still be useful for broader infrastructure monitoring. |
| [SmartDuke: “LangSmith vs Langfuse vs Arize vs Braintrust”](https://www.smartduke.com/blog/ai-observability-tools-compared) | May 16, 2026 | It says Langfuse is framework-agnostic, self-hostable, supports OpenTelemetry traces, and that its evaluation features have caught up substantially. | **No clear Langfuse factual error found.** The page is concise and subjective, but its Langfuse characterization is consistent with current docs. Treat this as a positive control rather than an outreach target. |

### Public Raindrop page checked

[DeployGraph's “Raindrop vs Langfuse” page](https://www.deploygraph.com/compare/raindrop-vs-langfuse) is publicly accessible, but it compares only adoption within DeployGraph's tracked-company dataset. It makes no tracing, evaluation, pricing, or product-capability claims that can be checked against the Langfuse docs. Its company counts may change with DeployGraph's methodology, but they are **out of scope for a Langfuse feature-currency audit**.

### Public-page outreach priority

1. **Awesome Agents:** correct the plan names, prices, and “events” terminology; this is the most concrete public-page error.
2. **VIPS Learn:** update the instrumentation row and OTel-first recommendation.
3. **StackScout and Leanware:** update alerting language, explicitly preserving the Cloud-only and threshold-based qualifications.
4. **DataCamp:** request only a small monitoring addendum. The article is otherwise a strong and recent comparison.
5. **SmartDuke and DeployGraph:** no correction request based on this audit.

## Correction register

This table lists only claims that need action. A page is not listed merely because it omitted a feature that was outside its comparison scope.

| What needs correction | Pages to update | What Langfuse supports now | Qualification worth preserving |
|---|---|---|---|
| Trace-to-dataset workflow described as manual scripting | **Braintrust** | Users can create dataset items directly from traces in the UI. | Braintrust may still prefer its own workflow, but Langfuse does not require a custom transformation script. |
| No turnkey CI/CD or per-PR experiment results | **Braintrust** | The official GitHub Action runs experiments, enforces regression gates, records commit metadata, links results, and comments on pull requests. | Teams still write the application-specific experiment task and choose their scoring thresholds. |
| No deterministic evaluation of production traffic | **LangSmith** | Python and TypeScript code evaluators can score live observations as well as experiments. | This launched after LangSmith published its page. |
| No native production monitoring or alert automation | **LangSmith**, **StackScout**, **Leanware**; **DataCamp** needs a smaller addendum | Cloud monitors watch cost, quality, and latency and notify Slack, webhooks, or GitHub Actions. | Monitors are threshold-based and currently available only on Langfuse Cloud. DataCamp already mentions spend alerts, so its issue is incompleteness rather than a direct falsehood. |
| Playground, LLM-as-a-Judge, prompt experiments, and annotation are paid-only when self-hosting | **Arize Phoenix** | These product features have been open source under MIT since June 2025. | Enterprise administration and security controls can still require commercial plans; that is separate from these product features. |
| Langfuse is not OpenTelemetry-native | **Arize Phoenix**, **PostHog alternatives roundup**, **VIPS Learn** | Current Langfuse SDKs are built on OpenTelemetry and add Langfuse-specific helpers on top. | Phoenix's OpenInference ecosystem and notebook experience remain valid differentiators. |
| No prompt-on-dataset runs, agent evaluations, human annotation, custom dashboards, or assistant | **Arize Phoenix** | Langfuse documents all five; the assistant is currently a Cloud public beta. | The exact UX and depth can differ from Phoenix, but the features should not be shown as absent. |
| Query surface reduced to filters, counts, and CSV | **Raindrop** | Langfuse provides metrics and observation APIs, a full API CLI, read/write MCP tools, a data assistant, and monitor automations. | Raindrop still has a genuine semantic vector-search distinction that Langfuse does not currently document as equivalent. |
| No prompt-version A/B testing | **PostHog dedicated comparison** | Langfuse supports application-routed prompt variants and comparison by cost, latency, usage, quality scores, and custom metrics. | PostHog has the more integrated product-experiment system: feature-flag assignment plus statistical analysis of downstream outcomes. |
| No cost analytics by feature; only partial analytics by user | **PostHog dedicated comparison** | Langfuse documents cost and latency breakdowns by both user and feature. | Those dimensions must be instrumented; Langfuse does not provide PostHog's broader behavioral user profile. |
| Hobby and Pro pricing expressed as events, with Pro at $50/month | **Awesome Agents** | Cloud pricing uses billable units: Hobby includes 50K units, Core starts at $29/month, and Pro is $199/month. | Pricing is volatile and should link to the live pricing page rather than be treated as permanent. |
| Langfuse has no programmable analytics because it lacks SQL | No direct correction required; **PostHog** should avoid this implication | Langfuse has metrics and observation APIs, CLI access, dashboards, and MCP tools, but not PostHog-style SQL over product events. | “No SQL” is accurate; “no programmatic analytics” would not be. |

## Can we submit PRs for these pages?

Yes for **PostHog** and likely yes for **Arize Phoenix**, with an important caveat: Arize's repo is public, but its contribution guide says non-trivial changes should usually start with an issue and explicit maintainer confirmation first. For the rest, I did not find a public repository that contains the audited page source, so outreach is more realistic than a direct docs PR.

| Page | Public source for the audited page? | Best route | Evidence |
|---|---|---|---|
| **Arize Phoenix** comparison page | **Yes** | Open issue first, then small docs PR | Exact page source is public: [`Arize-ai/phoenix/docs/phoenix/resources/frequently-asked-questions/langfuse-alternative-arize-phoenix-vs-langfuse-key-differences.mdx`](https://github.com/Arize-ai/phoenix/blob/main/docs/phoenix/resources/frequently-asked-questions/langfuse-alternative-arize-phoenix-vs-langfuse-key-differences.mdx). Contribution guide: [`CONTRIBUTING.md`](https://github.com/Arize-ai/phoenix/blob/main/CONTRIBUTING.md). |
| **PostHog** dedicated comparison page | **Yes** | Direct PR | Exact page source is public: [`posthog/posthog.com/contents/blog/posthog-vs-langfuse.mdx`](https://github.com/PostHog/posthog.com/blob/master/contents/blog/posthog-vs-langfuse.mdx). Contribution docs live in the same repo: [`contents/docs/contribute`](https://github.com/PostHog/posthog.com/blob/master/contents/docs/contribute/index.md). |
| **PostHog** alternatives roundup | **Yes** | Direct PR | Exact page source is public: [`posthog/posthog.com/contents/blog/best-langfuse-alternatives.mdx`](https://github.com/PostHog/posthog.com/blob/master/contents/blog/best-langfuse-alternatives.mdx). |
| **Braintrust** comparison page | **No public page-source repo found** | Direct outreach to the article/team | Braintrust has public repos, but I did not find a public repository containing `braintrust.dev/articles/langfuse-vs-braintrust` or a matching website/blog source tree. |
| **LangSmith / LangChain** comparison page | **No public page-source repo found** | Direct outreach to LangChain marketing/content team | `langchain-ai/docs` is public, but it does not contain the audited `langchain.com/resources/langsmith-vs-langfuse` page. I did not find a public `langchain.com` marketing-site repo with this resource page. |
| **Raindrop** blog page | **No public page-source repo found** | Direct outreach | The public `raindrop-ai` GitHub org does not appear to expose the website/blog source for the audited Query SDK post. |
| **DataCamp** public article | **No public page-source repo found** | Editorial/contact correction request | DataCamp has public repos, but I did not find a public source repository for this blog article. |
| **VIPS Learn** public comparison page | **No public page-source repo found** | Site/editorial outreach | I found no public repository containing the audited comparison page. |
| **StackScout** public comparison page | **No public page-source repo found** | Site/editorial outreach | I found no public repository containing the audited comparison page. |
| **Awesome Agents** public roundup | **No current page-source repo found** | Site/editorial outreach | There is a public [`evilsocket/awesomeagents`](https://github.com/evilsocket/awesomeagents) repo tied to the domain, but I did not find the current 2026 article source there, so it does not appear to back the audited page directly. |
| **Leanware** public article | **No public page-source repo found** | Site/editorial outreach | Leanware has public repos, but I did not find a public source repository for this article. |
| **SmartDuke** public article | **No public page-source repo found** | No action needed unless you want relationship-building outreach | I did not find a public source repository for this page, but there was also no factual Langfuse correction to send. |
| **DeployGraph** public comparison page | **No public page-source repo found** | No action needed | I did not find a public source repository for this page, and its content was out of scope for feature-currency corrections anyway. |

### PR-ready set

If the goal is “which pages can we actually fix ourselves,” the practical answer is:

1. **Arize Phoenix docs page**: one public docs file, but start with an issue because Arize's contribution policy is conservative.
2. **PostHog `posthog-vs-langfuse`**: direct PR candidate.
3. **PostHog `best-langfuse-alternatives`**: direct PR candidate.

Everything else currently looks like **outreach, not pull requests**.

## Recommended response order

1. **Arize Phoenix:** request correction of the paid-feature section, instrumentation section, and feature table. These are direct, high-confidence factual errors on a current docs page.
2. **Braintrust:** request updates to dataset creation, CI/CD, and per-PR results. Link the official experiment action and the trace-to-dataset workflow.
3. **LangSmith:** request updates for code evaluators and Cloud monitors/automations. Keep the managed deployment and custom-RBAC differences intact to make the request credible.
4. **PostHog:** on the dedicated page, correct prompt A/B testing and cost-by-user/feature. On the roundup, fix the OTel wording and resolve the trace-summarization contradiction. The remaining product-stack differentiation is comparatively current and well qualified.
5. **Raindrop:** ask it to narrow “just filters” to the genuine semantic-search distinction and acknowledge API/CLI/MCP/assistant workflows.

For independent public pages, prioritize Awesome Agents' pricing, VIPS Learn's OTel framing, and the pre-launch alerting descriptions on StackScout and Leanware. Keep these requests separate from vendor outreach because the severity and authority of the claims differ.

## Suggested concise correction language

> As of July 2026, Langfuse supports trace-to-dataset workflows, an official GitHub Action for experiment regression gates and PR reporting, deterministic code evaluators on live observations, Cloud monitors with Slack/webhook/GitHub Actions automation, OpenTelemetry-native SDKs, application-routed prompt A/B testing, and cost analytics by user and feature. Since v3.65.0, Playground, LLM-as-a-Judge, prompt experiments, and annotation/data-labeling features are open source under MIT. Please update the Langfuse comparison accordingly and preserve narrower differences such as managed agent deployment, custom roles, semantic vector search, integrated product-experiment statistics, or self-hosting architecture where those remain applicable.

## Limitations

- This was a documentation and changelog audit, not a hands-on benchmark of every product UI.
- Pricing, plan entitlements, and cloud/self-hosted availability can change quickly; this report only discusses them where necessary to resolve a feature claim.
- “Raiondrop” was interpreted as **Raindrop AI**.
- Some pages use broad marketing categories that do not map one-to-one across products. The report therefore distinguishes absence, partial support, packaged UX, and programmable support where the sources allow it.
