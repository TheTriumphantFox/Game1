// Stage 9: deterministic regional village shrines.
// Plain-script global by design; loaded after world.js and before gameplay.

const SHRINE_ABILITY_DEFAULTS = {
  frostGrip: false,
  updraftGlide: false,
  emberLantern: false,
  arcaneSight: false,
  shadowStep: false,
};

const SHRINE_REWARDS = [
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'ability', key:'frostGrip', label:'Frost Grip', icon:'❄' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'ability', key:'updraftGlide', label:'Updraft Glide', icon:'🜁' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'ability', key:'emberLantern', label:'Ember Lantern', icon:'🔥' },
  { kind:'heart', label:'Heart Container', icon:'❤' },
  { kind:'ability', key:'arcaneSight', label:'Arcane Sight', icon:'✦' },
  { kind:'ability', key:'shadowStep', label:'Shadow Step', icon:'◐' },
];

const SHRINE_NAMES = [
  'Verdant Oath', 'Cinder Procession', 'Twin Tides', 'Stillfrost',
  'Stonebreaker', 'Caldera Trial', 'Two Winds', 'Storm Circuit',
  'Prismatic Accord', 'Last Light', 'Breath of the Mire',
  'Living Sequence', 'The Paired Path',
];

const SHRINE_ENTRY_X = 48;
const SHRINE_ENTRY_Y = 75;
const SHRINE_WIND_START_X = 63;
const SHRINE_GOAL_X = 88;

const SHRINE_MECHANISM_TILES = new Set([
  T.SHRINE_SWITCH, T.SHRINE_TOGGLE, T.SHRINE_RESET, T.SHRINE_BRAZIER,
  T.SHRINE_REWARD, T.SHRINE_VALVE, T.SHRINE_MIRROR, T.SHRINE_PUZZLE_RUNE,
  T.SHRINE_SHIFT,
]);

function shrineKey(x, y) { return `${x},${y}`; }
function shrineClone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function shrineQuest(regionIdx) {
  const rid = REGIONS[regionIdx] && REGIONS[regionIdx].id;
  return rid && player.shrineQuests ? player.shrineQuests[rid] : null;
}

function newShrineQuest(villageMapId) {
  return {
    version: 2,
    status: 'available',
    villageMapId,
    shrineMapId: null,
    rewardClaimed: false,
    legacyCompleted: false,
  };
}

function installVillageShrineEntrance(mapObj) {
  if (!mapObj || mapObj.type !== 'village' || !mapObj.activated) return false;
  const regionIdx = Number.isInteger(mapObj.regionIdx)
    ? mapObj.regionIdx : REGIONS.findIndex(r => r.id === mapObj.biome);
  if (regionIdx < 0 || !REGIONS[regionIdx]) return false;
  const sl = villageShrineLayout(mapObj.biome, mapObj.map);
  const pl = villagePortalLayout(mapObj.biome, mapObj.map);
  // Older activated villages may already have assigned this house to a shop.
  // Move that shop to the first free ordinary house door before stamping the
  // shrine so its keeper and metadata remain valid.
  const shops = [
    ['innDoor',T.INN_DOOR], ['storeDoor',T.STORE_DOOR],
    ['herbDoor',T.HERB_DOOR], ['smithDoor',T.SMITH_DOOR],
  ];
  for (const [field,tile] of shops) {
    const d=mapObj[field];
    if (!d || d.r!==sl.doorR || d.c!==sl.doorC) continue;
    let moved=null;
    for (let r=0;r<MROWS&&!moved;r++) for(let c=0;c<MCOLS;c++) {
      if (mapObj.map[r][c]===T.DOOR &&
          !(r===sl.doorR&&c===sl.doorC) && !(r===pl.doorR&&c===pl.doorC)) {moved={r,c};break;}
    }
    if (moved) { mapObj.map[moved.r][moved.c]=tile; mapObj[field]=moved; }
  }
  mapObj.map[sl.doorR][sl.doorC] = T.SHRINE_DOOR;
  mapObj.shrineDoor = { r:sl.doorR, c:sl.doorC };
  player.shrineQuests = player.shrineQuests || {};
  const rid = REGIONS[regionIdx].id;
  const old = player.shrineQuests[rid];
  if (!old || old.version !== 2) {
    const q = newShrineQuest(mapObj.id);
    if (old && old.status === 'done') q.legacyCompleted = true;
    player.shrineQuests[rid] = q;
  } else {
    old.villageMapId = mapObj.id;
  }
  return true;
}

function shrineBaseState(regionIdx) {
  return {
    version: 1,
    puzzleId: REGIONS[regionIdx].id,
    blocks: [], initialBlocks: [],
    flags: {}, timers: {}, mirrors: {},
    attempt: 0, sequence: [], sequenceIndex: 0,
    plateOrder: [], layer: 'light',
    entrance: { x:SHRINE_ENTRY_X, y:SHRINE_ENTRY_Y },
  };
}

function shrineSet(m, tile, cells) {
  for (const [x, y] of cells) m[y][x] = tile;
}
function shrineLine(m, tile, x1, y1, x2, y2) {
  const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
  let x = x1, y = y1;
  for (;;) {
    m[y][x] = tile;
    if (x === x2 && y === y2) break;
    x += dx; y += dy;
  }
}
function shrineAddBlock(s, x, y, kind) {
  s.blocks.push({ x, y, kind:kind || 'block' });
}
function shrineFinishBlocks(s) { s.initialBlocks = shrineClone(s.blocks); }

function manaSequence(attempt) {
  const len = 5 + (attempt % 2);
  const seq = [];
  let n = (attempt + 1) * 1103515245 + 12345;
  for (let i = 0; i < len; i++) {
    n = (Math.imul(n ^ (n >>> 16), 1664525) + 1013904223) | 0;
    seq.push(Math.abs(n) % 8);
  }
  return seq;
}

