-- Build the Adult Red Dragon (the Red Dragon Emperor) sprite sheet.
--
-- Ported from the procedural art in render-enemies.js `case 'adult_red_dragon'`,
-- which is the creature's only existing reference -- there is no painted portrait
-- for him the way there is for the hero. Shapes, draw order and every palette
-- hex come from that switch arm; the additions are a 1px silhouette outline and
-- the crown.
--
-- THE CROWN is new. The story bible calls him "the one who wears the crown" and
-- tower.js rolls a gold circlet off his corpse, but the sprite never wore one.
-- It is gold #ffd24a to match drawEmperorCrown.
--
-- Facing: the front rows came first. Back and side views (2026-11-15) were
-- appended after them so no existing index moved; the game picks one from
-- creatureFacing and mirrors the side for left (dragon-sprite.js). Dormant and
-- the cinematic flyfire stay front-only.
--   dormant 0-3, awake 4-11, fly 12-17, run 18-23,
--   breathe 24-29, fight 30-35, flyfire 36-41
--   awake_back 42-49, fly_back 50-55, run_back 56-61, breathe_back 62-67,
--   fight_back 68-73, awake_side 74-81, fly_side 82-87, run_side 88-93,
--   breathe_side 94-99, fight_side 100-105
--
-- Soft additive FX are deliberately NOT baked in: the boss aura, chest furnace
-- glow, rising embers and nostril smoke stay procedural in render-enemies.js so
-- they keep their own periods and alpha.
--
-- Regenerate (run from the repo root; verified byte-identical to the
-- committed dragon-sheet.png/.json/.aseprite on aseprite 1.3.18.2-dev):
--   aseprite -b --script-param out=dragon-sheet.aseprite --script tools/make-dragon-sheet.lua
--   aseprite -b dragon-sheet.aseprite --sheet dragon-sheet.png --data dragon-sheet.json ^
--            --format json-array --sheet-type rows --sheet-columns 6 --list-tags
--
-- Two steps because the sprite the script builds is not left "open" for the
-- CLI's own --sheet/--data flags to see when they are chained onto the same
-- invocation as --script; --list-tags is required or frameTags is omitted
-- from the JSON. --sheet-columns matches SHEET_COLS below.

local W, H    = 168, 168
local S       = 134.0        -- body box == ts * e.size (2.8 tiles at TILE_PX 48)
local OX, OY  = 17.0, 17.0
local N_DORM, N_AWAKE = 4, 8
local N_FLY, N_RUN, N_BREATH, N_FIGHT = 6, 6, 6, 6
local SHEET_COLS = 6           -- 106 frames laid out 6x18, not one huge strip

local lib = dofile("tools/aseprite-lib.lua")
local hex = lib.hex

local TAIL_D  = hex('#7a1206')
local BODY_D  = hex('#8a1408')
local BODY    = hex('#a01d0c')
local BODY_L  = hex('#b02410')
local WING_FD = hex('#5e0e04')
local SPINE   = hex('#4a0a02')
local SNOUT   = hex('#b82a12')
-- (no horn colours: he is hornless, and the crown is the only thing on his head)
local TORSO   = hex('#9a1808')
local BELLY   = hex('#d8703a')
local BELLY_L = hex('#a84c22')
local WING    = hex('#6e1004')
local WING_M  = hex('#8a3018')
local TALON   = hex('#2a1a12')
local NECK    = hex('#a81f0c')
local SKULL   = hex('#b8260e')
local TEETH   = hex('#f4ead8')
local MAW     = hex('#ffaa28')
local EYE     = hex('#ffd23c')
local EYE_D   = hex('#2a0604')
local CROWN   = hex('#ffd24a')
local CROWN_D = hex('#a87c22')
local CROWN_L = hex('#ffffff')
local OUTLINE = hex('#1a0603')

----------------------------------------------------------------------
-- rasteriser (fraction space: 0..1 maps across the body box)
--
-- px/polyPx/ellipsePx/linePx/outlineSilhouette live in
-- tools/aseprite-lib.lua, shared with make-hero-sheet.lua; only the
-- fraction-of-S wrappers and the dragon-only bezier helpers below stay
-- local, since they close over this script's own W, H, OX, OY, S.
----------------------------------------------------------------------
local raster = lib.newRaster(W, H)
local px, polyPx, ellipsePx, linePx, outlineSilhouette =
  raster.px, raster.polyPx, raster.ellipsePx, raster.linePx, raster.outlineSilhouette

local function X(f) return OX + f * S end
local function Y(f) return OY + f * S end

local function polyF(img, P, c)
  local Q = {}
  for i = 1, #P do Q[i] = { X(P[i][1]), Y(P[i][2]) } end
  polyPx(img, Q, c)
end

-- sample a quadratic bezier into points (the canvas source uses quadraticCurveTo)
local function quad(p0, pc, p1, n)
  local pts = {}
  for i = 0, n do
    local t = i / n
    local u = 1 - t
    pts[#pts+1] = { u*u*p0[1] + 2*u*t*pc[1] + t*t*p1[1],
                    u*u*p0[2] + 2*u*t*pc[2] + t*t*p1[2] }
  end
  return pts
end

local function append(dst, src, skipFirst)
  for i = (skipFirst and 2 or 1), #src do dst[#dst+1] = src[i] end
  return dst
end

local function ellipseF(img, fcx, fcy, frx, fry, c, rot)
  ellipsePx(img, X(fcx), Y(fcy), frx*S, fry*S, c, rot)
end

-- lineF's width is a fraction of S -- unchanged. This is the canonical
-- semantics both scripts now use (see make-hero-sheet.lua's LINE_W comment
-- for why the hero sheet, which used to take raw pixels, was the one that
-- moved).
local function lineF(img, x0, y0, x1, y1, wf, c)
  linePx(img, X(x0), Y(y0), X(x1), Y(y1), wf*S, c)
end

-- stroke a sampled curve
local function strokePts(img, pts, wf, c)
  for i = 1, #pts - 1 do
    linePx(img, X(pts[i][1]), Y(pts[i][2]), X(pts[i+1][1]), Y(pts[i+1][2]), wf*S, c)
  end
end

