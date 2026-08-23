local W, H   = 96, 96
local S      = 48.0
local OX, OY = 24.0, 24.0
local FOOT_F = 0.96
local DIRS   = { "down", "up", "left", "right" }
local N_IDLE, N_WALK = 2, 4
local PER_DIR    = N_IDLE + N_WALK
local SHEET_COLS = 24

local lib = dofile("tools/aseprite-lib.lua")
local hex = lib.hex

local raster = lib.newRaster(W, H)
local px, polyPx, ellipsePx, linePx, outlineSilhouette =
  raster.px, raster.polyPx, raster.ellipsePx, raster.linePx, raster.outlineSilhouette

local function X(f) return OX + f * S end
local function Y(f) return OY + f * S end

local function rectF(img, fx, fy, fw, fh, c)
  local ix0 = math.floor(X(fx) + 0.5)
  local iy0 = math.floor(Y(fy) + 0.5)
  local ix1 = math.floor(X(fx) + fw * S + 0.5)
  local iy1 = math.floor(Y(fy) + fh * S + 0.5)
  if ix1 <= ix0 then ix1 = ix0 + 1 end
  if iy1 <= iy0 then iy1 = iy0 + 1 end
  for y = iy0, iy1 - 1 do
    for x = ix0, ix1 - 1 do px(img, x, y, c) end
  end
end

local function polyF(img, P, c)
  local Q = {}
  for i = 1, #P do Q[i] = { X(P[i][1]), Y(P[i][2]) } end
  polyPx(img, Q, c)
end

local function ellipseF(img, fcx, fcy, frx, fry, c)
  ellipsePx(img, X(fcx), Y(fcy), frx * S, fry * S, c)
end

local LINE_W = 1.0 / S
local function lineF(img, fx0, fy0, fx1, fy1, wf, c)
  linePx(img, X(fx0), Y(fy0), X(fx1), Y(fy1), wf * S, c)
end

local ROBE_D  = hex('#7f0000')
local ROBE_M  = hex('#bf0000')
local ROBE_L  = hex('#ff0000')
local HAIR_D  = hex('#007f00')
local HAIR_M  = hex('#00ff00')
local SKIN_D  = hex('#00007f')
local SKIN_M  = hex('#0000bf')
local SKIN_L  = hex('#0000ff')
local OUTLINE = hex('#12100c')
local BOOT_D  = hex('#2a1c0d')
local BOOT    = hex('#4a3319')
local BELT    = hex('#6d4d28')
local EYE     = hex('#1a1a22')
local WHITE   = hex('#ffffff')

