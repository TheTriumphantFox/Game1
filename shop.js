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
  // Per-enemy signature trophies — one unique spoil per enemy (see ENEMY_DROPS).
  { key: 'dryad_blooms',       icon: '🌷', label: 'Dryad Bloom',        value: 12 },
  { key: 'gnoll_fangs',        icon: '🦷', label: 'Gnoll Fang',         value: 14 },
  { key: 'hound_fangs',        icon: '🦷', label: 'Hellhound Fang',     value: 16 },
  { key: 'salamander_hides',   icon: '🦎', label: 'Salamander Hide',    value: 16 },
  { key: 'kuotoa_gills',       icon: '🐠', label: 'Kuo-toa Gill',       value: 16 },
  { key: 'shark_tooths',       icon: '🦈', label: 'Shark Tooth',        value: 18 },
  { key: 'hag_hairs',          icon: '🧶', label: 'Sea Hag Hair',       value: 18 },
  { key: 'frost_fangs',        icon: '❄️', label: 'Frost Fang',         value: 22 },
  { key: 'rimes',              icon: '🧊', label: 'Rime Crystal',       value: 26 },
  { key: 'acid_glands',        icon: '🧪', label: 'Acid Gland',         value: 24 },
  { key: 'displacer_hides',    icon: '🐆', label: 'Displacer Hide',     value: 26 },
  { key: 'bulette_plates',     icon: '🛡️', label: 'Bulette Plate',      value: 30 },
  { key: 'earth_hearts',       icon: '🟤', label: 'Earthen Heart',      value: 38 },
  { key: 'granites',           icon: '🗿', label: 'Granite Slab',       value: 28 },
  { key: 'harpy_plumes',       icon: '🪶', label: 'Harpy Plume',        value: 24 },
  { key: 'griffon_feathers',   icon: '🦅', label: 'Griffon Feather',    value: 26 },
  { key: 'manticore_spikes',   icon: '🗡️', label: 'Manticore Spike',    value: 28 },
  { key: 'zephyrs',            icon: '🌀', label: 'Zephyr Wisp',        value: 38 },
  { key: 'wyvern_scales',      icon: '🐲', label: 'Wyvern Scale',       value: 32 },
  { key: 'roc_plumes',         icon: '🪶', label: 'Roc Plume',          value: 30 },
  { key: 'wyrmling_scales',    icon: '🐉', label: 'Wyrmling Scale',     value: 30 },
  { key: 'behir_scales',       icon: '🐍', label: 'Behir Scale',        value: 32 },
  { key: 'bluedragon_scales',  icon: '🐉', label: 'Blue Dragon Scale',  value: 36 },
  { key: 'stormgiant_bolts',   icon: '🌩️', label: 'Tempest Bolt',       value: 40 },
  { key: 'pegasus_feathers',   icon: '🪽', label: 'Pegasus Feather',    value: 36 },
  { key: 'couatl_scales',      icon: '🌈', label: 'Couatl Scale',       value: 36 },
  { key: 'kirin_horns',        icon: '🦌', label: 'Ki-rin Horn',        value: 40 },
  { key: 'planetar_halos',     icon: '😇', label: 'Planetar Halo',      value: 48 },
  { key: 'wraith_shrouds',     icon: '🧣', label: 'Wraith Shroud',      value: 42 },
  { key: 'vampire_fangs',      icon: '🧛', label: 'Vampire Fang',       value: 40 },
  { key: 'phylacterys',        icon: '🔮', label: 'Phylactery',         value: 50 },
  { key: 'crawler_venoms',     icon: '🐛', label: 'Carrion Bile',       value: 28 },
  { key: 'troll_hides',        icon: '🟢', label: 'Troll Hide',         value: 30 },
  { key: 'otyugh_tentacles',   icon: '🦑', label: 'Otyugh Tentacle',    value: 30 },
  { key: 'treant_heartwoods',  icon: '🪵', label: 'Heartwood',          value: 30 },
  { key: 'greendragon_scales', icon: '🐉', label: 'Green Dragon Scale', value: 38 },
  { key: 'worm_stingers',      icon: '🪱', label: 'Worm Stinger',       value: 36 },
  { key: 'horror_plates',      icon: '🛡️', label: 'Animus Plate',       value: 42 },
  { key: 'gith_blades',        icon: '⚔️', label: 'Githyanki Blade',    value: 48 },
  { key: 'eyestalks',          icon: '👁️', label: 'Eyestalk',           value: 52 },
  { key: 'rakshasa_claws',     icon: '🐾', label: 'Rakshasa Claw',      value: 50 },
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
];

