// ─── Player state and movement ────────────────────────────────────────────────

// Inventory caps have been removed — every stackable item (potions, herbals,
// trophies, arrows, bombs) and rubies now bank without limit. Both constants are
// Infinity so the existing Math.min(...) clamps and `>= CAP` checks scattered
// across the shops become no-ops rather than needing per-site edits. Starting
// amount given to a fresh player for every item (and every elemental arrow /
// sword). Stats like maxHp / swordLevel / bowLevel / armor are progression — not
// items — and are intentionally not capped here.
const ITEM_CAP = Infinity;
const RUBY_CAP = Infinity;
// Fresh players start empty-handed: only a base sword and a bow with 10 plain
// arrows (see applyStartingInventory). 0 zeroes every stackable seeded from this
// constant — rubies, potions, herbals, mushrooms, and the granted trophies.
const STARTING_ITEM_AMOUNT = 0;

// Fresh-player trophy counters, derived from the TROPHIES registry (config.js):
// `granted` trophies (fang/finger/bone/wing) seed at STARTING_ITEM_AMOUNT, the
// rest at 0. Shared by the live `player`, DEFAULT_PLAYER, and the newGame reset,
// so a new trophy needs no per-site edit in any of them.
function trophyDefaults() {
  const o = {};
  for (const t of TROPHIES) o[t.id + 's'] = t.granted ? STARTING_ITEM_AMOUNT : 0;
  return o;
}

// Cap-respecting increment for a scalar inventory key. Returns the amount
// actually added (may be less than `n` when the cap clamps). Rubies use the
// larger RUBY_CAP; every other stackable shares ITEM_CAP.
function addItem(key, n) {
  const cap = key === 'rubies' ? RUBY_CAP : ITEM_CAP;
  const before = player[key] || 0;
  player[key] = Math.min(cap, before + n);
  return player[key] - before;
}

// Cap-respecting increment for elemental arrow counts.
function addArrow(elemId, n) {
  player.arrows = player.arrows || {};
  const before = player.arrows[elemId] || 0;
  player.arrows[elemId] = Math.min(ITEM_CAP, before + n);
  return player.arrows[elemId] - before;
}

// Fill in the starting weapons/arrows inventory. Called from boot and newGame.
function applyStartingInventory(p) {
  // A fresh player carries only a base sword and a bow with 10 plain arrows —
  // no elemental swords, no armor, no elemental arrows.
  p.swordElements = [];
  p.swordUpgrades = {};
  p.armorElements = [];
  p.armorUpgrades = {};
  p.arrows = { plain: 10 };
}

// Admin "God Mode" grant, fired from the radial Menu ring (see radial.js). Hands
// the player every elemental sword and armor at max upgrade (level 6), 100 HP,
// and 10000 rubies — the old god-start, on demand.
function grantGodMode() {
  const ids = Object.keys(SWORD_ELEMENTS);
  player.swordElements = ids.slice();
  player.swordUpgrades = {};
  for (const id of ids) player.swordUpgrades[id] = 6;
  player.armorElements = ids.slice();
  player.armorUpgrades = {};
  for (const id of ids) player.armorUpgrades[id] = 6;
  player.maxHp = 100;
  player.hp = 100;
  player.rubies = 10000;
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof showMsg === 'function') showMsg('😇 God Mode — full arsenal, 100 HP, 10000 rubies.', 2500);
}

let player = {
  // Hero name — chosen in the New Game name prompt; labels save slots.
  heroName: '',
  // Lifetime death count — bumped in respawn(), shown on the stats page.
  deaths: 0,
  x: EXIT_COL, y: EXIT_ROW,
  // Smoothed sub-tile position used for rendering only. Game logic still
  // operates on integer (x, y). renderX/Y lerps toward x/y each frame at the
  // same rate as the camera so the player stays visually centered.
  renderX: EXIT_COL, renderY: EXIT_ROW,
  hp: 12, maxHp: 12,
  // Temporary HP — a green-heart buffer (bought at the General Store) that
  // absorbs damage before real HP. Not healed by potions/hearts/rest.
  tempHp: 0,
  rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  invincible: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  potions: STARTING_ITEM_AMOUNT,
  // Bombs — no longer infinite. A fresh player starts with none; bombs are bought
  // at the General Store or found (5 at a time) in small chests. Placing one
  // consumes it (see placePlayerBomb).
  bombs: 0,
  herbals: STARTING_ITEM_AMOUNT,
  mushrooms: STARTING_ITEM_AMOUNT,
  // Trophy / crafting collectibles dropped by specific enemies — seeded from the
  // TROPHIES registry (config.js). fang/finger/bone/wing are `granted` (start at
  // STARTING_ITEM_AMOUNT); every other trophy is drop-only and starts at 0.
  ...trophyDefaults(),
  // Bone meal — ground from desert bone piles cut down by the sword. Starts at 0
  // since it's earned in the field, not granted.
  bonemeal: 0,
  // Snowballs — packed powder blasted out of ice-region snow drifts (50% per
  // bombed drift). Field-earned like bone meal, so it starts at 0.
  snowballs: 0,
  // Raw ores (see ORE_TYPES in config.js) — a rare 5% find in small chests, the
  // type set by the region. Field-earned, so all start at 0.
  grimsilver: 0, emberbrass: 0, glimmerspar: 0, wyrmgold: 0, eclipsium: 0,
  // Region-specific brews from each region's Herbalist (forest excluded — it
  // keeps the classic 1d4 Health Potion). regionPotions[regionId] counts that
  // region's Health Potion (heals Nd4, N = region number, forest=1). Both are
  // objects keyed by region id, empty for a fresh player.
  regionPotions: {}, elixirs: {},
  // Per-region Collector quests (see openCollectorModal in shop.js), keyed by
  // region id → { targets:[5 drop types], status:'active'|'done' }. Empty for a
  // fresh player; each region's quest is rolled the first time its Collector is
  // visited.
  collectorQuests: {},
  // Per-region "Find Timmy" quests (see the Worried Parent villager). Keyed by
  // region id → { status:'active'|'done', timmyMapId }. Seeded when a region is
  // sealed (its village cleared) — that's when the dead-end maps, and Timmy on
  // the 3rd of them, come into being. Reward on reunion is +1 bow level.
  lostSonQuests: {},
  // Per-region Sword & Shield Guild quests (see guild.js), keyed by region id →
  // { status:'active'|'head'|'done', creature, bossMapId }. Started by talking to
  // the region's wandering Guild Recruiter; slaying the Guild Quarry on a mid-depth
  // map and returning its head makes you a guild member. Region N's recruiter only
  // appears once region N-1's quest is 'done'.
  guildQuests: {},
  // Sword & Shield Guild membership card — granted on the first guild induction
  // (subsequent regions reward potions/elixirs/rubies instead). See guild.js.
  guildCard: false,
  // Per-region Sealed Shrine quests (see seedRegionShrine / tryUnsealShrine in
  // world.js), keyed by region id → { mapId, requiredElement, status:'sealed'|'done',
  // x, y }. One shrine seeded per region when its village is cleared; struck with a
  // matching elemental sword/arrow it awakens (a reusable heal shrine) and grants a
  // one-time +2 Max HP.
  shrineQuests: {},
  // Per-region Taxidermist quests (see openTaxidermistModal in shop-herbalist.js),
  // keyed by region id → { status:'active'|'done' }. Turning in one of every region
  // trophy grants a permanent +1 to that region's trophy drops (trophyDropBonus).
  taxidermistQuests: {},
  trophyDropBonus: {},
  // Per-region Alchemist bulk orders (see openAlchemistModal), keyed by region id →
  // { target, streak }. Repeatable: each fulfilled order rolls a new target and
  // raises the streak (escalating pay). Only even-numbered regions host one.
  alchemistOrders: {},
  // Per-region escort quests (#7/8/9, see ESCORT_DEFS in villagers.js), keyed by
  // region id → { status, entered, targetMapId }. Rewards land on the maps below.
  caravanQuests: {}, apprenticeQuests: {}, gathererQuests: {},
  // Escort rewards: storeDiscounts[rid] (0–1 fraction off the General Store, #7),
  // smithFreeUpgrade[rid] (a one-time free blacksmith upgrade voucher, #8), and
  // forageBonus[rid] (+N extra forage per pick in that region, #9).
  storeDiscounts: {}, smithFreeUpgrade: {}, forageBonus: {},
  // Highest Completionist's Ledger milestone claimed (#13, the Chronicler in the
  // final village pays a tower-prep bundle every CHRONICLE_STEP quests done).
  chronicleMilestone: 0,
  // Active elemental immunity from drinking an Elixir: the element id made
  // immune and the remaining buff time in ms (ticked down in main.js update()).
  immunityElement: null, immunityTimer: 0,
  // The collection of elemental swords the player owns (each id from
  // SWORD_ELEMENTS in elements.js). Elemental swords are now specific weapons
  // — they don't stack on the base sword. Only one is wielded at a time.
  swordElements: [],
  // Which elemental sword is currently equipped, or null for the base sword.
  // Affects doSwordSwing — only the active elemental adds its 1d4 roll.
  activeSwordElement: null,
  // Each elemental sword's upgrade level (0–6) lives in swordUpgrades, keyed by
  // element id; it adds +2 damage per level to that sword's hit (elements.js).
  swordUpgrades: {},
  // Quantities of each elemental arrow the player owns, keyed by element id.
  // Bought / sold in the General Store. Firing an elemental arrow consumes
  // one and adds +1d4 of that element to the hit.
  arrows: {},
  // Which elemental arrow is currently nocked, or null for plain arrows.
  activeArrowElement: null,
  // Owned elemental armors and the one currently worn (or null for none).
  // Each armor's upgrade level (0–6) lives in armorUpgrades, keyed by element id;
  // it drives the worn armor's physical defense and elemental block % (elements.js).
  armorElements: [],
  armorUpgrades: {},
  activeArmorElement: null,
  defeatedBoss: false,
  // True once the Adult Red Dragon at the castle pinnacle has been slain.
  wonGame: false
};

// Drink one Health Potion. Heals 1d4 HP (1-4, random), clamped to maxHp.
// No-op if the player is at full HP or has no potions left.
function usePotion() {
  if (player.potions <= 0) {
    showMsg('🧪 No potions left.', 1500);
    return;
  }
  if (player.hp >= player.maxHp) {
    showMsg('🧪 Already at full HP — saving the potion.', 1500);
    return;
  }
  player.potions--;
  const heal = 1 + Math.floor(Math.random() * 4);   // 1d4 → 1..4
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  const gained = player.hp - before;
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#ff66aa', 12, 3);
  spawnParticle(sp.x, sp.y, '#ffccdd', 8, 2);
  showMsg(`🧪 Quaffed a ${regionPotionName('forest')} — +${gained} HP!`, 2500);
  updateHUD();
}

// ─── Regional Herbalist brews ─────────────────────────────────────────────────
// Each region (forest excluded) has a 1-indexed "region number" N driving its
// Herbalist recipes: the region's Health Potion heals Nd4 and its immunity
// Elixir lasts ELIXIR_IMMUNITY_MS. Forest is N=1, fire N=2, … mana N=11.
function regionNumberOf(regionId) {
  const idx = (typeof REGIONS !== 'undefined') ? REGIONS.findIndex(r => r.id === regionId) : -1;
  return idx >= 0 ? idx + 1 : 1;
}

