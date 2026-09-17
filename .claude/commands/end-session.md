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

Create or **append** to `Session-AI_logs/Claude/session_YYYY-MM-DD.md` (use today's date from Step 1).

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

## Step 4 — Bump the in-game version label (optional)

Not applicable yet — there is no build or in-game version label until implementation starts. Skip this step until the project has a running build with a version label, then fill in the path and bump policy (patch/minor/major).

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
4. Version label status — not applicable yet
5. Git status — committed/pushed, not a repo yet, or error
