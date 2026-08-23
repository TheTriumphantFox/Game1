-- Build the forest-village building sheet for The RPG Game, drawn from the
-- village concept art (concept-art/village-layouts/01-village-of-the-lost.png)
-- rather than from the procedural roof/wall code.
--
-- The concept sketch is a painted top-down interpretation, not a tile render,
-- so this is a translation rather than a trace. What it fixes, specifically:
-- the cottages in game are gradient-filled polygons with ruled shingle lines,
-- and the art shows staggered wooden shingle courses inside a heavy dark timber
-- frame with a pale ridge beam across the middle. The fountain in game is a
-- flat blue square inside a ring of grey pillars; the art shows a cream marble
-- colonnade around a bright cyan basin.
--
-- 48x48 frames, 3 columns, 8 rows = 24 frames (22 used, 2 reserved). 48 because
-- that is TILE_PX's default, so the sheet blits 1:1 at the standard zoom and
-- scales cleanly to the 24 the phone check measured.
--
-- The frames are a NINE-SLICE for the roof plus a handful of standalone tiles,
-- not an animation, so nothing here is tagged. Rows 0-4 are the roof bands read
-- top to bottom (north eave, north slope, ridge, south slope, south fascia),
-- each row being that band's west / centre / east piece. render.js tiles the
-- centre pieces across a house and caps the run with the west/east ones.
--
-- Step 1 also writes village-atlas.js, the frame layout the game reads at
-- runtime. Same reasoning as hero-atlas.js: a .js file assigning a global,
-- because the game is opened from file:// where fetch cannot read a sibling
-- .json. village-sheet.json stays a build artefact for humans.
--
-- Regenerate (run from the repo root, so dofile finds tools/aseprite-lib.lua):
--   aseprite -b --script-param out=village-sheet.aseprite --script tools/make-village-sheet.lua
--   aseprite -b village-sheet.aseprite --sheet village-sheet.png --data village-sheet.json ^
--            --format json-array --sheet-type rows --sheet-columns 3
--
-- Two steps for the same reason make-hero-sheet.lua needs two: the sprite this
-- script builds is not left "open" for the CLI's own --sheet/--data flags when
-- they are chained onto the same invocation as --script. No --list-tags here,
-- because a tileset has no tags to list.

local S    = 48          -- one tile
local COLS = 3
local ROWS = 8
local N_FRAMES = COLS * ROWS

local lib = dofile("tools/aseprite-lib.lua")
local R   = lib.newRaster(S, S)
local hex = lib.hex

----------------------------------------------------------------------
-- palette, sampled from 01-village-of-the-lost.png
----------------------------------------------------------------------
-- Every value below was read out of the concept PNG with a dominant-colour
-- scan over the named region, not eyeballed. The roof samples come from a
-- cottage at (220,130)-(360,240); the marble and water from the fountain at
-- (520,500)-(740,720). Where a ramp needed more steps than the sketch's soft
-- painted gradient provides, the extra steps are interpolated between two
-- sampled ends rather than invented at a new hue.

-- Roof. The north (upper) slope reads lighter than the south in the art, which
-- is the same upper-left key light aseprite-lib.LIGHT_DIR describes, so the two
-- slopes get separate ramps instead of one ramp plus an overlay.
local SH_N_D  = hex('#805b2e')   -- north slope, course shadow
local SH_N    = hex('#a97c44')   -- north slope, base           (sampled)
local SH_N_L  = hex('#c09055')   -- north slope, lit shingle lip
local SH_S_D  = hex('#6c4c27')   -- south slope, course shadow  (sampled)
local SH_S    = hex('#7d5a2c')   -- south slope, base           (sampled)
local SH_S_L  = hex('#966b3a')   -- south slope, lit shingle lip(sampled)

local FRAME_D = hex('#241608')   -- timber frame around the whole roof
local FRAME_L = hex('#3f2814')   -- its inner, lit edge
local OUTLINE = hex('#0c0907')   -- the art's near-black ink line (sampled)

local RIDGE   = hex('#a97c44')   -- ridge beam body             (sampled)
local RIDGE_L = hex('#c9a86e')   -- ridge beam highlight
local RIDGE_D = hex('#4a3018')   -- shadow either side of the beam

