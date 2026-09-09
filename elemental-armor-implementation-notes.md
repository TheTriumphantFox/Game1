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
  - **Loot: BUILT 2026-09-01.** Golems drop the region's raw ore (`GOLEM_ORE_DROP`, 3) and rubies scaled by region order (`GOLEM_RUBY_BASE` 40 x order — 200 on Earth, 240 in the caldera), both GUARANTEED rather than rolled.
  - That makes them **the one reliable ore source in the game**: ore is otherwise a 2% roll off any kill, and ore is exactly what the Blacksmith needs to upgrade elemental armor. It closes a loop that was open — fell golems to upgrade your armor, and the upgraded armor is what walks you past the next ones asleep. It also fits what they are: a thing made of rock, ice or obsidian should come apart into it.
  - Guaranteed rather than rolled because a golem is a fight the player CHOSE to start, and a chosen fight that pays nothing teaches them not to choose it again.
  - Verified on real Earth and Volcanic maps: the correct REGION ore each time (emberbrass / glimmerspar), correct ruby scaling, ore and rubies on 10 of 10 kills, and an ordinary enemy on the same map drops neither.
- **Frog oracle: BUILT 2026-08-31, trimmed 2026-09-01.** The Warty Oracle stands on the first SEALED Earth dead-end the hero enters, remembered on `player.frogOracleMapId` so a later dead-end does not mint a second. It says **one line, every time** — "Your shadow self knows what you're thinking." — and sets no flag, because nothing in the game cares whether the hero found it. Verified over twelve seeds: placed on all twelve, adjacent to mud every time. Drawn procedurally in `drawVillager`, matching every other role-bearing NPC. **It is a clue, not a tutorial:** it briefly said three escalating lines ending in the boss's actual counter, which made a missable NPC into the place the answer lived — exactly what a missable NPC must not be.

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
- **REDESIGNED AND BUILT 2026-09-01.** The dead reveal half is replaced: the Radiant Aura now **burns enemy projectiles out of the air**. No visibility system was built, as decided — this is a job an aura of light can plausibly have, costs no new subsystem, and is worth something in the ranged-heavy rosters of the last five regions.
- A shot dies at the RIM of the aura rather than on the hero, so it reads as a shield instead of as invisible damage immunity, and it is checked ahead of the hit test so a blocked shot never touches the damage path — no i-frames spent, no damage number to explain away.
- **It recharges** (`LUMINOUS_BLOCK_RECHARGE_MS`, 1.1s): one shot at a time. Luminous is tier 8 of 13 and most rosters above it are full of ranged enemies, so catching a whole volley free would flatten the endgame. Set the constant to 0 for unconditional blocking.
- The ring is drawn around the hero and **dims while recharging** — a shield whose state the player cannot see is one they cannot plan around.
- **Bug worth remembering:** the radius was first measured against `player.x`, the integer tile index, while projectiles carry tile-CENTRE coordinates (`e.x + 0.5`). That put the aura half a tile off — a shot two tiles east measured 2.5 and slipped through while the same shot from the west measured 1.5 and was caught. Verified symmetric now in all four directions.
- Verified with i-frames as the signal (spent = the hit landed; destroyed with none spent = the aura ate it): blocked with the armor, hits without it, hits with the wrong armor, symmetric east/west/north, second shot of a volley gets through while recharging, third is blocked after 1.1s.
- The periodic stun pulse is unchanged and still works alongside it.
- Pulse radius, cooldown, normal stun, and boss stagger need playtesting. All four are named constants at the top of `abilities.js` (`RADIANT_*`).

### Tier 9: Necrotic

