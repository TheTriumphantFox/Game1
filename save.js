// ─── Save / load: named slot system ───────────────────────────────────────────
// Stores each save under `stormdrift_slot_N` in localStorage, plus a
// metadata index (`stormdrift_index`) with slot names and timestamps.
// Save payloads use the compact v2 tile representation below: seeded maps carry
// sparse changes and hand-built maps carry run-length encoded tiles.

const SAVE_KEY_PREFIX = 'stormdrift_slot_';
const SAVE_FORMAT_VERSION = 2;
// Slot indices are 0-based here and displayed as i + 1, so this is also the
// highest slot number the player sees. Raising it only widens the list: every
// existing save keeps its own index and key, so nothing has to be migrated.
const MAX_SLOTS = 9;

let modalMode = null;        // 'save' | 'load'
let pendingSlot = null;      // slot index currently being named

function getSaveIndex() {
  const raw = localStorage.getItem('stormdrift_index');
  if (!raw) return {};
  // A corrupted or hand-edited index used to throw straight out of JSON.parse,
  // which broke renderSlotList() and everything that opens the save/load modal —
  // the game had no menu left to save or load from until localStorage was
  // cleared by hand. Treat it as an empty index instead; the modal still opens
  // and the corrupted key is overwritten on the next setSaveIndex().
  try {
    const idx = JSON.parse(raw);
    return (idx && typeof idx === 'object') ? idx : {};
  } catch (e) {
    console.warn('Save index was corrupted, resetting it', e);
    return {};
  }
}
function setSaveIndex(idx) {
  localStorage.setItem('stormdrift_index', JSON.stringify(idx));
}

// Does this map's tile array have to go into the save, or can it be regenerated?
//
// Three ways out of paying 30 KB for a map:
//   • never visited — the player has not seen it, and it always regenerates;
//   • seeded AND untouched — regeneration reproduces it exactly, so storing tiles
//     is redundant;
//   • seeded AND changed — only the [flat index, tile] replacements are stored;
//     hand-built maps without a recipe use run-length encoding for their full grid.
//
// The moment gameplay writes to the tile array — cut foliage, a bombed rock, the
// village boss chest, an unsealed shrine, an ability alcove — the hash diverges.
// The hash answers the cheap clean/dirty question; only dirty seeded maps pay the
// one-time cost of rebuilding their pristine baseline to make a sparse delta.
function mapNeedsStoredTiles(m) {
  if (!m.visited) return false;
  if (m.mapSeed == null || m.pristineHash == null) return true;
  return tileHash(m.map) !== m.pristineHash;
}

function saveRegionIndex(m) {
  if (typeof m.regionIdx === 'number' && REGIONS[m.regionIdx]) return m.regionIdx;
  const biome = m.biome === 'desert' ? 'fire' : m.biome;
  const found = REGIONS.findIndex(region => region.id === biome);
  return found < 0 ? 0 : found;
}

function isSeededOverworldType(type, regionIdx) {
  const region = REGIONS[regionIdx];
  return !!region && (type === region.id || (type === 'desert' && regionIdx === 1));
}

function mapHasSeedRecipe(m) {
  return m.mapSeed != null && m.pristineHash != null &&
         isSeededOverworldType(m.type, saveRegionIndex(m)) &&
         typeof buildOverworldForRegion === 'function';
}

// Rebuilding a pristine seeded map is deterministic. Cache it by map object so
// repeated autosaves do not pay the generation cost again, while a new world gets
// a fresh cache key naturally when its map objects are replaced.
const pristineMapCache = new WeakMap();
function pristineMapForSave(m) {
  if (!mapHasSeedRecipe(m)) return null;
  const cached = pristineMapCache.get(m);
  if (cached) return cached;
  const regionIdx = saveRegionIndex(m);
  const base = buildOverworldForRegion(regionIdx, m.mapSeed, m.depth,
                                       mapOpenSides(m), !!m.placeDungeon);
  pristineMapCache.set(m, base);
  return base;
}

function mapTilePayload(m) {
  if (!mapNeedsStoredTiles(m)) return {};
  const baseline = pristineMapForSave(m);
  if (baseline) {
    const delta = encodeMapDelta(m.map, baseline);
    const packed = encodeMapCompact(m.map);
    // A badly mismatched recipe should not expand a save. RLE is the safe
    // fallback when a sparse delta would be larger than a complete packed grid.
    if (JSON.stringify(delta).length < packed.length) return { mapDelta: delta };
    return { mapTiles: packed };
  }
  return { mapTiles: encodeMapCompact(m.map) };
}

