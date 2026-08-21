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

> **Every box below is ticked, and the conversion is still not done.** On
> 2026-08-16 the USER played it and reported it does not feel different, and an
> audit confirmed that outside the prologue's Elderbrook the game still renders
> through the flat path. The boxes are accurate: that work was really done. What
> they do not capture is that the pilot gate was never widened and no level was
> ever authored to use the Z axis. Do not read a fully ticked file as "nothing
> left". Go to "What actually shipped" and "What feeling 2.5D requires" in
> `oblique-conversion-plan.md`, which are now the live sections.

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

Four things item A added to the rig, all of which cost a wrong answer first:

- **`canvas.toDataURL` throws.** The sprite sheets are `file://` images, so they
  taint the canvas and export is a `SecurityError`. `Page.captureScreenshot`
  goes through the compositor and is not subject to that. `sweep.js` renders a
  whole table of scenes in ONE page load and photographs each, which is how a
  "nothing else changed" claim gets hashed instead of reasoned about.
- **Stubbing `Math.random` does not make generation reproducible.**
  `map-helpers.js:42` does `let _genRandom = Math.random` at module load, before
  any probe can run, so the ~150 `rnd()` call sites keep drawing from the native
  generator no matter what the probe assigns. Measured: `buildVillageMap`
  consumes **zero** draws from a stubbed `Math.random`, and three builds under
  one reseed gave three different maps. Wrap generation in the game's own
  `beginSeededGeneration(seed)` / `endSeededGeneration(prev)` instead: three
  builds then hash identically and a different seed hashes differently. Only
  `mapgen-biomes.js` calls that pair today, which is exactly why overworlds were
  already reproducible and villages, caves, dungeons and towers were not.
- **Two renders in ONE page load are not comparable.** Ambient layers carry
  state that advances every frame (drifting motes, `render.js:1759`), so an A
  frame and a B frame taken back to back differ by ~0.1% of pixels at low
  amplitude whatever is being tested. Control: the same gate rendered twice in
  one load differed by 884 pixels. Run the A and the B as two separate LOADS
  with an identical call sequence, which is byte-reproducible: 15 of 15 scenes
  matched across two loads.
- **A positive control is mandatory, not a flourish.** See A0 below: the first
  version of the sweep was blind, and only the control revealed it.

`crop.js` writes a magnified crop of a region so an 88x48 change can be looked
at. It borrows `readPNG` from `pngdiff.js` and must take the channel count from
it: assuming 4 channels against a 3-channel screenshot produces vertical RGB
stripes, which is what it did the first time.

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

## Item A: cottage facades

The live work. Supersedes the ticked phases above. Full reasoning is in
`oblique-conversion-plan.md` under "What feeling 2.5D requires"; read item A
there, including its dependency note, before starting.

**The goal, in one line:** a player walking down a village street should see the
FRONTS of houses, not only their roofs. Success is the USER looking at a before
and after and not needing to be told where to look.

### A0: village roofs into the depth sort (do this first)

A facade hangs over the walkable tile row south of a house, and on a flat map the
roof pass draws after the player (`drawPlayer` at `render.js:3381`,
`drawForestVillageRoofs` at `render.js:3386`). Build the facade first and the
player gets painted over by the wall he is standing in front of.

- [x] Let `drawDepthLayer` run for forest village maps, NOT just `homevillage`
- [x] Keep wall extrusion off for them: this is the roof-sorting slice of C only
- [x] Confirm `drawForestVillageRoofs` early-returns for them, or roofs draw twice
- [x] MEASURE render() ms on Village of the Lost before and after, TILE_PX 48 and 24
- [x] VERIFY: player walking north past a cottage passes BEHIND its roof
- [x] VERIFY: every non-village map still renders byte-identically (hash the PNGs)

**Done when:** the depth sort is on for villages, nothing extrudes that did not
extrude before, the perf delta is recorded here, and the non-village hash check
is green. **All four met.**

**What changed.** A new `isDepthSortedMap` beside `isObliqueMap` in `render.js`,
and the three `isObliqueMap` call sites in the render path now ask the new one.
`isObliqueMap` is untouched and still means "does this map EXTRUDE", which is
the expensive half and stays item C. The new gate is the pilot plus forest
villages, matching `roofsApply`: a fire or ice village has no forest roofs to
sort, so putting it on the merge would reorder its actors for nothing.

`mapTallTiles` gained one condition. A map can now be on the merge without
extruding, so membership is no longer "is it tall" but "does this map stand this
kind of thing up": colossal trees and landmarks always, ledges always (their
height is gameplay, the same rule the flat ledge pass follows), and the rest of
`EXTRUDED_TILES` only when `isObliqueMap`. Safe to bake into the per-map memo
because `isObliqueMap` is a pure function of `mapObj.type`.

Third call site matters and is easy to miss: the flat renderer's colossal-tree /
landmark / ledge block is now gated on `!isDepthSortedMap`, not
`!isObliqueMap`. Left on `isObliqueMap` it would have drawn all three twice on
every forest village.

