// ─── Final castle tower — runtime logic ───────────────────────────────────────
// Entry from the last village's castle gate, the pinnacle's victory payoff, and
// the victory overlay. Map generation lives in mapgen-tower.js; floor factory in
// world.js (createTowerFloorMap); stair transitions in player.js. Plain <script>
// globals (see index.html load order).

// True while the victory overlay is up — main.js pauses the world on it, like
// the other modals.
let victoryOpen = false;

// Walk out the final village's castle-gate exit → enter tower floor 1. The
// tower id memoizes into villageMap.caveLinks['tower'] (a string key like the
// cave links, so the existing save plumbing round-trips it for free) — leaving
// and re-entering returns to the same tower, with every cleared floor's state
// intact via savedEnemies.
function enterCastleTower(villageMap, dir) {
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);
  // Leaving the village strips its King's Hoard, same as any other exit.
  removeVillageBossChest(villageMap);

  villageMap.caveLinks = villageMap.caveLinks || {};
  let towerId = villageMap.caveLinks['tower'];
  if (towerId == null) {
    // Return landing: just inside the castle-side gate.
    const rx = dir === 'left' ? 1 : dir === 'right' ? MCOLS - 2 : EXIT_COL;
    const ry = dir === 'up'   ? 1 : dir === 'down'  ? MROWS - 2 : EXIT_ROW;
    towerId = createTowerFloorMap(villageMap.id, rx, ry, 1);
    villageMap.caveLinks['tower'] = towerId;
  }
  currentMapId = towerId;
  const land = worldMaps[towerId].entryLand;
  player.x = land.x; player.y = land.y;
  spawnEnemiesForMap(towerId);
  spawnVillagersForMap(towerId);
  transitionCooldown = 400;
  minimapDirty = true;
  clampCam(true);
  revealAround(currentMap(), player.x, player.y, 16);
  showMapMsg('🏰 The Final Castle — its tower climbs beyond sight. Floor 1/14.');
  // Auto-save on arrival at each tower floor (floor 1 here) so a death in the
  // deadly climb restores the hero to the floor it began on, not the cabin.
  if (typeof autoSave === 'function') autoSave('Castle Tower — Floor 1');
}

// The dragon's death raises a King's-Hoard-class chest on the throne dais and
// showers the hoard in rubies. Mirrors placeVillageBossChest, at the pinnacle's
// fixed dais coordinates (see buildTowerPinnacleMap).
function placeTowerHoardChest(cm) {
  if (!cm || cm.type !== 'castle_tower' || !cm.map) return;
  const m = cm.map;
  let bcr = 31, bcc = 74;                       // heart of the marble dais
  if (m[bcr][bcc] === T.BOSS_CHEST_TL) return;  // already raised
  // Chests are solid — nudge south a row if the hero stands right there.
  if (player.y >= bcr && player.y <= bcr + 1 && player.x >= bcc && player.x <= bcc + 1) bcr += 2;
  m[bcr    ][bcc    ] = T.BOSS_CHEST_TL;
  m[bcr    ][bcc + 1] = T.BOSS_CHEST_TR;
  m[bcr + 1][bcc    ] = T.BOSS_CHEST_BL;
  m[bcr + 1][bcc + 1] = T.BOSS_CHEST_BR;
  minimapDirty = true;
  // Ruby shower across the hoard — the dragon's fortune spills loose. Long
  // lifetime so nothing evaporates while the victory screen is up.
  let placed = 0, tries = 0;
  while (placed < 40 && tries < 400) {
    tries++;
    const r = rnd(38, 52), c = rnd(62, 86);
    if (m[r] && m[r][c] === T.HOARD) {
      drops.push({
        type: 'ruby', val: 20 + Math.floor(Math.random() * 30),
        x: c, y: r, life: 600000, bob: 0, collected: false
      });
      placed++;
    }
  }
  const sp = screenPX(bcc, bcr);
  spawnParticle(sp.x, sp.y, '#ffdd33', 28, 6);
  spawnParticle(sp.x, sp.y, '#ff6622', 20, 5);
}

// ─── Victory overlay ──────────────────────────────────────────────────────────
function showVictoryScreen() {
  victoryOpen = true;
  const el = document.getElementById('victory-stats');
  if (el) {
    const rows = [];
    if (player && player.level != null) rows.push(`⚔️ Hero Level <b>${player.level}</b>`);
    if (player && player.rubies != null) rows.push(`💎 <b>${player.rubies}</b> rubies amassed`);
    if (typeof mapsVisited !== 'undefined') rows.push(`🗺️ <b>${mapsVisited}</b> areas explored`);
    rows.push(`🏰 <b>${REGIONS.length}</b> elemental regions conquered`);
    rows.push(`🐉 The <b>Adult Red Dragon</b> lies slain`);
    el.innerHTML = rows.map(r => `<div class="victory-stat">${r}</div>`).join('');
  }
  const ov = document.getElementById('victory-overlay');
  if (ov) ov.classList.add('open');
}

function continueFromVictory() {
  victoryOpen = false;
  const ov = document.getElementById('victory-overlay');
  if (ov) ov.classList.remove('open');
  showMapMsg('👑 The realm is saved — its treasures are yours to claim.');
}