// Serialize everything needed to restore the world. Maps that are unvisited — or
// seeded and still exactly as generated — carry no tile payload and are rebuilt from
// their recipe on load. New payloads are versioned so the complete-map codec is
// unambiguous; the loader still recognizes the old raw Base64 field when present.
function buildSaveData() {
  saveEnemyStateToMap(currentMapId);   // capture live enemies before serializing
  return {
    saveVersion: SAVE_FORMAT_VERSION,
    player,
    currentMapId,
    // The one roster worth writing for a map that doesn't remember its dead: the
    // fight the hero is standing in the middle of right now. Only what is still
    // breathing, at the position and HP it has this instant — a reload drops the
    // hero back into the same fight rather than a freshly stocked map, while
    // walking out and back in still regenerates it (see mapRemembersEnemies).
    // Villages and tower floors need nothing here; their full roster, dead
    // included, is in worldMapsLite[].savedEnemies below.
    liveEnemies: mapRemembersEnemies(worldMaps[currentMapId])
      ? null : enemies.filter(e => !e.dead).map(e => ({ ...e })),
    mapsVisited,
    desertsVisited,
    currentRegionIdx,
    regionMapsVisited,
    regionDungeonPlaced,
    mapSequence,
    worldGrid,
    worldSeed,
    worldMapsLite: worldMaps.map(m => ({
      id: m.id, gx: m.gx, gy: m.gy,
      name: m.name, type: m.type, biome: m.biome, regionIdx: m.regionIdx, depth: m.depth,
      homeLayoutVersion: m.homeLayoutVersion,
      openedChests: Array.from(m.openedChests),
      visited: m.visited,
      // Only the arenas persist a roster (see mapRemembersEnemies in enemies.js).
      // Everywhere else regenerates from enemyDefs on entry, so there is nothing
      // here to keep — and a save written before that change may still carry a
      // stale one, which is dropped rather than restored.
      savedEnemies: mapRemembersEnemies(m) ? (m.savedEnemies || null) : null,
      savedVillagers: m.savedVillagers || null,
      // Fog of war has been removed from the game, so no fog is written any more.
      // Older saves still carry `fogPacked` / `fog` keys; the loader ignores them.
      ...mapTilePayload(m),
      // ─── Rebuild inputs, for maps that carry no tile payload ────────────────
      // Only *visited* maps store their tiles, so anything the player never walked
      // into is regenerated from its builder on load. That rebuild was being handed
      // `undefined` for openSides, which the builders read as "all four sides open"
      // — so every sealed dead-end came back with four exits instead of one and the
      // region seal fell apart after a save/load. Persist the topology the map
      // actually has, so the rebuild can reproduce it.
      //
      // `sealed` matters beyond the borders: dead-ends are excluded from the
      // per-region map count that triggers a village (player.js), from Guild quarry
      // and bounty spawn candidates (guild.js), and from ability-secret stamping
      // (abilities.js). Dropping the flag quietly opted them into all three.
      openSides: mapOpenSides(m),
      sealed: m.sealed || undefined,
      // The rest of the generation recipe. With mapSeed + depth + openSides +
      // placeDungeon, a rebuilt map is the SAME map rather than an unrelated one —
      // generation is seeded now (see beginSeededGeneration in map-helpers.js).
      // placeDungeon in particular is decided from mutable world state at creation
      // time, so without it a rebuild silently dropped the region's dungeon entrance.
      mapSeed: m.mapSeed,
      placeDungeon: m.placeDungeon || undefined,
      pristineHash: m.pristineHash,
      // Cave linkage — only set for caves and source maps that opened one.
      returnMapId: m.returnMapId,
      returnX: m.returnX,
      returnY: m.returnY,
      // Overworld root-return target for the deep CHEST_EXIT portal (caves/dungeons).
      rootMapId: m.rootMapId,
      rootX: m.rootX,
      rootY: m.rootY,
      caveLinks: m.caveLinks ? { ...m.caveLinks } : undefined,
      // Waterfall cave-chain state (set on cave_chain maps).
      sourceTier: m.sourceTier,
      chainDepth: m.chainDepth,
      chainLen: m.chainLen,
      entryLand: m.entryLand,
      deeperLand: m.deeperLand,
      // Castle tower state — floor number (castle_tower maps) and the final
      // village's castle-gate side.
      floorIdx: m.floorIdx,
      castleExitDir: m.castleExitDir,
      // Which ability secret this map was stamped with, or null if it was
      // examined and didn't qualify (abilities.js). Persisted so the stamping
      // pass knows it has already run here — the terrain it laid is in the
      // stored tile payload already, and a second pass would hollow a second alcove.
      abilitySecret: m.abilitySecret,
      // Sealed-shrine required element (set on the one overworld map per region
      // that hosts the shrine; used to tint the shrine + its clue runes).
      shrineElement: m.shrineElement,
      shrineDoor: m.shrineDoor ? { ...m.shrineDoor } : undefined,
      shrineState: m.shrineState ? shrineClone(m.shrineState) : undefined,
      // Whirlpool grotto linkage — set on source maps that opened a grotto,
      // plus the cleared-chest flag on the grotto itself.
      grottoLinks: m.grottoLinks ? { ...m.grottoLinks } : undefined,
      grottoChestPlaced: m.grottoChestPlaced || undefined,
      // Village activation state
      activated: m.activated || false,
      // Elderbrook after Ashfall: the market row still trades, but on the ruin's
      // terms (bare shelves, forest prices). Without this the reloaded village
      // goes back to selling the endgame's stock out of a burnt-out shop.
      shopsRuined: m.shopsRuined || undefined,
      innDoor: m.innDoor || undefined,
      storeDoor: m.storeDoor || undefined,
      herbDoor: m.herbDoor || undefined,
      smithDoor: m.smithDoor || undefined
    }))
  };
}

// Authoritative default shape — any save missing a field falls back here.
const DEFAULT_PLAYER = {
  // Hero name — chosen on New Game (name prompt, main.js); labels save slots.
  heroName: '',
  // Lifetime death count — bumped in respawn() (player.js), shown on stats page.
  deaths: 0,
  x: EXIT_COL, y: EXIT_ROW,
  renderX: EXIT_COL, renderY: EXIT_ROW,
  // Height above the ground (see stepPlayerJump, player.js). Here so a save
  // written before z existed loads with both feet on the floor rather than
  // `undefined`, which would read as NaN the moment anything multiplied it.
  z: 0,
  // Height of the surface underfoot (ledges, 5d). Same reasoning: a save from
  // before ledges existed must load standing on the floor, not on `undefined`.
  // It is also recomputed from the tile on the first step after a load, so a
  // stale value cannot survive; this is what covers the frame before that.
  groundZ: 0,
  hp: 12, maxHp: 12, tempHp: 0,
  rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  // Punch swing clock — the fists' twin of swordTimer (see player.js).
  punchTimer: 0,
  // Bow-draw pose clock, the ranged twin of swordTimer/punchTimer (see player.js).
  bowTimer: 0,
  invincible: 0,
  // Which dead-end map the Earth frog was planted on, or null before the hero
  // has found one. Null-safe on load: a save written before the frog existed
  // reads as "not placed yet" and gets one on the next Earth dead-end.
  frogOracleMapId: null,
  // Regional heat (desert heatstroke, later Volcanic overheat) and quicksand
  // depth, both 0..1. Transient — they are recomputed from the tile underfoot
  // every frame and cleared on leaving the region — but defaulted here so a save
  // written before they existed loads as "cool and on solid ground" rather than
  // as undefined arithmetic.
  heat: 0, sink: 0,
  weapon: 'sword',
  bowLevel: 1, swordLevel: 1, armor: 0,
  // Grandmother's Bow — granted in the prologue's final beat, not owned at birth.
  // Back-filled to true below for saves written before the field existed.
  hasBow: false,
  // Grandmother's Sword — granted alongside the bow in that same beat. Also
  // back-filled below, but on a narrower test than hasBow.
  hasSword: false,
  potions: STARTING_ITEM_AMOUNT,
  // Bombs — bought at the store / found in chests; a fresh player starts with none.
  bombs: 0,
  herbals: STARTING_ITEM_AMOUNT,
  mushrooms: STARTING_ITEM_AMOUNT,
  // Trophy counters — seeded from the TROPHIES registry (config.js) via
  // trophyDefaults() (player.js), identical to the live player and newGame reset.
  ...trophyDefaults(),
  bonemeal: 0,
  snowballs: 0,
  // Raw ores (see ORE_TYPES) — rare 5% small-chest find, type set by region.
  grimsilver: 0, emberbrass: 0, glimmerspar: 0, wyrmgold: 0, eclipsium: 0,
  // Region Herbalist brews (objects keyed by region id) + active Elixir immunity.
  regionPotions: {}, elixirs: {},
  // Per-region Collector quests, keyed by region id (see openCollectorModal).
  collectorQuests: {},
  // Per-region "Find Timmy" quests, keyed by region id (see villagers.js).
  lostSonQuests: {},
  // Per-region Sword & Shield Guild quests, keyed by region id (see guild.js).
  guildQuests: {},
  // Version-2 village shrine quests; legacy sealed records upgrade on load.
  shrineQuests: {},
  // Permanent shrine abilities, keyed by ability id (see ABILITY_IDS, player.js).
  abilities: { arcaneSight:false },
  // The active ability on [F] / the touch ability button (abilities.js).
  equippedAbility: null,
  // Per-region Taxidermist quests + earned trophy-drop bonuses (shop-herbalist.js).
  taxidermistQuests: {},
  trophyDropBonus: {},
  // Per-region Alchemist repeatable bulk orders (shop-herbalist.js).
  alchemistOrders: {},
  // Per-region escort quests (#7/8/9) + their earned rewards (villagers.js).
  caravanQuests: {}, apprenticeQuests: {}, gathererQuests: {},
  storeDiscounts: {}, smithFreeUpgrade: {}, forageBonus: {},
  // Completionist's Ledger milestone (#13).
  chronicleMilestone: 0,
  // Sword & Shield Guild membership card (granted on first induction).
  guildCard: false,
  immunityElement: null, immunityTimer: 0,
  // swordElements / arrows are populated by applyStartingInventory() at boot
  // and on newGame, once SWORD_ELEMENTS has loaded.
  swordElements: [],
  activeSwordElement: null,
  swordUpgrades: {},
  arrows: {},
  activeArrowElement: null,
  armorElements: [],
  armorUpgrades: {},
  activeArmorElement: null,
  defeatedBoss: false,
  // True once the Adult Red Dragon at the castle pinnacle has been slain.
  wonGame: false,
  // Story flags — the single home for narrative state (see story.js).
  flags: {}
};

