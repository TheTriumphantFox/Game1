---
name: the-rpg-game
description: Project conventions, architecture rules, and story canon for The RPG Game, a browser-based top-down RPG that runs from the local filesystem with no build step. Use this skill for ANY work in this repo — adding or editing enemies, maps, items, quests, dialogue, save/load, enemy persistence, XP and leveling, UI, or refactors — and also whenever the user asks about game balance, story beats, the Withering Crown plotline, the Red Dragon Emperor, or what a system currently does. Consult it before writing code here, not after, because this project has hard constraints (no bundler, no ES module imports, no network calls) that ordinary web-app instincts will violate.
---

# The RPG Game

A browser-based top-down action RPG in the spirit of *Zelda: A Link to the Past*. Procedurally generated maps, D&D 5e-derived enemies, XP and leveling, named save slots, and a coordinate registry that acts as the source of truth for world state.

The whole game is opened by double-clicking `index.html`. There is no build and no install step. That single fact drives most of the rules below.

There *is* a small local static server in the repo — `.claude/serve.ps1`, wired up as the `the-rpg-game` config in `.claude/launch.json` (localhost:8765) — but it exists only as a testing convenience. It changes nothing about the constraints: the game has to work when the file is double-clicked, so never fix a `file://` problem by telling the user to run the server.

## Before writing any code

Orient yourself in the actual repo rather than assuming — the project has grown and moved things around before.

1. Read `index.html` first — it is the authority, and this list is a copy that has gone stale before. The order of its `<script>` tags **is** the dependency graph, currently 46 files: `config.js → projection.js → elements.js → map-helpers.js → connectivity.js → regions.js → mapgen-terrain.js → mapgen-foliage.js → mapgen-caves.js → mapgen-village.js → mapgen-prologue.js → mapgen-tower.js → mapgen-biomes.js → enemies.js → world.js → shrines.js → corruption.js → abilities.js → player.js → story.js → projectiles.js → render-tiles.js → dragon-sprite.js → render-enemies.js → hero-atlas.js → hero-sprite.js → render.js → ui.js → save.js → shop-core.js → shop-general.js → shop-blacksmith.js → shop-herbalist.js → villagers.js → guild.js → tower.js → radial.js → portal.js → ledger.js → stats.js → worldmap.js → sysmenu.js → dialogue.js → cutscene.js → prologue.js → main.js`. Anything you add has to be inserted at a point where its dependencies are already defined, and added to this list in the same change.
2. There is no `src/` or `styles/` folder — every `.js` and `.css` file sits flat at the repo root, alongside `index.html` itself. List the repo root and read the files you're about to touch, plus the file that owns the system you're changing.
3. Only then propose a change.

If a system already exists in some form, extend it. Do not build a parallel second version of it — this codebase has one owner and duplicated systems rot fast.

## Hard constraints

These are not style preferences. Violating any of them produces a game that silently fails to load when opened from `file://`, which is how the game is actually played. A violation that happens to work under `.claude/serve.ps1` is still a violation.

- **No ES module syntax.** No `import`, no `export`, no `type="module"`. Browsers block module loading over `file://` for security reasons. Everything is classic `<script>` tags sharing globals.
- **No `fetch()`, `XMLHttpRequest`, or `import()` of local files.** Same origin restriction — a `file://` page cannot read a sibling `.json` or `.txt`. Game data lives in `.js` files that assign to a global, not in data files that get loaded at runtime.
- **No build step, bundler, transpiler, or package manager.** No npm, no Vite, no TypeScript compilation. If a change would require running a command before the game works, it's the wrong change.
- **No CDN links or external assets.** The game must run with the laptop offline.
- **No frameworks.** Plain JS, plain CSS, canvas or DOM as the existing code already does it.

When a task genuinely seems to need one of these, say so plainly and propose a no-build alternative instead of quietly adding a dependency.

## Architecture conventions

**The world coordinate registry (`world.js`) tracks which generated MAP sits where — it is not a per-entity placement API.** `worldMaps[]` (indexed by mapId) and `worldGrid["gx,gy"] -> mapId` are the source of truth for map topology: which overworld map, village, cave, dungeon, or tower floor exists at a given grid cell, so a closed loop of walking (right → down → left → up) correctly returns to the map you started on instead of generating a new one. When you add a new kind of place that hangs off the grid (a new cave-chain type, a new off-grid area), follow the pattern in `world.js`'s `create*Map()` functions: build the tile data, push a map object onto `worldMaps` with the fields its type needs (`id, gx, gy, name, type, biome, map, enemyDefs, openedChests, visited, ...`), and register grid-linked maps with `worldGrid[gridKey(gx, gy)] = newId`.

There is no `registerEntity()`/`registerTile()`-style call anywhere in this codebase, and there doesn't need to be one — grep before assuming otherwise. Positions of enemies, chests, and shrines are computed inline during procedural generation and written straight into the tile array (`m[r][c] = T.CHEST`) or as plain `{ type, x, y }` objects in a map's `enemyDefs` (see `makeEnemyDefs` in `enemies.js`). That inline-placement pattern *is* the convention here — match it by reading how neighboring generation code places things, not by looking for a registry call to invoke.

