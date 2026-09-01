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

- **BUILT 2026-08-31.** Fire armor now: walks quicksand safely, bakes at half rate, and still cancels dune slowdown. Plain fire immunity remains intentionally dropped.
- **Quicksand** is `T.QUICKSAND` (id 192), passable and lethal. Standing on it sinks the hero over 2.6s and then drowns them; Fire armor walks it as sand. Wading is 3x slower.
  - The escape margin is an INVARIANT and it is one step wide. `floor(QUICKSAND_SINK_MS / (MOVE_MS * QUICKSAND_MOVE_MUL))` = 5 wading steps; measured over ten desert maps the deepest quicksand tile sits 4 steps from open ground. Widening the blot radius, slowing `MOVE_MS`, or raising the multiplier all eat that margin and make blot centres unsurvivable. Re-measure if any of them move.
- **Heatstroke** is the first entry in `HEAT_REGIONS` (abilities.js), a shared meter built for two regions rather than one. Heat fills only on hot tiles (`T.DUNE`, `T.QUICKSAND`), cools everywhere else, and costs HP only once full — 7.5s to full unarmored, 14.9s in Fire armor (armor halves the fill rate rather than stopping it), 1 HP/s at full, 3s to cool from full. Clears on leaving the region. HUD slot `ws-heat`, hidden while cold.
- **Generation**: `addDesertHazards` widens the dune fields and cuts 2-4 quicksand blots per map through `stampHazardBlots`, the shared blot stamper `addCursedGround` was refactored onto. Both skip `T.PATH`, and quicksand additionally refuses water and bridges so an oasis crossing can never become a death trap. Verified over twelve maps: **all four exits reachable without touching quicksand OR dune**, so the road route across the desert is both drown-free and heat-free.

### Tier 2: Water

- Medium-water swimming is already functional.
- Deep water remains blocked.
- **Whirlpool: DECIDED 2026-08-31.** Water armor cancels the 2 damage and nothing else. It does NOT resist the pull, because the dive is a destination — the flooded grotto below is optional content and the vortex is its only entrance — so resisting would close the route off at exactly the point the hero is best equipped for it. Armored swimmers get a different message so the mitigation is legible.

### Tier 3: Ice

- Ice grip is functional while Ice armor is worn.
- The old Frost Grip shrine reward also stops sliding for save compatibility. This overlap needs a design decision.
- **Dormant ice golems: BUILT 2026-08-31** (`ice_golem`), on the shared golem machine. The rules are identical in all three regions and are written out once under Tier 4 below.

### Tier 4: Earth

- The movement engine can now climb ledge faces while Earth armor is worn.
- **Correction (verified 2026-08-31).** An earlier draft of these notes claimed no generator emits `T.LEDGE` or `T.LEDGE_FACE`. That is wrong; it repeated a stale comment in `config.js` that has since been fixed. `addLedgeCauseway` runs unconditionally for the Earth region (`mapgen-biomes.js`), and the desert gets mesas or a causeway. Measured over ten seeds each: every Earth map carries ~430 `LEDGE`, ~296 `LEDGE_FACE` and 5-15 `CLIMB`; desert maps carry more. Cliff Climb already has real terrain and needs playtesting, not new terrain authoring.
- Open: the hero can now stand ON a `LEDGE_FACE` tile, which is in `EXTRUDED_TILES` and draws as a wall. Whether the hero renders inside it is unverified and needs a human look.
- Existing `T.MOUNTAIN` borders are not climbable because allowing them would let the player cross map boundaries. `isSolid` catches them before the step-up gate, so the `Infinity` step limit only ever affects `T.LEDGE`.
- **Dormant stone golems: BUILT 2026-08-31** (`stone_golem`). One shared state machine in `enemies.js` covers Ice, Earth and Volcanic — `GOLEM_REGIONS`, `stepGolems`, `wakeGolem`, `makeGolemDefs`.
  - **Wake rules:** within `GOLEM_WAKE_RADIUS` (3.5) without the region's armor wakes it; being damaged ALWAYS wakes it, armor or not; once awake it stays awake for the visit, so re-equipping mid-fight cannot settle it. Damage is spotted by watching `hp < maxHp` rather than by hooking each damage source, so a source added later cannot forget to wake them.
  - **Solid but climbable, in all three regions.** `GOLEM_STAND_Z` is 0.5, exactly `STEP_UP_MAX`, so a sleeping golem is the tallest thing an actor can step onto without a ramp — climbable by anyone, with no new movement rule. It composes: a ledge stands at 1.0 and is unreachable from the ground, but a golem asleep beside one is 0.5 up and then 0.5 more onto the shelf. **Keeping a golem asleep opens routes**, so the armor changes the map and not only the danger. Verified: ground→ledge blocked, golem→ledge allowed.
  - `actorSurfaceZ` (map-helpers.js) is the ONE place golem height enters movement; `stepUpBlocked` reads it, so keyboard movement and both pathfinders inherit the rule and cannot disagree. `surfaceZ` stays pure of entities on purpose.
  - Waking a golem the hero stands on drops them via `startPlayerFall` — the support just stood up.
  - **Placement is landmark-style, not roster:** 3-5 per open region map, never on `T.PATH`, ≥12 tiles apart, never in a boss village. Verified over 8 seeds per region — ice 3.9, earth 4.3, volcanic 3.9 per map; 0 on roads, 0 pairs too close, 0 in villages, 0 in non-golem regions.
  - Art is procedural (`render-enemies.js`): one body, three palettes. Asleep = bowed head, no bob, dead seams, no eyes; awake = stands, seams light, eyes on. The pose difference is the tell, so a player can see at a glance which golems in a field are still sleeping.
  - Still open: drops are the tier default; no golem-specific loot yet.
