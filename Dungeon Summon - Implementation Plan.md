# Dungeon Summon — Implementation Plan (Roblox)

Staged build plan for turning `Dungeon Summon - Core System Design Document.md` into the **Solo** Roblox place (placeId 78995314774794).
Each stage lists its goal, what to build, and how to know it's done. Build stages in order. Every stage ends with a playable test in Studio.

**Status legend:** ⬜ Not started · 🟨 In progress · ⏸ Check later · 👤 Assigned to someone else · ✅ Done

| Stage | Name                               | Design Doc Section              | Status        |
| ----- | ---------------------------------- | ------------------------------- | ------------- |
| 0     | Project Foundation                 | —                               | ✅             |
| 1     | Hunters & Solo Raid Party          | §3 The Raid Party               | ✅             |
| 2     | Gate System (overworld)            | §2 Gate System                  | ✅             |
| 3     | Gate Exploration (dungeon run)     | §1 Loop 5, §2 Modifiers         | ⏸ Check later |
| 4     | Dungeon Break & Guild Base         | §2 Stability, §5 Hunter Base    | ✅             |
| 5     | Combat Deep-Dive                   | §3 Hunter Roles                 | 🟨 Built       |
| 6     | Progression, Player Class & Saving | §4 Player Class, §5 Progression | ⬜             |
| 7     | Multiplayer Party                  | §3 Multiplayer Party Rules      | ⬜             |
| 8     | Economy & Pawn System              | §6 Economy (Phase 3+)           | ⬜             |

---

## Global Rules (apply to every stage)

### Decisions already made
- **Rig type: R15** for all Hunters and monsters.
- **Server spawns characters** (`Players.CharacterAutoLoads = false`). The player's own avatar is never used. The player controls one of their Hunter rigs.
- **Server authority:** the client only sends input requests. The server checks every request (range, cooldown, ownership, alive, state) before doing anything.
- **Data lives in Config modules**, not hardcoded in services. Tuning should only need edits to `ReplicatedStorage.Config`.

### Folder layout
```
ReplicatedStorage/
  Config/          RoleDefs, HunterDefs, GateDefs, ModifierDefs, MonsterDefs, ClassDefs, BaseDefs, ItemDefs
  Modules/         Signal, StateUtil, PowerCalc, (later) HitboxModule, ProjectileModule
  Remotes/         Party/, Gate/, Dungeon/, Base/, Combat/, Data/
  Assets/          Animations/, Sounds/, VFX/
ServerScriptService/
  Bootstrap        (Script — requires and starts every service in order)
  Services/        (ModuleScripts, one per system)
  Classes/         (ModuleScripts, one class per file: Hunter, Party, AIBrain, Gate, DungeonInstance, Monster, ...)
  Modules/         (server-only helper ModuleScripts that are not classes or services, e.g. RigFactory)
ServerStorage/
  HunterRigs/  Monsters/  DungeonTemplates/  GateModels/  BaseStructures/
StarterPlayer/StarterPlayerScripts/
  ClientBootstrap  (LocalScript — starts every controller)
  Controllers/     (ModuleScripts, one per client system)
  UIClasses/       (ModuleScripts, reusable UI components: HunterPortrait, StabilityBar, ...)
StarterGui/
  VersionGui, PartyHUD, GatePanel, BaseUI, ...
Workspace/
  World/  (GateSpawns/, BasePlots/, NPCs/)   Dungeons/   Debris/
```

### Naming conventions
- Services: `XxxService` (server). Controllers: `XxxController` (client).
- Remotes are named by action: `RequestSwap`, `SetAIMode`, `EnterGate`.
- Shared attributes, always set by the server:

| Attribute | On | Values |
|---|---|---|
| `Team` | any combat rig | `"Hunter"` / `"Monster"` |
| `OwnerUserId` | Hunter rig | player UserId |
| `HunterId` | Hunter rig | key in `HunterDefs` |
| `Role` | Hunter rig | `Fighter` `Mage` `Tank` `Healer` `Assassin` |
| `IsControlled` | Hunter rig | `true` if the player is driving it |
| `AIMode` | Hunter rig | `Aggressive` `Defensive` `ProtectAlly` `FocusTarget` `Balanced` |
| `IsStunned` / `IsAttacking` / `IsBlocking` | any combat rig | bool |
| `GateId` `Rank` `GateColor` `Stability` `Modifiers` `GateState` | Gate model | see Stage 2 |

### Code structure (hybrid OOP)
Use **classes for things that have many copies**, **singleton services for systems**, and **plain tables for config**.

| Kind | Use for | Examples | Lives in |
|---|---|---|---|
| **Class** (metatable OOP, `.new()` + methods + `:Destroy()`) | Anything with multiple live copies and its own state | `Hunter`, `Party`, `AIBrain`, `Gate`, `DungeonInstance`, `Monster`, `PawnContract` | `ServerScriptService/Classes/` |
| **Service** (singleton module with `:Init()` / `:Start()`) | One system that creates, tracks, and removes its objects | `PartyService` holds `Party` objects, `GateService` holds `Gate` objects | `ServerScriptService/Services/` |
| **Controller** (client singleton) | One client system | `PartyController`, `GateController` | `StarterPlayerScripts/Controllers/` |
| **Config** (plain data tables, no methods) | Tunable numbers and definitions | `RoleDefs`, `GateDefs`, `ClassDefs` | `ReplicatedStorage/Config/` |

**Rules**
- **Composition over inheritance.** No deep class trees. A `Hunter` and a `Monster` each *have* an `AIBrain`; they don't inherit from a shared base class. At most one level of inheritance if it clearly removes duplication.
- **No subclass per role, rank, or modifier.** Differences come from Config data (`RoleDefs.Mage`, `GateDefs.S`), read by one class.
- **Services own object lifetime.** Only the owning service calls `.new()` and `:Destroy()`. Other systems talk to a service (`GateService:GetGate(id)`), not by keeping their own references.
- **Every class has `:Destroy()`** that disconnects its connections and destroys its instances. Track connections in a list on the object (e.g. `self._connections`) so nothing leaks.
- **Classes communicate outward with `Signal`** (e.g. `gate.StabilityZero:Fire(gate)`); the owning service listens and relays to other services.
- **Type the classes** with Luau `export type` so fields and methods autocomplete.

**Class template**
```lua
--!strict
local Signal = require(game.ReplicatedStorage.Modules.Signal)

local Gate = {}
Gate.__index = Gate

export type Gate = typeof(setmetatable({} :: {
	Id: string,
	Rank: string,
	Stability: number,
	Model: Model,
	StabilityZero: any,
	_connections: { RBXScriptConnection },
}, Gate))

function Gate.new(id: string, rank: string, model: Model): Gate
	local self = setmetatable({
		Id = id,
		Rank = rank,
		Stability = 100,
		Model = model,
		StabilityZero = Signal.new(),
		_connections = {},
	}, Gate)
	return self
end

function Gate.Tick(self: Gate, dt: number)
	-- update state, fire signals
end

function Gate.Destroy(self: Gate)
	for _, c in self._connections do c:Disconnect() end
	self.StabilityZero:Destroy()
	self.Model:Destroy()
end

return Gate
```

### Assumptions for open design questions
Build with these defaults until the question is answered, and keep them easy to change.

| Question | Default assumption |
|---|---|
| Do shadow soldiers exist? (§1 says squad members are Hunters, loop step 4 + Monarch of Shadows mention shadow soldiers) | **No shadow soldiers.** Monarch of Shadows' "+50% shadow soldiers" applies to Assassin only. |
| Multiplayer Gate capacity | **Up to 3 players and 9 active Hunters per Gate (3 + 3 + 3).** Every player brings their own 3-Hunter party, controls one Hunter, and keeps two personal AI Companions. A join/leave only adds/removes that player's whole party; it never rebuilds another player's party. Same Hunter definitions may appear for different players. |
| Hunter Base: per player or shared? | ✅ **Decided (team, 2026-09-17): one shared Guild Base per server** at the world center. Dungeon Break waves march there. See Stage 4. |
| Stability timing | ✅ **Decided (team, 2026-09-17):** drains only while players are online, scaled by player count (3+ normal, 1–2 half speed). At most 1–2 breaks at a time. Rank-capped by the strongest online party. See Stage 4. |
| Dungeon instancing | **Same server.** Clone the dungeon template into an offset slot far from the world. |

---

## Stage 0 — Project Foundation

**Goal:** an empty but organized place where every later stage has somewhere to plug in.

### Build
1. Create the full folder layout above (empty ModuleScripts where needed), including `Classes/` and `UIClasses/`.
2. `Bootstrap` Script: requires each ModuleScript in `Services/` in a fixed order list and calls `:Init()` then `:Start()`.
3. `ClientBootstrap` LocalScript: same pattern for `Controllers/`.
4. `Signal` module (simple event object for service-to-service and class-to-service events), with `:Connect`, `:Fire`, `:Destroy`.
5. `StateUtil` module: `Get(rig, name)` / `Set(rig, name, value)` backed by **Attributes** so states sync to clients.
6. `Players.CharacterAutoLoads = false`. Temporary `SpawnService` loads one R15 test rig as `player.Character` so the place can still be playtested.
7. Test world: flat terrain or baseplate zone, `World/GateSpawns` (5 tagged parts), `World/BasePlots` (4 plot parts).
8. `VersionGui` with `VersionLabel` = `v0.0.1` (so `/end-session` can bump it).

### Done when
- Playtest runs with **zero errors** in the output.
- Player spawns as an R15 rig, walks around, and sees the version label.
- `Bootstrap` prints each service name as it starts.

### Built notes (2026-09-17)
- The test rig is **generated at server start** (`Players:CreateHumanoidModelFromDescription`, R15) inside `SpawnService`, not stored in `ServerStorage.HunterRigs`. The Studio MCP can't parent a model containing the `Animate` LocalScript. Stage 1 Hunter rigs need the same runtime generation, or they must be placed in `HunterRigs` by hand in Studio.
- Added `Controllers/GuiController`: with `CharacterAutoLoads = false`, StarterGui is not copied into PlayerGui automatically, so the controller clones any missing ScreenGuis on join.
- Verified in playtest: no errors, R15 character with walk animations, camera follows, version label visible, player network ownership, respawn after death works.

---

## Stage 1 — Hunters & Solo Raid Party (§3)

