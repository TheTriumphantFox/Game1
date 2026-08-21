# Moving terrain off the procedural switch

## Current state

Update this block at the end of every session. It is the first thing the next
session reads, and it is the only place that records where the work actually
stopped.

```
Phase in progress:  ALL THIRTEEN regions are built: forest,
                    desert (id 'fire'), coast (id 'water'), ice (id 'ice'),
                    earth (id 'earth'), volcanic (id 'volcanic'), air (id 'air'),
                    lightning (id 'lightning'), luminous (id 'luminous') and
                    necrotic (id 'necrotic', Ossuary of the Pale King) are built
                    and measured. Poison (id 'poison', Mire-warden Citadel),
                    mana (id 'mana', Heartstone Conclave) and shadow (id
                    'shadow', Umbral Sanctum) are built but not measured
                    in-game: this environment's browser policy blocks file://
                    and the USER still needs to play them.
                    THREE REGIONS WERE OVER BUDGET BEFORE ANY OF THIS AND NOBODY
                    HAD MEASURED THEM. At TILE_PX 24, against a 16.7 ms frame:
                    volcanic 25 ms, necrotic 48 ms, luminous 70 ms. All three are
                    dense with ANIMATED tiles, which are excluded from the sprite
                    cache by design and redrawn per tile per frame with trig and
                    several arcs each. Baking the ground under the animation
                    rather than replacing it takes them to 1.9, 2.0 and 4.3 ms.
                    Those three numbers are the most valuable thing this exercise
                    has produced and none of them was a goal of it.
                    Figures confirmed over two runs; the heavy regions are stable
                    to within a millisecond, while the light ones drift with
                    background load (forest OFF read 5.2 and 2.9 in consecutive
                    runs), so trust the big numbers and not the small ones.
                    OPEN: the USER has not played any of them. Every judgement
                    below is from headless renders, not from play.
                    Volcanic closed the WATER GAP by solving it for lava first.
                    An animated tile can be baked AND still animate: the bake
                    gives it its rounded shape and static crust, and the tile
                    draws its moving glow on top with its own base square
                    suppressed. T.LAVA and T.MAGMA_CRACK both work that way now,
                    and WATER SHOULD BE CONVERTED THE SAME WAY. That is the top
                    open item and it is no longer a design question, only work.
Last completed:     Mana and shadow. Mana has teal baked ground, pale lavender
                    roads, huge blue-green trees, cyan crystal borders and
                    violet growth. Its moss and oversized blooms keep their
                    procedural detail and animation. Shadow has near-black
                    violet baked ground, grey roads, broken void-stone walls,
                    violet fronds and monoliths; its rifts keep their breathing
                    light. Aseprite was unavailable in this environment. The
                    checked-in Lua generator is the source of truth; the three
                    final runtime atlases were composed from existing generated
                    silhouettes with tools/compose-terrain-fallback.py and
                    should be regenerated from Lua when Aseprite is available.
Half-finished:      Nothing. OPEN, in priority order: convert water to
                    bake-plus-overlay (technique proven on lava, mechanical
                    now); bake the neighbour-autotiled tiles, which is the
                    biggest remaining renderer win and would roughly halve
                    earth; torches still paint their own brown square. All
                    region artwork is built, but the final three need play QA.
```

Read `concept-art/village-layouts/ELEMENTS.md` next. It is the element inventory
this plan implements, and its closing section ("What the art is not") is the
reason the architecture below is shaped the way it is.

---

## Why this exists

Two findings, one from the art and one from the code.

**From the art.** Element 59: there is no visible tile seam anywhere in the
concept image. Not in the grass, not in the treeline, not in the paving. Every
paved area is bounded by a continuous kerb with rounded corners. Nothing in the
picture is 48 pixels wide. A renderer that paints one square per cell cannot
produce that, however good the square is.