// Total finished quests across every quest system — used by the Character stats
// panel and the Completionist's Ledger / Chronicler (#13). Counts a 'done' status
// on each per-region quest map, plus each region's guild artifact sub-quest and its
// three one-time bounties (all nested on guildQuests).
function totalQuestsDone(p) {
  p = p || player;
  const doneCount = o => Object.values(o || {}).filter(q => q && q.status === 'done').length;
  let n = 0;
  n += doneCount(p.guildQuests);
  n += doneCount(p.collectorQuests);
  n += doneCount(p.lostSonQuests);
  n += doneCount(p.taxidermistQuests);
  n += doneCount(p.caravanQuests);
  n += doneCount(p.apprenticeQuests);
  n += doneCount(p.gathererQuests);
  n += doneCount(p.shrineQuests);
  for (const rid in (p.guildQuests || {})) {
    const q = p.guildQuests[rid];
    if (!q) continue;
    if (q.artifactStatus === 'done') n++;
    if (q.bounties) for (const k in q.bounties) if (q.bounties[k] && q.bounties[k].status === 'done') n++;
  }
  return n;
}

// Drink one region Health Potion. Heals Nd4 (N = that region's number), clamped
// to maxHp. No-op at full HP or with none of that region's potion left.
function useRegionPotion(regionId) {
  player.regionPotions = player.regionPotions || {};
  if ((player.regionPotions[regionId] || 0) <= 0) {
    showMsg('🧪 No potions of that brew left.', 1500);
    return;
  }
  if (player.hp >= player.maxHp) {
    showMsg('🧪 Already at full HP — saving the potion.', 1500);
    return;
  }
  player.regionPotions[regionId]--;
  const N = regionNumberOf(regionId);
  let heal = 0;
  for (let i = 0; i < N; i++) heal += 1 + Math.floor(Math.random() * 4);   // Nd4
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  const gained = player.hp - before;
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#ff66aa', 12, 3);
  spawnParticle(sp.x, sp.y, '#ffccdd', 8, 2);
  showMsg(`🧪 Quaffed a ${regionPotionName(regionId)} — +${gained} HP!`, 2500);
  updateHUD();
}

// How long an Elixir's elemental immunity lasts, in ms.
const ELIXIR_IMMUNITY_MS = 30000;

// Drink one region Elixir. Grants full immunity to that region's element for
// ELIXIR_IMMUNITY_MS (see damagePlayer in projectiles.js). Re-drinking refreshes
// the timer. No-op with none of that elixir left.
function useElixir(elemId) {
  player.elixirs = player.elixirs || {};
  if ((player.elixirs[elemId] || 0) <= 0) {
    showMsg('⚗️ No elixir of that kind left.', 1500);
    return;
  }
  player.elixirs[elemId]--;
  player.immunityElement = elemId;
  player.immunityTimer = ELIXIR_IMMUNITY_MS;
  const elem = SWORD_ELEMENTS[elemId];
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, elem ? elem.color : '#ffffff', 14, 3);
  showMsg(`${elem ? elem.icon : '⚗️'} Immune to ${elem ? elem.label : elemId} for ${ELIXIR_IMMUNITY_MS / 1000}s!`, 2500);
  updateHUD();
}

// Tick/cooldown state
let moveTimer = 0;
const MOVE_MS = 153;             // ms between movement steps (grid-based) —
                                 // 110 / (0.9 × 0.8), i.e. 72% of the original
                                 // walk speed (90% cut, then a further 20% cut)
let lastStepMs = MOVE_MS;        // interval of the most recent step (terrain-scaled);
                                 // sets the pace of the render glide in tickCamera
const ICE_SLIDE_MS = 320;        // released walk input stays live this long on ICE
                                 // (~MOVE_MS×3 → the hero glides a couple of tiles
                                 // before stopping; bumped from 50 for slicker ice)

// ── Climb / jump animation state (read by drawPlayer in render.js) ────────────
// A "jump" is a short timed hop arc, triggered when the player mounts or leaves
// a CLIMB ramp (the lip where a path crosses a plateau). Climbing itself is
// detected per-frame from the tile under the player, so it needs no state here.
let playerJumpStart = -1;        // ms timestamp the current hop began (-1 = none)
const PLAYER_JUMP_MS = 260;      // hop duration
let attackCooldown = 0;
let bowCooldown = 0;
let bombCooldown = 0;
let transitionCooldown = 0;      // brief lockout after a map transition

// Input
let keys = {};
// Latest walking input + when it was last live — drives the ice slide in
// stepPlayerMovement (released input stays active ICE_SLIDE_MS on ICE).
let lastWalkInput = { mx: 0, my: 0, t: -1 };

// Camera tracks player position. We keep a *target* and the *actual* camera
// position separately so the world can smoothly chase the player rather than
// snapping each tile-step.
let camC = 0, camR = 0;
let camTargetC = 0, camTargetR = 0;

// Recompute the camera target from the player's current position.
// Pass snap=true to also pin the actual camera to the new target (for boot,
// load, respawn, and map transitions — anywhere a smooth scroll would be wrong).
function clampCam(snap = false) {
  const halfVC = PW / TILE_PX / 2;
  const halfVR = PH / TILE_PX / 2;
  const maxC = Math.max(0, MCOLS - PW / TILE_PX);
  const maxR = Math.max(0, MROWS - PH / TILE_PX);
  camTargetC = Math.max(0, Math.min(maxC, player.x - halfVC + 0.5));
  camTargetR = Math.max(0, Math.min(maxR, player.y - halfVR + 0.5));
  if (snap) {
    camC = camTargetC; camR = camTargetR;
    player.renderX = player.x; player.renderY = player.y;
  }
}

// Per-frame glide for the camera AND the player's render position. The render
// position chases the grid position at a *constant* pace — one tile per step
// interval — rather than an exponential lerp, which sprinted right after each
// grid step and stalled before the next (the visible walking pulse/jitter).
// Continuous walking therefore scrolls at one uniform speed. The camera is
// then pinned to the smoothed render position each frame (clamped at the map
// edges), so the hero stays rock-steady on screen while the world glides by.
function tickCamera(dt) {
  const maxDelta = (dt || 16) / lastStepMs;   // tiles this frame at walking pace
  const approach = (cur, target) =>
    Math.abs(target - cur) <= maxDelta ? target
                                       : cur + Math.sign(target - cur) * maxDelta;
  player.renderX = approach(player.renderX, player.x);
  player.renderY = approach(player.renderY, player.y);
  const halfVC = PW / TILE_PX / 2;
  const halfVR = PH / TILE_PX / 2;
  const maxC = Math.max(0, MCOLS - PW / TILE_PX);
  const maxR = Math.max(0, MROWS - PH / TILE_PX);
  camTargetC = Math.max(0, Math.min(maxC, player.renderX - halfVC + 0.5));
  camTargetR = Math.max(0, Math.min(maxR, player.renderY - halfVR + 0.5));
  camC = camTargetC;
  camR = camTargetR;
}

// ─── Level / XP ───────────────────────────────────────────────────────────────
function gainXP(amt) {
  player.xp += amt;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = Math.floor(player.xpNext * 1.8);
    player.maxHp += 2;
    player.hp = player.maxHp;  // full heal on level up
    // Celebratory burst — gold + white sparkles with a hint of blue to read as
    // "leveled up" rather than damage. spawnParticle works in canvas pixels,
    // so route the player's tile through screenPX first.
    const lvlSp = screenPX(player.x, player.y);
    spawnParticle(lvlSp.x, lvlSp.y, '#ffee44', 24, 4);
    spawnParticle(lvlSp.x, lvlSp.y, '#ffffff', 16, 3);
    spawnParticle(lvlSp.x, lvlSp.y, '#88ddff', 12, 2);
    showMsg(`⬆️ Level Up! Level ${player.level}! Max HP +2 — fully healed!`, 3000);
  }
}

// ─── Death / respawn ──────────────────────────────────────────────────────────
function respawn() {
  // On death, restore the most recent checkpoint (manual save, auto-save, or the
  // save just loaded) instead of the old return-to-start penalty. The death is
  // counted on the restored state, and a brief grace window keeps any stale
  // contact damage from the frame we died on from immediately re-killing us.
  if (typeof reloadLastSave === 'function' && reloadLastSave()) {
    player.deaths = (player.deaths || 0) + 1;
    player.invincible = 1500;
    showMsg('💀 Defeated! Restored to your last save.', 3000);
    return;
  }
  // Fallback — no checkpoint reached yet: the original return-to-start behavior.
  player.deaths = (player.deaths || 0) + 1;
  player.hp = player.maxHp;
  currentMapId = 0;
  placePlayerInStarterHouse(worldMaps[0]);  // same spot as a fresh game: beside the bed
  player.rubies = Math.max(0, player.rubies - 10);  // small death penalty
  clampCam(true);
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  showMsg('💀 Defeated! Returned to start (-10 rubies)', 3000);
}

