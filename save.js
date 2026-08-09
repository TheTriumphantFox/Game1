// ─── Save / load: named slot system ───────────────────────────────────────────
// Stores each save under `the_rpg_game_slot_N` in localStorage, plus a
// metadata index (`the_rpg_game_index`) with slot names and timestamps.
// Saves written before the game was renamed live under a `hyrule_quest_`
// prefix; config.js copies them onto these keys on first load, so nothing here
// has to know about the old names.

const SAVE_KEY_PREFIX = 'the_rpg_game_slot_';
const MAX_SLOTS = 6;

let modalMode = null;        // 'save' | 'load'
let pendingSlot = null;      // slot index currently being named

function getSaveIndex() {
  const raw = localStorage.getItem('the_rpg_game_index');
  return raw ? JSON.parse(raw) : {};
}
function setSaveIndex(idx) {
  localStorage.setItem('the_rpg_game_index', JSON.stringify(idx));
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
    regionDungeonPlaced,
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
      // Overworld root-return target for the deep CHEST_EXIT portal (caves/dungeons).
      rootMapId: m.rootMapId,
      rootX: m.rootX,
      rootY: m.rootY,
      caveLinks: m.caveLinks ? { ...m.caveLinks } : undefined,
      // Waterfall cave-chain state (set on cave_chain maps).
      sourceTier: m.sourceTier,
      chainDepth: m.chainDepth,
      chainLen: m.chainLen,
      entryLand: m.entryLand,
      deeperLand: m.deeperLand,
      // Castle tower state — floor number (castle_tower maps) and the final
      // village's castle-gate side.
      floorIdx: m.floorIdx,
      castleExitDir: m.castleExitDir,
      // Sealed-shrine required element (set on the one overworld map per region
      // that hosts the shrine; used to tint the shrine + its clue runes).
      shrineElement: m.shrineElement,
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
  // Hero name — chosen on New Game (name prompt, main.js); labels save slots.
  heroName: '',
  // Lifetime death count — bumped in respawn() (player.js), shown on stats page.
  deaths: 0,
  x: EXIT_COL, y: EXIT_ROW,
  renderX: EXIT_COL, renderY: EXIT_ROW,
  hp: 12, maxHp: 12, tempHp: 0,
  rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  invincible: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  // Grandmother's Bow — granted in the prologue's final beat, not owned at birth.
  // Back-filled to true below for saves written before the field existed.
  hasBow: false,
  potions: STARTING_ITEM_AMOUNT,
  // Bombs — bought at the store / found in chests; a fresh player starts with none.
  bombs: 0,
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
  // Per-region Sealed Shrine quests, keyed by region id (see world.js).
  shrineQuests: {},
  // Per-region Taxidermist quests + earned trophy-drop bonuses (shop-herbalist.js).
  taxidermistQuests: {},
  trophyDropBonus: {},
  // Per-region Alchemist repeatable bulk orders (shop-herbalist.js).
  alchemistOrders: {},
  // Per-region escort quests (#7/8/9) + their earned rewards (villagers.js).
  caravanQuests: {}, apprenticeQuests: {}, gathererQuests: {},
  storeDiscounts: {}, smithFreeUpgrade: {}, forageBonus: {},
  // Completionist's Ledger milestone (#13).
  chronicleMilestone: 0,
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
  defeatedBoss: false,
  // True once the Adult Red Dragon at the castle pinnacle has been slain.
  wonGame: false,
  // Story flags — the single home for narrative state (see story.js).
  flags: {}
};

