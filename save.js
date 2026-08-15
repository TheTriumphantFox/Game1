// ─── Save / load: named slot system ───────────────────────────────────────────
// Stores each save under `the_rpg_game_slot_N` in localStorage, plus a
// metadata index (`the_rpg_game_index`) with slot names and timestamps.
// Saves written before the game was renamed live under a `hyrule_quest_`
// prefix; config.js copies them onto these keys on first load, so nothing here
// has to know about the old names.

const SAVE_KEY_PREFIX = 'the_rpg_game_slot_';
// Slot indices are 0-based here and displayed as i + 1, so this is also the
// highest slot number the player sees. Raising it only widens the list: every
// existing save keeps its own index and key, so nothing has to be migrated.
const MAX_SLOTS = 9;

let modalMode = null;        // 'save' | 'load'
let pendingSlot = null;      // slot index currently being named

function getSaveIndex() {
  const raw = localStorage.getItem('the_rpg_game_index');
  return raw ? JSON.parse(raw) : {};
}
function setSaveIndex(idx) {
  localStorage.setItem('the_rpg_game_index', JSON.stringify(idx));
}

// Does this map's tile array have to go into the save, or can it be regenerated?
//
// Three ways out of paying 30 KB for a map:
//   • never visited — the player has not seen it, and it always regenerated;
//   • no recipe (no mapSeed / no pristineHash) — villages, caves, dungeons, tower
//     floors, grottos, shrines and the home village are not seeded, so they always
//     store tiles. Only the overworld builders take a seed;
//   • seeded AND untouched — regeneration reproduces it exactly (verified byte-for-
//     byte), so storing the tiles is redundant.
//
// The moment gameplay writes to the tile array — cut foliage, a bombed rock, the
// village boss chest, an unsealed shrine, an ability alcove — the hash diverges and
// the tiles are stored as before. Correctness never depends on guessing which sites
// mutate a map; the hash is what answers that.
function mapNeedsStoredTiles(m) {
  if (!m.visited) return false;
  if (m.mapSeed == null || m.pristineHash == null) return true;
  return tileHash(m.map) !== m.pristineHash;
}

// Serialize everything needed to restore the world.
// Map tiles are Base64-encoded for compactness. Maps that are unvisited — or that are
// seeded and still exactly as generated — carry no tiles at all and are rebuilt from
// their recipe on load (see mapNeedsStoredTiles).
function buildSaveData() {
  saveEnemyStateToMap(currentMapId);   // capture live enemies before serializing
  return {
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
      mapTiles: mapNeedsStoredTiles(m) ? encodeMap(m.map) : null,
      // ─── Rebuild inputs, for maps that carry no mapTiles ────────────────────
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
      // pass knows it has already run here — the terrain it laid is in mapTiles
      // already, and a second pass would hollow a second alcove.
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
  hp: 12, maxHp: 12, tempHp: 0,
  rubies: STARTING_ITEM_AMOUNT, level: 1, xp: 0, xpNext: 500,
  swordTimer: 0, swordDir: { x: 0, y: -1 },
  // Punch swing clock — the fists' twin of swordTimer (see player.js).
  punchTimer: 0,
  invincible: 0,
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
  abilities: { frostGrip:false, updraftGlide:false, emberLantern:false,
               arcaneSight:false, shadowStep:false },
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

function applyLoadData(data) {
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

    // Visited maps normally trust their encoded tiles. Elderbrook is versioned
    // separately so a layout redesign can replace those tiles once without
    // invalidating or rewriting the player's other maps.
    const migrateHomeLayout = lite.type === 'homevillage' &&
      lite.homeLayoutVersion !== HOME_LAYOUT_VERSION;
    const homeRuined = hasFlag('prologue_complete') || hasFlag('village_burning');

    const md = lite.mapTiles && !migrateHomeLayout
      ? decodeMap(lite.mapTiles)
      // A village only lands here when it was never entered (a visited one stores its
      // tiles). `lite.openSides` is the topology it actually had — without it the
      // rebuild opened all four gates, which re-cut the final village's sealed sides
      // and let the hero walk out of a border that had no map behind it. Saves written
      // before openSides existed still pass undefined and still get the old all-open
      // behaviour, since the information was never recorded for them.
      : lite.type === 'village' ? buildVillageMap(region.id, lite.openSides)
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

    // A rebuilt dead-end needs its Hero's Cache stamped back on — that upgrade
    // happens after generation in createSealedNeighbor (world.js), so a map rebuilt
    // from its builder comes back with the plain CHEST the builder placed. Only when
    // we actually rebuilt: a decoded map already carries the large chest in its tiles,
    // and re-running this on one would promote unrelated chests the player has since
    // found. `openedChests` is keyed by "x,y" and both halves share the anchor's key,
    // so an already-looted cache stays looted.
    if (lite.sealed && !(lite.mapTiles && !migrateHomeLayout)) {
      if (typeof upgradeDeadEndChests === 'function') upgradeDeadEndChests(md);
    }

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
const AUTOSAVE_KEY = 'the_rpg_game_autosave';
let lastCheckpoint = null;

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

function doLoad(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + slotIdx);
  if (!raw) return;
  const meta = getSaveIndex()[slotIdx];
  try {
    applyLoadData(JSON.parse(raw));
    lastCheckpoint = raw;   // dying right after loading returns to this same save
    // Dismiss the title screen if this load was launched from it (no-op mid-game).
    if (typeof startGame === 'function') startGame();
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
    if (typeof startGame === 'function') startGame();
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
    swordTimer: 0, swordDir: { x: 0, y: -1 }, punchTimer: 0, invincible: 0,
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
    abilities: { frostGrip:false, updraftGlide:false, emberLantern:false,
                 arcaneSight:false, shadowStep:false },
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
  // Drop the death-reload payload and the rolling autosave along with it.
  // reloadLastSave() falls back to `lastCheckpoint` and then to AUTOSAVE_KEY,
  // and neither belongs to this hero — without this, dying before the new game
  // reaches its first checkpoint (village clear / first tower floor) restores
  // the PREVIOUS game outright: old hero, old inventory, old maps.
  // The load modal's auto-save row is gated on the key existing, so the stale
  // `idx.auto` metadata left behind stays hidden and is overwritten wholesale
  // by the next autoSave().
  lastCheckpoint = null;
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* storage unavailable — nothing to clear */ }

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