**Goal:** the player controls 1 of 3 Hunters, swaps between them in real time, and the other 2 follow AI commands.

> Combat here is **placeholder only** (`BasicAttack` below), just enough to test party and AI behavior. Stage 5 replaces it.

### Config
- **RoleDefs** — base stats per role (§3 Hunter Roles table):

| Role | HP | ATK | DEF | Speed | Attack Range | Preferred Distance | Note |
|---|---|---|---|---|---|---|---|
| Fighter | 120 | 12 | 8 | 16 | 6 | 4 | balanced melee |
| Mage | 70 | 18 | 3 | 15 | 30 | 20 | glass cannon, ranged |
| Tank | 200 | 6 | 15 | 14 | 6 | 3 | draws aggro |
| Healer | 80 | 5 | 5 | 15 | 25 | 15 | basic action heals the ally with the lowest HP% |
| Assassin | 75 | 15 | 4 | 20 | 5 | 3 | fast, single target |

  *(Starting values — tune freely.)*
- **`HunterDefs`** — one starter Hunter per role: `{ Name, Role, Rank = "E", RigName }`.

### Build
1. **`PartyService`**
   - On join: spawn the player's 3 party rigs from `ServerStorage.HunterRigs`, set attributes (`Team`, `OwnerUserId`, `HunterId`, `Role`), apply `RoleDefs` stats to the Humanoid.
   - Slot 1 becomes `player.Character`; the server gives the player network ownership.
   - **Swap (Tag-in/Tag-out):** remote `Party.RequestSwap(slot)`. The server checks the slot is alive, not the current one, and the 1s swap cooldown has passed. Then the old rig goes to AI (server network owner, `IsControlled=false`), the new rig becomes `player.Character` (player network owner, `IsControlled=true`), with a short swap VFX.
   - **Death:** if the controlled Hunter dies, auto-swap to the next living slot. If all 3 are dead, it's a party wipe: fire the `PartyWiped` signal (Stage 3 uses it to eject from the dungeon), then respawn the party at the base after 5s.
   - ⚠️ **Do this first as a spike:** confirm that reassigning `player.Character` correctly moves camera, controls, and animations. AI-controlled rigs need a **server-side animation script** because the rig's `Animate` LocalScript stops running when it's no longer `player.Character`.
2. **`HunterAIService`** — runs about 8 times per second for each rig with `IsControlled=false`:
   - States: `Follow` → `Engage` → `Reposition` → `Support`.
   - Movement: `Humanoid:MoveTo`, switching to `PathfindingService` when the target is more than 40 studs away or blocked.
   - Behavior modes (remote `Party.SetAIMode(mode)` applies to both companions):

| Mode | Behavior |
|---|---|
| Aggressive | Target the nearest enemy, chase, attack continuously |
| Defensive | Stay within 12 studs of the controlled Hunter; only fight enemies inside that radius |
| Protect Ally | Healer heals lowest-HP% ally; others attack whatever is hitting that ally |
| Focus Target | Attack the controlled Hunter's current target |
| Balanced | Keep the role's Preferred Distance, attack what's in range |

3. **`BasicAttack` (placeholder, inside `PartyService` or a small `PlaceholderCombat` module)**
   - Player clicks → remote `Combat.BasicAttack()`. The server picks the nearest enemy in front within the role's Attack Range and applies a role cooldown.
   - Damage = `max(1, ATK - DEF * 0.5)`. For the Healer, the basic action heals `ATK * 2` instead.
   - The server tracks each player's **current target** (last enemy hit) for Focus Target.
4. **Training dummies:** 3 R15 dummies with `Team="Monster"` that walk toward the nearest Hunter and hit back with `BasicAttack`, then respawn after 5s.
5. **`PartyController` + `PartyHUD`**
   - Keys **1 / 2 / 3** to swap; mobile buttons on screen.
   - Portraits for all 3 slots: name, role icon, HP bar, "controlled" highlight, dead state.
   - AI mode selector (hold **Q** for a 5-option wheel; tap buttons on mobile).

### Done when
- The player can swap between all 3 Hunters mid-fight, with camera and controls following instantly.
- Each of the 5 AI modes visibly changes companion behavior against the dummies.
- The Healer companion keeps an injured ally alive in Protect Ally mode.
- Controlled Hunter dies → auto-swap. All 3 die → party wipe → respawn.

### Built notes (2026-09-17)
- **Swap gotcha (important):** Roblox **destroys** the previous `Player.Character` model whenever `player.Character` is reassigned. Fix in `Hunter:_detachFromCharacter()`: just before control leaves a Hunter, its parts and Humanoid move into a fresh Model, so only the empty shell is destroyed. The Humanoid keeps its identity, so `Died` / `HealthChanged` listeners keep working. **Never hold a long-lived reference to `hunter.Rig`**; it changes on every swap. Always read `hunter.Rig` fresh.
- **Swap knock-down:** moving body parts between models during the detach trips the Humanoid into `FallingDown`. In combat that can also kill it through the neck check. Fix: `Modules/HumanoidUtil` (shared) disables `FallingDown` / `Ragdoll` and gets the rig back up, and combat rigs use `RequiresNeck = false`. The server re-applies it after taking a Hunter back (plus `Upright`), and `Controllers/CharacterController` applies it on the client to the controlled Hunter. `SetStateEnabled` does not replicate, so both sides must call it. Stage 5 ragdolls must re-enable these states deliberately.
- **Camera:** the default camera does not follow a reassigned character. `Controllers/CameraController` sets `CameraSubject` whenever `player.Character` changes.
- **Network ownership:** Roblox auto-assigns nearby unanchored rigs to a player. `RigFactory.SetServerOwned` pins AI rigs (companions, dummies) to the server.
- **Init vs Start:** services must connect to other services' signals in `Init`, not `Start`. `PartyService.Start` creates parties immediately, so a listener connected later in `Start` misses them.
- **Built:** Config `RoleDefs` / `HunterDefs` / `AIModeDefs`. Server `Modules/RigFactory`. Classes `RigAnimator`, `Hunter`, `Party`, `AIBrain`. Services `PlaceholderCombatService`, `PartyService`, `HunterAIService`, `DummyService`. Client `CameraController`, `PartyController`, UI classes `HunterPortrait`, `AIModeWheel`. Removed the temporary `SpawnService`.
- **Verified in playtest:** 3 Hunters spawn, companions and dummies fight, the Healer heals, swapping with keys 2 / 3 and by clicking a portrait keeps all 3 rigs, and control, animations, camera and the HUD highlight all follow. The dead-Hunter swap was correctly refused.
- **Verified:** auto-swap on death, party wipe → respawn, HUD HP sync, and 11 swaps in combat with no falls. The user checked the AI modes and the Q wheel and signed off on Stage 1 (2026-09-17). Studio's simulated input can't press key `1`; real keyboards are fine.
- **Test hazard:** `World/TestArea/DeathBox` (tag `DeathBox`) + temporary `TestHazardService` instantly kills anything that touches it.

### Built notes — swap camera & target lock (2026-09-18, v0.3.4)
Added after Stage 1 was signed off, so **Stage 1 needs a quick re-verify**: swapping, camera and movement all changed.

- **Swap now keeps what you were watching.** Copying the old yaw/pitch is not enough — the new Hunter stands somewhere else, so the same angle points at something else. `CameraController` raycasts from last frame's camera (250 studs, ignoring all rigs you own) to find the world point being watched, then re-aims from the new Hunter over a **0.25s** blend. Guards: skipped on first spawn (`hasFramedCharacter`, needed because `CharacterAutoLoads = false` routes the first assignment through the same signal), skipped if the aim point is under 6 or over 300 studs (the latter stops a wipe-respawn aiming you across the map).
- **Why writing `camera.CFrame` works at all:** the default camera module re-reads its rotation from `CurrentCamera.CFrame.LookVector` every frame (`BaseCamera:GetCameraLookVector`) rather than keeping a private yaw/pitch. Bind after `Enum.RenderPriority.Camera`, write the CFrame, and the default camera carries on from there. No need to fight `PlayerModule`.
- **Target lock (new):** tap **R** to lock the enemy nearest your view centre, tap to cycle, **hold R** (0.35s) to release. Hard lock: camera goes `Scriptable` and frames the target, `Humanoid.AutoRotate = false` and the Hunter faces the target. Because Roblox movement is camera-relative and the camera points at the target, **W/S become approach/retreat and A/D become strafe for free** — no control-script changes.
- **`Escape` cannot be a release key.** Roblox owns it for its own menu, so the input arrives with `gameProcessed = true`. Hold-to-release instead.
- **Cycling must not order candidates by screen angle.** The hard-lock camera re-centres on whatever is locked, so a screen-angle order reshuffles every press and ping-pongs between the same two targets. Cycle by **world-space azimuth**; use screen angle only for the first lock.
- **`CloseLockRadius` (25 studs)** skips the 75° cone test. Without it an enemy 5 studs away but slightly behind you is unlockable, which reads as the key being broken.
- **Server owns the lock.** `TargetService` validates team, alive, range and ownership, and auto-releases on death, out-of-range, party rebuild or leave. It is deliberately **not** inside `PlaceholderCombatService`, which Stage 5 replaces wholesale.
- **Circular require:** `TargetService` requires `PartyService`, so `PartyService` cannot require it back. `PartyService.SetTargetProvider(fn)` is the hook, matching `GateService.SetEntryHandler`.
- **Default health GUI is now off** (`GuiController` → `SetCoreGuiEnabled(Health, false)`). It tracks one Humanoid and reads any drop as damage, so every swap to a more damaged Hunter flashed the red vignette as if you had been hit. The party HUD already shows all three HP bars.
- **Verified in playtest:** tap locks (target held 1.3° off screen centre), cycle visits all three bots, hold releases and restores camera / `AutoRotate` / HUD / marker, auto-release on target death logs its reason. **Not verified:** strafe feel, companions committing to the locked target in `FocusTarget` mode, swapping while locked.
- **Training bots:** `DummyService` defaults to punching-bag mode (HP 50000, ATK 0, WalkSpeed 0, spread 14 studs). `FIGHTS_BACK = true` restores the original chasing dummy.

---

## Stage 2 — Gate System, Overworld (§2, §1 Loop 1–4)

**Goal:** Gates appear in the world with a rank, color, and stability that counts down. The player can inspect one and decide whether to enter.

