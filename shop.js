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

// Canonical element ordering used by every shop list (arrows, armor, …).
const ELEMENT_ORDER = ['fire', 'water', 'ice', 'lightning', 'earth', 'air', 'luminous', 'necrotic', 'poison', 'mana'];

// ─── General Store ────────────────────────────────────────────────────────────
// Armor is no longer sold here — the Blacksmith handles all armor (flat +
// elemental). The General Store covers weapon levels, max HP, and arrows.
const STORE_ITEMS = [
  { id: 'sword', label: '⚔️ Sword Lv +1',  cost: 50,
    desc: 'Increase melee damage',
    apply: () => { player.swordLevel++; } },
  { id: 'bow',   label: '🏹 Bow Lv +1',    cost: 50,
    desc: 'Increase arrow damage',
    apply: () => { player.bowLevel++; } },
  { id: 'temphp', label: '💚 Temp HP +1',  cost: 150,
    desc: '+1 temporary HP (green heart) — soaks damage before your HP',
    apply: () => { player.tempHp = (player.tempHp || 0) + 1; } },
  // Elemental swords are no longer for sale — they only drop from the Forest
  // Lich. See the sell list rendered separately.
];

// Sell value the store offers per elemental sword (flat per element).
const ELEMENTAL_SELL_VALUE = 150;

// Elemental arrows: bought in packs, sold individually. Plain arrows trade at
// half price — no elemental rider on the hit.
const ARROW_PACK_SIZE  = 5;
const ARROW_PACK_COST  = 50;     // 50 rupees for 5 arrows
const ARROW_SELL_VALUE = 5;      // 5 rupees per arrow sold back
const PLAIN_ARROW_PACK_COST  = 25;
const PLAIN_ARROW_SELL_VALUE = 2;

// Monster trophies + foraged goods the General Store buys back. Values climb
// roughly with the region tier the trophy drops in (see ENEMY_DROPS in
// player.js). The store cashes in the whole stack at once.
const TROPHY_SELL = [
  { key: 'fangs',      icon: '🦷', label: 'Fang',           value: 10 },
  { key: 'fingers',    icon: '🫳', label: 'Finger',         value: 10 },
  { key: 'wings',      icon: '🪶', label: 'Wing',           value: 25 },
  { key: 'silks',      icon: '🕸️', label: 'Silk',           value: 12 },
  { key: 'feathers',   icon: '🪶', label: 'Feather',        value: 20 },
  { key: 'talismans',  icon: '📿', label: 'Talisman',       value: 20 },
  { key: 'embers',     icon: '🔥', label: 'Ember',          value: 15 },
  { key: 'venoms',     icon: '☠️', label: 'Venom Sac',      value: 18 },
  { key: 'fins',       icon: '🐟', label: 'Fin',            value: 15 },
  { key: 'pearls',     icon: '🦪', label: 'Pearl',          value: 30 },
  { key: 'shards',     icon: '🧊', label: 'Ice Shard',      value: 22 },
  { key: 'pelts',      icon: '🧥', label: 'Pelt',           value: 25 },
  { key: 'tusks',      icon: '🦣', label: 'Tusk',           value: 35 },
  { key: 'stones',     icon: '🪨', label: 'Stone Shard',    value: 25 },
  { key: 'cores',      icon: '💠', label: 'Elemental Core', value: 40 },
  { key: 'scales',     icon: '🐉', label: 'Dragon Scale',   value: 35 },
  { key: 'sparks',     icon: '⚡', label: 'Storm Spark',    value: 35 },
  { key: 'horns',      icon: '🦄', label: 'Horn',           value: 50 },
  { key: 'motes',      icon: '✨', label: 'Light Mote',     value: 45 },
  { key: 'bones',      icon: '🦴', label: 'Bone',           value: 12 },
  { key: 'organs',     icon: '🫀', label: 'Organ',          value: 15 },
  { key: 'ectoplasms', icon: '👻', label: 'Ectoplasm',      value: 40 },
  { key: 'eyes',       icon: '👁️', label: 'Eye',            value: 50 },
  { key: 'brains',     icon: '🧠', label: 'Brain',          value: 55 },
  { key: 'herbals',    icon: '🌿', label: 'Herbal',         value: 5  },
  { key: 'mushrooms',  icon: '🍄', label: 'Mushroom',       value: 5  },
  { key: 'bonemeal',   icon: '🧂', label: 'Bone Meal',      value: 8  },
  { key: 'snowballs',  icon: '⚪', label: 'Snowball',       value: 6  },
];