// ─── Per-enemy-type loot table ────────────────────────────────────────────────
// Each kill rolls its drops independently after the universal HP-heart roll.
// Every pool enemy (see ENEMY_POOLS in enemies.js) drops a thematically
// matching item: trophies (TROPHY_META ids), 'herbal', or 'potion'. All of
// them are sellable at the General Store.
// Each enemy also drops a second, rarer "prized" trophy (the low-chance entry,
// 5–10%) themed to that specific monster — see the Rare enemy drops block in the
// TROPHIES registry (config.js). It's always listed AFTER the primary drop so
// enemyTrophyType() (blacksmith parts) still resolves the primary one.
const ENEMY_DROPS = {
  // ── Tier 0 · Forest ──
  goblin:            [{ type: 'finger',    chance: 0.20 }, { type: 'goblin_ear',   chance: 0.10 }],
  wolf:              [{ type: 'fang',      chance: 0.50 }, { type: 'wolf_claw',    chance: 0.10 }],
  pixie:             [{ type: 'wing',      chance: 0.05 }, { type: 'pixie_dust',   chance: 0.10 }],
  dryad:             [{ type: 'dryad_bloom', chance: 0.50 }, { type: 'potion', chance: 0.10 }, { type: 'dryad_sap', chance: 0.10 }],
  giant_spider:      [{ type: 'silk',      chance: 0.35 }, { type: 'spinneret',    chance: 0.10 }],
  owlbear:           [{ type: 'feather',   chance: 0.20 }, { type: 'owlbear_claw', chance: 0.10 }],
  // ── Tier 1 · Fire / Desert ──
  cultist:           [{ type: 'talisman',  chance: 0.25 }, { type: 'potion', chance: 0.10 }, { type: 'cult_tome', chance: 0.10 }],
  magma_mephit:      [{ type: 'ember',     chance: 0.35 }, { type: 'mephit_ash',       chance: 0.10 }],
  gnoll:             [{ type: 'gnoll_fang',      chance: 0.35 }, { type: 'gnoll_ear',        chance: 0.10 }],
  hell_hound:        [{ type: 'hound_fang',      chance: 0.35 }, { type: 'hound_heart',      chance: 0.10 }],
  giant_scorpion:    [{ type: 'venom',           chance: 0.35 }, { type: 'scorpion_stinger', chance: 0.10 }],
  salamander:        [{ type: 'salamander_hide', chance: 0.40 }, { type: 'salamander_tail',  chance: 0.10 }],
  // ── Tier 2 · Water ──
  sahuagin:          [{ type: 'fin',       chance: 0.35 }, { type: 'sahuagin_trident', chance: 0.09 }],
  kuo_toa:           [{ type: 'kuotoa_gill', chance: 0.35 }, { type: 'kuotoa_eye',      chance: 0.09 }],
  hunter_shark:      [{ type: 'shark_tooth', chance: 0.50 }, { type: 'shark_fin',       chance: 0.09 }],
  merrow:            [{ type: 'pearl',       chance: 0.30 }, { type: 'merrow_scale',    chance: 0.09 }],
  sea_hag:           [{ type: 'hag_hair',    chance: 0.30 }, { type: 'hag_eye',         chance: 0.09 }],
  water_elemental:   [{ type: 'core',      chance: 0.30 }, { type: 'tidal_pearl',     chance: 0.09 }],
  // ── Tier 3 · Ice ──
  ice_mephit:        [{ type: 'shard',     chance: 0.35 }, { type: 'mephit_frost',     chance: 0.08 }],
  winter_wolf:       [{ type: 'frost_fang', chance: 0.40 }, { type: 'winterwolf_pelt',  chance: 0.08 }],
  yeti:              [{ type: 'pelt',       chance: 0.35 }, { type: 'yeti_claw',        chance: 0.08 }],
  mammoth:           [{ type: 'tusk',       chance: 0.40 }, { type: 'mammoth_hide',     chance: 0.08 }],
  white_dragon:      [{ type: 'scale',      chance: 0.35 }, { type: 'whitedragon_horn', chance: 0.08 }],
  frost_giant:       [{ type: 'rime',       chance: 0.40 }, { type: 'frostgiant_rune',  chance: 0.08 }],
  // ── Tier 4 · Earth ──
  gargoyle:          [{ type: 'stone',          chance: 0.35 }, { type: 'gargoyle_horn',      chance: 0.08 }],
  ankheg:            [{ type: 'acid_gland',     chance: 0.35 }, { type: 'ankheg_shell',       chance: 0.08 }],
  displacer:         [{ type: 'displacer_hide', chance: 0.35 }, { type: 'displacer_tentacle', chance: 0.08 }],
  bulette:           [{ type: 'bulette_plate',  chance: 0.35 }, { type: 'bulette_fin',        chance: 0.08 }],
  earth_elemental:   [{ type: 'earth_heart',    chance: 0.30 }, { type: 'terra_crystal',      chance: 0.08 }],
  stone_giant:       [{ type: 'granite',        chance: 0.40 }, { type: 'stonegiant_heart',   chance: 0.08 }],
  // ── Tier 5 · Air ──
  harpy:             [{ type: 'harpy_plume',     chance: 0.40 }, { type: 'harpy_talon',     chance: 0.08 }],
  griffon:           [{ type: 'griffon_feather', chance: 0.40 }, { type: 'griffon_claw',    chance: 0.08 }],
  manticore:         [{ type: 'manticore_spike', chance: 0.30 }, { type: 'manticore_tail',  chance: 0.08 }],
  air_elemental:     [{ type: 'zephyr',          chance: 0.30 }, { type: 'aeolian_crystal', chance: 0.08 }],
  wyvern:            [{ type: 'wyvern_scale',     chance: 0.35 }, { type: 'wyvern_sting',    chance: 0.08 }],
  roc:               [{ type: 'roc_plume',       chance: 0.50 }, { type: 'roc_talon',       chance: 0.08 }],
  // ── Tier 6 · Lightning ──
  will_o_wisp:       [{ type: 'spark',            chance: 0.35 }, { type: 'wisp_essence',    chance: 0.07 }],
  blue_wyrmling:     [{ type: 'wyrmling_scale',   chance: 0.35 }, { type: 'wyrmling_horn',   chance: 0.07 }],
  behir:             [{ type: 'behir_scale',      chance: 0.35 }, { type: 'behir_fang',      chance: 0.07 }],
  young_blue_dragon: [{ type: 'bluedragon_scale', chance: 0.40 }, { type: 'bluedragon_claw', chance: 0.07 }],
  storm_giant:       [{ type: 'stormgiant_bolt',  chance: 0.40 }, { type: 'storm_rune',      chance: 0.07 }],
  // ── Tier 7 · Luminous ──
  pegasus:           [{ type: 'pegasus_feather', chance: 0.40 }, { type: 'pegasus_hoof',   chance: 0.07 }],
  couatl:            [{ type: 'couatl_scale',    chance: 0.35 }, { type: 'couatl_feather', chance: 0.07 }],
  unicorn:           [{ type: 'horn',            chance: 0.30 }, { type: 'unicorn_mane',   chance: 0.07 }],
  ki_rin:            [{ type: 'kirin_horn',      chance: 0.30 }, { type: 'kirin_scale',    chance: 0.07 }],
  deva:              [{ type: 'mote',            chance: 0.35 }, { type: 'deva_feather',   chance: 0.07 }],
  planetar:          [{ type: 'planetar_halo',   chance: 0.40 }, { type: 'planetar_blade', chance: 0.07 }],
  // ── Tier 8 · Necrotic ──
  skeleton:          [{ type: 'bone',      chance: 0.20 }, { type: 'skull',          chance: 0.07 }],
  zombie:            [{ type: 'organ',     chance: 0.20 }, { type: 'rot_gland',      chance: 0.07 }],
  ghost:             [{ type: 'ectoplasm', chance: 0.35 }, { type: 'spectral_chain', chance: 0.07 }],
  wraith:            [{ type: 'wraith_shroud', chance: 0.35 }, { type: 'wraith_essence', chance: 0.07 }],
  vampire:           [{ type: 'vampire_fang',  chance: 0.35 }, { type: 'vampire_cloak',  chance: 0.07 }],
  lich:              [{ type: 'phylactery',    chance: 0.35 }, { type: 'lich_crown',     chance: 0.07 }],
  // ── Tier 9 · Poison ──
  carrion_crawler:   [{ type: 'crawler_venom',     chance: 0.35 }, { type: 'crawler_mandible', chance: 0.07 }],
  troll:             [{ type: 'troll_hide',        chance: 0.40 }, { type: 'troll_claw',       chance: 0.07 }],
  otyugh:            [{ type: 'otyugh_tentacle',   chance: 0.35 }, { type: 'otyugh_maw',       chance: 0.07 }],
  treant:            [{ type: 'treant_heartwood',  chance: 0.50 }, { type: 'treant_bark',      chance: 0.07 }],
  green_dragon:      [{ type: 'greendragon_scale', chance: 0.35 }, { type: 'greendragon_fang', chance: 0.07 }],
  purple_worm:       [{ type: 'worm_stinger',      chance: 0.40 }, { type: 'worm_hide',        chance: 0.07 }],
  // ── Tier 10 · Mana / Arcane ──
  nothic:            [{ type: 'eye',           chance: 0.35 }, { type: 'nothic_eye',      chance: 0.06 }],
  helmed_horror:     [{ type: 'horror_plate',  chance: 0.35 }, { type: 'horror_visor',    chance: 0.06 }],
  mind_flayer:       [{ type: 'brain',         chance: 0.35 }, { type: 'flayer_tentacle', chance: 0.06 }],
  githyanki:         [{ type: 'gith_blade',    chance: 0.35 }, { type: 'gith_crystal',    chance: 0.06 }],
  beholder:          [{ type: 'eyestalk',      chance: 0.40 }, { type: 'beholder_eye',    chance: 0.06 }],
  rakshasa:          [{ type: 'rakshasa_claw', chance: 0.35 }, { type: 'rakshasa_pelt',   chance: 0.06 }],
  // ── Tier 5 · Volcanic ──
  magmin:            [{ type: 'cinder_core',       chance: 0.35 }, { type: 'magmin_slag',       chance: 0.08 }],
  fire_snake:        [{ type: 'firesnake_fang',    chance: 0.40 }, { type: 'firesnake_scale',   chance: 0.08 }],
  azer:              [{ type: 'azer_ingot',        chance: 0.35 }, { type: 'azer_hammer',       chance: 0.08 }],
  red_wyrmling:      [{ type: 'redwyrmling_scale', chance: 0.35 }, { type: 'redwyrmling_horn',  chance: 0.08 }],
  fire_elemental:    [{ type: 'magma_core',        chance: 0.30 }, { type: 'flame_heart',       chance: 0.08 }],
  young_red_dragon:  [{ type: 'reddragon_scale',   chance: 0.35 }, { type: 'reddragon_claw',    chance: 0.08 }],
  // ── Tier 12 · Shadow ──
  shade:             [{ type: 'umbral_shard',      chance: 0.35 }, { type: 'shade_essence',     chance: 0.05 }],
  shadow_mastiff:    [{ type: 'mastiff_fang',      chance: 0.40 }, { type: 'mastiff_pelt',      chance: 0.05 }],
  bodak:             [{ type: 'bodak_eye',         chance: 0.35 }, { type: 'bodak_skull',       chance: 0.05 }],
  nightmare:         [{ type: 'nightmare_hoof',    chance: 0.35 }, { type: 'nightmare_mane',    chance: 0.05 }],
  shadow_demon:      [{ type: 'demon_horn',        chance: 0.35 }, { type: 'demon_claw',        chance: 0.05 }],
  nightwalker:       [{ type: 'void_heart',        chance: 0.40 }, { type: 'nightwalker_shard', chance: 0.05 }],
};

// The arrow element matching the current map. Region ids double as
// SWORD_ELEMENTS ids for every elemental region; forest (and anything
// unresolvable, e.g. caves) yields null → plain arrows.
function mapArrowElementId() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const region = (typeof REGIONS !== 'undefined' && cm && typeof cm.regionIdx === 'number')
    ? REGIONS[cm.regionIdx] : null;
  return (region && SWORD_ELEMENTS[region.id])
    ? region.id : null;
}

function rollEnemyTypeDrops(e) {
  const rx = Math.round(e.x), ry = Math.round(e.y);
  const drop = (extra) =>
    drops.push({ x: rx, y: ry, life: 10000, bob: 0, collected: false, ...extra });
  // Taxidermist boon (#3): once a region's full-roster trophy quest is done, every
  // monster-trophy drop in that region yields +N extra (player.trophyDropBonus).
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const rid = cm ? regionIdForMap(cm) : null;
  const tBonus = (rid && player.trophyDropBonus && player.trophyDropBonus[rid]) || 0;
  for (const d of (ENEMY_DROPS[e.type] || [])) {
    if (Math.random() < d.chance) {
      const isTrophy = tBonus > 0 && typeof TROPHY_META !== 'undefined' && TROPHY_META[d.type];
      drop({ type: d.type, val: 1 + (isTrophy ? tBonus : 0) });
    }
  }
  // Every projectile-shooting enemy can also drop a 5-pack of arrows matching
  // the map's element (plain in the elementless forest).
  if (e.ranged && Math.random() < 0.50) {
    drop({ type: 'arrows', val: 5, element: mapArrowElementId() });
  }
}

// ─── Kill sound ───────────────────────────────────────────────────────────────
// Every kill plays the classic Wilhelm scream. Decoded once into a Web Audio
// buffer so playback is instant and overlaps cleanly on rapid multi-kills —
// cloning an <audio> element re-decoded the file on each play, which is what made
// the scream lag behind the kill. A cloned-<audio> path stays as a fallback until
// the buffer is ready (or if Web Audio is unavailable). play() can reject before
// the first user gesture — swallow that quietly.
const WILHELM_SCREAM = new Audio('wilhelm-scream.wav');
let SCREAM_CTX = null;
let SCREAM_BUFFER = null;
(function preloadKillSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    SCREAM_CTX = new AC();
    fetch('wilhelm-scream.wav')
      .then(r => r.arrayBuffer())
      .then(buf => SCREAM_CTX.decodeAudioData(buf))
      .then(decoded => { SCREAM_BUFFER = decoded; })
      .catch(() => {});
  } catch (_) { SCREAM_CTX = null; }
})();
function playKillSound() {
  if (SCREAM_CTX && SCREAM_BUFFER) {
    // A user gesture may be needed before audio can start; resume if suspended.
    if (SCREAM_CTX.state === 'suspended') SCREAM_CTX.resume().catch(() => {});
    const src = SCREAM_CTX.createBufferSource();
    src.buffer = SCREAM_BUFFER;
    const gain = SCREAM_CTX.createGain();
    gain.gain.value = 0.5;
    src.connect(gain).connect(SCREAM_CTX.destination);
    src.start();
    return;
  }
  const s = WILHELM_SCREAM.cloneNode();
  s.volume = 0.5;
  s.play().catch(() => {});
}

