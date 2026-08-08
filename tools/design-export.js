#!/usr/bin/env node
// ─── Design-data exporter ─────────────────────────────────────────────────────
// Dumps the game's authoritative balance tables as one JSON document, so the
// design workbook (../Game1.xlsx) can be audited against the real code instead
// of by eye. Run it directly to inspect the data; tools/design-audit.py consumes
// it. Nothing here reads or writes the workbook.
//
//   node tools/design-export.js            # pretty JSON to stdout
//   node tools/design-export.js --compact  # one line
//
// HOW IT WORKS
// The game is plain <script> globals with no build step, so we can just run it.
// Every file listed in index.html is evaluated in one Node vm context behind a
// stub DOM (see makeContext) — no file is skipped and no table is transcribed by
// hand, which is the whole point: if a table moves or a value changes, this
// exporter follows it automatically. Two tables live inside function bodies
// rather than as data (the foliage cut chain and the pickup key chain); those
// are pulled straight from the source text by regex, and the script HARD-FAILS
// if either pattern stops matching, so a refactor can never silently produce a
// half-empty export.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const noop = () => {};

// ─── Stub DOM ─────────────────────────────────────────────────────────────────
// Just enough of a browser for the game's top-level code to run: config.js grabs
// a canvas and a 2D context, player.js preloads an <audio> + Web Audio buffer,
// several modules resolve DOM nodes at load time. Proxies answer any property
// with a no-op function, so new DOM touches don't break the exporter.
function stubEl() {
  const target = {};
  return new Proxy(target, {
    get(t, k) {
      if (k === 'getContext') return () => stubCtx2d();
      if (k === 'style' || k === 'dataset' || k === 'classList')
        return new Proxy({}, { get: () => noop, set: () => true });
      if (k === 'children' || k === 'childNodes') return [];
      if (k === 'width' || k === 'height') return 800;
      if (typeof k === 'symbol') return undefined;
      return k in t ? t[k] : noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function stubCtx2d() {
  const target = {};
  return new Proxy(target, {
    get(t, k) {
      if (k === 'canvas') return stubEl();
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: [] });
      if (typeof k === 'symbol') return undefined;
      return k in t ? t[k] : noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeContext() {
  const thenable = { then() { return this; }, catch() { return this; } };
  const ctx = {
    console, Math, JSON, Date, isNaN, parseInt, parseFloat,
    encodeURIComponent, decodeURIComponent,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.document = {
    getElementById: () => stubEl(), querySelector: () => stubEl(),
    querySelectorAll: () => [], createElement: () => stubEl(),
    addEventListener: noop, body: stubEl(), documentElement: stubEl(),
  };
  ctx.Image = function () { return stubEl(); };
  ctx.Audio = function () { return stubEl(); };
  ctx.fetch = () => thenable;
  ctx.AudioContext = function () {
    return {
      createBufferSource: () => stubEl(), createGain: () => stubEl(),
      decodeAudioData: () => thenable, destination: {},
      state: 'running', resume: () => ({ catch: noop }),
    };
  };
  ctx.localStorage = { getItem: () => null, setItem: noop, removeItem: noop, key: () => null, length: 0 };
  ctx.requestAnimationFrame = () => 0;
  ctx.setInterval = () => 0;
  ctx.setTimeout = () => 0;
  ctx.clearInterval = noop;
  ctx.navigator = { userAgent: 'node', maxTouchPoints: 0, vibrate: noop };
  ctx.location = { href: '' };
  ctx.addEventListener = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop });
  ctx.performance = { now: () => 0 };
  return vm.createContext(ctx);
}

// Every <script src> in index.html, in load order — the file itself is the
// source of truth, so a newly added module is picked up with no edit here.
function scriptOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+\.js)"><\/script>/g)].map(m => m[1]);
  if (!files.length) die('no <script src> tags found in index.html');
  return files;
}

function die(msg) {
  console.error('design-export: ' + msg);
  process.exit(1);
}

function loadGame() {
  const ctx = makeContext();
  const failures = [];
  for (const file of scriptOrder()) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) { failures.push(`${file}: missing`); continue; }
    try {
      vm.runInContext(fs.readFileSync(full, 'utf8'), ctx, { filename: file });
    } catch (e) {
      failures.push(`${file}: ${e.message}`);
    }
  }
  if (failures.length) {
    die('these game files would not evaluate — the stub DOM probably needs a new ' +
        'shim (see makeContext):\n  ' + failures.join('\n  '));
  }
  // The game declares its tables with `const`, which never lands on the context
  // object — it lives in the context's global lexical scope. Evaluating an
  // expression inside the context is the only way to reach them.
  return expr => vm.runInContext(`(${expr})`, ctx);
}

// ─── Regex-extracted tables ───────────────────────────────────────────────────
// These two live inside function bodies as if/else chains, not as data, so they
// have to come from the source text. Both extractors assert a plausible row
// count — silence here would mean an empty Foliage audit.

// doSwordSwing (projectiles.js): every cuttable tile, its forage drop and odds.
function foliageCutTable() {
  const src = fs.readFileSync(path.join(ROOT, 'projectiles.js'), 'utf8');
  const re = /tile === T\.([A-Z_0-9]+)\)\s*\{\s*dropType = '([a-z_]+)';\s*dropChance = ([0-9.]+);/g;
  const rows = [...src.matchAll(re)].map(m => ({ tile: m[1], drop: m[2], chance: +m[3] }));
  if (rows.length < 20) die(`the foliage cut chain in doSwordSwing (projectiles.js) matched only ` +
                           `${rows.length} rows — the pattern in foliageCutTable() needs updating`);
  return rows;
}

// stepDrops (projectiles.js): drop type -> the inventory key it stacks into.
// Needed to price forage, whose keys are irregularly pluralised (herbal ->
// herbals, sage -> sage, witherwood -> witherwood).
function dropKeyTable() {
  const src = fs.readFileSync(path.join(ROOT, 'projectiles.js'), 'utf8');
  const re = /d\.type === '([a-z_]+)'\)\s*\{\s*(?:const [^\n]*\n\s*)*addItem\('([a-z_]+)'/g;
  const map = {};
  for (const m of src.matchAll(re)) map[m[1]] = m[2];
  if (Object.keys(map).length < 15) die(`the pickup chain in stepDrops (projectiles.js) matched only ` +
                                        `${Object.keys(map).length} rows — see dropKeyTable()`);
  return map;
}

// scatter*Foliage (mapgen-foliage.js): which region seeds which foliage tile.
// Every builder opens with `if (regionId !== 'x') return;`, so the region is
// unambiguous; the tiles it plants come from scatterOn() in most regions and
// from a direct `m[r][c] = T.X` roll in poison/mana, so we just collect every
// tile the body names and let the caller keep the cuttable ones. Forest and fire
// aren't here — their bespoke builders live in mapgen-biomes.js — so the caller
// tops this up from REGION_LANDMARKS and REGIONS[].decoration, then checks that
// every cuttable tile ended up claimed.
function foliageScatterRegions() {
  const src = fs.readFileSync(path.join(ROOT, 'mapgen-foliage.js'), 'utf8');
  const out = {};                                       // region id -> [tile, ...]
  const re = /\(m, regionId[^)]*\)\s*\{\s*if \(regionId !== '(\w+)'\) return;([\s\S]*?)\n\}/g;
  for (const m of src.matchAll(re)) {
    const tiles = [...m[2].matchAll(/T\.([A-Z_0-9]+)/g)].map(x => x[1]);
    out[m[1]] = (out[m[1]] || []).concat(tiles);
  }
  if (!Object.keys(out).length) die('no region foliage builders matched in mapgen-foliage.js — ' +
                                    'see foliageScatterRegions()');
  return out;
}

// ─── Sheet-facing display names ───────────────────────────────────────────────
// The one place this exporter is allowed an opinion: the workbook labels a few
// regions more descriptively than their code ids. Everything else is derived.
const SHEET_REGION_LABEL = {
  forest: 'Forest', fire: 'Fire / Desert', water: 'Water', ice: 'Ice',
  earth: 'Earth', volcanic: 'Volcanic', air: 'Air', lightning: 'Lightning',
  luminous: 'Luminous', necrotic: 'Necrotic', poison: 'Poison',
  mana: 'Mana / Arcane', shadow: 'Shadow',
};
const NONE = '—';   // em dash: the sheet's "not applicable" marker

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function build() {
  const G = loadGame();
  const REGIONS = G('REGIONS');
  const DND = G('DND_ENEMIES');
  const POOLS = G('ENEMY_POOLS');
  const DROPS = G('ENEMY_DROPS');
  const TROPHIES = G('TROPHIES');
  const ORE_TYPES = G('ORE_TYPES');
  const OPPOSITE = G('OPPOSITE');
  const SELL = G('TROPHY_SELL');
  const FORAGE = G('REGION_FORAGE');
  const POTION_NAMES = G('REGION_POTION_NAMES');
  // Forest has no HERBALIST_RECIPES entry — its Herbalist keeps the hardcoded
  // classic brew (HERB_POTION_RECIPE, minus the ruby fee). Fold it in so forest
  // forage is classified like every other region's.
  const RECIPES = Object.assign(
    { forest: { heal: Object.keys(G('HERB_POTION_RECIPE')).filter(k => k !== 'rubies'), elixir: [] } },
    G('HERBALIST_RECIPES'));

  const trophy = Object.fromEntries(TROPHIES.map(t => [t.id, t]));
  const sellByKey = Object.fromEntries(SELL.map(s => [s.key, s]));
  const dropKey = dropKeyTable();
  // Trophy drops stack under "<id>s" (see rollEnemyTypeDrops); forage keys come
  // from the pickup chain.
  const keyFor = type => dropKey[type] || (type + 's');
  const labelFor = type => (trophy[type] && trophy[type].label)
                        || (sellByKey[keyFor(type)] && sellByKey[keyFor(type)].label)
                        || cap(type);
  const valueFor = type => (trophy[type] && trophy[type].value)
                        ?? (sellByKey[keyFor(type)] && sellByKey[keyFor(type)].value)
                        ?? null;

  const regionOf = {};            // enemy type -> region index of the pool it sits in
  POOLS.forEach((pool, i) => pool.forEach(t => { if (!(t in regionOf)) regionOf[t] = i; }));

  // ── Enemies ────────────────────────────────────────────────────────────────
  // One row per pool member plus each region's boss, in the sheet's order
  // (region -> class -> name), then the castle-tower final boss.
  function enemyRow(type, regionIdx, klass) {
    const e = DND[type];
    const drops = DROPS[type] || [];
    const primary = drops.find(d => d.type !== 'potion' && d.type !== 'arrows');
    const others = drops.filter(d => d !== primary);
    const pct = n => Math.round(n * 100);
    return {
      region: SHEET_REGION_LABEL[REGIONS[regionIdx] && REGIONS[regionIdx].id] || 'Castle Tower',
      regionNum: regionIdx,
      class: klass,
      name: e.name,
      hp: e.hp,
      damage: e.dmg,
      element: e.element ? cap(e.element) : 'Physical',
      vulnerability: e.element && OPPOSITE[e.element] ? cap(OPPOSITE[e.element]) : NONE,
      swims: e.swims ? 'Yes' : null,
      trophy: e.boss ? 'None (boss)' : (primary ? labelFor(primary.type) : null),
      trophyPct: e.boss ? null : (primary ? pct(primary.chance) : null),
      trophySell: e.boss ? null : (primary ? valueFor(primary.type) : null),
      otherDrops: e.boss
        ? `${100 * (regionIdx + 1)} rubies + 6 HP heart`
        : (others.map(d => `${d.type === 'potion' ? 'Potion' : labelFor(d.type)} ${pct(d.chance)}%`)
                 .join(', ') || null),
      xp: Math.floor(e.xp * 0.5),
      speed: e.spd,
      size: e.size,
      cr: e.cr,
    };
  }
  const enemies = [];
  REGIONS.forEach((region, i) => {
    const pool = POOLS[region.enemyTier] || [];
    const melee = pool.filter(t => !DND[t].ranged).sort((a, b) => DND[a].name.localeCompare(DND[b].name));
    const ranged = pool.filter(t => DND[t].ranged).sort((a, b) => DND[a].name.localeCompare(DND[b].name));
    melee.forEach(t => enemies.push(enemyRow(t, i, 'Melee')));
    ranged.forEach(t => enemies.push(enemyRow(t, i, 'Ranged')));
    enemies.push(enemyRow(region.boss, i, 'Boss'));
  });
  // The pinnacle dragon belongs to no region; it sits one tier past Shadow and
  // the tower pays every boss the floor-1 rate (tower maps carry no regionIdx).
  const dragon = enemyRow('adult_red_dragon', REGIONS.length, 'Final Boss');
  dragon.otherDrops = '100 rubies + 6 HP heart';
  enemies.push(dragon);

  // ── Foliage ────────────────────────────────────────────────────────────────
  // Three questions per cuttable tile: which region grows it, what it drops, and
  // who buys that. The first has no single source, so it comes from the union of
  // the three places a region can claim a tile — asserted complete below.
  const T = G('T');
  const tileById = Object.fromEntries(Object.entries(T).map(([name, id]) => [id, name]));
  const tileName = t => t.split('_').map(w => cap(w.toLowerCase())).join(' ');
  const cuttable = foliageCutTable();
  const cutTiles = new Set(cuttable.map(r => r.tile));

  const growsIn = {};             // tile name -> [region index, ...] in region order
  const claim = (regionId, tile) => {
    if (!cutTiles.has(tile)) return;
    const i = REGIONS.findIndex(r => r.id === regionId);
    if (i < 0) return;
    (growsIn[tile] = growsIn[tile] || []);
    if (!growsIn[tile].includes(i)) growsIn[tile].push(i);
  };
  const LANDMARKS = G('REGION_LANDMARKS');
  for (const [regionId, spec] of Object.entries(LANDMARKS))       // region's open-ground set
    for (const id of spec.open) claim(regionId, tileById[id]);
  REGIONS.forEach(r => claim(r.id, tileById[r.decoration]));      // the region's decoration tile
  for (const [regionId, tiles] of Object.entries(foliageScatterRegions()))
    for (const t of tiles) claim(regionId, t);                    // the scatter builders
  const orphans = cuttable.filter(r => !growsIn[r.tile]).map(r => r.tile);
  if (orphans.length) die(`no region claims these cuttable tiles: ${orphans.join(', ')} — ` +
                          'they grow somewhere the three sources in build() do not cover');
  Object.values(growsIn).forEach(list => list.sort((a, b) => a - b));

  // A store buys its region's forage plus any trophy its own roster drops (which
  // is why Stone Shard sells in Earth as well as Water).
  const buyersOf = {};            // inventory key -> [region index, ...]
  const addBuyer = (key, i) => {
    (buyersOf[key] = buyersOf[key] || []);
    if (!buyersOf[key].includes(i)) buyersOf[key].push(i);
  };
  REGIONS.forEach((r, i) => {
    for (const k of (FORAGE[r.id] || [])) addBuyer(k, i);
    for (const t of (POOLS[r.enemyTier] || []))
      for (const d of (DROPS[t] || []))
        if (d.type !== 'potion' && d.type !== 'arrows') addBuyer(d.type + 's', i);
  });
  const shortLabel = i => SHEET_REGION_LABEL[REGIONS[i].id].split(' /')[0];
  const joinRegions = list => list.length < 2 ? list.join('')
    : list.slice(0, -1).join(', ') + ' & ' + list[list.length - 1];

  const foliage = cuttable.map(row => {
    const key = keyFor(row.drop);
    const grown = growsIn[row.tile];
    const home = grown[0];                       // the sheet files a tile under its earliest region
    const buyers = (buyersOf[key] || []).slice().sort((a, b) => a - b);
    const usedBy = id => (RECIPES[id] || {});
    return {
      tile: row.tile,
      region: SHEET_REGION_LABEL[REGIONS[home].id],
      regionNum: home,
      alsoGrowsIn: grown.slice(1).map(i => SHEET_REGION_LABEL[REGIONS[i].id]),
      foliage: tileName(row.tile),
      revertsTo: tileName(tileById[REGIONS[home].ground]),
      drop: labelFor(row.drop),
      dropPct: Math.round(row.chance * 100),
      sell: valueFor(row.drop),
      soldWhere: buyers.length === 1 && buyers[0] === home
        ? 'This region only'
        : joinRegions(buyers.map(shortLabel)) + ' stores',
      // A few cuttables shed a registry TROPHY rather than plain forage (Stones ->
      // Stone Shard, Radiant Bloom -> Light Mote); the sheet flags those.
      herbalistUse: (grown.some(i => (usedBy(REGIONS[i].id).heal || []).includes(key))
        ? 'Potion ingredient'
        : grown.some(i => (usedBy(REGIONS[i].id).elixir || []).includes(key))
            ? 'Elixir ingredient' : 'Sell only') + (trophy[row.drop] ? ' (trophy)' : ''),
      potionDice: `${home + 1}d4`,
    };
  }).sort((a, b) => a.regionNum - b.regionNum || a.foliage.localeCompare(b.foliage));

  // ── Regions ────────────────────────────────────────────────────────────────
  const regions = REGIONS.map((r, i) => ({
    regionNum: i,
    region: SHEET_REGION_LABEL[r.id],
    element: r.element ? cap(r.element) : 'None',
    enemyTier: r.enemyTier,
    boss: DND[r.boss].name,
    village: r.villageName,
    ore: G('oreForRegionIdx')(i).label,
    potionName: POTION_NAMES[r.id],
    potionDice: `${i + 1}d4`,
  }));

  // ── Ores ───────────────────────────────────────────────────────────────────
  const ores = ORE_TYPES.map((o, tier) => ({
    tier,
    ore: o.label,
    icon: o.icon,
    sell: o.value,
    regions: REGIONS.map((r, i) => [r, i]).filter(([, i]) => G('oreForRegionIdx')(i).id === o.id)
                    .map(([r, i]) => `${SHEET_REGION_LABEL[r.id].split(' /')[0]} ${i}`).join(', '),
    armorBonus: (tier + 1) * 2,
  }));

  // ── Progression ────────────────────────────────────────────────────────────
  // gainXP: xpNext starts at 500 and floors x1.8 per level; +2 max HP per level.
  const progression = [];
  let next = 500, cumulative = 0;
  for (let lv = 1; lv <= 20; lv++) {
    progression.push({ level: lv, xpToNext: next, cumulative, maxHp: 10 + 2 * lv });
    cumulative += next;
    next = Math.floor(next * 1.8);
  }

  // ── Sword / armor forges and the shared upgrade ladder ─────────────────────
  const partQty = G('BLACKSMITH_ARMOR_PART_QTY');
  const rubyPerRegion = G('BLACKSMITH_ARMOR_RUBY_PER_REGION');
  const oreCost = G('ORE_ARMOR_ORE_COST');
  const rubyPerTier = G('ORE_ARMOR_RUBY_PER_TIER');
  const elementRegions = REGIONS.map((r, i) => ({ r, i })).filter(({ r }) => G('SWORD_ELEMENTS')[r.id]);

  const swordForge = elementRegions.map(({ r, i }) => ({
    element: cap(r.id), regionNum: i, homeRegion: cap(r.id),
    forgeCost: rubyPerRegion * (i + 1),
    parts: G('regionSwordPartTypes')(r.id).map(labelFor).join(', '),
    partQty: Math.ceil(partQty / 2),
  }));
  const armorForge = elementRegions.map(({ r, i }) => ({
    element: cap(r.id), regionNum: i, homeRegion: cap(r.id),
    forgeCost: rubyPerRegion * (i + 1),
    parts: G('regionArmorPartTypes')(i, r.id).map(labelFor).join(', '),
    partQty,
  }));
  const ladder = [{ level: 0, ore: NONE, oreCost: 0, rubyCost: 0, damage: '+0', physDef: '+0', block: '40%' }];
  ORE_TYPES.forEach((o, tier) => ladder.push({
    level: tier + 1,
    ore: o.label,
    oreCost,
    rubyCost: (tier + 1) * rubyPerTier,
    damage: `+${(tier + 1) * 2}`,
    physDef: `+${(tier + 1) * 2}`,
    block: `${G('elementalBlockPctForLevel')(tier + 1)}%`,
  }));
  // The capstone blade is forged like an elemental sword but is not one: no home
  // region, no trophies, a fixed toll. It rides along in swordForge so the sheet's
  // forge table can be audited as a whole.
  const dbCost = G('dragonbaneCost')();
  const dragonbane = { rubies: dbCost.rubies, ore: dbCost.ore.label, oreQty: dbCost.oreQty };
  swordForge.push({
    element: 'Dragonbane', regionNum: null, homeRegion: 'Final (castle-gate) village',
    forgeCost: dbCost.rubies,
    parts: `${dbCost.oreQty}× ${dbCost.ore.label} ore — no trophies`,
    partQty: null,
  });

  // ── Potions & elixirs ──────────────────────────────────────────────────────
  const potions = REGIONS.map((r, i) => {
    const N = i + 1;
    const ing = RECIPES[r.id].heal;
    return {
      region: cap(r.id), regionNum: i, brew: POTION_NAMES[r.id],
      heals: `Heals ${N}d4 HP`,
      ingredients: ing.map(k => `1 ${sellByKey[k] ? sellByKey[k].label : k}`).join(' + '),
      cost: 5 * N,
    };
  });
  const elixirs = REGIONS.map((r, i) => {
    const recipe = RECIPES[r.id];
    // Forest is elementless, so its Herbalist brews no elixir — and note the
    // forest entry folded in above carries an empty elixir list, not none.
    if (!recipe.elixir.length) return null;
    return {
      region: cap(r.id), regionNum: i, brew: 'Elixir',
      effect: `Full immunity to ${cap(r.id)}`,
      ingredients: recipe.elixir.map(k => `1 ${sellByKey[k] ? sellByKey[k].label : k}`).join(' + '),
      cost: 5 * (i + 1),
      immunity: cap(r.id),
      duration: `${G('ELIXIR_IMMUNITY_MS') / 1000}s`,
    };
  }).filter(Boolean);

  // ── Guild ──────────────────────────────────────────────────────────────────
  const guildQuarry = REGIONS.map((r, i) => {
    const type = G('guildCreatureFor')(i);
    return {
      regionNum: i, N: i + 1, region: SHEET_REGION_LABEL[r.id],
      creature: DND[type].name, baseHp: DND[type].hp, quarryHp: Math.round(DND[type].hp * 3),
      headToken: `${DND[type].name} head`,
    };
  });

  return {
    generated: new Date().toISOString(),
    source: path.basename(ROOT),
    enemies, foliage, regions, ores, progression,
    swordForge, armorForge, ladder, dragonbane,
    potions, elixirs, guildQuarry,
    // Loose numbers the prose sheets quote. The audit greps each sheet's notes
    // for these, which is the only automatic check possible on hand-written text.
    constants: {
      innRestCost: G('INN_REST_COST'),
      portalToll: G('PORTAL_TOLL'),
      guildCullNeed: G('GUILD_CULL_NEED'),
      collectorQty: G('COLLECTOR_QTY'),
      collectorTargets: G('COLLECTOR_TARGET_COUNT'),
      chronicleStep: G('CHRONICLE_STEP'),
      elixirImmunityMs: G('ELIXIR_IMMUNITY_MS'),
      itemCap: String(G('ITEM_CAP')),
      armorPartQty: partQty,
      swordPartQty: Math.ceil(partQty / 2),
      armorSellValue: G('ELEMENTAL_ARMOR_SELL_VALUE'),
      villagerCount: 20,
      regionCount: REGIONS.length,
      towerFloors: REGIONS.length + 1,
    },
  };
}

const out = build();
process.stdout.write(JSON.stringify(out, null, process.argv.includes('--compact') ? 0 : 2) + '\n');
