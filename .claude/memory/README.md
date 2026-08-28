# Claude's project memory

A committed copy of the notes Claude keeps about this project, so they travel
with the repo instead of living only on one machine. Written up on 2026-08-27,
when the user moved to a different computer.

`MEMORY.md` is the index. Every other file is one note, with frontmatter saying
what it is and a body saying why it matters and how to apply it.

## Restoring these into Claude Code's auto-memory

Claude Code reads memory from a per-project folder under the user's home
directory, keyed by the project's working-directory path. It does **not** read
this folder automatically. To wire them back up on a new machine, copy the
`.md` files (not this README) into:

```
<home>/.claude/projects/<project-key>/memory/
```

where `<project-key>` is the working directory path with its separators and
colon replaced by dashes. On the original machine the working directory was
`C:\Users\corte\MACortese42\Game1`, giving
`C--Users-corte-MACortese42-Game1`. If the project sits somewhere else now, the
key changes to match; check what folder Claude Code already created for this
project rather than guessing.

If the two copies drift, the auto-memory folder is the live one. Copy back here
and commit when you want the updates to travel.
