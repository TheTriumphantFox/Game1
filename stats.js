// ─── Character / stats page ───────────────────────────────────────────────────
// A full-screen "character sheet" opened from the radial MENU ring (see radial.js
// — the same launcher slot as the Drops ledger and God Mode). It shows a static
// painted portrait of the hero on the left and a complete readout of everything
// about the player on the right: vitals (HP / temp HP / level / XP), offense
// (sword / bow / bomb damage), defense (physical armor + the worn elemental
// armor's block %), inventory tallies, and the full owned arsenal of elemental
// swords & armors with their upgrade levels.
//
// The portrait is a painted illustration (hero-portrait.png) drawn into the
// canvas and shown as-is — a static image with no element FX overlaid. If the
// artwork ever fails to load, the page falls back to a hand-drawn vector
// portrait (buildHeroPortrait) so it is never blank. No WebGL / external
// libraries — just 2-D canvas, so it runs on file:// like the rest of the game.
//
// `statsPageOpen` gates gameplay input and freezes the world (see main.js),
// matching the shop / portal / ledger modal pattern.

let statsPageOpen = false;
let statsRAF = null;          // requestAnimationFrame handle for the element FX

// ─── Portrait artwork ─────────────────────────────────────────────────────────
// The character-sheet portrait is a painted illustration (hero-portrait.png) drawn
// into the stats canvas. It loads once, lazily; while it's loading — or if it ever
// fails — we fall back to the hand-drawn procedural portrait below so the page is
// never blank. The image is shown as-is (no element FX overlaid).
const STATS_PORTRAIT_SRC = 'hero-portrait.png';
let statsHeroImg = null;             // HTMLImageElement, once created
let statsHeroImgState = 'idle';      // 'idle' | 'loading' | 'ready' | 'error'

function ensureStatsHeroImg() {
  if (statsHeroImg) return;
  statsHeroImg = new Image();
  statsHeroImgState = 'loading';
  statsHeroImg.onload  = () => { statsHeroImgState = 'ready';  if (statsPageOpen) drawStatsModel(); };
  statsHeroImg.onerror = () => { statsHeroImgState = 'error';  if (statsPageOpen) drawStatsModel(); };
  statsHeroImg.src = STATS_PORTRAIT_SRC;
}

function openStatsPage() {
  // Reached through the radial menu — close it first so overlays don't stack.
  if (typeof closeRadialMenu === 'function') closeRadialMenu();
  statsPageOpen = true;
  if (typeof clearAllKeys === 'function') clearAllKeys();
  ensureStatsHeroImg();          // begin loading the portrait art (no-op if cached)
  document.getElementById('stats-modal-overlay').classList.add('open');
  renderStatsContents();
  startStatsModel();
}

function closeStatsPage() {
  statsPageOpen = false;
  document.getElementById('stats-modal-overlay').classList.remove('open');
  if (statsRAF !== null) { cancelAnimationFrame(statsRAF); statsRAF = null; }
}

// ─── Stat readout ─────────────────────────────────────────────────────────────
// A tiny row builder so the readout reads like a character sheet: bold amber
// value, muted label.
function statRow(label, value, accent) {
  const col = accent || '#ffcc44';
  return `<div class="stats-row">
    <span class="stats-label">${label}</span>
    <span class="stats-val" style="color:${col}">${value}</span>
  </div>`;
}

function statsGroup(title, rows) {
  if (!rows) return '';
  return `<div class="stats-group"><div class="stats-group-title">${title}</div>${rows}</div>`;
}