### Config
- **`GateDefs`** (by rank; values are starting points):

| Rank | Color | Tier (§2 table) | Stability Minutes | Recommended Power | Modifier Chance | Spawn Weight |
|---|---|---|---|---|---|---|
| E | Blue | Easy | 20 | 100 | 0% | 40 |
| D | Blue | Easy | 25 | 200 | 0% | 25 |
| C | Blue | Medium | 30 | 400 | 5% | 15 |
| B | Purple | Medium | 35 | 700 | 10% | 10 |
| A | Red | Very hard | 45 | 1200 | 40% | 6 |
| S | Red | Very hard | 60 | 2000 | 60% | 3 |
| Secret/Abyss | Black | Legendary | 30 | 3500 | 100% | 1 |

  Each rank also sets: `MonsterPool`, `Boss`, `DungeonTemplate`, `Rewards` (gold range, item table).
- **`ModifierDefs`** (§2 Modifiers):

| Modifier | Effect | Can roll on |
|---|---|---|
| BloodMoon | Dark-element monsters: stats ×1.5 | C and up |
| Berserk | Monster ATK ×2, HP ×0.7 | B and up |
| RedGate | Rewards ×3, **cannot leave until the boss dies** | A, S, Secret |

- **`PowerCalc`** module: `HunterPower = ATK*2 + DEF + HP/10`, and `PartyPower` is the sum of all 3 Hunters. Stage 6 adds level and gear.

### Build
1. **`GateService`**
   - Every `SPAWN_INTERVAL` (e.g. 90s), if active Gates are below `MAX_ACTIVE_GATES` (e.g. 4), pick a random free `GateSpawn` and a rank by spawn weight, then roll modifiers.
   - Clone `ServerStorage.GateModels.Gate` and set attributes `GateId`, `Rank`, `GateColor`, `Stability=100`, `Modifiers` (comma list), `GateState="Open"`.
   - A Heartbeat loop reduces Stability by `100 / (StabilityMinutes*60) * STABILITY_SPEED` per second.
   - Gate states: `Open` → `InProgress` (a party is inside) → `Cleared` (remove the Gate) or `Broken` (Stage 4).
   - Fires signals `GateSpawned`, `GateStabilityZero`, `GateCleared`.
2. **Gate visuals:** portal colored by `GateColor`. A BillboardGui shows the rank letter, a stability % bar, and modifier icons. The Gate flickers faster below 25% stability.
3. **Risk Assessment:** a ProximityPrompt on the Gate opens `GatePanel` through remote `Gate.GetGateInfo(gateId)` (RemoteFunction). The panel shows:
   - Rank + color, modifiers with descriptions, and time left before a Dungeon Break.
   - **Your party power vs recommended power** (green / yellow / red).
   - Buttons: **Enter** (remote `Gate.EnterGate(gateId)` → Stage 3) and **Cancel**.
4. **Gate Discovery aid:** a minimap/compass marker per Gate, colored by rank.

### Done when
- Gates spawn over time with the rank distribution above.
- Stability visibly drains. With `STABILITY_SPEED = 20` it reaches 0 within a minute, firing `GateStabilityZero` (a log line is enough until Stage 4).
- The Risk Assessment panel shows correct data, and Enter/Cancel work (Enter can just print until Stage 3).

### Built notes (2026-09-17)
- **Built:** Config `GateDefs` (ranks + `Settings`) and `ModifierDefs`. Shared `Modules/PowerCalc`. Class `Gate`, service `GateService` (signals `GateSpawned`, `GateStabilityZero`, `GateCleared`, `EnterRequested`; `SpawnGate(rank?, modifiers?)` for testing). Model `ServerStorage.GateModels.Gate` (Base, Rim, Portal, PromptAnchor). Remotes `Gate.GetGateInfo` and `Gate.EnterGate` (RemoteFunctions). Client `GateController` with UI classes `GateBillboard`, `GatePanel`, `GateCompass`.
- **Gate visuals are client-side:** the server only writes attributes (`Stability` / `SecondsLeft` every 0.5s), and the client builds labels and flicker from them. Gate models use `ModelStreamingMode = Atomic` so the label never sees a model without its `Portal`.
- **Gate model pivot:** `Base` is a rotated cylinder, so the model has no `PrimaryPart` and uses an explicit upright `WorldPivot`. Otherwise `PivotTo` tips the portal over.
- **Prompt placement:** the Inspect prompt lives on an invisible `PromptAnchor` at chest height in front of the portal. It was unreliable when parented to the portal center 9.5 studs up.
- **Bootstraps are fault-tolerant:** a module that fails to load or `Init` is skipped with a warning instead of stopping every other service or controller. A syntax error in `GatePanel` had knocked out the whole client HUD.
- **Healer AI (Stage 1 follow-up):** companion Healers now heal any ally missing HP in every mode (was 70%).
- **Verified in playtest:** spawn and rank roll, stability drain, label and timer, compass markers (edge-pinned when behind), prompt → panel (E gate Safe, D gate Dangerous for the starter party), Enter → server validation and message, panel auto-close by distance, and with `StabilitySpeed = 20`: 0% → Broken → `DUNGEON BREAK` log → removal after 10s, with the flicker working.
- **Not yet seen live:** a gate rolling a modifier. Only C+ can roll, so it's rare at current weights.

---

## Stage 3 — Gate Exploration, Dungeon Run (§1 Loop 5, §2 Modifiers)

**Goal:** entering a Gate sends the party into a dungeon. Clear the rooms, kill the boss, get rewards, and leave.

### Config
- **`MonsterDefs`:** `{ Name, Rig, HP, ATK, DEF, Speed, AttackRange, Element, IsBoss }`. `Element` is needed for Blood Moon.
- Per-template room list, e.g. `{ Rooms = { {Wave = {"Goblin","Goblin"}}, ... }, BossRoom = true }`.

### Build
1. **`DungeonService`**
   - `EnterGate`: the server re-checks the Gate is `Open`, then sets it to `InProgress`.
   - Clone `ServerStorage.DungeonTemplates[template]` into a free slot at `Vector3.new(10000 + slot * 2000, 0, 0)` under `Workspace.Dungeons`.
   - Teleport all 3 party rigs to the template's `Entrance` part and save the Gate's world position for the return trip.
   - **Rooms:** each room has a door part and a trigger. Entering spawns that room's wave, and the door opens when every monster in the room is dead.
   - **Boss room:** spawn the boss. When it dies, grant rewards (multiplied by modifiers), spawn the `ExitPortal`, and fire `GateCleared`.
   - **Exit:** teleport the party back to where they entered, destroy the dungeon instance, free the slot.
   - **Leave early:** an `ExitPortal` at the entrance is usable **unless** the RedGate modifier is active, in which case show "Cannot escape until the boss is defeated".
   - **Wipe:** listen to `PartyWiped`. Eject the party, reset the Gate to `Open`, apply a stability penalty (−10%).
2. **`MonsterAIService`:** same movement loop as `HunterAIService` with `Team="Monster"`, plus a **threat table** (damage dealt raises threat; the Tank role adds +50% threat, ready for Stage 5 taunt). Uses `BasicAttack`.
3. **Modifiers applied on spawn:** a `ModifierService` helper multiplies monster stats and rewards from `ModifierDefs`.
4. **Boss (placeholder):** a larger rig with more HP. One telegraphed area attack: a red circle on the ground for 1.5s, then damage inside it. Stage 5 deepens this.
5. **Rewards:** Gold goes to an in-memory wallet for now (saved in Stage 6). A results screen shows time, kills, and rewards.
6. **One dungeon template to start:** 2 rooms + boss room, reused for all ranks with scaled monsters.

### Done when
- Full loop: find Gate → assess → enter → clear 2 rooms → kill boss → rewards screen → exit to overworld. The Gate is removed.
- The RedGate modifier blocks early exit. Berserk visibly changes monster damage and HP.
- A party wipe ejects the player and the Gate stays available.
- Two parties can be in different dungeons at the same time without interfering.

### Built notes (2026-09-17)
- **Built:** Config `MonsterDefs` (Goblin, Shadow Wolf [Dark], Orc Brute, boss Goblin Chief with Ground Slam) and `DungeonDefs` (template `Standard` + `Settings`). `GateDefs` ranks now set `MonsterPool`, `Boss`, `DungeonTemplate`, `MonsterStatMultiplier` (E 1 … Abyss 16; scales HP and ATK only). Server `Modules/ModifierRules`. Classes `Monster` (stats, AIBrain, threat table with Tank ×1.5, boss slam telegraph) and `DungeonInstance` (rooms, doors, boss, exits; signals only). Services `DungeonService` (owns instances, slots, rewards, wipe/collapse handling) and `WalletService` (in-memory Gold on leaderstats). Client `DungeonController` + `UIClasses/DungeonResults`. Model `ServerStorage.DungeonTemplates.Standard` (lobby + early exit, Room1/Room2 with Trigger, Door, SpawnPoints, BossRoom with BossSpawn + hidden FinalExit).
- **No separate MonsterAIService:** monsters reuse `AIBrain` (composition). The threat table lives on `Monster` and feeds `AIBrain` through `GetThreatTarget`.
- **GateService → DungeonService coupling:** `GateService.SetEntryHandler` (registered in `DungeonService.Init`) replaced the `EnterRequested` signal, so GateService never requires DungeonService.
- **Combat stand-in:** `PlaceholderCombatService.ApplyDamage` is the single damage path (DEF, threat record, flash, `Damaged`). The boss slam uses it too.
- **Dungeon copies** are placed at `SlotOrigin + slot × SlotSpacing` with `ModelStreamingMode = Persistent`. The server calls `RequestStreamAroundAsync` before teleporting in and out. Room triggers are checked by polling party positions against the Trigger region (no Touched).
- **Entrance placement:** the party lands 21 studs from the lobby's Leave Gate prompt. It was 7 studs, which made accidental early exits easy.
- **Verified in playtest:** enter gate → teleport + objective banner + compass hidden + panel closes. Walking into Room 1 spawns the wave. Clearing it opens the door and advances the objective. Leave Gate early → back at the gate, gate re-opened, re-entry works.
- **Verified by user (2026-09-17):** Room 2 → boss → Ground Slam → results panel + Gold → golden final exit works.
- **Check later:** Red Gate blocks early exit; Berserk changes monster HP/ATK; party wipe ejects the party and applies the 10% stability penalty; multiplayer Gate behavior after Stage 7's 3 players + 3 Hunters each (`3 + 3 + 3`) implementation.

