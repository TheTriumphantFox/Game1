-- Build the player sprite sheet for The RPG Game, drawn from the painted
-- character portrait (hero-portrait.png) rather than from drawPlayer().
--
-- The portrait is the character's real design and differs from what the game
-- currently draws procedurally: a female elf knight in dark weathered plate,
-- a large verdigris tree-of-life shield on her off arm, a heavy forest cloak,
-- long swept-back ears, and the sword carried high. drawPlayer's bright-silver
-- palette and missing shield are approximations of that art; this sheet goes
-- back to the source.
--
-- 64x64 frames. Per direction: idle(2) + walk(4) + sword(5) = 11 frames,
-- four directions, 44 frames total, tagged per animation.
--
-- Regenerate:
--   aseprite --batch --script-param out=hero-sheet.aseprite \
--            --script tools/make-hero-sheet.lua

local W, H   = 64, 64
local DIRS   = { "down", "up", "left", "right" }
local N_IDLE, N_WALK, N_PUNCH, N_SWING = 2, 4, 4, 5
-- unarmed idle+walk+punch, then armed idle+walk+sword
local PER_DIR = N_IDLE + N_WALK + N_PUNCH + N_IDLE + N_WALK + N_SWING
local S       = 48.0
local OX, OY  = 8.0, 7.0

----------------------------------------------------------------------
-- palette sampled from hero-portrait.png
----------------------------------------------------------------------
local function hex(h)
  return app.pixelColor.rgba(
    tonumber(h:sub(2, 3), 16),
    tonumber(h:sub(4, 5), 16),
    tonumber(h:sub(6, 7), 16), 255)
end

local STEEL_D  = hex('#3f4340')   -- weathered plate, deep shadow
local STEEL    = hex('#636761')
local STEEL_L  = hex('#9aa09a')
local STEEL_H  = hex('#c6ccc4')   -- rim light
local CLOAK_D  = hex('#253a20')
local CLOAK    = hex('#3b5c31')
local CLOAK_L  = hex('#56803f')
local HAIR_D   = hex('#9c7530')
local HAIR     = hex('#d0a54a')
local HAIR_L   = hex('#f2dc93')
local SKIN     = hex('#ecc9a0')
local SKIN_D   = hex('#c39a72')
local EAR_T    = hex('#d9a184')   -- ears catch warm backlight in the portrait
local GOLD     = hex('#b8934a')
local GOLD_D   = hex('#7e6229')
local SHIELD_F = hex('#6d7f58')   -- verdigris field
local SHIELD_D = hex('#4d5c3e')
local TREE     = hex('#dfe3da')   -- silver tree of life
local LEATHER  = hex('#5a4128')
local LEATHER_D= hex('#33230f')
local EYE      = hex('#4a7a5e')   -- green
local WHITE    = hex('#ffffff')
local OUTLINE  = hex('#12100c')

----------------------------------------------------------------------
-- rasteriser
----------------------------------------------------------------------
local function X(f) return OX + f * S end
local function Y(f) return OY + f * S end

local function px(img, x, y, c)
  x = math.floor(x); y = math.floor(y)
  if x < 0 or y < 0 or x >= W or y >= H then return end
  img:drawPixel(x, y, c)
end

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