function renderStatsContents() {
  const p = player;

  // ── Derived offense ────────────────────────────────────────────────────────
  const lv = p.swordLevel || 1;
  let swordDmg = `${lv}–${lv + 2}`;
  if (p.activeSwordElement) {
    const el = SWORD_ELEMENTS[p.activeSwordElement];
    const b = elementalSwordBonus(p.activeSwordElement);
    if (el) swordDmg += ` +${el.icon}${1 + b}–${4 + b}`;
  }
  const bowLv = p.bowLevel || 1;
  let bowDmg = String(bowLv * 2 + 1);
  if (p.activeArrowElement) {
    const el = SWORD_ELEMENTS[p.activeArrowElement];
    if (el) bowDmg += ` +${el.icon}1–4`;
  }
  const bombDmg = 7 + (p.swordLevel || 1);

  // ── Derived defense ────────────────────────────────────────────────────────
  // While an elemental armor is worn it REPLACES the flat armor value (elements.js).
  const activeArmor = p.activeArmorElement;
  const physArmor = activeArmor ? elementalArmorPhys(activeArmor) : (p.armor || 0);
  const armorEl = activeArmor ? SWORD_ELEMENTS[activeArmor] : null;

  // ── Inventory tallies ──────────────────────────────────────────────────────
  const sum = o => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);
  const arrowsTotal  = sum(p.arrows);
  const regionPotions = sum(p.regionPotions);
  const elixirTotal  = sum(p.elixirs);
  const potionsTotal = (p.potions || 0) + regionPotions;

  // ── Weapon / equipment summary ─────────────────────────────────────────────
  const weaponName = p.weapon === 'bow' ? '🏹 Bow'
                   : p.weapon === 'bomb' ? '💣 Bomb'
                   : '⚔️ Sword';
  const equippedSword = p.activeSwordElement
    ? `${SWORD_ELEMENTS[p.activeSwordElement].icon} ${SWORD_ELEMENTS[p.activeSwordElement].label} Sword`
    : 'Base Sword';
  const equippedArmor = armorEl
    ? `${armorEl.icon} ${armorEl.label} Armor`
    : (p.armor > 0 ? 'Plain Armor' : 'None');

  // ── Vitals ─────────────────────────────────────────────────────────────────
  const hpColor = p.hp <= 3 ? '#ff5a5a' : p.hp < p.maxHp ? '#ffcc44' : '#7bd67b';
  let vitals = '';
  vitals += statRow('❤️ Health', `${p.hp} / ${p.maxHp}`, hpColor);
  if ((p.tempHp || 0) > 0) vitals += statRow('💚 Temp HP', `+${p.tempHp}`, '#7bd67b');
  vitals += statRow('⚔️ Level', String(p.level || 1), '#aef');
  vitals += statRow('✨ XP', `${p.xp || 0} / ${p.xpNext || 0}`, '#88aaff');
  vitals += statRow('💰 Rubies', String(p.rubies || 0), '#ffcc44');
  if (p.immunityElement && p.immunityTimer > 0) {
    const el = SWORD_ELEMENTS[p.immunityElement];
    vitals += statRow(`${el ? el.icon : '⚗️'} Immunity`,
      `${el ? el.label : p.immunityElement} · ${Math.ceil(p.immunityTimer / 1000)}s`, '#c6ff5a');
  }

  // ── Offense ────────────────────────────────────────────────────────────────
  let offense = '';
  offense += statRow('Equipped', weaponName, '#fff');
  offense += statRow('⚔️ Sword Dmg', swordDmg, '#ff8a6a');
  offense += statRow('🏹 Bow Dmg', bowDmg, '#ff8a6a');
  offense += statRow('💣 Bomb Dmg', String(bombDmg), '#ff8a6a');

  // ── Defense ────────────────────────────────────────────────────────────────
  let defense = '';
  defense += statRow('🛡 Armor Worn', equippedArmor, '#fff');
  defense += statRow('🛡 Physical Def', `+${physArmor}`, '#8ad6ff');
  if (armorEl) {
    defense += statRow(`${armorEl.icon} ${armorEl.label} Block`,
      `${elementalArmorBlockPct(activeArmor)}%`, '#8ad6ff');
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  let inv = '';
  inv += statRow('🧪 Potions', String(potionsTotal), '#ff9ac4');
  inv += statRow('⚗️ Elixirs', String(elixirTotal), '#c6ff5a');
  inv += statRow('➳ Arrows', String(arrowsTotal), '#cde');
  inv += statRow('💣 Bombs', String(p.bombs || 0), '#cde');

  // ── Progression / renown ───────────────────────────────────────────────────
  let renown = '';
  renown += statRow('🗺️ Maps Explored', String(typeof mapsVisited !== 'undefined' ? mapsVisited : '—'), '#8fbf8f');
  renown += statRow('🏆 Boss Slain', p.defeatedBoss ? 'Yes' : 'Not yet', p.defeatedBoss ? '#7bd67b' : '#889');
  renown += statRow('⚔️ Guild Member', p.guildCard ? 'Inducted' : 'No', p.guildCard ? '#7bd67b' : '#889');
  const questsDone = (typeof totalQuestsDone === 'function') ? totalQuestsDone(p) : 0;
  renown += statRow('📜 Quests Done', String(questsDone), '#8fbf8f');
  renown += statRow('💀 Deaths', String(p.deaths || 0), (p.deaths || 0) > 0 ? '#ff5a5a' : '#889');

  // ── Arsenal: owned elemental swords & armors with upgrade levels ────────────
  const gearChips = (ids, levelOf, worn, wrap) => {
    if (!ids || !ids.length) return `<div class="stats-empty">None forged yet.</div>`;
    return `<div class="stats-chips">` + ids.map(id => {
      const el = SWORD_ELEMENTS[id];
      if (!el) return '';
      const lvl = levelOf(id);
      const isWorn = id === worn;
      return `<span class="stats-chip${isWorn ? ' stats-chip-worn' : ''}"
        style="--chip:${el.color}">${el.icon} ${el.label} <b>Lv${lvl}</b></span>`;
    }).join('') + `</div>`;
  };
  const swordArsenal = gearChips(p.swordElements, swordUpgradeLevel, p.activeSwordElement);
  const armorArsenal = gearChips(p.armorElements, armorUpgradeLevel, p.activeArmorElement);
  const unlockedAbilities = SHRINE_REWARDS.filter(r =>
    r.kind === 'ability' && p.abilities && p.abilities[r.key]);
  const abilityArsenal = unlockedAbilities.length
    ? `<div class="stats-chips">${unlockedAbilities.map(r =>
        `<span class="stats-chip" style="--chip:#9f7bd8">${r.icon} ${r.label} <b>Unlocked</b></span>`
      ).join('')}</div>`
    : `<div class="stats-empty">No shrine abilities unlocked yet.</div>`;

  document.getElementById('stats-modal').innerHTML = `
    <h2>🧍 Character</h2>
    <div class="stats-layout">
      <div class="stats-model">
        <canvas id="stats-canvas"></canvas>
        <div class="stats-name">${p.heroName || 'The Hero'}</div>
        <div class="stats-sub">Level ${p.level || 1} Adventurer</div>
      </div>
      <div class="stats-sheet">
        ${statsGroup('Vitals', vitals)}
        ${statsGroup('Offense', offense)}
        ${statsGroup('Defense', defense)}
        ${statsGroup('Inventory', inv)}
        ${statsGroup('Renown', renown)}
      </div>
    </div>
    <div class="stats-arsenal">
      <div class="stats-group-title">⚔️ Elemental Swords</div>
      ${swordArsenal}
      <div class="stats-group-title" style="margin-top:10px">🛡 Elemental Armor</div>
      ${armorArsenal}
      <div class="stats-group-title" style="margin-top:10px">✦ Shrine Abilities</div>
      ${abilityArsenal}
    </div>
    <button class="shop-close" onclick="closeStatsPage()">✕ Close</button>
  `;
}

