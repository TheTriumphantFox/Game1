// ─── Village shops: Inn + General Store ──────────────────────────────────────
// Activated after the player clears every enemy in a village. Two house doors
// become INN_DOOR and STORE_DOOR; stepping on either opens the matching modal.
//
// The modals reuse the visual language of the save modal but are completely
// separate DOM elements so they can be opened independently.

// `shopOpen` gates keyboard input in main.js so the player isn't fighting
// invisible movement keys while choosing a purchase.
let shopOpen = false;

// ─── Inn ──────────────────────────────────────────────────────────────────────
const INN_REST_COST = 10;

function openInnModal() {
  shopOpen = true;
  const overlay = document.getElementById('inn-modal-overlay');
  overlay.classList.add('open');
  renderInnContents();
}

function renderInnContents() {
  const canRest = player.hp < player.maxHp;
  const html = `
    <h2>🛏️ Wayfarer's Rest</h2>
    <div class="shop-greeting">Welcome, hero. Take a moment to rest your weary bones.</div>
    <div class="shop-rupees">You have: 💰 <b>${player.rupees}</b></div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🛌 Rest — Full Heal</div>
        <div class="shop-item-meta">${canRest ? `Restores HP to ${player.maxHp}` : 'Already at full HP'}</div>
      </div>
      <button class="ssbtn" ${player.rupees < INN_REST_COST || !canRest ? 'disabled' : ''} onclick="buyInnRest()">
        💰 ${INN_REST_COST}
      </button>
    </div>
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
  document.getElementById('inn-modal').innerHTML = html;
}

function buyInnRest() {
  if (player.rupees < INN_REST_COST) return;
  if (player.hp >= player.maxHp) return;
  player.rupees -= INN_REST_COST;
  player.hp = player.maxHp;
  showMsg('💤 You feel refreshed. Full HP restored.', 3000);
  renderInnContents();
  updateHUD();
}

// ─── General Store ────────────────────────────────────────────────────────────
const STORE_ITEMS = [
  { id: 'sword', label: '⚔️ Sword Lv +1',  cost: 50,
    desc: 'Increase melee damage',
    apply: () => { player.swordLevel++; } },
  { id: 'bow',   label: '🏹 Bow Lv +1',    cost: 50,
    desc: 'Increase arrow damage',
    apply: () => { player.bowLevel++; } },
  { id: 'armor', label: '🛡️ Armor +1',     cost: 75,
    desc: 'Reduce incoming damage',
    apply: () => { player.armor = (player.armor || 0) + 1; } },
  { id: 'hp',    label: '💚 Max HP +2',    cost: 100,
    desc: '+2 maximum HP, fully healed',
    apply: () => { player.maxHp += 2; player.hp = player.maxHp; } },
  // Elemental swords are no longer for sale — they only drop from the Forest
  // Lich. See the sell list rendered separately.
];

// Sell value the store offers per elemental sword (flat per element).
const ELEMENTAL_SELL_VALUE = 150;

// Elemental arrows: bought in packs, sold individually.
const ARROW_PACK_SIZE  = 5;
const ARROW_PACK_COST  = 50;     // 50 rupees for 5 arrows
const ARROW_SELL_VALUE = 5;      // 5 rupees per arrow sold back

function openStoreModal() {
  shopOpen = true;
  const overlay = document.getElementById('store-modal-overlay');
  overlay.classList.add('open');
  renderStoreContents();
}

function renderStoreContents() {
  const buyRows = STORE_ITEMS.map(it => {
    const broke = player.rupees < it.cost;
    const owned = it.canBuy ? !it.canBuy() : false;
    const disabled = broke || owned;
    const tag = owned ? '<span style="color:#88cc88">✓ owned</span>' : '';
    return `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${it.label} ${tag}</div>
          <div class="shop-item-meta">${it.desc}</div>
        </div>
        <button class="ssbtn" ${disabled ? 'disabled' : ''} onclick="buyStoreItem('${it.id}')">
          💰 ${it.cost}
        </button>
      </div>
    `;
  }).join('');

  // Sell list: only shows elemental swords the player actually owns.
  const owned = (player.swordElements || []);
  const sellRows = owned.length === 0 ? '' :
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#88cc88">
      We buy elemental swords — bring 'em on:
    </div>` +
    owned.map(id => {
      const elem = SWORD_ELEMENTS[id];
      if (!elem) return '';
      return `
        <div class="shop-row">
          <div class="shop-item">
            <div class="shop-item-name">${elem.icon} ${elem.label} Sword</div>
            <div class="shop-item-meta">Sell for rupees</div>
          </div>
          <button class="ssbtn" onclick="sellElementalSword('${id}')">
            ➜ 💰 ${ELEMENTAL_SELL_VALUE}
          </button>
        </div>
      `;
    }).join('');

  // Elemental arrows section: one row per element with buy + sell controls.
  const elementOrder = ['poison', 'necrotic', 'fire', 'ice', 'water', 'wind', 'luminous'];
  const arrowsRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#aacc88">
      Elemental Arrows · ${ARROW_PACK_SIZE}-pack ${ARROW_PACK_COST}💰 · sell back ${ARROW_SELL_VALUE}💰 each
    </div>` +
    elementOrder.map(id => {
      const elem = SWORD_ELEMENTS[id];
      if (!elem) return '';
      const count = (player.arrows && player.arrows[id]) || 0;
      const cantBuy = player.rupees < ARROW_PACK_COST;
      const cantSell = count <= 0;
      return `
        <div class="shop-row">
          <div class="shop-item">
            <div class="shop-item-name">${elem.icon} ${elem.label} Arrow <span style="color:#88cc88">x${count}</span></div>
            <div class="shop-item-meta">+1d4 ${elem.label} on hit</div>
          </div>
          <button class="ssbtn" ${cantBuy ? 'disabled' : ''} onclick="buyElementalArrows('${id}')">
            +${ARROW_PACK_SIZE} 💰${ARROW_PACK_COST}
          </button>
          <button class="ssbtn" ${cantSell ? 'disabled' : ''} onclick="sellElementalArrow('${id}')">
            -1 ➜ 💰${ARROW_SELL_VALUE}
          </button>
        </div>
      `;
    }).join('');

  document.getElementById('store-modal').innerHTML = `
    <h2>🏪 General Store</h2>
    <div class="shop-greeting">Greetings, traveler! Care to spend some rupees?</div>
    <div class="shop-rupees">You have: 💰 <b>${player.rupees}</b></div>
    ${buyRows}
    ${arrowsRows}
    ${sellRows}
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function buyElementalArrows(id) {
  if (!SWORD_ELEMENTS[id]) return;
  if (player.rupees < ARROW_PACK_COST) return;
  player.rupees -= ARROW_PACK_COST;
  const gained = addArrow(id, ARROW_PACK_SIZE);
  const elem = SWORD_ELEMENTS[id];
  const tail = gained < ARROW_PACK_SIZE ? ` — quiver capped at ${ITEM_CAP}` : '';
  showMsg(`🛒 Bought ${gained} ${elem.icon} ${elem.label} Arrows (x${player.arrows[id]} total)${tail}`, 3000);
  renderStoreContents();
  updateHUD();
}

function sellElementalArrow(id) {
  if (!SWORD_ELEMENTS[id]) return;
  player.arrows = player.arrows || {};
  if ((player.arrows[id] || 0) <= 0) return;
  player.arrows[id]--;
  addItem('rupees', ARROW_SELL_VALUE);
  if (player.arrows[id] <= 0 && player.activeArrowElement === id) {
    player.activeArrowElement = null;
  }
  const elem = SWORD_ELEMENTS[id];
  showMsg(`💰 Sold 1 ${elem.icon} ${elem.label} Arrow for ${ARROW_SELL_VALUE} rupees`, 2500);
  renderStoreContents();
  updateHUD();
}

function sellElementalSword(id) {
  const owned = player.swordElements || [];
  const idx = owned.indexOf(id);
  if (idx < 0) return;
  const elem = SWORD_ELEMENTS[id];
  if (!elem) return;
  owned.splice(idx, 1);
  player.swordElements = owned;
  // If the player was wielding this sword, fall back to the base sword
  if (player.activeSwordElement === id) player.activeSwordElement = null;
  addItem('rupees', ELEMENTAL_SELL_VALUE);
  showMsg(`💰 Sold ${elem.icon} ${elem.label} Sword for ${ELEMENTAL_SELL_VALUE} rupees`, 3000);
  renderStoreContents();
  updateHUD();
}

function buyStoreItem(id) {
  const it = STORE_ITEMS.find(x => x.id === id);
  if (!it) return;
  if (it.canBuy && !it.canBuy()) return;
  if (player.rupees < it.cost) return;
  player.rupees -= it.cost;
  it.apply();
  showMsg(`🛒 Purchased ${it.label}!`, 3000);
  renderStoreContents();
  updateHUD();
}

// ─── Close / open helpers ─────────────────────────────────────────────────────
function closeShopModals() {
  shopOpen = false;
  document.getElementById('inn-modal-overlay')  .classList.remove('open');
  document.getElementById('store-modal-overlay').classList.remove('open');
  // Drop any keys that were "held" while the modal was up so the player doesn't
  // immediately walk back onto the door tile and re-open the same modal.
  for (const k of Object.keys(keys)) keys[k] = false;
}

// Close on click outside the modal
document.addEventListener('DOMContentLoaded', () => {
  ['inn-modal-overlay', 'store-modal-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => { if (e.target === el) closeShopModals(); });
  });
});
// Fallback for when the script loads after DOMContentLoaded already fired.
['inn-modal-overlay', 'store-modal-overlay'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => { if (e.target === el) closeShopModals(); });
});
