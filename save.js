// ─── Save / load: named slot system ───────────────────────────────────────────
// Stores each save under `hyrule_quest_slot_N` in localStorage, plus a
// metadata index (`hyrule_quest_index`) with slot names and timestamps.

const SAVE_KEY_PREFIX = 'hyrule_quest_slot_';
const MAX_SLOTS = 6;

let modalMode = null;        // 'save' | 'load'
let pendingSlot = null;      // slot index currently being named

function getSaveIndex() {
  const raw = localStorage.getItem('hyrule_quest_index');
  return raw ? JSON.parse(raw) : {};
}
function setSaveIndex(idx) {
  localStorage.setItem('hyrule_quest_index', JSON.stringify(idx));
}

// Serialize everything needed to restore the world.
// Map tiles are Base64-encoded for compactness. Only visited maps get full
// tile serialization — unvisited maps regenerate fresh on load.
function buildSaveData() {
  saveEnemyStateToMap(currentMapId);   // capture live enemies before serializing
  return {
    player,
    currentMapId,
    mapsVisited,
    desertsVisited,
    currentRegionIdx,
    regionMapsVisited,
    mapSequence,
    worldGrid,
    worldMapsLite: worldMaps.map(m => ({
      id: m.id, gx: m.gx, gy: m.gy,
      name: m.name, type: m.type, biome: m.biome, regionIdx: m.regionIdx, depth: m.depth,
      openedChests: Array.from(m.openedChests),
      visited: m.visited,
      savedEnemies: m.savedEnemies || null,
      savedVillagers: m.savedVillagers || null,
      fog: m.fog ? Array.from(m.fog) : null,
      mapTiles: m.visited ? encodeMap(m.map) : null,
      // Cave linkage — only set for caves and source maps that opened one.
      returnMapId: m.returnMapId,
      returnX: m.returnX,
      returnY: m.returnY,
      caveLinks: m.caveLinks ? { ...m.caveLinks } : undefined,
      // Waterfall cave-chain state (set on cave_chain maps).
      sourceTier: m.sourceTier,
      chainDepth: m.chainDepth,
      chainLen: m.chainLen,
      entryLand: m.entryLand,
      deeperLand: m.deeperLand,
      // Whirlpool grotto linkage — set on source maps that opened a grotto,
      // plus the cleared-chest flag on the grotto itself.
      grottoLinks: m.grottoLinks ? { ...m.grottoLinks } : undefined,
      grottoChestPlaced: m.grottoChestPlaced || undefined,
      // Village activation state
      activated: m.activated || false,
      innDoor: m.innDoor || undefined,
      storeDoor: m.storeDoor || undefined,
      herbDoor: m.herbDoor || undefined,
      smithDoor: m.smithDoor || undefined
    }))
  };
}

// Authoritative default shape — any save missing a field falls back here.
const DEFAULT_PLAYER = {
  x: EXIT_COL, y: EXIT_ROW,
  renderX: EXIT_COL, renderY: EXIT_ROW,
  hp: 12, maxHp: 12, tempHp: 0,
  rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  invincible: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  potions: STARTING_ITEM_AMOUNT,
  medPotions: 0,
  herbals: STARTING_ITEM_AMOUNT,
  mushrooms: STARTING_ITEM_AMOUNT,
  // Trophy counters — seeded from the TROPHIES registry (config.js) via
  // trophyDefaults() (player.js), identical to the live player and newGame reset.
  ...trophyDefaults(),
  bonemeal: 0,
  snowballs: 0,
  // Raw ores (see ORE_TYPES) — rare 5% small-chest find, type set by region.
  grimsilver: 0, emberbrass: 0, glimmerspar: 0, wyrmgold: 0, eclipsium: 0,
  // Region Herbalist brews (objects keyed by region id) + active Elixir immunity.
  regionPotions: {}, elixirs: {},
  // Per-region Collector quests, keyed by region id (see openCollectorModal).
  collectorQuests: {},
  // Per-region "Find Timmy" quests, keyed by region id (see villagers.js).
  lostSonQuests: {},
  // Per-region Sword & Shield Guild quests, keyed by region id (see guild.js).
  guildQuests: {},
  // Sword & Shield Guild membership card (granted on first induction).
  guildCard: false,
  immunityElement: null, immunityTimer: 0,
  // swordElements / arrows are populated by applyStartingInventory() at boot
  // and on newGame, once SWORD_ELEMENTS has loaded.
  swordElements: [],
  activeSwordElement: null,
  swordUpgrades: {},
  arrows: {},
  activeArrowElement: null,
  armorElements: [],
  armorUpgrades: {},
  activeArmorElement: null,
  defeatedBoss: false
};