---

## Stage 4 — Dungeon Break & Guild Base (§1 Loop 6–7, §2 Stability, §5)

**Goal:** Dungeon Breaks are a **shared server event the players can control**, not an unavoidable punishment. Players who are ready clear Gates before they break. If nobody stops a Gate, the server defends one central Guild Base together (with NPC guards), and losing costs time, never permanent progress.

**Status: ✅ signed off by the user (2026-09-17, v0.3.0).** First slice by Codex (v0.2.2), fixed and completed by Claude (v0.2.3). See Built notes at the end of this stage.

> **Team decisions (2026-09-17)** replace the original per-player-plot design and the harsh §5 collapse rules (storage loss, structure level loss). The Design Document §2/§5 should be updated to match.

### Rules (locked)
1. **Stability drain scales with players online.**
   - 3+ players: normal speed. 1–2 players: half speed. 0 players: paused (Roblox servers shut down when empty anyway).
   - **Break cap:** at most `MaxConcurrentBreaks` (1–2) active at once. While the cap is reached, other Gates cannot drop below `StabilityFloor` (5%).
2. **Breaks are timed events.**
   - A break lasts `BreakDuration` (~3 min) or `WaveCount` waves, whichever ends first. When it ends, any remaining monsters **retreat and despawn**.
   - **Guild guard NPCs** at the base fight automatically, so a small or weak server can still hold, just more slowly.
3. **One shared Guild Base** at the world center is the defense point.
   - Personal progress (gold, gear, levels, storage) is **never** at risk from a break.
   - (Personal plots in `World/BasePlots` can return later as housing/crafting, never as raid targets.)
4. **Gate ranks are capped by the strongest online party.**
   - A rank can only spawn if its `RecommendedPower ≤ RankCapMultiplier (≈1.5) × strongest online PartyPower`.
   - If the players who could handle a high-rank Gate leave, that Gate **freezes** its stability until a capable party is online again.
5. **Losing = temporary lockout, no permanent loss.**
   - Energy Core at 0 HP → base **Damaged**: base services (shop, crafting, blacksmith, quest board) are locked for `LockoutDuration`, or until players **repair together** (contribute gold/time).
   - After **any** break (won or lost) the Gate is removed and a `BreakCooldown` starts before another Gate may break.

### Config
- **`BreakDefs`:** per rank `{ WaveCount, MonstersPerWave, WaveInterval, BreakDuration }`, plus a win reward.
- **`GateDefs.Settings` additions:** `PlayerScaling = { [1] = 0.5, [2] = 0.5, default = 1 }`, `MaxConcurrentBreaks = 1`, `StabilityFloor = 5`, `RankCapMultiplier = 1.5`, `BreakCooldown` (e.g. 300s).
- **`BaseDefs`:** Energy Core HP, guard NPC count/stats, `LockoutDuration`, repair contribution needed, and structure list (Energy Core, Storage, Crafting Table, Blacksmith, Quest Board).

### Build
1. **`GateService` changes**
   - Drain multiplier from online player count. Pause at 0 players.
   - Break cap + stability floor while `MaxConcurrentBreaks` is reached.
   - Rank cap at spawn from `PowerCalc.PartyPower` of the strongest online party.
   - Freeze high-rank Gates when no capable party is online.
   - `BreakCooldown` after a break ends.
2. **`GuildBaseService`**
   - Builds the shared Guild Base at the world center from `ServerStorage.BaseStructures`: Energy Core (attribute `CoreHP`, HP billboard) + structure stubs with ProximityPrompts (filled in Stage 6).
   - Spawns **guard NPCs** (`Team = "Hunter"` rigs + `AIBrain` in Defensive mode around the Core; respawn after the break).
   - States: `Normal` → `UnderAttack` → `Normal` or `Damaged` (locked until `LockoutDuration` passes or repair is complete).
3. **`DungeonBreakService`**
   - On `GateStabilityZero`: Gate → `Broken`, shatter VFX, server-wide alert ("Dungeon Break! Rank X Gate").
   - Runs a timed break event: waves from `BreakDefs` spawn at the Gate and use `Monster` + `AIBrain` in a **raid** behavior (path to the Energy Core, fight Hunters/guards within aggro range, then resume toward the Core).
   - Ends on: all waves dead (**win**), `BreakDuration` elapsed (**held**: remaining monsters retreat), or Core destroyed (**lost**: monsters retreat, base → `Damaged`).
   - Always removes the Gate afterwards and starts `BreakCooldown`.
   - Players inside that Gate's dungeon are thrown out (already handled in Stage 3 via `GateStabilityZero`).
4. **UI:** break alert banner + countdown, wave counter, Core HP bar, `Damaged` lockout timer, and a repair-contribution prompt at the Core.

### Done when
- With 1–2 players, Gates drain at half speed. No more than `MaxConcurrentBreaks` break at once, and others hold at 5%.
- A new/weak party online never gets an A/S Gate spawned. A high-rank Gate freezes when its capable party leaves.
- A Gate at 0% starts a timed break: monsters march on the Guild Base, and guards fight them.
- All three endings work (win reward / held → retreat / lost → `Damaged` lockout that ends by timer or group repair). The Gate is removed and the cooldown applies.
- No player loses gold, items, or levels from any break outcome.
- Clearing a Gate before 0% prevents its break.

### Built notes (2026-09-17)
- **Config**
  - `BreakDefs`: `BreakDuration` 180s, core attack tuning, `RaidAggroRange` 30, retreat/corpse timings, and per-rank `Ranks[rank] = { WaveCount, MonstersPerWave, WaveInterval, WinGold }`.
  - `BaseDefs`: base at the world center (`Position` 0,0,0, 96×96 platform just under the spawn pad), `CoreOffset` (0, 5.5, -24), Core HP 2500, 2 guards (offsets + stats), `LockoutDuration` 120, `RepairNeeded` 250, `RepairPerHold` 25, `RepairGoldCost` 25.
  - `GateDefs.Settings`: `PlayerScaling`, `MaxConcurrentBreaks` 1, `StabilityFloor` 5, `RankCapMultiplier` 1.5, `BreakCooldown` 300.
- **`GateService`**
  - Drain = `StabilitySpeed × PlayerScaling` (0 with nobody online).
  - `CanBreak()` is false while a break is active, during `BreakCooldown`, or while the base is Damaged (`SetBreakBlocker`). Gates then hold at `StabilityFloor`. It is checked **per gate inside the Heartbeat loop**, so several Gates reaching 0% in the same frame only start one break (bug found in testing).
  - Rank cap: new Gates roll only ranks with `RecommendedPower ≤ 1.5 × strongest party`; existing Gates above the cap freeze. The lowest rank (E) never freezes. The starter party is power 113, so only E Gates spawn for now.
  - Held Gates write `SecondsLeft = -1`; `GateBillboard` shows "Holding", `GatePanel` explains that no break can start yet.
  - **Studio test hooks** (attributes on `ServerScriptService`, ignored outside Studio):
    - `DebugStabilitySpeed` (e.g. 300) forces a break in ~10s.
    - `DebugBreakMonsterMultiplier` (e.g. 3) multiplies monsters per wave.
    - `DebugBreakStatMultiplier` (e.g. 4) multiplies raider HP/ATK.
    - Removed from the place again at the user's request (2026-09-17); add them back only while testing.
- **`GuildBaseService`**
  - Builds `World/GuildBase` (Persistent streaming) with the Energy Core, its HP billboard and a Repair prompt.
  - Replicates state on `ReplicatedStorage.GuildBaseState` (Configuration attributes: `BaseState`, `CoreHP`, `CoreMaxHP`, `LockoutEndsAt`, `RepairProgress`, `RepairNeeded`, `Break*`, `LastBreak*`).
  - States Normal → UnderAttack → Normal / Damaged. Damaged ends when `LockoutDuration` passes **or** repair reaches `RepairNeeded`. Each 2s hold adds 25, doubled if the player pays 25 Gold (`WalletService.SpendGold`). Personal progress is never touched.
  - 2 guard NPCs (Tank stats, `Defensive` AI around their post, RigAnimator). After every break the living ones heal and fallen ones respawn.
- **`DungeonBreakService`**
  - On `GateStabilityZero`: waves from the rank's `BreakDefs` using the Gate's `MonsterPool` and stat multiplier, spawned in front of the portal. The next wave comes after `WaveInterval`, or 5s after a wave is cleared.
  - Raiders use `AIBrain` with `Home` = Core and the new `AggroRange` option: they fight Hunters/guards within 30 studs of themselves, otherwise walk to the Core. The service applies Core damage when they are within 5 studs of its surface.
  - Endings: **Won** (all waves dead, `WinGold` to every online player), **Held** (time out), **Lost** (Core 0, base Damaged). Survivors `Monster:Retreat` (walk toward the Gate, fade, despawn). The Gate is removed and `GateService.BreakEnded()` starts the cooldown.
- **Client `DungeonBreakController`:** alert text on break start and on each outcome (18px, 20% from the top); compact 210×40 panel on the right edge (32% down) with break countdown, Core HP bar and wave counter; Damaged panel with lockout timer and repair progress. It was shrunk and moved after the user said the first version was too big and blocked the view.
- **Test props moved off the base:** Death Box to (-75, 0, 30), training dummies to (-75, 4, -35).
- **Verified by playtest (with the debug speed and temporarily short timers, since restored):**
  - Break starts at 0% and the other Gates hold at 5%.
  - Raiders reach and damage the Core, and the guards fight them.
  - **Won:** +60 Gold, Gate removed, Core healed, guards healed.
  - **Lost:** Damaged, then the lockout timer restores the base.
  - After the lockout, the next break can start. **Held:** raiders retreat and despawn.
  - The HUD panel renders, and the boot is clean.
- **Still to verify:** repair via the prompt (needs a real player hold); a break with players inside the broken Gate's dungeon; the 3+ player normal-speed drain; the rank cap/freeze with a stronger party (Stage 6 power); how the HUD looks on mobile.
- **Not done / later:** shatter VFX on the broken Gate; the HUD shows only one break (fine while `MaxConcurrentBreaks` = 1); base structure stubs (Storage, Crafting, Blacksmith, Quest Board) and locking their services while Damaged arrive with Stage 6.

