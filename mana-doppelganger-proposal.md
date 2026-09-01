# Arcane Doppelganger — placement proposal

**Status: SUPERSEDED (2026-08-31). Never implemented. Kept for its research.**

> Mana's ability was redesigned: the armor now **slowly heals the hero**. The
> clone mechanic below was never built and is not planned.
>
> This file is kept rather than deleted because §0 is findings about the
> codebase, not about the clone, and all four still hold: there is no movement
> history anywhere; `[F]` is claimed by Air and Shadow armor with no room for a
> fourth touch button; pressure plates are shrine-scoped and held by pushable
> blocks rather than by actors; and fog of war has been removed from the game.
> Anything that later wants a replaying ghost, an actor-held switch, or a third
> active ability should start here.
>
> Everything from §1 onward describes the abandoned design. Read it as a record
> of what was considered, not as a plan.

Mana / Arcane is tier 11. The armor summons a short-lived clone that replays the
player's recent path a beat behind, and can hold glyphs, block hazards or
projectiles, and be stood on.

---

## 0. What I found before proposing anything

Four things in the current codebase change the shape of this, and two of them are
problems rather than details.

**There is no movement history.** Nothing anywhere records where the hero has
been. `player.x/y` are integer tile coordinates overwritten in place, and
`player.renderX/renderY` are only a lerp toward them for drawing. A replaying
clone needs a recording buffer that does not exist yet, and that buffer is the
foundational piece of this feature — everything else hangs off it.

**The `[F]` slot is already contested.** `armorActiveAbility()` (abilities.js)
has worn Air armor take over `[F]` for Updraft Glide and worn Shadow armor for
Shadow Step, temporarily overriding whatever shrine ability the player chose.
Mana armor summoning a clone would be the **third** armor claiming one button.
Wearing exactly one armor at a time means they never collide at runtime — but
the touch pad has one ability button and `elemental-armor-implementation-notes.md`
already records the constraint that no new armor action should add a permanent
fourth. **This needs a decision before implementation** (see §5).

**"Hold a pressure glyph" has no hook to reuse.** Pressure plates exist, but
they are shrine-only (`T.SHRINE_PLATE`) and they are held down by *pushable
blocks*, not by actors: the check is `blockOn(s,x,y)` → `shrineBlockAt(s,x,y)`,
which searches `s.blocks`. Nothing in the game asks "is an actor standing here"
for the purpose of holding something open. So the glyph capability is a **new
concept**, not an integration — and since the region's puzzle design is out of
scope, this proposal defines the clone's *occupancy query* and stops there.

**Fog of war is gone.** You asked me to flag clone-vs-fog-of-war. Fog of war was
removed from the game — it is why the Luminous armor's reveal half currently has
nothing to reveal. There is no interaction to flag; the question is moot until a
replacement visibility system exists.

---

## 1. Where it fits

| Concern | Home | Why there |
|---|---|---|
| Clone state, summon, despawn, per-frame step | **`abilities.js`** | It already owns every armor's runtime behaviour — the `[F]` actives, the Lightning timer, the Luminous pulse, cursed ground, heat, quicksand. A clone is one more clock-driven armor effect and belongs beside them. |
| Position recording | **`player.js`** | The buffer has to be written wherever `player.x/y` change, which is `stepPlayerMovement`. Recording from outside would miss teleports, transitions and respawns — the same failure mode `player.groundZ` was moved into the movement step to avoid. |
| Solidity / standability | **`player.js` `blocked()` + `main.js` both pathfinders** | Non-negotiable: see §4. |
| Drawing | **`render.js` depth merge** | The clone is an actor and must sort by row like every other one. Add a `DEPTH_CLONE` between `DEPTH_VILLAGER` and `DEPTH_PLAYER`. |
| Summon input | **`abilities.js` `useEquippedAbility()`** | Existing dispatch; no new key. |
| Save defaults | **`save.js`** | Transient, defaults to "no clone" — the pattern `heat` and `sink` already follow. |

No new files, no new `<script>` tag. Everything extends an existing owner, per
`AGENTS.md`.

## 2. Data structure

### The recording buffer

A fixed-length ring on the player, written once per completed step:

```
player.pathTrail = {
  buf:  [ {x, y, dir, t}, … ],   // ring, PATH_TRAIL_LEN entries
  head: 0,                        // next write index
  len:  0                         // entries valid so far
}
```

Written at the end of `stepPlayerMovement`, only on a step that actually changed
tile. Cleared on map transition, respawn and load — a trail across a map boundary
would replay the hero walking through somewhere they are not.

**Record `t` (a timestamp), not just position.** The clone follows a *fixed time
delay*, and the hero's step interval is not constant: it varies with terrain
(`terrainMs`), with the touch stick's analog pace (`joySpeedScale`), and now with
volcanic overheat (`heatMoveMultiplier`). A clone that replays "N entries behind"
would drift closer and further from the hero as the ground changed. Replaying
against wall-clock time is the only version that holds a steady beat.

