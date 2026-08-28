# Codex project memory

This repository is **Hero of Stormdrift**, a browser-based action RPG. Before
changing anything, read these files in order:

1. `index.html` - the authoritative classic-script dependency order.
2. `.claude/skills/hero-of-stormdrift/SKILL.md` - the permanent architecture,
   save-compatibility, story, and verification rules. Despite the directory
   name, these rules apply to Codex work too.
3. `CODEX_HANDOFF.md` - the dated worktree snapshot, current unfinished work,
   validation already performed, and next-session checklist.
4. The subsystem file being changed and two or three neighboring examples.

## Non-negotiable constraints

- The game must work by double-clicking `index.html` over `file://`.
- Use classic scripts and shared globals. Do not add modules, `fetch()` for
  local data, a build step, a package manager, a framework, a CDN, or a network
  dependency.
- Keep the flat root layout. Do not invent `src/` or `styles/` directories.
- Treat `index.html` script order as the dependency graph. Add every new script
  there after its dependencies and before its consumers.
- Preserve old named saves. Default new save fields when absent and retain the
  legacy storage-key migrations in `config.js`.
- `worldMaps` and `worldGrid` register maps and world topology, not individual
  entities or tiles. Match the existing inline placement patterns.
- Extend an existing owner instead of creating a parallel system.
- Do not add new bare `Math.random()` calls to generation. Most overworld
  generation is seeded now; the remaining warnings are listed in the handoff.
- Story or dialogue work must first read
  `.claude/skills/hero-of-stormdrift/references/story-bible.md`. The
  grandmother's dying words intentionally reveal only a partial truth.

## Verification contract

Run `node --check` on every changed JavaScript file and
`python tools/lint-conventions.py`. Then boot `index.html` directly over
`file://`, check the console, load an existing named save, exercise the changed
behavior and one adjacent behavior, and report honestly which checks were
actually performed. The local server in `.claude/serve.ps1` is a convenience,
not proof of `file://` compatibility.

## Document authority

- `main-quest-implementation-todo.md` is complete and is mostly a decision
  record now.
- `oblique-conversion-plan.md` is the original plan and has stale unchecked
  boxes for work that shipped. Prefer `oblique-conversion-todo.md` and the code.
- `AUDIT.md` is a historical 2026-08-13 audit. Most named findings were fixed;
  verify a finding in current code before treating it as open.
- `stage-2-handoff.md` has a stale "legacy shrine reward" warning; current
  `shrines.js` consumes `legacyCompleted` and avoids the double reward.

Always inspect `git status` before editing. The worktree may contain valuable
uncommitted user work, especially the Shadow-village art described in
`CODEX_HANDOFF.md`; do not discard, overwrite, or casually reformat it.