**Measured, on Village of the Lost, 40 roofs, 15 enemies, 12 villagers**,
interleaved A/B in one page load:

| zoom | merge on | merge off | delta |
|---|---|---|---|
| TILE_PX 48 | 1.028 ms | 1.020 ms | **+0.008 ms** |
| TILE_PX 24 | 3.020 ms | 2.960 ms | **+0.060 ms** |

0.4% of a 16.7 ms budget at the zoomed-out worst case. It is this cheap because
the village does not extrude: its tall-tile list is **14 entries**, not the
5,493 it would be if `EXTRUDED_TILES` applied, and the pilot's is 17,702.
`performance.now` is coarsened to 0.1 ms in this headless build, so each sample
times a batch of 25 renders and divides; timing single renders reports a delta
of exactly zero at both zooms and means nothing.

**The visual result**, hero standing one row south of a cottage door at TILE_PX
48: before, he is buried under the roof's eave shadow with his head and sword
clipped by the roof's south edge; after, he stands fully in front of it. The
diff is 3,510 pixels confined to an 88x48 box around him and **nothing else in
the frame moved**. Two rows south is byte-identical (the roof does not reach),
north is byte-identical (he is still behind it, since the roof's key is the
house's south row), and inside is byte-identical (`forestRoofVisible` drops the
roof either way).

**Counted rather than argued**, one frame each: forest village draws 2 roofs,
0 extrusions, 1 landmark, no roof twice, with the gate on AND off. The
Elderbrook pilot still extrudes 63 tiles. The fire village draws nothing new.

**The hash check, and the proof it can fail.** 15 scenes across villages,
overworlds in five biomes, a cave, a dungeon and a tower floor, rendered in one
page load and hashed:

- pre-A0 vs A0: **3 differ, 12 identical.** The three are the forest villages.
- pre-A0 vs `isDepthSortedMap = () => true` (item C, as a positive control):
  **12 differ, 3 identical.** Fire village, ice village, all five overworlds and
  the tower floor all move.

The control is not decoration. The **first** version of this sweep parked the
hero on open ground, and under it the forced-everything control changed 0 of 15
frames: there was nothing on screen whose order could differ, so a green result
proved nothing. The sweep now stands the hero one row south of a tall tile on
every map that has one. The two frames still identical under the control are the
cave and the dungeon, which have zero tall tiles, so there is genuinely nothing
there to reorder.

### A1: the facade itself

`drawForestHouseRoof`'s `familyHome` branch is the reference. It sets
`roofBottom = bottom - ts * 2.08` so the roof stops short of the south edge, then
builds a front elevation between `facadeTop` and `facadeBottom`.

- [x] Pull the facade out of the `familyHome` branch into a function taking the
      rect plus a size, so one body serves both instead of a second copy
- [x] Scale it: forest cottages are 9x7 tiles and the family home is much larger.
      A flat 2.08-tile facade eats a third of a cottage. Pick the fraction by
      rendering, not by arithmetic
- [x] Decide per-cottage detail level. The family home has two windows, four
      braces and two lanterns; a 9-wide cottage probably wants one window and no
      lanterns. Fewer, larger elements read better at TILE_PX 24
- [x] Use the village sheet for the material: `wall_face` and `door_face` are
      already authored and are currently reachable only through the extrusion
      path. See `drawVillageWallFace` / `drawVillageDoorPanel` in
      `village-sprite.js`
- [x] Keep the family home's own look unchanged. It is a tuned prologue set piece;
      if the shared function changes it at all, hash its frame before and after
- [x] VERIFY at TILE_PX 48 AND 24. The second is where detail turns to mush

**Done when:** USER looks at a street render and says it reads as buildings.
That judgement is theirs and cannot be made here. **Everything checkable is
checked; the verdict is outstanding and is A3.**

**What changed.** `drawForestHouseFacade(o, d)` in `render.js`, lifted out of
`drawForestHouseRoof`'s `familyHome` branch, plus a small detail table:
`FACADE_FAMILY` reproduces what that branch drew element for element and
`FACADE_COTTAGE` is the same body with less on it. `roofBottom` is now
`bottom - ts * facadeTiles` for every house rather than only the pilot.

**The fraction is 1.75 tiles**, against the family home's 2.08, picked by
rendering three whole trees at 1.40, 1.75 and 2.10 and looking at them at TILE_PX
24. 1.40 squeezes the door until it has no headroom and pushes the windows onto
the sill; 2.10 is top-heavy and opens a dark gap above the door. Every cottage in
Village of the Lost is 9x7, giving a roof rect of 7.65 tiles, so 1.75 takes 23%
of it.

