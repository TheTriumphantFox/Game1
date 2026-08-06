# Hyrule Quest — Story Bible

Canon reference. Read before writing dialogue, NPCs, quest text, item flavor, or story triggers.

## Premise: The Withering Crown

An emperor made a pact for immortality. The pact holds, but it has a cost the land pays instead of him: a spreading corruption, a blight that creeps outward and withers what it touches. The crown is the pact made physical.

The player's motivation is revenge, not prophecy. They are not a chosen one. They are someone whose home was burned.

## The Red Dragon Emperor

The antagonist, and the one who wears the crown. He is not a distant rumor in the opening — he personally attacks and destroys the player's village. The player sees him do it. That directness is the point: the inciting incident is personal and witnessed, not reported by an NPC after the fact.

## Prologue beats

1. **Home.** The player lives with mother, father, and grandmother. Establish all three as ordinary and alive.
2. **The fetch quest.** A small errand in the village — dinner or a package — serving as the movement/interaction tutorial. It should feel mundane, and it should introduce villagers by name so their loss lands.
3. **The return.** On the way home, the Red Dragon Emperor attacks. The village burns.
4. **Forced loss.** The encounter is unwinnable by design. The player cannot save the village. Escape is scripted, not earned.
5. **The grandmother's dying words.** She delivers a partial truth about the crown and the pact, then gives the player her bow and arrow — the first equippable weapon and an inherited object, not loot. Sets `revenge_triggered`.

## The partial truth — handle with care

The grandmother tells the player something true but incomplete. She does not know, or does not say, the whole of it.

**The midgame twist:** the player's own village had a historical role in the emperor's original pact. Their home was not a random target.

Everything written for the early and mid game must stay compatible with this. Concretely:

- No NPC may confirm the village was chosen at random.
- No NPC may state the village's role outright before the reveal.
- Elders and villagers who survived may carry unease or evasiveness about the old days — that's the right register.
- Reread her dying-words script before writing any new line that touches the crown, the pact, or the village's past.

If a line you're drafting resolves the ambiguity in either direction, it's wrong. Rewrite it.

## World systems tied to the story

- **Corruption as a map layer.** The blight renders as palette-shifted tiles over affected regions rather than a separate map. Its spread is story state, not decoration.
- **Shrines and fog of war.** Fog-of-war reveal is tied to shrine restoration state. Restoring a shrine is a milestone with a real reward — a heart, an ability — rather than a pile of XP.
- **Corrupted enemies.** Regions the blight has reached use the corrupted template over their base stat blocks. Encounter difficulty should track the story's geography.
- **Story flags live in the coordinate registry.** Progress flags and triggers are registered like any other world state. Don't invent a second story-state store.

## Tone

Grounded and specific over epic and vague. Villagers talk like people. The emperor's menace comes from what he does, not from how he's described. The grandmother's death is quiet.