-- drawVillager
local function drawVillager(img, facing, bob, swing)
  local b = bob

  -- LEGS
  if facing == 'left' or facing == 'right' then
    local d = (facing == 'right') and 1 or -1
    local ls1 = swing * 1.7
    local ls2 = -swing * 1.7
    rectF(img, 0.5-0.040+ls1, 0.700+b, 0.080, 0.160, SKIN_D)
    rectF(img, 0.5-0.048+ls1, 0.860+b, 0.096, 0.075, BOOT_D)
    rectF(img, 0.5-0.048+ls1, 0.935+b, 0.096+0.020, 0.025, BOOT_D)

    rectF(img, 0.5-0.040+ls2, 0.700+b, 0.080, 0.160, SKIN_M)
    rectF(img, 0.5-0.048+ls2, 0.860+b, 0.096, 0.075, BOOT)
    rectF(img, 0.5-0.048+ls2, 0.935+b, 0.096+0.020, 0.025, BOOT_D)
  else
    for _, dx in ipairs({-0.055, 0.055}) do
      local ls = (dx < 0) and swing or -swing
      rectF(img, 0.5+dx-0.040, 0.700+ls+b, 0.080, 0.160, SKIN_M)
      rectF(img, 0.5+dx-0.040, 0.700+ls+b, 0.080, 0.020, SKIN_D)
      rectF(img, 0.5+dx-0.048, 0.860+ls+b, 0.096, 0.075, BOOT)
      rectF(img, 0.5+dx-0.048, 0.935+ls+b, 0.096, 0.025, BOOT_D)
    end
  end

  -- TUNIC
  if facing == 'left' or facing == 'right' then
    polyF(img, { {0.400,0.050+b}, {0.600,0.050+b}, {0.580,0.330+b},
                 {0.615,0.700+b}, {0.385,0.700+b}, {0.420,0.330+b} }, ROBE_M)
    polyF(img, { {0.500,0.050+b}, {0.600,0.050+b}, {0.580,0.330+b},
                 {0.615,0.700+b}, {0.500,0.700+b} }, ROBE_D)
    rectF(img, 0.400, 0.050+b, 0.070, 0.022, ROBE_L)
    rectF(img, 0.415, 0.330+b, 0.170, 0.045, BELT)
  else
    polyF(img, { {0.365,0.050+b}, {0.635,0.050+b}, {0.605,0.330+b},
                 {0.645,0.700+b}, {0.355,0.700+b}, {0.395,0.330+b} }, ROBE_M)
    polyF(img, { {0.500,0.050+b}, {0.635,0.050+b}, {0.605,0.330+b},
                 {0.645,0.700+b}, {0.500,0.700+b} }, ROBE_D)
    rectF(img, 0.365, 0.050+b, 0.090, 0.022, ROBE_L)
    lineF(img, 0.372, 0.075+b, 0.360, 0.690+b, LINE_W, ROBE_L)
    rectF(img, 0.390, 0.330+b, 0.220, 0.045, BELT)
  end

  -- ARMS
  if facing == 'left' or facing == 'right' then
    local d = (facing == 'right') and 1 or -1
    rectF(img, 0.5+d*0.055-0.035, 0.070+b-swing*0.8, 0.070, 0.150, ROBE_D)
    rectF(img, 0.5+d*0.055-0.035, 0.070+b-swing*0.8, 0.022, 0.150, ROBE_M)
    ellipseF(img, 0.5+d*0.058, 0.245+b-swing*0.8, 0.036, 0.032, SKIN_M)
    ellipseF(img, 0.5+d*0.050, 0.238+b-swing*0.8, 0.020, 0.018, SKIN_L)
  else
    for _, sx in ipairs({-1, 1}) do
      rectF(img, 0.5+sx*0.135-0.035, 0.070+b, 0.070, 0.170, ROBE_M)
      ellipseF(img, 0.5+sx*0.145, 0.270+b, 0.038, 0.034, SKIN_M)
      if sx == -1 then
        rectF(img, 0.5-0.135-0.035, 0.070+b, 0.022, 0.170, ROBE_L)
      end
    end
  end

  -- NECK
  if facing == 'left' or facing == 'right' then
    local d = (facing == 'right') and 1 or -1
    rectF(img, 0.470, -0.010+b, 0.070, 0.060, SKIN_D)
  else
    rectF(img, 0.462, -0.010+b, 0.076, 0.060, SKIN_D)
  end

  -- HEAD
  if facing == 'left' or facing == 'right' then
    local d = (facing == 'right') and 1 or -1
    ellipseF(img, 0.500+d*0.018, -0.070+b, 0.090, 0.078, SKIN_M)
    ellipseF(img, 0.500+d*0.030, -0.085+b, 0.060, 0.050, SKIN_L)
    polyF(img, { {0.500+d*0.100, -0.085+b}, {0.500+d*0.125, -0.062+b},
                 {0.500+d*0.095, -0.055+b} }, SKIN_M)
  else
    ellipseF(img, 0.500, -0.070+b, 0.095, 0.078, SKIN_M)
    ellipseF(img, 0.480, -0.085+b, 0.070, 0.055, SKIN_L)
    ellipseF(img, 0.545, -0.055+b, 0.048, 0.055, SKIN_D)
  end

  -- HAIR
  if facing == 'up' then
    ellipseF(img, 0.500, -0.085+b, 0.115, 0.075, HAIR_M)
    ellipseF(img, 0.545, -0.075+b, 0.065, 0.060, HAIR_D)
    rectF(img, 0.386, -0.100+b, 0.030, 0.095, HAIR_D)
    rectF(img, 0.584, -0.100+b, 0.030, 0.095, HAIR_D)
    rectF(img, 0.420, -0.020+b, 0.160, 0.030, HAIR_D)
  elseif facing == 'left' or facing == 'right' then
    local d = (facing == 'right') and 1 or -1
    ellipseF(img, 0.500-d*0.010, -0.100+b, 0.105, 0.060, HAIR_M)
    ellipseF(img, 0.500-d*0.050, -0.080+b, 0.060, 0.075, HAIR_D)
    rectF(img, 0.500-d*0.110-0.014, -0.105+b, 0.028, 0.095, HAIR_D)
  else
    ellipseF(img, 0.500, -0.100+b, 0.110, 0.060, HAIR_M)
    ellipseF(img, 0.550, -0.092+b, 0.058, 0.052, HAIR_D)
    rectF(img, 0.390, -0.105+b, 0.028, 0.085, HAIR_D)
    rectF(img, 0.582, -0.105+b, 0.028, 0.085, HAIR_D)
    rectF(img, 0.405, -0.062+b, 0.190, 0.016, HAIR_M)
  end

  -- EYES
  if facing == 'left' or facing == 'right' then
    local d = (facing == 'right') and 1 or -1
    rectF(img, 0.500+d*0.055-0.021, -0.075+b, 0.0417, 0.0208, EYE)
  elseif facing == 'down' then
    rectF(img, 0.4375, -0.075+b, 0.0417, 0.0208, EYE)
    rectF(img, 0.5208, -0.075+b, 0.0417, 0.0208, EYE)
    rectF(img, 0.4375, -0.096+b, 0.0208, 0.0208, WHITE)
  end

  outlineSilhouette(img, OUTLINE)
