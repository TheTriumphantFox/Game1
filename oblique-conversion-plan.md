# Converting The RPG Game to an Oblique (2.5D) Renderer

## Current state

Update this block at the end of every session. It is the first thing the next
session reads, and it is the only place that records where the work actually
stopped. Keep it to three lines: the phase in progress, what landed last, and
anything left half-finished.

```
Phase in progress:  PHASE 6 IS COMPLETE, 6a/6b/6c all done, and so is every
                    phase of the conversion. The ONLY outstanding item in the
                    whole project is the USER's phone check at TILE_PX 24, which
                    has been on hold since Phase 4.
Last completed:     6c. T.TREE extrudes (+0.15ms at TILE_PX 48, +0.75ms at 24,
                    2.35ms total against a 16.7ms budget) and the USER confirmed
                    the forest wall reads correct. Doorways and the castle window
                    now close their notches, taking their height from the wall
                    they are set into so they are right in both the intact
                    village and the ruin: 17 found, all 17 at 1.60, 0 orphaned.
Half-finished:      Nothing. Every USER judgement is answered. ON HOLD, the only
                    open item: the phone check at TILE_PX 24. ANSWERED, do not
                    re-ask: losing "player always on top" is PREFERRED, the Beat
                    3 49px sliver is accepted, the ramp shadow no longer pulsing
                    is accepted, the nine hover heights are approved, the
                    dragon's own hover is deferred to "the appropriate time",
                    and thrown bombs are now stopped by terrain at or above 1.60
                    (built and verified).
```

Read `oblique-conversion-todo.md` next. Its "Verification rig" section describes
the headless-Edge CDP harness and the save fixture that every later phase should
verify against, and its Phase 2 block carries five specific notes handed forward
from Phase 1.

## How to run this across sessions

1. Read this whole file before touching code. Its file:line references were
   verified against the real source. Do not re-explore ground it covers.
2. Read `oblique-conversion-todo.md` in the repo root for the checkbox state. If
   it does not exist, create it from the Session checklist section below.
3. Work the lowest phase with unchecked boxes. Do not skip ahead, and do not
   start two phases at once. The order encodes real dependencies.
4. Verify using that phase's "Done when" line, which names who checks what.
5. Update the Current state block above and the todo file before the session
   ends, even if the phase is incomplete.
6. Stop at every phase boundary and report before starting the next one.

## Context

The game is a flat top-down RPG. Every actor draws into a square tile box, and
the entity pass at `render.js:3046-3055` runs in a fixed order with no depth
sorting at all:

```
drops → projectiles → enemies (spawn order) → villagers (spawn order) → player
```

The player is unconditionally on top of everything. Depth today exists only as
three hardcoded whole-pass exceptions: forest roofs with a "is the player inside
this house" test (`render.js:2522`), colossal-tree canopies (unconditional), and
big landmarks (unconditional). There is one row-sort in the whole renderer, and
it sorts landmarks against each other only (`render.js:1985`).

The goal is a game that reads as 2.5D: objects have height, actors pass in front
of and behind each other and behind scenery, and height becomes a real gameplay
axis rather than a drawing trick.

**Decisions made:**

- **Oblique, not isometric.** The square grid stays. Isometric would require
  rewriting `screenPX`, `clampCam`, the cull loop, the tile sprite cache, the
  minimap, and all 161 cases of `drawTileProcedural`.
- **Elderbrook village is the art pilot**, gated per-map so no other map changes.
- **Z is a real gameplay axis**: ledges, flying altitude, projectile arcs, jump.
- **Hybrid art**, with Aseprite now. Tall tiles extruded procedurally; actors on
  Aseprite sheets.

**Performance is not a constraint.** `AUDIT.md:23` measures `render()` at 0.72ms
against a 16.7ms budget on a fully-stocked 150x150 map with 20 enemies.

---

## The constraint that shapes everything

