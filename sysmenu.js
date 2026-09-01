// ─── Game menu ────────────────────────────────────────────────────────────────
// One window holding the four out-of-world commands — Save, Load, New Game and
// the admin God Mode grant. They used to be four separate launchers in the
// radial MENU ring, which pushed the gameplay panels (Character, Drops, World
// Map) down a crowded list; now a single "⚙️ Game Menu" launcher opens this and
// the ring stays short. Opened from radial.js. `sysMenuOpen` gates gameplay
// input and freezes the world (see main.js), matching the ledger/portal pattern.
//
// Every row closes this window before running its command: the save/load modal
// and the New Game confirm are their own overlays, and stacking two at the same
// z-index reads as a bug.

let sysMenuOpen = false;

function openSysMenu() {
  // Reached through the radial menu — close it first so overlays don't stack.
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  sysMenuOpen = true;
  if (typeof clearAllKeys === 'function') clearAllKeys();
  document.getElementById('sysmenu-modal-overlay').classList.add('open');
  renderSysMenuContents();
}

function closeSysMenu() {
  sysMenuOpen = false;
  document.getElementById('sysmenu-modal-overlay').classList.remove('open');
}

// The rows, in the order they're drawn. `run` fires after the window closes.
const SYSMENU_ITEMS = [
  { icon: '💾', label: 'Save Game',
    meta: 'Write this run into one of the named slots.',
    btn: 'Save',
    run: () => { if (typeof openSaveModal === 'function') openSaveModal(); } },
  { icon: '📂', label: 'Load Game',
    meta: 'Pick a saved slot and drop back into it.',
    btn: 'Load',
    run: () => { if (typeof openLoadModal === 'function') openLoadModal(); } },
  { icon: '🆕', label: 'New Game',
    meta: 'Name a new hero and start the world over.',
    btn: 'Start',
    run: () => { if (typeof newGame === 'function') newGame(); } },
  { icon: '😇', label: 'God Mode',
    meta: 'Admin grant — every elemental sword and armor, 100 HP, 10000 rubies.',
    btn: 'Grant',
    run: () => { if (typeof grantGodMode === 'function') grantGodMode(); } },
  { icon: '🗺️', label: 'Generate Full Map',
    meta: 'Dev — build all 13 regions at once: every region\'s 20 maps, its village and its ' +
          'ring of dead-ends, woven so each village is one map from the next. Nothing is cleared or explored.',
    btn: 'Build',
    run: () => runGenerateFullWorld() },
];

// Dev world-builder (generateFullWorld in world.js). 273 maps is a few seconds of
// solid work with no chance to paint, so the "working" toast goes up first and the
// build starts two frames later — otherwise the screen simply freezes with no
// indication anything is happening. The atlas opens on the way out, since seeing
// the weave is the point of the command.
function runGenerateFullWorld() {
  if (typeof generateFullWorld !== 'function') return;
  showMsg('🗺️ Charting every region — this takes a moment…', 6000);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const t0 = performance.now();
    const res = generateFullWorld();
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const skipped = res.skipped ? ` ${res.skipped} cell${res.skipped > 1 ? 's' : ''} already existed and were left alone.` : '';
    showMapMsg(`🗺️ World charted — ${res.built} maps across ${REGIONS.length} regions ` +
               `(${res.deadEnds} of them dead-ends) in ${secs}s.${skipped}`);
    if (typeof minimapDirty !== 'undefined') minimapDirty = true;
    if (typeof openWorldMap === 'function') openWorldMap();
  }));
}

function renderSysMenuContents() {
  const rows = SYSMENU_ITEMS.map((it, i) => `
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">${it.icon} ${it.label}</div>
        <div class="shop-item-meta">${it.meta}</div>
      </div>
      <button class="ssbtn" onclick="sysMenuSelect(${i})">${it.btn}</button>
    </div>`).join('');
  document.getElementById('sysmenu-modal').innerHTML = `
    <h2>⚙️ Game Menu</h2>
    <div class="shop-greeting">Saving, loading, and starting over.</div>
    ${rows}
    <button class="shop-close" onclick="closeSysMenu()">✕ Close</button>
  `;
}

// Dispatch a row click by index. Closes first — see the header note.
function sysMenuSelect(i) {
  const it = SYSMENU_ITEMS[i];
  if (!it) return;
  closeSysMenu();
  it.run();
}

// Close on click outside the modal (matches shop/portal/ledger behaviour).
const _sysMenuOverlay = document.getElementById('sysmenu-modal-overlay');
if (_sysMenuOverlay) {
  _sysMenuOverlay.addEventListener('click', e => {
    if (e.target === _sysMenuOverlay) closeSysMenu();
  });
}


// ─── Controls window ─────────────────────────────────────────────────────────
// Key rebinding and the touch handedness setting in one panel, because they are
// the same question asked of two devices: where are my controls, and can I move
// them. Both are also the Shadow temple's counter, which is a second reason not
// to split them across two places a player has to find separately.
//
// Lives here with the game menu rather than in its own file: this is the
// settings panel the sysmenu never had, and it uses the same overlay pattern.
let controlsOpen = false;
let controlsCapturing = null;      // action id awaiting a key, or null

