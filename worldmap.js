// ─── World map page ───────────────────────────────────────────────────────────
// A full-screen, zoomable/pannable atlas opened from the radial MENU ring (the
// same launcher slot as the Character sheet, Drops ledger, and God Mode). It
// draws the overworld as a node graph laid out on the world's (gx, gy) grid: one
// tile per generated overworld map / village, connected to its neighbours by the
// walkable border gates that actually link them. This is the "how the maps
// connect" view — a bird's-eye of everywhere the hero has been and how it all
// joins up.
//
// Nodes are positioned straight from each map's grid coordinate (see world.js —
// worldGrid["gx,gy"] -> mapId), so a closed loop of maps reads as a loop here
// too. Off-grid areas (caves, dungeons, grottos, sky caves, castle-tower floors,
// dev villages) don't own a grid cell; instead they're tallied as a small badge
// on whichever overworld node they hang off (their root/return map).
//
// Colour follows region: each node is tinted with its region's ground colour, so
// the forest reads green, the desert sandy, the ice pale, and so on. The map the
// hero is standing on (or, when underground, the overworld map that cave returns
// to) is ringed and flagged "You are here".
//
// Pan by dragging; zoom with the wheel, the ＋ / － buttons, pinch, or double-tap.
// `worldMapOpen` gates gameplay input and freezes the world (see main.js),
// matching the shop / ledger / stats modal pattern. Pure 2-D canvas, no external
// libraries, so it runs on file:// like the rest of the game.

let worldMapOpen = false;

// View transform: screen_px = world_px * wmScale + (wmOx / wmOy). World px are
// laid out with WM_CELL between adjacent grid cells; a node box is WM_NODE wide.
let wmScale = 1;
let wmOx = 0, wmOy = 0;
const WM_CELL = 64;      // world px between neighbouring grid cells
const WM_NODE = 46;      // node box side, in world px
const WM_MIN_SCALE = 0.18;
const WM_MAX_SCALE = 3.2;

// Rebuilt each time the page opens: the on-grid nodes to draw, an id→node lookup,
// and per-node counts of the off-grid sub-areas that hang off each one.
let wmNodeList = [];
let wmNodeById = {};
let wmChildBadge = {};   // gridMapId -> { count, hasCave, hasDungeon, hasTower }
let wmCurrentGridId = -1;

// Interaction state.
let wmDrag = null;                 // { x, y } last pointer pos while panning
let wmPinch = null;                // { dist } last two-finger spread
let wmLastTap = 0;                 // for double-tap-to-zoom
let wmHoverNode = null;

function wmCanvasEl() { return document.getElementById('worldmap-canvas'); }

// ─── Open / close ───────────────────────────────────────────────────────────
function openWorldMap() {
  // Reached through the radial menu — close it first so overlays don't stack.
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  worldMapOpen = true;
  if (typeof clearAllKeys === 'function') clearAllKeys();
  document.getElementById('worldmap-modal-overlay').classList.add('open');
  buildWorldMapNodes();
  renderWorldMapLegend();
  // Defer the first paint one frame so the canvas has its laid-out size.
  requestAnimationFrame(() => { worldMapResetView(); });
}

function closeWorldMap() {
  worldMapOpen = false;
  document.getElementById('worldmap-modal-overlay').classList.remove('open');
  wmDrag = null; wmPinch = null; wmHoverNode = null;
  hideWorldMapTooltip();
}

// ─── Node collection ──────────────────────────────────────────────────────────
// An overworld map "owns" its grid cell when worldGrid still points back at it.
// Off-grid areas carry placeholder coords (usually 0,0) and fail this test, so
// they're excluded from the graph and counted as badges instead.
function wmOwnsGridCell(m) {
  return m && worldGrid[gridKey(m.gx, m.gy)] === m.id;
}

// Walk an off-grid map back to the overworld map it ultimately returns to, so
// its sub-area badge lands on a real node. Follows rootMapId first (the chain's
// overworld anchor), then returnMapId, guarding against cycles.
function wmResolveGridId(m) {
  let cur = m, guard = 0;
  while (cur && !wmOwnsGridCell(cur) && guard++ < 64) {
    const next = (cur.rootMapId != null) ? cur.rootMapId
               : (cur.returnMapId != null) ? cur.returnMapId : null;
    if (next == null || next === cur.id) break;
    cur = worldMaps[next];
  }
  return (cur && wmOwnsGridCell(cur)) ? cur.id : -1;
}