- **Frog oracle: BUILT 2026-08-31.** The Warty Oracle stands on the first SEALED Earth dead-end map the hero enters, remembered on `player.frogOracleMapId` so a later dead-end does not mint a second. It walks three lines and then holds on the third, which carries the actual instruction, and sets the `frog_warned_shadow` story flag for the Shadow boss to read. Verified over twelve seeds: placed on all twelve, adjacent to mud every time. It is drawn procedurally in `drawVillager` rather than from a sprite sheet, matching every other role-bearing NPC in the game; give it a sheet the day it needs to hop.

### Tier 5: Volcanic

- **Overheat: BUILT 2026-08-31.** A `HEAT_REGIONS.volcanic` entry on the shared meter. Hot tile is `T.MAGMA_CRACK`, which was already the passable fissure dapple, so no new tile was needed. 8.7s to full bare, 17.4s in Fire armor.
- **Two armor roles.** Volcanic armor sets `immuneArmor` and removes the meter outright — no fill, no stages, no bar. Fire armor is `slowArmor` and halves the fill, so it is the partial substitute for a hero who has not reached tier 5. Desert heatstroke deliberately has only the slow role.
- **Escalating ladder** (`stages`): 40% heat haze, 70% haze plus a 1.45x step interval, 100% full haze, 1.8x step interval and 2 HP every 0.9s.
  - `sluggish` is implemented as a LONGER STEP INTERVAL, never as dropped, delayed or randomised input, and the haze is a colour wash and rising bands, never a warp or blur of the playfield. Degrading real controls or distorting what the player is aiming at breaks assistive input and motion sensitivity and reads as a bug rather than as heat. Both carry that reasoning inline; do not "improve" either into actual input interference.
- `addVolcanicHazards` widens the fissure dapple into fields via `stampHazardBlots`, skipping `T.PATH` and refusing lava and bridges. Verified over twelve maps: 168 fissure tiles average (70-386) and **all four exits reachable by a completely cool route on 12 of 12**.
- **Obsidian golems: BUILT 2026-08-31** (`obsidian_golem`) on the same shared machine. Idle hardening and climbable hardened bodies ARE the shared dormant/climbable behaviour, so those are done.
- **Melt state: BUILT 2026-08-31.** A woken obsidian golem runs MOLTEN and is a heat source in its own right (`moltenHeatAt`, enemies.js): it feeds the overheat meter from wherever it stands, whatever the hero is standing on. That is what makes it more than a big enemy with a big number — fighting one on cool ground still costs, retreating is a real option, and Volcanic armor answers the fight and the region with one decision.
  - Falls off linearly to zero at 4.5 tiles, sums over every molten golem in range, clamps at 0.22/s so a crowd cannot multiply the meter. A DORMANT obsidian golem radiates nothing — statues are cold.
  - Measured on cool ground beside one: 0.078/s adjacent, 0.033/s at 3 tiles, 0.311 heat after 4s, halved by Fire armor, zero in Volcanic armor. Two adjacent stack to 0.156 and clamp.
  - Its awake art is molten rather than merely lit — running lava, core glow, embers — because the fight has to look like the reason the bar is climbing, or the bar reads as unrelated.
