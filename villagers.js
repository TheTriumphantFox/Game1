// ─── Villagers ────────────────────────────────────────────────────────────────
// Friendly NPCs that wander around an active (cleared) village. They appear
// when activateVillage() runs, are saved per-map alongside enemies, and walk
// through the streets between shops on a slow random walk.
//
// Villagers don't fight, can't be hit by anything (weapons are sheathed in an
// active village), and the player passes through them — they only obstruct
// each other so the crowd doesn't pile onto a single tile.

const VILLAGER_TYPES = [
  { name: 'Farmer',   robe: '#8a5520', hair: '#3a2010', skin: '#e8c8a0' },
  { name: 'Baker',    robe: '#dddddd', hair: '#7a5530', skin: '#e8c8a0' },
  { name: 'Elder',    robe: '#445588', hair: '#cccccc', skin: '#d8b890' },
  { name: 'Child',    robe: '#cc4488', hair: '#aa7733', skin: '#f0d0a8', sizeMul: 0.72 },
  { name: 'Hunter',   robe: '#2f5a2f', hair: '#4a2c10', skin: '#d8b890' },
  { name: 'Merchant', robe: '#8a3a8a', hair: '#3a1808', skin: '#e8c8a0' },
  { name: 'Scholar',  robe: '#3a3a6a', hair: '#888888', skin: '#e0c098' },
  { name: 'Smith',    robe: '#5a3020', hair: '#1a1008', skin: '#d8a878' },
];

// Flavor lines shown when the player presses space next to a regular villager.
// One per kind; a random line is picked on each interaction.
const VILLAGER_CHAT = {
  Farmer:    ["The harvest will be plentiful this year.",
              "Mind my crops on your way past!",
              "A fine day for tilling."],
  Baker:     ["Fresh bread, hero!",
              "My oven's been busy ever since you arrived.",
              "Care for a sweet roll?"],
  Elder:     ["I remember when the Lich first came…",
              "You have saved us all.",
              "Sit a while and rest, young one."],
  Child:     ["You're a real hero!",
              "I want a sword like yours when I grow up!",
              "Tag — you're it!"],
  Hunter:    ["I track wolves in the eastern woods.",
              "Keep an arrow nocked out there.",
              "These boots have walked a thousand miles."],
  Merchant:  ["Business is finally booming.",
              "Visit the general store for the best wares.",
              "Coin makes the world turn."],
  Scholar:   ["I'm cataloguing every plant in the woods.",
              "Knowledge is the truest treasure.",
              "Have you seen the moonlight beetles?"],
  Smith:     ["My hammer rings night and day.",
              "Bring me good steel and I'll forge wonders.",
              "An honest dent shows honest work."],
  Innkeeper: ["Welcome, weary traveler. A bed awaits."],
  Shopkeeper:["Greetings, hero! Browse my wares."],
  Herbalist: ["Bring me mushrooms and herbs for a remedy."],
  Blacksmith:["Need armor? I forge the finest in the land."],
};

// Live list for the current map (mirrors `enemies`).
let villagers = [];

// Tiles villagers refuse to step onto even though they're "passable" — keeps
// them from clogging shop doors or sitting on a chest.
function isVillagerOffLimits(tileId) {
  return tileId === T.INN_DOOR || tileId === T.STORE_DOOR ||
         tileId === T.HERB_DOOR || tileId === T.SMITH_DOOR ||
         tileId === T.CHEST    || tileId === T.LARGE_CHEST ||
         tileId === T.LARGE_CHEST_R ||
         tileId === T.BOSS_CHEST_TL || tileId === T.BOSS_CHEST_TR ||
         tileId === T.BOSS_CHEST_BL || tileId === T.BOSS_CHEST_BR ||
         tileId === T.SHRINE   || tileId === T.CAVE_ENTRANCE ||
         tileId === T.CAVE_EXIT || tileId === T.PORTAL;
}