function buildShrineInterior(regionIdx) {
  const m = makeTile(MROWS, MCOLS, T.SHRINE_WALL);
  const s = shrineBaseState(regionIdx);
  setRect(m, 59, 45, 91, 105, T.SHRINE_FLOOR);
  setCol(m, 91, 59, 91, T.SHRINE_WALL);
  m[75][91] = T.SHRINE_GATE;
  m[75][45] = T.SHRINE_EXIT;
  m[74][50] = T.SHRINE_RESET;
  m[75][101] = T.SHRINE_REWARD;

  // Deterministic, readable puzzle arrangements. All local coordinates and
  // state are serialized; no generation-time randomness is used.
  switch (regionIdx) {
    case 0: // Forest: timed switch + block on plate.
      shrineSet(m, T.SHRINE_SWITCH, [[55,70]]);
      shrineSet(m, T.SHRINE_PLATE, [[72,78]]);
      shrineAddBlock(s, 64, 78);
      break;
    case 1: // Fire: order 1,3,2,4; hot route.
      shrineSet(m, T.SHRINE_BRAZIER, [[58,67],[70,67],[58,83],[70,83]]);
      s.braziers = [[58,67],[70,67],[58,83],[70,83]];
      s.order = [0,2,1,3]; s.orderIndex = 0;
      shrineLine(m, T.SHRINE_LAVA, 61, 72, 78, 72);
      shrineLine(m, T.SHRINE_LAVA, 61, 79, 78, 79);
      break;
    case 2: // Water: independent valves raise both bridges.
      shrineSet(m, T.SHRINE_VALVE, [[57,67],[57,83]]);
      shrineLine(m, T.SHRINE_WATER, 66, 60, 66, 90);
      shrineLine(m, T.SHRINE_WATER, 77, 60, 77, 90);
      s.waterSections = [[[66,74],[66,75],[66,76]], [[77,74],[77,75],[77,76]]];
      break;
    case 3: // Ice: sliding blocks, ordered plates.
      shrineSet(m, T.SHRINE_PLATE, [[72,67],[82,82]]);
      shrineAddBlock(s, 58, 67, 'ice'); shrineAddBlock(s, 58, 82, 'ice');
      s.requiredPlates = [[72,67],[82,82]];
      shrineSet(m, T.SHRINE_WALL, [[73,67],[83,82],[82,83],[72,66]]);
      break;
    case 4: // Earth: boulders break cracks, then hold plates.
      shrineSet(m, T.SHRINE_CRACKED, [[67,68],[67,82]]);
      shrineSet(m, T.SHRINE_PLATE, [[78,68],[78,82]]);
      shrineAddBlock(s, 59, 68, 'boulder'); shrineAddBlock(s, 59, 82, 'boulder');
      break;
    case 5: // Volcanic: timed drain + final crossing.
      shrineSet(m, T.SHRINE_BRAZIER, [[56,67],[82,84]]);
      shrineLine(m, T.SHRINE_LAVA, 64, 60, 64, 90);
      shrineLine(m, T.SHRINE_LAVA, 80, 60, 80, 90);
      shrineSet(m, T.SHRINE_PLATE, [[76,75]]);
      shrineAddBlock(s, 58, 75, 'block');
      s.volcanicBridges = [[[64,74],[64,75],[64,76]], [[80,74],[80,75],[80,76]]];
      break;
    case 6: // Air: both side toggles before the final current.
      shrineSet(m, T.SHRINE_TOGGLE, [[57,65],[57,85]]);
      shrineLine(m, T.SHRINE_WIND, 64, 75, 88, 75);
      s.windStartX = SHRINE_WIND_START_X;
      break;
    case 7: // Lightning: block plate + live switch.
      shrineSet(m, T.SHRINE_PLATE, [[68,75]]);
      shrineSet(m, T.SHRINE_SWITCH, [[78,68]]);
      shrineLine(m, T.SHRINE_CONDUIT, 69, 75, 78, 75);
      shrineLine(m, T.SHRINE_CONDUIT, 78, 69, 78, 75);
      shrineAddBlock(s, 58, 75);
      break;
    case 8: // Luminous: emitter -> fixed prism -> two mirror branches.
      shrineSet(m, T.SHRINE_EMITTER, [[55,75]]);
      shrineSet(m, T.SHRINE_PRISM, [[68,75]]);
      shrineSet(m, T.SHRINE_MIRROR, [[75,68],[75,82],[84,68],[84,82]]);
      shrineSet(m, T.SHRINE_RECEIVER, [[87,64],[87,86]]);
      s.mirrorCells = [[75,68],[75,82],[84,68],[84,82]];
      s.mirrorTargets = [1,3,0,2];
      for (const p of s.mirrorCells) s.mirrors[shrineKey(p[0],p[1])] = 0;
      break;
    case 9: // Necrotic: advancing darkness and optional light refills.
      shrineSet(m, T.SHRINE_BRAZIER, [[64,65],[76,85]]);
      shrineLine(m,T.SHRINE_DARKNESS,58,60,88,60);
      shrineLine(m,T.SHRINE_DARKNESS,58,90,88,90);
      s.darknessActive = false; s.timers.light = 12000;
      s.darkGoalX = SHRINE_GOAL_X;
      break;
    case 10: // Poison: independent zones and permanent vents.
      shrineSet(m, T.SHRINE_VALVE, [[62,66],[62,84]]);
      shrineSet(m, T.SHRINE_PLATE, [[72,75]]);
      setRect(m, 68, 78, 73, 87, T.SHRINE_GAS);
      setRect(m, 77, 78, 82, 87, T.SHRINE_GAS);
      s.timers.gasA = 0; s.timers.gasB = 0;
      break;
    case 11: // Mana: deterministic eight-rune sequence.
      s.runeCells = [[59,66],[68,64],[77,66],[84,71],[84,80],[77,85],[68,87],[59,84]];
      shrineSet(m, T.SHRINE_PUZZLE_RUNE, s.runeCells);
      s.sequence = manaSequence(0);
      break;
    case 12: // Shadow: paired collision layers; neither route is complete.
      shrineLine(m,T.SHRINE_WALL,45,72,90,72);
      shrineLine(m,T.SHRINE_WALL,45,78,90,78);
      shrineSet(m, T.SHRINE_SHIFT, [[57,75],[72,75]]);
      s.lightWalls = [[64,73],[64,74],[64,75],[64,76],[64,77]];
      s.darkWalls = [[80,73],[80,74],[80,75],[80,76],[80,77]];
      s.shadowGoalX = SHRINE_GOAL_X;
      break;
  }
  shrineFinishBlocks(s);
  return { map:m, state:s, entryLand:{x:SHRINE_ENTRY_X,y:SHRINE_ENTRY_Y} };
}

