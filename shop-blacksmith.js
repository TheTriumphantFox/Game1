// Blacksmith — ore/elemental armor & sword forging (+ shared economy helpers)
// Split out of shop.js (event-driven modal code; plain <script> globals). Shared
// economy helpers live in shop-blacksmith.js; all cross-file calls run at runtime.

// Elemental armor is now a regional reward: each Blacksmith forges only its own
// region's element. The cost scales with the region number N (forest=1 … mana=11):
//   • BLACKSMITH_ARMOR_RUBY_PER_REGION × N rubies, AND
//   • BLACKSMITH_ARMOR_PART_QTY of each of BLACKSMITH_ARMOR_PART_COUNT monster
//     parts dropped by that region's element-matched foes (see regionArmorPartTypes).
// Owned armor still sells back for a flat ruby value.
const ELEMENTAL_ARMOR_SELL_VALUE        = 100;
const BLACKSMITH_ARMOR_RUBY_PER_REGION = 100;  // ruby cost = this × region number N
const BLACKSMITH_ARMOR_PART_QTY         = 30;   // parts required of EACH demanded type
const BLACKSMITH_ARMOR_PART_COUNT       = 4;    // distinct enemy parts demanded

// An enemy's signature trophy drop type (its first non-potion/arrow drop), or
// null if it drops no trophy. Shared by regionArmorPartTypes.
function enemyTrophyType(type) {
  for (const d of ((typeof ENEMY_DROPS !== 'undefined' && ENEMY_DROPS[type]) || [])) {
    if (d.type === 'potion' || d.type === 'arrows') continue;
    return d.type;
  }
  return null;
}

// An enemy's rarer "prized" trophy — the LAST non-potion/arrow drop, which is the
// low-chance (5–10%) second trophy (see ENEMY_DROPS / the Rare enemy drops block in
// config.js). Returns null when the enemy drops only its primary trophy. Used by the
// SWORD forge (regionSwordPartTypes), which demands these rare parts at half quantity.
function enemyRareTrophyType(type) {
  const drops = (typeof ENEMY_DROPS !== 'undefined' && ENEMY_DROPS[type]) || [];
  let rare = null;
  for (const d of drops) {
    if (d.type === 'potion' || d.type === 'arrows') continue;
    if (rare === null) { rare = d.type; continue; }   // skip the primary, keep scanning
    rare = d.type;                                     // last trophy wins → the prized one
  }
  // Only the primary was found (no distinct prized drop) → no rare trophy.
  return rare === enemyTrophyType(type) ? null : rare;
}

// Is this trophy type any enemy's rare/prized drop? Rare parts are demanded at half
// quantity by the sword forge (see swordPartQty).
function isRareTrophy(trophyType) {
  if (typeof ENEMY_DROPS === 'undefined') return false;
  for (const type in ENEMY_DROPS) {
    if (enemyRareTrophyType(type) === trophyType) return true;
  }
  return false;
}

// How many of a given trophy the sword forge demands: the standard part quantity,
// HALVED (rounded up) when it's a rare/prized drop.
function swordPartQty(trophyType) {
  return isRareTrophy(trophyType)
    ? Math.ceil(BLACKSMITH_ARMOR_PART_QTY / 2)
    : BLACKSMITH_ARMOR_PART_QTY;
}

// The trophy drop types the Blacksmith demands for this region's elemental armor:
// the spoils of up to BLACKSMITH_ARMOR_PART_COUNT enemies whose attacks match the
// region's element, topped up from the rest of the region's pool when fewer than
// that many are element-tagged (e.g. Earth has only 3). Empty for the elementless
// forest, which therefore forges no elemental armor.
function regionArmorPartTypes(regionIdx, regionId) {
  if (!SWORD_ELEMENTS[regionId]) return [];
  const pool = (typeof ENEMY_POOLS !== 'undefined' && ENEMY_POOLS[regionIdx]) || [];
  const matched = [], rest = [];
  for (const type of pool) {
    const trophy = enemyTrophyType(type);
    if (!trophy) continue;
    const def = (typeof DND_ENEMIES !== 'undefined') ? DND_ENEMIES[type] : null;
    (def && def.element === regionId ? matched : rest).push(trophy);
  }
  const out = [];
  for (const t of matched.concat(rest)) {
    if (!out.includes(t)) out.push(t);
    if (out.length >= BLACKSMITH_ARMOR_PART_COUNT) break;
  }
  return out;
}

