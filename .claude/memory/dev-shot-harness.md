---
name: dev-shot-harness
description: "How to screenshot a specific game state: an iframe harness that boots index.html, teleports the camera and freezes."
metadata:
  node_type: memory
  type: project
  modified: 2026-08-27T20:35:00.000Z
---

To look at a particular map, region or building without playing to it, build a
throwaway iframe harness. The pattern (used by `roof-shot.html` and
`shadow-shot.html`, which were **never committed** and so do not exist in a
fresh clone): load `index.html` in an `<iframe>`, wait for it to boot, click
past the prologue and the name prompt through `contentWindow`, then `eval` a
setup block that calls `getOrCreateActiveRegionVillage(n)`, sets `currentMapId`,
sets `TILE_PX`, places `player.x/y`, syncs `renderX/renderY`, and calls
`clampCam(true)`. Query flags pick the shot (`?in=1` inside a house, `?gate=1`
on the castle approach, `py=` row, `ts=` tile size). Put diagnostics on
`window.__diag` and into `document.title`, so the harness reports whether it
actually landed where it meant to.

**Why:** walking to a shadow-region village by hand to check one roof is slow,
and the alternative (reading the drawing code and imagining it) is how art bugs
survive. This gives a repeatable, parameterised frame.

**How to apply:** keep these files out of the shipped script list in
`index.html`, and out of git unless the user asks otherwise. Two gotchas worth
knowing:

- **Skipping the prologue leaves `burnLevel` at 0.25**, and `drawFireWash` then
  multiplies a warm `#ffba8c` over *every* map for the rest of the session. Set
  `burnLevel = 0` in the harness or every colour judgement you make will be
  wrong, especially in the dark regions.
- Region 12 is the shadow region. The 500ms/1000ms `setTimeout` waits are load
  timing, not superstition; the sheets have to be in before the first frame.

Related: [[umbral-sanctum-work]]
