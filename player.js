// ─── Player state and movement ────────────────────────────────────────────────

// Inventory cap shared by every stackable item (potions, herbals, trophies, and
// each entry in player.arrows). Rupees are exempt — they bank far higher under
// RUPEE_CAP. Starting amount given to a fresh player for every item (and every
// elemental arrow / sword). Stats like maxHp / swordLevel / bowLevel / armor are
// progression — not items — and are intentionally not capped here.
const ITEM_CAP = 128;
const RUPEE_CAP = 99999;
const STARTING_ITEM_AMOUNT = 64;

// Cap-respecting increment for a scalar inventory key. Returns the amount
// actually added (may be less than `n` when the cap clamps). Rupees use the
// larger RUPEE_CAP; every other stackable shares ITEM_CAP.
function addItem(key, n) {
  const cap = key === 'rupees' ? RUPEE_CAP : ITEM_CAP;
  const before = player[key] || 0;
  player[key] = Math.min(cap, before + n);
  return player[key] - before;
}

// Cap-respecting increment for elemental arrow counts.
function addArrow(elemId, n) {
  player.arrows = player.arrows || {};
  const before = player.arrows[elemId] || 0;
  player.arrows[elemId] = Math.min(ITEM_CAP, before + n);
  return player.arrows[elemId] - before;
}

// Fill in starting inventory that depends on SWORD_ELEMENTS (which loads after
// player.js). Called from boot and newGame once every script has loaded.
function applyStartingInventory(p) {
  if (typeof SWORD_ELEMENTS === 'undefined') return;
  const ids = Object.keys(SWORD_ELEMENTS);
  p.swordElements = ids.slice();   // grant every elemental sword
  p.armorElements = ids.slice();   // grant every elemental armor
  p.arrows = { plain: STARTING_ITEM_AMOUNT };
  for (const id of ids) p.arrows[id] = STARTING_ITEM_AMOUNT;
}

let player = {
  x: EXIT_COL, y: EXIT_ROW,
  // Smoothed sub-tile position used for rendering only. Game logic still
  // operates on integer (x, y). renderX/Y lerps toward x/y each frame at the
  // same rate as the camera so the player stays visually centered.
  renderX: EXIT_COL, renderY: EXIT_ROW,
  hp: 8, maxHp: 8,
  // Temporary HP — a green-heart buffer (bought at the General Store) that
  // absorbs damage before real HP. Not healed by potions/hearts/rest.
  tempHp: 0,
  rupees: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  invincible: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  potions: STARTING_ITEM_AMOUNT,
  // Medium Health Potions — brewed only by the fire-region Herbalist (heal 1d8).
  // Brew-only, so a fresh player starts with none.
  medPotions: 0,
  herbals: STARTING_ITEM_AMOUNT,
  mushrooms: STARTING_ITEM_AMOUNT,
  // Trophy / crafting collectibles dropped by specific enemies.
  fangs: STARTING_ITEM_AMOUNT, fingers: STARTING_ITEM_AMOUNT,
  bones: STARTING_ITEM_AMOUNT, wings: STARTING_ITEM_AMOUNT,
  // Organs (from zombies) and feathers (from owlbears) are drop-only trophies,
  // so they start empty rather than at the granted starting amount.
  organs: 0, feathers: 0,
  // Region trophies (see ENEMY_DROPS) — all drop-only, so they start empty.
  silks: 0, talismans: 0, embers: 0, venoms: 0, fins: 0, pearls: 0,
  cores: 0, shards: 0, pelts: 0, tusks: 0, scales: 0, stones: 0,
  sparks: 0, horns: 0, motes: 0, ectoplasms: 0, eyes: 0, brains: 0,
  // Bone meal — ground from desert bone piles cut down by the sword. Starts at 0
  // since it's earned in the field, not granted.
  bonemeal: 0,
  // Snowballs — packed powder blasted out of ice-region snow drifts (50% per
  // bombed drift). Field-earned like bone meal, so it starts at 0.
  snowballs: 0,
  // The collection of elemental swords the player owns (each id from
  // SWORD_ELEMENTS in elements.js). Elemental swords are now specific weapons
  // — they don't stack on the base sword. Only one is wielded at a time.
  swordElements: [],
  // Which elemental sword is currently equipped, or null for the base sword.
  // Affects doSwordSwing — only the active elemental adds its 1d4 roll.
  activeSwordElement: null,
  // Quantities of each elemental arrow the player owns, keyed by element id.
  // Bought / sold in the General Store. Firing an elemental arrow consumes
  // one and adds +1d4 of that element to the hit.
  arrows: {},
  // Which elemental arrow is currently nocked, or null for plain arrows.
  activeArrowElement: null,
  // Owned elemental armors and the one currently worn (or null for none).
  // The active armor halves incoming damage of its matching element.
  armorElements: [],
  activeArmorElement: null,
  defeatedBoss: false
};

// Drink one Health Potion. Heals 1d4 HP (1-4, random), clamped to maxHp.
// No-op if the player is at full HP or has no potions left.
function usePotion() {
  if (player.potions <= 0) {
    showMsg('🧪 No potions left.', 1500);
    return;
  }
  if (player.hp >= player.maxHp) {
    showMsg('🧪 Already at full HP — saving the potion.', 1500);
    return;
  }
  player.potions--;
  const heal = 1 + Math.floor(Math.random() * 4);   // 1d4 → 1..4
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  const gained = player.hp - before;
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#ff66aa', 12, 3);
  spawnParticle(sp.x, sp.y, '#ffccdd', 8, 2);
  showMsg(`🧪 Quaffed a Health Potion — +${gained} HP!`, 2500);
  updateHUD();
}

// Drink one Medium Health Potion. Heals 1d8 HP (1-8, random), clamped to maxHp.
// No-op at full HP or with none left. Brewed by the fire-region Herbalist from
// monster trophies (see brewMedPotion in shop.js).
function useMedPotion() {
  if ((player.medPotions || 0) <= 0) {
    showMsg('🍶 No medium potions left.', 1500);
    return;
  }
  if (player.hp >= player.maxHp) {
    showMsg('🍶 Already at full HP — saving the potion.', 1500);
    return;
  }
  player.medPotions--;
  const heal = 1 + Math.floor(Math.random() * 8);   // 1d8 → 1..8
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  const gained = player.hp - before;
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#66ddaa', 12, 3);
  spawnParticle(sp.x, sp.y, '#cceedd', 8, 2);
  showMsg(`🍶 Quaffed a Medium Potion — +${gained} HP!`, 2500);
  updateHUD();
}

