---
name: enemy-forge
description: Design balanced enemies for The RPG Game by working backwards from a target difficulty using D&D 5e Challenge Rating math for HP and damage-per-round — this game has no AC or attack-bonus/to-hit stat, so the CR table's defensive/offensive-adjustment machinery doesn't apply, only its HP and DPR columns do — then emitting a stat block in the project's existing shape. Use this skill whenever the user wants a new enemy, monster, boss, or corrupted/template variant, asks whether an existing enemy is too hard or too easy, wants to rebalance a fight, asks what CR something should be for a given player level, or describes an encounter they want to feel a certain way. Trigger even when the user just describes a creature without saying "balance" or "CR" — the whole point is that they shouldn't have to do the math themselves.
---

# Enemy Forge

Turn "an archer that's a fair fight at level 6" into a stat block that actually plays that way.

The method is D&D 5e's Challenge Rating math for the piece it's actually good at: converting a target difficulty into a concrete HP and damage-output number. **This game has no AC, no attack bonus, no to-hit roll, and no ability scores anywhere in its combat** — it's real-time contact/collision combat, not a d20 roll. `references/cr-tables.md`'s AC and attack-bonus columns, and the defensive/offensive-CR adjustment rules built on them, have no equivalent stat to adjust here. Only the HP and damage-per-round columns actually transfer.

## The real stat block

From `enemies.js`'s `DND_ENEMIES` table, every entry carries exactly: `name, hp, spd, dmg, xp, color, size, cr` — plus `ranged`, `element`, `swims`, `boss`, `flies`, `breath`, `finalBoss` when relevant. Two things worth knowing before doing any math:

- **No `ac`, no attack bonus, no ability scores, no to-hit.** `cr` is stored as a flavor/reference tag on the object — the engine never computes or checks it at runtime.
- **`spd` is not tabletop speed-in-feet.** It's the enemy's move/attack tick interval in **milliseconds** (`e.timer = e.spd`, reset each tick — see `stepEnemies` in `projectiles.js`). Lower `spd` means faster ticks: quicker pursuit, and for melee enemies more frequent hits. Reading an enemy's real damage output means `dmg` × attack frequency, never `dmg` in isolation — but see Step 4, because the frequency is *not* simply `1/spd` for either melee or ranged enemies.
- **Melee damage is capped by player i-frames.** A melee hit sets `player.invincible = 900` (`stepEnemies`), so no melee enemy can land hits faster than one per 900 ms no matter how low its `spd` goes. Below `spd: 900`, extra speed buys pursuit and pressure, not damage.
- **So is projectile damage, and this is the one most easily missed.** A projectile hit is gated on `player.invincible <= 0` and sets `player.invincible = 800` (`stepProjectiles`, the `p.type === 'enemy'` branch). **One projectile per 800 ms, full stop, no matter how many are in the air.** Firing more projectiles at once buys angles and coverage, never damage: the extras hit an invincible player and are wasted. Measured against the Adult Red Dragon's 5-shot fan over 30 s: 11 volleys, 55 projectiles spawned, **exactly 11 hits**.
- **Ranged enemies ignore `spd` entirely for damage.** They deal no contact damage at all (the melee branch is gated on `!e.ranged`) and fire on their own `shootTimer`, reset to `1800 + rand*1200` ms — about 2400 ms average, independent of `spd`. See `stepEnemyRanged` in `projectiles.js`.

## The one calibration that matters

5e's CR table assumes a party of four adventurers. The RPG Game is one player in real-time action combat with no AC/to-hit axis at all — the raw table numbers are wildly too tanky pasted in unchanged, and half the table (AC, attack bonus) has nothing to map onto in the first place.

So **never import the table's HP or damage values directly, and never derive a scale from the numbers alone — anchor it to enemies the user has actually confirmed play right.**

**As of this writing, this repo has no confirmed-good reference enemy.** Asked directly which of Goblin, Hell Hound, or Stone Giant currently feels balanced, the answer was: haven't playtested enough to confirm any of them. Don't skip that and invent a ratio anyway. What follows is an *observed pattern* in the existing numbers — useful for placing a new enemy in the right neighborhood, but explicitly unconfirmed until the user says a specific enemy plays right:

| Enemy | Region / tier | Tabletop CR | Tabletop HP (row midpoint) | Actual HP | Ratio |
|---|---|---:|---:|---:|---:|
| Goblin | Forest / 0 | 1/4 | 42.5 | 7 | 16% |
| Wolf | Forest / 0 | 1/4 | 42.5 | 11 | 26% |
| Dryad | Forest / 0 | 1 | 78 | 22 | 28% |
| Owlbear | Forest / 0 | 3 | 108 | 28 | 26% |
| Hell Hound | Fire / 1 | 3 | 108 | 45 | 42% |
| Salamander | Fire / 1 | 5 | 138 | 58 | 42% |
| Mammoth | Ice / 3 | 6 | 153 | 90 | 59% |
| Stone Giant | Earth / 4 | 7 | 168 | 120 | 71% |
| Storm Giant | Lightning / 6 | 13 | 258 | 172 | 67% |
| Purple Worm | Poison / 9 | 15 | 288 | 290 | 101% |

The ratio isn't flat — it climbs from ~15-25% of tabletop HP at low CR toward parity (60-100%+) at high CR, tracking the region progression rather than CR alone. Use this table to place a new enemy's HP in the right neighborhood **and say plainly that it's unconfirmed**, not a locked scale. The moment the user confirms a specific enemy feels right, replace it with their confirmation and note who confirmed it.

## Building an enemy

**Step 1 — Pin the target.** Get two things from the user, asking only if they're genuinely unclear: what player level should meet this enemy, and should the fight feel trivial, fair, dangerous, or a boss. Map that to a CR relative to player level:

| Feel | CR relative to player level |
|---|---|
| Trivial — chaff, appears in groups | level ÷ 4 |
| Fair — the standard encounter | level ÷ 2 |
| Dangerous — a real threat solo | ≈ level |
| Boss — set piece | level + 2 or more |

Groups matter: four enemies at CR 1 are far more dangerous than one at CR 4, because in real-time action combat the player can only face one direction. Halve the individual CR when something spawns in packs.

**Step 2 — Read the target row** in `references/cr-tables.md` for expected HP and damage-per-round only. Ignore its AC and attack-bonus columns entirely — there's nothing in this game to adjust them against. Scale HP by the observed-ratio table above, interpolating toward the trend at the target CR. Damage-per-round has no confirmed project ratio yet either; until an enemy's output is actually confirmed in play, prioritize matching `dmg`/`spd` to an existing, already-shipped enemy of comparable intended threat over trusting the raw tabletop DPR number.

**Step 3 — Spend the budget on character.** Two enemies at the same CR shouldn't play the same. Trade within the HP + damage-output budget (there's no AC axis to trade against):

- Lower HP, higher `dmg` → a glass cannon that punishes standing still
- Lower `dmg`, faster `spd` → a harasser. This only raises damage output down to `spd: 900`, where the player's i-frames take over; past that it's a pressure/pursuit knob, not a DPS knob
- `ranged: true` with moderate `dmg` → controls space instead of trading hits (ranged enemies hold 5–9 tiles distance — see `stepEnemies` in `projectiles.js`). Remember this also *removes* all contact damage and puts output on the fixed ~2400 ms shoot timer, so `spd` becomes purely a repositioning stat
- An `element` tag matching the region's theme → hooks into elemental armor/vulnerability (`elements.js`) without touching the HP/damage budget at all

**Step 4 — Compute HP and effective DPS. Don't manufacture a defensive/offensive-CR average against an AC axis this game doesn't have.**

- *HP target*: interpolate from the observed-ratio table at the target CR.
- *Effective DPS*: the formula depends on how the enemy actually delivers damage — there is no single one.

| Enemy kind | Effective DPS |
|---|---|
| Melee | `dmg × 1000 / max(spd, 900)` — the i-frame floor, not `spd`, sets the ceiling |
| Ranged (`ranged: true`) | `dmg × 1000 / 2400` — the average shoot timer; `spd` does not appear |
| Dragon breath (`breath: 'fire'`) | `dmg × 1000 / 2850` — a 5-projectile fan on a `2400 + rand*900` ms timer, but only ONE shot of the fan can land |

**The breath row used to read `5 × dmg × 1000 / 2850`, on the assumption that the whole fan connects. It does not, and that made this table overstate a breath enemy's output by nearly 5x.** The 800 ms projectile i-frame above means the first shot of a fan to connect eats the whole volley; the other four pass through an invincible player. Measured on the shipped dragon (`dmg: 40`): the old formula predicted 70.18 dmg/sec, the game delivers **14.67**, a factor of 4.78. Every hit was a clean 40, one per volley.

The fan is a coverage and angle mechanism, not a damage multiplier. If you want a breath enemy to hit harder, raise `dmg` or shorten the volley timer; adding projectiles does nothing to its DPS.

Both ranged rows assume the player is inside the firing range (18 tiles for a stock shot, 26 for breath) and that shots connect; treat them as an upper bound. Compare the result to a same-region, already-shipped enemy as a sanity check, since there's no confirmed absolute target yet.

Show this arithmetic — it's the part the user can't easily check by eye, and what makes the number trustworthy.

**Step 5 — Emit in the project's shape.** Read two or three existing `DND_ENEMIES` entries in `enemies.js` and match them exactly — same key order (`name, hp, spd, dmg, xp, color, size, cr`, then optional fields), same conventions for when optional fields appear. There is no separate registration call: adding the object literal to `DND_ENEMIES` (and to the right tier's array in `ENEMY_POOLS`, if it's meant to spawn in the wild rather than only via a village/boss/quest hook) is the entirety of "registering" an enemy here.

## Corrupted / template variants

**There is no blight/corrupted system in the code yet.** The Withering Crown and the blight are `the-rpg-game`'s `story-bible.md` canon — design intent, not a built system. If the user asks for a corrupted variant, treat it as new work, not an extension of something that already exists; don't imply otherwise.

The precedent that *does* already exist for "a modifier applied over a base stat block instead of a second hand-authored creature" is the village **"Greater"** tier — see the `tier15` branch in `makeEnemyDefs` (`enemies.js`): 2× HP, 2× damage, 2× XP, 1.5× size, name prefixed "Greater", applied at spawn time from the same base entry. When the corrupted system does get built, follow that same multiplier-over-base pattern rather than hand-authoring corrupted variants as separate `DND_ENEMIES` entries — that's exactly the authoring drift the existing "Greater" precedent avoids.

## Always report

Alongside the stat block, give the user:

- The target CR and the player level it's built for
- Roughly how many hits the player needs to land, and how many the enemy needs — these two numbers communicate the feel better than any stat
- What was traded away to make room for whatever makes this enemy distinctive
- Whether it's meant to be fought alone or in a group
- Whether its HP/damage numbers are anchored to a user-confirmed reference enemy or to the unconfirmed observed-ratio table — say which, every time, until the repo actually has confirmed references

## Reference

`references/cr-tables.md` — the CR-by-statistics table and worked examples. Only its HP and damage-per-round columns apply here (scaled by the observed-ratio table above); its AC and attack-bonus columns, and the adjustment rules built on them, don't map onto this game's combat at all — skip them rather than forcing an adjustment that has no real stat behind it.