// Ruby + part cost to forge this region's elemental armor.
function regionArmorCost(regionIdx, regionId) {
  const N = (typeof regionNumberOf === 'function') ? regionNumberOf(regionId) : 1;
  return {
    rubies: BLACKSMITH_ARMOR_RUBY_PER_REGION * N,
    parts:  regionArmorPartTypes(regionIdx, regionId),
  };
}

// The trophy drop types the Blacksmith demands to forge this region's elemental
// SWORD. Like the armor (regionArmorPartTypes), a blade is tempered with the spoils
// of its OWN region — the same element as the sword being forged — favouring the
// enemies whose attacks match that element and topping up from the rest of the pool.
// But where armor takes each foe's common signature trophy, the sword demands their
// rarer PRIZED trophy (enemyRareTrophyType). Because those are rare, the forge asks
// for only half as many of each (see swordPartQty). Empty for the elementless forest,
// which forges no elemental sword.
function regionSwordPartTypes(regionId) {
  if (!SWORD_ELEMENTS[regionId]) return [];
  const regionIdx = (typeof REGIONS !== 'undefined') ? REGIONS.findIndex(r => r.id === regionId) : -1;
  if (regionIdx < 0) return [];
  const pool = (typeof ENEMY_POOLS !== 'undefined' && ENEMY_POOLS[regionIdx]) || [];
  const matched = [], rest = [];
  for (const type of pool) {
    const trophy = enemyRareTrophyType(type);
    if (!trophy) continue;
    const def = (typeof DND_ENEMIES !== 'undefined') ? DND_ENEMIES[type] : null;
    (def && def.element === regionId ? matched : rest).push(trophy);
  }
  const out = [];
  for (const t of matched.concat(rest)) {
    if (!out.includes(t)) out.push(t);
    if (out.length >= BLACKSMITH_ARMOR_PART_COUNT) break;
  }
  return out;
}

// Ruby + part cost to forge this region's elemental sword — same rubies as armor
// (100×N) but a different, rarer set of parts (this region's foes' prized trophies),
// each demanded at half quantity (see swordPartQty).
function regionSwordCost(regionId) {
  const N = (typeof regionNumberOf === 'function') ? regionNumberOf(regionId) : 1;
  return {
    rubies: BLACKSMITH_ARMOR_RUBY_PER_REGION * N,
    parts:  regionSwordPartTypes(regionId),
  };
}

// Flat physical armor is forged from the smith's regional ore (see oreForRegionIdx
// / ORE_TYPES). The bonus scales with the ore's class — Grimsilver +2, Emberbrass
// +4, Glimmerspar +6, Wyrmgold +8, Eclipsium +10, Voidsteel +12, i.e. (tier+1)×2 where tier is
// the ore's index in ORE_TYPES. A forge consumes ORE_ARMOR_ORE_COST of that ore
// plus a tier-scaled ruby fee and SETS player.armor to the new piece's value,
// replacing any lesser armor (it does not stack). So it's a tiered progression
// climbing region by region, not a repeatable grind — forging is pointless once
// player.armor already meets/exceeds the local ore's value. player.armor already
// persists, so no save changes are needed.
const ORE_ARMOR_ORE_COST       = 3;   // raw ore consumed per forge
const ORE_ARMOR_RUBY_PER_TIER = 80;  // ruby fee = (tier+1) × this

// Resolve the smith's region ore and the armor it forges. Null if the ore tables
// are unavailable (keeps the Blacksmith working even if config is stripped).
function smithOreArmor() {
  if (typeof ORE_TYPES === 'undefined' || typeof oreForRegionIdx !== 'function') return null;
  const { idx } = storeRegion();
  const ore  = oreForRegionIdx(idx);
  const tier = ORE_TYPES.indexOf(ore);
  return {
    ore, tier,
    armor:     (tier + 1) * 2,
    oreCost:   ORE_ARMOR_ORE_COST,
    rubyCost: (tier + 1) * ORE_ARMOR_RUBY_PER_TIER,
  };
}