// Potions sell one at a time (selling the whole stack at once would be too
// easy to fat-finger). Values stay below brew cost so there's no money loop.
const POTION_SELL = [
  { key: 'potions',    icon: '🧪', label: 'Health Potion', value: 10 },
  { key: 'medPotions', icon: '🍶', label: 'Medium Potion', value: 25 },
];

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

  // Arrows section: a plain-arrow row first, then one row per element, each
  // with buy + sell controls.
  const plainCount = (player.arrows && player.arrows.plain) || 0;
  const plainRow = `
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🏹 Plain Arrow <span style="color:#88cc88">x${plainCount}</span></div>
        <div class="shop-item-meta">Standard ammunition — no elemental rider</div>
      </div>
      <button class="ssbtn" ${player.rupees < PLAIN_ARROW_PACK_COST ? 'disabled' : ''} onclick="buyElementalArrows('plain')">
        +${ARROW_PACK_SIZE} 💰${PLAIN_ARROW_PACK_COST}
      </button>
      <button class="ssbtn" ${plainCount <= 0 ? 'disabled' : ''} onclick="sellElementalArrow('plain')">
        -1 ➜ 💰${PLAIN_ARROW_SELL_VALUE}
      </button>
    </div>
  `;
  const arrowsRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#aacc88">
      Arrows · plain ${ARROW_PACK_SIZE}-pack ${PLAIN_ARROW_PACK_COST}💰 (sell ${PLAIN_ARROW_SELL_VALUE}💰) · elemental ${ARROW_PACK_SIZE}-pack ${ARROW_PACK_COST}💰 (sell ${ARROW_SELL_VALUE}💰)
    </div>` +
    plainRow +
    ELEMENT_ORDER.map(id => {
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

  // Trophy sell section — cash in monster spoils (fangs, scales, pearls, …).
  // With two dozen trophy types, only the ones the player actually carries get
  // a row; otherwise the modal would scroll forever.
  const ownedTrophies = TROPHY_SELL.filter(t => (player[t.key] || 0) > 0);
  const trophyRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#cc9988">
      We buy monster trophies &amp; foraged goods — cash in your spoils:
    </div>` +
    (ownedTrophies.length === 0
      ? `<div style="font-size:11px;color:#778877;padding:6px 2px">
          Nothing to sell right now — every monster drops a trophy we'll pay for.
        </div>`
      : ownedTrophies.map(t => {
          const count = player[t.key] || 0;
          return `
            <div class="shop-row">
              <div class="shop-item">
                <div class="shop-item-name">${t.icon} ${t.label} <span style="color:#88cc88">x${count}</span></div>
                <div class="shop-item-meta">Sell for ${t.value}💰 each</div>
              </div>
              <button class="ssbtn" onclick="sellTrophy('${t.key}')">
                All ➜ 💰${count * t.value}
              </button>
            </div>
          `;
        }).join(''));

  // Potion buy-back rows — sold one at a time.
  const potionRows = POTION_SELL.map(p => {
    const count = player[p.key] || 0;
    return `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${p.icon} ${p.label} <span style="color:#88cc88">x${count}</span></div>
          <div class="shop-item-meta">Sell for ${p.value}💰 each</div>
        </div>
        <button class="ssbtn" ${count <= 0 ? 'disabled' : ''} onclick="sellPotionItem('${p.key}')">
          -1 ➜ 💰${p.value}
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
    ${trophyRows}
    ${potionRows}
    ${sellRows}
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function buyElementalArmor(id) {
  if (!SWORD_ELEMENTS[id]) return;
  player.armorElements = player.armorElements || [];
  if (player.armorElements.includes(id)) return;
  if (player.rupees < ELEMENTAL_ARMOR_COST) return;
  player.rupees -= ELEMENTAL_ARMOR_COST;
  player.armorElements.push(id);
  const elem = SWORD_ELEMENTS[id];
  showMsg(`🔨 Forged 🛡${elem.icon} ${elem.label} Armor — equip it via the V radial menu`, 3500);
  renderBlacksmithContents();
  updateHUD();
}

function sellElementalArmor(id) {
  player.armorElements = player.armorElements || [];
  const idx = player.armorElements.indexOf(id);
  if (idx < 0) return;
  const elem = SWORD_ELEMENTS[id];
  if (!elem) return;
  player.armorElements.splice(idx, 1);
  if (player.activeArmorElement === id) player.activeArmorElement = null;
  addItem('rupees', ELEMENTAL_ARMOR_SELL_VALUE);
  showMsg(`💰 Sold 🛡${elem.icon} ${elem.label} Armor for ${ELEMENTAL_ARMOR_SELL_VALUE} rupees`, 3000);
  renderBlacksmithContents();
  updateHUD();
}

function buyElementalArrows(id) {
  const plain = id === 'plain';
  if (!plain && !SWORD_ELEMENTS[id]) return;
  const cost = plain ? PLAIN_ARROW_PACK_COST : ARROW_PACK_COST;
  if (player.rupees < cost) return;
  player.rupees -= cost;
  const gained = addArrow(id, ARROW_PACK_SIZE);
  const elem = plain ? { icon: '🏹', label: 'Plain' } : SWORD_ELEMENTS[id];
  const tail = gained < ARROW_PACK_SIZE ? ` — quiver capped at ${ITEM_CAP}` : '';
  showMsg(`🛒 Bought ${gained} ${elem.icon} ${elem.label} Arrows (x${player.arrows[id]} total)${tail}`, 3000);
  renderStoreContents();
  updateHUD();
}

function sellElementalArrow(id) {
  const plain = id === 'plain';
  if (!plain && !SWORD_ELEMENTS[id]) return;
  player.arrows = player.arrows || {};
  if ((player.arrows[id] || 0) <= 0) return;
  player.arrows[id]--;
  const value = plain ? PLAIN_ARROW_SELL_VALUE : ARROW_SELL_VALUE;
  addItem('rupees', value);
  if (player.arrows[id] <= 0 && player.activeArrowElement === id) {
    player.activeArrowElement = null;
  }
  const elem = plain ? { icon: '🏹', label: 'Plain' } : SWORD_ELEMENTS[id];
  showMsg(`💰 Sold 1 ${elem.icon} ${elem.label} Arrow for ${value} rupees`, 2500);
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

function sellTrophy(key) {
  const t = TROPHY_SELL.find(x => x.key === key);
  if (!t) return;
  const count = player[key] || 0;
  if (count <= 0) return;
  player[key] = 0;
  const earned = count * t.value;
  addItem('rupees', earned);
  showMsg(`💰 Sold ${count} ${t.icon} ${t.label}${count > 1 ? 's' : ''} for ${earned} rupees`, 3000);
  renderStoreContents();
  updateHUD();
}

function sellPotionItem(key) {
  const p = POTION_SELL.find(x => x.key === key);
  if (!p) return;
  if ((player[key] || 0) <= 0) return;
  player[key]--;
  addItem('rupees', p.value);
  showMsg(`💰 Sold 1 ${p.icon} ${p.label} for ${p.value} rupees`, 2500);
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

// ─── Blacksmith ───────────────────────────────────────────────────────────────
// The armorer of the village — handles ALL armor. Forges flat physical armor
// pieces (each adds to player.armor) and forges / buys back the elemental
// armors that halve matching damage. No armor is sold anywhere else.

// Elemental armor: forge any you sold; sell off ones you own for rupees.
const ELEMENTAL_ARMOR_COST       = 200;
const ELEMENTAL_ARMOR_SELL_VALUE = 100;

// Flat physical-armor pieces. Repurchasable; each adds `armor` points to the
// player's flat armor total (shown as 🛡 Armor +N in the HUD).
const SMITH_ARMOR_PIECES = [
  { id: 'leather', label: '🛡️ Leather Armor', armor: 1, cost: 60,
    desc: '+1 Armor — light hide protection' },
  { id: 'chain',   label: '🛡️ Chainmail',     armor: 2, cost: 140,
    desc: '+2 Armor — interlocking steel rings' },
  { id: 'plate',   label: '🛡️ Plate Armor',   armor: 3, cost: 240,
    desc: '+3 Armor — full forged steel plate' },
];

function openBlacksmithModal() {
  shopOpen = true;
  document.getElementById('smith-modal-overlay').classList.add('open');
  renderBlacksmithContents();
}

function renderBlacksmithContents() {
  // Flat physical armor pieces.
  const pieceRows = SMITH_ARMOR_PIECES.map(p => {
    const broke = player.rupees < p.cost;
    return `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${p.label}</div>
          <div class="shop-item-meta">${p.desc}</div>
        </div>
        <button class="ssbtn" ${broke ? 'disabled' : ''} onclick="buyArmorPiece('${p.id}')">
          💰 ${p.cost}
        </button>
      </div>
    `;
  }).join('');

  // Elemental armor: one row per element, forge (buy) or sell back.
  const ownedArmors = new Set(player.armorElements || []);
  const armorsRows =
    `<div style="margin-top:14px;border-top:1px solid #2a3a4a;padding-top:10px;font-size:12px;color:#8cb0ff">
      Elemental Armor · ${ELEMENTAL_ARMOR_COST}💰 each · sell back ${ELEMENTAL_ARMOR_SELL_VALUE}💰 · halves matching damage
    </div>` +
    ELEMENT_ORDER.map(id => {
      const elem = SWORD_ELEMENTS[id];
      if (!elem) return '';
      const owned = ownedArmors.has(id);
      const equipped = player.activeArmorElement === id;
      const cantBuy = owned || player.rupees < ELEMENTAL_ARMOR_COST;
      const tag = owned ? (equipped ? '<span style="color:#88ccff">✓ worn</span>' : '<span style="color:#88cc88">✓ owned</span>') : '';
      return `
        <div class="shop-row">
          <div class="shop-item">
            <div class="shop-item-name">🛡${elem.icon} ${elem.label} Armor ${tag}</div>
            <div class="shop-item-meta">Halves incoming ${elem.label} damage when worn${id === 'water' ? ' · lets you swim through medium-depth water' : ''}</div>
          </div>
          <button class="ssbtn" ${cantBuy ? 'disabled' : ''} onclick="buyElementalArmor('${id}')">
            💰 ${ELEMENTAL_ARMOR_COST}
          </button>
          <button class="ssbtn" ${!owned ? 'disabled' : ''} onclick="sellElementalArmor('${id}')">
            ➜ 💰${ELEMENTAL_ARMOR_SELL_VALUE}
          </button>
        </div>
      `;
    }).join('');

  document.getElementById('smith-modal').innerHTML = `
    <h2>🔨 Blacksmith's Forge</h2>
    <div class="shop-greeting">Need armor, hero? I forge the finest in the land.</div>
    <div class="shop-rupees">You have: 💰 <b>${player.rupees}</b> · 🛡 Armor +${player.armor || 0}</div>
    ${pieceRows}
    ${armorsRows}
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function buyArmorPiece(id) {
  const p = SMITH_ARMOR_PIECES.find(x => x.id === id);
  if (!p) return;
  if (player.rupees < p.cost) return;
  player.rupees -= p.cost;
  player.armor = (player.armor || 0) + p.armor;
  showMsg(`🔨 Forged ${p.label} — Armor now +${player.armor}`, 3000);
  renderBlacksmithContents();
  updateHUD();
}

// ─── Herbalist ──────────────────────────────────────────────────────────────
// Trades foraged ingredients for medicine: 1 🍄 Mushroom + 1 🌿 Herbal + 5 💰
// brews 1 🧪 Health Potion. Ingredients are gathered by cutting mushrooms and
// flowers out in the forest (see projectiles.js).
const HERB_POTION_RECIPE = { mushrooms: 1, herbals: 1, rupees: 5 };

// Fire-region exclusive: the Herbalist of the Oasis brews a stronger remedy from
// monster trophies — 1 🫀 Organ + 1 🪶 Feather + 50 💰 → 1 🍶 Medium Potion (1d8).
const MED_POTION_RECIPE = { organs: 1, feathers: 1, rupees: 50 };

function openHerbalistModal() {
  shopOpen = true;
  document.getElementById('herb-modal-overlay').classList.add('open');
  renderHerbalistContents();
}

// True only when the player has every ingredient AND isn't already capped on
// potions (brewing a potion you can't carry would waste the ingredients).
function canBrewHerbPotion() {
  return (player.mushrooms || 0) >= HERB_POTION_RECIPE.mushrooms &&
         (player.herbals   || 0) >= HERB_POTION_RECIPE.herbals   &&
         (player.rupees    || 0) >= HERB_POTION_RECIPE.rupees    &&
         (player.potions   || 0) <  ITEM_CAP;
}

function renderHerbalistContents() {
  // The fire-region Herbalist (Oasis of the Damned) also brews a stronger remedy.
  const cm = currentMap();
  const inFire = !!cm && cm.biome === 'fire';

  const have = `🍄 ${player.mushrooms || 0} · 🌿 ${player.herbals || 0} · 💰 ${player.rupees || 0} · 🧪 ${player.potions || 0}` +
    (inFire ? ` · 🫀 ${player.organs || 0} · 🪶 ${player.feathers || 0} · 🍶 ${player.medPotions || 0}` : '');

  const capped = (player.potions || 0) >= ITEM_CAP;
  const meta = capped
    ? `Your satchel can't hold more potions (max ${ITEM_CAP})`
    : 'Heals 1d4 · Costs 🍄 1 Mushroom + 🌿 1 Herbal + 💰 5';

  // Fire-only medium-potion recipe row.
  let medRow = '';
  if (inFire) {
    const medCapped = (player.medPotions || 0) >= ITEM_CAP;
    const medMeta = medCapped
      ? `Your satchel can't hold more medium potions (max ${ITEM_CAP})`
      : 'Heals 1d8 · Costs 🫀 1 Organ + 🪶 1 Feather + 💰 50';
    medRow = `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">🍶 Brew a Medium Health Potion <span style="color:#88cc88">x${player.medPotions || 0}</span></div>
          <div class="shop-item-meta">${medMeta}</div>
        </div>
        <button class="ssbtn" ${canBrewMedPotion() ? '' : 'disabled'} onclick="brewMedPotion()">
          🫀🪶 + 💰50
        </button>
      </div>
    `;
  }

  document.getElementById('herb-modal').innerHTML = `
    <h2>🌿 Herbalist's Hut</h2>
    <div class="shop-greeting">Bring me mushrooms and herbs, and I'll brew you a remedy.</div>
    <div class="shop-rupees">You have: ${have}</div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🧪 Brew a Health Potion</div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      <button class="ssbtn" ${canBrewHerbPotion() ? '' : 'disabled'} onclick="brewHerbPotion()">
        🍄🌿 + 💰5
      </button>
    </div>
    ${medRow}
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function brewHerbPotion() {
  if (!canBrewHerbPotion()) return;
  player.mushrooms -= HERB_POTION_RECIPE.mushrooms;
  player.herbals   -= HERB_POTION_RECIPE.herbals;
  player.rupees    -= HERB_POTION_RECIPE.rupees;
  addItem('potions', 1);
  showMsg('🧪 The Herbalist brews you a Health Potion!', 3000);
  renderHerbalistContents();
  updateHUD();
}

// Fire-region medium potion: needs both trophies + rupees, and room to carry it.
function canBrewMedPotion() {
  return (player.organs    || 0) >= MED_POTION_RECIPE.organs   &&
         (player.feathers  || 0) >= MED_POTION_RECIPE.feathers &&
         (player.rupees    || 0) >= MED_POTION_RECIPE.rupees   &&
         (player.medPotions || 0) <  ITEM_CAP;
}

function brewMedPotion() {
  if (!canBrewMedPotion()) return;
  player.organs   -= MED_POTION_RECIPE.organs;
  player.feathers -= MED_POTION_RECIPE.feathers;
  player.rupees   -= MED_POTION_RECIPE.rupees;
  addItem('medPotions', 1);
  showMsg('🍶 The Herbalist brews you a Medium Health Potion (heals 1d8)!', 3000);
  renderHerbalistContents();
  updateHUD();
}

// ─── Close / open helpers ─────────────────────────────────────────────────────
const SHOP_OVERLAY_IDS = ['inn-modal-overlay', 'store-modal-overlay', 'herb-modal-overlay', 'smith-modal-overlay'];

function closeShopModals() {
  shopOpen = false;
  SHOP_OVERLAY_IDS.forEach(id => document.getElementById(id).classList.remove('open'));
  // Drop any keys that were "held" while the modal was up so the player doesn't
  // immediately walk back onto the door tile and re-open the same modal.
  for (const k of Object.keys(keys)) keys[k] = false;
}

// Close on click outside the modal
document.addEventListener('DOMContentLoaded', () => {
  SHOP_OVERLAY_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => { if (e.target === el) closeShopModals(); });
  });
});
// Fallback for when the script loads after DOMContentLoaded already fired.
SHOP_OVERLAY_IDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => { if (e.target === el) closeShopModals(); });
});
