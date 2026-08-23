# The RPG Game

A top-down Zelda-style adventure RPG that runs in the browser. Procedurally
generated maps across 13 elemental regions, D&D 5e enemies, persistent map
memory, an elemental crafting economy, side quests, and named save slots —
ending in a multi-floor castle tower and a final dragon.

Maps remember their terrain, their opened chests and their quest state, but not
their dead: only villages and the castle tower's floors stay cleared. Everywhere
else restocks from its spawn table every time you walk back in.

## Running

Just open `index.html` in any modern browser. No build step, no dependencies —
every script is plain ES loaded directly from the page.

For local development with auto-reload, run a simple static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Controls

- **Arrow keys** — move
- **Z** or **Space** — sword attack (Space also interacts: open an adjacent chest, or talk to a villager / shop in town when there's something to interact with)
- **X** — bow
- **C** — bomb
- **P** — drink a Health Potion
- **1 / 2 / 3** — quick weapon switch (sword / bow / bomb)
- **V** — open the radial inventory menu (equip elemental swords/armor/arrows, use items, open the Ledger, Character stats, and World Map)
- **Tab** — toggle minimap

Touch controls are supported:

- A thumbstick anchored in the **bottom-left** corner moves the hero — the
  further you push it, the faster he walks. Only the pad moves him; a stray tap
  on the world can't.
- **Sword / Bow / Potion** buttons sit in the opposite corner. The potion button
  is the P key's counterpart and shows how many are left; bombs and every other
  consumable live in the radial menu.
- **Tap on/next to the hero** opens the radial menu. Other taps are contextual —
  tap a villager or chest and the hero walks over and interacts.
- **Double-tap the pad** cycles the view: normal → zoomed out → full-screen map.
  A tap anywhere leaves the full-screen map.
- Save, Load, New Game, Fullscreen and the control-scheme toggle are in the
  radial menu's **menu** ring — the first three behind its ⚙️ Game Menu window.
- Controls inset themselves from notches and the home indicator on phones that
  report a safe area.

### Control scheme (touch vs desktop)

The game picks a scheme automatically and switches live — the starting guess
comes from device capability, then it follows whichever input you actually use,
so plugging a mouse into a tablet (or tapping the screen on a touchscreen
laptop) swaps the UI without a reload.

The 🎮 button on the title screen and the radial menu's **Controls** entry cycle
**Auto → Touch → Desktop** if you want to pin one. The choice is stored per
device (`the_rpg_game_ui_mode` in localStorage), not in your save file, so
carrying a save to another device doesn't drag a phone's controls along with it.

Everything keys off a single `data-ui` attribute on `<html>`, set in
`config.js` — CSS should target `html[data-ui="touch"]` rather than a
`(pointer: coarse)` media query, or a pinned mode won't be honoured.

## Project Structure

All scripts live in the project root (no build tooling). `index.html` loads them
in dependency order.

```
config.js            # Constants — tile types (T), map size, colors, registries (TROPHIES, ORE_TYPES, SOLID_TILES)
elements.js          # Elemental system — SWORD_ELEMENTS, OPPOSITE pairings, armor/sword math
regions.js           # The 13 regions (border/ground/decoration tiles, boss, element)
map-helpers.js       # Tile manipulation primitives
connectivity.js      # Flood-fill connectivity enforcement
mapgen-terrain.js    # Base terrain generation
mapgen-foliage.js    # Scattered, cuttable foliage (forage sources)
mapgen-caves.js      # Caves, sky caves, waterfall cave chains
mapgen-village.js    # Village / house / whirlpool-grotto layouts
mapgen-tower.js      # Castle-tower floor layouts
mapgen-biomes.js     # Per-region map assembly (buildRegionMap etc.)
enemies.js           # D&D enemy data, pools, and spawning
world.js             # Coordinate registry, neighbor lookup, region sealing, shrines
player.js            # Player state, movement, XP, loot tables, kill/respawn
projectiles.js       # Arrows / bombs / enemy projectiles, particles, damage numbers
render-tiles.js      # Tile rendering + sprite cache
render-enemies.js    # Enemy rendering
render.js            # Frame composition, player, HUD overlays, minimap
ui.js                # HUD updates, message toasts, modal management
save.js              # Named save slots + rolling autosave, serialization
shop-core.js         # Shared shop modal plumbing
shop-general.js      # General Store — buy/sell/forage, TROPHY_SELL table
shop-blacksmith.js   # Blacksmith — elemental swords & armor forging/upgrades
shop-herbalist.js    # Herbalist / Taxidermist / Alchemist
villagers.js         # Town NPCs, escort quests
guild.js             # Sword & Shield Guild quest chain
tower.js             # Castle-tower entry and floor progression
radial.js            # Radial inventory menu
portal.js            # Cave / portal transitions
ledger.js            # Completionist's drop Ledger
stats.js             # Character stats page
worldmap.js          # Zoomable world-map atlas page
sysmenu.js           # ⚙️ Game Menu window — Save / Load / New Game / God Mode / Generate Full Map
main.js              # Game loop, init, input
```

Styling is in `game.css` (HUD, layout, full-window canvas) and `modal.css`
(save/load and shop modal styling), both loaded from `index.html`.

## Game Mechanics

- The world is a grid of 150×150-tile maps spanning **13 regions** in
  progression order: forest → fire → water → ice → earth → volcanic → air →
  lightning → luminous → necrotic → poison → mana → shadow.
- Each map has up to 4 exits (one per side). Maps are persistent — walk away and
  return and the terrain you changed and the chests you opened stay that way.
  Positions live in a coordinate registry, so a loop (right → down → left → up)
  returns you to the starting map.
- **Kills do not persist.** Walk out of an overworld map, cave, dungeon, sky
  cave or grotto and it restocks: every enemy is back, at full HP, next time you
  step in. The exceptions are the arenas — villages and the 14 castle-tower
  floors — where a boss you have killed stays killed. A save records only the
  living enemies on the map you are standing on, so reloading drops you back
  into the same fight rather than a freshly stocked map.
- After ~20 unique overworld maps in a region, the next new map is that region's
  **Village**. Clearing the village boss seals the region (dead-ends behind you)
  and opens the gate into the next region.
- Beyond the final village lies a **14-floor castle tower**. Floors 1–13 replay
  each region's roster and boss; the pinnacle gathers every boss plus the flying
  **Adult Red Dragon** — slaying it wins the game.
- **Elemental combat** — every region has an element with an opposite. Elemental
  swords, arrows, and armor (forged and upgraded at Blacksmiths) exploit or
  defend those pairings. Herbalists brew region Health Potions and timed
  elemental-immunity Elixirs.
- **Side quests** — Collector, Lost Son (Timmy), the Sword & Shield Guild chain,
  Sealed Shrines, Taxidermist/Alchemist orders, and escort quests, tracked per
  region.
- **Death & saves** — six named save slots plus a rolling autosave written at
  checkpoints (village clears, each tower floor). Dying restores your most recent
  checkpoint.

## Customization Tips

- **Difficulty curve** — see `ENEMY_POOLS` in `enemies.js` and `ENEMY_DROPS` in `player.js`
- **Regions** — add or tweak entries in `regions.js`
- **New tile types** — add to the `T` enum in `config.js`, give it a color, add a draw case in `render-tiles.js`, and (if it blocks movement) add it to `SOLID_TILES`
- **New monster trophy** — add a row to `TROPHIES` (`config.js`) and an `ENEMY_DROPS` entry; sell rows, pickup handling, and defaults derive from the registry
- **Save slot count** — `MAX_SLOTS` in `save.js`
