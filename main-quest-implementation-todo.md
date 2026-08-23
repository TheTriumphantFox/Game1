# Main Quest Implementation To-Do

Consolidated, ordered implementation checklist for the main quest.

> **Status 2026-08-11: every box is ticked.** All ten stages are built and the verification
> pass at the bottom has been run. Read that pass's preamble before trusting it — it says
> exactly how each item was checked and what a machine could not check. The one thing still
> outstanding is a human playing the game.
>
> Files this work added, for anyone arriving cold: `corruption.js` (the blight),
> `abilities.js` (what the shrine rewards do out in the world), and the finale in
> `tower.js`. `shrines.js` predates it.

**Sources** (both left unchanged):

- `../the-rpg-game-main-quest-script-3.docx` — **DOCX v3, the latest authority**
- `../story-decisions-todo.md` — earlier decision log; compatible decisions preserved below,
  superseded ones recorded explicitly in [Superseded decisions](#superseded-decisions)

**Status legend**

- `[ ]` not started
- `[~]` partially in the code; needs rework to match DOCX v3
- `[x]` done and verified against DOCX v3

Each stage carries an **Audit** note recording what was actually found in the repo on
2026-08-10, so nobody has to re-derive it.

---

## 1. Reconcile canon and repository documentation

**Audit:** `.claude/skills/the-rpg-game/references/story-bible.md` and `prologue-script.md`
both exist and are still at the pre-v3 canon. `story.js` documents seven flags, none of the
new ones.

- [x] Update `story-bible.md` and `prologue-script.md` to match DOCX v3. Both rewritten
      against v3 *and* against what actually shipped, so they now describe the game rather
      than the pitch. Every "design intent, not built" note in the bible was either
      replaced with what the system turned out to be, or kept and marked still-unbuilt (the
      revenge damage bonus is the only one left).
- [x] Lock the canon chain: Grandmother's family ruled; the Emperor overthrew them with
      Elderbrook's historical help; a long-dead wizard later supplied the immortality
      potion; the potion caused the dragon transformation and the blight. Written out as a
      numbered, ordered list under "The canon chain — locked", with the v3 contradiction
      and its resolution named directly.
- [x] Keep the wizard completely off-screen and unmentioned before the final-boss scene.
      Audited: the only two `wizard` hits outside `tower.js` are code comments telling
      future editors not to mention him. He has no lines, no sprite and no NPC.
- [x] Update the partial-truth rule: Grandmother reveals that the attack targeted the
      player, but withholds why. The bible now spells out what she gives (the crown was
      promised by people now long dead; the attack was aimed at the player) and what she
      never gives (why), plus the four sanctioned fortune-teller fragments.
- [x] Apply the "no em dashes in dialogue" rule to all new and existing affected dialogue.
      (Scope: dialogue strings only, not code comments — the repo uses em dashes in prose
      comments throughout and those stay.)
- [x] Mark the older 12-shrine / Elemental Ward proposal as superseded by DOCX v3's 13
      regional shrine designs. In the bible's own Superseded section now, not just this
      file's table.
- [x] Keep Elderbrook permanently ruined; do not introduce restoration. Nothing restores
      it, and the blight overlay deliberately skips `homevillage` so it never even looks
      cleansable.

> **The em-dash sweep, and where its line is.** A scanner over every `.js` file, parsing
> out comments and reading only string literals, found 109 em dashes. **34 were dialogue
> and were rewritten**; the rest are toasts, banners, map names, item descriptions, UI
> chrome and shop item rows, which the rule exempts. The boundary was not invented here —
> `ESCORT_DEFS` in `villagers.js` already documents it ("offer/remind/done are spoken
> lines … found/grant stay plain strings: those are toasts, not speech"), so that is the
> line the sweep followed. Rewrites are commas, full stops and ellipses, chosen per line
> rather than substituted mechanically; Old Hendricks' interrupted "Is she—" became "Is
> she..." to match how Beat 5 cuts a line short.
>
> Files touched: `guild.js` (11), `villagers.js` (14), `shop-herbalist.js` (6),
> `portal.js` (3), `prologue.js` (2). Re-running the scanner over those files leaves only
> toasts and UI rows.

## 2. Player inventory, state, and save compatibility

**Audit:** `player.hasBow` exists and is granted in Beat 5 (`grantGrandmothersBow`,
`prologue.js:574`), with the load-time migration at `save.js:188`. There is **no**
`player.hasSword` — fresh heroes start armed. There is no `player.abilities` bag and no
punch action anywhere in the repo.

- [x] Add `player.hasSword`; fresh heroes start without sword or bow. Declare it in all
      three required places (the `player` literal in `player.js`, `DEFAULT_PLAYER` in
      `save.js`, and the `resetGame` assignment in `save.js`).
- [x] Hide and disable sword controls, rendering, and radial entries until the sword is
      granted (mirror the `hasBow` pattern in `ui.js`, `radial.js`, `main.js`). Also covers
      the title-screen control hint, which named the sword before one existed.
- [x] Add a pre-weapon punch action that deals 1 damage only to Hendricks' dog.
      `doPunch` / `PUNCHABLE_ENEMY` in `projectiles.js`. Stage 4 must spawn the dog with
      `type: 'hendricks_dog'` or the punch will bounce off it.
- [x] Add persistent `player.abilities` fields for Frost Grip, Updraft Glide, Ember
      Lantern, Arcane Sight, and Shadow Step. `ABILITY_IDS` / `hasAbility` / `grantAbility`
      in `player.js`.
- [x] Add story flags for dog resolution, fortune-teller reveals, corruption progression,
      and the final-boss dialogue thresholds. Documented in `story.js`; note that
      `corruption_level` is an index, not a boolean, so it needs `getFlag` not `hasFlag`.
- [x] Migrate old saves: preserve swords for completed/legacy games, keep incomplete
      prologues weaponless, and safely default missing ability/story fields.
- [x] Migrate legacy sealed-shrine records (`player.shrineQuests`, `seedRegionShrine` /
      `tryUnsealShrine` in `world.js`) into the new shrine schema without duplicating
      rewards; convert obsolete overworld sealed shrines into ordinary healing shrines.
      The tile half was already done by stage 9; the duplicate reward is closed now — see
      the note below.

> **Also done here, out of numerical order, because the game is otherwise uncompletable:**
> nothing granted a sword, so with `hasSword` defaulting to false a fresh playthrough could
> never obtain one. `grantGrandmothersBow` is now `grantGrandmothersWeapons`
> (`prologue.js`) and grants both. Equipping the bow initially while exposing the sword
> through normal weapon selection remains stage 7's item.
>
> **The conflict on the last item, and how it was closed.** Stage 9 replaced the
> `migrateLegacyShrines` body in `save.js` with a delegation to
> `migrateShrineSystemAfterLoad` (`shrines.js`), which keeps `shrineQuests` as the schema
> (versioned) rather than the `player.shrines` bag added here — `player.shrines` is
> vestigial and `applyLoadData` deletes it. It also made the opposite call on the reward:
> it **retains** the legacy +2 Max HP and records `legacyCompleted` rather than reclaiming
> it, and nothing ever read that flag, so a legacy-completed region kept its +2 *and* paid
> the new heart container in full.
>
> **`claimShrineReward` now consumes it.** A heart-container region whose legacy seal was
> already broken heals the hero and says so ("Its heart was already yours, from the old
> seal") instead of granting a second +2, and clears the flag so it can never pay twice.
> Consumed rather than reclaimed because taking Max HP back off a hero who earned it under
> the old rules is the worse of the two wrongs. **Ability rewards are deliberately
> unaffected** — an ability is not a second heart, so there is nothing duplicated to
> withhold. Verified against a hand-built legacy save: the legacy region gained 0, a fresh
> region gained the full +2, and an ability region with a legacy record still unlocked
> Frost Grip.

## 3. Prologue Beat 1: The House

**Audit:** Beat 1 is implemented in `prologue.js:358` (`startPrologue`) with the family cast
and the five-potion gift (`GRAN_POTION_GIFT = 5`). The household chest exists in
`mapgen-prologue.js:204`. The bow is narrated but not rendered. Father's line still says
"Take the west road" (`prologue.js:213`), which DOCX v3 replaces with the mill route.

- [x] Make the household chest story-locked and exempt from generic chest loot.
      `isHomeStoryChest` (`player.js`) short-circuits `handlePickup` before the loot table,
      swallows the keypress so SPACE can't punch the furniture, and shows
      `🔒 Locked [Space]` instead of `📦 Open [Space]`. After `revenge_triggered` it reads
      as empty, because what was in it is what Beat 5 just handed over.
- [x] Render Grandmother's bow visibly beside her before Ashfall. New passable tile
      `T.GRAN_BOW` at `HOME.bowRestAt`, moved to `HOME.bowAt` by the fire and removed by
      `grantGrandmothersWeapons`.
- [x] Add or adjust the mill/route landmark so Father's route directions are accurate,
      then replace the "west road" line with the DOCX v3 mill line. `HOME.mill` sits hard
      against the west side of the market spur, so the walk to the shopkeeper runs the
      length of its east wall. Built by `hvMill`, not `hvHouse` — grinding stones and a
      workbench rather than beds, or it reads as a sixth cottage.
- [x] Update Mother's errand to request one package from the existing shopkeeper.
- [x] Preserve Grandmother's five-potion gift and its one-time flag (`gran_potions_given`).
- [x] Confirm the chest and bow survive the later burn transformation. Both fall through
      `hvCharTile`'s default; asserted against `buildRuinedHomeVillage()`.

> **Deviation from DOCX v3, deliberate.** Mother's line is "before *they* close up", not
> "before *he* closes up". Wren's pronouns are not established anywhere in the script or
> the code, and the existing Beat 2 lines avoid the question; guessing one here would be a
> guess on the page forever. Change it if Wren's pronouns get decided.
>
> **Also fixed here:** the em dashes in the three Beat 1 lines that were being rewritten
> anyway (stage 1's blanket rule). The rest of the game's dialogue is untouched.
>
> **Flagged for stage 4.** Father now sends the player past the mill, which is south, but
> Hendricks' gate (`HOME.gate`) is out west at the far end of the west road, and Old
> Hendricks still says "Dog's on the west road." So the route Father recommends and the
> place the dog waits are opposite ends of the village. Stage 4 spawns the dog "at the
> gate" — either the gate moves onto the mill route or Hendricks' line changes. Left alone
> here rather than moving a landmark that stage 4 owns.

## 4. Prologue Beat 2: The Village

**Audit:** Wren exists, but as a **market-stall merchant** (`prologue.js:34`,
`PG_LINES` at `prologue.js:198`), which is the duplicate role DOCX v3 removes. "Old
Hendricks" is an elder NPC (`prologue.js:40`); his **dog does not exist** as an entity —
`dog` only appears in dialogue text and one `render-enemies.js` sprite reference.

- [x] Use the existing store shopkeeper as the package giver; name them Wren and remove
      the duplicate market-stall merchant role. `adoptShopkeeperAsWren` renames the keeper
      `placeShopkeepers` already put behind the counter and gives her a `pgTalk` key; she
      keeps `role: 'store'`, so once the errand is done she is the shopkeeper again.
- [x] Add objective markers for Wren and the return home. `prologueObjective` /
      `drawPrologueObjective` — 📦 over Wren, then 🏠 on the house door, in the same
      bobbing stroked style as the escort markers.
- [x] Retain the named flavor cast: Nettie, Bram, Old Hendricks, and Sella.
- [x] Spawn Hendricks' dog at the gate as the initial noncombat obstacle; interacting
      calms or shoos it aside.
- [x] After package pickup, make the dog pursue and attack for 1 damage.
- [x] Give the dog 3 HP; after two punches it flees at 1 HP and cannot be killed.
- [x] Allow outrunning the dog as an alternative completion path.
- [x] Require the dog encounter to resolve before Beat 3 can trigger.

> **The dog is an enemy, not a villager** (`DND_ENEMIES.hendricks_dog`, plus the encounter
> in `prologue.js`). That is what gets it pursuit, contact damage and tile blocking for
> free — a dormant enemy still occupies its tile, which is the "blocks the path" the script
> asks for. It cannot be killed: `doPunch` clamps it at 1 HP and never calls `killEnemy`,
> and weapons are locked in the home village regardless.
>
> **The gate gap is now one tile, not two.** With two, the player walked around the dog and
> never learned the action button. Still not a hard gate — the fence only spans rows 73-84,
> so its ends can be walked around through open grass.
>
> **Resolves the stage 3 route flag.** With Wren in the store, the errand runs west along
> the road past the mill and through the gate, so Father's directions, the mill, the dog
> "at the gate" and Old Hendricks' "Dog's on the west road" all describe the same walk. No
> landmark had to move.

## 5. Prologue Beat 3: The Warning

**Audit:** `playWarningBeat` (`prologue.js:384`) exists with the moving dragon shadow. The
roar is currently **text only** ("a distant roar" in dialogue); there is no
`dragon-roar.wav` in the repo — the only bundled audio is `wilhelm-scream.wav`.

- [x] Trigger the warning once the player comes within a seven-tile radius of `HOME.door`,
      while carrying the package and after resolving the dog. `WARNING_RADIUS = 7`, tested
      on the boundary. Replaces a "north of the square and roughly on the road" box that
      could be entered sideways without heading home, or skirted round the back.
- [x] Stage birds scattering, villagers stopping/looking up, wind, and the existing moving
      dragon shadow. All three are now staged rather than narrated — the narration line
      that described them has been dropped, since the player can see it happen.
- [x] Add a bundled local `dragon-roar.wav` and play it at the scripted cue; no runtime
      network dependency (the game must stay offline over `file://`). Loaded as an `Audio`
      element, matching `SCREAM_POOL` in `player.js`; media elements load by path, which
      works over `file://` where `fetch` + `decodeAudioData` does not.
- [x] Keep the airborne dragon visually distant and indistinct. Unchanged: `alt: 26`,
      `scale: 0.30`.

> **The roar is synthesized, not sampled** — see `tools/`-adjacent note below. It is built
> from oscillators, noise and a one-pole low-pass filter chain, so the file can be
> committed with no licensing question attached. Deliberately a *distant* roar: slow swell,
> heavy low-pass (air eats the highs over distance), and four decaying delay taps as a
> valley reverb. Mono 16-bit 22050 Hz, 3.8 s, peak −1.1 dBFS, rough spectral centroid
> ~284 Hz. **Nobody has listened to it yet** — it was verified by inspecting the waveform,
> not by ear. Swap the file if it doesn't land; nothing in the code depends on its content.
>
> **Birds** are their own tiny transient list (`prologueBirds`), not enemies or villagers —
> they live ~2.8 s, have no collision and nothing worth saving. Their rooftops live in
> `HOME.roosts` so moving a building moves its birds.
>
> **Villagers look up** via a new `lookUp` pose in `drawVillager`: hair pushed over the
> brow, eyes lifted, mouth open. It had to be in the face — villagers are drawn
> front-facing in every state, so setting `dir` alone would have shown nothing.
>
> **Held states get cleared** (`pgClearAmbience`) when the prologue closes and on load,
> or the three Ashfall survivors would spend the rest of the game staring at an empty sky.

## 6. Prologue Beat 4: Ashfall

**Audit:** `playAshfallBeat` (`prologue.js:410`) exists with ember bursts
(`pgEmberBurst`), shop closing (`pgCloseShops`, roles `inn`/`store`/`herb`/`smith`), and
the dead laid out (`pgLayOutTheDead`). No dragon-breath flame sweep. HP-to-3 and the
survivor shop restrictions need verifying against v3.

- [x] Add a visible dragon-breath flame sweep originating from the Emperor and crossing
      the screen. `pgBreathe` / `drawPrologueBreath` — an expanding ring with a white-hot
      leading edge, fired *before* the charring passes so the fire visibly causes the ruin.
- [x] Set player HP to exactly 3 during the initial strike. Set, not subtracted, and
      `tempHp` is cleared with it — a green-heart buffer bought before the errand would
      otherwise survive a dragon.
- [x] Lock all input during the strike; restore movement but keep combat disabled for the
      run home. The map-type weapon lock already covered swords and bombs; the punch added
      in stage 2 was exempt from it, so it is now suppressed while `village_burning`.
- [x] Add deterministic collapsing-path obstacles with at least one clearly navigable
      reroute and no softlock. `HOME_COLLAPSE` — three chokepoints that each block two of
      the corridor's three lanes and alternate which stays open (east, west, middle), so
      the run weaves. Softlock-proof by construction and asserted with a flood fill.
- [x] Keep the innkeeper, shopkeeper, and herbalist alive at their original locations.
- [x] Make the ruined shopkeeper buy-only, with no items for sale.
- [x] Restrict the ruined herbalist to forest-tier level-1 healing potions and pricing.
- [x] Leave the innkeeper's normal service available; the blacksmith does not survive.
- [x] Persist survivor roles, shop restrictions, ruined tiles, and bodies correctly across
      save/load. New `shopsRuined` map field carries the trading terms.

> **`hvCloseShops` became `hvRuinShops`, and stopped clearing `activated`.** That flag is
> what `spawnVillagersForMap` reads to stand the keepers back up on re-entry, so clearing
> it emptied the ruin of the three people the script keeps alive. The ruin is marked with
> `shopsRuined` instead: the trades still open, but on the ruin's terms.
>
> **One switch drives all three shop restrictions.** `storeRegion()` returns forest for a
> ruined Elderbrook instead of the last region, which drops prices to forest tier *and*
> gives the herbalist the plain 1d4 brew for free — `HERBALIST_RECIPES` has no `forest`
> entry, so `renderHerbalistContents` already falls through to `renderForestHerbalist`.
> Only the store's bare shelves needed explicit handling.
>
> **The three survivors' doorways no longer burn.** `hvCharTile` used to turn all four shop
> doors to rubble, which walled the keepers into buildings the player could see them
> through and never reach. Only `SMITH_DOOR` burns now.
>
> **Wren survives**, so she is out of Beat 4's `pgWound` list, and her handler returns one
> shaken line while the village burns rather than the shop counter or her errand lines.
>
> **`skipPrologue` also drops the hero to 3 HP**, or the two entry points into the open
> world would not be the same game.

## 7. Prologue Beat 5: What's Left

**Audit:** `playWhatsLeftBeat` (`prologue.js:476`) exists and grants the bow only
(`grantGrandmothersBow`, `prologue.js:574` sets `hasBow` and nothing else). Dialogue is the
pre-v3 text. `skipPrologue` (`prologue.js:600`) also calls `grantGrandmothersBow`, so it
will need the same sword/chest treatment.

**Verified 2026-08-11**, by pumping the real `update()` loop through Ashfall into Beat 5 in
the browser and reading the state out the other side: the full DOCX v3 line sequence in
order, `hasBow`/`hasSword`/`weapon: 'bow'`/10 plain arrows, both flags set, chest open, no
bow left on the floor, three survivors still trading. Same again for the skip path, for a
save/load round trip, and for a hand-faked pre-stage-7 save through the migration.

- [x] Show the chest open with its lock burned away and the bow just beyond Grandmother's
      reach. The bow was already staged (`hvPinGrandmother`); the chest now opens with the
      fire (`pgBurnChestOpen`, `prologue.js`) and is called out in the room's narration.
- [x] Replace the current older dialogue with DOCX v3's sequence, including "By people who
      are long dead…", "He was after us… he was after you…", and "Take the bow and what's
      in the chest." Verbatim bar the em dashes, which became ellipses and commas.
- [x] Preserve the quiet death beat without music, prompts, or interruption. Nothing now
      fires inside it: the grant, the item line and the key hint all moved past it.
- [x] Grant Grandmother's Bow, ten plain arrows, and Grandmother's Sword together.
      Unchanged from stage 2's `grantGrandmothersWeapons`, now fired at the chest.
- [x] Equip the bow initially while exposing the sword through normal weapon selection.
      The grant sets `player.weapon = 'bow'`; the sword needs no new plumbing, because the
      `[Z]` slot, the `[1]` key and the radial's swords ring all switch on `player.hasSword`
      (stage 2) and were empty until it flipped.
- [x] Set `revenge_triggered` and `prologue_complete`; make the skip path produce identical
      state, inventory, ruins, survivors, and chest state.
- [x] Do not add the optional revenge damage bonus in this pass. Not added; the grant site
      says why, so the next reader doesn't take its absence for an oversight.

> **The sword is walked to, not teleported into the bag.** After the held beat the hero
> crosses the room to the chest (`walkPlayer`, 17 tiles from the bow) and the grant fires
> there. It is the one item in the game the player is *told* where to find, and taking it
> should be an action rather than a notification. `walkPlayer` skips itself when it can't
> find a route, so the grant can never be stranded behind the walk.
>
> **The chest's open lid is map state, not a new tile.** `pgBurnChestOpen` adds it to map
> 0's `openedChests`, the same set the renderer already reads for every chest in the game
> — so no new tile type, art, minimap colour or burn rule, and it persists through
> save/load for free. Set at the top of Beat 5, so the room the player walks into is the
> room the script describes.
>
> **Three ways a skipped run differed from a played one, all fixed.**
> `skipPrologue` granted the weapons *before* rebuilding the ruin, and the rebuild
> (`hvPinGrandmother`) laid a second bow back on the floor of a room the hero had
> supposedly just picked it up from; the chest was never marked open; and its title card
> still read `HYRULE QUEST`, the pre-rename title. The bow half is belt-and-braces now:
> `buildRuinedHomeVillage` itself won't lay one down once `revenge_triggered` is set, which
> also covers the save-with-no-stored-tiles and fresh-world-with-the-flag paths.
>
> **Saves written before this stage are migrated** (`migratePrologueAftermath`, called from
> `restorePrologueAmbience`): the chest is opened and any stray bow prop is cleared. Keyed
> on `revenge_triggered`, so a mid-prologue save is untouched.
>
> **Also fixed here:** `interactionHint` (`player.js`) now returns nothing while
> `cutsceneInputLocked` is set. Every prompt it returned during a scene was a button that
> did nothing, and this beat is where it showed — the hero is parked beside the chest while
> the narration describes the lock as burned through, and the HUD was captioning it
> `🔒 Locked [Space]`. Beat 4's run home is unaffected; `control: true` clears that flag.

## 8. Midgame story systems

**Audit:** No fortune-teller NPC exists (the only `fortune` hit in the repo is an unrelated
string in `tower.js`). No story corruption layer exists; the Necrotic region's `BLIGHT`
terrain is unrelated plain biome terrain. `fog.js` exposes `revealAround(map, cx, cy, radius)`
but every call site passes a hardcoded literal (12 for normal movement, 14/16 for vantage
points), so there is no per-region radius to bump yet — one will have to be introduced.

**Re-audit 2026-08-11, before starting:** stage 9 has since been built (`shrines.js` is in
the repo and in `index.html`, `player.abilities` exists, the 13 puzzles are in), so this
stage's shrine hooks had somewhere real to attach: cleansing hangs off `setShrineSolved`,
and "is this region clean?" reads `player.shrineQuests[rid].status`. (Stage 9's checkboxes
were stale at that point; they were audited and finished on the same day — see below.)

- [x] Add one-time fortune tellers to the Water, Volcanic, Luminous, and Mana villages.
      `FORTUNE_TELLERS` / `placeFortuneTeller` / `talkFortuneTeller` (`villagers.js`),
      `role: 'fortune'`, one per village, stationary on the plaza's south flank.
- [x] Gate their scenes in progression order and persist each reveal. Each reading sets
      its own `fortune_*` flag (story.js) and autosaves.
- [x] Reveal only non-conclusive fragments: the crown predates the dragon, the Emperor
      began human and sought more time, a ruling house vanished during the takeover, and
      Elderbrook's oldest records were deliberately erased.
- [x] Ensure no fortune teller identifies Grandmother's family, Elderbrook's role, the
      wizard, the potion, or the final dragon's identity. The MAY / MAY NOT list is
      written out above `FORTUNE_TELLERS` so the next person to edit a line has it.
- [x] Add a story-driven corruption overlay that does not mutate base terrain and remains
      distinct from Necrotic-region `BLIGHT`. New flat-root `corruption.js`.
- [x] Advance corruption as each new region opens; solving that region's shrine cleanses
      its regional maps. Elderbrook remains ruined regardless (`homevillage` is on
      `CORRUPTION_EXEMPT_TYPES`, with the house interior, shrine interiors and the tower).
- [x] Apply a reversible corrupted-enemy template using the existing Greater/tier15
      multiplier pattern in `makeEnemyDefs` (`enemies.js`) and a distinct visual aura.
- [x] On cleansing, remove the template from living enemies while preserving their current
      HP percentage.
- [x] Tie shrine restoration to fog by increasing that region's reveal radius from 12 to 14
      tiles and fully revealing its village.

**Verified 2026-08-11** in the browser, against live state rather than by reading the
diff: all four readings fire in their scripted order and persist; a teller further along
the road defers and names the village to go back to; the ice village has none; blighted
creatures spawn with the template and shed it exactly (Owlbear 42/5/337 → 28/3/225) with
their HP percentage intact across the change; a map re-entered with blighted
`savedEnemies` in a cleansed region resyncs on entry; a cleansed village's fog goes
0 → 22,500 revealed and its walk radius 12 → 14; and the overlay measurably shifts a sand
tile from `(244,226,207)` to `(207,176,179)` rather than washing it out. Save/load round
trip preserves every flag, and a village saved before this stage gets its teller
backfilled on re-entry.

> **The blight is derived, never stored per-tile.** `isMapCorrupted(mapObj)` is one
> comparison against the `corruption_level` flag and the region's shrine quest, evaluated
> per frame. Nothing writes to `mapObj.map`, so there is no way for a half-applied tile
> swap to survive in a save and strand a region looking blighted after it was cleansed,
> and cleansing is a state change rather than a rewrite of 22,500 tiles per map.
>
> **`corruption_level` is derived when absent**, rather than being written by Beat 5: an
> absent flag on a finished prologue reads as 0 (the forest has been reached). That is
> what makes every pre-stage-8 save correct without a migration, and it keeps stage 7's
> beat from having to know this system exists.
>
> **The overlay is a `multiply` pass, not an alpha wash.** Multiplying by a bruised violet
> shifts each tile's own colours and keeps grass reading as grass; a flat film over the
> top pulls the whole map to one colour and it stops being legible. Blotching is a
> coordinate hash, so the creep holds still as the hero walks and is identical after a
> reload. It is **not** drawn on the minimap — that paints terrain colour straight from
> the tile array, and teaching it about a render-only layer was more than this is worth.
>
> **Turned up on request (2026-08-11).** A deeper veil colour, and the intensity moved off
> per-tile noise (which is even static — raising it just darkens the screen uniformly) and
> onto a patch field. Measured 20% darker with 1.5× the tile-to-tile variation. Terrain
> still separates cleanly, which is the whole reason it multiplies rather than washes.
>
> **Made blotchier on request, same day.** The first patch field was a hash over square
> 3×3 blocks, which fixed the evenness but traded it for hard axis-aligned edges — it read
> as tiling, not rot. Replaced with two octaves of interpolated value noise (scales 9 and
> 4, smoothstepped blend so there are no lattice creases), then a contrast stage:
> `CORRUPTION_CONTRAST` stretches the field about its midpoint before two smoothsteps.
> That stretch is the part that matters. Summed octaves pile up in the middle and
> smoothstep alone only steepens what is already off-centre, so without it 36% of the map
> sat in the middling band that reads as haze; with it that band is 17%, against ~26%
> clearly clean and ~38% clearly eaten. Motes are now gated on the field rather than the
> per-tile hash, so clean ground never carries one and the specks reinforce the same
> shapes the veil draws.
>
> Measured per tile as transmittance (blighted luminance ÷ the same tile cleansed, which
> cancels the terrain's own variation): spread **1.54×** what the previous version gave,
> ranging from 1.00 on untouched ground to 0.42 in the worst of a patch. Mean
> transmittance went 0.655 → 0.742, i.e. the map is *lighter on average* while the dark
> extreme got slightly darker — the alpha floor was dropped to 0.12 deliberately so this
> trades evenness for contrast instead of just piling on more blight. Field is
> deterministic (verified), and the whole overlay costs 0.27 ms a frame against 16.7 ms.
>
> **The three knobs, in the order worth reaching for:** `CORRUPTION_CONTRAST` (how sharply
> clean separates from eaten; past ~3 patches look cut out rather than spread), the two
> scales in `corruptionPatchNoise` (how big the patches are), and the `0.12` floor in the
> alpha line (overall darkness, independent of blotchiness).
>
> **Corrupted enemies are 1.5×, where Greater is 2×.** Damage multipliers land 1:1 on
> damage taken (every melee enemy already ticks below the player's 900 ms i-frame floor,
> so DPS is `dmg × 1000/900`), this stacks with Greater in a boss village for 3× base
> rather than 4×, and unlike Greater it is worn for a whole region rather than one arena.
> XP rises with it so the extra effort pays. Anchored to `tier15` as the shipped
> precedent and to the enemy-forge skill's observed HP-ratio table — **not** to a
> playtest-confirmed reference enemy, because this repo still doesn't have one.
> Bosses are exempt, which also covers Guild Quarries and bounty elites (both carry
> `boss: true`): those are hand-tuned with their own multipliers over the same base, and
> a third one on top would make a quest target's difficulty depend on story state.
>
> **Reversibility is by recomputation, not by division.** `corruptedStatsFor` rebuilds
> the stat line from the `DND_ENEMIES` entry plus the Greater tier, so an uncorrupted
> creature is byte-for-byte what `spawnEnemiesForMap` would have produced for it. Current
> HP crosses as a percentage in both directions.
>
> **Ordering note, deliberate.** A region's shrine only exists once its village is
> activated, and the village is activated by clearing it — so the boss arena is always
> fought blighted and cleansing pays off on everything after it. That is the intended
> shape (the shrine is the reward for the region, not a difficulty toggle you can flip
> before it), but it does mean the hardest fight in a region never benefits.
>
> **Also here:** `revealWalk` / `walkRevealRadius` (`fog.js`). Every "the hero moved or
> arrived" call site passed a bare `12`; they now go through one helper, which is what
> lets the cleansing bonus apply everywhere at once. The 14/16-tile vantage-point reveals
> in `player.js` and `tower.js` are left as literals on purpose — they describe what can
> be seen from up there, not how clear the air is.

## 9. Shrine framework

> **Audit 2026-08-10 (stale, kept for the record): NOT implemented.** No `shrines.js`, no
> `player.abilities`, no puzzle tiles. The 32 `shrine` hits in `world.js` were the
> **legacy sealed elemental shrine** system, a different feature: one dormant overworld
> shrine seeded per region at region-seal time (`seedRegionShrine`), broken by striking it
> with a matching elemental sword or arrow (`tryUnsealShrine`), granting +2 Max HP and
> converting into a reusable healing shrine. That is the system stage 2 says to migrate
> away from — it was **not** an early version of this stage.
>
> **Re-audit 2026-08-11.** The dungeon half was built after that audit was written and the
> checkboxes were never ticked: `shrines.js` exists and is loaded, all 13 puzzles are in,
> the tiles are in `config.js`, and `player.abilities` is in the save. What was genuinely
> missing was everything *outside* the shrine door — the abilities did nothing at all
> ("Stage 9 stores and displays these unlocks only" was written on the radial ring), there
> was no `[F]`, no ability button, and no secrets. That is what this pass added, in a new
> flat-root `abilities.js`.

- [x] Add a flat-root `shrines.js`, loaded after world/map dependencies and before player
      gameplay begins (i.e. after `world.js`, before `player.js`, in `index.html`).
- [x] Place one shrine entrance in each of the 13 elemental-region villages; Elderbrook
      receives none. Confirmed by walking all 13 villages: every one carries a
      `SHRINE_DOOR` at its `shrineDoor`, and map 0 has none anywhere on it.
- [x] Create deterministic off-grid shrine maps with entrance/exit links, persistent local
      puzzle state, reset handling, and one-time rewards.
- [x] Add the required puzzle tiles, rendering, collision, interaction, timers, and save
      serialization.
- [x] Ensure puzzle controls work on desktop and touch. SPACE routes through
      `tryShrineInteraction` (`main.js`); touch has the same via the interact button, plus
      `findTappedShrineInteractable` for tap-to-travel onto a mechanism.
- [x] Add an Abilities radial ring; passive abilities require no input, while Updraft Glide
      and Shadow Step use an equipped ability action (`F` on desktop and a touch ability
      button). The ring was informational; it now equips, and `[F]` / `#ta-ability` fire
      whatever is equipped.
- [x] Implement the 13 shrine designs and rewards:
  - [x] **Forest** (tier0): switch tutorial, block-held pressure plate → Heart Container.
  - [x] **Fire** (tier1): ordered braziers and hot-tile routing → Heart Container.
  - [x] **Water** (tier2): two valves and aligned floating bridge sections → Heart Container.
  - [x] **Ice** (tier3): sliding blocks, simultaneous plates, required solve order → **Frost Grip**.
  - [x] **Earth** (tier4): boulders breaking cracked walls and weighting two plates → Heart Container.
  - [x] **Volcanic** (tier5): timed lava suppression using braziers plus boulder placement → Heart Container.
  - [x] **Air** (tier6): toggle-controlled wind currents → **Updraft Glide**.
  - [x] **Lightning** (tier7): two conduit circuits with a block holding one switch → Heart Container.
  - [x] **Luminous** (tier8): mirrors plus a fixed beam-splitting prism so both receivers can be lit simultaneously → Heart Container.
  - [x] **Necrotic** (tier9): advancing darkness with optional light-refill detours → **Ember Lantern**.
  - [x] **Poison** (tier10): two independently filling gas zones, vents, and a timer-reset plate → Heart Container.
  - [x] **Mana** (tier11): randomized five-to-six-step rune sequences across eight pedestals → **Arcane Sight**.
  - [x] **Shadow** (tier12): paired light/dark room layers requiring timed shifts → **Shadow Step**.
- [x] Wire Frost Grip into existing ice movement, Ember Lantern into Necrotic visibility,
      and Arcane Sight into hidden rune paths.
- [x] Add deterministic overworld shortcuts/secrets for Updraft Glide, Arcane Sight, and
      Shadow Step, including at least one late-tower use.
- [x] Guarantee exactly eight Heart Containers and five abilities across all shrine rewards.
      `SHRINE_REWARDS` is 13 long: 8 hearts, and Frost Grip / Updraft Glide / Ember Lantern
      / Arcane Sight / Shadow Step on Ice, Air, Necrotic, Mana and Shadow respectively.

**Verified 2026-08-11**, driving the live game rather than reading the diff:

- All 13 puzzles reach `solved`, open their gate tile and pay out exactly once — a second
  claim is refused and Max HP does not move again. **Caveat, stated plainly:** the block
  puzzles were driven by placing blocks on their plates, so this proves each win condition
  and reward, not that every block route is physically pushable end to end. The push
  mechanics themselves were tested separately and all three work: a plain block moves one
  tile, an ice block slides 14 and stops exactly on its plate, and a boulder pushed 8
  tiles breaks its cracked wall. Nobody has played a shrine start-to-finish by hand.
- `[F]` and the touch button glide and step correctly: a 1-tile water channel is crossed
  and the hero lands on the far bank; a 1-tile wall is stepped through; open ground, a
  37-tile wall and a gapless line are all refused without moving the hero.
- Frost Grip: on ice with the input released, the hero slides one more tile without it and
  zero with it. Ember Lantern: a necrotic map reveals 8 tiles without it and 12 with.
  Arcane Sight: a rune trail is inert without it, pays out once with it, and reports itself
  spent afterwards.
- Save/load preserves the abilities bag, `equippedAbility` and each map's `abilitySecret`;
  chest counts are identical before and after, and re-entering a stamped map does not
  hollow a second alcove.

> **Two files, on purpose.** `shrines.js` owns the puzzles and the rewards; `abilities.js`
> owns what the rewards do afterwards. They have different lifetimes — a shrine matters
> for the twenty minutes you are inside it, an ability for the rest of the game — and the
> alternative was teaching shrines.js about ice fields, necrotic fog and the tower.
>
> **The two actives share one slot and one button.** The keyboard already uses Z X C V P
> 1 2 3 and four arrows, and the touch pad had three buttons. A key each for something
> used twice an hour was not worth it, so the radial's Abilities ring is what picks which
> of Updraft Glide / Shadow Step `[F]` fires; the three passives list as "Passive" and
> equip nothing. `setEquippedAbility` is deliberately NOT a toggle — `radialAutoPick`
> fires the highlighted item's action as you navigate onto it, so a toggle would unequip
> the ability just by opening the ring on it.
>
> **Glide crosses gaps, never walls**, and Shadow Step crosses at most two tiles of wall.
> Both limits are load-bearing: flying over trees and mountains would delete the shape of
> every map in the game, and every wall meant as a boundary in this game (region borders,
> the tower's curtain, a cave shell) is thicker than two while every wall meant as an
> obstacle is thinner.
>
> **Ember Lantern works by shortening sight rather than by adding darkness.** Necrotic
> maps reveal 8 tiles instead of 12 until the hero carries it. Fog is already this game's
> language for "you cannot see there", it persists per map and it shows on the minimap for
> free; a second darkness system would have to be taught all three. The penalty beats the
> cleansing bonus — a region can be clean of the blight and still be the one where nothing
> carries light.
>
> **The secrets are additive and enclosed, which is why they can be stamped after
> generation.** One per qualifying overworld map, chosen by map id so they stay mixed and
> a given world always puts the same one in the same place: a chest on an islet ringed by
> water, a chest sealed in a pocket of solid terrain, or a five-tile rune trail. None of
> them can cut a route, so none can strand a map's connectivity. The islet placement
> requires a shore within gliding distance as well as open water around it — the first
> version only checked the water and cheerfully dropped a chest in the middle of a
> forty-tile lake that no ability in the game could reach.
>
> **The late-tower use is a vault hollowed out of masonry on floors 12+**, stamped *after*
> `towerSealUnreachable` (which exists to fill in exactly that kind of pocket) and carved
> from a 5×5 that was already solid, so it can never sever a corridor the seal pass just
> blessed.
>
> **A rune mark is genuinely indistinguishable without Arcane Sight** — it draws its own
> region's ground, and its minimap colour is grass. The hero has been walking over them
> for hours by the time they can see one, which is the intended feeling.

## 10. Final boss and ending

**Audit:** the Adult Red Dragon boss exists (`enemies.js`, `tower.js`, `render-enemies.js`)
and `wonGame` fires on defeat (`player.js`, `save.js`). There is **no** pre-fight cutscene,
no HP-threshold dialogue, and no dying monologue — the DOCX v3 final-boss scene is entirely
unbuilt.

- [x] Replace the immediate dragon wake-up with a pre-fight cutscene after the other
      pinnacle guardians die. `playEmperorIntro` (`tower.js`); the scene is what wakes him
      now, and on a reload that has already seen it he is simply awake.
- [x] Confirm here, for the first time, that the Adult Red Dragon is the Emperor. Said in
      the scene, and shown on the HP bar: `nameTheEmperor` renames the creature from
      `ADULT RED DRAGON` to `THE RED DRAGON EMPEROR` at that moment, and the name rides
      along in `savedEnemies` so it stays renamed.
- [x] Reconcile the DOCX dialogue's internal contradiction: the Emperor took the crown from
      Grandmother's ruling family with Elderbrook's help; the wizard supplied the
      immortality potion rather than taking the crown.
- [x] Explicitly name the potion and establish that it caused the transformation and blight.
      **The Long Draught.** Coined here because the script never named it and this item
      says to; the name is in the pre-fight line and nowhere earlier.
- [x] Trigger the scripted Emperor line once at 50% HP.
- [x] At 15% HP, stagger the boss, briefly show the almost-human flicker, and play the
      second line once. `staggerT` (honoured in `stepEnemies`) and `humanFlickerT`
      (`drawEmperorFlicker`), both 2.2s.
- [x] On defeat, delay `wonGame` and the victory screen until the complete dying monologue
      finishes.
- [x] Reveal Grandmother's family and Elderbrook's role only in this scene.
- [x] Render the crown rolling to the player's feet, then show the epilogue title card.
- [x] Preserve one-shot scene flags across saves so no threshold or ending dialogue repeats.

**Verified 2026-08-11** by climbing to the pinnacle in the browser and driving the whole
finale: killing the last guardian plays the intro and wakes him; 60% fires nothing, 50%
fires its line once and stays quiet at 40%, 15% fires the stagger line once and stays quiet
at 10%; a staggered Emperor does not move for the length of the stagger and moves again the
moment it lapses; on death `wonGame` and the victory overlay are still false 1.3s into the
monologue and true only after the epilogue card; the crown ends its roll at the hero's feet
(target `(75,147)`, hero at `(75,146)`); the victory screen reads "The Red Dragon Emperor
lies slain". A save/load mid-fight keeps the flags, the rename and the awake state and
replays nothing, and a second run at the death scene short-circuits straight to the payout.

> **The contradiction, and which way it was resolved.** DOCX v3's pre-fight line has a
> wizard "promise me a crown and give me this instead"; its dying monologue has the Emperor
> take the crown himself from the ruling family. The monologue is the load-bearing reveal,
> so the pre-fight line gave way: the wizard never had a crown to give, he sold the Emperor
> **the Long Draught**, and what the Emperor wanted from it was time. The crown he wears is
> the one he took by force with Elderbrook's help. The Draught is what changed his shape
> and what the land has been paying for since — it is the blight, which is the same story
> `corruption.js` tells in tiles.
>
> **Thresholds are watched per frame, not hooked into damage.** There are eight places in
> `projectiles.js` that subtract from an enemy's HP; a fraction check in `stepFinalBoss`
> costs one comparison a frame and cannot be missed by a ninth. It sits *after* the freeze
> chain in `update()` on purpose, so the 15% line waits its turn while the 50% line's box
> is still up.
>
> **`staggerT` is general, not a boss field.** Dormant means asleep; this means
> interrupted. `stepEnemies` skips a staggered enemy the same way it skips a dormant one,
> so anything that later needs to stop a creature without putting it to sleep has it.
>
> **Nothing about winning happens until the last line is dismissed.** `wonGame`, the hoard
> chest and the victory overlay all live at the end of `playEmperorDeath`, and the generic
> `🏆 THE <name> IS DEFEATED!` toast is suppressed for the final boss alone — a trophy card
> thrown across his dying words would be the game applauding in the middle of the sentence
> that explains what the player just did.
>
> **The crown is a drawn prop**, like the prologue's Emperor: a position and nothing else,
> no entity, no pickup, no save field. It rolls on an eased arc with its width pinching as
> it spins, then lies flat where it stops. It is stepped *before* the freeze chain, because
> it rolls during a `wait` step of its own cutscene and everything below that chain is
> stopped while a `wait` runs.
>
> **The flicker is deliberately faceless** — a pale standing figure, no features. The
> script says "something almost human", and the moment it resolves into a specific person
> it stops being that.
>
> **Follow-up for stage 1:** the Long Draught is now canon and the story bible doesn't know
> it. Whoever does the canon pass should fold it in alongside the Withering Crown.

---

## Verification checklist

**How these were run.** The browser pane in this environment doesn't composite frames, so
`requestAnimationFrame` is throttled and the game loop doesn't tick on its own. Everything
below was therefore driven by pumping the real `update(dt)` — the same function the loop
calls, with the same dialogue, cutscene, movement and collision code underneath — and
reading the resulting state back out. That is stronger than reading the diff and weaker
than a person playing: **nobody has held a controller, and no physical touch device has
been used.** Where an item needed a human, it says so.

- [x] Run syntax checks on every changed JavaScript file and run `tools/lint-conventions.py`.
      `node --check` clean on every file touched; the linter reports 0 errors. Its 68
      warnings are the pre-existing unseeded-`Math.random()` generation gap documented in
      SKILL.md, and its one note (`dog_outrun` set but never checked) is a deliberate
      stage-4 flag kept for symmetry with `dog_fled`.
- [x] Audit dialogue strings for forbidden em dashes and premature wizard/family/village
      revelations. Em dashes: see stage 1. Revelations: `wizard`, `Long Draught`, "ruling
      family", "grandmother's family" and every phrasing of Elderbrook's role appear in
      exactly one place, `tower.js`. The prologue's Emperor is drawn with
      `cutsceneActor: true`, which returns before the name tag, so his name never reaches
      the screen there either.
- [x] Play the complete prologue on desktop and touch, testing dog-flee and dog-outrun paths.
      Both paths played start to finish: **flee** (3 HP → 2 → 1, clamped, `dog_fled`, and a
      third punch cannot kill it) on the desktop scheme, **outrun** (12 tiles clear for
      2.5s, `dog_outrun`) on the touch scheme. Both end with the same state: 3 HP, bow
      equipped, sword in the bag, ten arrows, chest open, `prologue_complete`. On touch the
      keyboard prompts are suppressed and the title hint rewords itself, as designed.
      **Caveat: "touch" here means the touch UI mode, driven programmatically — not a
      finger on a real screen.**
- [x] Test saving/loading before the package, during Ashfall, after Beat 5, and via Skip
      Prologue. All four round-trip. The mid-Ashfall load correctly lands unfrozen with
      3 HP, `village_burning` set and the ruin at full burn.
- [x] Verify post-Ashfall survivor shops, HP reduction, weapon gating, chest state, and
      permanent ruins. Innkeeper, shopkeeper and herbalist alive on their marks (plus the
      portal Gatekeeper), eight dead, `shopsRuined` set, `storeRegion()` returning forest
      tier, weapons locked on `homevillage`, chest open, and a from-scratch rebuild coming
      back charred with no second bow on the floor.
- [x] Solve, reset, leave, reload, and re-enter every shrine; confirm each reward is granted
      exactly once. All 13 solve, open their gate and pay out once (a second claim is
      refused and Max HP does not move). Two of them were taken through the full
      solve → claim → walk out the exit → reset-refused → save → reload → re-enter cycle:
      still solved, still claimed, gate still open, nothing re-granted. **Caveat carried
      forward from stage 9: the block puzzles were driven by placing blocks on their
      plates.** The push mechanics were verified separately (plain push, an ice block
      sliding 14 tiles onto its plate, a boulder breaking its cracked wall), but no shrine
      has been solved by hand, walking the route.
- [x] Test all five abilities and their overworld/tower integrations. Glide crosses a water
      channel and lands on the far bank; Shadow Step crosses a 1-tile wall; both refuse
      open ground, a 37-tile wall and a gapless line without moving the hero. Frost Grip
      stops the ice slide (1 tile of drift without it, 0 with). Ember Lantern restores
      necrotic sight (8 → 12). Arcane Sight makes a rune trail readable and claimable once.
      The tower vault is present on floor 12 and absent on floor 5.
- [x] Verify corruption visuals, enemy multipliers, cleansing, and fog bonuses across
      multiple regions. Four regions sampled at once: fire and ice blighted (Blighted
      Salamander 58 → 87 HP, 6 → 9 damage; Blighted Young White Dragon 96 → 144, 8 → 12),
      water cleansed and untouched, volcanic beyond the frontier and untouched. Fog reads
      12 in a blighted region and 14 in a cleansed one. The overlay measurably shifts a
      sand tile from `(244,226,207)` to `(207,176,179)`.
- [x] Test fortune-teller ordering and one-time persistence. All four readings fire in
      order, a teller further along the road defers and names the village to go back to,
      the ice village has none, and every flag survives a save/load.
- [x] Test final-boss scenes across both HP thresholds, death, reloads, and the victory
      transition. 60% silent, 50% once, 40% silent, 15% once with the stagger, 10% silent;
      a staggered Emperor holds still and moves again when it lapses; `wonGame` and the
      overlay wait for the monologue; the crown lands at the hero's feet; a mid-fight
      save/load keeps the flags, the rename and the awake state and replays nothing.
- [x] Open `index.html` directly through `file://`, inspect the console, and load at least
      one legacy save. Opened at `file:///C:/Users/corte/MACortese42/Game1/Game1/index.html`:
      all 43 scripts load, the newest globals are present (so it is current code, not a
      cached copy), 30 frames of `update` + `render` run without throwing, and the console
      is clean. A hand-built legacy save — no flags bag, no `hasBow`/`hasSword`, no
      abilities, `medPotions`, a version-less `shrineQuests`, the vestigial `player.shrines`
      — loads and migrates correctly on that same `file://` page.

**Still wanted, and only a person can do it:** play it. On a real phone, with a thumb, and
on a desktop with hands on the keys. Everything above proves the systems do what they were
built to do; none of it proves the game is any good to play.

---

## Superseded decisions

Recorded so the reasoning is not lost. These come from `../story-decisions-todo.md` and are
**overridden** by DOCX v3.

| Superseded | Replaced by (DOCX v3) |
|---|---|
| "Elemental Ward" puzzle template — one shared engine of 3–4 ward tiles hit with the region's own element, plus a per-region twist table | 13 bespoke shrine designs, each an off-grid two-room dungeon (entry room teaches the mechanic, puzzle room tests it), using generic puzzle tiles rather than elemental weapon hits |
| "Path-Carving" and "Chain-Reaction" puzzle families | Not used; the 13 designs in DOCX v3 are the full set |
| 12 shrines (one per village except the starting village), matching the 12 wieldable elements | **13** shrines, one per elemental region village; Elderbrook (the starting village) gets none |
| Shrine reward open question: heart containers as the constant with 2–3 special shrines | Fixed split: **8 heart containers + 5 abilities** (Ice, Air, Necrotic, Mana, Shadow) |
| Puzzle must use the region's own element via forged elemental gear | Puzzles are mechanical (switches, plates, blocks, beams, timers) and require no elemental gear |
| Fortune tellers in "some villages", villages unspecified | Exactly four: Water, Volcanic, Luminous, Mana |
| The wizard took the crown from Grandmother's family | The **Emperor** took the crown, with Elderbrook's help; the wizard only supplied the immortality potion |
| Beat 1 Father's line "Take the west road" | "Take the shortcut past the mill, it's faster." |
| Beat 2 package giver is a market-stall merchant | The existing store shopkeeper, named Wren; the duplicate stall role is removed |
| Legacy overworld sealed elemental shrines (+2 Max HP on an elemental strike) | Migrated into the new shrine schema; the old overworld shrines become ordinary healing shrines |

Preserved from `../story-decisions-todo.md` (compatible with DOCX v3, still in force):

- No em dashes anywhere in dialogue.
- The dog is Hendricks' dog, 3 HP, 1 damage; the player's punch does 1 damage and can harm
  nothing else in the game; the dog flees at 1 HP rather than dying.
- "He was after us… he was after you…" is the line that makes the attack personal, and the
  narrower partial-truth framing it implies (the *who* is known, the *why* is not).
- The wizard stays off-screen entirely and is long dead; the final-boss monologue is the
  only place he is ever mentioned.
- Elderbrook stays visibly ash and burned permanently; no restoration system.
- The corruption map layer is story-driven palette-shifted tiles, distinct from the Necrotic
  region's `BLIGHT` terrain.
- Corrupted enemies reuse the "Greater"/tier15 multiplier pattern already in `makeEnemyDefs`.

## Assumptions

- DOCX v3 overrides conflicting checklist text and older code.
- There are 13 regional-village shrines; "no shrine in the starting village" refers to
  Elderbrook.
- The detailed DOCX shrine layouts supersede the earlier Elemental Ward and 12-shrine
  proposals.
- The Luminous puzzle receives a prism splitter because the original simultaneous-receiver
  description is otherwise unsolvable.
- Both source files remain untouched; this handoff lives inside the game repository.