// ─── Legacy sealed-shrine migration ──────────────────────────────────────────
// The overworld "sealed elemental shrine" (one per region, seeded at region-seal
// time, broken by striking it with a matching elemental sword or arrow for a
// one-time +2 Max HP) has been replaced by the shrine dungeons in shrines.js.
// Migration preserves every old +2 Max HP award, marks legacyCompleted, and
// exposes the new deterministic puzzle as available and unclaimed. Old sealed
// tiles become ordinary reusable healing shrines and their clue runes safely
// return to local ground. The operation is idempotent.
function migrateLegacyShrines() {
  if (typeof migrateShrineSystemAfterLoad === 'function') migrateShrineSystemAfterLoad();
}

function rebuildSeededMapFromLite(lite, regionIdx) {
  if (lite.mapSeed == null || !isSeededOverworldType(lite.type, regionIdx))
    throw new Error('Map delta has no seeded recipe');
  const map = buildOverworldForRegion(regionIdx, lite.mapSeed, lite.depth,
                                      lite.openSides, !!lite.placeDungeon);
  return map;
}

// Applies a parsed save payload to the live game, restoring everything it
// touches if anything throws partway through — a malformed or truncated save
// (corrupted localStorage, a hand-edited slot, a future format this build
// doesn't understand) used to fail midway through applyLoadDataUnsafe, after
// `player` had already been overwritten but before `worldMaps` caught up (or
// vice versa), leaving the running game a hybrid of the old session and a
// half-applied new one. Every global applyLoadDataUnsafe can mutate is
// snapshotted first and, on failure, restored before the error is rethrown to
// the caller (doLoad / doLoadAuto / reloadLastSave already report the failure
// and none of them assume the live state changed).
function applyLoadData(data) {
  const snapshot = {
    player: { ...player },
    currentMapId, mapsVisited, desertsVisited, currentRegionIdx,
    regionMapsVisited, regionDungeonPlaced, mapSequence, worldGrid, worldSeed,
    attackCooldown, bowCooldown, bombCooldown, transitionCooldown, moveTimer,
    enemies, projectiles, particles, damageNumbers, drops, villagers,
    minimapCanvases, minimapDirty, worldMaps,
  };
  try {
    applyLoadDataUnsafe(data);
  } catch (e) {
    for (const k of Object.keys(player)) delete player[k];
    Object.assign(player, snapshot.player);
    currentMapId = snapshot.currentMapId;
    mapsVisited = snapshot.mapsVisited;
    desertsVisited = snapshot.desertsVisited;
    currentRegionIdx = snapshot.currentRegionIdx;
    regionMapsVisited = snapshot.regionMapsVisited;
    regionDungeonPlaced = snapshot.regionDungeonPlaced;
    mapSequence = snapshot.mapSequence;
    worldGrid = snapshot.worldGrid;
    worldSeed = snapshot.worldSeed;
    attackCooldown = snapshot.attackCooldown;
    bowCooldown = snapshot.bowCooldown;
    bombCooldown = snapshot.bombCooldown;
    transitionCooldown = snapshot.transitionCooldown;
    moveTimer = snapshot.moveTimer;
    enemies = snapshot.enemies;
    projectiles = snapshot.projectiles;
    particles = snapshot.particles;
    damageNumbers = snapshot.damageNumbers;
    drops = snapshot.drops;
    villagers = snapshot.villagers;
    minimapCanvases = snapshot.minimapCanvases;
    minimapDirty = snapshot.minimapDirty;
    worldMaps = snapshot.worldMaps;
    throw e;
  }
}

