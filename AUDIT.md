# Code Audit — Hero of Stormdrift

Date: 2026-09-05
Scope: `Game1/` — 66 flat `.js` files, ~43,000 lines, no build step, no dependencies.
Method: six parallel full-file reads covering every script in the repo (core state
and save, procedural map generation, enemies and combat, rendering and sprites,
economy and UI overlays, story and dialogue), plus a targeted re-verification of
every finding in the prior audit below. The two highest-value findings (the
cutscene-cancel leak and the dead Water-region drop) were independently
re-confirmed by direct reads before being written up here.

This file replaces the 2026-08-13 audit below, which is now superseded.

---

## The 2026-08-13 audit is resolved

Every High/Medium finding from that pass (H1 sealed-map save corruption, H2
localStorage quota and silent autosave failure, H3 save-modal not freezing the
world, M1 shop/portal modals not freezing the world, M2 XSS via hero name) is
fixed, each with an in-code comment narrating the original bug. So are L1
(stale damage numbers), L2 (`DEFAULT_PLAYER` reference sharing), and L3 (the
duplicate shop-core.js listener). L4's core claim, that generation ignored its
`seed` parameter, is also fixed: every `mapgen-*.js` builder now runs through
`beginSeededGeneration(seed)` and a seeded `rnd()` (mulberry32, in
map-helpers.js). One sub-finding from L4 is still open: `prologue.js:1072` sets
the flag `dog_outrun`, and nothing reads it (see Low, below).

The full file has been deleted rather than kept as a scrolling history. If you
want the original text, it is in git history for this file.

---

## High

### H1 — Canceling a cutscene can leak execution of its next step, including opening a new dialogue box

**Verified by direct read.** `cutscene.js:281-290`:

```js
function cancelCutscene() {
  if (!cutsceneActive) return;
  _csOnDone = null;
  if (typeof dialogueOpen !== 'undefined' && dialogueOpen) closeDialogue();
  ...
  _csFinish();   // this is what actually sets cutsceneActive = false
}
```

`closeDialogue()` (`dialogue.js:117-130`) fires the open dialogue's `onDone`
callback synchronously, before returning. For a cutscene `say` step that
callback is `() => { if (cutsceneActive) _csAdvance(); }` (`cutscene.js:138`).
`cutsceneActive` is only cleared inside `_csFinish()`, which runs *after* the
`closeDialogue()` call on the line above it. So at the moment the callback
checks the guard, it is still `true`, the guard passes, and `_csAdvance()`
runs the next scripted step (including any `run:` side effects) before the
cancel has actually finished.

**Concrete scenario.** Load a save mid-dialogue at `prologue.js:907-909`
("The lock is gone, burned through..."). `cancelCutscene()` fires (loading a
save is one of its two callers) and leaks into the very next step:
`grantGrandmothersWeapons()` and `setFlag('revenge_triggered')` run
(`prologue.js:910-915`), then the step after that calls `startDialogue()`
again (`prologue.js:916`), setting `dialogueOpen = true` a second time.
`_csFinish()` then clears `cutsceneActive`/`cutsceneInputLocked` but never
touches `dialogueOpen`, so the player is left with a dialogue box open and no
cutscene behind it. A second manifestation: canceling during the "There you
are. Good..." line (`prologue.js:847-852`) leaks into the `walkPlayer` step at
`prologue.js:854-855`, arming `autoNav`, so after the cancel the hero can be
seen auto-walking toward the bow with nothing driving it.

**Fix.** Clear `cutsceneActive` (and ideally `_csSteps`/`_csIndex`) *before*
calling `closeDialogue()` in `cancelCutscene()`, not after, so the guard in
the `say` step's callback is already false when it runs.

---

## Medium

### M1 — Water-region beach "Stones" can be cut but never picked up; the region's Stone Shard trade is permanently unavailable