function openBlacksmithModal() {
  shopOpen = true;
  document.getElementById('smith-modal-overlay').classList.add('open');
  renderBlacksmithContents();
}

function renderBlacksmithContents() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const regionName = regionId.charAt(0).toUpperCase() + regionId.slice(1);

  // Flat physical armor — a single tiered piece set by the region's ore. Forging a
  // higher tier replaces (not stacks on) any lesser armor; pointless once you already
  // have an equal/better piece.
  const oa = smithOreArmor();
  let pieceRows = '';
  if (oa) {
    const have    = player[oa.ore.id] || 0;
    const curArmor = player.armor || 0;
    const haveBetter = curArmor >= oa.armor;
    const broke = have < oa.oreCost || player.rubies < oa.rubyCost;
    const ownTag = haveBetter ? ` <span style="color:#88cc88">✓ have +${curArmor}</span>` : '';
    pieceRows = `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">${oa.ore.icon} ${oa.ore.label} Armor${ownTag}</div>
          <div class="shop-item-meta">Sets Armor to +${oa.armor} (replaces lesser) — forged from ${oa.ore.label} · You have ${oa.ore.icon} ${have}</div>
        </div>
        <button class="ssbtn" ${(haveBetter || broke) ? 'disabled' : ''} onclick="forgeOreArmor()">
          ${oa.ore.icon}${oa.oreCost} + 💰${oa.rubyCost}
        </button>
      </div>
    `;
  }

  // Elemental armor: forge THIS region's element (level 0), then upgrade ANY owned
  // armor whose next ore tier matches this village's ore (sequential). `oa` carries
  // this smith's ore, tier and forge cost.
  const homeElem = SWORD_ELEMENTS[regionId];
  const owned    = player.armorElements || [];
  let armorsRows = `
    <div style="margin-top:14px;border-top:1px solid #2a3a4a;padding-top:10px;font-size:12px;color:#8cb0ff">
      Elemental Armor${oa ? ` · upgrades here forge with ${oa.ore.icon} ${oa.ore.label}` : ''}
    </div>`;

  // Forge row — only the home region forges its own element, and only until owned.
  if (homeElem && !owned.includes(regionId)) {
    const { rubies: rubyCost, parts } = regionArmorCost(regionIdx, regionId);
    const haveRubies = player.rubies >= rubyCost;
    const haveParts  = parts.every(t => (player[t + 's'] || 0) >= BLACKSMITH_ARMOR_PART_QTY);
    const partChips = parts.map(t => {
      const meta = (typeof TROPHY_META !== 'undefined' && TROPHY_META[t]) ? TROPHY_META[t] : { icon: '•', label: t };
      const have = player[t + 's'] || 0;
      const ok   = have >= BLACKSMITH_ARMOR_PART_QTY;
      return `<span style="color:${ok ? '#88cc88' : '#cc8888'}">${meta.icon} ${Math.min(have, BLACKSMITH_ARMOR_PART_QTY)}/${BLACKSMITH_ARMOR_PART_QTY}</span>`;
    }).join(' · ');
    armorsRows += `
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">🛡${elemIconHTML(homeElem)} ${homeElem.label} Armor <span style="color:#999">(new · Lv 0)</span></div>
          <div class="shop-item-meta">Forge: 💰 ${rubyCost} + ${BLACKSMITH_ARMOR_PART_QTY}× each of 4 ${homeElem.label} foes' parts: ${partChips}</div>
        </div>
        <button class="ssbtn" ${(!haveRubies || !haveParts) ? 'disabled' : ''} onclick="forgeRegionalArmor()">🔨 Forge</button>
      </div>`;
  }

  // One status/upgrade row per owned elemental armor.
  for (const id of owned) armorsRows += blacksmithArmorRow(id, oa);

  // Nothing to forge or upgrade in this elementless village.
  if (!homeElem && owned.length === 0) {
    armorsRows = `
      <div style="margin-top:14px;border-top:1px solid #2a3a4a;padding-top:10px;font-size:12px;color:#8cb0ff">
        No elemental armor is forged in the ${regionName} — this forge works only mundane ore.
      </div>`;
  }

  // Elemental swords: forge THIS region's element (level 0) — like armor, tempered
  // with this same region's foes, but from their rarer prized trophies at half
  // quantity (regionSwordPartTypes / swordPartQty) — then upgrade ANY owned sword
  // whose next ore tier matches this village's ore.
  const ownedSwords = player.swordElements || [];
  let swordsRows = '';
  const canForgeSword = homeElem && !ownedSwords.includes(regionId);
  if (canForgeSword || ownedSwords.length > 0) {
    swordsRows = `
      <div style="margin-top:14px;border-top:1px solid #4a3a2a;padding-top:10px;font-size:12px;color:#ffcf8c">
        Elemental Swords${oa ? ` · upgrades here forge with ${oa.ore.icon} ${oa.ore.label}` : ''}
      </div>`;

    // Forge row — only the home region forges its own element, and only until owned.
    if (canForgeSword) {
      const { rubies: rubyCost, parts } = regionSwordCost(regionId);
      const haveRubies = player.rubies >= rubyCost;
      const haveParts  = parts.length > 0 && parts.every(t => (player[t + 's'] || 0) >= swordPartQty(t));
      const partChips = parts.map(t => {
        const meta = (typeof TROPHY_META !== 'undefined' && TROPHY_META[t]) ? TROPHY_META[t] : { icon: '•', label: t };
        const need = swordPartQty(t);
        const have = player[t + 's'] || 0;
        const ok   = have >= need;
        return `<span style="color:${ok ? '#88cc88' : '#cc8888'}">${meta.icon} ${Math.min(have, need)}/${need}</span>`;
      }).join(' · ');
      swordsRows += `
        <div class="shop-row">
          <div class="shop-item">
            <div class="shop-item-name">⚔${elemIconHTML(homeElem)} ${homeElem.label} Sword <span style="color:#999">(new · Lv 0)</span></div>
            <div class="shop-item-meta">Forge: 💰 ${rubyCost} + rare ${homeElem.label} foes' prized parts (½ qty): ${partChips}</div>
          </div>
          <button class="ssbtn" ${(!haveRubies || !haveParts) ? 'disabled' : ''} onclick="forgeRegionalSword()">🔨 Forge</button>
        </div>`;
    }

    // Capstone Dragonbane is never upgraded through the ore tiers — skip it here.
    for (const id of ownedSwords) { if (id === 'dragonbane') continue; swordsRows += blacksmithSwordRow(id, oa); }
  }

  document.getElementById('smith-modal').innerHTML = `
    <h2>🔨 Blacksmith's Forge</h2>
    <div class="shop-greeting">Blade or armor, hero? I forge the finest in the land.</div>
    <div class="shop-rubies">You have: 💰 <b>${player.rubies}</b> · 🛡 Armor +${player.armor || 0}</div>
    ${pieceRows}
    ${armorsRows}
    ${swordsRows}
    ${dragonbaneRow()}
    <button class="shop-close" onclick="closeShopModals()">✕ Leave</button>
  `;
}

