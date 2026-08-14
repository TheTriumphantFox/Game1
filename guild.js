// ─── Sword & Shield Guild quest chain ───────────────────────────────────────
// A per-region recruiter — a villager who WANDERS the region's cleared village —
// inducts the hero into the Sword & Shield Guild. Talk to them to take the
// commission: a lone Guild Quarry (a boss-flagged elite of the region's toughest
// creature) appears on one of the region's mid-depth [10–15] overworld maps.
// Slay it, claim its head, and bring the head back to be made a Guild member.
//
// Every region has its own recruiter, but region N's stays hidden until region
// N-1's recruiter has inducted you — a sequential chain across the world.
//
// Quest state lives on player.guildQuests[regionId] = { status, creature, bossMapId }
// with status 'active' (quarry spawned) → 'head' (head claimed) → 'done' (inducted).
// The head token advances the quest on the kill itself (see killEnemy), so leaving
// the map before grabbing the floor drop can never soft-lock it.

// The region's Guild Quarry creature = the toughest (last) entry of its enemy pool.
// Its head is the quest token, named for the creature.
function guildCreatureFor(regionIdx) {
  const region = REGIONS[regionIdx];
  if (!region) return null;
  const pool = ENEMY_POOLS[Math.min(region.enemyTier, ENEMY_POOLS.length - 1)];
  return pool && pool.length ? pool[pool.length - 1] : null;
}
function guildCreatureName(regionIdx) {
  const c = guildCreatureFor(regionIdx);
  return (c && DND_ENEMIES[c]) ? DND_ENEMIES[c].name : 'Beast';
}

// Is region N's recruiter unlocked? Region 0 always; every later region only once
// the previous region's guild quest is fully 'done'.
function guildRecruiterUnlocked(regionIdx) {
  if (regionIdx <= 0) return true;
  const prev = REGIONS[regionIdx - 1];
  const pq = (prev && player.guildQuests) ? player.guildQuests[prev.id] : null;
  return !!(pq && pq.status === 'done');
}

// Add the wandering recruiter to an activated village if this region's slot in the
// chain is unlocked and one isn't already present. Mirrors ensurePortalKeeper —
// called from spawnVillagersForMap on every village entry, so a recruiter that
// unlocks later (after the previous region's quest is finished) still turns up on
// the next visit.
function ensureGuildRecruiter(mapObj) {
  if (!mapObj || mapObj.type !== 'village' || !mapObj.activated) return;
  if (typeof villagers === 'undefined') return;
  const regionIdx = (typeof mapObj.regionIdx === 'number')
    ? mapObj.regionIdx
    : REGIONS.findIndex(r => r.id === mapObj.biome);
  if (regionIdx < 0) return;
  if (!guildRecruiterUnlocked(regionIdx)) return;
  if (villagers.some(v => v.role === 'guild')) return;
  const m = mapObj.map;
  // Start them on an open plaza tile a few steps out from the fountain, then let
  // the normal wander AI carry them around the streets.
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  const cands = [
    { x: midC,     y: midR + 8 }, { x: midC - 2, y: midR + 8 }, { x: midC + 2, y: midR + 8 },
    { x: midC - 8, y: midR     }, { x: midC + 8, y: midR     }, { x: midC,     y: midR - 8 },
  ];
  let spot = null;
  for (const s of cands) {
    if (s.x < 0 || s.y < 0 || s.x >= MCOLS || s.y >= MROWS) continue;
    if (isSolid(m, s.x, s.y)) continue;
    if (isVillagerOffLimits(m[s.y][s.x])) continue;
    if (villagers.some(v => v.x === s.x && v.y === s.y)) continue;
    spot = s; break;
  }
  if (!spot) spot = { x: midC, y: midR + 8 };
  const nextId = villagers.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  villagers.push({
    id: nextId,
    kind: 'Guild Recruiter', role: 'guild',
    robe: '#39506e', hair: '#4a3020', skin: '#e0c098',
    size: 1,
    x: spot.x, y: spot.y, renderX: spot.x, renderY: spot.y,
    dir: [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }][Math.floor(Math.random() * 4)],
    // Wanders (not stationary) — staggered timer like the crowd wanderers.
    timer: Math.random() * 600, stepMs: 600 + Math.random() * 400,
  });
}