**Verified by direct read.** Cutting a `T.STONES` cluster sets
`dropType = 'stone'` (`projectiles.js:465`), which is pushed into `drops[]`.
`stepDrops`'s pickup dispatch (`projectiles.js:942-1206`) has a case for
every other foliage-cut drop type (herbal, mushroom, fiddlehead, seashell,
coral, sage, moss, crystal, mote, and the rest) except `'stone'`. There is no
`else` branch, so the drop never sets `d.collected`, never calls `addItem`,
never shows a toast, and just sits there until its 10-second `life` runs out.
`player.stones` can never leave 0, so the General Store's "Stone Shard" sell
row (generated from `TROPHIES`'s `id:'stone'` entry) stays permanently
disabled in every Water-region village.

**Fix.** Add a `'stone'` case to the pickup switch in `stepDrops`, matching
the shape of its neighbors (e.g. `'seashell'`).

### M2 — `skipPrologue()` never grants the starting potions

**Verified by direct read.** `prologue.js:1063` states the invariant this
function exists to preserve: "Everything it sets must match what the beats
set, or a skipped run diverges." It grants the bow, sword, and arrows
(`grantGrandmothersWeapons()`) and sets every prologue flag, but the 5 Minor
Healing Potions granted when the player talks to Grandmother
(`prologue.js:406-411`, gated on `gran_potions_given`) are never granted by
the skip path, and the flag is never set. `STARTING_ITEM_AMOUNT` is 0
(`player.js:15`), so a "New Game, skip prologue" hero starts the open world
with 0 potions, while a hero who played the prologue and talked to
Grandmother has 5.

**Fix.** Call the same grant (or a small shared helper) from `skipPrologue()`.

### M3 — Two of the 13 zone bosses break the otherwise-clean stat progression

**Verified.** Every other boss stat climbs (or holds) in region order across
HP, damage, and XP. Two don't:

- `archmage_void` (Mana, `enemies.js:185`) awards `xp: 90000`, less than
  `hydra_queen` (Poison, the region immediately before it, `enemies.js:184`,
  `xp: 100000`). HP and damage still climb normally (940→1100, 28→32) for this
  pair, so only the XP value looks mistyped.
- `wind_djinn` (Air, `enemies.js:180`) has `hp: 620`, less than both
  `gaia_colossus` (Earth, `hp: 680`) and `magma_tyrant` (Volcanic, `hp: 700`)
  immediately before it. Its speed (500) is notably higher than its
  neighbors' (650-800), which could be a deliberate fast-but-fragile
  archetype rather than a typo. Worth a deliberate call either way.

**Fix, if these are typos:** bump `archmage_void.xp` above 100000 and
`wind_djinn.hp` above 700, matching the neighboring gaps. If either is
intentional, a one-line comment would keep the next audit pass from flagging
it again.

### M4 — Guild Bounty and Man-Eater elites skip the game's global XP halving

**Verified.** `makeBountyEnemy` (`guild.js:320`) computes
`xp: Math.floor(base.xp * 0.75)`. Every other spawn path applies the
documented "Global XP rebalance: all enemies award half their D&D-derived
value" rule explicitly: `spawnEnemiesForMap` (`enemies.js:1337`,
`base.xp * xpMul * 0.5`) and `makeGuildBossEnemy` (`guild.js:93`,
`base.xp * 0.5`). A Bounty or Man-Eater kill nets 50% more XP per base value
than an ordinary kill of the same creature, stacked on top of already being a
3-5x-HP elite. Worth confirming whether the richer payout is the point (the
Guild pays well) or the halving was simply never applied here.

### M5 — `resetGame()` doesn't clear `player.frogOracleMapId`