-- Timber walls. Only ever seen from directly above in Village of the Lost,
-- where the roof lifts once the player steps inside; Elderbrook extrudes them,
-- which is what wall_face is for.
local TIM_D   = hex('#4a3320')
local TIM     = hex('#6b4a2c')
local TIM_L   = hex('#8a6440')
local TIM_H   = hex('#a67c50')
local IRON    = hex('#2b2725')
local BRASS   = hex('#d6a84f')

-- Marble. The fountain colonnade and the plaza it stands on.
local MAR_L   = hex('#e0d5c2')   -- (sampled)
local MAR     = hex('#cdc4b3')   -- (sampled)
local MAR_D   = hex('#908b7b')   -- (sampled)
local MAR_DD  = hex('#7c7564')   -- (sampled)

-- Water. Brighter and greener than the game's #3366cc fountain fill, which is
-- the single biggest colour difference between the sketch and what ships.
local WAT_D   = hex('#14688c')
local WAT     = hex('#1b7ba4')   -- (sampled)
local WAT_L   = hex('#2f9fc8')
local WAT_H   = hex('#6fc4e0')
local FOAM    = hex('#bfe8f5')

----------------------------------------------------------------------
-- primitives
----------------------------------------------------------------------

local function rect(img, x, y, w, h, c)
  for j = y, y + h - 1 do
    for i = x, x + w - 1 do R.px(img, i, j, c) end
  end
end

local function fill(img, c) rect(img, 0, 0, S, S, c) end

local function hline(img, x, y, w, c) rect(img, x, y, w, 1, c) end
local function vline(img, x, y, h, c) rect(img, x, y, 1, h, c) end

-- Deterministic value noise, so every frame's mottling is identical on every
-- regeneration. Aseprite's math.random is not seeded the same way across
-- versions, and the sheet is committed, so it has to be reproducible from the
-- coordinates alone.
local function hash01(x, y, salt)
  local n = (x * 374761393 + y * 668265263 + (salt or 0) * 2147483647) % 4294967296
  n = (n ~ (n >> 13)) * 1274126177 % 4294967296
  return ((n ~ (n >> 16)) % 1000) / 1000
end

