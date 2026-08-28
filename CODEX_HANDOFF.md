# Codex handoff - 2026-08-27

This is the durable memory snapshot for moving Hero of Stormdrift to another
computer and continuing with a fresh Codex session. It records both stable
project knowledge and the exact unfinished work found in this checkout.

> **Update, 2026-08-27, added by a Claude session when this file was committed.**
> The transfer problem described in the next section was resolved rather than
> left open. The Shadow-village work is now in Git history as `35bcd12`, this
> file and `AGENTS.md` are committed, and everything was pushed to
> `origin/main`. A plain `git clone` on the new computer now retrieves all of
> it. What was deliberately left out and does *not* exist in the repo:
> `shadow-shot.html`, `roof-shot.html` and the three `out-*.png` captures.
> Everything below this line is the snapshot as Codex wrote it, and the
> unfinished-work and stale-comment sections are still accurate and still the
> right place to start.

## Transfer-critical state

At the start of this handoff:

- Repository: `https://github.com/TheTriumphantFox/Game1.git`
- Branch: `main`
- HEAD: `7e6211433635cd0dfd3a92476209d7c091de114e`
  (`Merge hero-sprite-hires`)
- `main` matched `origin/main`; there were no committed changes waiting to push.
- The worktree was dirty. The Shadow-village work described below is **not in
  Git history and will not appear in a fresh clone**.
- This file and `AGENTS.md` were then added as part of the handoff and are also
  uncommitted unless a later session commits them.

Copy the entire working directory, create a patch that includes untracked
files, or explicitly commit and push before abandoning the old computer. A
plain `git clone` on the new computer retrieves only `7e62114`, not the work
listed below.

The game's named saves are browser `localStorage`, not repository files. The
current keys are `stormdrift_slot_N`, `stormdrift_index`,
`stormdrift_autosave`, and `stormdrift_ui_mode`. They will not follow a Git
clone either. Preserve the old browser profile or export the relevant
`localStorage` values if those playthroughs matter.

## Uncommitted work: Umbral Sanctum

The active implementation is a visual overhaul of the Shadow region's final
village, **Umbral Sanctum**. It deliberately adds a regional paint/style layer
to the existing oblique village renderer rather than building a second
renderer or requiring a new Aseprite export.

### Files and responsibilities

| Path | State at handoff | Purpose |
| --- | --- | --- |
| `.claude/skills/hero-of-stormdrift/SKILL.md` | modified | Updates the documented script count and dependency list from 47 to 66, including the current sprite and terrain scripts plus `village-shadow.js`. |
| `index.html` | modified | Loads `village-shadow.js` after `village-sprite.js` and before terrain atlases and `render.js`. |
| `render.js` | modified | Adds Shadow-village ground hooks, roofs/facades, depth sorting, the Spire entry, and the Spire ground-shadow pass. |
| `render-tiles.js` | modified | Lets Shadow-village masonry paint extruded wall faces, caps, and door panels through the same hook pattern as forest-village timber. |
| `village-shadow.js` | untracked | The 724-line implementation: palette and gating, roof planes, projected facade, Obsidian Spire, Shadow path/wall/floor paint, and extruded masonry paint. |
| `shadow-shot.html` | untracked | Temporary iframe harness that fast-travels to region 12. Supports `?in=1`, `?gate=1`, `?py=N`, and `?ts=N`. It zeros the lingering prologue fire wash so screenshots show the real Shadow palette. |
| `roof-shot.html` | untracked | Earlier temporary forest-cottage harness. Useful as a control, not part of the shipped game. |
| `out-inside-zoom.png`, `out-inside.png`, `out-outside.png` | untracked | Earlier forest-cottage captures made before `village-shadow.js`; they do **not** validate the Shadow work. |

### Intended design

- `umbralArtActive()` limits the skin to `mapObj.type === 'village'` and
  `mapObj.biome === 'shadow'`.