**Verified.** `DEFAULT_PLAYER` (`save.js:181`) defaults this to `null`, so a
save loaded via `applyLoadData` is fine. But `resetGame()` (the in-game "New
Game" button, `save.js:866-906`) never lists this field in its
`Object.assign`, so starting a second playthrough from inside a running
session (without reloading the page) leaves the old world's map id behind.
`ensureEarthFrog` (`villagers.js:800`) gates the Earth-region frog easter egg
on this field matching the *current* world's map id, so in the new world no
Earth dead-end will ever match the stale id, and the frog silently never
spawns for the rest of that session. No crash or corruption, just permanent,
silent content loss on a common flow (New Game without a page reload). Note
`titleNewGame()`/`titleNewGameSkip()` are unaffected, since they run on a
freshly-booted page where the field was never set.

**Fix.** Add `frogOracleMapId: null` to `resetGame()`'s reset block.

---

## Low

- **`prologue.js:326` — `dog_fled` is set but never read.** A second dead
  prologue flag alongside the already-tracked `dog_outrun` (`prologue.js:1072`).
  Neither the "punched it down" nor the "outran it" outcome of the dog
  encounter is ever checked anywhere else in the codebase.
- **`prologue.js:1072` — `skipPrologue()` always hardcodes `dog_outrun`**,
  never `dog_fled`. Harmless today since neither flag is read, but if either
  is wired up later, skipped runs will be structurally unable to represent
  the "punched it down" outcome.
- **`save.js` — `DEFAULT_PLAYER` and `resetGame()` both omit `bowTimer`**,
  unlike its sibling `punchTimer` (present in both) and `swordTimer`
  (explicitly force-reset). `bowTimer` is live bow-draw-pose animation state.
  Loading a save mid-draw, or hitting New Game mid-draw, can leave the hero
  briefly rendered in the bow-draw pose out of context. Self-corrects within
  ≤280ms since `main.js:130` ticks it to 0 regardless of source, so this is
  cosmetic only. Same class of oversight as M5: a field present in the live
  player object but forgotten in one of its reset/default siblings.
- **`portal.js:213-220` — the exact duplicate-listener bug already fixed in
  shop-core.js was never cleaned up here.** Both a `DOMContentLoaded`
  registration and an immediate direct registration attach the same
  click-outside-closes-modal handler to `#portal-modal-overlay`. Harmless
  (`closePortalModal()` is idempotent) but it's dead weight matching a pattern
  the project already identified and fixed elsewhere.
- **`stats.js` — `statsRAF` is dead state.** Declared, checked, and
  `cancelAnimationFrame`-ed, but nothing ever assigns it a real
  `requestAnimationFrame` handle since the portrait animation loop it once
  drove was removed in favor of a static image (the file's own comment says
  so). `cancelAnimationFrame(null)` is a silent no-op, so no functional
  effect, just leftover scaffolding.
- **`cutscene.js:167` — the `emperorFly` step's `freeze: false` branch is
  dead code.** No call site in `prologue.js` ever passes `freeze: false` for
  this step type, so the non-blocking path is currently unreachable in
  shipped content.
- **`mapgen-biomes.js:1106-1119` — an 18-line dry-sandbar feature never
  executes.** It's guarded by `region.pathDry !== undefined`, but no entry in
  `regions.js`'s `REGIONS` table ever sets `pathDry`, so the condition is
  always false. Looks like one half of a design (a consumer wired up, the
  data side never connected) that was superseded by the current
  shallow/medium/deep water-banding approach without being removed.
- **`mapgen-biomes.js:952-953` — a comment describing the water region's
  paths as "shallow water" is stale.** `regions.js:50` actually sets the
  water region's `path` to `T.SAND`; its corridors are dry sand, matching
  `mapgen-terrain.js`'s own language elsewhere. Likely the other half of the
  same superseded design as the dead code above.
- **`mapgen-biomes.js:939` (and `regions.js`'s own header) undercounts the
  regions sharing `buildRegionMap`.** The comment says "the seven later
  elemental regions," naming nine, while the function actually supports
  eleven (volcanic and shadow are also fully wired in). Documentation drift
  as regions were added over time; no behavioral effect.
- **`mapgen-tower.js:444-451` — a comment misdescribes the Shadow Vault's
  placement algorithm** as "a fixed offset from the floor's centre" when the
  code is actually a plain top-left raster scan for the first open 5x5
  patch. Functionally harmless (still deterministic per floor), just an
  inaccurate description for the next reader. Lower confidence than the
  other findings in this section.
- **`enemies.js:76-77` — `kuo_toa`'s `cr` flavor tag reads oddly next to
  `sahuagin`'s.** `sahuagin` is tagged the nominally tougher `cr: '1/2'` with
  lower or equal hp/dmg/xp than `kuo_toa`'s `cr: '1/4'`. Since `cr` is
  documented as unused at runtime and appears to preserve each creature's
  real Monster Manual rating rather than the game's own tier curve (see also
  `lich` at `cr: 21` beside a much-less-scary-in-game `vampire` at `cr: 5`),
  this is very likely intentional flavor, flagged only as a "does this look
  right to you" item, not a balance regression, since no gameplay stat
  (hp/dmg/xp) breaks order within any region's own roster.
- **`enemies.js:1135` — a `continue` as the last statement of its enclosing
  loop body has no effect.** Harmless leftover from a refactor.
- **`villager-sprite.js`'s `TINT_CACHE` and `render.js`'s `minimapCanvases`
  have no eviction**, unlike every other cache in the rendering layer, which
  invalidates deliberately. In practice this isn't a real leak (villager
  palettes come from a small fixed set of hex literals, so the cache tops
  out at a few dozen small canvases), flagged only as an inconsistency with
  the codebase's otherwise-careful cache hygiene.

### Speculative, lower confidence

- **`prologue.js` — Grandmother is left standing, unwounded, and silently
  non-interactive during the Beat 4 run home.** `pgWound(...)` at
  `prologue.js:770` wounds six named characters but not Grandmother; she
  isn't relocated until Beat 5. `PG_LINES.grandmother` returns `null` under
  `village_burning` (`prologue.js:389`), so a player who detours to her
  original mark during the player-controlled window (`prologue.js:778-780`)
  gets no line and no sign anything is wrong, ahead of Beat 5's "pinned under
  a beam" reveal. Exact tile reachability from that spot wasn't confirmed.
