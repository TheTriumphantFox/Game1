// ─── Umbral Sanctum: the shadow region's village skin ─────────────────────────
// A second STYLE for the village architecture the oblique renderer already
// stands up, not a second renderer. drawForestHouseRoof computes the geometry
// (eave rect, ridge line, roof bottom, facade gap) exactly as it always has;
// the two entry points here take over the PAINT for shadow-region villages and
// hand the same numbers back, the same way village-sprite.js's sheet path does.
//
// WHY A STYLE AND NOT A SHEET
// terrain art is per-region (TERRAIN_ATLAS has thirteen entries); village art is
// not — village-sheet.png is one sheet of warm brown shingle that every village
// in the game wears. Authoring a second sheet needs Aseprite and a regenerate
// step. Drawing the shadow skin in code needs neither, and it keeps the door
// open for the other eleven regions to become sheets later: both paths already
// decline by returning false, and drawForestHouseRoof falls through to its own
// procedural planes when they do.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE
// The region lives inside about 12% of the luminance scale — T.SHADOW_GROUND
// #241d33 down to T.SHADOW_RIFT #080510. Tone alone cannot separate a roof from
// the ground it sits on at that range, so every shape here carries an ink
// outline (UMBRAL.ink) and every fill is a flat step rather than a gradient.
// Ink is doing the work a value difference does in the forest.

// ─── Palette ──────────────────────────────────────────────────────────────────
// Derived from the region's own tiles so nothing new enters the palette:
// roofN/roofS bracket T.SHADOW_WALL, wall resolves to T.SHADOW_GROUND at the
// sill, and lit/litDim are T.DOOR's two violets, which are already what the
// door tile paints in every region.
const UMBRAL = {
  ink:      '#040207',   // every outline, one weight
  roofN:    '#241d3a',   // north slope — the lit one, flat
  roofS:    '#100c1c',   // south slope — a full step darker, flat
  roofBand: '#2e2648',   // north slope shingle course
  roofBandS:'#171128',   // south slope shingle course
  ridge:    '#6b5a94',   // ridge beam — the cold rim off the rifts
  ridgeLip: '#9b8ac4',   // its top highlight
  verge:    '#0a0712',   // gable verge / fascia
  wall:     '#191426',   // facade infill
  wallLit:  '#241d33',   // the band the ground light reaches
  wallDeep: '#0a0712',   // eave shadow across the top of the front
  returnW:  '#191426',   // west wall return (toward the light)
  returnE:  '#0d0a16',   // east wall return (away from it)
  sill:     '#0e0a15',
  sillLip:  '#4b3d6d',
  frame:    '#3a2359',   // door and window surrounds
  lit:      '#cc88ff',   // an opening with something behind it
  litDim:   '#b07de8',
  shadow:   'rgba(4,2,8,0.62)',
};

// Ink weight, in tiles, so a 1px line at TILE_PX 48 is still a line at 24.
function umbralInk(ts, w) {
  return Math.max(1, ts * (w === undefined ? 0.055 : w));
}

// ─── The gate ─────────────────────────────────────────────────────────────────
// One test, asked by every entry point below, so widening this skin to another
// region (or narrowing it back) is a change to this function alone. Deliberately
// the same shape as village-sprite.js's villageArtActive.
function umbralArtActive(mapObj) {
  if (!mapObj || mapObj.biome !== 'shadow') return false;
  return mapObj.type === 'village';
}

function umbralArtHere() {
  return typeof currentMap === 'function' && umbralArtActive(currentMap());
}