function applyLoadData(data) {
  // Apply defaults first, then overlay saved values. This ensures fields
  // missing from older saves (e.g. armor) reset to their default rather than
  // leaking the current in-memory value.
  Object.assign(player, DEFAULT_PLAYER, data.player);
  // Clone the object-valued brews so a save lacking them doesn't alias the shared
  // DEFAULT_PLAYER literals (which would leak mutations across loads).
  player.regionPotions = { ...((data.player && data.player.regionPotions) || {}) };
  player.elixirs = { ...((data.player && data.player.elixirs) || {}) };
  player.collectorQuests = { ...((data.player && data.player.collectorQuests) || {}) };
  player.lostSonQuests = { ...((data.player && data.player.lostSonQuests) || {}) };
  player.guildQuests = { ...((data.player && data.player.guildQuests) || {}) };
  player.armorUpgrades = { ...((data.player && data.player.armorUpgrades) || {}) };
  player.swordUpgrades = { ...((data.player && data.player.swordUpgrades) || {}) };
  // renderX/Y aren't meaningful values to load — they should match x/y after
  // an instant snap (clampCam(true) below will do the rest).
  player.renderX = player.x;
  player.renderY = player.y;
  currentMapId = data.currentMapId;
  mapsVisited = data.mapsVisited || 0;
  desertsVisited = data.desertsVisited || 0;
  currentRegionIdx = data.currentRegionIdx || 0;
  regionMapsVisited = data.regionMapsVisited || {};
  // Back-fill region counters for older saves so progression keeps working.
  for (let i = 0; i < REGIONS.length; i++) {
    if (regionMapsVisited[i] === undefined) regionMapsVisited[i] = 0;
  }
  if (desertsVisited && !regionMapsVisited[1]) regionMapsVisited[1] = desertsVisited;
  mapSequence = data.mapSequence || [];
  worldGrid = data.worldGrid || {};

  // Reset transient state so the player isn't stuck mid-animation
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  player.invincible = 0; player.swordTimer = 0;
  player.immunityTimer = 0; player.immunityElement = null;
  enemies = []; projectiles = []; particles = []; damageNumbers = []; drops = [];
  villagers = [];
  minimapCanvases = {}; minimapDirty = true;

  worldMaps = data.worldMapsLite.map(lite => {
    // Resolve which region this map belongs to. Newer saves include `regionIdx`
    // directly; older saves are biome-string-based and may use 'desert' for the
    // fire region.
    const biome = lite.biome === 'desert' ? 'fire' : lite.biome;
    const regionIdx = (typeof lite.regionIdx === 'number')
      ? lite.regionIdx
      : Math.max(0, REGIONS.findIndex(r => r.id === biome));
    const region = REGIONS[regionIdx] || REGIONS[0];

    const md = lite.mapTiles
      ? decodeMap(lite.mapTiles)
      : lite.type === 'village' ? buildVillageMap(region.id)
      : lite.type === 'cave'    ? buildCaveMap()
      : lite.type === 'cave_chain' ? buildCaveLevelMap((lite.chainDepth || 1) >= (lite.chainLen || 1)).map
      : lite.type === 'sky_cave' ? buildSkyCaveLevelMap((lite.chainDepth || 1) >= (lite.chainLen || 1), region).map
      : lite.type === 'whirlpool_grotto' ? buildWhirlpoolGrottoMap()
      : lite.type === 'house'   ? buildStarterHouseMap()
      : lite.type === 'forest'  ? buildForestMap(lite.id, lite.depth)
      : lite.type === 'fire' || lite.type === 'desert'
                                ? buildDesertMap(lite.id, lite.depth)
      :                            buildRegionMap(lite.id, lite.depth, undefined, region);

    // Villages share type 'village' but each region's boss differs, so build a
    // `<region>_village` discriminator for makeEnemyDefs. Sky caves are stocked
    // from their region's own roster, so they resolve to the plain region id (the
    // 'sky_cave' type isn't a spawn key makeEnemyDefs understands).
    const enemyType = (lite.type === 'village')
      ? `${region.id}_village`
      : (lite.type === 'sky_cave') ? region.id
      : lite.type;
    const obj = {
      id: lite.id, gx: lite.gx || 0, gy: lite.gy || 0,
      name: lite.name, type: lite.type, biome: region.id, regionIdx, depth: lite.depth,
      map: md, enemyDefs: makeEnemyDefs(lite.depth, enemyType, md),
      openedChests: new Set(lite.openedChests),
      visited: lite.visited,
      savedEnemies: lite.savedEnemies || null,
      savedVillagers: lite.savedVillagers || null
    };
    if (lite.fog) obj.fog = new Uint8Array(lite.fog);
    if (lite.returnMapId != null) {
      obj.returnMapId = lite.returnMapId;
      obj.returnX = lite.returnX;
      obj.returnY = lite.returnY;
    }
    if (lite.caveLinks) obj.caveLinks = { ...lite.caveLinks };
    if (lite.sourceTier != null) obj.sourceTier = lite.sourceTier;
    if (lite.chainDepth != null) obj.chainDepth = lite.chainDepth;
    if (lite.chainLen != null) obj.chainLen = lite.chainLen;
    if (lite.entryLand) obj.entryLand = lite.entryLand;
    if (lite.deeperLand) obj.deeperLand = lite.deeperLand;
    if (lite.grottoLinks) obj.grottoLinks = { ...lite.grottoLinks };
    if (lite.grottoChestPlaced) obj.grottoChestPlaced = true;
    if (lite.activated) obj.activated = true;
    if (lite.innDoor)   obj.innDoor   = { ...lite.innDoor };
    if (lite.storeDoor) obj.storeDoor = { ...lite.storeDoor };
    if (lite.herbDoor)  obj.herbDoor  = { ...lite.herbDoor };
    if (lite.smithDoor) obj.smithDoor = { ...lite.smithDoor };
    return obj;
  });

  // Older saves predate worldGrid — rebuild from gx/gy
  if (!data.worldGrid) {
    worldGrid = {};
    worldMaps.forEach(m => { worldGrid[gridKey(m.gx, m.gy)] = m.id; });
  }

  spawnEnemiesForMap(currentMapId);
  spawnVillagersForMap(currentMapId);
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 12);
  updateHUD();
}