`SOLID_TILES` (`config.js:368-408`) is the single source of truth shared by
`isSolid()` (`map-helpers.js:134-138`) and the connectivity flood-fill.
`connectivity.js:24-26` *inverts* it for traversability, and pass 2 seals every
unreachable passable tile by converting it to `T.TREE` (`connectivity.js:112-116`).
The comment at `config.js:357-368` documents this contract explicitly.

`T.PLATEAU` and `T.CLIFF` are in that set. Making their tops walkable would let
`ensureConnectivity` believe every map is connected straight through a cliff
face, changing reachability on every generated map and every existing save.

**So `SOLID_TILES`, `isSolid()`, and `connectivity.js` are not touched.** Ledges
are built from *new* tiles instead (see 5d), which keeps the inversion truthful
with no elevation-aware collision query at all.

A partial ledge affordance already exists: `T.CLIMB` is a passable ramp through
solid `T.PLATEAU` (`mapgen-biomes.js:350,363`), and `playerJumpStart` /
`PLAYER_JUMP_MS` (`player.js:372-373`) already fire a hop when crossing a climb
or swim boundary. That hop is render-only and gets promoted rather than replaced.

---

## Architecture

### 1. `projection.js`, a new file inserted after `config.js`

Reads `TILE_PX` and `camC/camR` at call time only, so declaration order does not
matter. Add to `index.html` and to the stale script list in
`.claude/skills/the-rpg-game/SKILL.md:18`, which names 42 files while
`index.html` has 44 (it is missing `dragon-sprite.js` and `hero-sprite.js`).

Two constants, both no-ops by construction:

```js
const FOOT_Y   = 1.00;   // sprite box bottom, as a fraction down its tile
const SHADOW_Y = 0.93;   // where the shadow ellipse sits; matches all three
                         // existing shadows, so unification is a no-op
```

**`footBox` is the migration primitive that keeps the diff small.** The ~2600
lines of enemy art, the 161-case tile switch, and `drawPlayer`'s body are all
written against a top-left `(px, py)` and size `s`. Rather than rewrite them,
derive the legacy top-left from a foot anchor:

```js
// Top-left of an s-pixel sprite box whose FOOT is planted at (wx, wy), lifted
// by z. Existing draw bodies keep px/py/s untouched, so only the two lines that
// compute them change.
//   .x, .y     box top-left, z applied
//   .groundY   tile-bottom Y at z = 0, where the shadow goes
function footBox(wx, wy, z, s)
```

**Provably a no-op at size 1.0.** Today `drawEnemy` computes `oy = (ts-s)/2`, so
at `s == ts`, `py = sy`. `footBox` gives `y = worldY(e.y+1) - s = sy`. Identical.

**And it fixes a live bug.** At size 0.6 a goblin's boots currently land 21px
*above* its own shadow; at size 2.8 the dragon's feet hover 43px above its
shadow. Foot-anchoring fixes both with no shadow code moving at all.

**`screenPX` is not migrated.** Its tile-centre contract is correct for its 84
callers, which are particle spawns and damage-number anchors. They want a body
centre, not ground contact, and re-anchoring them would drop every particle burst
half a tile. It gets re-expressed in terms of `worldX/worldY` (a 4-line diff) so
there is one source of camera math, plus a comment documenting both contracts.

### 2. `TILE_HEIGHT`, a table in `config.js` after `SOLID_TILES`

Heights in world units where 1.0 is one tile edge, so a height reads the same at
`TILE_PX` 48 and 24. Authored as a spec array in the same style as
`SOLID_TILES` (including its `.filter(v => v !== undefined)` guard), baked into a
`Float32Array(256)` for lookup. This is read once per visible tile per frame
(~2600 at TILE_PX 24), so an array index beats a hash.

Absent means 0 means flat, so the ~130 flat types need no entry and any *new*
tile defaults flat. That is the same fail-safe-by-omission rule
`CACHEABLE_TILES` relies on (`render.js:59`).

Liquids are listed explicitly at 0 so nobody "fixes" them by assuming every solid
tile is tall. Landmark heights must match `BIG_LANDMARK_SCALE`
(`render-tiles.js:4298`) or the sort disagrees with the art.

