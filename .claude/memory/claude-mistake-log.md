---
name: claude-mistake-log
description: "Running log of mistakes Claude made while working on Game1: what happened, why, and how it was fixed."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9727d7b8-95e8-480b-932f-a684705b751a
  modified: 2026-08-16T17:04:08.697Z
---

Running log. Append a new entry below whenever Claude makes a mistake in this project that the user has to catch or correct: wrong assumption, bad edit, broken command, misread of the code, etc.

**Why:** The user wants a durable record of errors and fixes so patterns are visible and the same mistake isn't repeated across sessions.

**How to apply:** Before similar actions, scan the entries below for a matching situation. When a new mistake is caught and fixed, add an entry using this format:

```
## YYYY-MM-DD — short title
**What happened:** the mistake itself
**Why it happened:** root cause (wrong assumption, missing check, stale info, etc.)
**Fix:** what corrected it, and what to do differently next time
```

---

## 2026-08-15 - Em dashes again, in a long markdown deliverable
**What happened:** Wrote a multi-page plan file and several chat responses full of em dashes, despite [[prose-style]] already existing and being loaded. The user caught it with "BTW, you used em dashes again."
**Why it happened:** Checked the rule against short chat replies and forgot it while writing long-form markdown. The failure mode is length: the longer the document, the more the tic reasserts itself, and the less likely a final pass happens.
**Fix:** Rewrote the plan without them. Going forward, scan for the character before writing any markdown file, not just before sending a chat message. Long documents need the check more than short replies, not less.

## 2026-08-15 - Concluded Aseprite was not installed when it was
**What happened:** Reported to the user that Aseprite was not installed anywhere on the machine, and built a whole cost/benefit comparison around that constraint. The user corrected it: `C:\aseprite\`. It is a source checkout with a working build at `C:\aseprite\build\bin\aseprite.exe`, version 1.3.18.2-dev, which matches `meta.version` in the committed sheet JSONs, so it is the binary that produced the existing art.
**Why it happened:** Searched PATH, Program Files, LOCALAPPDATA and the default Steam library, then treated four negative results as proof of absence. Never checked drive roots, and never considered that a tool might be a self-built binary rather than an installed package.
**Fix:** State absence as "I did not find it in X, Y, Z" rather than "it is not installed", and ask, since the user knows their own machine. A negative search result is weak evidence compared to one question.

## 2026-08-16 - Read a stale sheet and concluded the generator had not run
**What happened:** While building village-sheet.png, edited the generator, re-ran it, and checked the output in the same shell command. The pixels were the old ones, the file lengths were byte-identical, and I concluded the edit had not taken effect. Then deleted the outputs and re-ran, and the check reported no files at all. Spent several rounds hunting a nonexistent bug in the Lua.
**Why it happened:** Aseprite's headless CLI returns before its writes and its stdout have landed. Every verification bundled into the same PowerShell call as the aseprite invocation was reading the previous run's file. The identical file lengths were the tell, and I read them as evidence the script was broken rather than as evidence I was reading a stale file.
**Fix:** Run aseprite in its own tool call, and verify in a separate one. Generally: when a check says a just-written file is unchanged, suspect the read before suspecting the write, especially when the "unchanged" evidence is an exactly identical size.

## 2026-08-27 - Wrote a stale code comment into a memory as fact
**What happened:** While writing a handoff memory about the Obsidian Spire, described it as "a thirty-tile tower standing outside the map, two tiles beyond the border ring", quoting a comment in `render.js`. The implementation says otherwise: `SPIRE_TILES_H = 10` and `SPIRE_INSET = 7`, and `village-shadow.js:302` carries a comment block explaining that the outside-the-map anchor was tried, rendered an invisible tower, and was abandoned. A parallel Codex session's handoff doc flagged the contradiction, and checking the source confirmed Codex was right.
**Why it happened:** Read the comment nearest the code I was documenting and treated it as the source. Comments in a file being actively iterated on are the *most* likely thing to be stale, not the least: the constants get changed and the prose around them does not. [[verify-facts-before-stating]] was followed only as far as "read a file", not as far as "read the code that runs".
**Fix:** Corrected [[umbral-sanctum-work]] and listed every stale comment site so they can be cleaned once the geometry settles. Going forward, when documenting behaviour, verify against the constants and the control flow, and treat a nearby comment as a claim to check rather than as evidence. Where a comment and the code disagree, say so in the note rather than silently picking one.

---

## The pattern across these entries, noticed 2026-08-27

Read the four entries above together. They are the same mistake wearing
different clothes:

- Aseprite: four negative search results stood in for the filesystem.
- The stale sheet: a read that happened too early stood in for what was written.
- The spire: a comment stood in for the code it sits above.

Each time I took a **secondary signal that was cheap to obtain** and treated it
as the primary source, then reasoned confidently on top of it. The em-dash
entry is a variant: a rule checked against short replies stood in for the rule
applied everywhere.

Writing the individual entries did not prevent the next one, because each felt
like a different situation in the moment. The generalisation is the useful part,
so state it as a question to ask before asserting: **what am I actually looking
at, and is it the thing itself or a description of the thing?** Search results
describe a filesystem. Comments describe code. A cached read describes a past
state. Documentation describes an intention. All four are worth reading and none
of them are evidence.

The tell is confidence arriving too easily. When a conclusion feels settled
after one cheap check, that is the moment to find the primary source, not after
the user pushes back.
