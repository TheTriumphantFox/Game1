// ─── Cabin portal: fast-travel destination select ───────────────────────────
// Stepping onto the PORTAL tile in the starter cabin opens this modal. The
// player picks the cabin or any discovered village; the game teleports there.
// `portalOpen` gates keyboard input in main.js so movement keys don't bleed
// through the modal.

let portalOpen = false;

// Rupees the Gatekeeper charges per trip through the gate.
const PORTAL_TOLL = 5;

function openPortalModal() {
  portalOpen = true;
  // Stop residual movement input so the player doesn't immediately walk off
  // the portal when the modal closes.
  if (typeof keys === 'object' && keys) {
    for (const k of Object.keys(keys)) keys[k] = false;
  }
  document.getElementById('portal-modal-overlay').classList.add('open');
  renderPortalContents();
}

function closePortalModal() {
  portalOpen = false;
  document.getElementById('portal-modal-overlay').classList.remove('open');
  // Brief cooldown so the next movement step doesn't immediately re-open
  // the portal we just stepped off of.
  if (typeof transitionCooldown !== 'undefined') transitionCooldown = 400;
}

// Build the destination list: the cabin (always available) + every region's
// village. DEV build — all villages are offered; choosing one force-clears it
// (building on demand if unreached) so it becomes an ACTIVE, monster-free
// village with a portal, consistent with the "portals only in cleared
// villages" rule. `_portalDests` caches the last rendered list so the row
// buttons can dispatch by index.
let _portalDests = [];

function portalDestinations() {
  const dests = [];
  // Cabin is map 0 in initWorld(); fall back to a type='house' lookup just
  // in case the convention ever changes.
  let cabinId = (worldMaps[0] && worldMaps[0].type === 'house') ? 0 : -1;
  if (cabinId === -1) {
    for (let i = 0; i < worldMaps.length; i++) {
      if (worldMaps[i] && worldMaps[i].type === 'house') { cabinId = i; break; }
    }
  }
  if (cabinId >= 0) {
    dests.push({ kind: 'house', mapId: cabinId, label: '🏠 ' + (worldMaps[cabinId].name || 'A Quiet Cabin') });
  }
  // One row per region village (dev: all of them). mapId resolves lazily on
  // travel; `activated` reflects whether it's already cleared in the world.
  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i];
    const existing = findRegionVillageId(i);
    dests.push({
      kind: 'village',
      regionIdx: i,
      mapId: existing,                                  // -1 until built
      label: '🏘️ ' + (region.villageName || ('Region ' + i)),
      activated: existing >= 0 && !!worldMaps[existing].activated,
    });
  }
  return dests;
}

function renderPortalContents() {
  _portalDests = portalDestinations();
  const curId = currentMapId;
  const rows = _portalDests.map((d, i) => {
    const here = d.mapId >= 0 && d.mapId === curId;
    let tag = '';
    if (here) tag = ' <span style="color:#88cc88">(here)</span>';
    else if (d.kind === 'village' && !d.activated) tag = ' <span style="color:#7788aa">(dev)</span>';
    return `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${d.label}${tag}</div>
        </div>
        <button class="ssbtn" ${here ? 'disabled' : ''} onclick="portalSelect(${i})">
          ✨ Travel
        </button>
      </div>
    `;
  }).join('');
  document.getElementById('portal-modal').innerHTML = `
    <h2>🌀 Portal Gate</h2>
    <div class="shop-greeting">The Gatekeeper minds the gate — ${PORTAL_TOLL} rupees per trip.</div>
    <div class="shop-rupees">You have: 💰 <b>${player.rupees}</b></div>
    ${rows}
    <button class="shop-close" onclick="closePortalModal()">✕ Cancel</button>
  `;
}

// Dispatch a destination row click. Village rows resolve to an ACTIVE village
// just-in-time (building + clearing on demand) so the dev list can reach every
// region.
function portalSelect(i) {
  const d = _portalDests[i];
  if (!d) return;
  // Can't cover the Gatekeeper's toll? Refuse before resolving/building the
  // destination (village rows would otherwise build a map on demand).
  if (d.mapId !== currentMapId && (player.rupees || 0) < PORTAL_TOLL) {
    if (typeof showMsg === 'function') {
      showMsg(`🌀 Gatekeeper: "The toll is ${PORTAL_TOLL} rupees — come back when you can pay."`, 2800);
    }
    return;
  }
  let mapId = d.mapId;
  if (d.kind === 'village') {
    mapId = (typeof getOrCreateActiveRegionVillage === 'function')
      ? getOrCreateActiveRegionVillage(d.regionIdx)
      : d.mapId;
  }
  if (mapId == null || mapId < 0) return;
  portalTravelTo(mapId);
}

