// Herbalist potions/elixirs + Collector quest vendor
// Split out of shop.js (event-driven modal code; plain <script> globals). Shared
// economy helpers live in shop-blacksmith.js; all cross-file calls run at runtime.

// ─── Herbalist ──────────────────────────────────────────────────────────────
// The forest Herbalist trades foraged goods for medicine: 1 🍄 Mushroom +
// 1 🌿 Herbal + 5 💰 brews 1 🧪 Health Potion (heals 1d4). Ingredients are
// gathered by cutting mushrooms and flowers out in the forest (see projectiles.js).
const HERB_POTION_RECIPE = { mushrooms: 1, herbals: 1, rubies: 5 };

// Every other region's Herbalist is bespoke (see renderHerbalistContents). Each
// region N (1-indexed; forest=1) brews:
//   • a Health Potion — 2 of its foraged goods + 5N 💰 → heals Nd4
//   • an Elixir — 3 of its monster trophies (distinct from the potion's forage)
//     + 5N 💰 → ELIXIR_IMMUNITY_MS of full immunity to that region's element.
// `heal` keys are forage; `elixir` keys are trophies — both must be valid player
// inventory keys (every key here also appears in TROPHY_SELL so itemMeta resolves
// an icon + label). The immunity element id is the region id itself.
const HERBALIST_RECIPES = {
  fire:      { heal: ['aloe', 'herbals'],            elixir: ['embers', 'salamander_hides', 'hound_fangs'] },
  water:     { heal: ['seashells', 'corals'],        elixir: ['fins', 'shark_tooths', 'cores'] },
  ice:       { heal: ['winterberries', 'frostpetals'], elixir: ['shards', 'rimes', 'frost_fangs'] },
  earth:     { heal: ['sage', 'moss'],               elixir: ['granites', 'earth_hearts', 'bulette_plates'] },
  volcanic:  { heal: ['emberblooms', 'sulfurmoss'],  elixir: ['magma_cores', 'reddragon_scales', 'firesnake_fangs'] },
  air:       { heal: ['skypetals', 'windseeds'],     elixir: ['zephyrs', 'griffon_feathers', 'roc_plumes'] },
  lightning: { heal: ['voltpetals', 'sparkseeds'],   elixir: ['sparks', 'stormgiant_bolts', 'bluedragon_scales'] },
  luminous:  { heal: ['sunseeds', 'prisms'],         elixir: ['motes', 'planetar_halos', 'kirin_horns'] },
  necrotic:  { heal: ['witherwood', 'graveblooms'],  elixir: ['ectoplasms', 'phylacterys', 'wraith_shrouds'] },
  poison:    { heal: ['herbals', 'mushrooms'],       elixir: ['crawler_venoms', 'greendragon_scales', 'worm_stingers'] },
  mana:      { heal: ['manapetals', 'heartfronds'],  elixir: ['brains', 'eyestalks', 'rakshasa_claws'] },
  shadow:    { heal: ['duskcaps', 'voidpetals'],     elixir: ['void_hearts', 'demon_horns', 'bodak_eyes'] },
};

// Resolve a stackable inventory key's icon + display label from TROPHY_SELL.
function itemMeta(key) {
  const t = TROPHY_SELL.find(x => x.key === key);
  return t ? { icon: t.icon, label: t.label } : { icon: '•', label: key };
}

// Which region the Herbalist sits in (reuses storeRegion). N is the 1-indexed
// region number (forest=1) that scales every recipe's heal dice and cost.
function herbRegion() {
  const { idx, region } = storeRegion();
  return { idx, region, id: region ? region.id : 'forest', N: idx + 1 };
}

function openHerbalistModal() {
  shopOpen = true;
  document.getElementById('herb-modal-overlay').classList.add('open');
  renderHerbalistContents();
}

