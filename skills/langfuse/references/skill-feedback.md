---
name: langfuse-skill-feedback
description: Submit approved feedback about the Langfuse skill through authenticated Langfuse feedback intake, with a GitHub issue as the unauthenticated fallback.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
    - GITHUB
---

# Skill Feedback

This workflow is only for feedback about the Langfuse skill's instructions and behavior, not product support or a user's application data.

1. Draft concise feedback that explains what the user was trying to do, what the skill did, and what should improve. Use `targetType` `skill` and target `langfuse`. Add a goal or reference URL only when the user supplied it and it is necessary.
2. Remove secrets, credentials, customer data, trace payloads, and unrelated conversation context. Never infer or attach those details.
3. Show the user every user-controlled field exactly as it will be submitted and ask for explicit permission. Do not submit if they decline or have not approved the final draft.
4. Prefer the authenticated in-app `submitFeedback` MCP tool when it is available. Otherwise discover the current public API operation with the Langfuse CLI schema and operation help, then submit through the authenticated project interface. Do not add client-identification headers.
5. If authenticated feedback intake is unavailable, unconfigured, or unsupported, offer to create an issue in [`langfuse/skills`](https://github.com/langfuse/skills/issues/new). Treat this as a separate external write and obtain approval before creating it.
6. Report the receipt ID returned by Langfuse or the GitHub issue URL. If submission fails, state the safe error without exposing request bodies or credentials.
