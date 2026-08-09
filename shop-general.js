// General Store — buy/sell/forage vendor
// Split out of shop.js (event-driven modal code; plain <script> globals). Shared
// economy helpers live in shop-blacksmith.js; all cross-file calls run at runtime.

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
  { id: 'bombs', label: '💣 Bombs ×5',    cost: 60,
    desc: 'A bundle of 5 bombs — lob to blast enemies & crack rocks',
    apply: () => { addItem('bombs', 5); } },
  // Elemental swords aren't sold or dropped — each is forged at its home region's
  // Blacksmith (see forgeRegionalSword). The store only buys them back; see the
  // sell list rendered separately.
];

// Sell value the store offers per elemental sword (flat per element).
const ELEMENTAL_SELL_VALUE = 150;

// Elemental arrows: bought in packs, sold individually. Plain arrows trade at
// half price — no elemental rider on the hit.
const ARROW_PACK_SIZE  = 5;
const ARROW_PACK_COST  = 50;     // 50 rubies for 5 arrows
const ARROW_SELL_VALUE = 5;      // 5 rubies per arrow sold back
const PLAIN_ARROW_PACK_COST  = 25;
const PLAIN_ARROW_SELL_VALUE = 2;

// Monster trophies + foraged goods the General Store buys back. Values climb
// roughly with the region tier the trophy drops in (see ENEMY_DROPS in
// player.js). The store cashes in the whole stack at once.
const TROPHY_SELL = [
  // Monster-trophy sell rows — derived from the TROPHIES registry (config.js) in
  // registry order, so `value` lives in exactly one place.
  ...TROPHIES.map(t => ({ key: t.id + 's', icon: t.icon, label: t.label, value: t.value })),
  { key: 'herbals',    icon: '🌿', label: 'Herbal',         value: 5  },
  { key: 'mushrooms',  icon: '🍄', label: 'Mushroom',       value: 5  },
  { key: 'bonemeal',   icon: '🧂', label: 'Bone Meal',      value: 8  },
  { key: 'snowballs',  icon: '⚪', label: 'Snowball',       value: 6  },
  // Region-specific foraged goods — cut from each region's signature foliage
  // (see doSwordSwing in projectiles.js). Each is only collectible in one
  // region, so each region's shop is the sole buyer (see REGION_FORAGE). Values
  // climb gently with region tier but stay modest crafting-tier prices.
  { key: 'fiddleheads',  icon: '🌿', label: 'Fiddlehead',   value: 5  },  // forest
  { key: 'aloe',         icon: '🪴', label: 'Aloe',         value: 6  },  // fire
  { key: 'seashells',    icon: '🐚', label: 'Seashell',     value: 7  },  // water
  { key: 'corals',       icon: '🪸', label: 'Coral',        value: 8  },  // water
  { key: 'winterberries',icon: '🫐', label: 'Winter Berry', value: 7  },  // ice
  { key: 'frostpetals',  icon: '💮', label: 'Frost Petal',  value: 8  },  // ice
  { key: 'frostferns',   icon: '❄️', label: 'Frost Fern',   value: 8  },  // ice
  { key: 'sage',         icon: '🌿', label: 'Sage',         value: 8  },  // earth
  { key: 'moss',         icon: '🌱', label: 'Moss',         value: 7  },  // earth
  { key: 'crystals',     icon: '🔮', label: 'Crystal',      value: 12 },  // earth
  { key: 'skypetals',    icon: '🌸', label: 'Sky Petal',    value: 9  },  // air
  { key: 'windseeds',    icon: '🌾', label: 'Wind Seed',    value: 9  },  // air
  { key: 'thistledown',  icon: '💨', label: 'Thistle Down', value: 10 },  // air
  { key: 'voltpetals',   icon: '🌼', label: 'Volt Petal',   value: 10 },  // lightning
  { key: 'sparkseeds',   icon: '🌾', label: 'Spark Seed',   value: 10 },  // lightning
  { key: 'fulgurites',   icon: '🔷', label: 'Fulgurite',    value: 13 },  // lightning
  { key: 'sunseeds',     icon: '🌟', label: 'Sun Seed',     value: 12 },  // luminous
  { key: 'prisms',       icon: '🔆', label: 'Prism Shard',  value: 14 },  // luminous
  { key: 'witherwood',   icon: '🪵', label: 'Witherwood',   value: 9  },  // necrotic
  { key: 'graveblooms',  icon: '🥀', label: 'Grave Bloom',  value: 11 },  // necrotic
  { key: 'reedpith',     icon: '🌾', label: 'Reed Pith',    value: 10 },  // poison
  { key: 'manapetals',   icon: '🪻', label: 'Mana Petal',   value: 15 },  // mana
  { key: 'heartfronds',  icon: '🍃', label: 'Heart Frond',  value: 14 },  // mana
  { key: 'glowcaps',     icon: '🍄', label: 'Glow Cap',     value: 13 },  // mana
  { key: 'emberblooms',  icon: '🏵️', label: 'Emberbloom',   value: 10 },  // volcanic
  { key: 'sulfurmoss',   icon: '🍂', label: 'Sulfur Moss',   value: 10 },  // volcanic
  { key: 'duskcaps',     icon: '🍄', label: 'Duskcap',       value: 16 },  // shadow
  { key: 'voidpetals',   icon: '🌌', label: 'Void Petal',    value: 17 },  // shadow
  // Raw ores (see ORE_TYPES) — a rare 5% small-chest find, the type set by the
  // region. Unlike forage, ores are prized everywhere: every General Store buys
  // all five (see the ore section in renderStoreContents), not just the locals.
  { key: 'grimsilver',  icon: '🔘', label: 'Grimsilver',  value: 20  },
  { key: 'emberbrass',  icon: '🟠', label: 'Emberbrass',  value: 35  },
  { key: 'glimmerspar', icon: '🔵', label: 'Glimmerspar', value: 60  },
  { key: 'wyrmgold',    icon: '🟡', label: 'Wyrmgold',    value: 95  },
  { key: 'eclipsium',   icon: '🟣', label: 'Eclipsium',   value: 150 },
  { key: 'voidsteel',   icon: '⬛', label: 'Voidsteel',   value: 230 },
];