// One Blacksmith row for an owned elemental sword: its level / flat bonus damage,
// plus an Upgrade button when this village's ore is the sword's next sequential
// tier (else a disabled hint pointing at the ore it needs). Swords are sold back at
// the General Store, so there's no sell button here. `oa` is this smith's
// ore/tier/cost (smithOreArmor()), or null.
// #8 Runaway Apprentice reward: a one-time free upgrade voucher for THIS region's
// smith. True while the current region has an unspent voucher.
function smithVoucherActive() {
  const rid = (typeof storeRegion === 'function') ? ((storeRegion().region || {}).id) : null;
  return !!(rid && player.smithFreeUpgrade && player.smithFreeUpgrade[rid] > 0);
}
// Consume the current region's voucher (one upgrade). Returns true if one was spent.
function consumeSmithVoucher() {
  const rid = (typeof storeRegion === 'function') ? ((storeRegion().region || {}).id) : null;
  if (!rid || !player.smithFreeUpgrade || !(player.smithFreeUpgrade[rid] > 0)) return false;
  player.smithFreeUpgrade[rid] -= 1;
  return true;
}

function blacksmithSwordRow(id, oa) {
  const elem = SWORD_ELEMENTS[id];
  if (!elem) return '';
  const lv    = swordUpgradeLevel(id);
  const bonus = lv * 2;
  const wieldTag = player.activeSwordElement === id ? ' <span style="color:#88ccff">✓ wielded</span>' : '';

  let btn, meta;
  if (lv >= 6) {
    btn  = `<button class="ssbtn" disabled>★ MAX</button>`;
    meta = `+${bonus} ${elem.label} dmg · fully forged`;
  } else if (oa && oa.tier === lv) {
    // This village's ore is exactly the sword's next sequential tier.
    const haveOre = player[oa.ore.id] || 0;
    const free    = smithVoucherActive();
    const broke   = !free && (haveOre < oa.oreCost || player.rubies < oa.rubyCost);
    const label   = free ? '🎟️ FREE' : `${oa.ore.icon}${oa.oreCost} + 💰${oa.rubyCost}`;
    btn  = `<button class="ssbtn" ${broke ? 'disabled' : ''} onclick="upgradeRegionalSword('${id}')">${label}</button>`;
    meta = `+${bonus} ${elem.label} dmg · upgrade → +${bonus + 2} dmg · have ${oa.ore.icon} ${haveOre}`;
  } else {
    // Next upgrade belongs to a different ore tier — point the hero at it.
    const need = (typeof ORE_TYPES !== 'undefined') ? ORE_TYPES[lv] : null;
    const needLbl = need ? `${need.icon} ${need.label}` : 'higher ore';
    btn  = `<button class="ssbtn" disabled>needs ${needLbl}</button>`;
    meta = `+${bonus} ${elem.label} dmg · next upgrade needs ${needLbl}`;
  }

  return `
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">⚔${elemIconHTML(elem)} ${elem.label} Sword · Lv ${lv}/6${wieldTag}</div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      ${btn}
    </div>`;
}

