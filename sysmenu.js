// ─── Game menu ────────────────────────────────────────────────────────────────
// One window holding the out-of-world commands — Save, Load, New Game, a way into
// Settings, and the dev rows (God Mode, Generate Full Map). They used to be four separate launchers in the
// radial MENU ring, which pushed the gameplay panels (Character, Drops, World
// Map) down a crowded list; now a single "💾 Game Menu" launcher opens this and
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
  // Settings has its own launcher in the ring too. This row is here because a
  // player looking for a volume slider opens the game menu first.
  { icon: '⚙️', label: 'Settings',
    meta: 'Sound, display, vibration and controls.',
    btn: 'Open',
    run: () => openSettingsWindow() },
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
    <h2>💾 Game Menu</h2>
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


// ─── Settings window ─────────────────────────────────────────────────────────
// Every per-device preference in one panel: sound, display, and controls. It
// grew out of the Controls window (key rebinding and touch handedness), which
// was already "the settings panel the sysmenu never had"; music used to sit in
// the game menu and nothing else was adjustable at all. One place means a
// player looking for any of these finds all of them.
//
// Rebinding and handedness stay together under Controls: they are the same
// question asked of two devices, and both are the Shadow temple's counter
// (controlsChangedFromDefault, config.js). Reset only touches that section, so
// clearing a bad key binding never undoes someone's volume or flashing choice.
//
// Nothing here is saved in a slot. Music keeps its key (music.js); everything
// else new is in devicePrefs (config.js).
let settingsOpen = false;
let settingsCapturing = null;      // action id awaiting a key, or null

function openSettingsWindow() {
  // Reached from the radial ring and from the game menu; close both so overlays
  // don't stack.
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  if (sysMenuOpen) closeSysMenu();
  settingsOpen = true;
  settingsCapturing = null;
  if (typeof clearAllKeys === 'function') clearAllKeys();
  document.getElementById('settings-modal-overlay').classList.add('open');
  renderSettingsWindow();
}

function closeSettingsWindow() {
  settingsOpen = false;
  settingsCapturing = null;
  document.getElementById('settings-modal-overlay').classList.remove('open');
  // Keys pressed while the window was up were swallowed by the capture path and
  // never reached setKey, so anything held on the way in would otherwise latch.
  if (typeof keys !== 'undefined') for (const k in keys) keys[k] = false;
}

// Called from the keydown handler BEFORE anything else. Returns true when it has
// consumed the press.
function settingsCaptureKey(e) {
  if (!settingsOpen) return false;
  if (!settingsCapturing) {
    // Not capturing: the window is still modal, so Escape closes it. Tab and
    // Enter/Space return false here — the caller in main.js still stops them
    // from reaching the world underneath, but doesn't preventDefault them, so
    // the browser's native focus-move and button-activate behavior keeps
    // working inside the window. Every other key (WASD, V, P, digits, ...) is
    // still swallowed. Arrow keys return false too, so a focused volume
    // slider can be nudged from the keyboard.
    if (e.key === 'Escape') { closeSettingsWindow(); return true; }
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') return false;
    if (e.key.startsWith('Arrow') && e.target && e.target.type === 'range') return false;
    return true;
  }
  if (e.key === 'Escape') {            // cancel this one assignment, keep the window
    settingsCapturing = null;
    renderSettingsWindow();
    return true;
  }
  // Modifier-only presses are not a binding. Waiting for the real key is kinder
  // than assigning "Shift" and leaving the player to work out why nothing works.
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return true;
  if (typeof setKeyBinding === 'function') setKeyBinding(settingsCapturing, e.key);
  settingsCapturing = null;
  renderSettingsWindow();
  if (typeof refreshControlHints === 'function') refreshControlHints();
  return true;
}

function beginControlsCapture(id) {
  settingsCapturing = id;
  renderSettingsWindow();
}