**One rule keeps it single-sourced.** The ~35 passable low-foliage props read as
tall to the renderer but must never be a ledge. Rather than a second column, add
a rule in `map-helpers.js` beside `isSolid`:

```js
// The height an actor STANDS AT. A passable tile is walked THROUGH, not climbed
// ONTO, so its surface is the ground however tall its art is. A fern is 0.3 to
// the renderer and 0 to the hero's knees.
function surfaceZ(map, c, r)
```

Renderer uses `TILE_HEIGHT[t]`; gameplay uses `surfaceZ()`.

### 3. Depth sorting

**The key is the foot row, not foot row plus z.** In an oblique projection the
camera sits at a fixed angle, so screen depth is world Y and only world Y. A bird
five tiles up over row 10 must still be occluded by a wall at row 12. Lifting the
key by z would pop anything airborne in front of walls ahead of it.

Ties break on a kind bias (tall tile, drop, projectile, enemy, villager, player),
reproducing `render.js:3046-3055` exactly for same-row objects. The only
behavioural change is cross-row.

**Merge, do not sort.** A forest is ~35% TREE, so ~1000 visible tall tiles at
TILE_PX 24. Both inputs are already ordered: the tall-tile list is row-sorted at
build time, and there are at most ~30 actors. Walking them together is O(n+m)
with no comparison sort of 1000 records and no per-frame allocation.

The cull loop at `render.js:3006-3022` is left alone and keeps drawing the flat
pass with all its cached blits. Tall tiles come from a per-map memoized scan
using the pattern `mapBigLandmarkTiles` (`render.js:1976`) already uses, with a
`DEPTH_SORT_MIN_Z = 0.6` floor so short props stay in the flat pass. Anything
that edits tiles (bomb-broken `ROCK` at `projectiles.js:668`, an opened
`SHRINE_GATE`) must invalidate the cache.

**Folding in the existing after-entity passes:**

| Pass | Verdict |
|---|---|
| `drawColossalTree`, `drawBigLandmark` | **Fold in.** Both are already "tall tile drawn after entities", a crude approximation of the sort. Folding in is strictly *more* correct: an actor south of a colossal tree should be in front of it and today is not. |
| `drawForestVillageRoofs` | **Stays special-cased**, since it is an interior-hiding layer rather than a depth-sorted object. But `redrawPlayerInFront` (`render.js:2973-2976`, `:2982`) goes away: give the facade a foot row and the player sorts in front for free. |
| `drawElderbrookFamilyHomeDepth` | Becomes the reference the generic path replaces. Its local `groundShadow()` folds into the shared helper. |
| Prologue layers (`render.js:3061-3082`) | **Stay.** Their ordering is deliberate and documented ("under the Emperor himself, it is coming out of him"). Only `drawPrologueEmperor` changes (see Risks). |
| Ground overlays (whirlpool, corruption, shrine) | **Stay** between the flat pass and the merge. |

**Gated per-map on `mapObj._oblique`.** Every unconverted map falls through to
today's fixed order untouched. This makes "nothing else changes" a structural
guarantee rather than a hope, and it matters because **"player always on top" is
a shipped feel that this ends.** He stays on top within his row, but a wall one
row south now covers him.

### 4. Foot anchoring and ground shadows

Three near-duplicate blocks collapse into one `groundShadow(wx, wy, z, rx, ry,
alpha, dx)`:

| Where | Radii and alpha |
|---|---|
| `render.js:254-266` (player) | `0.28 x 0.07`, `0.40`, plus climb sway and Elderbrook sun offset |
| `render-enemies.js:71-75` | `0.30*size x 0.07*size`, `0.38` |
| `villagers.js:874-887` | `0.26*size x 0.06*size`, `0.35`; fallen variant `0.44 x 0.12` |

The airborne scale and fade math is lifted verbatim from `render.js:256-258` so
the hero's shadow stays byte-identical. The Elderbrook interior sun offset moves
inside, so all three casters pick it up instead of two of three.