// Upgrade an owned elemental sword by one ore tier. Sequential like armor: this
// village's ore (oa.tier) must be exactly the sword's next tier (== its current
// level), so each sword climbs Grimsilver→Eclipsium across the matching villages.
// Costs the same ore + rubies as forging that tier's plain armor; adds +2 flat
// elemental damage (elementalSwordBonus).
function upgradeRegionalSword(id) {
  if (!SWORD_ELEMENTS[id]) return;
  player.swordElements = player.swordElements || [];
  if (!player.swordElements.includes(id)) return;
  const oa = smithOreArmor();
  if (!oa) return;
  player.swordUpgrades = player.swordUpgrades || {};
  const lv = player.swordUpgrades[id] || 0;
  if (lv >= 6) return;
  if (oa.tier !== lv) return;                          // must be upgraded in sequence at the right ore village
  const free = smithVoucherActive();
  if (!free) {
    if ((player[oa.ore.id] || 0) < oa.oreCost) return;
    if (player.rubies < oa.rubyCost) return;
    player[oa.ore.id] -= oa.oreCost;
    player.rubies     -= oa.rubyCost;
  } else {
    consumeSmithVoucher();
  }
  player.swordUpgrades[id] = lv + 1;
  const elem = SWORD_ELEMENTS[id];
  showMsg(`🔨 Upgraded ⚔${elem.icon} ${elem.label} Sword → Lv ${lv + 1}: +${(lv + 1) * 2} ${elem.label} damage${free ? ' (free — the apprentice\'s thanks!)' : ''}`, 3800);
  renderBlacksmithContents();
  updateHUD();
}

