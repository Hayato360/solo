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

### Stage 4 — Dungeon Break & Guild Base (2026-09-17)
- [x] `BreakDefs` (per-rank waves, win Gold) + `BaseDefs` (world-center base, guards, lockout/repair) + `GateDefs.Settings` (2026-09-17)
- [x] `GateService`: player-scaled drain, break cap + 5% floor during break/cooldown/Damaged, rank cap + freeze (E never freezes), `BreakCooldown`, `DebugStabilitySpeed` Studio hook; fixed Codex bug where Gates never broke (2026-09-17)
- [x] `GuildBaseService`: world-center base, Energy Core, `GuildBaseState` replication, Normal/UnderAttack/Damaged, 2 Defensive guards heal/respawn after breaks (2026-09-17)
- [x] `DungeonBreakService`: per-rank waves from the Gate's monster pool, raiders fight within 30 studs then push the Core, Won/Held/Lost, `Monster:Retreat`, Gate removed + cooldown (2026-09-17)
- [x] Damaged lockout: timer or group repair (hold adds 25, doubled for 25 Gold); no personal progress loss (2026-09-17)
- [x] Break UI `DungeonBreakController`: alert, countdown, Core HP, wave counter, lockout timer, repair progress, outcome message (2026-09-17)
- [x] Relocated Death Box (-75, 0, 30) and Training Dummies (-75, 4, -35) off the Guild Base (2026-09-17)
- [x] Verified by playtest: break start + other Gates hold at 5%, Won (+60 Gold), Lost → lockout timer → restore, Held → retreat, same-frame multi-Gate race fixed (2026-09-17)
- [x] User hand-tested the Repair prompt at the Core (2026-09-17)
- [ ] Check later: a Gate breaks while a party is inside its dungeon (eject + break starts)
- [ ] Later: Gate shatter VFX; lock base services while Damaged once Stage 6 structures exist; multi-break HUD if `MaxConcurrentBreaks` > 1
- [x] Studio test switches `DebugBreakMonsterMultiplier` / `DebugBreakStatMultiplier`; break HUD shrunk and moved to the right edge (2026-09-17)
- [x] User signed off; version v0.3.0 (2026-09-17)

---

## 📌 Decisions

- **Rig type: R15** (2026-09-17) — all Hunter/monster rigs are R15. Party rigs are server-spawned (`CharacterAutoLoads = false`), so the player avatar setting does not matter.
- **Roblox places** (2026-09-17) — `Solo` (placeId 78995314774794) is the real game, currently an empty baseplate. `latestTest` (placeId 113217941021291) is the combat prototype to port from. Both are owned by the same user (58164235), so published animations are reusable.

- **Dungeon Break redesign** (team discussion, 2026-09-17): Breaks are a shared, player-controllable server event.
  - One shared **Guild Base** at the world center.
  - Stability drain scaled by players online (half speed with 1–2, paused at 0); max 1–2 concurrent breaks with a 5% floor for other Gates.
  - Gate rank capped by the strongest online party (~1.5×); high-rank Gates freeze if capable players leave.
  - Timed breaks (~3 min) with guard NPCs; leftover monsters retreat.
  - Losing = temporary base lockout / group repair, **no permanent loss**; Gate removed + break cooldown after any break.
  - Supersedes design doc §5 storage-loss / structure-downgrade rules.

- **Stage 5 ownership** (2026-09-17): Combat Deep-Dive was assigned to a junior developer. Claude continued with Stage 6; other code kept calling `PlaceholderCombatService` functions so the combat swap stayed drop-in.
  - **Superseded (user, 2026-09-18): Claude took Stage 5 back** ("i dont want to wait for Jr. anymore"). The drop-in discipline paid off — `CombatService` kept the placeholder's API exactly, so all 13 consumers were repointed by a rename with no logic changes.

- **Combat knows nothing about progression** (2026-09-18): `DamageService` never reads levels, gear or Player Class. `StatCalc` folds all of it into the rig's `ATK`/`DEF` attributes, which is what keeps Stage 5 and Stage 6 independent.