function applyLoadDataUnsafe(data) {
  // A truncated write, a hand-edited slot, or a save from a format this build
  // doesn't understand can produce JSON that parses fine but isn't shaped like
  // a save. Fail before touching any live state rather than partway through —
  // everything below this point assumes these two fields exist.
  if (!data || typeof data !== 'object')
    throw new Error('Save data is not an object');
  if (!data.player || typeof data.player !== 'object')
    throw new Error('Save data has no player state');
  if (!Array.isArray(data.worldMapsLite) || data.worldMapsLite.length === 0)
    throw new Error('Save data has no world maps');
  // Apply defaults first, then overlay saved values. This ensures fields
  // missing from older saves (e.g. armor) reset to their default rather than
  // leaking the current in-memory value. sellableDefaults() zeroes the forage /
  // snowball / ore keys that aren't in DEFAULT_PLAYER so a save lacking them
  // (or an older one) can't inherit stale stock from the previous session.
  Object.assign(player, sellableDefaults(), DEFAULT_PLAYER, data.player);
  // Clone the object-valued brews so a save lacking them doesn't alias the shared
  // DEFAULT_PLAYER literals (which would leak mutations across loads).
  player.regionPotions = { ...((data.player && data.player.regionPotions) || {}) };
  // The Medium Health Potion was removed. Fold any leftover stock from an older save
  // into the fire region's Lesser Healing Potion (the closest surviving brew) so the
  // player doesn't silently lose owned potions, and drop the retired field.
  const legacyMed = (data.player && data.player.medPotions) || 0;
  if (legacyMed > 0) player.regionPotions.fire = (player.regionPotions.fire || 0) + legacyMed;
  delete player.medPotions;
  player.elixirs = { ...((data.player && data.player.elixirs) || {}) };
  player.collectorQuests = { ...((data.player && data.player.collectorQuests) || {}) };
  player.lostSonQuests = { ...((data.player && data.player.lostSonQuests) || {}) };
  player.guildQuests = { ...((data.player && data.player.guildQuests) || {}) };
  player.shrineQuests = shrineClone((data.player && data.player.shrineQuests) || {});
  delete player.shrines;
  player.abilities = Object.assign({}, SHRINE_ABILITY_DEFAULTS,
    shrineClone((data.player && data.player.abilities) || {}));
  player.taxidermistQuests = { ...((data.player && data.player.taxidermistQuests) || {}) };
  player.trophyDropBonus = { ...((data.player && data.player.trophyDropBonus) || {}) };
  player.alchemistOrders = { ...((data.player && data.player.alchemistOrders) || {}) };
  player.caravanQuests = { ...((data.player && data.player.caravanQuests) || {}) };
  player.apprenticeQuests = { ...((data.player && data.player.apprenticeQuests) || {}) };
  player.gathererQuests = { ...((data.player && data.player.gathererQuests) || {}) };
  player.storeDiscounts = { ...((data.player && data.player.storeDiscounts) || {}) };
  player.smithFreeUpgrade = { ...((data.player && data.player.smithFreeUpgrade) || {}) };
  player.forageBonus = { ...((data.player && data.player.forageBonus) || {}) };
  player.armorUpgrades = { ...((data.player && data.player.armorUpgrades) || {}) };
  player.swordUpgrades = { ...((data.player && data.player.swordUpgrades) || {}) };
  // The last four object-valued fields that were still being aliased. Object.assign
  // above copies DEFAULT_PLAYER's own literals by REFERENCE, so a save missing any of
  // these left `player` pointing straight at the shared default — and all four are
  // mutated in place elsewhere (the blacksmith pushes onto swordElements/
  // armorElements, addArrow writes into arrows, movement reassigns swordDir). One
  // such load and the blacksmith would be editing DEFAULT_PLAYER for the rest of the
  // session, handing the next load a hero with someone else's arsenal. Not reachable
  // from a save the current code writes — every one carries all four — but the
  // clones above already established the rule and these were simply missed.
  player.swordElements = [ ...((data.player && data.player.swordElements) || []) ];
  player.armorElements = [ ...((data.player && data.player.armorElements) || []) ];
  player.arrows = { ...((data.player && data.player.arrows) || {}) };
  player.swordDir = { ...((data.player && data.player.swordDir) || { x: 0, y: -1 }) };
  player.flags = { ...((data.player && data.player.flags) || {}) };
  // Saves predating the prologue have no `hasBow` field and no flags at all, but
  // their hero has been shooting arrows for hours. Test for *absence*, not false —
  // a save written after the prologue shipped legitimately stores hasBow: false
  // mid-prologue, and must not be handed a bow it hasn't earned yet.
  if (data.player && data.player.hasBow === undefined) player.hasBow = true;
  // The same problem for the sword, but it can't use the same test. EVERY hero
  // written before this field existed owned a sword — it was in the starting kit
  // — so "absent" doesn't distinguish a veteran from someone three minutes into
  // the prologue. Absence means "old save"; what to do about it depends on where
  // that save is:
  //   • prologue finished, or a save so old it predates the prologue entirely
  //     (no flags bag) → a real hero mid-adventure. Keep the sword.
  //   • prologue still running → the beat that hands the sword over hasn't played
  //     yet, and the new rule is that those beats are fought unarmed. Take it,
  //     and Beat 5 gives it back a few minutes later.
  if (data.player && data.player.hasSword === undefined) {
    const sp = data.player;
    const predatesPrologue = !sp.flags;
    player.hasSword = predatesPrologue || !!sp.flags.prologue_complete;
  }
  // renderX/Y aren't meaningful values to load — they should match x/y after
  // an instant snap (clampCam(true) below will do the rest).
  player.renderX = player.x;
  player.renderY = player.y;
  currentMapId = data.currentMapId;
  mapsVisited = data.mapsVisited || 0;
  desertsVisited = data.desertsVisited || 0;
  currentRegionIdx = data.currentRegionIdx || 0;
  regionMapsVisited = data.regionMapsVisited || {};
  regionDungeonPlaced = data.regionDungeonPlaced || {};
  // Back-fill region counters for older saves so progression keeps working.
  for (let i = 0; i < REGIONS.length; i++) {
    if (regionMapsVisited[i] === undefined) regionMapsVisited[i] = 0;
    if (regionDungeonPlaced[i] === undefined) regionDungeonPlaced[i] = false;
  }
  if (desertsVisited && !regionMapsVisited[1]) regionMapsVisited[1] = desertsVisited;
  mapSequence = data.mapSequence || [];
  worldGrid = data.worldGrid || {};
  // A save written before seeding existed has no worldSeed. Roll one rather than
  // leaving it 0, so any map generated from here on in that world is still seeded and
  // reproducible — the maps it already has keep their own stored mapSeed, or fall
  // back to regenerating freshly if they predate that too.
  worldSeed = (typeof data.worldSeed === 'number')
    ? data.worldSeed : (Math.random() * 0x100000000) >>> 0;

  // Reset transient state so the player isn't stuck mid-animation
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  player.invincible = 0; player.swordTimer = 0;
  player.immunityTimer = 0; player.immunityElement = null;
  enemies = []; projectiles = []; particles = []; damageNumbers = []; drops = [];
  villagers = [];
  minimapCanvases = {}; minimapDirty = true;

  worldMaps = data.worldMapsLite.map(lite => {
    // Resolve which region this map belongs to. Newer saves include `regionIdx`
    // directly; older saves are biome-string-based and may use 'desert' for the
    // fire region.
    const biome = lite.biome === 'desert' ? 'fire' : lite.biome;
    const regionIdx = (typeof lite.regionIdx === 'number')
      ? lite.regionIdx
      : Math.max(0, REGIONS.findIndex(r => r.id === biome));
    const region = REGIONS[regionIdx] || REGIONS[0];

    // Visited maps normally trust their stored tile payload. Seeded overworlds
    // rebuild their exact pristine grid first when a sparse delta is present;
    // Elderbrook is versioned separately so its layout migration still wins over
    // any old tile payload.
    const migrateHomeLayout = lite.type === 'homevillage' &&
      lite.homeLayoutVersion !== HOME_LAYOUT_VERSION;
    const homeRuined = hasFlag('prologue_complete') || hasFlag('village_burning');
    const hasStoredTiles = !migrateHomeLayout &&
      (lite.mapDelta !== undefined || !!lite.mapTiles);
    let md;
    if (!migrateHomeLayout && lite.mapDelta !== undefined) {
      md = applyMapDelta(rebuildSeededMapFromLite(lite, regionIdx), lite.mapDelta);
    } else if (!migrateHomeLayout && lite.mapTiles) {
      // v2 mapTiles carry a codec tag; an unversioned payload is the old raw
      // Base64 form and remains readable even though new saves no longer emit it.
      md = data.saveVersion >= SAVE_FORMAT_VERSION
        ? decodeMapCompact(lite.mapTiles) : decodeMap(lite.mapTiles);
    } else {
      // A village only lands here when it was never entered (a visited one stores its
      // tiles). `lite.openSides` is the topology it actually had — without it the
      // rebuild opened all four gates, which re-cut the final village's sealed sides
      // and let the hero walk out of a border that had no map behind it. Saves written
      // before openSides existed still pass undefined and still get the old all-open
      // behaviour, since the information was never recorded for them.
      md = lite.type === 'village' ? buildVillageMap(region.id, lite.openSides)
        : lite.type === 'cave'    ? buildCaveMap()
        : lite.type === 'cave_chain' ? buildCaveLevelMap((lite.chainDepth || 1) >= (lite.chainLen || 1)).map
        : lite.type === 'sky_cave' ? buildSkyCaveLevelMap((lite.chainDepth || 1) >= (lite.chainLen || 1), region).map
        : lite.type === 'castle_tower' ? buildTowerFloorMap(lite.floorIdx || 1).map
        : lite.type === 'dungeon' ? buildDungeonLevelMap().map
        : lite.type === 'whirlpool_grotto' ? buildWhirlpoolGrottoMap()
        : lite.type === 'shrine' ? buildShrineInterior(regionIdx).map
        : lite.type === 'house'   ? buildStarterHouseMap()
        // Map 0 since the prologue. Current-layout saves decode their exact tiles;
        // missing tiles and older layout versions rebuild the correct standing or
        // ruined Elderbrook from story flags.
        : lite.type === 'homevillage'
            ? (homeRuined ? buildRuinedHomeVillage() : buildHomeVillageMap())
        // lite.openSides is the topology this map actually had when it was saved (see
        // buildSaveData). It used to be `undefined` here, which the builders read as
        // "open on all four sides" — the bug that unsealed every dead-end on load.
        // Saves written before openSides existed still pass undefined and still get
        // the old all-open behaviour; the information was never recorded, so there is
        // nothing to recover for them.
        // lite.mapSeed is the seed this map was generated under. Older saves have no
        // mapSeed — they fall back to lite.id, which is what used to be passed and was
        // ignored anyway, so those maps regenerate freshly exactly as they did before.
        : lite.type === 'forest'
            ? buildForestMap(lite.mapSeed != null ? lite.mapSeed : lite.id,
                             lite.depth, lite.openSides, lite.placeDungeon)
        : lite.type === 'fire' || lite.type === 'desert'
            ? buildDesertMap(lite.mapSeed != null ? lite.mapSeed : lite.id,
                             lite.depth, lite.openSides, lite.placeDungeon)
        :     buildRegionMap(lite.mapSeed != null ? lite.mapSeed : lite.id,
                             lite.depth, lite.openSides, region, lite.placeDungeon);
    }

    // A rebuilt dead-end used to need its Hero's Cache stamped back on here. The
    // dead-end reward is an ordinary chest again (see world.js), which the builder
    // places itself, so a rebuilt map needs nothing extra. A save made before the
    // downgrade keeps whatever its stored tiles hold.

    // Villages share type 'village' but each region's boss differs, so build a
    // `<region>_village` discriminator for makeEnemyDefs. Sky caves are stocked
    // from their region's own roster, so they resolve to the plain region id (the
    // 'sky_cave' type isn't a spawn key makeEnemyDefs understands).
    const enemyType = (lite.type === 'village')
      ? `${region.id}_village`
      : (lite.type === 'sky_cave' || lite.type === 'dungeon') ? region.id
      // Tower floors 1–13 restock like their floor-region's village (Greater
      // roster + boss); the pinnacle gets the full finale (all bosses + dragon).
      : (lite.type === 'castle_tower')
        ? `${REGIONS[Math.min(lite.floorIdx || 1, 13) - 1].id}_village`
      : lite.type;
    const obj = {
      id: lite.id, gx: lite.gx || 0, gy: lite.gy || 0,
      name: lite.name, type: lite.type, biome: region.id, regionIdx, depth: lite.depth,
      homeLayoutVersion: lite.type === 'homevillage'
        ? HOME_LAYOUT_VERSION : lite.homeLayoutVersion,
      map: md,
      enemyDefs: lite.type === 'shrine' ? []
        : (lite.type === 'castle_tower' && (lite.floorIdx || 1) >= 14)
        ? makeTowerFinaleDefs(md)
        : makeEnemyDefs(lite.depth, enemyType, md),
      openedChests: new Set(lite.openedChests || []),
      visited: lite.visited,
      // Kept only for the arenas. An older save carries one for every map it had
      // ever entered; honouring those would resurrect the old "dead stays dead
      // everywhere" behaviour on load, so they are discarded and those maps come
      // back stocked (see mapRemembersEnemies in enemies.js).
      savedEnemies: mapRemembersEnemies(lite) ? (lite.savedEnemies || null) : null,
      savedVillagers: migrateHomeLayout
        ? migrateHomeVillageVillagers(lite.savedVillagers, homeRuined)
        : (lite.savedVillagers || null),
      _homeLayoutMigrated: migrateHomeLayout,
    };
    if (migrateHomeLayout && homeRuined) {
      obj.openedChests.add(`${HOME.chest.x},${HOME.chest.y}`);
    }
    // `lite.fogPacked` / `lite.fog` may still be present in a save written before
    // fog of war was removed. Both are deliberately dropped on the floor.
    // Dead-end marker. Read by the per-region map count that triggers a village
    // (player.js), the Guild quarry / bounty spawn candidates (guild.js), and the
    // ability-secret stamping pass (abilities.js) — all three of which quietly
    // started including dead-ends once this flag stopped surviving a load.
    if (lite.sealed) obj.sealed = true;
    // Carry the recipe forward so re-saving this map preserves it.
    if (lite.mapSeed != null) obj.mapSeed = lite.mapSeed;
    if (lite.placeDungeon) obj.placeDungeon = true;
    if (lite.pristineHash != null) obj.pristineHash = lite.pristineHash;
    if (lite.returnMapId != null) {
      obj.returnMapId = lite.returnMapId;
      obj.returnX = lite.returnX;
      obj.returnY = lite.returnY;
    }
    if (lite.rootMapId != null) {
      obj.rootMapId = lite.rootMapId;
      obj.rootX = lite.rootX;
      obj.rootY = lite.rootY;
    }
    if (lite.caveLinks) obj.caveLinks = { ...lite.caveLinks };
    if (lite.sourceTier != null) obj.sourceTier = lite.sourceTier;
    if (lite.chainDepth != null) obj.chainDepth = lite.chainDepth;
    if (lite.chainLen != null) obj.chainLen = lite.chainLen;
    if (lite.entryLand) obj.entryLand = { ...lite.entryLand };
    else if (lite.type === 'shrine') obj.entryLand = { x:SHRINE_ENTRY_X, y:SHRINE_ENTRY_Y };
    if (lite.deeperLand) obj.deeperLand = lite.deeperLand;
    if (lite.floorIdx != null) obj.floorIdx = lite.floorIdx;
    if (lite.castleExitDir) obj.castleExitDir = lite.castleExitDir;
    if (lite.abilitySecret !== undefined) obj.abilitySecret = lite.abilitySecret;
    if (lite.shrineElement) obj.shrineElement = lite.shrineElement;
    if (lite.shrineDoor) obj.shrineDoor = { ...lite.shrineDoor };
    if (lite.shrineState) obj.shrineState = shrineClone(lite.shrineState);
    else if (lite.type === 'shrine') obj.shrineState = buildShrineInterior(regionIdx).state;
    if (lite.grottoLinks) obj.grottoLinks = { ...lite.grottoLinks };
    if (lite.grottoChestPlaced) obj.grottoChestPlaced = true;
    if (migrateHomeLayout) {
      Object.assign(obj, homeVillageShopFields());
      if (homeRuined) hvRuinShops(obj);
      // A restored villager list bypasses placeShopkeepers during map entry, so
      // stamp the compact shop counters now as part of the tile migration.
      if (typeof placeShopkeepers === 'function') placeShopkeepers(obj);
    } else {
      if (lite.activated) obj.activated = true;
      if (lite.shopsRuined) obj.shopsRuined = true;
      if (lite.innDoor)   obj.innDoor   = { ...lite.innDoor };
      if (lite.storeDoor) obj.storeDoor = { ...lite.storeDoor };
      if (lite.herbDoor)  obj.herbDoor  = { ...lite.herbDoor };
      if (lite.smithDoor) obj.smithDoor = { ...lite.smithDoor };
    }
    return obj;
  });

  migrateLegacyShrines();

  // Older saves predate worldGrid — rebuild from gx/gy
  if (!data.worldGrid) {
    worldGrid = {};
    worldMaps.forEach(m => { worldGrid[gridKey(m.gx, m.gy)] = m.id; });
  }

  // A truncated or hand-edited save can name a currentMapId that worldMapsLite
  // never supplied. Every frame calls currentMap() before anything else, so an
  // unresolvable id doesn't fail here — it throws in the render loop, one frame
  // after the load reports success. Fall back to map 0, which always exists.
  if (!worldMaps[currentMapId]) {
    currentMapId = 0;
    player.x = EXIT_COL; player.y = EXIT_ROW;
    player.renderX = player.x; player.renderY = player.y;
    showMsg('⚠️ Save pointed at a missing map — returned home.', 4000);
  }

  // A player standing on an old Elderbrook footprint may now be inside a wall,
  // fountain, or roof. Move them once to a story-safe landmark; flags still
  // preserve exactly which prologue beat or post-game state they were in.
  const loadedMap = worldMaps[currentMapId];
  if (loadedMap && loadedMap._homeLayoutMigrated) {
    const at = hasFlag('prologue_started') ? HOME.center : HOME.spawn;
    player.x = at.x; player.y = at.y;
    player.renderX = player.x; player.renderY = player.y;
  }
  for (const m of worldMaps) delete m._homeLayoutMigrated;

  // Put the hero back into the fight they saved in. `liveEnemies` is the current
  // map's living roster (see buildSaveData) and only exists for maps that don't
  // remember their own — an arena already restored its full roster above, and
  // overwriting that with the living-only list would resurrect its dead.
  // Absent (older save, or an arena) means the map simply spawns fresh.
  const curMap = worldMaps[currentMapId];
  if (curMap && !mapRemembersEnemies(curMap) && Array.isArray(data.liveEnemies)) {
    curMap.savedEnemies = data.liveEnemies.map(e => ({ ...e }));
  }

  spawnEnemiesForMap(currentMapId);
  spawnVillagersForMap(currentMapId);
  // Cancel any cutscene the load interrupted and restore the ambient state that
  // isn't in the flag bag (how hard the ruin is still burning). Without this, a
  // load from inside a scripted beat leaves the world frozen forever.
  if (typeof restorePrologueAmbience === 'function') restorePrologueAmbience();
  clampCam(true);
  updateHUD();
}

