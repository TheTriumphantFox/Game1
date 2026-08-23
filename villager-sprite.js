// villager-sprite.js
// Handles loading, tinting, and drawing the villager sprite sheet.
// Relies on global `ctx` for drawing operations.
// Relies on global `VILLAGER_ATLAS` defined in villager-atlas.js.

const VILLAGER_SHEET_SRC = 'villager-sheet.png';
const VILLAGER_ATLAS_OK = typeof VILLAGER_ATLAS !== 'undefined' && !!VILLAGER_ATLAS &&
                          !!VILLAGER_ATLAS.anims && !!VILLAGER_ATLAS.dirRow &&
                          VILLAGER_ATLAS.frame > 0 && VILLAGER_ATLAS.body > 0;

let villagerSheetImg = null;
let villagerSheetState = 'idle';   // 'idle' | 'loading' | 'ready' | 'error'

// Cache for tinted sheets: key is "robe,hair,skin", value is Canvas.
const TINT_CACHE = {};

// Key colour map: hex string -> { slot, factor }
// Slots: 'robe', 'hair', 'skin'. Factors determine shading intensity.
const KEY_COLOURS = {
  '#7f0000': { slot: 'robe', factor: 0.62 },
  '#bf0000': { slot: 'robe', factor: 1.00 },
  '#ff0000': { slot: 'robe', factor: 1.28 },
  '#007f00': { slot: 'hair', factor: 0.70 },
  '#00ff00': { slot: 'hair', factor: 1.00 },
  '#00007f': { slot: 'skin', factor: 0.72 },
  '#0000bf': { slot: 'skin', factor: 1.00 },
  '#0000ff': { slot: 'skin', factor: 1.22 }
};

/**
 * Ensures the villager sheet image is loaded.
 * Creates the Image object once, attaches handlers, and sets src.
 * Called at module load time to start download immediately.
 */
function ensureVillagerSheet() {
  if (villagerSheetState !== 'idle') return;

  villagerSheetState = 'loading';
  const img = new Image();

  img.onload = function() {
    villagerSheetImg = img;
    villagerSheetState = 'ready';
  };

  img.onerror = function() {
    villagerSheetState = 'error';
  };

  img.src = VILLAGER_SHEET_SRC;
}

/**
 * Checks if the villager sheet is ready to be used.
 * Returns false if atlas is missing or image is not loaded.
 * If idle, triggers loading.
 */
function villagerSheetReady() {
  if (!VILLAGER_ATLAS_OK) return false;
  if (villagerSheetState === 'idle') {
    ensureVillagerSheet();
  }
  return villagerSheetState === 'ready';
}

/**
 * Calculates the top-left coordinates of a specific frame within the sheet.
 * @param {string} facing - Direction key ('down', etc.)
 * @param {number} col - Column index within the animation row
 * @returns {{frameX: number, frameY: number}} Coordinates in the sheet
 */
function villagerFrameXY(facing, col) {
  const atlas = VILLAGER_ATLAS;
  
  // Fallback direction if facing is not defined in atlas
  const dirRow = atlas.dirRow[facing] !== undefined ? atlas.dirRow[facing] : 0;
  
  // Calculate linear index in the sheet
  const i = dirRow * atlas.perDir + col;
  
  // Wrap around columns and calculate row
  const frameX = (i % atlas.sheetCols) * atlas.frame;
  const frameY = Math.floor(i / atlas.sheetCols) * atlas.frame;
  
  return { frameX, frameY };
}

/**
 * Helper to parse hex color string to RGB object.
 * Returns null if the input is not a valid '#rrggbb' or 'rrggbb' string.
 * @param {string} hex - Hex color string
 * @returns {{r: number, g: number, b: number}|null} Parsed color or null
 */
function parseHexColor(hex) {
  if (typeof hex !== 'string') return null;
  
  // Match exactly 6 hex digits, optionally preceded by #
  const match = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;
  
  const val = parseInt(match[1], 16);
  return {
    r: (val >> 16) & 255,
    g: (val >> 8) & 255,
    b: val & 255
  };
}

/**
 * Returns a tinted canvas for the given palette.
 * Caches results to avoid re-processing pixels for the same colors.
 * @param {string} robe - Hex color string for robe
 * @param {string} hair - Hex color string for hair
 * @param {string} skin - Hex color string for skin
 * @returns {HTMLCanvasElement|null} Tinted sheet or null if not ready or invalid colors
 */