// Tick/cooldown state
let moveTimer = 0;
const MOVE_MS = 110;             // ms between movement steps (grid-based)
const ICE_SLIDE_MS = 320;        // released walk input stays live this long on ICE
                                 // (~MOVE_MS×3 → the hero glides a couple of tiles
                                 // before stopping; bumped from 50 for slicker ice)

// ── Climb / jump animation state (read by drawPlayer in render.js) ────────────
// A "jump" is a short timed hop arc, triggered when the player mounts or leaves
// a CLIMB ramp (the lip where a path crosses a plateau). Climbing itself is
// detected per-frame from the tile under the player, so it needs no state here.
let playerJumpStart = -1;        // ms timestamp the current hop began (-1 = none)
const PLAYER_JUMP_MS = 260;      // hop duration
let attackCooldown = 0;
let bowCooldown = 0;
let bombCooldown = 0;
let transitionCooldown = 0;      // brief lockout after a map transition

// Input
let keys = {};
// Latest walking input + when it was last live — drives the ice slide in
// stepPlayerMovement (released input stays active ICE_SLIDE_MS on ICE).
let lastWalkInput = { mx: 0, my: 0, t: -1 };

// Camera tracks player position. We keep a *target* and the *actual* camera
// position separately so the world can smoothly chase the player rather than
// snapping each tile-step.
let camC = 0, camR = 0;
let camTargetC = 0, camTargetR = 0;
const CAM_TAU_MS = 80;   // exponential smoothing time constant

// Recompute the camera target from the player's current position.
// Pass snap=true to also pin the actual camera to the new target (for boot,
// load, respawn, and map transitions — anywhere a smooth scroll would be wrong).
function clampCam(snap = false) {
  const halfVC = PW / TILE_PX / 2;
  const halfVR = PH / TILE_PX / 2;
  const maxC = Math.max(0, MCOLS - PW / TILE_PX);
  const maxR = Math.max(0, MROWS - PH / TILE_PX);
  camTargetC = Math.max(0, Math.min(maxC, player.x - halfVC + 0.5));
  camTargetR = Math.max(0, Math.min(maxR, player.y - halfVR + 0.5));
  if (snap) {
    camC = camTargetC; camR = camTargetR;
    player.renderX = player.x; player.renderY = player.y;
  }
}

// Per-frame lerp for both camera AND the player's render position. Using the
// same time constant means the player stays visually centered while the world
// scrolls — no more tile-stepping jump on the sprite.
function tickCamera(dt) {
  const k = 1 - Math.exp(-(dt || 16) / CAM_TAU_MS);
  camC += (camTargetC - camC) * k;
  camR += (camTargetR - camR) * k;
  player.renderX += (player.x - player.renderX) * k;
  player.renderY += (player.y - player.renderY) * k;
  if (Math.abs(camC - camTargetC) < 0.0015) camC = camTargetC;
  if (Math.abs(camR - camTargetR) < 0.0015) camR = camTargetR;
  if (Math.abs(player.renderX - player.x) < 0.0015) player.renderX = player.x;
  if (Math.abs(player.renderY - player.y) < 0.0015) player.renderY = player.y;
}

// ─── Level / XP ───────────────────────────────────────────────────────────────
function gainXP(amt) {
  player.xp += amt;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = Math.floor(player.xpNext * 1.8);
    player.maxHp += 2;
    player.hp = player.maxHp;  // full heal on level up
    // Celebratory burst — gold + white sparkles with a hint of blue to read as
    // "leveled up" rather than damage. spawnParticle works in canvas pixels,
    // so route the player's tile through screenPX first.
    const lvlSp = screenPX(player.x, player.y);
    spawnParticle(lvlSp.x, lvlSp.y, '#ffee44', 24, 4);
    spawnParticle(lvlSp.x, lvlSp.y, '#ffffff', 16, 3);
    spawnParticle(lvlSp.x, lvlSp.y, '#88ddff', 12, 2);
    showMsg(`⬆️ Level Up! Level ${player.level}! Max HP +2 — fully healed!`, 3000);
  }
}

// ─── Death / respawn ──────────────────────────────────────────────────────────
function respawn() {
  player.hp = player.maxHp;
  currentMapId = 0;
  placePlayerInStarterHouse(worldMaps[0]);  // same spot as a fresh game: beside the bed
  player.rupees = Math.max(0, player.rupees - 10);  // small death penalty
  clampCam(true);
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  showMsg('💀 Defeated! Returned to start (-10 rupees)', 3000);
}