function createShrineMap(villageMapId, returnX, returnY, regionIdx) {
  const built = buildShrineInterior(regionIdx);
  const id = worldMaps.length;
  worldMaps.push({
    id, gx:0, gy:0,
    name:`${REGIONS[regionIdx].id[0].toUpperCase() + REGIONS[regionIdx].id.slice(1)} Shrine — ${SHRINE_NAMES[regionIdx]}`,
    type:'shrine', biome:REGIONS[regionIdx].id, regionIdx, depth:0,
    map:built.map, shrineState:built.state, entryLand:built.entryLand,
    returnMapId:villageMapId, returnX, returnY,
    enemyDefs:[], openedChests:new Set(), visited:true,
  });
  return id;
}

function resetShrineVolatile(cm) {
  if (!cm || cm.type !== 'shrine' || !cm.shrineState) return;
  const s = cm.shrineState;
  s.hazardClock = 0; s.damageClock = 0; s.windClock = 0;
  if (cm.regionIdx === 0) s.timers.switch = 0;
  if (cm.regionIdx === 5) {
    s.timers.drain = 0;
    if (s.volcanicBridges) {
      shrineSet(cm.map,T.SHRINE_LAVA,s.volcanicBridges[0]);
      shrineSet(cm.map,s.flags.brazierB?T.SHRINE_PLATFORM:T.SHRINE_LAVA,s.volcanicBridges[1]);
    }
  }
  if (cm.regionIdx === 9) { s.darknessActive = false; s.timers.light = 12000; }
  if (cm.regionIdx === 10) { s.timers.gasA = 0; s.timers.gasB = 0; }
}

function enterShrineMap(shrineId) {
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);
  currentMapId = shrineId;
  const cm = currentMap();
  resetShrineVolatile(cm);
  evaluateShrinePuzzle(cm);
  player.x = cm.entryLand.x; player.y = cm.entryLand.y;
  player.renderX = player.x; player.renderY = player.y;
  spawnEnemiesForMap(shrineId); spawnVillagersForMap(shrineId);
  transitionCooldown = 400; minimapDirty = true; clampCam(true);
  showMapMsg(`⛩ ${SHRINE_NAMES[cm.regionIdx]}`);
  if (cm.regionIdx === 0 && shrineQuest(0).status !== 'solved')
    showMsg('Press Space / Interact beside the switch, then push the block onto its plate.', 4200);
}

function tryShrineTransition() {
  if (transitionCooldown > 0) return false;
  const cm = currentMap(), tile = mapData()[player.y][player.x];
  if (cm.type === 'village' && tile === T.SHRINE_DOOR) {
    installVillageShrineEntrance(cm);
    const q = shrineQuest(cm.regionIdx);
    if (!q) return false;
    if (q.shrineMapId == null || !worldMaps[q.shrineMapId]) {
      const sl = villageShrineLayout(cm.biome, cm.map);
      q.shrineMapId = createShrineMap(cm.id, sl.returnC, sl.returnR, cm.regionIdx);
    }
    enterShrineMap(q.shrineMapId);
    return true;
  }
  if (cm.type === 'shrine' && tile === T.SHRINE_EXIT) {
    saveEnemyStateToMap(currentMapId); saveVillagersToMap(currentMapId);
    currentMapId = cm.returnMapId;
    player.x = cm.returnX; player.y = cm.returnY;
    player.renderX = player.x; player.renderY = player.y;
    spawnEnemiesForMap(currentMapId); spawnVillagersForMap(currentMapId);
    transitionCooldown = 500; minimapDirty = true; clampCam(true);
    showMapMsg('You return to the village.');
    return true;
  }
  return false;
}

function shrineBlockAt(s, x, y, except) {
  return s.blocks.find((b, i) => i !== except && b.x === x && b.y === y) || null;
}
function shadowLayerSolid(s, x, y, layer) {
  if (!s || s.puzzleId !== 'shadow') return false;
  const cells = layer === 'dark' ? s.darkWalls : s.lightWalls;
  return cells.some(p => p[0] === x && p[1] === y);
}
function shrineDynamicSolidAt(cm, x, y) {
  if (!cm || cm.type !== 'shrine' || !cm.shrineState) return false;
  const s = cm.shrineState;
  return !!shrineBlockAt(s, x, y) || shadowLayerSolid(s, x, y, s.layer);
}
function shrineStaticPushable(cm, x, y) {
  if (x < 0 || y < 0 || x >= MCOLS || y >= MROWS) return false;
  const t = cm.map[y][x];
  return !isSolid(cm.map, x, y) && t !== T.SHRINE_WATER &&
         !(t === T.SHRINE_LAVA && !(cm.shrineState.timers.drain > 0));
}
function shrinePrepareMove(cm, fromX, fromY, toX, toY) {
  if (!cm || cm.type !== 'shrine') return true;
  const s = cm.shrineState;
  if (shadowLayerSolid(s, toX, toY, s.layer)) return false;
  const bi = s.blocks.findIndex(b => b.x === toX && b.y === toY);
  if (bi < 0) return true;
  const dx = toX - fromX, dy = toY - fromY;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const b = s.blocks[bi];
  let nx = b.x + dx, ny = b.y + dy;
  if (b.kind === 'ice') {
    let lastX = b.x, lastY = b.y;
    while (shrineStaticPushable(cm, nx, ny) && !shrineBlockAt(s, nx, ny, bi) &&
           !shadowLayerSolid(s, nx, ny, s.layer)) {
      lastX = nx; lastY = ny; nx += dx; ny += dy;
    }
    if (lastX === b.x && lastY === b.y) return false;
    b.x = lastX; b.y = lastY;
  } else {
    if (cm.map[ny] && cm.map[ny][nx] === T.SHRINE_CRACKED && b.kind === 'boulder') {
      cm.map[ny][nx] = T.SHRINE_FLOOR;
    } else if (!shrineStaticPushable(cm, nx, ny)) return false;
    if (shrineBlockAt(s, nx, ny, bi) || shadowLayerSolid(s, nx, ny, s.layer)) return false;
    b.x = nx; b.y = ny;
  }
  evaluateShrinePuzzle(cm);
  return true;
}