// Potions sell one at a time (selling the whole stack at once would be too
// easy to fat-finger). Values stay below brew cost so there's no money loop.
const POTION_SELL = [
  { key: 'potions',    icon: '🧪', label: 'Health Potion', value: 10 },
  { key: 'medPotions', icon: '🍶', label: 'Medium Potion', value: 25 },
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
  air:       ['skypetals', 'windseeds', 'thistledown'],
  lightning: ['voltpetals', 'sparkseeds', 'fulgurites'],
  luminous:  ['motes', 'sunseeds', 'prisms'],
  necrotic:  ['bonemeal', 'witherwood', 'graveblooms'],
  poison:    ['reedpith', 'herbals', 'mushrooms'],
  mana:      ['manapetals', 'heartfronds', 'glowcaps'],
};

// Resolve the region the store sits in. Village/overworld maps both carry
// `regionIdx`; fall back to the biome string, then to forest.
function storeRegion() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  let idx = (cm && typeof cm.regionIdx === 'number') ? cm.regionIdx : -1;
  if (idx < 0 && cm && typeof REGIONS !== 'undefined') {
    idx = REGIONS.findIndex(r => r.id === cm.biome);
  }
  if (idx < 0) idx = 0;
  return { idx, region: (typeof REGIONS !== 'undefined' ? REGIONS[idx] : null) };
}

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
            <div class="shop-item-name">${elemIconHTML(elem)} ${elem.label} Sword</div>
            <div class="shop-item-meta">Sell for rupees</div>
          </div>
          <button class="ssbtn" onclick="sellElementalSword('${id}')">
            ➜ 💰 ${ELEMENTAL_SELL_VALUE}
          </button>
        </div>
      `;
    }).join('');

  // Arrows section: each region's store stocks only ONE arrow type — its own
  // element (plain in the elementless forest). A region with element 'fire'
  // sells fire arrows; forest sells plain. Both buy + sell controls for that
  // single type.
  const arrowId = (typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[regionId])
    ? regionId : 'plain';
  const arrowPlain = arrowId === 'plain';
  const arrowElem = arrowPlain
    ? { label: 'Plain', icon: '🏹' }
    : SWORD_ELEMENTS[arrowId];
  const arrowCount = (player.arrows && player.arrows[arrowId]) || 0;
  const arrowPackCost = arrowPlain ? PLAIN_ARROW_PACK_COST : ARROW_PACK_COST;
  const arrowSellVal  = arrowPlain ? PLAIN_ARROW_SELL_VALUE : ARROW_SELL_VALUE;
  const arrowMeta = arrowPlain
    ? 'Standard ammunition — no elemental rider'
    : `+1d4 ${arrowElem.label} on hit`;
  const arrowsRows =
    `<div style="margin-top:14px;border-top:1px solid #2a4a2a;padding-top:10px;font-size:12px;color:#aacc88">
      ${regionName} arrows · ${ARROW_PACK_SIZE}-pack ${arrowPackCost}💰 (sell ${arrowSellVal}💰)
    </div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">${arrowPlain ? '🏹' : elemIconHTML(arrowElem)} ${arrowElem.label} Arrow <span style="color:#88cc88">x${arrowCount}</span></div>
        <div class="shop-item-meta">${arrowMeta}</div>
      </div>
      <button class="ssbtn" ${player.rupees < arrowPackCost ? 'disabled' : ''} onclick="buyElementalArrows('${arrowId}')">
        +${ARROW_PACK_SIZE} 💰${arrowPackCost}
      </button>
      <button class="ssbtn" ${arrowCount <= 0 ? 'disabled' : ''} onclick="sellElementalArrow('${arrowId}')">
        -1 ➜ 💰${arrowSellVal}
      </button>
    </div>`;

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
            <div class="shop-item-name">🛡${elemIconHTML(elem)} ${elem.label} Armor ${tag}</div>
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
