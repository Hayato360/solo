# Dungeon Summon — Master Task List
Cross-session task tracker. Update this file alongside `sync_log.md` when completing or adding tasks.

---

## ✅ Done

### Design Documentation (2026-09-17)
- [x] **Core System Design Document** — Gate system, Raid Party / AI companion system, Player Class (Awakening), Hunter Base, Economy & Pawn System drafted (`Dungeon Summon - Core System Design Document.md`)

### Stage 0 — Project Foundation (2026-09-17)
- [x] Folder layout in Solo place (Config / Modules / Remotes / Assets, Services, Classes, Controllers, UIClasses, World folders)
- [x] `Bootstrap` (Script) + `ClientBootstrap` (LocalScript) with fixed Init → Start order
- [x] `Modules/Signal` + `Modules/StateUtil` (Attribute-backed)
- [x] `CharacterAutoLoads = false` + temporary `SpawnService` (runtime-generated R15 rig, respawn after 3s)
- [x] `Controllers/GuiController` (copies StarterGui into PlayerGui, needed with auto-load off)
- [x] Test world: `World/GateSpawns` ×5 (tag `GateSpawn`), `World/BasePlots` ×4 (tag `BasePlot`)
- [x] `StarterGui.VersionGui.VersionLabel` = v0.0.1
- [x] Playtest verified: zero errors, R15 walk anims, camera, label, respawn

### Stage 1 — Hunters & Solo Raid Party (2026-09-17)
- [x] Spike: swap by reassigning `player.Character` — works with `Hunter:_detachFromCharacter()` + `CameraController` (2026-09-17)
- [x] `RoleDefs` + `HunterDefs` + `AIModeDefs` (2026-09-17)
- [x] `PartyService` + `Party` / `Hunter` classes (spawn 3 rigs, swap, auto-swap on death, party wipe) (2026-09-17)
- [x] `HunterAIService` + `AIBrain` (5 AI modes, pathfinding over 40 studs) (2026-09-17)
- [x] Placeholder `BasicAttack` + training dummies (2026-09-17)
- [x] `PartyController` + `PartyHUD` (keys 1/2/3, portrait click, AI mode wheel on Q, mobile attack button) (2026-09-17)
- [x] AI modes checked by user (2026-09-17)
- [x] Verified auto-swap when the controlled Hunter dies, and party wipe → respawn after 5s (2026-09-17)
- [x] Fixed swap knock-down/death (`HumanoidUtil`, `CharacterController`); verified 11 swaps in combat with no falls or deaths (2026-09-17)
- [x] Checked HUD HP bars against live Humanoid HP through swaps and a wipe: no desync (2026-09-17)
- [x] Test Death Box (`World/TestArea/DeathBox`, tag `DeathBox`, temporary `TestHazardService`) — instant kill verified, triggers auto-swap (2026-09-17)
- [x] Q wheel checked by user; Stage 1 signed off, version v0.1.0 (2026-09-17)

### Stage 2 — Gate System (overworld) (2026-09-17)
- [x] `GateDefs` + `ModifierDefs` + `PowerCalc` (2026-09-17)
- [x] `GateService` + `Gate` class (spawn, rank weights, modifiers, stability drain, states, signals) (2026-09-17)
- [x] Gate model + client `GateBillboard` (rank, stability bar, timer, modifiers, low-stability flicker) (2026-09-17)
- [x] Risk Assessment `GatePanel` (party power vs recommended, Enter/Cancel) (2026-09-17)
- [x] `GateCompass` markers (2026-09-17)
- [x] Dungeon Break path verified with `StabilitySpeed = 20` (reset to 1) (2026-09-17)
- [x] Fixes: lower Inspect prompt, Atomic gate streaming, fault-tolerant bootstraps, Healer heals any missing HP (2026-09-17)
- [x] User signed off; version v0.2.0 (2026-09-17)

---

## 📌 Decisions