// Fresh spawn for a newly-activated village. Two shopkeepers stand behind
// wooden counters inside the inn and store houses; 20 more villagers wander
// the streets around the plaza.
function generateVillagers(mapObj) {
  const list = placeShopkeepers(mapObj);
  let nextId = list.length;
  const m = mapObj.map;
  const count = 20;
  const spread = 22;

  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 80; t++) {
      const x = rnd(spread, MCOLS - spread);
      const y = rnd(spread, MROWS - spread);
      if (isSolid(m, x, y)) continue;
      if (isVillagerOffLimits(m[y][x])) continue;
      // Wanderers stay outside (on grass / cobble / marble — never on FLOOR,
      // so they don't collide with the keepers' workspace).
      if (m[y][x] === T.FLOOR) continue;
      if (list.some(v => v.x === x && v.y === y)) continue;
      const type = VILLAGER_TYPES[Math.floor(Math.random() * VILLAGER_TYPES.length)];
      list.push({
        id: nextId++,
        kind: type.name,
        robe: type.robe, hair: type.hair, skin: type.skin,
        size: type.sizeMul || 1,
        x, y,
        renderX: x, renderY: y,
        dir: [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}][Math.floor(Math.random()*4)],
        // Stagger initial timers so they don't all step in unison.
        timer: Math.random() * 800,
        stepMs: 550 + Math.random() * 500,
      });
      break;
    }
  }
  return list;
}

// Build the two shopkeepers (innkeeper + shopkeeper) and stamp wooden
// counters into their houses just inside the door. The keepers are
// stationary and stand one tile north of the door, facing south.
//
// Counter layout (door at bottom, north is up):
//     [WALL ... WALL]
//     [.  KEEPER  .]      ← keeper villager
//     [TABLE . TABLE]     ← counter flanking the entry aisle
//     [INN_DOOR]          ← player walks in here
function placeShopkeepers(mapObj) {
  const list = [];
  const m = mapObj.map;
  let id = 0;

  const setup = (door, role, kind, robe) => {
    if (!door) return;
    const r = door.r, c = door.c;
    // House interiors are a full row inside the door — (r-1, c) and the
    // flanking tiles are FLOOR. Stamp counter to either side of the entry
    // aisle so the keeper's standing tile is clear.
    if (r - 1 >= 0 && c - 1 >= 0 && m[r - 1][c - 1] === T.FLOOR) m[r - 1][c - 1] = T.TABLE;
    if (r - 1 >= 0 && c + 1 < MCOLS && m[r - 1][c + 1] === T.FLOOR) m[r - 1][c + 1] = T.TABLE;
    list.push({
      id: id++,
      kind, role,
      robe, hair: '#3a2010', skin: '#e8c8a0',
      size: 1,
      x: c, y: r - 2,
      renderX: c, renderY: r - 2,
      stationary: true,
      dir: { x: 0, y: 1 },        // facing south toward the door
      timer: 0, stepMs: 9999,
    });
  };

  setup(mapObj.innDoor,   'inn',   'Innkeeper',  '#aa3344');
  setup(mapObj.storeDoor, 'store', 'Shopkeeper', '#226633');
  setup(mapObj.herbDoor,  'herb',  'Herbalist',  '#5a8a3a');
  setup(mapObj.smithDoor, 'smith', 'Blacksmith', '#3a4a6a');
  return list;
}

// Called on every map enter. Mirrors spawnEnemiesForMap: restore from
// savedVillagers if present, otherwise generate fresh (only if the map is an
// activated village), otherwise empty.
function spawnVillagersForMap(mid) {
  const rm = worldMaps[mid];
  if (!rm) { villagers = []; return; }
  if (rm.savedVillagers) {
    villagers = rm.savedVillagers.map(v => ({ ...v, renderX: v.x, renderY: v.y }));
    return;
  }
  if (rm.type === 'village' && rm.activated) {
    villagers = generateVillagers(rm);
    rm.savedVillagers = villagers.map(v => ({ ...v }));
  } else {
    villagers = [];
  }
}

function saveVillagersToMap(mid) {
  if (worldMaps[mid]) {
    worldMaps[mid].savedVillagers = villagers.map(v => ({ ...v }));
  }
}