- Open lava remains blocked and should not automatically become traversable unless separately approved.

### Tier 6: Air

- **DECIDED and BUILT 2026-08-31.** Air armor's real power is a LONGER glide: `GLIDE_ARMOR_RANGE` 6 against the shrine reward's `GLIDE_RANGE` 4. Verified: a 3-wide gap crosses either way, 4- and 5-wide gaps need the armor, 6-wide stops both.
- `GLIDE_RANGE` was deliberately left at 4 because it is also a generation contract — `ensureAbilitySecret` places its secret islets within it, and raising it would move islets that already exist.
- Escaping the map by gliding is structurally impossible at any range: a glide only lands on a non-gap non-solid tile and every border ring is solid. The big inland water bodies (forest 37, water 65, mana 50 tiles across) stay uncrossable.
- Slow-fall stays VISUAL and that is now deliberate, not a gap. Adding ledge fall damage to make it matter was rejected: it would retune every desert mesa and Earth causeway in the game, none of which were laid out against a fall cost.

### Tier 7: Lightning

- Random targeted strikes and the armor timer pause are functional.
- Strike interval and 6-damage balance need playtesting. The numbers are named constants at the top of `abilities.js` (`STORM_STRIKE_*`) so tuning is a one-line edit.
- Lightning overworld maps and Lightning villages are storm-active. Indoor sky caves and dungeons are currently sheltered.

### Tier 8: Luminous

- Periodic nearby-enemy stun is functional.
- Fog of war was removed from the game, so there is currently nothing for the reveal half of the aura to uncover.
- A replacement darkness, hidden-object, or local-visibility system is needed before reveal can matter.
- Pulse radius, cooldown, normal stun, and boss stagger need playtesting. All four are named constants at the top of `abilities.js` (`RADIANT_*`).

### Tier 9: Necrotic

- **Cursed ground: BUILT 2026-08-31.** `T.CURSED_GROUND` (id 191) is PASSABLE and drains 1 HP every 1.2s while stood on; Necrotic armor stops the drain dead rather than reducing it. Passable rather than solid because the armor is forged behind the region's own boss village, so a wall would gate the region behind itself.
- The drain reads the tile under the hero every frame rather than hooking the movement step, so standing still on it hurts too, and the clock resets on stepping clear — crossing a narrow finger costs nothing, wading into a field costs plenty.
- `addCursedGround` (mapgen-biomes.js) blots 3-6 patches per map, seeding each centre on open ground; a uniform centre landed in rock four times in five and yielded 51 tiles a map against the 141 it makes now (range 58-204 over ten seeds).
- Generation skips `T.PATH`, so the roads stay clean. Verified over fifteen maps: **all four exits reachable on every map without ever standing on cursed ground**, and zero cursed tiles on a road.
- Allied skeleton summoning, ownership, following, targeting, collision, damage, persistence, despawning, and save behavior are missing.
- Seeing and interacting with spirits remains a stretch goal.
- The existing Ember Lantern shrine reward is inert after fog of war removal and may be reusable here, but that needs a design decision.

### Tier 10: Poison

- **Toxic blooms and mushroom-cloud resistance: BUILT 2026-08-31** (`toxic_bloom`). A ROOTED plant that breathes a spore cloud on a 3.2s clock over a 2.6-tile radius for 6 damage. It never steps and never swings — `rooted` leaves the AI loop before both the movement and the melee contact check — so it is less a fight than terrain that hits back, and walking wide of one costs nothing but distance.
- **The cloud is telegraphed and that is the mechanic, not decoration.** It swells for 900ms before bursting, the sac inflates and the threatened radius brightens, and the ring the player sees is drawn from `bloomSwell` — the same number the damage fires on. A rooted enemy hitting an area with no wind-up would be unreadable.
- **Poison armor is full immunity to the cloud**, not a reduction, matching how Necrotic stops the cursed drain dead and Volcanic removes overheat. That is separate from and on top of the -50% elemental block any Poison armor already gives: the block is defence, this is the region's key.
- Placement is landmark-style like the golems, because a rooted enemy's position IS its mechanic: 4-7 per poison map, never on `T.PATH`, ≥9 apart. Pulse clocks are randomised on spawn so a field breathes out of sync rather than detonating in unison. Verified over 8 seeds: 5.5 per map, 0 on roads, 0 pairs too close, 0 in other regions, 6 of 6 spawned with distinct clocks.
- The drifting and diffusing miasma simulation, rendering, damage rules, map bounds, and performance limits are missing.
- Existing swamp mushrooms and decorative miasma art are not gameplay hazards.