// ─── Per-enemy-type loot table ────────────────────────────────────────────────
// Each kill rolls its drops independently after the universal HP-heart roll.
// Every pool enemy (see ENEMY_POOLS in enemies.js) drops a thematically
// matching item: trophies (TROPHY_META ids), 'herbal', or 'potion'. All of
// them are sellable at the General Store.
const ENEMY_DROPS = {
  // ── Tier 0 · Forest ──
  goblin:            [{ type: 'finger',    chance: 0.20 }],
  wolf:              [{ type: 'fang',      chance: 0.50 }],
  pixie:             [{ type: 'wing',      chance: 0.05 }],
  dryad:             [{ type: 'herbal',    chance: 0.50 }, { type: 'potion', chance: 0.10 }],
  giant_spider:      [{ type: 'silk',      chance: 0.35 }],
  owlbear:           [{ type: 'feather',   chance: 0.20 }],
  // ── Tier 1 · Fire / Desert ──
  cultist:           [{ type: 'talisman',  chance: 0.25 }, { type: 'potion', chance: 0.10 }],
  magma_mephit:      [{ type: 'ember',     chance: 0.35 }],
  gnoll:             [{ type: 'fang',      chance: 0.35 }],
  hell_hound:        [{ type: 'ember',     chance: 0.35 }],
  giant_scorpion:    [{ type: 'venom',     chance: 0.35 }],
  salamander:        [{ type: 'ember',     chance: 0.40 }],
  // ── Tier 2 · Water ──
  sahuagin:          [{ type: 'fin',       chance: 0.35 }],
  kuo_toa:           [{ type: 'fin',       chance: 0.35 }],
  hunter_shark:      [{ type: 'fang',      chance: 0.50 }],
  merrow:            [{ type: 'pearl',     chance: 0.30 }],
  sea_hag:           [{ type: 'finger',    chance: 0.30 }],
  water_elemental:   [{ type: 'core',      chance: 0.30 }],
  // ── Tier 3 · Ice ──
  ice_mephit:        [{ type: 'shard',     chance: 0.35 }],
  winter_wolf:       [{ type: 'fang',      chance: 0.40 }],
  yeti:              [{ type: 'pelt',      chance: 0.35 }],
  mammoth:           [{ type: 'tusk',      chance: 0.40 }],
  white_dragon:      [{ type: 'scale',     chance: 0.35 }],
  frost_giant:       [{ type: 'shard',     chance: 0.40 }],
  // ── Tier 4 · Earth ──
  gargoyle:          [{ type: 'stone',     chance: 0.35 }],
  ankheg:            [{ type: 'venom',     chance: 0.35 }],
  displacer:         [{ type: 'pelt',      chance: 0.35 }],
  bulette:           [{ type: 'scale',     chance: 0.35 }],
  earth_elemental:   [{ type: 'core',      chance: 0.30 }],
  stone_giant:       [{ type: 'stone',     chance: 0.40 }],
  // ── Tier 5 · Air ──
  harpy:             [{ type: 'feather',   chance: 0.40 }],
  griffon:           [{ type: 'feather',   chance: 0.40 }],
  manticore:         [{ type: 'wing',      chance: 0.30 }],
  air_elemental:     [{ type: 'core',      chance: 0.30 }],
  wyvern:            [{ type: 'scale',     chance: 0.35 }],
  roc:               [{ type: 'feather',   chance: 0.50 }],
  // ── Tier 6 · Lightning ──
  will_o_wisp:       [{ type: 'spark',     chance: 0.35 }],
  blue_wyrmling:     [{ type: 'scale',     chance: 0.35 }],
  behir:             [{ type: 'spark',     chance: 0.35 }],
  young_blue_dragon: [{ type: 'scale',     chance: 0.40 }],
  storm_giant:       [{ type: 'spark',     chance: 0.40 }],
  // ── Tier 7 · Luminous ──
  pegasus:           [{ type: 'feather',   chance: 0.40 }],
  couatl:            [{ type: 'scale',     chance: 0.35 }],
  unicorn:           [{ type: 'horn',      chance: 0.30 }],
  ki_rin:            [{ type: 'horn',      chance: 0.30 }],
  deva:              [{ type: 'mote',      chance: 0.35 }],
  planetar:          [{ type: 'mote',      chance: 0.40 }],
  // ── Tier 8 · Necrotic ──
  skeleton:          [{ type: 'bone',      chance: 0.20 }],
  zombie:            [{ type: 'organ',     chance: 0.20 }],
  ghost:             [{ type: 'ectoplasm', chance: 0.35 }],
  wraith:            [{ type: 'ectoplasm', chance: 0.35 }],
  vampire:           [{ type: 'fang',      chance: 0.35 }],
  lich:              [{ type: 'talisman',  chance: 0.35 }],
  // ── Tier 9 · Poison ──
  carrion_crawler:   [{ type: 'venom',     chance: 0.35 }],
  troll:             [{ type: 'organ',     chance: 0.40 }],
  otyugh:            [{ type: 'venom',     chance: 0.35 }],
  treant:            [{ type: 'herbal',    chance: 0.50 }],
  green_dragon:      [{ type: 'scale',     chance: 0.35 }],
  purple_worm:       [{ type: 'venom',     chance: 0.40 }],
  // ── Tier 10 · Mana / Arcane ──
  nothic:            [{ type: 'eye',       chance: 0.35 }],
  helmed_horror:     [{ type: 'core',      chance: 0.35 }],
  mind_flayer:       [{ type: 'brain',     chance: 0.35 }],
  githyanki:         [{ type: 'talisman',  chance: 0.35 }],
  beholder:          [{ type: 'eye',       chance: 0.40 }],
  rakshasa:          [{ type: 'finger',    chance: 0.35 }],
};

// The arrow element matching the current map. Region ids double as
// SWORD_ELEMENTS ids for every elemental region; forest (and anything
// unresolvable, e.g. caves) yields null → plain arrows.
function mapArrowElementId() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const region = (typeof REGIONS !== 'undefined' && cm && typeof cm.regionIdx === 'number')
    ? REGIONS[cm.regionIdx] : null;
  return (region && typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[region.id])
    ? region.id : null;
}

function rollEnemyTypeDrops(e) {
  const rx = Math.round(e.x), ry = Math.round(e.y);
  const drop = (extra) =>
    drops.push({ x: rx, y: ry, life: 10000, bob: 0, collected: false, ...extra });
  for (const d of (ENEMY_DROPS[e.type] || [])) {
    if (Math.random() < d.chance) drop({ type: d.type, val: 1 });
  }
  // Every projectile-shooting enemy can also drop a 5-pack of arrows matching
  // the map's element (plain in the elementless forest).
  if (e.ranged && Math.random() < 0.50) {
    drop({ type: 'arrows', val: 5, element: mapArrowElementId() });
  }
}