**From the code.** `drawTileProcedural` is 163 cases and about 267 KB, and its
oldest art is its worst. `T.GRASS` is three `fillRect` calls. `T.TREE` is three
`arc` calls and a 4x4 brown rectangle for a trunk. Those two tiles cover the
overwhelming majority of pixels on any forest map, so the weakest art in the
file is also the most visible.

The `oblique-conversion-plan.md` audit reached the matching conclusion from the
projection side: the extrusion pass "is working correctly and has almost nothing
to stand up", because a top-down building hides its height under its own roof.
Height has to come from somewhere other than extruding tiles.

## Architecture: three layers

The tile grid stays. It is the gameplay structure: collision, connectivity
flood-fill, mapgen, and the seed recipes saves are built from all read it, and
none of that should change to make the game prettier. What changes is that the
grid stops being the drawing unit.

### Layer 1: baked ground

Grass, cobblestone, marble, dirt path and water are painted into **offscreen
chunk canvases of 16x16 tiles**, built on demand and cached. Each frame blits
the handful of chunks the viewport touches instead of issuing one draw per cell.

Within a chunk, a paved area is drawn as a **real path** with rounded corners
and a kerb stroke, then texture-filled, rather than as a run of squares. That is
what removes the seam and reproduces elements 3, 4 and 12.

Two consequences worth stating up front:

- This should be **faster**, not slower. A 1280x800 viewport at `TILE_PX` 48
  covers about 27x17 tiles, so roughly 450 per-tile draws become 6 chunk blits.
  The `perf-hud.js` numbers already recorded in `oblique-conversion-plan.md`
  (necrotic overworld at 7.56 ms of a 16.7 ms budget) are the baseline to beat.
- It needs **invalidation**. A chunk must be rebuilt when a tile inside it
  changes (a bombed rock, a burnt tile) and every chunk must be dropped when
  `TILE_PX` changes. This is the one piece of genuinely new bookkeeping.

### Layer 2: foot-anchored props

Trees, shrubs, flower drifts, boulders, rock-wall slabs and gate furniture stop
being tile art. Each becomes a sprite **anchored at its foot** on a tile but
drawn at whatever size it wants, overhanging its neighbours freely, with size
and variant chosen by a `(col, row)` hash so no two read alike.

This is not a new idea in this codebase. `drawColossalTree` and
`drawBigLandmark` already do exactly this, and the depth merge already sorts
them against actors. This generalises the pattern from "the rare giant" to "the
ordinary tree", which is what the USER asked for.

The trees get a visible trunk, which the concept art does not have (element 34).
That is a deliberate departure and the reason for it is in ELEMENTS.md: the art
is orthographic top-down, and a canopy floating with no trunk reads as flat. The
trunk plus the ground shadow at its foot is where the height comes from.

### Layer 3: canopy overlay

The top of a tree draws after the actors so the hero passes behind it. Already
built: this is the existing after-entities pass in `render.js`, and on
depth-sorted maps it is already folded into `drawDepthLayer`.

## Palette

Sampled from `01-village-of-the-lost.png`, coarse-bucketed and ordered dark to
light, which is the ordering `aseprite-lib.ramp()` expects. Every sample box was
confirmed against a magnified contact sheet before its numbers were taken, after
a first pass put the canopy boxes on grass by mistake.

| Material | Ramp, dark to light |
|---|---|
| Grass | `#4a5619` `#6b7727` `#798a2b` `#869631` `#93a337` |
| Grass, shaded | `#5b6d23` `#687926` `#788a2d` `#879734` `#93a33b` |
| Canopy | `#37491c` `#3b4f22` `#4d512f` `#546c28` `#728b2f` |
| Canopy crown | `#37491c` `#3b5022` `#455a24` `#556c28` `#718b30` |
| Shrub | `#354919` `#566a24` `#677a26` `#778a2d` `#889732` |
| Cobblestone | `#746c56` `#948b74` `#b5ac95` `#c3bba5` `#cbc4ae` |
| Marble | `#aea79a` `#bab4a8` `#c2bdb2` `#c8c4b9` `#d1cec5` |
| Water | `#115373` `#167095` `#197ba3` `#2a8bb0` `#51accc` |
| Rock and moss | `#2a2f19` `#514f33` `#73694c` `#988a69` `#a59673` |
| Roof, north slope | `#73522b` `#825d30` `#916938` `#a77b44` `#b2854d` |
| Roof, south slope | `#4e361a` `#5c4325` `#70512b` `#825d30` `#876334` |
| Gate stone | `#373328` `#4e4a36` `#585445` `#706a55` `#b5ab90` |