----------------------------------------------------------------------
-- the crown -- gold circlet with jagged points, matching drawEmperorCrown
----------------------------------------------------------------------
-- Dark-to-light ramp lit toward lib.LIGHT_DIR: the shadowed underside of the
-- band, the gold band/points, the glint on the lit edge. lib.ramp(_, (i-1)/2)
-- reproduces CROWN_D, CROWN, CROWN_L exactly.
local CROWN_RAMP = { CROWN_D, CROWN, CROWN_L }
assert(lib.LIGHT_DIR.y < 0, "CROWN_RAMP is ordered dark-to-light assuming an overhead/upper light")

local function drawCrown(img, cx, cy, halfW, bandH, pointH)
  -- band
  polyF(img, { {cx-halfW, cy}, {cx+halfW, cy}, {cx+halfW*0.92, cy+bandH}, {cx-halfW*0.92, cy+bandH} }, lib.ramp(CROWN_RAMP, 1/2))
  polyF(img, { {cx-halfW*0.92, cy+bandH*0.62}, {cx+halfW*0.92, cy+bandH*0.62},
               {cx+halfW*0.92, cy+bandH}, {cx-halfW*0.92, cy+bandH} }, lib.ramp(CROWN_RAMP, 0/2))
  -- points: tallest at centre, stepping down outward
  local pts = { {-1.0, 0.58}, {-0.55, 0.82}, {0.0, 1.0}, {0.55, 0.82}, {1.0, 0.58} }
  for _, p in ipairs(pts) do
    local bx = cx + p[1] * halfW * 0.86
    local h  = pointH * p[2]
    polyF(img, { {bx - halfW*0.15, cy + 0.004}, {bx, cy - h}, {bx + halfW*0.15, cy + 0.004} }, lib.ramp(CROWN_RAMP, 1/2))
  end
  -- glint along the lit edge
  lineF(img, cx - halfW*0.80, cy + bandH*0.28, cx - halfW*0.10, cy + bandH*0.28, 0.008, lib.ramp(CROWN_RAMP, 2/2))
end

