# The RPG Game — Story Bible

Canon reference. Read before writing dialogue, NPCs, quest text, item flavor, or story triggers.

Authority: `../../../../the-rpg-game-main-quest-script-3.docx` (**DOCX v3**) is the source
this file tracks. Where the two disagree, v3 wins and this file is wrong. The
implementation checklist that turned v3 into code is `main-quest-implementation-todo.md`
at the repo root, including the decisions that were made *against* v3 and why.

## Premise: The Withering Crown

An emperor wanted more time. A wizard sold him **the Long Draught** and swore it was years
in a cup. It was. It is still pouring: the Draught bought him an immortality the land pays
for instead of him, as a blight that creeps outward and withers what it touches. The crown
he wears is a separate thing, and the older crime — see the canon chain below.

The player's motivation is revenge, not prophecy. They are not a chosen one. They are
someone whose home was burned.

## The canon chain — locked

In order, and none of it may move:

1. **Grandmother's family ruled this land.** Kindly enough that when the Emperor came
   asking for a crown of his own, they refused him.
2. **He took it by force, and Elderbrook helped him take it.** The player's own village,
   long before they were born, thinking they were buying themselves safety.
3. **A wizard, now long dead, supplied the Long Draught.** He did not take the crown, he
   did not give the crown, and he never appears. He is a fact mentioned once, in the last
   scene of the game.
4. **The Draught caused the transformation and the blight.** The dragon shape is what the
   potion did to him; the corruption spreading region by region is what it is still doing
   to everything else.

Note that (1) and (2) contradict DOCX v3's *pre-fight* line, which has the wizard promising
a crown. That contradiction was resolved in favour of the dying monologue, which is the
load-bearing reveal. See the header comment in `tower.js`.

## The Red Dragon Emperor

The antagonist, and the one who wears the crown. He is not a distant rumor in the opening —
he personally attacks and destroys the player's village. The player sees him do it. That
directness is the point: the inciting incident is personal and witnessed, not reported by
an NPC after the fact.

**He is the Adult Red Dragon at the top of the castle tower, and the game does not say so
until the player is standing in front of him.** Everything up to that scene calls the
creature what the bestiary calls it. `nameTheEmperor` (`tower.js`) renames it on the HP bar
at the moment the scene confirms it.

## Prologue beats

The full shooting script — every line, with trigger conditions and state flags — is
`prologue-script.md`, and it is kept in sync with what actually ships. Read that before
writing anything the player hears during the opening. The summary below is the shape of it.

1. **Home.** The player lives with mother, father, and grandmother. Establish all three as
   ordinary and alive. Grandmother's bow rests against the wall, visible from the first
   frame; the household chest sits in the corner, locked, with her sword inside it.
2. **The fetch quest.** A package from Wren the shopkeeper — the movement, interaction and
   shop tutorial. It should feel mundane, and it introduces villagers by name so their loss
   lands. Hendricks' dog is the obstacle that teaches the action button.
3. **The warning.** On the way home, birds scatter, villagers look up, the wind turns, and
   a shadow crosses the sky.
4. **Ashfall.** The Emperor descends and burns the village. Unwinnable by design; the
   player is dropped to 3 HP and runs home through collapsing streets. The innkeeper, the
   shopkeeper and the herbalist survive. The blacksmith does not.
5. **The grandmother's dying words.** She delivers a partial truth about the crown, tells
   the player the attack was aimed at *them*, and gives them her bow and the sword in the
   chest. Sets `revenge_triggered`, then `prologue_complete`.

## The partial truth — handle with care

The grandmother tells the player something true but incomplete. What she gives them is:

- the crown was **promised** to him a long time ago by people who should have known better,
  and **those people are long dead**;
- **the attack was aimed at the player.** "He was after us... he was after you..."

What she never gives them is **why**. She does not name her family, she does not say what
Elderbrook did, and she does not know or mention the wizard or the Draught.