- **Cursed ground: BUILT 2026-08-31.** `T.CURSED_GROUND` (id 191) is PASSABLE and drains 1 HP every 1.2s while stood on; Necrotic armor stops the drain dead rather than reducing it. Passable rather than solid because the armor is forged behind the region's own boss village, so a wall would gate the region behind itself.
- The drain reads the tile under the hero every frame rather than hooking the movement step, so standing still on it hurts too, and the clock resets on stepping clear — crossing a narrow finger costs nothing, wading into a field costs plenty.
- `addCursedGround` (mapgen-biomes.js) blots 3-6 patches per map, seeding each centre on open ground; a uniform centre landed in rock four times in five and yielded 51 tiles a map against the 141 it makes now (range 58-204 over ten seeds).
- Generation skips `T.PATH`, so the roads stay clean. Verified over fifteen maps: **all four exits reachable on every map without ever standing on cursed ground**, and zero cursed tiles on a road.
- **Skeleton allies: BUILT 2026-08-31.** The first allied units in the game (`allies`, `stepSkeletons` and friends in enemies.js). Up to 3 rise while Necrotic armor is worn AND a fight is on; they seek and attack nearby enemies; they crumble when it's over.
- **"In a fight" is defined as a live, awake enemy within 8 tiles of the hero** — proximity, not a damage timer. This codebase has no in-combat concept at all and inventing one would be a subsystem; proximity is computable from what exists and is the same shape the golem wake check uses.
- **Enemies do NOT retarget onto them.** Targeting reads the player's position in fourteen places, and rewriting all of it risks skeletons pulling so much aggro that the player becomes a spectator. Instead they **body-block**: an enemy cannot walk through one, and an enemy that tries to step into a skeleton attacks it instead. A wall that hits back, for a fraction of the cost, and the horde is still coming for the hero.
- **They do not block the HERO.** Being boxed into a corridor by your own minions would be infuriating and has no upside.
- **Their kills route through `killEnemy` (player.js)**, so XP, drops, the kill sound and every other death consequence are identical to the hero landing the blow. Verified: 12 of 12 skeleton kills paid 700 XP and 10 drops. An armor that quietly cost you progression is an armor nobody wears.
- A fallen skeleton arms a 6s cooldown before any replacement rises, so losing one costs something and a wall cannot be maintained for free through a long fight.
- Transient: never saved, crumble on unequip, and rise from whatever ground is underfoot rather than needing graves — the armor works in all thirteen regions and twelve of them have none.
- Drawn deliberately UNLIKE the necrotic region's own `skeleton` enemy, which shares its bones: allies carry a violet aura and violet eye-lights and enemies carry neither. In a fight in the wastes there are skeletons on both sides, and a player who cannot tell them apart cannot tell whether they are winning.
- Still open: the spirits stretch goal below.
- Seeing and interacting with spirits remains a stretch goal.
- The existing Ember Lantern shrine reward is inert after fog of war removal and may be reusable here, but that needs a design decision.

### Tier 10: Poison

- **Toxic blooms and mushroom-cloud resistance: BUILT 2026-08-31** (`toxic_bloom`). A ROOTED plant that breathes a spore cloud on a 3.2s clock over a 2.6-tile radius for 6 damage. It never steps and never swings — `rooted` leaves the AI loop before both the movement and the melee contact check — so it is less a fight than terrain that hits back, and walking wide of one costs nothing but distance.
- **The cloud is telegraphed and that is the mechanic, not decoration.** It swells for 900ms before bursting, the sac inflates and the threatened radius brightens, and the ring the player sees is drawn from `bloomSwell` — the same number the damage fires on. A rooted enemy hitting an area with no wind-up would be unreadable.
- **Poison armor is full immunity to the cloud**, not a reduction, matching how Necrotic stops the cursed drain dead and Volcanic removes overheat. That is separate from and on top of the -50% elemental block any Poison armor already gives: the block is defence, this is the region's key.
- Placement is landmark-style like the golems, because a rooted enemy's position IS its mechanic: 4-7 per poison map, never on `T.PATH`, ≥9 apart. Pulse clocks are randomised on spawn so a field breathes out of sync rather than detonating in unison. Verified over 8 seeds: 5.5 per map, 0 on roads, 0 pairs too close, 0 in other regions, 6 of 6 spawned with distinct clocks.
- **Miasma: BUILT 2026-08-31.** Fixed `T.GAS_VENT` fissures (id 193) breathe gas that drifts downwind, pools where terrain holds it, and cannot cross a wall. 2 HP/s while you stand in it; **Poison armor is full immunity**, same as the blooms. Wind is per-map, derived from the map id so a map always blows the same way.
- **The field is not tiles.** A Float32Array density grid on the map object, allocated lazily and only where vents exist — every other map pays nothing. Never saved: gas is weather, not terrain.
- **Performance was the whole design constraint, and it was measured, not assumed.** Three approaches, on a real poison map at steady state (169 gas tiles):
  | approach | ms/tick |
  |---|---|
  | whole grid, 22,500 cells | 0.95 |
  | bounding box | 0.58 |
  | **active frontier** | **0.037** |
  The AABB looked obvious and was wrong: three vents scattered across a map give a 94x82 box — 7,700 cells to move 85 tiles of gas. The frontier (cells holding gas, plus the ring they can spread into) scales with the GAS, not the map or the vent spread, and is the only one that stays flat as either grows. Ticks at 8Hz, not per frame. Total cost 0.29ms/sec; render 0.35ms → 0.70ms with a plume on screen.