- **The server owns the combo index** (2026-09-18): the client only sends "attack pressed". This deliberately fixes the `latestTest` prototype's flaw where the server trusted a client-supplied combo number.

- **Two combat pacing models** (2026-09-18): player-controlled rigs are paced by each attack's Windup/Recovery so combos feel fast; AI rigs keep their existing `AttackCooldown` attribute so Stage 1–4 balance did not shift.

- **Saving: ProfileService** (user, 2026-09-17), not ProfileStore. Studio falls back to `ProfileStore.Mock` when API access is off. Dev data resets by bumping the store key.

- **Swap camera keeps the aim point** (user, 2026-09-18): on a Hunter swap the camera re-aims from the new Hunter at the **same world point** the previous one was watching, blended over 0.25s. Copying the old angle alone is not enough, because the new Hunter stands elsewhere.

- **Target lock is a hard lock** (user, 2026-09-18): camera centres on the target, mouse look off, movement strafes around it. **Tap R** to lock the enemy nearest the view centre, tap again to cycle, **hold R** (0.35s) to release. `Escape` is unusable — Roblox owns it for its own menu and the input arrives `gameProcessed = true`. The lock drives the camera, Hunter facing, HUD marker + target HP bar, the `FocusTarget` AI mode, and basic-attack preference.

- **Targeting lives in `TargetService`, not `PlaceholderCombatService`** (2026-09-18): the placeholder is replaced wholesale in Stage 5, so the lock must not live inside it. `PartyService.SetTargetProvider` is the hook that avoids a circular require.

- **Default health CoreGui is disabled** (2026-09-18): it tracks a single Humanoid and reads any drop as damage, so every swap to a more damaged Hunter flashed the red vignette as if you had been hit. The party HUD already shows all three HP bars.

- **Training dummies are punching bags by default** (user, 2026-09-18): HP 50000, ATK 0, stationary, so testing is not interrupted by them dying or fighting back. `DummyService.FIGHTS_BACK = true` restores the original Stage 1 dummy.

---

## 🔄 In Progress

- [ ] **Stage 6 — Progression, Player Class & Saving** — 6A–6E all built (v0.3.3); 6A–6D verified, 6E partly verified; waiting for user hand checks + sign-off (2026-09-17). **Paused 2026-09-18** while camera/target-lock work was done at the user's request.
- [ ] **Target Focus (lock-on) — built 2026-09-18 (v0.3.4), partly verified.** Tap **R** lock/cycle, hold **R** release. Needs feel checks: strafing, companions in FocusTarget mode, swapping while locked.

---

## ⏸ Check Later

- [ ] **Stage 3 — Gate Exploration** — normal end-to-end path verified; remaining edge-case and multiplayer validation is deferred. Place remains at v0.2.1; save/publish when Studio changes are ready (2026-09-17)

## ❓ Open Design Questions
Defaults to build with until answered are in the plan's "Assumptions" table.

- [ ] Do shadow soldiers exist? (Section 1 says no; loop step 4 and Monarch of Shadows say yes)
- [x] Multiplayer party → superseded by `3 + 3 + 3`: every player keeps their own 3-Hunter party with 2 AI Companions (team, 2026-09-17)
- [x] Hunter Base → **shared Guild Base** (team, 2026-09-17)
- [x] Gate Stability → drain scaled by online players, break cap, rank cap by strongest party (team, 2026-09-17)
- [ ] Dungeon instancing: same-server arena copies (recommended to start) vs reserved servers
- [ ] Healer "weak in solo" still meaningful when AI companions are always present?
- [x] Updated Design Document §2/§5 to match the Dungeon Break redesign (2026-09-17)
- [x] Multiplayer Gate capacity → up to 3 players and 9 active Hunters (3 + 3 + 3); each player brings a complete personal 3-Hunter party, and joins/leaves only add/remove that party (team, 2026-09-17)

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
- [x] Verified by user: Room 2 → boss + slam → results + Gold → final exit (2026-09-17)
- [ ] Check later: Red Gate no-escape; Berserk monster HP/ATK; party wipe inside → eject + Gate stability −10%; multiplayer Gate behavior with 3 players + 3 Hunters each (`3 + 3 + 3`) after Stage 7
- [x] Moved test Death Box off the spawn → GateSpawn_1 line (done in Stage 4, 2026-09-17)
- [ ] Optional / check later: floating damage/heal numbers, custom overhead HP bars, remove training dummies once monsters are verified (2026-09-17)

