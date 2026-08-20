---
name: langfuse-sdk-upgrade
description: Upgrade Langfuse SDKs and application instrumentation while preserving trace attributes across observations. Use for Python or JS/TS SDK migrations, including the application side of a v4 platform migration.
metadata:
  required_access:
    - CODEBASE
    - LANGFUSE_PROJECT_SCRIPT
---

# Langfuse SDK upgrade

## Sources of truth

Determine every installed Langfuse SDK major version, then fetch each applicable leaf guide in full before editing:

- [SDK upgrade paths](https://langfuse.com/docs/observability/sdk/upgrade-path)
- [Python v3 to v4](https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4)
- [JS/TS v4 to v5](https://langfuse.com/docs/observability/sdk/upgrade-path/js-v4-to-v5)
- [Instrumentation and attribute propagation](https://langfuse.com/docs/observability/sdk/instrumentation#add-attributes)
- [Sessions and session-level metrics](https://langfuse.com/docs/observability/features/sessions)
- [Direct OpenTelemetry ingestion](https://langfuse.com/integrations/native/opentelemetry)

Follow every intermediate guide when the installed version is more than one major behind. Use the current docs for implementation details; do not copy examples from this file.

## Workflow

1. Inventory every SDK, integration package, direct OpenTelemetry exporter, initialization site, instrumentation wrapper, lockfile, worker, script, and test that can emit Langfuse data.
2. Find every source of correlating attributes, including `session_id`/`sessionId`, `user_id`/`userId`, tags, metadata, version, environment, and trace name. Search for the values and surrounding application concepts, not only removed SDK method names.
3. Apply every relevant item from the exact version-specific guides. Preserve each correlating attribute by establishing its documented propagation scope before any observation-producing call that must inherit it.
4. For sessions, propagate the session ID early enough that the root and every applicable child observation—including cost-bearing generations—receive the same value. For work crossing service boundaries, follow the current distributed-tracing and baggage guidance rather than assuming in-process context crosses the boundary.
5. Run focused format, type, lint, and test checks, then exercise each changed ingestion path with representative application behavior.
6. Fetch the emitted trace and verify the expected correlating attributes on the root and every applicable child observation. For a session path, also confirm the observations are grouped into the intended session and its cost includes the cost-bearing children.

Do not mark the upgrade ready when only dependency or compile-time checks passed. If runtime execution or trace inspection is unavailable, report the exact verification as blocked.

## Completion report

Report the versions before and after, changed instrumentation paths, attribute sources and propagation scopes, validation performed, inspected trace or session, and any remaining blocked verification.