- Rendering is bounded by the VIEWPORT, not the map, and alpha saturates at 0.62 so dense gas never hides what is under it — a hazard you cannot see the enemy through feels unfair rather than dangerous.
- **Placement order cost a debugging round and is worth remembering.** Vents placed with the other hazard passes were stamped correctly and then paved over by `addPoisonBogs`, `scatterPoisonFoliage`, `sprinkleMangroves` and `addFallenLogs`, which all write the same open SLUDGE — three maps in eight ended up with one surviving vent. They now run last, which is safe because a vent is passable and additive. Verified 3-5 vents on 10 of 10 maps, none on roads, none too close.
- Verified further: gas never occupies a wall; the dedupe mark leaks nothing; cutting the vents off disperses the cloud to zero and collapses the frontier, so nothing lingers or leaks.
- Existing swamp mushrooms and decorative miasma art remain scenery, untouched by this.

### Tier 11: Mana / Arcane

- **BUILT 2026-08-31: Arcane Mending.** Mana armor slowly heals the hero — 1 HP every 4s (`MANA_REGEN_MS` / `MANA_REGEN_HP`, abilities.js). This is the third design for this slot; the first two (ward/dispel, then a replaying clone) were both dropped, and this one is the only one that is a few lines rather than a subsystem.
- **Global, not region-locked.** It is the one armor power not tied to a hazard or a tile, which matches how the other POWERS behave even though the hazards they answer are regional — Deep Swim swims any medium water, Shadow Step crosses any thin wall.
- **Ticks through combat rather than pausing after a hit**, deliberately. Safe at this rate: 0.25 HP/s against enemy hits of 6-19 can never out-heal anything shooting at you. It removes the walk back to an Inn between fights without changing what happens during one, and Health Potions stay the fast answer. There is no in-combat concept anywhere in this codebase, so the pausing variant would have meant inventing one.
- Does NOT tick while a menu, shop or dialogue is open: it runs from the clock driver, which sits after `update()`'s modal early-return. Idling in the pause screen to heal is not a strategy.
- Real HP only — the green temp-HP pool is granted by items and is deliberately not topped up. Caps at `maxHp`, never revives a dead hero, and holds its clock at zero while at full health so the first tick after taking a hit is a full interval away rather than landing instantly off banked time.
- Verified: 10→13 HP over 12s; nothing without the armor or with the wrong armor; capped at max; dead stays dead; no instant tick after a hit; temp HP untouched; heals outside the Mana region.
- `mana-doppelganger-proposal.md` is SUPERSEDED but kept — its §0 findings are about the codebase rather than the clone and all still hold (no movement history; `[F]` claimed by Air and Shadow; plates are shrine-scoped and block-held; fog of war removed).
- Existing Arcane Sight reveals rune marks and is unrelated; leave it to the shrine overhaul.

### Tier 12: Shadow

- Armor-driven Shadow Step is functional using the existing thin-wall teleport.
- The old shrine reward can also grant Shadow Step. Left alone pending the shrine overhaul.
- The predictive Shadow temple boss is BUILT — see the Eclipse Sovereign entry at the end of this section. (This line said "missing" for a while after it shipped: there were two near-identical lines here and only one was updated.)
- The Earth-region frog (Tier 4) is flavour and nothing more. **The fight explains itself to everyone, every time**, and does not check for the frog — an opening line naming what the Sovereign is doing, and one blunter line 22s later if the hero is still fighting on the layout it read at the start.
- The nudge fires once and is suppressed for anyone who has already changed a binding or already blinded it, so nobody who has worked it out is nagged.
- `frog_warned_shadow` is **gone**. It briefly existed and the fight branched on it; that made the answer live inside an optional NPC on an optional map. Removed rather than left unread.