---

## Stage 5 — Combat Deep-Dive (§3 Hunter Roles)

**Goal:** replace placeholder `BasicAttack` with real action combat and a distinct kit per role.

> **Assigned to a junior developer (2026-09-17).** Claude skips this stage and continues with Stage 6.
> - Until Stage 5 lands, other stages keep using `PlaceholderCombatService` (`ApplyDamage`, `TryBasicAttack`, `GetEnemiesInRadius`, `Damaged` signal). New code should call combat only through those functions, so the swap to `CombatService`/`DamageService` stays a drop-in.
> - Stage 6 hooks that need combat (Player Class damage bonuses, equipment stats in damage) are written as stat modifiers/data first and wired into `DamageService` once Stage 5 is merged.

> **Deferred on purpose.** Port the combat prototype from the **latestTest** place (placeId 113217941021291) here.
> Quick notes for later: its 4-hit combo animations are already R15. `Hit` and `Block` animations are R6 and need R15 versions. The ragdoll is R6-only. `StateManager` doesn't sync to clients (replace with `StateUtil`). The server trusts the client's combo number. Hitstop, camera shake, knockback, directional block and destructible walls are worth keeping. A full review happens when this stage starts.

> **Target lock exists as of 2026-09-18 (v0.3.4)** and the new combat must keep feeding it:
> - `TargetService` (server) owns each player's locked target. Read it with `TargetService.GetTarget(player)`; **do not** put targeting back inside the combat service.
> - `PartyService.SetTargetProvider` supplies the lock as `preferredTarget` for a basic attack. `TryBasicAttack(attacker, preferredTarget?)` already takes it — keep that parameter in `CombatService`.
> - `HunterAIService.GetFocusTarget` prefers the lock and falls back to `Combat.GetCurrentTarget(userId)`. If `CombatService` drops `GetCurrentTarget`, that fallback needs replacing.
> - While locked the client sets `Humanoid.AutoRotate = false` and faces the target itself (`TargetController`). Combat that rotates the character must cooperate with this, not fight it.
> - `HumanoidUtil` disables `FallingDown` / `Ragdoll`; Stage 5 ragdolls must re-enable them deliberately, on whichever machine simulates the Humanoid.

### Built notes (2026-09-18/19, v0.3.10) — combat built, taken back from the junior dev

**Status: 🟨 built, awaiting user sign-off.** The user asked Claude to take Stage 5 over rather than keep waiting, then to carry it through to done.

**Built**
| File | What |
|---|---|
| `Config/CombatDefs` | Global tuning: combo reset/buffer, block + perfect block, hitstop, shake, DEF scale, backstab, damage numbers, colours |
| `Config/AttackDefs` | **Every attack as data.** 20 attacks: Fighter 4-hit + Whirlwind, Assassin 3-hit + Shadow Step, Tank 2-hit + Taunt, Mage 3-step + Meteor, Healer Mend + Sanctuary, monster basic/ranged/boss slam. Plus `RoleKits` and a `WeaponCombos` hook |
| `Modules/Hitbox` (shared) | Cone/radius queries, `IsBehind`, `IsInFront` |
| `Services/DamageService` | The one place damage and healing apply. Pipeline: raw → backstab → DEF → block/perfect block → floor. Owns `Damaged` / `Healed` / `Blocked`, stun, knockback, i-frames |
| `Services/CombatService` | Attack execution, server-owned combo state, windup/active/recovery, skills + cooldowns, blocking, taunt, projectiles, AoE. **Keeps the entire placeholder API** |
| `Controllers/CombatController` | Input (LMB or **E** attack, **F** skill, hold **RMB** block) + damage numbers and camera shake |
| Remotes | `Combat/UseSkill`, `Combat/SetBlocking`, `Combat/CombatFeedback` |

**Key decisions and gotchas**
- **`PlaceholderCombatService` is deleted.** `CombatService` exposes the same 9 functions and 2 signals, so all 13 consumers (AIBrain, Monster, PartyService, QuestService, StatsService, ProgressionService, ClassService, InventoryService, TargetService, GuildBaseService, DungeonInstance, HunterAIService) were repointed by a rename and needed no logic changes. `CombatService.Damaged` **is** `DamageService.Damaged` — the same Signal object — so existing `:Connect` calls keep firing.
- **Server owns the combo index.** The client only sends "I pressed attack". This fixes the prototype's flaw where the server trusted a client-supplied combo number.
- **Two pacing models on purpose.** Player-controlled rigs are paced by each attack's own Windup/Recovery so combos feel fast; AI rigs stay paced by their existing `AttackCooldown` attribute, so Stage 1–4 balance did not shift.
- **Progression stays out of combat.** `DamageService` never reads levels, gear or Player Class: `StatCalc` folds all of it into the rig's `ATK`/`DEF` attributes. That is what keeps Stage 5 and Stage 6 separable.
- **Hitboxes are tag + distance + arc, not physics queries.** R15 rigs are many loose parts, so `OverlapParams` returns the same rig repeatedly and misses limbs mid-animation.
- **Circular require avoided again:** `PartyService` requires combat, so combat cannot require it back. `CombatService.SetControlledRigProvider` is the hook (same pattern as `SetEntryHandler` and `SetTargetProvider`).
- **Taunt overrides every AI mode** in `AIBrain._selectTarget` — that is the entire point of pulling aggro.
- **Target lock is respected:** a locked/preferred target jumps the hit queue, and `TryBasicAttack(attacker, preferredTarget)` kept its signature.

**Verified in playtest**
- Combo advances in order with exact scaling: Fighter at ATK 50 dealt **35 + 40 + 47.5 = 122.5** (0.7 / 0.8 / 0.95 × 50).
- Whirlwind dealt exactly **65.0** (1.3 × 50); a second press inside the 8s cooldown was refused.
- AI companions damage through the same path (a dummy took 1215 from companions), so the legacy route works.
- Clean boot, zero errors, `DamageService` / `CombatService` / `CombatController` all start.

**Second pass — the rest of the stage**
| File | What |
|---|---|
| `Modules/Ragdoll` (server) | R15 ragdoll for **both** rig types |
| `Modules/CombatFX` (shared) | Positional sound with pitch jitter; a missing sound is a silent no-op, never an error |
| `Services/DestructibleService` | Props tagged `Destructible` take splash damage from any nearby hit and shatter into physics fragments |
| `Config/MonsterDefs` | `BossPhase` type + Goblin Chief phases (Furious at 60%, Enraged at 30%) |
| `Classes/Monster` | Reads phases each ability cycle: cooldown, damage, radius, windup and basic-attack speed all scale |
| `Classes/AIBrain` | Companions and monsters now use skills (rolls every 1.5s at 50%, gated by the real cooldown) |
| `Assets/Sounds` | Swing / Hit / Block inserted from free Creator Store audio |

**The ragdoll discovery worth remembering:** these rigs have **no `Motor6D` at all**. `CreateHumanoidModelFromDescription` returns a constraint rig — 15 `AnimationConstraint`s driving 14 `BallSocketConstraint`s. The first implementation did the classic Motor6D → BallSocket swap and was a silent no-op (it reported `0/0 joints`). Ragdolling a constraint rig just means disabling the `AnimationConstraint`s; the physical joints are already there. `Modules/Ragdoll` now handles both kinds, so a custom Motor6D model dropped into `ServerStorage.HunterRigs` still works.

**Verified in playtest (second pass)**
- **Ragdoll:** 15/15 → 0/15 constraints, head fell **4.20 studs**, then fully restored with `FallingDown` put back to disabled so swaps are unaffected.
- **Blocking:** `IsBlocking` true, WalkSpeed 16 → 7.2 (×0.45). Damage 93.5 unblocked → **23.4 blocked** (exactly ×0.25), **perfect block 0.0 with the attacker stunned**.
- **Boss phases:** 100% → base, 70% → base, 55% → **Furious**, 25% → **Enraged**; `AttackCooldown` 1.5 → 0.9.
- **Destructibles:** survived a partial hit, shattered when health ran out, spawned exactly its 8 configured fragments.
- **AI skills:** Han Seoa observed using both `mage_1` and `mage_skill`.
- Clean boot throughout; damage still exact with sound wiring in place.

**Measurement gotcha:** an early unblocked reading came out 69.5 instead of 93.5. That was the Healer topping the Hunter up during the 0.15s wait, not a pipeline bug — re-measured with no yield it was exactly 93.5. **Read health with no yield, or silence the Healer, when measuring damage.**

**Third pass — animations ported from latestTest (2026-09-19)**

The user opened `latestTest`, noting its animations were melee rather than sword. Melee is exactly what
the role chains needed: `fighter_1..4` **is** the unarmed combo. Sword-specific sets remain a separate
concern via `WeaponCombos`.

Found at `latestTest.ReplicatedStorage.CombatAnimations`. **Every id was tested on this place's rigs
before being trusted**, because the earlier note about them was wrong:

| Id | Measured | Used for |
|---|---|---|
| M1_1 `118869435727069` | 0.40s ✅ | `fighter_1`, `assassin_1`, `tank_1`, `monster_basic` |
| M1_2 `86999201325099` | 0.45s ✅ | `fighter_2`, `assassin_2` |
| M1_3 `79108635622879` | 0.50s ✅ | `fighter_3`, `assassin_3` |
| M1_4 `135239493164447` | 0.65s ✅ | `fighter_4`, `tank_2`, both melee skills |
| Hit `133445020667345` | 0.52s ✅ | hit-reaction flinch, played by `DamageService` |
| Block `133152621217382` | **never loads** ❌ | unused — blocking still has no animation |

- **Why they transfer cleanly:** `latestTest.Workspace.Rig` is the *same* R15 constraint rig this place
  generates (0 Motor6D, 15 AnimationConstraints). The R6 thing in the old notes is `Workspace.Dummy`.
- **The old note was half wrong.** It said "Hit and Block are R6". Measured: **Hit works fine**; only
  **Block** fails to load (length stays 0 after a 5s wait, even after `PreloadAsync`).
- **Mage and Healer deliberately have no animation** — these are unarmed punches and would look absurd
  on a cast.
- **`length` is 0 until the asset downloads.** A naive `AdjustSpeed(length / duration)` would divide to
  zero and freeze the track on frame one. `CombatFX.PlayAnimation` guards it, and `CombatService.Start`
  preloads every attack animation so the first swing of a session is animated.