local function polyPx(img, P, c)
  local miny, maxy = 1e9, -1e9
  for i = 1, #P do
    if P[i][2] < miny then miny = P[i][2] end
    if P[i][2] > maxy then maxy = P[i][2] end
  end
  for y = math.max(0, math.floor(miny)), math.min(H - 1, math.ceil(maxy)) do
    local yc, xs, n = y + 0.5, {}, #P
    for i = 1, n do
      local j = (i % n) + 1
      local ax, ay, bx, by = P[i][1], P[i][2], P[j][1], P[j][2]
      if (ay <= yc and by > yc) or (by <= yc and ay > yc) then
        xs[#xs + 1] = ax + (yc - ay) / (by - ay) * (bx - ax)
      end
    end
    table.sort(xs)
    for k = 1, #xs - 1, 2 do
      for x = math.floor(xs[k] + 0.5), math.floor(xs[k + 1] + 0.5) - 1 do
        px(img, x, y, c)
      end
    end
  end
end

local function polyF(img, P, c)
  local Q = {}
  for i = 1, #P do Q[i] = { X(P[i][1]), Y(P[i][2]) } end
  polyPx(img, Q, c)
end

local function ellipsePx(img, cx, cy, rx, ry, c)
  for y = math.max(0, math.floor(cy - ry)), math.min(H - 1, math.ceil(cy + ry)) do
    for x = math.max(0, math.floor(cx - rx)), math.min(W - 1, math.ceil(cx + rx)) do
      local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
      if dx * dx + dy * dy <= 1.0 then px(img, x, y, c) end
    end
  end
end

local function ellipseF(img, fcx, fcy, frx, fry, c)
  ellipsePx(img, X(fcx), Y(fcy), frx * S, fry * S, c)
end

local function linePx(img, x0, y0, x1, y1, wdt, c)
  local dx, dy = x1 - x0, y1 - y0
  local steps = math.max(1, math.ceil(math.max(math.abs(dx), math.abs(dy)) * 2))
  local r = wdt / 2
  for i = 0, steps do
    local t = i / steps
    local cx, cy = x0 + dx * t, y0 + dy * t
    for y = math.floor(cy - r), math.ceil(cy + r) do
      for x = math.floor(cx - r), math.ceil(cx + r) do
        local ddx, ddy = x + 0.5 - cx, y + 0.5 - cy
        if ddx * ddx + ddy * ddy <= r * r + 0.25 then px(img, x, y, c) end
      end
    end
  end
end

local function lineF(img, fx0, fy0, fx1, fy1, wdt, c)
  linePx(img, X(fx0), Y(fy0), X(fx1), Y(fy1), wdt, c)
end

local function outlineSilhouette(img, col)
  local solid = {}
  for y = 0, H - 1 do
    solid[y] = {}
    for x = 0, W - 1 do
      solid[y][x] = app.pixelColor.rgbaA(img:getPixel(x, y)) > 0
    end
  end
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      if not solid[y][x] then
        if (x > 0 and solid[y][x-1]) or (x < W-1 and solid[y][x+1]) or
           (y > 0 and solid[y-1][x]) or (y < H-1 and solid[y+1][x]) then
          img:drawPixel(x, y, col)
        end
      end
    end
  end
end

----------------------------------------------------------------------
-- pieces
----------------------------------------------------------------------

-- Heavy forest cloak. Hangs from the shoulders and stops above the boots so
-- the legs stay legible; sway trails the walk cycle.
local function drawCloak(img, sway, bob)
  local b = bob
  polyF(img, { {0.28,0.33+b}, {0.72,0.33+b}, {0.84+sway,0.82+b}, {0.16+sway,0.82+b} }, CLOAK_D)
  polyF(img, { {0.28,0.33+b}, {0.50,0.33+b}, {0.50+sway,0.82+b}, {0.16+sway,0.82+b} }, CLOAK)
  lineF(img, 0.50, 0.36+b, 0.50+sway, 0.81+b, 1.0, CLOAK_D)
  lineF(img, 0.34, 0.40+b, 0.27+sway, 0.81+b, 1.0, CLOAK_L)
  lineF(img, 0.66, 0.40+b, 0.74+sway, 0.81+b, 1.0, hex('#1b2b17'))
end

-- Armoured legs with plated greaves, and boots. `swing` moves the feet through
-- the walk cycle: vertically head-on, fore/aft in profile.
local function drawLegs(img, facing, swing, bob)
  local isSide = (facing == 'left' or facing == 'right')
  local b = bob
  local aX, bX, aY, bY = 0.34, 0.53, b, b
  if isSide then
    aX, bX = 0.34 + swing * 1.6, 0.50 - swing * 1.6
  else
    aY, bY = b + swing, b - swing
  end
  -- back leg first so the near leg overlaps it
  for _, L in ipairs({ { bX, bY, STEEL_D, LEATHER_D }, { aX, aY, STEEL, LEATHER } }) do
    local lx, ly, plate, boot = L[1], L[2], L[3], L[4]
    rectF(img, lx, 0.72 + ly, 0.13, 0.16, plate)
    rectF(img, lx, 0.72 + ly, 0.13, 0.02, STEEL_L)     -- knee cop
    rectF(img, lx - 0.01, 0.86 + ly, 0.15, 0.09, boot)
    rectF(img, lx - 0.01, 0.86 + ly, 0.15, 0.02, LEATHER)
    rectF(img, lx - 0.01, 0.935 + ly, 0.15, 0.025, hex('#1a1206'))
  end
end

-- Torso: female cuirass with the portrait's deep V neckline, layered pauldrons,
-- bronze filigree, belt and the green sash that hangs off it.
local function drawTorso(img, facing, bob)
  local isSide = (facing == 'left' or facing == 'right')
  local b = bob
  local L, R = 0.30, 0.70
  if isSide then L, R = 0.34, 0.66 end

  -- tassets / skirt plates
  polyF(img, { {L+0.02,0.60+b}, {R-0.02,0.60+b}, {R+0.02,0.74+b}, {L-0.02,0.74+b} }, LEATHER)
  polyF(img, { {0.50,0.60+b}, {R-0.02,0.60+b}, {R+0.02,0.74+b}, {0.50,0.74+b} }, LEATHER_D)
  lineF(img, 0.38, 0.62+b, 0.36, 0.73+b, 1.0, STEEL_D)
  lineF(img, 0.62, 0.62+b, 0.64, 0.73+b, 1.0, STEEL_D)

  -- cuirass
  polyF(img, { {L,0.37+b}, {R,0.37+b}, {R,0.55+b}, {0.50,0.63+b}, {L,0.55+b} }, STEEL)
  polyF(img, { {0.50,0.37+b}, {R,0.37+b}, {R,0.55+b}, {0.50,0.63+b} }, STEEL_D)
  -- breast curve highlights
  ellipseF(img, 0.42, 0.455+b, 0.075, 0.065, STEEL_L)
  ellipseF(img, 0.585, 0.455+b, 0.075, 0.065, STEEL)
  ellipseF(img, 0.405, 0.44+b, 0.035, 0.03, STEEL_H)
  -- deep V neckline
  polyF(img, { {0.415,0.365+b}, {0.585,0.365+b}, {0.50,0.50+b} }, SKIN_D)
  polyF(img, { {0.435,0.365+b}, {0.565,0.365+b}, {0.50,0.475+b} }, SKIN)
  lineF(img, 0.415, 0.365+b, 0.50, 0.50+b, 1.0, GOLD)
  lineF(img, 0.585, 0.365+b, 0.50, 0.50+b, 1.0, GOLD_D)
  -- bronze filigree down the flanks
  lineF(img, L+0.03, 0.40+b, L+0.05, 0.54+b, 1.0, GOLD_D)
  lineF(img, R-0.03, 0.40+b, R-0.05, 0.54+b, 1.0, GOLD_D)

  -- belt, buckle, and the green sash hanging from it
  rectF(img, L-0.01, 0.575+b, (R-L)+0.02, 0.045, LEATHER_D)
  rectF(img, 0.475, 0.567+b, 0.055, 0.06, GOLD)
  rectF(img, 0.489, 0.582+b, 0.026, 0.032, GOLD_D)
  polyF(img, { {0.40,0.60+b}, {0.50,0.60+b}, {0.48,0.80+b}, {0.37,0.78+b} }, CLOAK)
  lineF(img, 0.43, 0.63+b, 0.42, 0.77+b, 1.0, CLOAK_D)

  -- pauldrons: layered plates with a bright top edge
  local function pauldron(cx)
    ellipseF(img, cx, 0.415+b, 0.095, 0.075, STEEL_D)
    ellipseF(img, cx, 0.405+b, 0.085, 0.062, STEEL_L)
    ellipseF(img, cx, 0.392+b, 0.070, 0.042, STEEL_H)
    lineF(img, cx-0.075, 0.445+b, cx+0.075, 0.445+b, 1.0, GOLD_D)
  end
  if isSide then
    pauldron(facing == 'left' and 0.38 or 0.62)
    rectF(img, facing == 'left' and 0.34 or 0.54, 0.46+b, 0.12, 0.14, LEATHER)
    rectF(img, facing == 'left' and 0.34 or 0.54, 0.50+b, 0.12, 0.035, STEEL_L)  -- vambrace
  else
    pauldron(0.24); pauldron(0.76)
    rectF(img, 0.20, 0.46+b, 0.10, 0.15, LEATHER)
    rectF(img, 0.70, 0.46+b, 0.10, 0.15, LEATHER)
    rectF(img, 0.20, 0.50+b, 0.10, 0.035, STEEL_L)
    rectF(img, 0.70, 0.50+b, 0.10, 0.035, STEEL_L)
  end
end

-- The signature piece: a big verdigris shield with the silver tree of life,
-- carried on the off arm. Absent from drawPlayer entirely.
local function drawShield(img, facing, bob)
  if facing == 'up' then return end          -- reads as the shield's back
  local cx = (facing == 'left') and 0.22 or 0.78
  if facing == 'right' then cx = 0.80 end
  if facing == 'left'  then cx = 0.20 end
  local cy = 0.52 + bob
  local rx, ry = 0.165, 0.205

  ellipseF(img, cx, cy, rx, ry, STEEL_L)                 -- rim
  ellipseF(img, cx, cy, rx * 0.86, ry * 0.88, SHIELD_D)  -- rolled edge
  ellipseF(img, cx, cy, rx * 0.74, ry * 0.78, SHIELD_F)  -- field
  -- engraved border dots
  ellipseF(img, cx, cy - ry * 0.86, 0.016, 0.014, STEEL_H)
  ellipseF(img, cx, cy + ry * 0.86, 0.016, 0.014, STEEL_H)

  -- Tree of life. Everything is 1px with field showing between: a filled
  -- canopy at this size collapses the whole emblem into a white smear.
  local tx, ty = X(cx), Y(cy)
  local RX, RY = rx * S, ry * S
  linePx(img, tx, ty + RY*0.60, tx, ty - RY*0.18, 1.4, TREE)          -- trunk
  linePx(img, tx, ty + RY*0.16, tx - RX*0.44, ty - RY*0.16, 1.0, TREE)
  linePx(img, tx, ty + RY*0.16, tx + RX*0.44, ty - RY*0.16, 1.0, TREE)
  linePx(img, tx, ty - RY*0.14, tx - RX*0.34, ty - RY*0.50, 1.0, TREE)
  linePx(img, tx, ty - RY*0.14, tx + RX*0.34, ty - RY*0.50, 1.0, TREE)
  -- leaf clusters at the branch tips only
  ellipsePx(img, tx,             ty - RY*0.46, 1.6, 1.4, TREE)
  ellipsePx(img, tx - RX*0.40,   ty - RY*0.56, 1.3, 1.2, TREE)
  ellipsePx(img, tx + RX*0.40,   ty - RY*0.56, 1.3, 1.2, TREE)
  ellipsePx(img, tx - RX*0.50,   ty - RY*0.20, 1.2, 1.1, TREE)
  ellipsePx(img, tx + RX*0.50,   ty - RY*0.20, 1.2, 1.1, TREE)
  -- root flare
  linePx(img, tx, ty + RY*0.60, tx - RX*0.26, ty + RY*0.70, 1.0, TREE)
  linePx(img, tx, ty + RY*0.60, tx + RX*0.26, ty + RY*0.70, 1.0, TREE)
end

-- Head: long swept ears, windswept blonde, green eyes.
local function drawHead(img, facing, bob)
  local b = bob

  if facing == 'up' then
    -- back of the head: the mane, plus the windswept lock trailing to one side
    polyF(img, { {0.60,0.16+b}, {0.74,0.20+b}, {0.86,0.46+b}, {0.70,0.44+b} }, HAIR_D)
    ellipseF(img, 0.50, 0.22+b, 0.195, 0.175, HAIR_D)
    ellipseF(img, 0.50, 0.205+b, 0.165, 0.145, HAIR)
    ellipseF(img, 0.50, 0.165+b, 0.105, 0.065, HAIR_L)
    lineF(img, 0.42, 0.13+b, 0.40, 0.30+b, 1.0, HAIR_D)
    lineF(img, 0.58, 0.13+b, 0.61, 0.30+b, 1.0, HAIR_D)
    -- ear tips just clear the hair
    polyF(img, { {0.31,0.20+b}, {0.19,0.13+b}, {0.315,0.26+b} }, EAR_T)
    polyF(img, { {0.69,0.20+b}, {0.81,0.13+b}, {0.685,0.26+b} }, EAR_T)
    return
  end

  -- hair mass behind the head, sweeping to the character's right
  polyF(img, { {0.58,0.14+b}, {0.74,0.19+b}, {0.88,0.44+b}, {0.68,0.42+b} }, HAIR_D)
  lineF(img, 0.70, 0.22+b, 0.84, 0.41+b, 1.0, HAIR)
  ellipseF(img, 0.50, 0.21+b, 0.185, 0.165, HAIR_D)

  -- long pointed ears, angled up and back
  if facing == 'right' then
    polyF(img, { {0.34,0.175+b}, {0.19,0.10+b}, {0.35,0.255+b} }, EAR_T)
    lineF(img, 0.33, 0.175+b, 0.22, 0.125+b, 1.0, SKIN_D)
  elseif facing == 'left' then
    polyF(img, { {0.66,0.175+b}, {0.81,0.10+b}, {0.65,0.255+b} }, EAR_T)
    lineF(img, 0.67, 0.175+b, 0.78, 0.125+b, 1.0, SKIN_D)
  else
    polyF(img, { {0.345,0.18+b}, {0.20,0.105+b}, {0.355,0.26+b} }, EAR_T)
    polyF(img, { {0.655,0.18+b}, {0.80,0.105+b}, {0.645,0.26+b} }, EAR_T)
    lineF(img, 0.335, 0.18+b, 0.23, 0.13+b, 1.0, SKIN_D)
    lineF(img, 0.665, 0.18+b, 0.77, 0.13+b, 1.0, SKIN_D)
  end

  -- face
  ellipseF(img, 0.50, 0.225+b, 0.135, 0.145, SKIN_D)
  ellipseF(img, 0.492, 0.215+b, 0.115, 0.125, SKIN)

  -- swept fringe, parted off-centre as in the portrait
  polyF(img, { {0.355,0.09+b}, {0.65,0.09+b}, {0.66,0.20+b}, {0.545,0.145+b},
               {0.47,0.205+b}, {0.40,0.15+b}, {0.35,0.21+b} }, HAIR)
  rectF(img, 0.43, 0.088+b, 0.15, 0.022, HAIR_L)
  lineF(img, 0.40, 0.115+b, 0.375, 0.19+b, 1.0, HAIR_D)
  lineF(img, 0.62, 0.115+b, 0.645, 0.19+b, 1.0, HAIR_D)

  if facing == 'down' then
    rectF(img, 0.405, 0.215+b, 0.055, 0.042, EYE)
    rectF(img, 0.545, 0.215+b, 0.055, 0.042, EYE)
    rectF(img, 0.418, 0.222+b, 0.018, 0.016, WHITE)
    rectF(img, 0.558, 0.222+b, 0.018, 0.016, WHITE)
    rectF(img, 0.402, 0.202+b, 0.06, 0.012, HAIR_D)
    rectF(img, 0.542, 0.202+b, 0.06, 0.012, HAIR_D)
    rectF(img, 0.492, 0.252+b, 0.018, 0.016, SKIN_D)
    rectF(img, 0.468, 0.283+b, 0.062, 0.012, hex('#b07f63'))
  else
    local ex = (facing == 'right') and 0.545 or 0.40
    rectF(img, ex, 0.215+b, 0.07, 0.042, EYE)
    rectF(img, ex + ((facing == 'right') and 0.04 or 0.0), 0.222+b, 0.016, 0.016, WHITE)
    rectF(img, ex, 0.202+b, 0.07, 0.012, HAIR_D)
    rectF(img, (facing == 'right') and 0.615 or 0.365, 0.255+b, 0.02, 0.016, SKIN_D)

    -- A lock swept across the far side of the face. In profile only one eye is
    -- ever visible, which reads as a missing eye rather than a hidden one; this
    -- covers where the second would sit, stopping short of the near eye.
    if facing == 'right' then
      polyF(img, { {0.385,0.095+b}, {0.545,0.095+b}, {0.535,0.185+b},
                   {0.495,0.265+b}, {0.435,0.245+b}, {0.380,0.160+b} }, HAIR)
      lineF(img, 0.500, 0.115+b, 0.478, 0.250+b, 1.0, HAIR_D)
      lineF(img, 0.435, 0.110+b, 0.416, 0.220+b, 1.0, HAIR_L)
    else
      polyF(img, { {0.615,0.095+b}, {0.455,0.095+b}, {0.465,0.185+b},
                   {0.505,0.265+b}, {0.565,0.245+b}, {0.620,0.160+b} }, HAIR)
      lineF(img, 0.500, 0.115+b, 0.522, 0.250+b, 1.0, HAIR_D)
      lineF(img, 0.565, 0.110+b, 0.584, 0.220+b, 1.0, HAIR_L)
    end
  end
end

----------------------------------------------------------------------
-- sword
----------------------------------------------------------------------
local SW_CX, SW_CY    = 32.0, 30.0
local SW_HILT, SW_LEN = 10.0, 30.0
local BASE_ANGLE = { down = math.pi/2, up = -math.pi/2, left = math.pi, right = 0.0 }
-- Carried high, as in the portrait. Pivoted at the sword hand (opposite the
-- shield) and angled near-vertical so the blade rises beside the head instead
-- of cutting across her face.
local IDLE_ANGLE = { down = -1.75, up = -1.75, left = -1.35, right = -1.75 }
local IDLE_PIVOT = {
  down = {23.0, 34.0}, up = {23.0, 34.0}, left = {41.0, 34.0}, right = {23.0, 34.0},
}

local function drawBlade(img, a, bob, trail, cx, cy0)
  local cy = cy0 + bob * S
  local bx, by = cx + math.cos(a)*SW_HILT, cy + math.sin(a)*SW_HILT
  local tx, ty = cx + math.cos(a)*SW_LEN,  cy + math.sin(a)*SW_LEN
  local mx, my = cx + math.cos(a)*(SW_LEN-5), cy + math.sin(a)*(SW_LEN-5)
  local gx, gy = cx + math.cos(a)*3.0, cy + math.sin(a)*3.0
  local nx, ny = -math.sin(a), math.cos(a)

  if trail then
    for k = 2, 1, -1 do
      local ta = a - 0.26*k
      linePx(img, cx+math.cos(ta)*(SW_HILT+3), cy+math.sin(ta)*(SW_HILT+3),
                  cx+math.cos(ta)*(SW_LEN-2),  cy+math.sin(ta)*(SW_LEN-2),
                  (k==2) and 1.0 or 1.8, (k==2) and STEEL_D or STEEL_L)
    end
  end

  linePx(img, bx, by, tx, ty, 5.4, OUTLINE)
  linePx(img, bx+nx*5.5, by+ny*5.5, bx-nx*5.5, by-ny*5.5, 4.6, OUTLINE)
  linePx(img, gx, gy, bx, by, 4.2, OUTLINE)

  -- grip, pommel, and the portrait's ornate swept crossguard
  linePx(img, gx, gy, bx, by, 2.6, LEATHER_D)
  linePx(img, gx, gy, bx, by, 1.0, LEATHER)
  ellipsePx(img, gx, gy, 2.2, 2.2, GOLD)
  ellipsePx(img, gx, gy, 1.0, 1.0, GOLD_D)
  linePx(img, bx+nx*4.6, by+ny*4.6, bx-nx*4.6, by-ny*4.6, 2.8, STEEL_L)
  linePx(img, bx+nx*4.6, by+ny*4.6, bx-nx*4.6, by-ny*4.6, 1.0, STEEL_D)
  ellipsePx(img, bx+nx*4.6, by+ny*4.6, 1.4, 1.4, GOLD)
  ellipsePx(img, bx-nx*4.6, by-ny*4.6, 1.4, 1.4, GOLD)

  -- blade: body, tapered point, fuller, lit edge
  linePx(img, bx, by, mx, my, 3.6, STEEL_L)
  linePx(img, mx, my, tx, ty, 1.8, STEEL_L)
  linePx(img, bx, by, mx, my, 1.0, STEEL)
  linePx(img, bx-nx*1.3, by-ny*1.3, mx-nx*1.3, my-ny*1.3, 1.0, STEEL_H)
end

----------------------------------------------------------------------
-- punch: the pre-weapon jab. player.hasSword is false until prologue Beat 5,
-- and render.js is explicit that no blade may be drawn before the player owns
-- one -- so the unarmed poses carry no sword at all.
----------------------------------------------------------------------
local DIR_VEC = { down = {0,1}, up = {0,-1}, left = {-1,0}, right = {1,0} }

local function drawFist(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local reach = math.sin(phase * math.pi) * S * 0.55
  local cy0 = 30 + bob * S
  local cx, cy = SW_CX + d[1]*reach, cy0 + d[2]*reach
  local r = S * 0.095
  -- forearm back to the body
  linePx(img, SW_CX + d[1]*5, cy0 + d[2]*5, cx, cy, r*1.25, OUTLINE)
  linePx(img, SW_CX + d[1]*5, cy0 + d[2]*5, cx, cy, r*0.75, LEATHER)
  linePx(img, SW_CX + d[1]*6, cy0 + d[2]*6, cx - d[1]*r*1.4, cy - d[2]*r*1.4, r*0.4, STEEL_L)
  -- fist
  ellipsePx(img, cx, cy, r*1.35, r*1.35, OUTLINE)
  ellipsePx(img, cx, cy, r*1.00, r*1.00, SKIN_D)
  ellipsePx(img, cx - r*0.22, cy - r*0.22, r*0.70, r*0.70, SKIN)
end

----------------------------------------------------------------------
-- frame assembly
----------------------------------------------------------------------
local ARMED = { idle_armed = true, walk_armed = true, sword = true }

local function drawFrame(img, facing, kind, i, n)
  local bob, sway, swing, a, trail = 0, 0, 0, IDLE_ANGLE[facing], false
  local pcx, pcy = IDLE_PIVOT[facing][1], IDLE_PIVOT[facing][2]
  local punchPhase = nil

  if kind == 'idle' or kind == 'idle_armed' then
    bob = (i == 2) and (1.0 / S) or 0
  elseif kind == 'walk' or kind == 'walk_armed' then
    local t = (i - 1) / n
    swing = math.sin(t * math.pi * 2) * 0.045
    bob   = (math.abs(math.sin(t * math.pi * 2)) > 0.5) and (-1.0 / S) or 0
    sway  = -math.sin(t * math.pi * 2) * 0.05
  elseif kind == 'punch' then
    -- Sampled off the endpoints: sin(0) and sin(pi) are both zero reach, which
    -- parks the fist on her chest instead of showing a jab.
    punchPhase = (i - 0.5) / n
    bob = (punchPhase > 0.3 and punchPhase < 0.7) and (-1.0 / S) or 0
  else -- sword: pivots at the body centre so the arc reads as a real sweep
    local phase = (i - 1) / (n - 1)
    local arc = math.pi * 0.85
    a = BASE_ANGLE[facing] - arc/2 + arc*phase
    trail = phase > 0.05
    bob = (phase > 0.15 and phase < 0.85) and (-1.0 / S) or 0
    pcx, pcy = SW_CX, SW_CY
  end

  drawCloak(img, sway, bob)
  drawLegs(img, facing, swing, bob)
  drawTorso(img, facing, bob)
  -- off-arm shield sits behind the blade but in front of the body
  drawShield(img, facing, bob)
  drawHead(img, facing, bob)
  outlineSilhouette(img, OUTLINE)

  if punchPhase then
    drawFist(img, facing, punchPhase, bob)
  elseif ARMED[kind] then
    drawBlade(img, a, bob, trail, pcx, pcy)
  end
end

local KINDS = {
  { 'idle',       N_IDLE,  0.28  },   -- unarmed: before prologue Beat 5
  { 'walk',       N_WALK,  0.11  },
  { 'punch',      N_PUNCH, 0.037 },   -- punchTimer is 150ms
  { 'idle_armed', N_IDLE,  0.28  },   -- armed: sword carried high
  { 'walk_armed', N_WALK,  0.11  },
  { 'sword',      N_SWING, 0.036 },   -- swordTimer is 180ms
}

local spr = Sprite(W, H, ColorMode.RGB)
local lay = spr.layers[1]
lay.name = "hero"

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
print("wrote " .. app.params["out"] .. "  frames=" .. #spr.frames .. " tags=" .. #spr.tags)