// ─── Roof ─────────────────────────────────────────────────────────────────────
// Takes over the two roof planes for a shadow cottage. Same contract as
// drawVillageRoofPlanes: return true and the caller skips its own planes,
// return false and nothing here has drawn a pixel.
//
// The forest roof reads by hue (warm shingle on green grass). Here both roof
// and ground are near-black, so the read is built from three things instead:
// a hard ink silhouette, two flat slope values a full step apart, and one pale
// ridge beam splitting them.
function drawUmbralRoofPlanes(left, top, right, roofBottom, ridgeY, ts) {
  if (!umbralArtHere()) return false;
  if (roofBottom - top < ts * 1.2 || right - left < ts * 1.2) return false;

  const lw = umbralInk(ts);

  // Cast shadow first, offset south-east like every other raised thing in the
  // game. Deeper than the forest's 0.48 because there is no fill light here to
  // lift the inside of it.
  ctx.fillStyle = UMBRAL.shadow;
  ctx.fillRect(left + ts * 0.16, top + ts * 0.30, right - left, roofBottom - top + ts * 0.5);

  // North slope — flat fill, no gradient. Corners clipped to the same 0.22
  // the procedural planes use so the silhouette is unchanged.
  ctx.beginPath();
  ctx.moveTo(left + ts * 0.22, top);
  ctx.lineTo(right - ts * 0.22, top);
  ctx.lineTo(right, ridgeY);
  ctx.lineTo(left, ridgeY);
  ctx.closePath();
  ctx.fillStyle = UMBRAL.roofN; ctx.fill();
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();

  // South slope, a full step darker.
  ctx.beginPath();
  ctx.moveTo(left, ridgeY);
  ctx.lineTo(right, ridgeY);
  ctx.lineTo(right - ts * 0.18, roofBottom);
  ctx.lineTo(left + ts * 0.18, roofBottom);
  ctx.closePath();
  ctx.fillStyle = UMBRAL.roofS; ctx.fill(); ctx.stroke();

  // Shingle courses as BANDS, not lines. A hairline reads as a scratch at
  // TILE_PX 24; a band half a tile deep still reads as material.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left + ts * 0.22, top); ctx.lineTo(right - ts * 0.22, top);
  ctx.lineTo(right, ridgeY); ctx.lineTo(left, ridgeY);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = UMBRAL.roofBand;
  for (let y = top + ts * 0.30; y < ridgeY; y += ts * 0.62) {
    ctx.fillRect(left, y, right - left, ts * 0.26);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, ridgeY); ctx.lineTo(right, ridgeY);
  ctx.lineTo(right - ts * 0.18, roofBottom); ctx.lineTo(left + ts * 0.18, roofBottom);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = UMBRAL.roofBandS;
  for (let y = ridgeY + ts * 0.36; y < roofBottom; y += ts * 0.62) {
    ctx.fillRect(left, y, right - left, ts * 0.26);
  }
  // Staggered vertical joints, alternating per course, so the slope reads as
  // overlapping pieces rather than stripes.
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.03);
  let course = 0;
  for (let y = ridgeY; y < roofBottom; y += ts * 0.62, course++) {
    const off = (course % 2) * ts * 0.5;
    for (let x = left + off; x < right; x += ts) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + ts * 0.62); ctx.stroke();
    }
  }
  ctx.restore();

  // Ridge beam. The one pale thing on the whole building, and the only place
  // the rifts' cold ambient is allowed to land.
  const rh = Math.max(2, ts * 0.13);
  ctx.fillStyle = UMBRAL.ridge;
  ctx.fillRect(left, ridgeY - rh / 2, right - left, rh);
  ctx.fillStyle = UMBRAL.ridgeLip;
  ctx.fillRect(left, ridgeY - rh / 2, right - left, Math.max(1, rh * 0.28));
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.035);
  ctx.strokeRect(left, ridgeY - rh / 2, right - left, rh);

  return true;
}

