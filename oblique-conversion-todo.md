# Oblique (2.5D) Conversion To-Do

Checkbox state for the conversion described in `oblique-conversion-plan.md`. That
file is the authority: it holds the reasoning, the verified file:line references,
and the per-phase "Done when" lines. This file only records what is ticked.

**Status legend**

- `[ ]` not started
- `[~]` in progress or delegated and not yet reported back
- `[x]` done and verified by that phase's "Done when" line

Work the lowest phase with unchecked boxes. Do not start two phases at once, and
do not skip ahead: the order encodes real dependencies.

---

## Verification rig (built during Phase 1, reusable for every later phase)

The Browser pane cannot open a real `file://` origin (it inlines the page as a
`data:` URL, so no sibling script loads), and the Chrome extension is not
connected on this machine. So verification runs through a small zero-dependency
CDP driver against headless Edge, which gives a genuine `file://` load plus
console capture, JS evaluation and screenshots.

- Driver: `<scratchpad>/cdp.js`, run as
  `node cdp.js "file:///C:/Users/corte/MACortese42/Game1/Game1/index.html" --probe p.js --shot out.png`
- Persistent browser profile: **`<session bf8d78d9>/scratchpad/edge-profile`.**
  The save fixture lives in this profile's localStorage, so do not delete it,
  and pass it with `--profile` from a later session rather than letting cdp.js
  default to the current scratchpad. `file://` localStorage is shared across all
  `file://` pages, so a baseline copy at another path sees the same save.
- `pngdiff.js` (Phase 2) diffs two screenshots exactly: differing pixel count,
  max channel delta, bounding box and a coarse location map. It decodes PNG on
  node's built-in zlib, so it stays dependency-free. Always sanity-check it on a
  known-identical pair first.
- **Exit codes are signals, not failures.** `pngdiff.js` exits 1 when the images
  differ, which is the expected result for every check whose point is to find a
  difference. `cdp.js` exits 2 when the page logged at error level. Both show up
  as red in a terminal; neither means the run went wrong.
- **Chrome interventions are not errors, and used to be counted as them.**
  Headless Chrome refuses `navigator.vibrate` without a user gesture, which a
  headless page can never have, and logs it at error level. The game buzzes on
  damage, so any probe that landed a hit or threw a bomb exited non-zero for a
  reason with nothing to do with the game (the dragon DPS probe alone tripped it
  11 times). `cdp.js` now routes `source === 'intervention'` into its own bucket:
  still printed, collapsed to a count, and excluded from the exit code. Verified
  three ways after the change: the noisy probe exits 0, a clean probe stays
  clean, and a genuine `ERR_FILE_NOT_FOUND` still exits 2.
- `pngdiff.js`'s decoder can be borrowed by other scratch tools, but slice it at
  its own closing brace. Cutting at the next `function` sweeps up the file's
  top-level CLI code, which then calls `readPNG` on `argv[3]`.
- **Freeze before you load.** Every probe must stub `requestAnimationFrame`,
  freeze `Date.now` and seed `Math.random` BEFORE calling `doLoad`, then call
  `render()` by hand. Freezing after the load leaves the world stepping for a
  variable number of frames and the frame is no longer reproducible.
- Prove the rig before trusting a diff: render the same build twice (must be
  identical), and render one scene through two different probe files (must also
  be identical). The second check is the one that catches a probe whose own
  timing is perturbing the frame.
- Save fixture: slot 0, named **"Oblique Fixture"**, hero "Fixture", Elderbrook
  post-prologue (`skipPrologue`), 12 villagers, hp 3, bow acquired. It was
  written through the game's own `doSave(0)` path, not hand-crafted, so it
  genuinely exercises save compatibility. Load it with `doLoad(0)`.
- No save existed in any browser profile on this machine, so this fixture had to
  be created. If a real player save ever appears, prefer it.
- Walking the hero: dispatch `KeyboardEvent` on **`document`**, not `window`.
  The handler is `document.addEventListener('keydown', ...)` at `main.js:250`,
  and events dispatched on `window` never reach it.

---

## Phase 0: Aseprite pipeline (parallelisable, no game changes)

- [x] Verify the reconstructed export command reproduces hero-sheet.png byte-for-byte
- [x] Record both Aseprite commands in the two .lua headers
- [x] Factor tools/aseprite-lib.lua out of the ~95 duplicated helper lines
- [x] Reconcile lineF's conflicting width semantics (px in hero, fraction of S in dragon)
- [x] Add an explicit light-direction constant and a ramp() helper
- [x] Confirm both generators still produce identical sheets after the refactor

Done by a background `general-purpose` agent on Sonnet, then re-verified
independently rather than taken on trust.

**Regenerate command (run from the repo root, both steps):**

```
aseprite -b --script-param out=hero-sheet.aseprite --script tools/make-hero-sheet.lua
aseprite -b hero-sheet.aseprite --sheet hero-sheet.png --data hero-sheet.json \
         --format json-array --sheet-type rows --sheet-columns 21 --list-tags
```

Same shape for the dragon, with `--sheet-columns 6`. It is two steps because the
script-built sprite is not left open for the CLI's own `--sheet`/`--data` flags,
and `--list-tags` is required or `frameTags` is dropped from the JSON.

Verification actually performed:

- All six outputs (png, json, aseprite, for both sheets) regenerated to scratch
  and SHA256-compared against the committed files: **6 of 6 byte-identical**.
- Committed sheets confirmed untouched by mtime (still dated 2026-08-14, while
  only the three `tools/*.lua` files changed).
- The sheet JSON's own `"version": "1.3.18.2-dev"` matches the installed
  Aseprite, so there is no version drift hiding behind the match.
- Re-hashed a second time after a further comment fix. Still 6 of 6.

**Correction to the agent's report:** it claimed Aseprite's batch-mode `dofile`
falls back to the running script's own directory when the cwd-relative path
misses. It does not. Running either script from any other cwd fails with
`cannot open tools/aseprite-lib.lua` and exit 127, before drawing anything. The
scripts are still correct as written, since both headers say to run from the
repo root and the failure is loud rather than silent, but the comment in
`aseprite-lib.lua` asserting the fallback was wrong and has been rewritten.

`lineF` is now "fraction of S" in both scripts, matching every other `*F`
helper. Hero's 22 call sites all passed the same 1px literal, replaced by
`LINE_W = 1.0 / S`, which round-trips exactly in doubles.

## Phase 1: projection.js (zero visual change)

- [x] Create projection.js with FOOT_Y, SHADOW_Y, worldX, worldY, footPX, footBox, groundShadow
- [x] Insert in index.html after config.js
- [x] Add to the stale script list in SKILL.md:18 (also add the two missing sprite files)
- [x] Re-express screenPX in terms of worldX/worldY, with the dual-contract comment
- [x] VERIFY: pixel-identical, console clean, existing named save loads

Notes:

- `screenPX` lives in `projectiles.js:244`, not in `render.js` as the plan's
  prose implies. The plan's other references were accurate.
- The re-expression is **bitwise** identical, not merely close: reassociating
  `(tx - camC + 0.5) * TILE_PX` to `(tx + 0.5 - camC) * TILE_PX` was swept over
  3,848,004 samples across TILE_PX 24/32/48/64 with zero differing results.
- `footBox` was checked live against the legacy `(ts - s) / 2` formula at size
  1.0 and matched exactly, including accumulated float error.
- The script list is now 45 files, was 42 in SKILL.md and 44 in index.html.
- Nothing calls the new helpers yet, which is what makes this phase zero-risk.

## Phase 2: Foot anchoring + unified shadows

- [x] Route drawPlayer through footBox + groundShadow
- [x] Route drawEnemy through footBox + groundShadow
- [x] Route drawVillager through footBox + groundShadow (incl. the fallen pivot)
- [x] Repoint the four ox/oy readers (render-enemies.js:3028, :3036, :3061)
- [x] Fix drawPrologueEmperor: pass z instead of its own translate  (MUST be this phase)
- [x] Convert drawDrop's bobOff into a real d.z, add its shadow
- [x] VERIFY: goblin boots meet their shadow; dragon stands on its shadow;
      size-1.0 enemies pixel-identical; PROLOGUE BEAT 3 unchanged
- [x] Consider /code-review   (run; two findings, both fixed and re-verified)
- [ ] USER: accept the one measured Beat 3 deviation, 49 px (see below)