function buildWorldMapNodes() {
  wmNodeList = [];
  wmNodeById = {};
  wmChildBadge = {};

  for (let i = 0; i < worldMaps.length; i++) {
    const m = worldMaps[i];
    if (!m) continue;
    if (wmOwnsGridCell(m)) {
      const node = { id: m.id, gx: m.gx, gy: m.gy, map: m };
      wmNodeList.push(node);
      wmNodeById[m.id] = node;
    }
  }
  // Tally off-grid sub-areas onto their anchoring overworld node.
  for (let i = 0; i < worldMaps.length; i++) {
    const m = worldMaps[i];
    if (!m || wmOwnsGridCell(m)) continue;
    if (m.devSpawned) continue;                 // dev fast-travel villages aren't "real"
    const gid = wmResolveGridId(m);
    if (gid < 0) continue;
    const b = wmChildBadge[gid] || (wmChildBadge[gid] = { count: 0 });
    b.count++;
    if (m.type === 'cave_chain' || m.type === 'sky_cave' || m.type === 'whirlpool_grotto') b.hasCave = true;
    if (m.type === 'dungeon') b.hasDungeon = true;
    if (m.type === 'castle_tower') b.hasTower = true;
  }

  // Which grid node the hero is effectively on (overworld map for underground).
  const cur = (typeof currentMap === 'function') ? currentMap() : null;
  wmCurrentGridId = cur ? (wmOwnsGridCell(cur) ? cur.id : wmResolveGridId(cur)) : -1;
}

// ─── View fitting ─────────────────────────────────────────────────────────────
// Fit every node into the viewport with a margin, centred on the graph. Called
// on open and by the reset (⤢) button.
function worldMapResetView() {
  const cv = wmCanvasEl();
  if (!cv || wmNodeList.length === 0) { drawWorldMap(); return; }
  const cssW = cv.clientWidth || 600, cssH = cv.clientHeight || 420;

  let minGx = Infinity, maxGx = -Infinity, minGy = Infinity, maxGy = -Infinity;
  for (const n of wmNodeList) {
    minGx = Math.min(minGx, n.gx); maxGx = Math.max(maxGx, n.gx);
    minGy = Math.min(minGy, n.gy); maxGy = Math.max(maxGy, n.gy);
  }
  // World-px content box (node centres span [min*CELL, max*CELL]; pad by a node).
  const worldW = (maxGx - minGx) * WM_CELL + WM_NODE * 2;
  const worldH = (maxGy - minGy) * WM_CELL + WM_NODE * 2;
  const pad = 28;
  const fit = Math.min((cssW - pad * 2) / worldW, (cssH - pad * 2) / worldH);
  wmScale = Math.max(WM_MIN_SCALE, Math.min(WM_MAX_SCALE, fit));

  // Centre the graph's midpoint in the viewport.
  const midX = (minGx + maxGx) / 2 * WM_CELL;
  const midY = (minGy + maxGy) / 2 * WM_CELL;
  wmOx = cssW / 2 - midX * wmScale;
  wmOy = cssH / 2 - midY * wmScale;
  drawWorldMap();
}

