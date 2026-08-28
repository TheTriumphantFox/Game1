---
name: aseprite-for-all-artwork
description: "All Game1 artwork is authored in Aseprite via a generator script, never as procedural canvas drawing code."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1e8c1412-fa4c-4c19-921f-b76a00198c9f
  modified: 2026-08-27T20:30:00.000Z
---

Every piece of art in Hero of Stormdrift goes through Aseprite. Sprites and
tiles are built by a `tools/make-*-sheet.lua` generator, exported to a `.png`
sheet plus an atlas, and blitted at runtime. Do not add new art as procedural
canvas drawing code in `render-tiles.js` or `render.js`, and do not hand-author
PNGs by any other route.

**Why:** The procedural switch in `render-tiles.js` grew to 163 tile cases and
about 267 KB, and its oldest art (T.GRASS is three fillRects, T.TREE is three
arcs) is the weakest thing on screen. Art authored in a real pixel editor is
better, is inspectable, and stops the renderer being the place art lives.

**How to apply:** New art means a new or extended `tools/make-*-sheet.lua`
following the pattern in `make-village-sheet.lua`: sample the palette out of the
concept PNG rather than eyeballing it, write both the `.aseprite` and a
`*-atlas.js` (a plain global assignment, because the game runs from `file://`
where `fetch` cannot read a sibling `.json`), and pair it with a `*-sprite.js`
runtime module that declines gracefully when the sheet has not loaded. Existing
generators: hero, dragon, village, villager, terrain. See
[[perf-hud-temporary]] for the frame budget any new pass has to fit inside.

**Where the binary is:** on the user's original machine it was a source build at
`C:\aseprite\build\bin\aseprite.exe`, version 1.3.18.2-dev, which is the one
that produced every committed sheet (`meta.version` in the sheet JSONs matches).
That path is machine-specific and the user moved to a different computer on
2026-08-27, so **ask where Aseprite lives rather than assuming the old path, and
never conclude it is absent from a handful of negative searches**. See
[[claude-mistake-log]] for the time it was wrongly reported as missing, and for
the rule that Aseprite's headless CLI must run in its own tool call because it
returns before its writes land.

**The one sanctioned exception:** `village-shadow.js` paints the Umbral Sanctum
village skin procedurally instead of from a sheet, and its own header argues
why: village art is one warm-brown sheet shared by every village in the game,
while terrain art is per-region, so a second region skin would need a whole
second sheet and regenerate step. It is written as a paint override that hands
the same geometry back and returns false to fall through, not as a second
renderer. Treat this as a decision about *village skins specifically*, not a
general licence to draw art in code. See [[umbral-sanctum-work]].
