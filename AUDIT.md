# Code Audit — The RPG Game

Date: 2026-08-13
Scope: `Game1/` — 45 files, ~33,500 lines of vanilla ES, no build step, no dependencies.
Method: full read of the core layers (boot, input, player, save, world, fog, connectivity,
projectiles, UI, shops), targeted reads elsewhere, cross-file collision analysis, and live
verification in a browser against a running instance on `localhost:8765`.

Every finding below marked **Verified** was reproduced against the running game, not
inferred from reading.

---

## Overall

This is a well-engineered codebase for what it is. Specifically:

- **No global namespace collisions.** 704 top-level functions and 309 top-level
  `const`/`let`/`var` across 45 non-module scripts sharing one global scope, and not a
  single duplicate name. That is discipline, and it is the thing most likely to go wrong
  in this architecture.
- **Boots clean.** No console errors, no failed resource loads, correct script ordering.
- **Performance is not a problem.** On a fully-stocked 150×150 forest map with 20 enemies
  and a mostly-revealed fog layer: `update()` 0.02 ms, `render()` 0.72 ms, against a
  16.7 ms budget at 60 fps. The tile sprite cache and the fog "paint only the new
  crescent" optimisation (`fog.js:61-77`) are both doing their job. Minimap-on and
  zoomed-out modes are also well inside budget.
- **Comment quality is unusually high** — comments explain *why*, record rejected
  alternatives, and flag ordering constraints. `main.js:88-96` and `save.js:224-240` are
  good examples.
- **The previous `Bug.Report.txt` (2026-08-05) is fully addressed.** Projectile and
  particle frame-rate dependence now scale by `dt` (`projectiles.js:619`, `:1029`), the
  arrow multi-hit has an explicit `break` (`projectiles.js:740`), `resetGame` clears
  drops/projectiles and zeroes field-earned stock (`save.js:699-741`), and the README
  matches the current structure. That report can be retired.

The problems that remain cluster in two places: **what the save format does not
preserve**, and **which overlays are wired into the freeze/input chain**.

---

## High

### H1 — Save/load destroys sealed dead-end maps and breaks the region seal

**Verified.** Round-tripped a `createSealedNeighbor` map through
`buildSaveData()` → `applyLoadData()`:

| | before save | after load |
|---|---|---|
| open sides | `right` only | **all four** |
| `sealed` flag | `true` | **absent** |
| Hero's Cache | 1 `LARGE_CHEST` | **0** (downgraded to plain `CHEST`) |
| terrain | — | **completely regenerated** |

Three separate causes compound:

1. `save.js:46` — `mapTiles: m.visited ? encodeMap(m.map) : null`. Dead-ends are created
   by `sealRegion` with `visited: false` (`world.js:585`), so their tiles are never stored.
2. `save.js:305` — the rebuild path calls
   `buildRegionMap(lite.id, lite.depth, undefined, region)` with `openSides` **undefined**,
   and `mapgen-biomes.js:637` defaults that to `{left:true, right:true, up:true, down:true}`.
   A one-exit dead-end comes back as a four-exit map.
3. `sealed: true` is not in the `worldMapsLite` projection at all, so the flag is lost.

Consequences beyond the map itself — every one of these reads a flag that no longer exists:

- `player.js:905` — sealed maps are excluded from `regionMapsVisited`. After a reload they
  count, inflating progress toward the 21-map village trigger.
- `guild.js:143` / `guild.js:333` — Guild Quarry and bounty elites filter on `!mm.sealed`.
  After a reload, quest targets can spawn on dead-end maps.
- `abilities.js:296` — ability secrets are deliberately not stamped on sealed maps. After a
  reload they become eligible.

There is also a border-symmetry break: the neighbouring map's tiles *are* stored, so the
regenerated dead-end opens toward a neighbour with no opening back — precisely the one-way
doorway `reconcileOpenSides` (`world.js:60-69`) exists to prevent. That reconcile only runs
at creation time, never on load.

