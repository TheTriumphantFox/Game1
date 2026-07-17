// ─── Fog of war ───────────────────────────────────────────────────────────────
// Each map has a Uint8Array of MCOLS*MROWS bytes where 0 = hidden, 1 = revealed.
// Created lazily on first reveal. Persisted with the map across save/load.

function ensureFog(mapObj) {
  if (!mapObj.fog) {
    mapObj.fog = new Uint8Array(MCOLS * MROWS);
  }
}

// Reveal a circular area around (cx, cy). Called whenever the player moves.
function revealAround(mapObj, cx, cy, radius) {
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
  if (!mapObj.fog) return true;
  return mapObj.fog[r * MCOLS + c] === 0;
}