- **Rig type: R15** (2026-09-17) — all Hunter/monster rigs are R15. Party rigs are server-spawned (`CharacterAutoLoads = false`), so the player avatar setting does not matter.
- **Roblox places** (2026-09-17) — `Solo` (placeId 78995314774794) is the real game, currently an empty baseplate. `latestTest` (placeId 113217941021291) is the combat prototype to port from. Both are owned by the same user (58164235), so published animations are reusable.

---

## 🔄 In Progress

- [ ] **Stage 3 — Gate Exploration (dungeon run)** — built; hand tests pending (see Stage 3 below). Place at v0.2.1, remember to save/publish (2026-09-17)

---

## ❓ Open Design Questions
Defaults to build with until answered are in the plan's "Assumptions" table.

- [ ] Do shadow soldiers exist? (Section 1 says no; loop step 4 and Monarch of Shadows say yes)
- [ ] Multiplayer party: 1 Hunter per player with no AI, or AI fills empty slots?
- [ ] Hunter Base: personal plot per player, or one shared guild base per server? (decides where Dungeon Break monsters go)
- [ ] Gate Stability: real-time decay, or short per-server timers?
- [ ] Dungeon instancing: same-server arena copies (recommended to start) vs reserved servers
- [ ] Healer "weak in solo" still meaningful when AI companions are always present?

---

## 📋 To Do
Detailed build steps and "done when" checks for each stage are in `Dungeon Summon - Implementation Plan.md`.

### Stage 3 — Gate Exploration (dungeon run)
- [x] `MonsterDefs` + `DungeonDefs` + template `Standard` (2 rooms + boss room) (2026-09-17)
- [x] `DungeonService` + `DungeonInstance` (slots, rooms/waves, doors, boss, rewards, exits, Red Gate lock, wipe eject, gate collapse) (2026-09-17)
- [x] `Monster` class with threat table (reuses `AIBrain`) + boss Ground Slam telegraph (2026-09-17)
- [x] `ModifierRules` (Blood Moon, Berserk, Red Gate reward/no-escape) + `WalletService` Gold (2026-09-17)
- [x] Client `DungeonController` (objective banner, toasts) + `DungeonResults` panel (2026-09-17)
- [x] Verified: enter → Room 1 wave → door opens → objective advances; early leave + re-enter (2026-09-17)
- [ ] Verify Room 2 → boss + slam → results + Gold → final exit
- [ ] Verify Red Gate no-escape, Berserk stats, party wipe inside, two parties at once
- [ ] Move test Death Box off the spawn → GateSpawn_1 line (it sits at 35,0,0 directly on the path)
- [ ] Optional: floating damage/heal numbers, custom overhead HP bars, remove training dummies once monsters are verified (2026-09-17)

### Stage 4 — Dungeon Break & Hunter Base
- [ ] `BaseDefs` + `BreakDefs`
- [ ] `BaseService` (plots, structures, Energy Core HP, interaction stubs)
- [ ] `DungeonBreakService` (shatter, alert, waves march to nearest base, NPC attacks)
- [ ] Defense success / Base Collapse penalties + repair
- [ ] Break UI (banner, wave counter, Core HP, repair panel)

### Stage 5 — Combat Deep-Dive (port from latestTest)
- [ ] Detail this stage when it starts (notes in the plan)

### Stage 6 — Progression, Player Class & Saving
- [ ] `DataService` (ProfileStore)
- [ ] Leveling, equipment, crafting, Blacksmith, Signature Weapons, Hunter Rank
- [ ] Player Class awakening + rarity + secret quest
- [ ] Hunter recruitment + party editor

### Stage 7 — Multiplayer Party
- [ ] Invites, 3–4 players, no duplicate Hunters, shared dungeon

### Stage 8 — Economy & Pawn System
- [ ] Currencies + Guild Shop
- [ ] Safe Trading with guild tax
- [ ] Pawn System contracts (lock, redemption, expiry, offline-safe)