// ─── Auto-save / death checkpoint ──────────────────────────────────────────────
// A single rolling autosave written at key checkpoints (clearing a village,
// each castle-tower floor). It lives under its own key so it never clobbers one
// of the named slots. `lastCheckpoint` holds the most recent save payload of
// ANY kind — manual save, auto-save, or the save just loaded — and is what a
// death reload restores from.
const AUTOSAVE_KEY = 'stormdrift_autosave';
let lastCheckpoint = null;

// Start a fresh hero's checkpoint lifetime without touching named saves. This
// runs after the name prompt is confirmed, so cancelling New Game keeps the
// current run's checkpoint available.
function initializeNewRunCheckpoint() {
  lastCheckpoint = null;
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* storage unavailable - nothing to clear */ }
}

function autoSave(label) {
  try {
    const json = JSON.stringify(buildSaveData());
    localStorage.setItem(AUTOSAVE_KEY, json);
    const idx = getSaveIndex();
    idx.auto = {
      saveName: label ? `Auto-save · ${label}` : 'Auto-save',
      heroName: player.heroName || '',
      level: player.level,
      mapsVisited,
      date: new Date().toLocaleDateString() + ' ' +
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSaveIndex(idx);
    lastCheckpoint = json;
    showMsg(label ? `💾 Auto-saved · ${label}` : '💾 Auto-saved', 1500);
  } catch (e) {
    // Storage is full (or blocked). This used to be swallowed silently, which was
    // the worst possible handling: `lastCheckpoint` keeps pointing at the PREVIOUS
    // payload, respawn() restores from it (player.js), and the hero goes on clearing
    // villages and tower floors while their death-restore point quietly stops
    // advancing. The only cue was the absence of the toast above — invisible unless
    // you already knew to watch for it.
    //
    // Sticky (dur 0) on purpose: this costs the player hours if it goes unread, and
    // it is exactly what sticky is for. Repeats are safe — showToast dedupes on the
    // message text and bumps a ×N badge instead of stacking copies (see ui.js).
    showMsg('⚠️ Auto-save FAILED (storage full) — your death checkpoint is not ' +
            'advancing. Save to a slot, or delete an old save, before continuing.', 0);
  }
}

// Restore the most recent checkpoint after death. Returns false if none exists
// yet (a fresh game that hasn't reached any save point), so the caller can fall
// back to the return-to-start behavior.
function reloadLastSave() {
  const json = lastCheckpoint || localStorage.getItem(AUTOSAVE_KEY);
  if (!json) return false;
  try { applyLoadData(JSON.parse(json)); return true; }
  catch (e) { return false; }
}

// ─── Modal UI ─────────────────────────────────────────────────────────────────
function renderSlotList() {
  const idx = getSaveIndex();
  const list = document.getElementById('slot-list');
  const nameRow = document.getElementById('modal-name-row');
  const modeLabel = document.getElementById('modal-mode-label');
  list.innerHTML = '';
  nameRow.style.display = 'none';
  pendingSlot = null;

  modeLabel.textContent = modalMode === 'save'
    ? 'Choose a slot to save into, or create a new one.'
    : 'Choose a save to load.';

  // Auto-save (load mode only) — the rolling checkpoint written on village
  // clears and tower floors, shown above the manual slots so it can be resumed.
  if (modalMode === 'load' && idx.auto && localStorage.getItem(AUTOSAVE_KEY)) {
    const meta = idx.auto;
    const div = document.createElement('div');
    div.className = 'save-slot';

    const nameSpan = document.createElement('div');
    nameSpan.className = 'save-slot-name';
    nameSpan.textContent = '⏱ ' + (meta.saveName || 'Auto-save');

    const metaSpan = document.createElement('div');
    metaSpan.className = 'save-slot-meta';
    const hero = meta.heroName ? `🛡 ${meta.heroName} · ` : '';
    metaSpan.textContent = `${hero}Lv${meta.level} · Map ${meta.mapsVisited}/232 · ${meta.date}`;

    const btns = document.createElement('div');
    btns.className = 'save-slot-btns';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'ssbtn';
    loadBtn.textContent = '📂 Load';
    loadBtn.onclick = () => doLoadAuto();
    btns.appendChild(loadBtn);

    div.appendChild(nameSpan);
    div.appendChild(metaSpan);
    div.appendChild(btns);
    list.appendChild(div);
  }

  for (let i = 0; i < MAX_SLOTS; i++) {
    const meta = idx[i];
    const div = document.createElement('div');
    div.className = 'save-slot' + (meta ? '' : ' empty');

    if (meta) {
      const nameSpan = document.createElement('div');
      nameSpan.className = 'save-slot-name';
      nameSpan.textContent = meta.saveName || `Save ${i + 1}`;

      const metaSpan = document.createElement('div');
      metaSpan.className = 'save-slot-meta';
      // Show the hero's name when the slot name doesn't already carry it.
      const hero = (meta.heroName && meta.heroName !== meta.saveName)
        ? `🛡 ${meta.heroName} · ` : '';
      metaSpan.textContent = `${hero}Lv${meta.level} · Map ${meta.mapsVisited}/232 · ${meta.date}`;

      const btns = document.createElement('div');
      btns.className = 'save-slot-btns';

      if (modalMode === 'save') {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'ssbtn';
        saveBtn.textContent = '💾 Overwrite';
        saveBtn.onclick = () => startSlotSave(i, meta.saveName);
        btns.appendChild(saveBtn);
      } else {
        const loadBtn = document.createElement('button');
        loadBtn.className = 'ssbtn';
        loadBtn.textContent = '📂 Load';
        loadBtn.onclick = () => doLoad(i);
        btns.appendChild(loadBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'ssbtn danger';
      delBtn.textContent = '🗑';
      delBtn.onclick = (e) => { e.stopPropagation(); doDelete(i); };
      btns.appendChild(delBtn);

      div.appendChild(nameSpan);
      div.appendChild(metaSpan);
      div.appendChild(btns);
    } else {
      if (modalMode === 'save') {
        div.textContent = `＋ Empty Slot ${i + 1}`;
        div.onclick = () => startSlotSave(i, '');
      } else {
        div.textContent = `— Empty Slot ${i + 1}`;
      }
    }
    list.appendChild(div);
  }
}

// Default slot name — the hero's name (chosen on New Game) so saves are
// identifiable per character; falls back to the old generic slot label.
function defaultSlotName(slotIdx) {
  return player.heroName || `Save ${slotIdx + 1}`;
}

function startSlotSave(slotIdx, existingName) {
  pendingSlot = slotIdx;
  const nameRow = document.getElementById('modal-name-row');
  const nameInput = document.getElementById('modal-name-input');
  nameInput.value = existingName || defaultSlotName(slotIdx);
  nameRow.style.display = 'flex';
  nameInput.focus();
  document.getElementById('modal-confirm-btn').onclick = () => doSave(slotIdx);
}

function doSave(slotIdx) {
  const nameInput = document.getElementById('modal-name-input');
  const saveName = nameInput.value.trim() || defaultSlotName(slotIdx);
  try {
    const json = JSON.stringify(buildSaveData());
    localStorage.setItem(SAVE_KEY_PREFIX + slotIdx, json);
    lastCheckpoint = json;   // a manual save is also a death-reload point
    const idx = getSaveIndex();
    idx[slotIdx] = {
      saveName,
      heroName: player.heroName || '',
      level: player.level,
      mapsVisited,
      date: new Date().toLocaleDateString() + ' ' +
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSaveIndex(idx);
    setSaveStatus(`✅ Saved to "${saveName}"`);
    closeModal();
  } catch (e) {
    setSaveStatus('❌ Save failed (storage full?)');
  }
}

// Leave the title screen after a successful load. A load launched from the
// title shows the controls first (the world is frozen until it is dismissed);
// a load made mid-run does nothing here at all, since the game is already going.
function finishTitleLoad() {
  const fromTitle = typeof gameStarted !== 'undefined' && !gameStarted;
  if (fromTitle && typeof showLoadingScreen === 'function') {
    showLoadingScreen(() => { if (typeof startGame === 'function') startGame(); });
    return;
  }
  if (typeof startGame === 'function') startGame();
}

function doLoad(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + slotIdx);
  if (!raw) return;
  const meta = getSaveIndex()[slotIdx];
  try {
    applyLoadData(JSON.parse(raw));
    lastCheckpoint = raw;   // dying right after loading returns to this same save
    // Dismiss the title screen if this load was launched from it (no-op mid-game),
    // showing the controls on the way in. Only from the title: a mid-run load is
    // a player who already knows the keys, and stopping them for a card they have
    // read would be an interruption rather than a help.
    finishTitleLoad();
    setSaveStatus(`✅ Loaded "${meta?.saveName || 'Save ' + (slotIdx+1)}"`, { toast: false });
    showMsg(`📂 Loaded: ${currentMap().name}`, 2500);
    closeModal();
  } catch (e) {
    setSaveStatus('❌ Load failed');
  }
}

function doLoadAuto() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return;
  try {
    applyLoadData(JSON.parse(raw));
    lastCheckpoint = raw;
    finishTitleLoad();
    setSaveStatus('✅ Loaded auto-save', { toast: false });
    showMsg(`📂 Loaded: ${currentMap().name}`, 2500);
    closeModal();
  } catch (e) {
    setSaveStatus('❌ Load failed');
  }
}

function doDelete(slotIdx) {
  const idx = getSaveIndex();
  const name = idx[slotIdx]?.saveName || `Slot ${slotIdx + 1}`;
  if (!confirm(`Delete save "${name}"?`)) return;
  localStorage.removeItem(SAVE_KEY_PREFIX + slotIdx);
  delete idx[slotIdx];
  setSaveIndex(idx);
  renderSlotList();
}

// Save/load feedback. This used to write into the save row's status span, with a
// toast as the touch-mode stand-in once that row was hidden there. The row is
// gone on every device now (its buttons live in the radial MENU ring), so the
// toast is the only channel left and always fires.
// `toast: false` for the paths that already raise their own.
function setSaveStatus(text, { toast = true } = {}) {
  if (toast && text && typeof showMsg === 'function') showMsg(text, 2500);
}

function openSaveModal() {
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  modalMode = 'save';
  document.getElementById('modal-title').textContent = '💾 Save Game';
  document.getElementById('save-modal-overlay').classList.add('open');
  renderSlotList();
}

function openLoadModal() {
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  modalMode = 'load';
  document.getElementById('modal-title').textContent = '📂 Load Game';
  document.getElementById('save-modal-overlay').classList.add('open');
  renderSlotList();
}

function closeModal() {
  document.getElementById('save-modal-overlay').classList.remove('open');
  modalMode = null;
  pendingSlot = null;
}

// Click outside the modal closes it
document.getElementById('save-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('save-modal-overlay')) closeModal();
});

// Enter confirms, Escape closes. stopPropagation so keystrokes while naming a save
// never reach the gameplay keydown handler in main.js — the same guard the hero-name
// prompt has always had (see the #name-input listener there). Without it, typing a
// name swung the sword, drank potions and opened the menu ring, and SPACE was
// preventDefault()ed out of the field entirely. Belt and braces with the modalMode
// branch now in that handler; either alone would fix it, and both is cheap.
document.getElementById('modal-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && pendingSlot !== null) doSave(pendingSlot);
  if (e.key === 'Escape') closeModal();
  e.stopPropagation();
});