- **`prologue.js:477-479` — Mother's dying words assert a specific action**
  ("You set it by the hearth, like I asked.") that the flag gating her death
  (`fetch_quest_complete`, meaning only that the package is in hand) doesn't
  actually verify happened. Likely intentional narrative compression, not a
  bug, since the Beat 3 trigger radius (7 tiles) could plausibly fire before
  the player has stepped inside.
- **`corruption.js` — dormant enemies are excluded from corruptibility
  checks** (`isCorruptible()`, line 152), and corruption state only resyncs
  on map entry or cleansing. If a dormant golem wakes mid-visit after the
  blight reaches its region, it might fight at un-corrupted stats until the
  player leaves and re-enters. Not confirmed reachable from the files read;
  flagged as a hypothesis for whoever next touches enemies.js and
  corruption.js together.

---

## Not bugs: design decisions worth writing down

- **`village-shadow.js` (~650 lines) is a large, permanent, hand-rolled
  procedural drawing system** for the shadow region's villages, including
  the Obsidian Spire castle. This was flagged against a blanket "always use
  Aseprite, never procedural drawing code" convention that existed in
  project notes at the time of this audit; that blanket rule has since been
  removed (2026-09-05), so this file is no longer an exception to anything
  and needs no further action here. Noted for the record only.
- **Umbral Sanctum / Obsidian Spire status, clarified.** None of the
  `mapgen-*.js` files gate or block this region. `regions.js` fully defines
  the shadow region's overworld generation (village name, boss, enemy tier,
  landmark) exactly like every other late-game region, and `buildRegionMap`
  supports it with no missing wiring. What's actually true: `mapgen-village.js`
  has a bespoke dressing block for every other late region *except* shadow,
  because the shadow region's boss village is built entirely by
  `village-shadow.js` instead. No orientation-check gate was found in
  `mapgen-*.js`, `world.js`, or `village-shadow.js` in this pass; if a memory
  entry says this feature is currently blocked, that specific claim should
  be re-verified against `village-shadow.js`'s actual entry conditions before
  being repeated again, since this pass didn't locate it.
- **Villager sprites are further along than my own notes said.** The
  ambient-crowd sheet (`villager-sprite.js` + `villager-atlas.js` +
  `villager-sheet.png`) is complete and shipped, wired into `villagers.js`.
  Every role-bearing NPC and the fallen-pose scene stay procedural *on
  purpose*, because their overlays are hand-anchored to the procedural
  body's geometry and re-anchoring them to the sheet is separate, deferred
  work, not an omission. Separately, the abandoned low-resolution revert
  mentioned in project history was to the *hero* sprite, not the villagers,
  and it never merged: it lives only on the unmerged branch
  `hero-revert-lowres` (commit `8cb05d9`, whose own message says "not
  intended for main"). There is no dead code from it on `main`.

---

## Suggested order of work

1. **H1** — the cutscene-cancel leak. Small, contained fix (reorder two
   lines), and it's the only finding in this pass that can leave the game in
   a visibly broken state (a dialogue box with nothing behind it, or the
   hero walking on its own).
2. **M1** — the dead Water-region Stones drop. One missing `case` in a
   switch statement, and it's a permanent, silent content gap for anyone
   playing that region.
3. **M2** — `skipPrologue()`'s missing potions. One function call, closes a
   real (if minor) unfair-start gap between the two "New Game" paths.
4. **M3, M4** — the two boss stat outliers and the Guild XP-halving skip are
   all one-line changes, but need a judgment call first: typo or intentional?
   Worth a quick decision from you before either gets "fixed."
5. **M5** and its Low sibling (`bowTimer`) — add the two missing fields to
   `resetGame()`/`DEFAULT_PLAYER`. Same shape as the L2 fix from the last
   audit; worth doing as one pass since the pattern (a field present in the
   live player object but forgotten in a reset/default block) has now
   recurred twice.
6. **Everything else in Low** — independent, low-risk, no urgency.
7. **The two "not bugs" items** aren't code changes; they're a documentation
   decision (ratify the shadow-village exception) and a note to re-verify
   before repeating the Umbral Sanctum "blocked" claim again.

---

## Other things worth your attention

- **The design workbook wasn't checked in this pass.** `Game1.current.xlsx`
  tracks enemy stats among other tables; if M3/M4 above turn out to be real
  typos rather than intentional design, the workbook likely needs the same
  correction once the code does. Worth a `design-workbook` skill pass after
  those are resolved, not before.
- **Two of my own project-memory notes were stale and have been corrected**
  as part of this audit: `sprite-verifier-tooling` said the four tools in
  `tools/` were untracked; they were committed on 2026-08-30 (`1e950b0`) and
  that memory now reflects it. The villager-sprite status is corrected above
  rather than in memory directly. No code changes resulted from either
  correction, just fixing my own notes so they stop asserting something
  that's no longer true.