// ─── Static hero portrait ─────────────────────────────────────────────────────
// The hero is painted once as a detailed 2-D illustration into an offscreen
// bitmap, then composited every frame between the animated element FX layers:
//   backdrop → pedestal → armor aura FX → hero bitmap → sword FX → vignette
// The figure keeps the combat guard: staggered bent legs, round shield raised
// across the chest, sword drawn and angled up ready to strike.
//
// All shapes live in a fixed 200×260 "view box" that is scaled to fit the
// canvas. Shapes are smooth closed curves through control points (duplicate a
// point to sharpen a corner), filled flat, cel-shaded with clipped darker /
// lighter patches, and inked with a dark contour line.

const STATS_VIEW_W = 200, STATS_VIEW_H = 260;
let statsHeroCache = null;   // { key, cv } — cached portrait bitmap

// Shade a hex colour by a 0..~1.5 factor (ambient + diffuse), returning rgb().
function statsShade(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const k = c => Math.max(0, Math.min(255, Math.round(c * f)));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

// Paint the full hero illustration into canvas `cv` (backing store already
// sized), using device-pixel-ratio `dpr` and view→canvas transform (s, ox, oy).
function buildHeroPortrait(cv, dpr, s, ox, oy) {
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.translate(ox, oy);
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // ── Palette (muted, earthy — key-art tones) ──
  const OUT = '#241609';
  const armorEl = player.activeArmorElement ? SWORD_ELEMENTS[player.activeArmorElement] : null;
  const swordEl = player.activeSwordElement ? SWORD_ELEMENTS[player.activeSwordElement] : null;
  const skin  = '#eac394', skinS = '#c79a63';
  const tunic = armorEl ? armorEl.color : '#5c6e44';
  const tunS  = statsShade(tunic, 0.68), tunL = statsShade(tunic, 1.18);
  const white = '#e9e5d6', whiteS = '#bfb8a1';
  const mail  = '#8f854f', mailS = '#655d2c';
  const hair  = '#c9973a', hairS = '#966d20';
  const capC  = '#42602c', capS = '#2e451c';
  const boot  = '#6f4b26', bootS = '#4a2f13';
  const pants = '#d6c9a4', pantsS = '#ab9a70';
  const strap = '#7a5227', strapS = '#54371a';
  const gold  = '#d1a943', goldS = '#9c7a24';
  const wood  = '#7a5426', woodS = '#573a17';
  const steel = '#aab2bd';
  const red   = '#a93122', redS = '#711f16';
  const gaunt = '#a84a2f';
  const blade = swordEl ? swordEl.color : '#ccd5df';
  const eyeC  = '#3f6fae';

  // ── Shape helpers ──
  // Smooth closed curve through the midpoints of consecutive control points.
  function poly(pts) {
    g.beginPath();
    const n = pts.length;
    g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    g.closePath();
  }
  // Fill + optional clipped cel-shade patches + ink outline.
  function paint(pts, fill, o = {}) {
    poly(pts);
    g.fillStyle = fill;
    g.fill();
    if (o.shade) {
      g.save(); poly(pts); g.clip();
      for (const [sp, sc] of o.shade) { poly(sp); g.fillStyle = sc; g.fill(); }
      g.restore();
    }
    if (o.line !== false) {
      poly(pts);
      g.strokeStyle = o.lc || OUT;
      g.lineWidth = o.lw || 1.3;
      g.stroke();
    }
  }
  // Smooth open stroked line through control points.
  function line(pts, col, w) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    const last = pts[pts.length - 1];
    g.lineTo(last[0], last[1]);
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  // Fill a region with a chainmail ring texture.
  function chainmail(pts, o = {}) {
    paint(pts, mail, { line: false });
    g.save(); poly(pts); g.clip();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    g.strokeStyle = mailS; g.lineWidth = 0.5;
    for (let y = y0, row = 0; y < y1 + 2; y += 2.1, row++) {
      for (let x = x0 + (row % 2) * 1.05; x < x1 + 2; x += 2.1) {
        g.beginPath(); g.arc(x, y, 1.0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
      }
    }
    g.restore();
    poly(pts); g.strokeStyle = OUT; g.lineWidth = o.lw || 1.2; g.stroke();
  }

  // ══ 1. Cap tail — flows out behind the head to the right ══
  paint([[110, 31], [124, 35], [135, 46], [139, 58], [139, 63], [139, 63], [132, 64], [125, 53], [115, 42], [106, 35]],
    capC, { shade: [[[[124, 46], [138, 59], [138, 63], [131, 63], [122, 52]], capS]] });

  // ══ 2. Legs (staggered guard: front leg bent forward, back leg extended,
  //      heel raised) — cream leggings into tall boots ══
  // Back (viewer-right) leg
  paint([[106, 152], [114, 155], [121, 173], [113, 178], [104, 168], [103, 156]], pants,
    { shade: [[[[112, 158], [120, 172], [114, 177], [108, 166]], pantsS]] });
  paint([[112, 174], [125, 178], [131, 192], [134, 204], [140, 222], [139, 229], [139, 229], [131, 228], [126, 212], [119, 196], [109, 184]],
    boot, { shade: [[[[124, 182], [132, 198], [138, 222], [138, 228], [131, 227], [124, 206], [118, 188]], bootS]] });
  paint([[109, 171], [126, 175], [124, 183], [108, 179]], bootS, { lw: 1.1 });   // cuff
  // Front (viewer-left) leg
  paint([[87, 152], [95, 155], [91, 174], [82, 178], [78, 170], [83, 158]], pants,
    { shade: [[[[90, 158], [88, 172], [82, 176], [82, 164]], pantsS]] });
  paint([[72, 176], [88, 180], [85, 198], [82, 212], [78, 220], [66, 228], [57, 227], [56, 222], [56, 222], [65, 214], [69, 198], [70, 184]],
    boot, { shade: [[[[82, 186], [84, 200], [79, 216], [70, 224], [62, 226], [70, 214], [74, 198], [75, 186]], bootS]] });
  paint([[70, 173], [89, 177], [87, 185], [69, 181]], bootS, { lw: 1.1 });       // cuff
  line([[58, 224], [70, 224], [78, 217]], OUT, 1);                               // sole
  line([[68, 206], [82, 209]], strapS, 2.2);                                     // ankle strap
  g.fillStyle = gold; g.fillRect(74, 205.6, 2.6, 3.6);                           // strap buckle

  // ══ 3. Chainmail skirt hem peeking under the tunic ══
  chainmail([[80, 148], [122, 148], [118, 165], [101, 168], [84, 165]]);

  // ══ 4. Tunic — torso + flared skirt, cinched at the belt ══
  const tunicPts = [[80, 79], [76, 90], [79, 104], [81, 116], [78, 128], [74, 142], [72, 152], [80, 157], [92, 159], [101, 161], [110, 159], [121, 156], [127, 150], [124, 140], [121, 128], [119, 116], [121, 104], [124, 90], [121, 79], [112, 74], [101, 76], [90, 74]];
  paint(tunicPts, tunic, {
    lw: 1.5,
    shade: [
      // right-hand core shadow
      [[[110, 78], [122, 79], [124, 92], [118, 118], [124, 144], [118, 156], [110, 152], [115, 120], [111, 96]], tunS],
      // skirt shadow under the belt
      [[[78, 132], [122, 132], [117, 141], [83, 141]], statsShade(tunic, 0.85)],
      // chest highlight toward the light
      [[[84, 84], [97, 79], [99, 100], [88, 112], [82, 100]], tunL],
    ],
  });
  // Skirt fold creases
  line([[90, 134], [88, 148], [89, 156]], tunS, 1);
  line([[101, 138], [101, 150], [101, 159]], tunS, 1);
  line([[112, 134], [114, 146], [112, 154]], tunS, 1);

  // ══ 5. Collar: chainmail band + white undershirt V + neck ══
  chainmail([[92, 68], [110, 68], [109, 75], [93, 75]], { lw: 1.1 });
  paint([[94, 73], [108, 73], [101, 83]], white, { shade: [[[[101, 73], [108, 73], [101, 83]], whiteS]], lw: 1.1 });
  paint([[96, 62], [106, 62], [105, 73], [97, 73]], skin, { shade: [[[[96, 62], [106, 62], [105, 68], [97, 68]], skinS]], lw: 1.1 });

  // ══ 6. Baldric across the chest, waist belt + buckle, slung hip belt + pouch ══
  paint([[113, 76], [120, 79], [90, 128], [83, 124]], strap,
    { shade: [[[[116, 77], [120, 79], [104, 105], [100, 103]], strapS]], lw: 1.2 });
  paint([[112, 79], [119, 82], [116, 88], [109, 85]], strapS, { lw: 1.1 });      // shoulder pad
  paint([[79, 127], [122, 138], [121, 145], [78, 134]], strap, { lw: 1.2 });     // slung hip belt
  paint([[110, 134], [121, 137], [119, 149], [108, 146]], strapS, { lw: 1.2 }); // belt pouch
  line([[109, 140], [120, 143]], OUT, 0.9);                                     // pouch flap
  paint([[77, 120], [101, 124], [124, 120], [124, 130], [101, 134], [77, 130]], '#43301a',
    { shade: [[[[101, 122], [124, 120], [124, 130], [101, 133]], '#2d1f0e']], lw: 1.3 });
  paint([[95, 122], [107, 122], [107, 133], [95, 133]], gold, { shade: [[[[101, 122], [107, 122], [107, 133], [101, 133]], goldS]], lw: 1.2 });
  g.fillStyle = '#2d1f0e'; g.fillRect(98.4, 125.4, 5.2, 4.6);                    // buckle slot

  // ══ 7. Sword arm (viewer-right): shoulder → elbow back → forearm out ══
  paint([[118, 77], [128, 79], [132, 88], [127, 95], [119, 92], [116, 84]], tunic,
    { shade: [[[[125, 79], [131, 86], [128, 94], [122, 90]], tunS]], lw: 1.3 }); // shoulder
  paint([[125, 87], [134, 89], [143, 102], [137, 107], [128, 96], [123, 93]], white,
    { shade: [[[[133, 92], [142, 102], [137, 106], [130, 97]], whiteS]], lw: 1.2 });
  paint([[136, 103], [144, 107], [151, 117], [146, 122], [138, 112], [133, 108]], white,
    { shade: [[[[143, 108], [150, 117], [146, 121], [140, 113]], whiteS]], lw: 1.2 });
  paint([[142, 110], [151, 116], [148, 123], [139, 117]], strap, { lw: 1.2 });   // bracer
  line([[142, 113], [149, 118]], strapS, 1);

  // ══ 8. The sword: pommel, wrapped grip, winged cross-guard, long blade ══
  g.beginPath(); g.arc(146, 131, 2.8, 0, Math.PI * 2);
  g.fillStyle = gold; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.1; g.stroke();
  paint([[146, 129], [150, 122], [154, 118], [157, 121], [153, 126], [149, 132]], '#3f3050', { lw: 1.1 });
  line([[149, 126], [153, 122]], '#5d4a78', 0.8);                               // grip wrap
  paint([[150, 111], [163, 116], [165, 121], [151, 116], [148, 114]], gold,
    { shade: [[[[157, 114], [165, 120], [158, 118]], goldS]], lw: 1.2 });        // cross-guard
  paint([[154.6, 110.6], [160.4, 113.2], [184.6, 46.6], [184, 45], [184, 45], [183.2, 45.2]], blade,
    { lw: 1.2, shade: [[[[157.5, 112], [160.4, 113.2], [184.6, 46.6], [184, 45]], statsShade(blade, 0.8)]] });
  line([[157.5, 111.5], [183.8, 46]], statsShade(blade, 0.65), 0.7);            // centre ridge
  line([[155.4, 110.6], [183.4, 45.6]], 'rgba(255,255,255,0.75)', 0.6);         // edge glint
  // Fist over the grip
  paint([[148, 118], [155, 119], [157, 124], [154, 129], [148, 128], [145, 123]], skin,
    { shade: [[[[152, 120], [157, 124], [154, 128], [149, 126]], skinS]], lw: 1.2 });
  line([[148, 122], [154, 123.5]], skinS, 0.8);
  line([[148, 125], [153, 126.3]], skinS, 0.8);

  // ══ 9. Shield arm + the ornate red gauntlet (mostly behind the shield) ══
  paint([[75, 79], [84, 81], [86, 91], [80, 98], [72, 94], [71, 84]], tunic,
    { shade: [[[[81, 82], [86, 90], [81, 97], [76, 92]], tunS]], lw: 1.3 });     // shoulder
  paint([[74, 92], [88, 96], [92, 106], [82, 108], [73, 101]], gaunt, { lw: 1.2 });

  // ══ 10. Round shield raised across the chest ══
  g.save();
  g.translate(86, 117);
  g.rotate(-0.09);
  // wood face
  g.beginPath(); g.ellipse(0, 0, 24, 27, 0, 0, Math.PI * 2);
  g.fillStyle = wood; g.fill();
  g.save(); g.clip();
  g.strokeStyle = woodS; g.lineWidth = 1;
  for (const px of [-9, 0, 9]) line([[px, -27], [px - 1, 0], [px, 27]], woodS, 1);
  g.beginPath(); g.ellipse(6, 4, 20, 24, 0, -Math.PI * 0.5, Math.PI * 0.5);      // right-side shadow
  g.ellipse(0, 0, 24, 27, 0, Math.PI * 0.5, -Math.PI * 0.5, true);
  g.fillStyle = 'rgba(35,20,8,0.30)'; g.fill();
  // red cross
  g.fillStyle = red;
  g.fillRect(-3.4, -21, 6.8, 42);
  g.fillRect(-19, -3.4, 38, 6.8);
  g.strokeStyle = redS; g.lineWidth = 0.8;
  g.strokeRect(-3.4, -21, 6.8, 42);
  g.strokeRect(-19, -3.4, 38, 6.8);
  g.restore();
  // steel rim + rivets
  g.beginPath(); g.ellipse(0, 0, 22.6, 25.6, 0, 0, Math.PI * 2);
  g.strokeStyle = steel; g.lineWidth = 3.2; g.stroke();
  g.beginPath(); g.ellipse(0, 0, 24, 27, 0, 0, Math.PI * 2);
  g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = '#6d7480';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.4;
    g.beginPath(); g.arc(Math.cos(a) * 22.6, Math.sin(a) * 25.6, 1.0, 0, Math.PI * 2); g.fill();
  }
  // gold boss
  g.beginPath(); g.arc(0, 0, 5.6, 0, Math.PI * 2);
  g.fillStyle = gold; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
  g.beginPath(); g.arc(-1.6, -1.8, 2.2, 0, Math.PI * 2);
  g.fillStyle = statsShade(gold, 1.35); g.fill();
  g.restore();

  // ══ 11. Head: face, jaw, long pointed ears ══
  paint([[101, 35], [112, 38], [116, 47], [113, 58], [106, 64.5], [100.5, 66], [95, 64.5], [89, 58], [86, 47], [90, 38]],
    skin, { lw: 1.4, shade: [[[[109, 42], [115, 48], [112, 58], [105, 64], [104, 56], [108, 48]], statsShade(skin, 0.9)]] });
  paint([[88, 48], [78, 42], [74, 43], [74, 43], [85, 55]], skin, { lw: 1.2 });  // left ear
  paint([[114, 48], [124, 42], [128, 43], [128, 43], [117, 55]], skin, { lw: 1.2 });
  line([[80, 45], [86, 50]], skinS, 0.9);                                       // inner ear
  line([[122, 45], [116, 50]], skinS, 0.9);

  // ══ 12. The face: knitted brows, narrow blue eyes, nose, set mouth ══
  const eye = (cx, flip) => {
    g.beginPath(); g.ellipse(cx, 52.8, 2.9, 2.1, flip * 0.12, 0, Math.PI * 2);
    g.fillStyle = '#f4f1e6'; g.fill();
    g.beginPath(); g.arc(cx + flip * 0.4, 52.9, 1.7, 0, Math.PI * 2);
    g.fillStyle = eyeC; g.fill();
    g.beginPath(); g.arc(cx + flip * 0.4, 53.0, 0.8, 0, Math.PI * 2);
    g.fillStyle = '#182231'; g.fill();
    g.beginPath(); g.arc(cx + flip * 0.9, 52.2, 0.5, 0, Math.PI * 2);
    g.fillStyle = '#fff'; g.fill();
    line([[cx - 2.9, 51.6], [cx, 50.6], [cx + 2.9, 51.6]], OUT, 1);             // upper lid
  };
  eye(93.2, 1);
  eye(108.8, -1);
  line([[89.5, 47.2], [96.8, 49.4]], '#54390f', 1.7);                           // brows, knitted in
  line([[112.5, 47.2], [105.2, 49.4]], '#54390f', 1.7);
  line([[100.8, 54.5], [99.9, 58.5], [100.8, 58.9]], skinS, 1);                 // nose
  line([[97.8, 61.6], [101, 61.9], [104.2, 61.3]], '#7c4a33', 1.2);             // firm mouth

  // ══ 13. Windswept blonde hair: fringe spikes below the cap + sideburns ══
  paint([[86, 50], [85, 40], [90, 31], [101, 28], [112, 31], [117, 40], [116, 50], [112, 43], [110, 48.5], [106, 42], [103, 48.5], [99, 42], [95, 48.5], [91, 42], [88, 48.5]],
    hair, { lw: 1.2, shade: [[[[104, 32], [114, 36], [116, 48], [110, 46], [105, 40]], hairS]] });
  paint([[86, 46], [83, 55], [84, 64], [87, 63], [88, 50]], hair, { lw: 1.1 }); // sideburn L
  paint([[116, 46], [119, 55], [118, 64], [115, 63], [114, 50]], hair, { lw: 1.1 });

  // ══ 14. Green cap: dome + snug brim over the fringe ══
  paint([[85, 41], [86, 33], [93, 26.5], [102, 25], [111, 28], [117, 35], [118, 41], [101, 37]],
    capC, { lw: 1.4, shade: [[[[107, 28], [116, 34], [118, 41], [108, 38]], capS]] });
  paint([[84, 39], [101, 35], [118, 39], [118, 45], [101, 41], [84, 45]], capC,
    { lw: 1.3, shade: [[[[101, 38], [118, 42], [118, 45], [101, 41]], capS]] });
  line([[96, 30], [93, 35]], capS, 1);                                          // cap fold

  return cv;
}

// Paint the portrait. When the artwork is ready it is drawn as-is; until then
// (or on load failure) it falls back to the hand-drawn procedural portrait.
function drawStatsModel() {
  const canvas = document.getElementById('stats-canvas');
  if (!canvas) return;
  const g2 = canvas.getContext('2d');

  // Size the backing store to the element for crisp, high-resolution output.
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 260;
  const cssH = canvas.clientHeight || 320;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  g2.clearRect(0, 0, cssW, cssH);

  if (statsHeroImgState === 'ready' && statsHeroImg) {
    drawStatsPortraitImage(g2, cssW, cssH);
  } else {
    drawStatsProceduralModel(g2, canvas, cssW, cssH, dpr);
  }
}

// ── Image portrait: the painted artwork, shown as-is (no element FX). The image
// is a tall 2:3 and the canvas is wider, so a plain crop would lose the raised
// sword or the tree shield. Instead we fill the frame edge-to-edge with a blurred
// COVER copy (no letterbox bars), then lay the whole figure over it CONTAINED so
// nothing is cropped. ──
function drawStatsPortraitImage(g2, cssW, cssH) {
  const iw = statsHeroImg.naturalWidth  || 1024;
  const ih = statsHeroImg.naturalHeight || 1536;

  // Blurred cover fill so the surrounding forest bleeds to the edges.
  const covS = Math.max(cssW / iw, cssH / ih);
  const covW = iw * covS, covH = ih * covS;
  g2.save();
  g2.filter = `blur(${Math.max(4, cssW * 0.03)}px)`;
  g2.drawImage(statsHeroImg, (cssW - covW) / 2, (cssH - covH) / 2, covW, covH);
  g2.restore();

  // The whole figure, contained and centred — sword tip through shield all visible.
  const conS = Math.min(cssW / iw, cssH / ih);
  const dw = iw * conS, dh = ih * conS;
  g2.drawImage(statsHeroImg, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
}

// ── Procedural fallback: the hand-drawn vector portrait (backdrop, pedestal,
// armor aura FX, cached hero bitmap, sword FX, vignette). Used until the artwork
// loads, or permanently if it fails to load. ──
function drawStatsProceduralModel(g2, canvas, cssW, cssH, dpr) {
  // ── Painterly backdrop: a cold, misty canyon fading to dark, with a soft
  // light halo behind the figure so the silhouette pops like painted key art. ──
  const bgGrad = g2.createLinearGradient(0, 0, 0, cssH);
  bgGrad.addColorStop(0,    '#252c3e');
  bgGrad.addColorStop(0.55, '#161b28');
  bgGrad.addColorStop(1,    '#0a0d14');
  g2.fillStyle = bgGrad;
  g2.fillRect(0, 0, cssW, cssH);
  const halo = g2.createRadialGradient(cssW / 2, cssH * 0.42, 8, cssW / 2, cssH * 0.42, cssH * 0.62);
  halo.addColorStop(0,    'rgba(125,145,180,0.28)');
  halo.addColorStop(0.55, 'rgba(95,115,150,0.10)');
  halo.addColorStop(1,    'rgba(0,0,0,0)');
  g2.fillStyle = halo;
  g2.fillRect(0, 0, cssW, cssH);

  // View box → canvas transform.
  const s = Math.min(cssW / STATS_VIEW_W, cssH / STATS_VIEW_H) * 0.98;
  const ox = (cssW - STATS_VIEW_W * s) / 2;
  const oy = (cssH - STATS_VIEW_H * s) / 2;
  const vx = (x, y) => [ox + x * s, oy + y * s];

  // ── Ground: stone pedestal (tinted by the worn armor) + contact shadow ──
  const armorEl = player.activeArmorElement ? SWORD_ELEMENTS[player.activeArmorElement] : null;
  const [pcx, pcy] = vx(100, 231);
  const ped = g2.createLinearGradient(pcx - s * 58, 0, pcx + s * 58, 0);
  ped.addColorStop(0, armorEl ? armorEl.color : '#3a4254');
  ped.addColorStop(0.5, '#10141d');
  ped.addColorStop(1, armorEl ? armorEl.color : '#3a4254');
  g2.fillStyle = ped;
  g2.beginPath();
  g2.ellipse(pcx, pcy, s * 58, s * 11, 0, 0, Math.PI * 2);
  g2.fill();
  g2.fillStyle = 'rgba(0,0,0,0.38)';
  g2.beginPath();
  g2.ellipse(pcx, pcy - s * 2, s * 48, s * 7, 0, 0, Math.PI * 2);
  g2.fill();

  // ── Worn elemental armor aura — the SAME gameplay FX (flame / mist / frost /
  // spark / …), animated behind the figure. drawElementFX renders to the global
  // `ctx`, so point it at our canvas for the call, then restore it. ──
  if (player.activeArmorElement && typeof drawElementFX === 'function') {
    const [ax, ay] = vx(101, 122);
    const _ctx = ctx; ctx = g2;
    drawElementFX(ax, ay, s * 82, player.activeArmorElement, 0.55, 1.7);
    ctx = _ctx;
  }

  // ── The static hero portrait (cached; rebuilt when size / gear changes) ──
  const key = `${canvas.width}x${canvas.height}|${player.activeArmorElement || ''}|${player.activeSwordElement || ''}`;
  if (!statsHeroCache || statsHeroCache.key !== key) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width;
    cv.height = canvas.height;
    buildHeroPortrait(cv, dpr, s, ox, oy);
    statsHeroCache = { key, cv };
  }
  g2.drawImage(statsHeroCache.cv, 0, 0, cssW, cssH);

  // ── Active elemental sword — the SAME gameplay FX over the blade, in front. ──
  if (player.activeSwordElement && typeof drawElementFX === 'function') {
    const [sx, sy] = vx(170, 80);
    const _ctx = ctx; ctx = g2;
    drawElementFX(sx, sy, s * 38, player.activeSwordElement, 0.85, 4.2);
    ctx = _ctx;
  }

  // ── Soft vignette so the corners fall away like a painted portrait. ──
  const vig = g2.createRadialGradient(cssW / 2, cssH * 0.46, cssH * 0.36, cssW / 2, cssH * 0.46, cssH * 0.82);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  g2.fillStyle = vig;
  g2.fillRect(0, 0, cssW, cssH);
}

function startStatsModel() {
  statsHeroCache = null;   // procedural-fallback cache may be stale
  if (statsRAF !== null) { cancelAnimationFrame(statsRAF); statsRAF = null; }
  // The portrait is a static image now, so a single paint is enough. If the
  // artwork is still loading, its onload handler repaints once it's ready.
  drawStatsModel();
}

// Close on click outside the modal (matches shop / ledger behaviour).
const _statsOverlay = document.getElementById('stats-modal-overlay');
if (_statsOverlay) {
  _statsOverlay.addEventListener('click', e => { if (e.target === _statsOverlay) closeStatsPage(); });
}