- **Tracks are cached per Animator** in `CombatFX`; calling `LoadAnimation` on every swing leaks tracks
  and re-downloads the asset.

**Verified in playtest:** all four combo animations played and were retimed exactly — M1_2 (0.45s) at
**1.18x** to fit fighter_2's 0.38s, M1_4 (0.65s) at **0.88x** to fit fighter_4's 0.74s — while the combo
dealt 202.5, the exact full 4-hit total at ATK 50. The flinch played at **1.48x** to fit 0.35s.

**Bug fixes from the user's first real play session (2026-09-19, v0.3.10)**

- **Fighter permanently slow.** Holding block and swapping away stranded the old Hunter at
  `walkSpeed 7.2` **and** `IsBlocking = true` forever (so also permanently damage-reduced). Cause: three
  systems mutated `WalkSpeed` in place, block compounded on repeat calls, and the client fired the
  release against the **new** rig. **Speed is now derived, never accumulated** —
  `HumanoidUtil.RefreshWalkSpeed` recomputes `BaseWalkSpeed x stun x block` and is idempotent. It lives
  in `HumanoidUtil` so `Hunter` (a Class) can call it on a swap without requiring a Service.
- **Equipping a weapon disabled attacking.** A Roblox `Tool` captures `MouseButton1`, so the click
  reached `InputBegan` with `gameProcessed = true` and was discarded — zero attacks, zero damage, with
  the sword equipped. `CombatController` now also triggers on `Tool.Activated`.
- **Attack animations cut short.** Cached tracks plus a delayed `track:Stop()` meant an earlier swing
  could stop a later one. Removed; retimed tracks already end on time.
- **`EquippedWeaponId` was never set**, so `WeaponCombos` would have silently never triggered once
  sword animations existed. `Hunter.SetEquippedWeapon` now sets it.
- **Overlapping stuns were NOT broken** — predicted, tested, disproved, not "fixed". Hardened anyway
  with `stunEndsAt` so the longest stun wins.
- **`C` added as a keyboard block key.** Right mouse fights camera rotation and proved undiscoverable.

**Still open**
- **Sword combos.** `AttackDefs.WeaponCombos` is still empty: Codex's `fighter_sword01` uses the unarmed
  chain. Needs 4 sword-specific published R15 animations.
- **Block animation** — latestTest's is unusable. The guard pose is authored and waiting at
  `ServerStorage.AnimationSources.BlockGuard` (KeyframeSequence, looping, Action2, both arms up with the
  forearms crossed at the chest). **Publish it in the Animation Editor and paste the id into
  `AttackDefs.Reactions.Block`** — `CombatService` already holds and releases the track with the guard.

  **Why it is not simply code:** these R15 constraint rigs **revert any script write to
  `AnimationConstraint.Transform`** — verified with the `Animate` script disabled and zero tracks
  playing, the value read back as identity every time. A code-authored pose is impossible here; only a
  published animation works. An earlier attempt (`Modules/BlockPose`) was removed rather than shipped.
- **Audio licensing** is the user's call: the three sounds are free third-party Creator Store assets.

### Original scope (for reference)
- `CombatService` + data-driven `AttackDefs` (hitbox, damage scale, stun, hitstop, knockback), used by players, AI companions and monsters alike.
- `DamageService` pipeline: stats → block → Player Class (Stage 6) → Gate modifiers.
- Role kits: Fighter combo, Assassin dash/backstab, Tank block + taunt, Mage projectiles + AoE, Healer heals.
- AI companions and monsters use abilities, not just basic attacks.
- Boss attack patterns and phases. Destructible arena props.
- R15 ragdoll, hit reactions, sounds, VFX.

---

## Stage 6 — Progression, Player Class & Saving (§4, §5 Progression)

**Goal:** progress persists. Hunters level up and gear up, the player awakens a Player Class that shapes the whole team, and the Guild Base structures (Storage, Crafting Table, Blacksmith, Quest Board) do something.

> **Decisions (2026-09-17):**
> - **Saving uses ProfileService** (loleris), per the user. It is not ProfileStore.
> - Stage 5 combat belongs to the junior developer, so Stage 6 applies stats through rig attributes (`HP`, `ATK`, `DEF`, multipliers) that `PlaceholderCombatService` already reads. Stage 5's `DamageService` takes those over later.
> - The per-player base plot and collapse fields from the original schema are removed: the Guild Base is shared, and breaks never touch personal data (Stage 4).

Built in five sub-stages. Each one is playable and testable on its own, and gets its own version bump.

### 6A — Saving foundation (ProfileService)
**Setup (user):** insert **ProfileService** as `ServerScriptService.Modules.ProfileService`. Turn on *Game Settings → Security → Enable Studio Access to API Services* (the place must be published).

**Build**
1. **`Config/DataTemplate`** (profile template, reconciled on load):
   ```lua
   {
     Version = 1,
     Gold = 0, Diamonds = 0,
     Hunters = { -- owned Hunters only
       hunter_fighter_01 = { Level = 1, Exp = 0, Rank = "E", Equipment = {}, Signature = { Level = 0 } },
       hunter_mage_01    = { ... }, hunter_healer_01 = { ... },
     },
     Party = { "hunter_fighter_01", "hunter_mage_01", "hunter_healer_01" },
     Items = {},          -- [uid] = { ItemId, Level } (gear, unique so it can be upgraded)
     Materials = {},      -- [materialId] = qty (stacks: ores, cores, potions, traps)
     NextItemUid = 1,
     PlayerClass = { Id = nil, Rarity = nil }, UnlockedClasses = {},
     Quests = { Active = {}, Completed = {}, SecretStep = 0, RefreshAt = 0 },
     Stats = { GatesCleared = 0, BreaksDefended = 0, MonstersKilled = 0 },
   }
   ```