----------------------------------------------------------------------
-- DORMANT: coiled asleep on the hoard, head resting on its forepaws
----------------------------------------------------------------------
local function drawDormant(img, bw)
  -- coiled tail wrapping the body, drawn first and underneath
  local arc = {}
  for i = 0, 24 do
    local a = math.pi*0.15 + (math.pi*1.40) * (i/24)
    arc[#arc+1] = { 0.5 + math.cos(a)*0.42, 0.60 + math.sin(a)*0.28 }
  end
  strokePts(img, arc, 0.10, TAIL_D)
  polyF(img, { {0.86,0.44}, {0.98,0.38}, {0.92,0.52} }, TAIL_D)          -- spade tip

  -- body mass, swelling with each breath
  ellipseF(img, 0.54, 0.58, 0.34*bw, 0.24*bw, BODY_D)
  ellipseF(img, 0.52, 0.54, 0.28*bw, 0.18*bw, BODY)

  -- folded wings laid along the back
  local wingP = { {0.28, 0.42} }
  append(wingP, quad({0.28,0.42}, {0.50,0.30}, {0.74,0.44}, 12), true)
  append(wingP, quad({0.74,0.44}, {0.62,0.52}, {0.50,0.50}, 8), true)
  append(wingP, quad({0.50,0.50}, {0.38,0.52}, {0.28,0.42}, 8), true)
  polyF(img, wingP, WING_FD)
  for _, fx in ipairs({0.36, 0.48, 0.60}) do
    lineF(img, fx, 0.44, fx + 0.10, 0.36, 0.010, SPINE)
  end

  -- back spines along the coil
  for _, fx in ipairs({0.30, 0.42, 0.54, 0.66}) do
    polyF(img, { {fx,0.40}, {fx+0.03,0.33}, {fx+0.06,0.40} }, SPINE)
  end

  -- hind legs, drawn up against the coiled flank
  polyF(img, { {0.60,0.60}, {0.78,0.63}, {0.80,0.76}, {0.60,0.74} }, BODY_D)
  polyF(img, { {0.62,0.72}, {0.80,0.74}, {0.79,0.83}, {0.62,0.81} }, TAIL_D)
  for i = 0, 2 do
    local bx = 0.645 + i*0.055
    polyF(img, { {bx,0.815}, {bx+0.018,0.865}, {bx+0.044,0.818} }, TALON)
  end

  -- forepaws, the head resting across them
  polyF(img, { {0.30,0.74}, {0.46,0.76}, {0.45,0.85}, {0.29,0.83} }, BODY_D)
  for i = 0, 2 do
    local bx = 0.305 + i*0.050
    polyF(img, { {bx,0.838}, {bx+0.016,0.882}, {bx+0.040,0.840} }, TALON)
  end

  -- head at rest on its forepaws, lower-left
  ellipseF(img, 0.25, 0.70, 0.155, 0.115, BODY, -0.2)
  ellipseF(img, 0.145, 0.735, 0.095, 0.065, SNOUT, -0.2)
  -- nostril + closed eye, a thin dark slit
  ellipseF(img, 0.088, 0.742, 0.014, 0.011, EYE_D)
  lineF(img, 0.195, 0.688, 0.268, 0.676, 0.011, EYE_D)
  -- hornless: a low crest ridge along the skull instead
  polyF(img, { {0.205,0.622}, {0.330,0.640}, {0.320,0.664}, {0.200,0.648} }, BODY_D)
  -- the crown, sitting askew on the sleeping head
  drawCrown(img, 0.243, 0.598, 0.082, 0.024, 0.044)
end

----------------------------------------------------------------------
-- AWAKE and its variants, all posed through one parameterised body.
--
-- P fields:
--   bodyY  vertical offset of everything but the hind feet (hover, run bounce)
--   lean   horizontal lean
--   wf     wing lift multiplier (>1 = wings up)
--   fold   0 = wings spread, 1 = tucked back along the flanks
--   tail   tail lash offset
--   jaw    0 = shut, 1 = gaping
--   fire   0..1 breath plume out of the mouth
--   legs   'stand' | 'run' | 'tuck'
--   legPh  run cycle phase 0..1
--   claw   forelimb reach: -1 wound back, 0 neutral, 1 struck forward
----------------------------------------------------------------------
local function lerpP(a, b, t)
  return { a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t }
end

local function drawWings(img, P)
  local function wing(sgn)
    local function Q(x, y) return { 0.5 + sgn * x, y } end
    local w2 = (sgn < 0) and (P.wf * 0.94) or P.wf
    local lift = function(y) return y / w2 end
    local f = P.fold
    -- spread pose, then the tucked-back pose, blended by fold
    local shoulder = Q(0.10, 0.42)
    local elbow  = lerpP(Q(0.34, lift(0.10)), Q(0.21, 0.34), f)
    local wrist  = lerpP(Q(0.54, lift(0.02)), Q(0.27, 0.50), f)
    local spread = {
      Q(0.57, lift(0.20)), Q(0.47, lift(0.26)),
      Q(0.53, 0.36),       Q(0.42, 0.41),
      Q(0.46, 0.52),       Q(0.35, 0.54),
      Q(0.34, 0.65),       Q(0.22, 0.60),
    }
    local tucked = {
      Q(0.32, 0.56), Q(0.25, 0.54),
      Q(0.31, 0.64), Q(0.23, 0.62),
      Q(0.29, 0.72), Q(0.21, 0.70),
      Q(0.26, 0.80), Q(0.17, 0.72),
    }
    local edge = {}
    for i = 1, #spread do edge[i] = lerpP(spread[i], tucked[i], f) end

    local poly = { shoulder }
    append(poly, quad(shoulder, lerpP(Q(0.20, lift(0.16)), Q(0.15, 0.38), f), elbow, 8), true)
    append(poly, quad(elbow, lerpP(Q(0.46, lift(0.00)), Q(0.26, 0.42), f), wrist, 8), true)
    for _, p in ipairs(edge) do poly[#poly + 1] = p end
    append(poly, quad(edge[8], Q(0.14, 0.56), shoulder, 6), true)
    polyF(img, poly, WING)
    polyF(img, { shoulder, elbow, edge[2], edge[4], edge[6], Q(0.16, 0.50) }, WING_M)
    polyF(img, { elbow, wrist, edge[1], edge[2] }, hex('#4e0a02'))
    for _, t in ipairs({ wrist, edge[1], edge[3], edge[5], edge[7] }) do
      linePx(img, X(shoulder[1]), Y(shoulder[2]), X(t[1]), Y(t[2]), 0.012 * S, SPINE)
    end
    linePx(img, X(shoulder[1]), Y(shoulder[2]), X(elbow[1]), Y(elbow[2]), 0.020 * S, SPINE)
    polyF(img, { { wrist[1], wrist[2] }, { wrist[1] + sgn * 0.050, wrist[2] - 0.050 },
                 { wrist[1] + sgn * 0.014, wrist[2] + 0.024 } }, TALON)
  end
  wing(-1); wing(1)
end

local function drawTail(img, P)
  local t = P.tail
  local tail = quad({ 0.5, 0.70 }, { 0.5 + t * 0.6, 0.90 }, { 0.5 + t, 1.04 }, 16)
  for i = 1, #tail - 1 do
    local w = 0.078 * (1 - (i - 1) / #tail * 0.72)
    linePx(img, X(tail[i][1]), Y(tail[i][2]), X(tail[i + 1][1]), Y(tail[i + 1][2]), w * S, BODY_D)
  end
  for _, i in ipairs({ 5, 9, 13 }) do
    local p, q = tail[i], tail[i + 1]
    local dx, dy = q[1] - p[1], q[2] - p[2]
    local L = math.max(1e-6, math.sqrt(dx * dx + dy * dy))
    polyF(img, { { p[1] - dy / L * 0.05, p[2] + dx / L * 0.05 },
                 { p[1] + dx * 1.5, p[2] + dy * 1.5 }, { p[1], p[2] } }, SPINE)
  end
  polyF(img, { { 0.5 + t, 1.08 }, { 0.5 + t - 0.07, 0.975 }, { 0.5 + t + 0.07, 0.975 } }, WING)
  polyF(img, { { 0.5 + t, 1.045 }, { 0.5 + t - 0.032, 0.99 }, { 0.5 + t + 0.032, 0.99 } }, SPINE)
end

local function drawHindLegs(img, P)
  for _, sgn in ipairs({ -1, 1 }) do
    local dx, dy, sc = 0, 0, 1
    if P.legs == 'run' then
      -- one leg reaches while the other drives back
      local ph = P.legPh * math.pi * 2 + ((sgn < 0) and 0 or math.pi)
      dx = math.sin(ph) * 0.055 * sgn
      dy = -math.max(0, math.sin(ph)) * 0.075
    elseif P.legs == 'tuck' then
      dx = -sgn * 0.055; dy = -0.115; sc = 0.80    -- drawn up under the belly
    end
    -- scale about the hip, then offset
    local function q(ox, oy)
      return { 0.5 + sgn * (ox * sc) + dx, 0.615 + (oy - 0.615) * sc + dy }
    end
    polyF(img, { q(0.09, 0.615), q(0.30, 0.645), q(0.335, 0.795), q(0.115, 0.775) }, TORSO)
    polyF(img, { q(0.20, 0.632), q(0.30, 0.645), q(0.335, 0.795), q(0.245, 0.788) }, BODY_D)
    polyF(img, { q(0.215, 0.762), q(0.330, 0.782), q(0.310, 0.905), q(0.200, 0.888) }, BODY_D)
    polyF(img, { q(0.170, 0.878), q(0.355, 0.892), q(0.350, 0.948), q(0.165, 0.936) }, TORSO)
    for i = -1, 1 do
      local bx = 0.180 + i * 0.070 + 0.075
      polyF(img, { q(bx, 0.930), q(bx + 0.020, 1.010), q(bx + 0.052, 0.936) }, TALON)
    end
  end
end

local function drawTorso(img, P)
  polyF(img, { {0.335,0.45}, {0.665,0.45}, {0.625,0.60}, {0.585,0.73}, {0.415,0.73}, {0.375,0.60} }, TORSO)
  polyF(img, { {0.335,0.45}, {0.50,0.45}, {0.50,0.73}, {0.415,0.73}, {0.375,0.60} }, BODY_L)
  polyF(img, { {0.28,0.50}, {0.36,0.395}, {0.46,0.44}, {0.40,0.56} }, BODY_D)
  polyF(img, { {0.72,0.50}, {0.64,0.395}, {0.54,0.44}, {0.60,0.56} }, hex('#6e0e04'))
  for i = 0, 4 do
    local yy = 0.475 + i * 0.048
    polyF(img, { {0.455,yy}, {0.50,yy+0.026}, {0.545,yy}, {0.50,yy+0.010} }, BELLY)
  end
  for _, sgn in ipairs({ -1, 1 }) do
    for i = 0, 2 do
      lineF(img, 0.5 + sgn*0.11, 0.47 + i*0.055, 0.5 + sgn*0.18, 0.50 + i*0.055, 0.008, SPINE)
    end
  end
end

local function drawForelimbs(img, P)
  local reach = P.claw or 0
  for _, sgn in ipairs({ -1, 1 }) do
    local ex = reach * 0.055                      -- outward/forward on a strike
    local ey = reach * 0.070
    local hx = 0.5 + sgn * 0.15
    polyF(img, { {hx, 0.495}, {0.5 + sgn*(0.275+ex), 0.575+ey},
                 {0.5 + sgn*(0.225+ex), 0.635+ey}, {hx - sgn*0.02, 0.565} }, BODY_D)
    polyF(img, { {0.5 + sgn*(0.255+ex), 0.585+ey}, {0.5 + sgn*(0.305+ex), 0.655+ey},
                 {0.5 + sgn*(0.215+ex), 0.665+ey}, {0.5 + sgn*(0.195+ex), 0.615+ey} }, TORSO)
    for i = -1, 1 do
      local bx = 0.5 + sgn*(0.245+ex) + i*0.042
      -- claws splay and lengthen through the swipe
      local cl = 0.100 + math.max(0, reach) * 0.055
      polyF(img, { {bx, 0.645+ey}, {bx + sgn*0.018, 0.645+ey+cl}, {bx + sgn*0.046, 0.650+ey} }, TALON)
    end
  end
end

local function drawNeckHead(img, P)
  local j = P.jaw
  polyF(img, { {0.425,0.46}, {0.575,0.46}, {0.552,0.255}, {0.448,0.255} }, NECK)
  for _, sgn in ipairs({ -1, 1 }) do
    for i = 0, 2 do
      local bx = 0.5 + sgn*(0.075 + i*0.058)
      polyF(img, { {bx, 0.470}, {bx + sgn*0.030, 0.392 - i*0.012}, {bx + sgn*0.058, 0.470} }, SPINE)
    end
  end

  polyF(img, { {0.345,0.115}, {0.655,0.115}, {0.610,0.250}, {0.390,0.250} }, SKULL)
  polyF(img, { {0.355,0.170}, {0.400,0.150}, {0.412,0.262}, {0.362,0.240} }, BODY_D)
  polyF(img, { {0.645,0.170}, {0.600,0.150}, {0.588,0.262}, {0.638,0.240} }, BODY_D)
  polyF(img, { {0.392,0.240}, {0.608,0.240}, {0.556,0.330}, {0.444,0.330} }, SNOUT)

  -- gullet and lower jaw open by `jaw`
  local gd = 0.312 + j * 0.115          -- how far the gullet reaches
  polyF(img, { {0.442,0.312}, {0.558,0.312}, {0.528,gd}, {0.472,gd} }, hex('#3a0a04'))
  polyF(img, { {0.455,0.326}, {0.545,0.326}, {0.519,gd-0.022}, {0.481,gd-0.022} }, MAW)
  polyF(img, { {0.470,0.338}, {0.530,0.338}, {0.511,gd-0.036}, {0.489,gd-0.036} }, hex('#ffe98a'))
  polyF(img, { {0.452,gd-0.026}, {0.548,gd-0.026}, {0.524,gd+0.036}, {0.476,gd+0.036} }, BODY_D)
  for _, fx2 in ipairs({-0.086, -0.048, -0.012, 0.024, 0.060}) do
    polyF(img, { {0.5+fx2,0.308}, {0.5+fx2+0.015,0.364}, {0.5+fx2+0.030,0.308} }, TEETH)
  end
  for _, fx2 in ipairs({-0.062, -0.022, 0.018, 0.052}) do
    polyF(img, { {0.5+fx2,gd+0.000}, {0.5+fx2+0.013,gd-0.046}, {0.5+fx2+0.026,gd+0.000} }, TEETH)
  end
  ellipseF(img, 0.466, 0.272, 0.013, 0.009, EYE_D)
  ellipseF(img, 0.534, 0.272, 0.013, 0.009, EYE_D)

  polyF(img, { {0.358,0.132}, {0.642,0.132}, {0.622,0.190}, {0.378,0.190} }, hex('#3a0802'))
  polyF(img, { {0.392,0.170}, {0.474,0.192}, {0.466,0.216}, {0.388,0.194} }, EYE)
  polyF(img, { {0.608,0.170}, {0.526,0.192}, {0.534,0.216}, {0.612,0.194} }, EYE)
  polyF(img, { {0.428,0.185}, {0.441,0.188}, {0.437,0.211}, {0.424,0.206} }, EYE_D)
  polyF(img, { {0.572,0.185}, {0.559,0.188}, {0.563,0.211}, {0.576,0.206} }, EYE_D)

  polyF(img, { {0.408,0.118}, {0.592,0.118}, {0.560,0.086}, {0.440,0.086} }, BODY_D)
  drawCrown(img, 0.50, 0.068, 0.104, 0.028, 0.050)
end

-- Breath plume, straight down the screen at the player. Drawn last, over the
-- body, because it is coming out of him toward the camera.
local function drawFirePlume(img, P)
  local f = P.fire or 0
  if f <= 0 then return end
  local top = 0.40
  local len = 0.20 + f * 0.78
  local w1  = 0.045 + f * 0.030
  local w2  = 0.090 + f * 0.230
  local function cone(scale, col)
    polyF(img, { {0.5 - w1*scale, top}, {0.5 + w1*scale, top},
                 {0.5 + w2*scale, top + len}, {0.5 - w2*scale, top + len} }, col)
  end
  cone(1.00, hex('#ff5a18'))
  cone(0.66, hex('#ffa02a'))
  cone(0.34, hex('#ffe98a'))
  -- flame tongues licking off the edges
  for i = 1, 5 do
    local t = i / 6
    local yy = top + len * t
    local xx = w1 + (w2 - w1) * t
    local s2 = 0.030 + 0.045 * t
    polyF(img, { {0.5 - xx, yy}, {0.5 - xx - s2, yy + s2*0.7}, {0.5 - xx, yy + s2} }, hex('#ff7a20'))
    polyF(img, { {0.5 + xx, yy}, {0.5 + xx + s2, yy + s2*0.7}, {0.5 + xx, yy + s2} }, hex('#ff7a20'))
  end
end

local function drawDragon(img, P)
  -- Hind feet stay planted while the rest of the body rides bodyY, so a run
  -- bounce doesn't lift him off the floor.
  local oX, oY = OX, OY
  OX = oX + (P.lean or 0) * S
  OY = oY + (P.bodyY or 0) * S
  drawWings(img, P)
  OX, OY = oX, oY

  drawTail(img, P)
  drawHindLegs(img, P)

  OX = oX + (P.lean or 0) * S
  OY = oY + (P.bodyY or 0) * S
  drawTorso(img, P)
  drawForelimbs(img, P)
  drawNeckHead(img, P)
  OX, OY = oX, oY
end

----------------------------------------------------------------------
-- BACK and SIDE views (2026-11-15). The front art above is untouched; these
-- are new frames appended after it. The game picks a view from the way he
-- faces (creatureFacing, render-enemies.js): 'up' is his back, 'left' and
-- 'right' the side, drawn facing right and mirrored at draw time. Dormant and
-- the cinematic flyover stay front-only. Same palette, same body box, same
-- pose curves (poseFor), so every animation moves the way its front does.
----------------------------------------------------------------------

-- Seen from behind: no face at all. The crown and the back of the skull, the
-- spine ridge down the neck and back, the wings spread toward the viewer, and
-- the tail coming down the screen at the camera.
local function drawBackHead(img, P)
  polyF(img, { {0.425,0.46}, {0.575,0.46}, {0.552,0.240}, {0.448,0.240} }, NECK)
  polyF(img, { {0.50,0.46}, {0.575,0.46}, {0.552,0.240}, {0.50,0.240} }, BODY_D)
  -- back of the skull, a darker band where the jaw sits out of sight
  polyF(img, { {0.355,0.110}, {0.645,0.110}, {0.618,0.235}, {0.382,0.235} }, SKULL)
  polyF(img, { {0.375,0.200}, {0.625,0.200}, {0.612,0.250}, {0.388,0.250} }, BODY_D)
  -- the crest ridge down the middle of the skull and neck
  polyF(img, { {0.488,0.115}, {0.512,0.115}, {0.508,0.240}, {0.492,0.240} }, SPINE)
  for i = 0, 3 do
    local yy = 0.255 + i * 0.050
    polyF(img, { {0.474,yy+0.030}, {0.500,yy-0.012}, {0.526,yy+0.030} }, SPINE)
  end
  -- jaw corners just showing past the skull when he gapes
  local j = P.jaw or 0
  if j > 0.5 then
    polyF(img, { {0.382,0.235}, {0.400,0.235}, {0.396,0.250 + (j-0.5)*0.03} }, BODY_D)
    polyF(img, { {0.618,0.235}, {0.600,0.235}, {0.604,0.250 + (j-0.5)*0.03} }, BODY_D)
  end
  polyF(img, { {0.408,0.118}, {0.592,0.118}, {0.560,0.086}, {0.440,0.086} }, BODY_D)
  drawCrown(img, 0.50, 0.068, 0.104, 0.028, 0.050)
end

local function drawBackTorso(img, P)
  polyF(img, { {0.335,0.45}, {0.665,0.45}, {0.625,0.60}, {0.585,0.73}, {0.415,0.73}, {0.375,0.60} }, BODY_D)
  polyF(img, { {0.335,0.45}, {0.50,0.45}, {0.50,0.73}, {0.415,0.73}, {0.375,0.60} }, BODY)
  -- shoulder blades, where the wings root
  polyF(img, { {0.30,0.49}, {0.37,0.41}, {0.47,0.45}, {0.41,0.55} }, BODY_L)
  polyF(img, { {0.70,0.49}, {0.63,0.41}, {0.53,0.45}, {0.59,0.55} }, TORSO)
  -- the spine ridge running down the back to the tail root
  for i = 0, 5 do
    local yy = 0.470 + i * 0.046
    polyF(img, { {0.478,yy+0.034}, {0.500,yy-0.010}, {0.522,yy+0.034} }, SPINE)
  end
  for _, sgn in ipairs({ -1, 1 }) do
    for i = 0, 2 do
      lineF(img, 0.5 + sgn*0.06, 0.50 + i*0.060, 0.5 + sgn*0.15, 0.48 + i*0.060, 0.008, SPINE)
    end
  end
end

-- Breath seen from behind: the plume goes away from the camera, so all that
-- shows is the flame rising past his head, narrowing as it recedes. It stops
-- short of the frame's top edge (-OY/S, about -0.127) so it is never cut flat.
local function drawBackPlume(img, P)
  local f = P.fire or 0
  if f <= 0 then return end
  local base = 0.22
  local len  = 0.10 + f * 0.22
  local w1, w2 = 0.100 + f * 0.110, 0.012
  local function cone(scale, col)
    polyF(img, { {0.5 - w1*scale, base}, {0.5 + w1*scale, base},
                 {0.5 + w2*scale, base - len}, {0.5 - w2*scale, base - len} }, col)
  end
  cone(1.00, hex('#ff5a18'))
  cone(0.66, hex('#ffa02a'))
  cone(0.34, hex('#ffe98a'))
end

local function drawDragonBack(img, P)
  local oX, oY = OX, OY
  local function lifted() OX = oX + (P.lean or 0) * S; OY = oY + (P.bodyY or 0) * S end
  local function planted() OX, OY = oX, oY end
  lifted();  drawForelimbs(img, P)      -- only the reach past his flanks shows
  planted(); drawHindLegs(img, P)
  lifted();  drawBackTorso(img, P)
  drawWings(img, P)                     -- rooted on his back, nearer than his sides
  drawBackHead(img, P)
  planted(); drawTail(img, P)           -- last: it hangs toward the camera
end

-- Side, facing right. One eye, the snout out to the right, the far wing and
-- far legs a shade darker behind the body, the near ones over it.
local function sideWing(img, P, far)
  local dx, dy = far and 0.07 or 0, far and -0.035 or 0
  local wf, f = P.wf or 1, P.fold or 0
  local function L(y) return y / wf end
  local function at(spread, tucked) return lerpP({ spread[1] + dx, spread[2] + dy }, { tucked[1] + dx, tucked[2] + dy }, f) end
  local shoulder = { 0.46 + dx, 0.44 + dy }
  local elbow = at({0.34, L(0.16)}, {0.40, 0.40})
  local wrist = at({0.20, L(0.04)}, {0.33, 0.50})
  local edge = {
    at({0.08, L(0.12)}, {0.29, 0.56}), at({0.16, L(0.24)}, {0.32, 0.59}),
    at({0.11, L(0.33)}, {0.28, 0.63}), at({0.21, L(0.40)}, {0.33, 0.66}),
    at({0.19, L(0.49)}, {0.30, 0.71}), at({0.29, 0.50},    {0.35, 0.72}),
    at({0.31, 0.58},    {0.34, 0.76}), at({0.39, 0.55},    {0.40, 0.72}),
  }
  local poly = { shoulder }
  append(poly, quad(shoulder, at({0.42, L(0.24)}, {0.44, 0.40}), elbow, 8), true)
  append(poly, quad(elbow, at({0.26, L(0.06)}, {0.37, 0.44}), wrist, 8), true)
  for _, p in ipairs(edge) do poly[#poly + 1] = p end
  append(poly, quad(edge[8], { 0.44 + dx, 0.54 + dy }, shoulder, 6), true)
  polyF(img, poly, far and WING_FD or WING)
  if not far then
    polyF(img, { shoulder, elbow, edge[2], edge[4], edge[6], { 0.42, 0.52 } }, WING_M)
    polyF(img, { elbow, wrist, edge[1], edge[2] }, hex('#4e0a02'))
  end
  for _, t in ipairs({ wrist, edge[1], edge[3], edge[5], edge[7] }) do
    linePx(img, X(shoulder[1]), Y(shoulder[2]), X(t[1]), Y(t[2]), 0.012 * S, SPINE)
  end
  linePx(img, X(shoulder[1]), Y(shoulder[2]), X(elbow[1]), Y(elbow[2]), 0.020 * S, SPINE)
  polyF(img, { wrist, { wrist[1] - 0.045, wrist[2] - 0.045 }, { wrist[1] - 0.010, wrist[2] + 0.024 } }, TALON)
end

local function sideTail(img, P)
  local t = P.tail or 0
  local tail = quad({ 0.40, 0.70 }, { 0.12, 0.80 + t * 0.30 }, { 0.00, 0.98 + t * 0.10 }, 16)
  for i = 1, #tail - 1 do
    local w = 0.078 * (1 - (i - 1) / #tail * 0.72)
    linePx(img, X(tail[i][1]), Y(tail[i][2]), X(tail[i + 1][1]), Y(tail[i + 1][2]), w * S, BODY_D)
  end
  for _, i in ipairs({ 4, 8, 12 }) do
    local p = tail[i]
    polyF(img, { { p[1] - 0.025, p[2] - 0.020 }, { p[1] - 0.005, p[2] - 0.075 }, { p[1] + 0.025, p[2] - 0.030 } }, SPINE)
  end
  local e = tail[#tail]
  polyF(img, { { e[1] - 0.075, e[2] + 0.005 }, { e[1] + 0.015, e[2] - 0.055 }, { e[1] + 0.015, e[2] + 0.060 } }, WING)
  polyF(img, { { e[1] - 0.040, e[2] + 0.004 }, { e[1] + 0.010, e[2] - 0.026 }, { e[1] + 0.010, e[2] + 0.030 } }, SPINE)
end

local function sideLeg(img, P, far)
  local dx, dy = far and 0.06 or 0, far and -0.02 or 0
  if P.legs == 'run' then
    local ph = P.legPh * math.pi * 2 + (far and math.pi or 0)
    dx = dx + math.sin(ph) * 0.070
    dy = dy - math.max(0, math.sin(ph)) * 0.075
  elseif P.legs == 'tuck' then
    dx = dx - 0.050; dy = dy - 0.115
  end
  local function q(x, y) return { x + dx, y + dy } end
  local A, B = far and TAIL_D or TORSO, far and hex('#6a1004') or BODY_D
  polyF(img, { q(0.38,0.60), q(0.54,0.62), q(0.57,0.78), q(0.43,0.81) }, A)
  polyF(img, { q(0.47,0.61), q(0.54,0.62), q(0.57,0.78), q(0.50,0.80) }, B)
  polyF(img, { q(0.43,0.77), q(0.53,0.77), q(0.51,0.92), q(0.44,0.92) }, B)
  polyF(img, { q(0.41,0.89), q(0.60,0.90), q(0.60,0.95), q(0.41,0.95) }, A)
  for i = 0, 2 do
    local bx = 0.535 + i * 0.030
    polyF(img, { q(bx, 0.93), q(bx + 0.040, 1.000), q(bx + 0.020, 0.94) }, TALON)
  end
end

local function sideForelimb(img, P, far)
  local reach = P.claw or 0
  local ex, ey = reach * 0.075, reach * 0.030
  local dx, dy = far and 0.05 or 0, far and -0.02 or 0
  local function q(x, y) return { x + dx, y + dy } end
  local A, B = far and hex('#6a1004') or BODY_D, far and TAIL_D or TORSO
  polyF(img, { q(0.56,0.48), q(0.64,0.50), q(0.68+ex,0.61+ey), q(0.62+ex,0.63+ey) }, A)
  polyF(img, { q(0.63+ex,0.58+ey), q(0.70+ex*1.6,0.62+ey), q(0.72+ex*1.6,0.67+ey), q(0.64+ex,0.66+ey) }, B)
  local cl = 0.060 + math.max(0, reach) * 0.040
  for i = 0, 2 do
    local bx = 0.665 + ex * 1.6 + i * 0.020
    polyF(img, { q(bx, 0.665+ey), q(bx + 0.030, 0.665+ey+cl), q(bx + 0.016, 0.670+ey) }, TALON)
  end
end

local function sideTorso(img, P)
  polyF(img, { {0.38,0.43}, {0.56,0.41}, {0.65,0.49}, {0.64,0.61}, {0.57,0.73},
               {0.42,0.75}, {0.35,0.64}, {0.35,0.50} }, BODY_D)
  polyF(img, { {0.38,0.43}, {0.56,0.41}, {0.63,0.48}, {0.58,0.56}, {0.40,0.58}, {0.36,0.50} }, BODY)
  -- belly plates down the front, chevrons stepping toward the hips
  for i = 0, 4 do
    local yy = 0.475 + i * 0.048
    local xx = 0.640 - i * 0.016
    polyF(img, { {xx - 0.060, yy}, {xx, yy + 0.004}, {xx - 0.008, yy + 0.034}, {xx - 0.060, yy + 0.028} }, BELLY)
    lineF(img, xx - 0.060, yy + 0.030, xx - 0.008, yy + 0.034, 0.006, BELLY_L)
  end
  -- spines along the back
  for i = 0, 4 do
    local yy = 0.46 + i * 0.055
    polyF(img, { {0.365,yy}, {0.320,yy + 0.012}, {0.360,yy + 0.040} }, SPINE)
  end
  for i = 0, 2 do
    lineF(img, 0.42, 0.62 + i*0.035, 0.52, 0.60 + i*0.035, 0.008, SPINE)
  end
end

local function sideNeckHead(img, P)
  local j = P.jaw or 0
  polyF(img, { {0.50,0.45}, {0.62,0.44}, {0.69,0.30}, {0.66,0.21}, {0.56,0.21}, {0.52,0.32} }, NECK)
  polyF(img, { {0.50,0.45}, {0.55,0.45}, {0.56,0.32}, {0.59,0.21}, {0.56,0.21}, {0.52,0.32} }, BODY_D)
  for i = 0, 2 do
    local p = { 0.515 + i * 0.012, 0.40 - i * 0.075 }
    polyF(img, { {p[1], p[2]}, {p[1] - 0.045, p[2] - 0.010}, {p[1] + 0.005, p[2] - 0.040} }, SPINE)
  end
  -- skull and upper snout, pointing right
  polyF(img, { {0.56,0.135}, {0.67,0.100}, {0.75,0.135}, {0.77,0.205}, {0.60,0.245}, {0.555,0.195} }, SKULL)
  polyF(img, { {0.70,0.150}, {0.895,0.195}, {0.900,0.235}, {0.700,0.250} }, SNOUT)
  -- the mouth, opened by the lower jaw dropping from its hinge
  local drop = j * 0.075
  polyF(img, { {0.660,0.245}, {0.885,0.240}, {0.870,0.262 + drop}, {0.670,0.270} }, hex('#3a0a04'))
  if j > 0.15 then
    polyF(img, { {0.700,0.250}, {0.860,0.246}, {0.848,0.255 + drop * 0.8}, {0.705,0.262} }, MAW)
  end
  polyF(img, { {0.640,0.255}, {0.670,0.268}, {0.875,0.258 + drop}, {0.870,0.290 + drop}, {0.660,0.300} }, BODY_D)
  for i = 0, 4 do
    local bx = 0.725 + i * 0.034
    polyF(img, { {bx, 0.244}, {bx + 0.010, 0.270}, {bx + 0.020, 0.243} }, TEETH)
    if j > 0.3 then
      polyF(img, { {bx + 0.006, 0.260 + drop}, {bx + 0.016, 0.236 + drop}, {bx + 0.026, 0.259 + drop} }, TEETH)
    end
  end
  ellipseF(img, 0.872, 0.208, 0.011, 0.008, EYE_D)          -- nostril
  -- brow, then the one eye
  polyF(img, { {0.640,0.145}, {0.735,0.150}, {0.725,0.172}, {0.640,0.165} }, hex('#3a0802'))
  polyF(img, { {0.660,0.168}, {0.720,0.170}, {0.712,0.192}, {0.664,0.188} }, EYE)
  polyF(img, { {0.690,0.168}, {0.700,0.169}, {0.698,0.192}, {0.688,0.190} }, EYE_D)
  -- the crest ridge, swept back off the skull
  polyF(img, { {0.560,0.140}, {0.650,0.112}, {0.600,0.170} }, BODY_D)
  drawCrown(img, 0.665, 0.090, 0.072, 0.026, 0.046)
end

local function drawSidePlume(img, P)
  local f = P.fire or 0
  if f <= 0 then return end
  local x0, yc = 0.885, 0.262
  local len = 0.06 + f * 0.18
  local w1, w2 = 0.018 + f * 0.012, 0.040 + f * 0.120
  local function cone(scale, col)
    polyF(img, { {x0, yc - w1*scale}, {x0, yc + w1*scale},
                 {x0 + len, yc + w2*scale}, {x0 + len, yc - w2*scale} }, col)
  end
  cone(1.00, hex('#ff5a18'))
  cone(0.66, hex('#ffa02a'))
  cone(0.34, hex('#ffe98a'))
end

local function drawDragonSide(img, P)
  local oX, oY = OX, OY
  local function lifted() OX = oX + (P.lean or 0) * S; OY = oY + (P.bodyY or 0) * S end
  local function planted() OX, OY = oX, oY end
  lifted();  sideWing(img, P, true)
  planted(); sideTail(img, P); sideLeg(img, P, true)
  lifted();  sideForelimb(img, P, true)
             sideTorso(img, P)
  planted(); sideLeg(img, P, false)
  lifted();  sideWing(img, P, false)
             sideNeckHead(img, P)
             sideForelimb(img, P, false)
  planted()
end

----------------------------------------------------------------------
-- build
----------------------------------------------------------------------
local spr = Sprite(W, H, ColorMode.RGB)
local lay = spr.layers[1]
lay.name = "dragon"

-- Every animation is a pose curve over its own frame count. `awake` is the
-- stationary hover; the rest were added so the boss has something to play for
-- each thing he actually does.
local function poseFor(kind, i, n)
  local a = (i - 1) / n * math.pi * 2          -- looping cycles
  local t = (n > 1) and ((i - 1) / (n - 1)) or 0   -- one-shot actions

  if kind == 'awake' then
    return { wf = 1 + math.sin(a)*0.22, fold = 0, tail = math.sin(a)*0.20,
             jaw = 0.55, legs = 'stand' }

  elseif kind == 'fly' then
    -- deeper wingbeat, body rising on the downstroke, legs drawn up
    return { wf = 1 + math.sin(a)*0.55, fold = 0, tail = math.sin(a)*0.14,
             jaw = 0.35, legs = 'tuck', bodyY = -math.sin(a)*0.045 }

  elseif kind == 'flyfire' then
    return { wf = 1 + math.sin(a)*0.55, fold = 0, tail = math.sin(a)*0.14,
             jaw = 1, legs = 'tuck', bodyY = -math.sin(a)*0.045,
             fire = 0.8 + math.sin(a)*0.15 }

  elseif kind == 'run' then
    -- wings half-tucked, legs cycling, a two-beat bounce per stride
    return { wf = 1.05, fold = 0.72, tail = math.sin(a)*0.26, jaw = 0.45,
             legs = 'run', legPh = (i - 1) / n,
             bodyY = -math.abs(math.sin(a * 2)) * 0.022,
             lean = math.sin(a) * 0.012 }

  elseif kind == 'breathe' then
    -- rears back over the first third, then holds a wide jaw and lets go
    if t < 0.34 then
      local u = t / 0.34
      return { wf = 1.15, fold = 0.25, tail = -0.10, jaw = 0.20 + u*0.45,
               legs = 'stand', bodyY = -u*0.045, fire = 0 }
    end
    local u = (t - 0.34) / 0.66
    return { wf = 1.10, fold = 0.25, tail = -0.10 + u*0.06, jaw = 1.0,
             legs = 'stand', bodyY = -0.045 + u*0.030,
             fire = math.min(1, 0.25 + u * 1.10) }

  else -- 'fight': wind up, strike, recover
    local claw, jaw, lean
    if t < 0.34 then      claw = -0.55 * (1 - t/0.34) - 0.15; jaw = 0.30; lean = -0.020
    elseif t < 0.62 then  local u = (t-0.34)/0.28; claw = -0.70 + u*1.70; jaw = 0.35 + u*0.65; lean = -0.020 + u*0.045
    else                  local u = (t-0.62)/0.38; claw = 1.00 - u*0.80;  jaw = 1.00 - u*0.55; lean = 0.025 - u*0.020 end
    return { wf = 1.12, fold = 0.45, tail = math.sin(t*math.pi*2)*0.20,
             jaw = jaw, legs = 'stand', claw = claw, lean = lean }
  end
end

-- The fourth field is the view; the front rows come first and keep their
-- indices, the back and side rows follow (tags named e.g. 'fly_back').
local SEQ = {
  { 'dormant', N_DORM,  0.22 },
  { 'awake',   N_AWAKE, 0.10 },
  { 'fly',     N_FLY,   0.09 },
  { 'run',     N_RUN,   0.08 },
  { 'breathe', N_BREATH,0.09 },
  { 'fight',   N_FIGHT, 0.07 },
  { 'flyfire', N_FLY,   0.09 },
}
for _, view in ipairs({ 'back', 'side' }) do
  SEQ[#SEQ + 1] = { 'awake',   N_AWAKE, 0.10, view }
  SEQ[#SEQ + 1] = { 'fly',     N_FLY,   0.09, view }
  SEQ[#SEQ + 1] = { 'run',     N_RUN,   0.08, view }
  SEQ[#SEQ + 1] = { 'breathe', N_BREATH,0.09, view }
  SEQ[#SEQ + 1] = { 'fight',   N_FIGHT, 0.07, view }
end

local total = 0
for _, k in ipairs(SEQ) do total = total + k[2] end
while #spr.frames < total do spr:newFrame() end

local cursor = 0
for _, k in ipairs(SEQ) do
  local kind, n, dur, view = k[1], k[2], k[3], k[4]
  for i = 1, n do
    local f = cursor + i
    local img = Image(W, H, ColorMode.RGB); img:clear()
    if kind == 'dormant' then
      -- breath swell: bw in [1, 1.035], matching the canvas source
      drawDormant(img, 1 + (math.sin((i-1)/n * math.pi*2) * 0.5 + 0.5) * 0.035)
      outlineSilhouette(img, OUTLINE)
    elseif view == 'back' then
      local P = poseFor(kind, i, n)
      drawDragonBack(img, P)
      outlineSilhouette(img, OUTLINE)
      -- the fan rises past his head, then the head is laid back over it
      if (P.fire or 0) > 0 then
        drawBackPlume(img, P)
        local oX, oY = OX, OY
        OX = oX + (P.lean or 0) * S; OY = oY + (P.bodyY or 0) * S
        drawBackHead(img, P)
        OX, OY = oX, oY
      end
    elseif view == 'side' then
      local P = poseFor(kind, i, n)
      drawDragonSide(img, P)
      outlineSilhouette(img, OUTLINE)
      drawSidePlume(img, P)
    else
      local P = poseFor(kind, i, n)
      drawDragon(img, P)
      outlineSilhouette(img, OUTLINE)
      -- the plume is outlined with the body, then drawn over it
      drawFirePlume(img, P)
    end
    if lay:cel(f) then spr:deleteCel(lay, f) end
    spr:newCel(lay, f, img, Point(0,0))
    spr.frames[f].duration = dur
  end
  local tag = spr:newTag(cursor + 1, cursor + n)
  tag.name = view and (kind .. '_' .. view) or kind
  cursor = cursor + n
end

spr:saveAs(app.params["out"])
print("wrote " .. app.params["out"] .. "  frames=" .. #spr.frames .. " tags=" .. #spr.tags)
