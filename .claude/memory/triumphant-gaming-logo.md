---
name: triumphant-gaming-logo
description: Triumphant Gaming logo project: chosen concept, palette, asset locations, and what's still unfinished
metadata:
  type: project
---

Company logo for "Triumphant Gaming", generated with the local ComfyUI install (started 2026-08-25).

**Chosen concept:** gold laurel wreath encircling a game controller, on deep navy. Picked over
three rejects: phoenix crest (generic esports, no gaming signifier), trophy-controller (model
ignored the fusion, came out illustrative not vector), crown shield (two crowns, off-palette red gems).
Source render: `/home/hm/AI/ComfyUI/output/tg_laurel_controller_00001_.png` (seed 777001). Three
alternate seeds were generated and all were worse; seed 1 wins because its open wreath leaves
natural room for the wordmark.

**Palette:** navy `#10204A`, gold `#E2B860`, cream `#F5EEDE`.
**Type:** Noto Serif Display Black for "TRIUMPHANT", Bold for the tracked-out "GAMING".

**Assets:** `/home/hm/Projects/Game1/brand/` holds primary-navy, transparent, mono-cream, mono-navy, icon-32/64/128/512.
**Build scripts:** `brand/gen_concepts.py` (drives ComfyUI to render concept marks) and
`brand/build_lockup.py` (keys the navy background to alpha, then composites the wordmark lockup
and icons). Re-run `build_lockup.py` to regenerate every asset from the source render.

**Unfinished when we stopped, and re-verified still unfinished on 2026-08-30:** the 32px icon is
mush (wreath too detailed for a favicon). The proposed fix was never written; `build_lockup.py`
imports no scipy and its icon loop still scales the whole keyed mark, so this is an idea, not
half-landed code. The idea was to isolate the controller alone via scipy connected components, because the single-component
grab drops the touchpad and shoulder buttons, so the fix is to also include every small component
fully contained in the controller's expanded bbox. Also pending, and confirmed still true: `build_lockup.py` calls bare `build()` for
`logo-transparent.png`, whose default is `sub=CREAM`, so "GAMING" renders cream and nearly vanishes
on light backgrounds. It should be gold in that variant. The palette constants check out exactly:
`NAVY = (16, 32, 74)`, `GOLD = (226, 184, 96)`, `CREAM = (245, 238, 222)`.

See [[comfyui-lowvram-constraint]].