// Per-frame AI step. Each villager keeps a heading and steps on its own
// timer; sometimes it pauses, sometimes it turns. Render position smoothly
// interpolates toward the integer tile position so motion looks continuous.
// Stationary keepers skip the wander entirely.
function stepVillagers(dt, map) {
  const lerpK = 1 - Math.exp(-(dt || 16) / 130);
  for (const v of villagers) {
    v.renderX += (v.x - v.renderX) * lerpK;
    v.renderY += (v.y - v.renderY) * lerpK;
    if (Math.abs(v.renderX - v.x) < 0.005) v.renderX = v.x;
    if (Math.abs(v.renderY - v.y) < 0.005) v.renderY = v.y;

    if (v.stationary) continue;

    v.timer -= dt;
    if (v.timer > 0) continue;

    // Occasionally idle for a beat (chatting / looking around).
    if (Math.random() < 0.18) {
      v.timer = 600 + Math.random() * 1200;
      continue;
    }
    // 35% chance to pick a new heading; otherwise keep walking the same way.
    if (Math.random() < 0.35) {
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      v.dir = dirs[Math.floor(Math.random() * 4)];
    }

    const nx = v.x + v.dir.x, ny = v.y + v.dir.y;
    const inBounds = nx >= 0 && nx < MCOLS && ny >= 0 && ny < MROWS;
    const tile = inBounds ? map[ny][nx] : null;
    const otherV = villagers.some(o => o !== v && o.x === nx && o.y === ny);
    const blocked = !inBounds || isSolid(map, nx, ny) || otherV ||
                    isVillagerOffLimits(tile);

    if (!blocked) {
      v.x = nx; v.y = ny;
    } else {
      // Hit a wall / shop door / neighbour — turn for next tick.
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      v.dir = dirs[Math.floor(Math.random() * 4)];
    }
    v.timer = v.stepMs;
  }
}

