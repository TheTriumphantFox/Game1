# Elemental Armor Implementation Notes

## Goal

Each of the 12 elemental armors grants a region-linked traversal, survival, or combat ability while worn. Forest is tier 0 and has no armor.

## Implemented in the first pass

- Added `ELEMENTAL_ARMOR_ABILITIES` in `elements.js` as the central armor-power registry.
- Added shared armor checks so keyboard movement and tap-to-travel use the same traversal rules.
- Corrected Earth, Lightning, and Mana region metadata to identify their elements instead of reporting `null`.
- Armor powers now appear in the radial armor ring, HUD, Character page, and Blacksmith descriptions.
- Fire armor ignores the existing `T.DUNE` movement penalty. This is only a foundation for quicksand traversal.
- Water armor still permits swimming through `T.MEDIUM_WATER`.
- Ice armor stops sliding on `T.ICE`.
- Earth armor can cross and climb `T.LEDGE_FACE` and bypass the normal ledge step-up limit.
- Air armor temporarily supplies Updraft Glide on the shared ability button and slows ledge-fall gravity to 35 percent.
- Lightning territory now has a random 6 to 14 second gameplay strike timer. A strike targets the player for Lightning damage and drives a targeted storm-flash bolt. Lightning armor pauses the timer.
- Luminous armor emits a pulse every 4 seconds. Enemies within 4 tiles are stunned for 1.1 seconds, while bosses reel for 0.3 seconds.
- Shadow armor temporarily supplies Shadow Step on the shared ability button.
- Existing shrine selections are restored when Air or Shadow armor is removed.

## Missing or incomplete by region

### Tier 1: Fire / Desert

- Existing dunes are slowed terrain, not dedicated quicksand.
- No quicksand tile, sinking state, escape behavior, or generated quicksand fields exist yet.
- No regional heatstroke meter or HP drain exists yet.
- Fire armor currently only removes dune slowdown.
- Plain fire immunity remains intentionally dropped.

### Tier 2: Water

- Medium-water swimming is already functional.
- Deep water remains blocked.
- Review whether whirlpool pull should be reduced by Water armor or remain a threat to swimmers.

### Tier 3: Ice

- Ice grip is functional while Ice armor is worn.
- The old Frost Grip shrine reward also stops sliding for save compatibility. This overlap needs a design decision.
- Dormant ice golems, wake logic, placement, art, and loot are missing.

### Tier 4: Earth

- The movement engine can now climb ledge faces while Earth armor is worn.
- **Correction (verified 2026-08-31).** An earlier draft of these notes claimed no generator emits `T.LEDGE` or `T.LEDGE_FACE`. That is wrong; it repeated a stale comment in `config.js` that has since been fixed. `addLedgeCauseway` runs unconditionally for the Earth region (`mapgen-biomes.js`), and the desert gets mesas or a causeway. Measured over ten seeds each: every Earth map carries ~430 `LEDGE`, ~296 `LEDGE_FACE` and 5-15 `CLIMB`; desert maps carry more. Cliff Climb already has real terrain and needs playtesting, not new terrain authoring.
- Open: the hero can now stand ON a `LEDGE_FACE` tile, which is in `EXTRUDED_TILES` and draws as a wall. Whether the hero renders inside it is unverified and needs a human look.
- Existing `T.MOUNTAIN` borders are not climbable because allowing them would let the player cross map boundaries. `isSolid` catches them before the step-up gate, so the `Infinity` step limit only ever affects `T.LEDGE`.
- Dormant stone golems, wake logic, placement, art, and loot are missing.

### Tier 5: Volcanic

- Obsidian golems are missing.
- Idle hardening, climbable hardened bodies, melting, awakening, and active combat states are missing.
- The stacking overheat stat, escalating thresholds, effects, HUD meter, armor slowdown, and armor venting are missing.
- Open lava remains blocked and should not automatically become traversable unless separately approved.

### Tier 6: Air

- Armor-driven Updraft Glide and slow-fall are functional.
- Glide uses the existing four-tile gap-crossing implementation.
- Slow-fall is currently visual because ledge falls do not deal damage.
- The old shrine reward can also grant Updraft Glide. This overlap needs a design decision.

### Tier 7: Lightning

- Random targeted strikes and the armor timer pause are functional.
- Strike interval and 6-damage balance need playtesting.
- Lightning overworld maps and Lightning villages are storm-active. Indoor sky caves and dungeons are currently sheltered.