**The midgame twist:** the player's own village had a historical role in the Emperor's
original pact. Their home was not a random target.

Everything written for the early and mid game must stay compatible with this. Concretely:

- No NPC may confirm the village was chosen at random.
- No NPC may state the village's role outright before the reveal.
- No NPC may name Grandmother's family, mention the wizard, mention the Long Draught, or
  suggest the tower dragon is the Emperor.
- Elders and villagers who survived may carry unease or evasiveness about the old days —
  that's the right register.
- Reread her dying-words script before writing any new line that touches the crown, the
  pact, or the village's past.

If a line you're drafting resolves the ambiguity in either direction, it's wrong. Rewrite
it.

**The four fortune tellers** (Water, Volcanic, Luminous and Mana villages, `villagers.js`)
are the sanctioned way to leak more of it, and each is allowed exactly one fragment: the
crown predates the dragon; the Emperor began human and wanted more time; a ruling house
vanished during the takeover; the player's village has no records older than the road. The
MAY / MAY NOT list is written out above `FORTUNE_TELLERS` — read it before touching a line.

## Style rules

- **No em dashes in dialogue.** Anything a character says, and any narration inside a
  dialogue box, uses commas, full stops or ellipses instead. Toasts, banners, map names,
  item descriptions, UI chrome and code comments are exempt and use them freely.
- **Elderbrook stays ruined.** Map 0 is ash from Beat 4 onward and is never rebuilt,
  repopulated or restored, by a shrine or by anything else. The ruin is the permanent
  visual payoff of Beat 5, and the blight overlay deliberately does not draw on it — a
  village that looks cleansable is a promise the story does not keep.

## World systems tied to the story

All four of these were design intent when this file was first written. All four are now
built; what follows is what they actually are.

- **Corruption as a map layer.** `corruption.js`. Derived per frame from the
  `corruption_level` story flag and the region's shrine quest, drawn as a `multiply` pass
  that palette-shifts the tiles underneath. It never mutates terrain. Distinct from the
  necrotic region's `BLIGHT` tiles, which are ordinary biome ground with an unfortunate
  name. Advances as each region opens; a region's shrine cleanses it.
- **Shrines and fog of war.** `shrines.js` for the 13 puzzles, `abilities.js` for what
  their rewards do. Exactly 8 heart containers and 5 abilities, never XP. Solving a shrine
  also widens that region's walking fog reveal from 12 tiles to 14 and reveals its village
  outright.
- **Corrupted enemies.** The `corrupted` template in `corruption.js`: 1.5× HP, damage and
  XP over the base entry, following the `tier15`/"Greater" multiplier pattern, reversible,
  and stripped from everything still alive when the region is cleansed.
- **Story flags.** `story.js` owns `setFlag`/`getFlag`/`hasFlag`/`clearFlag` over a single
  `player.flags` bag, persisted with the rest of the player. That bag is the one home for
  story state; don't scatter a second one beside it. Note that `world.js`'s coordinate
  registry is *not* that home: it tracks which generated map sits at which grid cell and
  has no per-entity or per-flag API.

## Superseded

Recorded so nobody re-proposes them. The full table, with reasoning, is in
`main-quest-implementation-todo.md`.

- **The 12-shrine "Elemental Ward" proposal** — one shared puzzle engine of 3–4 ward tiles
  struck with the region's own element, one shrine per village except the starting village.
  Replaced by DOCX v3's **13 bespoke shrine designs**, one per elemental region village,
  built from generic puzzle tiles (switches, plates, blocks, beams, timers) and requiring
  no elemental gear at all. Elderbrook gets none.
- **The wizard taking the crown.** He supplied the Long Draught and nothing else.
- **Legacy overworld sealed shrines** (+2 Max HP for an elemental strike). Migrated into
  the shrine schema; the old overworld shrines are ordinary healing shrines now.

## Tone

Grounded and specific over epic and vague. Villagers talk like people. The emperor's menace
comes from what he does, not from how he's described. The grandmother's death is quiet.