2. **`DataService`** (ProfileStore key `"PlayerData_v1"`, profile key `"Player_<UserId>"`):
   - Load on join with `LoadProfileAsync(key, "ForceLoad")`. Then `AddUserId`, `Reconcile`, `ListenToRelease` → kick. Kick if loading fails. Release on leave and on `game:BindToClose`.
   - `DataService.GetData(player)`, a `ProfileLoaded` signal, and `DataService.Update(player, path, fn)` which marks the data dirty and replicates it.
   - **No API access in Studio** → falls back to `ProfileStore.Mock`, with a warning, so playtests still work (data just isn't saved).
   - Other services never touch the DataStore directly. They go through `DataService`.
3. **Replication:** `Remotes/Data/Snapshot` (full client-safe copy on load) + `Remotes/Data/Changed` (path + value). Client `DataController` keeps a local copy and fires `Changed` signals for UI.
4. **`WalletService` migrates to profile data.** Gold and Diamonds are stored in the profile, and `leaderstats` just mirrors them. `AddGold`/`SpendGold` keep the same API. Add `AddDiamonds`/`SpendDiamonds`.
5. **Join order:** `PartyService` waits for `ProfileLoaded` before spawning the party (it reads `Party` from the profile).
6. Stats counters: Gate clears (`DungeonService`), break wins (`DungeonBreakService`), kills.

**Done when:** earn Gold, leave, rejoin → Gold is still there. Two Studio sessions with the same account don't duplicate data (session lock). No errors with API access off (Mock).

**6A Built notes (2026-09-17, v0.3.1)**
- **ProfileService:** the official asset 5331689994 (loleris), inserted by Claude after a code review. It's at `ServerScriptService.Modules.ProfileService`. Studio API access is on, so Studio playtests really save ("Roblox API services available - data will be saved").
- **`Config/DataTemplate`:** the schema above. Default Hunters are built from `HunterDefs.DefaultParty`.
- **`DataService`** (first in `SERVICE_ORDER`):
  - Store `PlayerData_v1`, key `Player_<UserId>`. `LoadProfileAsync(..., "ForceLoad")` → `AddUserId` → `Reconcile` → `ListenToRelease` (kick). Released on leave; ProfileService handles `BindToClose` itself.
  - API: `GetData`, `WaitForData` (polls until loaded or the player leaves), `Set`, `Update`, `Increment`, `IncrementStat`.
  - Signals `ProfileLoaded` / `DataChanged`. Player attribute `DataLoaded`.
  - Remotes `Data/Snapshot`, `Data/KeyChanged`, `Data/GetSnapshot`. **Gotcha:** a remote named `Changed` collides with `Instance.Changed` on the folder (`dataRemotes.Changed` returns the event), so it is `KeyChanged`.
- **`WalletService`:** Gold + Diamonds live in the profile. `leaderstats` mirrors both. `AddGold`/`SpendGold` are unchanged, and `AddDiamonds`/`SpendDiamonds`/`GetDiamonds` are new. Spending fails if data isn't loaded.
- **`PartyService`:** waits for data, then spawns the saved `Party` (only Hunters that exist in `HunterDefs` and are owned; falls back to `DefaultParty`).
- **Stats:**
  - `DungeonService` → `GatesCleared`.
  - `DungeonBreakService` → `BreaksDefended` for all players on Won/Held.
  - New **`StatsService`** → `MonstersKilled` from `PlaceholderCombatService.Damaged` (killing blow on rigs with `MonsterId`, credited via the attacker's `OwnerUserId`). It listens to combat without modifying it, since `PlaceholderCombatService` belongs to the Stage 5 junior dev.
- **Client `DataController`** (after `GuiController`): `Get(key)`, `IsLoaded()`, `Loaded` / `Changed` signals. It fetches `GetSnapshot` if the pushed snapshot arrived before it was listening.
- **Verified:** clean boot, profile loads with API access, the party spawns from save data, and the leaderstats Gold/Diamonds mirror works.
- **Verified by user:** Gold is kept after stopping and playing again. **Not yet tested:** two sessions of the same account at once (session lock).
- **MCP limit:** `execute_luau` can't `require` game modules (capability error), so it can't add Gold directly to test saving.

### 6B — Hunter leveling, Rank, Power & party editor
**Build**
1. **`Config/ProgressionDefs`:** `MaxLevel` 50, `ExpToNext(level)` curve, `StatGrowthPerLevel` (e.g. +6% base HP/ATK/DEF per level), Hunter Rank thresholds (E→D→C→B→A→S by level + Gates cleared), EXP sources (`KillExp` per monster in `MonsterDefs`, `ClearExp` per Gate rank in `GateDefs`).
2. **`StatCalc` (shared module):** `HunterStats(hunterData, def, classId?) → { HP, ATK, DEF, Speed, ... }` = `RoleDefs` base × level growth + gear (6C) × class modifiers (6D). One place for all stat math.
3. **EXP awards:** a monster kill gives EXP to the killer's party (all 3, the killer gets a bonus share). A Gate clear gives `ClearExp` to all 3. Level-ups refresh the live rig stats and show a toast.
4. **Hunter Rank-up:** checked after EXP / clears. Rank is stored on the Hunter and shown in the HUD.
5. **`PowerCalc.PartyPower`** reads real Hunter stats (`StatCalc`) instead of the flat role numbers. This naturally opens higher Gate ranks through the Stage 4 rank cap.
6. **Party editor UI** (open at the Guild Base / key `P`): pick 3 owned Hunters (no duplicates within your own party). It shows level, rank and power. Changes apply to the party once it's outside a dungeon and not in a break.
7. HUD portraits show `Lv` + Rank. EXP bar in the party editor.

**Done when:** killing monsters and clearing Gates levels Hunters. Stats and Party Power rise, and D/C Gates start spawning for that party. The party editor swaps members. Everything survives rejoin.

**6B Built notes (2026-09-17)**
- **`Config/ProgressionDefs`:**
  - MaxLevel 50; EXP to next = `floor(100 × level^1.5)`; +6% base HP/ATK/DEF per level.
  - `KillExp` per MonsterId × the monster's `RankMultiplier` attribute (new, set in `Monster.new`). The whole party gets it, and the Hunter that landed the blow gets +50%.
  - `ClearExp` per Gate rank.
  - Rank steps: E / D (Lv 8, 3 clears) / C (16, 10) / B (25, 25) / A (35, 45) / S (45, 75), using the player's lifetime `GatesCleared`.
- **`Modules/StatCalc` (shared):** `HunterStats(hunterId, data, extras)`, `ExpToNext`, `RankFor`, `NextRankStep`, `PowerOf`, `HunterPower`. `extras = { Flat, Multiplier }` is how gear and class plug in. `PowerCalc` now delegates to it.
- **`Hunter.new(..., data, extras)`** applies level stats and sets rig attributes `Level` and `HunterRank`. `Hunter:RefreshStats` re-applies stats live and keeps the HP ratio.
- **`Party.new(owner, ids, statsProvider)`** and `Party:RefreshStats()`. Slot state now includes `Level` and `Rank`, and the HUD portraits show `Role · Lv · Rank`.
- **`PartyService`:**
  - `RegisterExtrasProvider(fn(player, hunterId, data) → extras)`: flat bonuses add up, multipliers multiply.
  - `GetHunterExtras`, `GetHunterStats`, `GetPartyPower(party)` (real power used by Gate risk and the rank cap), `RefreshStats(player)`.
  - Remote `Party/SetParty` (3 unique owned Hunters; not inside a Gate or while wiped) rebuilds the party where the controlled Hunter stands.
- **`GateService`** uses `PartyService.GetPartyPower`, and refreshes the rank cap once a second instead of every frame.
- **`ProgressionService`:** `AwardExp(player, {hunterId = amount})` (one save update; level-up/rank-up toasts; `LeveledUp`/`RankedUp` signals), `RecheckRanks` (on clear and on profile load). New `DungeonService.PlayerCleared` signal `(player, gate, instance)`.
- **Client:**
  - `UIClasses/UIKit` (panel/button/label/bar/list builders, rarity colors; panels scale down to fit 90% of the screen).
  - `PartyEditorController`: key **P** or the menu button; slots + owned Hunter cards with level, rank, EXP bar and power.
- **Verified in playtest:**
  - Kill EXP accrues from a Dungeon Break; the party editor renders.
  - Debug clears + EXP took Kang from Lv 1 to Lv 3, and the live stats grew (ATK 24→27, HP 240→269).
  - Clear EXP levelled Seoa and Mina.

### 6C — Items: drops, Storage, equipment, Crafting Table, Blacksmith, Signature Weapons
**Build**
1. **`Config/ItemDefs`:**
   - **Gear:** `Slot` Weapon/Armor/Accessory, `Role` restriction (optional), `Rarity`, base stat bonuses, `MaxLevel`.
   - **Materials/consumables:** `Potion` (heal %), `Trap` (placeable slow/damage, simple version).
   - **Signature Weapons:** one per Hunter, `SkillUnlockRanks = { C = "...", A = "..." }`. The skill is only a flag/ID until Stage 5 implements it.
2. **Drops:** `DropTables` per Gate rank (boss + room clear), rolled per player on clear. Shown in the `DungeonResults` panel.
3. **Structures at the Guild Base:** Storage, Crafting Table, Blacksmith and Quest Board stubs with ProximityPrompts, built by `GuildBaseService` on the platform. **Prompts are disabled while the base is Damaged** (closes the Stage 4 lockout loop).
4. **`InventoryService`:** add/remove items and materials, equip/unequip (slot + role check), sell for Gold. **Storage UI** (grid + filters) and **Hunter equipment UI** (in the party editor).
5. **`CraftingService`:** `Config/RecipeDefs` (materials + Gold → item/consumable). Crafting Table UI.
6. **`BlacksmithService`:** upgrade gear +1…+MaxLevel (Gold + materials, cost curve, no failure/destroy for now). Forge Signature Weapons (needs Hunter Rank + materials); Signature Level caps at Hunter Rank.
7. Potions usable from the HUD (hotkey, cooldown). Traps can be placed in dungeons and during breaks.

**Done when:** clear a Gate → items appear in Storage. Equip → Hunter stats and Party Power change. Craft a Potion and use it. Upgrade a weapon. Forge a Signature Weapon at the required Rank. Structures lock while the base is Damaged. All of it persists.

**6C Built notes (2026-09-17)**
- **`Config/ItemDefs`:**
  - Gear (Weapon/Armor/Accessory, role limits, rarity, stats + per-upgrade stats, MaxLevel, SellGold).
  - Materials/consumables (`health_potion` heals the controlled Hunter 40%; `spike_trap` does ATK×1.5 damage per second in a 6-stud radius for 25s).
  - Signature Weapons per Hunter (stats per level, `SkillUnlocks` at Rank C/A, used by Stage 5). Signature level cap by Rank: E2 … S12.
  - Upgrade cost curve; drop tables per Gate rank.
- **`Config/RecipeDefs`:** potions, traps and 6 gear recipes.
- **StatCalc:** `GearStats`, `EquipmentBonus` (gear + Signature), `UpgradeCost`, `SignatureCost`, `SignatureMaxLevel`.
- **`BaseDefs.Structures`:** Storage, Crafting Table, Blacksmith, Quest Board, Awakening Altar and Recruit Desk, built on the Guild Base platform by `GuildBaseService` (tag `BaseStructure`, prompt attribute `StructureId`). **All prompts are disabled while the base is Damaged.** `GuildBaseService.CanUseStructure(player, id)` is the server check (not Damaged, controlled Hunter within 18 studs).
- **`InventoryService`:**
  - `AddGear` (uid `i<n>`), `AddMaterial`, `RemoveMaterials` (all or nothing), `Give`, `FindWearer`.
  - Remotes `Items/Equip` (role check; moves the item off any other wearer; not inside a Gate), `Unequip`, `Sell`, `UseConsumable` (the hotkey version also toasts).
  - Gear stats reach Hunters through `PartyService.RegisterExtrasProvider`. Drops are rolled on `DungeonService.PlayerCleared` and toasted as "Loot: …".
- **`CraftingService`** (`Items/Craft`) and **`BlacksmithService`** (`Items/Upgrade` never fails; `Items/ForgeSignature` is capped by Rank). Both check Gold and materials before spending either.
- **Client:**
  - `MenuController`: a button row above the party HUD (Party P, Bag B, Potion H, Trap T; more in 6D/6E) for touch screens, plus routing of structure prompts to panels.
  - `InventoryController`: Bag panel with Hunter selector, equipment slots (click to unequip), Gear/Items tabs.
  - `WorkshopController`: Crafting Table and Blacksmith panels.
- **TEMP `DebugService`** (Studio only, remove before release): set the player attribute `DebugCommand`, e.g. `give:iron_ore:20;gold:500;exp:hunter_fighter_01:400;clear:E`.
- **Verified in playtest through the real UI:**
  - Clear drops (Oak Staff) appeared in the Bag.
  - Equipping the Hunter Blade: Kang ATK 27→39.
  - Crafted a Spike Trap (−10 Gold).
  - Blacksmith +1: ATK →41, −60 Gold.
  - Forged the Oath Blade: ATK 45, HP 279, −150 Gold.
  - T placed a trap.
- **Not yet tested by hand:** selling, potion use, unequip, traps damaging monsters, Damaged lockout on structures.

### 6D — Player Class (Awakening)
**Build**
1. **`Config/ClassDefs`:** `Id`, `Rarity` (Common / Rare / Epic / Legendary / Secret), `Description`, `Modifiers` list, e.g.
   - `{ Stat = "ATK", Multiplier = 1.5, Roles = { "Assassin" } }`
   - `{ Stat = "Healing", Multiplier = 0.8 }`
   - `{ Stat = "DEF", Multiplier = 1.3 }`
   - `{ Stat = "Regen", Multiplier = 2 }`
   - `{ Stat = "ATK", Multiplier = 0.85, DamageType = "Physical" }`

   Start with ~8 classes: 3 Common, 2 Rare, 1 Epic, Monarch of Shadows + Archangel (Legendary), and 1 Secret.
2. **Awakening unlock:** after `Stats.GatesCleared ≥ AwakeningGateClears` (default 10). The first awakening is free and rolls a class by `RarityWeights` (Secret excluded). **Re-awaken** costs Diamonds. Unlocked classes are kept, and the player can switch between unlocked ones for Gold.
3. **Applying the class:** `StatCalc` applies the modifiers to every Hunter in the party. They're written to rig attributes (`ATK`, `DEF`, `MaxHealth`, `HealingMultiplier`, `RegenPerSecond`), which the placeholder combat and a small `RegenService` already use. Physical/magic damage type per role: Mage + Healer = magic, the rest physical.
4. **UI:** Awakening screen (roll animation, rarity color), Class panel (current class, buff/debuff text, switch).

**Done when:** after 10 clears the player awakens, and the class shows its rarity. Choosing Monarch of Shadows visibly raises Assassin damage and lowers healing. Archangel raises team DEF/regen and lowers physical ATK. Class persists.

**6D Built notes (2026-09-17)**
- **`Config/ClassDefs`:** 9 classes.
  - Common: Iron Vanguard, Swift Blade, Field Medic. Rare: Arcane Scholar, Bulwark. Epic: War Chief.
  - Legendary: Monarch of Shadows, Archangel. Secret: Sovereign of the Abyss.
  - Modifiers are `{ Stat, Multiplier, Roles?, DamageType? }` with stats HP/ATK/DEF/Speed/Healing/Regen.
  - Physical = Fighter/Tank/Assassin, Magic = Mage/Healer.
  - Rarity weights 60/28/10/2 (Secret only from quests). `AwakeningGateClears` 10, `ReawakenDiamonds` 50, `SwitchGold` 200. Base out-of-combat regen 0.4% max HP/s after 5s without being hit.
- **StatCalc:** `Stats` gains `HealingMultiplier` and `RegenMultiplier`. **Until Stage 5, healing bonuses also scale a Healer's ATK** (the placeholder combat heals for ATK × 2). Hunter rigs carry the `HealingMultiplier` / `RegenMultiplier` attributes for Stage 5 to read. `RefreshStats` also applies Speed.
- **`ClassService`:**
  - Registers class extras with PartyService.
  - `GrantClass(player, id)` (unlock + activate + refresh stats).
  - Remotes `Class/Awaken` (needs 10 clears and the Awakening Altar; first awakening free, later ones cost Diamonds) and `Class/SwitchClass` (unlocked class, Gold, altar).
  - Out-of-combat regen loop.
- **Client `ClassController`:** key **K**, the menu button, or the altar. Shows the current class card (buff/debuff), the Awaken / Re-awaken button, the unlocked class list with Switch, and a rarity-colored reveal.
- **Verified in playtest:**
  - Awakening through the altar UI rolled War Chief (Epic): Kang ATK 45→54, DEF 13→12.
  - Monarch of Shadows: Mina ATK 11→8 (−20% healing).
  - Archangel: DEF 13→17, Kang physical ATK 45→39, Seoa (magic) unchanged, regen multiplier 2.
  - The test granted Monarch and Archangel to the dev profile through `DebugService`.

### 6E — Quest Board, secret quest & Hunter recruitment
**Build**
1. **`Config/QuestDefs`:** templates like `KillMonsters { MonsterId?, Count }`, `ClearGates { MinRank, Count }`, `DefendBreak { Count }`, `ExploreRooms { Count }`, each with Gold/Diamond/EXP/material rewards.
2. **`QuestService`:**
   - 3 active board quests, refreshed every `QuestRefreshSeconds` (real time, stored as `RefreshAt`).
   - Progress hooks from DungeonService, DungeonBreakService and Monster deaths.
   - Claim rewards at the Quest Board.
   - Locked while the base is Damaged.
3. **Secret quest chain:** a hidden 3-step chain (e.g. clear a Red Gate → defend 3 breaks → clear a Gate without the controlled Hunter dying). It starts from a rare hint on the board and grants the **Secret** class.
4. **Recruitment (`RecruitService`):**
   - Spend Diamonds at a Guild Base NPC to roll a Hunter from `HunterDefs` by recruit rarity.
   - Add more Hunter definitions (e.g. 2–3 per role).
   - A duplicate becomes EXP for that Hunter.
   - Diamonds come from quests, break wins and rare Gate drops.
5. **UI:** Quest Board panel, quest tracker (small, right side under the break panel), and a recruitment screen.

**Done when:** accept → progress → claim quests. The board refreshes on its timer. The secret chain grants the Secret class. Recruiting a new Hunter adds it to the party editor. All of it persists.

**6E Built notes (2026-09-17)**
- **`HunterDefs`:**
  - Now 11 Hunters, each with a `Rarity`.
  - Starter Kang, Seoa and Mina, plus Taeho and Hyun (Common).
  - Park Jiwon, Lee Hana, Jung Minho (Rare); Seo Yuna, Kim Rian (Epic); Go Taesan (Legendary).
  - `RarityStatMultiplier` (1 / 1.1 / 1.2 / 1.35) applies in StatCalc.
  - New Hunters use generated rigs, and only the `_01` Hunters have Signature Weapons so far.
- **`Config/RecruitDefs`:** 30 Diamonds per roll, weights 55/32/11/2, a duplicate gives +400 EXP to that Hunter.
- **`Config/QuestDefs`:**
  - 7 board quests (KillMonsters / ClearGates / DefendBreak) with Gold/Diamonds/EXP/material rewards.
  - `BoardSize` 3, `RefreshSeconds` 1800.
  - **Secret chain:** the hint can appear on a refresh (30%) once the player has 20+ lifetime clears. Steps: clear a Red Gate → defend 3 breaks → clear 3 Rank C+ Gates. It grants `abyss_sovereign`.
- **Diamond sources:** quest rewards, Dungeon Break wins (`BreakDefs` `WinDiamonds` per rank), rare Gate drops (`diamonds` entries in `ItemDefs.DropTables`, handled by `InventoryService.Give`).
- **`QuestService`:**
  - Board quests are active immediately (no accept step); rewards are claimed at the Quest Board (`Quest/Claim`).
  - Progress comes from killing blows (`Combat.Damaged`), `DungeonService.PlayerCleared`, and the new `DungeonBreakService.BreakEnded (gate, outcome)` (Won/Held count, credited to all online players).
  - Refresh on profile load and every 30s check. `Quest/AcceptSecret` starts the chain; finishing it calls `ClassService.GrantClass`.
- **`DataTemplate.Quests`** adds `SecretProgress`, `SecretOffered`.
- **`RecruitService`:** `Recruit/Recruit` (Recruit Desk, Diamonds, rarity roll with fallback to lower tiers, refund if nothing can roll); `GrantHunter` (new Hunter data or duplicate EXP).
- **Client:**
  - `QuestController`: key **J**, the menu button, or the Quest Board. Shows the board with progress bars, Claim, refresh timer and secret hint/progress, plus a small quest tracker on the right edge under the break panel.
  - `RecruitController`: opened from the Recruit Desk. Shows odds and owned markers, a Recruit button, and a rarity reveal.
- **TEMP `DebugService`** gained `class:<id>`, `stat:<name>:<n>`, `quests:refresh`, `quests:secret`, `break:<Won|Held>`.
- **Verified in playtest:**
  - Board refresh, and the tracker showing 3 quests.
  - Debug clears completed Gate Sweep 4/4.
  - The user claimed it at the board ("Claimed: 10 Diamonds, 250 EXP").
  - The secret hint card shows with Accept. HUD portraits show Lv 4. Clean console.
- **Still to test by hand:** Accept the secret quest and watch its steps advance; recruit a Hunter (the dev profile has ~110 Diamonds) and add them in the party editor; the board refresh timer rolling over.

### Stage 6 defaults (change any time)
| Question | Default |
|---|---|
| Diamond sources | Quest rewards, Dungeon Break wins (small), rare Gate drops. Robux purchase later (Stage 8). |
| Starting Hunters | The 3 in `DefaultParty` are owned. Everything else is recruited. |
| Awakening unlock | 10 Gate clears. First roll free, re-roll costs Diamonds. |
| Upgrade failure | No failure or item loss for now. |
| Data reset during development | Bump the ProfileStore key (`PlayerData_v2`) instead of writing migrations until release. |

---

## Stage 7 — Multiplayer Party (§3 Multiplayer Party Rules)

### Build (outline)
- Party invite / accept / leave / kick UI. A Gate accepts up to **3 players**, each with their complete 3-Hunter party: maximum **9 active Hunters** (`3 + 3 + 3`).
- Every player controls one Hunter and keeps their two own AI Companions, including personal swapping and AI mode controls.
- A player who joins an ongoing dungeon brings their full party of 3. A player who leaves removes only their party of 3; never rebuild or replace another player's party.
- Allow the same Hunter definition for different players, since each player owns an independent Hunter instance.
- Verify server performance, AI targeting, rewards, wipe handling, and network ownership with all 9 Hunters active.
- One shared dungeon instance per party. Rewards go to each member. A wipe means every member is down.
- Gate Risk Assessment uses combined party power.

### Done when
- 2–3 players (Studio multi-client test) form a party, enter a Gate together with up to 9 active Hunters, clear it, and each receives rewards.
- A 4th player is refused entry. Players with the same Hunter definitions can enter together.
- A player joining mid-dungeon adds only their 3 Hunters; a player leaving removes only their 3. The other players' parties are never swapped, moved, or replaced.

---

## Stage 8 — Economy & Pawn System (§6, Phase 3+)

### Build (outline)
1. **Currencies:** Gold (sell monster loot, general use), Diamond (premium: Hunter rolls, cosmetics), Gate Tokens (high-rank Gate clears → guild shop legendary items).
2. **Guild Shop** priced in Gate Tokens.
3. **Safe Trading:** two-player trade window, both confirm, atomic swap of unbound items/materials, guild tax deducted.
4. **Pawn System:**
   - Contract record in a DataStore: `{ ContractId, PawnerUserId, HolderUserId, ItemData, TokenAmount, InterestPercent, CreatedAt, ExpiresAt (e.g. +7 days), State }`.
   - **Pawn Lock:** the holder stores the item but it has `Locked = true` and can't be used, sold, traded or upgraded.
   - **Redemption:** before `ExpiresAt` the pawner pays Tokens + interest and gets the item back.
   - **Expiration:** after `ExpiresAt` the item unlocks and belongs to the holder permanently.
   - Offline players: deliver changes through ProfileStore messages and process them on next login. Every step must be safe against duplication (the item can never exist unlocked in both profiles).

### Done when
- A trade completes with tax, and neither side can dupe by leaving mid-trade.
- A pawn contract can be redeemed before expiry and auto-transfers after expiry, including when either player is offline.

---

## How to use this plan in sessions
- `/start-session` reads this file. Pick up the first stage not marked ✅.
- Update the **Status** table at the top when a stage starts or finishes.
- Break the current stage's **Build** list into tasks in `Session-AI_logs/AI-Sync/sync_task.md`.
- If a stage reveals a design change, update the design doc or this plan in the same session and note it in the session log.