- **Touch counter: BUILT 2026-08-31.** A handedness setting (`touchSidePref`, config.js) mirrors the touch controls — steering pad and action buttons swap sides. That is the touch answer to "change your control settings", on a device with no keys to rebind. Exposed on the title screen and in the radial MENU ring, persisted in `localStorage`, and it moves the canvas-drawn pad (`joyHome`), the CSS-positioned buttons, and the control hint text together.
  - It is also an accessibility fix in its own right and was worth building regardless of the boss: a left-handed player has had the pad under their weak hand since touch controls shipped, with no way to move it.
  - Added `safeInsetRight` while doing it. `--safe-right` had always existed in CSS and been used by the action buttons, but nothing drawn on the canvas had ever needed the right edge, so it was never resolved into JS.
- **Desktop counter: BUILT 2026-09-01.** Real key rebinding. `KEY_ACTIONS` / `keyBinds` (config.js) covers all four movement keys plus melee, bow, bomb, ability, potion, menu, minimap and the three weapon hotkeys, persisted in `localStorage`.
  - **Implemented as ONE translation at the input boundary**, not as a lookup at each of the dozens of places a key is read. `canonicalKey` turns a pressed key into the key the game's code was written against, and everything downstream keeps its own vocabulary. That matters because movement is an internal protocol here: the touch joystick and tap-to-travel both DRIVE the hero by injecting arrow keys into the same `keys` map, so per-read lookups would have needed teaching to the injectors too, and the first one anybody forgot would be a control that worked on keyboard and not on touch.
  - A key that is some action's default but is no longer bound to it goes **dead** rather than passing through. Without that, moving melee from Z to K left Z still swinging — the old key kept working because Z is the vocabulary downstream reads. Caught in testing.
  - Space is deliberately not rebindable: it is the interact key, doubles as melee, and is "confirm" in half a dozen modal handlers, so letting it be reassigned would let a player bind away their ability to close a dialogue.
  - One key holds one action; taking a bound key leaves its previous owner explicitly `unbound` and the window says so in red, because two actions on one key is a bug the player cannot see.
- **`controlsChangedFromDefault()` is the Shadow boss's hook.** True when any key differs from its default OR the touch controls have been mirrored, so a keyboard player and a touch player each have a real answer to a fight that reads your inputs.
- Both halves live in one **Controls window** (`openControlsWindow`, sysmenu.js), reached from the radial MENU ring, holding the scheme override, the touch handedness setting and the full key list. It joins the world-freeze and touch-block lists, so the game does not run underneath it.
- **The predictive boss: BUILT 2026-09-01.** The Eclipse Sovereign (`eclipse_sovereign`, already in the roster) now reads the player's controls. Driver is `stepEclipseSovereign` / `sovereignObserveKey` in enemies.js.
  - **The baseline is the fight's own start, not the game's defaults.** It SNAPSHOTS whatever bindings and handedness the hero walks in using, so arriving with an already-custom layout buys nothing and the fight has to be solved *during* the fight. Verified: walk in on a custom melee key and its read still lands.
  - While the snapshot holds, the read LANDS — it blinks clear and the swing closes on empty ground. Rebind anything mid-fight and the read FAILS: it commits toward the hero, into the attack, and is left staggered and open. That stagger is the damage window.
  - Blinking rather than an invulnerability flag is deliberate: it needs no hook into any of the several places enemy HP is decremented, and "your sword passes through where it was standing" tells the story better than a damage number reading 0.
  - **It RE-LEARNS** after `SOVEREIGN_RELEARN_MS` (14s), so one trip to the Controls window is a reprieve rather than a win and the fight is a rhythm of changing the board under it. This was a judgement call, not a specified one; set the constant to `Infinity` for a one-change fight.
  - Touch handedness counts as a control change, so a touch player has the same answer as a keyboard player.
  - A ring of pale light marks it while blind. A boss that is only situationally vulnerable has to say so rather than leave it to be inferred from damage numbers.
  - Reads `frog_warned_shadow`'s subject matter — the Earth frog has been telling the player this since tier 4, and its third line is the instruction.
  - **Bug worth remembering:** the first version asked the SNAPSHOT both "was this a combat input" and "what action is it". That was silently broken — after a rebind the player presses a key the snapshot has never heard of, so the Sovereign observed nothing, never guessed wrong, and could never be punished. "Was this combat input" must come from the CURRENT bindings; only the prediction comes from the snapshot.

## Cross-system decisions — SETTLED 2026-08-31