function villagerTinted(robe, hair, skin) {
  if (!villagerSheetReady() || !villagerSheetImg) return null;

  // Validate all color inputs before processing pixels
  const robeColor = parseHexColor(robe);
  const hairColor = parseHexColor(hair);
  const skinColor = parseHexColor(skin);

  if (!robeColor || !hairColor || !skinColor) {
    return null;
  }

  const cacheKey = robe + ',' + hair + ',' + skin;
  
  // Return cached tint if available
  if (TINT_CACHE[cacheKey]) {
    return TINT_CACHE[cacheKey];
  }

  const atlas = VILLAGER_ATLAS;
  const width = villagerSheetImg.width;
  const height = villagerSheetImg.height;

  // Create offscreen canvas for the tinted sheet
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Draw original sheet onto offscreen canvas
  ctx.drawImage(villagerSheetImg, 0, 0);
  
  // Get pixel data to modify colors
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Walk through every pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a === 0) continue;

    // Create hex key for lookup
    const key = '#' + r.toString(16).padStart(2, '0') + 
                g.toString(16).padStart(2, '0') + 
                b.toString(16).padStart(2, '0');
    
    const mapping = KEY_COLOURS[key];

    // If not a key colour, leave pixel alone (fixed colours)
    if (!mapping) continue;

    // Determine target color based on slot
    let targetR, targetG, targetB;
    switch (mapping.slot) {
      case 'robe':
        targetR = robeColor.r;
        targetG = robeColor.g;
        targetB = robeColor.b;
        break;
      case 'hair':
        targetR = hairColor.r;
        targetG = hairColor.g;
        targetB = hairColor.b;
        break;
      case 'skin':
        targetR = skinColor.r;
        targetG = skinColor.g;
        targetB = skinColor.b;
        break;
      default:
        continue;
    }

    const factor = mapping.factor;
    
    // Apply shading factor to each channel
    let newR, newG, newB;

    if (factor < 1) {
      newR = targetR * factor;
      newG = targetG * factor;
      newB = targetB * factor;
    } else if (factor > 1) {
      // Brighten: add fraction of remaining headroom to 255
      newR = targetR + (255 - targetR) * (factor - 1);
      newG = targetG + (255 - targetG) * (factor - 1);
      newB = targetB + (255 - targetB) * (factor - 1);
    } else {
      // Factor is exactly 1, keep original target color
      newR = targetR;
      newG = targetG;
      newB = targetB;
    }

    // Clamp and round
    data[i]     = Math.max(0, Math.min(255, Math.round(newR)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(newG)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(newB)));
    // Alpha remains unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  
  // Cache the result
  TINT_CACHE[cacheKey] = canvas;
  
  return canvas;
}

/**
 * Draws a single villager sprite frame.
 * @param {Object} v - Villager object with .robe, .hair, .skin, .id
 * @param {number} sx - Screen X position (center-ish)
 * @param {number} sy - Screen Y position (feet-ish)
 * @param {number} s - Scale factor
 * @param {string} facing - Direction ('down', etc.)
 * @param {boolean} moving - Whether the villager is currently moving
 * @returns {boolean} True if drawn successfully, false otherwise
 */
function drawVillagerSprite(v, sx, sy, s, facing, moving) {
  if (!villagerSheetReady() || !villagerSheetImg) return false;

  const atlas = VILLAGER_ATLAS;
  
  // Determine animation to use
  const animName = moving ? 'walk' : 'idle';
  const anim = atlas.anims[animName];
  
  // Fallback to idle if walk is missing or invalid
  let msPerFrame, count, startCol;
  
  if (anim && Array.isArray(anim)) {
    msPerFrame = anim[2];
    count = anim[1];
    startCol = anim[0];
  } else {
    const fallbackAnim = atlas.anims['idle'];
    if (!fallbackAnim || !Array.isArray(fallbackAnim)) return false;
    
    msPerFrame = fallbackAnim[2];
    count = fallbackAnim[1];
    startCol = fallbackAnim[0];
  }

  // Calculate frame index with offset for crowd desync
  const frameIndex = (Math.floor(Date.now() / msPerFrame) + v.id) % count;
  const col = startCol + frameIndex;

  // Get source coordinates within the sheet
  const { frameX, frameY } = villagerFrameXY(facing, col);

  // Get tinted sheet for this palette
  // This runs once per unique palette, not per frame
  const tinted = villagerTinted(v.robe, v.hair, v.skin);
  if (!tinted) return false;

  // Calculate scale factor relative to body size
  const k = s / atlas.body;
  const frameSize = atlas.frame * k;

  // Calculate destination position on screen
  // sx/sy are reference points (e.g., feet), so we offset to draw the sprite correctly
  const destX = sx - atlas.bodyOX * k;
  const destY = sy + s * (1 - atlas.footF) - atlas.bodyOY * k;

  // Disable smoothing for crisp pixel art rendering
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  // Draw the specific frame from the tinted sheet to the screen
  ctx.drawImage(tinted, frameX, frameY, atlas.frame, atlas.frame, destX, destY, frameSize, frameSize);

  // Restore smoothing setting
  ctx.imageSmoothingEnabled = prevSmoothing;

  return true;
}

// Start loading the sheet when this script is evaluated
ensureVillagerSheet();