// Build a live Guild Quarry enemy (kept at its base creature's stats & drops, just
// flagged as a boss + `guildBoss` and grown a touch for presence). Matches the
// enemy shape produced by spawnEnemiesForMap so it can be pushed straight into a
// map's savedEnemies.
function makeGuildBossEnemy(creature, x, y, regionId, id) {
  const base = DND_ENEMIES[creature] || DND_ENEMIES.goblin;
  // A proper mini-boss: 3× the base creature's HP and hits 40% harder.
  const hp = Math.round(base.hp * 3);
  return {
    id: id != null ? id : 9000,
    type: creature, x, y, hp, maxHp: hp,
    spd: base.spd, dmg: Math.round(base.dmg * 1.4), xp: Math.floor(base.xp * 0.5),
    color: base.color, size: (base.size || 1) * 1.3,
    name: `${base.name}, Guild Quarry`,
    ranged: base.ranged || false, swims: base.swims || false,
    boss: true, guildBoss: true, guildRegion: regionId,
    tier15: false, element: base.element || null,
    timer: Math.random() * base.spd, dead: false,
    shootTimer: Math.random() * 1500 + 500
  };
}

// Drop the Guild Quarry onto a mid-depth map: find an open tile near its centre
// and inject the boss into that map's saved enemy state (or its defs, for the rare
// never-visited map). Idempotent — never stacks a second quarry on the same map.
function spawnGuildBossOnMap(mapObj, creature, regionId) {
  const base = DND_ENEMIES[creature];
  if (!base) return;
  const m = mapObj.map;
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  let sx = cx, sy = cy, found = false;
  for (let radius = 0; radius <= 50 && !found; radius++) {
    for (let dy = -radius; dy <= radius && !found; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 2 || y < 2 || x >= MCOLS - 2 || y >= MROWS - 2) continue;
        if (m && isSolid(m, x, y)) continue;
        sx = x; sy = y; found = true; break;
      }
    }
  }
  if (Array.isArray(mapObj.savedEnemies)) {
    if (mapObj.savedEnemies.some(e => e.guildBoss)) return;
    const maxId = mapObj.savedEnemies.reduce((mx, e) => Math.max(mx, e.id || 0), -1);
    mapObj.savedEnemies.push(makeGuildBossEnemy(creature, sx, sy, regionId, maxId + 1));
  } else {
    mapObj.enemyDefs = mapObj.enemyDefs || [];
    if (mapObj.enemyDefs.some(d => d.guild)) return;
    mapObj.enemyDefs.push({ type: creature, x: sx, y: sy, guild: regionId });
  }
}

// Start a region's guild quest: pick one of its mid-depth [10–15] overworld maps,
// spawn the Guild Quarry there, and record the quest. Returns the chosen map id
// (or null if — vanishingly unlikely — no mid-depth map exists yet).
function startGuildQuest(regionIdx) {
  const region = REGIONS[regionIdx];
  if (!region) return null;
  const creature = guildCreatureFor(regionIdx);
  if (!creature) return null;
  const cands = worldMaps.filter(mm => mm && !mm.sealed && mm.type === region.id &&
    typeof mm.depth === 'number' && mm.depth >= 10 && mm.depth <= 15);
  let bossMapId = null;
  if (cands.length) {
    const target = cands[Math.floor(Math.random() * cands.length)];
    spawnGuildBossOnMap(target, creature, region.id);
    bossMapId = target.id;
  }
  player.guildQuests = player.guildQuests || {};
  player.guildQuests[region.id] = { status: 'active', creature, bossMapId };
  return bossMapId;
}

// How many regions the hero has been inducted through (guild "rank").
function guildRank() {
  if (!player.guildQuests) return 0;
  return Object.values(player.guildQuests).filter(q => q && q.status === 'done').length;
}

// ─── Second commission: the sealed-dungeon artifact ──────────────────────────
// Once inducted (head quest 'done'), the recruiter offers a second commission per
// region: retrieve the region's mysterious artifact from its ruined dungeon. That
// dungeon is sealed from the start of the game — its DUNGEON_DOOR can't be entered
// — until this quest is taken, which breaks the ancient seal for good.
//
// The artifact sub-quest lives on the SAME quest record as a separate field,
// player.guildQuests[regionId].artifactStatus:
//   (unset)    — not yet offered (dungeon sealed)
//   'active'   — commission taken, dungeon unsealed, artifact waiting in its chest
//   'held'     — artifact claimed from the chest, not yet handed in
//   'done'     — artifact returned and rewarded
// Keeping it off `status` leaves the head-quest chain (guildRecruiterUnlocked, which
// keys the next region off status==='done') completely untouched.