1. **Armor acquisition timing: DECIDED.** Every region must be completable *without* its armor. Regional armor is forged at that region's Blacksmith, which sits behind the boss village, so no armor can gate its own region's first pass. Armor hazards gate optional routes, backtracking secrets, and later areas only. This is a hard constraint on every mechanic below — a hazard that blocks mandatory progression is a bug, not a difficulty choice.
   - **Audited and implemented 2026-08-31.** `ensureConnectivity` no longer floods the armor-free component through `T.MEDIUM_WATER`, and it roots the flood at one exit before explicitly repairing every other open exit. Dungeon doors, shrines, chests, waterfall doors, and other optional features are validated against a combined Water/Earth/Air/Shadow traversal graph; armor changes in that graph are allowed only on ordinary ground. A malformed armor route gets a deterministic fallback corridor rather than leaving a visible feature stranded.
     - The development verifier covers 20 seeded maps per region, including the Forest seed 4 swim-gated door and Fire seed 1 disconnected exits. It also stamps the post-generation Air/Shadow secrets and checks every armor-traversable terrain tile plus every surviving ordinary standing pocket; the current run reports zero failures across 260 maps.
     - This keeps armor-gated backtracking content intentional while protecting the map's actual mandatory contract: open exits are reachable without armor, and every generated feature has a usable route with the traversal powers the game provides.