function blockOn(s, x, y) { return !!shrineBlockAt(s, x, y); }
function setShrineSolved(cm) {
  if (!cm || cm.type !== 'shrine') return;
  const q = shrineQuest(cm.regionIdx);
  if (!q || q.status === 'solved') return;
  q.status = 'solved';
  cm.map[75][91] = T.SHRINE_FLOOR;
  showMsg('✦ The shrine gate opens.', 2400);
  minimapDirty = true;
  // The gate tile changed, so the renderer's memoized per-map tile scans have to
  // be dropped alongside the minimap. Shrines are not a 2.5D map today, so this
  // is insurance: a stale tall-tile list draws a gate that is already open.
  if (typeof invalidateTallTiles === 'function') invalidateTallTiles(cm);
  // Stage 8: solving the puzzle is what lifts the blight from this region — the
  // overlay stops and its creatures shed the corrupted template (corruption.js).
  if (typeof cleanseRegionCorruption === 'function') cleanseRegionCorruption(cm.regionIdx);
}

function evaluateShrinePuzzle(cm) {
  if (!cm || cm.type !== 'shrine') return;
  const s = cm.shrineState;
  if (shrineQuest(cm.regionIdx) && shrineQuest(cm.regionIdx).status === 'solved') {
    cm.map[75][91] = T.SHRINE_FLOOR; return;
  }
  let solved = false;
  switch (cm.regionIdx) {
    case 0: solved = s.timers.switch > 0 && blockOn(s,72,78); break;
    case 1: solved = s.orderIndex >= s.order.length; break;
    case 2: solved = !!s.flags.valveA && !!s.flags.valveB; break;
    case 3: solved = s.plateOrder.length === 2; break;
    case 4: solved = blockOn(s,78,68) && blockOn(s,78,82); break;
    case 5: solved = blockOn(s,76,75) && !!s.flags.brazierB && s.timers.drain > 0; break;
    case 6: solved = !!s.flags.toggleA && !!s.flags.toggleB; break;
    case 7: solved = blockOn(s,68,75) && !!s.flags.circuit; break;
    case 8: solved = s.mirrorCells.every((p,i) => s.mirrors[shrineKey(p[0],p[1])] === s.mirrorTargets[i]); break;
    case 10: solved = !!s.flags.valveA && !!s.flags.valveB; break;
    case 11: solved = s.sequenceIndex >= s.sequence.length; break;
  }
  if (cm.regionIdx === 3) {
    const occupied = s.requiredPlates.map(p => blockOn(s,p[0],p[1]));
    for (let i = 0; i < occupied.length; i++) {
      if (occupied[i] && !s.plateOrder.includes(i)) {
        if (i !== s.plateOrder.length) {
          s.blocks = shrineClone(s.initialBlocks); s.plateOrder = [];
          showMsg('The ice sigils reject that order.', 1800); return;
        }
        s.plateOrder.push(i);
      }
    }
    solved = s.plateOrder.length === 2;
  }
  if (solved) setShrineSolved(cm);
}

function resetShrineAttempt() {
  const cm = currentMap();
  if (!cm || cm.type !== 'shrine') return false;
  const q = shrineQuest(cm.regionIdx);
  if (q && q.status === 'solved') { showMsg('The completed trial rests.', 1500); return true; }
  const built = buildShrineInterior(cm.regionIdx);
  cm.map = built.map; cm.shrineState = built.state; cm.entryLand = built.entryLand;
  player.x = built.entryLand.x; player.y = built.entryLand.y;
  player.renderX = player.x; player.renderY = player.y;
  minimapDirty = true; clampCam(true);
  showMsg('↺ The shrine trial resets.', 1800);
  return true;
}

function shrineDamage(amount, minimumOne) {
  if (minimumOne) {
    player.hp = Math.max(1, player.hp - amount); player.invincible = 900;
    updateHUD();
  } else if (player.invincible <= 0 && typeof damagePlayer === 'function') {
    damagePlayer(amount, null);
    player.invincible = 900;
    if (player.hp <= 0 && typeof respawn === 'function') respawn();
  }
}
function shrineFallReset(message, damage) {
  const cm = currentMap();
  if (!cm || cm.type !== 'shrine') return;
  if (damage) shrineDamage(damage, true);
  const q=shrineQuest(cm.regionIdx);
  if (q && q.status !== 'solved') {
    const built=buildShrineInterior(cm.regionIdx);
    cm.map=built.map; cm.shrineState=built.state; cm.entryLand=built.entryLand;
    minimapDirty=true;
  }
  const p = cm.shrineState.entrance;
  player.x = p.x; player.y = p.y; player.renderX = p.x; player.renderY = p.y;
  showMsg(message, 1600); clampCam(true);
}

