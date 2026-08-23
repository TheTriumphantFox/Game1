# Challenge Rating Reference

Derived from the D&D 5e monster-creation guidelines. Use these as the *baseline* to scale from — see the calibration step in SKILL.md. These assume tabletop party-of-four combat, which The RPG Game is not.

## Monster statistics by CR

| CR | Armor Class | Hit Points | Attack Bonus | Damage / Round | Save DC |
|---:|---:|---:|---:|---:|---:|
| 0 | 13 | 1–6 | +3 | 0–1 | 13 |
| 1/8 | 13 | 7–35 | +3 | 2–3 | 13 |
| 1/4 | 13 | 36–49 | +3 | 4–5 | 13 |
| 1/2 | 13 | 50–70 | +3 | 6–8 | 13 |
| 1 | 13 | 71–85 | +3 | 9–14 | 13 |
| 2 | 13 | 86–100 | +3 | 15–20 | 13 |
| 3 | 13 | 101–115 | +4 | 21–26 | 13 |
| 4 | 14 | 116–130 | +5 | 27–32 | 14 |
| 5 | 15 | 131–145 | +6 | 33–38 | 15 |
| 6 | 15 | 146–160 | +6 | 39–44 | 15 |
| 7 | 15 | 161–175 | +6 | 45–50 | 15 |
| 8 | 16 | 176–190 | +7 | 51–56 | 16 |
| 9 | 16 | 191–205 | +7 | 57–62 | 16 |
| 10 | 17 | 206–220 | +7 | 63–68 | 16 |
| 11 | 17 | 221–235 | +8 | 69–74 | 17 |
| 12 | 17 | 236–250 | +8 | 75–80 | 17 |
| 13 | 18 | 251–265 | +8 | 81–86 | 18 |
| 14 | 18 | 266–280 | +8 | 87–92 | 18 |
| 15 | 18 | 281–295 | +8 | 93–98 | 18 |
| 16 | 18 | 296–310 | +9 | 99–104 | 18 |
| 17 | 19 | 311–325 | +10 | 105–110 | 19 |
| 18 | 19 | 326–340 | +10 | 111–116 | 19 |
| 19 | 19 | 341–355 | +10 | 117–122 | 19 |
| 20 | 19 | 356–400 | +10 | 123–140 | 19 |

## Adjustment rules

**Defensive CR** — start from the row whose HP range contains the enemy's HP. Then compare its AC to that row's expected AC: for every 2 points of AC above expected, raise defensive CR by 1; for every 2 points below, lower it by 1.

**Offensive CR** — start from the row whose damage-per-round range contains the enemy's average damage over its first three rounds of combat. Then compare its attack bonus to that row's expected: every 2 points above expected raises offensive CR by 1, every 2 below lowers it by 1. Use save DC instead of attack bonus for enemies whose main threat is a save-based effect.

**Final CR** = (defensive CR + offensive CR) ÷ 2, rounded to the nearest CR step.

## Effective HP and damage

Resistances and immunities raise *effective* HP above printed HP — roughly ×2 for resistance to most incoming damage at low CR, tapering as CR climbs. Temporary hit points, regeneration, and reliable healing count toward effective HP too.

For damage per round, average the first three rounds of what the enemy realistically does — including a big opening move it can only use once, spread across those three rounds. Don't count a nova attack as if it fires every round.

## Worked example

*A ranged skirmisher, targeting CR 2.*

- Row for CR 2: AC 13, HP 86–100, attack +3, damage 15–20.
- Wanted: fragile but hits hard and stays at range.
- HP set to 80 → that's the CR 1 row → defensive CR 1. AC 15 is 2 above the CR 1 row's expected 13 → +1 → **defensive CR 2**.
- Damage per round 22 → that's the CR 3 row → offensive CR 3. Attack bonus +2 is 2 below the CR 3 row's expected +4 → −1 → **offensive CR 2**.
- Final: (2 + 2) ÷ 2 = **CR 2**. On target.

Then apply the project's HP scaling ratio before writing the actual stat block — the 80 HP above is a tabletop figure, not a The RPG Game figure.

## Group encounters

Numbers multiply threat faster than statistics do. As a rough guide, a pack of *n* enemies plays roughly like a single enemy of substantially higher CR — and more so in real-time action combat than at a tabletop, because the player can only face one direction and can be surrounded. When designing something that spawns in groups of three or more, target roughly half the individual CR you'd pick for a solo encounter, then playtest.
