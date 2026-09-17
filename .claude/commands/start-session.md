# start-session

You are starting a new working session on **Dungeon Summon**, a Solo Leveling-inspired Action RPG built in **Roblox**.

- **Game code** lives in the Roblox Studio place **Solo** (placeId `78995314774794`), edited through the Roblox Studio MCP. Scripts are **not** in git.
- **Docs, plan, and session logs** live in this folder, a git repo pushed to https://github.com/Hayato360/solo (`main`).
- **Build progress** is tracked stage by stage in `Dungeon Summon - Implementation Plan.md`.

Follow every step below in order. Report progress to the user as you go.

---

## Step 1 — Get current time

Run this and remember the timestamp for the session log:
```
powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"
```

---

## Step 2 — Pull latest changes from GitHub

Check for local changes first:
```
git status --short
```

- **No local changes:** run `git pull origin main`.
- **Local changes:** run `git stash push -u`, then `git pull origin main`, then `git stash pop`.
  - If `stash pop` reports **merge conflicts**, stop and warn the user. Do not continue until they resolve them.

Then verify local HEAD matches remote:
```
git log -1 --format="%H"
git log origin/main -1 --format="%H"
```
Both hashes **must match** before continuing.

---

## Step 3 — Read session AI logs

Read in order:
1. `Session-AI_logs/AI-Sync/sync_log.md`: all work by all AIs. Focus on the last 5–10 rows.
2. `Session-AI_logs/AI-Sync/sync_task.md`: Done / Decisions / In Progress / Open Questions / To Do.
3. The newest session log in `Session-AI_logs/Claude/` (latest date in the filename; ignore `_TEMPLATE.md`).

Then glob `Session-AI_logs/` for any other session logs from the last 3 days (any AI folder) and read them.

---

## Step 4 — Read design docs and find the current stage

Read:
- `Dungeon Summon - Core System Design Document.md`: the master game design (Thai).
- `Dungeon Summon - Implementation Plan.md`: the staged build plan.
  - Use the **Status table** to find the current stage (🟨, or the first ⬜).
  - Read that stage's **Build**, **Done when**, and **Built notes** sections, and the **Global Rules** (folder layout, attributes, hybrid OOP rules, default assumptions).

Read any other `.md` docs in the root as well.

---

## Step 5 — Connect to Roblox Studio ⚠️ always check

1. Call `list_roblox_studios`.
2. Select the instance named **Solo** (placeId `78995314774794`) automatically.
   - `latestTest` (placeId `113217941021291`) is the old combat prototype. Only read it when working on Stage 5 (combat port). Never modify it.
   - If Solo is not listed, or its name shows `null` (place not open), tell the user to open the Solo place and continue with the other steps.
3. Call `get_studio_state`. Note whether it is in **Edit** or **Play**. If the user is playtesting, don't stop the playtest without asking.
4. Read `game.StarterGui.VersionGui.VersionLabel.Text` (current version).

**MCP limits to remember:**
- `execute_luau` cannot `require` game modules or fire remotes. Inspect instances and attributes instead, and use real input tools for testing.
- Simulated keyboard input cannot press key `1`.
- Models containing scripts cannot be parented from the tool in Edit mode, which is why rigs are generated at runtime.

---

## Step 6 — Read the code for the current stage

Scripts live in the place, not the repo. Use `search_game_tree` / `script_read` / `script_grep` on the Solo instance.

Core layout (see the plan's Global Rules for the full list):
- **Server:** `ServerScriptService.Bootstrap` (service order), `Services/*`, `Classes/*`, `Modules/*`
- **Shared:** `ReplicatedStorage.Config/*`, `Modules/*`, `Remotes/*`
- **Client:** `StarterPlayer.StarterPlayerScripts.ClientBootstrap` (controller order), `Controllers/*`, `UIClasses/*`
- **Assets:** `ServerStorage.GateModels`, `DungeonTemplates`, `HunterRigs`, `Monsters`

Always read both bootstraps. Then read the scripts for the systems the current stage touches (listed in its Built notes). Don't read everything if it isn't relevant.

Temporary test-only scripts (remove before release): `PlaceholderCombatService`, `DummyService`, `TestHazardService` (Death Box).

---

## Step 7 — Report to user

Give a concise summary:
1. **Current time**
2. **Git:** pulled / up to date / conflicts
3. **Current stage** and its status, plus the version label
4. **Recent work:** 3–5 bullets from sync_log and the latest session log
5. **Next up:** the unchecked items for the current stage from sync_task.md, plus any open design questions that block it
6. **Studio status:** Solo connected? Edit or Play? Any expected scripts missing?
7. **Ready to work:** confirm you have full context