function activateShrineMechanism(cm, x, y, fromStrike) {
  const s = cm.shrineState, t = cm.map[y][x], k = shrineKey(x,y);
  if (t === T.SHRINE_RESET) return resetShrineAttempt();
  if (t === T.SHRINE_REWARD) return claimShrineReward(cm);
  if (t === T.SHRINE_SWITCH) {
    if (cm.regionIdx === 0) s.timers.switch = 8000;
    else if (cm.regionIdx === 7) s.flags.circuit = !s.flags.circuit;
    else s.flags[k] = !s.flags[k];
  } else if (t === T.SHRINE_TOGGLE) {
    if (x === 57 && y === 65) s.flags.toggleA = !s.flags.toggleA;
    else s.flags.toggleB = !s.flags.toggleB;
  } else if (t === T.SHRINE_VALVE) {
    const first = y < 75;
    s.flags[first ? 'valveA' : 'valveB'] = true;
    if (cm.regionIdx === 2) {
      const section = s.waterSections[first ? 0 : 1];
      shrineSet(cm.map, T.SHRINE_PLATFORM, section);
    }
  } else if (t === T.SHRINE_BRAZIER) {
    s.flags[k] = true;
    if (cm.regionIdx === 1) {
      const i = s.braziers.findIndex(p => p[0] === x && p[1] === y);
      if (i !== s.order[s.orderIndex]) {
        s.orderIndex = 0; s.flags = {};
        showMsg('The flame order breaks. Begin again.', 1800);
      } else s.orderIndex++;
    } else if (cm.regionIdx === 5) {
      if (x < 70) { s.timers.drain = 10000; shrineSet(cm.map,T.SHRINE_PLATFORM,s.volcanicBridges[0]); }
      else { s.flags.brazierB = true; shrineSet(cm.map,T.SHRINE_PLATFORM,s.volcanicBridges[1]); }
    } else if (cm.regionIdx === 9) {
      s.timers.light = Math.min(12000, s.timers.light + 5500);
    }
  } else if (t === T.SHRINE_MIRROR) {
    s.mirrors[k] = ((s.mirrors[k] || 0) + 1) % 4;
  } else if (t === T.SHRINE_PUZZLE_RUNE) {
    shrineRuneInput(cm, x, y);
  } else if (t === T.SHRINE_SHIFT) {
    const next = s.layer === 'light' ? 'dark' : 'light';
    if (shadowLayerSolid(s, player.x, player.y, next)) {
      showMsg('The other layer is solid here.', 1400); return true;
    }
    s.layer = next; showMsg(next === 'dark' ? '◐ Dark layer' : '◑ Light layer', 1200);
  } else return false;
  evaluateShrinePuzzle(cm);
  return true;
}

function shrineRuneInput(cm, x, y) {
  const s = cm.shrineState;
  const rune = s.runeCells.findIndex(p => p[0] === x && p[1] === y);
  if (rune < 0) return;
  if (rune === s.sequence[s.sequenceIndex]) {
    s.sequenceIndex++;
    showMsg(`Rune ${s.sequenceIndex}/${s.sequence.length}`, 700);
  } else {
    s.attempt++; s.sequence = manaSequence(s.attempt); s.sequenceIndex = 0;
    showMsg('The runes reform into a new pattern.', 1600);
  }
  evaluateShrinePuzzle(cm);
}

function tryShrineInteraction() {
  const cm = currentMap();
  if (!cm || cm.type !== 'shrine') return false;
  const dirs = [];
  if (player.swordDir) dirs.push([player.swordDir.x, player.swordDir.y]);
  dirs.push([1,0],[-1,0],[0,1],[0,-1]);
  const seen = new Set();
  for (const [dx,dy] of dirs) {
    const x = player.x + dx, y = player.y + dy, k = shrineKey(x,y);
    if (seen.has(k) || !currentMap().map[y]) continue; seen.add(k);
    if (SHRINE_MECHANISM_TILES.has(currentMap().map[y][x]))
      return activateShrineMechanism(cm,x,y,false);
  }
  return false;
}

function tryShrineStrike(x, y) {
  const cm = currentMap();
  if (!cm || cm.type !== 'shrine' || !cm.map[y]) return false;
  const t = cm.map[y][x];
  if (t !== T.SHRINE_BRAZIER && t !== T.SHRINE_TOGGLE && t !== T.SHRINE_SWITCH) return false;
  return activateShrineMechanism(cm,x,y,true);
}

function onShrinePlayerStep() {
  const cm = currentMap();
  if (!cm || cm.type !== 'shrine') return;
  const s = cm.shrineState, t = cm.map[player.y][player.x];
  if (t === T.SHRINE_LAVA) {
    if (cm.regionIdx === 5) shrineFallReset('Lava surges beneath you!', 2);
    else shrineDamage(1, false);
  } else if (t === T.SHRINE_WATER) {
    shrineFallReset('The current returns you to the entrance.', 0);
  } else if (t === T.SHRINE_WIND) {
    if (!(s.flags.toggleA && s.flags.toggleB)) shrineFallReset('The crosswind drops you at the start.', 0);
    else if (player.x >= 88) setShrineSolved(cm);
  } else if (t === T.SHRINE_PUZZLE_RUNE) shrineRuneInput(cm,player.x,player.y);
  if (cm.regionIdx === 9 && player.x > 58) s.darknessActive = true;
  if (cm.regionIdx === 9 && player.x >= s.darkGoalX) setShrineSolved(cm);
  if (cm.regionIdx === 12 && player.x >= s.shadowGoalX) setShrineSolved(cm);
  if (cm.regionIdx === 10 && t === T.SHRINE_PLATE) {
    s.timers.gasA = 0; s.timers.gasB = 0; showMsg('The vents draw a fresh breath.', 900);
  }
  evaluateShrinePuzzle(cm);
}