// ─── Front elevation ──────────────────────────────────────────────────────────
// The wall standing in the gap the roof left above the south wall row. Same
// contract and the same returned geometry as drawForestHouseFacade, so
// facadeSignSpot hangs a shop board here without knowing which skin drew it.
//
// The forest front is lit by an upper-left morning sun and gradients from
// #cdb27f down to #805c3e. There is no sun here, so the value runs the other
// way: darkest under the eave, lifting toward the ground where the torch and
// door light actually reach. What makes it read as a wall is the ink, the sill,
// and the lit opening punched through it.
function drawUmbralFacade(o, d) {
  if (!umbralArtHere()) return null;
  const { left, right, bottom, roofBottom, width, centreX, ts } = o;
  const facadeTop = roofBottom - ts * 0.03;
  const facadeBottom = bottom + ts * 0.10;
  const facadeLeft = left + ts * 0.42;
  const facadeRight = right - ts * 0.42;
  const facadeH = facadeBottom - facadeTop;
  if (facadeH <= ts * 0.2 || facadeRight - facadeLeft <= ts * 0.5) return null;

  const lw = umbralInk(ts);
  ctx.lineJoin = 'round';

  // Ground shadow the front throws forward, before anything stands on it.
  ctx.fillStyle = 'rgba(4,2,8,0.42)';
  ctx.fillRect(facadeLeft + ts * 0.18, facadeBottom - ts * 0.06,
    facadeRight - facadeLeft, ts * 0.30);

  // Wall returns at each end: the depth cue that stops the front reading as a
  // flat card. West catches what light there is, east falls away.
  ctx.fillStyle = UMBRAL.returnW;
  ctx.beginPath();
  ctx.moveTo(left + ts * 0.18, facadeTop - ts * 0.08);
  ctx.lineTo(facadeLeft, facadeTop + ts * 0.12);
  ctx.lineTo(facadeLeft, facadeBottom);
  ctx.lineTo(left + ts * 0.20, facadeBottom - ts * 0.27);
  ctx.closePath();
  ctx.fill(); ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.stroke();

  ctx.fillStyle = UMBRAL.returnE;
  ctx.beginPath();
  ctx.moveTo(facadeRight, facadeTop + ts * 0.12);
  ctx.lineTo(right - ts * 0.18, facadeTop - ts * 0.08);
  ctx.lineTo(right - ts * 0.16, facadeBottom - ts * 0.30);
  ctx.lineTo(facadeRight, facadeBottom);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // The front itself: three flat steps, dark at the eave, resolving to the
  // region's own ground colour where it meets the sill.
  const fw = facadeRight - facadeLeft;
  ctx.fillStyle = UMBRAL.wall;
  ctx.fillRect(facadeLeft, facadeTop, fw, facadeH);
  ctx.fillStyle = UMBRAL.wallDeep;
  ctx.fillRect(facadeLeft, facadeTop, fw, facadeH * 0.22);
  ctx.fillStyle = UMBRAL.wallLit;
  ctx.fillRect(facadeLeft, facadeTop + facadeH * 0.52, fw, facadeH * 0.24);
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw;
  ctx.strokeRect(facadeLeft, facadeTop, fw, facadeH);

  // Corner posts. Two heavy uprights are all the timbering this front can carry
  // at TILE_PX 24 without turning to mush — the same reason FACADE_COTTAGE
  // drops the family home's inner braces.
  ctx.fillStyle = UMBRAL.ink;
  ctx.fillRect(facadeLeft + ts * 0.10, facadeTop, ts * 0.14, facadeH);
  ctx.fillRect(facadeRight - ts * 0.24, facadeTop, ts * 0.14, facadeH);

  // Windows. Lit, because an unlit hole in a near-black wall is invisible.
  const winXs = d.windowsAt.map(f => centreX + width * f);
  const winW = ts * 0.62, winH = Math.min(ts * 0.42, facadeH * 0.34);
  const winY = facadeTop + facadeH * 0.30;
  for (const wx of winXs) {
    if (wx - winW / 2 < facadeLeft + ts * 0.3 || wx + winW / 2 > facadeRight - ts * 0.3) continue;
    ctx.fillStyle = UMBRAL.frame;
    ctx.fillRect(wx - winW / 2, winY, winW, winH);
    ctx.fillStyle = UMBRAL.litDim;
    ctx.fillRect(wx - winW / 2 + ts * 0.06, winY + ts * 0.05, winW - ts * 0.12, winH - ts * 0.10);
    ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.04);
    ctx.strokeRect(wx - winW / 2, winY, winW, winH);
  }

  // Door. Same 0.88-tile width and 1.30-tile height the forest cottage uses, so
  // a hero standing in the opening lines up identically in both skins.
  const doorW = ts * 0.88;
  const doorX = centreX - doorW / 2;
  const doorFoot = facadeBottom - ts * 0.06;
  const doorTop = facadeTop + ts * 0.23;
  const doorY = d.doorTiles ? Math.max(doorTop, doorFoot - ts * d.doorTiles) : doorTop;

  // Light spilling out onto the ground in front of the opening. This is the
  // region's key light: it leaves the building rather than landing on it.
  const spill = ctx.createRadialGradient(
    centreX, doorFoot, ts * 0.05, centreX, doorFoot, ts * 1.9);
  spill.addColorStop(0, 'rgba(204,136,255,0.34)');
  spill.addColorStop(1, 'rgba(136,74,204,0)');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.ellipse(centreX, doorFoot, ts * 1.9, ts * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = UMBRAL.frame;
  ctx.fillRect(doorX, doorY, doorW, doorFoot - doorY);
  ctx.fillStyle = UMBRAL.lit;
  ctx.fillRect(doorX + ts * 0.10, doorY + ts * 0.08, doorW - ts * 0.20, doorFoot - doorY - ts * 0.08);
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.045);
  ctx.strokeRect(doorX, doorY, doorW, doorFoot - doorY);

  // Sill / foundation, projecting forward under the wall.
  const sillH = ts * 0.24;
  ctx.fillStyle = UMBRAL.sill;
  ctx.fillRect(facadeLeft - ts * 0.05, facadeBottom - sillH, fw + ts * 0.10, sillH);
  ctx.fillStyle = UMBRAL.sillLip;
  ctx.fillRect(facadeLeft - ts * 0.05, facadeBottom - sillH, fw + ts * 0.10, Math.max(1, ts * 0.045));
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.035);
  ctx.strokeRect(facadeLeft - ts * 0.05, facadeBottom - sillH, fw + ts * 0.10, sillH);

  return { facadeTop, facadeBottom, facadeLeft, facadeRight, doorX, doorW, winXs };
}