`drawEnemy`'s vertically-centred box becomes foot-anchored. **This moves four
things** that read `ox`/`oy`: the dormant tag (`render-enemies.js:3028`), the HP
bar X and Y (`:3036`), and tag centring (`:3061`). It *improves* the bar, which
today pins to the top of a centred box, putting the dragon's bar 0.9 tiles below
its head.

`drawDrop` keeps its tile-centre anchor, but its `bobOff` becomes a real `d.z`
and it gains a ground shadow for the first time, so bobbing drops read as
floating rather than sliding.

### 5. Real Z as gameplay state

**5a, Jump.** Move the arc from `render.js:217-222` into `stepPlayerJump(dt)` in
`player.js`, called from `main.js`. `drawPlayer` reads `player.z` and stops
writing `playerJumpStart`. `climbLift` and `climbSway` stay purely cosmetic:
climbing is an animation, not altitude, and folding it into z would shrink the
hero's shadow every time he scrambles a ramp. Save: `z: 0` in `DEFAULT_PLAYER`,
covered by `save.js:252`. Never save `playerJumpStart`, which is a `Date.now()`
timestamp and is meaningless across a reload. **Risk: low**, provided jump stays
the existing automatic hop. It becomes high the moment it is player-triggered.

**5b, Flying altitude via a new `hover` field, NOT `e.flies`.** `flies` is on
exactly one enemy (`adult_red_dragon`, `enemies.js:151`) and means "ignores solid
terrain" (`projectiles.js:553`). Harpy, wyvern, roc, griffon, air elemental,
will-o-wisp and pixie are all thematically airborne and all flagged ground.
Setting `flies` on a harpy to get altitude would also let it cross walls and map
borders. So `hover` is a separate optional field, eased toward in `stepEnemies`.
Save: `savedEnemies` records are spread verbatim (`enemies.js:407`), so
`Object.assign` will not cover them. Default in the reconcile block at
`enemies.js:455-463`, which exists for exactly this. **Risk: low as scoped, high
if it creeps.** Altitude must stay visual-plus-shadow in this pass. The moment it
gates melee or arrow hits, hovering enemies become unhittable and every
air-region encounter breaks. Say so in the comment.

**5c, Projectile arcs.** `p.z` and `p.vz` in `projectiles.js`, using the same
gravity idiom as the existing particle arc at `projectiles.js:1036-1039` so there
is one model rather than two. The height table's best gameplay use lives here:
replace the flat solid test at `projectiles.js:704` so a projectile is stopped
only by terrain *taller than it is flying*. An arrow lobbed over a `ROCK` (0.40)
clears it; a `WALL` (1.60) still eats it. **Only the bomb gets a real arc first.**
Giving today's flat fast arrows gravity would change the range of every shot in
the game. No save impact: projectiles are cleared on map change
(`enemies.js:464`) and never serialised.

**5d, Ledges, from new tiles.** `T.LEDGE` (passable, the walkable top surface)
and `T.LEDGE_FACE` (solid, the vertical face below it). Because the face is the
tile that blocks, `connectivity.js`'s inversion stays truthful with no changes.
`LEDGE` is the one exception to the `surfaceZ` rule, a passable tile you stand
*on top of*, and reads its height explicitly.

Movement: a step-up gate in `blocked()` (`player.js:1815-1822`) and a fall in the
post-move block (`player.js:1837-1872`), right where the climb hop already fires.
`stepEnemies` needs the same gate or enemies walk off ledges into the air.

Tile-id budget: max `T` is 188 and the `Uint8Array` assumption (`config.js:24`)
dies at 256. Two ledge tiles leaves 65. Fine, but finite.

No tile-array format change, since heights are a lookup and never stored, so
`encodeMap` output stays byte-identical and old Elderbrook saves keep their flat
village. **Risk: low as scoped, high if applied to existing terrain.** Converting
`CLIFF`, `PLATEAU` or `MOUNTAIN` to standable terraces changes traversability on
every desert and earth map. Separate project.

