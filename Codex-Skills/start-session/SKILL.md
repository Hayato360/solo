---
name: start-session
description: Start a Dungeon Summon work session by loading the project's git, handoff-log, design, and Roblox Studio context. Use when the user says start-session or asks to resume Dungeon Summon work.
---

# Start Session

Use this workflow only for the Dungeon Summon repository that contains this skill source. Work from the active repository root; do not assume a fixed Windows path.

1. Get the local timestamp.
2. Inspect `git status --short --branch` and the configured upstream. Do not stash, reset, or pull over local changes. If the tree is clean and an update is needed, ask before running a networked `git pull --ff-only`.
3. Read, in this order:
   - `Session-AI_logs/AI-Sync/sync_log.md`
   - `Session-AI_logs/AI-Sync/sync_task.md`
   - the newest relevant session log under `Session-AI_logs/`
   - `Dungeon Summon - Core System Design Document.md`
   - `Dungeon Summon - Implementation Plan.md`
4. Check whether a Roblox Studio integration or live Studio window is available. If more than one candidate is available, ask the user which place to inspect. Do not modify any Studio place during session start.
5. Report the timestamp, recent work, active stage, outstanding tasks, git state, and Studio availability. State any limitations plainly, then say the session is ready.

## Project Context

- The repository tracks planning and session-memory files; the live Roblox content is stored in the Studio place, not source files in this repository.
- The primary live place is `Solo` (`placeId 78995314774794`).
- Treat `sync_task.md` and the Implementation Plan as the authoritative current status.
