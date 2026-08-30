---
name: npc-sprite-project
description: "Ongoing goal: replace every NPC and player sprite in Hero of Stormdrift; hero is done, villagers are half done, what remains and why it was deferred"
metadata: 
  node_type: memory
  type: project
  originSessionId: 59467645-a4dc-4a15-b41b-0847c00b2bcd
  modified: 2026-08-23T23:04:15.486Z
---

Started 2026-08-23. The user's stated goal: **all new sprites for the NPCs and the
player**, starting with the player, "increase resolution and redesign when needed".

**Done and merged** (commit `aae51db`, merged as `7e62114`): the hero, redrawn at
128px frames / 28x62px of art / 4.9 heads tall; and villagers, a new key-colour
mask sheet plus `villager-sprite.js` and a `!v.role && !fallen` gate in
`drawVillager`.

**Resolved 2026-08-30. Read this before the paragraph above, which describes a
state that no longer exists on disk.** An audit found 11 tracked files modified or
deleted in the working tree, uncommitted and unexplained: the villager work
deleted, and the hero rescaled from 128px frames down to 96px with a 40x46px
standing figure, below the chosen 1.25-tile scale. The reflog named it: a branch
called `hero-revert-lowres`, sitting at the same commit as main with no commits of
its own, so the revert only ever existed in the working tree. The user confirmed
it was an experiment at reverting the player sprite and chose to work off the last
commit instead.

`git restore .` put the tree back to `c43b19d`. Verified after: `hero-atlas.js`
back to `frame: 128` / `perDir: 52` / `sheetCols: 26` / `swordLen: 35`,
`hero-sheet.png` back to 3328x1024, the idle-down figure measured back at 28x62px
(1.29 tiles), all six villager files restored, 66 `<script src=>` tags in
`index.html`, and `node --check` clean on `hero-sprite.js`, `villager-sprite.js`,
`render.js` and `villagers.js`. **HEAD is now the source of truth and everything
below is accurate again.**

The low-res experiment was preserved before restoring, as a `git diff --binary`
patch and a file copy, in this session's scratchpad. That scratchpad does not
survive, so if the low-res direction is ever wanted again it has to be redone. It
is not in any branch.

The lasting lesson is about the audit, not the sprites: **an uncommitted working
tree is not evidence of what the project wants.** Four notes had been rewritten to
describe the 96px state as current before the reflog was consulted. Check
`git status` and `git reflog` before concluding that memory has drifted, because
the tree can be the thing that drifted. `villager-atlas.js`, `villager-sprite.js`, `villager-sheet.png`,
`villager-sheet.json`, `villager-sheet.aseprite` and
`tools/make-villager-sheet.lua` show as deleted against HEAD, the two villager
`<script>` tags are gone from `index.html` (64 `<script src=>` tags now, against
the 66 still listed in `hero-of-stormdrift/SKILL.md`), and `drawVillager` in
`villagers.js` carries no sprite gate. The edit to `index.html` makes this look
deliberate rather than a stray delete, but it was never explained to me, and it
is uncommitted. The hero sprite work is untouched and still in place. Ask the
user what happened before acting on step 1 below; it may be a revert to redo
rather than a pass to polish.

(That paragraph is superseded by the resolution above: the villager files are
back on disk and the gate in `drawVillager` is restored, so remaining item 1
below is live work again, exactly as originally written.)

**Remaining, in the order I would do it:**

1. **Villager art needs a by-eye pass.** What shipped is a working skeleton, not
   finished art. The face is a pale band with two eyes, the arms are stiff bars,
   and the profile (14px) is a touch narrow beside the hero (28px). The hero took
   about five visual iterations to stop reading as a blob; the villagers have had
   none. The coordinates are all in `tools/make-villager-sheet.lua` and the art
   flaws trace to that table, not to any renderer bug.
2. **Re-anchor the 13 role overlays**, then widen the gate in `drawVillager`.
   Until then a village mixes sprite townsfolk with procedural shopkeepers. See
   the commit body for why they are deferred: each overlay is hand-placed against
   the procedural body's geometry (`py + s*0.28` for a head) and the sheet figure
   overhangs its tile, so its head is nowhere near there.
3. **Enemies** are still fully procedural (`render-enemies.js`, 183KB) and were
   never in scope for this pass. The dragon already has its own sheet.

`pgFallen` should probably stay procedural indefinitely, see the commit body.

Related: [[sprite-scale-decisions]], [[sprite-verifier-tooling]].