/code-review found two real defects, both created by foot anchoring moving the
sprite box while something that drew against the TILE stayed put. Both are fixed:

1. `drawDrop`'s new shadow used the default SHADOW_Y (0.93), which is built for
   an actor whose foot plane is 1.00. A drop is anchored at its tile centre, so
   the shadow landed 0.43 tiles (20.6px) below the item, a detached smudge with
   bare floor between. Now passes `yFrac` 0.69, derived the same way an actor's
   is: the art reaches 0.24 tile below centre, so 0.74 is the drop's own foot
   plane and 0.69 puts the ellipse's lower edge on it.
2. The 14 one-tile aura backdrops built a radial gradient centred on (cx, cy)
   and painted it through a rect anchored to the tile. cx/cy followed the box,
   the rect did not, so for the 11 affected non-unit-size types the glow was
   clipped off-centre: a size-1.65 storm giant sat 15.6px off, which roughly
   doubled the alpha at the rect's top edge and made it a visible seam. The rects
   now use `fb`. Deliberately `fb` and not `px`/`py`, because the rect never
   included the idle bob while the gradient always did; `fb` preserves that
   existing wobble and keeps size 1.0 byte-identical.

Re-verified after both fixes: fixture scene still 0 differing pixels against the
pre-Phase-2 baseline, Beat 3 still exactly the same 49 px and nothing new, and in
the aura scene the size-1.0 control is 0 differing pixels while the 1.65 and 0.5
cases change as intended.

Not filed as a defect, but a USER-visible consequence worth knowing: Nettie
(size 0.72) is laid fallen by `pgWound('child', ...)` (prologue.js:770) and her
pose visibly shifts, because foot anchoring moved her body while the rotation
pivot stayed tile-anchored. That pivot is now MORE consistent, not less: every
villager's feet land on the tile bottom regardless of size, so one tile-anchored
pivot is correct for all of them where it used to be right only at size 1.0.
A size-1.0 villager in the same pose is byte-identical.

The six code boxes were written in an earlier session that ended without
updating this file, so they were found already done and were verified rather
than re-implemented. Verification actually performed, all from a real `file://`
origin against the "Oblique Fixture" save:

- A pre-Phase-2 **baseline build** was reconstructed in the scratchpad by
  reversing all 22 Phase 2 hunks, each asserted to match exactly once. The two
  builds are then screenshot-diffed frame by frame. The first attempt at this
  revert missed the `fb`/`boxTop` declaration and left two comment fragments, so
  the baseline still called `footBox`; that is fixed and the leftover check now
  passes cleanly.
- **Pixel-identical at size 1.0: confirmed byte for byte.** The fixture scene
  (hero plus 12 villagers, the on-screen ones all size 1.0) renders to an
  identical PNG on both builds, 0 differing pixels of 843,942.
- **The foot fix is real and consistent.** Distance from a sprite box's bottom
  to its own shadow line, at TILE_PX 48, was +6.24px (goblin 0.6), +3.84px
  (wolf 0.7), +3.36px (Nettie 0.72) and -46.56px (dragon 2.8) before. It is
  -3.36px for every size after, size 1.0 included and unchanged. Screenshots of
  the magnified foot lines show the gap closing.
- **Beat 3: three of the four scripted states are byte identical**, and the
  fourth (scale 1.5, alt 5) differs by 49 px in a 127x5 band, all of them
  slightly lighter. That is the Emperor's internal shadow sliver, which the
  code suppresses for a cutscene actor. See the correction below.

Two things about the plan's own numbers, neither of them blocking:

- The plan says a size-0.6 goblin's boots land "21px above its own shadow" and
  the dragon's feet "hover 43px above" theirs. Measured at TILE_PX 48 the goblin
  gap is 6.24px, and the dragon's box bottom is 46.56px BELOW its shadow line
  rather than above. The bug is real and the magnitudes are the right order, but
  the goblin figure and the dragon's direction do not reproduce.
- The comment added with Phase 2 claimed the Emperor's own copy of the shadow
  ellipse was "hidden behind his own 5.5-tile body, so it is invisible." It is
  not: 49 px of it show at the beat's closest state. The comment at
  `render-enemies.js:87` now records the measurement instead of the assumption.
  Suppressing it is still right, because drawing it from the new foot row would
  move it about 174px rather than restore it.

Rig note carried forward: **stub `requestAnimationFrame` BEFORE `doLoad`,** not
after. Stubbing it after lets the world step for however many frames fit in the
load sleep, villagers wander a different number of steps per run, and a frame
picks up several hundred pixels of noise that looks exactly like a real
regression. That flaw produced a spurious 922-pixel Beat 3 diff before it was
caught by cross-checking two probes that render the same scene.

Carried into this phase from Phase 1:

- To stay pixel-identical, the hero must pass his **combined** lift
  (`jumpLift + climbLift`) as `groundShadow`'s z, because that is what today's
  `airT` uses. Phase 5a is where climb stops counting as altitude.
- `groundShadow` takes an optional `yFrac` for the fallen villager, whose shadow
  sits at 0.86 rather than SHADOW_Y (0.93).
- The Elderbrook interior sun offset now lives inside `groundShadow`, so enemies
  pick it up too. That is a deliberate, tiny change from two casters to three.
- `groundShadow` wraps its fill in save/restore. This preserves the caller's
  `shadowBlur`, which the hero's low-HP red glow relies on to tint his shadow.
- `ts` is `TILE_PX` at every call site, checked, so helpers reading TILE_PX
  directly are safe.

## Phase 3: TILE_HEIGHT + extrusion for T.WALL only

- [x] Add TILE_HEIGHT_SPEC + TILE_HEIGHT to config.js after SOLID_TILES
- [x] Add surfaceZ() to map-helpers.js beside isSolid
- [x] Generalise landmarkOverlayPass into a tileExtrudePass flag
- [x] Extrude T.WALL only, drawn in the existing after-entity slot
- [x] CONFIRM extrusions never route through drawTile/getTileSprite
- [x] MEASURE render() ms before extruding anything denser than walls
- [x] VERIFY: Elderbrook walls stand up, every other map unchanged
- [x] Extrude BOTH wall types, burnt at half height with half of them collapsed

**The ruin problem, resolved.** Elderbrook is two villages, and the shipped
post-prologue one had nothing to extrude:

| layout | T.WALL | T.BURNT_WALL |
|---|---|---|
| intact (prologue only) | 443 | 0 |
| ruined (every post-prologue save) | 0 | 1606 |

Extruding only T.WALL stood up a village the player sees once. Both types now
extrude, and on the USER's call the ruin gets a mix rather than a uniform field:
T.BURNT_WALL dropped from 1.00 to **0.50**, less than a third of an intact wall,
and only **half of them stand** at all. Measured 806 of 1606 standing, 50.2%.

Which half is a hash of the tile's own coordinates, so it is decided identically
on every frame, every reload and every save, with nothing stored and no new map
field. It uses mulberry32's mixing (map-helpers.js) as a one-shot hash rather
than the cheap `(col * 73) ^ (row * 41)` style VARIANT_TILE_HASH uses: a wall run
is a straight line, and a low-period mix lays a repeating dashes pattern down it.
Checked by walking a 60-tile row and a 60-tile column as bit strings and looking
for any period up to 16. There is none in either direction.

**One trap this created, worth knowing before Phase 4 adds more tile types.**
"Should I draw this tile?" and "will my south neighbour cover my face?" must be
answered by the SAME rule. Answering the second from TILE_HEIGHT while the first
consults the collapse rule leaves a standing wall skipping a face that nothing
then draws. Both now go through `extrudedHeight()`, which also fixed a live bug
in the first version of this pass: it tested the raw height table, so a wall with
a TREE to its south (1.80 in the table, never extruded) skipped its face and left
a hole. `EXTRUDED_TILES` is what makes that answerable.

Also flat, and deliberately out of scope: what is embedded IN the wall runs.
1 CASTLE_WINDOW and 16 doors (DOOR x12 plus one each of STORE/INN/SMITH/HERB)
sit between wall tiles, are not T.WALL, and so stay flat, leaving notches in an
otherwise standing run. CASTLE_WINDOW already carries 1.60 in the height table
for exactly this reason, so it is a one-word change when the art wants it.