// Fresh-hero defaults (0) for every field-earned sellable — the foraged goods,
// snowballs, and raw ores in TROPHY_SELL. Unlike granted trophies (trophyDefaults)
// these keys are never listed in the player defaults; they spring into existence
// via addItem the first time one is picked up. Zeroing them from the single
// authoritative sell table means a New Game and an old save both clear stale
// stock in exactly one place, so a newly-added sellable resets automatically.
// (Trophy keys reappear here harmlessly — trophyDefaults already zeroes them.)
function sellableDefaults() {
  const o = {};
  for (const s of TROPHY_SELL) o[s.key] = 0;
  return o;
}

// Potions sell one at a time (selling the whole stack at once would be too
// easy to fat-finger). Values stay below brew cost so there's no money loop.
const POTION_SELL = [
  { key: 'potions',    icon: '🧪', label: regionPotionName('forest'), value: 10 },
];

// ─── Region-specific stock ────────────────────────────────────────────────────
// Each region's General Store only buys drops collectible in that region and
// only sells arrows of that region's element. The buyable set per region is the
// union of:
//   • that region's monster trophies — computed at runtime from ENEMY_POOLS +
//     ENEMY_DROPS so it stays in sync as the drop tables evolve, and
//   • that region's foraged goods — keyed below by region id (the foliage each
//     region scatters, see the scatter*Foliage builders in map-gen.js). Every
//     key here must also have a TROPHY_SELL entry so the row can render.
const REGION_FORAGE = {
  forest:    ['herbals', 'mushrooms', 'fiddleheads'],
  fire:      ['herbals', 'bonemeal', 'aloe'],
  water:     ['stones', 'seashells', 'corals'],
  ice:       ['winterberries', 'frostpetals', 'frostferns', 'snowballs'],
  earth:     ['sage', 'moss', 'crystals'],
  volcanic:  ['emberblooms', 'sulfurmoss'],
  air:       ['skypetals', 'windseeds', 'thistledown'],
  lightning: ['voltpetals', 'sparkseeds', 'fulgurites'],
  luminous:  ['motes', 'sunseeds', 'prisms'],
  necrotic:  ['bonemeal', 'witherwood', 'graveblooms'],
  poison:    ['reedpith', 'herbals', 'mushrooms'],
  mana:      ['manapetals', 'heartfronds', 'glowcaps'],
  shadow:    ['duskcaps', 'voidpetals'],
};