function renderHerbalistContents() {
  const { id: regionId, N } = herbRegion();
  const recipe = HERBALIST_RECIPES[regionId];
  // Forest (and any region without a bespoke recipe) keeps the classic brew.
  if (!recipe) { renderForestHerbalist(); return; }

  const elem = SWORD_ELEMENTS[regionId];
  const name = regionId.charAt(0).toUpperCase() + regionId.slice(1);
  const elemName = elem ? elem.label : name;
  const secs = ((typeof ELIXIR_IMMUNITY_MS !== 'undefined') ? ELIXIR_IMMUNITY_MS : 30000) / 1000;

  // "You have" line: every ingredient this region's recipes consume + rubies.
  const have = [...recipe.heal, ...recipe.elixir]
    .map(k => { const m = itemMeta(k); return `${m.icon} ${player[k] || 0}`; })
    .concat(`💰 ${player.rubies || 0}`).join(' · ');

  // Healing-potion row.
  const potCount = (player.regionPotions && player.regionPotions[regionId]) || 0;
  const potCapped = potCount >= ITEM_CAP;
  const healCost = recipe.heal.map(k => { const m = itemMeta(k); return `${m.icon} 1 ${m.label}`; }).join(' + ');
  const healMeta = potCapped
    ? `Your satchel can't hold more potions (max ${ITEM_CAP})`
    : `Heals ${N}d4 · Costs ${healCost} + 💰 ${5 * N}`;
  const healBtn = recipe.heal.map(k => itemMeta(k).icon).join('');

  // Elixir row.
  const elixCount = (player.elixirs && player.elixirs[regionId]) || 0;
  const elixCapped = elixCount >= ITEM_CAP;
  const elixCost = recipe.elixir.map(k => { const m = itemMeta(k); return `${m.icon} 1 ${m.label}`; }).join(' + ');
  const elixMeta = elixCapped
    ? `Your satchel can't hold more elixirs (max ${ITEM_CAP})`
    : `Immune to ${elemName} for ${secs}s · Costs ${elixCost} + 💰 ${5 * N}`;
  const elixBtn = recipe.elixir.map(k => itemMeta(k).icon).join('');

  document.getElementById('herb-modal').innerHTML = `
    <h2>🌿 Herbalist's Hut</h2>
    <div class="shop-greeting">The ${name} remedies are my craft, traveler — what'll it be?</div>
    <div class="shop-rubies">You have: ${have}</div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🧪 Brew a ${name} Potion <span style="color:#88cc88">x${potCount}</span></div>
        <div class="shop-item-meta">${healMeta}</div>
      </div>
      <button class="ssbtn" ${canBrewRegionPotion(regionId, N) ? '' : 'disabled'} onclick="brewRegionPotion('${regionId}', ${N})">
        ${healBtn} + 💰${5 * N}
      </button>
    </div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">⚗️ Brew a ${elemName} Elixir <span style="color:#88cc88">x${elixCount}</span></div>
        <div class="shop-item-meta">${elixMeta}</div>
      </div>
      <button class="ssbtn" ${canBrewElixir(regionId, N) ? '' : 'disabled'} onclick="brewElixir('${regionId}', ${N})">
        ${elixBtn} + 💰${5 * N}
      </button>
    </div>
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

// The forest Herbalist — unchanged classic 🍄 + 🌿 + 💰5 → 1d4 Health Potion.
function canBrewHerbPotion() {
  return (player.mushrooms || 0) >= HERB_POTION_RECIPE.mushrooms &&
         (player.herbals   || 0) >= HERB_POTION_RECIPE.herbals   &&
         (player.rubies    || 0) >= HERB_POTION_RECIPE.rubies    &&
         (player.potions   || 0) <  ITEM_CAP;
}

function renderForestHerbalist() {
  const have = `🍄 ${player.mushrooms || 0} · 🌿 ${player.herbals || 0} · 💰 ${player.rubies || 0} · 🧪 ${player.potions || 0}`;
  const capped = (player.potions || 0) >= ITEM_CAP;
  const meta = capped
    ? `Your satchel can't hold more potions (max ${ITEM_CAP})`
    : 'Heals 1d4 · Costs 🍄 1 Mushroom + 🌿 1 Herbal + 💰 5';
  document.getElementById('herb-modal').innerHTML = `
    <h2>🌿 Herbalist's Hut</h2>
    <div class="shop-greeting">Bring me mushrooms and herbs, and I'll brew you a remedy.</div>
    <div class="shop-rubies">You have: ${have}</div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🧪 Brew a Health Potion</div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      <button class="ssbtn" ${canBrewHerbPotion() ? '' : 'disabled'} onclick="brewHerbPotion()">
        🍄🌿 + 💰5
      </button>
    </div>
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function brewHerbPotion() {
  if (!canBrewHerbPotion()) return;
  player.mushrooms -= HERB_POTION_RECIPE.mushrooms;
  player.herbals   -= HERB_POTION_RECIPE.herbals;
  player.rubies    -= HERB_POTION_RECIPE.rubies;
  addItem('potions', 1);
  showMsg('🧪 The Herbalist brews you a Health Potion!', 3000);
  renderHerbalistContents();
  updateHUD();
}

// Region Health Potion: needs both forage ingredients + 5N rubies, and room to
// carry one more of that region's potion.
function canBrewRegionPotion(regionId, N) {
  const recipe = HERBALIST_RECIPES[regionId];
  if (!recipe) return false;
  if (((player.regionPotions && player.regionPotions[regionId]) || 0) >= ITEM_CAP) return false;
  if ((player.rubies || 0) < 5 * N) return false;
  return recipe.heal.every(k => (player[k] || 0) >= 1);
}

function brewRegionPotion(regionId, N) {
  if (!canBrewRegionPotion(regionId, N)) return;
  const recipe = HERBALIST_RECIPES[regionId];
  for (const k of recipe.heal) player[k] -= 1;
  player.rubies -= 5 * N;
  player.regionPotions = player.regionPotions || {};
  player.regionPotions[regionId] = Math.min(ITEM_CAP, (player.regionPotions[regionId] || 0) + 1);
  const name = regionId.charAt(0).toUpperCase() + regionId.slice(1);
  showMsg(`🧪 The Herbalist brews you a ${name} Potion (heals ${N}d4)!`, 3000);
  renderHerbalistContents();
  updateHUD();
}

// Region Elixir: needs all three trophies + 5N rubies, and room to carry one more.
function canBrewElixir(regionId, N) {
  const recipe = HERBALIST_RECIPES[regionId];
  if (!recipe) return false;
  if (((player.elixirs && player.elixirs[regionId]) || 0) >= ITEM_CAP) return false;
  if ((player.rubies || 0) < 5 * N) return false;
  return recipe.elixir.every(k => (player[k] || 0) >= 1);
}

function brewElixir(regionId, N) {
  if (!canBrewElixir(regionId, N)) return;
  const recipe = HERBALIST_RECIPES[regionId];
  for (const k of recipe.elixir) player[k] -= 1;
  player.rubies -= 5 * N;
  player.elixirs = player.elixirs || {};
  player.elixirs[regionId] = Math.min(ITEM_CAP, (player.elixirs[regionId] || 0) + 1);
  const elem = SWORD_ELEMENTS[regionId];
  showMsg(`⚗️ The Herbalist brews you a ${elem ? elem.label : regionId} Elixir!`, 3000);
  renderHerbalistContents();
  updateHUD();
}

// ─── The Collector: chest-house quest giver ────────────────────────────────────
// A villager who lodges in the chest house of every region's village. They ask
// the hero to gather COLLECTOR_QTY each of COLLECTOR_TARGET_COUNT random trophies
// dropped by that region's monsters, paying 1.5× the General Store value of
// everything handed in (see collectorReward) on completion. The quest is rolled
// once per region and persisted on player.collectorQuests so the same five
// trophies are asked for every visit.
const COLLECTOR_QTY = 20;          // how many of each trophy the quest needs
const COLLECTOR_TARGET_COUNT = 5;  // how many distinct trophies the quest asks for

// All singular trophy drop types a region's monsters can drop (excludes the
// generic potion / arrow drops). Derived from ENEMY_POOLS + ENEMY_DROPS so it
// tracks the drop tables, exactly like regionBuyKeys.
function regionDropTypes(regionIdx) {
  const out = [];
  const pool = (typeof ENEMY_POOLS !== 'undefined' && ENEMY_POOLS[regionIdx]) || [];
  for (const type of pool) {
    for (const d of ((typeof ENEMY_DROPS !== 'undefined' && ENEMY_DROPS[type]) || [])) {
      if (d.type === 'potion' || d.type === 'arrows') continue;
      if (!out.includes(d.type)) out.push(d.type);
    }
  }
  return out;
}

// Lazily roll (and persist) this region's quest. Picks COLLECTOR_TARGET_COUNT
// random distinct drop types from the region's monster spoils.
function ensureCollectorQuest(regionIdx, regionId) {
  player.collectorQuests = player.collectorQuests || {};
  let q = player.collectorQuests[regionId];
  if (q && q.targets) return q;
  const pool = regionDropTypes(regionIdx).slice();
  for (let i = pool.length - 1; i > 0; i--) {        // Fisher–Yates shuffle
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  q = { targets: pool.slice(0, Math.min(COLLECTOR_TARGET_COUNT, pool.length)), status: 'active' };
  player.collectorQuests[regionId] = q;
  return q;
}

// The General Store's per-unit buy price for a trophy drop type (inventory key
// is the plural). 0 if the store doesn't trade it.
function trophySellValue(type) {
  const t = (typeof TROPHY_SELL !== 'undefined') ? TROPHY_SELL.find(x => x.key === type + 's') : null;
  return t ? t.value : 0;
}

// Reward in rubies for a collection quest: 1.5× the shop price of every item it
// asks for — COLLECTOR_QTY of each target trophy at its per-unit store value.
function collectorReward(q) {
  const total = (q && q.targets ? q.targets : [])
    .reduce((sum, type) => sum + COLLECTOR_QTY * trophySellValue(type), 0);
  return Math.round(total * 1.5);
}

// True once the player is holding at least COLLECTOR_QTY of every target trophy.
function collectorQuestReady(q) {
  return q.targets.every(type => (player[type + 's'] || 0) >= COLLECTOR_QTY);
}

function openCollectorModal() {
  shopOpen = true;
  document.getElementById('quest-modal-overlay').classList.add('open');
  renderCollectorContents();
}

function renderCollectorContents() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const regionName = regionId.charAt(0).toUpperCase() + regionId.slice(1);
  const q = ensureCollectorQuest(regionIdx, regionId);
  const reward = collectorReward(q);

  if (q.status === 'done') {
    document.getElementById('quest-modal').innerHTML = `
      <h2>📜 The Collector</h2>
      <div class="shop-greeting">My shelves are full thanks to you, hero — the ${regionName} reaches hold no more secrets for me.</div>
      <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
    `;
    return;
  }

  // One progress row per target trophy (icon · label · have/need).
  const rows = q.targets.map(type => {
    const have = player[type + 's'] || 0;
    const meta = (typeof TROPHY_META !== 'undefined' && TROPHY_META[type])
      ? TROPHY_META[type] : { icon: '•', label: type };
    const done = have >= COLLECTOR_QTY;
    return `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${meta.icon} ${meta.label} ${done ? '<span style="color:#88cc88">✓</span>' : ''}</div>
          <div class="shop-item-meta">${Math.min(have, COLLECTOR_QTY)} / ${COLLECTOR_QTY}</div>
        </div>
      </div>
    `;
  }).join('');

  const ready = collectorQuestReady(q);
  document.getElementById('quest-modal').innerHTML = `
    <h2>📜 The Collector</h2>
    <div class="shop-greeting">I'm cataloguing the spoils of the ${regionName} reaches. Bring me <b>${COLLECTOR_QTY}</b> each of these five and I'll pay you well.</div>
    <div class="shop-rubies">Reward: 💰 <b>${reward}</b></div>
    ${rows}
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🎁 Hand over the collection</div>
        <div class="shop-item-meta">${ready ? 'Everything\'s here — claim your reward!' : 'Gather all five stacks first'}</div>
      </div>
      <button class="ssbtn" ${ready ? '' : 'disabled'} onclick="turnInCollectorQuest()">➜ 💰 ${reward}</button>
    </div>
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function turnInCollectorQuest() {
  const { region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const q = (player.collectorQuests || {})[regionId];
  if (!q || q.status === 'done') return;
  // Re-verify against live inventory (guards against a stale enabled button).
  if (!collectorQuestReady(q)) { renderCollectorContents(); return; }
  for (const type of q.targets) player[type + 's'] -= COLLECTOR_QTY;
  const reward = collectorReward(q);
  player.rubies += reward;
  q.status = 'done';
  showMsg(`📜 Collection complete! The Collector pays 💰 ${reward}.`, 3500);
  renderCollectorContents();
  updateHUD();
}

// ─── The Taxidermist: full-roster trophy quest (#3) ────────────────────────────
// A villager on the plaza of every region's village. They ask for ONE of every
// monster trophy the region's beasts drop; hand over the full set and they mount a
// trophy wall, granting a permanent +1 to that region's trophy drop-count (see
// player.trophyDropBonus, applied in rollEnemyTypeDrops). One-time per region.
function taxidermistTargets(regionIdx) { return regionDropTypes(regionIdx); }

function ensureTaxidermistQuest(regionId) {
  player.taxidermistQuests = player.taxidermistQuests || {};
  let q = player.taxidermistQuests[regionId];
  if (q) return q;
  q = { status: 'active' };
  player.taxidermistQuests[regionId] = q;
  return q;
}

function taxidermistReady(regionIdx) {
  return taxidermistTargets(regionIdx).every(type => (player[type + 's'] || 0) >= 1);
}

function openTaxidermistModal() {
  shopOpen = true;
  document.getElementById('quest-modal-overlay').classList.add('open');
  renderTaxidermistContents();
}

function renderTaxidermistContents() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const regionName = regionId.charAt(0).toUpperCase() + regionId.slice(1);
  const q = ensureTaxidermistQuest(regionId);
  const targets = taxidermistTargets(regionIdx);

  if (q.status === 'done') {
    document.getElementById('quest-modal').innerHTML = `
      <h2>🦌 The Taxidermist</h2>
      <div class="shop-greeting">The ${regionName} trophy wall is complete — my mounts will draw the beasts out for you now.</div>
      <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
    `;
    return;
  }

  const rows = targets.map(type => {
    const have = player[type + 's'] || 0;
    const meta = (typeof TROPHY_META !== 'undefined' && TROPHY_META[type]) ? TROPHY_META[type] : { icon: '•', label: type };
    const done = have >= 1;
    return `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${meta.icon} ${meta.label} ${done ? '<span style="color:#88cc88">✓</span>' : ''}</div>
          <div class="shop-item-meta">${Math.min(have, 1)} / 1</div>
        </div>
      </div>`;
  }).join('');

  const ready = taxidermistReady(regionIdx);
  document.getElementById('quest-modal').innerHTML = `
    <h2>🦌 The Taxidermist</h2>
    <div class="shop-greeting">Bring me <b>one</b> of every beast in the ${regionName} reaches and I'll mount a trophy wall — the scent draws more prey. <b>Reward: permanent +1 ${regionName} trophy drops.</b></div>
    ${rows}
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🎁 Hand over the set</div>
        <div class="shop-item-meta">${ready ? 'The full roster — claim your boon!' : 'Gather one of each first'}</div>
      </div>
      <button class="ssbtn" ${ready ? '' : 'disabled'} onclick="turnInTaxidermistQuest()">➜ 🏆</button>
    </div>
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function turnInTaxidermistQuest() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const q = (player.taxidermistQuests || {})[regionId];
  if (!q || q.status === 'done') return;
  if (!taxidermistReady(regionIdx)) { renderTaxidermistContents(); return; }
  for (const type of taxidermistTargets(regionIdx)) player[type + 's'] -= 1;
  q.status = 'done';
  player.trophyDropBonus = player.trophyDropBonus || {};
  player.trophyDropBonus[regionId] = (player.trophyDropBonus[regionId] || 0) + 1;
  const regionName = regionId.charAt(0).toUpperCase() + regionId.slice(1);
  showMsg(`🦌 Trophy wall mounted! ${regionName} beasts now drop +1 trophy.`, 3500);
  renderTaxidermistContents();
  updateHUD();
}

// ─── The Alchemist: repeatable bulk order (#1) ─────────────────────────────────
// A traveling vendor camped outside every OTHER region's village (even region
// numbers; placement gated in placeAlchemist). They run a repeatable order for
// ALCHEMIST_QTY of a single random region trophy, paying an escalating streak
// bonus and rolling a fresh target on each fulfillment.
const ALCHEMIST_QTY = 15;

function rollAlchemistTarget(regionIdx) {
  const pool = regionDropTypes(regionIdx);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function ensureAlchemistOrder(regionIdx, regionId) {
  player.alchemistOrders = player.alchemistOrders || {};
  let o = player.alchemistOrders[regionId];
  if (o && o.target) return o;
  o = { target: rollAlchemistTarget(regionIdx), streak: 0 };
  player.alchemistOrders[regionId] = o;
  return o;
}

// Escalating pay: 1.25× store value at streak 0, +0.25× per consecutive order.
function alchemistReward(o) {
  if (!o || !o.target) return 0;
  const base = ALCHEMIST_QTY * trophySellValue(o.target);
  return Math.round(base * (1.25 + 0.25 * (o.streak || 0)));
}

function openAlchemistModal() {
  shopOpen = true;
  document.getElementById('quest-modal-overlay').classList.add('open');
  renderAlchemistContents();
}

function renderAlchemistContents() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const o = ensureAlchemistOrder(regionIdx, regionId);
  if (!o.target) {
    document.getElementById('quest-modal').innerHTML = `
      <h2>⚗️ The Alchemist</h2>
      <div class="shop-greeting">No reagents catch my eye here just now — come back with more spoils.</div>
      <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>`;
    return;
  }
  const meta = (typeof TROPHY_META !== 'undefined' && TROPHY_META[o.target]) ? TROPHY_META[o.target] : { icon: '•', label: o.target };
  const have = player[o.target + 's'] || 0;
  const reward = alchemistReward(o);
  const ready = have >= ALCHEMIST_QTY;
  document.getElementById('quest-modal').innerHTML = `
    <h2>⚗️ The Alchemist</h2>
    <div class="shop-greeting">I need reagents in bulk. Bring me <b>${ALCHEMIST_QTY}</b> ${meta.label} and I'll pay well — the more orders you fill in a row, the sweeter the price.</div>
    <div class="shop-rubies">Reward: 💰 <b>${reward}</b> &nbsp;·&nbsp; Streak: <b>${o.streak || 0}</b></div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">${meta.icon} ${meta.label}</div>
        <div class="shop-item-meta">${Math.min(have, ALCHEMIST_QTY)} / ${ALCHEMIST_QTY}</div>
      </div>
      <button class="ssbtn" ${ready ? '' : 'disabled'} onclick="turnInAlchemistOrder()">➜ 💰 ${reward}</button>
    </div>
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

function turnInAlchemistOrder() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const o = (player.alchemistOrders || {})[regionId];
  if (!o || !o.target) return;
  if ((player[o.target + 's'] || 0) < ALCHEMIST_QTY) { renderAlchemistContents(); return; }
  player[o.target + 's'] -= ALCHEMIST_QTY;
  const reward = alchemistReward(o);
  player.rubies += reward;
  o.streak = (o.streak || 0) + 1;
  o.target = rollAlchemistTarget(regionIdx);   // roll the next order
  showMsg(`⚗️ Order filled! The Alchemist pays 💰 ${reward}. (Streak ${o.streak})`, 3500);
  renderAlchemistContents();
  updateHUD();
}

