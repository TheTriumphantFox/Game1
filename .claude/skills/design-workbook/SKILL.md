---
name: design-workbook
description: Keep Game1.xlsx — the 12-sheet design reference for enemies, foliage, chests, ores, regions, quests, the Guild, NPCs, progression, sword/armor forging, and potions — in sync with the game source it was transcribed from. Use this skill whenever the user asks to update, check, refresh, audit, or fix the spreadsheet/workbook/design doc, whenever they ask what a sheet should say, and whenever a code change touches a balance table (DND_ENEMIES, ENEMY_DROPS, TROPHIES, ORE_TYPES, REGIONS, HERBALIST_RECIPES, the foliage cut chain, chest rewards, quest rewards) — the workbook is a snapshot and goes stale silently. Trigger even when the user only says "update all the fields" or names the file, without saying what changed.
---

# Design Workbook

`Game1.xlsx` sits one level **above** the repo, at `../Game1.xlsx`. It is a hand-authored reference
for the game's balance tables — not an input to the game. Nothing loads it at runtime, so when a
table in the JS changes, the workbook keeps showing the old number and nothing complains.

That has already produced real drift: the Foliage sheet predated the volcanic and shadow regions,
so four foliage rows were missing *and* every region after Earth carried a region number one too
low, which silently made its Region Potion dice wrong too.

Do not audit this workbook by eye. Two tools do the mechanical part.

## The tools

```bash
node tools/design-export.js
```

Runs the actual game — every `<script src>` in `index.html`, in order, inside a Node `vm` behind a
stub DOM — and prints the authoritative balance tables as JSON. It transcribes nothing: values come
from the live objects, and derived columns come from calling the real functions
(`regionSwordPartTypes`, `regionArmorPartTypes`, `guildCreatureFor`, `oreForRegionIdx`,
`elementalBlockPctForLevel`, `dragonbaneCost`). Useful on its own for "what does the code actually
say about X".

```bash
python tools/design-audit.py            # report drift, exit 1 if any
python tools/design-audit.py --fix      # also rewrite the wrong cells
python tools/design-audit.py --sheet Enemies
```

Diffs the export against the workbook and names every disagreement by cell. **Start here for any
workbook task, and finish with a clean run.**

Findings come in five kinds:

| Kind | Meaning | `--fix` |
| --- | --- | --- |
| `MISMATCH` | a cell disagrees with the code | rewrites it |
| `MISSING` | the code has a row the sheet lacks | reports the full row; never inserts |
| `EXTRA` | the sheet has a row the code lacks | reports only; never deletes |
| `CONSTANT` | a source number appears nowhere in a prose sheet | reports only |
| `STRUCTURE` | a header or column moved — the spec needs updating | reports only |

`--fix` only ever sets `.value`, so styling is untouched by construction.

## What the tools do not cover

**Three sheets are prose** — Treasure & Chests, Quests, NPCs & Services. Their rules live in
function bodies, not tables, so they get a weak constant scan and nothing more. When they need
checking, read these:

| Sheet | Read |
| --- | --- |
| Treasure & Chests | `handlePickup` in `player.js` (all three chest classes and their odds), `placeCaveChests` calls in `mapgen-caves.js` / `mapgen-village.js` / `mapgen-tower.js` for spawn counts |
| Quests | `villagers.js` (Collector, Timmy, escorts, Chronicler), `shop-herbalist.js` (Collector/Taxidermist/Alchemist payouts), `guild.js` (the 5-quest chain), `tryUnsealShrine` in `world.js` |
| NPCs & Services | `VILLAGER_TYPES` + the `place*` functions in `villagers.js`, `INN_REST_COST` in `shop-core.js`, `PORTAL_TOLL` in `portal.js` |

**Some columns are deliberately unaudited** because they have no counterpart in code — the Foliage
sheet's `Type` (Bloom / Fern / Mineral / …) is a hand-authored taxonomy, and every Notes and
legend block is written by hand. Editing those is a judgement call, not a sync.

## Adding a missing row by hand

The audit prints the row's values but will not insert it, because placement (which banded section,
what sort order) needs a decision. Inserting by hand has three traps, all of which will silently
mangle the sheet:

1. **`ws.insert_rows()` does not carry styling.** Build the new row by copying `_style` from a
   neighbouring row of the same kind — a boss row is bold on a tan fill, a data row is plain on
   white. `from copy import copy; new_cell._style = copy(src_cell._style)`.
2. **Merged ranges do not move.** Every merge at or below the insert point must be unmerged and
   re-merged one row lower, or section banners end up over the wrong rows.
3. **Row heights do not move either.** These sheets wrap text, so a stale height crops the row
   below. Shift the custom heights past the insert point the same way.

Sheets with merges: Quests, Guild, NPCs & Services, Sword Progression, Armor Progression, Potions.
Sheets with non-uniform row heights: Treasure & Chests, Sword Progression, Armor Progression.

## Sheet → source map

| Sheet | Authoritative source |
| --- | --- |
| Enemies | `DND_ENEMIES` + `ENEMY_POOLS` (`enemies.js`), `ENEMY_DROPS` (`player.js`), `TROPHIES` (`config.js`), `OPPOSITE` (`elements.js`) |
| Foliage | the cut chain in `doSwordSwing` (`projectiles.js`), `scatter*Foliage` (`mapgen-foliage.js`), `REGION_FORAGE` + `TROPHY_SELL` (`shop-general.js`), `HERBALIST_RECIPES` (`shop-herbalist.js`) |
| Treasure & Chests | `handlePickup` (`player.js`) — prose |
| Ores & Minerals | `ORE_TYPES` + `oreForRegionIdx` (`config.js`) |
| Regions | `REGIONS` (`regions.js`) |
| Quests | `villagers.js`, `shop-herbalist.js`, `world.js` — prose |
| Guild | `guild.js` |
| NPCs & Services | `villagers.js`, `shop-core.js`, `portal.js` — prose |
| Progression | `gainXP` (`player.js`) — 500 XP, ×1.8 floored, +2 max HP per level |
| Sword Progression | `regionSwordPartTypes`, `dragonbaneCost` (`shop-blacksmith.js`) |
| Armor Progression | `regionArmorPartTypes`, `smithOreArmor`, `elementalBlockPctForLevel` |
| Potions | `HERBALIST_RECIPES` (`shop-herbalist.js`), `REGION_POTION_NAMES` (`regions.js`) |

## Two things that look like damage but are not

- **Whole floats become ints on save.** openpyxl writes `22.0` back as `22`. Every affected cell is
  General-formatted, so Excel displays them identically. Do not chase this.
- **The export's row order is not the sheet's row order** for Foliage. The audit matches on the key
  column, so this never matters to a check — only to where you place a new row.

## When the exporter breaks

It fails loudly rather than exporting half a table. Two failure modes:

- *"these game files would not evaluate"* — a module started touching a browser API the stub DOM
  lacks. Add the shim to `makeContext()` in `tools/design-export.js`.
- *"the foliage cut chain … matched only N rows"* / *"no region claims these cuttable tiles"* — the
  two tables that live inside function bodies are pulled from source text by regex, and the shape
  changed. Update `foliageCutTable()`, `dropKeyTable()`, or `foliageScatterRegions()`.

Never work around a failure by hardcoding the value it could not derive. The point of these tools
is that no number is transcribed twice.