// ─── Kill enemy ───────────────────────────────────────────────────────────────
function killEnemy(e) {
  e.dead = true;
  const sp = screenPX(e.x, e.y);
  spawnParticle(sp.x, sp.y, e.color, 14, 5);
  spawnParticle(sp.x, sp.y, '#ffcc00', 6, 3);

  // Region context drives a couple of drop tweaks: fire-region hearts roll
  // bigger (1d6 vs 1d4), and the boss rupee payout scales with the region tier.
  const cm = currentMap();
  const region = (typeof REGIONS !== 'undefined' && cm && typeof cm.regionIdx === 'number')
    ? REGIONS[cm.regionIdx] : null;
  const inFire = !!region && region.id === 'fire';

  gainXP(e.xp);   // XP is awarded on every kill, unchanged.

  if (e.boss) {
    // Boss payout: 100 rupees per region in progression order (forest=1,
    // fire=2, …), plus a guaranteed 6-HP heart. Type-specific loot rolls are
    // for rank-and-file enemies only.
    const regionOrder = (cm && typeof cm.regionIdx === 'number') ? cm.regionIdx + 1 : 1;
    addItem('rupees', 100 * regionOrder);
    drops.push({
      type: 'hp', val: 6,
      x: Math.round(e.x), y: Math.round(e.y),
      life: 10000, bob: 0, collected: false
    });
  } else {
    // Rupees now drop on only 30% of (non-boss) kills.
    if (Math.random() < 0.30) addItem('rupees', Math.floor(e.maxHp * 0.1) + 1);
    // 40% chance to drop an HP heart — 1d6 in the fire region, 1d4 elsewhere.
    if (Math.random() < 0.40) {
      drops.push({
        type: 'hp',
        val: 1 + Math.floor(Math.random() * (inFire ? 6 : 4)),
        x: Math.round(e.x), y: Math.round(e.y),
        life: 10000, bob: 0, collected: false
      });
    }
    rollEnemyTypeDrops(e);
  }
  if (e.boss) {
    // Boss kills no longer grant +6 maxHp / a random elemental sword — those
    // rewards were removed by request. The flag is still set so saves / future
    // progression checks can tell a boss has been cleared.
    player.defeatedBoss = true;
    showMsg(`🏆 THE ${e.name} IS DEFEATED!`, 0);
  } else {
    showMsg(`⚔️ ${e.name} defeated! +${e.xp} XP`, 1500);
  }
  // Clearing a whirlpool grotto surfaces its sunken treasure: a large chest
  // rises west of the arena's heart, mirroring the exit vortex to the east.
  if (cm && cm.type === 'whirlpool_grotto' && !cm.grottoChestPlaced &&
      enemies.every(en => en.dead)) {
    cm.grottoChestPlaced = true;
    const gm = cm.map;
    const ccx = Math.floor(MCOLS / 2) - 15;
    let ccy = Math.floor(MROWS / 2);
    // Chests are solid — nudge down a row if the hero is floating right there.
    if (player.y === ccy && (player.x === ccx || player.x === ccx + 1)) ccy++;
    gm[ccy][ccx] = T.LARGE_CHEST;
    gm[ccy][ccx + 1] = T.LARGE_CHEST_R;
    minimapDirty = true;
    const csp = screenPX(ccx, ccy);
    spawnParticle(csp.x, csp.y, '#ffdd00', 18, 5);
    spawnParticle(csp.x, csp.y, '#bfe6f4', 12, 3);
    showMapMsg('💰 The waters calm — a sunken chest surfaces!');
  }
  // Clearing the village wakes it up into an active town.
  if (cm && cm.type === 'village' && !cm.activated && enemies.every(en => en.dead)) {
    if (activateVillage(cm)) {
      minimapDirty = true;
      spawnVillagersForMap(currentMapId);
      // Seal the cleared region with dead-ends. If a next region exists, the
      // village's own exits stay open so they can connect into it as the player
      // walks out — otherwise the final village's exits get sealed too.
      const clearedRegionIdx = (typeof cm.regionIdx === 'number') ? cm.regionIdx : 0;
      sealRegion(clearedRegionIdx);
      // Advance the world's notion of "current region" so any UI / spawn logic
      // checking it sees the new region the player is about to walk into.
      const nextIdx = clearedRegionIdx + 1;
      if (nextIdx < REGIONS.length) {
        currentRegionIdx = nextIdx;
        const nextRegion = REGIONS[nextIdx];
        showMapMsg(`🏘️ The village awakens! Beyond its gates: the ${nextRegion.id} region.`);
      } else {
        showMapMsg('🏘️ The village awakens! You have conquered every elemental region.');
      }
    }
  }
}

// ─── Map transition (walking out an exit) ─────────────────────────────────────
function tryTransition() {
  if (transitionCooldown > 0) return;
  // Trigger when player steps onto an actual border tile
  let dir = null;
  if (player.x === 0)               dir = 'left';
  else if (player.x === MCOLS - 1)  dir = 'right';
  else if (player.y === 0)          dir = 'up';
  else if (player.y === MROWS - 1)  dir = 'down';
  if (!dir) return;

  // Village is sealed: no exits while any enemy is still standing.
  if (currentMap().type === 'village' && enemies.some(e => !e.dead)) {
    showMapMsg('🔒 The village gates are sealed! Defeat every enemy here first.');
    transitionCooldown = 600;   // throttle the message
    return;
  }

  // Snapshot the current map's enemy + villager state before leaving
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);

  const nextId = getOrCreateNeighbor(dir);
  if (nextId == null) return;

  currentMapId = nextId;
  const nm = worldMaps[nextId];

  if (!nm.visited) {
    nm.visited = true;
    mapsVisited++;
    mapSequence.push(nextId);
    // Count overworld maps per region. After 20 the next new neighbor in the
    // region becomes its village (see createOverworldMap). Villages and dead-end
    // sealed maps don't count — only fresh overworld entries.
    const isOverworld = (nm.type !== 'village' && nm.type !== 'house' &&
                         nm.type !== 'cave' && !nm.sealed &&
                         typeof nm.regionIdx === 'number');
    if (isOverworld) {
      regionMapsVisited[nm.regionIdx] = (regionMapsVisited[nm.regionIdx] || 0) + 1;
      // Legacy mirror for the fire region (kept so older save logic doesn't
      // notice the rename).
      if (nm.regionIdx === 1) desertsVisited = regionMapsVisited[1];
    }
  }
  spawnEnemiesForMap(nextId);
  spawnVillagersForMap(nextId);

  // Place player just inside the opposite edge, preserving lateral position
  if (dir === 'left')        player.x = MCOLS - 2;
  else if (dir === 'right')  player.x = 1;
  else if (dir === 'up')     player.y = MROWS - 2;
  else                       player.y = 1;

  // If landing on a solid tile, scan laterally for a non-solid spot
  const map = mapData();
  if (isSolid(map, player.x, player.y)) {
    const lateral = (dir === 'left' || dir === 'right');
    for (let d = 1; d <= 5; d++) {
      let placed = false;
      for (const sign of [1, -1]) {
        const ty = lateral ? player.y + d * sign : player.y;
        const tx = lateral ? player.x : player.x + d * sign;
        if (tx >= 0 && tx < MCOLS && ty >= 0 && ty < MROWS && !isSolid(map, tx, ty)) {
          player.x = tx; player.y = ty; placed = true; break;
        }
      }
      if (placed) break;
    }
  }
  // Still solid (e.g. the destination already existed as a sealed dead-end and we
  // walked in through one of its walled-off sides — its facing border is all
  // trees): spiral outward from the entry point for the nearest open tile so the
  // hero is never stranded inside a solid tile.
  if (isSolid(map, player.x, player.y)) {
    const sx = player.x, sy = player.y;
    outer:
    for (let radius = 1; radius <= 70; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;  // ring only
          const tx = sx + dx, ty = sy + dy;
          if (tx >= 0 && tx < MCOLS && ty >= 0 && ty < MROWS && !isSolid(map, tx, ty)) {
            player.x = tx; player.y = ty; break outer;
          }
        }
      }
    }
  }

  transitionCooldown = 400;
  minimapDirty = true;
  clampCam(true);   // snap on map transition (instant teleport)
  revealAround(nm, player.x, player.y, 12);
  // (Map-name announcements removed — the current area name still lives in the
  // HUD's roomName span. Notable map events use showMapMsg instead.)
}

