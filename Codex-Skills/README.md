# Dungeon Summon Codex Skills

This folder is the Git-tracked source for the Dungeon Summon `start-session` and `end-session` skills. It lets every development machine install the same session workflow.

## New Machine Setup

1. Clone this repository and open PowerShell at its root.
2. Install the skills for the current Windows user:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills" | Out-Null
Copy-Item -Path ".\Codex-Skills\start-session", ".\Codex-Skills\end-session" -Destination "$env:USERPROFILE\.codex\skills" -Recurse -Force
```

3. Restart Codex or start a new Codex task, then use `$start-session` or `$end-session`.
4. Open the `Solo` Roblox place in Roblox Studio before running `$start-session` when Studio context is needed.

## Updating a Machine

After pulling new repository changes, rerun the same `Copy-Item` command. The tracked folders are the source of truth, so avoid editing only the copies in `%USERPROFILE%\.codex\skills`.

## Important

- Git stores design documents, session logs, and these skills. It does **not** automatically store the live Roblox Studio place or its scripts.
- After Studio changes, use **File > Save** or **Publish to Roblox** in Studio.
- `$end-session` records work and asks before a commit or push unless those were explicitly requested.