### Tier 8: Luminous

- Periodic nearby-enemy stun is functional.
- Fog of war was removed from the game, so there is currently nothing for the reveal half of the aura to uncover.
- A replacement darkness, hidden-object, or local-visibility system is needed before reveal can matter.
- Pulse radius, cooldown, normal stun, and boss stagger need playtesting.

### Tier 9: Necrotic

- No cursed-ground hazard or armor traversal exception exists.
- Allied skeleton summoning, ownership, following, targeting, collision, damage, persistence, despawning, and save behavior are missing.
- Seeing and interacting with spirits remains a stretch goal.
- The existing Ember Lantern shrine reward is inert after fog of war removal and may be reusable here, but that needs a design decision.

### Tier 10: Poison

- Toxic bloom enemies are missing.
- Mushroom-cloud attacks and Poison armor resistance are missing.
- The drifting and diffusing miasma simulation, rendering, damage rules, map bounds, and performance limits are missing.
- Existing swamp mushrooms and decorative miasma art are not gameplay hazards.

### Tier 11: Mana / Arcane

- Arcane wards and barriers are missing as world objects.
- Dispel interaction, feedback, barrier state, map persistence, and generation are missing.
- Existing Arcane Sight reveals rune marks but does not dispel anything.
- Decide whether Mana armor replaces, supplements, or remains separate from the Arcane Sight shrine reward.

### Tier 12: Shadow

- Armor-driven Shadow Step is functional using the existing thin-wall teleport.
- The old shrine reward can also grant Shadow Step. This overlap needs a design decision.
- The predictive Shadow temple boss is missing.
- The Earth-region frog foreshadowing NPC and side quest are missing.
- The proposed boss reads and front-runs gameplay key presses, with changing control settings as the counter. This needs an accessibility and touch-control design before implementation.

## Cross-system decisions — SETTLED 2026-08-31

1. **Armor acquisition timing: DECIDED.** Every region must be completable *without* its armor. Regional armor is forged at that region's Blacksmith, which sits behind the boss village, so no armor can gate its own region's first pass. Armor hazards gate optional routes, backtracking secrets, and later areas only. This is a hard constraint on every mechanic below — a hazard that blocks mandatory progression is a bug, not a difficulty choice.
   - **Open verification:** `ensureConnectivity` (connectivity.js) treats `T.MEDIUM_WATER` as floodable while `SOLID_TILES` blocks it at runtime, so generation can call an area reachable by a route only Water armor can walk. Harmless for a chest; a rule violation for a `DUNGEON_DOOR` or an exit corridor. Not yet audited.
2. **Shrine overlap: DEFERRED.** The shrine reward set is being overhauled later. Until then, leave the overlaps alone and keep the compatibility fallbacks (`frostGripHolds` accepting either source; Air/Shadow armor temporarily borrowing the shared [F] slot without overwriting `player.equippedAbility`). Do not design new mechanics around the current shrine rewards.
3. **Equipping inside hazards:** decide what happens if armor is removed while swimming, climbing, standing on cursed ground, or inside a barrier route.
4. **Enemy art:** all new golems, toxic blooms, and summoned skeleton variants require Aseprite sources and generator scripts under the existing art pipeline.
5. **Save compatibility:** persistent meters, summons, barriers, boss learning state, or altered map features need absent-field defaults and old-save migration behavior.
6. **Generation and connectivity:** new blocking hazards must be included in connectivity rules. Generation must not create a route that requires armor before the player can own it.
7. **Touch controls:** Air and Shadow currently reuse the existing ability button. Any new active armor action should avoid adding another permanent touch button.

## Suggested next implementation order

1. Finish Lightning balance and test it in all Lightning map types.
2. Playtest Earth Cliff Climb on the causeways that already generate, and settle the `LEDGE_FACE` rendering question. (This replaces the old step 3, which asked for terrain that already exists.)
3. Audit generation against the "passable without armor" rule, starting with the `MEDIUM_WATER` connectivity gap noted above.
4. Add real Fire quicksand and heatstroke because Fire is the first armor region.
5. Add Ice and Earth dormant golems using one shared dormant-golem state machine with region-specific art and stats.
6. Build Volcanic overheat before obsidian golems, so the region's survival loop can be tested independently.
7. Design Mana barriers, Luminous darkness/reveal, and the Shadow boss only after the simpler regional mechanics establish conventions.