**Measurements**, interleaved A/B with the pass stubbed as the control, median of
40 rounds of 20 frames:

| layout | zoom | in view | render() with | without | cost of pass |
|---|---|---|---|---|---|
| intact | TILE_PX 48 | 34 | 0.510 ms | 0.455 ms | +0.055 ms |
| intact | TILE_PX 24 | 178 | 1.925 ms | 1.670 ms | +0.255 ms |
| ruin | TILE_PX 48 | 58 | 0.570 ms | 0.500 ms | +0.070 ms |
| ruin | TILE_PX 24 | 354 | 1.795 ms | 1.360 ms | +0.435 ms |

Against a 16.7 ms frame budget, so the worst case measured uses 2.6% of it. The
ruin counts include the collapsed half, which the pass still iterates and skips.
TILE_PX 48 sits under AUDIT.md's 0.72 ms baseline with the pass on, in both
layouts. Roughly 1.5 us per extruded tile, which is the number Phase 4 needs:
extruding a forest instead of a village, at roughly 1000 visible TREE tiles
zoomed out, projects to about +1.4 ms.

First attempt at this measurement was wrong and said the pass was FREE, twice.
It toggled the gate by swapping `mapObj.type`, which also turns off village
roofs, the family-home depth pass and the shop signs, so it was timing two
different scenes. The control has to stub `drawTileExtrusion` and nothing else.

Verification performed:

- Intact Elderbrook renders with walls visibly standing: lighter cap, graded
  darker south face. Screenshotted.
- Every other map unchanged, structurally and empirically. All new render code
  sits inside `if (isObliqueMap(mapObj))`, and the flag rename introduced a name
  that did not previously exist anywhere in the tree, so it is a single-binding
  rename. Empirically: with the map's type changed so the gate is off, stubbing
  drawTileExtrusion changes 0 pixels, which is direct proof the pass never runs
  off the pilot.
- Adding burnt walls left the intact village byte-identical, 0 differing pixels
  before vs after that change, so the second tile type is purely additive.
- `drawTileExtrusion` calls only `drawTileProcedural`, never `drawTile` or
  `getTileSprite`, so the sprite cache is untouched.

A note that saves Phase 4 some worry: a wall's face extends UP from its own
bottom edge, so it never reaches into the tile to its south. An actor standing
directly south of a wall is therefore NOT painted over, even though the pass runs
after the entities. Checked with the hero placed against a wall. Walls occlude
only actors north of them, which is correct. The depth merge is still needed for
southward-overhanging art like canopies, and for actors against each other.

`_oblique` deviation: the gate is a derived `isObliqueMap(mapObj)` testing
`type === 'homevillage'`, not a stored `mapObj._oblique` field. Map objects carry
memoized render caches and are long-lived, so a stored field raises a "does this
reach the save?" question that a pure function does not, and derived covers every
Elderbrook in every existing save with no migration.

## Phase 4: The depth merge

- [x] mapTallTiles + invalidateTallTiles beside mapBigLandmarkTiles
- [x] drawDepthLayer, with the merge (not a sort)
- [x] Move the entity pass into it
- [x] Fold in drawColossalTree and drawBigLandmark as tall-tile kinds
- [x] Delete redrawPlayerInFront and the double drawPlayer call
- [x] Gate on the oblique test, Elderbrook only
- [x] Wire tile-edit invalidation (projectiles.js bomb, shrines.js gate)
- [x] VERIFY: walk north and south of an Elderbrook wall, overlap flips
- [ ] VERIFY on a real phone at TILE_PX 24  (USER)
- [ ] USER: is losing "player always on top" acceptable? (see below)

**What actually changed on screen.** Less than expected for walls, and more than
expected for actors:

- **Actor vs actor is the real change.** An enemy standing SOUTH of the hero is
  now drawn over him. Screenshotted both ways: enemy north, hero in front; enemy
  south, enemy in front. This is the end of "player always on top" and it is the
  thing to judge.
- **Walls barely moved.** A wall's face only ever extends UP from its own bottom
  edge, so it never reached into the tile south of it even in Phase 3. North of
  a wall the hero is hidden (completely, at 1.60), south of it he is in front.
  Both were already true before the merge; the merge makes them true by
  construction rather than by luck of geometry.
- **Colossal trees and big landmarks are where the merge earns its keep.** Their
  art overhangs southward, and they used to draw over every actor
  unconditionally. A hero south of a giant is now in front of it.

**redrawPlayerInFront is gone**, and the way it went is worth recording. It drew
the entire hero a SECOND time, after the roof layer, whenever he stood within two
tiles south of the pilot cottage. Roofs now enter the merge as their own kind
keyed to the house's south row (DEPTH_ROOF, sorting after every actor on that
row), so a hero at the door is in front of the roof and people inside the house
are still hidden by it, both for free. That required splitting the 190-line loop
body of drawForestVillageRoofs into drawForestHouseRoof. The extraction was
verified byte-faithful: 16 roofs, 0 differing pixels against the pre-extraction
build with all actors removed.

That double draw also mattered beyond tidiness. It is Risk 4 in the plan: the
renderer mutates game state, and drawPlayer clears playerJumpStart, so the second
call saw a different jump time. That is now impossible.

**PERFORMANCE NUMBERS IN THIS FILE ARE ONLY COMPARABLE WITHIN A SINGLE RUN.**
The Phase 3 build measured 1.795 ms on the ruin at TILE_PX 24 in the last
session and 3.48 ms for the same build, same scene, an hour later. Nothing
changed but the machine. Absolute figures drift by 2x here, so the Phase 3 table
above should not be read against the numbers below, and neither should be read
against AUDIT.md's 0.72 ms. Only interleaved A/B deltas mean anything.

Measured back to back against a reconstructed Phase 3 build, same machine state:

| zoom | Phase 3 | Phase 4 | cost of the merge |
|---|---|---|---|
| TILE_PX 48 | 1.135 ms | 1.145 ms | +0.010 ms |
| TILE_PX 24 | 3.480 ms | 3.705 ms | +0.225 ms |

And isolated inside one build, swapping only the ordering strategy while drawing
exactly the same things, the merge costs +0.02 ms at TILE_PX 24 and nothing at
48. So sorting is free and the +0.225 ms is the extra function-call layer, not
the algorithm. 20 enemies on screen adds 0.1 ms. Worst case is 3.8 ms of a
16.7 ms budget.

Verification performed, all from `file://` on the "Oblique Fixture" save:

- The depth layer is provably never called off the pilot: replacing it with a
  function that THROWS leaves a non-pilot map rendering 0 differing pixels and
  no exception.
- Prologue Beat 3 renders clean with the merge live, and the Emperor's geometry
  check still reports identical placement at all four scripted states.

**/code-review of Phase 4 found two real bugs, both mine, both now fixed.**

1. **The burning of Elderbrook left the tall-tile cache stale** (prologue.js).
   `skipPrologue` swaps the whole tile array for the ruin, and it is the ONLY
   runtime site in the codebase that replaces a map's tiles. The depth layer had
   already memoized the intact village's 443 entries. Measured on the real path:
   1204 of the ruin's 1606 burnt walls never drew, and it only righted itself on
   a reload, because that rebuilds the map object. The irony worth remembering:
   invalidateTallTiles was wired into the bomb and the shrine gate, neither of
   which can currently affect the list, and not into the one site that can.
   Fixed and re-verified through `skipPrologue()` itself rather than a hand
   reproduction: cache goes 443 to 1606, matching the ruin exactly, 0 walls
   missing.
2. **Projectiles sorted on a key that does not exist** (render.js). They carry
   `tx`/`ty`, not `x`/`y`, so `p.y` was undefined, `(a.y - b.y)` was NaN, and
   because NaN is falsy the comparator fell through to the kind compare and
   stopped being a consistent total order. Every arrow drew behind every actor
   regardless of position, and a single arrow on screen could perturb the whole
   frame's ordering. Now keys on `p.ty - 0.5`, since ty is a tile CENTRE while
   every other actor keys on its tile row.

Also removed: `EXTRUDE_PASS_TILES` and the `_wallTiles`/`_burntWallTiles` cache
keys went dead when the merge replaced the Phase 3 standalone pass, and the
comment on the dead constant still claimed it kept EXTRUDED_TILES in sync.