// ─── Kill enemy ───────────────────────────────────────────────────────────────
function killEnemy(e) {
  e.dead = true;
  playKillSound();
  const sp = screenPX(e.x, e.y);
  spawnParticle(sp.x, sp.y, e.color, 14, 5);
  spawnParticle(sp.x, sp.y, '#ffcc00', 6, 3);

  // Region context drives a couple of drop tweaks: HP hearts roll 1d4 per region
  // level (forest=1 … shadow=13), and the boss ruby payout scales with the region
  // tier. regionLevel is the 1-based progression order (regionIdx + 1).
  const cm = currentMap();
  const regionLevel = (cm && typeof cm.regionIdx === 'number') ? cm.regionIdx + 1 : 1;

  gainXP(e.xp);   // XP is awarded on every kill, unchanged.

  // 2% chance any enemy also drops a chunk of the region's raw ore, on top of its
  // normal loot. Which ore is set by the region (see oreForMap / ORE_TYPES).
  if (Math.random() < 0.02) {
    const ore = oreForMap(cm);
    if (ore) {
      drops.push({
        type: 'ore', ore: ore.id, val: 1,
        x: Math.round(e.x), y: Math.round(e.y),
        life: 10000, bob: 0, collected: false
      });
    }
  }

  if (e.boss && !e.guildBoss && !e.bounty) {
    // Boss payout: 100 rubies per region in progression order (forest=1,
    // fire=2, …), plus a guaranteed 6-HP heart. Type-specific loot rolls are
    // for rank-and-file enemies only.
    const regionOrder = (cm && typeof cm.regionIdx === 'number') ? cm.regionIdx + 1 : 1;
    addItem('rubies', 100 * regionOrder);
    drops.push({
      type: 'hp', val: 6,
      x: Math.round(e.x), y: Math.round(e.y),
      life: 10000, bob: 0, collected: false
    });
    // Slaying the village boss raises its King's Hoard on the plaza (the chest is
    // no longer pre-placed). It's stripped the first time the hero leaves town.
    if (cm && cm.type === 'village') placeVillageBossChest(cm);
  } else {
    // Rank-and-file AND Guild Quarries roll normal loot — the quarry "keeps its
    // stats and other drops," it's just flagged a boss for the fight.
    // Rubies now drop on only 30% of (non-boss) kills.
    if (Math.random() < 0.30) addItem('rubies', Math.floor(e.maxHp * 0.1) + 1);
    // 60% chance to drop an HP heart — rolls 1d4 per region level (so the value
    // scales the deeper into the world you fight).
    if (Math.random() < 0.60) {
      let hp = 0;
      for (let i = 0; i < regionLevel; i++) hp += 1 + Math.floor(Math.random() * 4);
      drops.push({
        type: 'hp',
        val: hp,
        x: Math.round(e.x), y: Math.round(e.y),
        life: 10000, bob: 0, collected: false
      });
    }
    rollEnemyTypeDrops(e);
  }
  // Guild Quarry: a guaranteed trophy head on top of its normal loot. The quest
  // advances on the kill itself so leaving before grabbing the drop can't
  // soft-lock it (the floor drop is a bonus visual to pick up — see stepDrops).
  if (e.guildBoss) {
    drops.push({
      type: 'guildhead', region: e.guildRegion, val: 1,
      x: Math.round(e.x), y: Math.round(e.y),
      life: 600000, bob: 0, collected: false
    });
    player.guildQuests = player.guildQuests || {};
    const gq = player.guildQuests[e.guildRegion];
    if (gq && gq.status === 'active') gq.status = 'head';
  }
  // Guild bounty elites (#4/5/6) advance their bounty on the kill itself.
  if (typeof guildBountyKill === 'function') guildBountyKill(e, cm);
  if (e.boss && !e.guildBoss && !e.bounty) {
    // Boss kills no longer grant +6 maxHp / a random elemental sword — those
    // rewards were removed by request. The flag is still set so saves / future
    // progression checks can tell a boss has been cleared.
    player.defeatedBoss = true;
    showMsg(`🏆 THE ${e.name} IS DEFEATED!`, 0);
  } else if (e.guildBoss) {
    showMsg(`🗡️ ${e.name} falls! Take its head to the Guild recruiter.`, 3500);
  } else if (e.bounty) {
    showMsg(`⚔️ ${e.name} slain! Report to the Guild recruiter.`, 3000);
  } else {
    showMsg(`⚔️ ${e.name} defeated! +${e.xp} XP`, 1500);
  }
  // Clearing a whirlpool grotto surfaces its sunken treasure: a large chest
  // rises west of the arena's heart, mirroring the exit vortex to the east.
  if (cm && cm.type === 'whirlpool_grotto' && !cm.grottoChestPlaced &&
      enemies.every(en => en.dead)) {
    cm.grottoChestPlaced = true;
    const gm = cm.map;
    const ccx = Math.floor(MCOLS / 2) - 15;
    let ccy = Math.floor(MROWS / 2);
    // Chests are solid — nudge down a row if the hero is floating right there.
    if (player.y === ccy && (player.x === ccx || player.x === ccx + 1)) ccy++;
    gm[ccy][ccx] = T.LARGE_CHEST;
    gm[ccy][ccx + 1] = T.LARGE_CHEST_R;
    minimapDirty = true;
    const csp = screenPX(ccx, ccy);
    spawnParticle(csp.x, csp.y, '#ffdd00', 18, 5);
    spawnParticle(csp.x, csp.y, '#bfe6f4', 12, 3);
    showMapMsg('💰 The waters calm — a sunken chest surfaces!');
  }
  // Clearing the village wakes it up into an active town.
  if (cm && cm.type === 'village' && !cm.activated && enemies.every(en => en.dead)) {
    if (activateVillage(cm)) {
      minimapDirty = true;
      spawnVillagersForMap(currentMapId);
      // Seal the cleared region with dead-ends. If a next region exists, the
      // village's own exits stay open so they can connect into it as the player
      // walks out — otherwise the final village's exits get sealed too.
      const clearedRegionIdx = (typeof cm.regionIdx === 'number') ? cm.regionIdx : 0;
      sealRegion(clearedRegionIdx);
      // Advance the world's notion of "current region" so any UI / spawn logic
      // checking it sees the new region the player is about to walk into.
      const nextIdx = clearedRegionIdx + 1;
      if (nextIdx < REGIONS.length) {
        currentRegionIdx = nextIdx;
        const nextRegion = REGIONS[nextIdx];
        showMapMsg(`🏘️ The village awakens! Beyond its gates: the ${nextRegion.id} region.`);
      } else {
        showMapMsg('🏘️ The village awakens! To the castle — the realm’s last evil waits at its pinnacle.');
      }
      // Clearing a village for the first time is a checkpoint — auto-save so a
      // later death restores the hero here rather than back at the cabin.
      if (typeof autoSave === 'function') autoSave(cm.name || 'village');
    }
  }
  // ─── Castle pinnacle: the staged finale ────────────────────────────────────
  // The dragon sleeps on its hoard until every region boss guarding the throne
  // hall has fallen; slaying the dragon itself wins the game.
  if (cm && cm.type === 'castle_tower' && cm.floorIdx === 14) {
    const dragon = enemies.find(en => en.finalBoss);
    if (dragon && dragon.dormant && enemies.every(en => en.dead || en.finalBoss)) {
      dragon.dormant = false;
      const dsp = screenPX(dragon.x, dragon.y);
      spawnParticle(dsp.x, dsp.y, '#ff6622', 24, 6);
      spawnParticle(dsp.x, dsp.y, '#ffd24a', 16, 4);
      showMapMsg('🐉 The gold shifts and slides — the ADULT RED DRAGON WAKES!');
    }
    if (e.finalBoss) {
      player.wonGame = true;
      if (typeof placeTowerHoardChest === 'function') placeTowerHoardChest(cm);
      if (typeof showVictoryScreen === 'function') showVictoryScreen();
    }
  }
  // ─── Castle floors 1–13: unsealing the stair up ────────────────────────────
  // When the last guardian on a tower floor falls, announce that the spiral
  // stair has unsealed (the TOWER_STAIRS_UP handler enforces the actual lock).
  if (cm && cm.type === 'castle_tower' && cm.floorIdx < 14 &&
      enemies.every(en => en.dead)) {
    showMapMsg(`🗝️ Floor ${cm.floorIdx} cleared — the spiral stair unseals. Climb on!`);
  }
}

// ─── Map transition (walking out an exit) ─────────────────────────────────────
function tryTransition() {
  if (transitionCooldown > 0) return;
  // Trigger when player steps onto an actual border tile
  let dir = null;
  if (player.x === 0)               dir = 'left';
  else if (player.x === MCOLS - 1)  dir = 'right';
  else if (player.y === 0)          dir = 'up';
  else if (player.y === MROWS - 1)  dir = 'down';
  if (!dir) return;

  // Village is sealed: no exits while any enemy is still standing.
  if (currentMap().type === 'village' && enemies.some(e => !e.dead)) {
    showMapMsg('🔒 The village gates are sealed! Defeat every enemy here first.');
    transitionCooldown = 600;   // throttle the message
    return;
  }

  // The final village's castle gate: walking out that side enters the castle
  // tower instead of generating an overworld neighbor. Intercepted before
  // getOrCreateNeighbor so no phantom map is ever created on the castle side.
  {
    const cmv = currentMap();
    if (cmv.type === 'village' && cmv.castleExitDir === dir &&
        typeof enterCastleTower === 'function') {
      enterCastleTower(cmv, dir);
      return;
    }
  }

  // Snapshot the current map's enemy + villager state before leaving
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);

  const nextId = getOrCreateNeighbor(dir);
  if (nextId == null) return;

  // Leaving a village strips its King's Hoard: the boss chest is a one-time,
  // grab-it-before-you-go reward. The village gates only open once the boss is
  // dead (so the chest is always present by now); walking out any exit removes it.
  const leavingMap = currentMap();
  if (leavingMap && leavingMap.type === 'village') removeVillageBossChest(leavingMap);

  currentMapId = nextId;
  const nm = worldMaps[nextId];

  if (!nm.visited) {
    nm.visited = true;
    mapsVisited++;
    mapSequence.push(nextId);
    // Count overworld maps per region. After 20 the next new neighbor in the
    // region becomes its village (see createOverworldMap). Villages and dead-end
    // sealed maps don't count — only fresh overworld entries.
    const isOverworld = (nm.type !== 'village' && nm.type !== 'house' &&
                         nm.type !== 'cave' && !nm.sealed &&
                         typeof nm.regionIdx === 'number');
    if (isOverworld) {
      regionMapsVisited[nm.regionIdx] = (regionMapsVisited[nm.regionIdx] || 0) + 1;
      // Legacy mirror for the fire region (kept so older save logic doesn't
      // notice the rename).
      if (nm.regionIdx === 1) desertsVisited = regionMapsVisited[1];
    }
  }
  spawnEnemiesForMap(nextId);
  spawnVillagersForMap(nextId);

  // Place player just inside the opposite edge, preserving lateral position
  if (dir === 'left')        player.x = MCOLS - 2;
  else if (dir === 'right')  player.x = 1;
  else if (dir === 'up')     player.y = MROWS - 2;
  else                       player.y = 1;

  // If landing on a solid tile, scan laterally for a non-solid spot
  const map = mapData();
  if (isSolid(map, player.x, player.y)) {
    const lateral = (dir === 'left' || dir === 'right');
    for (let d = 1; d <= 5; d++) {
      let placed = false;
      for (const sign of [1, -1]) {
        const ty = lateral ? player.y + d * sign : player.y;
        const tx = lateral ? player.x : player.x + d * sign;
        if (tx >= 0 && tx < MCOLS && ty >= 0 && ty < MROWS && !isSolid(map, tx, ty)) {
          player.x = tx; player.y = ty; placed = true; break;
        }
      }
      if (placed) break;
    }
  }
  // Still solid (e.g. the destination already existed as a sealed dead-end and we
  // walked in through one of its walled-off sides — its facing border is all
  // trees): spiral outward from the entry point for the nearest open tile so the
  // hero is never stranded inside a solid tile.
  if (isSolid(map, player.x, player.y)) {
    const sx = player.x, sy = player.y;
    outer:
    for (let radius = 1; radius <= 70; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;  // ring only
          const tx = sx + dx, ty = sy + dy;
          if (tx >= 0 && tx < MCOLS && ty >= 0 && ty < MROWS && !isSolid(map, tx, ty)) {
            player.x = tx; player.y = ty; break outer;
          }
        }
      }
    }
  }

  transitionCooldown = 400;
  minimapDirty = true;
  clampCam(true);   // snap on map transition (instant teleport)
  revealAround(nm, player.x, player.y, 12);
  // (Map-name announcements removed — the current area name still lives in the
  // HUD's roomName span. Notable map events use showMapMsg instead.)
}