// Is region N's ruined dungeon still sealed? Sealed until its artifact commission
// has been taken (any artifactStatus at all); thereafter it stays open forever.
function guildDungeonSealed(regionIdx) {
  const region = REGIONS[regionIdx];
  if (!region) return false;
  const q = player.guildQuests ? player.guildQuests[region.id] : null;
  return !(q && q.artifactStatus);
}

// Talk to a Guild Recruiter. Drives the state machine: offer/start → remind while
// the quarry lives → induct once its head is in hand → thereafter greet a member.
function talkGuildRecruiter(v) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const regionIdx = cm ? cm.regionIdx : null;
  const region = (typeof regionIdx === 'number') ? REGIONS[regionIdx] : null;
  if (!region) return;
  const rid = region.id;
  const creatureName = guildCreatureName(regionIdx);
  player.guildQuests = player.guildQuests || {};
  const q = player.guildQuests[rid];

  // The recruiter is an NPC standing in front of the player, so every line below
  // goes through the dialogue box and waits for a keypress rather than flashing
  // past as a toast — these lines carry quest directions the player needs. Reward
  // hauls still toast, fired from the dialogue's onDone so they land after the
  // speech instead of inside it.
  const say = (text, then) => { if (typeof sayNPC === 'function') sayNPC('Guild Recruiter', text, then); };

  // Not started — offer it and spawn the quarry.
  if (!q) {
    const bossMapId = startGuildQuest(regionIdx);
    const where = (bossMapId != null && worldMaps[bossMapId] && worldMaps[bossMapId].name)
      ? worldMaps[bossMapId].name : 'the mid-reaches of this land';
    say(`The Sword & Shield Guild wants steel like yours. A monstrous ${creatureName} has denned at ${where}. Slay it, take its head, and you're one of us.`);
    return;
  }

  // Quarry still alive — remind where.
  if (q.status === 'active') {
    const where = (q.bossMapId != null && worldMaps[q.bossMapId] && worldMaps[q.bossMapId].name)
      ? worldMaps[q.bossMapId].name : 'this region';
    say(`The ${creatureName} still lives, out at ${where}. Bring me its head.`);
    return;
  }

  // Head in hand — the recruiter collects it and inducts / rewards the hero.
  if (q.status === 'head') {
    q.status = 'done';
    if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
    let line, haul;
    if (!player.guildCard) {
      // First induction: hand over the Sword & Shield Guild membership card.
      player.guildCard = true;
      line = `The head of the ${creatureName}! You've proven your steel. Welcome to the Sword & Shield Guild. Here is your guild card, member.`;
      haul = `🎟️ Received the Sword & Shield Guild Card!`;
    } else {
      // Already a member — a material bounty: 2 region Health Potions, 2 region
      // element-resistance Elixirs (only where the region has an element), and
      // 100 × region level rubies.
      const rewards = [];
      if (typeof grantRegionPotions === 'function') rewards.push(grantRegionPotions(rid, 2));
      if (typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[rid] && typeof grantRegionElixirs === 'function')
        rewards.push(grantRegionElixirs(rid, 2));
      if (typeof addItem === 'function' && typeof regionNumberOf === 'function') {
        const rubyGot = addItem('rubies', 100 * regionNumberOf(rid));
        rewards.push(`💎 ${rubyGot} Rubies!`);
      }
      line = `The head of the ${creatureName}. Fine work, member. The Guild rewards its own.`;
      haul = rewards.join(' ');
    }
    if (typeof updateHUD === 'function') updateHUD();
    say(line, () => { if (typeof showMapMsg === 'function') showMapMsg(haul); });
    return;
  }

  // ── Inducted member (q.status === 'done'): the artifact commission ──────────
  const as = q.artifactStatus;

  // Not yet offered — hand over the second commission and break the dungeon seal.
  if (!as) {
    q.artifactStatus = 'active';
    say(`One last charge for the Guild, member. A rare and mysterious artifact lies sealed within this land's ruined dungeon, and the Guild's writ breaks the ancient seal. Bring it back to me.`,
        () => { if (typeof showMapMsg === 'function') showMapMsg(`🔓 The ruined dungeon's seal is broken!`); });
    return;
  }

  // Commission taken, artifact not yet in hand — remind where.
  if (as === 'active') {
    say(`The mysterious artifact still lies in the deepest chest of this land's ruined dungeon. Bring it to me, member.`);
    return;
  }

  // Artifact in hand — the recruiter takes it and pays the bounty.
  if (as === 'held') {
    q.artifactStatus = 'done';
    if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
    // Bounty: 200 × region level rubies, 2d4 region Health Potions, 2d4 region ore.
    const d4 = () => 1 + Math.floor(Math.random() * 4);
    const rewards = [];
    if (typeof addItem === 'function' && typeof regionNumberOf === 'function') {
      const rubyGot = addItem('rubies', 200 * regionNumberOf(rid));
      rewards.push(`💎 ${rubyGot} Rubies!`);
    }
    if (typeof grantRegionPotions === 'function') rewards.push(grantRegionPotions(rid, d4() + d4()));
    if (typeof oreForRegionIdx === 'function' && typeof addItem === 'function') {
      const ore = oreForRegionIdx(regionIdx);
      if (ore) {
        const oreGot = addItem(ore.id, d4() + d4());
        rewards.push(`✦ ${oreGot} ${ore.icon} ${ore.label} ore!`);
      }
    }
    if (typeof updateHUD === 'function') updateHUD();
    const haul = rewards.join(' ');
    say(`The artifact, at last! The Guild is in your debt, member. Take this for your trouble.`,
        () => { if (typeof showMapMsg === 'function') showMapMsg(haul); });
    return;
  }

  // Artifact commission fully done — the recruiter offers the repeatable-once
  // bounties (#4/5/6). These never touch guildRecruiterUnlocked.
  talkGuildBounties(rid, regionIdx);
}

