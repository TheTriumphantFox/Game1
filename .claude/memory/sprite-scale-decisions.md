---
name: sprite-scale-decisions
description: "The sprite scale and art-direction choices the user made for Hero of Stormdrift, which every future NPC sheet has to match"
metadata: 
  node_type: memory
  type: project
  originSessionId: 59467645-a4dc-4a15-b41b-0847c00b2bcd
  modified: 2026-08-23T23:04:29.842Z
---

Set 2026-08-23, chosen by the user from options I put to them. These are
decisions, not derivations. A future sheet that picks different numbers will
look wrong next to what shipped, and the numbers alone do not say they were
deliberate.

**Scale: 1.25 tiles tall.** Offered 1.25 / 1.5 / 2 tiles; the user picked the
most conservative. So the hero is ~62px of art against a 48px tile, and
villagers ~56px. Any new NPC sheet should land in that band. Do not quietly
scale a new character to 1.5 tiles because it looks better in isolation.

**Confirmed still true on 2026-08-30** by measuring the alpha bounding box of
the sheet rather than trusting a comment: the hero's idle-down art is 28x62px,
which is 1.29 tiles. A 96px-frame revert that put the figure at 40x46px, or 0.96
tiles, was tried on the `hero-revert-lowres` branch and abandoned without being
committed, so this decision stands unchanged. Measuring the bounding box is the
cheap way to check a sheet against this rule, and it is worth doing whenever a
sheet is regenerated. See [[npc-sprite-project]].

**Art direction: rebuild toward the portrait**, not a faithful upscale of the
old sprite. The user explicitly chose to let the design change. `hero-portrait.png`
is the source of truth for the hero's design, and the palette in
`tools/make-hero-sheet.lua` was measured off it by median-cut clustering per
region rather than eyedropped.

**The load-bearing geometry fact**, because it is counter-intuitive and I got it
backwards at first: the atlas `body` (48) is the character's GROUND FOOTPRINT,
mapped onto one tile by `render.js`. It is not their height. Raising `body`
above 48 does not add resolution, it makes the renderer downscale. Resolution
comes from letting the figure overhang the tile upward inside a larger frame.
This is written up in the header of `tools/make-hero-sheet.lua`.

**Villager colours are runtime data, not art.** Robe/hair/skin come from
`VILLAGER_TYPES` plus per-quest NPCs carrying arbitrary hex, so the villager
sheet is a KEY-COLOUR MASK recoloured per NPC into a cached canvas. Any new
NPC sheet whose colours vary per instance needs the same treatment; one that is
a single fixed character (a named boss, say) does not.

Related: [[npc-sprite-project]].