---

## Agent and model strategy

Most of this work is not a good agent target. Phases 1 through 5 are sequential
by construction, share a "pixel-identical at size 1.0" invariant across
`render.js`, `render-enemies.js` and `villagers.js`, and would conflict if edited
in parallel. Those run inline on Opus.

Three things are genuinely separable and should be delegated:

| Work | Agent | Model | Why it is safe to delegate |
|---|---|---|---|
| Phase 0: verify the Aseprite export command reproduces the committed PNG byte-for-byte, then factor `tools/aseprite-lib.lua` out of the ~95 duplicated lines | `general-purpose` | Sonnet | Different file tree, zero shared state with the JS engine work, and the success criterion is mechanical (byte-identical PNG, both generators still produce identical sheets). Can run concurrently with Phase 1. |
| Mechanical "find every site that reads X" sweeps, e.g. all `ox`/`oy` readers before Phase 2 | `Explore` | Haiku | Read-only, single-pattern search, verifiable by re-grepping. |
| Broader "how does system Y work" lookups mid-implementation | `Explore` | Sonnet | Read-only, but needs judgment about what is relevant. |

Run the Phase 0 agent in the background so Phase 1 is not blocked on it. Phase 6
(re-arting Elderbrook) is also delegable once the projection spec is fixed, since
by then the interface is a sprite sheet and a height number.

`/code-review` after Phase 2 and Phase 5 is worth the cost. Those are the two
phases that touch shipped behaviour rather than adding new paths. It is
user-triggered and billed, so it is your call to launch, not mine.

---

## Session checklist

This is multi-session work. **Create `oblique-conversion-todo.md` in the repo
root**, matching the existing `main-quest-implementation-todo.md` convention, so
progress survives a context reset. Update it at the end of every session.

Each phase has a **Done when** line naming who verifies what. Claude can drive
the browser itself through the Browser pane (the `the-rpg-game` config in
`.claude/launch.json` serves on :8765), read the console, and take screenshots.
Two things Claude cannot judge and must hand back: performance on a real phone,
and whether a changed feel is acceptable. Those are marked USER.

Phase-specific invariants live here rather than in any prompt, because they
expire. The pixel-identical rule governs Phases 1 through 4 and stops applying
once Phase 5 starts changing gameplay on purpose.