2. **Shrine overlap: DEFERRED.** The shrine reward set is being overhauled later. Until then, leave the overlaps alone and keep the compatibility fallbacks (`frostGripHolds` accepting either source; Air/Shadow armor temporarily borrowing the shared [F] slot without overwriting `player.equippedAbility`). Do not design new mechanics around the current shrine rewards.
3. **Equipping inside hazards: DECIDED and BUILT 2026-08-31.** Armor changes are REFUSED while the hero stands on a tile only the worn armor makes passable (`armorChangeBlockedHere` / `setActiveArmorElement`, elements.js; the radial's three entries all route through it). Measured: taking Water armor off mid-pond left 0 of 8 legal moves with no damage source out there to die out of — an unrecoverable save. Refused rather than ejected-to-shore, because a refusal explains itself and never teleports the hero somewhere they did not ask to go. Earth was measured and is not affected (stepping down off a face is never blocked, 6 of 8 exits) but is covered by the same rule. Cursed ground needs no guard: it is passable to everyone.
4. **Enemy art:** all new golems, toxic blooms, and summoned skeleton variants require Aseprite sources and generator scripts under the existing art pipeline.
5. **Save compatibility:** persistent meters, summons, barriers, boss learning state, or altered map features need absent-field defaults and old-save migration behavior.
6. **Generation and connectivity:** new blocking hazards must be included in connectivity rules. Open exits and mandatory progression must not require armor; optional features may be armor-gated but must remain reachable through a valid armor route.
7. **Touch controls:** Air and Shadow currently reuse the existing ability button. Any new active armor action should avoid adding another permanent touch button.

## Suggested next implementation order

1. Finish Lightning balance and test it in all Lightning map types.
2. Playtest Earth Cliff Climb on the causeways that already generate, and settle the `LEDGE_FACE` rendering question. (This replaces the old step 3, which asked for terrain that already exists.)
3. **Completed 2026-08-31:** audit generation against the armor-free exit rule and the combined-armor optional-content rule; see `connectivity.js` and `tools/verify-connectivity.js`.
4. Add real Fire quicksand and heatstroke because Fire is the first armor region.
5. Add Ice and Earth dormant golems using one shared dormant-golem state machine with region-specific art and stats.
6. Build Volcanic overheat before obsidian golems, so the region's survival loop can be tested independently.
7. Design Mana barriers, Luminous darkness/reveal, and the Shadow boss only after the simpler regional mechanics establish conventions.

## Level scaling and the shrine overhaul: BUILT 2026-09-08

This closes cross-system decision 2 above ("Shrine overlap: DEFERRED"), and it turns
every armor's power from an all-or-nothing switch into a curve over the same 0-6
upgrade level that already drove physical defense and elemental block %.

### The shared convention

`armorAbilityStep(elemId)` (elements.js) is the one place that says what "level"
means to an ability curve. It returns 0 when the armor is not worn and 1-6 when it
is, with level 0 reading as step 1, a freshly forged armor whose power does
nothing until the first ore upgrade reads as broken, and the design table says the
same wherever it mentions level 0 ("3 seconds at level 0/1").

### The twelve curves

| Armor | Ability | Level 1 | Level 6 |
| --- | --- | --- | --- |
| Fire | quicksand + dune pace | 20% of walk speed | 120% |
| Water | swim pace | 20% | 120% |
| Ice | ice-sheet traction (drift pace is a flat 100% at every level) | slide cut 20% | slide gone |
| Earth | ledge-face climb pace | 20% | 120% |
| Volcanic | overheat fill | 50% | no meter at all |
| Air | glide range | 2 tiles | 12 tiles, and never under a roof |
| Lightning | storm-strike wait | x3 (18-42s) | never strikes |
| Luminous | shots blocked per charge | 1, recharging in 3s | 6, recharging in 1s |
| Necrotic | skeletons raised | 1 | 6 |
| Poison | miasma/spore damage | halved, x2 rehit wait | immune |
| Mana | regeneration | 1 HP / 12s | 1 HP / 2s |
| Shadow | enemy detection range | -20% | -80% |

Fire, Water and Earth share one formula (`armorTerrainStepMs`, elements.js):
speed is 20% of full walking speed per level, so level 5 exactly matches open
ground and level 6 is a genuine sprint. **This is a deliberate regression at low
levels**, confirmed with the owner before it was built: all three armors used to
grant flat "as if it were open ground" relief the moment they were worn, and
levels 1-4 are now slower than that. On a DUNE, levels 1-2 are also slower than
crossing it with no armor at all (765ms per step against 306ms bare). Fire is left
that way deliberately, because it buys quicksand safety and half the heat fill at
the same time. Water and Earth have no unarmored comparison at all, since their
tiles are impassable without the armor.

**Ice came off that curve after it was built**, on the owner's call. Snow-drift
relief was the whole of what Ice armor did on that tile, so a curve starting at 20%
(below the 50% an unarmored hero already trudges a drift at) left a freshly forged
armor strictly worse than no armor with nothing to show for it. Ice now grants a
flat full-speed drift walk at every level, and its LEVEL scales traction on the ICE
sheets instead (`iceSlideMs`, abilities.js): the released-input slide window drops
from 320ms unarmored to 256ms at level 1 and 0ms at level 6, which is the
all-or-nothing Frost Grip the armor used to give the moment it was worn. Traction is
the better thing for the level to buy anyway, since the slide is the ice region's
signature and the player feels it on every step rather than only in the drifts.

### What was removed, and why it had to be

- **Radiant Pulse is gone**, boss-stagger variant included. Luminous is one
  mechanic now, the shot-blocking shield, because a shield the player can read
  the state of is a better ability than a shield plus an invisible crowd-control
  aura that was quietly doing most of the armor's work.
- **Shadow Step is gone from the game**, not moved. Shadow armor grants the Umbral
  Veil instead (`shadowDetectionScale`, elements.js), which shrinks every distance
  an enemy uses to decide it has seen you: a dormant golem's wake radius
  (`stepGolems`, enemies.js) and a ranged enemy's engagement range, the dragon's
  breath fan included (`stepEnemyRanged`, projectiles.js). Melee pursuit is
  deliberately excluded: an enemy at arm's length has not detected you at a
  distance, it has walked into you. Three things went with the ability: its shrine
  reward, the shadow-alcove secret (`SECRET_KINDS`), and the tower's floor-12+
  Shadow Vault. All three were content only Shadow Step could open.
- **The shrine reward set is four-fifths retired.** Twelve of the thirteen shrines
  give a Heart Container. Frost Grip, Updraft Glide and Shadow Step were already
  supplied (or replaced) by their armor; Ember Lantern had been inert since fog of
  war was removed. **Mana keeps Arcane Sight**. It is the only key to the hidden
  rune-mark caches, and a thirteenth heart would strand that content permanently.
  `ABILITY_IDS` is now one entry; the retired keys are left untouched in old saves
  rather than stripped, since nothing reads them.

### Connectivity

`MAP_CONNECTIVITY_ARMOR_STATES` lost its `shadow` entry: the Umbral Veil changes
what enemies notice, not what tiles the hero can stand on. The Air state now models
the LEVEL-6 glide range, which is the right end of the curve for the question that
flood is asked: "can a fully equipped hero ever reach this", not "can a hero reach
it right now". Nothing mandatory depends on it (`ensureConnectivity` still carves
required routes against the armor-free flood), and glide islets are laid within
`GLIDE_RANGE` (3-4 tiles), which is Air level 2 and up. `tools/verify-connectivity.js`
reports zero failures across 260 maps after the change.