function applyLoadData(data) {
  // Apply defaults first, then overlay saved values. This ensures fields
  // missing from older saves (e.g. armor) reset to their default rather than
  // leaking the current in-memory value. sellableDefaults() zeroes the forage /
  // snowball / ore keys that aren't in DEFAULT_PLAYER so a save lacking them
  // (or an older one) can't inherit stale stock from the previous session.
  Object.assign(player, sellableDefaults(), DEFAULT_PLAYER, data.player);
  // Clone the object-valued brews so a save lacking them doesn't alias the shared
  // DEFAULT_PLAYER literals (which would leak mutations across loads).
  player.regionPotions = { ...((data.player && data.player.regionPotions) || {}) };
  // The Medium Health Potion was removed. Fold any leftover stock from an older save
  // into the fire region's Lesser Healing Potion (the closest surviving brew) so the
  // player doesn't silently lose owned potions, and drop the retired field.
  const legacyMed = (data.player && data.player.medPotions) || 0;
  if (legacyMed > 0) player.regionPotions.fire = (player.regionPotions.fire || 0) + legacyMed;
  delete player.medPotions;
  player.elixirs = { ...((data.player && data.player.elixirs) || {}) };
  player.collectorQuests = { ...((data.player && data.player.collectorQuests) || {}) };
  player.lostSonQuests = { ...((data.player && data.player.lostSonQuests) || {}) };
  player.guildQuests = { ...((data.player && data.player.guildQuests) || {}) };
  player.shrineQuests = { ...((data.player && data.player.shrineQuests) || {}) };
  player.taxidermistQuests = { ...((data.player && data.player.taxidermistQuests) || {}) };
  player.trophyDropBonus = { ...((data.player && data.player.trophyDropBonus) || {}) };
  player.alchemistOrders = { ...((data.player && data.player.alchemistOrders) || {}) };
  player.caravanQuests = { ...((data.player && data.player.caravanQuests) || {}) };
  player.apprenticeQuests = { ...((data.player && data.player.apprenticeQuests) || {}) };
  player.gathererQuests = { ...((data.player && data.player.gathererQuests) || {}) };
  player.storeDiscounts = { ...((data.player && data.player.storeDiscounts) || {}) };
  player.smithFreeUpgrade = { ...((data.player && data.player.smithFreeUpgrade) || {}) };
  player.forageBonus = { ...((data.player && data.player.forageBonus) || {}) };
  player.armorUpgrades = { ...((data.player && data.player.armorUpgrades) || {}) };
  player.swordUpgrades = { ...((data.player && data.player.swordUpgrades) || {}) };
  player.flags = { ...((data.player && data.player.flags) || {}) };
  // Saves predating the prologue have no `hasBow` field and no flags at all, but
  // their hero has been shooting arrows for hours. Test for *absence*, not false —
  // a save written after the prologue shipped legitimately stores hasBow: false
  // mid-prologue, and must not be handed a bow it hasn't earned yet.
  if (data.player && data.player.hasBow === undefined) player.hasBow = true;
  // renderX/Y aren't meaningful values to load — they should match x/y after
  // an instant snap (clampCam(true) below will do the rest).
  player.renderX = player.x;
  player.renderY = player.y;
  currentMapId = data.currentMapId;
  mapsVisited = data.mapsVisited || 0;
  desertsVisited = data.desertsVisited || 0;
  currentRegionIdx = data.currentRegionIdx || 0;
  regionMapsVisited = data.regionMapsVisited || {};
  regionDungeonPlaced = data.regionDungeonPlaced || {};
  // Back-fill region counters for older saves so progression keeps working.
  for (let i = 0; i < REGIONS.length; i++) {
    if (regionMapsVisited[i] === undefined) regionMapsVisited[i] = 0;
    if (regionDungeonPlaced[i] === undefined) regionDungeonPlaced[i] = false;
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
      : lite.type === 'castle_tower' ? buildTowerFloorMap(lite.floorIdx || 1).map
      : lite.type === 'dungeon' ? buildDungeonLevelMap().map
      : lite.type === 'whirlpool_grotto' ? buildWhirlpoolGrottoMap()
      : lite.type === 'house'   ? buildStarterHouseMap()
      // Map 0 since the prologue. In practice this branch is a safety net —
      // map 0 is always `visited`, so lite.mapTiles is present and decodeMap
      // above wins, which is what preserves the exact state the player left the
      // ruin in. It matters when tiles are somehow absent: rebuild the ruin, not
      // the village, or a finished prologue would reload with the family home
      // standing and everyone alive.
      : lite.type === 'homevillage'
          ? (hasFlag('prologue_complete') ? buildRuinedHomeVillage() : buildHomeVillageMap())
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
      : (lite.type === 'sky_cave' || lite.type === 'dungeon') ? region.id
      // Tower floors 1–13 restock like their floor-region's village (Greater
      // roster + boss); the pinnacle gets the full finale (all bosses + dragon).
      : (lite.type === 'castle_tower')
        ? `${REGIONS[Math.min(lite.floorIdx || 1, 13) - 1].id}_village`
      : lite.type;
    const obj = {
      id: lite.id, gx: lite.gx || 0, gy: lite.gy || 0,
      name: lite.name, type: lite.type, biome: region.id, regionIdx, depth: lite.depth,
      map: md,
      enemyDefs: (lite.type === 'castle_tower' && (lite.floorIdx || 1) >= 14)
        ? makeTowerFinaleDefs(md)
        : makeEnemyDefs(lite.depth, enemyType, md),
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
    if (lite.rootMapId != null) {
      obj.rootMapId = lite.rootMapId;
      obj.rootX = lite.rootX;
      obj.rootY = lite.rootY;
    }
    if (lite.caveLinks) obj.caveLinks = { ...lite.caveLinks };
    if (lite.sourceTier != null) obj.sourceTier = lite.sourceTier;
    if (lite.chainDepth != null) obj.chainDepth = lite.chainDepth;
    if (lite.chainLen != null) obj.chainLen = lite.chainLen;
    if (lite.entryLand) obj.entryLand = lite.entryLand;
    if (lite.deeperLand) obj.deeperLand = lite.deeperLand;
    if (lite.floorIdx != null) obj.floorIdx = lite.floorIdx;
    if (lite.castleExitDir) obj.castleExitDir = lite.castleExitDir;
    if (lite.shrineElement) obj.shrineElement = lite.shrineElement;
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

  // A truncated or hand-edited save can name a currentMapId that worldMapsLite
  // never supplied. Every frame calls currentMap() before anything else, so an
  // unresolvable id doesn't fail here — it throws in the render loop, one frame
  // after the load reports success. Fall back to map 0, which always exists.
  if (!worldMaps[currentMapId]) {
    currentMapId = 0;
    player.x = EXIT_COL; player.y = EXIT_ROW;
    player.renderX = player.x; player.renderY = player.y;
    showMsg('⚠️ Save pointed at a missing map — returned home.', 4000);
  }

  spawnEnemiesForMap(currentMapId);
  spawnVillagersForMap(currentMapId);
  // Cancel any cutscene the load interrupted and restore the ambient state that
  // isn't in the flag bag (how hard the ruin is still burning). Without this, a
  // load from inside a scripted beat leaves the world frozen forever.
  if (typeof restorePrologueAmbience === 'function') restorePrologueAmbience();
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 12);
  updateHUD();
}

// ─── Auto-save / death checkpoint ──────────────────────────────────────────────
// A single rolling autosave written at key checkpoints (clearing a village,
// each castle-tower floor). It lives under its own key so it never clobbers one
// of the 6 named slots. `lastCheckpoint` holds the most recent save payload of
// ANY kind — manual save, auto-save, or the save just loaded — and is what a
// death reload restores from.
const AUTOSAVE_KEY = 'the_rpg_game_autosave';
let lastCheckpoint = null;

function autoSave(label) {
  try {
    const json = JSON.stringify(buildSaveData());
    localStorage.setItem(AUTOSAVE_KEY, json);
    const idx = getSaveIndex();
    idx.auto = {
      saveName: label ? `Auto-save · ${label}` : 'Auto-save',
      heroName: player.heroName || '',
      level: player.level,
      mapsVisited,
      date: new Date().toLocaleDateString() + ' ' +
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSaveIndex(idx);
    lastCheckpoint = json;
    showMsg(label ? `💾 Auto-saved · ${label}` : '💾 Auto-saved', 1500);
  } catch (e) { /* storage full — skip the autosave silently */ }
}

// Restore the most recent checkpoint after death. Returns false if none exists
// yet (a fresh game that hasn't reached any save point), so the caller can fall
// back to the return-to-start behavior.
function reloadLastSave() {
  const json = lastCheckpoint || localStorage.getItem(AUTOSAVE_KEY);
  if (!json) return false;
  try { applyLoadData(JSON.parse(json)); return true; }
  catch (e) { return false; }
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

  // Auto-save (load mode only) — the rolling checkpoint written on village
  // clears and tower floors, shown above the manual slots so it can be resumed.
  if (modalMode === 'load' && idx.auto && localStorage.getItem(AUTOSAVE_KEY)) {
    const meta = idx.auto;
    const div = document.createElement('div');
    div.className = 'save-slot';

    const nameSpan = document.createElement('div');
    nameSpan.className = 'save-slot-name';
    nameSpan.textContent = '⏱ ' + (meta.saveName || 'Auto-save');

    const metaSpan = document.createElement('div');
    metaSpan.className = 'save-slot-meta';
    const hero = meta.heroName ? `🛡 ${meta.heroName} · ` : '';
    metaSpan.textContent = `${hero}Lv${meta.level} · Map ${meta.mapsVisited}/232 · ${meta.date}`;

    const btns = document.createElement('div');
    btns.className = 'save-slot-btns';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'ssbtn';
    loadBtn.textContent = '📂 Load';
    loadBtn.onclick = () => doLoadAuto();
    btns.appendChild(loadBtn);

    div.appendChild(nameSpan);
    div.appendChild(metaSpan);
    div.appendChild(btns);
    list.appendChild(div);
  }

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
      // Show the hero's name when the slot name doesn't already carry it.
      const hero = (meta.heroName && meta.heroName !== meta.saveName)
        ? `🛡 ${meta.heroName} · ` : '';
      metaSpan.textContent = `${hero}Lv${meta.level} · Map ${meta.mapsVisited}/232 · ${meta.date}`;

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

// Default slot name — the hero's name (chosen on New Game) so saves are
// identifiable per character; falls back to the old generic slot label.
function defaultSlotName(slotIdx) {
  return player.heroName || `Save ${slotIdx + 1}`;
}

function startSlotSave(slotIdx, existingName) {
  pendingSlot = slotIdx;
  const nameRow = document.getElementById('modal-name-row');
  const nameInput = document.getElementById('modal-name-input');
  nameInput.value = existingName || defaultSlotName(slotIdx);
  nameRow.style.display = 'flex';
  nameInput.focus();
  document.getElementById('modal-confirm-btn').onclick = () => doSave(slotIdx);
}

function doSave(slotIdx) {
  const nameInput = document.getElementById('modal-name-input');
  const saveName = nameInput.value.trim() || defaultSlotName(slotIdx);
  try {
    const json = JSON.stringify(buildSaveData());
    localStorage.setItem(SAVE_KEY_PREFIX + slotIdx, json);
    lastCheckpoint = json;   // a manual save is also a death-reload point
    const idx = getSaveIndex();
    idx[slotIdx] = {
      saveName,
      heroName: player.heroName || '',
      level: player.level,
      mapsVisited,
      date: new Date().toLocaleDateString() + ' ' +
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSaveIndex(idx);
    setSaveStatus(`✅ Saved to "${saveName}"`);
    closeModal();
  } catch (e) {
    setSaveStatus('❌ Save failed (storage full?)');
  }
}

function doLoad(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + slotIdx);
  if (!raw) return;
  const meta = getSaveIndex()[slotIdx];
  try {
    applyLoadData(JSON.parse(raw));
    lastCheckpoint = raw;   // dying right after loading returns to this same save
    // Dismiss the title screen if this load was launched from it (no-op mid-game).
    if (typeof startGame === 'function') startGame();
    setSaveStatus(`✅ Loaded "${meta?.saveName || 'Save ' + (slotIdx+1)}"`, { toast: false });
    showMsg(`📂 Loaded: ${currentMap().name}`, 2500);
    closeModal();
  } catch (e) {
    setSaveStatus('❌ Load failed');
  }
}

function doLoadAuto() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return;
  try {
    applyLoadData(JSON.parse(raw));
    lastCheckpoint = raw;
    if (typeof startGame === 'function') startGame();
    setSaveStatus('✅ Loaded auto-save', { toast: false });
    showMsg(`📂 Loaded: ${currentMap().name}`, 2500);
    closeModal();
  } catch (e) {
    setSaveStatus('❌ Load failed');
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

// Save/load feedback. This used to write into the save row's status span, with a
// toast as the touch-mode stand-in once that row was hidden there. The row is
// gone on every device now (its buttons live in the radial MENU ring), so the
// toast is the only channel left and always fires.
// `toast: false` for the paths that already raise their own.
function setSaveStatus(text, { toast = true } = {}) {
  if (toast && text && typeof showMsg === 'function') showMsg(text, 2500);
}

function openSaveModal() {
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  modalMode = 'save';
  document.getElementById('modal-title').textContent = '💾 Save Game';
  document.getElementById('save-modal-overlay').classList.add('open');
  renderSlotList();
}

function openLoadModal() {
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
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
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  if (!confirm('Start a new game? Unsaved progress will be lost.')) return;
  // Ask for the hero's name first — the world reset runs once a name is chosen
  // (cancelling the prompt leaves the current game untouched).
  openNamePrompt(name => resetGame(name));
}

function resetGame(heroName) {
  Object.assign(player, {
    // Zero every field-earned sellable first (forage goods, snowballs, all raw
    // ores) so late-region stock never survives into a fresh game. Explicit
    // fields below override any overlap. See sellableDefaults (shop-general.js).
    ...sellableDefaults(),
    heroName,
    deaths: 0,
    x: EXIT_COL, y: EXIT_ROW,
    hp: 12, maxHp: 12, tempHp: 0,
    rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
    swordTimer: 0, swordDir: { x: 0, y: -1 }, invincible: 0,
    weapon: 'sword', bowLevel: 1, swordLevel: 1, armor: 0,
    hasBow: false,
    potions: STARTING_ITEM_AMOUNT, bombs: 0, herbals: STARTING_ITEM_AMOUNT,
    mushrooms: STARTING_ITEM_AMOUNT,
    ...trophyDefaults(),
    bonemeal: 0,
    grimsilver: 0, emberbrass: 0, glimmerspar: 0, wyrmgold: 0, eclipsium: 0,
    regionPotions: {}, elixirs: {}, collectorQuests: {}, lostSonQuests: {}, guildQuests: {},
    shrineQuests: {}, taxidermistQuests: {}, trophyDropBonus: {}, alchemistOrders: {},
    caravanQuests: {}, apprenticeQuests: {}, gathererQuests: {},
    storeDiscounts: {}, smithFreeUpgrade: {}, forageBonus: {},
    chronicleMilestone: 0,
    guildCard: false,
    immunityElement: null, immunityTimer: 0,
    swordElements: [], activeSwordElement: null, swordUpgrades: {},
    arrows: {}, activeArrowElement: null,
    armorElements: [], armorUpgrades: {}, activeArmorElement: null,
    defeatedBoss: false,
    wonGame: false,
    flags: {}
  });
  applyStartingInventory(player);
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  enemies = []; projectiles = []; particles = []; damageNumbers = []; drops = [];
  villagers = [];
  minimapCanvases = {}; minimapDirty = true;
  // Drop the death-reload payload and the rolling autosave along with it.
  // reloadLastSave() falls back to `lastCheckpoint` and then to AUTOSAVE_KEY,
  // and neither belongs to this hero — without this, dying before the new game
  // reaches its first checkpoint (village clear / first tower floor) restores
  // the PREVIOUS game outright: old hero, old inventory, old maps.
  // The load modal's auto-save row is gated on the key existing, so the stale
  // `idx.auto` metadata left behind stays hidden and is overwritten wholesale
  // by the next autoSave().
  lastCheckpoint = null;
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* storage unavailable — nothing to clear */ }

  initWorld();
  revealAround(currentMap(), player.x, player.y, 12);
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  clampCam(true);
  updateHUD();
  setSaveStatus('', { toast: false });
  // Same opening the title-screen New Game gets — the prologue's first beat
  // establishes the house itself, so there's no banner to show first.
  if (typeof startPrologue === 'function') startPrologue();
}