----------------------------------------------------------------------
-- shingle field
----------------------------------------------------------------------
-- Staggered courses, exactly as the concept cottages are painted: horizontal
-- bands of shingles with the vertical joints of each band offset half a shingle
-- from the band above, so it reads as overlapping material rather than a grid.
--
-- COURSE 8 and SHINGLE 12 both divide 48 exactly, which is what lets a fill
-- frame repeat against itself with no seam in either axis. Six courses per
-- tile is an even number, so the alternating half-offset also carries across
-- the tile boundary (course 5 is odd, the next tile's course 0 is even).
-- Changing either constant to something that does not divide 48 puts a visible
-- seam down every tile edge.
local COURSE  = 8
local SHINGLE = 12

local function shingles(img, x0, y0, x1, y1, dark, base, lit)
  for y = y0, y1 do
    local course = y // COURSE
    local inCourse = y % COURSE
    local offset = (course % 2) * (SHINGLE // 2)
    for x = x0, x1 do
      local c = base
      if inCourse == COURSE - 1 then
        c = dark                                    -- the course's own shadow
      elseif inCourse == 0 then
        c = lit                                     -- the lip catching the key light
      elseif (x + offset) % SHINGLE == 0 then
        c = dark                                    -- joint between two shingles
      elseif hash01(x, y, 7) > 0.94 then
        c = dark                                    -- weathering fleck
      end
      R.px(img, x, y, c)
    end
  end
end

----------------------------------------------------------------------
-- roof frame beams
----------------------------------------------------------------------
-- The heavy dark border the concept art draws around every roof. Two pixels of
-- ink, then four of timber, then one lit inner edge: at TILE_PX 24 that still
-- resolves to a dark line rather than mush, which a single-pixel outline does
-- not.

local function beamTop(img)
  hline(img, 0, 0, S, OUTLINE); hline(img, 0, 1, S, OUTLINE)
  rect(img, 0, 2, S, 4, FRAME_D)
  hline(img, 0, 6, S, FRAME_L)
end

local function beamBottom(img)
  hline(img, 0, S - 1, S, OUTLINE); hline(img, 0, S - 2, S, OUTLINE)
  rect(img, 0, S - 6, S, 4, FRAME_D)
  hline(img, 0, S - 7, S, FRAME_L)
end

local function beamLeft(img)
  vline(img, 0, 0, S, OUTLINE); vline(img, 1, 0, S, OUTLINE)
  rect(img, 2, 0, 4, S, FRAME_D)
  vline(img, 6, 0, S, FRAME_L)
end

local function beamRight(img)
  vline(img, S - 1, 0, S, OUTLINE); vline(img, S - 2, 0, S, OUTLINE)
  rect(img, S - 6, 0, 4, S, FRAME_D)
  vline(img, S - 7, 0, S, FRAME_L)
end

----------------------------------------------------------------------
-- roof bands
----------------------------------------------------------------------
-- side is -1 (west piece), 0 (centre) or 1 (east piece).

local function addVerge(img, side)
  if side < 0 then beamLeft(img) elseif side > 0 then beamRight(img) end
end

-- Row 0 — north eave. The roof's top edge: ink, timber beam, then shingles.
local function frameNorthEave(img, side)
  shingles(img, 0, 0, S - 1, S - 1, SH_N_D, SH_N, SH_N_L)
  beamTop(img)
  addVerge(img, side)
end

-- Row 1 — north slope fill.
local function frameNorthSlope(img, side)
  shingles(img, 0, 0, S - 1, S - 1, SH_N_D, SH_N, SH_N_L)
  addVerge(img, side)
end

-- Row 2 — the ridge. North shingles above, the pale beam across the middle,
-- south shingles below. The two shadow bands either side of the beam are what
-- make the roof fold rather than change colour.
local function frameRidge(img, side)
  shingles(img, 0, 0, S - 1, 17, SH_N_D, SH_N, SH_N_L)
  shingles(img, 0, 30, S - 1, S - 1, SH_S_D, SH_S, SH_S_L)
  rect(img, 0, 18, S, 2, RIDGE_D)
  rect(img, 0, 20, S, 8, RIDGE)
  hline(img, 0, 21, S, RIDGE_L)
  hline(img, 0, 22, S, RIDGE_L)
  rect(img, 0, 28, S, 2, RIDGE_D)
  -- Peg holes along the beam, the way the sketch dots its ridge timber.
  for x = 5, S - 5, 11 do rect(img, x, 24, 2, 2, RIDGE_D) end
  addVerge(img, side)
end

-- Row 3 — south slope fill.
local function frameSouthSlope(img, side)
  shingles(img, 0, 0, S - 1, S - 1, SH_S_D, SH_S, SH_S_L)
  addVerge(img, side)
end

-- Row 4 — south fascia. The eave the player looks at head-on, so it carries the
-- thickest timber and a cast shadow below it.
local function frameFascia(img, side)
  shingles(img, 0, 0, S - 1, S - 1, SH_S_D, SH_S, SH_S_L)
  beamBottom(img)
  hline(img, 0, S - 8, S, RIDGE_D)
  addVerge(img, side)
end

----------------------------------------------------------------------
-- walls and door
----------------------------------------------------------------------

-- Seen from directly above: planks running east-west along the wall run.
local function frameWallCap(img)
  fill(img, TIM_L)
  for y = 0, S - 1 do
    local inPlank = y % 12
    for x = 0, S - 1 do
      local c = TIM_L
      if inPlank == 11 then c = TIM_D
      elseif inPlank == 0 then c = TIM_H
      elseif hash01(x, y, 3) > 0.93 then c = TIM end
      R.px(img, x, y, c)
    end
  end
  -- Nail heads, two per plank, on a fixed grid so a wall run does not shimmer.
  for y = 3, S - 1, 12 do
    for x = 7, S - 1, 22 do rect(img, x, y, 2, 2, IRON) end
  end
end

-- The extruded side of a wall (Elderbrook only today): vertical boards.
local function frameWallFace(img)
  for y = 0, S - 1 do
    for x = 0, S - 1 do
      local c = TIM
      local inBoard = x % 8
      if inBoard == 7 then c = TIM_D
      elseif inBoard == 0 then c = TIM_L
      elseif hash01(x, y, 11) > 0.95 then c = TIM_D end
      R.px(img, x, y, c)
    end
  end
  -- Head beam, so a run of face tiles has a lintel line at the top rather than
  -- reading as boards that continue forever upward.
  rect(img, 0, 0, S, 3, FRAME_D)
  hline(img, 0, 3, S, TIM_H)
end

local function frameDoor(img)
  frameWallFace(img)
  -- Jambs and lintel: the opening is cut out of the wall, so the masonry
  -- surround is drawn first and the door panel set inside it.
  rect(img, 0, 0, 5, S, TIM_D)
  rect(img, S - 5, 0, 5, S, TIM_D)
  rect(img, 0, 0, S, 6, TIM_D)
  vline(img, 5, 6, S - 6, OUTLINE)
  vline(img, S - 6, 6, S - 6, OUTLINE)
  hline(img, 5, 6, S - 10, OUTLINE)
  -- Plank panel.
  for y = 7, S - 1 do
    for x = 6, S - 7 do
      local c = hex('#7a5230')
      if (x - 6) % 9 == 8 then c = hex('#4b2f18')
      elseif (x - 6) % 9 == 0 then c = hex('#94663d') end
      R.px(img, x, y, c)
    end
  end
  -- Strap hinges and a brass ring, the hardware the sketch puts on every door.
  for _, y in ipairs({ 14, 34 }) do
    rect(img, 6, y, S - 12, 4, IRON)
    rect(img, 9, y + 1, 2, 2, MAR_D)
    rect(img, S - 12, y + 1, 2, 2, MAR_D)
  end
  R.ellipsePx(img, 36, 26, 3, 3, BRASS)
  R.ellipsePx(img, 36, 26, 1, 1, IRON)
end

----------------------------------------------------------------------
-- fountain
----------------------------------------------------------------------
-- basin and spout are OPAQUE and full-tile: they are intercepted in drawTile,
-- which returns before anything paints a base square, so they supply their own.
--
-- pillar_cap is the exception and is TRANSPARENT around the column. It used to
-- carry its own marble ground, and that was wrong in a way only visible in the
-- game: the plaza it stands on is T.MARBLE, whose art is a hashed variant with
-- eight different vein patterns, so a flat marble square baked into this frame
-- left every column sitting on a visibly different, veinless tile. The renderer
-- draws the real plaza tile underneath instead.

local function framePillarCap(img)
  -- Cast shadow to the lower-right, opposite the key light.
  R.ellipsePx(img, 26, 27, 18, 18, MAR_DD)
  -- Column: ink ring, body, then the lip of the capital.
  R.ellipsePx(img, 23, 23, 18, 18, OUTLINE)
  R.ellipsePx(img, 23, 23, 16, 16, MAR_D)
  R.ellipsePx(img, 22, 22, 15, 15, MAR_L)
  R.ellipsePx(img, 23, 23, 12, 12, OUTLINE)
  R.ellipsePx(img, 23, 23, 11, 11, MAR)
  R.ellipsePx(img, 22, 22, 10, 10, MAR_L)
  -- Fluting: short ticks around the capital's lower arc.
  for k = 0, 11 do
    local a = math.pi * (0.10 + k * 0.075)
    local x = 23 + math.cos(a) * 13.5
    local y = 23 + math.sin(a) * 13.5
    R.px(img, math.floor(x), math.floor(y), MAR_D)
    R.px(img, math.floor(x), math.floor(y) + 1, MAR_D)
  end
end

-- Open water inside the basin. Deliberately a texture and not a motif: this
-- frame repeats across the whole 5x5 basin, and any recognisable shape in it
-- would tile into an obvious grid. The basin's centrepiece lives on the spout.
local function frameBasin(img)
  for y = 0, S - 1 do
    for x = 0, S - 1 do
      local n = hash01(x // 2, y // 2, 33)
      local c = WAT
      if n > 0.90 then c = WAT_L elseif n < 0.14 then c = WAT_D end
      R.px(img, x, y, c)
    end
  end
  -- Slow drifting ripple lines, in the two lighter blues.
  for _, band in ipairs({ { 11, WAT_L }, { 27, WAT_H }, { 40, WAT_L } }) do
    local y0, c = band[1], band[2]
    for x = 0, S - 1 do
      local y = y0 + math.floor(math.sin(x * 0.26) * 2.0)
      R.px(img, x, y, c)
    end
  end
end

-- The spout tile: the fountain's one piece of centre-stage art, matching the
-- rosette the sketch paints in the middle of the basin.
local function frameSpout(img)
  frameBasin(img)
  for r = 20, 4, -4 do
    R.ellipsePx(img, 24, 24, r, r, r % 8 == 0 and WAT_H or WAT_L)
  end
  R.ellipsePx(img, 24, 24, 7, 7, FOAM)
  R.ellipsePx(img, 24, 24, 4, 4, hex('#ffffff'))
  -- Droplets thrown clear of the plume.
  for _, p in ipairs({ { 11, 13 }, { 36, 12 }, { 13, 35 }, { 37, 34 }, { 24, 8 } }) do
    R.ellipsePx(img, p[1], p[2], 2, 2, FOAM)
  end
end

-- The basin's marble lip. Authored with the lip along the NORTH edge only;
-- village-sprite.js rotates it for the other three sides, which is why the art
-- must not contain anything that reads as up.
--
-- This is the one TRANSPARENT frame on the sheet, and it has to be: a corner
-- water tile takes two lips, and an opaque frame would have the second wipe the
-- first. It overlays a basin tile that is always drawn first.
local function frameBasinEdge(img)
  rect(img, 0, 0, S, 6, MAR_L)
  rect(img, 0, 6, S, 3, MAR_D)
  hline(img, 0, 9, S, OUTLINE)
  -- The lip's shadow falling onto the water below it.
  rect(img, 0, 10, S, 3, WAT_D)
end

----------------------------------------------------------------------
-- assembly
----------------------------------------------------------------------
-- Frame order IS the atlas, and both are written from this one table so they
-- cannot drift. Index in this list == frame index == the number village-atlas.js
-- hands the renderer.

local FRAMES = {
  { 'roof_nw',    function (i) frameNorthEave(i, -1)  end },
  { 'roof_n',     function (i) frameNorthEave(i,  0)  end },
  { 'roof_ne',    function (i) frameNorthEave(i,  1)  end },

  { 'roof_w',     function (i) frameNorthSlope(i, -1) end },
  { 'roof_c',     function (i) frameNorthSlope(i,  0) end },
  { 'roof_e',     function (i) frameNorthSlope(i,  1) end },

  { 'ridge_w',    function (i) frameRidge(i, -1)      end },
  { 'ridge_c',    function (i) frameRidge(i,  0)      end },
  { 'ridge_e',    function (i) frameRidge(i,  1)      end },

  { 'roof_sw',    function (i) frameSouthSlope(i, -1) end },
  { 'roof_s',     function (i) frameSouthSlope(i,  0) end },
  { 'roof_se',    function (i) frameSouthSlope(i,  1) end },

  { 'fascia_w',   function (i) frameFascia(i, -1)     end },
  { 'fascia_c',   function (i) frameFascia(i,  0)     end },
  { 'fascia_e',   function (i) frameFascia(i,  1)     end },

  { 'wall_cap',   frameWallCap  },
  { 'wall_face',  frameWallFace },
  { 'door_face',  frameDoor     },

  { 'pillar_cap', framePillarCap },
  { 'spout',      frameSpout     },
  { 'basin',      frameBasin     },

  { 'basin_edge', frameBasinEdge },
}

local spr = Sprite(S, S, ColorMode.RGB)
local lay = spr.layers[1]
lay.name = "village"

while #spr.frames < N_FRAMES do spr:newFrame() end

for f = 1, N_FRAMES do
  local img = Image(S, S, ColorMode.RGB)
  img:clear()
  local entry = FRAMES[f]
  if entry then entry[2](img) end          -- frames past the list stay empty
  if lay:cel(f) then spr:deleteCel(lay, f) end
  spr:newCel(lay, f, img, Point(0, 0))
end

spr:saveAs(app.params["out"])
print("wrote " .. app.params["out"] .. "  frames=" .. #spr.frames)

----------------------------------------------------------------------
-- village-atlas.js
----------------------------------------------------------------------

local atlasPath = app.params["atlas"] or "village-atlas.js"
local af = io.open(atlasPath, "wb")
if not af then
  error("cannot write " .. atlasPath .. " (run from the repo root)")
end

af:write("// GENERATED by tools/make-village-sheet.lua. Do not edit by hand.\n")
af:write("//\n")
af:write("// Regenerate with the two commands in that script's header, from the\n")
af:write("// repo root. This file is written by step 1, alongside the .aseprite.\n")
af:write("//\n")
af:write("// Loaded as a plain script (no modules, no fetch) so it works from\n")
af:write("// file://, and read by village-sprite.js.\n")
af:write("const VILLAGE_ATLAS = {\n")
af:write(string.format("  tile: %d,\n", S))
af:write(string.format("  cols: %d,\n", COLS))
af:write("  frames: {\n")
for i = 1, #FRAMES do
  af:write(string.format("    %s: %d,\n", FRAMES[i][1], i - 1))
end
af:write("  },\n")
af:write("};\n")
af:close()
print("wrote " .. atlasPath)