function updateShrinePuzzle(dt) {
  const cm = currentMap();
  if (!cm || cm.type !== 'shrine') return;
  const s = cm.shrineState;
  if (s.timers.switch > 0) s.timers.switch = Math.max(0,s.timers.switch-dt);
  if (cm.regionIdx === 5 && s.timers.drain > 0) {
    s.timers.drain = Math.max(0,s.timers.drain-dt);
    if (s.timers.drain === 0) {
      shrineSet(cm.map,T.SHRINE_LAVA,s.volcanicBridges[0]);
      if (!s.flags.brazierB) shrineSet(cm.map,T.SHRINE_LAVA,s.volcanicBridges[1]);
      if (shrineQuest(cm.regionIdx).status !== 'solved') {
        shrineFallReset('The lava rises; the trial resets.', 0);
        return;
      }
    }
  }
  if (cm.regionIdx === 6 && s.flags.toggleA && s.flags.toggleB &&
      cm.map[player.y][player.x] === T.SHRINE_WIND) {
    s.windClock = (s.windClock || 0) + dt;
    if (s.windClock >= 180) {
      s.windClock = 0;
      const nx = Math.min(88, player.x + 1);
      if (!isSolid(cm.map,nx,player.y) && !shrineDynamicSolidAt(cm,nx,player.y)) {
        player.x=nx; player.renderX=nx;
        if (nx >= 88) setShrineSolved(cm);
      } else shrineFallReset('The current loses its hold.',0);
    }
  }
  if (cm.regionIdx === 9 && s.darknessActive && shrineQuest(cm.regionIdx).status !== 'solved') {
    s.timers.light -= dt;
    if (s.timers.light <= 0) { shrineFallReset('The darkness closes in.',0); s.darknessActive=false; s.timers.light=12000; }
  }
  if (cm.regionIdx === 10 && shrineQuest(cm.regionIdx).status !== 'solved') {
    if (!s.flags.valveA) s.timers.gasA += dt;
    if (!s.flags.valveB) s.timers.gasB += dt;
    const inA = player.x >= 78 && player.x <= 87 && player.y >= 68 && player.y <= 73;
    const inB = player.x >= 78 && player.x <= 87 && player.y >= 77 && player.y <= 82;
    if ((inA && s.timers.gasA >= 3000) || (inB && s.timers.gasB >= 3000)) {
      s.damageClock = (s.damageClock || 0) + dt;
      if (s.damageClock >= 1000) { s.damageClock = 0; shrineDamage(1,false); }
    } else s.damageClock = 0;
  }
  evaluateShrinePuzzle(cm);
}

function claimShrineReward(cm) {
  const q = shrineQuest(cm.regionIdx);
  if (!q || q.status !== 'solved') { showMsg('The reward remains sealed.', 1400); return true; }
  if (q.rewardClaimed) { showMsg('The shrine reward has already been claimed.', 1400); return true; }
  const reward = SHRINE_REWARDS[cm.regionIdx];
  q.rewardClaimed = true;
  player.abilities = Object.assign({}, SHRINE_ABILITY_DEFAULTS, player.abilities || {});
  if (reward.kind === 'heart') {
    // Stage 2's last open item, closed here. A hero who broke this region's
    // LEGACY sealed shrine (the old overworld system: strike it with the right
    // element, take +2 Max HP) already has this exact reward in their Max HP.
    // migrateShrineSystemAfterLoad deliberately lets them keep it and records
    // `legacyCompleted`; until now nothing ever read that flag, so the same
    // region paid +2 twice. The flag is consumed here instead of the +2 being
    // reclaimed, because taking Max HP back off a hero who earned it under the
    // old rules is the worse of the two wrongs.
    //
    // Ability rewards are NOT affected: an ability is not a second heart, so
    // there is nothing duplicated to withhold.
    if (q.legacyCompleted) {
      q.legacyCompleted = false;     // consumed; never pays out twice
      player.hp = player.maxHp;
      showMsg('❤ The shrine restores you. Its heart was already yours, from the old seal.', 3600);
    } else {
      player.maxHp += 2; player.hp = player.maxHp;
      showMsg('❤ Heart Container — Maximum HP +2!', 3000);
    }
  } else {
    // Through grantAbility (player.js) rather than by assignment, so there is
    // one place that owns the bag. Then equip it if it is one of the two the
    // [F] key drives, or the shrine that grants Updraft Glide would also demand
    // a trip through the menu before the button did anything (abilities.js).
    if (typeof grantAbility === 'function') grantAbility(reward.key);
    else player.abilities[reward.key] = true;
    if (typeof autoEquipAbility === 'function') autoEquipAbility(reward.key);
    showMsg(`${reward.icon} Ability unlocked: ${reward.label}`, 3200);
  }
  updateHUD();
  return true;
}

function findTappedShrineInteractable(wx, wy, passable, idx) {
  const cm = currentMap(), map = mapData();
  const tc = Math.floor(wx), tr = Math.floor(wy);
  let tx=-1, ty=-1, best=1.25;
  for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
    const x=tc+dc,y=tr+dr;
    if (!map[y] || x<0 || x>=MCOLS) continue;
    const t=map[y][x];
    const ok = (cm.type === 'village' && t === T.SHRINE_DOOR) ||
               (cm.type === 'shrine' && SHRINE_MECHANISM_TILES.has(t));
    if (!ok) continue;
    const d=Math.hypot(x+.5-wx,y+.5-wy); if (d<best) {best=d;tx=x;ty=y;}
  }
  if (tx<0) return null;
  const door = map[ty][tx] === T.SHRINE_DOOR;
  const goals = new Set();
  if (door && passable(tx,ty)) goals.add(idx(tx,ty));
  else for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])
    if (passable(tx+dx,ty+dy)) goals.add(idx(tx+dx,ty+dy));
  return {
    goals,
    adjacentNow: () => door ? (player.x===tx && player.y===ty)
      : Math.abs(tx-player.x)+Math.abs(ty-player.y)===1,
    act: () => { if (!door) tryShrineInteraction(); },
  };
}