// ─── Guild bounties (#4 Bounty Board, #5 Man-Eater, #6 Culling the Nest) ──────
// Offered by the recruiter once a region's artifact quest is done. Three one-time
// bounties, handed out and turned in one at a time in this order. State lives on
// player.guildQuests[rid].bounties = { board, maneater, culling }, each with its
// own status ('active' → 'ready' → 'done'), leaving the head-quest chain untouched.
const GUILD_BOUNTY_ORDER = ['board', 'maneater', 'culling'];
const GUILD_CULL_NEED = 10;   // creatures to cull on a single hunt (#6)

// A live elite for a board/maneater bounty — kept at its base stats + drops, flagged
// with `bounty` (distinct from guildBoss) so killEnemy advances the right bounty and
// never the head quest. Man-Eaters are bigger and far tougher.
function makeBountyEnemy(creature, x, y, regionId, kind, id) {
  const base = DND_ENEMIES[creature] || DND_ENEMIES.goblin;
  const hpMul  = kind === 'maneater' ? 5 : 3;
  const dmgMul = kind === 'maneater' ? 1.7 : 1.4;
  const hp = Math.round(base.hp * hpMul);
  const title = kind === 'maneater' ? 'the Man-Eater' : 'Guild Bounty';
  return {
    id: id != null ? id : 9500,
    type: creature, x, y, hp, maxHp: hp,
    spd: base.spd, dmg: Math.round(base.dmg * dmgMul), xp: Math.floor(base.xp * 0.75),
    color: base.color, size: (base.size || 1) * (kind === 'maneater' ? 1.45 : 1.3),
    name: `${base.name}, ${title}`,
    ranged: base.ranged || false, swims: base.swims || false,
    boss: true, bounty: kind, bountyRegion: regionId,
    tier15: false, element: base.element || null,
    timer: Math.random() * base.spd, dead: false,
    shootTimer: Math.random() * 1500 + 500
  };
}

// A region's non-sealed, on-grid overworld maps — candidates for bounty spawns.
function regionOverworldMaps(regionId) {
  return worldMaps.filter(mm => mm && !mm.sealed && mm.type === regionId &&
    typeof mm.depth === 'number' && worldGrid[gridKey(mm.gx, mm.gy)] === mm.id);
}