Re-verified after the fixes: fixture loads clean, all four depth cases render 0
differing pixels against their pre-fix screenshots, the non-pilot gate still
holds, roof art still byte-faithful, and Beat 3 geometry still identical.
- [ ] ASK: is losing "player always on top" acceptable?  (USER)

## Phase 5: Z as gameplay (ascending risk, land in this order)

- [x] 5a jump: stepPlayerJump in player.js, called from main.js; z:0 in DEFAULT_PLAYER
- [x] 5b hover: new field on 9 airborne enemies; default in the reconcile block
- [x] 5c bomb arc + the TILE_HEIGHT projectile gate (arrows stay flat)
- [x] 5d ledges: T.LEDGE / T.LEDGE_FACE, step-up gate, fall, enemy gate
- [x] VERIFY after EACH: load an existing named save, not a new game
- [x] VERIFY: regenerate maps from fixed seeds, confirm ensureConnectivity seals identically
- [x] Consider /code-review   (run over the whole uncommitted conversion; 7 findings, all fixed)
- [x] Re-check dragon balance with the enemy-forge skill

Stop and report after each of 5a, 5b, 5c and 5d separately.

### 5a: jump

**The hop was shipped broken and this session is what fixed it.** An earlier
session wrote all of 5a's code and ended without updating this file, the same way
Phase 2 did. Everything was in place except the one line that makes it run:
nothing called `stepPlayerJump`, and it appeared nowhere in `main.js`. So
`player.z` never left 0, and every hop trigger in the game (both ramp-lip
crossings, the swim waterline in either direction, and both whirlpool grabs) was
silently flat. Measured before the fix: driving `update()` for 18 frames after
`startPlayerJump()` left z at 0 for all 18, while calling `stepPlayerJump`
directly produced a correct arc. The function was never wrong, only unreachable.

Landed this session:

1. `stepPlayerJump(dt)` in `update()` (main.js), placed after `stepPlayerMovement`
   and `stepWhirlpoolPull` so a hop triggered this frame is already rising when
   the renderer reads it, and below the freeze chain so it pauses with the world.
   Both properties were then measured rather than assumed.
2. The hero's shadow now takes `player.z` alone instead of
   `(jumpLift + climbLift) / s`. This is the deliberate change 5a exists to make,
   and the comment sitting on that line had been predicting it since Phase 2.
3. A stale comment in `drawDrop` that cited `playerJumpStart` as the live example
   of the renderer mutating game state. 5a is what made it untrue.

**Climbing is no longer altitude, and it was worse than "slightly wrong".**
`climbLift` is `|sin(t)| * 0.12`, so feeding it to the shadow did not merely
shrink it, it PULSED it at the scramble rate. Swept across one full scramble
cycle on both builds at TILE_PX 48:

| build | shadow radius while on a ramp |
|---|---|
| pre-5a | oscillates 11.829 to 13.368 px, twice per cycle, worst case 12% under |
| now | flat 13.44 px, identical to standing on level ground |

The hero is standing on the ramp the whole time, so a shrinking shadow was always
wrong; it was just wrong consistently. `climbSway` is still passed, so the shadow
keeps tracking sideways under him, which was measured too (centre moves 627 to
629.08 px). Only `climbLift` stopped counting.

Verification performed, all from a real `file://` origin against the "Oblique
Fixture" save, console clean and 0 errors on every run:

- **5a is completely inert when the hero is grounded.** A pre-5a baseline build
  was reconstructed in the scratchpad by reversing both functional hunks, and the
  at-rest fixture frame renders **0 differing pixels of 843,942** against it.
  Sanity-checked against a known-identical pair first, as the rig note requires.
- **The isolation is exact.** A three-panel magnified comparison (grounded,
  mid-hop at z 0.45, on a ramp) diffs to 24,102 pixels between the builds, and
  the bounding box `x 940..1253` falls entirely inside the third panel. Grounded
  and mid-hop are pixel-identical across the change; only the ramp shadow moved.
  Mid-hop being identical is expected and is a useful check on the rewrite:
  `jumpLift / s` is exactly `player.z`, so the two expressions agree whenever
  climbLift is 0.
- **The arc runs through the real movement path**, not just when poked. Walking
  the hero onto a laid ramp lifts him on the very frame his row changes (frame 9,
  y 48 to 49, z 0 to 0.086 in that same frame), peaking at 0.450 and returning to
  0. That is direct evidence for the ordering choice in main.js.
- **It pauses with the world.** Opening the radial menu mid-hop holds z at 0.3143
  across 30 frames instead of letting the arc finish behind the menu.
- **Save compatibility, both directions.** The fixture itself turns out to
  predate the z field entirely (`'z' in raw.player` is false), so the shipped
  named save IS the old-format case: it loads with z 0, a real number, finite
  under multiplication. And a save doctored to hold a mid-hop z of 0.37 loads
  with that value and is zeroed by the first stepped frame, which is exactly what
  the comment on `stepPlayerJump` promises. Both tested through `applyLoadData`
  on a copy, so slot 0 was never written to.
- **The renderer is now pure with respect to jump state.** Calling `drawPlayer`
  twice in a row leaves `player.z` untouched, and `playerJumpStart` no longer
  exists as a global. That closes Risk 4 in the plan.

USER judgement wanted: the ramp shadow no longer pulses. It is a small, correct
change, but it is a visible one on every plateau ramp in the game.

### 5b: hover

The render side was already done. `drawEnemy` has read `e.z` through both
`footBox` and `groundShadow` since Phase 2 (render-enemies.js:65 and :118), so
5b is only about making `e.z` stop being 0. That is why this is a small diff.

**Who hovers, and the rule.** Nine creatures, the seven the plan names plus
Pegasus and Couatl, which are winged and airborne on exactly the same reasoning:

| creature | hover | | creature | hover |
|---|---|---|---|---|
| Will-o'-Wisp | 0.50 | | Wyvern | 0.32 |
| Pixie Swarm | 0.40 | | Harpy | 0.30 |
| Roc | 0.40 | | Griffon | 0.28 |
| Air Elemental | 0.35 | | Pegasus | 0.26 |
| Couatl | 0.34 | | | |

The rule is "spends its time in the air", not "can leave the ground", and the
exclusions are written into the comment so the next session does not have to
re-derive them: the gargoyle perches, the mephits are ground skirmishers here,
and the undead floaters are drawn standing. All are one number when the art
wants them. Everything stays under half a tile so the shadow is still legible
under the creature and it still reads as occupying its own tile.

**The final-boss dragon is deliberately left at 0.** It is the one creature with
`flies`, so it is the obvious candidate, but its fight is tuned and its sprite is
bespoke, and Phase 5's own checklist ends with "re-check dragon balance". Giving
the Emperor altitude is a decision for the USER, not a side effect of this pass.

`flies` and `hover` are provably independent: `flies` is on one creature and
`hover` on nine, and the intersection is empty. Checked at runtime, not just by
eye.

**Where the ease runs matters.** `stepEnemies` gates on a per-enemy step cadence
(`e.timer`, 350 to 1000 ms), so easing altitude inside that gate would climb in
one-third-of-a-tile jumps a few times a second. The call sits at the very top of
the loop, ahead of every `continue`, and dormant and staggered enemies are still
stepped so they settle back DOWN rather than hang in the air.

**Save shape.** `hover` and `z` are written in the fresh-spawn branch beside
`flies`, and normalised for both branches in the reconcile block that already
existed for the corruption sync. `enemyHoverTarget` additionally falls back to
the type table, which is not redundancy for its own sake: guild elites and the
Man-Eater bounty are injected into `enemies` AFTER that reconcile pass runs, so
an instance-only lookup would leave a guild-quarry harpy sitting on the floor.

Verification performed, from `file://` on the "Oblique Fixture" save:

- **Nothing outside the renderer reads altitude.** Grepping `e.z` across the tree
  returns exactly two sites, both in `drawEnemy`. No collision, targeting, reach
  or pathing code touches it, which is the plan's hard invariant made checkable
  rather than merely asserted.
- **And confirmed live, not just structurally.** A hovering Griffon at z 0.28
  still lands contact damage through the real `stepEnemies` melee branch (player
  999 to 991 HP) and still takes damage normally. Worth knowing: this test is
  what produced the one late console entry in the whole phase, headless Chrome
  refusing `navigator.vibrate` without a user gesture. That is the harness having
  no tap to react to, not a game fault, and it is incidental proof the hit went
  through the real damage path.