function controlsResetAll() {
  if (typeof resetKeyBindings === 'function') resetKeyBindings();
  if (typeof setTouchSide === 'function') setTouchSide('left');
  settingsCapturing = null;
  renderSettingsWindow();
  if (typeof refreshControlHints === 'function') refreshControlHints();
}

function controlsCycleScheme() {
  if (typeof cycleUiMode === 'function') cycleUiMode();
  renderSettingsWindow();
}

function controlsToggleSide() {
  if (typeof toggleTouchSide === 'function') toggleTouchSide();
  renderSettingsWindow();
}

// The way back from "Don't show this again" on the controls card (main.js). This
// window is the right home for it: it is the one place in the game that already
// owns the answer to "how do I play this", and it is reachable from the Menu ring
// on both control schemes.
function controlsToggleStartScreen() {
  if (typeof setShowControlsOnStart === 'function') {
    setShowControlsOnStart(!showControlsOnStart);
  }
  renderSettingsWindow();
}

// ── Sound and display handlers ──
// Sliders write on every input event but do not re-render: rebuilding the row
// under a slider mid-drag would drop the pointer.
function settingsToggleMusicMute() {
  if (typeof musicSetMuted !== 'function') return;
  musicSetMuted(!musicPref.muted);
  renderSettingsWindow();
}

function settingsSetSfxVolume(v) {
  setDevicePref('sfxVolume', Math.max(0, Math.min(100, Math.round(Number(v) || 0))));
}

function settingsToggleSfxMute() {
  setDevicePref('sfxMuted', !devicePrefs.sfxMuted);
  renderSettingsWindow();
}

// Plain on/off prefs. The buzz fires after the write so turning vibration ON
// confirms itself and turning it OFF is silent.
function settingsToggle(k) {
  setDevicePref(k, !devicePrefs[k]);
  if (k === 'screenShake' && !devicePrefs.screenShake) { shakeMag = 0; shakeMs = 0; }
  if (typeof buzz === 'function') buzz(8);
  renderSettingsWindow();
}

function settingsToggleKeepAwake() {
  if (typeof setKeepAwake === 'function') setKeepAwake(!devicePrefs.keepAwake);
  renderSettingsWindow();
}

// Zoom without cycling through the full-screen map. setViewMode remembers it.
function settingsToggleZoom() {
  if (typeof setViewMode === 'function') setViewMode(viewMode === 1 ? 0 : 1);
  renderSettingsWindow();
}

function settingsCycleToastTime() {
  const i = TOAST_TIME_STEPS.indexOf(devicePrefs.toastTime);
  setDevicePref('toastTime', TOAST_TIME_STEPS[(i + 1) % TOAST_TIME_STEPS.length]);
  renderSettingsWindow();
}

const TOAST_TIME_LABELS = { 1: 'Normal', 1.5: 'Long', 2: 'Longer' };

// One labelled row with a single button. `extra` slots a control (a slider)
// in before the button.
function settingsRow(icon, name, meta, btnLabel, onclick, extra = '') {
  return `<div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">${icon} ${name}</div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      ${extra}
      <button class="ssbtn" style="min-width:${extra ? 72 : 118}px" onclick="${onclick}">${btnLabel}</button>
    </div>`;
}

function settingsSlider(value, label, oninput) {
  return `<input type="range" min="0" max="100" value="${value}" aria-label="${label}"
             style="width:96px;accent-color:#e8c870" oninput="${oninput}">`;
}

function settingsHeading(text) {
  return `<div style="margin:14px 0 4px;color:#e8c870;font-size:13px;font-weight:bold;
                      letter-spacing:0.08em;text-transform:uppercase">${text}</div>`;
}

