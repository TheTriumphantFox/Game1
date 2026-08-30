---
name: sprite-verifier-tooling
description: "Headless sprite verifiers live in Game1's tools/: what they check, how to run them, and that they are currently uncommitted"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 59467645-a4dc-4a15-b41b-0847c00b2bcd
  modified: 2026-08-23T23:04:51.188Z
---

Written 2026-08-23. Four files in `Game1/tools/`, **left UNTRACKED on purpose**:
they were created after the `/done` ship and the user has not been asked whether
they want them in the repo. They will show up in `git status`. Commit or delete
them; do not just leave them drifting.

Still true on 2026-08-30: all four exist, none are tracked, and after the working
tree was restored to `c43b19d` they all have their subject back, so they should
run as designed. They are now the only thing `git status` reports in this repo,
which makes the commit-or-delete question easy to keep putting off.

- `sprite-harness.js` stubs `Image`, canvas and a 2D context over real PNG
  pixels so a browser sprite loader can run headlessly in node. Generic; reusable
  for any future loader.
- `dump-sheet.py` decodes a sheet PNG to `sheet.raw` + `sheet.json` for the
  harness (node has no PNG decoder and this project has no dependencies). Those
  two outputs are gitignored.
- `verify-sprite.js` runs behavioural checks on `villager-sprite.js`.
- `verify-villager.py` checks on the generated villager sheet itself.

Run from the repo root:

    python3 tools/dump-sheet.py && node tools/verify-sprite.js
    python3 tools/verify-villager.py

**Why they exist:** structural checks are close to worthless on sprite code.
`node --check`, greps for banned constructs, and "does the function exist" all
passed a loader whose recolour function ignored its own arguments entirely, and
a draw function that took its destination from the source coordinate. Only
testing what the code DOES caught either. The checks that matter are of the form
"two different palettes must produce different pixels" and "moving `sx` by 70
must move the sprite by 70".

**Every check in them was written because something got past a weaker one.** If
one fails, read it before believing it: see [[verifiers-fail-correct-code]].