// ─── Chest / shrine pickup ────────────────────────────────────────────────────
// Called when player steps onto a CHEST or SHRINE tile.
function handlePickup(bnx, bny, map) {
  if (map[bny][bnx] === T.CHEST && !currentMap().openedChests.has(`${bnx},${bny}`)) {
    currentMap().openedChests.add(`${bnx},${bny}`);
    const roll = Math.random();
    let reward;
    if (roll < 0.3) {
      addItem('rupees', 10 + Math.floor(Math.random() * 25));
      reward = '💎 Found Rupees!';
    } else if (roll < 0.55) {
      player.hp = player.maxHp;
      reward = '❤️ Full Hearts Restored!';
    } else if (roll < 0.75) {
      player.bowLevel++;
      reward = `🏹 Bow Lv${player.bowLevel}!`;
    } else if (roll < 0.9) {
      gainXP(300);
      reward = '📜 Ancient Scroll! +300 XP';
    } else {
      addItem('potions', 1);
      reward = `🧪 Health Potion! (now carrying ${player.potions}) — press P to drink`;
    }
    showMsg(reward, 3000);
    const sp = screenPX(bnx, bny);
    spawnParticle(sp.x, sp.y, '#ffcc00', 12, 4);
  }
  // Shrines are reusable — every step onto one restores full HP.
  if (map[bny][bnx] === T.SHRINE) {
    player.hp = player.maxHp;
    showMsg('🙏 Ancient Shrine — HP fully restored!', 2500);
    const sp = screenPX(bnx, bny);
    spawnParticle(sp.x, sp.y, '#aaffaa', 16, 4);
  }
  // Shop doors are now just walkable entrances — the actual interaction lives
  // on the innkeeper / shopkeeper inside the building (press SPACE next to
  // them). Stepping on the door is a no-op.
  // The Hero's Cache — one-time +2 Sword / +2 Armor pickup at the back of a
  // cave. The chest spans 2 horizontal tiles (LARGE_CHEST anchor + LARGE_CHEST_R
  // extension); stepping on either half resolves to the anchor (the left tile).
  {
    const tHere = map[bny][bnx];
    if (tHere === T.LARGE_CHEST || tHere === T.LARGE_CHEST_R) {
      const ax = tHere === T.LARGE_CHEST_R ? bnx - 1 : bnx;
      const ay = bny;
      if (!currentMap().openedChests.has(`big_${ax},${ay}`)) {
        currentMap().openedChests.add(`big_${ax},${ay}`);
        player.swordLevel += 2;
        player.armor      = (player.armor || 0) + 2;
        player.hp = player.maxHp;
        showMsg('⚔️🛡️ The Hero\'s Cache! +2 Sword and +2 Armor — fully healed!', 5000);
        const sp = screenPX(bnx, bny);
        spawnParticle(sp.x, sp.y, '#ffdd00', 24, 6);
        spawnParticle(sp.x, sp.y, '#ffffff', 16, 4);
      }
    }
  }

  // The King's Hoard — one-time epic reward at the boss arena. 2×2 chest with
  // BOSS_CHEST_TL as the anchor; the other three quadrants resolve back to TL.
  {
    const tHere = map[bny][bnx];
    if (tHere === T.BOSS_CHEST_TL || tHere === T.BOSS_CHEST_TR ||
        tHere === T.BOSS_CHEST_BL || tHere === T.BOSS_CHEST_BR) {
      const ax = (tHere === T.BOSS_CHEST_TR || tHere === T.BOSS_CHEST_BR) ? bnx - 1 : bnx;
      const ay = (tHere === T.BOSS_CHEST_BL || tHere === T.BOSS_CHEST_BR) ? bny - 1 : bny;
      if (!currentMap().openedChests.has(`boss_${ax},${ay}`)) {
        currentMap().openedChests.add(`boss_${ax},${ay}`);
        player.swordLevel += 3;
        player.armor      = (player.armor || 0) + 3;
        player.maxHp      = (player.maxHp || 6) + 4;
        player.hp         = player.maxHp;
        player.bowLevel   = (player.bowLevel || 1) + 2;
        addItem('rupees', 250);
        addItem('potions', 3);
        gainXP(1000);
        showMsg('👑 The King\'s Hoard! +3 Sword, +3 Armor, +4 Max HP, +2 Bow, 250 💎, 3 🧪, 1000 XP!', 7000);
        const sp = screenPX(ax, ay);
        spawnParticle(sp.x, sp.y, '#ff66ff', 40, 8);
        spawnParticle(sp.x, sp.y, '#ffdd33', 32, 6);
        spawnParticle(sp.x, sp.y, '#ffffff', 24, 5);
      }
    }
  }
}

// ─── Chest interaction (SPACE) ────────────────────────────────────────────────
// Chests are solid, so they're opened deliberately: stand next to one and press
// SPACE. Checks the tile the player faces first (swordDir), then the four
// neighbours. Any tile of a multi-tile chest works — handlePickup resolves it to
// the chest's anchor. Returns true only if a closed chest was actually opened,
// so the caller can swallow the keypress (and otherwise let SPACE swing).
function tryChestInteraction() {
  const map = mapData();
  const cm = currentMap();
  const dirs = [];
  if (player.swordDir && (player.swordDir.x || player.swordDir.y)) {
    dirs.push([player.swordDir.x, player.swordDir.y]);
  }
  dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  for (const [dx, dy] of dirs) {
    const c = player.x + dx, r = player.y + dy;
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) continue;
    if (!isChestTile(map[r][c])) continue;
    const before = cm.openedChests.size;
    handlePickup(c, r, map);
    if (cm.openedChests.size > before) return true;   // a closed chest just opened
  }
  return false;
}

