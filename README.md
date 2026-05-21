# Hyrule Quest

A top-down Zelda-style adventure RPG that runs in the browser. Procedurally generated forest maps, D&D 5e enemies, fog of war, persistent map memory, and named save slots.

## Running

Just open `index.html` in any modern browser. No build step, no dependencies.

For local development with auto-reload, you can run a simple static server:

```bash
# Python 3
python3 -m http.server 8000

# Node (npx)
npx serve

# Then open http://localhost:8000
```

## Controls

- **WASD / Arrows** — move
- **Z / Space** — sword attack
- **X** — bow
- **C** — bomb
- **Tab** — toggle minimap
- **1 / 2 / 3** — quick weapon switch (sword / bow / bomb)

## Project Structure

```
hyrule-quest/
├── index.html             # Entry point — loads styles + scripts
├── README.md
├── styles/
│   ├── game.css           # HUD, layout, full-window canvas
│   └── modal.css          # Save/load modal styling
└── src/
    ├── config.js          # Constants — tile types, map size, colors
    ├── map-helpers.js     # Tile manipulation primitives
    ├── connectivity.js    # Flood-fill connectivity enforcement
    ├── map-gen.js         # buildForestMap / buildVillageMap
    ├── enemies.js         # DnD enemy data and spawning
    ├── world.js           # Coordinate registry, neighbor lookup
    ├── player.js          # Player state, movement, attacks
    ├── projectiles.js     # Arrow / bomb / enemy projectiles
    ├── fog.js             # Per-map fog of war
    ├── render.js          # Tile/enemy/player rendering, minimap
    ├── save.js            # Save slot system, serialization
    ├── ui.js              # HUD updates, modal management
    └── main.js            # Game loop, init, input
```

## Game Mechanics

- The world is an infinite grid of 150×150 tile forest maps.
- Each map has 4 exits (one per side, centered).
- Maps are persistent — walk away and return, your kills, opened chests, and explored areas stay.
- Map positions are tracked in a coordinate registry, so a loop (right → down → left → up) returns you to the starting map.
- After visiting 20 unique forest maps, the 21st new map is always the Village.
- Defeating the Forest Lich boss in the village completes the game.

## Customization Tips

- **Difficulty curve** — see `ENEMY_POOLS` in `src/enemies.js`
- **Map biomes / generators** — extend `src/map-gen.js` and call from `src/world.js`
- **New tile types** — add to the `T` enum in `src/config.js`, give it a color in `TILE_COLORS`, and add a case to `drawTile()` in `src/render.js`
- **Save slot count** — `MAX_SLOTS` in `src/save.js`