// ─── New game button ──────────────────────────────────────────────────────────
function newGame() {
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  if (!confirm('Start a new game? Unsaved progress will be lost.')) return;
  // Ask for the hero's name first — the world reset runs once a name is chosen
  // (cancelling the prompt leaves the current game untouched).
  openNamePrompt(name => resetGame(name));
}

function resetGame(heroName) {
  initializeNewRunCheckpoint();
  Object.assign(player, {
    // Zero every field-earned sellable first (forage goods, snowballs, all raw
    // ores) so late-region stock never survives into a fresh game. Explicit
    // fields below override any overlap. See sellableDefaults (shop-general.js).
    ...sellableDefaults(),
    heroName,
    deaths: 0,
    x: EXIT_COL, y: EXIT_ROW,
    hp: 12, maxHp: 12, tempHp: 0,
    rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
    swordTimer: 0, swordDir: { x: 0, y: -1 }, punchTimer: 0, bowTimer: 0, invincible: 0,
    // Cleared so a New Game started mid-session (no page reload) can't inherit the
    // previous world's Earth dead-end id and silently never spawn its own frog
    // (see ensureEarthFrog in villagers.js).
    frogOracleMapId: null,
    weapon: 'sword', bowLevel: 1, swordLevel: 1, armor: 0,
    // Both of Grandmother's weapons are re-locked for the new hero. hasSword has
    // to be named explicitly: Object.assign only overwrites the keys it lists, so
    // leaving it out would let a finished hero's sword survive into the next New
    // Game and start the prologue armed.
    hasBow: false, hasSword: false,
    potions: STARTING_ITEM_AMOUNT, bombs: 0, herbals: STARTING_ITEM_AMOUNT,
    mushrooms: STARTING_ITEM_AMOUNT,
    ...trophyDefaults(),
    bonemeal: 0,
    grimsilver: 0, emberbrass: 0, glimmerspar: 0, wyrmgold: 0, eclipsium: 0,
    regionPotions: {}, elixirs: {}, collectorQuests: {}, lostSonQuests: {}, guildQuests: {},
    shrineQuests: {},
    abilities: { arcaneSight:false },
    equippedAbility: null,
    taxidermistQuests: {}, trophyDropBonus: {}, alchemistOrders: {},
    caravanQuests: {}, apprenticeQuests: {}, gathererQuests: {},
    storeDiscounts: {}, smithFreeUpgrade: {}, forageBonus: {},
    chronicleMilestone: 0,
    guildCard: false,
    immunityElement: null, immunityTimer: 0,
    swordElements: [], activeSwordElement: null, swordUpgrades: {},
    arrows: {}, activeArrowElement: null,
    armorElements: [], armorUpgrades: {}, activeArmorElement: null,
    defeatedBoss: false,
    wonGame: false,
    flags: {}
  });
  applyStartingInventory(player);
  attackCooldown = 0; bowCooldown = 0; bombCooldown = 0;
  transitionCooldown = 0; moveTimer = 0;
  enemies = []; projectiles = []; particles = []; damageNumbers = []; drops = [];
  villagers = [];
  minimapCanvases = {}; minimapDirty = true;
  initWorld();
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  clampCam(true);
  updateHUD();
  setSaveStatus('', { toast: false });
  // Same opening the title-screen New Game gets — the prologue's first beat
  // establishes the house itself, so there's no banner to show first.
  if (typeof startPrologue === 'function') startPrologue();
}
