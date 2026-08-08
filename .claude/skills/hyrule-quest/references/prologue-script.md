# Prologue Script — "Ashfall"

*The Withering Crown* — Prologue. Transcribed from `opening_scene_script.pdf`.

This is the shooting script for the opening. Dialogue here is **canon and final** — if
you need a line the player hears during the prologue, take it from this file rather
than writing a new one. Beats are in the format `SKILL.md` prescribes: trigger
condition and state flags first, then the lines.

Story context for everything below lives in `story-bible.md`. The rule that matters
most while editing this file: **the grandmother's dying words are a partial truth on
purpose.** Do not let any line here — or any line elsewhere in the early game — close
that gap.

---

## BEAT 1 — The House

```
Trigger: New Game, after the hero name is confirmed
State:   sets `prologue_started`
Place:   family home interior, home village (map 0)
```

**[INT. FAMILY HOME — MORNING]**

Player spawns in the family home. Warm color palette.

Mother is near the hearth, Father near the door, Grandmother seated by the window
with her bow resting against the wall beside her.

> **MOTHER:**
> Up already? Good — I need someone to run to the market before the stalls close.

*(Tutorial prompt: movement)*

> **FATHER:**
> Take the west road, it's faster. Mind the Hendricks' dog, he still doesn't like
> strangers.

*(Tutorial prompt: interact)*

Player may optionally speak to Grandmother before leaving.

> **GRANDMOTHER:**
> *(not looking up)*
> Bring me back something sweet, if there's any left. And don't dawdle — the sky's
> an odd color today.

> **GRANDMOTHER:**
> Take the little green ones from the shelf. You always come back scraped.

*(Item acquired: 5 Minor Healing Potions — the player's starting stock. Given
once, on first speaking to her.)*

*(Beat. She glances at the bow beside her, then back out the window. No further
explanation given — just a flicker of unease.)*

*(The potions are practical, not portentous. She is packing off a child who
scrapes their knees, and that is all the line may carry — she does not know what
is coming, and nothing here may suggest she does.)*

---

## BEAT 2 — The Village (tutorial quest)

```
Trigger: talking to MOTHER in Beat 1
State:   sets `fetch_quest_active`; on pickup sets `fetch_quest_complete`
Place:   home village exterior
```

**[EXT. VILLAGE — DAY]**

Player is sent to fetch dinner / a package. Simple objective marker leads through
the village.

- NPC dialogue teaches shop/inventory interaction
- Minor obstacle (locked gate / skittish animal) teaches the action button
- 2–3 optional flavor NPCs to make the village feel alive (a child playing, a
  merchant haggling, an old friend who teases the player)

Once the item is collected, objective updates: **"Head home."**

> **Authoring note:** the story bible asks that villagers here be introduced *by
> name*, so their loss in Beat 4 lands. Flavor NPCs are optional to talk to but
> should not be anonymous.

---

## BEAT 3 — The Warning

```
Trigger: player heads home with `fetch_quest_complete`
State:   —
Place:   village road
```

**[EXT. VILLAGE ROAD — DAY]**

As the player starts back, ambient shift: birds scatter, NPCs pause and look up,
wind picks up. A shadow sweeps across the ground.

> **VILLAGER** *(offscreen)*:
> ...Do you feel that?

Beat. Silence. Then a distant roar.

*(Trigger: brief cutscene — camera pulls up. A massive red shape crosses the sky,
too far to make out clearly yet.)*

---

## BEAT 4 — Ashfall

```
Trigger: end of Beat 3
State:   sets `village_burning`
Combat:  none possible — the encounter is unbeatable by design
Place:   home village, burning
```

**[EXT. VILLAGE — CONTINUOUS]**

The Red Dragon Emperor descends over the village center.

Player input is locked for the initial strike — a wide burst of fire crosses the
screen, tiles beginning to char/corrupt in real time (palette shift trigger).

Input returns. Objective: **"Get home."**

Forced-run sequence back through the village — burning structures, fleeing NPCs,
collapsing paths forcing minor rerouting. **No combat is possible here; the
encounter is unbeatable by design.**

*(Optional: one NPC the player met in Beat 2 is seen for the last time here —
doesn't need dialogue, just a visual beat.)*

---

## BEAT 5 — What's Left

```
Trigger: player reaches the family home in Beat 4
State:   sets `revenge_triggered`, then `prologue_complete`
Item:    grants Grandmother's Bow — first equippable weapon
Place:   family home, ruined
```

**[INT. FAMILY HOME — RUINS]**

Player arrives at the house, now half-collapsed and burning at the edges. No sign
of Mother or Father — implied, not shown.

Grandmother is pinned beneath fallen timber near the hearth, her bow lying just
out of her reach.

> **GRANDMOTHER:**
> *(weak, but steady)*
> There you are. Good. I was afraid I'd... go without saying it.

Player approaches. She reaches for the bow — can't quite get it. Player picks it
up for her, or she gestures for them to take it — implementation choice.

> **GRANDMOTHER:**
> That bow was mine, once. And my mother's before that. I hoped you'd never need it.

*(Beat.)*

> **GRANDMOTHER:**
> He's no dragon of legend, child. Not truly. That crown he wears — it isn't his by
> right. It was *promised* to him, a long time ago, by people who should have known
> better. I know that much. I don't know all of it. No one living does anymore.

> **GRANDMOTHER:**
> But I know this — the ones who made that promise thought they were buying us
> time. They were wrong.

*(Her hand closes weakly around the player's.)*

> **GRANDMOTHER:**
> Don't let it be for nothing. Take the bow. Find out what he took, and what he's
> still taking. And when you're standing in front of him —
> *(the faintest, tired smile)*
> — don't miss.

*(She goes still. A held beat of silence — no music, no prompt, just stillness.)*

*(Item acquired: Grandmother's Bow — first equippable weapon)*

*(State flag set: `revenge_triggered` — affects future dialogue options, possibly a
passive damage/rage mechanic against Emperor-aligned enemies)*

**[SCREEN FADES. TITLE CARD: HYRULE QUEST]**

---

## Implementation notes

These are the script's own notes, kept verbatim in substance.

**`revenge_triggered` flag.** Could gate certain dialogue trees (more
aggressive/terse player dialogue options), or add a minor mechanical bonus vs.
corrupted/Emperor-aligned enemies — a subtle way to make the player *feel* the
revenge motivation without a heavy-handed system.

> Status: the flag is set and persisted. The damage bonus is **not built** — it
> depends on a corrupted-enemy template that doesn't exist yet (see `SKILL.md` on
> the `tier15`/"Greater" pattern to follow when it does).

**Partial truth.** Grandmother's line *"I don't know all of it. No one living does
anymore"* deliberately leaves the door open for the midgame twist (that the
village/family had some hand in the original pact) without contradicting anything
she says here.

**Bow as starting weapon.** Sets up ranged combat as the core kit from minute one —
worth deciding early if this is the *only* weapon type for a while, or if melee
options unlock later.

> Status: the game ships a sword as well. The bow is gated behind `player.hasBow`
> and granted in Beat 5; the sword is untouched.

**Unbeatable encounter.** Recommend either fully locking combat input during Beat
4, or allowing "combat" but scripting all damage to deal 0 / be non-lethal
narratively — cleaner to just lock it.

> Status: locked. The Emperor is drawn as a cutscene actor and never enters the
> enemy system, so there is nothing to target.

**Corrupted village callback.** Keeping the ruined house as a revisitable location
later (post-shrine-restoration) would pay off Beat 5 visually if you restore it
partially over time.

> Status: the ruined village *is* map 0 and stays the player's home base. Partial
> restoration over time is unbuilt.