// Add `n` of a region's Health Potion into the satchel (cap-respecting). Forest —
// which has no bespoke brew (see HERBALIST_RECIPES) — yields classic generic Health
// Potions instead. Returns { got, label, generic }: the count that actually fit,
// its singular display label, and whether it was the generic brew.
function addRegionPotions(regionId, n) {
  const hasBrew = typeof HERBALIST_RECIPES !== 'undefined' && HERBALIST_RECIPES[regionId];
  if (!hasBrew) {
    return { got: addItem('potions', n), label: regionPotionName('forest'), generic: true };
  }
  player.regionPotions = player.regionPotions || {};
  const before = player.regionPotions[regionId] || 0;
  player.regionPotions[regionId] = Math.min(ITEM_CAP, before + n);
  return { got: player.regionPotions[regionId] - before, label: regionPotionName(regionId), generic: false };
}

// Grant `n` of a region's Health Potion and return a standalone message describing
// what landed.
function grantRegionPotions(regionId, n) {
  const { got, label, generic } = addRegionPotions(regionId, n);
  return `🧪 ${got} ${label}${got === 1 ? '' : 's'}!${generic ? ' — press P to drink' : ''}`;
}

// Grant `n` of a region's element-resistance Elixir into the satchel (cap-respecting)
// and return the describing message. Caller guarantees the region has an element.
function grantRegionElixirs(regionId, n) {
  player.elixirs = player.elixirs || {};
  const before = player.elixirs[regionId] || 0;
  player.elixirs[regionId] = Math.min(ITEM_CAP, before + n);
  const got = player.elixirs[regionId] - before;
  const elem = SWORD_ELEMENTS[regionId];
  const label = elem ? elem.label : regionId;
  const icon = elem ? elem.icon : '⚗️';
  return `${icon} ${got} ${label} Elixir${got === 1 ? '' : 's'}!`;
}

// ─── Chest / shrine pickup ────────────────────────────────────────────────────
// Called when player steps onto a CHEST or SHRINE tile.
function handlePickup(bnx, bny, map) {
  if (map[bny][bnx] === T.CHEST && !currentMap().openedChests.has(`${bnx},${bny}`)) {
    currentMap().openedChests.add(`${bnx},${bny}`);
    // Small-chest loot is tuned to the region the chest sits in (see
    // regionIdForMap): its Health Potions and element-resistance Elixirs are the
    // local brew, and the bonus ore is the local tier.
    const cm = currentMap();
    const regionId = regionIdForMap(cm);
    const d4 = () => 1 + Math.floor(Math.random() * 4);
    const roll = Math.random();
    let reward;
    if (roll < 0.30) {
      // 30% — rubies (unchanged).
      addItem('rubies', 10 + Math.floor(Math.random() * 25));
      reward = '💎 Found Rubies!';
    } else if (roll < 0.60) {
      // 30% — full hearts.
      player.hp = player.maxHp;
      reward = '❤️ Full Hearts Restored!';
    } else if (roll < 0.90) {
      // 30% — 1d4 of the region's Health Potion.
      reward = grantRegionPotions(regionId, d4());
    } else {
      // 10% — 1d4 of the region's element-resistance Elixir. Regions without an
      // element (forest) have no elixir, so that slice heals to full instead.
      if (typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[regionId]) {
        reward = grantRegionElixirs(regionId, d4());
      } else {
        player.hp = player.maxHp;
        reward = '❤️ Full Hearts Restored!';
      }
    }
    // Independent 5% bonus: 1d4 chunks of raw ore tucked in the chest. Which ore is
    // set by the region (see oreForMap / ORE_TYPES) — common Grimsilver in the early
    // regions up to priceless Voidsteel in Shadow. Added on top of the normal reward.
    let oreNote = '';
    if (Math.random() < 0.05) {
      const ore = oreForMap(cm);
      if (ore) {
        const got = addItem(ore.id, d4());
        if (got > 0) oreNote = ` ✦ ${got} ${ore.icon} ${ore.label} ore!`;
      }
    }
    // Independent 10% bonus: a bundle of 5 bombs stashed in the chest. Added on top
    // of the normal reward, regardless of what the main roll gave.
    let bombNote = '';
    if (Math.random() < 0.10) {
      addItem('bombs', 5);
      bombNote = ' 💣 5 Bombs!';
    }
    showMsg(reward + oreNote + bombNote, 3000);
    if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
    const sp = screenPX(bnx, bny);
    spawnParticle(sp.x, sp.y, '#ffcc00', 12, 4);
  }
  // Shrines are reusable — every step onto one restores full HP.
  if (map[bny][bnx] === T.SHRINE) {
    player.hp = player.maxHp;
    showMsg('🙏 Ancient Shrine — HP fully restored!', 2500);
    const sp = screenPX(bnx, bny);
    spawnParticle(sp.x, sp.y, '#aaffaa', 16, 4);
  }
  // A SEALED shrine can't be stepped-into for healing — it only whispers its clue.
  // The atmospheric hint names its element; strike it with the matching elemental
  // sword or arrow to break the seal (see tryUnsealShrine in world.js).
  if (map[bny][bnx] === T.SEALED_SHRINE) {
    const cm = currentMap();
    const clue = (cm && cm.shrineElement && typeof ELEMENT_CLUE !== 'undefined')
      ? ELEMENT_CLUE[cm.shrineElement] : null;
    showMsg(`🔒 A sealed shrine, bound tight. ${clue || 'Old runes ring it, waiting for the right elemental strike.'}`, 3500);
  }
  // Shop doors are now just walkable entrances — the actual interaction lives
  // on the innkeeper / shopkeeper inside the building (press SPACE next to
  // them). Stepping on the door is a no-op.
  // The Hero's Cache — one-time regional haul at the back of a cave. The chest
  // spans 2 horizontal tiles (LARGE_CHEST anchor + LARGE_CHEST_R extension);
  // stepping on either half resolves to the anchor (the left tile). Loot is 100%
  // guaranteed and scaled to the region: 2d6 of its raw ore, 1d4 of its Health
  // Potion, and 100 × region level rubies.
  {
    const tHere = map[bny][bnx];
    if (tHere === T.LARGE_CHEST || tHere === T.LARGE_CHEST_R) {
      const ax = tHere === T.LARGE_CHEST_R ? bnx - 1 : bnx;
      const ay = bny;
      if (!currentMap().openedChests.has(`big_${ax},${ay}`)) {
        currentMap().openedChests.add(`big_${ax},${ay}`);
        const cm = currentMap();
        const regionId = regionIdForMap(cm);
        const d6 = () => 1 + Math.floor(Math.random() * 6);
        // 2d6 chunks of the region's raw ore.
        const ore = oreForMap(cm);
        const oreGot = ore ? addItem(ore.id, d6() + d6()) : 0;
        // 1d4 of the region's Health Potion.
        const pot = addRegionPotions(regionId, 1 + Math.floor(Math.random() * 4));
        // 100 × region level rubies (forest = 1 … shadow = 13).
        const rubyGot = addItem('rubies', 100 * regionNumberOf(regionId));
        const oreClause = ore ? `${oreGot} ${ore.icon} ${ore.label} ore, ` : '';
        showMsg(`💰 The Hero's Cache! ${oreClause}${pot.got} 🧪 ${pot.label}${pot.got === 1 ? '' : 's'}, and ${rubyGot} 💎!`, 5000);
        const sp = screenPX(bnx, bny);
        spawnParticle(sp.x, sp.y, '#ffdd00', 24, 6);
        spawnParticle(sp.x, sp.y, '#ffffff', 16, 4);
      }
    }
  }

  // The region's mysterious Guild artifact — waiting in the ruined dungeon's heart
  // chest (the same LARGE_CHEST) while its Guild commission is 'active'. Granted
  // independently of the Hero's Cache flag above, keyed only off artifactStatus, so
  // a dungeon whose cache was already looted can't soft-lock the quest. The
  // 'active'→'held' flip is itself the idempotent guard.
  {
    const tHere = map[bny][bnx];
    if ((tHere === T.LARGE_CHEST || tHere === T.LARGE_CHEST_R) && currentMap().type === 'dungeon') {
      const rid = regionIdForMap(currentMap());
      player.guildQuests = player.guildQuests || {};
      const gq = player.guildQuests[rid];
      if (gq && gq.artifactStatus === 'active') {
        gq.artifactStatus = 'held';
        showMsg('🏺 You lift a rare and mysterious artifact from the chest! Return it to the Guild Recruiter.', 5000);
        if (typeof buzz === 'function') buzz([0, 30, 20, 40]);
        const sp = screenPX(bnx, bny);
        spawnParticle(sp.x, sp.y, '#cc66ff', 24, 6);
        spawnParticle(sp.x, sp.y, '#ffffff', 16, 4);
        if (typeof updateHUD === 'function') updateHUD();
      }
    }
  }

  // The King's Hoard — one-time epic reward at the boss arena. 2×2 chest with
  // BOSS_CHEST_TL as the anchor; the other three quadrants resolve back to TL.
  {
    const tHere = map[bny][bnx];
    if (tHere === T.BOSS_CHEST_TL || tHere === T.BOSS_CHEST_TR ||
        tHere === T.BOSS_CHEST_BL || tHere === T.BOSS_CHEST_BR) {
      const ax = (tHere === T.BOSS_CHEST_TR || tHere === T.BOSS_CHEST_BR) ? bnx - 1 : bnx;
      const ay = (tHere === T.BOSS_CHEST_BL || tHere === T.BOSS_CHEST_BR) ? bny - 1 : bny;
      if (!currentMap().openedChests.has(`boss_${ax},${ay}`)) {
        currentMap().openedChests.add(`boss_${ax},${ay}`);
        const cm = currentMap();
        const regionId = regionIdForMap(cm);
        const lvl = regionNumberOf(regionId);
        // +4 Max HP (the four new hearts come filled), 250 × region level 💎, 2d4 of
        // the region's Health Potion, and 1000 × region level XP — all guaranteed,
        // nothing else.
        player.maxHp = (player.maxHp || 6) + 4;
        player.hp    = Math.min(player.maxHp, (player.hp || 0) + 4);
        const rubyGot = addItem('rubies', 250 * lvl);
        const potN = (1 + Math.floor(Math.random() * 4)) + (1 + Math.floor(Math.random() * 4));
        const pot = addRegionPotions(regionId, potN);
        gainXP(1000 * lvl);
        showMsg(`👑 The King's Hoard! +4 Max HP, ${rubyGot} 💎, ${pot.got} 🧪 ${pot.label}${pot.got === 1 ? '' : 's'}, ${1000 * lvl} XP!`, 7000);
        const sp = screenPX(ax, ay);
        spawnParticle(sp.x, sp.y, '#ff66ff', 40, 8);
        spawnParticle(sp.x, sp.y, '#ffdd33', 32, 6);
        spawnParticle(sp.x, sp.y, '#ffffff', 24, 5);
      }
    }
  }
}

