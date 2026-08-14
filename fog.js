// ─── Fog of war ───────────────────────────────────────────────────────────────
// Each map has a Uint8Array of MCOLS*MROWS bytes where 0 = hidden, 1 = revealed.
// Created lazily on first reveal. Persisted with the map across save/load.

function ensureFog(mapObj) {
  if (!mapObj.fog) {
    mapObj.fog = new Uint8Array(MCOLS * MROWS);
  }
}

// Elderbrook is exempt. It's the player's own village — they know every house
// on it before the game opens — so it's never fogged, whole or ruined (both
// states are type 'homevillage'; see createHomeVillageMap in world.js).
// Answered here rather than by pre-filling a revealed fog array (the idiom an
// activated village and the throne hall use) because this also covers saves
// written back when the village still had partial fog stored: those restore
// their old fog byte-for-byte in save.js, and the save format is unchanged.
function isFoglessMap(mapObj) {
  return mapObj.type === 'homevillage';
}

// How far ordinary walking sees. 12 tiles everywhere, 14 in a region whose
// shrine has been solved — stage 8's fog half of the shrine payoff. Vantage
// points (peaks, towers, the 14/16-tile reveals in player.js) are a different
// thing entirely and are left as the literals they are: they describe what can
// be seen from up there, not how clear the air is.
const WALK_REVEAL_RADIUS = 12;
const WALK_REVEAL_CLEANSED = 14;

function walkRevealRadius(mapObj) {
  if (typeof isRegionCleansed !== 'function' || typeof mapRegionIndex !== 'function') {
    return WALK_REVEAL_RADIUS;
  }
  // The necrotic pall eats sight until the hero is carrying the Ember Lantern
  // (abilities.js). It beats the cleansing bonus: a region can be clean of the
  // blight and still be the region where nothing carries light.
  if (typeof necroticSightPenalty === 'function' && necroticSightPenalty(mapObj)) {
    return NECROTIC_REVEAL;
  }
  return isRegionCleansed(mapRegionIndex(mapObj)) ? WALK_REVEAL_CLEANSED : WALK_REVEAL_RADIUS;
}

// Reveal what walking reveals. Every "the hero moved / arrived" call site goes
// through here rather than passing 12 itself, so the cleansing bonus applies
// everywhere at once and there is one place to change if it ever moves again.
function revealWalk(mapObj, cx, cy) {
  revealAround(mapObj, cx, cy, walkRevealRadius(mapObj));
}

// Reveal a circular area around (cx, cy). Called whenever the player moves.
function revealAround(mapObj, cx, cy, radius) {
  if (isFoglessMap(mapObj)) return;   // nothing to reveal — see isFoglessMap
  ensureFog(mapObj);
  const r2 = radius * radius;
  // The player re-reveals the same disc every step, so only the thin crescent of
  // genuinely new tiles matters. Stamp just those onto the cached minimap instead
  // of flagging a full MROWS*MCOLS rebuild — the full rescan cost ~9ms/step on a
  // large mostly-revealed map (e.g. a castle-tower floor) and dropped the frame
  // rate whenever the map was held open. A full rebuild is still requested only
  // when the map's minimap canvas doesn't exist yet (first open builds it whole).
  let revealedAny = false;
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dc * dc + dr * dr <= r2) {
        const r = cy + dr, c = cx + dc;
        if (r >= 0 && r < MROWS && c >= 0 && c < MCOLS) {
          const idx = r * MCOLS + c;
          if (mapObj.fog[idx] === 0) {
            mapObj.fog[idx] = 1;
            revealedAny = true;
            paintMinimapTile(mapObj, c, r);
          }
        }
      }
    }
  }
  if (revealedAny && !minimapCanvases[mapObj.id]) minimapDirty = true;
}

function isFoggy(mapObj, c, r) {
  if (isFoglessMap(mapObj)) return false;
  if (!mapObj.fog) return true;
  return mapObj.fog[r * MCOLS + c] === 0;
}

// ─── Fog serialization ────────────────────────────────────────────────────────
// Fog is one bit per tile but was persisted as `Array.from(fog)` — a JSON array of
// 22,500 numbers, 45,001 characters per map. That is 1.5x the size of the entire
// base64 tile map for the map itself, and at the 232 maps the save UI advertises it
// worked out to ~10 MB of a ~16.6 MB save, which does not fit in the ~5 MB per-origin
// localStorage budget a phone gives you.
//
// Packing eight tiles to the byte and base64-ing the result takes the same data to
// 2,813 bytes -> 3,752 characters, a ~12x reduction. Same idea and same encoding as
// encodeMap/decodeMap in map-helpers.js, one bit wide instead of one byte.
//
// Written under a NEW key (`fogPacked`), leaving the old `fog` array untouched in
// saves that already have one — the loader reads whichever is present, so an existing
// save keeps working and is quietly upgraded the next time it is written.
function packFog(fog) {
  const n = MCOLS * MROWS;
  const bytes = new Uint8Array((n + 7) >> 3);
  for (let i = 0; i < n; i++) if (fog[i]) bytes[i >> 3] |= 1 << (i & 7);
  // Chunked so a large map can't overflow the argument limit on String.fromCharCode.
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function unpackFog(b64) {
  const bin = atob(b64);
  const n = MCOLS * MROWS;
  const fog = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) fog[i] = 1;
  }
  return fog;
}