// The `openedChests` key for a chest tile at (c, r) — mirrors handlePickup so we
// can tell whether a chest is still closed without opening it. Returns null for
// non-chest tiles. (Shrines are stepped-on, not SPACE-interacted, so excluded.)
function chestOpenedKey(t, c, r) {
  if (t === T.CHEST) return `${c},${r}`;
  if (t === T.LARGE_CHEST || t === T.LARGE_CHEST_R) {
    const ax = t === T.LARGE_CHEST_R ? c - 1 : c;
    return `big_${ax},${r}`;
  }
  if (t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_TR ||
      t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR) {
    const ax = (t === T.BOSS_CHEST_TR || t === T.BOSS_CHEST_BR) ? c - 1 : c;
    const ay = (t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR) ? r - 1 : r;
    return `boss_${ax},${ay}`;
  }
  return null;
}

// Non-destructive probe for "can SPACE interact right now?" — returns a short
// HUD label (icon + [Space]) describing the available interaction, or null when
// SPACE would just swing the sword. Mirrors the SPACE handler in main.js:
// villager/shop talk in an activated village, else an adjacent closed chest.
function interactionHint() {
  const cm = currentMap();
  if (!cm) return null;

  // 1. Talk to / shop with an adjacent villager in an activated village.
  if (cm.type === 'village' && cm.activated &&
      typeof villagers !== 'undefined' && villagers && villagers.length) {
    const near = villagers
      .filter(v => Math.abs(v.x - player.x) <= 1 && Math.abs(v.y - player.y) <= 1)
      .sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0))[0];
    if (near) {
      if (near.role === 'store') return '🛒 Shop [Space]';
      if (near.role === 'inn')   return '🛏️ Inn [Space]';
      if (near.role === 'herb')  return '🌿 Herbalist [Space]';
      return '💬 Talk [Space]';
    }
  }

  // 2. Open an adjacent closed chest (facing tile first, then orthogonal).
  const map = mapData();
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (player.swordDir && (player.swordDir.x || player.swordDir.y)) {
    dirs.unshift([player.swordDir.x, player.swordDir.y]);
  }
  for (const [dx, dy] of dirs) {
    const c = player.x + dx, r = player.y + dy;
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) continue;
    const t = map[r][c];
    if (!isChestTile(t)) continue;
    const key = chestOpenedKey(t, c, r);
    if (key && !cm.openedChests.has(key)) return '📦 Open [Space]';
  }
  return null;
}