- **Ground creatures are untouched, and provably so.** In a mixed scene of two
  ground creatures and three airborne ones, diffed against a reconstructed
  pre-5b build: 11,285 differing pixels, bounding box `x 510..853`. The airborne
  columns sit at x 507, 651 and 795; the Goblin at 267 and the Wolf at 363 are
  outside the box entirely. Their z is `Object.is(z, 0)` exact, so their draw
  path is bit-identical to before.
- **The ease behaves.** A Griffon starts at 0.022 on its first frame and settles
  on exactly 0.28; a Roc settles on exactly 0.40. Both reach their target and
  stop, rather than approaching it forever, which matters because an
  asymptotically drifting z would keep the shadow's alpha changing in its last
  decimal every frame.
- **Dormant rests on the ground.** A dormant Griffon sinks to exactly 0 and rises
  back to 0.28 on waking.
- **Old rosters load.** An enemy record with neither field, which is what every
  save written before today holds, yields target 0.32 from the type table, a
  finite z after one step, and a finite lift when multiplied by TILE_PX.
- **Geometry.** A Will-o'-Wisp at hover 0.50 lifts its box exactly 24.00 px at
  TILE_PX 48, which is the predicted `0.50 * 48`. Its shadow stays on the ground
  (identical centre Y) and tightens from 7.2 to 3.96 px radius.

`ensureConnectivity` is untouched by construction: 5b adds no tiles, changes no
tile ids, and does not go near `SOLID_TILES` or `isSolid()`. The fixed-seed
regeneration check in this phase's list belongs to 5d, which is the substep that
actually introduces tiles.

USER judgement wanted: whether the nine heights read right, and whether the
final-boss dragon should join them.

### 5c: bomb arc and the projectile height gate

Two deliverables. **They both landed and they deliberately do not yet meet**,
which is the one thing to understand about this substep before reading further.

**The arc.** A bomb used to APPEAR three tiles ahead of the hero with
`vx: 0, vy: 0`. It is thrown now and travels there on a ballistic arc, peaking at
0.896 tiles at frame 9 of a 16-frame flight. The launch speed is derived, not
authored: integrating `z += vz; vz -= g` over n steps from 0 gives
`z(n) = n*vz0 - g*n*(n-1)/2`, so `vz0 = g*(n-1)/2` brings it back to the ground
exactly as the flight ends. Written that way so tuning either constant cannot
desync the pair and leave the bomb landing above or below the floor. Same gravity
idiom as `stepParticles`, per the plan, so there is one model of a falling thing.

**The landing is snapped, not summed.** When the flight ends the bomb is written
to its stored `destX/destY` rather than being left wherever a float sum over a
variable number of frames put it. That is what makes the detonation coordinate
provably the same as before rather than approximately the same.

**The gate.** `projectileBlockedAt(map, c, r, z)` replaces the flat solid test.
Two guards make it identical to what it replaces while every projectile is still
flat, and both are load-bearing:

1. The solid test stays IN FRONT of the height compare. The ~35 passable low
   props carry a real height for the renderer and have never blocked a shot, so a
   pure height compare would have a fern eat an arrow.
2. **A shot at z = 0 is blocked by everything solid, without consulting the
   table at all.** This is the one that is easy to get wrong: solid does NOT
   imply tall. Liquids are solid and are listed at 0 on purpose, so a bare
   `TILE_HEIGHT[t] > z` compare would have started letting arrows sail across
   lava and deep water. **97 of the 17,950 solid tiles on the fixture map are
   height 0**, so this was not a theoretical concern.

`!(z > 0)` rather than `z <= 0`, so a NaN z reads as blocking rather than as a
projectile that passes through the world. Out of bounds returns true before the
table is touched, since it is solid with no tile to measure.

**Why the two do not meet.** The bomb is still not terrain-tested in flight. It
has always sailed over whatever stood between the hero and its landing tile,
walls included, and routing the flight through the gate would stop it at any wall
taller than 0.896. That moves where bombs land, which is a gameplay change, and
the plan's whole framing of 5c is that shipped ranges must not move. So the gate
is in place and correct at the site the plan names, and nothing in live play
exercises it yet. **Connecting them is a one-line change and a USER decision**:
delete the early return's exemption and a thrown bomb starts bouncing off walls
instead of clearing them.

Verification performed, from `file://` on the "Oblique Fixture" save:

- **The gate is a no-op at z = 0, checked exhaustively rather than by sampling.**
  Every one of the 22,500 tiles on the real map was tested with the old
  expression and the new function side by side: **0 mismatches**, 17,950 of them
  solid.
- **The gate is right with altitude.** Over a ROCK (0.40): blocked flat, blocked
  at 0.30, clears at 0.50. Over a WALL (1.60): blocked flat, still blocked lobbed
  at 0.90, clears at 1.70. Over LAVA (0, solid): blocked flat, clears at 0.50,
  which is correct, a lava channel is a surface and not a wall.
- **Out of bounds still stops a shot**, at z = 0 and at z = 9.
- **The arc is symmetric and lands exactly.** z rises 0 to 0.896 over 8 frames and
  falls back symmetrically, landing on frame 17 on exactly x 78.5, the aimed
  coordinate to the last bit.
- **Detonation is unchanged, measured against a reconstructed pre-5c build.**
  Both builds: detonates on frame 50, at [78.5, 48.5], for 8 damage.
- **Existing shots are unchanged, measured the same way.** An arrow fired into a
  laid wall run dies on frame 13 at [79.7, 48.5] on both builds.

Small deliberate visual addition: the thrown bomb casts a ground shadow, at its
own underside (yFrac 0.72) rather than an actor's foot plane. Without it the bomb
reads as sliding up the screen rather than rising, so the shadow is what actually
sells the throw.

Rig note earned here: when a probe freezes `Date.now`, the hero disappears from
screenshots if he is invincible. `drawPlayer`'s blink is
`floor(Date.now()/80) % 2`, so a frozen clock pins him to one half of it, and at
this fixture's timestamp that is the hidden half.

### 5d: ledges

**SOLID_TILES was appended to, with the USER's explicit approval, after asking.**
The standing constraint says never to touch it, but the plan requires a solid
ledge face, so the two could not both be honoured silently. The resolution: the
danger the constraint protects against is RECLASSIFYING existing tiles, and
`config.js` itself says "Add a blocking tile here once and both stay in sync".
`T.LEDGE_FACE` is purely additive, no existing entry moved, and no generator
emits the id, so it appears in zero tile arrays and the flood-fill's inversion is
unchanged. That was then measured rather than argued (see below). `isSolid()` and
`connectivity.js` remain untouched.

**Two tiles, 189 and 190**, leaving 65 ids before the `Uint8Array` assumption
dies at 256.

- `T.LEDGE` passable, height 1.00, the walkable top.
- `T.LEDGE_FACE` solid, height 1.00, the vertical face at the southern rim.

`surfaceZ()` gains its one documented exception: LEDGE reports its height despite
being passable, because it is the only tile you stand ON TOP OF rather than walk
THROUGH. Every other passable tile still reports 0, so the fern rule is intact.

**Height is split into two fields, not one.** `player.groundZ` is the surface
underfoot; `player.z` is the hop plus any remaining drop above it. Combining them
would have been simpler and wrong: the sprite is lifted by the SUM, but the
shadow is painted on the surface at `groundZ` and shrinks only with `z`, so a
hero standing on a shelf casts a full shadow on the shelf instead of a shrivelled
one on the ground a tile below him. `groundShadow` gained an optional `baseZ` for
exactly this, defaulting to 0, which is what every pre-5d caller means. Enemies
carry the same split.

**groundZ is derived, never assigned by movers.** It is recomputed from the tile
every frame inside `stepPlayerJump`. There are a dozen ways the hero changes tile
(walking, map transition, respawn, a whirlpool spit, loading a save) and having
each remember to update a height field is how one of them ends up forgetting. A
stale `groundZ` from a save is corrected on the first stepped frame.

**Both halves extrude.** The face tile alone would give a shelf a raised rim with
a flat interior behind it. Since both carry the same height, the existing
`southTall` test suppresses the interior's faces and leaves exactly one face at
the rim.

Verification performed, from `file://` on the "Oblique Fixture" save:

- **The connectivity check, and the rig lesson that made it real.** 22 maps were
  generated from fixed seeds on a reconstructed pre-5d build and on the current
  one: two forest, two desert, two village, cave, intact Elderbrook, the ruin,
  and all 13 regions. Result: **byte-identical grid hashes and identical sealed
  TREE counts on all 22**, and both ledge tiles absent from every one.
- **That check was worthless on the first two attempts and the self-check is
  what caught it.** The plan and the project skill both say generation ignores
  its seed and runs on bare `Math.random`, so the first version stubbed
  `Math.random`. Rendering the same build twice then produced DIFFERENT maps.
  **The skill is out of date on this point**: `beginSeededGeneration` /
  `endSeededGeneration` (map-helpers.js) now swap the module-level stream that
  `genRandom()` and `rnd()` actually read, and that is the mechanism a seeded
  replay has to use. With both pinned, same-build-twice is identical, and only
  then does the cross-build comparison mean anything. Prove the rig first.
- **Nothing existing moved.** The fixture frame is **0 differing pixels of
  843,942** against the pre-5d build.
- **The step-up gate holds.** Walking the hero east into a shelf for 90 frames
  leaves him exactly where he started. A ledge is a full tile and STEP_UP_MAX is
  0.50, so it cannot be climbed and he has to find a ramp or a way around.
- **Standing is right to the pixel.** On the shelf `groundZ` is 1, the sprite
  lifts exactly 48.00 px at TILE_PX 48, and the shadow is the same size as on
  flat ground and raised 48.00 px onto the shelf.
- **The drop is a drop, not a teleport.** Stepping off carries 0.945 of a tile
  into the fall and decays to 0 over 5 frames under gravity. The TILE moves
  immediately, so gameplay never waits on the animation.
- **Enemies obey the same gate.** A goblin pursuing a hero standing on the shelf
  never once occupied a LEDGE tile across 200 steps.

The lit lip on the shelf's top edge is drawn only where the shelf actually ends,
because giving every row its own lip stripes a multi-row shelf into terraces.
That makes the art neighbour-dependent, which is safe ONLY because neither ledge
tile is in `CACHEABLE_TILES`, checked. If either is ever added there, that lip is
the thing that breaks first, and it is Risk 1 in the plan repeating itself.

**No generator emits either tile.** Placement is level design and belongs to
Phase 6. That is deliberate and is what keeps the risk at the "low as scoped"
end: the plan is explicit that converting existing CLIFF, PLATEAU or MOUNTAIN
into standable terraces would change traversability on every desert and earth
map, and that remains a separate project.

### /code-review of the whole conversion

Run over the entire uncommitted diff, Phases 1 through 5, about 1,244 insertions
across 17 files. Seven findings, all real, all fixed. The two that mattered were
both in 5d and both were mine from the same session.

**1. The ledge/face split did NOT make the flood-fill truthful, and the comment
claiming it did was wrong.** `connectivity.js`'s `passable()` is
`!SOLID_TILES.has(tile)`, so a passable LEDGE is enterable by the flood from all
four sides, while the step-up gate refuses that same step from any lower tile.
LEDGE_FACE only covers the rim a designer puts it on. Face the south rim alone
and the flood strolls in from the east, west or north, routes through the shelf
to whatever is behind it, and `ensureConnectivity` leaves a pocket unsealed that
no player can reach: the PLATEAU hazard the design exists to avoid, relocated.

The fix is a real invariant rather than a warning:

- **T.CLIMB is now the sanctioned way up.** `isRampStep()` exempts a ramp step
  from the gate in BOTH directions, and suppresses the fall, so walking down a
  ramp is a descent rather than a one-tile pitch off the middle of a staircase.
  Ledges reuse CLIMB rather than inventing a second word for it.
- **`stampLedgeShelf()`** lays a shelf with its ENTIRE perimeter faced and ramps
  where you ask for them, so the flood reaches the top exactly where the hero
  does. Correct by construction, measured: a 4x4 shelf with one ramp gives 4
  interior LEDGE, 11 FACE, 1 CLIMB and **0 unfaced edges**.
- **`findUnfacedLedgeEdges()`** audits a map built any other way. Fed the
  south-rim-only shelf that provoked the finding, it returns **8 offending
  edges**. Not called in the game loop; it is a level-design check for Phase 6.
- The `T.LEDGE` comment in config.js now states the invariant instead of
  claiming a guarantee the code did not provide.

**2. Ledges only rendered as ledges on the oblique pilot map.** `drawTileExtrusion`
was reachable only through `drawDepthLayer`, gated on `isObliqueMap`, but
`surfaceZ` and `groundZ` apply everywhere. A ledge on any other map would have
drawn flat while still lifting the hero a full tile, and LEDGE_FACE would have
been an invisible wall wearing the shelf-top art.

Walls staying flat off-pilot is fine, because a flat wall still reads as a wall.
A ledge is different in kind: its height IS the gameplay. So ledges now extrude
on every map, through a separate memoized `mapLedgeTiles()` list. Measured
off-pilot: **0 extrusion calls on a map with no ledges** (so it costs nothing on
the ~100 maps that will never have one), **15 on a map with a 4x4 shelf**, and
the list contains ledge tiles only, so walls are still flat everywhere but the
pilot.

The other five, each fixed:

3. **`findPathToGoals` did not know the step-up rule.** Its `passable()` ended at
   `!isSolid()`, so tap-to-travel routed straight over a shelf, jammed the hero
   against it and cancelled 1.6s later on the stuck timer. The BFS now tests the
   STEP as well as the tile. Verified: with a shelf walling the corridor it
   returns an 11-step route that does not touch a single ledge tile.
4. **`playerFallZ` survived a teleport.** A drop in progress carried across a map
   transition, a respawn or a load, so the hero arrived floating and sank.
   `stepPlayerJump` now drops a stale fall when the hero moved more than one tile
   since the last frame, detected in the same place `groundZ` is derived rather
   than wired into the half-dozen call sites that could forget. Verified both
   ways: a teleport clears it, a real walked step still falls.
5. **`stepEnemyHover` read `mapData()`** while `stepEnemies` resolved movement
   against its `map` parameter. Now passed through, so height and movement can
   never come from different grids.
6. **The ledge heights had been spliced into the middle of the "liquids are
   listed at 0" comment**, inverting its meaning. Moved above it.
7. **"max T today is 188" was stale.** It is 190, and the comment now says so and
   says why it must be maintained: it is where the tile-id budget is read from.

`STEP_UP_MAX` moved from player.js to map-helpers.js as part of fix 1/3. It is
not the hero's rule; the hero, enemies and the pathfinder all measure against it,
and a movement constant owned by one of three callers is one refactor from
drifting.

Regression after all seven: the fixture frame is **0 differing pixels of
843,942** against the pre-5d build, and the **22 seeded maps still regenerate
byte-identically**. All four phase probes (5a through 5d) still pass with a clean
console from `file://`.

### Dragon balance re-check (enemy-forge)

**Phase 5 moved nothing about the dragon fight.** Checked rather than assumed:

- **5a**: nothing in `tower.js` or `abilities.js` reads `.z` at all.
- **5b**: the dragon was deliberately left at `hover: 0`, and `flies` is untouched.
- **5c**: the breath spawns with `overWalls: true`, so it takes the bounds-only
  branch and never reaches `projectileBlockedAt`. The hero's arrows do reach it,
  at z 0, where it is bit-identical (0 mismatches over 22,500 tiles).
- **5d**: the enemy step-up gate is `!e.flies && ...`, so a flier is exempt.

**The re-check found a real defect, but in the SKILL rather than the dragon.**

The skill's effective-DPS table gave dragon breath as `5 * dmg * 1000 / 2850`,
on the assumption that a 5-projectile fan all lands. It cannot. `stepProjectiles`
gates a projectile hit on `player.invincible <= 0` and sets `player.invincible =
800` on connect, so the first shot of a fan to reach the player eats the entire
volley and the other four pass through harmlessly. The skill documented that
i-frame ceiling for melee (900 ms) and missed it for projectiles (800 ms).

Measured over 30 s against an unarmoured, unmoving player:

| | value |
|---|---|
| volleys fired | 11 |
| projectiles spawned | 55 |
| **hits landed** | **11** |
| damage per hit | 40, every time |
| **actual DPS** | **14.67** |
| skill's predicted DPS | 70.18 |
| overstatement | **4.78x** |

