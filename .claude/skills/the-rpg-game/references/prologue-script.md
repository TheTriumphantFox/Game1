# Prologue Script — "Ashfall"

*The Withering Crown* — Prologue. Tracks **DOCX v3**
(`../../../../the-rpg-game-main-quest-script-3.docx`) and the code that implements it
(`prologue.js`, `mapgen-prologue.js`).

This is the shooting script for the opening. Dialogue here is **canon and final** — if you
need a line the player hears during the prologue, take it from this file rather than
writing a new one, and if this file and `prologue.js` ever disagree, the code is what
shipped and one of the two is a bug.

Story context lives in `story-bible.md`. Two rules matter most while editing this file:

1. **The grandmother's dying words are a partial truth on purpose.** Do not let any line
   here, or any line elsewhere in the early or mid game, close that gap.
2. **No em dashes in dialogue.** Commas, full stops and ellipses instead. Prose *about* the
   scene (including this sentence) may use them freely.

---

## BEAT 1 — The House

```
Trigger: New Game, after the hero name is confirmed
State:   sets `prologue_started`
Place:   family home interior, home village (map 0)
```

**[INT. FAMILY HOME — MORNING]**

Player spawns in the family home. Warm color palette.

Mother is near the hearth, Father near the door, Grandmother seated by the window with her
bow resting against the wall beside her. Two props are on the map from the first frame
because both pay off in Beat 5: **the bow** (`T.GRAN_BOW` at `HOME.bowRestAt`) and **the
household chest** (`HOME.chest`), which is locked, holds her sword, and is exempt from the
generic chest loot table.

> **MOTHER:**
> Up already? Good, I need someone to run to the shopkeeper's before they close up.

*(Tutorial prompt: movement)*

> **FATHER:**
> Take the shortcut past the mill, it's faster. Mind the Hendricks' dog, he still doesn't
> like strangers.

*(Tutorial prompt: interact)*

Player may optionally speak to Grandmother before leaving.

> **GRANDMOTHER:**
> *(not looking up)*
> Bring me back something sweet, if there's any left. And don't dawdle. The sky's an odd
> color today.

> **GRANDMOTHER:**
> Take the little green ones from the shelf. You always come back scraped.

*(Item acquired: 5 Minor Healing Potions — the player's entire starting stock. Given once,
on first speaking to her; `gran_potions_given`.)*