// Resolve the region the store sits in. Village/overworld maps both carry
// `regionIdx`; fall back to the biome string, then to forest.
function storeRegion() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  // Elderbrook is the one exception. Its market row trades at the world's last
  // region's rates rather than its own forest biome, so every price, recipe,
  // stock list and forge toll below resolves as it would in the final village.
  // Gated on `activated` so the burnt-out ruin — which has no shops at all — is
  // never treated as a trading post. See homeVillageShopRegionIdx.
  if (cm && cm.type === 'homevillage' && cm.activated &&
      typeof homeVillageShopRegionIdx === 'function') {
    const hvIdx = homeVillageShopRegionIdx();
    return { idx: hvIdx, region: (typeof REGIONS !== 'undefined' ? REGIONS[hvIdx] : null) };
  }
  let idx = (cm && typeof cm.regionIdx === 'number') ? cm.regionIdx : -1;
  if (idx < 0 && cm && typeof REGIONS !== 'undefined') {
    idx = REGIONS.findIndex(r => r.id === cm.biome);
  }
  if (idx < 0) idx = 0;
  return { idx, region: (typeof REGIONS !== 'undefined' ? REGIONS[idx] : null) };
}

// #7 Lost Caravan reward: a permanent General Store discount in the region whose
// caravan has been escorted home. Returns the price multiplier (1 normally).
function storeDiscountFactor() {
  const { region } = storeRegion();
  const rid = region ? region.id : null;
  const d = (rid && player.storeDiscounts) ? (player.storeDiscounts[rid] || 0) : 0;
  return 1 - Math.min(0.9, Math.max(0, d));
}
// A base price after the active region discount (used for both display and charge).
function discountedCost(base) { return Math.max(0, Math.round(base * storeDiscountFactor())); }

// The set of inventory keys this region's store buys: monster trophies (from the
// region's enemy pool) plus its foraged goods.
function regionBuyKeys(regionIdx, regionId) {
  const keys = new Set();
  const pool = (typeof ENEMY_POOLS !== 'undefined' && ENEMY_POOLS[regionIdx]) || [];
  for (const type of pool) {
    for (const d of ((typeof ENEMY_DROPS !== 'undefined' && ENEMY_DROPS[type]) || [])) {
      // Skip non-trophy drops (potions, arrow packs); trophy inventory key is
      // the plural of the drop type (fang → fangs), matching the pickup logic.
      if (d.type === 'potion' || d.type === 'arrows') continue;
      keys.add(d.type + 's');
    }
  }
  for (const k of (REGION_FORAGE[regionId] || [])) keys.add(k);
  return keys;
}

function openStoreModal() {
  shopOpen = true;
  const overlay = document.getElementById('store-modal-overlay');
  overlay.classList.add('open');
  renderStoreContents();
}