```
### Phase 0: Aseprite pipeline (parallelisable, no game changes)
- [ ] Verify the reconstructed export command reproduces hero-sheet.png byte-for-byte
- [ ] Record both Aseprite commands in the two .lua headers
- [ ] Factor tools/aseprite-lib.lua out of the ~95 duplicated helper lines
- [ ] Reconcile lineF's conflicting width semantics (px in hero, fraction of S in dragon)
- [ ] Add an explicit light-direction constant and a ramp() helper
- [ ] Confirm both generators still produce identical sheets after the refactor
DONE WHEN: the export command reproduces the committed hero-sheet.png
byte-for-byte, and both regenerated sheets are byte-identical to the committed
ones. Fully machine-checkable. Delegate to a background general-purpose agent on
Sonnet and carry on with Phase 1 while it runs.

### Phase 1: projection.js (zero visual change)
- [ ] Create projection.js with FOOT_Y, SHADOW_Y, worldX, worldY, footPX, footBox, groundShadow
- [ ] Insert in index.html after config.js
- [ ] Add to the stale script list in SKILL.md:18 (also add the two missing sprite files)
- [ ] Re-express screenPX in terms of worldX/worldY, with the dual-contract comment
- [ ] VERIFY: pixel-identical, console clean, existing named save loads
DONE WHEN: the game opens from file:// with a clean console, an existing named
save loads, and nothing on screen has moved. Claude verifies. If any pixel
moved, the anchor math is wrong: stop and find out why rather than adjusting
constants until it looks right.

### Phase 2: Foot anchoring + unified shadows
- [ ] Route drawPlayer through footBox + groundShadow
- [ ] Route drawEnemy through footBox + groundShadow
- [ ] Route drawVillager through footBox + groundShadow (incl. the fallen pivot)
- [ ] Repoint the four ox/oy readers (render-enemies.js:3028, :3036, :3061)
- [ ] Fix drawPrologueEmperor: pass z instead of its own translate  ← MUST be this phase
- [ ] Convert drawDrop's bobOff into a real d.z, add its shadow
- [ ] VERIFY: goblin boots meet their shadow; dragon stands on its shadow;
      size-1.0 enemies pixel-identical; PROLOGUE BEAT 3 unchanged
- [ ] Consider /code-review
DONE WHEN: a goblin's boots sit on its shadow, the tower dragon stands on its
shadow, a size-1.0 enemy is still pixel-identical, and prologue Beat 3 looks
exactly as before. Claude verifies all four by screenshot. Beat 3 is the one to
check hardest, since a size-5.5 sprite is the most visible possible regression.

### Phase 3: TILE_HEIGHT + extrusion for T.WALL only
- [ ] Add TILE_HEIGHT_SPEC + TILE_HEIGHT to config.js after SOLID_TILES
- [ ] Add surfaceZ() to map-helpers.js beside isSolid
- [ ] Generalise landmarkOverlayPass into a tileExtrudePass flag
- [ ] Extrude T.WALL only, drawn in the existing after-entity slot
- [ ] CONFIRM extrusions never route through drawTile/getTileSprite
- [ ] MEASURE render() ms before extruding anything denser than walls
- [ ] VERIFY: Elderbrook walls stand up, every other map unchanged
DONE WHEN: Elderbrook's walls have visible height, every other map renders
unchanged, and render() is still measured and reported against the 0.72ms
baseline. Claude verifies. Do not extrude anything denser than walls until that
number is in hand.

### Phase 4: The depth merge
- [ ] mapTallTiles + invalidateTallTiles beside mapBigLandmarkTiles
- [ ] drawDepthLayer, with the merge (not a sort)
- [ ] Move the entity pass (render.js:3046-3055) into it
- [ ] Fold in drawColossalTree and drawBigLandmark as tall-tile kinds
- [ ] Delete redrawPlayerInFront and the double drawPlayer call
- [ ] Gate on mapObj._oblique, set for Elderbrook only
- [ ] Wire tile-edit invalidation (projectiles.js:668 and friends)
- [ ] VERIFY: walk north and south of an Elderbrook wall, overlap flips
- [ ] VERIFY on a real phone at TILE_PX 24  (USER)
DONE WHEN: walking north of an Elderbrook wall hides the hero and walking south
puts him in front. Claude verifies that by screenshot. Two things go back to the
USER: the phone check at TILE_PX 24, and a judgement call on whether losing
"player always on top" feels acceptable. Stop and ask rather than deciding that
one alone. This is the last phase governed by the pixel-identical rule.

### Phase 5: Z as gameplay (ascending risk, land in this order)
- [ ] 5a jump: stepPlayerJump in player.js, called from main.js; z:0 in DEFAULT_PLAYER
- [ ] 5b hover: new field on ~9 airborne enemies; default in enemies.js:455-463
- [ ] 5c bomb arc + the TILE_HEIGHT projectile gate (arrows stay flat)
- [ ] 5d ledges: T.LEDGE / T.LEDGE_FACE, step-up gate, fall, enemy gate
- [ ] VERIFY after EACH: load an existing named save, not a new game
- [ ] VERIFY: regenerate maps from fixed seeds, confirm ensureConnectivity seals identically
- [ ] Consider /code-review
- [ ] Re-check dragon balance with the enemy-forge skill
DONE WHEN: each of 5a through 5d loads an existing named save cleanly, and maps
regenerated from fixed seeds still seal identically under ensureConnectivity.
Claude verifies those. **Stop and report after each of 5a, 5b, 5c and 5d
separately.** This phase changes shipped behaviour on purpose, so the
pixel-identical rule no longer applies and the USER has to judge whether each
change feels right. Do not land all four and then ask.

### Phase 6: Re-art Elderbrook
- [ ] Regenerate hero-sheet foot-anchored (taller frame, known foot row)
- [ ] Update the three coupled constants together: HERO_BODY_OX/OY and heroSwordTip
- [ ] Emit hero-atlas.js assigning a global, replacing the hardcoded frame constants
- [ ] Extrude tree, wall, house for the pilot
DONE WHEN: the hero renders from a foot-anchored sheet with no hardcoded frame
constants left in hero-sprite.js, and Elderbrook's tree, wall and house have
height. Largely a USER judgement on whether the art reads right. Claude verifies
only that nothing regressed.
```