Two of these carry information beyond their own colour:

- **Canopy is darker and cooler than grass.** Grass sits at `#869631`, canopy at
  `#4d512f`. The current `T.TREE` art has this backwards, drawing a canopy
  lighter than the grass it sits on, which is part of why the treeline reads as
  noise.
- **Marble has a much tighter range than cobblestone** (`#ae` to `#d1` against
  `#74` to `#cb`). It is flat dressed stone next to rough fieldstone, and
  flattening that difference is what makes the plaza read as more cobble.

The roof ramps are the cross-check on the method: `make-village-sheet.lua`
sampled `#a97c44` and `#7d5a2c` independently for the two slopes, and this pass
got `#a77b44` and `#70512b`. Close enough to trust both.

## Region skinning

`01-village-of-the-lost.png` and `04-frostfast-hold.png` share their geometry
exactly, down to the gate arches and the fountain's ripple rose. They differ in
palette and in prop set: round broadleaf canopies become snow pines, boulders
become ice spires, flower drifts become frost blooms, and the gate pillars gain
lit braziers.

So the sheet is authored **once** and the other twelve regions are a data
change: a palette table plus a prop-substitution table, both keyed by region id.
Forest is built first and built to be skinned, per the USER's decision. No other
region's art is generated in this pass.

## Risks

| Risk | Mitigation |
|---|---|
| Chunk memory. A 16x16 chunk at `TILE_PX` 48 is 768x768, about 2.4 MB. | LRU cap on the cache, sized to a few screens' worth. Maps are 150x150, so baking everything is never an option. |
| Invalidation misses, leaving stale ground after a tile changes. | One choke point that every tile write goes through, rather than hunting call sites. Verified by bombing a rock and re-reading the chunk. |
| The sheet fails to load and the game is unplayable. | Same contract as `village-sprite.js`: every entry point reports "not mine" until the image is ready, and forever if it 404s, and the caller draws exactly what it drew before. The procedural switch stays in place as the fallback. |
| Trees with trunks hide the hero behind a forest. | This is a real finding already recorded in `oblique-conversion-plan.md`, which gated tree extrusion to village maps for exactly this reason. Trunk height is tunable and the canopy overlay pass keeps the hero visible through it; if it still fails, trunks go to clearings only. |
| Frame budget. | Measured with the existing `perf-hud.js` against the recorded baseline, on a forest overworld and a forest village, before anything is called done. |

## Phases

- [x] **0. Palette and inventory.** ELEMENTS.md, sampled ramps, this plan.
- [x] **1. The sheets.** `tools/make-forest-sheet.lua`, producing
      `forest-ground.png` (18 seamless 48px textures), `forest-props.png`
      (27 foot-anchored 96x144 props) and `forest-atlas.js`.
- [x] **2. Baked ground.** Chunk cache, region tracing with rounded kerbs,
      invalidation through the existing `invalidateTallTiles`.
- [x] **3. Props off the grid.** Trees, flower drifts, boulders and the
      moss-boulder landmark, foot-anchored and hashed, through the depth merge.
- [x] **4. Wiring and measurement.** Gated per map, measured at both zooms.
- [x] **5. Region two, and the generalisation to make it cheap.** Desert built;
      generator and runtime reorganised around shared roles.
- [x] **6. Region three.** Coast built. Needed two renderer changes rather than
      none, which is worth recording against the claim in phase 5 that regions
      are pure data from here: a second water category (the lagoon and the ocean
      are too far apart for one ramp), and two real bug fixes the region
      exposed. Regions whose concept differs structurally will keep doing this.