`PATH_TRAIL_LEN` needs to cover the worst case: the longest delay times the
fastest step rate. At `MOVE_MS` 153 and a 1s delay, ~8 entries; 32 is ample and
costs nothing.

### The clone

```
manaClone = {
  x, y, renderX, renderY, dir,   // same shape as every other actor
  bornAt,                         // for lifespan and for the spawn cue
  delayMs,                        // fixed beat behind the hero
  cursor                          // read position into the trail
}
```

Module-level in `abilities.js`, not on `player` — it is transient and must never
be serialised. One at a time, as specified.

### How it reads the history

Each frame, the clone looks for the most recent trail entry whose `t` is at or
before `now - delayMs`, and takes that tile as its target; `renderX/renderY` lerp
toward it exactly as villagers and the hero already do, so it moves with the same
weight as everything else on screen.

If the trail runs dry — the hero has stood still longer than the delay — the
clone arrives at the hero's last recorded tile and stops there. That is a
*feature*: it means "stand still for a moment, then summon" is how you place a
clone deliberately on a spot, which is exactly what holding a glyph needs.

Despawn on whichever comes first: lifespan elapsed, trail exhausted and lifespan
past a minimum, map change, or the armor coming off.

## 3. Placeholder cues

**Visual.** Draw the clone as the hero, re-tinted: composite the existing hero
sprite with a Mana-violet wash (`SWORD_ELEMENTS.mana.color`, `#cc44ff`) at ~55%
alpha, plus a slow alpha pulse and a fade-in over the first ~150ms and a fade-out
over the last ~250ms of its life. Summon and despawn each also `spawnParticle` a
violet burst at the tile, which is the game's existing idiom for "something
happened here" and needs no new asset.

**Audio.** There is no sound helper in this codebase — the only sound anywhere is
a bare `new Audio('wilhelm-scream.wav')` in `player.js`. Rather than add a
binary asset for a placeholder, synthesise both cues with a short WebAudio
oscillator blip (rising for summon, falling for despawn), created on demand.
That keeps the no-build-step / no-network / works-over-`file://` constraints
intact and is trivially replaced by a real asset later. It also needs a lazily
created `AudioContext`, since browsers refuse one before a user gesture.

## 4. The one thing that must not be got wrong

**Solidity has to be taught to three places, not one.**

`blocked()` in `stepPlayerMovement` gates keyboard movement; `findPathToGoals`
and `findTappedInteractable` in `main.js` gate tap-to-travel. This codebase has
already been bitten by exactly this — `stepUpBlocked` carries a comment about a
pathfinder that "disagrees with the movement it is planning for" walking the hero
into a wall and giving up, and the Water/Earth armor traversal was refactored
into the shared `elementalArmorTraversesTile` for the same reason.

A clone that blocks or that can be stood on changes what is passable. All three
must ask the same question. Note that `elementalArmorTraversesTile` is keyed on
*tile type* and the clone is keyed on *position*, so this is a sibling check
beside it, not an extension of it.

**The stepping-stone case is the sharp one.** "Stand on the clone" means a tile
that is normally solid becomes standable for as long as the clone is there — and
the clone despawns on a timer. A hero standing on a hazard tile when their
support vanishes needs a defined outcome, and this is the same class of problem
the Water-armor soft-lock turned out to be (removing the armor mid-pond left 0 of
8 legal moves). Whatever the answer is — fall, damage, eject — it should be
decided before the stepping-stone capability is built, not after.

## 5. Flagged for decision, not solved here

1. **The `[F]` collision.** Third armor on one button, and the touch pad has room
   for no more. Options: the clone reuses `[F]` like Air and Shadow (simplest,
   consistent); or the ability button becomes context-sensitive; or Mana gets a
   held-input variant. Needs your call.
2. **Clone vs enemies.** Does it block them, absorb a hit, draw aggro, or is it
   scenery they walk through? Aggro is the most interesting and the most work:
   enemy targeting reads `player.x/y` directly throughout `projectiles.js`.
3. **Clone vs the stepping-stone despawn**, per §4.
4. **Clone vs projectiles.** "Blocks projectiles" means the projectile collision
   loop needs a new collidable, which today only knows about enemies and the
   player.
5. **Clone vs save/load.** Proposal: it simply does not persist — despawn on save
   or load. Confirm that is acceptable rather than expecting it to survive.
6. **Clone vs the glyph concept**, which does not exist yet (§0). The clone can
   expose "am I standing at (x,y)"; what consumes that is region-puzzle design
   and is out of scope here.
7. **Clone vs fog of war** — moot, fog of war was removed from the game.

## 6. Suggested build order

1. The trail buffer alone, with a debug overlay. It is the foundation and it is
   independently verifiable.
2. Summon / despawn / replay / lifespan, drawn and cued, with **no** solidity.
   At this point the clone is a ghost that follows you, and that is already
   testable and already looks like the feature.
3. Solidity, taught to all three gates at once, with the despawn rule from §4
   decided first.
4. The occupancy query the glyph concept will later consume.
5. Enemy and projectile interactions, once §5.2 and §5.4 are answered.