// One Blacksmith row for an owned elemental armor: its level / physical defense /
// block %, plus an Upgrade button when this village's ore is the armor's next
// sequential tier (else a disabled hint pointing at the ore it needs), and a
// sell-back button. `oa` is this smith's ore/tier/cost (smithOreArmor()), or null.
function blacksmithArmorRow(id, oa) {
  const elem = SWORD_ELEMENTS[id];
  if (!elem) return '';
  const lv       = armorUpgradeLevel(id);
  const phys     = lv * 2;
  const blockPct = elementalArmorBlockPct(id);
  const wornTag  = player.activeArmorElement === id ? ' <span style="color:#88ccff">✓ worn</span>' : '';
  const swims    = id === 'water' ? ' · swims medium water' : '';

  let btn, meta;
  if (lv >= 6) {
    btn  = `<button class="ssbtn" disabled>★ MAX</button>`;
    meta = `+${phys} def · blocks ${blockPct}% ${elem.label} · fully forged${swims}`;
  } else if (oa && oa.tier === lv) {
    // This village's ore is exactly the armor's next sequential tier.
    const haveOre  = player[oa.ore.id] || 0;
    const free     = smithVoucherActive();
    const broke    = !free && (haveOre < oa.oreCost || player.rubies < oa.rubyCost);
    const nextPct  = elementalBlockPctForLevel(lv + 1);
    const blockUp  = nextPct > blockPct ? `, block ${blockPct}→${nextPct}%` : '';
    const label    = free ? '🎟️ FREE' : `${oa.ore.icon}${oa.oreCost} + 💰${oa.rubyCost}`;
    btn  = `<button class="ssbtn" ${broke ? 'disabled' : ''} onclick="upgradeRegionalArmor('${id}')">${label}</button>`;
    meta = `+${phys} def · blocks ${blockPct}% ${elem.label} · upgrade → +${phys + 2} def${blockUp} · have ${oa.ore.icon} ${haveOre}${swims}`;
  } else {
    // Next upgrade belongs to a different ore tier — point the hero at it.
    const need = (typeof ORE_TYPES !== 'undefined') ? ORE_TYPES[lv] : null;
    const needLbl = need ? `${need.icon} ${need.label}` : 'higher ore';
    btn  = `<button class="ssbtn" disabled>needs ${needLbl}</button>`;
    meta = `+${phys} def · blocks ${blockPct}% ${elem.label} · next upgrade needs ${needLbl}${swims}`;
  }

  return `
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">🛡${elemIconHTML(elem)} ${elem.label} Armor · Lv ${lv}/6${wornTag}</div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      ${btn}
      <button class="ssbtn" onclick="sellElementalArmor('${id}')">➜ 💰${ELEMENTAL_ARMOR_SELL_VALUE}</button>
    </div>`;
}

function forgeOreArmor() {
  const oa = smithOreArmor();
  if (!oa) return;
  if ((player.armor || 0) >= oa.armor) return;   // already have an equal/better piece — no downgrade
  if ((player[oa.ore.id] || 0) < oa.oreCost) return;
  if (player.rubies < oa.rubyCost) return;
  player[oa.ore.id] -= oa.oreCost;
  player.rubies     -= oa.rubyCost;
  player.armor = oa.armor;   // replace the lesser piece with this tier's value
  showMsg(`🔨 Forged ${oa.ore.label} Armor — Armor now +${player.armor}`, 3000);
  renderBlacksmithContents();
  updateHUD();
}