### Tier 11: Mana / Arcane

- **DESIGN CHANGED 2026-08-31.** The ward/barrier + dispel concept is dropped. Mana armor's ability is now the **Arcane Doppelganger**: a short-lived clone that replays the hero's recent path a fixed beat behind, and can hold glyphs, block hazards or projectiles, and be stood on.
- A placement proposal exists at `mana-doppelganger-proposal.md` — codebase hooks, the trail-buffer and clone data structures, placeholder cues, and the decisions still open. **No code written, and Mana is now DEFERRED TO LAST in the build order** (decided 2026-08-31).
- Deferred on cost and sequencing, NOT because the mechanic was judged bad. It is the only remaining ability that needs a whole new subsystem before any of it can be tested, and two of its three hooks do not exist yet. The proposal stands as written; pick it up from its §6 build order.
- Three findings from that research worth carrying: there is **no movement history** anywhere in the codebase today and the trail buffer is the foundational piece; the **`[F]` slot is already claimed** by Air and Shadow armor and Mana would be the third, against a documented constraint of no fourth touch button; and **pressure plates are shrine-scoped and held by pushable blocks, not actors**, so "clone holds a glyph" is a new concept rather than an integration.
- Existing Arcane Sight reveals rune marks and is unrelated; leave it to the shrine overhaul.

### Tier 12: Shadow

- Armor-driven Shadow Step is functional using the existing thin-wall teleport.
- The old shrine reward can also grant Shadow Step. This overlap needs a design decision.
- The predictive Shadow temple boss is missing.
- The Earth-region frog foreshadowing NPC is BUILT (see Tier 4). It sets `frog_warned_shadow`; the boss encounter should read that flag and adjust how much it explains.
- The proposed boss reads and front-runs gameplay key presses, with changing control settings as the counter. This needs an accessibility and touch-control design before implementation.

## Cross-system decisions — SETTLED 2026-08-31

1. **Armor acquisition timing: DECIDED.** Every region must be completable *without* its armor. Regional armor is forged at that region's Blacksmith, which sits behind the boss village, so no armor can gate its own region's first pass. Armor hazards gate optional routes, backtracking secrets, and later areas only. This is a hard constraint on every mechanic below — a hazard that blocks mandatory progression is a bug, not a difficulty choice.
   - **Audited 2026-08-31, then DECIDED: accept as armor-gated. No code change.** `ensureConnectivity` (connectivity.js) treats `T.MEDIUM_WATER` as floodable while `SOLID_TILES` blocks it at runtime, so generation can call an area reachable by a route only Water armor can walk.
     - Measured over 150 generated maps: **map exits were never split** — every region stays traversable on foot, which is what the rule above actually protects. What gets water-locked is shrine and dungeon-door tiles: forest 9/30 maps (30%), mana 8/30 (27%), water 2/30 (7%), luminous and fire 0/30.
     - Accepted because both affected tile types are already optional backtrack content. Dungeons are single-level loot rooms stocked from the region's own roster and gate nothing. Shrines are sealed with a `requiredElement` the hero must strike them with (`world.js`), so returning later with new gear was always the design. A water-locked shrine is one more reason to come back, not a lost reward — fast travel exists (portal.js).
     - Consequence to keep in mind: a forest (tier 0) shrine can sit behind medium water before any armor exists in the game. That is intended. If shrine rewards later become mandatory, revisit this.
2. **Shrine overlap: DEFERRED.** The shrine reward set is being overhauled later. Until then, leave the overlaps alone and keep the compatibility fallbacks (`frostGripHolds` accepting either source; Air/Shadow armor temporarily borrowing the shared [F] slot without overwriting `player.equippedAbility`). Do not design new mechanics around the current shrine rewards.
3. **Equipping inside hazards: DECIDED and BUILT 2026-08-31.** Armor changes are REFUSED while the hero stands on a tile only the worn armor makes passable (`armorChangeBlockedHere` / `setActiveArmorElement`, elements.js; the radial's three entries all route through it). Measured: taking Water armor off mid-pond left 0 of 8 legal moves with no damage source out there to die out of — an unrecoverable save. Refused rather than ejected-to-shore, because a refusal explains itself and never teleports the hero somewhere they did not ask to go. Earth was measured and is not affected (stepping down off a face is never blocked, 6 of 8 exits) but is covered by the same rule. Cursed ground needs no guard: it is passable to everyone.
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
