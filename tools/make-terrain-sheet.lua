-- Build the terrain art for The RPG Game from the village concept sketches in
-- concept-art/village-layouts/, replacing the oldest and most-visible cases in
-- render-tiles.js. One region per invocation.
--
-- Read concept-art/village-layouts/ELEMENTS.md first. It inventories the 59
-- elements of the forest concept, and its closing section explains the one
-- deliberate departure this script makes from the art: the concept's border
-- growth has no trunks at all (element 34), because the art is orthographic
-- top-down. Growth with no trunk reads as flat, so trees and saguaros here get
-- a trunk and a ground shadow. That is where the height comes from.
--
-- ONE SET OF ROLES, MANY SKINS. 01-village-of-the-lost.png and
-- 02-oasis-of-the-damned.png share their geometry exactly, down to the gate
-- arches and the fountain's ripple rose, and differ only in palette and in
-- which object fills each slot. So this script is organised around ROLES, not
-- around forests:
--
--   ground role   forest        desert
--   ----------    ------        ------
--   GROUND        turf          sand
--   FOLIAGE       canopy        cactus flesh
--   PAVE          fieldstone    bleached fieldstone
--   PLAZA         marble        sun-bleached marble
--   ROCK          mossy grey    tan rubble
--   TRIM          gate stone    sandstone
--
--   prop role     forest        desert
--   ---------     ------        ------
--   growth_*      broadleaf     saguaro
--   growth_alt_*  conifer       barrel cactus
--   shrub_*       bush          prickly pear
--   bloom_*       flower drift  desert bloom
--   landmark      moss boulder  obelisk
--   debris_*      stump         bones
--
-- Every region emits the SAME frame names, which is what lets terrain-sprite.js
-- carry one frame table and simply load a different sheet per region.
--
-- TWO SPRITES PER REGION, because the two jobs want different frame sizes and a
-- sprite has only one canvas size:
--
--   <region>-ground  48x48, seamless.  Blitted into the baked chunk canvases.
--                    48 because that is TILE_PX's default, so it lands 1:1 at
--                    the standard zoom.
--   <region>-props   96x144.  Every prop is drawn ANCHORED AT ITS FOOT, at
--                    (PW/2, PH-6), so the renderer positions it by the tile it
--                    stands on and lets the art overhang however far it wants.
--
-- The ground textures are SEAMLESS in both axes. Every stamp goes through a
-- wrapping plotter (G.px), and the fieldstone is a Voronoi over jittered sites
-- measured with wrapped distance, so a stone running off the right edge
-- continues on the left. The chunk baker fills large free-form regions with
-- these, and a texture with a hard edge would reintroduce exactly the tile seam
-- the whole exercise removes (ELEMENTS.md, element 59).
--
-- Palette: every value was sampled out of the concept PNGs as an ordered
-- dark-to-light ramp, and every sample box was confirmed by eye on a magnified
-- contact sheet before its numbers were taken. Two sampling notes worth
-- keeping, because both cost a wrong first pass:
--   * The canopy is DARKER and cooler than the turf (#4d512f against #869631).
--     The procedural T.TREE has this backwards.
--   * Green in this art is OLIVE, not emerald. Desert cactus flesh sampled at
--     around #98903e, where RED is the larger channel, so a "G > R" filter
--     finds essentially nothing.
--
-- Regenerate (run from the repo root, so dofile finds tools/aseprite-lib.lua).
-- Once per region, then two export steps per region:
--   aseprite -b --script-param region=forest ^
--            --script-param out=terrain-forest-ground.aseprite ^
--            --script-param props=terrain-forest-props.aseprite ^
--            --script-param atlas=terrain-forest-atlas.js ^
--            --script tools/make-terrain-sheet.lua
--   aseprite -b terrain-forest-ground.aseprite --sheet terrain-forest-ground.png ^
--            --data terrain-forest-ground.json --format json-array ^
--            --sheet-type rows --sheet-columns 4
--   aseprite -b terrain-forest-props.aseprite --sheet terrain-forest-props.png ^
--            --data terrain-forest-props.json --format json-array ^
--            --sheet-type rows --sheet-columns 4
--
-- Separate invocations for the same reason make-village-sheet.lua needs two:
-- the sprite this script builds is not left "open" for the CLI's own
-- --sheet/--data flags when they are chained onto a --script run. Step 1 also
-- writes <region>-atlas.js, the frame layout the game reads at runtime, as a
-- .js assigning into a global rather than the .json Aseprite emits, because the
-- game is opened from file:// where fetch cannot read a sibling file. Same
-- arrangement as hero-atlas.js and village-atlas.js; the .json files stay build
-- artefacts.
--
-- Aseprite's headless CLI returns before its writes land, so run each command
-- in its own invocation and verify in a separate one.

local lib = dofile("tools/aseprite-lib.lua")
local hex = lib.hex

local GS    = 48            -- ground frame, square and seamless
local GCOLS = 4
local PW, PH = 96, 144      -- prop frame
local PCOLS  = 4
local FOOT_X, FOOT_Y = PW / 2, PH - 6   -- where every prop stands

local RG = lib.newRaster(GS, GS)
local RP = lib.newRaster(PW, PH)

local OUTLINE = hex('#0c0907')   -- the art's near-black ink line (sampled)

----------------------------------------------------------------------
-- palettes
----------------------------------------------------------------------
-- Ordered dark to light, which is what lib.ramp() expects. See the tables in
-- terrain-art-plan.md for the coverage percentages each step carried.

local function ramps(t)
  local out = {}
  for k, v in pairs(t) do
    local r = {}
    for i = 1, #v do r[i] = hex(v[i]) end
    out[k] = r
  end
  return out
end

local PALETTES = {
  forest = ramps{
    GROUND      = { '#4a5619', '#6b7727', '#798a2b', '#869631', '#93a337' },
    GROUND_DARK = { '#3f4a15', '#5b6d23', '#687926', '#788a2d', '#879734' },
    FOLIAGE     = { '#37491c', '#3b4f22', '#4d512f', '#546c28', '#728b2f' },
    FOLIAGE2    = { '#354919', '#566a24', '#677a26', '#778a2d', '#889732' },
    PAVE        = { '#746c56', '#948b74', '#b5ac95', '#c3bba5', '#cbc4ae' },
    PLAZA       = { '#aea79a', '#bab4a8', '#c2bdb2', '#c8c4b9', '#d1cec5' },
    WATER       = { '#115373', '#167095', '#197ba3', '#2a8bb0', '#51accc' },
    WATER_DEEP  = { '#062a41', '#0a3750', '#0d4460', '#105470', '#186480' },
    ROCK        = { '#2a2f19', '#514f33', '#73694c', '#988a69', '#a59673' },
    TRIM        = { '#373328', '#4e4a36', '#585445', '#706a55', '#b5ab90' },
    -- The concept art has no trunks to sample (element 34), so bark is
    -- interpolated between the darkest roof timber and the mid rock browns
    -- rather than invented at a new hue.
    BARK        = { '#2b1d0f', '#3a2a16', '#4e3a20', '#63492a', '#7a5c37' },
    DIRT        = { '#4a3a24', '#5e4a2f', '#75603f', '#8d764f', '#a08a61' },
    PALE        = { '#c9b088', '#e5cca6', '#f5dbaa', '#f7e4bb', '#fdf0c2' },
  },
  desert = ramps{
    GROUND      = { '#986733', '#ac753b', '#d5974e', '#e6a85a', '#edb265' },
    GROUND_DARK = { '#8a5c2d', '#9c6a35', '#c08945', '#d29a51', '#dca35c' },
    -- Cactus flesh. Both sample boxes (the west border band and the east one)
    -- returned the same five steps independently, which is the cross-check on
    -- the values. What they did NOT give was the range: a filtered scan returns
    -- the most COMMON matching colours, and most of a cactus in this art is in
    -- shadow, so all five came back inside #443c13..#98903e and a stand of them
    -- rendered as brown-olive sticks. The dark end is kept as sampled and the
    -- light end extended to the lit flesh visible in the raw pixel dump.
    -- Pulled toward green from the raw sample. The filtered scan is honest
    -- about the concept's cactus flesh being olive, but reproducing that ramp
    -- literally put a khaki-brown cactus stand next to khaki-brown sand and the
    -- two stopped separating. Green is raised and red lowered by roughly one
    -- step while the value range stays where it was sampled.
    FOLIAGE     = { '#2f3a12', '#44521a', '#5c7024', '#7a9036', '#96ac4a' },
    FOLIAGE2    = { '#354012', '#4b5a1c', '#657a28', '#849b3c', '#a2b854' },
    -- Cooled and desaturated from the raw sample, for the same reason the
    -- cactus was pushed greener: sampled literally, the paving sat within a few
    -- values of the sand and a road read as a faint outline on an unbroken
    -- field of tan. The concept's roads are visibly greyer than the ground they
    -- cross; this keeps the sampled lightness and takes the warmth out.
    PAVE        = { '#a89070', '#c4ae8e', '#d6c4a6', '#e6d7bd', '#f0e3cd' },
    PLAZA       = { '#d5b891', '#ddc29c', '#e2c59d', '#e7cfad', '#efdcc0' },
    WATER       = { '#115572', '#167091', '#1c85a9', '#2b8faf', '#51aac6' },
    WATER_DEEP  = { '#062c3f', '#0a3a50', '#0e4862', '#125672', '#1a6584' },
    ROCK        = { '#372910', '#4f3316', '#714c27', '#875930', '#916933' },
    TRIM        = { '#4e3a22', '#6e5131', '#947047', '#c0a070', '#eeca92' },
    BARK        = { '#3a2a12', '#4d3818', '#5c4420', '#6b4f24', '#87663a' },
    DIRT        = { '#7a5528', '#8f6633', '#a87b40', '#c0904e', '#d2a25e' },
    PALE        = { '#c9b088', '#e5cca6', '#f5dbaa', '#f7e4bb', '#fdf0c2' },
  },
  -- Tideborn Refuge. The one region so far whose concept does NOT simply
  -- re-skin the first: it keeps the road, house and plaza skeleton, but the
  -- open ground between the houses is tidepool rather than turf, the border is
  -- ocean behind a rock breakwater instead of a treeline, and there is no tall
  -- growth anywhere in the picture.
  coast = ramps{
    GROUND      = { '#c4c3a3', '#d8bf96', '#e2caa3', '#edd6af', '#f2e0c0' },
    -- Wet sand, the band where the beach meets the water.
    GROUND_DARK = { '#a89878', '#bda986', '#cbb992', '#d9c69f', '#e4d2ac' },
    -- Warm coral. Sampled with a channel-spread filter, because beach sand is
    -- warm enough to pass any "red ahead of blue" test: sand's spread is about
    -- 63 and the corals run past 100.
    FOLIAGE     = { '#8a4a2c', '#c56a3a', '#df8e72', '#f3c178', '#ffd9a0' },
    -- Violet coral. Read off the art rather than dominance-sampled: the violet
    -- and pink corals are small and rare, so a "most common matching colour"
    -- scan finds the warm ones and the lagoon and never these. Recorded as a
    -- deliberate exception to the sampling rule, not an oversight.
    FOLIAGE2    = { '#3a2a58', '#5f3f86', '#8f5bb0', '#b47cc8', '#d4a8e0' },
    PAVE        = { '#aba296', '#b2aa9f', '#b9b1a4', '#c2bbad', '#d2ccc0' },
    PLAZA       = { '#c2bbb0', '#d3ccc1', '#ddd6cb', '#e6dfd4', '#ece5da' },
    -- Lagoon, and the ocean beyond the breakwater. The gap between these two is
    -- the widest of any region's two water tones, and it is the whole reason
    -- the deep-water category exists.
    WATER       = { '#58b0a6', '#5cbbaf', '#71bfb1', '#77c8ba', '#8fd4c3' },
    WATER_DEEP  = { '#02264a', '#022e54', '#043b60', '#07476c', '#0b5678' },
    ROCK        = { '#282728', '#414140', '#5b5b59', '#736e61', '#8a857a' },
    TRIM        = { '#6e6a60', '#8b867a', '#a8a294', '#c6c0b2', '#e2ddd0' },
    -- Bleached driftwood, which is also this region's landmark.
    BARK        = { '#5a4230', '#745942', '#907559', '#a98f72', '#c5ac8b' },
    DIRT        = { '#a89878', '#bda986', '#cbb992', '#d9c69f', '#e4d2ac' },
    PALE        = { '#daccb2', '#e6d3b2', '#eed8b2', '#f1debd', '#f8ecd4' },
  },
  -- Frostfast Hold. Back to the forest's layout exactly, unlike the coast: four
  -- roads, a ring, sixteen houses, a plaza. The hard part here is not structure,
  -- it is that almost EVERYTHING in the sketch is a pale near-neutral, so snow,
  -- cobble and marble separate by only a few values and the ramps have to stay
  -- honest or the whole picture turns to porridge.
  ice = ramps{
    -- Both snow boxes returned these five steps independently, to the byte.
    GROUND      = { '#cad1d7', '#cdd8e3', '#d2e1ed', '#d7e6f4', '#e1ecf5' },
    GROUND_DARK = { '#a8b3bf', '#b4c0cc', '#bfcbd8', '#c9d5e2', '#d3dfec' },
    -- Conifer needles, of which the sketch shows very little: the pines are so
    -- heavily snow-laden that a filtered scan over the whole border band
    -- matched only 83 pixels. Desaturated grey-green, not forest green.
    FOLIAGE     = { '#2b3d29', '#385036', '#4a664b', '#647c61', '#789379' },
    -- Ice: frost plants and crystal, the one blue-dominant thing in the frame.
    FOLIAGE2    = { '#6a9bc0', '#8fb7d5', '#bbd3e7', '#d2e1ef', '#deebf6' },
    PAVE        = { '#b5bbc1', '#bbc1ca', '#c2c9d0', '#cbd1d7', '#d1d8de' },
    -- Nudged a step paler than the sampled reading, which came back almost on
    -- top of the cobblestone. In a snowbound village everything is grey-white,
    -- and reproducing that literally lost the plaza against the ring road.
    PLAZA       = { '#b8bfc6', '#c4cbd2', '#d0d7de', '#dae1e8', '#e6edf3' },
    WATER       = { '#1d6192', '#1e699f', '#2474a9', '#3280b4', '#3989bc' },
    WATER_DEEP  = { '#0b3355', '#10406a', '#154d7e', '#1a5a90', '#2067a2' },
    -- Glacier: the deep blue of the ice walls and crystal, which is this
    -- region's rock.
    ROCK        = { '#37648f', '#4b7aa5', '#6490b9', '#7ba5cc', '#bbd0e5' },
    TRIM        = { '#6e747c', '#878e96', '#a1a8b0', '#bcc3cb', '#dde4ea' },
    BARK        = { '#2e2620', '#3d332b', '#4d4138', '#5d5046', '#6f6154' },
    DIRT        = { '#a8b3bf', '#b4c0cc', '#bfcbd8', '#c9d5e2', '#d3dfec' },
    PALE        = { '#cdd8e3', '#d7e6f4', '#e1ecf5', '#eef4fa', '#fbfdff' },
  },
  -- Stoneheart Burrow. The forest's layout again, on loose mountain scree.
  -- Everything here is a grey-brown separated mostly by value, so the two
  -- signature objects (leaning menhirs and amethyst) carry the whole region's
  -- identity and both have to stay clearly readable against the ground.
  earth = ramps{
    -- Pushed browner and a step darker than the raw sample, which came back
    -- almost exactly on top of the cobblestone and would have made every road
    -- vanish into the ground it crosses. In the sketch the scree plainly reads
    -- darker and warmer than the paving.
    -- Shifted DOWN a step from the first attempt. groundBase fills at ramp 0.65
    -- and patches at 0.85, so in practice only the top two steps of any ground
    -- ramp get much coverage; sampling the baked chunk showed earth's scree
    -- landing on #ada492 and #99907a and nothing else. Moving the whole ramp
    -- down puts the tones that actually get used where the sketch has them,
    -- clearly darker and warmer than the cobblestone crossing them.
    GROUND      = { '#4a4234', '#5a5142', '#6b6152', '#7d7361', '#918872' },
    GROUND_DARK = { '#38321f', '#46402f', '#544d3a', '#635b46', '#736a54' },
    -- Moss, in the cracks and at the foot of the rocks.
    FOLIAGE     = { '#4a4b30', '#6b6c45', '#7a7d5b', '#898a6c', '#959772' },
    -- Mountain sage: pale, barely green, and nudged a little greener than
    -- sampled so a sage bush does not read as a pale stone.
    FOLIAGE2    = { '#6e7458', '#808568', '#929878', '#a4a98c', '#b8bca2' },
    PAVE        = { '#877e71', '#958b7e', '#9f9688', '#aca496', '#bcb4a6' },
    PLAZA       = { '#aba49b', '#b3ada3', '#bbb6ae', '#c2bdb5', '#c7c3bb' },
    WATER       = { '#21729a', '#277ca2', '#2a84ab', '#358aaf', '#3e95b8' },
    WATER_DEEP  = { '#0d3f5c', '#114c70', '#155882', '#1a6594', '#2071a6' },
    -- The mountainside itself. NOTE that T.MOUNTAIN keeps its own procedural
    -- art (it autotiles against its neighbours to cap the crests, which this
    -- system cannot express), so this ramp dresses boulders and talus only.
    ROCK        = { '#282623', '#3e3d39', '#514d40', '#57544e', '#9a958a' },
    -- Menhir and gate stone.
    TRIM        = { '#7a7264', '#988e7f', '#a39e95', '#b2ae9e', '#cac6b8' },
    BARK        = { '#3a2f22', '#4a3c2b', '#5a4a34', '#6a583e', '#7c6848' },
    DIRT        = { '#4e4436', '#605445', '#726554', '#857866', '#988a78' },
    PALE        = { '#b2ae9e', '#c2bdb5', '#cfcac2', '#dcd8d0', '#e8e5de' },
  },
  -- Cinderhearth Bastion. The darkest region by a long way: ash, basalt and
  -- near-black slate roofs, with two separate oranges running through it. Note
  -- that LAVA and MAGMA_CRACK are NOT baked at all (see terrain-sprite.js):
  -- they animate, and their glow is the whole reason the region reads as
  -- volcanic, so they stay on the procedural switch over the baked ash.
  volcanic = ramps{
    -- Both ash boxes returned identical steps. Shifted up slightly so the band
    -- groundBase actually uses (ramp 0.65 to 0.85) lands on the sampled
    -- dominant tones rather than above them.
    GROUND      = { '#241d19', '#2e2521', '#3a2f29', '#473a33', '#584c43' },
    GROUND_DARK = { '#1a1512', '#221c18', '#2b2320', '#362c27', '#42362f' },
    -- Ember flowers. A duller orange than the lava on purpose: the filtered
    -- scan keeps the two apart, because averaging a flower into a lava flow
    -- would have made every bloom look molten.
    FOLIAGE     = { '#5a2a12', '#733c22', '#9a3b12', '#b65221', '#d4702e' },
    -- Sulfur shrubs, pushed yellower at the light end than the raw sample,
    -- which came back closer to brown than the sketch reads.
    FOLIAGE2    = { '#6a4218', '#865521', '#9f6625', '#b8802e', '#cfa03e' },
    PAVE        = { '#2a221d', '#342a24', '#4e433b', '#574c43', '#675a4e' },
    PLAZA       = { '#867366', '#8d7a6d', '#948173', '#9c8a7d', '#ab9a8b' },
    -- The basin sampled dark because the box caught its rim shadow; this is the
    -- same cool blue the other regions' fountains use, which is right, since it
    -- is the same asset and the one cool thing in the whole picture.
    WATER       = { '#12506e', '#17658a', '#1d7aa4', '#2a8fbb', '#3ba5d0' },
    WATER_DEEP  = { '#08283a', '#0c3450', '#104066', '#144d7a', '#1a5a8e' },
    -- Molten rock. Sampled from the flows outside the caldera rim, with the
    -- bright end extended: the scan finds the body of a flow, not its core.
    LAVA        = { '#8a2408', '#b53a10', '#d4551a', '#ee7a26', '#ffa844' },
    -- Basalt, which is also the obsidian. The light end is opened up well past
    -- the sample: read literally the whole ramp sat under #50, drawRock's lit
    -- facet had nowhere to go, and the caldera rim came out as rows of flat
    -- dark lozenges. The dark end is where the sketch has it; the range is not.
    ROCK        = { '#100d0c', '#1e1715', '#2e2622', '#453931', '#6d5c50' },
    TRIM        = { '#4a423c', '#5e554d', '#756b61', '#8d8277', '#a89c90' },
    BARK        = { '#2a1f18', '#372a20', '#45362a', '#534234', '#64513f' },
    DIRT        = { '#241d19', '#2e2521', '#3a2f29', '#473a33', '#584c43' },
    PALE        = { '#584c43', '#675a4e', '#786a5c', '#8a7b6c', '#9c8c7c' },
  },
  -- Stormcrown Aerie, built on a cloud island in open sky.
  --
  -- The hardest separation problem of the seven. Cloud floor, cloud bank,
  -- cobblestone and marble ALL sampled as the same near-white (#d9 to #f4), so
  -- reproducing them literally would have collapsed the roads, the plaza and
  -- the ground the hero walks on into one white field. The four are pulled
  -- apart into a deliberate value ladder instead: cobble darkest, then plaza,
  -- then cloud floor, then cloud bank brightest. The sketch does separate them,
  -- just by less than survives at tile size.
  air = ramps{
    -- Every value below is pushed harder than the first attempt, which used a
    -- ladder about half this wide and rendered as one flat white field with the
    -- roads barely visible as ghost outlines. The sketch's own separation is
    -- genuinely tiny; at tile size it has to be roughly doubled to survive.
    --
    -- The ladder is set at STEP 4, not across the whole ramp. groundBase fills
    -- with lib.ramp(P, 0.65), and for a five-entry ramp that resolves to index
    -- 4 exactly; the patch pass at 0.85 lands on 4 or 5. So step 4 is the tone
    -- a material actually reads as, and it is the one that has to be separated
    -- from its neighbours. Reading step 4 across the four pale materials here:
    -- pave #a8b0bd, cloud #cdd6e4, plaza #dee1e6, cloudbank #eef1f7.
    GROUND      = { '#93a0b8', '#a5b1c6', '#b7c2d5', '#cdd6e4', '#e0e7f0' },
    -- NOTE the inversion: for every other region GROUND_DARK is ground in
    -- shadow, but the air region's second ground tone is T.CLOUDBANK, a
    -- BRIGHTER puff standing above the walkable floor. The role is "the other
    -- ground tone" and here it happens to be lighter.
    GROUND_DARK = { '#d8dee9', '#e5eaf2', '#eef1f7', '#f6f8fb', '#fdfdff' },
    -- Wind reeds and storm thistles: a soft teal.
    FOLIAGE     = { '#5c7492', '#7089a8', '#89a6c5', '#a7b8d3', '#c4d2e2' },
    -- Sky blooms: pale violet.
    FOLIAGE2    = { '#7a74a0', '#9a94c0', '#b9b4da', '#cbc5e5', '#e2dff0' },
    PAVE        = { '#6f7784', '#828a97', '#959daa', '#a8b0bd', '#bcc4d0' },
    PLAZA       = { '#b0b6c0', '#c0c5cd', '#d0d4da', '#dee1e6', '#ecedf1' },
    WATER       = { '#2b98c8', '#359ac8', '#39a8d5', '#45acd6', '#48b4db' },
    -- Open sky beyond the cloud island. It fills the deep-water slot because
    -- that is exactly its role: the impassable far surface at the map's edge.
    WATER_DEEP  = { '#06426f', '#0a5a8e', '#0c68a7', '#1471ae', '#247bb9' },
    -- Cloud spires: the region's rock is made of cloud. Opened right up at the
    -- dark end, because a spire drawn inside a #c0-to-#f8 range is white on a
    -- white floor and only its ink outline survives.
    ROCK        = { '#8e9bb2', '#a8b4c8', '#c2ccdc', '#dce3ee', '#f4f7fb' },
    TRIM        = { '#8a919c', '#a0a7b2', '#b8bec8', '#d0d5dc', '#e8ebef' },
    BARK        = { '#4a3a24', '#5d4a2e', '#795835', '#99733f', '#a57a47' },
    DIRT        = { '#a8afba', '#b8bec8', '#c8ced6', '#d8dce2', '#e6e9ee' },
    PALE        = { '#e5eaf2', '#eef1f7', '#f6f8fb', '#fbfcfe', '#ffffff' },
  },
  -- Voltheart Bastion. The air region's structure with the lights turned off:
  -- another sky island, but the cloud is a thunderhead and the floor is near
  -- black, lit only by cyan crystal, violet spark growth and the bolts running
  -- round the rim.
  --
  -- Ramps are set at STEP 4, per the note in the air block. The ladder that
  -- matters here, darkest to lightest: thunderhead #1e203a, storm floor
  -- #2a2e41, cobblestone #878899, plaza #a8abbb.
  lightning = ramps{
    GROUND      = { '#121623', '#1a1f30', '#22283c', '#2a2e41', '#363c52' },
    -- Storm banks: the darker churn dappled across the floor.
    GROUND_DARK = { '#090a14', '#10111f', '#1e203a', '#272942', '#33355a' },
    -- Spark growth: violet, extended past the sample at the bright end because
    -- the scan finds the shaded body of a frond and not its lit tips.
    FOLIAGE     = { '#2a2360', '#322a75', '#413a77', '#6f62b0', '#a898e0' },
    -- Volt crystal: vivid cyan-blue, the brightest colour on the ground.
    FOLIAGE2    = { '#12305e', '#1f57b0', '#3d72e0', '#6fa3e8', '#b8d8f8' },
    PAVE        = { '#3e4152', '#565968', '#6e6f80', '#878899', '#a0a1b1' },
    PLAZA       = { '#777785', '#898a99', '#92929f', '#a8abbb', '#c0c3d0' },
    WATER       = { '#083e75', '#065496', '#085d9e', '#0a65a8', '#1877b9' },
    -- The border thunderhead. It fills the deep slot the way the air region
    -- puts open sky there: the impassable mass past the island's rim. Nearly
    -- black, so the bolts drawn over it read.
    WATER_DEEP  = { '#05060d', '#0a0b16', '#0f1022', '#16172e', '#1e1f3c' },
    ROCK        = { '#14161f', '#1e2130', '#2a2e41', '#3b3e50', '#5c6076' },
    TRIM        = { '#4a4d5e', '#5e6172', '#757887', '#8e919f', '#adb0be' },
    BARK        = { '#1a1c26', '#24262f', '#2f323d', '#3c3f4c', '#4c4f5e' },
    DIRT        = { '#121623', '#1a1f30', '#22283c', '#2a2e41', '#363c52' },
    -- Bolt white.
    PALE        = { '#9a97d8', '#c2bff4', '#dfe0f9', '#ececff', '#ffffff' },
  },
  -- Solarspire Sanctum. Everything here is warm and bright, so the separations
  -- are between shades of gold and cream rather than between hues.
  --
  -- This is also the region where EVERY tile animates: floor, glow pools,
  -- blooms, crystal and the light pillar all pulse. All of them draw their light
  -- as translucent washes over the shared base square, which is exactly what the
  -- bake-plus-overlay path wants, so the bake supplies a textured golden floor
  -- and rounded paved regions and the tiles keep every bit of their shimmer.
  luminous = ramps{
    -- Step 4 is the golden floor tone, per the ladder note in the air block.
    GROUND      = { '#a89050', '#bda264', '#cbb271', '#dcc87e', '#e8d79a' },
    -- Only a little darker than the floor. A first pass dropped it a long way
    -- and, since this region does not trace its second tone, the ground under
    -- the crystal wall came out as hard-edged dark rectangles. Here it needs to
    -- read as shade, not as a different material.
    GROUND_DARK = { '#b09a5c', '#bfa96c', '#cbb679', '#d6c187', '#e0cd97' },
    -- The sanctum's gold growth.
    FOLIAGE     = { '#a8842c', '#c39c3e', '#d9b759', '#e8c768', '#f5d677' },
    -- Prismatic shards: the one cool note on the ground.
    FOLIAGE2    = { '#b8cfe0', '#cce6f4', '#dceef8', '#ecf6fb', '#fbfcf9' },
    -- Paving is PALER than the floor here, which is the reverse of every other
    -- region and is what the sketch shows: cream roads across a golden field.
    PAVE        = { '#d8c48a', '#e4d29e', '#eddfb8', '#f5ecd0', '#f9f5e6' },
    PLAZA       = { '#cfc0aa', '#ddd0be', '#e6dbcb', '#ede2d0', '#f5eee4' },
    WATER       = { '#187aa6', '#1789b8', '#1997c7', '#2699c7', '#28a5d4' },
    WATER_DEEP  = { '#0a4a6a', '#0e5a80', '#126a96', '#167aac', '#1a8ac2' },
    -- The crystal border wall, the brightest thing in the frame.
    ROCK        = { '#d8bf72', '#e8d48c', '#f4e6b0', '#fbf3d4', '#fdfcf2' },
    TRIM        = { '#c8b894', '#d8caa8', '#e6dcc2', '#f0ead8', '#faf6ec' },
    BARK        = { '#9a8248', '#ad9358', '#bfa468', '#d0b478', '#e0c48c' },
    DIRT        = { '#a89050', '#bda264', '#cbb271', '#dcc87e', '#e8d79a' },
    PALE        = { '#f4e6b0', '#fbf3d4', '#fdf9e6', '#fefdf4', '#ffffff' },
  },
  -- Ossuary of the Pale King. A graveyard: dark blight underfoot, crypt walls
  -- and dead trees around the rim, and pale headstones absolutely everywhere.
  -- The paving and the plaza are the BRIGHT things here, which with the near
  -- black roofs gives the region most of its contrast.
  necrotic = ramps{
    GROUND      = { '#241f1e', '#2c2625', '#352e2c', '#433b38', '#574e4a' },
    -- Grave dirt, and the ground in the shadow of the crypt wall.
    GROUND_DARK = { '#161313', '#1e1a19', '#292422', '#332c2b', '#3f3735' },
    -- Withered growth.
    FOLIAGE     = { '#1a1614', '#262019', '#362d22', '#47392b', '#5b4a38' },
    -- Corpse flowers. Read off the art rather than dominance-sampled: a violet
    -- filter over the quadrants came back with the dark ground every time,
    -- because these are small and only barely more violet than the blight.
    FOLIAGE2    = { '#2e2030', '#3f2c42', '#533a56', '#6a4d6c', '#83628a' },
    PAVE        = { '#5a534e', '#6d655f', '#7c746d', '#8b837b', '#9c948c' },
    -- Pushed paler than sampled, which put it almost exactly on the cobble.
    PLAZA       = { '#8c837c', '#9a918a', '#a8a099', '#b6aea7', '#c4bcb5' },
    -- A cold, desaturated basin: the one fountain in the game nobody tends.
    WATER       = { '#1a2c35', '#22343d', '#253b45', '#2b424c', '#334b55' },
    WATER_DEEP  = { '#0d1a20', '#12242c', '#172e38', '#1c3844', '#214250' },
    -- Headstone and crypt stone.
    ROCK        = { '#6a625a', '#7c736a', '#8b8379', '#9b948a', '#aba399' },
    TRIM        = { '#4a4442', '#5c5552', '#6f6764', '#837a76', '#9a918c' },
    -- Dead wood, nearly black.
    BARK        = { '#0a0809', '#191617', '#2a2525', '#322c2b', '#3a3534' },
    DIRT        = { '#241f1e', '#2c2625', '#352e2c', '#433b38', '#574e4a' },
    -- Bone.
    PALE        = { '#988e88', '#a2978d', '#aaa399', '#bdb5ab', '#d0c8be' },
    -- This region's accent tile is T.LAVA, which is odd for a graveyard but is
    -- what regions.js says. Kept a dull ember rather than bright molten, so the
    -- animated orange the tile draws on top does not fight the palette.
    LAVA        = { '#3a1a08', '#55250e', '#6f3416', '#88451e', '#a05a2a' },
  },
  -- Mire-warden Citadel. The concept is almost entirely dark olive and root
  -- brown, with the pale roads and acid-lime mushroom caps supplying its two
  -- strong value accents. The mangrove border is darker than the open mire,
  -- but not black: the exposed roots still need to separate inside the band.
  poison = ramps{
    GROUND      = { '#202317', '#2b2f1d', '#363b24', '#414628', '#52562e' },
    -- Waterlogged bog and the ground under the mangrove wall.
    GROUND_DARK = { '#14180f', '#1b2114', '#242c18', '#30371f', '#3d4526' },
    -- Mangrove canopy and hanging moss.
    FOLIAGE     = { '#181b11', '#242819', '#313620', '#414725', '#555b2f' },
    -- Reeds, marsh fern and algae. The bright end is also the fungus glow.
    FOLIAGE2    = { '#344019', '#4b5a20', '#657427', '#829331', '#a3b63b' },
    PAVE        = { '#74715b', '#88836c', '#9c967f', '#ada993', '#c0bdae' },
    PLAZA       = { '#8e8d82', '#a19f94', '#b1afa5', '#bfbdb4', '#cbc9c0' },
    WATER       = { '#17616b', '#1b7580', '#238892', '#329aa1', '#53adb0' },
    -- Stagnant pools beyond the scum skin.
    WATER_DEEP  = { '#0e170c', '#15220f', '#1d3014', '#29411b', '#385625' },
    -- Tangled root and thicket mass.
    ROCK        = { '#15130e', '#241f16', '#342c1d', '#493c27', '#625234' },
    TRIM        = { '#514d40', '#6b6654', '#84806b', '#9d9882', '#b6b19c' },
    BARK        = { '#17110c', '#281e14', '#3a2c1c', '#503e27', '#695335' },
    DIRT        = { '#202317', '#2b2f1d', '#363b24', '#414628', '#52562e' },
    -- Mushroom stalks and the palest algae flecks.
    PALE        = { '#8d8968', '#a39d78', '#b8b18a', '#cec69d', '#e0d9b2' },
  },
  -- Heartstone Conclave. Cool teal forest floor under immense blue-green
  -- trees, with violet flowers and cyan crystal growth around the border.
  mana = ramps{
    GROUND      = { '#163b45', '#1d4b55', '#275b64', '#326b73', '#43808a' },
    GROUND_DARK = { '#102d37', '#153a46', '#1d4653', '#275866', '#356b77' },
    FOLIAGE     = { '#173752', '#214c64', '#2e6070', '#477b86', '#6a959d' },
    FOLIAGE2    = { '#3a2d68', '#58408f', '#7458bc', '#9270df', '#b89aff' },
    PAVE        = { '#665e80', '#7d7395', '#958aa9', '#aa9ec2', '#bcb0d1' },
    PLAZA       = { '#887e9e', '#9c91b1', '#afa2c8', '#c0b4d5', '#d1c6e2' },
    WATER       = { '#17647c', '#1d7690', '#2788a1', '#389bad', '#58afbd' },
    WATER_DEEP  = { '#0b3047', '#104159', '#17536c', '#20667e', '#2c7a90' },
    ROCK        = { '#12344e', '#17617a', '#258aa0', '#40bfd0', '#81edf1' },
    TRIM        = { '#514e6b', '#696581', '#837d99', '#9c95b0', '#b7aec9' },
    BARK        = { '#2b1f35', '#463451', '#624a69', '#7b607d', '#967b96' },
    DIRT        = { '#23454d', '#31565d', '#42696f', '#587d82', '#719297' },
    PALE        = { '#a9a8bd', '#bbb9cc', '#cbc9da', '#dedbeb', '#eeeafa' },
  },
  -- Umbral Sanctum. Near-black violet ground and walls, grey paving and
  -- concentrated violet growth. Value separation matters more than hue here.
  shadow = ramps{
    GROUND      = { '#0d0b12', '#15121b', '#201b26', '#2b252f', '#393239' },
    GROUND_DARK = { '#050407', '#0a0810', '#100d17', '#171220', '#21182c' },
    FOLIAGE     = { '#0c0912', '#171022', '#261638', '#3a2254', '#59367a' },
    FOLIAGE2    = { '#2a1744', '#432366', '#63378f', '#8555b7', '#ab82d8' },
    PAVE        = { '#332c31', '#463d41', '#5a5052', '#706666', '#8d837e' },
    PLAZA       = { '#565052', '#6c6667', '#807a7b', '#969091', '#aca7a7' },
    WATER       = { '#12182c', '#1a2340', '#243052', '#304064', '#40547a' },
    WATER_DEEP  = { '#020205', '#05040a', '#090713', '#100b1d', '#191128' },
    ROCK        = { '#020204', '#07070b', '#0d0c12', '#171420', '#282332' },
    TRIM        = { '#252127', '#39343a', '#50494e', '#6a6265', '#8a8385' },
    BARK        = { '#030205', '#08060c', '#100b16', '#1a1124', '#291a38' },
    DIRT        = { '#100d14', '#1b171e', '#272127', '#342c31', '#443a3e' },
    PALE        = { '#8e8997', '#aaa4b3', '#c2bccb', '#d8d2df', '#eee9f3' },
  },
}
-- One typo guard: a malformed hex above silently produces nil and then a
-- confusing arithmetic error hundreds of lines later.
for rname, p in pairs(PALETTES) do
  for k, v in pairs(p) do
    for i = 1, #v do
      if v[i] == nil then error('bad colour in ' .. rname .. '.' .. k .. ' step ' .. i) end
    end
  end
end

-- Bloom colours per region: the forest's yellow-and-white drifts, and the
-- desert's sparse orange-red flowers (element: the flowering tips the concept
-- puts on every prickly pear).
local BLOOMS = {
  forest = { A = hex('#e0cf46'), A_L = hex('#f4e88a'),
             B = hex('#e6e3d6'), B_L = hex('#fbfaf3'), STEM = hex('#566a24') },
  desert = { A = hex('#d4541f'), A_L = hex('#f08a3c'),
             B = hex('#c93b26'), B_L = hex('#e86a4a'), STEM = hex('#6a6428') },
  -- The coast's "blooms" are starfish and shells scattered on the beach, so
  -- these are the starfish orange and the shell cream rather than petal colours.
  coast  = { A = hex('#d8813c'), A_L = hex('#f0a95e'),
             B = hex('#e6d3b2'), B_L = hex('#f8ecd4'), STEM = hex('#b8a184') },
  -- Winter berries and frost lilies. The berry red is read off the art rather
  -- than dominance-sampled: the berries are a few pixels each and a filtered
  -- scan over the whole quadrant matched five of them.
  ice    = { A = hex('#c4392c'), A_L = hex('#e0655a'),
             B = hex('#bbd3e7'), B_L = hex('#eef6fc'), STEM = hex('#6a7a72') },
  -- Earth's "blooms" are amethyst clusters, so these are the crystal violets.
  -- The light end is extended past the sample: the scan found the shadowed body
  -- of the crystals, not their lit tips, which is where the colour lives.
  earth  = { A = hex('#8f76ad'), A_L = hex('#c4aede'),
             B = hex('#6b5a7e'), B_L = hex('#a08cb8'), STEM = hex('#6e7458') },
  -- Ember flowers, on charred stems.
  volcanic = { A = hex('#cf5a1c'), A_L = hex('#f79a3e'),
               B = hex('#a8411a'), B_L = hex('#d97a30'), STEM = hex('#5a4a2e') },
  -- Sky blooms (violet) and reed heads (teal), on pale stems.
  air    = { A = hex('#a79fd0'), A_L = hex('#e2dff0'),
             B = hex('#89a6c5'), B_L = hex('#c4d2e2'), STEM = hex('#8b9aae') },
  -- Volt crystal (cyan) and spark growth (violet), on dark stems.
  lightning = { A = hex('#3d72e0'), A_L = hex('#b8d8f8'),
                B = hex('#6f62b0'), B_L = hex('#a898e0'), STEM = hex('#4a4470') },
  luminous  = { A = hex('#e8c768'), A_L = hex('#f9e8b8'),
                B = hex('#cce6f4'), B_L = hex('#fbfcf9'), STEM = hex('#b39a52') },
  necrotic  = { A = hex('#6a4d6c'), A_L = hex('#a37fa8'),
                B = hex('#aaa399'), B_L = hex('#d0c8be'), STEM = hex('#3a322a') },
  poison    = { A = hex('#83ad13'), A_L = hex('#c1e63a'),
                B = hex('#6b4d25'), B_L = hex('#9a7440'), STEM = hex('#526927') },
  mana      = { A = hex('#7458bc'), A_L = hex('#b89aff'),
                B = hex('#40bfd0'), B_L = hex('#81edf1'), STEM = hex('#477b86') },
  shadow    = { A = hex('#63378f'), A_L = hex('#ab82d8'),
                B = hex('#8e8997'), B_L = hex('#d8d2df'), STEM = hex('#261638') },
}

-- The active palette. Swapped by usePalette() before each region is built, so
-- every draw function below can read these as upvalues instead of taking a
-- palette argument through six levels of call.
local GROUND, GROUND_DARK, FOLIAGE, FOLIAGE2, PAVE, PLAZA, WATER, WATER_DEEP,
      LAVA, ROCK, TRIM, BARK, DIRT, PALE, BLOOM

local function usePalette(region)
  local p = PALETTES[region] or error('no palette for region ' .. tostring(region))
  GROUND, GROUND_DARK = p.GROUND, p.GROUND_DARK
  FOLIAGE, FOLIAGE2   = p.FOLIAGE, p.FOLIAGE2
  PAVE, PLAZA, WATER  = p.PAVE, p.PLAZA, p.WATER
  WATER_DEEP          = p.WATER_DEEP or p.WATER
  -- Only the volcanic and necrotic regions carry molten ground, but every
  -- region emits the frames, so the rest fall back to something harmless.
  LAVA                = p.LAVA or p.WATER_DEEP or p.WATER
  ROCK, TRIM, BARK    = p.ROCK, p.TRIM, p.BARK
  DIRT, PALE          = p.DIRT, p.PALE
  BLOOM               = BLOOMS[region] or BLOOMS.forest
end

----------------------------------------------------------------------
-- helpers
----------------------------------------------------------------------

-- Deterministic LCG, so the sheets are byte-reproducible across runs. Lua's
-- math.random is not guaranteed stable across builds and the whole point of a
-- generated sheet is that regenerating it produces the same art.
local function newRng(seed)
  local s = seed % 2147483647
  if s <= 0 then s = s + 2147483646 end
  return function()
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  end
end

local function rgba(c, a)
  return app.pixelColor.rgba(
    app.pixelColor.rgbaR(c), app.pixelColor.rgbaG(c), app.pixelColor.rgbaB(c), a)
end

-- Pick a ramp step with a little random wobble, so a flat fill gets tonal
-- variation without leaving the sampled palette.
local function jitterRamp(ramp, t, rng, spread)
  return lib.ramp(ramp, math.max(0, math.min(1, t + (rng() - 0.5) * (spread or 0.3))))
end

-- Source-over composite. Written out rather than using Image:drawImage because
-- the props need a shadow layer UNDER an ink-outlined body layer, and the
-- outline pass has to see the body's silhouette alone.
local function over(dst, src, W, H)
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      local s  = src:getPixel(x, y)
      local sa = app.pixelColor.rgbaA(s)
      if sa == 255 then
        dst:drawPixel(x, y, s)
      elseif sa > 0 then
        local d  = dst:getPixel(x, y)
        local da = app.pixelColor.rgbaA(d)
        local a  = sa / 255
        local na = sa + da * (1 - a)
        if na > 0 then
          local function ch(fs, fd)
            return math.floor((fs * sa + fd * da * (1 - a)) / na + 0.5)
          end
          dst:drawPixel(x, y, app.pixelColor.rgba(
            ch(app.pixelColor.rgbaR(s), app.pixelColor.rgbaR(d)),
            ch(app.pixelColor.rgbaG(s), app.pixelColor.rgbaG(d)),
            ch(app.pixelColor.rgbaB(s), app.pixelColor.rgbaB(d)),
            math.floor(na + 0.5)))
        end
      end
    end
  end
end

----------------------------------------------------------------------
-- ground: wrapping plotter
----------------------------------------------------------------------

local G = {}

function G.px(img, x, y, c)
  img:drawPixel(math.floor(x) % GS, math.floor(y) % GS, c)
end

function G.blob(img, cx, cy, rx, ry, c)
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
      if dx * dx + dy * dy <= 1.0 then G.px(img, x, y, c) end
    end
  end
end

function G.fill(img, c)
  for y = 0, GS - 1 do for x = 0, GS - 1 do img:drawPixel(x, y, c) end end
end

-- Shortest delta on a wrapped axis, so distances are measured the way the
-- texture actually repeats.
local function wrapD(a, b)
  local d = a - b
  if d >  GS / 2 then d = d - GS end
  if d < -GS / 2 then d = d + GS end
  return d
end

----------------------------------------------------------------------
-- ground textures
----------------------------------------------------------------------

-- Turf or sand. Mottled base with darker blotches and paler patches, soft
-- painted variation with no repeat, then a scatter of upright marks and the odd
-- pebble. `cracked` adds the fine dark fissures the desert concept draws across
-- its open ground.
-- `sparkle` adds the scatter of hard white glints the frost sketch puts across
-- its open snow, which is the one texture cue that stops a pale near-neutral
-- field reading as blank paper.
local function groundBase(img, seed, shaded, cracked, sparkle)
  local rng = newRng(seed)
  local P = shaded and GROUND_DARK or GROUND
  G.fill(img, lib.ramp(P, shaded and 0.45 or 0.65))
  for i = 1, 26 do                                  -- broad tonal blotches
    G.blob(img, rng() * GS, rng() * GS, 4 + rng() * 7, 3 + rng() * 6,
           jitterRamp(P, shaded and 0.3 or 0.5, rng, 0.35))
  end
  for i = 1, 30 do                                  -- lighter patches
    G.blob(img, rng() * GS, rng() * GS, 2 + rng() * 4, 2 + rng() * 3,
           jitterRamp(P, shaded and 0.6 or 0.85, rng, 0.25))
  end
  -- Shadow specks and upright marks, both deliberately weak. An early pass used
  -- the darkest ramp step for 14 specks and the lightest for 22 marks, and at
  -- 48px that read as scattered dark crosses on noise rather than as ground.
  for i = 1, 7 do
    G.blob(img, rng() * GS, rng() * GS, 1 + rng() * 1.6, 1 + rng() * 1.2,
           lib.ramp(P, 0.2))
  end
  for i = 1, 14 do
    local x, y = rng() * GS, rng() * GS
    local h = 2 + math.floor(rng() * 2)
    local c = lib.ramp(P, 0.85)
    for k = 0, h do G.px(img, x, y - k, c) end
  end
  if cracked then
    -- Wandering hairline fissures, wrapped like everything else.
    for i = 1, 3 do
      local x, y = rng() * GS, rng() * GS
      local a = rng() * math.pi * 2
      local c = lib.ramp(P, 0.0)
      for k = 0, 26 do
        a = a + (rng() - 0.5) * 0.8
        x, y = x + math.cos(a) * 1.7, y + math.sin(a) * 1.7
        G.px(img, x, y, c)
      end
    end
  end
  if sparkle then
    -- Count AND brightness are per region, not a fixed 16 white specks. On the
    -- frost region's pale snow, sixteen full-white glints read as a sparkle; on
    -- the lightning region's near-black storm floor the same sixteen read as
    -- heavy static and buried the ground under noise.
    local hi = lib.ramp(PALE, sparkle.t)
    for i = 1, sparkle.n do
      local x, y = rng() * GS, rng() * GS
      G.px(img, x, y, hi)
      if rng() < (sparkle.cross or 0.45) then       -- a few as tiny crosses
        G.px(img, x + 1, y, hi); G.px(img, x - 1, y, hi)
        G.px(img, x, y + 1, hi); G.px(img, x, y - 1, hi)
      end
    end
  elseif not shaded then
    for i = 1, 3 do                                 -- loose pebbles
      G.blob(img, rng() * GS, rng() * GS, 1.2, 1.0, lib.ramp(ROCK, 0.75))
    end
  end
end

-- Fieldstone. Irregular polygonal stones of uneven size, every one ink-outlined.
-- A Voronoi over jittered sites gives exactly that, and measuring it with wrapD
-- makes it seamless.
local function groundPave(img, seed, sites)
  local rng = newRng(seed)
  local N = sites or 5
  local S = {}
  for gy = 0, N - 1 do
    for gx = 0, N - 1 do
      S[#S + 1] = {
        x = (gx + 0.5 + (rng() - 0.5) * 0.85) * GS / N,
        y = (gy + 0.5 + (rng() - 0.5) * 0.85) * GS / N,
        c = jitterRamp(PAVE, 0.55 + rng() * 0.35, rng, 0.22),
      }
    end
  end
  local joint = lib.ramp(PAVE, 0.0)
  for y = 0, GS - 1 do
    for x = 0, GS - 1 do
      local d1, d2, best = 1e9, 1e9, nil
      for i = 1, #S do
        local dx, dy = wrapD(x + 0.5, S[i].x), wrapD(y + 0.5, S[i].y)
        local d = dx * dx + dy * dy
        if d < d1 then d2 = d1; d1 = d; best = S[i]
        elseif d < d2 then d2 = d end
      end
      -- Near-equal distance to two sites means a cell boundary, which is the
      -- mortar joint and the stone's ink line in one.
      if math.sqrt(d2) - math.sqrt(d1) < 1.15 then
        img:drawPixel(x, y, joint)
      else
        img:drawPixel(x, y, best.c)
      end
    end
  end
end

-- Dressed stone: one large regular flagstone per tile, with veining and thin
-- joints. Deliberately NOT seamless-random like the ground: this is masonry and
-- the grid is the point, which is also why the plaza ramp is so much tighter
-- than the fieldstone one.
local function groundPlaza(img, seed)
  local rng = newRng(seed)
  G.fill(img, lib.ramp(PLAZA, 0.55))
  -- Streaks, not blobs. Scattering round blobs across a flagstone reads as pale
  -- bubbles; veining in stone runs in a direction, so each mark is a short
  -- elongated smear along a shared bedding angle.
  local bed = rng() * math.pi
  for i = 1, 16 do
    local cx, cy = rng() * GS, rng() * GS
    local a = bed + (rng() - 0.5) * 0.9
    local len = 4 + rng() * 12
    local c = jitterRamp(PLAZA, 0.45 + rng() * 0.4, rng, 0.18)
    for k = 0, len do
      G.blob(img, cx + math.cos(a) * k, cy + math.sin(a) * k, 1.6, 1.3, c)
    end
  end
  for i = 1, 3 do
    local x, y = rng() * GS, rng() * GS
    local a = bed + (rng() - 0.5) * 0.5
    local c = lib.ramp(PLAZA, 0.15)
    for k = 0, 26 do
      a = a + (rng() - 0.5) * 0.45
      x, y = x + math.cos(a) * 1.6, y + math.sin(a) * 1.6
      G.px(img, x, y, c)
    end
  end
  local jd, jl = lib.ramp(PLAZA, 0.0), lib.ramp(PLAZA, 1.0)
  for i = 0, GS - 1 do                              -- joints: dark N/W, lit S/E
    img:drawPixel(i, 0, jd); img:drawPixel(0, i, jd)
    img:drawPixel(i, GS - 1, jl); img:drawPixel(GS - 1, i, jl)
  end
end

local function groundDirt(img, seed)
  local rng = newRng(seed)
  G.fill(img, lib.ramp(DIRT, 0.55))
  for i = 1, 30 do
    G.blob(img, rng() * GS, rng() * GS, 3 + rng() * 6, 2 + rng() * 4,
           jitterRamp(DIRT, 0.35 + rng() * 0.45, rng, 0.25))
  end
  for i = 1, 16 do
    G.blob(img, rng() * GS, rng() * GS, 1, 1, jitterRamp(DIRT, 0.15, rng, 0.2))
  end
  for i = 1, 5 do
    G.blob(img, rng() * GS, rng() * GS, 1.3, 1.1, lib.ramp(ROCK, 0.7))
  end
end

-- Bands, not blobs. Water reads as horizontal wave lines under a top-down view;
-- round blobs give dark lozenges floating in cyan. Each band is a shallow sine
-- run so the wave has a crest and a trough rather than being a straight rule.
-- `deep` selects the ocean ramp instead of the shallow one. Two water tones,
-- because the coast concept's lagoon and its ocean are further apart than any
-- other pair of materials in any of the sketches, and painting both from one
-- ramp loses the breakwater entirely.
local function groundWater(img, seed, deep)
  local rng = newRng(seed)
  local P = deep and WATER_DEEP or WATER
  G.fill(img, lib.ramp(P, 0.55))
  for i = 1, 14 do
    local y0 = rng() * GS
    local amp = 0.8 + rng() * 1.8
    local ph  = rng() * math.pi * 2
    local thick = 1.5 + rng() * 2.2
    local c = jitterRamp(P, 0.25 + rng() * 0.4, rng, 0.2)
    for x = 0, GS - 1 do
      G.blob(img, x, y0 + math.sin(x * 0.22 + ph) * amp, 1.1, thick, c)
    end
  end
  for i = 1, deep and 5 or 9 do                     -- surface glints
    local y0, x0 = rng() * GS, rng() * GS
    local w  = 4 + math.floor(rng() * 7)
    local ph = rng() * math.pi * 2
    for k = 0, w do
      G.px(img, x0 + k, y0 + math.sin((x0 + k) * 0.22 + ph) * 1.2, lib.ramp(P, 1.0))
    end
  end
end

-- Molten rock: a dark crust broken by a network of bright cracks, which is the
-- opposite construction to water. Water is a bright field with darker bands
-- across it; lava is a dark field with the glow showing THROUGH it, so this
-- draws the crust first and then eats channels out of it.
local function groundLava(img, seed)
  local rng = newRng(seed)
  G.fill(img, lib.ramp(LAVA, 0.15))
  -- Crust plates: dark irregular blobs over the glow.
  for i = 1, 16 do
    G.blob(img, rng() * GS, rng() * GS, 5 + rng() * 9, 4 + rng() * 8,
           jitterRamp(LAVA, 0.0, rng, 0.16))
  end
  -- Molten channels between the plates, brightest at their centres.
  for i = 1, 7 do
    local x, y = rng() * GS, rng() * GS
    local a = rng() * math.pi * 2
    for k = 0, 30 do
      a = a + (rng() - 0.5) * 0.7
      x, y = x + math.cos(a) * 1.8, y + math.sin(a) * 1.8
      G.blob(img, x, y, 2.2, 1.9, lib.ramp(LAVA, 0.55))
      G.blob(img, x, y, 1.0, 0.9, lib.ramp(LAVA, 0.9))
    end
  end
  for i = 1, 10 do                                  -- hot specks
    G.blob(img, rng() * GS, rng() * GS, 1.1, 1.0, lib.ramp(LAVA, 1.0))
  end
end

----------------------------------------------------------------------
-- props: shared pieces
----------------------------------------------------------------------

-- A canopy is a rosette of scalloped lobes drawn as one shape. Ringing N
-- lobe-ellipses around a centre and filling the middle produces the cloud-like
-- scalloped outline directly.
--
-- Both the ring radius AND the individual lobe size are jittered. Jittering only
-- the radius still produced a near-perfect circle: the lobes are what you
-- actually see, so if they are all the same size the silhouette reads as a
-- lollipop rather than as an uneven canopy.
local function rosette(img, cx, cy, R, lobeR, n, c, rng, wobble)
  local w = wobble or 0.18
  for i = 0, n - 1 do
    local a  = (i / n) * math.pi * 2 + (rng() - 0.5) * 0.45
    local rr = R * (1 + (rng() - 0.5) * w)
    local lr = lobeR * (0.72 + rng() * 0.62)
    RP.ellipsePx(img, cx + math.cos(a) * rr, cy + math.sin(a) * rr,
                 lr, lr * (0.82 + rng() * 0.24), c)
  end
  RP.ellipsePx(img, cx, cy, R * 0.94, R * 0.86, c)
end

-- Every raised object casts a soft shadow whose length scales with its height.
-- Two rings, a wide faint one under a tighter denser one, because a single flat
-- ellipse at a low alpha is almost invisible against ground and the props read
-- as floating.
local function footShadow(img, w, h, a)
  local base = a or 130
  RP.ellipsePx(img, FOOT_X + w * 0.20, FOOT_Y - 1, w * 1.25, h * 1.25,
               rgba(hex('#1a2410'), math.floor(base * 0.45)))
  RP.ellipsePx(img, FOOT_X + w * 0.16, FOOT_Y - 2, w, h,
               rgba(hex('#1a2410'), base))
end

----------------------------------------------------------------------
-- props: forest shapes
----------------------------------------------------------------------

-- `tone` shifts every canopy step along the ramp: 0 is the sampled reading,
-- negative is growth in shade. A treeline built from tone-0 frames alone read as
-- one flat mass of the same green, because a real treeline's variety is as much
-- tonal as it is about size.
local function drawTree(body, shadow, scale, seed, tone)
  local rng = newRng(seed)
  local ct = function (t) return math.max(0, math.min(1, t + (tone or 0))) end
  local R      = 30 * scale
  local lobeR  = 15 * scale
  local canY   = FOOT_Y - 84 * scale
  local canX   = FOOT_X + (rng() - 0.5) * 10 * scale
  local trunkW = 7 * scale

  footShadow(shadow, 26 * scale, 8 * scale, 145)

  local topY = canY + R * 0.5
  RP.polyPx(body, {
    { FOOT_X - trunkW,       FOOT_Y },
    { canX   - trunkW * 0.6, topY   },
    { canX   + trunkW * 0.6, topY   },
    { FOOT_X + trunkW,       FOOT_Y },
  }, lib.ramp(BARK, 0.4))
  RP.polyPx(body, {
    { FOOT_X - trunkW,       FOOT_Y },
    { canX   - trunkW * 0.6, topY   },
    { canX   - trunkW * 0.1, topY   },
    { FOOT_X - trunkW * 0.3, FOOT_Y },
  }, lib.ramp(BARK, 0.75))
  RP.linePx(body, FOOT_X, FOOT_Y - 2, FOOT_X - trunkW * 2.2, FOOT_Y,
            math.max(2, 2 * scale), lib.ramp(BARK, 0.3))
  RP.linePx(body, FOOT_X, FOOT_Y - 2, FOOT_X + trunkW * 2.2, FOOT_Y,
            math.max(2, 2 * scale), lib.ramp(BARK, 0.3))

  rosette(body, canX, canY, R, lobeR, 10, lib.ramp(FOLIAGE, ct(0.0)), rng, 0.30)
  rosette(body, canX - R * 0.06, canY - R * 0.08, R * 0.80, lobeR * 0.84, 9,
          lib.ramp(FOLIAGE, ct(0.35)), rng, 0.30)

  -- Radial creases, drawn BETWEEN the mid and the lit passes so the crown covers
  -- the ones on the upper-left and only the shaded side keeps them. Drawing them
  -- last, full length, at 1.1px per unit scale read as the spokes of an umbrella.
  local crease = lib.ramp(FOLIAGE, ct(0.15))
  for i = 0, 6 do
    local a = (i / 7) * math.pi * 2 + 0.2 + (rng() - 0.5) * 0.3
    RP.linePx(body, canX + math.cos(a) * R * 0.46, canY + math.sin(a) * R * 0.42,
              canX + math.cos(a) * R * 0.86, canY + math.sin(a) * R * 0.78,
              1, crease)
  end

  rosette(body, canX - R * 0.18, canY - R * 0.22, R * 0.54, lobeR * 0.74, 8,
          lib.ramp(FOLIAGE, ct(0.7)), rng, 0.28)
  rosette(body, canX - R * 0.34, canY - R * 0.38, R * 0.24, lobeR * 0.56, 6,
          lib.ramp(FOLIAGE, ct(1.0)), rng, 0.26)
end

-- `snowy` loads each skirt with snow along its upper edge, which is how the
-- frost sketch draws every pine in its border band: the needles barely show and
-- the silhouette is mostly white.
local function drawConifer(body, shadow, scale, seed, snowy)
  local rng = newRng(seed)
  local H   = 74 * scale
  local topY = FOOT_Y - H
  footShadow(shadow, 15 * scale, 5 * scale, 130)

  RP.polyPx(body, {
    { FOOT_X - 3 * scale, FOOT_Y },
    { FOOT_X - 2 * scale, FOOT_Y - 12 * scale },
    { FOOT_X + 2 * scale, FOOT_Y - 12 * scale },
    { FOOT_X + 3 * scale, FOOT_Y },
  }, lib.ramp(BARK, 0.35))

  for i = 0, 4 do
    local t  = i / 4
    local yB = FOOT_Y - 10 * scale - (H - 10 * scale) * t * 0.86
    local w  = (24 - 17 * t) * scale
    local hh = 22 * scale
    RP.polyPx(body, {
      { FOOT_X,     yB - hh }, { FOOT_X + w, yB }, { FOOT_X - w, yB },
    }, lib.ramp(FOLIAGE, 0.15 + t * 0.35))
    RP.polyPx(body, {
      { FOOT_X, yB - hh }, { FOOT_X - w * 0.35, yB }, { FOOT_X - w, yB },
    }, lib.ramp(FOLIAGE, 0.45 + t * 0.4))
    if snowy then
      -- A cap on the UPPER-LEFT of each skirt only, leaving the lower right in
      -- needle green. A first pass spanned the full width and most of the
      -- height, and every pine came out a plain white triangle with no tree
      -- left in it: snow on a branch is a highlight, not a repaint.
      RP.polyPx(body, {
        { FOOT_X,            yB - hh * 0.88 },
        { FOOT_X + w * 0.30, yB - hh * 0.40 },
        { FOOT_X - w * 0.10, yB - hh * 0.30 },
        { FOOT_X - w * 0.62, yB - hh * 0.18 },
      }, lib.ramp(PALE, 0.7))
      RP.polyPx(body, {
        { FOOT_X,            yB - hh * 0.88 },
        { FOOT_X - w * 0.34, yB - hh * 0.40 },
        { FOOT_X - w * 0.62, yB - hh * 0.18 },
      }, lib.ramp(PALE, 1.0))
    end
  end
  RP.polyPx(body, {
    { FOOT_X, topY }, { FOOT_X + 5 * scale, topY + 13 * scale },
    { FOOT_X - 5 * scale, topY + 13 * scale },
  }, lib.ramp(snowy and PALE or FOLIAGE, 0.9))
end

-- Same construction as a canopy at about a third the size, no trunk.
-- `berries` dots the crown with fruit and `snowy` caps it, which between them
-- turn the forest's bush into the frost region's winter-berry bush without a
-- second shape.
local function drawShrub(body, shadow, scale, seed, berries, snowy)
  local rng = newRng(seed)
  local R   = 15 * scale
  local cy  = FOOT_Y - 12 * scale
  footShadow(shadow, 14 * scale, 4.5 * scale, 125)
  rosette(body, FOOT_X, cy, R, R * 0.5, 8, lib.ramp(FOLIAGE2, 0.05), rng, 0.22)
  rosette(body, FOOT_X - R * 0.1, cy - R * 0.12, R * 0.76, R * 0.42, 7,
          lib.ramp(FOLIAGE2, 0.45), rng, 0.2)
  rosette(body, FOOT_X - R * 0.24, cy - R * 0.28, R * 0.4, R * 0.34, 5,
          lib.ramp(FOLIAGE2, 0.85), rng, 0.18)
  if snowy then
    rosette(body, FOOT_X - R * 0.2, cy - R * 0.34, R * 0.62, R * 0.34, 6,
            lib.ramp(PALE, 0.9), rng, 0.24)
  end
  if berries then
    for i = 1, 6 do
      local a, rr = rng() * math.pi * 2, 0.35 + rng() * 0.6
      local bx = FOOT_X + math.cos(a) * R * rr
      local by = cy + math.sin(a) * R * 0.72 * rr
      RP.ellipsePx(body, bx, by, 2.1 * scale, 2.0 * scale, BLOOM.A)
      RP.px(body, bx - 1, by - 1, BLOOM.A_L)
    end
  end
end

----------------------------------------------------------------------
-- props: desert shapes
----------------------------------------------------------------------

-- Saguaro. A ribbed column with one or two elbowed arms and flowering tips,
-- which is what the desert concept plants in the border band where the forest
-- plants trees. Same contract as drawTree: `scale` about the foot, `tone`
-- shifting the flesh ramp so a cactus stand varies instead of reading flat.
local function drawSaguaro(body, shadow, scale, seed, tone)
  local rng = newRng(seed)
  local ct = function (t) return math.max(0, math.min(1, t + (tone or 0))) end
  local H  = 96 * scale
  local W  = 9.5 * scale
  local topY = FOOT_Y - H

  footShadow(shadow, 15 * scale, 5.5 * scale, 140)

  -- One column, capped with a dome rather than a flat top.
  local col = function (cx, yTop, yBot, w, shade)
    RP.polyPx(body, {
      { cx - w, yBot }, { cx - w, yTop }, { cx + w, yTop }, { cx + w, yBot },
    }, lib.ramp(FOLIAGE, ct(shade)))
    RP.ellipsePx(body, cx, yTop, w, w * 0.95, lib.ramp(FOLIAGE, ct(shade)))
    -- Lit western face and a shaded eastern one: the one light direction.
    RP.polyPx(body, {
      { cx - w,        yBot }, { cx - w,        yTop },
      { cx - w * 0.34, yTop }, { cx - w * 0.34, yBot },
    }, lib.ramp(FOLIAGE, ct(shade + 0.42)))
    RP.polyPx(body, {
      { cx + w * 0.55, yBot }, { cx + w * 0.55, yTop },
      { cx + w,        yTop }, { cx + w,        yBot },
    }, lib.ramp(FOLIAGE, ct(shade - 0.28)))
    -- Ribs.
    local ribs = 3
    for i = 1, ribs do
      local rx = cx - w + (2 * w) * (i / (ribs + 1))
      RP.linePx(body, rx, yTop + w * 0.6, rx, yBot, 1, lib.ramp(FOLIAGE, ct(shade - 0.34)))
    end
  end

  col(FOOT_X, topY, FOOT_Y, W, 0.42)

  -- Arms: up, out, and up again. Count and side hashed so no two match.
  local arms = 1 + math.floor(rng() * 2.4)
  for i = 1, math.min(2, arms) do
    local side = (i == 1) and ((rng() < 0.5) and -1 or 1) or ((rng() < 0.5) and 1 or -1)
    local aw   = W * 0.72
    local elbowY = FOOT_Y - H * (0.42 + rng() * 0.22)
    local reach  = W * (2.4 + rng() * 1.3) * side
    local armTop = elbowY - H * (0.20 + rng() * 0.16)
    -- Horizontal run out to the elbow.
    RP.polyPx(body, {
      { FOOT_X,          elbowY + aw },
      { FOOT_X,          elbowY - aw },
      { FOOT_X + reach,  elbowY - aw },
      { FOOT_X + reach,  elbowY + aw },
    }, lib.ramp(FOLIAGE, ct(0.34)))
    col(FOOT_X + reach, armTop, elbowY + aw, aw, 0.42)
    RP.ellipsePx(body, FOOT_X + reach, elbowY, aw, aw, lib.ramp(FOLIAGE, ct(0.34)))
    if rng() < 0.7 then
      RP.ellipsePx(body, FOOT_X + reach, armTop - aw * 0.3, aw * 0.5, aw * 0.42, BLOOM.A)
      RP.ellipsePx(body, FOOT_X + reach - aw * 0.2, armTop - aw * 0.5, aw * 0.26, aw * 0.22, BLOOM.A_L)
    end
  end

  -- Flowering crown.
  RP.ellipsePx(body, FOOT_X, topY - W * 0.34, W * 0.56, W * 0.46, BLOOM.A)
  RP.ellipsePx(body, FOOT_X - W * 0.22, topY - W * 0.52, W * 0.3, W * 0.24, BLOOM.A_L)
end

-- Barrel cactus: a squat ribbed dome with a ring of flowers on the crown. The
-- desert's answer to the forest's conifer, and like it, a smaller singleton.
local function drawBarrel(body, shadow, scale, seed)
  local rng = newRng(seed)
  local w, h = 15 * scale, 20 * scale
  local cy = FOOT_Y - h * 0.5
  footShadow(shadow, w * 0.95, h * 0.3, 130)
  RP.ellipsePx(body, FOOT_X, cy, w, h * 0.62, lib.ramp(FOLIAGE, 0.35))
  RP.ellipsePx(body, FOOT_X - w * 0.22, cy - h * 0.12, w * 0.6, h * 0.42,
               lib.ramp(FOLIAGE, 0.72))
  for i = -3, 3 do
    local rx = FOOT_X + (i / 3.4) * w
    RP.linePx(body, rx, cy - h * 0.5, rx, cy + h * 0.48, 1, lib.ramp(FOLIAGE, 0.08))
  end
  for i = -1, 1 do
    RP.ellipsePx(body, FOOT_X + i * w * 0.42, cy - h * 0.56, w * 0.2, h * 0.14, BLOOM.A)
  end
end

-- Prickly pear: overlapping flat oval pads at varying angles, with fruit on the
-- rim. Fills the shrub role in the desert, which is what the concept scatters
-- through its open sand.
local function drawPear(body, shadow, scale, seed)
  local rng = newRng(seed)
  footShadow(shadow, 16 * scale, 5 * scale, 125)
  local pads = 4 + math.floor(rng() * 3)
  for i = 1, pads do
    local a  = (rng() - 0.5) * 1.5
    local px = FOOT_X + (rng() - 0.5) * 26 * scale
    local py = FOOT_Y - (5 + rng() * 26) * scale
    local rx = (7 + rng() * 4) * scale
    local ry = (10 + rng() * 6) * scale
    RP.ellipsePx(body, px, py, rx, ry, lib.ramp(FOLIAGE, 0.2 + rng() * 0.3), a)
    RP.ellipsePx(body, px - rx * 0.24, py - ry * 0.18, rx * 0.6, ry * 0.62,
                 lib.ramp(FOLIAGE, 0.7 + rng() * 0.25), a)
    if rng() < 0.55 then
      RP.ellipsePx(body, px + (rng() - 0.5) * rx, py - ry * 0.95,
                   2.4 * scale, 2.1 * scale, BLOOM.A)
    end
  end
end

-- A tapering sandstone monument with a pyramidal cap, a stepped plinth and a
-- dark inset panel carrying a red mark. Four of them ring the desert village's
-- inner square; it fills the landmark role the forest gives its moss boulder.
local function drawObelisk(body, shadow, seed)
  local rng = newRng(seed)
  footShadow(shadow, 17, 6, 155)
  local H = 84
  local wB, wT = 11, 6            -- shaft half-width at base and at the cap
  local baseY = FOOT_Y - 10
  local topY  = FOOT_Y - H

  -- Stepped plinth, two courses.
  RP.polyPx(body, { { FOOT_X - 17, FOOT_Y }, { FOOT_X - 17, FOOT_Y - 6 },
                    { FOOT_X + 17, FOOT_Y - 6 }, { FOOT_X + 17, FOOT_Y } },
            lib.ramp(TRIM, 0.5))
  RP.polyPx(body, { { FOOT_X - 14, FOOT_Y - 5 }, { FOOT_X - 14, baseY },
                    { FOOT_X + 14, baseY }, { FOOT_X + 14, FOOT_Y - 5 } },
            lib.ramp(TRIM, 0.68))
  -- Shaft.
  RP.polyPx(body, { { FOOT_X - wB, baseY }, { FOOT_X - wT, topY + 12 },
                    { FOOT_X + wT, topY + 12 }, { FOOT_X + wB, baseY } },
            lib.ramp(TRIM, 0.55))
  RP.polyPx(body, { { FOOT_X - wB, baseY }, { FOOT_X - wT, topY + 12 },
                    { FOOT_X - wT * 0.2, topY + 12 }, { FOOT_X - wB * 0.2, baseY } },
            lib.ramp(TRIM, 0.85))
  -- Pyramidal cap.
  RP.polyPx(body, { { FOOT_X - wT - 1, topY + 12 }, { FOOT_X, topY },
                    { FOOT_X + wT + 1, topY + 12 } }, lib.ramp(TRIM, 0.7))
  RP.polyPx(body, { { FOOT_X - wT - 1, topY + 12 }, { FOOT_X, topY },
                    { FOOT_X, topY + 12 } }, lib.ramp(TRIM, 1.0))
  -- Inset panel with its red mark.
  RP.polyPx(body, { { FOOT_X - 4, baseY - 16 }, { FOOT_X - 4, baseY - 40 },
                    { FOOT_X + 4, baseY - 40 }, { FOOT_X + 4, baseY - 16 } },
            lib.ramp(TRIM, 0.18))
  RP.ellipsePx(body, FOOT_X, baseY - 28, 2.4, 6, hex('#a8321c'))
end

-- Bones. A part-buried rib cage and a skull, which the desert concept scatters
-- across its sand and which is the whole reason the place is called Oasis of
-- the Damned.
local function drawBones(body, shadow, seed, skull)
  local rng = newRng(seed)
  footShadow(shadow, 15, 4, 70)
  local pale = lib.ramp(PALE, 0.85)
  local dark = lib.ramp(PALE, 0.15)
  if skull then
    RP.ellipsePx(body, FOOT_X, FOOT_Y - 8, 11, 8, pale)          -- cranium
    RP.polyPx(body, { { FOOT_X - 4, FOOT_Y - 6 }, { FOOT_X - 7, FOOT_Y + 1 },
                      { FOOT_X + 3, FOOT_Y + 1 }, { FOOT_X + 2, FOOT_Y - 6 } }, pale)
    RP.ellipsePx(body, FOOT_X - 4, FOOT_Y - 9, 2.6, 2.4, dark)   -- eye sockets
    RP.ellipsePx(body, FOOT_X + 3, FOOT_Y - 9, 2.6, 2.4, dark)
    RP.ellipsePx(body, FOOT_X - 1, FOOT_Y - 4, 1.4, 1.6, dark)
    -- A horn, which is what makes it read as a beast rather than a person.
    RP.linePx(body, FOOT_X + 9, FOOT_Y - 12, FOOT_X + 17, FOOT_Y - 17, 2.4, pale)
    RP.linePx(body, FOOT_X - 9, FOOT_Y - 12, FOOT_X - 17, FOOT_Y - 17, 2.4, pale)
  else
    -- Spine with ribs curving off it, half sunk into the sand.
    local x0, x1 = FOOT_X - 20, FOOT_X + 20
    RP.linePx(body, x0, FOOT_Y - 3, x1, FOOT_Y - 6, 2.2, pale)
    for i = 0, 5 do
      local t  = i / 5
      local sx = x0 + (x1 - x0) * t
      local sy = FOOT_Y - 3 - 3 * t
      RP.linePx(body, sx, sy, sx + 3, sy - 9 - rng() * 4, 1.8, pale)
      RP.linePx(body, sx, sy, sx - 2, sy + 4, 1.6, pale)
    end
  end
end

-- Sparse orange-red blooms on short stems, the desert's version of the forest's
-- flower drifts. Fewer and lower: the concept's open sand is not a meadow.
local function drawDesertBloom(body, shadow, seed, count)
  local rng = newRng(seed)
  local n = count or 9
  footShadow(shadow, 13, 3.5, 60)
  for i = 1, n do
    local a  = rng() * math.pi * 2
    local rr = math.sqrt(rng())
    local bx = FOOT_X + math.cos(a) * rr * 22
    local by = FOOT_Y - 3 - math.abs(math.sin(a)) * rr * 9 - rng() * 3
    local h  = 5 + rng() * 7
    local tipX = bx + (rng() - 0.5) * 2.5
    local tipY = by - h
    -- A low tuft of blade-leaves under each bloom, so the drift has some body.
    -- Bare stems with 2px heads were all but invisible against sand.
    for k = -1, 1 do
      RP.linePx(body, bx, by, bx + k * 4, by - 4 - rng() * 3, 1, BLOOM.STEM)
    end
    RP.linePx(body, bx, by, tipX, tipY, 1.6, BLOOM.STEM)
    local alt = rng() < 0.4
    RP.ellipsePx(body, tipX, tipY, 3.4, 3.0, alt and BLOOM.B or BLOOM.A)
    RP.ellipsePx(body, tipX - 1.1, tipY - 1.1, 1.7, 1.5, alt and BLOOM.B_L or BLOOM.A_L)
  end
end

----------------------------------------------------------------------
-- props: coast shapes
----------------------------------------------------------------------

-- Branching coral. Arms radiate from a low base and fork once or twice, each
-- tip carrying a lighter nub, which is how the concept draws every one of them.
-- `cool` switches from the warm ramp to the violet one.
--
-- The coast has NO tall growth at all: no trees, no cacti, nothing standing
-- above about half a tile. So the growth roles are filled by coral, and the
-- height comes from the fan being drawn upward from its foot rather than from a
-- trunk. That is a real departure from the first two regions and it is why this
-- shape leans wide rather than tall.
local function drawCoral(body, shadow, scale, seed, cool, tone)
  local rng = newRng(seed)
  local P = cool and FOLIAGE2 or FOLIAGE
  local ct = function (t) return math.max(0, math.min(1, t + (tone or 0))) end
  local H = 40 * scale
  footShadow(shadow, 15 * scale, 5 * scale, 110)

  local arms = 5 + math.floor(rng() * 4)
  for i = 1, arms do
    -- Fanned upward: arms spread across the top half, none pointing straight
    -- down, so the silhouette reads as growing out of the sand.
    local a  = -math.pi * (0.12 + 0.76 * ((i - 0.5) / arms)) + (rng() - 0.5) * 0.25
    local len = H * (0.55 + rng() * 0.5)
    local bx, by = FOOT_X + (rng() - 0.5) * 8 * scale, FOOT_Y - 3 * scale
    local mx, my = bx + math.cos(a) * len * 0.55, by + math.sin(a) * len * 0.55
    local ex, ey = mx + math.cos(a + (rng() - 0.5) * 0.6) * len * 0.5,
                   my + math.sin(a + (rng() - 0.5) * 0.6) * len * 0.5
    local w = math.max(1.6, 3.2 * scale)
    RP.linePx(body, bx, by, mx, my, w, lib.ramp(P, ct(0.25)))
    RP.linePx(body, mx, my, ex, ey, w * 0.72, lib.ramp(P, ct(0.55)))
    -- A fork off the midpoint on about half the arms.
    if rng() < 0.55 then
      local fa = a + (rng() < 0.5 and -1 or 1) * (0.5 + rng() * 0.4)
      local fx, fy = mx + math.cos(fa) * len * 0.4, my + math.sin(fa) * len * 0.4
      RP.linePx(body, mx, my, fx, fy, w * 0.62, lib.ramp(P, ct(0.5)))
      RP.ellipsePx(body, fx, fy, w * 0.62, w * 0.58, lib.ramp(P, ct(0.9)))
    end
    RP.ellipsePx(body, ex, ey, w * 0.7, w * 0.66, lib.ramp(P, ct(0.95)))
  end
  -- Base clump, so the arms do not appear to sprout from a point.
  RP.ellipsePx(body, FOOT_X, FOOT_Y - 3 * scale, 8 * scale, 4 * scale,
               lib.ramp(P, ct(0.1)))
end

-- Sea anemone: a squat column under a disc of short tentacles, seen from
-- slightly above. Fills the "second growth" slot the forest gives its conifer.
local function drawAnemone(body, shadow, scale, seed)
  local rng = newRng(seed)
  local R = 13 * scale
  local cy = FOOT_Y - 10 * scale
  footShadow(shadow, R * 0.9, R * 0.32, 105)
  RP.ellipsePx(body, FOOT_X, FOOT_Y - 5 * scale, R * 0.5, R * 0.42,
               lib.ramp(FOLIAGE2, 0.2))
  for i = 0, 13 do
    local a = (i / 14) * math.pi * 2
    local rr = R * (0.75 + rng() * 0.5)
    RP.linePx(body, FOOT_X, cy, FOOT_X + math.cos(a) * rr, cy + math.sin(a) * rr * 0.7,
              math.max(1, 1.8 * scale), lib.ramp(FOLIAGE2, 0.45 + rng() * 0.3))
  end
  RP.ellipsePx(body, FOOT_X, cy, R * 0.42, R * 0.32, lib.ramp(FOLIAGE2, 0.8))
  RP.ellipsePx(body, FOOT_X, cy, R * 0.2, R * 0.15, lib.ramp(FOLIAGE, 0.7))
end

-- A five-armed starfish lying flat on the sand, plus a shell or two. The coast's
-- answer to a flower drift: scattered small warm objects on open ground.
local function drawShoreScatter(body, shadow, seed, stars, shells)
  local rng = newRng(seed)
  footShadow(shadow, 15, 4, 62)
  for s = 1, (stars or 1) do
    local cx = FOOT_X + (rng() - 0.5) * 34
    local cy = FOOT_Y - 6 - rng() * 12
    local R  = 7 + rng() * 3
    local rot = rng() * math.pi * 2
    for i = 0, 4 do
      local a = rot + (i / 5) * math.pi * 2
      RP.linePx(body, cx, cy, cx + math.cos(a) * R, cy + math.sin(a) * R * 0.8,
                3.2, BLOOM.A)
      RP.linePx(body, cx, cy, cx + math.cos(a) * R * 0.7, cy + math.sin(a) * R * 0.56,
                1.8, BLOOM.A_L)
    end
    RP.ellipsePx(body, cx, cy, R * 0.42, R * 0.34, BLOOM.A_L)
  end
  for s = 1, (shells or 2) do
    local cx = FOOT_X + (rng() - 0.5) * 38
    local cy = FOOT_Y - 3 - rng() * 12
    local R  = 4 + rng() * 2.5
    RP.ellipsePx(body, cx, cy, R, R * 0.8, BLOOM.B)
    -- Ribs, which is what stops a shell reading as a pebble.
    for i = -2, 2 do
      RP.linePx(body, cx, cy + R * 0.6, cx + i * R * 0.34, cy - R * 0.7, 1, BLOOM.B_L)
    end
  end
end

-- A bleached driftwood trunk washed up on the beach, lying along the ground
-- rather than standing. This region's landmark, where the forest has a boulder
-- and the desert an obelisk.
local function drawDriftwood(body, shadow, seed)
  local rng = newRng(seed)
  footShadow(shadow, 34, 7, 120)
  local y = FOOT_Y - 9
  local x0, x1 = FOOT_X - 38, FOOT_X + 36
  RP.polyPx(body, {
    { x0, y + 6 }, { x0 + 3, y - 6 }, { x1 - 2, y - 8 }, { x1, y + 5 },
  }, lib.ramp(BARK, 0.45))
  RP.polyPx(body, {                                  -- lit upper face
    { x0 + 2, y - 2 }, { x0 + 4, y - 6 }, { x1 - 2, y - 8 }, { x1 - 1, y - 3 },
  }, lib.ramp(BARK, 0.9))
  RP.ellipsePx(body, x0 + 2, y, 4, 6, lib.ramp(BARK, 0.25))   -- cut end
  RP.ellipsePx(body, x0 + 2, y, 2.2, 3.4, lib.ramp(BARK, 0.6))
  -- Grain, and two snapped branch stubs.
  for i = 1, 4 do
    local ly = y - 6 + i * 2.6
    RP.linePx(body, x0 + 6, ly, x1 - 5, ly - 1, 1, lib.ramp(BARK, 0.2))
  end
  RP.linePx(body, FOOT_X - 6, y - 6, FOOT_X - 14, y - 18, 3, lib.ramp(BARK, 0.55))
  RP.linePx(body, FOOT_X + 14, y - 7, FOOT_X + 21, y - 16, 2.6, lib.ramp(BARK, 0.5))
end

----------------------------------------------------------------------
-- props: ice shapes
----------------------------------------------------------------------

-- A faceted spire: a tall prism with one or two smaller shards leaning against
-- it. Straight edges and hard facets throughout, because the one thing that
-- separates ice from water at this size is that ice has corners.
--
-- Shared by TWO regions, which is why it is not called drawIceSpire any more.
-- It takes its body from ROCK and its bright rim from FOLIAGE2, so the ice
-- region gets blue crystal with a pale rim and the volcanic region gets black
-- obsidian with a hot ochre one, from the same twenty lines.
local function drawFacetedSpire(body, shadow, scale, seed)
  local rng = newRng(seed)
  local H = 62 * scale
  local W = 11 * scale
  footShadow(shadow, W * 1.5, W * 0.55, 100)

  local shard = function (cx, h, w, lean, shade)
    local topX = cx + lean
    RP.polyPx(body, {
      { cx - w, FOOT_Y }, { topX - w * 0.22, FOOT_Y - h },
      { topX + w * 0.22, FOOT_Y - h }, { cx + w, FOOT_Y },
    }, lib.ramp(ROCK, shade))
    -- Lit west facet and a bright rim on the very edge, the two cues that make
    -- a flat polygon read as faceted ice.
    RP.polyPx(body, {
      { cx - w, FOOT_Y }, { topX - w * 0.22, FOOT_Y - h },
      { topX + w * 0.02, FOOT_Y - h }, { cx - w * 0.20, FOOT_Y },
    }, lib.ramp(ROCK, math.min(1, shade + 0.35)))
    RP.linePx(body, cx - w, FOOT_Y, topX - w * 0.22, FOOT_Y - h, 1,
              lib.ramp(FOLIAGE2, 0.95))
    -- A horizontal fracture across the shaft.
    local fy = FOOT_Y - h * (0.4 + rng() * 0.25)
    RP.linePx(body, cx - w * 0.7, fy, cx + w * 0.7, fy - 2, 1, lib.ramp(ROCK, 0.05))
  end

  shard(FOOT_X - W * 1.25, H * 0.52, W * 0.55, -2 * scale, 0.30)
  shard(FOOT_X + W * 1.15, H * 0.66, W * 0.5,   3 * scale, 0.22)
  shard(FOOT_X, H, W, (rng() - 0.5) * 5 * scale, 0.45)
end

-- A glacier block: an angular slab of ice with a flat lit top and a shadowed
-- front face. Deliberately NOT drawRock with a blue ramp, which is what the
-- first pass used and which produced rows of rounded blue pills: the only
-- thing separating ice from water at this size is that ice has corners.
local function drawIceBlock(body, shadow, w, h, seed)
  local rng = newRng(seed)
  footShadow(shadow, w * 0.95, h * 0.28, 110)
  local topY = FOOT_Y - h
  local midY = FOOT_Y - h * 0.42
  -- Top face: an irregular quad, read as looking slightly down onto the slab.
  local j = function (n) return (rng() - 0.5) * n end
  local tl = { FOOT_X - w + j(5),      midY + j(4) }
  local tt = { FOOT_X - w * 0.25 + j(6), topY + j(5) }
  local tr = { FOOT_X + w + j(5),      midY + j(4) }
  local tb = { FOOT_X + w * 0.20 + j(6), midY + h * 0.30 + j(4) }
  RP.polyPx(body, { tl, tt, tr, tb }, lib.ramp(ROCK, 0.85))
  -- Front faces, split so the slab has a lit west side and a dark south one.
  RP.polyPx(body, {
    tl, tb, { tb[1], FOOT_Y }, { tl[1], FOOT_Y - h * 0.10 },
  }, lib.ramp(ROCK, 0.45))
  RP.polyPx(body, {
    tb, tr, { tr[1], FOOT_Y - h * 0.12 }, { tb[1], FOOT_Y },
  }, lib.ramp(ROCK, 0.20))
  -- Bright rim along the top edges, and one internal fracture.
  RP.linePx(body, tl[1], tl[2], tt[1], tt[2], 1, lib.ramp(FOLIAGE2, 0.95))
  RP.linePx(body, tt[1], tt[2], tr[1], tr[2], 1, lib.ramp(FOLIAGE2, 0.7))
  RP.linePx(body, FOOT_X + j(w * 0.5), midY, FOOT_X + j(w * 0.5), FOOT_Y - h * 0.06,
            1, lib.ramp(ROCK, 0.05))
end

-- A wind-piled snow drift: a low rounded bank with a lit crest. Fills the
-- debris slot, where the forest has a stump and the desert has bones.
local function drawSnowMound(body, shadow, scale, seed)
  local rng = newRng(seed)
  local w, h = 20 * scale, 13 * scale
  footShadow(shadow, w * 0.9, h * 0.34, 85)
  local cy = FOOT_Y - h * 0.45
  RP.ellipsePx(body, FOOT_X, cy, w, h * 0.72, lib.ramp(PALE, 0.35))
  RP.ellipsePx(body, FOOT_X - w * 0.18, cy - h * 0.2, w * 0.7, h * 0.48,
               lib.ramp(PALE, 0.8))
  RP.ellipsePx(body, FOOT_X - w * 0.3, cy - h * 0.32, w * 0.4, h * 0.26,
               lib.ramp(PALE, 1.0))
  for i = 1, 3 do                                    -- a few glints on the crest
    RP.px(body, FOOT_X + (rng() - 0.5) * w, cy - h * (0.1 + rng() * 0.3),
          lib.ramp(PALE, 1.0))
  end
end

----------------------------------------------------------------------
-- props: earth shapes
----------------------------------------------------------------------

-- A leaning megalithic menhir: a tall tapered slab of pale stone, tilted, with
-- a lit west face, a weathered top and moss creeping up the base. The earth
-- sketch stands these all over its scree and they are the one vertical thing in
-- the region, so they carry its silhouette the way trees carry the forest's.
local function drawMenhir(body, shadow, scale, seed, lean)
  local rng = newRng(seed)
  local H  = 66 * scale
  local wB = 10 * scale                 -- half-width at the base
  local wT = 6.5 * scale                -- and at the crown
  local tilt = (lean or 0) * scale
  footShadow(shadow, wB * 1.7, wB * 0.62, 135)

  local topY = FOOT_Y - H
  local tx   = FOOT_X + tilt
  RP.polyPx(body, {
    { FOOT_X - wB, FOOT_Y }, { tx - wT, topY + 4 * scale },
    { tx + wT,     topY },   { FOOT_X + wB, FOOT_Y },
  }, lib.ramp(TRIM, 0.5))
  -- Lit west face, a narrow strip rather than half the slab: a menhir is thin.
  RP.polyPx(body, {
    { FOOT_X - wB,        FOOT_Y }, { tx - wT,        topY + 4 * scale },
    { tx - wT * 0.25,     topY + 3 * scale },
    { FOOT_X - wB * 0.28, FOOT_Y },
  }, lib.ramp(TRIM, 0.85))
  -- Shadowed east edge.
  RP.polyPx(body, {
    { FOOT_X + wB * 0.55, FOOT_Y }, { tx + wT * 0.5, topY + 1 * scale },
    { tx + wT,            topY },   { FOOT_X + wB,   FOOT_Y },
  }, lib.ramp(TRIM, 0.2))
  -- Weathered pits and a couple of horizontal bedding lines.
  for i = 1, 3 do
    local t = 0.25 + rng() * 0.5
    local y = FOOT_Y - H * t
    RP.linePx(body, FOOT_X - wB * (1 - t * 0.3), y,
              FOOT_X + wB * (1 - t * 0.3) + tilt * t, y - 1, 1, lib.ramp(TRIM, 0.1))
  end
  -- Moss at the foot, which is what stops it reading as a plain grey wedge.
  for i = 1, 5 do
    local a = rng()
    RP.ellipsePx(body, FOOT_X + (a - 0.5) * wB * 2, FOOT_Y - rng() * H * 0.16,
                 2 + rng() * 3, 1.6 + rng() * 2, lib.ramp(FOLIAGE, 0.2 + rng() * 0.5))
  end
end

-- An amethyst cluster: three to five hexagonal prisms of different heights
-- sharing a base, lit tips, dark bodies. The only saturated colour in the
-- region and the reason its blooms are violet rather than floral.
local function drawCrystalCluster(body, shadow, scale, seed)
  local rng = newRng(seed)
  footShadow(shadow, 13 * scale, 4.5 * scale, 95)
  local n = 3 + math.floor(rng() * 3)
  for i = 1, n do
    local h  = (12 + rng() * 20) * scale
    local w  = (2.6 + rng() * 2.2) * scale
    local cx = FOOT_X + (rng() - 0.5) * 20 * scale
    local tilt = (rng() - 0.5) * 6 * scale
    local topY = FOOT_Y - 2 * scale - h
    RP.polyPx(body, {
      { cx - w, FOOT_Y - 1 * scale }, { cx - w * 0.55 + tilt, topY + w },
      { cx + tilt,     topY },        { cx + w * 0.55 + tilt, topY + w },
      { cx + w, FOOT_Y - 1 * scale },
    }, BLOOM.B)
    -- Lit west facet and a bright tip.
    RP.polyPx(body, {
      { cx - w, FOOT_Y - 1 * scale }, { cx - w * 0.55 + tilt, topY + w },
      { cx + tilt * 0.4,       topY + w * 1.6 },
      { cx - w * 0.2,          FOOT_Y - 1 * scale },
    }, BLOOM.A)
    RP.ellipsePx(body, cx + tilt, topY + w * 0.8, w * 0.55, w * 0.75, BLOOM.A_L)
  end
end

----------------------------------------------------------------------
-- props: air shapes
----------------------------------------------------------------------

-- A cloud spire: billows stacked into a tapering pillar. Built from overlapping
-- ellipses rather than the conifer's straight-edged skirts, because the whole
-- point of a cloud is that it has no straight edges anywhere.
local function drawCloudSpire(body, shadow, scale, seed)
  local rng = newRng(seed)
  local H = 88 * scale
  footShadow(shadow, 15 * scale, 5 * scale, 70)   -- cloud casts a light shadow
  local tiers = 7
  for i = 0, tiers - 1 do
    local t  = i / (tiers - 1)                    -- 0 at the foot, 1 at the tip
    local cy = FOOT_Y - 6 * scale - H * t * 0.92
    local rx = (20 - 15 * t) * scale
    local ry = rx * 0.62
    -- Three overlapping lobes per tier, so the silhouette is bumpy rather than
    -- a smooth cone.
    for k = -1, 1 do
      RP.ellipsePx(body, FOOT_X + k * rx * 0.52 + (rng() - 0.5) * 3 * scale,
                   cy + (rng() - 0.5) * 2 * scale,
                   rx * (0.62 + rng() * 0.22), ry * (0.72 + rng() * 0.3),
                   lib.ramp(ROCK, 0.25 + t * 0.3))
    end
    -- Lit crown on the upper-left of each tier.
    RP.ellipsePx(body, FOOT_X - rx * 0.38, cy - ry * 0.34,
                 rx * 0.5, ry * 0.5, lib.ramp(ROCK, 0.7 + t * 0.3))
  end
  RP.ellipsePx(body, FOOT_X, FOOT_Y - 6 * scale - H * 0.95, 4 * scale, 3.4 * scale,
               lib.ramp(ROCK, 1.0))
end

-- Wind reeds: a clump of tall thin blades leaning off the vertical, each with a
-- seed head. The air region's answer to a shrub, and the reason it needed a
-- shape at all: a rosette reads as a bush, and nothing on a cloud is a bush.
local function drawReed(body, shadow, scale, seed)
  local rng = newRng(seed)
  local n = 6 + math.floor(rng() * 4)
  footShadow(shadow, 12 * scale, 4 * scale, 65)
  for i = 1, n do
    local bx = FOOT_X + (rng() - 0.5) * 20 * scale
    local h  = (16 + rng() * 20) * scale
    local lean = (rng() - 0.5) * 14 * scale
    local tipX, tipY = bx + lean, FOOT_Y - 3 * scale - h
    RP.linePx(body, bx, FOOT_Y - 2 * scale, tipX, tipY,
              math.max(1, 1.6 * scale), lib.ramp(FOLIAGE, 0.25 + rng() * 0.35))
    -- Seed head: a small elongated bud along the blade's own lean.
    RP.ellipsePx(body, tipX, tipY, 1.9 * scale, 3.4 * scale,
                 lib.ramp(FOLIAGE, 0.8), math.atan(lean / math.max(1, h)))
    RP.px(body, tipX - 1, tipY - 1, BLOOM.B_L)
  end
end

----------------------------------------------------------------------
-- props: poison shapes
----------------------------------------------------------------------

-- A root-heavy mangrove with a low, broad canopy and curtains of hanging moss.
-- The exposed prop roots are the region's silhouette: a normal forest trunk
-- recoloured olive still reads as an ordinary tree, while these fork above the
-- waterline and visibly grip the mire.
local function drawMangrove(body, shadow, scale, seed, tone)
  local rng = newRng(seed)
  local ct = function (t) return math.max(0, math.min(1, t + (tone or 0))) end
  local H = 76 * scale
  local R = 28 * scale
  local canX = FOOT_X + (rng() - 0.5) * 10 * scale
  local canY = FOOT_Y - H
  local forkY = FOOT_Y - 35 * scale
  local trunkW = 5.5 * scale

  footShadow(shadow, 30 * scale, 9 * scale, 150)

  -- Five splayed prop roots, with the outside pair reaching well beyond the
  -- trunk. They are drawn first so the paired trunk forks sit over them.
  for i = -2, 2 do
    local rootX = FOOT_X + i * (10 + rng() * 3) * scale
    local rootY = FOOT_Y - (i % 2 == 0 and 0 or 3) * scale
    RP.linePx(body, FOOT_X + i * 1.4 * scale, forkY + 13 * scale,
              rootX, rootY, math.max(2, 3.2 * scale), lib.ramp(BARK, 0.28 + (i + 2) * 0.06))
    RP.linePx(body, rootX, rootY, rootX + i * 3 * scale, FOOT_Y,
              math.max(1, 1.7 * scale), lib.ramp(BARK, 0.16))
  end

  -- A paired, slightly twisted trunk rather than one straight column.
  RP.linePx(body, FOOT_X - trunkW, FOOT_Y - 2 * scale,
            canX - 6 * scale, canY + 18 * scale,
            math.max(3, trunkW * 1.35), lib.ramp(BARK, 0.34))
  RP.linePx(body, FOOT_X + trunkW, FOOT_Y - 2 * scale,
            canX + 7 * scale, canY + 20 * scale,
            math.max(3, trunkW * 1.18), lib.ramp(BARK, 0.53))
  RP.linePx(body, FOOT_X - trunkW * 0.5, FOOT_Y - 4 * scale,
            canX - 8 * scale, canY + 16 * scale,
            math.max(1, 1.5 * scale), lib.ramp(BARK, 0.82))

  -- Broad, heavy canopy. It stays lower and flatter than the forest crown,
  -- matching the concept's wall of moss-draped swamp growth.
  rosette(body, canX, canY, R, R * 0.48, 11,
          lib.ramp(FOLIAGE, ct(0.06)), rng, 0.30)
  rosette(body, canX - R * 0.08, canY - R * 0.08, R * 0.78, R * 0.38, 9,
          lib.ramp(FOLIAGE, ct(0.42)), rng, 0.28)
  rosette(body, canX - R * 0.30, canY - R * 0.30, R * 0.34, R * 0.22, 7,
          lib.ramp(FOLIAGE, ct(0.90)), rng, 0.24)

  -- Hanging moss in uneven curtains. The muted lines carry over the canopy
  -- edge without turning the tree into a comb.
  for i = 1, 7 do
    local vx = canX - R * 0.72 + (i - 1) * R * 0.24 + (rng() - 0.5) * 3 * scale
    local vy = canY + R * (0.25 + rng() * 0.35)
    local len = (9 + rng() * 18) * scale
    RP.linePx(body, vx, vy, vx + (rng() - 0.5) * 3 * scale, vy + len,
              math.max(1, 1.2 * scale), rgba(lib.ramp(FOLIAGE2, 0.40 + rng() * 0.25), 180))
  end
end

----------------------------------------------------------------------
-- props: necrotic shapes
----------------------------------------------------------------------

-- A gnarled leafless tree. Same foot-anchored contract as drawTree, but the
-- canopy is replaced by bare forking limbs, so the silhouette is all negative
-- space. That is what makes a dead forest read as dead rather than as a forest
-- drawn in brown.
local function drawDeadTree(body, shadow, scale, seed)
  local rng = newRng(seed)
  local H = 78 * scale
  local trunkW = 5.5 * scale
  footShadow(shadow, 16 * scale, 5 * scale, 120)

  local topY = FOOT_Y - H * 0.52
  local leanX = (rng() - 0.5) * 8 * scale
  RP.polyPx(body, {
    { FOOT_X - trunkW,       FOOT_Y },
    { FOOT_X + leanX - trunkW * 0.5, topY },
    { FOOT_X + leanX + trunkW * 0.5, topY },
    { FOOT_X + trunkW,       FOOT_Y },
  }, lib.ramp(BARK, 0.35))
  RP.polyPx(body, {                                  -- lit west edge
    { FOOT_X - trunkW,       FOOT_Y },
    { FOOT_X + leanX - trunkW * 0.5, topY },
    { FOOT_X + leanX - trunkW * 0.1, topY },
    { FOOT_X - trunkW * 0.4, FOOT_Y },
  }, lib.ramp(BARK, 0.8))
  RP.linePx(body, FOOT_X, FOOT_Y - 2, FOOT_X - trunkW * 2.4, FOOT_Y,
            math.max(2, 2 * scale), lib.ramp(BARK, 0.2))
  RP.linePx(body, FOOT_X, FOOT_Y - 2, FOOT_X + trunkW * 2.4, FOOT_Y,
            math.max(2, 2 * scale), lib.ramp(BARK, 0.2))

  -- Limbs, each forking once or twice and thinning as it goes.
  local limb
  limb = function (x, y, a, len, w, depth)
    if depth <= 0 or len < 3 * scale then return end
    local ex = x + math.cos(a) * len
    local ey = y + math.sin(a) * len
    RP.linePx(body, x, y, ex, ey, math.max(1, w), lib.ramp(BARK, 0.3 + rng() * 0.4))
    local n = (rng() < 0.75) and 2 or 1
    for i = 1, n do
      limb(ex, ey, a + (rng() - 0.5) * 1.5, len * (0.6 + rng() * 0.22),
           w * 0.66, depth - 1)
    end
  end
  local base = FOOT_X + leanX
  for i = 1, 4 do
    local a = -math.pi * (0.18 + 0.64 * ((i - 0.5) / 4)) + (rng() - 0.5) * 0.3
    limb(base, topY + 2 * scale, a, H * 0.30, trunkW * 0.9, 3)
  end
end

-- A headstone: a slab with a rounded top, tilted, half sunk, with a carved
-- panel. The necrotic sketch stands these across every open patch it has, so
-- they carry this region's silhouette the way trees carry the forest's.
local function drawTombstone(body, shadow, scale, seed)
  local rng = newRng(seed)
  local w = 11 * scale
  local h = 26 * scale
  local tilt = (rng() - 0.5) * 5 * scale
  footShadow(shadow, w * 1.5, w * 0.55, 130)

  local topY = FOOT_Y - h
  local cx = FOOT_X
  -- Slab, with the rounded cap drawn as an ellipse over a rectangle.
  RP.polyPx(body, {
    { cx - w, FOOT_Y }, { cx - w + tilt, topY + w * 0.6 },
    { cx + w + tilt, topY + w * 0.6 }, { cx + w, FOOT_Y },
  }, lib.ramp(ROCK, 0.5))
  RP.ellipsePx(body, cx + tilt, topY + w * 0.6, w, w * 0.72, lib.ramp(ROCK, 0.5))
  -- Lit west face.
  RP.polyPx(body, {
    { cx - w, FOOT_Y }, { cx - w + tilt, topY + w * 0.6 },
    { cx - w * 0.3 + tilt, topY + w * 0.6 }, { cx - w * 0.3, FOOT_Y },
  }, lib.ramp(ROCK, 0.85))
  -- Carved panel and a couple of illegible lines on it.
  RP.polyPx(body, {
    { cx - w * 0.55 + tilt * 0.6, FOOT_Y - h * 0.22 },
    { cx - w * 0.55 + tilt * 0.8, topY + w * 0.9 },
    { cx + w * 0.55 + tilt * 0.8, topY + w * 0.9 },
    { cx + w * 0.55 + tilt * 0.6, FOOT_Y - h * 0.22 },
  }, lib.ramp(ROCK, 0.2))
  for i = 1, 2 do
    local ly = topY + w * 1.3 + i * h * 0.18
    RP.linePx(body, cx - w * 0.34 + tilt * 0.7, ly, cx + w * 0.34 + tilt * 0.7, ly,
              1, lib.ramp(ROCK, 0.05))
  end
  -- Weeds at the foot, which is what stops it reading as a plain grey wedge.
  for i = 1, 4 do
    local bx = cx + (rng() - 0.5) * w * 2.2
    RP.linePx(body, bx, FOOT_Y, bx + (rng() - 0.5) * 4 * scale,
              FOOT_Y - (3 + rng() * 5) * scale, 1, lib.ramp(FOLIAGE, 0.3 + rng() * 0.4))
  end
end

----------------------------------------------------------------------
-- props: shared shapes
----------------------------------------------------------------------

-- Forest flower drifts: 5 to 20 blooms on thin stems, never a single bloom and
-- never on a grid. `mix` is 0 for all of colour A, 1 for all of colour B.
local function drawFlowers(body, shadow, seed, mix, count)
  local rng = newRng(seed)
  local n = count or 16
  footShadow(shadow, 17, 4, 78)
  for i = 1, n do
    local a  = rng() * math.pi * 2
    local rr = math.sqrt(rng())
    local bx = FOOT_X + math.cos(a) * rr * 23
    local by = FOOT_Y - 3 - math.abs(math.sin(a)) * rr * 10 - rng() * 4
    local h  = 3 + rng() * 4
    -- The stem tip is computed ONCE and both the bloom and its highlight are
    -- placed on it. Drawing a fresh random offset for the stem, the bloom and
    -- the highlight independently floated the blooms off the ends of the stems.
    local tipX = bx + (rng() - 0.5) * 2.5
    local tipY = by - h
    RP.linePx(body, bx, by, tipX, tipY, 1, BLOOM.STEM)
    local alt = rng() < mix
    RP.ellipsePx(body, tipX, tipY, 2.4, 2.1, alt and BLOOM.B or BLOOM.A)
    RP.ellipsePx(body, tipX - 0.8, tipY - 0.8, 1.1, 1.0, alt and BLOOM.B_L or BLOOM.A_L)
  end
end

-- `w` is the half-width at the ground, `h` is the HEIGHT the rock stands above
-- its foot. Those are two different axes on purpose: treating h as another
-- radius about a centre only 0.55h off the ground made every rock a wide flat
-- disc, and the landmark boulder came out as a pancake lying on the ground.
local function drawRock(body, shadow, w, h, seed, mossy)
  local rng = newRng(seed)
  footShadow(shadow, w * 0.95, h * 0.26, 145)
  local cy = FOOT_Y - h * 0.52

  local P = {}
  local n = 11
  for i = 0, n - 1 do
    local a = (i / n) * math.pi * 2
    local rr = 1 + (rng() - 0.5) * 0.26
    local sy = math.sin(a)
    P[#P + 1] = {
      FOOT_X + math.cos(a) * w * rr,
      cy + sy * h * (sy > 0 and 0.50 or 0.54) * rr,
    }
  end
  RP.polyPx(body, P, lib.ramp(ROCK, 0.42))

  RP.ellipsePx(body, FOOT_X - w * 0.16, cy - h * 0.20, w * 0.66, h * 0.30,
               lib.ramp(ROCK, 0.72))
  RP.ellipsePx(body, FOOT_X - w * 0.26, cy - h * 0.28, w * 0.40, h * 0.18,
               lib.ramp(ROCK, 0.95))
  RP.ellipsePx(body, FOOT_X + w * 0.30, cy + h * 0.26, w * 0.52, h * 0.20,
               lib.ramp(ROCK, 0.18))

  for i = 1, 3 do
    local sx = FOOT_X + (rng() - 0.5) * w * 1.2
    local sy = cy - h * 0.34
    local ex = sx + (rng() - 0.5) * w * 0.5
    RP.linePx(body, sx, sy, ex, cy + h * (0.24 + rng() * 0.2), 1, lib.ramp(ROCK, 0.02))
  end

  if mossy then
    -- Moss sits on the TOP of a boulder, where the light and rain reach it, so
    -- it is biased to the upper half rather than scattered over the silhouette.
    for i = 1, 9 do
      local a, rr = rng() * math.pi * 2, rng()
      RP.ellipsePx(body,
                   FOOT_X + math.cos(a) * w * 0.78 * rr,
                   cy - h * 0.16 + math.sin(a) * h * 0.26 * rr,
                   2 + rng() * 3.5, 1.5 + rng() * 2.2,
                   lib.ramp(FOLIAGE2, 0.05 + rng() * 0.35))
    end
  end
end

local function drawGatePillar(body, shadow, seed)
  footShadow(shadow, 18, 6, 155)
  local w, h = 17, 46
  local topY = FOOT_Y - h
  RP.polyPx(body, {
    { FOOT_X - w, FOOT_Y }, { FOOT_X - w, topY },
    { FOOT_X + w, topY },   { FOOT_X + w, FOOT_Y },
  }, lib.ramp(TRIM, 0.55))
  RP.polyPx(body, {
    { FOOT_X - w,       FOOT_Y }, { FOOT_X - w,       topY },
    { FOOT_X - w * 0.4, topY },   { FOOT_X - w * 0.4, FOOT_Y },
  }, lib.ramp(TRIM, 0.8))
  RP.polyPx(body, {
    { FOOT_X - w - 2, topY }, { FOOT_X - w - 2, topY - 5 },
    { FOOT_X + w + 2, topY - 5 }, { FOOT_X + w + 2, topY },
  }, lib.ramp(TRIM, 1.0))
  RP.ellipsePx(body, FOOT_X, FOOT_Y - h * 0.55, w * 0.55, h * 0.3, lib.ramp(TRIM, 0.2))
  RP.ellipsePx(body, FOOT_X, FOOT_Y - h * 0.55, w * 0.4,  h * 0.22, lib.ramp(TRIM, 0.45))
end

local function drawGateArch(body, shadow, seed)
  local w = 44
  local cy = FOOT_Y - 10
  -- A band, not a filled arch: the road passes under it. Thicker and seated
  -- lower than a first pass which drew a 5px ribbon floating clear of the
  -- ground and read as a rainbow rather than as masonry.
  for t = 0, 140 do
    local a = math.pi * (t / 140)
    local x = FOOT_X - math.cos(a) * w
    local y = cy - math.sin(a) * 30
    RP.ellipsePx(body, x, y, 8, 8, lib.ramp(TRIM, 0.4))
    RP.ellipsePx(body, x - 1.5, y - 1.5, 5, 5, lib.ramp(TRIM, 0.75))
  end
  for t = 1, 8 do                                   -- voussoir joints
    local a = math.pi * (t / 9)
    RP.linePx(body, FOOT_X - math.cos(a) * (w - 7), cy - math.sin(a) * (30 - 7),
              FOOT_X - math.cos(a) * (w + 7), cy - math.sin(a) * (30 + 7),
              1, lib.ramp(TRIM, 0.05))
  end
  RP.polyPx(body, {
    { FOOT_X - 5, cy - 34 }, { FOOT_X + 5, cy - 34 },
    { FOOT_X + 7, cy - 24 }, { FOOT_X - 7, cy - 24 },
  }, lib.ramp(TRIM, 1.0))
end

local function drawStump(body, shadow, seed)
  local rng = newRng(seed)
  footShadow(shadow, 13, 4.5, 140)
  local h = 13
  RP.polyPx(body, {
    { FOOT_X - 10, FOOT_Y }, { FOOT_X - 9, FOOT_Y - h },
    { FOOT_X + 9,  FOOT_Y - h }, { FOOT_X + 10, FOOT_Y },
  }, lib.ramp(BARK, 0.35))
  RP.ellipsePx(body, FOOT_X, FOOT_Y - h, 9, 4, lib.ramp(BARK, 0.85))
  RP.ellipsePx(body, FOOT_X, FOOT_Y - h, 6, 2.6, lib.ramp(BARK, 0.6))
  RP.ellipsePx(body, FOOT_X, FOOT_Y - h, 3, 1.3, lib.ramp(BARK, 0.9))
end

----------------------------------------------------------------------
-- frame tables
----------------------------------------------------------------------
-- Ground frame names are IDENTICAL across regions, which is what lets the
-- runtime carry one frame table and just load a different sheet.

local GROUND_FRAMES = {
  { 'ground_a',      function (i) groundBase(i, 1011, false, GROUND_CRACKED, GROUND_SPARKLE) end },
  { 'ground_b',      function (i) groundBase(i, 2027, false, GROUND_CRACKED, GROUND_SPARKLE) end },
  { 'ground_c',      function (i) groundBase(i, 3041, false, GROUND_CRACKED, GROUND_SPARKLE) end },
  { 'ground_d',      function (i) groundBase(i, 4073, false, GROUND_CRACKED, GROUND_SPARKLE) end },
  { 'ground_dark_a', function (i) groundBase(i, 5087, true,  false, GROUND_SPARKLE) end },
  { 'ground_dark_b', function (i) groundBase(i, 6101, true,  false, GROUND_SPARKLE) end },
  { 'pave_a',        function (i) groundPave(i, 7013, 5) end },
  { 'pave_b',        function (i) groundPave(i, 8039, 5) end },
  { 'pave_c',        function (i) groundPave(i, 9059, 6) end },
  { 'pave_d',        function (i) groundPave(i, 10079, 4) end },
  { 'plaza_a',       function (i) groundPlaza(i, 11087) end },
  { 'plaza_b',       function (i) groundPlaza(i, 12097) end },
  { 'plaza_c',       function (i) groundPlaza(i, 13109) end },
  { 'plaza_d',       function (i) groundPlaza(i, 14127) end },
  { 'dirt_a',        function (i) groundDirt(i, 15131) end },
  { 'dirt_b',        function (i) groundDirt(i, 16141) end },
  { 'water_a',       function (i) groundWater(i, 17159, false) end },
  { 'water_b',       function (i) groundWater(i, 18169, false) end },
  { 'deep_a',        function (i) groundWater(i, 19181, true) end },
  { 'deep_b',        function (i) groundWater(i, 20201, true) end },
  -- Molten ground. This is the STATIC body of a lava flow; its moving glow is
  -- still drawn by the procedural switch on top (see terrain-sprite.js), so the
  -- bake supplies the rounded shape and the tile supplies the life.
  { 'lava_a',        function (i) groundLava(i, 21211) end },
  { 'lava_b',        function (i) groundLava(i, 22229) end },
}

-- Prop ROLES, filled by different shapes per region. Props are (body, shadow)
-- pairs so the ink outline can run on the body alone.
local PROP_ROLES = {
  'growth_big_a', 'growth_big_b', 'growth_big_c', 'growth_big_d', 'growth_big_e',
  'growth_mid_a', 'growth_mid_b', 'growth_mid_c',
  'growth_small_a', 'growth_small_b',
  'growth_alt_a', 'growth_alt_b',
  'shrub_a', 'shrub_b', 'shrub_c',
  'bloom_a', 'bloom_b', 'bloom_c',
  'boulder_a', 'boulder_b', 'landmark',
  'rockwall_a', 'rockwall_b', 'rockwall_c',
  'gate_pillar', 'gate_arch',
  'debris_a', 'debris_b',
}

local REGION_PROPS = {
  forest = {
    growth_big_a   = function (b, s) drawTree(b, s, 1.00, 101,  0.00) end,
    growth_big_b   = function (b, s) drawTree(b, s, 0.94, 211,  0.00) end,
    growth_big_c   = function (b, s) drawTree(b, s, 1.02, 307,  0.00) end,
    growth_big_d   = function (b, s) drawTree(b, s, 0.98, 811, -0.30) end,
    growth_big_e   = function (b, s) drawTree(b, s, 1.04, 907, -0.18) end,
    growth_mid_a   = function (b, s) drawTree(b, s, 0.74, 401,  0.00) end,
    growth_mid_b   = function (b, s) drawTree(b, s, 0.68, 503,  0.00) end,
    growth_mid_c   = function (b, s) drawTree(b, s, 0.72, 1013, -0.26) end,
    growth_small_a = function (b, s) drawTree(b, s, 0.52, 601,  0.00) end,
    growth_small_b = function (b, s) drawTree(b, s, 0.46, 701,  0.00) end,
    growth_alt_a   = function (b, s) drawConifer(b, s, 1.00, 809) end,
    growth_alt_b   = function (b, s) drawConifer(b, s, 0.72, 907) end,
    shrub_a        = function (b, s) drawShrub(b, s, 1.00, 1009) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.78, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.15, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.0,  17) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 1.0,  15) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.45, 19) end,
    boulder_a      = function (b, s) drawRock(b, s, 16, 26, 1601, true) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 17, 1709, true) end,
    landmark       = function (b, s) drawRock(b, s, 38, 56, 2411, true) end,
    rockwall_a     = function (b, s) drawRock(b, s, 30, 26, 1801, true) end,
    rockwall_b     = function (b, s) drawRock(b, s, 34, 22, 1907, true) end,
    rockwall_c     = function (b, s) drawRock(b, s, 27, 28, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawStump(b, s, 2309) end,
    debris_b       = function (b, s) drawStump(b, s, 2417) end,
  },
  desert = {
    growth_big_a   = function (b, s) drawSaguaro(b, s, 1.00, 101,  0.00) end,
    growth_big_b   = function (b, s) drawSaguaro(b, s, 0.92, 211,  0.00) end,
    growth_big_c   = function (b, s) drawSaguaro(b, s, 1.05, 307, -0.12) end,
    growth_big_d   = function (b, s) drawSaguaro(b, s, 0.96, 811, -0.28) end,
    growth_big_e   = function (b, s) drawSaguaro(b, s, 1.01, 907,  0.10) end,
    growth_mid_a   = function (b, s) drawSaguaro(b, s, 0.70, 401,  0.00) end,
    growth_mid_b   = function (b, s) drawSaguaro(b, s, 0.64, 503, -0.20) end,
    growth_mid_c   = function (b, s) drawSaguaro(b, s, 0.74, 1013, 0.08) end,
    growth_small_a = function (b, s) drawSaguaro(b, s, 0.48, 601,  0.00) end,
    growth_small_b = function (b, s) drawBarrel(b, s, 1.10, 701) end,
    growth_alt_a   = function (b, s) drawBarrel(b, s, 1.00, 809) end,
    growth_alt_b   = function (b, s) drawBarrel(b, s, 0.74, 911) end,
    shrub_a        = function (b, s) drawPear(b, s, 1.00, 1009) end,
    shrub_b        = function (b, s) drawPear(b, s, 0.78, 1103) end,
    shrub_c        = function (b, s) drawPear(b, s, 1.15, 1201) end,
    bloom_a        = function (b, s) drawDesertBloom(b, s, 1301, 9) end,
    bloom_b        = function (b, s) drawDesertBloom(b, s, 1409, 6) end,
    bloom_c        = function (b, s) drawDesertBloom(b, s, 1511, 12) end,
    boulder_a      = function (b, s) drawRock(b, s, 16, 24, 1601, false) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 16, 1709, false) end,
    landmark       = function (b, s) drawObelisk(b, s, 2411) end,
    rockwall_a     = function (b, s) drawRock(b, s, 30, 24, 1801, false) end,
    rockwall_b     = function (b, s) drawRock(b, s, 34, 20, 1907, false) end,
    rockwall_c     = function (b, s) drawRock(b, s, 27, 26, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawBones(b, s, 2309, false) end,
    debris_b       = function (b, s) drawBones(b, s, 2417, true) end,
  },
  coast = {
    -- No tall growth exists in this concept, so the growth roles are coral, and
    -- the size ladder runs across coral fans rather than across tree heights.
    growth_big_a   = function (b, s) drawCoral(b, s, 1.00, 101, false,  0.00) end,
    growth_big_b   = function (b, s) drawCoral(b, s, 0.92, 211, true,   0.00) end,
    growth_big_c   = function (b, s) drawCoral(b, s, 1.05, 307, false, -0.15) end,
    growth_big_d   = function (b, s) drawCoral(b, s, 0.96, 811, true,   0.12) end,
    growth_big_e   = function (b, s) drawCoral(b, s, 1.02, 907, false,  0.10) end,
    growth_mid_a   = function (b, s) drawCoral(b, s, 0.74, 401, false,  0.00) end,
    growth_mid_b   = function (b, s) drawCoral(b, s, 0.68, 503, true,   0.00) end,
    growth_mid_c   = function (b, s) drawCoral(b, s, 0.78, 1013, false, -0.2) end,
    growth_small_a = function (b, s) drawCoral(b, s, 0.52, 601, false,  0.00) end,
    growth_small_b = function (b, s) drawCoral(b, s, 0.48, 701, true,   0.00) end,
    growth_alt_a   = function (b, s) drawAnemone(b, s, 1.00, 809) end,
    growth_alt_b   = function (b, s) drawAnemone(b, s, 0.74, 911) end,
    shrub_a        = function (b, s) drawCoral(b, s, 0.60, 1009, true,  0.15) end,
    shrub_b        = function (b, s) drawCoral(b, s, 0.50, 1103, false, 0.15) end,
    shrub_c        = function (b, s) drawAnemone(b, s, 0.86, 1201) end,
    bloom_a        = function (b, s) drawShoreScatter(b, s, 1301, 1, 2) end,
    bloom_b        = function (b, s) drawShoreScatter(b, s, 1409, 0, 4) end,
    bloom_c        = function (b, s) drawShoreScatter(b, s, 1511, 2, 1) end,
    boulder_a      = function (b, s) drawRock(b, s, 15, 22, 1601, false) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 15, 1709, false) end,
    landmark       = function (b, s) drawDriftwood(b, s, 2411) end,
    -- The breakwater: wet black boulders, wide and low.
    rockwall_a     = function (b, s) drawRock(b, s, 30, 22, 1801, false) end,
    rockwall_b     = function (b, s) drawRock(b, s, 34, 19, 1907, false) end,
    rockwall_c     = function (b, s) drawRock(b, s, 27, 24, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawShoreScatter(b, s, 2309, 0, 3) end,
    debris_b       = function (b, s) drawShoreScatter(b, s, 2417, 1, 1) end,
  },
  ice = {
    -- Snow-laden pines fill the border band, the way the forest uses broadleaf
    -- and the desert uses saguaro.
    growth_big_a   = function (b, s) drawConifer(b, s, 1.00, 101, true) end,
    growth_big_b   = function (b, s) drawConifer(b, s, 0.92, 211, true) end,
    growth_big_c   = function (b, s) drawConifer(b, s, 1.06, 307, true) end,
    growth_big_d   = function (b, s) drawConifer(b, s, 0.88, 811, true) end,
    growth_big_e   = function (b, s) drawConifer(b, s, 1.02, 907, true) end,
    growth_mid_a   = function (b, s) drawConifer(b, s, 0.72, 401, true) end,
    growth_mid_b   = function (b, s) drawConifer(b, s, 0.66, 503, true) end,
    growth_mid_c   = function (b, s) drawConifer(b, s, 0.76, 1013, true) end,
    growth_small_a = function (b, s) drawConifer(b, s, 0.50, 601, true) end,
    growth_small_b = function (b, s) drawConifer(b, s, 0.44, 701, true) end,
    growth_alt_a   = function (b, s) drawFacetedSpire(b, s, 1.00, 809) end,
    growth_alt_b   = function (b, s) drawFacetedSpire(b, s, 0.72, 911) end,
    shrub_a        = function (b, s) drawShrub(b, s, 1.00, 1009, true,  true) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.78, 1103, true,  true) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.12, 1201, false, true) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 1.0,  13) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 0.35, 11) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 1.0,  15) end,
    boulder_a      = function (b, s) drawIceBlock(b, s, 16, 26, 1601) end,
    boulder_b      = function (b, s) drawIceBlock(b, s, 11, 18, 1709) end,
    landmark       = function (b, s) drawFacetedSpire(b, s, 1.55, 2411) end,
    -- The glacier border: angular ice slabs rather than weathered stone.
    rockwall_a     = function (b, s) drawIceBlock(b, s, 28, 34, 1801) end,
    rockwall_b     = function (b, s) drawIceBlock(b, s, 32, 27, 1907) end,
    rockwall_c     = function (b, s) drawIceBlock(b, s, 25, 40, 2003) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawSnowMound(b, s, 1.00, 2309) end,
    debris_b       = function (b, s) drawSnowMound(b, s, 0.74, 2417) end,
  },
  earth = {
    -- Menhirs fill the growth roles. This region's border is T.MOUNTAIN, which
    -- keeps its own neighbour-autotiled art, so nothing dense uses these slots
    -- on an overworld; the standing stones draw from them for variety.
    growth_big_a   = function (b, s) drawMenhir(b, s, 1.00, 101,  1.5) end,
    growth_big_b   = function (b, s) drawMenhir(b, s, 0.92, 211, -2.0) end,
    growth_big_c   = function (b, s) drawMenhir(b, s, 1.08, 307,  0.5) end,
    growth_big_d   = function (b, s) drawMenhir(b, s, 0.88, 811,  2.5) end,
    growth_big_e   = function (b, s) drawMenhir(b, s, 1.02, 907, -1.2) end,
    growth_mid_a   = function (b, s) drawMenhir(b, s, 0.72, 401,  1.8) end,
    growth_mid_b   = function (b, s) drawMenhir(b, s, 0.66, 503, -2.4) end,
    growth_mid_c   = function (b, s) drawMenhir(b, s, 0.78, 1013, 0.8) end,
    growth_small_a = function (b, s) drawMenhir(b, s, 0.50, 601, -1.0) end,
    growth_small_b = function (b, s) drawMenhir(b, s, 0.44, 701,  1.4) end,
    growth_alt_a   = function (b, s) drawCrystalCluster(b, s, 1.25, 809) end,
    growth_alt_b   = function (b, s) drawCrystalCluster(b, s, 0.90, 911) end,
    shrub_a        = function (b, s) drawShrub(b, s, 0.95, 1009) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.76, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.10, 1201) end,
    bloom_a        = function (b, s) drawCrystalCluster(b, s, 1.00, 1301) end,
    bloom_b        = function (b, s) drawCrystalCluster(b, s, 0.78, 1409) end,
    bloom_c        = function (b, s) drawCrystalCluster(b, s, 1.15, 1511) end,
    boulder_a      = function (b, s) drawRock(b, s, 16, 25, 1601, true) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 17, 1709, true) end,
    landmark       = function (b, s) drawMenhir(b, s, 1.30, 2411, -2.2) end,
    rockwall_a     = function (b, s) drawRock(b, s, 30, 27, 1801, true) end,
    rockwall_b     = function (b, s) drawRock(b, s, 34, 22, 1907, true) end,
    rockwall_c     = function (b, s) drawRock(b, s, 27, 30, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawRock(b, s, 9, 11, 2309, true) end,
    debris_b       = function (b, s) drawRock(b, s, 7, 8, 2417, false) end,
  },
  -- Volcanic introduces NO new shape at all: obsidian is the faceted spire with
  -- a basalt body, the sulfur bushes are the forest's shrub on an ochre ramp,
  -- and the ember flowers are the forest's drift on an orange one. This is the
  -- reuse the role split was for.
  volcanic = {
    growth_big_a   = function (b, s) drawFacetedSpire(b, s, 1.00, 101) end,
    growth_big_b   = function (b, s) drawFacetedSpire(b, s, 0.90, 211) end,
    growth_big_c   = function (b, s) drawFacetedSpire(b, s, 1.10, 307) end,
    growth_big_d   = function (b, s) drawFacetedSpire(b, s, 0.84, 811) end,
    growth_big_e   = function (b, s) drawFacetedSpire(b, s, 1.04, 907) end,
    growth_mid_a   = function (b, s) drawFacetedSpire(b, s, 0.70, 401) end,
    growth_mid_b   = function (b, s) drawFacetedSpire(b, s, 0.62, 503) end,
    growth_mid_c   = function (b, s) drawFacetedSpire(b, s, 0.76, 1013) end,
    growth_small_a = function (b, s) drawFacetedSpire(b, s, 0.48, 601) end,
    growth_small_b = function (b, s) drawFacetedSpire(b, s, 0.42, 701) end,
    growth_alt_a   = function (b, s) drawRock(b, s, 15, 22, 809, false) end,
    growth_alt_b   = function (b, s) drawRock(b, s, 12, 17, 911, false) end,
    shrub_a        = function (b, s) drawShrub(b, s, 0.98, 1009) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.78, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.14, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.0,  15) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 0.5,  12) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.25, 18) end,
    boulder_a      = function (b, s) drawRock(b, s, 16, 24, 1601, false) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 16, 1709, false) end,
    landmark       = function (b, s) drawFacetedSpire(b, s, 1.50, 2411) end,
    -- The caldera rim: a dense band of chunky black basalt.
    rockwall_a     = function (b, s) drawRock(b, s, 29, 26, 1801, false) end,
    rockwall_b     = function (b, s) drawRock(b, s, 33, 21, 1907, false) end,
    rockwall_c     = function (b, s) drawRock(b, s, 26, 30, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawRock(b, s, 9, 12, 2309, false) end,
    debris_b       = function (b, s) drawRock(b, s, 7, 9, 2417, false) end,
  },
  air = {
    growth_big_a   = function (b, s) drawCloudSpire(b, s, 1.00, 101) end,
    growth_big_b   = function (b, s) drawCloudSpire(b, s, 0.90, 211) end,
    growth_big_c   = function (b, s) drawCloudSpire(b, s, 1.08, 307) end,
    growth_big_d   = function (b, s) drawCloudSpire(b, s, 0.84, 811) end,
    growth_big_e   = function (b, s) drawCloudSpire(b, s, 1.02, 907) end,
    growth_mid_a   = function (b, s) drawCloudSpire(b, s, 0.70, 401) end,
    growth_mid_b   = function (b, s) drawCloudSpire(b, s, 0.62, 503) end,
    growth_mid_c   = function (b, s) drawCloudSpire(b, s, 0.76, 1013) end,
    growth_small_a = function (b, s) drawCloudSpire(b, s, 0.46, 601) end,
    growth_small_b = function (b, s) drawCloudSpire(b, s, 0.40, 701) end,
    -- Storm thistles: the forest's bush on the teal ramp, spikier by virtue of
    -- the palette rather than the shape.
    growth_alt_a   = function (b, s) drawShrub(b, s, 0.86, 809) end,
    growth_alt_b   = function (b, s) drawShrub(b, s, 0.66, 911) end,
    shrub_a        = function (b, s) drawReed(b, s, 1.00, 1009) end,
    shrub_b        = function (b, s) drawReed(b, s, 0.78, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.05, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.0,  14) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 0.45, 12) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.2,  16) end,
    -- No stone anywhere in this region: the "boulders" are small cloud puffs.
    boulder_a      = function (b, s) drawCloudSpire(b, s, 0.34, 1601) end,
    boulder_b      = function (b, s) drawCloudSpire(b, s, 0.28, 1709) end,
    landmark       = function (b, s) drawCloudSpire(b, s, 1.35, 2411) end,
    rockwall_a     = function (b, s) drawCloudSpire(b, s, 0.55, 1801) end,
    rockwall_b     = function (b, s) drawCloudSpire(b, s, 0.48, 1907) end,
    rockwall_c     = function (b, s) drawCloudSpire(b, s, 0.62, 2003) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawReed(b, s, 0.60, 2309) end,
    debris_b       = function (b, s) drawCloudSpire(b, s, 0.24, 2417) end,
  },
  -- Lightning introduces no new shape either. Fulgurite is the faceted spire on
  -- a dark ramp, volt blooms are the earth region's crystal cluster in cyan,
  -- and spark reeds are the air region's reeds in violet. Three regions'
  -- shapes, recombined.
  lightning = {
    growth_big_a   = function (b, s) drawFacetedSpire(b, s, 1.00, 101) end,
    growth_big_b   = function (b, s) drawFacetedSpire(b, s, 0.90, 211) end,
    growth_big_c   = function (b, s) drawFacetedSpire(b, s, 1.08, 307) end,
    growth_big_d   = function (b, s) drawFacetedSpire(b, s, 0.84, 811) end,
    growth_big_e   = function (b, s) drawFacetedSpire(b, s, 1.03, 907) end,
    growth_mid_a   = function (b, s) drawFacetedSpire(b, s, 0.70, 401) end,
    growth_mid_b   = function (b, s) drawFacetedSpire(b, s, 0.62, 503) end,
    growth_mid_c   = function (b, s) drawFacetedSpire(b, s, 0.76, 1013) end,
    growth_small_a = function (b, s) drawFacetedSpire(b, s, 0.48, 601) end,
    growth_small_b = function (b, s) drawFacetedSpire(b, s, 0.42, 701) end,
    growth_alt_a   = function (b, s) drawFacetedSpire(b, s, 0.66, 809) end,
    growth_alt_b   = function (b, s) drawFacetedSpire(b, s, 0.54, 911) end,
    shrub_a        = function (b, s) drawReed(b, s, 1.05, 1009) end,
    shrub_b        = function (b, s) drawReed(b, s, 0.82, 1103) end,
    shrub_c        = function (b, s) drawCrystalCluster(b, s, 0.90, 1201) end,
    bloom_a        = function (b, s) drawCrystalCluster(b, s, 1.00, 1301) end,
    bloom_b        = function (b, s) drawCrystalCluster(b, s, 0.78, 1409) end,
    bloom_c        = function (b, s) drawCrystalCluster(b, s, 1.18, 1511) end,
    boulder_a      = function (b, s) drawRock(b, s, 15, 22, 1601, false) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 16, 1709, false) end,
    landmark       = function (b, s) drawFacetedSpire(b, s, 1.45, 2411) end,
    rockwall_a     = function (b, s) drawRock(b, s, 29, 25, 1801, false) end,
    rockwall_b     = function (b, s) drawRock(b, s, 32, 21, 1907, false) end,
    rockwall_c     = function (b, s) drawRock(b, s, 26, 29, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawCrystalCluster(b, s, 0.62, 2309) end,
    debris_b       = function (b, s) drawReed(b, s, 0.58, 2417) end,
  },
  -- Luminous has exactly ONE prop: its crystal border wall. Everything else in
  -- the region animates and is left on the procedural switch over the bake, so
  -- the remaining roles are filled but see little use.
  luminous = {
    growth_big_a   = function (b, s) drawFacetedSpire(b, s, 1.10, 101) end,
    growth_big_b   = function (b, s) drawFacetedSpire(b, s, 0.96, 211) end,
    growth_big_c   = function (b, s) drawFacetedSpire(b, s, 1.20, 307) end,
    growth_big_d   = function (b, s) drawFacetedSpire(b, s, 0.88, 811) end,
    growth_big_e   = function (b, s) drawFacetedSpire(b, s, 1.06, 907) end,
    growth_mid_a   = function (b, s) drawFacetedSpire(b, s, 0.74, 401) end,
    growth_mid_b   = function (b, s) drawFacetedSpire(b, s, 0.64, 503) end,
    growth_mid_c   = function (b, s) drawFacetedSpire(b, s, 0.80, 1013) end,
    growth_small_a = function (b, s) drawFacetedSpire(b, s, 0.50, 601) end,
    growth_small_b = function (b, s) drawFacetedSpire(b, s, 0.44, 701) end,
    growth_alt_a   = function (b, s) drawCrystalCluster(b, s, 1.05, 809) end,
    growth_alt_b   = function (b, s) drawCrystalCluster(b, s, 0.80, 911) end,
    shrub_a        = function (b, s) drawShrub(b, s, 0.98, 1009) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.78, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.12, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.0,  15) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 0.5,  12) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.25, 17) end,
    boulder_a      = function (b, s) drawRock(b, s, 15, 22, 1601, false) end,
    boulder_b      = function (b, s) drawRock(b, s, 11, 16, 1709, false) end,
    landmark       = function (b, s) drawFacetedSpire(b, s, 1.55, 2411) end,
    rockwall_a     = function (b, s) drawFacetedSpire(b, s, 0.92, 1801) end,
    rockwall_b     = function (b, s) drawFacetedSpire(b, s, 0.78, 1907) end,
    rockwall_c     = function (b, s) drawFacetedSpire(b, s, 1.02, 2003) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawCrystalCluster(b, s, 0.60, 2309) end,
    debris_b       = function (b, s) drawShrub(b, s, 0.58, 2417) end,
  },
  necrotic = {
    -- Dead trees claw up out of the crypt-wall border.
    growth_big_a   = function (b, s) drawDeadTree(b, s, 1.00, 101) end,
    growth_big_b   = function (b, s) drawDeadTree(b, s, 0.90, 211) end,
    growth_big_c   = function (b, s) drawDeadTree(b, s, 1.08, 307) end,
    growth_big_d   = function (b, s) drawDeadTree(b, s, 0.84, 811) end,
    growth_big_e   = function (b, s) drawDeadTree(b, s, 1.03, 907) end,
    growth_mid_a   = function (b, s) drawDeadTree(b, s, 0.72, 401) end,
    growth_mid_b   = function (b, s) drawDeadTree(b, s, 0.64, 503) end,
    growth_mid_c   = function (b, s) drawDeadTree(b, s, 0.78, 1013) end,
    growth_small_a = function (b, s) drawDeadTree(b, s, 0.50, 601) end,
    growth_small_b = function (b, s) drawDeadTree(b, s, 0.44, 701) end,
    -- Headstones, in five sizes and leans. This region scatters them across
    -- every open patch it has, so they need at least as much variety as the
    -- forest's trees.
    growth_alt_a   = function (b, s) drawTombstone(b, s, 1.00, 809) end,
    growth_alt_b   = function (b, s) drawTombstone(b, s, 0.82, 911) end,
    shrub_a        = function (b, s) drawShrub(b, s, 0.90, 1009) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.70, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.06, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.0,  11) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 0.6,   9) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.3,  13) end,
    boulder_a      = function (b, s) drawTombstone(b, s, 1.12, 1601) end,
    boulder_b      = function (b, s) drawTombstone(b, s, 0.68, 1709) end,
    landmark       = function (b, s) drawTombstone(b, s, 1.35, 2411) end,
    rockwall_a     = function (b, s) drawRock(b, s, 28, 24, 1801, false) end,
    rockwall_b     = function (b, s) drawRock(b, s, 32, 20, 1907, false) end,
    rockwall_c     = function (b, s) drawRock(b, s, 25, 27, 2003, false) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    -- Bone heaps, using the shore-scatter shape on the bone palette.
    debris_a       = function (b, s) drawShoreScatter(b, s, 2309, 0, 5) end,
    debris_b       = function (b, s) drawShoreScatter(b, s, 2417, 1, 3) end,
  },
  poison = {
    -- Mangroves fill both the explicit tree tiles and the dense thicket band.
    -- Ten scales and tones prevent the border from reading as a stamped row.
    growth_big_a   = function (b, s) drawMangrove(b, s, 1.00, 101,  0.00) end,
    growth_big_b   = function (b, s) drawMangrove(b, s, 0.92, 211, -0.06) end,
    growth_big_c   = function (b, s) drawMangrove(b, s, 1.06, 307, -0.12) end,
    growth_big_d   = function (b, s) drawMangrove(b, s, 0.86, 811, -0.20) end,
    growth_big_e   = function (b, s) drawMangrove(b, s, 1.02, 907, -0.08) end,
    growth_mid_a   = function (b, s) drawMangrove(b, s, 0.72, 401, -0.04) end,
    growth_mid_b   = function (b, s) drawMangrove(b, s, 0.64, 503, -0.16) end,
    growth_mid_c   = function (b, s) drawMangrove(b, s, 0.78, 1013, -0.10) end,
    growth_small_a = function (b, s) drawMangrove(b, s, 0.52, 601, -0.12) end,
    growth_small_b = function (b, s) drawMangrove(b, s, 0.46, 701, -0.22) end,
    growth_alt_a   = function (b, s) drawMangrove(b, s, 0.68, 809, -0.08) end,
    growth_alt_b   = function (b, s) drawMangrove(b, s, 0.58, 911, -0.18) end,
    -- The existing reed shape becomes brown-headed cattail on this palette.
    shrub_a        = function (b, s) drawReed(b, s, 1.08, 1009) end,
    shrub_b        = function (b, s) drawReed(b, s, 0.84, 1103) end,
    shrub_c        = function (b, s) drawReed(b, s, 1.20, 1201) end,
    -- Low layered crowns read as marsh fern when kept close to the ground.
    bloom_a        = function (b, s) drawShrub(b, s, 0.92, 1301) end,
    bloom_b        = function (b, s) drawShrub(b, s, 0.72, 1409) end,
    bloom_c        = function (b, s) drawShrub(b, s, 1.05, 1511) end,
    boulder_a      = function (b, s) drawRock(b, s, 27, 21, 1601, true) end,
    boulder_b      = function (b, s) drawRock(b, s, 20, 16, 1709, true) end,
    landmark       = function (b, s) drawDriftwood(b, s, 2411) end,
    rockwall_a     = function (b, s) drawMangrove(b, s, 0.66, 1801, -0.18) end,
    rockwall_b     = function (b, s) drawMangrove(b, s, 0.56, 1907, -0.24) end,
    rockwall_c     = function (b, s) drawMangrove(b, s, 0.74, 2003, -0.14) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawDriftwood(b, s, 2309) end,
    debris_b       = function (b, s) drawRock(b, s, 16, 12, 2417, true) end,
  },
  mana = {
    -- Broad ancient trees supply the region's height. Crystal spires and
    -- clusters occupy the alternate and stone roles so cyan breaks through
    -- the blue-green canopy all around the border.
    growth_big_a   = function (b, s) drawTree(b, s, 1.08, 101,  0.00) end,
    growth_big_b   = function (b, s) drawTree(b, s, 1.00, 211, -0.05) end,
    growth_big_c   = function (b, s) drawTree(b, s, 1.12, 307, -0.10) end,
    growth_big_d   = function (b, s) drawTree(b, s, 0.96, 811, -0.16) end,
    growth_big_e   = function (b, s) drawTree(b, s, 1.06, 907, -0.08) end,
    growth_mid_a   = function (b, s) drawTree(b, s, 0.78, 401, -0.04) end,
    growth_mid_b   = function (b, s) drawTree(b, s, 0.70, 503, -0.12) end,
    growth_mid_c   = function (b, s) drawTree(b, s, 0.82, 1013, -0.08) end,
    growth_small_a = function (b, s) drawTree(b, s, 0.56, 601, -0.10) end,
    growth_small_b = function (b, s) drawTree(b, s, 0.48, 701, -0.16) end,
    growth_alt_a   = function (b, s) drawFacetedSpire(b, s, 1.00, 809) end,
    growth_alt_b   = function (b, s) drawFacetedSpire(b, s, 0.72, 907) end,
    shrub_a        = function (b, s) drawShrub(b, s, 1.08, 1009) end,
    shrub_b        = function (b, s) drawShrub(b, s, 0.84, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 1.18, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.0, 17) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 1.0, 15) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.45, 19) end,
    boulder_a      = function (b, s) drawCrystalCluster(b, s, 0.82, 1601) end,
    boulder_b      = function (b, s) drawCrystalCluster(b, s, 0.62, 1709) end,
    landmark       = function (b, s) drawTree(b, s, 1.22, 2411, -0.06) end,
    rockwall_a     = function (b, s) drawFacetedSpire(b, s, 0.88, 1801) end,
    rockwall_b     = function (b, s) drawFacetedSpire(b, s, 0.72, 1907) end,
    rockwall_c     = function (b, s) drawCrystalCluster(b, s, 0.95, 2003) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawCrystalCluster(b, s, 0.46, 2309) end,
    debris_b       = function (b, s) drawFlowers(b, s, 2417, 0.35, 7) end,
  },
  shadow = {
    -- Low black spires make a broken wall rather than a forest. Violet shrubs,
    -- pale flower drifts and monoliths are reserved for readable accents.
    growth_big_a   = function (b, s) drawFacetedSpire(b, s, 1.02, 101) end,
    growth_big_b   = function (b, s) drawFacetedSpire(b, s, 0.92, 211) end,
    growth_big_c   = function (b, s) drawFacetedSpire(b, s, 1.10, 307) end,
    growth_big_d   = function (b, s) drawMenhir(b, s, 0.92, 811, -0.08) end,
    growth_big_e   = function (b, s) drawMenhir(b, s, 1.04, 907, 0.06) end,
    growth_mid_a   = function (b, s) drawFacetedSpire(b, s, 0.72, 401) end,
    growth_mid_b   = function (b, s) drawFacetedSpire(b, s, 0.62, 503) end,
    growth_mid_c   = function (b, s) drawMenhir(b, s, 0.70, 1013, -0.05) end,
    growth_small_a = function (b, s) drawRock(b, s, 24, 20, 601, false) end,
    growth_small_b = function (b, s) drawRock(b, s, 18, 15, 701, false) end,
    growth_alt_a   = function (b, s) drawMenhir(b, s, 1.00, 809, -0.05) end,
    growth_alt_b   = function (b, s) drawMenhir(b, s, 0.72, 907, 0.06) end,
    shrub_a        = function (b, s) drawReed(b, s, 1.02, 1009) end,
    shrub_b        = function (b, s) drawReed(b, s, 0.78, 1103) end,
    shrub_c        = function (b, s) drawShrub(b, s, 0.92, 1201) end,
    bloom_a        = function (b, s) drawFlowers(b, s, 1301, 0.15, 13) end,
    bloom_b        = function (b, s) drawFlowers(b, s, 1409, 0.85, 11) end,
    bloom_c        = function (b, s) drawFlowers(b, s, 1511, 0.50, 15) end,
    boulder_a      = function (b, s) drawRock(b, s, 29, 24, 1601, false) end,
    boulder_b      = function (b, s) drawRock(b, s, 21, 17, 1709, false) end,
    landmark       = function (b, s) drawMenhir(b, s, 1.24, 2411, -0.02) end,
    rockwall_a     = function (b, s) drawRock(b, s, 34, 28, 1801, false) end,
    rockwall_b     = function (b, s) drawRock(b, s, 38, 24, 1907, false) end,
    rockwall_c     = function (b, s) drawFacetedSpire(b, s, 0.66, 2003) end,
    gate_pillar    = function (b, s) drawGatePillar(b, s, 2101) end,
    gate_arch      = function (b, s) drawGateArch(b, s, 2203) end,
    debris_a       = function (b, s) drawRock(b, s, 16, 11, 2309, false) end,
    debris_b       = function (b, s) drawFlowers(b, s, 2417, 0.65, 5) end,
  },
}