// ─── Sprite ───────────────────────────────────────────────────────────────────
// Simple top-down humanoid: hooded robe + head + tiny boots. Each "kind" only
// varies in robe / hair / skin colour and slight scale (children are smaller).
function drawVillager(v, ts) {
  const sx = (v.renderX - camC) * ts, sy = (v.renderY - camR) * ts;
  const s = ts * v.size;
  const ox = (ts - s) / 2, oy = (ts - s) / 2;
  const phase = (v.id || 0) * 1.3;
  const bob = Math.sin(Date.now() / 220 + phase) * 1.2;
  const px = sx + ox, py = sy + oy + bob;
  const cx = sx + ts / 2;

  ctx.save();

  // Shadow at feet — anchored to the un-bobbed position.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(sx + ts / 2, sy + ts * 0.93, ts * 0.26 * v.size, ts * 0.06 * v.size, 0, 0, Math.PI * 2);
  ctx.fill();

  // Boots (under the robe hem)
  ctx.fillStyle = '#3a1c08';
  ctx.fillRect(px + s * 0.32, py + s * 0.86, s * 0.12, s * 0.12);
  ctx.fillRect(px + s * 0.56, py + s * 0.86, s * 0.12, s * 0.12);

  // Robe body
  ctx.fillStyle = v.robe;
  ctx.fillRect(px + s * 0.24, py + s * 0.42, s * 0.52, s * 0.48);
  // Shadow side
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(px + s * 0.50, py + s * 0.42, s * 0.26, s * 0.48);
  // Hem darker stripe
  ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
  ctx.fillRect(px + s * 0.24, py + s * 0.84, s * 0.52, s * 0.04);
  // Belt
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(px + s * 0.24, py + s * 0.62, s * 0.52, s * 0.05);
  ctx.fillStyle = '#cc9944';
  ctx.fillRect(px + s * 0.46, py + s * 0.62, s * 0.08, s * 0.05);

  // Sleeves / arms
  ctx.fillStyle = v.robe;
  ctx.fillRect(px + s * 0.14, py + s * 0.46, s * 0.12, s * 0.30);
  ctx.fillRect(px + s * 0.74, py + s * 0.46, s * 0.12, s * 0.30);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(px + s * 0.74, py + s * 0.46, s * 0.12, s * 0.30);
  // Hands
  ctx.fillStyle = v.skin;
  ctx.fillRect(px + s * 0.14, py + s * 0.74, s * 0.12, s * 0.08);
  ctx.fillRect(px + s * 0.74, py + s * 0.74, s * 0.12, s * 0.08);

  // Head
  const headY = py + s * 0.28;
  ctx.fillStyle = v.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, s * 0.19, 0, Math.PI * 2); ctx.fill();
  // Face shading
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.arc(cx + s * 0.04, headY + s * 0.02, s * 0.16, 0, Math.PI * 2); ctx.fill();
  // Hair cap (top half of head)
  ctx.fillStyle = v.hair;
  ctx.beginPath();
  ctx.arc(cx, headY - s * 0.04, s * 0.19, Math.PI, 0); ctx.fill();
  // A small fringe across the brow so the hair doesn't look like a perfect dome
  ctx.fillRect(px + s * 0.34, py + s * 0.22, s * 0.32, s * 0.04);

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(px + s * 0.39, py + s * 0.29, s * 0.06, s * 0.04);
  ctx.fillRect(px + s * 0.55, py + s * 0.29, s * 0.06, s * 0.04);
  // Eye glint
  ctx.fillStyle = '#fff';
  ctx.fillRect(px + s * 0.41, py + s * 0.30, s * 0.015, s * 0.015);
  ctx.fillRect(px + s * 0.57, py + s * 0.30, s * 0.015, s * 0.015);
  // Smile
  ctx.strokeStyle = '#5a2010';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + s * 0.43, py + s * 0.38);
  ctx.quadraticCurveTo(cx, py + s * 0.41, px + s * 0.57, py + s * 0.38);
  ctx.stroke();

  // Shopkeepers wear an apron — a lighter strip over the front of the robe
  // so they're easy to pick out across the counter.
  if (v.role) {
    ctx.fillStyle = '#f0e8d8';
    ctx.fillRect(px + s * 0.32, py + s * 0.46, s * 0.36, s * 0.42);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(px + s * 0.50, py + s * 0.46, s * 0.18, s * 0.42);
    // The Herbalist tucks a sprig of green herb into the apron.
    if (v.role === 'herb') {
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(px + s * 0.46, py + s * 0.52, s * 0.08, s * 0.18);
      ctx.fillStyle = '#5aaa4a';
      ctx.fillRect(px + s * 0.40, py + s * 0.54, s * 0.06, s * 0.06);
      ctx.fillRect(px + s * 0.54, py + s * 0.54, s * 0.06, s * 0.06);
    }
    // The Blacksmith wears a dark leather apron with a steel hammer tucked in.
    if (v.role === 'smith') {
      // Darken the apron to soot-stained leather
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(px + s * 0.32, py + s * 0.46, s * 0.36, s * 0.42);
      // Hammer: grey steel head + brown handle across the chest
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(px + s * 0.40, py + s * 0.52, s * 0.04, s * 0.22);
      ctx.fillStyle = '#9a9aa2';
      ctx.fillRect(px + s * 0.34, py + s * 0.50, s * 0.16, s * 0.07);
    }
  }

  ctx.restore();
}

// ─── Interaction ──────────────────────────────────────────────────────────────
// Called from the keydown handler when the player presses space inside an
// active village. Looks for any villager in the 8 surrounding tiles; the
// keepers open their modal, anyone else delivers a flavor line.
function tryVillagerInteraction() {
  if (!villagers || !villagers.length) return false;
  // Prefer the keepers when ties happen (they should always win adjacency).
  const nearby = villagers
    .filter(v => Math.abs(v.x - player.x) <= 1 && Math.abs(v.y - player.y) <= 1)
    .sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0));
  if (!nearby.length) return false;
  const v = nearby[0];

  if (v.role === 'inn'   && typeof openInnModal        === 'function') { openInnModal();        return true; }
  if (v.role === 'store' && typeof openStoreModal      === 'function') { openStoreModal();      return true; }
  if (v.role === 'herb'  && typeof openHerbalistModal  === 'function') { openHerbalistModal();  return true; }
  if (v.role === 'smith' && typeof openBlacksmithModal === 'function') { openBlacksmithModal(); return true; }

  const lines = VILLAGER_CHAT[v.kind] || ["…"];
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (typeof showMsg === 'function') showMsg(`💬 ${v.kind}: "${line}"`, 2500);
  return true;
}
