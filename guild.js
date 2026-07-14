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

  // Not started — offer it and spawn the quarry.
  if (!q) {
    const bossMapId = startGuildQuest(regionIdx);
    const where = (bossMapId != null && worldMaps[bossMapId] && worldMaps[bossMapId].name)
      ? worldMaps[bossMapId].name : 'the mid-reaches of this land';
    const msg = `⚔️ Guild Recruiter: "The Sword & Shield Guild wants steel like yours. A monstrous ${creatureName} has denned at ${where} — slay it, take its head, and you're one of us."`;
    if (typeof showMapMsg === 'function') showMapMsg(msg);
    else if (typeof showMsg === 'function') showMsg(msg, 5000);
    return;
  }

  // Quarry still alive — remind where.
  if (q.status === 'active') {
    const where = (q.bossMapId != null && worldMaps[q.bossMapId] && worldMaps[q.bossMapId].name)
      ? worldMaps[q.bossMapId].name : 'this region';
    if (typeof showMsg === 'function')
      showMsg(`💬 Guild Recruiter: "The ${creatureName} still lives, out at ${where}. Bring me its head."`, 4000);
    return;
  }

  // Head in hand — the recruiter collects it and inducts / rewards the hero.
  if (q.status === 'head') {
    q.status = 'done';
    if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
    let msg;
    if (!player.guildCard) {
      // First induction: hand over the Sword & Shield Guild membership card.
      player.guildCard = true;
      msg = `⚔️ Guild Recruiter: "The head of the ${creatureName}! You've proven your steel — welcome to the Sword & Shield Guild. Here is your guild card, member." 🎟️ Received the Sword & Shield Guild Card!`;
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
      msg = `⚔️ Guild Recruiter: "The head of the ${creatureName} — fine work, member. The Guild rewards its own." ` + rewards.join(' ');
    }
    if (typeof updateHUD === 'function') updateHUD();
    if (typeof showMapMsg === 'function') showMapMsg(msg);
    else if (typeof showMsg === 'function') showMsg(msg, 6000);
    return;
  }

  // ── Inducted member (q.status === 'done'): the artifact commission ──────────
  const as = q.artifactStatus;

  // Not yet offered — hand over the second commission and break the dungeon seal.
  if (!as) {
    q.artifactStatus = 'active';
    const msg = `⚔️ Guild Recruiter: "One last charge for the Guild, member. A rare and mysterious artifact lies sealed within this land's ruined dungeon — the Guild's writ breaks the ancient seal. Bring it back to me." 🔓 The ruined dungeon's seal is broken!`;
    if (typeof showMapMsg === 'function') showMapMsg(msg);
    else if (typeof showMsg === 'function') showMsg(msg, 6000);
    return;
  }

  // Commission taken, artifact not yet in hand — remind where.
  if (as === 'active') {
    if (typeof showMsg === 'function')
      showMsg(`💬 Guild Recruiter: "The mysterious artifact still lies in the deepest chest of this land's ruined dungeon. Bring it to me, member."`, 4000);
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
    const msg = `⚔️ Guild Recruiter: "The artifact — at last! The Guild is in your debt, member. Take this for your trouble." ` + rewards.join(' ');
    if (typeof showMapMsg === 'function') showMapMsg(msg);
    else if (typeof showMsg === 'function') showMsg(msg, 6000);
    return;
  }

  // Artifact commission fully done — greet a member.
  if (typeof showMsg === 'function')
    showMsg(`💬 Guild Recruiter: "Well met, guild member. Steel and shield stand with you."`, 3500);
}