// ─── The Obsidian Spire ───────────────────────────────────────────────────────
// The endgame castle, standing behind the village it rises out of. This is the
// LAST village in the game and the only one with a castle gate, so it is the
// only place in thirteen regions that gets a silhouette taller than a house.
//
// Anchored on the castle gate (mapObj.castleExitDir), outside the map, so it
// never overlaps a walkable tile and needs no tile, no collision and no save
// field. Drawn 30 tiles tall: at TILE_PX 48 that is 1440px of art, taller than
// the viewport, which is deliberate — the crown is only visible on approach.
// Height is bounded by the CAMERA, not by taste. A tall object is drawn upward
// from its foot and clampCam never scrolls above row 0, so from inside the
// village you can only ever see as many tiles of tower as its foot row — eight,
// here, whatever TILE_PX is. That is the budget the proportions below are tuned
// against: plinth, great door and three storeys of lit window all land inside
// it, and the shaft runs out of frame above, which is the intended read. You
// are not supposed to be able to fit this thing on the screen.
const SPIRE_TILES_H = 10;    // total height, tile edges
// Narrow on purpose. Only eight tiles of height ever reach the screen, so a
// nine-tile-wide tower reads as a wall with a door in it — first build did, and
// it looked like a keep rather than a spire. At five and a half the visible band
// is taller than it is wide and the silhouette goes vertical.
const SPIRE_TILES_W = 5.5;   // width at the plinth

// Where the spire's foot sits, in world tile coordinates, or null if this map
// has no castle gate.
//
// It stands on the INNER edge of the border ring, not outside the map. That is
// forced by the camera, and it is the one piece of this that cannot be reasoned
// out from the art: a tall object is drawn upward from its foot, and clampCam
// never scrolls above row 0, so a foot at a negative row puts the entire tower
// off the top of the screen forever. First build did exactly that and rendered
// a perfect, invisible spire — only its ground shadow proved it was there.
//
// Row 7 is inside buildVillageMap's solid border ring (rows 1..7), so the foot
// is on unwalkable tiles and the hero can never stand in the masonry. From the
// plaza the tower is off-screen north; walking up the road brings it into frame
// crown-first, and from about fifteen rows south it fills the viewport.
const SPIRE_INSET = 7;

function obsidianSpireFoot(mapObj) {
  if (!umbralArtActive(mapObj) || !mapObj.castleExitDir) return null;
  switch (mapObj.castleExitDir) {
    case 'up':    return { x: EXIT_COL, y: SPIRE_INSET };
    case 'down':  return { x: EXIT_COL, y: MROWS - 1 - SPIRE_INSET };
    case 'left':  return { x: SPIRE_INSET, y: EXIT_ROW };
    case 'right': return { x: MCOLS - 1 - SPIRE_INSET, y: EXIT_ROW };
    default:      return null;
  }
}