### Stage 5 — Combat Deep-Dive
- [x] **Taken back from the junior developer at the user's request (2026-09-18).** Claude built the core.
- [x] `Config/CombatDefs` + `Config/AttackDefs` (20 attacks, 5 role kits, `WeaponCombos` hook) (2026-09-18)
- [x] `Modules/Hitbox` (cone / radius / behind / in-front queries) (2026-09-18)
- [x] `Services/DamageService` — single damage+heal pipeline: backstab → DEF → block/perfect block → floor; stun, knockback, i-frames (2026-09-18)
- [x] `Services/CombatService` — server-owned combo state, windup/active/recovery, skills + cooldowns, blocking, taunt, projectiles, AoE (2026-09-18)
- [x] `Controllers/CombatController` — LMB/E attack, F skill, hold RMB block, damage numbers, camera shake (2026-09-18)
- [x] Remotes `Combat/UseSkill`, `Combat/SetBlocking`, `Combat/CombatFeedback` (2026-09-18)
- [x] **`PlaceholderCombatService` deleted**; all 13 consumers repointed to `CombatService`, which keeps the same 9 functions and 2 signals (2026-09-18)
- [x] Taunt overrides AI target selection in `AIBrain` (2026-09-18)
- [x] Verified: Fighter combo dealt exactly 35+40+47.5 at ATK 50; Whirlwind exactly 65.0; skill cooldown refused a second press; AI damages through the same path; clean boot, zero errors (2026-09-18)
- [x] **R15 ragdoll** (`Modules/Ragdoll`) — handles both rig types; verified head fell 4.20 studs and fully restored (2026-09-18)
- [x] **Boss phases** — `MonsterDefs.BossPhase` + `Monster`; Goblin Chief Furious at 60%, Enraged at 30%; verified thresholds and `AttackCooldown` 1.5 → 0.9 (2026-09-18)
- [x] **Destructible props** (`DestructibleService`) — tag `Destructible`, splash damage, physics fragments; verified 8 fragments (2026-09-18)
- [x] **AI uses skills** — `AIBrain` rolls every 1.5s at 50%, gated by the real cooldown; verified Han Seoa using `mage_skill` (2026-09-18)
- [x] **Blocking + perfect block hand-tested** — WalkSpeed ×0.45, 93.5 → 23.4 blocked, perfect block 0.0 + attacker stunned (2026-09-18)
- [x] **Sounds** — Swing / Hit / Block inserted from free Creator Store audio, wired via `Modules/CombatFX` (2026-09-18)
- [x] **Animations ported from `latestTest`** (2026-09-19). User opened the place; its `ReplicatedStorage.CombatAnimations` holds a 4-hit melee combo. Melee is the right fit — `fighter_1..4` *is* the unarmed chain. Wired to Fighter, Assassin, Tank and monsters; Mage/Healer left without on purpose (punches would look wrong on a cast). `CombatFX` caches tracks per Animator and `CombatService.Start` preloads them.
- [x] **Hit-reaction flinch** — latestTest's `Hit` (0.52s) verified working, played by `DamageService` at Movement priority, skipped when the hit will ragdoll anyway (2026-09-19)
- [x] Verified: all 4 combo animations play and retime exactly (M1_2 at 1.18×, M1_4 at 0.88×); flinch at 1.48×; combo still deals the exact 202.5 (2026-09-19)
- [ ] **Sword combos still open** — `AttackDefs.WeaponCombos` is empty, so Codex's `fighter_sword01` uses the unarmed chain. Needs 4 sword-specific published R15 animations.
- [ ] **Block animation — authored, needs publishing by the user.** Guard pose is ready at `ServerStorage.AnimationSources.BlockGuard` (KeyframeSequence, looping, Action2, two-handed chest guard). Publish it in the Animation Editor and paste the id into `AttackDefs.Reactions.Block`; `CombatService` already holds/releases the track with the guard.
  - **Cannot be done in code:** these R15 constraint rigs revert any script write to `AnimationConstraint.Transform` (verified with `Animate` disabled and no tracks playing). An attempted `Modules/BlockPose` was removed rather than shipped as dead code (2026-09-19).
