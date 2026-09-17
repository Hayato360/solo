# start-session

You are starting a new working session on **Dungeon Summon**, a Solo Leveling-inspired Action RPG (currently in the design-document phase — no game engine/codebase connected yet). Follow every step below in order. Do not skip any step. Report progress to the user as you go.

---

## Step 1 — Get current time

Run this command and remember the timestamp for the session log later:
```
powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"
```

---

## Step 1.5 — Pull latest changes from GitHub (if applicable)

This project is **not currently a git repository**. Check first:
```
git rev-parse --is-inside-work-tree
```
If that fails, skip this step entirely and continue to Step 2.

If it succeeds, run:
```
git stash
git pull origin main
git stash pop
```

Then **verify** the pull actually succeeded by confirming local HEAD matches remote:
```
git log -1 --format="%H"
git log origin/main -1 --format="%H"
```

Both hashes **must match**. If they do not match, something went wrong — do not continue until they match.

If there are **merge conflicts** after stash pop, stop and warn the user — do not proceed until they resolve the conflicts.

---

## Step 2 — Read session AI logs

Read these files in order:

1. `Session-AI_logs/AI-Sync/sync_log.md` — understand all work done by all AIs since the beginning. Pay special attention to the most recent 5–10 entries.
2. `Session-AI_logs/AI-Sync/sync_task.md` — understand pending tasks, in-progress work, and what was recently completed.
3. The most recent session log file in `Session-AI_logs/Claude/` (find it by the latest date in the filename).

Then glob `Session-AI_logs/` for any other session logs from the last 3 days (any AI folder) and read them.

---

## Step 3 — Read design docs

Glob the project root (`*.md`) and read all design docs. Key file to prioritize:

- `Dungeon Summon - Core System Design Document.md` — the master design reference (Gate system, Raid Party/AI companions, Player Class/Awakening, Hunter Base, Economy & Pawn System)
- `Dungeon Summon - Implementation Plan.md` — the staged Roblox build plan. Check its Status table to find the current stage, and follow that stage's Build list and "Done when" checks.

Read any other `.md` design files that appear in the root or in a docs folder — do not skip any unless clearly out of scope (e.g. this command file itself).

---

## Step 4 — Connect to engine / editor ⚠️ ALWAYS CHECK — do not skip based on doc assumptions

**Always** call the Roblox Studio MCP tool to check for a live instance, regardless of whether the project "looks like" design-doc-only. Do not skip this step just because no engine has been mentioned yet — check every session.

1. Call `list_roblox_studios` to find available editor instances.
2. If one or more instances are found, **confirm with the user** which instance (by name/placeId) is the Dungeon Summon project before connecting to or reading/modifying anything in it — do not assume.
3. Once confirmed, call `get_studio_state` with that `studio_id` to verify the connection with a quick sanity check.
4. If no instance is found, tell the user and continue with Step 5 (skip reading scripts) — do not block the session on this.

---

## Step 5 — Read key scripts / source files

No scripts exist yet. Skip this step until implementation begins. Once code exists, list the core scripts/systems here (server, client, shared) and keep the list up to date as the codebase grows.

---

## Step 6 — Report to user

After completing all steps, give the user a concise summary:

1. **Current time** (from Step 1)
2. **Recent work** — 3–5 bullet points from sync_log covering what was done in the last few sessions
3. **Pending tasks** — key To Do items from sync_task.md
4. **Engine/editor status** — not applicable yet (design-doc phase)
5. **Any files missing** from Step 5 (not applicable yet)
6. **Ready to work** — confirm you have full context and are ready for instructions
