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
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dc * dc + dr * dr <= radius * radius) {
        const r = cy + dr, c = cx + dc;
        if (r >= 0 && r < MROWS && c >= 0 && c < MCOLS) {
          mapObj.fog[r * MCOLS + c] = 1;
        }
      }
    }
  }
  minimapDirty = true;  // minimap cache needs rebuild
}

function isFoggy(mapObj, c, r) {
  if (!mapObj.fog) return true;
  return mapObj.fog[r * MCOLS + c] === 0;
}
