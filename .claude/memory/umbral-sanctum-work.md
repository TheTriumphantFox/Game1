---
name: umbral-sanctum-work
description: "The Umbral Sanctum shadow-village skin and Obsidian Spire: what they are, the rules they enforce, and what is still unfinished."
metadata:
  node_type: memory
  type: project
  modified: 2026-08-27T20:45:00.000Z
---

The newest feature in the repo as of 2026-08-27 is the **Umbral Sanctum**: a
second village architecture skin for the shadow region, plus the **Obsidian
Spire** landmark. It was written just before the user moved to a different
computer. **It is not finished.** Do not treat it as shipped.

What it consists of:

- `village-shadow.js` (~724 lines): the whole skin. Entry points
  `umbralTileArt`, `drawUmbralRoofPlanes`, `drawUmbralFacade`,
  `drawUmbralWallFace`, `drawUmbralWallCap`, `drawUmbralDoorPanel`,
  `obsidianSpireFoot`, `drawObsidianSpire`, `drawObsidianSpireShadow`.
- `index.html`: one `<script>` tag, after `village-sprite.js`.
- `render.js`: a `umbralTileArt` hook in `drawTile`, a new `DEPTH_SPIRE = 7`
  actor kind in the depth-sort merge, and `isDepthSortedMap` widened from
  forest villages only to `forest || shadow`.
- `render-tiles.js`: an `umbralMasonry` flag beside the existing
  `villageTimber` one in `drawTileExtrusion`, deliberately kept separate so it
  is clear which skin is speaking.
- `.claude/skills/hero-of-stormdrift/SKILL.md`: script count corrected from 47
  to 66 and the list refreshed.

`umbralArtActive()` gates the whole skin to `type === 'village'` and
`biome === 'shadow'`. Tile identity, collision, pathfinding, minimap and save
data are untouched; this is paint only.

**Why it is drawn in code rather than from an Aseprite sheet:** village art is
a single shared sheet across every village, unlike per-region terrain art, so a
second skin would mean a whole second sheet and regenerate step. It is written
as a paint override that returns false and falls through to the procedural
planes, not as a rival renderer. This is the one exception to
[[aseprite-for-all-artwork]], and it was never re-confirmed with the user in
conversation, so raise it rather than citing it as settled policy.

**The design constraint it exists to enforce:** the shadow region occupies about
12% of the luminance scale (`T.SHADOW_GROUND #241d33` down to `T.SHADOW_RIFT
#080510`). Tone alone cannot separate a roof from its ground at that range, so
every shape carries a one-weight ink outline (`UMBRAL.ink #040207`) and every
fill is a flat step, never a gradient. Ink does the work a value difference does
in the forest. Keep that rule for any further shadow-region art.

**The spire's real geometry, because the comments lie about it.**
`SPIRE_TILES_H = 10`, `SPIRE_TILES_W = 5.5`, `SPIRE_INSET = 7`. The foot sits on
the **inner edge of the border ring, inside the map** (rows 1..7 are
buildVillageMap's solid ring, so the hero can never stand in the masonry). An
earlier build anchored it outside the map at a negative row and rendered a
perfect invisible tower, because a tall object draws upward from its foot and
`clampCam` never scrolls above row 0. The authoritative explanation is the
comment block above `SPIRE_INSET` at `village-shadow.js:302`. Every other
comment mentioning "30 tiles" or "outside the map" is stale.

**Re-verified in full on 2026-08-30.** Every constant above still reads as
stated, `village-shadow.js` is still 724 lines, all nine entry points and
`umbralArtActive`'s `village` plus `shadow` gate are unchanged, `DEPTH_SPIRE` is
still 7, `umbralMasonry` is still in `render-tiles.js`, and `drawObsidianSpire`
still contains no reference to `castleExitDir` or any direction at all, so
unfinished item 1 below is exactly as described. All seven stale comment sites
survive: `village-shadow.js` 281, 283, 364, 584 and `render.js` 2081, 2272, 3732.
The line numbers drift by about one, so grep the phrases rather than jumping to a
line. `render.js` 2272 is the worst of them: it justifies the depth sort by the
foot row being negative, whereas the code pushes `spireFoot.y`, which is 7. The
sort still behaves correctly, because row 7 is inside the unwalkable border ring,
but the stated reason is not the real one. Fix these once the geometry is finally
settled, not before.

**Known unfinished work:**

1. **Gate orientation is unresolved, and it is the blocking one.**
   `obsidianSpireFoot` moves the anchor for all four `castleExitDir` values, but
   `drawObsidianSpire` has no direction branching at all: it always draws
   straight up from `baseY`. Everything was reasoned about for a north gate,
   which is what the dev shortcut `getOrCreateActiveRegionVillage(12)` always
   produces, while real progression picks the direction dynamically. Decide
   between forcing the final castle gate north and adapting the spire per
   direction, and test on a walk-generated final village, not the dev map.
2. No visual or gameplay QA has been done. `node --check` and
   `python tools/lint-conventions.py` pass, and nothing more than that.
3. Performance is unmeasured. The spire uses gradients, a radial halo, animated
   windows and a beacon. Measure at normal size and at `TILE_PX 24` before
   expanding it. See [[perf-hud-temporary]].
4. The `out-*.png` captures in the working tree are **forest cottage** controls
   taken before this work. They do not validate anything here.

The dev harness used to look at it (`roof-shot.html`, `shadow-shot.html`) and
the `out-*.png` captures were committed on 2026-08-27 so they would reach the
new machine. See [[dev-shot-harness]].

A parallel Codex session wrote `CODEX_HANDOFF.md` and `AGENTS.md` at the repo
root on 2026-08-27 covering the same ground in more detail, including a wider
survey of which older planning docs have gone stale. Its account of the spire
was checked against the source and was correct.