**Fix.** Cheapest correct option: persist `openSides` (or just `sealed` plus the four
`mapEdgeOpen` results) per map, and store `mapTiles` for sealed maps regardless of
`visited`. Given H2, storing tiles for every generated map is the wrong direction — better
is to persist `sealed` + the open-side set and pass it into the rebuild, and to re-run
`reconcileOpenSides` after rebuilding. The Hero's Cache upgrade in
`world.js:565-579` also needs to move into the rebuild path or be recorded.

### H2 — A completed save will not fit in localStorage; the autosave fails silently

**Verified by measurement.** Per visited map:

- tiles, base64: **30,002** chars (`encodeMap`, 1 byte/tile — fine)
- fog, `Array.from()` → JSON: **45,001** chars (`save.js:45`)

Fog is **1.5× the size of the entire tile map**, for one bit of information per tile. At the
232 maps the save UI itself advertises (`save.js:491`, `:522` — `Map N/232`), one slot
projects to **~16.6 MB**, of which **~10 MB is fog**. Six named slots plus the rolling
autosave share one origin quota.

Measured ceiling in this Chromium: 48.5 MB — so a single completed save fits, but two do
not, and the README documents touch/phone support as a first-class target, where iOS
Safari's ~5 MB origin cap is a hard wall reached at roughly map 68 of 232.

The failure mode is the serious part. **Verified** by forcing `QuotaExceededError`:

- `doSave` reports it — `❌ Save failed (storage full?)` (`save.js:598`).
- `autoSave` shows **nothing at all** (`save.js:450`, empty `catch`), and leaves
  `lastCheckpoint` pointing at the previous payload. Since `respawn()` restores from
  `lastCheckpoint` (`player.js:472`), the player keeps clearing villages and tower floors
  while their death-restore point silently stops advancing. The only cue is the *absence*
  of the `💾 Auto-saved` toast they normally see.

**Fix.** Two independent changes:

1. Pack fog to bits and base64 it — 22,500 bits → 2,813 bytes → ~3,752 chars, a **~12×
   reduction** that takes the projected save from ~16.6 MB to ~7.2 MB. (Fog is
   large contiguous runs, so RLE would do better still.)
2. Make `autoSave`'s catch report — a toast, and ideally a persistent HUD warning, since a
   silently-not-advancing checkpoint is the kind of bug players only discover by losing
   hours.

### H3 — The Save/Load modal neither freezes the world nor captures input

**Verified.** With the save modal open and the name field focused:

| keypress | what happens |
|---|---|
| `Space` | `preventDefault()` — **the space is never typed into the save name** |
| `v` | opens the radial menu **on top of the save modal** |
| `ArrowDown` / `ArrowUp` | swallowed; also steps the hero |
| `z` | swings the sword |

And the world keeps running underneath: with the modal open, one `update(16)` moved the
hero. Since `stepPlayerMovement` ends in `tryTransition()` (`player.js:1888`), the player
can walk off the map edge while the save dialog is up.

The cause is that the save modal is absent from both gates:

- the freeze chain in `main.js:101-111` lists `radialMenuOpen`, `ledgerOpen`,
  `statsPageOpen`, `worldMapOpen`, `sysMenuOpen`, `victoryOpen`, `dialogueOpen`,
  `cutsceneBlocking` — but has no term for `modalMode`;
- the keydown handler (`main.js:241-378`) has a branch for every one of those overlays and
  none for this one.

The hero-name prompt gets this right — its input calls `e.stopPropagation()`
(`main.js:82`). The save-name input (`save.js:681-684`) does not.

**Fix.** Add `modalMode` to both chains, and add `e.stopPropagation()` to the
`modal-name-input` listener to match `name-input`.

---

## Medium

### M1 — Shop and portal modals don't freeze the world either

**Verified** — the hero moved one step under an open shop modal. Same root cause as H3:
`shopOpen` and `portalOpen` gate *keyboard* input (`main.js:262`, `:271`) and canvas
touches (`main.js:507-517`), but neither appears in the `update()` freeze chain.

Mostly masked today because shops only open in cleared villages, where nothing is alive to
hurt you — but the hero still walks under the modal (which is why `closeShopModals` has to
force-clear `keys` at `shop-core.js:60`, treating the symptom), villagers still step, and
`tryTransition()` can still fire. Adding the two flags to the freeze chain removes the need
for that workaround.