// First open tile spiralling out from a map's centre (mirrors spawnGuildBossOnMap).
function findOpenTileNearCentre(m) {
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  for (let radius = 0; radius <= 50; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 2 || y < 2 || x >= MCOLS - 2 || y >= MROWS - 2) continue;
        if (m && isSolid(m, x, y)) continue;
        return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

// Inject a bounty elite onto a map (its live savedEnemies, or its defs for a
// never-visited map). Never stacks two of the same bounty kind on one map.
function spawnBountyOnMap(mapObj, creature, regionId, kind) {
  if (!mapObj) return;
  const spot = findOpenTileNearCentre(mapObj.map);
  if (Array.isArray(mapObj.savedEnemies)) {
    if (mapObj.savedEnemies.some(e => e.bounty === kind && !e.dead)) return;
    const maxId = mapObj.savedEnemies.reduce((mx, e) => Math.max(mx, e.id || 0), -1);
    mapObj.savedEnemies.push(makeBountyEnemy(creature, spot.x, spot.y, regionId, kind, maxId + 1));
  } else {
    mapObj.enemyDefs = mapObj.enemyDefs || [];
    if (mapObj.enemyDefs.some(d => d.bounty === kind)) return;
    mapObj.enemyDefs.push({ type: creature, x: spot.x, y: spot.y, bounty: kind, bountyRegion: regionId });
  }
}

// Start a bounty of `kind` for a region: cullings pick a target type + count; board
// and man-eater spawn an elite on a region map (recording where).
function startGuildBounty(regionIdx, rid, kind) {
  const region = REGIONS[regionIdx];
  const q = player.guildQuests[rid];
  q.bounties = q.bounties || {};
  const pool = (typeof ENEMY_POOLS !== 'undefined')
    ? (ENEMY_POOLS[Math.min(region.enemyTier, ENEMY_POOLS.length - 1)] || []) : [];
  if (kind === 'culling') {
    const type = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'goblin';
    q.bounties.culling = { status: 'active', type, need: GUILD_CULL_NEED, count: 0, mapId: null };
    return { type };
  }
  const creature = kind === 'maneater'
    ? guildCreatureFor(regionIdx)
    : (pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'goblin');
  const cands = regionOverworldMaps(rid);
  const visited = cands.filter(mm => mm.visited);
  const target = (visited.length ? visited : cands)[Math.floor(Math.random() * (visited.length ? visited.length : cands.length))];
  let mapId = null;
  if (target) { spawnBountyOnMap(target, creature, rid, kind); mapId = target.id; }
  q.bounties[kind] = { status: 'active', creature, mapId };
  return { creature, mapId };
}

// ─── Restocking the Guild's elites onto a regenerated map ────────────────────
// Every map outside the villages and the castle tower forgets its roster the
// moment the hero walks out and rebuilds it from `enemyDefs` on the way back in
// (see mapRemembersEnemies, enemies.js). The Guild Quarry and the Bounty Board
// elite are not in `enemyDefs` — both are injected after the map was generated,
// and on a visited map they were only ever held in `savedEnemies`, which is now
// thrown away. Left alone, a hero who stepped off the quarry's map before killing
// it would find the map empty forever and the quest unfinishable.
//
// So they are respawned from the thing that IS durable: the quest record on
// `player.guildQuests`, which already carries the creature and the map it was
// assigned to and already round-trips through save/load. Called from
// spawnEnemiesForMap once `enemies` is populated, and idempotent — a map whose
// defs already produced the elite (the never-visited path in spawnGuildBossOnMap /
// spawnBountyOnMap) is left alone.
function ensureGuildElitesOnMap(rm) {
  if (!rm || !rm.map) return;
  if (typeof player === 'undefined' || !player.guildQuests) return;
  const push = (make) => {
    const spot = findOpenTileNearCentre(rm.map);
    const maxId = enemies.reduce((mx, e) => Math.max(mx, e.id || 0), -1);
    enemies.push(make(spot, maxId + 1));
  };
  for (const rid of Object.keys(player.guildQuests)) {
    const q = player.guildQuests[rid];
    if (!q) continue;
    // The head quest's Guild Quarry, while its head is still on its shoulders.
    if (q.status === 'active' && q.creature && q.bossMapId === rm.id &&
        !enemies.some(e => e.guildBoss && !e.dead)) {
      push((spot, id) => makeGuildBossEnemy(q.creature, spot.x, spot.y, rid, id));
    }
    // Bounty #4's Board elite, which stays put on the map it was set on. #5 the
    // Man-Eater moves and has its own restocker below; #6 the Culling is a kill
    // count against the ordinary roster and needs nothing here.
    const b = (q.bounties && q.bounties.board) ? q.bounties.board : null;
    if (b && b.status === 'active' && b.creature && b.mapId === rm.id &&
        !enemies.some(e => e.bounty === 'board' && !e.dead)) {
      push((spot, id) => makeBountyEnemy(b.creature, spot.x, spot.y, rid, 'board', id));
    }
  }
}

// The Man-Eater relocates to whatever region overworld map the hero enters while it
// still lives (called from spawnEnemiesForMap after `enemies` is populated).
function ensureManeaterOnMap(rm) {
  if (!rm || !rm.map || rm.type === 'village') return;
  if (typeof player === 'undefined' || !player.guildQuests || typeof REGIONS === 'undefined') return;
  const regionIdx = (typeof rm.regionIdx === 'number') ? rm.regionIdx : REGIONS.findIndex(r => r.id === rm.biome);
  if (regionIdx < 0 || !REGIONS[regionIdx]) return;
  const rid = REGIONS[regionIdx].id;
  if (rm.type !== rid) return;                             // this region's own overworld
  if (worldGrid[gridKey(rm.gx, rm.gy)] !== rm.id) return;  // on-grid only
  const q = player.guildQuests[rid];
  const b = (q && q.bounties) ? q.bounties.maneater : null;
  if (!b || b.status !== 'active') return;
  // Presence first, den second. This used to return early on `b.mapId === rm.id`
  // ("already denned here"), which was true while a visited map kept its roster in
  // savedEnemies. A map that regenerates comes back WITHOUT the Man-Eater, so
  // re-entering its own den would have quietly left it empty.
  if (enemies.some(e => e.bounty === 'maneater' && !e.dead)) { b.mapId = rm.id; return; }
  const moved = b.mapId !== rm.id;
  // Pull any stale copy off the previous map — from its saved roster and from its
  // defs, since a never-visited target was given a def rather than a live entry.
  if (moved && b.mapId != null && worldMaps[b.mapId]) {
    const old = worldMaps[b.mapId];
    if (Array.isArray(old.savedEnemies)) old.savedEnemies = old.savedEnemies.filter(e => e.bounty !== 'maneater');
    if (Array.isArray(old.enemyDefs))    old.enemyDefs    = old.enemyDefs.filter(d => d.bounty !== 'maneater');
  }
  const spot = findOpenTileNearCentre(rm.map);
  const maxId = enemies.reduce((mx, e) => Math.max(mx, e.id || 0), -1);
  enemies.push(makeBountyEnemy(b.creature, spot.x, spot.y, rid, 'maneater', maxId + 1));
  // Only worth mirroring where a saved roster exists at all; a forgetful map's is
  // null and stays null until saveEnemyStateToMap decides otherwise.
  if (Array.isArray(rm.savedEnemies)) rm.savedEnemies = enemies.map(e => ({ ...e }));
  b.mapId = rm.id;
  if (moved && typeof showMapMsg === 'function') showMapMsg(`🩸 The Man-Eater has tracked you to ${rm.name || 'these lands'}!`);
}

// Advance the region's bounties on a kill. board/maneater elites flip to 'ready';
// culling counts matching kills on a single map (a kill on a new map resets it).
function guildBountyKill(e, cm) {
  if (!player.guildQuests || typeof REGIONS === 'undefined') return;
  const rid = (cm && typeof cm.regionIdx === 'number' && REGIONS[cm.regionIdx])
    ? REGIONS[cm.regionIdx].id : (cm ? cm.biome : null);
  if (!rid) return;
  const q = player.guildQuests[rid];
  if (!q || !q.bounties) return;
  const b = q.bounties;
  if (e.bounty === 'board' && b.board && b.board.status === 'active') b.board.status = 'ready';
  if (e.bounty === 'maneater' && b.maneater && b.maneater.status === 'active') b.maneater.status = 'ready';
  const cull = b.culling;
  if (cull && cull.status === 'active' && !e.bounty && e.type === cull.type) {
    if (cull.mapId !== currentMapId) { cull.mapId = currentMapId; cull.count = 0; }
    cull.count = (cull.count || 0) + 1;
    if (cull.count >= cull.need) {
      cull.status = 'ready';
      if (typeof showMsg === 'function') showMsg(`⚔️ Culling complete — ${cull.count}/${cull.need}! Report to the Guild.`, 3500);
    } else if (typeof showMsg === 'function') {
      showMsg(`⚔️ Culling bounty: ${cull.count}/${cull.need}`, 1200);
    }
  }
}

// The recruiter's bounty state machine: reward anything ready, else remind anything
// active, else offer the next un-started bounty, else greet a finished member.
function talkGuildBounties(rid, regionIdx) {
  const q = player.guildQuests[rid];
  q.bounties = q.bounties || {};
  const b = q.bounties;
  for (const kind of GUILD_BOUNTY_ORDER)
    if (b[kind] && b[kind].status === 'ready') { rewardGuildBounty(rid, regionIdx, kind); return; }
  for (const kind of GUILD_BOUNTY_ORDER)
    if (b[kind] && b[kind].status === 'active') { remindGuildBounty(rid, kind); return; }
  for (const kind of GUILD_BOUNTY_ORDER)
    if (!b[kind]) { offerGuildBounty(rid, regionIdx, kind); return; }
  sayRecruiter(`Every bounty cleared, member. The Guild has no equal in you.`);
}

// The recruiter speaking, in the dialogue box — same input-required treatment as
// talkGuildRecruiter's own lines. Shared by the three bounty handlers below.
function sayRecruiter(text, then) {
  if (typeof sayNPC === 'function') sayNPC('Guild Recruiter', text, then);
}

function offerGuildBounty(rid, regionIdx, kind) {
  const info = startGuildBounty(regionIdx, rid, kind);
  let msg;
  if (kind === 'culling') {
    const nm = (DND_ENEMIES[info.type]) ? DND_ENEMIES[info.type].name : 'beasts';
    msg = `Guild Bounty, Culling the Nest: slay ${GUILD_CULL_NEED} ${nm} on a single hunt (all on one map), member.`;
  } else {
    const where = (info.mapId != null && worldMaps[info.mapId] && worldMaps[info.mapId].name)
      ? worldMaps[info.mapId].name : 'this region';
    const cnm = (DND_ENEMIES[info.creature]) ? DND_ENEMIES[info.creature].name : 'beast';
    msg = kind === 'maneater'
      ? `Guild Bounty, the Man-Eater: a monstrous ${cnm} stalks ${where}. It flees the hunt from land to land. Run it down, member.`
      : `Guild Bounty, the Board: a fierce ${cnm} has been marked at ${where}. Bring it down.`;
  }
  sayRecruiter(msg);
}

function remindGuildBounty(rid, kind) {
  const b = player.guildQuests[rid].bounties[kind];
  let msg;
  if (kind === 'culling') {
    msg = `The culling isn't finished. ${b.count || 0}/${b.need} on one hunt.`;
  } else {
    const where = (b.mapId != null && worldMaps[b.mapId] && worldMaps[b.mapId].name)
      ? worldMaps[b.mapId].name : 'this region';
    msg = kind === 'maneater'
      ? `The Man-Eater still roams. Last tracked near ${where}.`
      : `Your bounty still lives, out at ${where}.`;
  }
  sayRecruiter(msg);
}

function rewardGuildBounty(rid, regionIdx, kind) {
  const b = player.guildQuests[rid].bounties[kind];
  b.status = 'done';
  if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
  const N = (typeof regionNumberOf === 'function') ? regionNumberOf(rid) : 1;
  const d4 = () => 1 + Math.floor(Math.random() * 4);
  const rewards = [];
  if (kind === 'board') {
    if (typeof addItem === 'function') rewards.push(`💎 ${addItem('rubies', 60 * N)} Rubies!`);
  } else if (kind === 'maneater') {
    if (typeof addItem === 'function') rewards.push(`💎 ${addItem('rubies', 120 * N)} Rubies!`);
    if (typeof grantRegionPotions === 'function') rewards.push(grantRegionPotions(rid, d4() + d4()));
  } else {
    if (typeof addItem === 'function') rewards.push(`💎 ${addItem('rubies', 40 * N)} Rubies!`);
    if (typeof grantRegionPotions === 'function') rewards.push(grantRegionPotions(rid, 3));
  }
  if (typeof updateHUD === 'function') updateHUD();
  const label = kind === 'maneater' ? 'the Man-Eater' : kind === 'board' ? 'the Board bounty' : 'the culling';
  const haul = rewards.join(' ');
  sayRecruiter(`You've done ${label}, member. The Guild pays its own.`,
               () => { if (typeof showMapMsg === 'function') showMapMsg(haul); });
}
