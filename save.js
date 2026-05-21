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
    mapSequence,
    worldGrid,
    worldMapsLite: worldMaps.map(m => ({
      id: m.id, gx: m.gx, gy: m.gy,
      name: m.name, type: m.type, depth: m.depth,
      openedChests: Array.from(m.openedChests),
      visited: m.visited,
      savedEnemies: m.savedEnemies || null,
      fog: m.fog ? Array.from(m.fog) : null,
      mapTiles: m.visited ? encodeMap(m.map) : null,
      // Cave linkage — only set for caves and source maps that opened one.
      returnMapId: m.returnMapId,
      returnX: m.returnX,
      returnY: m.returnY,
      caveLinks: m.caveLinks ? { ...m.caveLinks } : undefined,
      // Village activation state
      activated: m.activated || false,
      innDoor: m.innDoor || undefined,
      storeDoor: m.storeDoor || undefined
    }))
  };
}

// Authoritative default shape — any save missing a field falls back here.
const DEFAULT_PLAYER = {
  x: EXIT_COL, y: EXIT_ROW,
  renderX: EXIT_COL, renderY: EXIT_ROW,
  hp: 8, maxHp: 8,
  rupees: 0, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  invincible: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  potions: 0,
  swordElements: [],
  activeSwordElement: null,
  arrows: {},
  activeArrowElement: null,
  defeatedBoss: false
};

function applyLoadData(data) {
  // Apply defaults first, then overlay saved values. This ensures fields
  // missing from older saves (e.g. armor) reset to their default rather than
  // leaking the current in-memory value.
  Object.assign(player, DEFAULT_PLAYER, data.player);
  // renderX/Y aren't meaningful values to load — they should match x/y after
  // an instant snap (clampCam(true) below will do the rest).
  player.renderX = player.x;
  player.renderY = player.y;
  currentMapId = data.currentMapId;
  mapsVisited = data.mapsVisited || 0;
  mapSequence = data.mapSequence || [];
  worldGrid = data.worldGrid || {};

  // Reset transient state so the player isn't stuck mid-animation
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  player.invincible = 0; player.swordTimer = 0;
  enemies = []; projectiles = []; particles = []; damageNumbers = []; drops = [];
  minimapCanvases = {}; minimapDirty = true;

  worldMaps = data.worldMapsLite.map(lite => {
    const md = lite.mapTiles
      ? decodeMap(lite.mapTiles)
      : lite.type === 'village' ? buildVillageMap()
      : lite.type === 'cave'    ? buildCaveMap()
      :                            buildForestMap(lite.id, lite.depth);
    const obj = {
      id: lite.id, gx: lite.gx || 0, gy: lite.gy || 0,
      name: lite.name, type: lite.type, depth: lite.depth,
      map: md, enemyDefs: makeEnemyDefs(lite.depth, lite.type, md),
      openedChests: new Set(lite.openedChests),
      visited: lite.visited,
      savedEnemies: lite.savedEnemies || null
    };
    if (lite.fog) obj.fog = new Uint8Array(lite.fog);
    if (lite.returnMapId != null) {
      obj.returnMapId = lite.returnMapId;
      obj.returnX = lite.returnX;
      obj.returnY = lite.returnY;
    }
    if (lite.caveLinks) obj.caveLinks = { ...lite.caveLinks };
    if (lite.activated) obj.activated = true;
    if (lite.innDoor)   obj.innDoor   = { ...lite.innDoor };
    if (lite.storeDoor) obj.storeDoor = { ...lite.storeDoor };
    return obj;
  });

  // Older saves predate worldGrid — rebuild from gx/gy
  if (!data.worldGrid) {
    worldGrid = {};
    worldMaps.forEach(m => { worldGrid[gridKey(m.gx, m.gy)] = m.id; });
  }

  spawnEnemiesForMap(currentMapId);
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
      metaSpan.textContent = `Lv${meta.level} · Map ${meta.mapsVisited}/21 · ${meta.date}`;

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
    hp: 8, maxHp: 8, rupees: 0, level: 1, xp: 0, xpNext: 500,
    swordTimer: 0, swordDir: { x: 0, y: -1 }, invincible: 0,
    weapon: 'sword', bowLevel: 1, swordLevel: 1, armor: 0, potions: 0,
    swordElements: [], activeSwordElement: null,
    arrows: {}, activeArrowElement: null,
    defeatedBoss: false
  });
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  enemies = []; projectiles = []; particles = []; damageNumbers = [];
  minimapCanvases = {}; minimapDirty = true;

  initWorld();
  revealAround(currentMap(), player.x, player.y, 12);
  spawnEnemiesForMap(0);
  clampCam(true);
  updateHUD();
  document.getElementById('save-status').textContent = '';
  showMsg('🌲 A new adventure begins in the Enchanted Forest!', 3500);
}