- [ ] ⚠️ **Audio licensing is the user's call** — the three sounds are free third-party Creator Store assets, not first-party Roblox audio. Confirm before a commercial release.
- [x] **Fixed: Fighter permanently slow** — block state stranded on swap; WalkSpeed is now derived (`HumanoidUtil.RefreshWalkSpeed`), not accumulated (2026-09-19)
- [x] **Fixed: equipping a weapon disabled attacking** — Roblox Tools capture MouseButton1; `CombatController` now also fires on `Tool.Activated` (2026-09-19)
- [x] **Fixed: attack animations cut short** by a stale `track:Stop()` against a cached track (2026-09-19)
- [x] **Fixed: `EquippedWeaponId` never set**, which would have made `WeaponCombos` silently dead (2026-09-19)
- [x] Added **`C`** as a keyboard block key; right mouse fights camera rotation and was undiscoverable (2026-09-19)
- [ ] ⚠️ **Tool-click fix is NOT playtest-verified** — code is in, reproduction understood, but the playtest ended first. Equip Sword01 and left-click to confirm.
- [ ] Decide whether right mouse should stay a block binding at all
- [x] Added character-specific F/G/X kits, damage-charged ultimate meter, hold-preview-release AoE telegraphs, target-range feedback, and Passive companion mode (2026-09-19)
- [ ] Hand-test X ultimate after filling its meter, including swap-away/swap-back persistence; Studio transport closed during final verification (2026-09-19)
- [ ] Hand-test Mina Second Dawn and Seo Yuna Starlight Revival on a fallen nearby party member (2026-09-19)
- [ ] User sign-off on Stage 5

### Stage 6 — Progression, Player Class & Saving (planned 2026-09-17)
- [x] Inserted official ProfileService (asset 5331689994, loleris) as `ServerScriptService.Modules.ProfileService` after a code review (single module, only DataStoreService/RunService, no require-by-id/loadstring/getfenv) (2026-09-17)
- [x] User enabled Studio Access to API Services (2026-09-17)
- [x] 6A Saving built (v0.3.1): `DataTemplate`, `DataService` (ProfileService, session lock, auto mock), `Data/Snapshot`+`KeyChanged`+`GetSnapshot` + `DataController`, WalletService on profile (Gold + Diamonds), PartyService spawns the saved party, `StatsService` + clear/break counters; clean boot verified (2026-09-17)
- [x] 6A verified by user: Gold kept after stop → play again; stronger team works (2026-09-17)
- [x] Team buff at user request: `RoleDefs` HP ×2, ATK ×2, DEF ×1.5 for every role; starter party power 113 → ~219, so Rank D Gates can now spawn (2026-09-17)
- [x] 6B Leveling built + verified in playtest: `ProgressionDefs`, `StatCalc`, kill/clear EXP, level-up + Hunter Rank, real party power (rank cap), party editor (P), Lv/Rank on HUD (2026-09-17)
- [x] 6C Items built + verified through the UI: `ItemDefs`/`RecipeDefs`, drops, 6 Guild Base structures (locked while Damaged), `InventoryService` + Bag (B), `CraftingService`, `BlacksmithService` + Signature Weapons, potions (H) / traps (T), `MenuController` buttons, TEMP `DebugService` (2026-09-17)
- [x] `Sword01` is Fighter-only Bag gear: one copy is granted per profile and its equipped Tool model follows the custom Hunter swap flow through the R15 right hand (2026-09-18)
- [ ] 6C hand checks: sell, potion use, unequip, trap damage, structures locked while Damaged
- [x] 6D Player Class built + verified: `ClassDefs` (9 classes), awakening at the altar after 10 clears (first free, re-roll 50 Diamonds), switch for Gold, class modifiers via StatCalc, out-of-combat regen, Class panel (K) with reveal (2026-09-17)
- [x] 6E Quests & recruitment built: 11 Hunters with rarity, `RecruitDefs` + `RecruitService`, `QuestDefs` + `QuestService` (3 board quests, 30-min refresh, claim at board), secret chain → Sovereign of the Abyss, Diamond sources (quests, break wins, rare drops), Quest panel (J) + tracker, Recruit panel (2026-09-17)
- [ ] 6E hand checks: accept secret quest + step progress, recruit a Hunter and add to party, board refresh rollover
- [ ] Stage 6 sign-off by user (then bump to v0.4.0). Version is v0.3.3 after 6D/6E (2026-09-17)
- [ ] Before release: remove TEMP `DebugService`; consider `PlayerData_v2` to wipe dev test data

