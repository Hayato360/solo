---
name: end-session
description: Record and close a Dungeon Summon work session by updating its handoff logs, optional Studio version, and git history. Use when the user says end-session or asks to wrap up Dungeon Summon work.
---

# End Session

Use this workflow only for the Dungeon Summon repository that contains this skill source. Work from the active repository root; do not assume a fixed Windows path.

1. Get the local timestamp and inspect the current git diff/status.
2. Read `Session-AI_logs/Claude/_TEMPLATE.md`, `Session-AI_logs/AI-Sync/sync_log.md`, and `Session-AI_logs/AI-Sync/sync_task.md`.
3. Create or append to `Session-AI_logs/Codex/session_YYYY-MM-DD.md`. If today's file exists, append `## Session Continuation - HH:MM`; do not overwrite earlier notes. Record the model, time, work summary, files changed, verification, issues, and concrete next steps.
4. Append one new row to `sync_log.md`; never edit existing rows. Update only the relevant items in `sync_task.md`, preserving its format and noting the date.
5. When the Studio place or its scripts changed, check whether a Roblox Studio integration or live Studio window is available and whether the place is in Edit mode. Read the existing version label before changing it. Bump PATCH by default; bump MINOR only when an implementation-plan stage is completed; bump MAJOR only on explicit user request. If Studio is unavailable, report that no version was bumped. Never claim a publish occurred unless it was actually completed.
6. Review exactly which files would be committed. Ask the user before committing or pushing, unless they already explicitly requested those actions in this session. Commit only the session's intended files; do not stage unrelated user changes. If asked to push and it fails due to remote updates, stop and report the state rather than rebasing automatically.
7. Report the session log path, sync-log entry, task updates, Studio version result, git result, and whether the user still needs to save or publish the Studio place.

## Project Context

- Keep session records in `Session-AI_logs/Codex/`, separate from Claude's existing history.
- The primary live place is `Solo` (`placeId 78995314774794`).
- Studio content is not backed up by this repository; remind the user to save or publish after Studio edits.
