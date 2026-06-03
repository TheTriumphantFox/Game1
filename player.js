// ─── Player state and movement ────────────────────────────────────────────────

// Inventory cap shared by every stackable item (rupees, potions, herbals,
// trophies, and each entry in player.arrows). Starting amount given to a fresh
// player for every item (and every elemental arrow / sword). Stats like
// maxHp / swordLevel / bowLevel / armor are progression — not items — and are
// intentionally not capped here.
const ITEM_CAP = 128;
const STARTING_ITEM_AMOUNT = 64;

// Cap-respecting increment for a scalar inventory key. Returns the amount
// actually added (may be less than `n` when the cap clamps).
function addItem(key, n) {
  const before = player[key] || 0;
  player[key] = Math.min(ITEM_CAP, before + n);
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
  rupees: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  invincible: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  potions: STARTING_ITEM_AMOUNT,
  herbals: STARTING_ITEM_AMOUNT,
  mushrooms: STARTING_ITEM_AMOUNT,
  // Trophy / crafting collectibles dropped by specific enemies.
  fangs: STARTING_ITEM_AMOUNT, fingers: STARTING_ITEM_AMOUNT,
  bones: STARTING_ITEM_AMOUNT, wings: STARTING_ITEM_AMOUNT,
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

// Tick/cooldown state
let moveTimer = 0;
const MOVE_MS = 110;             // ms between movement steps (grid-based)
let attackCooldown = 0;
let bowCooldown = 0;
let bombCooldown = 0;
let transitionCooldown = 0;      // brief lockout after a map transition

// Input
let keys = {};

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
  player.x = EXIT_COL; player.y = Math.floor(MROWS / 2);
  player.rupees = Math.max(0, player.rupees - 10);  // small death penalty
  clampCam(true);
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  showMsg('💀 Defeated! Returned to start (-10 rupees)', 3000);
}

// ─── Per-enemy-type loot table ────────────────────────────────────────────────
// Each kill rolls its drops independently after the universal HP-heart roll.
// "arrows" drops carry an `element` id; the element is chosen at kill time so
// the player sees the icon/colour on the ground sprite.
function randomElementId() {
  if (typeof SWORD_ELEMENTS === 'undefined') return null;
  const ids = Object.keys(SWORD_ELEMENTS);
  return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
}
function rollEnemyTypeDrops(e) {
  const rx = Math.round(e.x), ry = Math.round(e.y);
  const drop = (extra) =>
    drops.push({ x: rx, y: ry, life: 10000, bob: 0, collected: false, ...extra });
  // All arrow drops are 5-packs. Plain bundles leave `element` null; elemental
  // bundles pick a random element at kill time so the ground sprite shows it.
  const dropPlainArrows    = () => drop({ type: 'arrows', val: 5, element: null });
  const dropElementalArrows = () => {
    const el = randomElementId();
    if (el) drop({ type: 'arrows', val: 5, element: el });
  };
  switch (e.type) {
    case 'wolf':
      if (Math.random() < 0.50) drop({ type: 'fang',   val: 1 });
      break;
    case 'goblin':
      if (Math.random() < 0.20) drop({ type: 'finger', val: 1 });
      break;
    case 'skeleton':
      if (Math.random() < 0.20) drop({ type: 'bone',   val: 1 });
      if (Math.random() < 0.50) dropPlainArrows();
      break;
    case 'dryad':
      if (Math.random() < 0.10) drop({ type: 'potion', val: 1 });
      break;
    case 'pixie':
      if (Math.random() < 0.05) drop({ type: 'wing',   val: 1 });
      if (Math.random() < 0.50) dropPlainArrows();
      if (Math.random() < 0.03) dropElementalArrows();
      break;
  }
}

// ─── Kill enemy ───────────────────────────────────────────────────────────────
function killEnemy(e) {
  e.dead = true;
  const sp = screenPX(e.x, e.y);
  spawnParticle(sp.x, sp.y, e.color, 14, 5);
  spawnParticle(sp.x, sp.y, '#ffcc00', 6, 3);
  addItem('rupees', Math.floor(e.maxHp * 0.1) + 1);
  gainXP(e.xp);
  // 40% chance to drop an HP heart (1d4)
  if (Math.random() < 0.40) {
    drops.push({
      type: 'hp',
      val: 1 + Math.floor(Math.random() * 4),  // 1..4
      x: Math.round(e.x), y: Math.round(e.y),
      life: 10000, bob: 0, collected: false
    });
  }
  rollEnemyTypeDrops(e);
  if (e.boss) {
    // Boss kills no longer grant +6 maxHp / a random elemental sword — those
    // rewards were removed by request. The flag is still set so saves / future
    // progression checks can tell a boss has been cleared.
    player.defeatedBoss = true;
    showMsg(`🏆 THE ${e.name} IS DEFEATED!`, 0);
  } else {
    showMsg(`⚔️ ${e.name} defeated! +${e.xp} XP`, 1500);
  }
  // Clearing the village wakes it up into an active town.
  const cm = currentMap();
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
  if (map[bny][bnx] === T.SHRINE && !currentMap().openedChests.has(`shrine_${bnx},${bny}`)) {
    currentMap().openedChests.add(`shrine_${bnx},${bny}`);
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

  // Step onto a tunnel in the overworld → enter (or re-enter) the linked cave
  if (t === T.CAVE_ENTRANCE && cm.type !== 'cave') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId;
    const sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let caveId = cm.caveLinks[key];
    if (caveId == null) {
      caveId = createCaveMap(sourceId, sourceX, sourceY);
      cm.caveLinks[key] = caveId;
    }
    currentMapId = caveId;
    const cx = Math.floor(MCOLS / 2);
    const cy = Math.floor(MROWS / 2);
    // Land one tile NORTH of the CAVE_EXIT so we don't immediately re-trigger it.
    player.x = cx; player.y = cy + 7;
    spawnEnemiesForMap(caveId);
    spawnVillagersForMap(caveId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ You squeeze into a hidden cave…');
    return true;
  }

  // Step onto the cave exit → return to source map at the tunnel tile
  if (t === T.CAVE_EXIT && cm.type === 'cave') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    const srcMap = worldMaps[currentMapId].map;
    // Prefer one tile south of the tunnel; if that's solid, scan adjacent
    // tiles for a non-solid spot (same idea as regular map transition).
    let tx = cm.returnX;
    let ty = Math.min(MROWS - 2, cm.returnY + 1);
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
  let mx = 0, my = 0;
  if      (keys['ArrowLeft']  || keys['a'] || keys['A']) mx = -1;
  else if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
  if      (keys['ArrowUp']    || keys['w'] || keys['W']) my = -1;
  else if (keys['ArrowDown']  || keys['s'] || keys['S']) my = 1;
  if (!mx && !my) return;
  if (moveTimer < MOVE_MS) return;

  moveTimer = 0;
  if (!keys['Shift']) {
    if (mx) player.swordDir = { x: mx, y: 0 };
    if (my) player.swordDir = { x: 0, y: my };  // vertical wins when both pressed
  }

  const map = mapData();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bnx = clamp(player.x + mx, 0, MCOLS - 1);
  const bny = clamp(player.y + my, 0, MROWS - 1);
  const enemyAt = (c, r) => enemies.some(e => !e.dead && e.x === c && e.y === r);
  const blocked = (c, r) => isSolid(map, c, r) || enemyAt(c, r);

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
    player.x = tx; player.y = ty;
  }
  clampCam();
  revealAround(currentMap(), player.x, player.y, 12);
  if (!tryCaveTransition()) tryTransition();
}