### M2 — Hero name is interpolated into `innerHTML` unescaped

`stats.js:189`:

```js
<div class="stats-name">${p.heroName || 'The Hero'}</div>
```

**Verified**: naming a hero `<img src=x onerror="...">` and opening the Character page
executes the script. Every other surface that shows the name uses `textContent` and is safe
(`save.js:486`, `:515`, `:521`).

This is self-inflicted in a local single-player game, so the practical risk is low — but it
also means a perfectly innocent name containing `<`, `&`, or `'` renders wrong or breaks the
panel. Escape it, or build that node with `textContent` like the save-slot list does.

---

## Low

### L1 — Damage numbers survive map transitions

**Verified.** `spawnEnemiesForMap` clears `projectiles`, `particles` and `drops` on a map
change (`enemies.js:445-447`) but not `damageNumbers`. Entries hold a live `entity`
reference (`projectiles.js:715`), so a number spawned just before a transition keeps
rendering at the *old* enemy's tile coordinates on the *new* map for up to ~1.1 s.
One-line fix: add `damageNumbers = []` alongside the other three.

### L2 — `DEFAULT_PLAYER`'s object fields are shared by reference

**Verified**: `Object.assign({}, DEFAULT_PLAYER, {}).arrows === DEFAULT_PLAYER.arrows`.

`applyLoadData` (`save.js:191`) does `Object.assign(player, sellableDefaults(),
DEFAULT_PLAYER, data.player)`, then defensively re-clones `regionPotions`, `elixirs`,
`collectorQuests`, `armorUpgrades`, `swordUpgrades` and others — but **not**
`swordElements`, `armorElements`, `arrows`, or `swordDir` (`save.js:158-164`). Those are
mutated in place elsewhere (`shop-blacksmith.js:448`, `:473`; `player.js:41`), so a save
missing any of those keys would let the blacksmith permanently pollute `DEFAULT_PLAYER` for
the rest of the session.

Not currently reachable — every real save writes all four — so this is latent, not live.
Worth closing anyway since the surrounding code already established the pattern.

### L3 — Duplicate overlay listeners in `shop-core.js`

`shop-core.js:64-75` registers the same outside-click handler twice: once inside a
`DOMContentLoaded` callback, once immediately as a "fallback for when the script loads
after DOMContentLoaded already fired". Classic scripts at the end of `<body>` run *before*
`DOMContentLoaded`, so both always register. Harmless — `closeShopModals` is idempotent —
but the fallback is dead weight and the doubled handler is misleading. Keep only the
immediate registration.

### L4 — Map generation is not deterministic, and the `seed` parameter is ignored

The project's own linter reports this: `python tools/lint-conventions.py` → **0 errors, 68
warnings**, all `Math.random() in generation code -- same seed must give same map`.

`buildForestMap(seed, …)`, `buildDesertMap(seed, …)` and `buildRegionMap(seed, …)` all
accept a `seed` and none of them use it; generation runs on bare `Math.random()`/`rnd()`.
This is what makes H1 destructive rather than merely lossy — a regenerated map isn't a
slightly different version of the original, it's an entirely unrelated one. Threading a
small seeded PRNG through `rnd()` would fix H1's terrain half outright and make map
regeneration a legitimate save-size strategy rather than a corruption vector.

`prologue.js:1072` also sets the flag `dog_outrun`, which nothing reads.

---

## Suggested order of work

1. **H2's autosave catch** — one line, and it's the difference between a visible problem
   and a silent one.
2. **H3 + M1** — add `modalMode`, `shopOpen`, `portalOpen` to the `update()` freeze chain
   and the keydown chain; `stopPropagation` on the save-name input. Small, contained, and
   fixes a bug players hit every time they name a save.
3. **H1** — persist `sealed` and the open-side set; re-run `reconcileOpenSides` after
   rebuild. This is the one that quietly corrupts long games.
4. **H2's fog packing** — bit-pack + base64.
5. **M2, L1, L2, L3** — small, independent.
6. **L4** — largest change, and the enabler for doing H1/H2 properly rather than patching.