---

## Verification

There is no test runner and adding one would violate the project constraints.
Per phase:

1. Open `index.html` **directly from the filesystem**, not just the `:8765`
   server. A `file://` violation only shows up that way. Check the console.
2. **Load an existing named save**, not a new game. That catches save-compat
   breaks, and it matters most in Phase 5.
3. Walk the changed thing plus one adjacent system sharing state.
4. Record `render()` ms against the 0.72ms baseline.
5. Check **zoomed-out mode** (`TILE_PX` 24, `render.js:1373`), roughly 2600
   visible tiles, the worst case for the merge.
6. Check on a real phone at Phase 4. Touch controls are shipped, and 0.72ms on
   desktop can be 5 to 8ms on a mid-range device.
7. **Check prologue Beat 3** after Phase 2 (see Risks).

---

## Risks

1. **Extrusions must never go through the tile cache.** `CACHEABLE_TILES` is
   empirically derived (`render.js:45-64`) on the rule that art is a pure
   function of `(type, size)`. A side face shaded by which neighbours are tall is
   neighbourhood-dependent and would be silently *wrong* through the cache, which
   is exactly the `CLIMB` failure that comment describes catching. Extrusions
   draw procedurally in the tall-tile pass; the flat pass and its cache are
   untouched. This also sidesteps `buildTileSprite`'s clipping bail
   (`render.js:125-126`), which a 1.6 to 2.4 tile extrusion would always trip.

2. **Never add neighbour-mask height variants.** `VARIANT_TILE_HASH` has 2
   entries at 8 and 16 variants. A neighbour mask across ~59 tall solids at 16 to
   256 masks each is hundreds of megabytes of canvas.

3. **`drawPrologueEmperor` breaks unless handled in Phase 2.** `render.js:1663`
   passes `size: 5.5` through `drawEnemy` and applies its own
   `ctx.translate(0, -alt*ts)`. Foot-anchoring moves a size-5.5 sprite up by 2.25
   tiles. Fix by passing `z: alt` into the enemy literal and deleting the
   translate, so he uses the same path as everything else. Beat 3 is a scripted
   unwinnable cutscene, so a 2.25-tile sprite jump there is the most visible
   possible regression.

4. **The renderer mutates game state today.** `render.js:220` clears
   `playerJumpStart` inside `drawPlayer`, and `drawPlayer` is called *twice* in
   one frame at the Elderbrook family home (`render.js:2982`), so the second call
   sees a different `jt`. Latent now, a real bug once jump is real state. Phase 4
   deletes the double draw; Phase 5a moves the arc out of the renderer.

5. **Enemies have no smoothed coordinates.** `drawEnemy` reads raw integer
   `e.x/e.y` while the player and villagers glide. Depth sorting makes the snap
   more visible, since order pops a full row at a time. Adding `renderX/renderY`
   to enemies may become necessary for the result to look right.

6. **Mobile at TILE_PX 24 is the real perf case.** The mitigations are all in the
   design: cached row-sorted list, merge instead of sort, `DEPTH_SORT_MIN_Z`
   floor. The actual cost is `save/translate/scale/restore` per tall object, and
   `drawBigLandmark` does that on ~10 objects per frame today, not ~800. Measure
   Phase 3 before extruding a forest.

7. **`SKILL.md:18`'s script list is stale**, naming 42 files against 44 in
   `index.html`. Any new file goes in both.
