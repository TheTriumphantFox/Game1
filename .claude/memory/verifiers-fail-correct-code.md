---
name: verifiers-fail-correct-code
description: "Feedback: when a check I wrote rejects delegated or generated work, suspect my own check and my own spec before concluding the tool or model failed"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 59467645-a4dc-4a15-b41b-0847c00b2bcd
  modified: 2026-08-23T23:05:07.353Z
---

Learned 2026-08-23, the hard way, across one long session on Game1's sprites.

I concluded twice that the local qwen worker "was not economical" for sprite
work. The user pushed back both times, saying "I know qwen can do it, we just need to
figure out the secret sauce", and was right both times. Every failure I had
attributed to the model turned out to be **my** input:

- Two fatal bugs in a generated sprite loader traced to ambiguities I wrote.
  `x`/`y` named the source frame position in one paragraph of my spec and the
  destination anchor in another, in the same function's scope. And "factor < 1
  multiplies each RGB channel" never said *of what*. Rewriting the prose, with the same
  model, same path and same task, fixed both on the first try.
- **Five separate verifiers I wrote rejected correct code.** A walk cycle failed
  a "feet planted" check for putting a foot below the rest row, which is what a
  step is. A sole check asserted `sy + footF*body` when the `footF` term cancels
  and the answer is `sy + s`. A check asserted `.x`/`.y` after I had changed the
  contract to `frameX/frameY`. A width floor written for front-facing art was
  applied to profiles, which are legitimately narrower.

**Why:** "the delegation failed" and "my check is wrong" produce the identical
observable, a red FAIL, and I reached for the first explanation without
testing the second. Doing that twice cost about 40 minutes and two premature
conclusions I stated confidently to the user.

**How to apply:**

1. When generated work fails a check, read the failing output and the check
   before reporting a verdict. Ask "would a correct implementation pass this?"
2. Validate a verifier against known-good code before trusting it to judge
   anything. A verifier is code and has bugs like code.
3. Before blaming a model, re-read the spec for name collisions and implicit
   referents. Grep the spec for any identifier used with two meanings.
4. Do not generalise a failure into a verdict about a tool from one or two runs.
   Say what failed and why, and keep the verdict scoped to that.

This is one face of the pattern named at the bottom of [[claude-mistake-log]]:
a cheap secondary signal (here, a check I wrote) standing in for the primary
source (what the code actually does). Read the two together. Note that
[[delegate-to-qwen-policy]] is referenced below but no such note exists yet;
write it or drop the link.

The working recipe that came out of this lives in
[[delegate-to-qwen-policy]] (spec hygiene, behavioural verification, and the
`qwen -c last` revision loop). Once it was applied, four consecutive delegations
landed correct on the first attempt.