function renderSettingsWindow() {
  const el = document.getElementById('settings-modal');
  if (!el) return;
  const onOff = on => on ? 'On' : 'Off';

  // ── Sound ──
  const music = (typeof musicPref === 'undefined') ? '' : settingsRow('🎵', 'Music',
    'Each region has its own theme. It rises when a boss is near and settles in a restored village.',
    musicPref.muted ? 'Unmute' : 'Mute', 'settingsToggleMusicMute()',
    settingsSlider(musicPref.volume, 'Music volume', 'musicSetVolume(this.value)'));
  const sfx = settingsRow('🔊', 'Sound effects',
    'Battle cries and the dragon\'s roar.',
    devicePrefs.sfxMuted ? 'Unmute' : 'Mute', 'settingsToggleSfxMute()',
    settingsSlider(devicePrefs.sfxVolume, 'Sound effects volume', 'settingsSetSfxVolume(this.value)'));

  // ── Display ──
  const flashing = settingsRow('⚡', 'Reduce flashing',
    'Softens the lightning storms, holds the low health warning steady and slows the blink after a hit.',
    onOff(devicePrefs.reduceFlashing), "settingsToggle('reduceFlashing')");
  const shake = settingsRow('💥', 'Screen shake',
    'The camera jolt in cutscenes and big moments.',
    onOff(devicePrefs.screenShake), "settingsToggle('screenShake')");
  const zoom = settingsRow('🔍', 'View',
    'How much of the map is on screen. Remembered next time you play.',
    viewMode === 1 ? 'Zoomed out' : 'Normal', 'settingsToggleZoom()');
  const toast = settingsRow('💬', 'Message time',
    'How long pickup, area and event messages stay up.',
    TOAST_TIME_LABELS[devicePrefs.toastTime] || 'Normal', 'settingsCycleToastTime()');
  const awake = settingsRow('☀️', 'Keep screen awake',
    'Stops the screen dimming while you play. Off saves battery.',
    onOff(devicePrefs.keepAwake), 'settingsToggleKeepAwake()');

  // ── Controls ──
  const rows = (typeof KEY_ACTIONS !== 'undefined' ? KEY_ACTIONS : []).map(a => {
    const capturing = settingsCapturing === a.id;
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
  const startCardLabel = (typeof showControlsOnStart === 'undefined' || showControlsOnStart)
    ? 'Shown' : 'Hidden';

  el.innerHTML = `
    <h2>⚙️ Settings</h2>
    <div class="shop-greeting">Saved on this device only. Your save slots are not affected.</div>
    ${settingsHeading('Sound')}
    ${music}${sfx}
    ${settingsHeading('Display')}
    ${flashing}${shake}${zoom}${toast}${awake}
    ${settingsHeading('Controls')}
    ${settingsRow('🎮', 'Control scheme',
      'Auto follows the last input you used. Override it if auto guesses wrong.',
      schemeLabel, 'controlsCycleScheme()')}
    ${settingsRow('🤚', 'Touch control side',
      'Which side the steering pad and action buttons sit on.',
      sideLabel, 'controlsToggleSide()')}
    ${settingsRow('📳', 'Vibration',
      'Buzzes on touch devices that support it.',
      onOff(devicePrefs.haptics), "settingsToggle('haptics')")}
    ${settingsRow('🗺️', 'Controls card on start',
      'The summary shown when a run begins. Turn it back on here if you ticked "Don\'t show this again".',
      startCardLabel, 'controlsToggleStartScreen()')}
    <div style="margin:10px 0 4px;color:#8a93b8;font-size:13px">
      Keyboard: click a key, then press the one you want.
      Space always swings as well, and cannot be reassigned.
    </div>
    ${rows}
    <div style="margin-top:10px;color:${changed ? '#a9d8a9' : '#8a93b8'};font-size:13px">
      ${changed ? '✔ Your controls differ from the defaults.'
                : 'Your controls are at their defaults.'}
    </div>
    <button class="ssbtn" onclick="controlsResetAll()">↺ Reset controls</button>
    <button class="shop-close" onclick="closeSettingsWindow()">✕ Close</button>`;
}

// Close on click outside the modal, like the game menu above.
const _settingsOverlay = document.getElementById('settings-modal-overlay');
if (_settingsOverlay) {
  _settingsOverlay.addEventListener('click', e => {
    if (e.target === _settingsOverlay) closeSettingsWindow();
  });
}
