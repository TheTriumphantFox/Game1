# Stage 2 — decision record

Stage 2 is complete except its last item, which stage 9 has taken over. The checklist and
current status live in [main-quest-implementation-todo.md](main-quest-implementation-todo.md) § 2;
this file only keeps the reasoning behind three choices that aren't obvious from the diff,
so nobody undoes them by accident.

## 1. The `hasSword` back-fill can't copy the `hasBow` one

`hasBow`'s migration tests for *absence* and grants the bow, because a save predating the
field belonged to a hero who had been shooting for hours. That logic does not transfer:
under the old rules **every** hero started with a sword, so absence doesn't separate a
veteran from someone three minutes into the prologue.

It keys off prologue progress instead (`applyLoadData`, `save.js`):

- prologue finished, or a save so old it has no `flags` bag at all → keep the sword
- prologue still running → take it; Beat 5 hands it back within minutes
- an explicit `false` from a modern save is always respected

Verified by round-tripping four synthetic saves through `buildSaveData` → `applyLoadData`;
all four behave as above.

## 2. The punch is gated by target, not by context

`doPunch` (`projectiles.js`) deals 1 damage and only to `PUNCHABLE_ENEMY`
(`'hendricks_dog'`). Everything else takes zero and gets a "your fist does nothing"
message rather than silently absorbing it.

The rule in the design notes is about what a fist can hurt, not about where the player is
standing, so it is enforced on the target rather than with a "prologue only" check. A fist
that stays harmless everywhere is one fewer thing to reason about if the punch ever
survives past the prologue.

This is also why the punch sits **outside** `weaponsLocked` in both `update()` and
`triggerAction()` (`main.js`). That lock covers `homevillage`, and the home village is
exactly where Beat 2's dog encounter has to teach the button. Leaving it open is safe
because there is nothing in a peaceful town a fist can break.

The dog itself is stage 4's job. It must be spawned with `type: 'hendricks_dog'`.

`doPunch` also clamps the dog at 1 HP and never calls `killEnemy`, so the dog cannot be
killed even if stage 4's flee check fires late.

## 3. The melee slot shows "Punch", it doesn't hide

The bow slot hides completely before Beat 5, because a bow the player has never seen would
be a spoiler. The melee slot doesn't get the same treatment: `[Z]` still does something,
and Beat 2 exists specifically to teach that button, so it needs a visible control. It
reads `👊 Punch [Z]` (and `👊` on the touch pad, and `Z: punch` in the title hint) until the
sword is won. The *sword* is never named before she tells the player to open the chest,
which is the part that actually matters.

## Open: the legacy shrine reward

Stage 9 replaced the `migrateLegacyShrines` body with a delegation to
`migrateShrineSystemAfterLoad` (`shrines.js`) and made the opposite call on the reward —
it retains the legacy +2 Max HP and records `legacyCompleted` rather than reclaiming it.

That is a legitimate choice, but `legacyCompleted` is currently written in three places and
read in none, so a legacy-completed region keeps its +2 **and** pays the new shrine reward
in full. Whichever way it is settled, one of the two has to actually happen.

The tile half of that item — converting surviving overworld `SEALED_SHRINE` tiles into
ordinary healing shrines and reverting their clue runes — is done and correct.