function migrateShrineSystemAfterLoad() {
  player.abilities = Object.assign({}, SHRINE_ABILITY_DEFAULTS, shrineClone(player.abilities || {}));
  player.shrineQuests = player.shrineQuests || {};
  // Legacy seals become ordinary reusable healing shrines; clue runes return to
  // local ground. Their historical +2 HP is deliberately retained.
  for (const cm of worldMaps) {
    if (!cm || !cm.map) continue;
    const ground = cm.type === 'shrine' ? T.SHRINE_FLOOR : regionById(cm.biome).ground;
    for (let y=0;y<MROWS;y++) for (let x=0;x<MCOLS;x++) {
      if (cm.map[y][x] === T.SEALED_SHRINE) cm.map[y][x] = T.SHRINE;
      else if (cm.map[y][x] === T.SHRINE_RUNE) cm.map[y][x] = ground;
    }
    delete cm.shrineElement;
  }
  for (let i=0;i<REGIONS.length;i++) {
    const rid=REGIONS[i].id, old=player.shrineQuests[rid];
    if (old && old.version !== 2) {
      const village=worldMaps.find(m=>m&&m.type==='village'&&m.regionIdx===i);
      const q=newShrineQuest(village ? village.id : null);
      q.legacyCompleted=old.status==='done'; player.shrineQuests[rid]=q;
    }
    const village=worldMaps.find(m=>m&&m.type==='village'&&m.regionIdx===i&&m.activated);
    if (village) installVillageShrineEntrance(village);
  }
  for (const cm of worldMaps) {
    if (cm && cm.type === 'shrine') {
      const rid = REGIONS[cm.regionIdx].id;
      if (!player.shrineQuests[rid] || player.shrineQuests[rid].version !== 2)
        player.shrineQuests[rid] = newShrineQuest(cm.returnMapId);
      player.shrineQuests[rid].shrineMapId = cm.id;
      resetShrineVolatile(cm); evaluateShrinePuzzle(cm);
    }
  }
}

function devEnterShrine(regionIdx) {
  regionIdx = Math.max(0,Math.min(REGIONS.length-1,Number(regionIdx)||0));
  let village=worldMaps.find(m=>m&&m.type==='village'&&m.regionIdx===regionIdx);
  if (!village && typeof getOrCreateActiveRegionVillage === 'function') {
    const id=getOrCreateActiveRegionVillage(regionIdx); village=worldMaps[id];
  }
  if (!village) { console.warn('No village available for shrine',regionIdx); return false; }
  if (!village.activated) activateVillage(village);
  else installVillageShrineEntrance(village);
  const q=shrineQuest(regionIdx), sl=villageShrineLayout(village.biome, village.map);
  if (q.shrineMapId==null || !worldMaps[q.shrineMapId])
    q.shrineMapId=createShrineMap(village.id,sl.returnC,sl.returnR,regionIdx);
  enterShrineMap(q.shrineMapId); return true;
}

// Canvas-native shrine art. The normal fallback fill has already run.
function drawShrineTile(col,row,t,x,y,s) {
  if (t < T.SHRINE_WALL || t > T.SHRINE_PRISM) return false;
  ctx.save(); ctx.lineWidth=Math.max(1,s*.055); ctx.strokeStyle='rgba(15,12,28,.75)';
  if (t===T.SHRINE_FLOOR) {
    ctx.strokeStyle='rgba(220,210,255,.14)'; ctx.strokeRect(x+s*.08,y+s*.08,s*.84,s*.84);
  } else if (t===T.SHRINE_WALL) {
    ctx.fillStyle='#34314b'; ctx.fillRect(x,y+s*.1,s,s*.8);
    ctx.strokeStyle='#6d678f'; ctx.strokeRect(x+s*.05,y+s*.1,s*.9,s*.8);
  } else if (t===T.SHRINE_DOOR) {
    ctx.fillStyle='#302344'; ctx.fillRect(x+s*.18,y+s*.12,s*.64,s*.88);
    ctx.strokeStyle='#b693e2'; ctx.strokeRect(x+s*.2,y+s*.14,s*.6,s*.84);
    ctx.beginPath();ctx.arc(x+s*.5,y+s*.48,s*.18,0,Math.PI*2);ctx.stroke();
  } else if (t===T.SHRINE_EXIT) {
    ctx.fillStyle='#183c3a';ctx.fillRect(x+s*.2,y+s*.08,s*.6,s*.84);
    ctx.strokeStyle='#79ead6';ctx.strokeRect(x+s*.2,y+s*.08,s*.6,s*.84);
  } else if (t===T.SHRINE_GATE) {
    ctx.strokeStyle='#b8a7d4'; for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(x+s*i/5,y);ctx.lineTo(x+s*i/5,y+s);ctx.stroke();}
  } else if (t===T.SHRINE_REWARD) {
    const q=currentMap()&&currentMap().type==='shrine'?shrineQuest(currentMap().regionIdx):null,claimed=q&&q.rewardClaimed;
    ctx.fillStyle=claimed?'#4c443e':'#7b421c';ctx.fillRect(x+s*.12,y+s*.38,s*.76,s*.48);
    ctx.fillStyle=claimed?'#82796d':'#efc34e';ctx.fillRect(x+s*.1,y+s*.36,s*.8,s*.13);ctx.fillRect(x+s*.45,y+s*.4,s*.1,s*.3);
  } else if (t===T.SHRINE_PLATE) {
    ctx.fillStyle='#b9a17b';ctx.beginPath();ctx.ellipse(x+s*.5,y+s*.62,s*.34,s*.2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  } else if (t===T.SHRINE_SWITCH||t===T.SHRINE_TOGGLE||t===T.SHRINE_SHIFT) {
    const st=currentMap()&&currentMap().shrineState;let active=false;
    if(st&&t===T.SHRINE_SWITCH) active=(currentMap().regionIdx===0?st.timers.switch>0:!!st.flags.circuit);
    if(st&&t===T.SHRINE_TOGGLE) active=row<75?!!st.flags.toggleA:!!st.flags.toggleB;
    ctx.fillStyle=t===T.SHRINE_SHIFT?'#b27fe4':active?'#d9fbff':'#74c7df';ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.23,0,Math.PI*2);ctx.fill();ctx.stroke();
  } else if (t===T.SHRINE_RESET) {
    ctx.fillStyle='#6a517f';ctx.fillRect(x+s*.22,y+s*.3,s*.56,s*.6);ctx.fillStyle='#e2c9ff';ctx.font=`${s*.5}px serif`;ctx.fillText('↺',x+s*.27,y+s*.72);
  } else if (t===T.SHRINE_BRAZIER) {
    const st=currentMap()&&currentMap().shrineState,lit=st&&!!st.flags[shrineKey(col,row)];ctx.fillStyle='#5a3525';ctx.fillRect(x+s*.25,y+s*.58,s*.5,s*.3);ctx.fillStyle=lit?'#fff07a':'#ff9a2f';ctx.beginPath();ctx.moveTo(x+s*.5,y+s*.12);ctx.lineTo(x+s*.72,y+s*.62);ctx.lineTo(x+s*.28,y+s*.62);ctx.fill();
  } else if (t===T.SHRINE_VALVE) {
    const st=currentMap()&&currentMap().shrineState,on=st&&(row<75?st.flags.valveA:st.flags.valveB);ctx.strokeStyle=on?'#baffdf':'#d6dbd5';ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.28,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*.25,y+s*.5);ctx.lineTo(x+s*.75,y+s*.5);ctx.moveTo(x+s*.5,y+s*.25);ctx.lineTo(x+s*.5,y+s*.75);ctx.stroke();
  } else if (t===T.SHRINE_MIRROR) {
    const st=currentMap()&&currentMap().shrineState,o=st?(st.mirrors[shrineKey(col,row)]||0):0;ctx.translate(x+s*.5,y+s*.5);ctx.rotate(o*Math.PI/2);ctx.strokeStyle='#edffff';ctx.lineWidth=s*.14;ctx.beginPath();ctx.moveTo(-s*.3,s*.3);ctx.lineTo(s*.3,-s*.3);ctx.stroke();
  } else if (t===T.SHRINE_PUZZLE_RUNE) {
    const st=currentMap()&&currentMap().shrineState,ri=st&&st.runeCells?st.runeCells.findIndex(p=>p[0]===col&&p[1]===row):-1;ctx.fillStyle='#d9a8ff';ctx.font=`bold ${s*.52}px serif`;ctx.fillText(String(ri+1),x+s*.34,y+s*.69);
  } else if (t===T.SHRINE_WIND) {
    ctx.strokeStyle='#eefcff';ctx.beginPath();ctx.arc(x+s*.45,y+s*.5,s*.3,-1.3,1.8);ctx.stroke();
  } else if (t===T.SHRINE_CONDUIT) {
    ctx.strokeStyle='#9dcfff';ctx.beginPath();ctx.moveTo(x,y+s*.5);ctx.lineTo(x+s,y+s*.5);ctx.stroke();
  } else if (t===T.SHRINE_PRISM) {
    ctx.fillStyle='#eadbff';ctx.beginPath();ctx.moveTo(x+s*.5,y+s*.15);ctx.lineTo(x+s*.82,y+s*.8);ctx.lineTo(x+s*.18,y+s*.8);ctx.fill();ctx.stroke();
  }
  ctx.restore(); return true;
}