// Zoom by a factor about a screen anchor (defaults to viewport centre).
function worldMapZoom(factor, ax, ay) {
  const cv = wmCanvasEl();
  if (!cv) return;
  if (ax == null) ax = (cv.clientWidth || 600) / 2;
  if (ay == null) ay = (cv.clientHeight || 420) / 2;
  const next = Math.max(WM_MIN_SCALE, Math.min(WM_MAX_SCALE, wmScale * factor));
  if (next === wmScale) return;
  // Keep the world point under the anchor fixed while scaling.
  const wx = (ax - wmOx) / wmScale, wy = (ay - wmOy) / wmScale;
  wmScale = next;
  wmOx = ax - wx * wmScale;
  wmOy = ay - wy * wmScale;
  drawWorldMap();
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function wmSX(wx) { return wx * wmScale + wmOx; }
function wmSY(wy) { return wy * wmScale + wmOy; }
function wmNodeCenter(n) { return [n.gx * WM_CELL, n.gy * WM_CELL]; }

// Region ground colour = the node's tint.
function wmRegionColor(biome) {
  const r = (typeof regionById === 'function') ? regionById(biome) : null;
  return (r && typeof TILE_COLORS !== 'undefined' && TILE_COLORS[r.ground]) || '#3a4a3a';
}

// Darken a #rrggbb by factor (0..1) for borders / shading.
function wmShade(hex, f) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
  return `rgb(${r},${g},${b})`;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function drawWorldMap() {
  const cv = wmCanvasEl();
  if (!cv) return;
  const g = cv.getContext('2d');
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const cssW = cv.clientWidth || 600, cssH = cv.clientHeight || 420;
  if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Parchment-dark backdrop.
  const bg = g.createLinearGradient(0, 0, 0, cssH);
  bg.addColorStop(0, '#0c150c');
  bg.addColorStop(1, '#060b06');
  g.fillStyle = bg;
  g.fillRect(0, 0, cssW, cssH);

  if (wmNodeList.length === 0) {
    g.fillStyle = '#5f8f5f';
    g.font = '13px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('The atlas is empty — venture out to chart the world.', cssW / 2, cssH / 2);
    return;
  }

  const ns = WM_NODE * wmScale;

  // ── Connections first, so nodes sit on top ──────────────────────────────────
  // Only right/down neighbours are inspected so each shared border is drawn once.
  for (const n of wmNodeList) {
    const [ax, ay] = wmNodeCenter(n);
    for (const dir of ['right', 'down']) {
      const d = DIR_DELTA[dir];
      const nb = wmNodeById[worldGrid[gridKey(n.gx + d.dx, n.gy + d.dy)]];
      if (!nb) continue;
      const [bx, by] = wmNodeCenter(nb);
      // A true walkable link needs both facing gates open; otherwise the maps are
      // merely adjacent (a sealed shared wall) and the line is drawn faint/dashed.
      const walkable = mapEdgeOpen(n.map, dir) && mapEdgeOpen(nb.map, OPPOSITE_DIR[dir]);
      g.beginPath();
      g.moveTo(wmSX(ax), wmSY(ay));
      g.lineTo(wmSX(bx), wmSY(by));
      if (walkable) {
        g.strokeStyle = 'rgba(200,180,110,0.75)';
        g.lineWidth = Math.max(1.5, 3 * wmScale);
        g.setLineDash([]);
      } else {
        g.strokeStyle = 'rgba(120,120,120,0.28)';
        g.lineWidth = Math.max(1, 1.5 * wmScale);
        g.setLineDash([4, 5]);
      }
      g.stroke();
    }
  }
  g.setLineDash([]);

  // ── Nodes ───────────────────────────────────────────────────────────────────
  const showLabels = ns > 40;
  for (const n of wmNodeList) {
    const m = n.map;
    const [wx, wy] = wmNodeCenter(n);
    const cx = wmSX(wx), cy = wmSY(wy);
    const half = ns / 2;
    const isCurrent = n.id === wmCurrentGridId;
    const isVillage = m.type === 'village';
    // Home — the lone cabin in old saves, the home village since the prologue.
    // Both get the same slate-blue "this is where you live" tint.
    const isHouse   = m.type === 'house' || m.type === 'homevillage';
    const visited   = !!m.visited;

    // Fill: region tint, dimmed for unexplored (generated but never entered).
    const base = isHouse ? '#6b7a8c' : wmRegionColor(m.biome);
    g.fillStyle = visited ? base : wmShade(base, 0.42);
    roundRectPath(g, cx - half, cy - half, ns, ns, Math.max(2, 5 * wmScale));
    g.fill();
    // Inner shading for a little depth.
    g.fillStyle = 'rgba(0,0,0,0.18)';
    roundRectPath(g, cx - half, cy - half + ns * 0.55, ns, ns * 0.45, Math.max(2, 5 * wmScale));
    g.fill();

    // Border.
    g.strokeStyle = isCurrent ? '#ffe680'
                  : isVillage ? '#ffcf5a'
                  : isHouse   ? '#9fd6ff'
                  : visited   ? wmShade(base, 0.55)
                              : 'rgba(150,150,150,0.4)';
    g.lineWidth = isCurrent ? 3 : (isVillage || isHouse) ? 2.2 : 1.4;
    if (!visited && !isCurrent) g.setLineDash([3, 3]);
    roundRectPath(g, cx - half, cy - half, ns, ns, Math.max(2, 5 * wmScale));
    g.stroke();
    g.setLineDash([]);

    // Glyph — house / village markers, and a small depth number otherwise when
    // there's room. Villages and the cabin read at a glance.
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (isHouse || isVillage) {
      g.font = `${Math.round(ns * 0.5)}px monospace`;
      g.fillText(isHouse ? '🏠' : '🏰', cx, cy);
    } else if (ns > 26 && typeof m.depth === 'number' && m.depth > 0) {
      g.fillStyle = visited ? 'rgba(255,255,255,0.82)' : 'rgba(220,220,220,0.5)';
      g.font = `bold ${Math.round(ns * 0.34)}px monospace`;
      g.fillText(String(m.depth), cx, cy);
    }

    // Sub-area badge (caves / dungeon / tower hanging off this map).
    const badge = wmChildBadge[n.id];
    if (badge && ns > 22) {
      const bx = cx + half - 5 * wmScale, by = cy - half + 5 * wmScale;
      const br = Math.max(5, 8 * wmScale);
      g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2);
      g.fillStyle = badge.hasTower ? '#c9a0ff' : badge.hasDungeon ? '#d88' : '#8fd0d0';
      g.fill();
      g.strokeStyle = '#0a120a'; g.lineWidth = 1.4; g.stroke();
      if (br > 6) {
        g.fillStyle = '#0a120a';
        g.font = `bold ${Math.round(br * 1.2)}px monospace`;
        g.fillText(String(badge.count), bx, by + 0.5);
      }
    }

    // Name label under the node when zoomed in (always for villages).
    if ((showLabels || isVillage) && m.name) {
      const label = String(m.name).replace(/\s*\[\d+\]\s*$/, '');
      g.font = `${isVillage ? 'bold ' : ''}${Math.max(9, Math.min(12, 11 * wmScale))}px monospace`;
      const ly = cy + half + 10;
      g.lineWidth = 3; g.strokeStyle = '#060b06';
      g.strokeText(label, cx, ly);
      g.fillStyle = isVillage ? '#ffd98a' : '#bcd0bc';
      g.fillText(label, cx, ly);
    }
  }

  // ── "You are here" flag over the current node ────────────────────────────────
  const curNode = wmNodeById[wmCurrentGridId];
  if (curNode) {
    const [wx, wy] = wmNodeCenter(curNode);
    const cx = wmSX(wx), cy = wmSY(wy);
    const half = ns / 2;
    // Halo ring.
    g.strokeStyle = 'rgba(255,230,128,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, half + 6, 0, Math.PI * 2);
    g.stroke();
    // Pennant above.
    const py = cy - half - 8;
    g.fillStyle = '#ffe680';
    g.beginPath();
    g.moveTo(cx, py + 8);
    g.lineTo(cx - 7, py);
    g.lineTo(cx + 7, py);
    g.closePath();
    g.fill();
    g.font = 'bold 10px monospace';
    g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.lineWidth = 3; g.strokeStyle = '#060b06';
    g.strokeText('You are here', cx, py - 2);
    g.fillStyle = '#ffe680';
    g.fillText('You are here', cx, py - 2);
  }
}

