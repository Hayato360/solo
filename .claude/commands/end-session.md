# end-session

You are ending a working session on **Dungeon Summon**, a Solo Leveling-inspired Action RPG built in **Roblox**.

- **Game code** lives in the Roblox Studio place **Solo** (placeId `78995314774794`). It is **not** in git; the user must save/publish the place.
- **Docs, plan, and logs** live in this git repo (https://github.com/Hayato360/solo, `main`).

Follow every step below in order.

---

## Step 1 — Get current time

Use the result as the timestamp for all files.
```
powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"
```

---

## Step 2 — Write session log

Create or **append** to `Session-AI_logs/Claude/session_YYYY-MM-DD.md` (today's date from Step 1). Follow `Session-AI_logs/Claude/_TEMPLATE.md`.

If the file already exists, do NOT overwrite it. Append a continuation section:
```
## Session Continuation — HH:MM
```

The log must include:
- **Model** (the exact model id(s) used this session), **Time**, **Studio** (place name + placeId), **Type**
- **Summary**: what was built, fixed, decided, or designed
- **Files Changed**, in two tables:
  - **Local repo**: every doc/command/log file touched
  - **Roblox Studio (Solo)**: every script, config, remote, model, or setting created, changed, or removed
- **Issues Encountered**: bugs and how they were fixed, gotchas, MCP/tool limits hit, open design questions
- **User Actions Required**: e.g. save/publish, things to test by hand
- **Pending / Next Steps**

Be thorough; future AI agents rely on this.

---

## Step 3 — Update the Implementation Plan (if a stage changed)

In `Dungeon Summon - Implementation Plan.md`:
- Update the **Status table** if a stage started (🟨) or the user signed it off (✅).
- Add or extend the stage's **Built notes**: what was built, non-obvious decisions and gotchas, what was verified, and what still needs verifying.

Only mark a stage ✅ when the **user** confirms it's done.

---

## Step 4 — Bump the in-game version label ⚠️

**Do not skip this step, even if the session felt small.**

1. `list_roblox_studios` → select **Solo**. `get_studio_state` must be **Edit**.
   - If the user is playtesting, **ask them to stop** rather than stopping it yourself.
2. Read `game.StarterGui.VersionGui.VersionLabel.Text` (`vMAJOR.MINOR.PATCH`).
3. Bump:
   - **PATCH** +1 by default (fixes, tuning, partial stage work): `v0.2.0` → `v0.2.1`
   - **MINOR** +1, patch reset to 0, when the user signed off a whole stage this session: `v0.2.1` → `v0.3.0`
     - Skip the extra patch bump if the minor bump already happened during the session.
   - **MAJOR** only if the user explicitly asks.
4. Write the new value and read it back to confirm.

Skip only if nothing in the Studio place changed this session (docs-only).

**If Studio is unavailable or not in Edit mode:** say clearly in the report that the version was **not** bumped.

---

## Step 5 — Append a row to sync_log.md

Read `Session-AI_logs/AI-Sync/sync_log.md` and **append** one row at the bottom. Never edit existing rows.
```
| YYYY-MM-DD HH:MM | Claude (<model id(s) used>) | One sentence summary of the session, ending with the version. | `../Claude/session_YYYY-MM-DD.md` |
```

If a row for today already exists, still append a new row.

---

## Step 6 — Update sync_task.md

Read `Session-AI_logs/AI-Sync/sync_task.md`:
- Tick finished items (`- [x] … (YYYY-MM-DD)`). When a whole stage is signed off, move its block under `## ✅ Done`.
- Add newly discovered tasks under the right stage in `## 📋 To Do`.
- Update `## 🔄 In Progress` (current stage + short status).
- Record new decisions in `## 📌 Decisions`, and new or answered design questions in `## ❓ Open Design Questions`.

Only update the relevant items. Don't restructure the whole file.

---

## Step 7 — Git commit and push

1. Review what changed:
   ```
   git status --short
   ```
2. Stage the project docs and logs. Never stage `.claude/settings.local.json` or `.obsidian/` (both are gitignored):
   ```
   git add Session-AI_logs/ .claude/commands/ "*.md"
   git add -u
   ```
   Re-run `git status --short` and check nothing unexpected is staged.
3. Commit (one-line summary + the attribution line required by the environment):
   ```
   git commit -m "docs: session log YYYY-MM-DD — <one line summary>"
   ```
4. Push:
   ```
   git push origin main
   ```
   If the push is rejected because of upstream changes, run `git pull --rebase origin main` and push again.

---

## Step 8 — Report to user

Tell the user:
1. What was written to the session log
2. The sync_log row that was appended
3. Plan and sync_task.md updates (stage status, tasks ticked or added)
4. Version label: old → new (or why it was not bumped)
5. Git: commit hash and push result (or the error)
6. **Reminder: save/publish the Solo place in Studio.** The game scripts are not in git and don't reach the live game until published.
