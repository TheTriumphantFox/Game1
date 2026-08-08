// ─── Villagers ────────────────────────────────────────────────────────────────
// Friendly NPCs that wander around an active (cleared) village. They appear
// when activateVillage() runs, are saved per-map alongside enemies, and walk
// through the streets between shops on a slow random walk.
//
// Villagers don't fight, can't be hit by anything (weapons are sheathed in an
// active village), and the player passes through them — they only obstruct
// each other so the crowd doesn't pile onto a single tile.

const VILLAGER_TYPES = [
  { name: 'Farmer',   robe: '#8a5520', hair: '#3a2010', skin: '#e8c8a0' },
  { name: 'Baker',    robe: '#dddddd', hair: '#7a5530', skin: '#e8c8a0' },
  { name: 'Elder',    robe: '#445588', hair: '#cccccc', skin: '#d8b890' },
  { name: 'Child',    robe: '#cc4488', hair: '#aa7733', skin: '#f0d0a8', sizeMul: 0.72 },
  { name: 'Hunter',   robe: '#2f5a2f', hair: '#4a2c10', skin: '#d8b890' },
  { name: 'Merchant', robe: '#8a3a8a', hair: '#3a1808', skin: '#e8c8a0' },
  { name: 'Scholar',  robe: '#3a3a6a', hair: '#888888', skin: '#e0c098' },
  { name: 'Smith',    robe: '#5a3020', hair: '#1a1008', skin: '#d8a878' },
];

// Flavor lines shown when the player presses space next to a regular villager.
// One per kind; a random line is picked on each interaction.
const VILLAGER_CHAT = {
  Farmer:    ["The harvest will be plentiful this year.",
              "Mind my crops on your way past!",
              "A fine day for tilling."],
  Baker:     ["Fresh bread, hero!",
              "My oven's been busy ever since you arrived.",
              "Care for a sweet roll?"],
  Elder:     ["I remember when the Lich first came…",
              "You have saved us all.",
              "Sit a while and rest, young one."],
  Child:     ["You're a real hero!",
              "I want a sword like yours when I grow up!",
              "Tag — you're it!"],
  Hunter:    ["I track wolves in the eastern woods.",
              "Keep an arrow nocked out there.",
              "These boots have walked a thousand miles."],
  Merchant:  ["Business is finally booming.",
              "Visit the general store for the best wares.",
              "Coin makes the world turn."],
  Scholar:   ["I'm cataloguing every plant in the woods.",
              "Knowledge is the truest treasure.",
              "Have you seen the moonlight beetles?"],
  Smith:     ["My hammer rings night and day.",
              "Bring me good steel and I'll forge wonders.",
              "An honest dent shows honest work."],
  Innkeeper: ["Welcome, weary traveler. A bed awaits."],
  Shopkeeper:["Greetings, hero! Browse my wares."],
  Herbalist: ["Bring me mushrooms and herbs for a remedy."],
  Blacksmith:["Need armor? I forge the finest in the land."],
  Collector: ["I'm cataloguing the spoils of this region — talk to me for a commission."],
  Parent:    ["Have you seen my boy? Please, find my Timmy!"],
  Timmy:     ["Thank you for finding me! I'll never wander off again."],
  Taxidermist:["I mount the beasts of this land — bring me one of each and I'll teach the hunt."],
  Alchemist: ["Fresh reagents! I pay handsomely for trophies in bulk."],
  Chronicler:["I chronicle every hero's deeds. Complete your quests and I'll ready you for the tower."],
};

// ─── Escort quests (#7 Lost Caravan, #8 Runaway Apprentice, #9 Missing Gatherer) ──
// All three reuse the "Find Timmy" skeleton: a stationary GIVER stands on the
// village plaza and hands out an errand; a LOST npc is seeded on the Nth qualifying
// map the hero enters after taking it (a dead-end / cave / deep overworld map);
// reaching the lost npc whisks them home beside the giver; returning to the giver
// pays the reward. One registry entry per quest keeps the plumbing shared — see
// placeEscortGivers / ensureEscortTargets / talkEscortGiver / findEscortNpc.
//   state:   player[def.key][regionId] = { status:'active'|'found'|'done', entered:[], targetMapId }
const ESCORT_DEFS = {
  caravan: {
    id: 'caravan', key: 'caravanQuests',
    giverKind: 'Stranded Trader',
    giverRobe: '#7a5a2a', giverHair: '#3a2a12', giverSkin: '#e8c8a0',
    lostKind: 'Lost Caravan', lostRobe: '#8a6a2a', lostHair: '#4a3418', lostSkin: '#e8c8a0', lostSize: 1,
    marker: '🛒',
    giverSpots: (mR, mC) => [
      { x: mC - 4, y: mR - 6 }, { x: mC + 4, y: mR - 6 },
      { x: mC - 6, y: mR - 2 }, { x: mC + 6, y: mR - 2 },
    ],
    qualifies: (mo) => !!mo.sealed && mo.type !== 'village',   // dead-end maps
    count: 2,
    offer: () => `💬 Stranded Trader: "My partner's caravan broke an axle out on a dead-end trail — the second one you come across. Bring it home and I'll open my ledger to you!"`,
    remind: () => `💬 Stranded Trader: "Any sign of the caravan? Search the dead-end trails — it's stuck down the second one you find."`,
    found: () => `🛒 You found the stranded caravan! It rolls home — go see the trader for your reward.`,
    done: () => `💬 Stranded Trader: "Trade's booming again thanks to you, hero."`,
    grant: (rid) => {
      player.storeDiscounts = player.storeDiscounts || {};
      player.storeDiscounts[rid] = 0.15;
      return `🛒 The trader opens their ledger — 15% off this region's General Store, for good!`;
    },
  },
  apprentice: {
    id: 'apprentice', key: 'apprenticeQuests',
    giverKind: 'Worried Smith',
    giverRobe: '#3a4a6a', giverHair: '#1a1008', giverSkin: '#d8a878',
    lostKind: 'Runaway Apprentice', lostRobe: '#5a6a8a', lostHair: '#2a1c10', lostSkin: '#e0c098', lostSize: 0.82,
    marker: '🔨',
    giverSpots: (mR, mC) => [
      { x: mC + 6, y: mR + 2 }, { x: mC - 6, y: mR + 2 },
      { x: mC + 4, y: mR + 4 }, { x: mC - 4, y: mR + 4 },
    ],
    qualifies: (mo) => mo.type === 'cave' || mo.type === 'cave_chain' || mo.type === 'sky_cave',
    count: 2,
    offer: () => `💬 Worried Smith: "My apprentice ran off into the caves in a sulk — the second cavern you delve into. Fetch them back and your first upgrade at my forge is on the house!"`,
    remind: () => `💬 Worried Smith: "Please — my apprentice is still down in the caves. The second one you enter."`,
    found: () => `🔨 You found the runaway apprentice! They scurry home — go see the smith for your reward.`,
    done: () => `💬 Worried Smith: "My apprentice hasn't touched the forge-bellows since. Thank you, hero."`,
    grant: (rid) => {
      player.smithFreeUpgrade = player.smithFreeUpgrade || {};
      player.smithFreeUpgrade[rid] = 1;
      return `🔨 The smith owes you one — your next sword OR armor upgrade in this region is FREE!`;
    },
  },
  gatherer: {
    id: 'gatherer', key: 'gathererQuests',
    giverKind: 'Anxious Herbalist',
    giverRobe: '#5a8a3a', giverHair: '#3a2a12', giverSkin: '#e8c8a0',
    lostKind: 'Lost Gatherer', lostRobe: '#6a9a4a', lostHair: '#4a3418', lostSkin: '#e8c8a0', lostSize: 1,
    marker: '🌿',
    giverSpots: (mR, mC) => [
      { x: mC - 8, y: mR - 4 }, { x: mC + 8, y: mR - 4 },
      { x: mC - 8, y: mR + 4 }, { x: mC + 8, y: mR + 4 },
    ],
    qualifies: (mo) => mo.type !== 'village' && !mo.sealed &&
      typeof mo.regionIdx === 'number' && (mo.depth || 0) >= 8 &&
      typeof REGIONS !== 'undefined' && REGIONS[mo.regionIdx] && mo.type === REGIONS[mo.regionIdx].id,
    count: 2,
    offer: () => `💬 Anxious Herbalist: "My gatherer wandered deep into the wilds and never came back — the second far-off field you reach. Find them and I'll teach you their knack for foraging!"`,
    remind: () => `💬 Anxious Herbalist: "My gatherer is still out there, deep in the wilds — the second distant field."`,
    found: () => `🌿 You found the lost gatherer! They head home — go see the herbalist for your reward.`,
    done: () => `💬 Anxious Herbalist: "My gatherer's baskets are full again. Bless you, hero."`,
    grant: (rid) => {
      player.forageBonus = player.forageBonus || {};
      player.forageBonus[rid] = (player.forageBonus[rid] || 0) + 1;
      return `🌿 The gatherer teaches you their knack — +1 forage yield in this region, for good!`;
    },
  },
};