// Teleport the player to `mapId`, placing them on a sensible landing tile so
// they don't re-trigger the portal or get stuck on a wall.
function portalTravelTo(mapId) {
  if (mapId === currentMapId) { closePortalModal(); return; }
  const target = worldMaps[mapId];
  if (!target) return;

  // Gatekeeper's toll — charged per trip through the gate. Leave the modal open
  // if the player can't pay so they can still cancel.
  if ((player.rupees || 0) < PORTAL_TOLL) {
    if (typeof showMsg === 'function') {
      showMsg(`🌀 Gatekeeper: "The toll is ${PORTAL_TOLL} rupees — come back when you can pay."`, 2800);
    }
    return;
  }
  player.rupees -= PORTAL_TOLL;
  if (typeof updateHUD === 'function') updateHUD();

  // Persist enemy/villager state on the source map before we leave it.
  if (typeof saveEnemyStateToMap   === 'function') saveEnemyStateToMap(currentMapId);
  if (typeof saveVillagersToMap    === 'function') saveVillagersToMap(currentMapId);

  currentMapId = mapId;
  const landing = portalLandingSpot(target);
  player.x = landing.x;
  player.y = landing.y;
  player.renderX = player.x;
  player.renderY = player.y;
  player.swordDir = { x: 0, y: 1 };

  target.visited = true;
  if (typeof spawnEnemiesForMap   === 'function') spawnEnemiesForMap(mapId);
  if (typeof spawnVillagersForMap === 'function') spawnVillagersForMap(mapId);
  if (typeof revealAround === 'function') revealAround(target, player.x, player.y, 12);
  if (typeof clampCam     === 'function') clampCam(true);
  if (typeof minimapDirty !== 'undefined') minimapDirty = true;

  closePortalModal();
  if (typeof showMapMsg === 'function') {
    showMapMsg('🌀 You step through the portal to ' + (target.name || 'a distant place') + '.');
  }
}

// Land the player one tile to the LEFT (west) of the destination map's portal,
// so they step out of the gate and onto solid floor. If the immediate-left
// tile is blocked, spiral outward from the portal for the nearest passable
// non-portal tile.
function portalLandingSpot(target) {
  // Locate the portal tile in the destination map.
  let pr = -1, pc = -1;
  for (let r = 0; r < MROWS && pr < 0; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (target.map[r][c] === T.PORTAL) { pr = r; pc = c; break; }
    }
  }

  if (pr >= 0) {
    // Preferred spot: one tile west of the portal.
    const lx = pc - 1, ly = pr;
    if (lx > 0 && !isSolid(target.map, lx, ly) && target.map[ly][lx] !== T.PORTAL) {
      return { x: lx, y: ly };
    }
    // Fallback: spiral outward from the portal for any open tile.
    for (let radius = 1; radius < 30; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = pc + dx, ny = pr + dy;
          if (nx <= 0 || nx >= MCOLS - 1 || ny <= 0 || ny >= MROWS - 1) continue;
          if (isSolid(target.map, nx, ny)) continue;
          if (target.map[ny][nx] === T.PORTAL) continue;
          return { x: nx, y: ny };
        }
      }
    }
  }

  // No portal found (shouldn't happen) — fall back to a sane default.
  if (target.type === 'house') {
    const HH = 16, HW = 21;
    const r1 = MROWS - 1 - HH;
    const c1 = Math.floor(MCOLS / 2) - Math.floor(HW / 2);
    return { x: c1 + 2, y: r1 + 4 };
  }
  return { x: Math.floor(MCOLS / 2), y: Math.floor(MROWS / 2) };
}

// Close on click outside the modal (matches shop modal behaviour).
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('portal-modal-overlay');
  if (el) el.addEventListener('click', e => { if (e.target === el) closePortalModal(); });
});
const _portalOverlay = document.getElementById('portal-modal-overlay');
if (_portalOverlay) {
  _portalOverlay.addEventListener('click', e => { if (e.target === _portalOverlay) closePortalModal(); });
}