// ─── Village boss chest (King's Hoard) — appear on boss kill, vanish on exit ───
// The 2×2 chest is no longer baked into the village map (see mapgen-village.js).
// It materialises here the moment the village boss is slain, then is stripped the
// first time the hero walks out of the village — a grab-it-before-you-go reward.

// Stamp the King's Hoard (2×2 chest + flanking torches) onto the village plaza.
// Guards off the tile grid itself (which persists through save/load via mapTiles),
// so it's idempotent and needs no separate saved flag: if the anchor is already a
// boss chest, there's nothing to do.
function placeVillageBossChest(cm) {
  if (!cm || cm.type !== 'village' || !cm.map) return;
  const { r: bcr, c: bcc } = villageBossChestAnchor();
  const m = cm.map;
  if (m[bcr][bcc] === T.BOSS_CHEST_TL) return;   // already raised
  m[bcr    ][bcc    ] = T.BOSS_CHEST_TL;
  m[bcr    ][bcc + 1] = T.BOSS_CHEST_TR;
  m[bcr + 1][bcc    ] = T.BOSS_CHEST_BL;
  m[bcr + 1][bcc + 1] = T.BOSS_CHEST_BR;
  // Flanking torches for dramatic effect.
  m[bcr][bcc - 2] = T.TORCH;
  m[bcr][bcc + 3] = T.TORCH;
  minimapDirty = true;
  if (cm === currentMap()) {
    const sp = screenPX(bcc, bcr);
    spawnParticle(sp.x, sp.y, '#ffdd33', 28, 6);
    spawnParticle(sp.x, sp.y, '#ff66ff', 20, 5);
    showMapMsg("👑 A King's Hoard rises on the plaza — claim it before you leave!");
  }
}

// Strip the King's Hoard back to bare plaza marble (chest + its torches). Called
// when the hero first leaves the village, so an unclaimed (or claimed) chest is
// gone for good on return. Tile-guarded (persists via mapTiles): a no-op once the
// anchor is already marble, so re-leaving does nothing.
function removeVillageBossChest(cm) {
  if (!cm || cm.type !== 'village' || !cm.map) return;
  const { r: bcr, c: bcc } = villageBossChestAnchor();
  const m = cm.map;
  if (m[bcr][bcc] !== T.BOSS_CHEST_TL) return;   // nothing to strip
  m[bcr    ][bcc    ] = T.MARBLE;
  m[bcr    ][bcc + 1] = T.MARBLE;
  m[bcr + 1][bcc    ] = T.MARBLE;
  m[bcr + 1][bcc + 1] = T.MARBLE;
  m[bcr][bcc - 2] = T.MARBLE;
  m[bcr][bcc + 3] = T.MARBLE;
  minimapDirty = true;
}

// ─── Chest interaction (SPACE) ────────────────────────────────────────────────
// Chests are solid, so they're opened deliberately: stand next to one and press
// SPACE. Checks the tile the player faces first (swordDir), then the four
// neighbours. Any tile of a multi-tile chest works — handlePickup resolves it to
// the chest's anchor. Returns true only if a closed chest was actually opened,
// so the caller can swallow the keypress (and otherwise let SPACE swing).
function tryChestInteraction() {
  const map = mapData();
  const cm = currentMap();
  const dirs = [];
  if (player.swordDir && (player.swordDir.x || player.swordDir.y)) {
    dirs.push([player.swordDir.x, player.swordDir.y]);
  }
  dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  for (const [dx, dy] of dirs) {
    const c = player.x + dx, r = player.y + dy;
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) continue;
    if (!isChestTile(map[r][c])) continue;
    const before = cm.openedChests.size;
    handlePickup(c, r, map);
    if (cm.openedChests.size > before) return true;   // a closed chest just opened
  }
  return false;
}

// The `openedChests` key for a chest tile at (c, r) — mirrors handlePickup so we
// can tell whether a chest is still closed without opening it. Returns null for
// non-chest tiles. (Shrines are stepped-on, not SPACE-interacted, so excluded.)
function chestOpenedKey(t, c, r) {
  if (t === T.CHEST) return `${c},${r}`;
  if (t === T.LARGE_CHEST || t === T.LARGE_CHEST_R) {
    const ax = t === T.LARGE_CHEST_R ? c - 1 : c;
    return `big_${ax},${r}`;
  }
  if (t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_TR ||
      t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR) {
    const ax = (t === T.BOSS_CHEST_TR || t === T.BOSS_CHEST_BR) ? c - 1 : c;
    const ay = (t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR) ? r - 1 : r;
    return `boss_${ax},${ay}`;
  }
  return null;
}

// Non-destructive probe for "can SPACE interact right now?" — returns a short
// HUD label (icon + [Space]) describing the available interaction, or null when
// SPACE would just swing the sword. Mirrors the SPACE handler in main.js:
// villager/shop talk in an activated village, else an adjacent closed chest.
function interactionHint() {
  const cm = currentMap();
  if (!cm) return null;

  // 0. Lost Timmy standing on a dead-end map (villagers exist off-village here).
  if (typeof villagers !== 'undefined' && villagers && villagers.length) {
    const child = villagers.find(v => v.role === 'lostchild' && v.lost &&
      Math.abs(v.x - player.x) <= 1 && Math.abs(v.y - player.y) <= 1);
    if (child) return '👦 Help [Space]';
  }

  // 1. Talk to / shop with / travel via an adjacent villager. Adjacency alone is
  //    the gate — villagers only populate maps where interaction is intended
  //    (activated villages, the cabin's Gatekeeper, rescued / field NPCs), so this
  //    mirrors tryVillagerInteraction, which acts on any map. (The old
  //    village-only gate hid the cabin Gatekeeper's prompt from the bottom bar.)
  if (typeof villagers !== 'undefined' && villagers && villagers.length) {
    const near = villagers
      .filter(v => Math.abs(v.x - player.x) <= 1 && Math.abs(v.y - player.y) <= 1)
      .sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0))[0];
    if (near) {
      if (near.role === 'store')  return '🛒 Shop [Space]';
      if (near.role === 'inn')    return '🛏️ Inn [Space]';
      if (near.role === 'herb')   return '🌿 Herbalist [Space]';
      if (near.role === 'smith')  return '⚒️ Blacksmith [Space]';
      if (near.role === 'guild')  return '⚔️ Guild [Space]';
      if (near.role === 'portal') return '🌀 Travel [Space]';
      return '💬 Talk [Space]';
    }
  }

  // 2. Open an adjacent closed chest (facing tile first, then orthogonal).
  const map = mapData();
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (player.swordDir && (player.swordDir.x || player.swordDir.y)) {
    dirs.unshift([player.swordDir.x, player.swordDir.y]);
  }
  for (const [dx, dy] of dirs) {
    const c = player.x + dx, r = player.y + dy;
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) continue;
    const t = map[r][c];
    if (!isChestTile(t)) continue;
    const key = chestOpenedKey(t, c, r);
    if (key && !cm.openedChests.has(key)) return '📦 Open [Space]';
  }
  return null;
}

