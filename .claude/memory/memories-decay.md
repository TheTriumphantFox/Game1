---
name: memories-decay
description: "Memories on this project go stale fast; audit them against the code at handoff points rather than trusting them."
metadata:
  node_type: memory
  type: feedback
  modified: 2026-08-27T21:45:00.000Z
---

On 2026-08-27, asked to prepare notes for a move to another computer, the
useful work turned out not to be writing new memories but **auditing the
existing ones**. Four of the seven had drifted from the code in under three
weeks:

- Two pointed at a skill directory renamed out from under them.
- One described a hand-maintained frame layout that had since been generated.
- One recorded a tool path that was only ever true of one machine.

None of them announced that they were stale. Each read as confidently as the
day it was written.

**Why:** this codebase moves fast, and a memory is a snapshot with no expiry
date attached. The risk is not that a stale memory is useless; it is that a
stale memory is *authoritative-sounding*, so it displaces the check that would
have caught it. The Aseprite path is the sharp example: stated as fact, it would
have produced a confident wrong answer on any new machine.

**How to apply:** treat a memory as a strong hypothesis about the past, not a
fact about the present, and verify anything it names (a path, a function, a file
count, a constant) before acting on it or repeating it. Do this especially when
the memory is what makes a task feel already solved.

At natural checkpoints, a machine move, a rename, a big merge, a release, read
the whole set against the repo and fix what has drifted. It takes a few minutes
and it is the only thing that keeps the set worth consulting. Prefer correcting
an existing note to adding a new one beside it; two notes disagreeing is worse
than one note being out of date.

Related: [[verify-facts-before-stating]], [[claude-mistake-log]]
