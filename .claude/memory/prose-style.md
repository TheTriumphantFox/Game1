---
name: prose-style
description: "Never use em dashes in responses to this user; use commas, colons, parentheses, or separate sentences instead."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d488fa48-3f15-46a3-8195-3e1b35b63fad
  modified: 2026-08-15T15:15:05.175Z
---

Do not use em dashes (—) in any user-facing text: chat responses, summaries,
commit messages, PR bodies, or code comments written for this project.

Reach for a comma, a colon, parentheses, a semicolon, or a full stop instead.
Most em dashes in a sentence can simply become a comma, or the sentence can be
split in two.

**Why:** the user asked directly, on 2026-08-14, after a long run of work where
nearly every paragraph I wrote contained one. It reads as a verbal tic.

**How to apply:** check the response before sending. This applies to all future
sessions, not just the one where it was raised. En dashes in numeric ranges
(frames 0-3) and hyphens in compound words are fine; it is specifically the em
dash used as a parenthetical or dramatic break that should go.

This was violated again on 2026-08-15 in a long markdown plan file. The failure
mode is document length: the rule gets applied to short chat replies and
forgotten in long-form writing. Scan for the character before writing any
markdown deliverable (plan files, handoff docs, todo lists), not only before
sending a chat message. See [[claude-mistake-log]].

Related: [[verify-facts-before-stating]]