// Forge this region's elemental armor: charge 100×N rubies AND BLACKSMITH_ARMOR_PART_QTY
// of each demanded element-matched part, then grant the matching armor element.
function forgeRegionalArmor() {
  const { idx: regionIdx, region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const elem = SWORD_ELEMENTS[regionId];
  if (!elem) return;
  player.armorElements = player.armorElements || [];
  if (player.armorElements.includes(regionId)) return;
  const { rubies: rubyCost, parts } = regionArmorCost(regionIdx, regionId);
  // Re-verify against live inventory (guards a stale enabled button).
  if (player.rubies < rubyCost) return;
  if (!parts.every(t => (player[t + 's'] || 0) >= BLACKSMITH_ARMOR_PART_QTY)) return;
  player.rubies -= rubyCost;
  for (const t of parts) player[t + 's'] -= BLACKSMITH_ARMOR_PART_QTY;
  player.armorElements.push(regionId);
  player.armorUpgrades = player.armorUpgrades || {};
  player.armorUpgrades[regionId] = 0;   // forged at level 0 — upgrade it through the ore tiers
  showMsg(`🔨 Forged 🛡${elem.icon} ${elem.label} Armor (Lv 0) — equip via the V menu, then upgrade with ore`, 4000);
  renderBlacksmithContents();
  updateHUD();
}

// Forge this region's elemental sword: charge 100×N rubies AND swordPartQty of each
// demanded same-region prized part (regionSwordPartTypes) — half quantity because
// they're rare — then grant the sword at level 0. Mirrors forgeRegionalArmor.
function forgeRegionalSword() {
  const { region } = storeRegion();
  const regionId = region ? region.id : 'forest';
  const elem = SWORD_ELEMENTS[regionId];
  if (!elem) return;
  player.swordElements = player.swordElements || [];
  if (player.swordElements.includes(regionId)) return;
  const { rubies: rubyCost, parts } = regionSwordCost(regionId);
  if (parts.length === 0) return;
  // Re-verify against live inventory (guards a stale enabled button).
  if (player.rubies < rubyCost) return;
  if (!parts.every(t => (player[t + 's'] || 0) >= swordPartQty(t))) return;
  player.rubies -= rubyCost;
  for (const t of parts) player[t + 's'] -= swordPartQty(t);
  player.swordElements.push(regionId);
  player.swordUpgrades = player.swordUpgrades || {};
  player.swordUpgrades[regionId] = 0;   // forged at level 0 — upgrade it through the ore tiers
  showMsg(`🔨 Forged ⚔${elem.icon} ${elem.label} Sword (Lv 0) — equip via the V menu, then upgrade with ore`, 4000);
  renderBlacksmithContents();
  updateHUD();
}

// Upgrade an owned elemental armor by one ore tier. Sequential: this village's ore
// (oa.tier) must be exactly the armor's next tier (== its current level), so each
// armor must climb Grimsilver→Eclipsium across the matching villages. Costs the same
// ore + rubies as forging that tier's plain armor; bumps physical defense (level×2)
// and, on the 1st/3rd/5th/6th upgrade, its elemental block % (elementalBlockPctForLevel).
function upgradeRegionalArmor(id) {
  if (!SWORD_ELEMENTS[id]) return;
  player.armorElements = player.armorElements || [];
  if (!player.armorElements.includes(id)) return;
  const oa = smithOreArmor();
  if (!oa) return;
  player.armorUpgrades = player.armorUpgrades || {};
  const lv = player.armorUpgrades[id] || 0;
  if (lv >= 6) return;
  if (oa.tier !== lv) return;                          // must be upgraded in sequence at the right ore village
  const free = smithVoucherActive();
  if (!free) {
    if ((player[oa.ore.id] || 0) < oa.oreCost) return;
    if (player.rubies < oa.rubyCost) return;
    player[oa.ore.id] -= oa.oreCost;
    player.rubies     -= oa.rubyCost;
  } else {
    consumeSmithVoucher();
  }
  player.armorUpgrades[id] = lv + 1;
  const elem = SWORD_ELEMENTS[id];
  showMsg(`🔨 Upgraded 🛡${elem.icon} ${elem.label} Armor → Lv ${lv + 1}: +${(lv + 1) * 2} def, blocks ${elementalBlockPctForLevel(lv + 1)}% ${elem.label}${free ? ' (free — the apprentice\'s thanks!)' : ''}`, 3800);
  renderBlacksmithContents();
  updateHUD();
}

// ─── #15 Forging the Dragonbane (capstone) ────────────────────────────────────
// The ultimate blade — forged once at the FINAL village's smith after the hero has
// proven themselves by slaying every region's Guild Quarry (all Guild head-quests
// done, i.e. a boss part claimed in every land). Costs a heavy final-region ore +
// ruby toll. It equips through the normal swordElements machinery; its damage
// (1d12 + 12, ignores resistance) is handled in doSwordSwing.

// How many regions have a Guild Quarry to slay (all of them, defensively counted).
function dragonbaneRegionsCount() {
  let n = 0;
  for (let i = 0; i < REGIONS.length; i++)
    if (typeof guildCreatureFor === 'function' && guildCreatureFor(i)) n++;
  return n;
}
// Gate: every region's Guild head-quest is done (guildRank counts 'done' quests).
function dragonbaneGateMet() {
  const need = dragonbaneRegionsCount();
  return need > 0 && (typeof guildRank === 'function') && guildRank() >= need;
}
// Forge toll: a heavy stack of the final region's ore + rubies.
function dragonbaneCost() {
  const lastIdx = REGIONS.length - 1;
  const ore = (typeof oreForRegionIdx === 'function') ? oreForRegionIdx(lastIdx) : null;
  return { rubies: 1000, ore, oreQty: 20 };
}

// The capstone row for the blacksmith modal — shown only at the final village's
// smith (castle-gate village) or once the Dragonbane is already owned.
function dragonbaneRow() {
  const owns = (player.swordElements || []).includes('dragonbane');
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const atFinalSmith = !!(cm && cm.castleExitDir);
  if (!owns && !atFinalSmith) return '';
  const elem = SWORD_ELEMENTS.dragonbane;
  if (owns) {
    const wield = player.activeSwordElement === 'dragonbane' ? ' <span style="color:#88ccff">✓ wielded</span>' : '';
    return `
      <div style="margin-top:14px;border-top:1px solid #7a2a1a;padding-top:10px;font-size:12px;color:#ff8a5c">The Dragonbane</div>
      <div class="shop-row">
        <div class="shop-item">
          <div class="shop-item-name">⚔${elem.icon} ${elem.label}${wield}</div>
          <div class="shop-item-meta">Strikes for 1d12 + 12 and ignores all resistance — the ultimate blade.</div>
        </div>
        <button class="ssbtn" disabled>★ FORGED</button>
      </div>`;
  }
  const gate = dragonbaneGateMet();
  const cost = dragonbaneCost();
  const haveRubies = player.rubies >= cost.rubies;
  const haveOre = !cost.ore || (player[cost.ore.id] || 0) >= cost.oreQty;
  const canForge = gate && haveRubies && haveOre;
  const oreChip = cost.ore ? `${cost.ore.icon} ${Math.min(player[cost.ore.id] || 0, cost.oreQty)}/${cost.oreQty}` : '';
  const meta = gate
    ? `Forge: 💰 ${cost.rubies}${cost.ore ? ` + ${oreChip} ${cost.ore.label} ore` : ''} — you've slain a Guild Quarry in every land.`
    : `Locked: slay every region's Guild Quarry (finish the Guild's hunt in all lands) to earn the right to forge it.`;
  return `
    <div style="margin-top:14px;border-top:1px solid #7a2a1a;padding-top:10px;font-size:12px;color:#ff8a5c">The Dragonbane · capstone</div>
    <div class="shop-row">
      <div class="shop-item">
        <div class="shop-item-name">⚔${elem.icon} ${elem.label} <span style="color:#999">(1d12 + 12 · ignores resistance)</span></div>
        <div class="shop-item-meta">${meta}</div>
      </div>
      <button class="ssbtn" ${canForge ? '' : 'disabled'} onclick="forgeDragonbane()">🔨 Forge</button>
    </div>`;
}

function forgeDragonbane() {
  if ((player.swordElements || []).includes('dragonbane')) return;
  if (!dragonbaneGateMet()) return;
  const cost = dragonbaneCost();
  if (player.rubies < cost.rubies) return;
  if (cost.ore && (player[cost.ore.id] || 0) < cost.oreQty) return;
  player.rubies -= cost.rubies;
  if (cost.ore) player[cost.ore.id] -= cost.oreQty;
  player.swordElements = player.swordElements || [];
  player.swordElements.push('dragonbane');
  player.activeSwordElement = 'dragonbane';   // auto-wield the new capstone
  if (typeof buzz === 'function') buzz([0, 30, 20, 40]);
  const msg = '🐲 The Dragonbane is forged! Its edge fears nothing — 1d12 + 12 and no resistance turns it. Now wielded.';
  if (typeof showMapMsg === 'function') showMapMsg(msg);
  else if (typeof showMsg === 'function') showMsg(msg, 5000);
  renderBlacksmithContents();
  updateHUD();
}