`facadeDepthFor` clamps the facade so the roof keeps at least
`VILLAGE_ROOF_MIN_H`. Below that the sheet roof refuses the job and silently
falls back to procedural planes, so a short house would stop matching its
neighbours. Elderbrook's one 10x5 house is the case this exists for: a 5.65-tile
roof rect, which 1.75 leaves at 3.90 and a naive 2.08 would have left at 3.57.

**Cottage detail**, decided by rendering: sheet `wall_face` boards instead of the
plaster gradient, sheet `door_face` instead of the procedural planks, two windows
with flower boxes, the two OUTER braces only, no lanterns, no mullions. Two
windows rather than the predicted one: the facade is 8.72 tiles wide between its
posts, which holds two 1.36-tile windows either side of the door comfortably, and
one would have left the front lopsided against a centred door.

The door needed its own rule. Its opening ran the full height of the front, which
is right under the family home's 2.08 but on a cottage left half a tile of empty
jamb above the sheet panel, reading as a gap rather than a transom. `doorTiles:
1.30` anchors it at the threshold instead. The family home passes no `doorTiles`
and keeps the full-height opening.

Two new entry points in `village-sprite.js`: `drawVillageFacadeWall` (tiles
`wall_face` over a rect) and `drawVillageDoorPanelRect` (`door_face` at an
explicit rect, since the existing `drawVillageDoorPanel` is a square tile blit,
which is what an extruded wall's foot is and not what a door opening is).

**The family home is byte-identical.** Proved, not asserted. There was no pre-A1
copy of `render.js` in any scratchpad, so one was reconstructed from the original
source and the pixels were left to judge the reconstruction: the family home's
roof drawn ALONE, with every neighbour's suppressed by filtering the memoized
roof list, hashes the same in both trees at TILE_PX 48 and 24. A whole-frame hash
could not have answered this, because a frame centred on the family home also
contains ordinary Elderbrook cottages and those do change.

**A0 was a real dependency, and now there is a picture of it.** Hero standing on
a cottage doorstep at TILE_PX 48, one row south of the south wall: with the depth
sort off he is cut off at the shoulders by the threshold and sill, painted over
by the house he is standing in front of; with it on he stands complete in front
of the wall. 3,773 pixels differ, all inside an 88x51 box around him.

**Measured**, A/B by stubbing `drawForestHouseFacade` (the same control Phase 3
established), standing where the MOST facades are on screen rather than at a
fixed spot:

| zoom | facades on screen | with | without | delta |
|---|---|---|---|---|
| TILE_PX 48 | 4 | 1.324 ms | 1.148 ms | **+0.176 ms** |
| TILE_PX 24 | 7 | 3.020 ms | 2.528 ms | **+0.492 ms** |

About 44 us per facade at both zooms. Worst case 3.02 ms of a 16.7 ms budget.

**The 15-scene sweep still says 12 identical, 3 differ** against the pre-A0
baseline, the three being the forest villages. A1 only reaches maps `roofsApply`
accepts, so this is what it should say, and the positive control recorded under
A0 is what makes that mean something.

**Provisional, and A2's to settle:** the cottage gable's base moved from
`bottom` to `roofBottom`, so it sits on the roof's own south edge. Left where it
was it would hang down over the front wall it is supposed to shelter. At TILE_PX
24 it now reads as a large triangle high on the south slope, which is legible but
prominent.

### A2: the things a facade sits next to

Each of these already draws relative to the roof rect and will move when
`roofBottom` does.

- [x] Shop signs (`forestShopSignStyle`) hang beneath the front gable. Four shops
      per village, and they must stay readable and still point at the right door
- [x] The generic gable (`if (!familyHome)`, now sheet-drawn via
      `drawVillageGable`) overlaps the facade zone. It may become the porch roof,
      or it may go
- [x] Chimney and moss anchor to the south slope
- [x] `mapForestHouseRoofs` detection must be untouched: it scans doors and wall
      runs, not roof pixels, so it should be safe. Confirm rather than assume
- [x] `forestRoofVisible` hides a roof when the player is inside. Decide whether
      the facade hides with it (probably yes, or he is behind a wall he cannot see
      past)
- [x] Elderbrook is also a forest village and shares this code. Check both, in
      the prologue AND post-Ashfall

**Done when:** all six are checked and the prologue still plays through Beat 3
without a visual regression. **All six done.**

**Shop signs were genuinely broken by A1 and are fixed.** The board hung below
the house's SOUTH EDGE, centred on the door, which was right while a cottage was
a bare roof plane with open ground under it. A1 put a wall there and the board
went on hanging in front of it: floating on the grass, hooks buried in the sill,
reading as a signboard someone had propped against the lawn.

It hangs from the eave now, in the blank bay next to the door.
`drawForestHouseFacade` returns its geometry and `facadeSignSpot` picks the
wider of the two bays (right first, since that side is out of the eave shadow)
and works out how much the board has to shrink to fit. `drawForestShopSign`
takes a hang line and a scale instead of assuming both; the scale is applied as
a transform about the hanging point, so a narrow bay gets a smaller sign rather
than a squashed one. Measured on all four shops in Village of the Lost: **4 of 4
drawn, all at scale 0.845, all with the board inside the facade rect, clear of
the door and clear of the window.** A house too short for a facade falls back to
the old anchor, which is still correct for a bare roof plane.

**The gable stays, as a dormer.** It used to run from the eave to the ridge,
which was fine when it was the only thing marking a cottage's door. The facade
marks the door now, so a 2.9 by 3.5 tile spike was dominating the roof rather
than breaking it up. Capped at 1.75 tiles tall and still clamped so it can never
poke through the ridge on a squat roof. It did NOT become a porch: a canopy over
the door would have covered the top of the door it was meant to announce.

**Chimney and moss needed no change, which was checked and not assumed.** The
cottage chimney anchors to `top`, the roof's north edge, which item A never
moves. The moss anchors to `ridgeY`, which moves up with the shortened roof and
therefore stays on the roof, which is where it belongs. Both confirmed visible
and correctly placed at TILE_PX 48 and 24.

**`mapForestHouseRoofs` is untouched, compared rect by rect rather than by
count.** 40 houses in different places would still be 40, so the check dumps
every `c1,r1,c2,r2,doorC` and compares the strings: **identical in both trees**,
on Village of the Lost (40) and on intact Elderbrook (16), with the family home
still detected in both.

**The facade hides with the roof**, because it is drawn inside
`drawForestHouseRoof` and `forestRoofVisible` gates that. Counted:
`drawForestHouseRoof` fires once for a house when the hero is on its doorstep
and zero times when he is inside it, identically in both trees. That is the
right answer, and not only by default: a hero indoors would otherwise be looking
at the back of a wall he cannot see past.

**Elderbrook, both states.** Post-Ashfall is unaffected in full: `roofsApply`
returns false once `village_burning` or `prologue_complete` is set, so the ruin
has no roofs and therefore no facades, in both trees. This is worth stating
plainly because it is the state every existing save sits in: **item A changes
nothing the USER's current save can see on its own map.** Intact Elderbrook, the
prologue's village, gets facades on its 14 cottages while the family home stays
byte-identical.

**Beat 3 and Beat 4 hold up.** Staged over the intact village by setting
`prologueEmperor` directly. Beat 3's frame differs from the baseline only in a
184x143 box at the left edge, which is one neighbouring cottage's new front; the
square, the fountain and the family home are untouched. Beat 4's landing draws
the Emperor and his swelling ground shadow correctly over a village of fronts.
The Emperor's draw order is unchanged: roofs came before him in the flat path
and come before him in the merge, so nothing about the prologue's layering
moved.

**Total facade cost after A2**, same A/B and same worst viewpoint: +0.196 ms at
TILE_PX 48 with 4 facades on screen, +0.596 ms at TILE_PX 24 with 7. Whole frame
3.14 ms of a 16.7 ms budget.

**A rig trap worth recording:** `prologueEmperor` is a top-level `let`
(`cutscene.js:50`), so it is NOT a window property. `window.prologueEmperor = ...`
creates a separate property the renderer never reads and the dragon silently
does not appear. Bare assignment reaches the real binding. The same is true of
every top-level `let`/`const` in this codebase, including `TILE_PX`, and it is
the opposite of `function` declarations, which ARE window properties and are
what makes the gate-swapping A/B possible.

### A3: does it actually help

- [x] Render the same village street before and after, side by side, for the USER
- [x] Record the total perf delta for A0 through A2 here
- [x] USER verdict: does it feel different now, yes or no
- [x] If NO: stop. Do not start B or C. Go back to the plan's item D and have the
      explicit conversation about the projection, which is a different project

**VERDICT, 2026-08-16: YES.** The USER looked at the before/after set and said
"I like it", and to carry on. Item A is closed. B and C are unblocked, and the
plan's item D stays where it is.

Still outstanding from A and carried forward into C: **the phone check at
TILE_PX 24 has not been done for item A.** C re-runs it anyway, so it is folded
into C3 rather than left dangling here.

**The before/after set.** Four stacked pairs, before on top of after with an
orange divider, same seed and same camera in both halves: a street at TILE_PX 48
and 24, an approach at 24, and intact Elderbrook at 48. Villagers are cleared
from all of them, deliberately: they are the one thing on screen whose positions
are not reproducible across two page loads, and a before/after in which people
have moved is not a before/after.

The "before" tree is `base-a1` (pre-A1 and pre-A2 by construction) with
`isDepthSortedMap` pointed at `isObliqueMap`, which takes A0 back out too. So it
is the shipped game as of the start of this session, not an approximation of it.

**Total cost of item A**, both levers pulled together in one page load (the
depth-sort gate back to `isObliqueMap` and the facade stubbed), standing where
the most houses are on screen:

| zoom | houses on screen | item A on | item A off | total delta | frame vs 16.7 ms |
|---|---|---|---|---|---|
| TILE_PX 48 | 4 | 1.676 ms | 1.448 ms | **+0.228 ms** | 10.0% |
| TILE_PX 24 | 7 | 3.688 ms | 3.072 ms | **+0.616 ms** | 22.1% |

15 enemies and 12 villagers live in both columns. The shop board moving and the
gable shrinking are not captured by this A/B, because both draw the same number
of shapes wherever they sit. Desktop only: **the phone check at TILE_PX 24 is
the USER's and is outstanding.**

**How to actually see this in play, which is not obvious and is a real problem.**
Post-Ashfall Elderbrook has `roofsApply` false, so the ruin has no roofs and no
facades: an existing save shows item A nothing on its own map. Reaching a
Village of the Lost legitimately means visiting 20 forest maps, and there is no
dev warp in this project. Two options:

1. Start a new game and play the prologue. Intact Elderbrook has 14 cottages
   with fronts plus the untouched family home.
2. Open devtools (F12) on the running game, load a save, and paste:

```js
(() => { const id = worldMaps.length;
  const vm = makeVillageMapAt(id, 99, 99, 0, {left:true,right:true,up:true,down:true}, null);
  worldMaps.push(vm); currentMapId = id; vm.visited = true;
  if (typeof activateVillage === 'function') activateVillage(vm);
  if (typeof spawnEnemiesForMap === 'function') spawnEnemiesForMap(id);
  player.x = 56; player.y = 63; player.renderX = player.x; player.renderY = player.y;
  clampCam(true); return currentMap().name; })()
```

Verified in a live unfrozen game: warps to Village of the Lost with 12 villagers
and 15 enemies, the hero walks, and the loop is still running seconds later.
Paste it only after the save has finished loading. It creates a throwaway map
that is not registered in `worldGrid`, so walk back out through a gate rather
than saving from inside it.

---

## Item C: widen the gate

Unblocked by A3's YES. Full reasoning in `oblique-conversion-plan.md` under
"What feeling 2.5D requires", item C.

### C0: measure before widening (do this first)

- [x] A/B the widened gate by swapping the two gate functions, no source change
- [x] Separate the MERGE cost from the EXTRUSION DRAW cost
- [x] Record which maps gain nothing, so the widening is not sold as universal

**The plan's prediction was wrong, and usefully so.** It said to "expect the
depth merge, not the extrusion, to be the cost", on the grounds that the merge
walks the whole tall-tile list every frame regardless of culling. It does walk
it, and on a forest overworld that list is **14,497 entries**, but the walk costs
**0.045 to 0.15 ms** on every map measured. It is a cheap loop with a cull test.
The cost is the extrusion DRAW, for the few hundred tiles that survive the cull:
+2.53 ms on a forest overworld at TILE_PX 24, +1.55 ms in a dungeon, +0.42 ms in
a village. Anyone optimising this later should go at the rasteriser, not at the
merge.

**Maps that gain nothing, measured rather than assumed:**

- **Caves.** `T.CAVE_WALL` has a height of 1.60 in `TILE_HEIGHT` but is NOT in
  `EXTRUDED_TILES`, so a cave's tall list is 0 entries before and after. Adding
  it is a separate decision with its own look to judge, not part of widening a
  gate.
- **Villages at close zoom.** Counted on Village of the Lost at TILE_PX 48: **18
  wall faces are drawn and the frame is byte-identical.** Every one of them is
  under a roof. That is the audit's central finding ("a top-down building hides
  its own height under its own roof") confirmed at the level of the gate, and it
  is why item A had to come first.

### C1: the widening, and the one thing it could not include

- [x] Widen `isObliqueMap` to every map
- [x] Keep `isDepthSortedMap` as a separate question even though it now agrees
- [x] Leave the flat branches in `render()` in place as the retreat path
- [x] VERIFY: console clean, existing named save loads, hero walks
- [x] VERIFY: hash every map before and after

**Trees had to be pulled back out, and the render is why.** Widening the gate
literally, so that every map extrudes everything, makes a forest overworld
unplayable: at ~35% tree density scattered through the play area, every trunk
south of the hero stands a 1.80-tile face band up the screen, and **the hero
disappears entirely** behind the trees in front of him while the open ground and
water fill with dark slabs. This is not a tuning problem. It is the wrong thing
to draw.

`mapExtrudesTrees` is the answer: `T.TREE` stands up on `homevillage` and
`village` maps and nowhere else. Around a village the trees are a sealed mass
(71% of the pilot map is `ensureConnectivity`'s seal) and standing them up
builds the wall the USER approved in 6c. On an overworld the same tile is the
terrain the hero walks through. Walls, doorways and ledges stand up everywhere;
trees stand up only where they are architecture.

With that in place, a forest overworld differs from its pre-C frame by **1,491
pixels in a 78x26 box around the hero**, which is the depth sort putting him in
front of a boulder, and nothing else.

**What C actually buys, by map:**

| map | verdict |
|---|---|
| dungeon, castle tower | The win. Wall runs get visible height, hero fully visible. |
| forest overworld | Depth sorting only, trees deliberately flat. |
| other overworlds | Depth sorting against landmarks: a hero south of an obelisk is now in front of it. |
| villages | Almost nothing at close zoom (walls are under roofs); the tree border at wide zoom. |
| caves | Nothing. `T.CAVE_WALL` is not in `EXTRUDED_TILES`. |

**Measured, item A's gate versus item C's, same page load, interleaved:**

| map | zoom | tall list | before | after | delta | frame vs 16.7 ms |
|---|---|---|---|---|---|---|
| dungeon | 24 | 0 -> 11,103 | 2.050 ms | 3.610 ms | **+1.560 ms** | 21.6% |
| dungeon | 48 | 0 -> 11,103 | 0.675 ms | 1.010 ms | +0.335 ms | 6.0% |
| forest village | 24 | 14 -> 5,500 | 4.710 ms | 5.100 ms | +0.390 ms | 30.5% |
| necrotic overworld | 24 | 106 | 7.555 ms | 7.700 ms | +0.145 ms | 46.1% |
| fire overworld | 24 | 22 | 2.620 ms | 2.680 ms | +0.060 ms | 16.0% |
| forest overworld | 24 | 12 | 2.205 ms | 2.150 ms | -0.055 ms | 12.9% |
| cave | 24 | 0 | 4.455 ms | 4.255 ms | -0.200 ms | 25.5% |

Negative deltas are run-to-run noise on a 0.1 ms timer, not gains.

**Worth flagging and NOT caused by this work: the necrotic overworld already
costs 7.56 ms per frame at TILE_PX 24 before item C touches it**, 45% of the
budget, and item C adds 0.145 ms to that. It has 106 tall tiles and no walls, so
none of this is the extrusion. It is the single hottest map measured and it was
already that way. Someone should look at it; it is not item C's to fix.

**Hash sweep**, 15 scenes, corrected (see below): pre-item-A to item C is **13 of
15 changed**. The two unchanged are the cave (nothing extrudable) and Village of
the Lost at TILE_PX 48 (walls under roofs).

**A harness bug this turn caught, worth recording.** The sweep positioned the
hero next to the nearest tall tile by reading `mapTallTiles`, which bakes
`isObliqueMap` into the list it builds. The moment C widened that gate the list
went from 12 entries to 14,497 and "the nearest tall tile" became a different
tile, so the hero stood somewhere else and the before/after compared two
different scenes. It surfaced as a forest village hashing IDENTICAL across a
change that could not possibly have left it alone. The anchor is now scanned
directly for the kinds that are in the list under every gate. **Every A-phase
result above is unaffected**, because those runs never changed the tall list on
the maps being compared; this only became reachable once C moved it.

### C2: still open

- [ ] USER: does the game hold up on a real phone at TILE_PX 24 (carries item A's
      outstanding phone check with it, and the dungeon is now the case to test)
- [ ] USER: do dungeon and tower walls read right, and is a village at close zoom
      being unchanged acceptable
- [ ] Decide whether `T.CAVE_WALL` joins `EXTRUDED_TILES` (its own look to judge)

---

## Item B: place ledges

The first call to `stampLedgeShelf` in the project's history. Level design, not
engine work: the mechanic is built, gated and verified (see 5d), and its
call-site count is still zero.

### B0: the USER's four decisions, answered 2026-08-16

1. **Which region.** Earth AND desert (the `fire` region: sand, cactus, mesas).
   The USER's words: "i know they have mesas that need a ledge."
2. **How many per map.** Half a map's worth, enough to feel the difference.
   NOT the plan's "one hand-placed shelf" starting point; the USER asked for
   more than that on purpose.
3. **What is on top.** A shortcut across the map.
4. **Can an enemy above shoot down at you.** No, leave it. That is also the
   no-work answer: projectiles spawn at `z: 0` and only the bomb has an arc, so
   an archer on a shelf has its own arrow stopped by its own 1.00-tall rim
   today. Making it yes would mean projectiles inheriting the shooter's
   `groundZ`, which 5b's comment explicitly warns against.

Answers 1, 2 and 3 converge on one design rather than three: **the desert mesa
becomes climbable, and its top is the shortcut.** `addDesertPlateau`
(`mapgen-biomes.js:373`) already stamps a band edge to edge, so a walkable top
IS a route across the whole map, and a band is already about half a map's worth
of structure.

**What a mesa is today, which matters because it is not what it looks like.**
The band is solid `T.PLATEAU` and `carveClimbV`/`carveClimbH` cut 3-wide
`T.CLIMB` corridors THROUGH it with a sand lip on each face. So a mesa is a wall
you tunnel through, not a plateau you climb onto. Turning the top into a shelf
is precisely the change the plan flags as a separate project: "Converting
`CLIFF`, `PLATEAU` or `MOUNTAIN` to standable terraces changes traversability on
every desert and earth map." The USER has now asked for it explicitly, which
resolves the flag but does not remove the risk.

**Two risks that are real and have to be settled before code:**

- **`stampLedgeShelf` stamps its whole rect unconditionally.** The current
  plateau pass deliberately skips `isProtectedFeature` tiles, water, oasis water
  and existing climbs. A naive swap would pave over a chest, a dungeon door or a
  shrine. Skipping them instead punches holes in the perimeter, and an unfaced
  perimeter is the exact failure the invariant in `config.js` exists to prevent.
- **Existing saves.** A visited map that was never modified stores no tiles and
  is rebuilt from `mapSeed` on load (`mapNeedsStoredTiles`, `save.js:41`).
  Changing desert generation means every unmodified desert map in an existing
  save comes back with different terrain. Not a crash, and it self-corrects on
  the next save, but the world changes under the player.

Earth is a separate problem from desert and is NOT the same fix: the earth
region has no `PLATEAU` bands at all. It builds with `T.MOUNTAIN` and `T.CLIFF`
(`addEarthCaveEntrances`, `mapgen-biomes.js:16`), so it needs a shelf pass of
its own rather than a conversion.

**Measured on 12 desert maps from fixed seeds, and it moved the design:**

| | |
|---|---|
| maps with any mesa at all | **7 of 12** |
| bands per map | `rnd(1, 4) - 1`, so 0 to 3, and 0 is common |
| average mesa tiles per map | **881 of 22,500**, about 4% |
| earth maps with a mesa | **none**, the region has no `PLATEAU` |

Two consequences the decisions did not anticipate:

- **A mesa is not reliably there.** Converting mesas alone leaves 5 of 12 desert
  maps with no ledge and every earth map with no ledge, which is not "half a map
  as needed to see the difference" so much as "a coin flip".
- **4% of tiles is not half a map**, though a band spanning edge to edge is a
  big feature to look at. The two readings of decision 2 point different ways.

**The USER's answer to both, 2026-08-16:** mesa tops become climbable AND a new
causeway pass covers earth maps and mesa-less desert maps, so every map in both
regions gets a shortcut. And the save impact is accepted: unmodified earth and
desert maps in an existing save will rebuild with ledges in them.

### B1: the desert mesa becomes a shelf

- [x] Stamp the band `T.LEDGE` instead of `T.PLATEAU`
- [x] Cut ramps UP onto it, not only corridors through it
- [x] Face the perimeter, given the band is not a rectangle
- [x] VERIFY: zero unfaced edges, every shelf reachable
- [x] Region-appropriate colour and rock texture
- [ ] VERIFY: connectivity seals identically, existing save loads
- [ ] The causeway pass for earth and mesa-less desert maps

**`faceLedgeEdges` is new, in `map-helpers.js` beside `stampLedgeShelf`.** The
rect stamper could not be used here: a mesa flows around chests, shrines, water
and the climb corridors already cut through it, so it is not a rectangle, and
every tile it skips is a hole whose rim would be unfaced. Unfaced rims are the
exact failure `config.js`'s invariant exists to prevent. `faceLedgeEdges`
discovers the perimeter from the tiles instead of assuming a shape, leaves
`T.CLIMB` alone so ramps are not walled off, and collects before it writes so a
tile turned into a face cannot make its neighbour look like an edge in turn and
erode the shelf inward.

**`rampUpToMesa` is what makes it a shelf rather than a wall.** A mesa was solid
`T.PLATEAU` with 3-wide `T.CLIMB` corridors cut THROUGH it. Those corridors stay,
so every existing route across a desert map still works; what is added is a
`T.CLIMB` one tile inside each face on the corridor's centre line, so the hero
can turn off the corridor and walk UP. Ramps are placed before the facing pass,
because facing would otherwise wall them off.

**Verified on 12 desert maps from fixed seeds:** 7 have a mesa (unchanged, the
band count is still `rnd(1, 4) - 1`), all `T.PLATEAU` is gone from them, and
`findUnfacedLedgeEdges` returns **0 unfaced edges on all 12**. Every shelf has
between 8 and 58 ramp tiles touching it, so none is stranded.

### B1a: tint and texture

`ledgePalette()` in `render-tiles.js` derives the whole shelf palette from
`region.ground` rather than hand-authoring thirteen, so every region is covered
by construction and a fourteenth would be too. The slab is darkened to 0.82 of
its ground: a shelf exactly the colour of the floor around it reads as a painted
patch rather than as rock. Memoized per biome id, a pure key, so the derivation
runs once and not per tile per frame.

**Safe only because neither ledge tile is cacheable.** `getTileSprite`'s contract
is that art is a pure function of (type, size), and this makes it a function of
the map as well. The existing comment in the `T.LEDGE` case already flagged the
neighbour-dependent lip as the thing that breaks if either tile is ever added to
`CACHEABLE_TILES`; the palette is now a second reason. The extruded face never
goes through the cache at all, by design.

The cap is faceted rock now instead of flat colour plus speckles: lit facet
upper-left, shadowed recess lower-right, a hashed fracture between them, lit the
same way the mesa art is. The vertical face takes the same palette plus
horizontal strata, hashed off the column so the beds do not line up into one
continuous stripe along a shelf that runs the width of the map.

**Verified:** the 15-scene sweep is **15 identical, 0 differ** against the
pre-tint build, because no map in it contains a ledge; the invariant check still
reports 0 unfaced edges on all 12 desert maps; console clean.

**Still not right, and this one is NOT a palette problem.** The mesa top now
reads as sandstone, but the frame is dominated by stacked vertical face bands.
The cause is geometric, not artistic: `carveClimbV`/`carveClimbH` cut a 3-wide
corridor at every column where a path crossed the band, and map 0 alone has 138
climb tiles. Every corridor is a hole, `faceLedgeEdges` correctly faces its
north rim, and each of those rims draws its own full-height face band. About a
quarter of the band ends up as face. A mesa with a dozen canyons through it is
what was asked for geometrically and is not what a mesa should look like.

### B1b: fewer crossings

`thinMesaCrossings` caps a band at **2 corridors**, kept 30 tiles apart. The old
pass cut one at every column a path crossed, which is six or seven on a real
map, and every corridor is a hole whose rim draws its own face band. Two is
enough now that the shelf is not a wall: a corridor is a convenience for someone
who does not want to climb, and the climb goes anywhere there is a ramp. A band
no path crossed still gets one in the middle and a second far from it.

Measured across 8 desert maps: climb tiles fell from 48-378 to **10-93**, and the
mesa reads as one plateau with a canyon through it rather than as a comb.

### B2: the causeway

`addLedgeCauseway` is the **first real call site of `stampLedgeShelf` in the
project's history**. Deliberately the rect stamper rather than the mesa's
discover-the-rim path: a causeway can be a clean rectangle, and a rect is faced
correctly by construction instead of by inspection. Runs on every earth map, and
on desert maps that rolled no mesa.

Two things it took a measurement to get right, both recorded because the first
version of each was wrong and shipped-looking:

- **Thickness 5, not 3.** `stampLedgeShelf` faces the whole perimeter, so a
  3-thick causeway is two rows of solid rim around ONE walkable row: measured,
  143 walkable tiles against 292 of face. That is a wall with a slot in it. Five
  gives three walkable rows between parapets: 429 against 296.
- **Ramp positions are searched, not fixed.** Fixed offsets put a ramp wherever
  they landed, including against a pool that `demoteWaterToMedium` turns solid
  AFTER this pass runs, and a ramp opening onto water is not a way up. Measured
  before the fix: **one desert map in eight had a causeway nothing could reach.**
  A column now qualifies only if the ground just outside BOTH faces is walkable,
  and the pass declines to build at all rather than lay a wall it cannot climb.

**Verified across 17 maps (8 desert, 8 earth, 1 ice control):**

- `findUnfacedLedgeEdges`: **0 unfaced edges on all 17.**
- Shelf reachability, flooded from the map centre: **17 of 17 fully reachable**,
  every ledge tile of every shelf.
- The ice control has zero ledge tiles, so no region got one that should not.
- The 15-scene sweep is unchanged against the pre-B build (the three forest
  villages differ from pre-A0, as they have since item A; nothing else moved).
- Console clean, existing named save loads, hero walks.

**A rig lesson worth keeping.** The reachability check first flooded from the
first passable tile in raster order, which can land in a border pocket
`ensureConnectivity` legitimately left alone, and it reported a perfectly
reachable shelf as unreachable on one earth map. It floods from the map centre
now. Both the false positive and the real defect it was masking were found by
distrusting the first green result.

**Open for the USER:** whether a canyon cut through a mesa should show a wall
face at every step down its length. It is geometrically correct for an oblique
camera and it does stack visibly at TILE_PX 24.

**A note on this measurement's own limits, so the next session does not overread
it.** The protected-feature and water columns were computed over each map's
plateau BOUNDING RECT, and a map with both a horizontal and a vertical band has
a bounding rect covering nearly the whole map. Those two columns are therefore
meaningless on multi-band maps and were not used to decide anything. The band
counts, the map counts and the tile totals are sound.

---

## Standing constraints

These do not expire and are repeated here so a cold session sees them:

- Never touch `SOLID_TILES`, `isSolid()` or `connectivity.js`. That constraint is
  the whole reason ledges use new tiles instead of making plateau tops walkable.
- No em dashes anywhere: chat, markdown, code comments.
- Project rules hold: no ES modules, no fetch, no build step, no dependencies.
- Verify from `file://` directly, not only the localhost:8765 server, and always
  load an existing named save rather than starting a new game.