// Live list for the current map (mirrors `enemies`).
let villagers = [];

// Tiles villagers refuse to step onto even though they're "passable" — keeps
// them from clogging shop doors or sitting on a chest.
function isVillagerOffLimits(tileId) {
  return tileId === T.INN_DOOR || tileId === T.STORE_DOOR ||
         tileId === T.HERB_DOOR || tileId === T.SMITH_DOOR ||
         tileId === T.CHEST    || tileId === T.LARGE_CHEST ||
         tileId === T.LARGE_CHEST_R ||
         tileId === T.BOSS_CHEST_TL || tileId === T.BOSS_CHEST_TR ||
         tileId === T.BOSS_CHEST_BL || tileId === T.BOSS_CHEST_BR ||
         tileId === T.SHRINE   || tileId === T.CAVE_ENTRANCE ||
         tileId === T.CAVE_EXIT || tileId === T.CHEST_EXIT || tileId === T.PORTAL;
}

// Fresh spawn for a newly-activated village. Two shopkeepers stand behind
// wooden counters inside the inn and store houses; 20 more villagers wander
// the streets around the plaza.
function generateVillagers(mapObj) {
  const list = placeShopkeepers(mapObj);
  placeCollector(mapObj, list);
  placeLostParent(mapObj, list);
  placeTaxidermist(mapObj, list);
  placeAlchemist(mapObj, list);
  placeEscortGivers(mapObj, list);
  placeChronicler(mapObj, list);
  let nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  const m = mapObj.map;
  const count = 20;
  const spread = 22;

  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 80; t++) {
      const x = rnd(spread, MCOLS - spread);
      const y = rnd(spread, MROWS - spread);
      if (isSolid(m, x, y)) continue;
      if (isVillagerOffLimits(m[y][x])) continue;
      // Wanderers stay outside (on grass / cobble / marble — never on FLOOR,
      // so they don't collide with the keepers' workspace).
      if (m[y][x] === T.FLOOR) continue;
      if (list.some(v => v.x === x && v.y === y)) continue;
      const type = VILLAGER_TYPES[Math.floor(Math.random() * VILLAGER_TYPES.length)];
      list.push({
        id: nextId++,
        kind: type.name,
        robe: type.robe, hair: type.hair, skin: type.skin,
        size: type.sizeMul || 1,
        x, y,
        renderX: x, renderY: y,
        dir: [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}][Math.floor(Math.random()*4)],
        // Stagger initial timers so they don't all step in unison.
        timer: Math.random() * 800,
        stepMs: 550 + Math.random() * 500,
      });
      break;
    }
  }
  return list;
}

// Build the two shopkeepers (innkeeper + shopkeeper) and stamp wooden
// counters into their houses just inside the door. The keepers are
// stationary and stand one tile north of the door, facing south.
//
// Counter layout (door at bottom, north is up):
//     [WALL ... WALL]
//     [.  KEEPER  .]      ← keeper villager
//     [TABLE . TABLE]     ← counter flanking the entry aisle
//     [INN_DOOR]          ← player walks in here
function placeShopkeepers(mapObj) {
  const list = [];
  const m = mapObj.map;
  let id = 0;

  const setup = (door, role, kind, robe) => {
    if (!door) return;
    const r = door.r, c = door.c;
    // House interiors are a full row inside the door — (r-1, c) and the
    // flanking tiles are FLOOR. Stamp counter to either side of the entry
    // aisle so the keeper's standing tile is clear.
    if (r - 1 >= 0 && c - 1 >= 0 && m[r - 1][c - 1] === T.FLOOR) m[r - 1][c - 1] = T.TABLE;
    if (r - 1 >= 0 && c + 1 < MCOLS && m[r - 1][c + 1] === T.FLOOR) m[r - 1][c + 1] = T.TABLE;
    list.push({
      id: id++,
      kind, role,
      robe, hair: '#3a2010', skin: '#e8c8a0',
      size: 1,
      x: c, y: r - 2,
      renderX: c, renderY: r - 2,
      stationary: true,
      dir: { x: 0, y: 1 },        // facing south toward the door
      timer: 0, stepMs: 9999,
    });
  };

  setup(mapObj.innDoor,   'inn',   'Innkeeper',  '#aa3344');
  setup(mapObj.storeDoor, 'store', 'Shopkeeper', '#226633');
  setup(mapObj.herbDoor,  'herb',  'Herbalist',  '#5a8a3a');
  setup(mapObj.smithDoor, 'smith', 'Blacksmith', '#3a4a6a');
  return list;
}