// Handle tile-based teleports (cave tunnel + cave exit). Called once per
// successful movement step. Returns true if a teleport happened.
function tryCaveTransition() {
  if (transitionCooldown > 0) return false;
  const map = mapData();
  const t = map[player.y][player.x];
  const cm = currentMap();

  // Step onto a tunnel in the overworld → drop into a hidden cave chain — the
  // same universal cave system reached behind a waterfall. Length is rolled 1d6
  // on first entry; caveLinks keys the chain to the tunnel tile so re-entering
  // the same bombed rock returns to the same caves. (Legacy single-cave maps in
  // old saves keep working via their own CAVE_EXIT handling below.)
  if (t === T.CAVE_ENTRANCE && cm.type !== 'cave' && cm.type !== 'cave_chain') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let caveId = cm.caveLinks[key];
    if (caveId == null) {
      const tier = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
        ? REGIONS[cm.regionIdx].enemyTier : 0;
      caveId = createCaveChainMap(sourceId, sourceX, sourceY, tier, 1, rnd(1, 6));
      cm.caveLinks[key] = caveId;
    }
    currentMapId = caveId;
    { const land = worldMaps[caveId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(caveId);
    spawnVillagersForMap(caveId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ You squeeze into a hidden cave…');
    return true;
  }

  // Step into the glowing doorway behind a waterfall → drop into a hidden cave
  // chain whose length is rolled 1d6 on first entry. caveLinks keys the chain to
  // the door tile so re-entering the same falls returns to the same caves.
  if (t === T.WATERFALL_DOOR && cm.type !== 'cave_chain') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let caveId = cm.caveLinks[key];
    if (caveId == null) {
      const tier = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
        ? REGIONS[cm.regionIdx].enemyTier : 0;
      caveId = createCaveChainMap(sourceId, sourceX, sourceY, tier, 1, rnd(1, 6));
      cm.caveLinks[key] = caveId;
    }
    currentMapId = caveId;
    { const land = worldMaps[caveId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(caveId);
    spawnVillagersForMap(caveId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ Behind the falls — a hidden passage!');
    return true;
  }

  // Step onto a descent inside a cave chain → go one level deeper (building the
  // next level on first visit). Each descent links back to itself for the climb.
  if (t === T.CAVE_DESCENT && cm.type === 'cave_chain') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let nextId = cm.caveLinks[key];
    if (nextId == null) {
      nextId = createCaveChainMap(sourceId, sourceX, sourceY,
                                  cm.sourceTier, cm.chainDepth + 1, cm.chainLen);
      cm.caveLinks[key] = nextId;
    }
    currentMapId = nextId;
    { const land = worldMaps[nextId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(nextId);
    spawnVillagersForMap(nextId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ You descend deeper into the cave…');
    return true;
  }

  // Step onto the cave exit → return to source map at the tunnel tile
  if (t === T.CAVE_EXIT && (cm.type === 'cave' || cm.type === 'cave_chain')) {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    const dest = worldMaps[currentMapId];
    const srcMap = dest.map;
    let tx, ty;
    // The chain-aware landings apply ONLY when *this* map is a chain level.
    // A legacy cache cave (cm.type === 'cave') — even one bombed open inside a
    // chain level — must always return to its own entrance tile (returnX/Y),
    // never to the chain's descent.
    if (cm.type === 'cave_chain' && dest.type === 'cave_chain' && dest.deeperLand) {
      // Climbing back up a chain: stand beside the descent we came down through.
      tx = dest.deeperLand.x; ty = dest.deeperLand.y;
    } else if (cm.type === 'cave_chain' &&
               srcMap[cm.returnY] && srcMap[cm.returnY][cm.returnX] === T.WATERFALL_DOOR) {
      // Surfacing behind a waterfall: land back on the door itself — the splash
      // pool around it is medium water, so there's no dry tile to step onto.
      tx = cm.returnX; ty = cm.returnY;
    } else {
      // Legacy cache cave / any tunnel: one tile south of the mouth, else nearest open.
      tx = cm.returnX;
      ty = Math.min(MROWS - 2, cm.returnY + 1);
      if (isSolid(srcMap, tx, ty)) {
        const candidates = [
          [0,  1], [1,  0], [-1, 0], [0, -1],
          [1,  1], [-1, 1], [1, -1], [-1, -1],
          [0,  2], [2,  0], [-2, 0], [0, -2]
        ];
        for (const [dx, dy] of candidates) {
          const cx2 = cm.returnX + dx, cy2 = cm.returnY + dy;
          if (cx2 >= 0 && cx2 < MCOLS && cy2 >= 0 && cy2 < MROWS && !isSolid(srcMap, cx2, cy2)) {
            tx = cx2; ty = cy2; break;
          }
        }
      }
    }
    player.x = tx; player.y = ty;
    spawnEnemiesForMap(currentMapId);
    spawnVillagersForMap(currentMapId);
    transitionCooldown = 600;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 12);
    showMapMsg('🕳️ You emerge back from the cave.');
    return true;
  }
  return false;
}

// ─── Player movement step ─────────────────────────────────────────────────────
// Called from update(); reads `keys` and steps once per MOVE_MS.
function stepPlayerMovement() {
  if (whirlpoolChurnMs > 0) return;   // caught in the vortex — can't swim free
  let mx = 0, my = 0;
  if      (keys['ArrowLeft']  || keys['a'] || keys['A']) mx = -1;
  else if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
  if      (keys['ArrowUp']    || keys['w'] || keys['W']) my = -1;
  else if (keys['ArrowDown']  || keys['s'] || keys['S']) my = 1;
  const map = mapData();
  if (mx || my) {
    // Remember the live walking input for the ice slide below.
    lastWalkInput.mx = mx; lastWalkInput.my = my; lastWalkInput.t = Date.now();
  } else {
    // Slippery ice: standing on an ICE sheet keeps the released walk input
    // active for an extra ICE_SLIDE_MS, so the hero keeps gliding for a couple
    // of beats after you let go instead of halting on a dime.
    if (map[player.y][player.x] === T.ICE && lastWalkInput.t >= 0 &&
        Date.now() - lastWalkInput.t <= ICE_SLIDE_MS) {
      mx = lastWalkInput.mx; my = lastWalkInput.my;
    }
    if (!mx && !my) return;
  }
  // Trudging through a sand DUNE (fire region), a SNOW_DRIFT (ice region), a
  // MUD clump (earth region), or a boggy BOG mire (poison region) halves walk
  // speed; swimming through MEDIUM_WATER is slower still — 40% of normal pace
  // (interval × 2.5). The step gate stretches to match while standing on one.
  const standTile = map[player.y][player.x];
  const stepMs = standTile === T.DUNE         ? MOVE_MS * 2
               : standTile === T.SNOW_DRIFT   ? MOVE_MS * 2
               : standTile === T.MUD          ? MOVE_MS * 2
               : standTile === T.BOG          ? MOVE_MS * 2
               : standTile === T.MEDIUM_WATER ? MOVE_MS * 2.5
               : MOVE_MS;
  if (moveTimer < stepMs) return;

  moveTimer = 0;
  if (!keys['Shift']) {
    if (mx) player.swordDir = { x: mx, y: 0 };
    if (my) player.swordDir = { x: 0, y: my };  // vertical wins when both pressed
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bnx = clamp(player.x + mx, 0, MCOLS - 1);
  const bny = clamp(player.y + my, 0, MROWS - 1);
  const enemyAt = (c, r) => enemies.some(e => !e.dead && e.x === c && e.y === r);
  // The Water armor lets the hero swim through MEDIUM_WATER (the shelf between
  // wadeable SHALLOW_WATER and impassable DEEP_WATER). Without it, that tile is
  // solid like normal. DEEP_WATER stays off-limits regardless.
  const canSwimMedium = player.activeArmorElement === 'water';
  const blocked = (c, r) => {
    if (enemyAt(c, r)) return true;
    if (canSwimMedium && map[r] && map[r][c] === T.MEDIUM_WATER) return false;
    return isSolid(map, c, r);
  };

  // Try diagonal first; if blocked, slide along whichever axis is clear.
  let tx = player.x, ty = player.y;
  if (mx && my) {
    if      (!blocked(bnx, bny))      { tx = bnx; ty = bny; }
    else if (!blocked(bnx, player.y)) { tx = bnx; }
    else if (!blocked(player.x, bny)) { ty = bny; }
  } else if (!blocked(bnx, bny)) {
    tx = bnx; ty = bny;
  }

  // Chests are solid — you can't stand on them. Opening is a deliberate action:
  // press SPACE while adjacent (see tryChestInteraction). handlePickup is still
  // called on the destination tile so step-on triggers (SHRINE) keep working.
  if (tx !== player.x || ty !== player.y) {
    handlePickup(tx, ty, map);
    // Climb/jump feedback: hop when mounting or leaving a CLIMB ramp lip, and
    // kick up sand while scrambling along the ramp.
    const wasClimb = map[player.y][player.x] === T.CLIMB;
    const nowClimb = map[ty][tx] === T.CLIMB;
    if (wasClimb !== nowClimb) playerJumpStart = Date.now();
    // Dive-in / haul-out feedback: the same hop when crossing the medium-water
    // boundary in either direction (Water armor swimming).
    const wasSwim = map[player.y][player.x] === T.MEDIUM_WATER;
    const nowSwim = map[ty][tx] === T.MEDIUM_WATER;
    if (wasSwim !== nowSwim) playerJumpStart = Date.now();
    if (nowClimb) {
      const sp = screenPX(tx, ty);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.35, '#caa46a', 4, 2);
    }
    // Splash a little water when wading into a SHALLOW_WATER tile. Spawn at the
    // player's smoothed render position (not the destination tile) so the splash
    // lands under the sprite rather than a tile ahead of it while walking.
    if (map[ty][tx] === T.SHALLOW_WATER) {
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#c8eef8', 5, 2);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#9fd6e8', 3, 2);
    } else if (map[ty][tx] === T.MEDIUM_WATER) {
      // Swimming (Water armor only) — a bigger, deeper splash than wading.
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#bfe6f4', 7, 2);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#5aa8c8', 4, 2);
    } else if (wasSwim) {
      // Hauling out onto dry land — water sheds off the hero behind the hop.
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#bfe6f4', 5, 2);
    }
    player.x = tx; player.y = ty;
  }
  clampCam();
  revealAround(currentMap(), player.x, player.y, 12);
  if (!tryPortalInteraction() && !tryCaveTransition()) tryTransition();
}

// ─── Whirlpool suction ────────────────────────────────────────────────────────
// Whirlpools actively grab swimmers: getting within 1 tile (Chebyshev) of one
// drags the hero to its eye, churns them under for a moment (movement locked,
// 2 damage), then spits them out a few tiles away. A short cooldown after the
// throw keeps the vortex from chaining grabs back-to-back.
let whirlpoolChurnMs = 0;        // >0 while caught — stepPlayerMovement is locked
let whirlpoolCooldown = 0;       // re-grab lockout after being spat out
let whirlpoolSprayAcc = 0;       // spray-particle drip timer while churning
const WHIRLPOOL_CHURN_MS  = 750;
const WHIRLPOOL_REGRAB_MS = 1500;

function stepWhirlpoolPull(dt) {
  const map = mapData();
  if (whirlpoolCooldown > 0) whirlpoolCooldown -= dt;

  // Mid-churn: spin spray off the vortex, then throw the hero clear. If the
  // player is no longer on a whirlpool (map load / teleport), cancel cleanly.
  if (whirlpoolChurnMs > 0) {
    if (map[player.y][player.x] !== T.WHIRLPOOL) { whirlpoolChurnMs = 0; return; }
    whirlpoolChurnMs -= dt;
    whirlpoolSprayAcc += dt;
    if (whirlpoolSprayAcc > 90) {
      whirlpoolSprayAcc = 0;
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y, '#eaf4ff', 3, 3);
      spawnParticle(sp.x, sp.y, '#3f79ad', 2, 2);
    }
    if (whirlpoolChurnMs <= 0) resolveWhirlpoolDive();
    return;
  }
  if (whirlpoolCooldown > 0) return;

  // Grab check — any whirlpool within 1 tile of the player?
  let wx = -1, wy = -1;
  for (let dr = -1; dr <= 1 && wx < 0; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = player.x + dc, r = player.y + dr;
      if (r >= 0 && r < MROWS && c >= 0 && c < MCOLS &&
          map[r][c] === T.WHIRLPOOL) { wx = c; wy = r; break; }
    }
  }
  if (wx < 0) return;

  // Caught — drag to the eye (the render lerp animates the pull) and churn.
  player.x = wx; player.y = wy;
  playerJumpStart = Date.now();
  whirlpoolChurnMs = WHIRLPOOL_CHURN_MS;
  clampCam();
  const sp = screenPX(wx, wy);
  spawnParticle(sp.x, sp.y, '#eaf4ff', 14, 4);
  spawnParticle(sp.x, sp.y, '#2c5d8e', 10, 3);
  showMsg('🌀 The whirlpool drags you under!', 2000);
  if (player.invincible <= 0) {
    damagePlayer(2, null);
    player.invincible = 900;
    if (player.hp <= 0) { whirlpoolChurnMs = 0; respawn(); }
  }
}

// Churn finished — the vortex swallows the hero. A whirlpool on a normal map
// dives down into its flooded grotto (created on first visit, then reused);
// the grotto's own vortex returns to the map that swallowed the player,
// surfacing them beside the original whirlpool.
function resolveWhirlpoolDive() {
  const cm = currentMap();
  if (cm.type === 'whirlpool_grotto') exitWhirlpoolGrotto(cm);
  else enterWhirlpoolGrotto(cm);
}

function enterWhirlpoolGrotto(cm) {
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);
  const wx = player.x, wy = player.y;        // the vortex tile we're on
  cm.grottoLinks = cm.grottoLinks || {};
  const key = `${wx},${wy}`;
  let gid = cm.grottoLinks[key];
  if (gid == null) {
    const tier = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
      ? REGIONS[cm.regionIdx].enemyTier : 0;
    gid = createWhirlpoolGrottoMap(currentMapId, wx, wy, tier);
    cm.grottoLinks[key] = gid;
  }
  currentMapId = gid;
  player.x = Math.floor(MCOLS / 2);
  player.y = Math.floor(MROWS / 2);
  spawnEnemiesForMap(gid);
  spawnVillagersForMap(gid);
  transitionCooldown = 400;
  whirlpoolCooldown = WHIRLPOOL_REGRAB_MS;
  minimapDirty = true;
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 16);
  showMapMsg('🌀 The vortex drags you down into a flooded grotto!');
}

function exitWhirlpoolGrotto(cm) {
  saveEnemyStateToMap(currentMapId);    // dead swimmers stay dead on re-entry
  saveVillagersToMap(currentMapId);
  currentMapId = cm.returnMapId;
  player.x = cm.returnX; player.y = cm.returnY;
  spawnEnemiesForMap(currentMapId);
  spawnVillagersForMap(currentMapId);
  // Scatter off the vortex into nearby open water (also arms the re-grab
  // cooldown so the whirlpool can't swallow the hero straight back).
  ejectFromWhirlpool(mapData());
  transitionCooldown = 600;
  minimapDirty = true;
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 12);
  showMapMsg('🌊 The whirlpool spits you back out!');
}