The skill is corrected: the breath row is now `dmg * 1000 / 2850`, with the
projectile i-frame written up beside the melee one and the measurement quoted.
This mattered beyond bookkeeping, because any future breath enemy costed against
the old row would have shipped with roughly five times its intended threat.

**The dragon's own stat block needs no change.** Measured time-to-kill against
its 2200 HP, running the real `doSwordSwing` path:

| loadout | hits to kill | seconds | damage taken if never dodging |
|---|---|---|---|
| bow lv15 | 71 arrows | 24.8 | 364 |
| sword lv15, plain | 107 swings | 30.0 | 440 |
| sword lv15 + Dragonbane | 43 swings | 12.0 | 176 |
| sword lv25 + Dragonbane | 33 swings | 9.2 | 135 |

Player HP at the tower is about 50 (level 12, 4 heart containers) to 70 (level
14, 8). The XP curve puts the hero around level 12 to 13 there, and the dragon
itself awards 125,000 against the roughly 401,000 cumulative needed for level 12.

So the fight allows **one or two breath hits total**, and the asymmetry between
the weapon paths is the whole design: the bow keeps you at the range the dragon
prefers and asks you to stay perfect for 25 seconds, while the Dragonbane sword
cuts that to 12 seconds and roughly halves the incoming total. That reads as
intended, since the Dragonbane is the capstone anti-dragon weapon and the fight
is where having built it pays off. Nothing here is out of line and no numbers
were changed.

**Anchoring, stated plainly as the skill requires: this is NOT anchored to a
user-confirmed reference enemy.** The repo still has none. The verdict above is
internal-consistency and time-to-kill arithmetic against the shipped numbers, not
a claim that the fight feels right. That remains a USER playtest call.

## USER judgements, all answered

Recorded here so no later session re-opens a settled question.

| item | phase | answer |
|---|---|---|
| Losing "player always on top" | 4 | **Preferred.** The new depth ordering is the wanted behaviour, not a regression to tolerate. |
| Beat 3 49px sliver | 2 | **Accepted.** No further work; restoring parity would move the ellipse ~174px. |
| Ramp shadow no longer pulsing | 5a | **Accepted.** |
| The nine hover heights | 5b | **Approved.** |
| Dragon's own hover | 5b | **Deferred** by the USER to "the appropriate time". Not open, not refused. The balance re-check found no obstacle: nothing in that fight reads z. |
| Thrown bombs vs walls | 5c | **Changed: terrain at or above 1.60 now stops a thrown bomb.** See below. |
| Phone check at TILE_PX 24 | 4 | **ON HOLD.** The only thing still outstanding in the whole conversion, and the one thing Claude structurally cannot do. |

### Bombs are now stopped by walls

The 5c pass deliberately left a thrown bomb sailing over anything between the
hero and its landing tile, because changing it moves where bombs land. The USER
has now called for the change, at a threshold of 1.60 rather than the literal
"taller than 2" first suggested. That distinction mattered and was worth pausing
on: **T.WALL is 1.60, so a strict `> 2` would have excluded every wall in the
game** and stopped bombs only with mountains and giant trees, which is the
opposite of what "walls stop the bomb" means.

`BOMB_THROW_CLEARANCE = 1.60` is a deliberate threshold, NOT the arc's own
height. The bomb only reaches 0.896, so letting its arc decide would have it
turned back by a PLATEAU (1.20), a CLIFF (1.40) and a row of waist-high
furniture. The rule is that a bomb clears terrain and is stopped by built things.

It routes through the same `projectileBlockedAt` gate arrows use, passing the
clearance instead of the arc height, so there is one answer to "does this terrain
stop a projectile" rather than a second rule that can drift. On a block the bomb
drops where it was the instant BEFORE, and destX/destY move with it so the
landing snap cannot pull it forward through the thing that just stopped it.

Verified from `file://` on the fixture:

| | |
|---|---|
| stops it | WALL, CAVE_WALL, SHRINE_GATE, CASTLE_WINDOW (1.60), TREE (1.80), PILLAR (2.00), MOUNTAIN, GREAT_TREE (2.20) |
| clears through | CLIFF (1.40), PLATEAU (1.20), BURNT_WALL (0.50), ROCK (0.40), RUBBLE (0.35), TABLE (0.55), LAVA, DEEP_WATER (0) |

- **An unobstructed throw is completely unchanged**: still lands on exactly x
  78.5, still detonates on frame 50, still 8 damage, matched against the
  pre-5c build. The arrow parity case is unchanged too (frame 13, x 79.7).
- **The bomb never rests inside what stopped it**: against a wall on tile 77 it
  comes to rest at 76.813.
- Fixture frame still **0 differing pixels of 843,942** against pre-5d.

Consequence worth knowing, and it is a real gameplay change rather than a
rendering one: **bombing through a wall is over**, and a bomb thrown at a wall
you are standing next to now stops about a tile away, well inside the 2-tile
blast. Throwing one at a wall in your face will hurt.

## Phase 6: Re-art Elderbrook

Run as three chunks, reported separately, same shape as 5a-5d:
**6a** the atlas, **6b** the foot-anchored sheet, **6c** the pilot extrusions.

- [x] 6a: Emit hero-atlas.js assigning a global, replacing the hardcoded frame constants
- [x] 6b: Regenerate hero-sheet foot-anchored (taller frame, known foot row)
- [x] 6b: Update the three coupled constants together: HERO_BODY_OX/OY and heroSwordTip
- [x] 6c: Extrude tree for the pilot (wall was done in Phase 3)
- [x] 6c: The house notches (doorways derive their height from their wall)

**The checklist order was inverted deliberately: the atlas came first.** Doing
the sheet first means hand-editing the frame constants in hero-sprite.js to match
the new geometry, then deleting them a step later when the atlas lands. With the
atlas already in place, 6b's new frame size and foot row flow out of the
generator on their own. That is exactly the drift the old hero-sprite.js header
warned about ("change these constants in the same edit"), so removing the hazard
before doing the thing that would have triggered it was worth the reorder.

### 6a: hero-atlas.js

**The generator emits it**, rather than a second tool parsing the sheet back.
`tools/make-hero-sheet.lua` already owns every one of these numbers (W, S, OX,
OY, DIRS, KINDS), so writing them out from there means the atlas cannot describe
a layout the generator did not author. It is written by step 1, beside the
`.aseprite`.

A `.js` file assigning a global, not the `.json` Aseprite emits, because the game
opens from `file://` where fetch and XHR cannot read a sibling file.
`hero-sheet.json` stays a build artefact for humans.

`hero-sprite.js` lost its hardcoded block: `HERO_FRAME`, `HERO_BODY`,
`HERO_BODY_OX/OY`, `HERO_COLS`, `HERO_DIR_ROW` and the whole six-entry
`HERO_ANIMS` table now come from `HERO_ATLAS`.

Verification:

- **The sheet pipeline is untouched.** Regenerated all three outputs to scratch
  and SHA256-compared: `hero-sheet.aseprite`, `hero-sheet.png` and
  `hero-sheet.json` are all **byte-identical** to the committed files, so adding
  the atlas emission changed nothing about the art.
- **The atlas reproduces every replaced constant exactly.** Asserted one by one
  at runtime: frame 64, body 48, bodyOX 8, bodyOY 7, cols 21, the four direction
  rows, and all six animations with identical `[start, count, ms]` triples. Zero
  mismatches. The animations also fill the 21-column row exactly, with no gap or
  overrun.
- **Pixel-identical**: the fixture frame is 0 differing pixels of 843,942
  against the pre-5d build, with the hero drawn from the sheet.
- **A missing atlas is survivable, tested by deleting it.** In a build without
  `hero-atlas.js`: the only console entry is the expected 404, `HERO_ATLAS_OK` is
  false, `heroSheetReady()` returns false, the save still loads (Elderbrook,
  "Fixture"), and `render()` completes without throwing. The hero simply draws
  procedurally, which is the same contract the file already had for a missing
  PNG. Guarded in `ensureHeroSheet` and `heroSheetReady` rather than at the
  property reads, so a bad atlas degrades instead of killing the game.

Also fixed in passing: the generator's header claimed "idle(2) + walk(4) +
sword(5) = 11 frames, four directions, 44 frames total". It has been 21 and 84
since the unarmed set and the punch were added.