- [x] **7. Region four.** Ice built, and it needed no renderer change at all:
      two new shapes in the generator (a faceted ice block and an ice spire),
      two flags on existing ones (`snowy` on the conifer, `berries` on the
      shrub), a `sparkle` ground flag, and the four data tables. That is the
      shape the remaining regions should take.
- [x] **8. Region five.** Earth built, again with no renderer change: two new
      generator shapes (a leaning menhir and an amethyst cluster) and the data
      tables. First region to leave one of its own tiles procedural on purpose.
- [x] **9. Region six.** Volcanic built with NO new prop shape at all: obsidian
      is the faceted spire on a basalt ramp, the sulfur bushes are the forest's
      shrub on ochre, the ember flowers are the forest's drift on orange. It did
      add one ground category (`FGC_LAVA`) and the bake-plus-overlay technique
      that closes the water gap.
- [x] **10. Region seven.** Air built. Two new generator shapes (a cloud spire
      and wind reeds), plus two renderer changes: the second ground tone can now
      be traced as a rounded region (opt-in per region, because paying it
      everywhere dropped frames), and the chunk size came down to 384 px.
- [x] **11. Region eight.** Lightning built with NO new shape and no renderer
      change: the ice region's faceted spire, the earth region's crystal cluster
      and the air region's reeds, recombined on a storm palette. One generator
      change, sparkle becoming per-region rather than a boolean.
- [x] **12. Region nine.** Luminous built. No new shape, no renderer change, and
      the fullest use of bake-plus-overlay anywhere: its floor, glow pools and
      blooms are all baked AND still animated. Took the region from 61.9 ms to
      4.3 ms at the small zoom.
- [x] **13. Region ten.** Necrotic built. Two new shapes (a gnarled leafless
      tree and a headstone). Its crypt wall became a prop rather than an
      overlay, trading its pulse for stone rubble, because as a tile it painted
      saturated purple squares against the baked blight.
- [ ] **14. Convert water to bake-plus-overlay.** See Known gaps. Mechanical,
      and now clearly worth it: the same technique just rescued two regions.
- [ ] **15. Played.** Not done. Nothing here has been seen in motion by a human.
- [x] **16. Regions eleven to thirteen.** Per region: a palette block and a prop
      block in `tools/make-terrain-sheet.lua`, and a ground-category table plus
      a prop-set table in `terrain-sprite.js`. Add the region id to
      `TERRAIN_REGIONS` and its atlas to `index.html`. No renderer change
      EXPECTED, but see phase 6.
      - [x] Poison: mangrove and marsh props, baked mire, animated bog/pool and
            fungus overlays, and neighbor-aware fallen logs.
      - [x] Mana: ancient blue-green trees, cyan crystal props, teal ground,
            lavender paving and animated giant-growth overlays.
      - [x] Shadow: broken black stone props, violet growth, grey paving and an
            animated rift overlay.

## Reusing shapes across regions

Worth stating, because it is what keeps each new region cheap. Four regions in,
the generator has eleven prop shapes and they cover forty-four role slots:

| Shape | Used by |
|---|---|
| `drawTree` | forest |
| `drawConifer` | forest, ice (with `snowy`) |
| `drawShrub` | forest, ice (with `berries` and `snowy`) |
| `drawFlowers` | forest, ice |
| `drawRock` | forest, desert, coast |
| `drawSaguaro`, `drawBarrel`, `drawPear`, `drawObelisk`, `drawBones`, `drawDesertBloom` | desert |
| `drawCoral`, `drawAnemone`, `drawShoreScatter`, `drawDriftwood` | coast |
| `drawIceSpire`, `drawIceBlock`, `drawSnowMound` | ice |
| `drawGatePillar`, `drawGateArch` | all four |

The pattern that works: before writing a new shape, check whether an existing
one plus a boolean gets there. `snowy` and `berries` turned the forest's conifer
and bush into the frost region's two signature plants for about twenty lines,
and both still draw the forest exactly as before because the flags default off.