function renderStoreContents() {
  // Which region this store sits in — drives its region-specific stock.
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const regionName = region && region.id
    ? region.id.charAt(0).toUpperCase() + region.id.slice(1)
    : 'Forest';

  const buyRows = STORE_ITEMS.map(it => {
    const cost = discountedCost(it.cost);
    const broke = player.rubies < cost;
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
          💰 ${cost}
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
            <div class="shop-item-name">${elemIconHTML(elem)} ${elem.label} Sword</div>
            <div class="shop-item-meta">Sell for rubies</div>
          </div>
          <button class="ssbtn" onclick="sellElementalSword('${id}')">
            ➜ 💰 ${ELEMENTAL_SELL_VALUE}
          </button>
        </div>
      `;
    }).join('');

  // Arrows section: every store sells plain arrows in 5-arrow bundles. Elemental
  // regions additionally stock their own element's arrows. Renders a buy/sell
  // row for a given arrow id.
  const arrowRowHTML = (id) => {
    const plain = id === 'plain';
    const elem = plain ? { label: 'Plain', icon: '🏹' } : SWORD_ELEMENTS[id];
    const count = (player.arrows && player.arrows[id]) || 0;
    const packCost = discountedCost(plain ? PLAIN_ARROW_PACK_COST : ARROW_PACK_COST);
    const sellVal  = plain ? PLAIN_ARROW_SELL_VALUE : ARROW_SELL_VALUE;
    const meta = plain
      ? 'Standard ammunition — no elemental rider'
      : `+1d4 ${elem.label} on hit`;
    return `<div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">${plain ? '🏹' : elemIconHTML(elem)} ${elem.label} Arrow <span style="color:#88cc88">x${count}</span> <span style="color:#778877">· ${ARROW_PACK_SIZE}-pack ${packCost}💰 (sell ${sellVal}💰)</span></div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      <button class="ssbtn" ${player.rubies < packCost ? 'disabled' : ''} onclick="buyElementalArrows('${id}')">
        +${ARROW_PACK_SIZE} 💰${packCost}
      </button>
      <button class="ssbtn" ${count <= 0 ? 'disabled' : ''} onclick="sellElementalArrow('${id}')">
        -1 ➜ 💰${sellVal}
      </button>
    </div>`;
  };
  // Plain arrows are stocked everywhere; elemental regions add their own element.
  const arrowIds = SWORD_ELEMENTS[regionId] ? [regionId, 'plain'] : ['plain'];
  const arrowsRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#aacc88">
      Arrows · ${ARROW_PACK_SIZE}-arrow bundles
    </div>` +
    arrowIds.map(arrowRowHTML).join('');

  // Trophy / forage sell section — region-scoped. The store only buys drops
  // collectible in THIS region (its monster trophies + its foraged goods, see
  // regionBuyKeys). All of them are shown so the shop's local specialty reads
  // clearly; the sell button is disabled until the player actually carries some.
  const buyKeys = regionBuyKeys(regionIdx, regionId);
  const regionTrophies = TROPHY_SELL.filter(t => buyKeys.has(t.key));
  const trophyRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#cc9988">
      We buy ${regionName} spoils — local trophies &amp; foraged goods only:
    </div>` +
    (regionTrophies.length === 0
      ? `<div style="font-size:11px;color:#778877;padding:6px 2px">
          Nothing to trade here just yet.
        </div>`
      : regionTrophies.map(t => {
          const count = player[t.key] || 0;
          const none = count <= 0;
          return `
            <div class="shop-row">
              <div class="shop-item">
                <div class="shop-item-name">${t.icon} ${t.label} <span style="color:#88cc88">x${count}</span></div>
                <div class="shop-item-meta">Sell for ${t.value}💰 each</div>
              </div>
              <button class="ssbtn" ${none ? 'disabled' : ''} onclick="sellTrophy('${t.key}')">
                ${none ? `💰${t.value}` : `All ➜ 💰${count * t.value}`}
              </button>
            </div>
          `;
        }).join(''));

  // Precious ores — bought at every store regardless of region, since an ore
  // isn't a local spoil (a rare small-chest find, see ORE_TYPES). All five are
  // listed so their relative worth reads clearly; the sell button stays disabled
  // until the player actually carries some.
  const oreRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#cc9988">
      We pay top ruby for raw ore — any kind, brought from anywhere:
    </div>` +
    (typeof ORE_TYPES === 'undefined' ? '' : ORE_TYPES.map(o => {
      const count = player[o.id] || 0;
      const none = count <= 0;
      return `
        <div class="shop-row">
          <div class="shop-item">
            <div class="shop-item-name">${o.icon} ${o.label} <span style="color:#88cc88">x${count}</span></div>
            <div class="shop-item-meta">Sell for ${o.value}💰 each</div>
          </div>
          <button class="ssbtn" ${none ? 'disabled' : ''} onclick="sellTrophy('${o.id}')">
            ${none ? `💰${o.value}` : `All ➜ 💰${count * o.value}`}
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
    <div class="shop-greeting">Greetings, traveler! Care to spend some rubies?</div>
    <div class="shop-rubies">You have: 💰 <b>${player.rubies}</b></div>
    ${buyRows}
    ${arrowsRows}
    ${trophyRows}
    ${oreRows}
    ${potionRows}
    ${sellRows}
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function sellElementalArmor(id) {
  player.armorElements = player.armorElements || [];
  const idx = player.armorElements.indexOf(id);
  if (idx < 0) return;
  const elem = SWORD_ELEMENTS[id];
  if (!elem) return;
  player.armorElements.splice(idx, 1);
  if (player.armorUpgrades) delete player.armorUpgrades[id];   // drop its upgrade level — a re-forge starts at Lv 0
  if (player.activeArmorElement === id) player.activeArmorElement = null;
  addItem('rubies', ELEMENTAL_ARMOR_SELL_VALUE);
  showMsg(`💰 Sold 🛡${elem.icon} ${elem.label} Armor for ${ELEMENTAL_ARMOR_SELL_VALUE} rubies`, 3000);
  renderBlacksmithContents();
  updateHUD();
}

function buyElementalArrows(id) {
  const plain = id === 'plain';
  if (!plain && !SWORD_ELEMENTS[id]) return;
  const cost = discountedCost(plain ? PLAIN_ARROW_PACK_COST : ARROW_PACK_COST);
  if (player.rubies < cost) return;
  player.rubies -= cost;
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
  addItem('rubies', value);
  if (player.arrows[id] <= 0 && player.activeArrowElement === id) {
    player.activeArrowElement = null;
  }
  const elem = plain ? { icon: '🏹', label: 'Plain' } : SWORD_ELEMENTS[id];
  showMsg(`💰 Sold 1 ${elem.icon} ${elem.label} Arrow for ${value} rubies`, 2500);
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
  if (player.swordUpgrades) delete player.swordUpgrades[id];   // drop its upgrade level — a re-won sword starts at Lv 0
  // If the player was wielding this sword, fall back to the base sword
  if (player.activeSwordElement === id) player.activeSwordElement = null;
  addItem('rubies', ELEMENTAL_SELL_VALUE);
  showMsg(`💰 Sold ${elem.icon} ${elem.label} Sword for ${ELEMENTAL_SELL_VALUE} rubies`, 3000);
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
  addItem('rubies', earned);
  showMsg(`💰 Sold ${count} ${t.icon} ${t.label}${count > 1 ? 's' : ''} for ${earned} rubies`, 3000);
  renderStoreContents();
  updateHUD();
}

function sellPotionItem(key) {
  const p = POTION_SELL.find(x => x.key === key);
  if (!p) return;
  if ((player[key] || 0) <= 0) return;
  player[key]--;
  addItem('rubies', p.value);
  showMsg(`💰 Sold 1 ${p.icon} ${p.label} for ${p.value} rubies`, 2500);
  renderStoreContents();
  updateHUD();
}

function buyStoreItem(id) {
  const it = STORE_ITEMS.find(x => x.id === id);
  if (!it) return;
  if (it.canBuy && !it.canBuy()) return;
  const cost = discountedCost(it.cost);
  if (player.rubies < cost) return;
  player.rubies -= cost;
  it.apply();
  showMsg(`🛒 Purchased ${it.label}!`, 3000);
  renderStoreContents();
  updateHUD();
}

// ─── Blacksmith ───────────────────────────────────────────────────────────────
// The armorer of the village — handles ALL armor. Forges flat physical armor
// from the region's own ore (each adds to player.armor) and forges the ONE
// elemental armor native to its region (the element matching the region id),
// which blocks 50–80% of matching damage as it is upgraded. It also upgrades any
// owned elemental armor whose next ore tier matches this village's ore (see
// upgradeRegionalArmor). No armor is sold elsewhere.