- Shadow roofs and facades reuse geometry from `drawForestHouseRoof()` but
  replace warm forest paint with flat, ink-outlined violet-black value steps.
- `umbralTileArt()` repaints generic `T.PATH`, `T.WALL`, and `T.FLOOR` only in
  the Shadow village. Tile identity, collision, pathfinding, minimap behavior,
  and save data remain unchanged.
- Extruded `T.WALL` faces/caps and doorway panels use Shadow-specific hooks in
  `drawTileExtrusion()`.
- The Obsidian Spire is derived render art with no tile, collision, or save
  field. It is keyed into the depth merge by its foot row and casts a long
  ground-pass shadow. The current constants are `SPIRE_TILES_H = 10`,
  `SPIRE_TILES_W = 5.5`, and `SPIRE_INSET = 7`.
- The skin falls back safely: if its functions are absent or decline, existing
  procedural/sprite rendering continues.

### Important unresolved issues before this is called finished

1. **Real castle-gate orientation is not settled.** The dev-created final
   village always uses a north/up castle gate, but normal progression chooses
   `castleExitDir` dynamically, usually opposite the side from which the final
   village was entered. It can therefore be `up`, `down`, `left`, or `right`.
   `obsidianSpireFoot()` moves the anchor for all four values, but the tower is
   always drawn vertically upward on screen and all proportions were reasoned
   about for the north gate. Decide explicitly between forcing the real final
   castle gate north or adapting/culling/composing the Spire for all four gate
   directions. Test a real walk-generated final village, not only
   `getOrCreateActiveRegionVillage(12)`.
2. **Visual and gameplay QA has not been completed for this dirty worktree.**
   Syntax and convention checks pass, but no claim has been made that the
   Shadow village looks correct in motion, that its roofs hide/show correctly,
   or that the Spire depth relation feels right.
3. **Several Spire comments are stale and contradictory.** The code evolved
   from a 30-tile, outside-the-map anchor to a 10-tile tower anchored at inset
   row 7. The introductory Spire block and the cull/aerial-perspective comments
   in `village-shadow.js`, plus the Spire insertion comment in `render.js`,
   still mention 30 tiles and/or an outside-map foot. Update comments only
   after the orientation and final dimensions are decided.
4. **The existing PNGs are forest controls.** Generate fresh Shadow exterior,
   interior, gate, close-zoom, and `TILE_PX = 24` captures before judging the
   new work.
5. **Performance is unmeasured.** The Spire uses gradients, animated windows,
   a beacon, and a large halo. Measure the Shadow village at normal and
   `TILE_PX = 24`, especially on a real phone, before expanding the effect.

### Suggested next-session sequence

1. Read `AGENTS.md`, the full project skill, `index.html`, this file, then the
   complete dirty diff and `village-shadow.js`.
2. Preserve the existing work; do not reset or reformat it.
3. Resolve the arbitrary `castleExitDir` design first because it changes the
   Spire's geometry and test matrix.
4. Clean the stale Spire comments after the geometry is final.
5. Use `shadow-shot.html` for quick north-gate captures, then create or mutate a
   test map to cover the other possible directions.
6. Verify cottage exterior, entering/leaving a house, shop signs and doorway
   panels, walking both in front of and behind depth-sorted objects, castle
   approach, close zoom, `TILE_PX = 24`, and an existing named save.
7. Boot `index.html` directly over `file://` and check the console. The harness
   may use the local server for convenience, but the shipped game may not rely
   on it.
8. Remove or intentionally retain the temporary harnesses and screenshots,
   then review the final diff before asking to commit/push.

## Validation completed during this handoff

The following checks were actually run against the dirty worktree:

```text
node --check village-shadow.js
node --check render.js
node --check render-tiles.js
python tools/lint-conventions.py
```

All three syntax checks passed. The convention linter reported:

```text
0 errors, 3 warnings, 1 note
```

The current warnings/note are pre-existing or outside the Shadow-village diff:

- `perf-hud.js:64`: hardcoded HUD coordinate pair.
- `world.js:106`: `Math.random()` chooses a new world seed.
- `world.js:775`: `Math.random()` chooses the sealed shrine's required
  element.
- `prologue.js:1072`: `dog_outrun` is set but never read.

`index.html` currently contains 66 JavaScript tags and every referenced script
exists. No in-browser or `file://` pass was performed during this handoff.

## Stable project memory

### Runtime and architecture

- This is plain HTML, CSS, and JavaScript with no build or install step. The
  root is intentionally flat.
- `index.html` is the load graph. Top-level classic-script names share one
  global lexical environment, so name collisions and load order matter.
- The local PowerShell server is `.claude/serve.ps1` and defaults to port 8765.
  `.claude/launch.json` also contains a Python server option on 8766.
- The world is 150 x 150-tile maps across 13 regions. `worldMaps` and
  `worldGrid` own map topology. Entity and tile positions are ordinary data
  written by their generators, not registered through a separate entity API.
- Normal overworld enemies respawn when re-entering a map. Villages and castle
  tower floors remember cleared enemies. Saves preserve the live fight on the
  current non-arena map.

### Save and generation state

- Existing named saves are a shipped compatibility constraint. New fields
  need absent-field defaults.
- Old storage-name migrations in `config.js` must remain so saves from earlier
  game names are not stranded.
- Seeded overworld regeneration and pristine-map hashing now exist. Do not rely
  on the old `AUDIT.md` statement that every generation path is wholly
  unseeded. Do avoid introducing new unseeded generation calls.
- Fog of war was removed, so the old audit's fog-size calculation is
  historical.
- Sealed-map topology, modal freezing/input capture, autosave failure
  reporting, hero-name escaping, damage-number clearing, default-player object
  cloning, and the duplicate shop overlay listener described in `AUDIT.md`
  have all been addressed in current code.

### Story and content

- The current title is **Hero of Stormdrift**. The main quest implementation
  checklist has 101 completed items and no unchecked items.
- Canon lives in
  `.claude/skills/hero-of-stormdrift/references/story-bible.md`; the prologue
  script is beside it. Do not casually restate or "fix" the grandmother's
  partial truth.
- Enemy objects do not use armor class, attack bonuses, ability scores, or
  runtime CR math. `cr` is descriptive only. Use the existing enemy shape and
  the `enemy-forge` skill for new balance work.

### Roadmap documents and remaining known work

- `oblique-conversion-plan.md` is an original plan, not a reliable checklist;
  its major renderer phases shipped in merge `6affb52`.
- `oblique-conversion-todo.md` is the richer implementation/decision record.
  Its meaningful remaining judgments include real-phone performance,
  dungeon/tower wall appearance, and whether `T.CAVE_WALL` should extrude.
  Some earlier unchecked user questions and the causeway checkbox are stale;
  later sections record that the causeway was implemented and verified.
- `terrain-art-plan.md` still records two genuine gaps: convert water to the
  bake-plus-overlay pattern so animation returns, and perform human play QA.
  It also records the expensive Earth/necrotic cases and other art observations.
- `stage-2-handoff.md` is useful for sword/punch decisions, but its open
  `legacyCompleted` reward warning was subsequently resolved at
  `shrines.js:624-632`.
- `AUDIT.md` remains valuable history and rationale, but it is not a live bug
  list. Reproduce any finding against current code before scheduling a fix.

## Local-only Git oddities

This checkout prints warnings about broken refs named
`refs/heads/desktop.ini`, `refs/heads/claude/desktop.ini`, and
`refs/heads/codex/desktop.ini`. It also has local `oblique`, `oblique-perf`, and
`claude/sprite-sheets-hero-and-dragon` branches whose upstream branches are
gone. These are local metadata issues, not game-code failures, and a clean
clone should not inherit them. Do not delete refs or branches as an incidental
part of game work.