// Throw the hero out to open water 2–3 tiles from the vortex — past the pull
// ring, so they aren't grabbed straight back. If no medium-water tile exists
// out there (hemmed in by deep water), leave them treading on the vortex; the
// re-grab cooldown gives them time to swim clear.
function ejectFromWhirlpool(map) {
  const exits = [];
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) < 2) continue;
      const c = player.x + dc, r = player.y + dr;
      if (r > 0 && r < MROWS - 1 && c > 0 && c < MCOLS - 1 &&
          map[r][c] === T.MEDIUM_WATER) exits.push({ c, r });
    }
  }
  if (exits.length) {
    const out = exits[Math.floor(Math.random() * exits.length)];
    player.x = out.c; player.y = out.r;
  }
  playerJumpStart = Date.now();
  whirlpoolCooldown = WHIRLPOOL_REGRAB_MS;
  clampCam();
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#bfe6f4', 8, 3);
  spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#5aa8c8', 5, 2);
}

// Stepping onto the cabin's PORTAL tile opens the destination-select modal.
// Movement is paused via portalOpen while the modal is up.
function tryPortalInteraction() {
  if (transitionCooldown > 0) return false;
  const map = mapData();
  const t = map[player.y][player.x];
  if (t !== T.PORTAL) return false;
  if (typeof openPortalModal !== 'function') return false;
  if (typeof portalOpen !== 'undefined' && portalOpen) return true;
  openPortalModal();
  return true;
}