function drawShrineOverlays(ts) {
  const cm=currentMap(); if(!cm||cm.type!=='shrine'||!cm.shrineState)return;
  const s=cm.shrineState;
  for(const b of s.blocks){const p=screenPX(b.x,b.y),x=p.x-ts/2,y=p.y-ts/2;ctx.fillStyle=b.kind==='ice'?'#bdeaff':b.kind==='boulder'?'#71685d':'#87745d';ctx.fillRect(x+ts*.12,y+ts*.12,ts*.76,ts*.76);ctx.strokeStyle='#211c27';ctx.strokeRect(x+ts*.12,y+ts*.12,ts*.76,ts*.76);}
  if(cm.regionIdx===8){ctx.save();ctx.strokeStyle='rgba(255,239,137,.8)';ctx.lineWidth=Math.max(2,ts*.07);const beam=(a,b)=>{const p=screenPX(a[0],a[1]),q=screenPX(b[0],b[1]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();};beam([55,75],[68,75]);beam([68,75],[75,68]);beam([68,75],[75,82]);ctx.restore();}
  if(cm.regionIdx===9&&s.darknessActive){const f=Math.max(0,Math.min(1,1-s.timers.light/12000)),top=screenPX(58,60),bot=screenPX(88,90),h=(bot.y-top.y+ts)*.48*f;ctx.fillStyle='rgba(5,2,13,.82)';ctx.fillRect(top.x-ts/2,top.y-ts/2,bot.x-top.x+ts,h);ctx.fillRect(top.x-ts/2,bot.y+ts/2-h,bot.x-top.x+ts,h);}
  if(cm.regionIdx===10){const alphaA=Math.min(.55,s.timers.gasA/6000),alphaB=Math.min(.55,s.timers.gasB/6000);for(const z of [[78,68,87,73,alphaA],[78,77,87,82,alphaB]]){const a=screenPX(z[0],z[1]),b=screenPX(z[2],z[3]);ctx.fillStyle=`rgba(107,170,65,${z[4]})`;ctx.fillRect(a.x-ts/2,a.y-ts/2,b.x-a.x+ts,b.y-a.y+ts);}}
  if(cm.regionIdx===1||cm.regionIdx===11){ctx.save();ctx.textAlign='center';ctx.font=`bold ${Math.max(14,ts*.32)}px sans-serif`;ctx.fillStyle='#fff0b0';const label=cm.regionIdx===1?'Flame order: I · III · II · IV':'Rune memory: '+s.sequence.map(n=>n+1).join(' · ');ctx.fillText(label,canvas.width/2,Math.max(24,ts*.65));ctx.restore();}
  if(cm.regionIdx===7){ctx.save();ctx.strokeStyle=blockOn(s,68,75)&&s.flags.circuit?'#e6fbff':'rgba(100,130,170,.35)';ctx.lineWidth=Math.max(2,ts*.08);const a=screenPX(68,75),b=screenPX(78,75),c=screenPX(78,68);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.stroke();ctx.restore();}
  if(cm.regionIdx===12){ctx.fillStyle=s.layer==='dark'?'rgba(24,10,43,.26)':'rgba(239,229,255,.08)';ctx.fillRect(0,0,canvas.width,canvas.height);const walls=s.layer==='dark'?s.darkWalls:s.lightWalls;ctx.fillStyle=s.layer==='dark'?'#191024':'#bbb1d0';for(const p of walls){const q=screenPX(p[0],p[1]);ctx.fillRect(q.x-ts/2,q.y-ts/2,ts,ts);}}
}