## Adding a region

The whole point of the role split, so it is worth writing down while it is fresh.

1. Inventory the concept sketch as a DELTA against the forest, in ELEMENTS.md.
   The geometry is always identical; only palette and slot-filling change.
2. Sample the palette from confirmed boxes. Build the contact sheet FIRST and
   look at it, every time. Two of the desert's ramps came back wrong from boxes
   that seemed obviously right.
3. Add a `PALETTES.<region>` block and a `REGION_PROPS.<region>` block to the
   generator. Reuse the shared shapes where the concept reuses them, and write a
   new draw function only where the object genuinely differs.
4. Add `TERRAIN_GROUND_CAT.<region>`, `TERRAIN_PROP_SETS.<region>`,
   `TERRAIN_KERB.<region>` and the `TERRAIN_REGIONS` entry in terrain-sprite.js.
   The key is the REGION ID from regions.js, which is not always an English word
   for the terrain: the desert's id is `fire`.
5. Generate, export twice, add the atlas script tag, render one frame and look
   at it.

## Measured

Headless Edge at 1280x800, median of 60 frames after a cold frame, blight veil
off. "OFF" is the procedural switch this replaces, forced by failing the sheet
load, so both columns are the same build and the same frame.

| Case | OFF median | ON median | Cold frame (ON) |
|---|---|---|---|
| Forest overworld, TILE_PX 48 | 0.8 ms | **0.3 ms** | 10.7 ms |
| Forest overworld, TILE_PX 24 | 2.8 ms | **1.9 ms** | 34.1 ms |
| Desert overworld, TILE_PX 48 | 1.6 ms | **0.7 ms** | 23.4 ms |
| Desert overworld, TILE_PX 24 | 5.8 ms | **1.5 ms** | 43.6 ms |
| Coast overworld, TILE_PX 48 | 1.1 ms | **0.1 ms** | 37.1 ms |
| Coast overworld, TILE_PX 24 | 3.4 ms | **0.3 ms** | 46.4 ms |
| Ice overworld, TILE_PX 48 | 1.2 ms | **0.6 ms** | 18.1 ms |
| Ice overworld, TILE_PX 24 | 4.0 ms | **2.7 ms** | 48.8 ms |
| Earth overworld, TILE_PX 48 | 1.9 ms | **1.1 ms** | 7.3 ms |
| Earth overworld, TILE_PX 24 | 7.6 ms | **5.0 ms** | 16.8 ms |
| Volcanic overworld, TILE_PX 48 | 5.7 ms | **0.7 ms** | 27.0 ms |
| **Volcanic overworld, TILE_PX 24** | **20.1 ms** | **1.9 ms** | 32.9 ms |
| Air overworld, TILE_PX 48 | 2.3 ms | **0.2 ms** | 22.8 ms |
| Air overworld, TILE_PX 24 | 6.5 ms | **0.4 ms** | 45.2 ms |
| Lightning overworld, TILE_PX 48 | 2.3 ms | **0.2 ms** | 31.8 ms |
| Lightning overworld, TILE_PX 24 | 5.4 ms | **0.2 ms** | 40.2 ms |
| Luminous overworld, TILE_PX 48 | 10.5 ms | **1.6 ms** | 15.3 ms |
| **Luminous overworld, TILE_PX 24** | **~70 ms** | **4.3 ms** | 37.3 ms |
| Necrotic overworld, TILE_PX 48 | 7.5 ms | **0.7 ms** | 17.8 ms |
| **Necrotic overworld, TILE_PX 24** | **~48 ms** | **2.0 ms** | 35.0 ms |
| Forest village, TILE_PX 48 | 3.6 ms | **1.2 ms** | 19.0 ms |
| Forest village, TILE_PX 24 | 10.4 ms | **2.9 ms** | 29.3 ms |

### The three broken regions

**Volcanic, necrotic and luminous were all over budget before this work started,
and none of them had ever been measured.** At `TILE_PX` 24, against a 16.7 ms
frame:

| Region | before | after | over budget by |
|---|---|---|---|
| Volcanic | ~25 ms | **1.9 ms** | 1.5x |
| Necrotic | ~48 ms | **2.0 ms** | 2.9x |
| Luminous | ~70 ms | **4.3 ms** | 4.2x |

One cause for all three: they are dense with ANIMATED tiles. Animated tiles are
deliberately excluded from `CACHEABLE_TILES`, so each is redrawn per tile per
frame with trigonometry and several arcs. The luminous region animates every
single tile it has. Baking the ground UNDER the animation rather than replacing
it is what fixes them, which is the same bake-plus-overlay path the water gap
needs.

**On trusting these numbers.** Confirmed over two consecutive runs. The heavy
regions are stable to within a millisecond (necrotic 48.9 then 48.5, luminous
69.5 then 71.3, volcanic 24.7 then 25.1). The light ones drift with background
load: forest OFF read 5.2 and then 2.9. So the big numbers are solid and the
small ones are indicative.

Also worth recording: `oblique-conversion-plan.md` states the necrotic overworld
costs 7.56 ms at `TILE_PX` 24 and calls it the hottest map measured. This pass
measures about 48 ms for the same region. The two are not reconciled. The likely
difference is which map instance was measured (a seeded overworld here, against
whatever that session had loaded), and the older figure should not be relied on.

### Walking, which is the number that catches bake hitches

Steady-state medians hide the bake entirely. Walking 100 tiles east and counting
frames over the 16.7 ms budget is what surfaces it, and it is what caught the
regression described in the current-state block:

| Chunk size | forest@24 | volcanic@24 | air@24 | worst frame |
|---|---|---|---|---|
| 768 px, tracing the second tone everywhere | 1 | 3 | 3 | 48.6 ms |
| 768 px, tracing it only where needed | 0 | 2 | 2 | 31.0 ms |
| 512 px | 0 | 1 | 2 | 21.1 ms |
| **384 px (shipped)** | **0** | **1** | **0** | **16.9 ms** |

Re-run with eight regions built, at 384 px, walking 100 tiles:

| Region | med | p95 | worst | frames over budget |
|---|---|---|---|---|
| forest @24 | 0.9 ms | 4.8 ms | 7.0 ms | 0 |
| volcanic @24 | 1.4 ms | 6.7 ms | 10.7 ms | 0 |
| air @24 | 0.4 ms | 8.6 ms | 15.8 ms | 0 |
| lightning @24 | 0.4 ms | 13.0 ms | 17.3 ms | 1 |