// A rounded-rect subpath (2-D canvas has no built-in on older engines).
function roundRectPath(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ─── Legend ───────────────────────────────────────────────────────────────────
// A compact swatch list of the regions actually present on the atlas, in game
// order, so the region colours are readable.
function renderWorldMapLegend() {
  const el = document.getElementById('worldmap-legend');
  if (!el) return;
  const present = new Set(wmNodeList.map(n => n.map.biome));
  const rows = REGIONS.filter(r => present.has(r.id)).map(r => {
    const col = (typeof TILE_COLORS !== 'undefined' && TILE_COLORS[r.ground]) || '#3a4a3a';
    const name = r.id.charAt(0).toUpperCase() + r.id.slice(1);
    return `<span class="wm-legend-item"><i style="background:${col}"></i>${name}</span>`;
  });
  el.innerHTML = rows.join('');
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function wmNodeAtScreen(x, y) {
  const half = (WM_NODE * wmScale) / 2;
  for (const n of wmNodeList) {
    const [wx, wy] = wmNodeCenter(n);
    const cx = wmSX(wx), cy = wmSY(wy);
    if (x >= cx - half && x <= cx + half && y >= cy - half && y <= cy + half) return n;
  }
  return null;
}

function showWorldMapTooltip(node, clientX, clientY) {
  const tip = document.getElementById('worldmap-tooltip');
  const vp = document.getElementById('worldmap-viewport');
  if (!tip || !vp) return;
  const m = node.map;
  const region = (typeof regionById === 'function') ? regionById(m.biome) : null;
  const regionName = region ? region.id.charAt(0).toUpperCase() + region.id.slice(1) : m.biome;
  const badge = wmChildBadge[node.id];
  let sub = '';
  if (badge) {
    const bits = [];
    if (badge.hasCave) bits.push('cave');
    if (badge.hasDungeon) bits.push('dungeon');
    if (badge.hasTower) bits.push('castle tower');
    sub = `<div class="wm-tip-sub">↳ ${badge.count} sub-area${badge.count > 1 ? 's' : ''}${bits.length ? ' (' + bits.join(', ') + ')' : ''}</div>`;
  }
  const status = node.id === wmCurrentGridId ? ' · <b>here</b>'
               : m.visited ? '' : ' · <i>unexplored</i>';
  tip.innerHTML = `<div class="wm-tip-name">${m.name || 'Unknown'}</div>
    <div class="wm-tip-meta">${regionName}${status}</div>${sub}`;
  const rect = vp.getBoundingClientRect();
  let tx = clientX - rect.left + 14, ty = clientY - rect.top + 14;
  tip.style.display = 'block';
  // Keep it inside the viewport.
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  if (tx + tw > rect.width) tx = clientX - rect.left - tw - 12;
  if (ty + th > rect.height) ty = clientY - rect.top - th - 12;
  tip.style.left = Math.max(2, tx) + 'px';
  tip.style.top = Math.max(2, ty) + 'px';
}

function hideWorldMapTooltip() {
  const tip = document.getElementById('worldmap-tooltip');
  if (tip) tip.style.display = 'none';
}

// ─── Pointer / touch input ────────────────────────────────────────────────────
function wmLocal(e, cv) {
  const rect = cv.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function initWorldMapInput() {
  const cv = wmCanvasEl();
  if (!cv) return;

  // Drag to pan; hover for tooltip.
  cv.addEventListener('mousedown', e => {
    wmDrag = { x: e.clientX, y: e.clientY, moved: false };
    hideWorldMapTooltip();
  });
  window.addEventListener('mousemove', e => {
    if (!worldMapOpen) return;
    if (wmDrag) {
      const dx = e.clientX - wmDrag.x, dy = e.clientY - wmDrag.y;
      wmOx += dx; wmOy += dy;
      wmDrag.x = e.clientX; wmDrag.y = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 1) wmDrag.moved = true;
      drawWorldMap();
      return;
    }
    // Hover tooltip.
    const p = wmLocal(e, cv);
    if (p.x < 0 || p.y < 0 || p.x > cv.clientWidth || p.y > cv.clientHeight) {
      hideWorldMapTooltip(); return;
    }
    const node = wmNodeAtScreen(p.x, p.y);
    cv.style.cursor = node ? 'pointer' : 'grab';
    if (node) showWorldMapTooltip(node, e.clientX, e.clientY);
    else hideWorldMapTooltip();
  });
  window.addEventListener('mouseup', () => { wmDrag = null; });

  // Wheel to zoom about the cursor.
  cv.addEventListener('wheel', e => {
    if (!worldMapOpen) return;
    e.preventDefault();
    const p = wmLocal(e, cv);
    worldMapZoom(e.deltaY < 0 ? 1.12 : 0.89, p.x, p.y);
  }, { passive: false });

  // Touch: one finger pans (double-tap zooms), two fingers pinch-zoom.
  cv.addEventListener('touchstart', e => {
    if (!worldMapOpen) return;
    hideWorldMapTooltip();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      wmDrag = { x: t.clientX, y: t.clientY, moved: false };
      const now = Date.now();
      if (now - wmLastTap < 300) {
        const p = wmLocal(t, cv);
        worldMapZoom(1.6, p.x, p.y);
        wmLastTap = 0;
      } else {
        wmLastTap = now;
      }
    } else if (e.touches.length === 2) {
      wmDrag = null;
      wmPinch = { dist: wmTouchDist(e.touches) };
    }
    e.preventDefault();
  }, { passive: false });

  cv.addEventListener('touchmove', e => {
    if (!worldMapOpen) return;
    if (e.touches.length === 2 && wmPinch) {
      const nd = wmTouchDist(e.touches);
      const rect = cv.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      if (wmPinch.dist > 0) worldMapZoom(nd / wmPinch.dist, mx, my);
      wmPinch.dist = nd;
    } else if (e.touches.length === 1 && wmDrag) {
      const t = e.touches[0];
      wmOx += t.clientX - wmDrag.x;
      wmOy += t.clientY - wmDrag.y;
      wmDrag.x = t.clientX; wmDrag.y = t.clientY;
      drawWorldMap();
    }
    e.preventDefault();
  }, { passive: false });

  cv.addEventListener('touchend', e => {
    if (e.touches.length === 0) { wmDrag = null; wmPinch = null; }
    else if (e.touches.length === 1) { wmPinch = null; wmDrag = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false }; }
  });
}

function wmTouchDist(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX,
                    touches[0].clientY - touches[1].clientY);
}

// Keep the view sensible when the window resizes with the atlas open.
window.addEventListener('resize', () => { if (worldMapOpen) drawWorldMap(); });

// Close on click outside the modal (matches shop / ledger / stats behaviour).
const _wmOverlay = document.getElementById('worldmap-modal-overlay');
if (_wmOverlay) {
  _wmOverlay.addEventListener('click', e => { if (e.target === _wmOverlay) closeWorldMap(); });
}

initWorldMapInput();
