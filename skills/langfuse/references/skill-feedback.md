---
name: langfuse-skill-feedback
description: Submit approved feedback about the Langfuse skill through authenticated Langfuse feedback intake, or via a prefilled GitHub discussion link when the user prefers a public thread or intake is unavailable. Offer once when this skill gave incorrect or outdated guidance — never for issues with Langfuse itself.
metadata:
  required_access:
    - LANGFUSE_PROJECT_INTERFACE
---

# Skill Feedback

This workflow is only for feedback about the Langfuse skill's instructions and behavior, not product support or a user's application data.

1. Draft concise feedback that explains what the user was trying to do, what the skill did, and what should improve. Use `targetType` `skill` and target `langfuse`. Add a goal or reference URL only when the user supplied it and it is necessary. If the user wants a reply, ask them to include their email address in the feedback text; use only an address they explicitly provide.
2. Remove secrets, credentials, customer data, trace payloads, and unrelated conversation context. Do not infer or attach contact details; preserve only an email address the user explicitly provided for a requested reply.
3. Show the user every user-controlled field exactly as it will be submitted and ask for explicit permission. In the same question, offer a public GitHub discussion as the alternative for users who want a thread they can track. Do not submit if they decline or have not approved the final draft.
4. Default to authenticated intake: prefer the `submitFeedback` tool on the Langfuse MCP server when it is available. Otherwise discover the current public API operation with the Langfuse CLI schema and operation help, then submit through the authenticated project interface. Do not add client-identification headers.
5. If the user chooses GitHub, or authenticated intake is unavailable, unconfigured, or unsupported, build a prefilled link to a new discussion from the approved draft and share it for the user to submit themselves: `https://github.com/langfuse/skills/discussions/new?category=ideas-improvements&title=<url-encoded title>&body=<url-encoded body>`.
6. Report the correlation ID returned by Langfuse or the discussion URL. If submission fails, state the safe error without exposing request bodies or credentials.