// ─── Modal UI ─────────────────────────────────────────────────────────────────
function renderSlotList() {
  const idx = getSaveIndex();
  const list = document.getElementById('slot-list');
  const nameRow = document.getElementById('modal-name-row');
  const modeLabel = document.getElementById('modal-mode-label');
  list.innerHTML = '';
  nameRow.style.display = 'none';
  pendingSlot = null;

  modeLabel.textContent = modalMode === 'save'
    ? 'Choose a slot to save into, or create a new one.'
    : 'Choose a save to load.';

  for (let i = 0; i < MAX_SLOTS; i++) {
    const meta = idx[i];
    const div = document.createElement('div');
    div.className = 'save-slot' + (meta ? '' : ' empty');

    if (meta) {
      const nameSpan = document.createElement('div');
      nameSpan.className = 'save-slot-name';
      nameSpan.textContent = meta.saveName || `Save ${i + 1}`;

      const metaSpan = document.createElement('div');
      metaSpan.className = 'save-slot-meta';
      metaSpan.textContent = `Lv${meta.level} · Map ${meta.mapsVisited}/232 · ${meta.date}`;

      const btns = document.createElement('div');
      btns.className = 'save-slot-btns';

      if (modalMode === 'save') {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'ssbtn';
        saveBtn.textContent = '💾 Overwrite';
        saveBtn.onclick = () => startSlotSave(i, meta.saveName);
        btns.appendChild(saveBtn);
      } else {
        const loadBtn = document.createElement('button');
        loadBtn.className = 'ssbtn';
        loadBtn.textContent = '📂 Load';
        loadBtn.onclick = () => doLoad(i);
        btns.appendChild(loadBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'ssbtn danger';
      delBtn.textContent = '🗑';
      delBtn.onclick = (e) => { e.stopPropagation(); doDelete(i); };
      btns.appendChild(delBtn);

      div.appendChild(nameSpan);
      div.appendChild(metaSpan);
      div.appendChild(btns);
    } else {
      if (modalMode === 'save') {
        div.textContent = `＋ Empty Slot ${i + 1}`;
        div.onclick = () => startSlotSave(i, '');
      } else {
        div.textContent = `— Empty Slot ${i + 1}`;
      }
    }
    list.appendChild(div);
  }
}

function startSlotSave(slotIdx, existingName) {
  pendingSlot = slotIdx;
  const nameRow = document.getElementById('modal-name-row');
  const nameInput = document.getElementById('modal-name-input');
  nameInput.value = existingName || `Save ${slotIdx + 1}`;
  nameRow.style.display = 'flex';
  nameInput.focus();
  document.getElementById('modal-confirm-btn').onclick = () => doSave(slotIdx);
}

function doSave(slotIdx) {
  const nameInput = document.getElementById('modal-name-input');
  const saveName = nameInput.value.trim() || `Save ${slotIdx + 1}`;
  try {
    const data = buildSaveData();
    localStorage.setItem(SAVE_KEY_PREFIX + slotIdx, JSON.stringify(data));
    const idx = getSaveIndex();
    idx[slotIdx] = {
      saveName,
      level: player.level,
      mapsVisited,
      date: new Date().toLocaleDateString() + ' ' +
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSaveIndex(idx);
    document.getElementById('save-status').textContent = `✅ Saved to "${saveName}"`;
    closeModal();
  } catch (e) {
    document.getElementById('save-status').textContent = '❌ Save failed (storage full?)';
  }
}

function doLoad(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + slotIdx);
  if (!raw) return;
  const meta = getSaveIndex()[slotIdx];
  try {
    applyLoadData(JSON.parse(raw));
    // Dismiss the title screen if this load was launched from it (no-op mid-game).
    if (typeof startGame === 'function') startGame();
    document.getElementById('save-status').textContent =
      `✅ Loaded "${meta?.saveName || 'Save ' + (slotIdx+1)}"`;
    showMsg(`📂 Loaded: ${currentMap().name}`, 2500);
    closeModal();
  } catch (e) {
    document.getElementById('save-status').textContent = '❌ Load failed';
  }
}

function doDelete(slotIdx) {
  const idx = getSaveIndex();
  const name = idx[slotIdx]?.saveName || `Slot ${slotIdx + 1}`;
  if (!confirm(`Delete save "${name}"?`)) return;
  localStorage.removeItem(SAVE_KEY_PREFIX + slotIdx);
  delete idx[slotIdx];
  setSaveIndex(idx);
  renderSlotList();
}

function openSaveModal() {
  modalMode = 'save';
  document.getElementById('modal-title').textContent = '💾 Save Game';
  document.getElementById('save-modal-overlay').classList.add('open');
  renderSlotList();
}

function openLoadModal() {
  modalMode = 'load';
  document.getElementById('modal-title').textContent = '📂 Load Game';
  document.getElementById('save-modal-overlay').classList.add('open');
  renderSlotList();
}

function closeModal() {
  document.getElementById('save-modal-overlay').classList.remove('open');
  modalMode = null;
  pendingSlot = null;
}

// Click outside the modal closes it
document.getElementById('save-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('save-modal-overlay')) closeModal();
});

// Enter / Escape on the name input
document.getElementById('modal-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && pendingSlot !== null) doSave(pendingSlot);
  if (e.key === 'Escape') closeModal();
});

