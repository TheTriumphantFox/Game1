---
name: perf-hud-temporary
description: "perf-hud.js is diagnostic tooling the user wants removed before release, not permanent game code."
metadata: 
  node_type: memory
  type: project
  originSessionId: cabda797-8fd4-4c45-94e1-2e57d5f13509
  modified: 2026-08-27T20:30:00.000Z
---

`perf-hud.js` (the `#perf` on-screen render() timer, PR #61) is **temporary**. On
2026-08-16 the user decided: keep it for now, remove it prior to release.

**Why:** it exists to answer one question the desktop cannot, which is how the
2.5D oblique renderer performs on a real phone at TILE_PX 24. That check passed
(median 4ms, 24% of the 16.7ms budget), but it stays for now because the cost is
worth re-checking as the Elderbrook pilot gets more art.

**How to apply:** do not treat it as shipped game code, and do not build features
on it. When release prep starts, deleting it is three edits with nothing else to
update: drop the file, drop its `<script>` tag from `index.html`, and decrement
the file count in the script list in `.claude/skills/hero-of-stormdrift/SKILL.md`
(it says 66, and that number has been wrong before, so count
`index.html`'s `<script>` tags rather than trusting either source). Counted on
2026-08-30: `index.html` has 66 `<script src=>` tags, so SKILL.md is right at the
moment. It briefly read 64 while an abandoned villager revert sat in the working
tree, which is the reminder that this count tracks the tree, not the project.
Nothing else
in the game references it, though `terrain-art-plan.md` cites its numbers as the
frame budget baseline. It wraps `render()` rather than editing it precisely so it
can leave no trace. The same note is in the file's own header, so this is a
reminder rather than the only record.

Note the skill was called `the-rpg-game` until the 2026-08-26 rename; the
`.claude/skills/the-rpg-game/` directory still exists on disk but is empty of
content. `hero-of-stormdrift` is the live one. See [[project-renamed-stormdrift]].
