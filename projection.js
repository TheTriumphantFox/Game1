// ─── Oblique projection ───────────────────────────────────────────────────────
// The single source of camera math for the 2.5D renderer.
//
// The projection is OBLIQUE, not isometric: the tile grid stays square and
// axis-aligned, and the camera just tilts. So a world tile still maps to a
// screen square, and every existing draw body keeps working. What changes is
// where a sprite's box is anchored inside that square, and that height (z)
// becomes a real axis that lifts a sprite up the screen without moving the
// ground it stands on.
//
// Everything here reads TILE_PX (config.js) and camC/camR (player.js) at CALL
// TIME, never at load time, so this file can load immediately after config.js
// even though camC/camR are declared later.
//
// Sign convention: +z is UP. A sprite at z = 1.0 is lifted one full tile edge up
// the screen. Heights and radii are in WORLD units where 1.0 is one tile edge,
// so a value reads the same at TILE_PX 48 and TILE_PX 24.

// Where a sprite box's FOOT sits, as a fraction down its tile. 1.00 is the tile
// bottom edge. This is a no-op by construction: drawEnemy currently centres its
// box vertically, which at size 1.0 puts the box bottom exactly here.
const FOOT_Y = 1.00;

// Where a ground shadow ellipse sits, as a fraction down the tile. All three
// existing shadow blocks (player, enemy, villager) already use 0.93, so
// unifying them on this constant moves nothing.
const SHADOW_Y = 0.93;

// The lift, in world units, at which an airborne shadow reaches its full shrink
// and fade. Lifted verbatim from the hero's hop arc, which peaks at 0.45 tile.
const SHADOW_AIR_FULL = 0.45;

// ─── Camera math ──────────────────────────────────────────────────────────────

// World tile column to canvas X. Fractional wx is fine and is how smoothed
// actor coordinates (player.renderX, v.renderX) glide between tiles.
function worldX(wx) {
  return (wx - camC) * TILE_PX;
}

// World tile row to canvas Y. Does NOT apply z: callers that need height pass
// through footPX or footBox instead, so there is exactly one place that decides
// which way is up.
function worldY(wy) {
  return (wy - camR) * TILE_PX;
}

// Canvas point of a ground position (wx, wy) lifted by z world units.
// wx and wy are exact world coordinates here, not a tile's top-left corner:
// this is the low-level primitive, and footBox is the one that knows about
// tile-relative anchoring.
function footPX(wx, wy, z) {
  return {
    x: worldX(wx),
    y: worldY(wy) - (z || 0) * TILE_PX
  };
}

// ─── Foot anchoring ───────────────────────────────────────────────────────────

// Top-left of an s-pixel sprite box whose FOOT is planted on tile (wx, wy) and
// which is lifted by z world units.
//
// This is the migration primitive that keeps the diff small. The ~2600 lines of
// enemy art, the 161-case tile switch and drawPlayer's body are all written
// against a top-left (px, py) plus a size s. Rather than rewrite them, derive
// that legacy top-left from a foot anchor, so only the two lines that compute
// px/py change and every drawing line below them is untouched.
//
// wx, wy are the actor's TILE coordinate (the tile's top-left, the same thing
// e.x/e.y and player.renderX/renderY already hold). The box is centred
// horizontally in that tile and its bottom lands at FOOT_Y down it.
//
// Provably a no-op at size 1.0. drawEnemy today computes ox = oy = (ts - s) / 2,
// so at s === ts both are 0 and px/py are the raw tile corner. footBox gives
// x = worldX(wx + 0.5) - ts / 2 = worldX(wx) and
// y = worldY(wy + 1.00) - ts     = worldY(wy). Identical.
//
// And it fixes a live bug at every other size. A size-0.6 goblin's boots
// currently land well above its own shadow, and the size-2.8 dragon's feet
// hover above its shadow, because a vertically centred box splits the leftover
// space between head and feet. Foot anchoring puts the boots on the ground with
// no shadow code moving at all.
//
// Returns:
//   .x, .y     box top-left, with z applied
//   .groundY   the unlifted foot line (y at z = 0), for anything that has to
//              stay planted while the body rises. Note the shadow ellipse sits
//              at SHADOW_Y, slightly above this; use groundShadow for that.
function footBox(wx, wy, z, s) {
  const gy = worldY(wy + FOOT_Y);
  return {
    x: worldX(wx + 0.5) - s / 2,
    y: gy - s - (z || 0) * TILE_PX,
    groundY: gy
  };
}

// ─── Ground shadows ───────────────────────────────────────────────────────────

// One shadow ellipse for every actor that casts one. Replaces three near
// duplicate blocks (render.js player, render-enemies.js, villagers.js) that had
// drifted to slightly different radii and alphas but shared the same anchor.
//
//   wx, wy   the actor's TILE coordinate, same as footBox takes
//   z        lift in world units. The shadow stays on the ground and tightens
//            and fades as the caster rises.
//   rx, ry   ellipse radii in WORLD units (fraction of a tile), so a caller
//            multiplies by its own size rather than by pixels
//   alpha    base opacity at z = 0
//   dx       horizontal offset in world units, for the hero's climbing sway
//   yFrac    optional override for SHADOW_Y. The only caller that needs it is
//            the fallen villager, whose body pools lower on the tile.
//   baseZ    optional height of the SURFACE the shadow is painted on, for an
//            actor standing on a ledge (5d). The ellipse is lifted onto that
//            surface, and only the height ABOVE it counts as airborne, so a
//            hero standing on a shelf casts a full shadow on the shelf rather
//            than a shrunken one on the ground a tile below him. Defaults to 0,
//            which is what every pre-5d caller means, so they are untouched.
//
// The airborne shrink and fade math is lifted verbatim from the hero's block so
// his shadow stays byte-identical. The Elderbrook interior sun offset moves in
// here too, which means all three casters pick it up instead of two of three.
function groundShadow(wx, wy, z, rx, ry, alpha, dx, yFrac, baseZ) {
  const base = baseZ || 0;
  const airT = Math.max(0, Math.min(1, ((z || 0) - base) / SHADOW_AIR_FULL));
  const shScale = 1 - 0.45 * airT;

  // Inside an intact Elderbrook home the light comes from a fixed window rather
  // than from overhead, so shadows there sit slightly down and to the side.
  const homeLight = typeof isInsideIntactElderbrookHomePosition === 'function' &&
                    isInsideIntactElderbrookHomePosition(wx, wy);
  const offX = homeLight ? 0.045 : 0;
  const offY = homeLight ? 0.018 : 0;

  const cx = worldX(wx + 0.5 + (dx || 0) + offX);
  const cy = worldY(wy + (yFrac === undefined ? SHADOW_Y : yFrac) + offY) - base * TILE_PX;

  // save/restore rather than leaking fillStyle. This deliberately preserves the
  // caller's shadowBlur, which the hero's low-HP red glow relies on: his aura is
  // set before the shadow is drawn and is meant to tint it.
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${(alpha * (1 - 0.4 * airT)).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * shScale * TILE_PX, ry * shScale * TILE_PX, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
