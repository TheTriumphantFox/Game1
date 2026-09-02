---
name: project-renamed-stormdrift
description: "The game is called Hero of Stormdrift; the GitHub repo, the folder path and older docs still say Game1."
metadata:
  node_type: memory
  type: project
  modified: 2026-08-27T20:30:00.000Z
---

The game was renamed from "the RPG game" to **Hero of Stormdrift** on
2026-08-26 (commits 32aba9b, e56826c). Several older names survive and are not
mistakes to fix on sight:

- The GitHub remote is still `TheTriumphantFox/Game1`.
- The working copy still lives under a `Game1` folder path.
- The repo skill was renamed `.claude/skills/the-rpg-game` to
  `.claude/skills/hero-of-stormdrift`. As of 2026-08-30 the old directory is
  gone entirely, so a reference to `the-rpg-game/SKILL.md` now fails outright
  rather than reading an empty file.

**Why:** memories, plan docs and handoff notes written before the rename point
at the old skill path and the old title, and following one silently reads the
wrong (empty) file.

**How to apply:** use "Hero of Stormdrift" in anything user-facing, read
`.claude/skills/hero-of-stormdrift/SKILL.md` for project conventions, and do not
propose renaming the GitHub repo or the folders unless the user asks.

**Sibling skills:** `.claude/skills/` also holds `enemy-forge` (CR-based enemy
balance math) and `design-workbook` (keeps `Game1.current.xlsx` in sync with the balance
tables in the source). Both post-date the notes above; check them before
hand-rolling either job.

**Repo layout gotcha:** the git repository is the *inner* `Game1\Game1`
directory, which on the current machine is `/home/hm/Projects/Game1/Game1`. The outer folder is not a repo, and holds loose reference material
(the .docx main-quest script, the dated `Game1.*.xlsx` workbooks, `story-decisions-todo.md`, concept
PNGs) that is not version controlled and does not travel with a clone.
