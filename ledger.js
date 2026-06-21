// ─── Drops ledger ─────────────────────────────────────────────────────────────
// A read-only, grouped manifest of every passive pickup the player has gathered.
// Drops have no action (you only ever *view* counts), so a scrollable list reads
// far better than a 45-icon ring. It's opened from the radial menu's "Drops"
// launcher (the MENU ring) — see radial.js. `ledgerOpen` gates gameplay input and
// freezes the world (see main.js), matching the shop/portal modal pattern.

let ledgerOpen = false;

function openDropLedger() {
  // Reached through the radial menu — close it first so overlays don't stack.
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  ledgerOpen = true;
  if (typeof clearAllKeys === 'function') clearAllKeys();
  document.getElementById('ledger-modal-overlay').classList.add('open');
  renderLedgerContents();
}

function closeDropLedger() {
  ledgerOpen = false;
  document.getElementById('ledger-modal-overlay').classList.remove('open');
}

// Render the grouped manifest. Walks DROP_CATEGORIES in order, emitting a header
// + one row per owned (count > 0) drop in that bucket; empty buckets are skipped.
function renderLedgerContents() {
  let body = '';
  for (const c of DROP_CATEGORIES) {
    const rows = PASSIVE_DROPS
      .filter(d => dropCatOf(d.type) === c.id && (player[d.key] || 0) > 0)
      .map(d => `
        <div class="shop-row">
          <div class="shop-item"><div class="shop-item-name">${d.icon} ${d.label}</div></div>
          <span class="ledger-count">x${player[d.key] || 0}</span>
        </div>`)
      .join('');
    if (!rows) continue;
    body += `<div class="ledger-cat">${c.label}</div>${rows}`;
  }
  if (!body) {
    body = `<div class="shop-greeting">Your satchel is empty — go gather some drops.</div>`;
  }
  document.getElementById('ledger-modal').innerHTML = `
    <h2>🎒 Drops</h2>
    <div class="shop-greeting">Everything you've gathered from the wild.</div>
    ${body}
    <button class="shop-close" onclick="closeDropLedger()">✕ Close</button>
  `;
}

// Close on click outside the modal (matches shop/portal behaviour).
const _ledgerOverlay = document.getElementById('ledger-modal-overlay');
if (_ledgerOverlay) {
  _ledgerOverlay.addEventListener('click', e => { if (e.target === _ledgerOverlay) closeDropLedger(); });
}