// The spire's own long shadow, raked south-east across the village floor. Drawn
// on the GROUND pass, before the buildings, so houses and actors stand on top of
// it rather than under it. Rule 55 of the concept-art read — shadow length
// scales with height — taken to its limit: nothing else in the game throws one
// this long, and that is what states the tower's size.
function drawObsidianSpireShadow(mapObj, ts) {
  const foot = obsidianSpireFoot(mapObj);
  if (!foot) return;
  const fx = worldX(foot.x + 0.5), fy = worldY(foot.y + 1);
  const halfW = SPIRE_TILES_W * ts * 0.5;
  const len = SPIRE_TILES_H * ts * 1.15;

  const g = ctx.createLinearGradient(fx, fy, fx + len * 0.6, fy + len);
  g.addColorStop(0, 'rgba(4,2,8,0.54)');
  g.addColorStop(1, 'rgba(4,2,8,0.04)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(fx - halfW, fy);
  ctx.lineTo(fx + halfW, fy);
  ctx.lineTo(fx + halfW + len * 0.62, fy + len);
  ctx.lineTo(fx - halfW + len * 0.30, fy + len);
  ctx.closePath();
  ctx.fill();
}

// The tower itself. Enters the depth merge as a tall object keyed to its foot
// row, so a hero walking up to the gate passes IN FRONT of it and the villagers
// on the plaza are never painted over by it.
function drawObsidianSpire(mapObj, ts) {
  const foot = obsidianSpireFoot(mapObj);
  if (!foot) return;

  const cx = worldX(foot.x + 0.5);
  const baseY = worldY(foot.y + 1);
  const H = SPIRE_TILES_H * ts;
  const halfW = SPIRE_TILES_W * ts * 0.5;
  const lw = umbralInk(ts, 0.075);

  // Cull: the spire is 30 tiles of art hanging off one point, so the cheap
  // horizontal test is worth making before any of it is built.
  if (cx + halfW * 2.2 < 0 || cx - halfW * 2.2 > PW) return;

  const topY = baseY - H;                 // crown apex
  const plinthY = baseY - H * 0.07;       // stepped base — kept shallow so the
  const shaftTopY = baseY - H * 0.74;     // shaft starts inside the visible band
  const beltY = baseY - H * 0.83;
  const crownY = baseY - H * 0.90;

  const shaftHalfBase = halfW * 0.86;
  const shaftHalfTop = halfW * 0.52;

  ctx.save();
  ctx.lineJoin = 'round';

  // Halo: the rifts' violet ambient collecting behind the tower, which is what
  // gives the black silhouette something to be black against.
  const halo = ctx.createRadialGradient(cx, baseY - H * 0.5, ts * 0.5,
                                        cx, baseY - H * 0.5, H * 0.62);
  halo.addColorStop(0, 'rgba(138,95,216,0.30)');
  halo.addColorStop(0.55, 'rgba(90,58,150,0.12)');
  halo.addColorStop(1, 'rgba(74,47,125,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - H * 0.62, baseY - H * 1.12, H * 1.24, H * 1.24);

  // ── Buttresses ──
  ctx.fillStyle = '#070510';
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 1.42, baseY);
  ctx.lineTo(cx - halfW * 1.06, baseY - H * 0.40);
  ctx.lineTo(cx - halfW * 0.86, baseY - H * 0.40);
  ctx.lineTo(cx - halfW * 0.86, baseY);
  ctx.closePath();
  ctx.fill(); ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.stroke();
  ctx.fillStyle = '#040309';
  ctx.beginPath();
  ctx.moveTo(cx + halfW * 1.42, baseY);
  ctx.lineTo(cx + halfW * 1.06, baseY - H * 0.40);
  ctx.lineTo(cx + halfW * 0.86, baseY - H * 0.40);
  ctx.lineTo(cx + halfW * 0.86, baseY);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // ── Stepped plinth ──
  const step = (x0, y0, x1, y1, fill, lip) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx - x0, y0); ctx.lineTo(cx + x0, y0);
    ctx.lineTo(cx + x1, y1); ctx.lineTo(cx - x1, y1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.stroke();
    ctx.fillStyle = lip;
    ctx.fillRect(cx - x1, y1, x1 * 2, Math.max(1.5, ts * 0.09));
  };
  step(halfW * 1.16, baseY, halfW * 1.04, plinthY, '#0a0712', '#2a2140');
  step(halfW * 1.04, plinthY, halfW * 0.94, plinthY - H * 0.05, '#0d0918', '#241d3a');
  step(halfW * 0.94, plinthY - H * 0.05, shaftHalfBase, plinthY - H * 0.10, '#0b0814', '#1f1934');

  // ── Great door at the foot: the way in, and the brightest thing down here ──
  const doorH = H * 0.055, doorW2 = halfW * 0.30;
  ctx.fillStyle = UMBRAL.ink;
  ctx.beginPath();
  ctx.moveTo(cx - doorW2, baseY);
  ctx.lineTo(cx - doorW2, baseY - doorH * 0.62);
  ctx.quadraticCurveTo(cx, baseY - doorH * 1.35, cx + doorW2, baseY - doorH * 0.62);
  ctx.lineTo(cx + doorW2, baseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = UMBRAL.ridge; ctx.lineWidth = Math.max(1.5, ts * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(204,136,255,0.55)';
  ctx.fillRect(cx - doorW2 * 0.6, baseY - doorH * 0.55, doorW2 * 1.2, doorH * 0.55);

  // ── Main shaft ──
  const shaftBaseY = plinthY - H * 0.10;
  ctx.beginPath();
  ctx.moveTo(cx - shaftHalfBase, shaftBaseY);
  ctx.lineTo(cx + shaftHalfBase, shaftBaseY);
  ctx.lineTo(cx + shaftHalfTop, shaftTopY);
  ctx.lineTo(cx - shaftHalfTop, shaftTopY);
  ctx.closePath();
  ctx.fillStyle = '#0b0813'; ctx.fill();
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.stroke();

  // Lit west face — the same cold rim every shadow prop carries on its
  // upper-left, so the tower belongs to the same light as the shard clusters.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - shaftHalfBase, shaftBaseY);
  ctx.lineTo(cx + shaftHalfBase, shaftBaseY);
  ctx.lineTo(cx + shaftHalfTop, shaftTopY);
  ctx.lineTo(cx - shaftHalfTop, shaftTopY);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = '#1d1733';
  ctx.beginPath();
  ctx.moveTo(cx - shaftHalfBase, shaftBaseY);
  ctx.lineTo(cx - shaftHalfBase + halfW * 0.26, shaftBaseY);
  ctx.lineTo(cx - shaftHalfTop + halfW * 0.20, shaftTopY);
  ctx.lineTo(cx - shaftHalfTop, shaftTopY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#050309';
  ctx.fillRect(cx + shaftHalfTop * 0.72, shaftTopY, shaftHalfBase, shaftBaseY - shaftTopY);

  // Fourteen floor bands, one per storey, narrowing with the taper.
  ctx.fillStyle = '#151027';
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    const y = shaftBaseY + (shaftTopY - shaftBaseY) * t;
    const hw = shaftHalfBase + (shaftHalfTop - shaftHalfBase) * t;
    ctx.fillRect(cx - hw, y - ts * 0.10, hw * 2, ts * 0.20);
  }
  ctx.restore();

  // Pilasters running the full taper, inked so they read at any zoom.
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.05);
  for (const f of [-0.55, -0.18, 0.18, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(cx + shaftHalfBase * f * 1.8, shaftBaseY);
    ctx.lineTo(cx + shaftHalfTop * f * 1.8, shaftTopY);
    ctx.stroke();
  }

  // ── Windows: the tower is inhabited, and this is how you know ──
  // Out of phase per storey so the stack never pulses in unison.
  const now = Date.now() / 1000;
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const y = shaftBaseY + (shaftTopY - shaftBaseY) * t;
    const hw = shaftHalfBase + (shaftHalfTop - shaftHalfBase) * t;
    const pulse = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(now * 0.9 + i * 1.7));
    const wW = Math.max(2, ts * 0.30), wH = Math.max(4, ts * 0.86);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = UMBRAL.lit;
    ctx.fillRect(cx - wW / 2, y - wH, wW, wH);
    ctx.globalAlpha = pulse * 0.55;
    ctx.fillStyle = UMBRAL.litDim;
    ctx.fillRect(cx - hw * 0.58 - wW * 0.35, y - wH * 0.8, wW * 0.7, wH * 0.8);
    ctx.fillRect(cx + hw * 0.58 - wW * 0.35, y - wH * 0.8, wW * 0.7, wH * 0.8);
    ctx.globalAlpha = 1;
  }

  // ── Banners ──
  for (const s of [-1, 1]) {
    const bx = cx + s * shaftHalfTop * 1.25;
    const bTop = shaftTopY + H * 0.05, bBot = bTop + H * 0.11;
    ctx.fillStyle = s < 0 ? '#3a1f5e' : '#2a1547';
    ctx.beginPath();
    ctx.moveTo(bx - ts * 0.55, bTop); ctx.lineTo(bx + ts * 0.55, bTop);
    ctx.lineTo(bx + ts * 0.55, bBot); ctx.lineTo(bx, bBot - ts * 0.42);
    ctx.lineTo(bx - ts * 0.55, bBot);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = Math.max(1, ts * 0.045); ctx.stroke();
    ctx.fillStyle = UMBRAL.lit;
    ctx.fillRect(bx - ts * 0.19, bTop + ts * 0.30, ts * 0.38, Math.max(1.5, ts * 0.10));
    ctx.fillRect(bx - ts * 0.07, bTop + ts * 0.30, ts * 0.14, ts * 0.62);
  }

  // ── Belfry ──
  const belHalfB = shaftHalfTop, belHalfT = shaftHalfTop * 0.80;
  ctx.beginPath();
  ctx.moveTo(cx - belHalfB, shaftTopY); ctx.lineTo(cx + belHalfB, shaftTopY);
  ctx.lineTo(cx + belHalfT, beltY); ctx.lineTo(cx - belHalfT, beltY);
  ctx.closePath();
  ctx.fillStyle = '#0d0918'; ctx.fill();
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.stroke();

  // The beacon in the belfry arch. Swells on its own slower period.
  const bp = 0.5 + 0.5 * Math.sin(now * 0.62);
  const archH = (shaftTopY - beltY) * 0.72, archW = belHalfT * 0.52;
  const archY = shaftTopY - archH * 0.2;
  ctx.fillStyle = UMBRAL.ink;
  ctx.beginPath();
  ctx.moveTo(cx - archW, archY);
  ctx.lineTo(cx - archW, archY - archH * 0.55);
  ctx.quadraticCurveTo(cx, archY - archH * 1.30, cx + archW, archY - archH * 0.55);
  ctx.lineTo(cx + archW, archY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = UMBRAL.ridge; ctx.lineWidth = Math.max(1.5, ts * 0.055); ctx.stroke();
  ctx.globalAlpha = 0.45 + 0.55 * bp;
  ctx.fillStyle = UMBRAL.lit;
  ctx.beginPath();
  ctx.ellipse(cx, archY - archH * 0.5, archW * 0.62, archH * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Crown of shards ──
  const cw = belHalfT;
  ctx.beginPath();
  ctx.moveTo(cx - cw, crownY + (beltY - crownY) * 0.1);
  ctx.lineTo(cx - cw * 0.62, topY + H * 0.10);
  ctx.lineTo(cx - cw * 0.30, topY + H * 0.16);
  ctx.lineTo(cx, topY);
  ctx.lineTo(cx + cw * 0.34, topY + H * 0.15);
  ctx.lineTo(cx + cw * 0.66, topY + H * 0.08);
  ctx.lineTo(cx + cw, crownY + (beltY - crownY) * 0.1);
  ctx.closePath();
  ctx.fillStyle = '#08060f'; ctx.fill();
  ctx.strokeStyle = UMBRAL.ink; ctx.lineWidth = lw; ctx.stroke();
  // Lit facets on the upper-left of each spike, the props' own convention.
  ctx.fillStyle = '#3d3260';
  ctx.beginPath();
  ctx.moveTo(cx, topY); ctx.lineTo(cx + cw * 0.16, topY + H * 0.07);
  ctx.lineTo(cx + cw * 0.34, topY + H * 0.15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#332a4d';
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.62, topY + H * 0.10); ctx.lineTo(cx - cw * 0.46, topY + H * 0.13);
  ctx.lineTo(cx - cw * 0.30, topY + H * 0.16); ctx.closePath(); ctx.fill();

  // The light at the very top, visible from the far side of the map.
  ctx.globalAlpha = 0.30 + 0.45 * bp;
  const tip = ctx.createRadialGradient(cx, topY + ts * 0.3, 0, cx, topY + ts * 0.3, ts * 2.6);
  tip.addColorStop(0, 'rgba(240,216,255,0.95)');
  tip.addColorStop(0.35, 'rgba(204,136,255,0.42)');
  tip.addColorStop(1, 'rgba(204,136,255,0)');
  ctx.fillStyle = tip;
  ctx.beginPath(); ctx.arc(cx, topY + ts * 0.3, ts * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Aerial perspective ──
  // The one place in the region anything is allowed to go soft. Fading the
  // crown back toward the ground colour is what makes it read as FAR as well as
  // tall; without it a 30-tile tower just looks like a big near thing.
  const aerial = ctx.createLinearGradient(0, topY, 0, topY + H * 0.55);
  aerial.addColorStop(0, 'rgba(66,52,110,0.60)');
  aerial.addColorStop(0.5, 'rgba(42,31,72,0.18)');
  aerial.addColorStop(1, 'rgba(27,21,40,0)');
  ctx.fillStyle = aerial;
  ctx.fillRect(cx - halfW * 1.6, topY, halfW * 3.2, H * 0.55);

  ctx.restore();
}

// ─── Ground ───────────────────────────────────────────────────────────────────
// buildVillageMap fills every village in the game with T.PATH and paints the
// plaza and roads on top, so the open ground of Umbral Sanctum is the same warm
// tan #a08860 the forest gets. Under a black roof with a violet door that reads
// as mud, and it was the single loudest wrong note once the architecture landed.
//
// Same hook and same contract as villageTileArt (render.js:153): repaint the
// handful of tiles whose forest colour fights this region, decline everything
// else. Nothing here changes a tile's identity — T.PATH is still T.PATH to
// collision, pathing, the minimap and the save.
function umbralTileArt(col, row, t, sx, sy, s) {
  if (!umbralArtHere()) return false;
  const x = Math.floor(sx), y = Math.floor(sy), w = Math.ceil(s) + 1;
  // Hashed per tile so the ground reads as a continuous waste rather than a
  // grid. Three values a hair apart plus an offset dapple is enough to break
  // the 48px cell without any tile looking different from its neighbour.
  const h = (col * 131 + row * 83) >>> 0;

  if (t === T.PATH) {
    ctx.fillStyle = (h % 3 === 0) ? '#221b30' : (h % 3 === 1 ? '#261f36' : '#201a2c');
    ctx.fillRect(x, y, w, w);
    // Pooled deeper gloom, drifting off the cell edges so the seam disappears.
    if (h % 5 < 2) {
      ctx.fillStyle = '#1a1526';
      ctx.beginPath();
      ctx.ellipse(x + s * ((h % 7) / 7), y + s * ((h % 11) / 11),
        s * 0.62, s * 0.34, (h % 13) * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    // A little grit catching the same cold light every shadow prop carries.
    if (h % 4 === 0) {
      ctx.fillStyle = 'rgba(122,100,178,0.20)';
      ctx.fillRect(x + s * ((h % 9) / 9), y + s * ((h % 6) / 6),
        Math.max(1, s * 0.045), Math.max(1, s * 0.045));
    }
    return true;
  }

  // House walls seen from above, where a roof is not covering them: void stone,
  // not the generic grey T.WALL paints everywhere else.
  if (t === T.WALL) {
    ctx.fillStyle = '#100b18'; ctx.fillRect(x, y, w, w);
    ctx.fillStyle = '#040207'; ctx.fillRect(x, y, w, Math.max(1, s * 0.06));
    ctx.fillStyle = '#040207'; ctx.fillRect(x, y, Math.max(1, s * 0.06), w);
    ctx.fillStyle = '#241d3a'; ctx.fillRect(x, y + s - Math.max(1, s * 0.08), w, Math.max(1, s * 0.08));
    return true;
  }

  // Interior floor. Dark slate flags rather than the forest's oak boards, so
  // walking into a house does not swap the region out from under the player.
  if (t === T.FLOOR) {
    ctx.fillStyle = (h % 2) ? '#1f1930' : '#221c34';
    ctx.fillRect(x, y, w, w);
    ctx.fillStyle = 'rgba(4,2,8,0.45)';
    ctx.fillRect(x, y, w, Math.max(1, s * 0.05));
    ctx.fillRect(x, y, Math.max(1, s * 0.05), w);
    ctx.fillStyle = 'rgba(107,90,148,0.14)';
    ctx.fillRect(x + s * 0.06, y + s * 0.06, s * 0.36, Math.max(1, s * 0.04));
    return true;
  }

  return false;
}

// ─── Extruded walls ───────────────────────────────────────────────────────────
// isObliqueMap returns true for every map now, so T.WALL genuinely STANDS UP:
// drawTileExtrusion (render-tiles.js) lifts each wall tile and paints a vertical
// face below its cap. That is where a shadow house's walls actually come from,
// which is why repainting the flat tile alone left them the generic #484848 —
// the flat art is only ever seen where nothing extrudes.
//
// Same three hook points and the same decline-by-returning-false contract as
// village-sprite.js's drawVillageWallFace / WallCap / DoorPanel.

// The vertical face of a lifted wall: void-stone courses, inked at both edges.
function drawUmbralWallFace(x, faceTop, ts, lift) {
  if (!umbralArtHere()) return false;
  ctx.fillStyle = '#100b18';
  ctx.fillRect(x, faceTop, ts, lift);
  // Coursed masonry. Staggered per course off the column so a long wall run
  // does not line its joints up into one continuous stripe.
  ctx.fillStyle = '#171128';
  const bed = Math.max(2, ts * 0.26);
  let n = 0;
  for (let yy = faceTop; yy < faceTop + lift; yy += bed, n++) {
    ctx.fillRect(x, yy, ts, Math.max(1, bed * 0.42));
  }
  ctx.fillStyle = 'rgba(4,2,8,0.85)';
  for (let yy = faceTop + bed; yy < faceTop + lift; yy += bed) {
    ctx.fillRect(x, yy, ts, Math.max(1, ts * 0.03));
  }
  // Ink both verticals. The right edge takes the cold rim instead of the
  // forest's white highlight, so an extruded wall agrees with the roof planes
  // about where what little light there is comes from.
  ctx.fillStyle = '#040207';
  ctx.fillRect(x, faceTop, Math.max(1, ts * 0.05), lift);
  ctx.fillStyle = 'rgba(107,90,148,0.22)';
  ctx.fillRect(x + ts - Math.max(1, ts * 0.05), faceTop, Math.max(1, ts * 0.05), lift);
  return true;
}

// The top of a lifted wall, seen from directly above.
function drawUmbralWallCap(x, y, ts) {
  if (!umbralArtHere()) return false;
  ctx.fillStyle = '#241d3a';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = '#2e2648';
  ctx.fillRect(x, y, ts, Math.max(1, ts * 0.22));
  ctx.fillStyle = '#040207';
  ctx.fillRect(x, y, ts, Math.max(1, ts * 0.06));
  ctx.fillRect(x, y, Math.max(1, ts * 0.06), ts);
  ctx.fillRect(x, y + ts - Math.max(1, ts * 0.06), ts, Math.max(1, ts * 0.06));
  return true;
}

// The door panel set into an extruded wall — the one lit thing at ground level.
function drawUmbralDoorPanel(x, y, ts) {
  if (!umbralArtHere()) return false;
  ctx.fillStyle = UMBRAL.frame;
  ctx.fillRect(x + ts * 0.08, y + ts * 0.06, ts * 0.84, ts * 0.94);
  ctx.fillStyle = UMBRAL.lit;
  ctx.fillRect(x + ts * 0.19, y + ts * 0.16, ts * 0.62, ts * 0.84);
  ctx.fillStyle = 'rgba(240,216,255,0.5)';
  ctx.fillRect(x + ts * 0.19, y + ts * 0.16, ts * 0.62, Math.max(1, ts * 0.05));
  ctx.fillStyle = UMBRAL.ink;
  ctx.lineWidth = Math.max(1, ts * 0.05);
  ctx.strokeStyle = UMBRAL.ink;
  ctx.strokeRect(x + ts * 0.08, y + ts * 0.06, ts * 0.84, ts * 0.94);
  return true;
}
