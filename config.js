// ─── Configuration ────────────────────────────────────────────────────────────
// Tile types, map dimensions, viewport setup, and color palette.
// All other modules import these via the global scope.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const TS = 16;          // tile size in logical px (not actually used for rendering — TILE_PX is)
const MCOLS = 150;
const MROWS = 150;

// Exit gate positions — centre of each border edge
const EXIT_COL = Math.floor(MCOLS / 2);
const EXIT_ROW = Math.floor(MROWS / 2);

// Dynamic viewport — fills the window, recomputed on resize
let TILE_PX = 48;       // rendered pixels per tile (zoom level)
let VCOLS = 1, VROWS = 1, PW = 1, PH = 1;

// Tile type enum. Numeric so we can store maps as Uint8Array for fast (de)serialization.
const T = {
  GRASS:0, TREE:1, WATER:2, PATH:3, WALL:4, FLOOR:5,
  CHEST:6, DOOR:7, ROCK:8, SAND:9, FLOWER:10, DUNGEON_DOOR:11,
  DEEP_WATER:12, LAVA:13, BRIDGE:14, PILLAR:15, TORCH:16, STATUE:17,
  SHRINE:18, MUSHROOM:19, FERN:20,
  CAVE_ENTRANCE:21, CAVE_EXIT:22, LARGE_CHEST:23, CAVE_FLOOR:24,
  INN_DOOR:25, STORE_DOOR:26
};

// Fallback colors used by the minimap renderer (richer art in render.js)
const TILE_COLORS = {
  [T.GRASS]: '#3a7a3a', [T.TREE]: '#1a4a1a', [T.WATER]: '#2255aa',
  [T.PATH]: '#8a7050', [T.WALL]: '#484848', [T.FLOOR]: '#9a7550',
  [T.CHEST]: '#7a4400', [T.DOOR]: '#663399', [T.ROCK]: '#777',
  [T.SAND]: '#d4b070', [T.FLOWER]: '#4a8a3a', [T.DUNGEON_DOOR]: '#220033',
  [T.DEEP_WATER]: '#112266', [T.LAVA]: '#cc2200', [T.BRIDGE]: '#885522',
  [T.PILLAR]: '#555', [T.TORCH]: '#663300', [T.STATUE]: '#888',
  [T.SHRINE]: '#225522', [T.MUSHROOM]: '#3a7a3a', [T.FERN]: '#3a7a3a',
  [T.CAVE_ENTRANCE]: '#0a0a0a', [T.CAVE_EXIT]: '#332266',
  [T.LARGE_CHEST]: '#cc8800', [T.CAVE_FLOOR]: '#3a2a1a',
  [T.INN_DOOR]: '#aa3322', [T.STORE_DOOR]: '#33aa55',
};

// Resize canvas to fill viewport minus HUD/bottom bars. Called once at boot and on resize.
function resizeCanvas() {
  const hudH  = document.getElementById('hud')?.offsetHeight        || 0;
  const msgH  = document.getElementById('msg-bar')?.offsetHeight    || 0;
  const wepH  = document.getElementById('weapon-bar')?.offsetHeight || 0;
  const ctrlH = document.getElementById('ctrl-bar')?.offsetHeight   || 0;
  const saveH = document.getElementById('save-row')?.offsetHeight   || 0;
  const usedH = hudH + msgH + wepH + ctrlH + saveH;
  canvas.width  = window.innerWidth;
  canvas.height = Math.max(window.innerHeight - usedH, 200);
  PW = canvas.width;
  PH = canvas.height;
  VCOLS = Math.ceil(PW / TILE_PX) + 2;
  VROWS = Math.ceil(PH / TILE_PX) + 2;
  // clampCam might not be defined yet at first call
  if (typeof clampCam === 'function') clampCam();
}
window.addEventListener('resize', resizeCanvas);