Lightning traces its second ground tone (its storm banks are open floor, like
the air region's cloud banks) and is the only one still clipping the budget,
once per hundred tiles.

**Volcanic at TILE_PX 24 was over budget before this work: 18.5 ms against
16.7 ms.** That region was dropping frames on the small zoom and nothing in the
project had measured it. The cause is the same thing that made it interesting to
convert: a volcanic map is dense with `T.LAVA` and `T.MAGMA_CRACK`, both
animated, both therefore excluded from the sprite cache and redrawn per tile per
frame with trigonometry in the inner loop. Baking the ground under them and
leaving only the glow on top takes it to 1.3 ms.

Two regions sit above the rest and each for its own reason, both instructive:

**Ice** has the largest cold frame, because its border is `T.GLACIER`, a PROP
tile: nearly every cell in the border band carries a foot-anchored sprite
through the depth merge. The ground bake saves what it saves; the prop pass is
the floor.

**Earth is the slowest, at 6.2 ms, and that is the cost of a decision rather
than a defect.** Most of an earth map is `T.MOUNTAIN`, which this pass
deliberately did NOT re-skin (it autotiles against its neighbours to cap the
crests, and losing that would trade a cliff face for a boulder field). So it is
still drawn by the procedural switch, per tile, every frame, uncached because
its art depends on its neighbours. That 6.2 ms is very nearly the untouched
`OFF` cost of the tiles this pass left alone.

Everything remains inside the 16.7 ms budget, earth included.

Forest and desert land on each other, which is the expected result: cost is a
property of the architecture, not of how much art a region has.

**The coast is the outlier and the reason is worth understanding.** It is ten
times faster rather than two or three, because a coast map is mostly water, and
water in the procedural switch is ANIMATED: it is excluded from
`CACHEABLE_TILES` and redrawn from `Date.now()` every frame for every visible
tile. Baking it makes it static, and static is free. That is a genuine saving
and it is also a genuine behaviour change, recorded under Known gaps.

Walking 80 tiles east, timing every frame, which is the test that catches the
bake hitch rather than hiding it in a median:

| Zoom | median | p95 | worst | frames over 16.7 ms |
|---|---|---|---|---|
| TILE_PX 48 | 0.4 ms | 5.2 ms | 9.3 ms | **0 of 80** |
| TILE_PX 24 | 0.8 ms | 2.1 ms | 14.1 ms | **0 of 80** |

The steady-state win is the whole point of the design: about 450 per-tile draws
per frame became 6 chunk blits. The cold frame on map entry is the price, and it
is a one-off 40 ms at the small zoom, on a frame where the screen is changing
anyway. If that ever reads as a stall, the fix is to bake at most one chunk per
frame and let the tile loop cover the rest for a frame or two; it is not built,
because nothing measured yet justifies the complexity.

## Known gaps

- **Torches keep their brown square.** `T.TORCH` paints `TILE_COLORS` under
  itself and now stands out against baked turf. It is NOT in the ground table on
  purpose: torches are also indoors, and giving the tile a grass category would
  put lawn inside houses. Fixing it properly means deriving a decoration tile's
  ground from its neighbours rather than from a fixed table.
- **Baked water is STATIC, and the fix is now known and proven.** This was an
  open design question; it is not any more. The volcanic region needed the same
  thing for lava and the answer turned out to be "both": put the tile in the
  ground table AND in `TERRAIN_OVERLAY_TILES`. The bake supplies the rounded
  region shape and a static body; the procedural tile draws its animated layer
  on top with its own base square suppressed. `T.LAVA` and `T.MAGMA_CRACK` work
  exactly this way and keep their pulsing glow.
  Converting water is mechanical: add `water_*` to the overlay set, check
  whether `T.WATER` and friends paint their own base square inside their case
  (`T.MAGMA_CRACK` did and needed a `tileOverlayPass` guard; `T.LAVA` did not),
  and re-render the coast. It costs back a per-tile draw for water cells only.
  NOT DONE, and it is the top open item.
- **Neighbour-dependent tiles could be baked, and that is the fix for earth.**
  `T.MOUNTAIN` is drawn per tile per frame and cannot be cached, because its art
  reads its eight neighbours to cap the crests. That is exactly the kind of work
  the chunk baker makes free: the baker holds the whole map, runs once per
  chunk, and is under no obligation to be a pure function of the tile type. An
  autotiled ground category (pick the frame from the neighbour mask) would take
  `T.MOUNTAIN`, `T.GLACIER` and probably the cliff tiles off the hot path
  entirely and should roughly halve earth's frame. Not built, and it is the
  single biggest remaining win in the renderer.
- **The final three regions need play QA.** Their atlases and fallbacks are
  wired, but this environment could not open the file:// build for an in-game
  visual or performance pass.
- **Ground repeat.** Four variants per region, hashed per cell. Across a large
  open clearing the repeat is faintly visible. More variants is a one-line
  change to the frame table.
- **The desert border is a wall of cactus.** T.CACTUS fills the border the way
  T.TREE does in the forest, and saguaros are narrow and regular, so a dense
  band of them reads as more uniform than a treeline does. It is the same
  density the flat renderer always had, and it may simply want fewer, larger
  cacti at generation time rather than an art change.
- **The fountain is not on its plaza.** The concept art centres the fountain in
  the marble plaza; the generated village puts it on turf. That is map
  generation, not rendering, and is untouched here.