function openControlsWindow() {
  controlsOpen = true;
  controlsCapturing = null;
  document.getElementById('controls-modal-overlay').classList.add('open');
  renderControlsWindow();
}

function closeControlsWindow() {
  controlsOpen = false;
  controlsCapturing = null;
  document.getElementById('controls-modal-overlay').classList.remove('open');
  // Keys pressed while the window was up were swallowed by the capture path and
  // never reached setKey, so anything held on the way in would otherwise latch.
  if (typeof keys !== 'undefined') for (const k in keys) keys[k] = false;
}

// Called from the keydown handler BEFORE anything else. Returns true when it has
// consumed the press.
function controlsCaptureKey(e) {
  if (!controlsOpen) return false;
  if (!controlsCapturing) {
    // Not capturing: the window is still modal, so Escape closes it and every
    // other key is swallowed rather than reaching the world underneath.
    if (e.key === 'Escape') closeControlsWindow();
    return true;
  }
  if (e.key === 'Escape') {            // cancel this one assignment, keep the window
    controlsCapturing = null;
    renderControlsWindow();
    return true;
  }
  // Modifier-only presses are not a binding. Waiting for the real key is kinder
  // than assigning "Shift" and leaving the player to work out why nothing works.
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return true;
  if (typeof setKeyBinding === 'function') setKeyBinding(controlsCapturing, e.key);
  controlsCapturing = null;
  renderControlsWindow();
  if (typeof refreshControlHints === 'function') refreshControlHints();
  return true;
}

function beginControlsCapture(id) {
  controlsCapturing = id;
  renderControlsWindow();
}

function controlsResetAll() {
  if (typeof resetKeyBindings === 'function') resetKeyBindings();
  if (typeof setTouchSide === 'function') setTouchSide('left');
  controlsCapturing = null;
  renderControlsWindow();
  if (typeof refreshControlHints === 'function') refreshControlHints();
}

function controlsCycleScheme() {
  if (typeof cycleUiMode === 'function') cycleUiMode();
  renderControlsWindow();
}

function controlsToggleSide() {
  if (typeof toggleTouchSide === 'function') toggleTouchSide();
  renderControlsWindow();
}

function renderControlsWindow() {
  const el = document.getElementById('controls-modal');
  if (!el) return;
  const rows = (typeof KEY_ACTIONS !== 'undefined' ? KEY_ACTIONS : []).map(a => {
    const capturing = controlsCapturing === a.id;
    const bound = (typeof keyBinding === 'function') ? keyBinding(a.id) : '';
    // An action left unbound by a reassignment says so loudly. A blank cell
    // reads as a rendering fault; "unbound" reads as a thing you did.
    const label = capturing ? 'press a key…'
                : bound ? ((typeof keyLabel === 'function') ? keyLabel(bound) : bound)
                : 'unbound';
    const colour = capturing ? '#ffe89a' : bound ? '#dfe7ff' : '#ff8a8a';
    return `<div class="shop-row">
      <div class="shop-item"><div class="shop-item-name">${a.label}</div></div>
      <button class="ssbtn" style="min-width:118px;color:${colour}"
        onclick="beginControlsCapture('${a.id}')">${label}</button>
    </div>`;
  }).join('');

  const sideLabel = (typeof touchSideLabel === 'function') ? touchSideLabel() : '—';
  const schemeLabel = (typeof uiModeLabel === 'function') ? uiModeLabel() : '—';
  const changed = (typeof controlsChangedFromDefault === 'function')
    ? controlsChangedFromDefault() : false;

  el.innerHTML = `
    <h2>🎮 Controls</h2>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🎮 Control scheme</div>
        <div class="shop-item-meta">Auto follows the last input you used. Override it if auto guesses wrong.</div>
      </div>
      <button class="ssbtn" style="min-width:118px" onclick="controlsCycleScheme()">${schemeLabel}</button>
    </div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🤚 Touch control side</div>
        <div class="shop-item-meta">Which side the steering pad and action buttons sit on.</div>
      </div>
      <button class="ssbtn" style="min-width:118px" onclick="controlsToggleSide()">${sideLabel}</button>
    </div>
    <div style="margin:10px 0 4px;color:#8a93b8;font-size:13px">
      Keyboard — click a key, then press the one you want.
      Space always swings as well, and cannot be reassigned.
    </div>
    ${rows}
    <div style="margin-top:10px;color:${changed ? '#a9d8a9' : '#8a93b8'};font-size:13px">
      ${changed ? '✔ Your controls differ from the defaults.'
                : 'Everything is at its default.'}
    </div>
    <button class="ssbtn" onclick="controlsResetAll()">↺ Reset to defaults</button>
    <button class="shop-close" onclick="closeControlsWindow()">✕ Close</button>`;
}