### Target Focus / camera (built 2026-09-18, v0.3.4)
- [x] `Config/TargetDefs`, `Remotes/Combat/SetTarget` + `TargetChanged`, `TargetService`, `TargetController` (2026-09-18)
- [x] `CameraController`: swap re-aims at the same world point over a 0.25s blend; yields whenever the camera is `Scriptable` (2026-09-18)
- [x] `HunterAIService.GetFocusTarget` prefers the lock; `PartyService` passes it as `preferredTarget` (2026-09-18)
- [x] `DummyService` punching-bag mode (HP 50000, ATK 0, stationary, spacing 14) (2026-09-18)
- [x] `GuiController` disables the default health CoreGui — fixes the false red damage vignette on swap (2026-09-18)
- [x] Verified: tap locks (1.3° off centre), cycle visits all 3 bots, hold releases and restores camera/AutoRotate/HUD/marker, auto-release on death logs its reason (2026-09-18)
- [ ] **User to confirm:** the red screen border is gone when swapping to Han Seoa
- [ ] **User to judge:** strafe feel (A/D circling a locked target), camera distance/height/lerp
- [ ] Test companions in `FocusTarget` mode (Q wheel) actually committing to the locked target
- [ ] Test swapping while locked keeps the lock framed from the new Hunter
- [ ] Re-verify Stage 1 — swap, camera and movement all changed after its sign-off
- [ ] Mobile / touch: no lock button yet (R is keyboard only)
- [ ] Consider raising `ClassDefs.BaseRegenPerSecond` (0.004 = 0.4%/s ≈ 200s to full-heal the Mage; nearly all healing currently comes from the Healer)
- [ ] Before release: restore `DummyService.FIGHTS_BACK = true` or replace dummies with real monsters

### Docs
- [x] Rewrote `dungeon-summon-deep-dive-th.*` from live code: glossary, real formulas with worked examples, 8 config tables, Remote/Signal/Attribute tables, character-swap section (2026-09-18)
- [ ] Deep-dive page is now out of date: the swap section still describes the old "keeps the same angle" camera, and there is no target-lock section

### Stage 7 — Multiplayer Party
- [ ] Invites, up to 3 players and 9 active Hunters per Gate (3 + 3 + 3), personal party join/leave, duplicate Hunter definitions allowed across players, shared dungeon

### Stage 8 — Economy & Pawn System
- [ ] Currencies + Guild Shop
- [ ] Safe Trading with guild tax
- [ ] Pawn System contracts (lock, redemption, expiry, offline-safe)


