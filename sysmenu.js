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
];

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