end

-- drawFrame
local function drawFrame(img, facing, kind, i, n)
  local bob, swing = 0, 0
  if kind == 'idle' then
    bob = (i == 2) and (1.0 / S) or 0
  else
    local t = (i - 1) / n
    swing = math.sin(t * math.pi * 2) * 0.055
    bob = (math.abs(math.sin(t * math.pi * 2)) > 0.5) and (-1.0 / S) or 0
  end
  drawVillager(img, facing, bob, swing)
end

-- Sheet assembly
local KINDS = { { 'idle', N_IDLE, 0.40 }, { 'walk', N_WALK, 0.13 } }

local spr = Sprite(W, H, ColorMode.RGB)
local lay = spr.layers[1]
lay.name = "villager"
local total = #DIRS * PER_DIR
while #spr.frames < total do spr:newFrame() end

for d = 1, #DIRS do
  local facing = DIRS[d]
  local base = (d - 1) * PER_DIR
  local cursor = 0
  for _, K in ipairs(KINDS) do
    local kind, n, dur = K[1], K[2], K[3]
    for i = 1, n do
      local f = base + cursor + i
      local img = Image(W, H, ColorMode.RGB)
      img:clear()
      drawFrame(img, facing, kind, i, n)
      if lay:cel(f) then spr:deleteCel(lay, f) end
      spr:newCel(lay, f, img, Point(0, 0))
      spr.frames[f].duration = dur
    end
    local tag = spr:newTag(base + cursor + 1, base + cursor + n)
    tag.name = kind .. "_" .. facing
    cursor = cursor + n
  end
end

spr:saveAs(app.params["out"])
print("wrote " .. app.params["out"] .. "  frames=" .. #spr.frames)

-- Atlas tail
local atlasPath = app.params["atlas"] or "villager-atlas.js"
local af = io.open(atlasPath, "wb")
if not af then error("cannot write " .. atlasPath .. " (run from the repo root)") end
local ms = function (sec) return math.floor(sec * 1000 + 0.5) end
af:write("// GENERATED by tools/make-villager-sheet.lua. Do not edit by hand.\n")
af:write("const VILLAGER_ATLAS = {\n")
af:write(string.format("  frame: %d,\n", W))
af:write(string.format("  body: %d,\n", math.floor(S + 0.5)))
af:write(string.format("  bodyOX: %d,\n", math.floor(OX + 0.5)))
af:write(string.format("  bodyOY: %d,\n", math.floor(OY + 0.5)))
af:write(string.format("  footF: %s,\n", tostring(FOOT_F)))
af:write(string.format("  perDir: %d,\n", PER_DIR))
af:write(string.format("  sheetCols: %d,\n", SHEET_COLS))
af:write("  dirRow: {")
for d = 1, #DIRS do
  af:write(string.format("%s %s: %d", d > 1 and "," or "", DIRS[d], d - 1))
end
af:write(" },\n")
af:write("  anims: {\n")
local cursor = 0
for _, K in ipairs(KINDS) do
  af:write(string.format("    %s: [%d, %d, %d],\n", K[1], cursor, K[2], ms(K[3])))
  cursor = cursor + K[2]
end
af:write("  },\n};\n")
af:close()
print("wrote " .. atlasPath)
