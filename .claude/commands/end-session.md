# end-session

You are ending a working session on **Dungeon Summon**, a Solo Leveling-inspired Action RPG (currently in the design-document phase — no game engine/codebase connected yet). Follow every step below in order. Do not skip any step.

---

## Step 1 — Get current time

Run this command first. Use the result as the timestamp for all files.
```
powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"
```

---

## Step 2 — Write session log

Create or **append** to `Session-AI_logs/Claude/session_YYYY-MM-DD.md` (use today's date from Step 1). Use `Session-AI_logs/Claude/_TEMPLATE.md` as the structure to follow.

If the file already exists, do NOT overwrite it — append a new continuation section with a header like:
```
## Session Continuation — HH:MM
```

The session log must include:
- **Model**, **Time**, **Type** (what kind of work — design, docs, planning, code once it starts)
- **Summary** — what was designed, written, or decided this session
- **Files Changed** — list every file touched (design docs, commands, logs), with a one-line description of the change
- **Issues Encountered** — any open questions, contradictions, or design gaps found
- **Pending / Next Steps** — anything left undone or worth doing next session

Be thorough — future AI agents will read this to understand what happened.

---

## Step 3 — Write calendar / dev-log event (optional)

No calendar/notes vault is currently set up for this project. Skip this step unless the user has since pointed you at one — if so, update this step with the correct path/format.

---

## Step 4 — Bump the in-game version label ⚠️

**Do not skip this step, even if the session felt small.**

Connect to the **Solo** Studio instance (`list_roblox_studios`, pick the one named `Solo`), make sure it is in **Edit** mode, then read and update `game.StarterGui.VersionGui.VersionLabel.Text` (three-part `vMAJOR.MINOR.PATCH`, e.g. `v0.0.1`).

1. Read the current value.
2. **By default, bump PATCH by 1** (`v0.0.1` → `v0.0.2`) for normal sessions: fixes, tuning, small features.
   - **MINOR** (reset patch to 0) when a whole implementation-plan stage is finished.
   - **MAJOR** only if the user explicitly asks.
3. Write the new value and read it back to confirm.

Only skip the bump if nothing in the Studio place or scripts changed this session (docs-only session).

**If Studio is unavailable:** say clearly in the final report that the version was **not** bumped.

**Always remind the user to publish the place.** Changes in Studio do not reach the live game until it is published.

---

## Step 5 — Append a row to sync_log.md

Read `Session-AI_logs/AI-Sync/sync_log.md` to find the last row, then **append** a new row at the bottom. Never edit existing rows.

Format:
```
| YYYY-MM-DD HH:MM | Claude (claude-sonnet-5) | One sentence summary of what was done. | `../Claude/session_YYYY-MM-DD.md` |
```

Use the timestamp from Step 1. The summary must be one sentence covering the main work done this session.

If a row for today already exists, still append a new row — do not overwrite.

---

## Step 6 — Update sync_task.md

Read `Session-AI_logs/AI-Sync/sync_task.md`.

- Move any tasks completed this session from `## 📋 To Do` or `## 🔄 In Progress` → `## ✅ Done`
- Add any new tasks discovered this session to `## 📋 To Do`
- Update `## 🔄 In Progress` to reflect the current state
- Add a note with today's date next to any item you change

Do not reformat or restructure the entire file — only update the relevant items.

---

## Step 7 — Git commit and push (if applicable)

This project is **not currently a git repository**. Check first:
```
git rev-parse --is-inside-work-tree
```
If that fails, tell the user their work is saved locally but not version-controlled, and skip this step (optionally offer to run `git init` if they want).

If it succeeds, run:
```
powershell -Command "git add Session-AI_logs/"
```
```
powershell -Command "git add -u"
```

Then commit with a message summarizing this session (one line):
```
git commit -m "docs: session log YYYY-MM-DD — <one line summary>"
```

Then push:
```
git push origin main
```

If push fails due to upstream changes, run `git pull --rebase origin main` first, then push again.

---

## Step 8 — Report to user

Tell the user:
1. What was written to the session log
2. The sync_log row that was appended
3. What tasks were updated in sync_task.md
4. Version label: old → new value (or why it was not bumped), plus a reminder to publish
5. Git status — committed/pushed, not a repo yet, or error