-- Per-region ground flags. Only the desert concept draws cracked open ground;
-- only the frost one glints.
local CRACKED = { forest = false, desert = true,  coast = false, ice = false,
                  luminous = false,
                  earth = false, volcanic = true,  air = false, lightning = false,
                  poison = false, mana = false, shadow = false }
-- Lightning sparkles too: the frost region's glints become static discharge
-- flecked across the storm floor. Far fewer and far dimmer, though, because the
-- ground under them is nearly black.
local SPARKLE = {
  ice       = { n = 16, t = 1.0, cross = 0.45 },
  lightning = { n = 5,  t = 0.0, cross = 0.15 },
}

----------------------------------------------------------------------
-- build
----------------------------------------------------------------------

local function buildGround(path)
  local n = #GROUND_FRAMES
  local total = math.ceil(n / GCOLS) * GCOLS
  local spr = Sprite(GS, GS, ColorMode.RGB)
  spr.layers[1].name = "ground"
  local lay = spr.layers[1]
  while #spr.frames < total do spr:newFrame() end
  for f = 1, total do
    local img = Image(GS, GS, ColorMode.RGB)
    img:clear()
    local e = GROUND_FRAMES[f]
    if e then e[2](img) end                        -- frames past the list stay empty
    if lay:cel(f) then spr:deleteCel(lay, f) end
    spr:newCel(lay, f, img, Point(0, 0))
  end
  spr:saveAs(path)
  print("wrote " .. path .. "  frames=" .. #spr.frames)
end

local function buildProps(path, region)
  local set = REGION_PROPS[region] or error('no props for region ' .. tostring(region))
  local n = #PROP_ROLES
  local total = math.ceil(n / PCOLS) * PCOLS
  local spr = Sprite(PW, PH, ColorMode.RGB)
  spr.layers[1].name = "props"
  local lay = spr.layers[1]
  while #spr.frames < total do spr:newFrame() end
  for f = 1, total do
    local img = Image(PW, PH, ColorMode.RGB)
    img:clear()
    local role = PROP_ROLES[f]
    local fn = role and set[role]
    if role and not fn then error('region ' .. region .. ' has no shape for role ' .. role) end
    if fn then
      local body   = Image(PW, PH, ColorMode.RGB); body:clear()
      local shadow = Image(PW, PH, ColorMode.RGB); shadow:clear()
      fn(body, shadow)
      -- One ink line of consistent weight around the silhouette, run on the body
      -- alone so the soft shadow underneath is not outlined.
      RP.outlineSilhouette(body, OUTLINE)
      over(img, shadow, PW, PH)
      over(img, body,   PW, PH)
    end
    if lay:cel(f) then spr:deleteCel(lay, f) end
    spr:newCel(lay, f, img, Point(0, 0))
  end
  spr:saveAs(path)
  print("wrote " .. path .. "  frames=" .. #spr.frames)
end

local params = app.params or {}
local region = params["region"] or os.getenv("TERRAIN_REGION") or "forest"
usePalette(region)
GROUND_CRACKED = CRACKED[region] or false
GROUND_SPARKLE = SPARKLE[region] or nil

local groundPath = params["out"]   or os.getenv("TERRAIN_GROUND_OUT") or ('terrain-' .. region .. '-ground.aseprite')
local propsPath  = params["props"] or os.getenv("TERRAIN_PROPS_OUT")  or ('terrain-' .. region .. '-props.aseprite')
buildGround(groundPath)
buildProps(propsPath, region)

----------------------------------------------------------------------
-- <region>-atlas.js
----------------------------------------------------------------------

local atlasPath = params["atlas"] or os.getenv("TERRAIN_ATLAS_OUT") or ('terrain-' .. region .. '-atlas.js')
local af = io.open(atlasPath, "wb")
if not af then
  error("cannot write " .. atlasPath .. " (run from the repo root)")
end

af:write("// GENERATED by tools/make-terrain-sheet.lua. Do not edit by hand.\n")
af:write("//\n")
af:write("// Regenerate with the commands in that script's header, from the repo\n")
af:write("// root. This file is written by step 1, alongside the two .aseprite\n")
af:write("// files, and is one region's entry in the shared TERRAIN_ATLAS.\n")
af:write("//\n")
af:write("// Loaded as a plain script (no modules, no fetch) so it works from\n")
af:write("// file://, and read by terrain-sprite.js. Assigns into a global rather\n")
af:write("// than declaring one, so every region's atlas file is independent and\n")
af:write("// they can load in any order.\n")
af:write("//\n")
af:write("// `ground` frames are 48x48 and SEAMLESS in both axes: the chunk baker\n")
af:write("// uses them as repeating fills over free-form regions. `props` frames\n")
af:write("// are 96x144 with the object's foot at (48, 138), so the renderer\n")
af:write("// positions a prop by the tile it stands on and lets the art overhang\n")
af:write("// its neighbours. Frame NAMES are identical across regions; only the\n")
af:write("// pixels differ.\n")
af:write("window.TERRAIN_ATLAS = window.TERRAIN_ATLAS || {};\n")
af:write(string.format("window.TERRAIN_ATLAS[%q] = {\n", region))
af:write(string.format("  ground: { tile: %d, cols: %d, sheet: 'terrain-%s-ground.png', frames: {\n",
                       GS, GCOLS, region))
for i = 1, #GROUND_FRAMES do
  af:write(string.format("    %s: %d,\n", GROUND_FRAMES[i][1], i - 1))
end
af:write("  } },\n")
af:write(string.format("  props: { w: %d, h: %d, cols: %d, footX: %d, footY: %d, sheet: 'terrain-%s-props.png', frames: {\n",
                       PW, PH, PCOLS, FOOT_X, FOOT_Y, region))
for i = 1, #PROP_ROLES do
  af:write(string.format("    %s: %d,\n", PROP_ROLES[i], i - 1))
end
af:write("  } },\n")
af:write("};\n")
af:close()
print("wrote " .. atlasPath)