// ─── New game button ──────────────────────────────────────────────────────────
function newGame() {
  if (!confirm('Start a new game? Unsaved progress will be lost.')) return;
  Object.assign(player, {
    x: EXIT_COL, y: EXIT_ROW,
    hp: 12, maxHp: 12, tempHp: 0,
    rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
    swordTimer: 0, swordDir: { x: 0, y: -1 }, invincible: 0,
    weapon: 'sword', bowLevel: 1, swordLevel: 1, armor: 0,
    potions: STARTING_ITEM_AMOUNT, medPotions: 0, herbals: STARTING_ITEM_AMOUNT,
    mushrooms: STARTING_ITEM_AMOUNT,
    ...trophyDefaults(),
    bonemeal: 0,
    grimsilver: 0, emberbrass: 0, glimmerspar: 0, wyrmgold: 0, eclipsium: 0,
    regionPotions: {}, elixirs: {}, collectorQuests: {}, lostSonQuests: {}, guildQuests: {},
    guildCard: false,
    immunityElement: null, immunityTimer: 0,
    swordElements: [], activeSwordElement: null, swordUpgrades: {},
    arrows: {}, activeArrowElement: null,
    armorElements: [], armorUpgrades: {}, activeArmorElement: null,
    defeatedBoss: false
  });
  applyStartingInventory(player);
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  enemies = []; projectiles = []; particles = []; damageNumbers = [];
  villagers = [];
  minimapCanvases = {}; minimapDirty = true;

  initWorld();
  revealAround(currentMap(), player.x, player.y, 12);
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  clampCam(true);
  updateHUD();
  document.getElementById('save-status').textContent = '';
  showMapMsg('🛏️ You awaken in your cabin. Step outside to begin your adventure.');
}