// Stand a stationary "Collector" beside the village's chest. They lodge in the
// chest house and hand out the region's trophy-gathering quest (see
// openCollectorModal in shop.js). No-op if the map has no chest or no open
// interior tile beside it. `list` is mutated in place (a fresh id is assigned).
function placeCollector(mapObj, list) {
  const m = mapObj.map;
  // Find the single village chest.
  let chest = null;
  for (let r = 0; r < MROWS && !chest; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.CHEST) { chest = { r, c }; break; }
  if (!chest) return;
  // First open interior tile beside the chest, preferring the south side (the
  // chest sits near the house's north wall, so the floor below it is clear).
  const cands = [
    { x: chest.c,     y: chest.r + 1 },
    { x: chest.c - 1, y: chest.r     },
    { x: chest.c + 1, y: chest.r     },
    { x: chest.c,     y: chest.r + 2 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (list.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) return;
  const nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  list.push({
    id: nextId,
    kind: 'Collector', role: 'quest',
    robe: '#7a5a2a', hair: '#d8c088', skin: '#e8c8a0',
    size: 1,
    x: spot.x, y: spot.y,
    renderX: spot.x, renderY: spot.y,
    stationary: true,
    dir: { x: Math.sign(chest.c - spot.x), y: Math.sign(chest.r - spot.y) }, // face the chest
    timer: 0, stepMs: 9999,
  });
}

// Stand a stationary "Worried Parent" on the village plaza, near the fountain,
// where the hero can't miss them. They hand out the region's "Find Timmy" quest
// (their son wandered off to the region's 3rd dead-end map) and, once he's home,
// stand beside the reunited boy. `list` is mutated in place. No-op if no open
// plaza tile is free (extremely unlikely on the fixed village layout).
function placeLostParent(mapObj, list) {
  const m = mapObj.map;
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  // Open marble tiles ringing the 7×7 fountain colonnade — north first, then the
  // flanks. All clear of the pillars (±3), the plaza torches (±5), and the boss
  // chest to the south (midR+6..+7).
  const cands = [
    { x: midC,     y: midR - 6 }, { x: midC - 1, y: midR - 6 }, { x: midC + 1, y: midR - 6 },
    { x: midC,     y: midR - 7 },
    { x: midC - 6, y: midR     }, { x: midC + 6, y: midR     },
    { x: midC - 6, y: midR - 1 }, { x: midC + 6, y: midR - 1 },
    { x: midC - 7, y: midR     }, { x: midC + 7, y: midR     },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (list.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) return;
  const nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  list.push({
    id: nextId,
    kind: 'Parent', role: 'lostson',
    robe: '#7a3a3a', hair: '#5a4020', skin: '#e8c8a0',
    size: 1,
    x: spot.x, y: spot.y,
    renderX: spot.x, renderY: spot.y,
    stationary: true,
    dir: { x: 0, y: 1 },        // facing south, toward the plaza
    timer: 0, stepMs: 9999,
  });
}

// Stand a stationary "Taxidermist" on the plaza (every village), flanking the
// fountain. They hand out the region's full-roster trophy quest (see
// openTaxidermistModal): bring one of every monster trophy the region drops for a
// permanent +1 to that region's trophy drops. `list` is mutated in place.
function placeTaxidermist(mapObj, list) {
  const m = mapObj.map;
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  // Off to the flanks of the fountain colonnade, clear of the parent (north) and
  // the boss chest (south).
  const cands = [
    { x: midC + 5, y: midR - 5 }, { x: midC - 5, y: midR - 5 },
    { x: midC + 6, y: midR - 3 }, { x: midC - 6, y: midR - 3 },
    { x: midC + 5, y: midR - 7 }, { x: midC - 5, y: midR - 7 },
    { x: midC + 7, y: midR - 5 }, { x: midC - 7, y: midR - 5 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (list.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) return;
  const nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  list.push({
    id: nextId,
    kind: 'Taxidermist', role: 'taxidermist',
    robe: '#4a5a3a', hair: '#3a2a18', skin: '#e0c098',
    size: 1,
    x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
    stationary: true,
    dir: { x: 0, y: 1 },
    timer: 0, stepMs: 9999,
  });
}

// Stand a wandering "Alchemist" out toward the village perimeter — but only in
// EVERY OTHER region's village (those with an even region number). They run a
// repeatable single-trophy bulk order (see openAlchemistModal). `list` is mutated
// in place; no-op in odd-numbered regions or when no open perimeter tile is free.
function placeAlchemist(mapObj, list) {
  const regionIdx = (typeof mapObj.regionIdx === 'number')
    ? mapObj.regionIdx
    : (typeof REGIONS !== 'undefined' ? REGIONS.findIndex(r => r.id === mapObj.biome) : -1);
  const regionId = (typeof REGIONS !== 'undefined' && REGIONS[regionIdx]) ? REGIONS[regionIdx].id : null;
  // "Every other village": only even region numbers (regionNumberOf is 1-indexed,
  // so forest=1 skipped, fire=2 has one, water=3 skipped, …).
  if (!regionId || typeof regionNumberOf !== 'function' || regionNumberOf(regionId) % 2 !== 0) return;
  const m = mapObj.map;
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  // Camp out near the edge of the walkable village, well away from the plaza.
  const cands = [
    { x: midC,      y: midR - 15 }, { x: midC - 3, y: midR - 15 }, { x: midC + 3, y: midR - 15 },
    { x: midC,      y: midR + 15 }, { x: midC - 3, y: midR + 15 }, { x: midC + 3, y: midR + 15 },
    { x: midC - 15, y: midR      }, { x: midC + 15, y: midR      },
    { x: midC - 12, y: midR - 12 }, { x: midC + 12, y: midR - 12 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 2 || s.y < 2 || s.x >= MCOLS - 2 || s.y >= MROWS - 2) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (m[s.y][s.x] === T.FLOOR) continue;
    if (list.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) return;
  const nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  list.push({
    id: nextId,
    kind: 'Alchemist', role: 'alchemist',
    robe: '#3a4a6a', hair: '#6a5a2a', skin: '#e8c8a0',
    size: 1,
    x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
    dir: [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }][Math.floor(Math.random() * 4)],
    timer: Math.random() * 600, stepMs: 600 + Math.random() * 400,
  });
}

// Stand a stationary "Chronicler" in the FINAL village only (the one with a castle
// gate). They run the Completionist's Ledger (#13): every CHRONICLE_STEP quests the
// hero finishes across the world earns a tower-prep bundle. `list` is mutated.
const CHRONICLE_STEP = 10;
function placeChronicler(mapObj, list) {
  if (!mapObj.castleExitDir) return;   // final village only
  const m = mapObj.map;
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  const cands = [
    { x: midC + 9, y: midR }, { x: midC - 9, y: midR },
    { x: midC + 9, y: midR - 2 }, { x: midC - 9, y: midR - 2 },
    { x: midC + 9, y: midR + 2 }, { x: midC - 9, y: midR + 2 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (list.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) return;
  const nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  list.push({
    id: nextId, kind: 'Chronicler', role: 'completionist',
    robe: '#5a3a8a', hair: '#d8d0e8', skin: '#e0c098',
    size: 1, x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
    stationary: true, dir: { x: 0, y: -1 }, timer: 0, stepMs: 9999,
  });
}

// Talk to the Chronicler: claim the next tower-prep milestone if the hero has done
// enough quests, otherwise report progress toward it.
function talkChronicler(v) {
  const total = (typeof totalQuestsDone === 'function') ? totalQuestsDone(player) : 0;
  const claimed = player.chronicleMilestone || 0;
  const next = (claimed + 1) * CHRONICLE_STEP;
  if (total < next) {
    if (typeof showMsg === 'function')
      showMsg(`📜 Chronicler: "Your legend stands at ${total} deeds. Reach ${next} and I'll ready you for the tower."`, 4500);
    return;
  }
  player.chronicleMilestone = claimed + 1;
  const tier = player.chronicleMilestone;
  const rid = (typeof currentRegionId === 'function') ? currentRegionId() : 'shadow';
  const regionIdx = (typeof REGIONS !== 'undefined') ? REGIONS.findIndex(r => r.id === rid) : -1;
  const N = (typeof regionNumberOf === 'function') ? regionNumberOf(rid) : 1;
  const rewards = [];
  if (typeof grantRegionPotions === 'function') rewards.push(grantRegionPotions(rid, 2 * tier));
  if (typeof oreForRegionIdx === 'function' && regionIdx >= 0 && typeof addItem === 'function') {
    const ore = oreForRegionIdx(regionIdx);
    if (ore) rewards.push(`✦ ${addItem(ore.id, 2 * tier)} ${ore.icon} ${ore.label} ore!`);
  }
  if (typeof addItem === 'function') rewards.push(`💎 ${addItem('rubies', 100 * tier * N)} Rubies!`);
  if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
  if (typeof updateHUD === 'function') updateHUD();
  const msg = `📜 Chronicler: "Milestone ${tier} — ${total} deeds done! Take this for the climb ahead." ` + rewards.join(' ');
  if (typeof showMapMsg === 'function') showMapMsg(msg);
  else if (typeof showMsg === 'function') showMsg(msg, 6000);
}

// Build a Timmy (the lost child) standing on the open tile nearest a dead-end
// map's centre. Returns the Timmy entry, or null if no open tile exists. The
// caller decides where to stash him (see ensureTimmyOnDeadEnd).
function buildTimmyForMap(mapObj) {
  if (!mapObj || !mapObj.map) return null;
  const m = mapObj.map;
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  let spot = null;
  for (let radius = 0; radius <= 60 && !spot; radius++) {
    for (let dy = -radius; dy <= radius && !spot; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;  // ring only
        const x = cx + dx, y = cy + dy;
        if (x < 1 || y < 1 || x >= MCOLS - 1 || y >= MROWS - 1) continue;
        if (isSolid(m, x, y)) continue;
        if (isVillagerOffLimits(m[y][x])) continue;
        spot = { x, y }; break;
      }
    }
  }
  if (!spot) return null;
  return {
    id: 0,
    kind: 'Timmy', role: 'lostchild', lost: true,
    robe: '#4a7abf', hair: '#8a5a2a', skin: '#f0d0a8',
    size: 0.72,
    x: spot.x, y: spot.y,
    renderX: spot.x, renderY: spot.y,
    stationary: true,
    dir: { x: 0, y: 1 },
    timer: 0, stepMs: 9999,
  };
}

// The "Find Timmy" quest hides the lost boy on the 3rd distinct dead-end map the
// hero enters *after* taking the quest — not a pre-chosen one they'd never spot.
// Called from spawnVillagersForMap on every map entry (mirrors ensureGuildRecruiter):
// each new dead-end the hero steps into for that map's region is counted, and when
// the third is reached, Timmy is stood there — both in the live list and the map's
// saved copy so he persists. No-op unless this map is a dead-end whose region has an
// active quest and Timmy hasn't been placed yet.
function ensureTimmyOnDeadEnd(mapObj) {
  if (!mapObj || !mapObj.sealed || !mapObj.map) return;   // dead-ends only
  if (typeof villagers === 'undefined') return;
  if (typeof player === 'undefined' || !player.lostSonQuests) return;
  if (typeof REGIONS === 'undefined') return;
  const regionIdx = (typeof mapObj.regionIdx === 'number')
    ? mapObj.regionIdx
    : REGIONS.findIndex(r => r.id === mapObj.biome);
  if (regionIdx < 0 || !REGIONS[regionIdx]) return;
  const rid = REGIONS[regionIdx].id;
  const q = player.lostSonQuests[rid];
  if (!q || q.status !== 'active') return;   // no active quest in this region
  if (q.timmyMapId != null) return;          // already placed on a dead-end

  // Count this dead-end the first time the hero enters it.
  q.enteredDeadEnds = q.enteredDeadEnds || [];
  if (!q.enteredDeadEnds.includes(mapObj.id)) q.enteredDeadEnds.push(mapObj.id);
  if (q.enteredDeadEnds.length < 3) return;  // not the 3rd distinct one yet

  // The 3rd dead-end the hero has explored — Timmy is here. Add him live and save.
  const timmy = buildTimmyForMap(mapObj);
  if (!timmy) return;                        // no open tile (vanishingly rare); retry next dead-end
  q.timmyMapId = mapObj.id;
  villagers.push(timmy);
  mapObj.savedVillagers = villagers.map(v => ({ ...v }));
}

// Locate the (single) portal tile on a map. Returns {r,c} or null.
function findPortalTile(m) {
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.PORTAL) return { r, c };
  return null;
}

// Stand a stationary "Gatekeeper" beside the portal. The keeper controls the
// gate: the player talks to them (and pays a toll) instead of stepping onto the
// portal tile. No-op if the map has no portal or a keeper is already present —
// the guard also retro-fits older saves whose savedVillagers predate this NPC.
function ensurePortalKeeper(mapObj) {
  if (!mapObj || !mapObj.map) return;
  if (villagers.some(v => v.role === 'portal')) return;
  const p = findPortalTile(mapObj.map);
  if (!p) return;
  const m = mapObj.map;
  // First open tile beside the portal, preferring N/E/S so the western landing
  // tile (where travelers arrive) stays clear.
  const cands = [
    { x: p.c,     y: p.r - 1 },
    { x: p.c + 1, y: p.r     },
    { x: p.c,     y: p.r + 1 },
    { x: p.c - 1, y: p.r     },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (m[s.y][s.x] === T.PORTAL) continue;
    if (villagers.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) return;
  const nextId = villagers.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  villagers.push({
    id: nextId,
    kind: 'Gatekeeper', role: 'portal',
    robe: '#5a3a8a', hair: '#d8d0e8', skin: '#e0c098',
    size: 1,
    x: spot.x, y: spot.y,
    renderX: spot.x, renderY: spot.y,
    stationary: true,
    dir: { x: Math.sign(p.c - spot.x), y: Math.sign(p.r - spot.y) }, // face the gate
    timer: 0, stepMs: 9999,
  });
}

// Called on every map enter. Mirrors spawnEnemiesForMap: restore from
// savedVillagers if present, otherwise generate fresh (only if the map is an
// activated village), otherwise empty. Any map with a portal also gets a
// Gatekeeper standing watch beside it.
function spawnVillagersForMap(mid) {
  const rm = worldMaps[mid];
  if (!rm) { villagers = []; return; }
  if (rm.savedVillagers) {
    villagers = rm.savedVillagers.map(v => ({ ...v, renderX: v.x, renderY: v.y }));
    ensurePortalKeeper(rm);
    if (typeof ensureGuildRecruiter === 'function') ensureGuildRecruiter(rm);
    ensureTimmyOnDeadEnd(rm);
    ensureEscortTargets(rm);
    return;
  }
  if (rm.type === 'village' && rm.activated) {
    villagers = generateVillagers(rm);
  } else {
    villagers = [];
  }
  ensurePortalKeeper(rm);
  if (typeof ensureGuildRecruiter === 'function') ensureGuildRecruiter(rm);
  ensureTimmyOnDeadEnd(rm);
  ensureEscortTargets(rm);
  // Persist so the keeper survives re-entry. Previously only villages saved;
  // the cabin needs it too now that it has a portal keeper.
  if (villagers.length) rm.savedVillagers = villagers.map(v => ({ ...v }));
}

function saveVillagersToMap(mid) {
  if (worldMaps[mid]) {
    worldMaps[mid].savedVillagers = villagers.map(v => ({ ...v }));
  }
}

// Per-frame AI step. Each villager keeps a heading and steps on its own
// timer; sometimes it pauses, sometimes it turns. Render position smoothly
// interpolates toward the integer tile position so motion looks continuous.
// Stationary keepers skip the wander entirely.
function stepVillagers(dt, map) {
  const lerpK = 1 - Math.exp(-(dt || 16) / 130);
  for (const v of villagers) {
    v.renderX += (v.x - v.renderX) * lerpK;
    v.renderY += (v.y - v.renderY) * lerpK;
    if (Math.abs(v.renderX - v.x) < 0.005) v.renderX = v.x;
    if (Math.abs(v.renderY - v.y) < 0.005) v.renderY = v.y;

    if (v.stationary) continue;

    v.timer -= dt;
    if (v.timer > 0) continue;

    // Occasionally idle for a beat (chatting / looking around).
    if (Math.random() < 0.18) {
      v.timer = 600 + Math.random() * 1200;
      continue;
    }
    // 35% chance to pick a new heading; otherwise keep walking the same way.
    if (Math.random() < 0.35) {
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      v.dir = dirs[Math.floor(Math.random() * 4)];
    }

    const nx = v.x + v.dir.x, ny = v.y + v.dir.y;
    const inBounds = nx >= 0 && nx < MCOLS && ny >= 0 && ny < MROWS;
    const tile = inBounds ? map[ny][nx] : null;
    const otherV = villagers.some(o => o !== v && o.x === nx && o.y === ny);
    const blocked = !inBounds || isSolid(map, nx, ny) || otherV ||
                    isVillagerOffLimits(tile);

    if (!blocked) {
      v.x = nx; v.y = ny;
    } else {
      // Hit a wall / shop door / neighbour — turn for next tick.
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      v.dir = dirs[Math.floor(Math.random() * 4)];
    }
    v.timer = v.stepMs;
  }
}

// ─── Sprite ───────────────────────────────────────────────────────────────────
// Simple top-down humanoid: hooded robe + head + tiny boots. Each "kind" only
// varies in robe / hair / skin colour and slight scale (children are smaller).
function drawVillager(v, ts) {
  const sx = (v.renderX - camC) * ts, sy = (v.renderY - camR) * ts;
  const s = ts * v.size;
  const ox = (ts - s) / 2, oy = (ts - s) / 2;
  const phase = (v.id || 0) * 1.3;
  const bob = Math.sin(Date.now() / 220 + phase) * 1.2;
  const px = sx + ox, py = sy + oy + bob;
  const cx = sx + ts / 2;

  ctx.save();

  // Shadow at feet — anchored to the un-bobbed position.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(sx + ts / 2, sy + ts * 0.93, ts * 0.26 * v.size, ts * 0.06 * v.size, 0, 0, Math.PI * 2);
  ctx.fill();

  // Boots (under the robe hem)
  ctx.fillStyle = '#3a1c08';
  ctx.fillRect(px + s * 0.32, py + s * 0.86, s * 0.12, s * 0.12);
  ctx.fillRect(px + s * 0.56, py + s * 0.86, s * 0.12, s * 0.12);

  // Robe body
  ctx.fillStyle = v.robe;
  ctx.fillRect(px + s * 0.24, py + s * 0.42, s * 0.52, s * 0.48);
  // Shadow side
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(px + s * 0.50, py + s * 0.42, s * 0.26, s * 0.48);
  // Hem darker stripe
  ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
  ctx.fillRect(px + s * 0.24, py + s * 0.84, s * 0.52, s * 0.04);
  // Belt
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(px + s * 0.24, py + s * 0.62, s * 0.52, s * 0.05);
  ctx.fillStyle = '#cc9944';
  ctx.fillRect(px + s * 0.46, py + s * 0.62, s * 0.08, s * 0.05);

  // Sleeves / arms
  ctx.fillStyle = v.robe;
  ctx.fillRect(px + s * 0.14, py + s * 0.46, s * 0.12, s * 0.30);
  ctx.fillRect(px + s * 0.74, py + s * 0.46, s * 0.12, s * 0.30);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(px + s * 0.74, py + s * 0.46, s * 0.12, s * 0.30);
  // Hands
  ctx.fillStyle = v.skin;
  ctx.fillRect(px + s * 0.14, py + s * 0.74, s * 0.12, s * 0.08);
  ctx.fillRect(px + s * 0.74, py + s * 0.74, s * 0.12, s * 0.08);

  // Head
  const headY = py + s * 0.28;
  ctx.fillStyle = v.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, s * 0.19, 0, Math.PI * 2); ctx.fill();
  // Face shading
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.arc(cx + s * 0.04, headY + s * 0.02, s * 0.16, 0, Math.PI * 2); ctx.fill();
  // Hair cap (top half of head)
  ctx.fillStyle = v.hair;
  ctx.beginPath();
  ctx.arc(cx, headY - s * 0.04, s * 0.19, Math.PI, 0); ctx.fill();
  // A small fringe across the brow so the hair doesn't look like a perfect dome
  ctx.fillRect(px + s * 0.34, py + s * 0.22, s * 0.32, s * 0.04);

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(px + s * 0.39, py + s * 0.29, s * 0.06, s * 0.04);
  ctx.fillRect(px + s * 0.55, py + s * 0.29, s * 0.06, s * 0.04);
  // Eye glint
  ctx.fillStyle = '#fff';
  ctx.fillRect(px + s * 0.41, py + s * 0.30, s * 0.015, s * 0.015);
  ctx.fillRect(px + s * 0.57, py + s * 0.30, s * 0.015, s * 0.015);
  // Smile
  ctx.strokeStyle = '#5a2010';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + s * 0.43, py + s * 0.38);
  ctx.quadraticCurveTo(cx, py + s * 0.41, px + s * 0.57, py + s * 0.38);
  ctx.stroke();

  // The Gatekeeper wears a deep hood and cradles a glowing portal-orb instead
  // of a shopkeeper's apron, marking them as the gate's warden.
  if (v.role === 'portal') {
    // Hood pulled over the head
    ctx.fillStyle = '#2e2148';
    ctx.beginPath();
    ctx.arc(cx, headY - s * 0.02, s * 0.22, Math.PI, 0); ctx.fill();
    ctx.fillRect(px + s * 0.30, py + s * 0.18, s * 0.40, s * 0.10);
    // Glowing orb at the chest, tinted like the portal tile (#aa66ff)
    const orbT = Date.now() / 380 + phase;
    const orbR = s * (0.10 + Math.sin(orbT) * 0.014);
    const orbY = py + s * 0.60;
    ctx.fillStyle = 'rgba(170,102,255,0.30)';
    ctx.beginPath(); ctx.arc(cx, orbY, orbR * 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aa66ff';
    ctx.beginPath(); ctx.arc(cx, orbY, orbR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d8ff';
    ctx.beginPath(); ctx.arc(cx - orbR * 0.3, orbY - orbR * 0.3, orbR * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // The Collector lodges by the chest: a leather satchel slung across the
  // chest and a parchment scroll in hand, with a floating quest marker so the
  // hero can spot the commission from across the room.
  if (v.role === 'quest') {
    // Satchel strap across the chest
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(px + s * 0.30, py + s * 0.44, s * 0.40, s * 0.06);
    // Satchel pouch at the hip
    ctx.fillStyle = '#6a4424';
    ctx.fillRect(px + s * 0.60, py + s * 0.58, s * 0.16, s * 0.18);
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(px + s * 0.60, py + s * 0.64, s * 0.16, s * 0.03);
    // Rolled scroll held in the left hand
    ctx.fillStyle = '#e8dcb0';
    ctx.fillRect(px + s * 0.12, py + s * 0.62, s * 0.16, s * 0.06);
    ctx.fillStyle = '#c8b078';
    ctx.fillRect(px + s * 0.12, py + s * 0.62, s * 0.03, s * 0.06);
    ctx.fillRect(px + s * 0.25, py + s * 0.62, s * 0.03, s * 0.06);

    // Floating quest marker above the head — gold "!" while gathering, green
    // "✓" once the region's collection has been turned in.
    let done = false;
    try {
      const reg = (typeof storeRegion === 'function') ? storeRegion().region : null;
      const rid = reg ? reg.id : null;
      const q = (rid && player.collectorQuests) ? player.collectorQuests[rid] : null;
      done = !!(q && q.status === 'done');
    } catch (e) {}
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.fillStyle = done ? '#66dd88' : '#ffdd33';
    ctx.font = `bold ${Math.round(s * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.strokeText(done ? '✓' : '!', cx, markY);
    ctx.fillText(done ? '✓' : '!', cx, markY);
  }

  // The Worried Parent floats a quest marker like the Collector — gold "!" while
  // Timmy is still lost, green "✓" once he's been brought home.
  if (v.role === 'lostson') {
    let done = false;
    try {
      const reg = (typeof storeRegion === 'function') ? storeRegion().region : null;
      const rid = reg ? reg.id : null;
      const q = (rid && player.lostSonQuests) ? player.lostSonQuests[rid] : null;
      done = !!(q && q.status === 'done');
    } catch (e) {}
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.fillStyle = done ? '#66dd88' : '#ffdd33';
    ctx.font = `bold ${Math.round(s * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.strokeText(done ? '✓' : '!', cx, markY);
    ctx.fillText(done ? '✓' : '!', cx, markY);
  }

  // Lost Timmy waves for help — a bobbing cyan "!" so the hero spots him across
  // the dead-end map. (Once home in the village he's `lost:false`, no marker.)
  if (v.role === 'lostchild' && v.lost) {
    const markBob = Math.sin(Date.now() / 260 + phase) * (s * 0.05);
    ctx.fillStyle = '#66d8ff';
    ctx.font = `bold ${Math.round(s * 0.46)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    const markY = py - s * 0.04 + markBob;
    ctx.strokeText('!', cx, markY);
    ctx.fillText('!', cx, markY);
  }

  // The Guild Recruiter wears a steel-grey tabard blazoned with a crossed
  // sword-and-shield, and floats a crossed-swords "⚔" marker (green "✓" once the
  // hero is a member) so they stand out among the wandering crowd.
  if (v.role === 'guild') {
    // Tabard panel over the robe
    ctx.fillStyle = '#b8c0cc';
    ctx.fillRect(px + s * 0.32, py + s * 0.44, s * 0.36, s * 0.44);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(px + s * 0.50, py + s * 0.44, s * 0.18, s * 0.44);
    // Shield emblem
    ctx.fillStyle = '#3a5a9a';
    ctx.fillRect(px + s * 0.42, py + s * 0.54, s * 0.16, s * 0.16);
    ctx.fillStyle = '#dfe6ef';
    ctx.fillRect(px + s * 0.47, py + s * 0.54, s * 0.06, s * 0.22);   // sword blade
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(px + s * 0.44, py + s * 0.64, s * 0.12, s * 0.03);   // crossguard

    let done = false;
    try {
      const reg = (typeof storeRegion === 'function') ? storeRegion().region : null;
      const rid = reg ? reg.id : null;
      const q = (rid && player.guildQuests) ? player.guildQuests[rid] : null;
      done = !!(q && q.status === 'done');
    } catch (e) {}
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.fillStyle = done ? '#66dd88' : '#dfe6ef';
    ctx.font = `bold ${Math.round(s * 0.40)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.strokeText(done ? '✓' : '⚔', cx, markY);
    ctx.fillText(done ? '✓' : '⚔', cx, markY);
  }

  // The Taxidermist floats a deer marker — gold "!" until the region's full
  // trophy roster is turned in, green "✓" after.
  if (v.role === 'taxidermist') {
    let done = false;
    try {
      const reg = (typeof storeRegion === 'function') ? storeRegion().region : null;
      const rid = reg ? reg.id : null;
      const q = (rid && player.taxidermistQuests) ? player.taxidermistQuests[rid] : null;
      done = !!(q && q.status === 'done');
    } catch (e) {}
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.font = `bold ${Math.round(s * 0.42)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.fillStyle = done ? '#66dd88' : '#ffdd33';
    ctx.strokeText(done ? '✓' : '🦌', cx, markY);
    ctx.fillText(done ? '✓' : '🦌', cx, markY);
  }

  // The Alchemist floats an ⚗️ marker — always available (repeatable orders).
  if (v.role === 'alchemist') {
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.font = `bold ${Math.round(s * 0.40)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.fillStyle = '#c6ff8a';
    ctx.strokeText('⚗️', cx, markY);
    ctx.fillText('⚗️', cx, markY);
  }

  // Escort givers float their errand glyph (gold "!" while active, green "✓" once
  // done); the lost npc waves a cyan "!" out in the field until rescued.
  if (v.role === 'escort') {
    let status = null;
    try {
      const def = ESCORT_DEFS[v.escortId];
      const reg = (typeof storeRegion === 'function') ? storeRegion().region : null;
      const rid = reg ? reg.id : null;
      const q = (def && rid && player[def.key]) ? player[def.key][rid] : null;
      status = q ? q.status : null;
    } catch (e) {}
    const done = status === 'done';
    const glyph = done ? '✓' : (ESCORT_DEFS[v.escortId] ? ESCORT_DEFS[v.escortId].marker : '!');
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.font = `bold ${Math.round(s * 0.40)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.fillStyle = done ? '#66dd88' : '#ffdd33';
    ctx.strokeText(glyph, cx, markY);
    ctx.fillText(glyph, cx, markY);
  }
  if (v.role === 'escort_lost' && v.lost) {
    const markBob = Math.sin(Date.now() / 260 + phase) * (s * 0.05);
    ctx.fillStyle = '#66d8ff';
    ctx.font = `bold ${Math.round(s * 0.46)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    const markY = py - s * 0.04 + markBob;
    ctx.strokeText('!', cx, markY);
    ctx.fillText('!', cx, markY);
  }

  // The Chronicler floats a 📜 marker — gold when a milestone is claimable, else grey.
  if (v.role === 'completionist') {
    let claimable = false;
    try {
      const total = (typeof totalQuestsDone === 'function') ? totalQuestsDone(player) : 0;
      claimable = total >= ((player.chronicleMilestone || 0) + 1) * CHRONICLE_STEP;
    } catch (e) {}
    const markBob = Math.sin(Date.now() / 300 + phase) * (s * 0.04);
    ctx.font = `bold ${Math.round(s * 0.40)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    const markY = py - s * 0.02 + markBob;
    ctx.fillStyle = claimable ? '#ffdd33' : '#b9b0d0';
    ctx.strokeText('📜', cx, markY);
    ctx.fillText('📜', cx, markY);
  }

  // Shopkeepers wear an apron — a lighter strip over the front of the robe
  // so they're easy to pick out across the counter.
  if (v.role && v.role !== 'portal' && v.role !== 'quest' &&
      v.role !== 'lostson' && v.role !== 'lostchild' && v.role !== 'guild' &&
      v.role !== 'taxidermist' && v.role !== 'alchemist' &&
      v.role !== 'escort' && v.role !== 'escort_lost' && v.role !== 'completionist') {
    ctx.fillStyle = '#f0e8d8';
    ctx.fillRect(px + s * 0.32, py + s * 0.46, s * 0.36, s * 0.42);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(px + s * 0.50, py + s * 0.46, s * 0.18, s * 0.42);
    // The Herbalist tucks a sprig of green herb into the apron.
    if (v.role === 'herb') {
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(px + s * 0.46, py + s * 0.52, s * 0.08, s * 0.18);
      ctx.fillStyle = '#5aaa4a';
      ctx.fillRect(px + s * 0.40, py + s * 0.54, s * 0.06, s * 0.06);
      ctx.fillRect(px + s * 0.54, py + s * 0.54, s * 0.06, s * 0.06);
    }
    // The Blacksmith wears a dark leather apron with a steel hammer tucked in.
    if (v.role === 'smith') {
      // Darken the apron to soot-stained leather
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(px + s * 0.32, py + s * 0.46, s * 0.36, s * 0.42);
      // Hammer: grey steel head + brown handle across the chest
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(px + s * 0.40, py + s * 0.52, s * 0.04, s * 0.22);
      ctx.fillStyle = '#9a9aa2';
      ctx.fillRect(px + s * 0.34, py + s * 0.50, s * 0.16, s * 0.07);
    }
  }

  ctx.restore();
}

// ─── Interaction ──────────────────────────────────────────────────────────────
// Called from the keydown handler when the player presses space inside an
// active village. Looks for any villager in the 8 surrounding tiles; the
// keepers open their modal, anyone else delivers a flavor line.
function tryVillagerInteraction() {
  if (!villagers || !villagers.length) return false;
  // Prefer the keepers when ties happen (they should always win adjacency).
  const nearby = villagers
    .filter(v => Math.abs(v.x - player.x) <= 1 && Math.abs(v.y - player.y) <= 1)
    .sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0));
  if (!nearby.length) return false;
  const v = nearby[0];

  // Prologue cast (family, neighbours, the merchant). They carry scripted lines
  // rather than a random VILLAGER_CHAT one-liner, and what they say depends on
  // which beat the story is on — so the handler lives with the script, in
  // prologue.js, and is dispatched by name off the villager.
  if (v.pgTalk && typeof talkPrologueNpc === 'function') { talkPrologueNpc(v); return true; }
  if (v.role === 'inn'   && typeof openInnModal        === 'function') { openInnModal();        return true; }
  if (v.role === 'store' && typeof openStoreModal      === 'function') { openStoreModal();      return true; }
  if (v.role === 'herb'  && typeof openHerbalistModal  === 'function') { openHerbalistModal();  return true; }
  if (v.role === 'smith' && typeof openBlacksmithModal === 'function') { openBlacksmithModal(); return true; }
  // The Collector hands out the region's trophy-gathering quest.
  if (v.role === 'quest' && typeof openCollectorModal === 'function') { openCollectorModal(); return true; }
  // The Taxidermist hands out the region's full-roster trophy quest.
  if (v.role === 'taxidermist' && typeof openTaxidermistModal === 'function') { openTaxidermistModal(); return true; }
  // The Alchemist runs a repeatable single-trophy bulk order.
  if (v.role === 'alchemist' && typeof openAlchemistModal === 'function') { openAlchemistModal(); return true; }
  // The Chronicler pays out Completionist's Ledger milestones (final village).
  if (v.role === 'completionist') { talkChronicler(v); return true; }
  // The Worried Parent hands out (and closes) the "Find Timmy" quest.
  if (v.role === 'lostson')   { talkLostParent(v);  return true; }
  // The Guild Recruiter inducts the hero into the Sword & Shield Guild.
  if (v.role === 'guild' && typeof talkGuildRecruiter === 'function') { talkGuildRecruiter(v); return true; }
  // Escort quest givers (#7/8/9) hand out and reward their errand.
  if (v.role === 'escort') { talkEscortGiver(v); return true; }
  // An escort's lost npc: rescue them out in the field, or greet them once home.
  if (v.role === 'escort_lost') {
    if (v.lost) findEscortNpc(v);
    else if (typeof showMsg === 'function') showMsg(`💬 ${v.kind}: "Thank you for bringing me home, hero!"`, 2500);
    return true;
  }
  // Timmy: lost & scared out on a dead end, or safely home in the village.
  if (v.role === 'lostchild') {
    if (v.lost) findTimmy(v);
    else {
      const line = (VILLAGER_CHAT.Timmy || ["…"])[0];
      if (typeof showMsg === 'function') showMsg(`💬 Timmy: "${line}"`, 2500);
    }
    return true;
  }
  // The Gatekeeper opens the portal gate (the toll is collected on travel).
  if (v.role === 'portal') {
    if (typeof portalOpen !== 'undefined' && portalOpen) return true;
    if (typeof openPortalModal === 'function') openPortalModal();
    return true;
  }

  const lines = VILLAGER_CHAT[v.kind] || ["…"];
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (typeof showMsg === 'function') showMsg(`💬 ${v.kind}: "${line}"`, 2500);
  return true;
}

// ─── "Find Timmy" quest ─────────────────────────────────────────────────────
// A per-region errand: the village's Worried Parent asks the hero to find their
// son Timmy, who wandered off to the region's 3rd dead-end map (seeded in
// sealRegion). Reaching Timmy whisks him home beside the parent and rewards the
// hero with +1 bow level.

// The region id of the map the player is standing on ('forest' … 'shadow'),
// used to key player.lostSonQuests. Falls back through biome then forest.
function currentRegionId() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  if (cm && typeof cm.regionIdx === 'number' && typeof REGIONS !== 'undefined' && REGIONS[cm.regionIdx])
    return REGIONS[cm.regionIdx].id;
  if (cm && typeof REGIONS !== 'undefined') {
    const r = REGIONS.find(rr => rr.id === cm.biome);
    if (r) return r.id;
  }
  return 'forest';
}

// Talk to the Worried Parent. Drives the quest state machine:
//   (none)  → start the quest: hide Timmy on the region's 3rd dead-end map and
//             send the hero after him.  status → 'active'
//   'active'→ Timmy's still lost: a reminder of where to look.
//   'found' → Timmy is safely home beside them: hand over the reward (+1 bow
//             level).  status → 'done'
//   'done'  → a grateful thank-you.
function talkLostParent(v) {
  const rid = currentRegionId();
  player.lostSonQuests = player.lostSonQuests || {};
  let q = player.lostSonQuests[rid];

  // ── Reward turn-in: Timmy is home, hand over the +1 bow level ──────────────
  if (q && q.status === 'found') {
    q.status = 'done';
    player.bowLevel = (player.bowLevel || 1) + 1;   // each level = +2 bow damage
    if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
    if (typeof updateHUD === 'function') updateHUD();
    const msg = `💬 Parent: "Bless you, hero — you brought my Timmy home! Take this: my late father's bow arm will serve you well." 🏹 Bow Level up — now Lv ${player.bowLevel}!`;
    if (typeof showMapMsg === 'function') showMapMsg(msg);
    else if (typeof showMsg === 'function') showMsg(msg, 5000);
    return;
  }

  // ── Already fully done ─────────────────────────────────────────────────────
  if (q && q.status === 'done') {
    if (typeof showMsg === 'function')
      showMsg(`💬 Parent: "Timmy hasn't left my side since you brought him home. Thank you, hero."`, 4000);
    return;
  }

  // ── Start the quest on first contact ──────────────────────────────────────
  // Timmy isn't pre-placed; he's stood on the 3rd distinct dead-end the hero
  // enters from here on (see ensureTimmyOnDeadEnd). `enteredDeadEnds` tracks that
  // count; `timmyMapId` stays null until the third one is reached.
  if (!q) {
    q = player.lostSonQuests[rid] = { status: 'active', enteredDeadEnds: [], timmyMapId: null };
    if (typeof showMsg === 'function')
      showMsg(`💬 Parent: "Please, hero — my son Timmy wandered off! Folk saw him slip down the third dead-end trail he could find. Search the sealed paths at the edges of this land — the third one holds my boy!"`, 5000);
    return;
  }

  // ── Quest active, Timmy still out there ────────────────────────────────────
  if (typeof showMsg === 'function')
    showMsg(`💬 Parent: "Any sign of my Timmy? Keep exploring the dead-end trails — he's waiting down the third one you find."`, 4000);
}

// Reach the lost Timmy on a dead-end map. He's whisked home to stand beside his
// parent; the quest waits on 'found' until the hero returns to claim the reward.
function findTimmy(v) {
  const rid = currentRegionId();
  player.lostSonQuests = player.lostSonQuests || {};
  const q = player.lostSonQuests[rid] || (player.lostSonQuests[rid] = { status: 'active' });
  if (q.status === 'found' || q.status === 'done') return;   // already reunited (defensive)
  q.status = 'found';

  // Timmy vanishes from this dead-end map — pull him from the live list and the
  // map's saved copy so he never reappears here.
  v.lost = false;
  villagers = villagers.filter(o => o !== v);
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  if (cm) cm.savedVillagers = villagers.map(o => ({ ...o }));

  // …and reappears in the region's village, standing beside the parent.
  reuniteTimmyInVillage(cm ? cm.regionIdx : null);

  if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
  if (typeof showMapMsg === 'function') {
    showMapMsg(`👦 You found Timmy! He races home to the village — go tell his parent for your reward.`);
  } else if (typeof showMsg === 'function') {
    showMsg(`👦 You found Timmy! He races home — go see his parent.`, 4000);
  }
}

// Drop a reunited Timmy into the region's village, on an open tile beside the
// Worried Parent, and persist him to the village's savedVillagers so he's there
// when the hero returns. No-op if the village map or parent can't be found.
function reuniteTimmyInVillage(regionIdx) {
  if (typeof regionIdx !== 'number' || typeof findRegionVillageId !== 'function') return;
  const vid = findRegionVillageId(regionIdx);
  if (vid < 0) return;
  const vm = worldMaps[vid];
  if (!vm || !vm.map) return;
  const saved = vm.savedVillagers ? vm.savedVillagers.slice() : [];
  if (saved.some(o => o.role === 'lostchild')) return;   // already home
  const parent = saved.find(o => o.role === 'lostson');
  const m = vm.map;
  const base = parent || { x: Math.floor(MCOLS / 2), y: Math.floor(MROWS / 2) };
  const cands = [
    { x: base.x - 1, y: base.y     }, { x: base.x + 1, y: base.y     },
    { x: base.x,     y: base.y + 1 }, { x: base.x,     y: base.y - 1 },
    { x: base.x - 1, y: base.y + 1 }, { x: base.x + 1, y: base.y + 1 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (saved.some(o => o.x === s.x && o.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) spot = { x: base.x, y: base.y };
  const nextId = saved.reduce((mx, o) => Math.max(mx, o.id || 0), -1) + 1;
  saved.push({
    id: nextId,
    kind: 'Timmy', role: 'lostchild', lost: false, reunited: true,
    robe: '#4a7abf', hair: '#8a5a2a', skin: '#f0d0a8',
    size: 0.72,
    x: spot.x, y: spot.y,
    renderX: spot.x, renderY: spot.y,
    stationary: true,
    dir: { x: Math.sign((base.x) - spot.x) || 0, y: Math.sign((base.y) - spot.y) || 1 },
    timer: 0, stepMs: 9999,
  });
  vm.savedVillagers = saved;
}

// ─── Escort quest engine (shared by caravan / apprentice / gatherer, #7/8/9) ──
// Place every escort giver on the plaza of an activating village.
function placeEscortGivers(mapObj, list) {
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  const m = mapObj.map;
  for (const id in ESCORT_DEFS) {
    const def = ESCORT_DEFS[id];
    const cands = def.giverSpots(midR, midC);
    let spot = null;
    for (const s of cands) {
      if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
      if (isSolid(m, s.x, s.y)) continue;
      if (isVillagerOffLimits(m[s.y][s.x])) continue;
      if (list.some(v => v.x === s.x && v.y === s.y)) continue;
      spot = s; break;
    }
    if (!spot) continue;
    const nextId = list.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
    list.push({
      id: nextId, kind: def.giverKind, role: 'escort', escortId: id,
      robe: def.giverRobe, hair: def.giverHair, skin: def.giverSkin,
      size: 1, x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
      stationary: true, dir: { x: 0, y: 1 }, timer: 0, stepMs: 9999,
    });
  }
}

// Build an escort's lost npc on the open tile nearest a map's centre.
function buildEscortLost(mapObj, def) {
  if (!mapObj || !mapObj.map) return null;
  const m = mapObj.map;
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  let spot = null;
  for (let radius = 0; radius <= 60 && !spot; radius++) {
    for (let dy = -radius; dy <= radius && !spot; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 1 || y < 1 || x >= MCOLS - 1 || y >= MROWS - 1) continue;
        if (isSolid(m, x, y)) continue;
        if (isVillagerOffLimits(m[y][x])) continue;
        spot = { x, y }; break;
      }
    }
  }
  if (!spot) return null;
  return {
    id: 0, kind: def.lostKind, role: 'escort_lost', escortId: def.id, lost: true,
    robe: def.lostRobe, hair: def.lostHair, skin: def.lostSkin, size: def.lostSize || 1,
    x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
    stationary: true, dir: { x: 0, y: 1 }, timer: 0, stepMs: 9999,
  };
}

// Seed each escort's lost npc on the Nth qualifying map (mirrors ensureTimmyOnDeadEnd).
function ensureEscortTargets(mapObj) {
  if (!mapObj || !mapObj.map) return;
  if (typeof villagers === 'undefined' || typeof player === 'undefined') return;
  if (typeof REGIONS === 'undefined') return;
  const regionIdx = (typeof mapObj.regionIdx === 'number')
    ? mapObj.regionIdx : REGIONS.findIndex(r => r.id === mapObj.biome);
  if (regionIdx < 0 || !REGIONS[regionIdx]) return;
  const rid = REGIONS[regionIdx].id;
  let placedAny = false;
  for (const id in ESCORT_DEFS) {
    const def = ESCORT_DEFS[id];
    if (!def.qualifies(mapObj)) continue;
    const store = player[def.key]; if (!store) continue;
    const q = store[rid];
    if (!q || q.status !== 'active' || q.targetMapId != null) continue;
    q.entered = q.entered || [];
    if (!q.entered.includes(mapObj.id)) q.entered.push(mapObj.id);
    if (q.entered.length < def.count) continue;
    const npc = buildEscortLost(mapObj, def);
    if (!npc) continue;
    q.targetMapId = mapObj.id;
    villagers.push(npc);
    placedAny = true;
  }
  if (placedAny) mapObj.savedVillagers = villagers.map(v => ({ ...v }));
}

// Talk to an escort giver — offer / remind / reward / thank.
function talkEscortGiver(v) {
  const def = ESCORT_DEFS[v.escortId]; if (!def) return;
  const rid = currentRegionId();
  player[def.key] = player[def.key] || {};
  let q = player[def.key][rid];
  if (q && q.status === 'found') {
    q.status = 'done';
    const rewardMsg = def.grant(rid);
    if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
    if (typeof updateHUD === 'function') updateHUD();
    if (typeof showMapMsg === 'function') showMapMsg(rewardMsg);
    else if (typeof showMsg === 'function') showMsg(rewardMsg, 5000);
    return;
  }
  if (q && q.status === 'done') {
    if (typeof showMsg === 'function') showMsg(def.done(), 4000);
    return;
  }
  if (!q) {
    player[def.key][rid] = { status: 'active', entered: [], targetMapId: null };
    if (typeof showMsg === 'function') showMsg(def.offer(), 5500);
    return;
  }
  if (typeof showMsg === 'function') showMsg(def.remind(), 4000);
}

// Reach an escort's lost npc — whisk them home beside their giver.
function findEscortNpc(v) {
  const def = ESCORT_DEFS[v.escortId]; if (!def) return;
  const rid = currentRegionId();
  player[def.key] = player[def.key] || {};
  const q = player[def.key][rid] || (player[def.key][rid] = { status: 'active' });
  if (q.status === 'found' || q.status === 'done') return;
  q.status = 'found';
  v.lost = false;
  villagers = villagers.filter(o => o !== v);
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  if (cm) cm.savedVillagers = villagers.map(o => ({ ...o }));
  reuniteEscortInVillage(cm ? cm.regionIdx : null, def);
  if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
  if (typeof showMapMsg === 'function') showMapMsg(def.found());
  else if (typeof showMsg === 'function') showMsg(def.found(), 4000);
}

// Drop the reunited npc into the region's village beside their giver.
function reuniteEscortInVillage(regionIdx, def) {
  if (typeof regionIdx !== 'number' || typeof findRegionVillageId !== 'function') return;
  const vid = findRegionVillageId(regionIdx);
  if (vid < 0) return;
  const vm = worldMaps[vid];
  if (!vm || !vm.map) return;
  const saved = vm.savedVillagers ? vm.savedVillagers.slice() : [];
  if (saved.some(o => o.role === 'escort_lost' && o.escortId === def.id && o.reunited)) return;
  const giver = saved.find(o => o.role === 'escort' && o.escortId === def.id);
  const m = vm.map;
  const base = giver || { x: Math.floor(MCOLS / 2), y: Math.floor(MROWS / 2) };
  const cands = [
    { x: base.x - 1, y: base.y }, { x: base.x + 1, y: base.y },
    { x: base.x, y: base.y + 1 }, { x: base.x, y: base.y - 1 },
    { x: base.x - 1, y: base.y + 1 }, { x: base.x + 1, y: base.y + 1 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (saved.some(o => o.x === s.x && o.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) spot = { x: base.x, y: base.y };
  const nextId = saved.reduce((mx, o) => Math.max(mx, o.id || 0), -1) + 1;
  saved.push({
    id: nextId, kind: def.lostKind, role: 'escort_lost', escortId: def.id, lost: false, reunited: true,
    robe: def.lostRobe, hair: def.lostHair, skin: def.lostSkin, size: def.lostSize || 1,
    x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
    stationary: true, dir: { x: 0, y: 1 }, timer: 0, stepMs: 9999,
  });
  vm.savedVillagers = saved;
}