*(She glances at the bow beside her, then back out the window. She doesn't explain.)*

*(The potions are practical, not portentous. She is packing off a child who scrapes their
knees, and that is all the line may carry — she does not know what is coming, and nothing
here may suggest she does.)*

> **Wren's pronouns are not established** anywhere in v3 or the code, so Mother says
> "before *they* close up". Change it if Wren is ever pinned down.

---

## BEAT 2 — The Village (tutorial quest)

```
Trigger: talking to MOTHER in Beat 1
State:   sets `fetch_quest_active`; on pickup `fetch_quest_complete`
         dog: `dog_blocking`, then `dog_resolved` + (`dog_fled` | `dog_outrun`)
Place:   home village exterior
```

**[EXT. VILLAGE — DAY]**

The errand runs west along the road, past the mill, through the Hendricks' gate, to the
store. **Wren is the store shopkeeper** — v3 removed the duplicate market-stall merchant,
so the package giver and the keeper are one person. Objective markers: 📦 over Wren, then
🏠 on the house door.

> **WREN:**
> Your mother's package. Last one, I was about to close up.
>
> *(You take the bundle. It's still warm.)*

**Hendricks' dog** is the obstacle that teaches the action button, and the prologue's only
creature. Two phases:

- **Blocking.** Before the package, it sits in the gate's single road tile and does not
  move or attack. SPACE beside it calms it aside.
- **Chasing.** Once the package is in hand it wakes and pursues for 1 damage a touch. It
  has 3 HP, the punch does 1, and at 1 HP it breaks off and flees. It cannot be killed.
  Outrunning it ends the encounter just as well.

Beat 3 will not fire until the dog is resolved either way.

The named flavor cast, all four kept from v3: **Nettie** (child), **Bram** (friend), **Old
Hendricks** (elder), **Sella** (the one watching the sky).

> **Authoring note:** villagers here are introduced *by name* so their loss in Beat 4
> lands. None of them is anonymous.

---

## BEAT 3 — The Warning

```
Trigger: within 7 tiles of HOME.door, carrying the package, dog resolved
State:   sets `warning_seen`
Place:   village road
```

**[EXT. VILLAGE ROAD — DAY]**

Staged, not narrated, and in this order — the animals know before the people do, and the
people know before the sky shows them anything: birds scatter off the rooftops, villagers
stop and look up, the wind rises. Then a shadow crosses the ground, high and fast and too
far to make out.

> **VILLAGER** *(offscreen)*:
> ...Do you feel that?

*(The roar. A bundled local `dragon-roar.wav`, played on the cue, with a screen shake.)*

> *(narration)*
> Silence. Then, a long way off, a roar.

---

## BEAT 4 — Ashfall

```
Trigger: end of Beat 3
State:   sets `village_burning`
Combat:  none possible — the encounter is unbeatable by design
Place:   home village, burning
```

**[EXT. VILLAGE — CONTINUOUS]**

The Emperor comes in high, drops onto the square, and lands.

> *(narration)*
> He lands in the square he has never had any reason to know the name of.

**The strike.** A wall of flame leaves him and crosses the screen, and the tiles char
behind it in three passes so the fire visibly causes the ruin. Player input is locked for
this. **Player HP is set to exactly 3** (set, not subtracted; temporary HP is cleared with
it), so the run home lands the same for a full-health hero and a scraped-up one.

Input returns, combat stays locked. Objective: **"Get home."**

The run home is a forced sequence through burning streets with three deterministic
chokepoints that each block two of the corridor's three lanes and alternate which stays
open, so the player weaves rather than sprints. Softlock-proof by construction.

Everyone the player met in Beat 2 is still there, dying, with one last thing to say
(`PG_LAST_WORDS`). None of it is required. Talking to one spends its last words and takes
it; anyone the player never reaches dies where they lie when the prologue closes. **The
window for going back for them is the run home**, which is the point: the player chooses
between the people behind them and the house ahead.

Mother and Father are staged out on the road, coming the other way, so Beat 5's "no sign of
your mother or your father" stays true of the room.

**Old Hendricks is the one to be careful with.** He is the only other villager who
remembers what Grandmother remembers, and he must NOT close the gap her dying words leave
open. He gets as far as saying there is something, and no further:

> **OLD HENDRICKS:**
> Your grandmother. Is she...
>
> *(giving up on the question)*
> There's a thing she should have told you. Years back. I said so at the time and she knows
> I said it.
>
> *(He looks like a man working up to the rest of it. He doesn't get there.)*

**Who survives:** the innkeeper, the shopkeeper (Wren) and the herbalist, on their original
marks. The blacksmith does not. The ruined store is buy-only with nothing on its shelves;
the herbalist drops to forest-tier level-1 healing potions and pricing; the inn trades
normally.

---

## BEAT 5 — What's Left

```
Trigger: player reaches the family home in Beat 4
State:   sets `revenge_triggered`, then `prologue_complete`
Item:    Grandmother's Bow, ten plain arrows, and Grandmother's Sword from the chest
         — the first equippable weapons. The bow is equipped; the sword is left to
         normal weapon selection.
Place:   family home, ruined
```

**[INT. FAMILY HOME — RUINS]**

The house is half-collapsed and burning at the edges. No sign of Mother or Father, implied
and not shown.

Grandmother is pinned beneath fallen timber near the hearth, her bow lying just out of her
reach. **The household chest stands open beside her, its lock burned away.**

> **GRANDMOTHER:**
> *(weak, but steady)*
> There you are. Good. I was afraid I'd... go without saying it.

Player approaches. She reaches for the bow and can't quite get it; the player picks it up.
(v3 allows either staging. This is the one where the player acts, because the whole game is
about what they do next.)

> **GRANDMOTHER:**
> That bow was mine, once. And my mother's before that. I hoped you'd never need it.

*(Beat.)*

> **GRANDMOTHER:**
> He's no dragon of legend, child. Not truly. That crown he wears, it isn't his by right. It
> was promised to him, a long time ago, by people who should have known better. By people
> who are long dead...

> **GRANDMOTHER:**
> He was after us... he was after you...

*(Her hand closes weakly around the player's.)*

> **GRANDMOTHER:**
> Don't let it be for nothing. Take the bow and what's in the chest. Find out what he took,
> and what he's still taking. And when you're standing in front of him...
> *(the faintest, tired smile)*
> ...don't miss.

*(She goes still. A held beat of silence — no music, no prompt, no banner, nothing on
screen but the room.)*

Then the hero crosses the room to the chest, and the grant fires there.

> *(narration)*
> The lock is gone, burned through. Inside, wrapped and unburnt, is a sword, and a quiver of
> ten plain arrows.

**[SCREEN FADES. TITLE CARD: THE RPG GAME]**

*(The same card the Skip Prologue path shows, so the two entry points into the open world
are the same game.)*

---

## What the two lines must and must not do

Her two reveal lines carry exactly two things: **the crown was promised to him by people
now long dead**, and **the attack was aimed at the player**. They must not name her family,
say what Elderbrook did, mention a wizard or the Long Draught, or hint that the dragon at
the top of the tower is the Emperor. All of that belongs to the final scene (`tower.js`),
and it only lands there if she leaves the hole.

---

## Implementation notes

The script's own notes, with what actually shipped.

**`revenge_triggered` flag.** Could gate more aggressive dialogue options, or add a minor
damage bonus against Emperor-aligned enemies.

> Status: the flag is set and persisted. The damage bonus is **still not built** and was
> explicitly deferred. The corrupted-enemy template it was waiting on now exists
> (`corruption.js`), so the blocker is gone if anyone wants it.

**Partial truth.** Deliberately leaves the door open for the midgame twist.

> Status: intact, and now leaked in four sanctioned fragments by the fortune tellers in the
> Water, Volcanic, Luminous and Mana villages (`FORTUNE_TELLERS`, `villagers.js`).

**Bow as starting weapon.**

> Status: both of Grandmother's weapons arrive together in Beat 5, because the sword is
> what is in the chest she tells the player to open and nothing else in the game grants
> one. A fresh hero starts with neither: `player.hasSword` and `player.hasBow` are both
> false, `[Z]` is a punch until Beat 5, and the sword controls, radial ring and title-screen
> hint all stay hidden until it lands.

**Unbeatable encounter.**

> Status: locked. The Emperor is drawn as a cutscene actor and never enters the enemy
> system, so there is nothing to target. The punch added for the dog is suppressed while
> `village_burning`.

**Corrupted village callback.** Keeping the ruined house revisitable would pay off Beat 5.

> Status: the ruined village **is** map 0 and stays the player's home base for the rest of
> the game. It is never restored, and the blight overlay deliberately does not draw on it —
> a village that looks cleansable is a promise the story does not keep.
