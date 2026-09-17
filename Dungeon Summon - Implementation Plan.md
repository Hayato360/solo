# Dungeon Summon — Implementation Plan (Roblox)

Staged build plan for turning `Dungeon Summon - Core System Design Document.md` into the **Solo** Roblox place (placeId 78995314774794).
Each stage lists its goal, what to build, and how to know it's done. Build stages in order. Every stage ends with a playable test in Studio.

**Status legend:** ⬜ Not started · 🟨 In progress · ✅ Done

| Stage | Name                               | Design Doc Section              | Status |
| ----- | ---------------------------------- | ------------------------------- | ------ |
| 0     | Project Foundation                 | —                               | ✅      |
| 1     | Hunters & Solo Raid Party          | §3 The Raid Party               | ✅      |
| 2     | Gate System (overworld)            | §2 Gate System                  | ✅      |
| 3     | Gate Exploration (dungeon run)     | §1 Loop 5, §2 Modifiers         | 🟨      |
| 4     | Dungeon Break & Hunter Base        | §2 Stability, §5 Hunter Base    | ⬜      |
| 5     | Combat Deep-Dive                   | §3 Hunter Roles                 | ⬜      |
| 6     | Progression, Player Class & Saving | §4 Player Class, §5 Progression | ⬜      |
| 7     | Multiplayer Party                  | §3 Multiplayer Party Rules      | ⬜      |
| 8     | Economy & Pawn System              | §6 Economy (Phase 3+)           | ⬜      |

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
| Multiplayer: does each player bring AI companions? | **No.** In a multiplayer party each player controls 1 Hunter and AI companions are off. Solo play keeps 2 AI companions. |
| Hunter Base: per player or shared? | **Per-player base plot** on the server. Dungeon Break waves march to the base plot nearest the broken Gate. |
| Stability timing | **Real-time minutes while the server runs** (per-rank value in `GateDefs`), with a global `STABILITY_SPEED` multiplier for testing. |
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
- **`RoleDefs`** — base stats per role (§3 Hunter Roles table):

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
- **Still to verify:** Room 2 → boss spawn → slam telegraph → results panel + Gold → final exit; Red Gate blocks early exit; Berserk stats; party wipe inside → eject + gate −10% stability; two parties at once.

---

## Stage 4 — Dungeon Break & Hunter Base (§1 Loop 6–7, §2 Stability, §5)

**Goal:** ignored Gates break open and monsters raid the player's base. The base has structures and suffers real consequences if the Energy Core falls.

### Config
- **`BaseDefs`:** per structure `{ MaxLevel, UpgradeCost[level], Function }` for Energy Core, Storage, Crafting Table, Blacksmith, Quest Board. Energy Core HP by level.
- **`BreakDefs`:** per rank `{ WaveCount, MonstersPerWave, WaveInterval }`.
- **Collapse penalties:** `STORAGE_LOSS_PERCENT` (e.g. 30%), `STRUCTURE_LEVEL_LOSS` (1), `REPAIR_COST` and `REPAIR_TIME`.

### Build
1. **`BaseService`**
   - Assign each joining player a free `World/BasePlots` plot and build their structures from `ServerStorage.BaseStructures` at their saved levels (in-memory until Stage 6).
   - Energy Core: HP bar billboard, attribute `CoreHP`.
   - Structure interactions (ProximityPrompt → UI stub for now): Storage (view items), Crafting Table, Blacksmith, Quest Board. Stage 6 fills these in.
2. **`DungeonBreakService`**
   - On `GateStabilityZero`: set Gate to `Broken`, play the shatter VFX, send a server-wide alert ("⚠️ Dungeon Break! Rank X Gate at …").
   - Spawn waves from `BreakDefs` at the Gate position, targeting the **nearest base plot**.
   - Break monsters use `MonsterAIService` in "raid" mode: path to the target Energy Core, attack Hunters and NPCs that come within aggro range, and resume toward the Core afterward.
   - Overworld NPCs (a few wandering civilians) can be killed by break monsters.
3. **Base Defense result**
   - **All waves killed, Core alive:** defense success, bonus reward, Gate removed.
   - **Core HP reaches 0:** **Base Collapse**:
     - Remove `STORAGE_LOSS_PERCENT` of Storage contents.
     - Every structure loses `STRUCTURE_LEVEL_LOSS` levels (minimum 1).
     - Base enters `Collapsed` state: structure interactions are locked until the player pays `REPAIR_COST` and `REPAIR_TIME` passes.
     - Remaining break monsters despawn.
4. **UI:** an alert banner, a wave counter, a Core HP bar while under attack, and a repair panel while collapsed.