`index.html` is now 46 scripts, with `hero-atlas.js` immediately before
`hero-sprite.js`; SKILL.md's list updated in the same change, per Risk 7.

### 6b: the foot-anchored sheet

Frame **64 to 96**, body still 48, origin 8,7 to **24,24**. Two real defects
behind it, both measured off the old sheet rather than assumed:

1. **The hero floated.** The art's boot soles stop at 0.96 of the body box, but
   the renderer planted the box BOTTOM on the ground, so she hovered
   `(1 - 0.96) * 48` = **1.92px** at TILE_PX 48, and the amount varied by frame.
2. **The 64px frame was too small and poses were being cut.** Art reached x=0,
   x=63 and y=0 in three of the four direction rows. `heroSwordTip`'s own
   comment already admitted it: the drawn blade is "shorter than the 1.25 tiles
   the hitbox uses, because the full reach does not fit in a 64px frame."

**FOOT_F = 0.96 is now named in the generator, used to place the boot sole, and
shipped in the atlas.** `hero-sprite.js` plants that row on the tile's bottom
edge instead of the box bottom, through a shared `heroBodyOrigin()` that
`heroSwordTip` uses too, so the blade FX cannot anchor to a different origin than
the body holding it.

**The trap this uncovered, which is the reason the frame could not simply be
enlarged.** The sword and fist were authored in FRAME-ABSOLUTE pixels
(`SW_CX, SW_CY = 32, 30`, `IDLE_PIVOT = {23,34}/{41,34}`, and `drawFist`'s
`cy0 = 30`), while every other part of the body is a fraction of the body box.
Growing the frame moved the body down and left those two behind, tearing the
fist and blade off the arm. It was invisible before only because those literals
happened to equal the right points under the old 64px geometry.

Diagnosed by dumping pixels rather than reading code: the offending row-0 pixels
were **byte-identical at two different frame sizes**, which natural overhang can
never be, and they were skin and outline colours at the top of an "up"-facing
punch, i.e. the thrust fist.

Every one of those literals is an exact fraction of the 48px body
(`X(0.5) = 32`, `Y(23/48) = 30`, `X(15/48) = 23`, `Y(27/48) = 34`), so the
conversion is exact rather than a re-tune. `SW_HILT` and `SW_LEN` were
deliberately NOT converted: they are LENGTHS, and the body is still 48px at any
frame size, so a distance in pixels is still the distance it was. Only positions
had to move.

Verification:

- **The absolute-to-relative conversion is provably exact.** Regenerated with
  the frame put back to 64 and the origin to 8,7: `hero-sheet.png` comes out
  **byte-identical to the previously committed sheet**. So the conversion
  changed nothing about the art, only what it follows. That check is the whole
  reason to trust the 96px output.
- **Nothing is clipped any more.** At 96 the art spans y 13..78 and x 15..80,
  and **no frame touches any edge** (it was several frames per row before). The
  blade needed 11px of headroom and had 8.
- **The feet are on the ground**, confirmed by magnified before/after shots with
  the tile's bottom edge drawn across them: before, the soles stop about 2px
  short; after, they sit on the line.
- **The change is confined to the hero.** Fixture frame diff pre-6b vs post-6b:
  5,532 pixels in a 102x113 box centred on her tile. The rest of the frame,
  including all 12 villagers on the procedural path, is untouched.
- Phase 5a's jump checks still pass unchanged (arc symmetric, returns to zero,
  stale z cleared on load, renderer still pure).

Sheet is now 2016x384 (was 1344x256). `hero-sheet.json` regenerated with it.

### 6c: pilot extrusions

`T.TREE` added to `EXTRUDED_TILES`. Walls were already done in Phase 3, so the
tree was the outstanding half of "extrude tree, wall, house".

**The tile census changed what this substep actually is**, and it is worth
recording because the plan's Phase 3 note is out of date on it:

| tile | count on the ruined pilot |
|---|---|
| TREE | **16,092** |
| BURNT_WALL | 1,606 |
| CASTLE_WINDOW | 1 |
| STORE_DOOR / INN_DOOR / HERB_DOOR | 1 each |
| WALL / DOOR / SMITH_DOOR | 0 |

Two things follow. First, **the 16,092 trees are overwhelmingly
ensureConnectivity's seal**, not planted scenery: the flood converts every
unreachable passable tile to T.TREE, so 71% of the map is the sealed mass
outside the village. Extruding TREE therefore stands up a forest wall framing
the playable area, which is a much bigger visual statement than "the pilot's
trees have height". Second, **Phase 3's note about "16 doors plus one
CASTLE_WINDOW" describes the INTACT prologue village**. The ruin the player
actually inhabits has 4 such tiles, because the fire took the rest. The house
notch work is a quarter the size it was written up as, and it is invisible on
every post-prologue save except in four places.

Measurements, interleaved A/B with `drawTileExtrusion` stubbed as the control
(the same control Phase 3 established, since swapping `mapObj.type` also
disables roofs and shop signs and would time two different scenes):

| zoom | extruded per frame | render() with | without | cost | us/tile |
|---|---|---|---|---|---|
| TILE_PX 48 | 62 | 0.675 ms | 0.525 ms | +0.150 ms | 2.42 |
| TILE_PX 24 | 416 | 2.350 ms | 1.600 ms | +0.750 ms | 1.80 |

So 2.35 ms of a 16.7 ms budget zoomed out, 14%. The per-tile cost lands close to
Phase 3's ~1.5 us estimate. Only 62 and 416 tiles draw per frame because the cull
window does its job; the other ~17,000 never reach the rasteriser.

Worth flagging for whoever tunes this next: the memoized tall-tile list is now
**17,698 entries**, and the depth merge walks all of it every frame regardless of
culling. That iteration sits in the baseline column above, not the cost column,
so it is not visible in the delta. It is the thing to look at first if the
zoomed-out frame ever needs reclaiming.

**The seal-tree question went to the USER and the answer was that the trees read
correct.** So TREE extrudes everywhere on the pilot, sealed mass included, and
the forest wall around the village is intended rather than tolerated.

### 6c: the house notches

Doorways (`DOOR`, `STORE_DOOR`, `INN_DOOR`, `SMITH_DOOR`, `HERB_DOOR`) and
`CASTLE_WINDOW` now extrude, closing the gaps Phase 3 left punched through
otherwise standing wall runs. They are handled apart from every other extruded
tile in three ways, each for a reason:

1. **Height comes from the wall, not the table.** A door is exactly as tall as
   the wall it is set into and nothing else, so `extrudedHeight` takes the max
   over its WALL and BURNT_WALL neighbours. That is also what makes it correct in
   both village layouts at once: 1.60 in the intact prologue village, and in the
   ruin it matches whatever actually stands, so a doorway in a burnt run that
   collapsed stays flat WITH it instead of standing alone in the rubble. No
   recursion is possible: only wall tiles are consulted, never another doorway.
2. **It wears the wall's masonry**, not its own colour, for the face and the cap.
   What sits above a door is a lintel and more wall, never a door lying on its
   back.
3. **Its own art is drawn on the FACE, at the foot.** The face band runs from
   `faceTop` down to `y + ts`, so the tile's own square is the bottom of it, and
   drawing the door at its normal position lands it standing on the ground with
   masonry above. Deliberately not an overlay pass, so it paints a solid panel
   set into the stone rather than a translucent sketch with wall showing through.

Verified on the INTACT village, which is where this is actually visible (the ruin
has only 4 such tiles; the fire took the rest): **17 doorways found, all 17
deriving height 1.60 from their wall, 0 orphaned** with no wall neighbour. The
wall run screenshots as continuous masonry with an opening set into it.

`EXTRUDED_TILES` is now WALL, BURNT_WALL, LEDGE, LEDGE_FACE, TREE, and the six
doorway types.

---

## Standing constraints

These do not expire and are repeated here so a cold session sees them:

- Never touch `SOLID_TILES`, `isSolid()` or `connectivity.js`. That constraint is
  the whole reason ledges use new tiles instead of making plateau tops walkable.
- No em dashes anywhere: chat, markdown, code comments.
- Project rules hold: no ES modules, no fetch, no build step, no dependencies.
- Verify from `file://` directly, not only the localhost:8765 server, and always
  load an existing named save rather than starting a new game.