// Handle tile-based teleports (cave tunnel + cave exit). Called once per
// successful movement step. Returns true if a teleport happened.
function tryCaveTransition() {
  if (transitionCooldown > 0) return false;
  const map = mapData();
  const t = map[player.y][player.x];
  const cm = currentMap();

  // Step onto a tunnel in the overworld → drop into a hidden cave chain — the
  // same universal cave system reached behind a waterfall. Length is rolled 1d6
  // on first entry; caveLinks keys the chain to the tunnel tile so re-entering
  // the same bombed rock returns to the same caves. (Legacy single-cave maps in
  // old saves keep working via their own CAVE_EXIT handling below.)
  if (t === T.CAVE_ENTRANCE && cm.type !== 'cave' && cm.type !== 'cave_chain') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let caveId = cm.caveLinks[key];
    if (caveId == null) {
      const tier = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
        ? REGIONS[cm.regionIdx].enemyTier : 0;
      caveId = createCaveChainMap(sourceId, sourceX, sourceY, tier, 1, rnd(1, 6));
      cm.caveLinks[key] = caveId;
    }
    currentMapId = caveId;
    { const land = worldMaps[caveId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(caveId);
    spawnVillagersForMap(caveId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ You squeeze into a hidden cave…');
    return true;
  }

  // Step into the glowing doorway behind a waterfall → drop into a hidden cave
  // chain whose length is rolled 1d6 on first entry. caveLinks keys the chain to
  // the door tile so re-entering the same falls returns to the same caves.
  if (t === T.WATERFALL_DOOR && cm.type !== 'cave_chain') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let caveId = cm.caveLinks[key];
    if (caveId == null) {
      const tier = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
        ? REGIONS[cm.regionIdx].enemyTier : 0;
      caveId = createCaveChainMap(sourceId, sourceX, sourceY, tier, 1, rnd(1, 6));
      cm.caveLinks[key] = caveId;
    }
    currentMapId = caveId;
    { const land = worldMaps[caveId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(caveId);
    spawnVillagersForMap(caveId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ Behind the falls — a hidden passage!');
    return true;
  }

  // Step onto the BASE of a vertical wind gust out on an air/lightning cloud floor
  // → the updraft whisks the hero UP into a hidden sky cave chain (length rolled
  // 1d6 on first entry). The gust is an 8-tile-tall column, but only its bottom
  // tile activates: the base is the gust tile with no gust directly below it, so
  // walking up through the rising shaft above it does nothing. The cloud regions
  // can't hold buried caves, so this is their universal cave system — built from
  // the region's own tiles and enemies. caveLinks keys the chain to the base tile
  // so re-entering the same gust returns to the same sky cave. See createSkyCaveMap.
  const onGustBase = t === T.WIND_GUST &&
    !(player.y + 1 < MROWS && map[player.y + 1][player.x] === T.WIND_GUST);
  if (onGustBase && cm.type !== 'sky_cave') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let caveId = cm.caveLinks[key];
    if (caveId == null) {
      const regionIdx = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
        ? cm.regionIdx : Math.max(0, REGIONS.findIndex(r => r.id === cm.biome));
      caveId = createSkyCaveMap(sourceId, sourceX, sourceY, regionIdx, 1, rnd(1, 6));
      cm.caveLinks[key] = caveId;
    }
    currentMapId = caveId;
    { const land = worldMaps[caveId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(caveId);
    spawnVillagersForMap(caveId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🌬️ A gust of wind lifts you into the clouds!');
    return true;
  }

  // Step onto an ascent gust inside a sky cave → ride the updraft one level higher
  // (building the next level on first visit). Each ascent links back to itself for
  // the return drop. Mirrors CAVE_DESCENT for the rock caves.
  if (t === T.SKY_ASCENT && cm.type === 'sky_cave') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let nextId = cm.caveLinks[key];
    if (nextId == null) {
      nextId = createSkyCaveMap(sourceId, sourceX, sourceY,
                                cm.regionIdx, cm.chainDepth + 1, cm.chainLen);
      cm.caveLinks[key] = nextId;
    }
    currentMapId = nextId;
    { const land = worldMaps[nextId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(nextId);
    spawnVillagersForMap(nextId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🌬️ An updraft carries you higher into the storm…');
    return true;
  }

  // Step onto the downdraft exit inside a sky cave → the wind sets the hero back
  // down: to the level below (climbing back down the chain) or out onto the
  // overworld gust that lifted them. Mirrors CAVE_EXIT for the rock caves.
  if (t === T.SKY_EXIT && cm.type === 'sky_cave') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    const dest = worldMaps[currentMapId];
    if (dest.type === 'sky_cave' && dest.deeperLand) {
      // Dropping back down a level: land beside the ascent gust we rode up through.
      player.x = dest.deeperLand.x; player.y = dest.deeperLand.y;
    } else {
      // Surfacing onto the overworld: land back on the passable gust tile itself.
      player.x = cm.returnX; player.y = cm.returnY;
    }
    spawnEnemiesForMap(currentMapId);
    spawnVillagersForMap(currentMapId);
    transitionCooldown = 600;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 12);
    showMapMsg('🌬️ The wind sets you gently back down.');
    return true;
  }

  // Step onto the spiral stair UP inside the castle tower → climb one floor
  // (building the next floor on first visit). Each stair links back to itself
  // for the descent. Mirrors SKY_ASCENT for the sky caves.
  if (t === T.TOWER_STAIRS_UP && cm.type === 'castle_tower') {
    // Each floor is sealed until its garrison falls — no climbing past live
    // guardians. (The dormant dragon only ever stands on floor 14, which has no
    // stair up, so finalBoss is excluded defensively.) A short cooldown keeps
    // the "sealed" message from spamming while the hero shoves at the stair.
    const remaining = enemies.filter(e => !e.dead && !e.finalBoss).length;
    if (remaining > 0) {
      transitionCooldown = 400;
      showMapMsg(remaining === 1
        ? '🔒 The stair is sealed — one last guardian still stands on this floor.'
        : `🔒 The stair is sealed — ${remaining} guardians still stand on this floor.`);
      return true;
    }
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let nextId = cm.caveLinks[key];
    if (nextId == null) {
      nextId = createTowerFloorMap(sourceId, sourceX, sourceY, cm.floorIdx + 1);
      cm.caveLinks[key] = nextId;
    }
    currentMapId = nextId;
    { const land = worldMaps[nextId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(nextId);
    spawnVillagersForMap(nextId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    const nf = worldMaps[nextId].floorIdx;
    showMapMsg(nf >= 14
      ? '🐉 The pinnacle. Every fallen champion of the realm stands guard here…'
      : `🏰 You climb the spiral stair — Floor ${nf}/14.`);
    // Checkpoint each floor of the climb (including the pinnacle) so a death
    // restores the hero to the start of the floor they fell on.
    if (typeof autoSave === 'function') autoSave(`Castle Tower — Floor ${nf}`);
    return true;
  }

  // Step onto the spiral stair DOWN inside the castle tower → descend: to the
  // floor below, or out through the castle gate into the final village.
  // Mirrors SKY_EXIT for the sky caves.
  if (t === T.TOWER_STAIRS_DOWN && cm.type === 'castle_tower') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    const dest = worldMaps[currentMapId];
    if (dest.type === 'castle_tower' && dest.deeperLand) {
      // Descending a floor: land beside the stair-up we climbed through.
      player.x = dest.deeperLand.x; player.y = dest.deeperLand.y;
    } else {
      // Leaving the castle: land just inside the village's castle gate.
      player.x = cm.returnX; player.y = cm.returnY;
    }
    spawnEnemiesForMap(currentMapId);
    spawnVillagersForMap(currentMapId);
    transitionCooldown = 600;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 12);
    showMapMsg(dest.type === 'castle_tower'
      ? `🏰 You wind back down — Floor ${dest.floorIdx}/14.`
      : '🏘️ You step out of the castle, back into the village.');
    return true;
  }

  // Step onto a descent inside a cave chain → go one level deeper (building the
  // next level on first visit). Each descent links back to itself for the climb.
  if (t === T.CAVE_DESCENT && cm.type === 'cave_chain') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let nextId = cm.caveLinks[key];
    if (nextId == null) {
      nextId = createCaveChainMap(sourceId, sourceX, sourceY,
                                  cm.sourceTier, cm.chainDepth + 1, cm.chainLen);
      cm.caveLinks[key] = nextId;
    }
    currentMapId = nextId;
    { const land = worldMaps[nextId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(nextId);
    spawnVillagersForMap(nextId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 16);
    showMapMsg('🕳️ You descend deeper into the cave…');
    return true;
  }

  // Step onto the reward portal beside the deep large chest → warp all the way
  // back out to the overworld region map this labyrinth hangs off (rootMapId),
  // skipping the whole climb back up the chain. Works from a cave chain's deepest
  // level, a sky cave's highest reach, and a ruined dungeon. Falls back to the
  // immediate return map for any legacy save whose deep map predates rootMapId.
  if (t === T.CHEST_EXIT) {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const backId = cm.rootMapId != null ? cm.rootMapId : cm.returnMapId;
    const backX  = cm.rootMapId != null ? cm.rootX : cm.returnX;
    const backY  = cm.rootMapId != null ? cm.rootY : cm.returnY;
    currentMapId = backId;
    const srcMap = worldMaps[currentMapId].map;
    // Land one tile south of the entrance we originally used, else nearest open.
    let tx = backX, ty = Math.min(MROWS - 2, backY + 1);
    if (isSolid(srcMap, tx, ty)) {
      const candidates = [
        [0,  1], [1,  0], [-1, 0], [0, -1],
        [1,  1], [-1, 1], [1, -1], [-1, -1],
        [0,  2], [2,  0], [-2, 0], [0, -2]
      ];
      tx = backX; ty = backY;
      for (const [dx, dy] of candidates) {
        const cx2 = backX + dx, cy2 = backY + dy;
        if (cx2 >= 0 && cx2 < MCOLS && cy2 >= 0 && cy2 < MROWS && !isSolid(srcMap, cx2, cy2)) {
          tx = cx2; ty = cy2; break;
        }
      }
    }
    player.x = tx; player.y = ty;
    spawnEnemiesForMap(currentMapId);
    spawnVillagersForMap(currentMapId);
    transitionCooldown = 600;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 12);
    showMapMsg('✨ The portal returns you to the surface.');
    return true;
  }

  // Step onto the cave exit → return to source map at the tunnel tile
  if (t === T.CAVE_EXIT && (cm.type === 'cave' || cm.type === 'cave_chain')) {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    const dest = worldMaps[currentMapId];
    const srcMap = dest.map;
    let tx, ty;
    // The chain-aware landings apply ONLY when *this* map is a chain level.
    // A legacy cache cave (cm.type === 'cave') — even one bombed open inside a
    // chain level — must always return to its own entrance tile (returnX/Y),
    // never to the chain's descent.
    if (cm.type === 'cave_chain' && dest.type === 'cave_chain' && dest.deeperLand) {
      // Climbing back up a chain: stand beside the descent we came down through.
      tx = dest.deeperLand.x; ty = dest.deeperLand.y;
    } else if (cm.type === 'cave_chain' &&
               srcMap[cm.returnY] && srcMap[cm.returnY][cm.returnX] === T.WATERFALL_DOOR) {
      // Surfacing behind a waterfall: land back on the door itself — the splash
      // pool around it is medium water, so there's no dry tile to step onto.
      tx = cm.returnX; ty = cm.returnY;
    } else {
      // Legacy cache cave / any tunnel: one tile south of the mouth, else nearest open.
      tx = cm.returnX;
      ty = Math.min(MROWS - 2, cm.returnY + 1);
      if (isSolid(srcMap, tx, ty)) {
        const candidates = [
          [0,  1], [1,  0], [-1, 0], [0, -1],
          [1,  1], [-1, 1], [1, -1], [-1, -1],
          [0,  2], [2,  0], [-2, 0], [0, -2]
        ];
        for (const [dx, dy] of candidates) {
          const cx2 = cm.returnX + dx, cy2 = cm.returnY + dy;
          if (cx2 >= 0 && cx2 < MCOLS && cy2 >= 0 && cy2 < MROWS && !isSolid(srcMap, cx2, cy2)) {
            tx = cx2; ty = cy2; break;
          }
        }
      }
    }
    player.x = tx; player.y = ty;
    spawnEnemiesForMap(currentMapId);
    spawnVillagersForMap(currentMapId);
    transitionCooldown = 600;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 12);
    showMapMsg('🕳️ You emerge back from the cave.');
    return true;
  }

  // Step onto a ruined-dungeon door out in the overworld → descend into the
  // region's dungeon (built on first entry; caveLinks keys it to the door tile so
  // re-entering the same door returns to the same dungeon). Mirrors the cave-chain
  // entry — the dungeon is a single level whose own DUNGEON_DOOR leads back out.
  if (t === T.DUNGEON_DOOR && cm.type !== 'dungeon') {
    const regionIdx = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
      ? cm.regionIdx
      : Math.max(0, REGIONS.findIndex(r => r.id === cm.biome));
    // The dungeon is sealed by ancient magic until the region's Guild artifact
    // commission is taken (see guildDungeonSealed / talkGuildRecruiter). Bounce off.
    if (typeof guildDungeonSealed === 'function' && guildDungeonSealed(regionIdx)) {
      showMapMsg('🔒 The ruined dungeon is sealed by ancient magic. Only the Sword & Shield Guild can break it.');
      return true;
    }
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    const sourceId = currentMapId, sourceX = player.x, sourceY = player.y;
    cm.caveLinks = cm.caveLinks || {};
    const key = `${sourceX},${sourceY}`;
    let dungId = cm.caveLinks[key];
    if (dungId == null) {
      dungId = createDungeonMap(sourceId, sourceX, sourceY, regionIdx);
      cm.caveLinks[key] = dungId;
    }
    currentMapId = dungId;
    { const land = worldMaps[dungId].entryLand; player.x = land.x; player.y = land.y; }
    spawnEnemiesForMap(dungId);
    spawnVillagersForMap(dungId);
    transitionCooldown = 400;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 14);
    showMapMsg('🏛️ You step down into the ruined dungeon…');
    return true;
  }

  // Step onto the dungeon's door → climb back out to the overworld, landing just
  // south of the door that opened it (falling back to the door tile itself if that
  // spot is somehow blocked). Mirrors CAVE_EXIT for the rock caves.
  if (t === T.DUNGEON_DOOR && cm.type === 'dungeon') {
    saveEnemyStateToMap(currentMapId);
    saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    const srcMap = worldMaps[currentMapId].map;
    let tx = cm.returnX, ty = Math.min(MROWS - 2, cm.returnY + 1);
    if (isSolid(srcMap, tx, ty)) { tx = cm.returnX; ty = cm.returnY; }
    player.x = tx; player.y = ty;
    spawnEnemiesForMap(currentMapId);
    spawnVillagersForMap(currentMapId);
    transitionCooldown = 600;
    minimapDirty = true;
    clampCam(true);
    revealAround(currentMap(), player.x, player.y, 12);
    showMapMsg('🏛️ You emerge from the ruined dungeon.');
    return true;
  }
  return false;
}

// ─── Player movement step ─────────────────────────────────────────────────────
// Called from update(); reads `keys` and steps once per MOVE_MS.
function stepPlayerMovement() {
  if (whirlpoolChurnMs > 0) return;   // caught in the vortex — can't swim free
  let mx = 0, my = 0;
  if      (keys['ArrowLeft']  || keys['a'] || keys['A']) mx = -1;
  else if (keys['ArrowRight'] || keys['d'] || keys['D']) mx = 1;
  if      (keys['ArrowUp']    || keys['w'] || keys['W']) my = -1;
  else if (keys['ArrowDown']  || keys['s'] || keys['S']) my = 1;
  const map = mapData();
  if (mx || my) {
    // Remember the live walking input for the ice slide below.
    lastWalkInput.mx = mx; lastWalkInput.my = my; lastWalkInput.t = Date.now();
  } else {
    // Slippery ice: standing on an ICE sheet keeps the released walk input
    // active for an extra ICE_SLIDE_MS, so the hero keeps gliding for a couple
    // of beats after you let go instead of halting on a dime.
    if (map[player.y][player.x] === T.ICE && lastWalkInput.t >= 0 &&
        Date.now() - lastWalkInput.t <= ICE_SLIDE_MS) {
      mx = lastWalkInput.mx; my = lastWalkInput.my;
    }
    if (!mx && !my) return;
  }
  // Trudging through a sand DUNE (fire region), a SNOW_DRIFT (ice region), a
  // MUD clump (earth region), or a boggy BOG mire (poison region) halves walk
  // speed; swimming through MEDIUM_WATER is slower still — 40% of normal pace
  // (interval × 2.5). The step gate stretches to match while standing on one.
  const standTile = map[player.y][player.x];
  const stepMs = standTile === T.DUNE         ? MOVE_MS * 2
               : standTile === T.SNOW_DRIFT   ? MOVE_MS * 2
               : standTile === T.MUD          ? MOVE_MS * 2
               : standTile === T.BOG          ? MOVE_MS * 2
               : standTile === T.MEDIUM_WATER ? MOVE_MS * 2.5
               : MOVE_MS;
  if (moveTimer < stepMs) return;

  // Carry the sub-frame remainder past the gate (capped so an idle-accumulated
  // timer can't burst extra steps): steps land every stepMs on average instead
  // of rounding up to whole frames, which made the cadence uneven.
  moveTimer = Math.min(moveTimer - stepMs, 25);
  lastStepMs = stepMs;   // the render glide covers this step at the same pace
  if (!keys['Shift']) {
    if (mx) player.swordDir = { x: mx, y: 0 };
    if (my) player.swordDir = { x: 0, y: my };  // vertical wins when both pressed
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bnx = clamp(player.x + mx, 0, MCOLS - 1);
  const bny = clamp(player.y + my, 0, MROWS - 1);
  const enemyAt = (c, r) => enemies.some(e => !e.dead && e.x === c && e.y === r);
  // The Water armor lets the hero swim through MEDIUM_WATER (the shelf between
  // wadeable SHALLOW_WATER and impassable DEEP_WATER). Without it, that tile is
  // solid like normal. DEEP_WATER stays off-limits regardless.
  const canSwimMedium = player.activeArmorElement === 'water';
  const blocked = (c, r) => {
    if (enemyAt(c, r)) return true;
    if (canSwimMedium && map[r] && map[r][c] === T.MEDIUM_WATER) return false;
    return isSolid(map, c, r);
  };

  // Try diagonal first; if blocked, slide along whichever axis is clear.
  let tx = player.x, ty = player.y;
  if (mx && my) {
    if      (!blocked(bnx, bny))      { tx = bnx; ty = bny; }
    else if (!blocked(bnx, player.y)) { tx = bnx; }
    else if (!blocked(player.x, bny)) { ty = bny; }
  } else if (!blocked(bnx, bny)) {
    tx = bnx; ty = bny;
  }

  // Chests are solid — you can't stand on them. Opening is a deliberate action:
  // press SPACE while adjacent (see tryChestInteraction). handlePickup is still
  // called on the destination tile so step-on triggers (SHRINE) keep working.
  if (tx !== player.x || ty !== player.y) {
    handlePickup(tx, ty, map);
    // Climb/jump feedback: hop when mounting or leaving a CLIMB ramp lip, and
    // kick up sand while scrambling along the ramp.
    const wasClimb = map[player.y][player.x] === T.CLIMB;
    const nowClimb = map[ty][tx] === T.CLIMB;
    if (wasClimb !== nowClimb) playerJumpStart = Date.now();
    // Dive-in / haul-out feedback: the same hop when crossing the medium-water
    // boundary in either direction (Water armor swimming).
    const wasSwim = map[player.y][player.x] === T.MEDIUM_WATER;
    const nowSwim = map[ty][tx] === T.MEDIUM_WATER;
    if (wasSwim !== nowSwim) playerJumpStart = Date.now();
    if (nowClimb) {
      const sp = screenPX(tx, ty);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.35, '#caa46a', 4, 2);
    }
    // Splash a little water when wading into a SHALLOW_WATER tile. Spawn at the
    // player's smoothed render position (not the destination tile) so the splash
    // lands under the sprite rather than a tile ahead of it while walking.
    if (map[ty][tx] === T.SHALLOW_WATER) {
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#c8eef8', 5, 2);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#9fd6e8', 3, 2);
    } else if (map[ty][tx] === T.MEDIUM_WATER) {
      // Swimming (Water armor only) — a bigger, deeper splash than wading.
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#bfe6f4', 7, 2);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#5aa8c8', 4, 2);
    } else if (wasSwim) {
      // Hauling out onto dry land — water sheds off the hero behind the hop.
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#bfe6f4', 5, 2);
    }
    player.x = tx; player.y = ty;
  }
  clampCam();
  revealAround(currentMap(), player.x, player.y, 12);
  if (!tryPortalInteraction() && !tryCaveTransition()) tryTransition();
}

// ─── Whirlpool suction ────────────────────────────────────────────────────────
// Whirlpools actively grab swimmers: getting within 1 tile (Chebyshev) of one
// drags the hero to its eye, churns them under for a moment (movement locked,
// 2 damage), then spits them out a few tiles away. A short cooldown after the
// throw keeps the vortex from chaining grabs back-to-back.
let whirlpoolChurnMs = 0;        // >0 while caught — stepPlayerMovement is locked
let whirlpoolCooldown = 0;       // re-grab lockout after being spat out
let whirlpoolSprayAcc = 0;       // spray-particle drip timer while churning
const WHIRLPOOL_CHURN_MS  = 750;
const WHIRLPOOL_REGRAB_MS = 1500;

function stepWhirlpoolPull(dt) {
  const map = mapData();
  if (whirlpoolCooldown > 0) whirlpoolCooldown -= dt;

  // Mid-churn: spin spray off the vortex, then throw the hero clear. If the
  // player is no longer on a whirlpool (map load / teleport), cancel cleanly.
  if (whirlpoolChurnMs > 0) {
    if (map[player.y][player.x] !== T.WHIRLPOOL) { whirlpoolChurnMs = 0; return; }
    whirlpoolChurnMs -= dt;
    whirlpoolSprayAcc += dt;
    if (whirlpoolSprayAcc > 90) {
      whirlpoolSprayAcc = 0;
      const sp = screenPX(player.renderX, player.renderY);
      spawnParticle(sp.x, sp.y, '#eaf4ff', 3, 3);
      spawnParticle(sp.x, sp.y, '#3f79ad', 2, 2);
    }
    if (whirlpoolChurnMs <= 0) resolveWhirlpoolDive();
    return;
  }
  if (whirlpoolCooldown > 0) return;

  // Grab check — any whirlpool within 1 tile of the player?
  let wx = -1, wy = -1;
  for (let dr = -1; dr <= 1 && wx < 0; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = player.x + dc, r = player.y + dr;
      if (r >= 0 && r < MROWS && c >= 0 && c < MCOLS &&
          map[r][c] === T.WHIRLPOOL) { wx = c; wy = r; break; }
    }
  }
  if (wx < 0) return;

  // Caught — drag to the eye (the render lerp animates the pull) and churn.
  player.x = wx; player.y = wy;
  playerJumpStart = Date.now();
  whirlpoolChurnMs = WHIRLPOOL_CHURN_MS;
  clampCam();
  const sp = screenPX(wx, wy);
  spawnParticle(sp.x, sp.y, '#eaf4ff', 14, 4);
  spawnParticle(sp.x, sp.y, '#2c5d8e', 10, 3);
  showMsg('🌀 The whirlpool drags you under!', 2000);
  if (player.invincible <= 0) {
    damagePlayer(2, null);
    player.invincible = 900;
    if (player.hp <= 0) { whirlpoolChurnMs = 0; respawn(); }
  }
}

// Churn finished — the vortex swallows the hero. A whirlpool on a normal map
// dives down into its flooded grotto (created on first visit, then reused);
// the grotto's own vortex returns to the map that swallowed the player,
// surfacing them beside the original whirlpool.
function resolveWhirlpoolDive() {
  const cm = currentMap();
  if (cm.type === 'whirlpool_grotto') exitWhirlpoolGrotto(cm);
  else enterWhirlpoolGrotto(cm);
}

function enterWhirlpoolGrotto(cm) {
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);
  const wx = player.x, wy = player.y;        // the vortex tile we're on
  cm.grottoLinks = cm.grottoLinks || {};
  const key = `${wx},${wy}`;
  let gid = cm.grottoLinks[key];
  if (gid == null) {
    const tier = (typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
      ? REGIONS[cm.regionIdx].enemyTier : 0;
    gid = createWhirlpoolGrottoMap(currentMapId, wx, wy, tier);
    cm.grottoLinks[key] = gid;
  }
  currentMapId = gid;
  player.x = Math.floor(MCOLS / 2);
  player.y = Math.floor(MROWS / 2);
  spawnEnemiesForMap(gid);
  spawnVillagersForMap(gid);
  transitionCooldown = 400;
  whirlpoolCooldown = WHIRLPOOL_REGRAB_MS;
  minimapDirty = true;
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 16);
  showMapMsg('🌀 The vortex drags you down into a flooded grotto!');
}

function exitWhirlpoolGrotto(cm) {
  saveEnemyStateToMap(currentMapId);    // dead swimmers stay dead on re-entry
  saveVillagersToMap(currentMapId);
  currentMapId = cm.returnMapId;
  player.x = cm.returnX; player.y = cm.returnY;
  spawnEnemiesForMap(currentMapId);
  spawnVillagersForMap(currentMapId);
  // Scatter off the vortex into nearby open water (also arms the re-grab
  // cooldown so the whirlpool can't swallow the hero straight back).
  ejectFromWhirlpool(mapData());
  transitionCooldown = 600;
  minimapDirty = true;
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 12);
  showMapMsg('🌊 The whirlpool spits you back out!');
}

// Throw the hero out to open water 2–3 tiles from the vortex — past the pull
// ring, so they aren't grabbed straight back. If no medium-water tile exists
// out there (hemmed in by deep water), leave them treading on the vortex; the
// re-grab cooldown gives them time to swim clear.
function ejectFromWhirlpool(map) {
  const exits = [];
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) < 2) continue;
      const c = player.x + dc, r = player.y + dr;
      if (r > 0 && r < MROWS - 1 && c > 0 && c < MCOLS - 1 &&
          map[r][c] === T.MEDIUM_WATER) exits.push({ c, r });
    }
  }
  if (exits.length) {
    const out = exits[Math.floor(Math.random() * exits.length)];
    player.x = out.c; player.y = out.r;
  }
  playerJumpStart = Date.now();
  whirlpoolCooldown = WHIRLPOOL_REGRAB_MS;
  clampCam();
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#bfe6f4', 8, 3);
  spawnParticle(sp.x, sp.y + TILE_PX * 0.3, '#5aa8c8', 5, 2);
}

// The Gatekeeper now controls the gate — stepping onto the PORTAL tile no
// longer opens the menu. Point the player toward the keeper instead. (Returns
// true to swallow the step so no map-transition logic runs on the portal tile.)
function tryPortalInteraction() {
  if (transitionCooldown > 0) return false;
  const map = mapData();
  const t = map[player.y][player.x];
  if (t !== T.PORTAL) return false;
  if (typeof showMsg === 'function') {
    showMsg('🌀 The Gatekeeper controls this gate — speak with them to travel.', 2600);
  }
  return true;
}