### Done when
- A Gate left to 0% stability raises a Dungeon Break and monsters walk to the nearest base.
- Defending successfully gives a reward. Losing the Core applies all 3 collapse penalties and requires repair.
- Entering and clearing a Gate before 0% prevents the Break.

---

## Stage 5 — Combat Deep-Dive (§3 Hunter Roles)

**Goal:** replace placeholder `BasicAttack` with real action combat and a distinct kit per role.

> **Deferred on purpose.** Port the combat prototype from the **latestTest** place (placeId 113217941021291) here.
> Quick notes for later: its 4-hit combo animations are already R15. `Hit` and `Block` animations are R6 and need R15 versions. The ragdoll is R6-only. `StateManager` doesn't sync to clients (replace with `StateUtil`). The server trusts the client's combo number. Hitstop, camera shake, knockback, directional block and destructible walls are worth keeping. A full review happens when this stage starts.

### Scope (detail when the stage starts)
- `CombatService` + data-driven `AttackDefs` (hitbox, damage scale, stun, hitstop, knockback), used by players, AI companions and monsters alike.
- `DamageService` pipeline: stats → block → Player Class (Stage 6) → Gate modifiers.
- Role kits: Fighter combo, Assassin dash/backstab, Tank block + taunt, Mage projectiles + AoE, Healer heals.
- AI companions and monsters use abilities, not just basic attacks.
- Boss attack patterns and phases. Destructible arena props.
- R15 ragdoll, hit reactions, sounds, VFX.

---

## Stage 6 — Progression, Player Class & Saving (§4, §5 Progression)

**Goal:** progress persists. Hunters grow stronger, and the player awakens a Player Class that shapes the whole team.

### Build (outline)
1. **`DataService`** on ProfileStore. Schema:
   ```lua
   {
     Version = 1,
     Gold = 0, Diamond = 0, GateTokens = 0,
     Hunters = { [hunterId] = { Level = 1, Exp = 0, Rank = "E",
                 Equipment = { Weapon = nil, Armor = nil, Accessory = nil },
                 SignatureLevel = 0 } },
     Party = { "hunter_fighter_01", "hunter_mage_01", "hunter_healer_01" },
     PlayerClass = { Id = nil, Rarity = nil }, UnlockedClasses = {},
     Base = { Plot = nil, Collapsed = false, RepairEndsAt = 0,
              Levels = { EnergyCore = 1, Storage = 1, Crafting = 1, Blacksmith = 1, QuestBoard = 1 } },
     Storage = { [itemId] = qty },
     Quests = {}, Stats = { GatesCleared = 0, BreaksDefended = 0 },
   }
   ```
2. **Leveling:** EXP from kills and Gate clears. Level raises base stats (`RoleDefs` × growth curve).
3. **Equipment:** Weapon / Armor / Accessory slots with stat bonuses. Items come from dungeon drops and the Crafting Table (Potions, Traps).
4. **Blacksmith:** upgrade equipment. **Signature Weapons** scale with Hunter Rank and unlock a special skill at set ranks.
5. **Hunter Rank:** E → S, earned through level + clears. Gates `RecommendedPower` and Signature unlocks depend on it.
6. **Player Class (Awakening)** — a team-wide buff/debuff applied in `DamageService` / stat calc:

| Class | Rarity | Buff | Debuff |
|---|---|---|---|
| Monarch of Shadows | Legendary | Assassin damage +50% | Healing −20% |
| Archangel | Legendary | Team DEF +30%, HP regen +100% | Team physical ATK −15% |

   Rarity tiers: Common, Rare, Epic, Legendary, **Secret** (from secret quests only). More classes get added to `ClassDefs`.
7. **Quest Board:** kill/explore quests, one secret quest chain that grants a Secret class.
8. **Hunter recruitment:** spend Diamonds to roll new Hunters (party members are other Hunters, per §1). Party editor UI to choose the 3 party slots.
9. `PowerCalc` includes level, gear, and class.

### Done when
- Leave and rejoin: currencies, Hunters, gear, class, base levels and collapse state all persist.
- Choosing a class visibly changes team stats and damage.

---

## Stage 7 — Multiplayer Party (§3 Multiplayer Party Rules)

### Build (outline)
- Party invite / accept / leave / kick UI. Max **3–4 players**.
- **Strict rule:** no two players can bring the same Hunter character (checked at party formation and at Gate entry).
- Each player controls 1 Hunter. AI companions are off in multiplayer (see assumption).
- One shared dungeon instance per party. Rewards go to each member. A wipe means every member is down.
- Gate Risk Assessment uses combined party power.

### Done when
- 2–4 players (Studio multi-client test) form a party, enter a Gate together, clear it, and each receives rewards. Duplicate Hunters are rejected.

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