**Directory layout stays as-is.** `index.html` at the root; every `.js` and `.css` file sits flat beside it — there is no `src/` or `styles/` folder. Add files inside the existing flat structure; don't introduce subfolders as a side effect of another task.

**Match the existing shape.** Before adding an enemy, item, map feature, or save field, read two or three existing examples and follow their shape exactly — same property names, same ordering, same construction pattern (e.g. how neighboring `create*Map()` functions build and push a map object, or how neighboring `DND_ENEMIES` entries are shaped). Consistency here matters more than any individual improvement, because the systems read each other's data.

**Save compatibility.** Named save slots are a shipped feature and there are real saves in them. When adding a field to save state, default it sensibly when it's absent so an older save still loads. Never change the persistence mechanism or the slot format without flagging it first and saying explicitly that existing saves will break. The storage keys are `the_rpg_game_slot_N` / `_index` / `_autosave` / `_ui_mode`; pre-rename saves used a `hyrule_quest_` prefix and are copied across by the one-shot migration at the top of the UI-mode section in `config.js`. Leave that migration in place — removing it strands the saves of anyone who hasn't opened the game since the rename.

**Procedural generation is supposed to be reproducible — it currently is not.** Every `mapgen-*.js` file (and `world.js`) accepts a `seed` parameter but never actually threads it into randomness; generation runs on bare, unseeded `Math.random()`/`rnd()` throughout (confirmed via `tools/lint-conventions.py`, which flags this everywhere, and reproducible in `tools/seed-preview.html` — generating the same seed twice yields different maps). This is a real, pre-existing gap, not a hypothetical rule. Don't make it worse: no *new* bare `Math.random()` in generation paths. If you're the one fixing it, that means threading an actual seeded PRNG through every generation file that currently ignores `seed` — not just changing one call site and calling it done.

## Enemies

Enemies are *inspired* by D&D 5e, but the stat block is much smaller than a tabletop one. Every `DND_ENEMIES` entry in `enemies.js` carries exactly `name, hp, spd, dmg, xp, color, size, cr`, plus `ranged`, `element`, `swims`, `boss`, `flies`, `breath`, `finalBoss` where relevant. Two things to be clear about before writing any enemy:

- **There is no `ac`, no attack bonus, no to-hit roll, and no ability scores anywhere in this game.** Combat is real-time contact and projectile collision, not a d20 roll. Don't add those fields or reason about them — grep for `ac:` in `enemies.js` and you'll find nothing.
- **`cr` is a flavor/reference tag only.** It's stored on the object and never read at runtime by anything.

For the actual balance math — turning a target difficulty into HP and damage numbers that play right — use the `enemy-forge` skill rather than working it out here. For a new enemy, always state the CR you're targeting and how it compares to the player's expected level in the region where it spawns.

**The corrupted/blight template does not exist in code.** The Withering Crown and its blight are story canon (see `references/story-bible.md`); the only thing shipped is the necrotic region's *terrain* tiles, which are unrelated. If asked for a corrupted variant, treat it as new work and say so. The precedent to follow when it does get built is the village **"Greater"** tier — see the `tier15` branch in `makeEnemyDefs` (`enemies.js`), which applies 2× HP, 2× damage, 2× XP and 1.5× size over a base entry at spawn time rather than hand-authoring a second creature.

## Story and dialogue

The canon lives in `references/story-bible.md` — read it before writing any dialogue, NPC, quest text, or story trigger. It covers the Withering Crown plotline, the Red Dragon Emperor, the prologue beats, and the midgame twist that early dialogue has to stay compatible with.

The one rule that matters most: **the grandmother's dying words deliver a partial truth on purpose.** Nothing written for the early game may confirm or contradict the full truth, because the reveal depends on the player having been told something incomplete. If a line you're writing would close that gap, rewrite it.

Dialogue and cutscenes are written as scripted beats with the trigger conditions and state flags called out alongside the lines, so the writing and the implementation stay in sync:

```
BEAT 3 — The Emperor arrives
Trigger: player enters village_center with flag `fetch_quest_complete`
State:   sets `revenge_triggered = true`
Combat:  forced-loss encounter — player cannot win, escape is scripted

GRANDMOTHER: [line]
             [line]
```

## Verifying a change

There is no test runner and adding one would violate the constraints above. Verify like this:

1. Open `index.html` in the browser and check the console — a `file://` violation shows up there immediately, usually as a CORS or module error.
2. Load an existing named save, not just a new game. That's what catches save-compat breaks.
3. Walk through the specific thing that changed, plus one thing adjacent to it that shares state with it.

Tell the user exactly what to click to confirm the change worked. Don't claim something is verified that was only reasoned about.

## Working style

Small, reviewable diffs. State what you're changing and why before changing it. When a task is ambiguous — which of two systems should own a new behavior, whether a change is worth the save-compat cost — ask rather than picking silently. And when something in the existing code looks wrong, mention it rather than fixing it in the same pass as an unrelated task.
