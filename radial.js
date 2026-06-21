// ─── Radial inventory menu ───────────────────────────────────────────────────
// Opens with 'V' (or Escape to close). One ring is visible at a time; the player
// cycles five flat rings and picks an item within each:
//
//   Rings (cycle ▲ prev / ▼ next, empty rings skipped):
//     • swords     → base sword + each owned elemental sword
//     • arrows     → bow + plain & elemental arrows
//     • consumables→ Bomb + Health Potion
//     • drops      → passive pickups (rupees, herbals, fangs, …)
//     • armor      → Armor (only when the player has some)
//
//   ◀ / ▶  → previous / next item within the current ring (wraps)
//   ▲ / ▼  → previous / next ring
//
// Navigating auto-equips the highlighted weapon — no Enter needed. Consumables
// (potion drink / bomb drop) are skipped by auto-equip and fired only on an
// explicit Enter / click, or via the C quick-use key.

let radialMenuOpen = false;
let radialMenuOpenTime = 0;
let radialRingIndex = 0;     // index into RADIAL_RINGS
let radialItemIndex = 0;     // selected item within the current ring
// Ring spin: the selected item is pinned to the top (12 o'clock) and the whole
// ring rotates to bring it there, instead of a highlight hopping between fixed
// slots. radialSpinAngle is the live rotation (radians), eased toward
// radialSpinTarget each frame in drawRadialMenu.
let radialSpinAngle = 0;
let radialSpinTarget = 0;
// The consumable bound to the C quick-use key + HUD [C] slot, stored by *type*
// so it survives the item going out of stock. Defaults to Bomb; updated whenever
// the player highlights a consumable in any ring.
let inventorySelectionType = 'bomb';
// Per-ring highlight memory, keyed by ring name and stored by item type so
// switching rings (or reopening the menu) restores the last item chosen there
// instead of snapping back to index 0.
const ringSelectionType = {};

const radialMouse = { x: 0, y: 0 };

// All rings share one radius so swapping rings doesn't visibly resize.
const RADIAL_RADIUS = 150;

// Passive drop items (rupees, herbals, monster trophies). They have no action —
// they're displayed for at-a-glance inventory tracking. Kept in one table so the
// drops ring stays a single source of truth for "everything off the ground."
const PASSIVE_DROPS = [
  { type: 'rupees',  icon: '💎', label: 'Rupees',  key: 'rupees'  },
  { type: 'herbals', icon: '🌿', label: 'Herbal',  key: 'herbals' },
  { type: 'fangs',   icon: '🦷', label: 'Fang',    key: 'fangs'   },
  { type: 'fingers', icon: '🫳', label: 'Finger',  key: 'fingers' },
  { type: 'bones',   icon: '🦴', label: 'Bone',    key: 'bones'   },
  { type: 'wings',   icon: '🪶', label: 'Wing',    key: 'wings'   },
  { type: 'organs',  icon: '🫀', label: 'Organ',   key: 'organs'  },
  { type: 'feathers',icon: '🪶', label: 'Feather', key: 'feathers'},
  { type: 'bonemeal',icon: '🧂', label: 'Bone Meal', key: 'bonemeal' },
  { type: 'silks',     icon: '🕸️', label: 'Silk',           key: 'silks'      },
  { type: 'talismans', icon: '📿', label: 'Talisman',       key: 'talismans'  },
  { type: 'embers',    icon: '🔥', label: 'Ember',          key: 'embers'     },
  { type: 'venoms',    icon: '☠️', label: 'Venom Sac',      key: 'venoms'     },
  { type: 'fins',      icon: '🐟', label: 'Fin',            key: 'fins'       },
  { type: 'pearls',    icon: '🦪', label: 'Pearl',          key: 'pearls'     },
  { type: 'cores',     icon: '💠', label: 'Elemental Core', key: 'cores'      },
  { type: 'shards',    icon: '🧊', label: 'Ice Shard',      key: 'shards'     },
  { type: 'pelts',     icon: '🧥', label: 'Pelt',           key: 'pelts'      },
  { type: 'tusks',     icon: '🦣', label: 'Tusk',           key: 'tusks'      },
  { type: 'scales',    icon: '🐉', label: 'Dragon Scale',   key: 'scales'     },
  { type: 'stones',    icon: '🪨', label: 'Stone Shard',    key: 'stones'     },
  { type: 'sparks',    icon: '⚡', label: 'Storm Spark',    key: 'sparks'     },
  { type: 'horns',     icon: '🦄', label: 'Horn',           key: 'horns'      },
  { type: 'motes',     icon: '✨', label: 'Light Mote',     key: 'motes'      },
  { type: 'ectoplasms',icon: '👻', label: 'Ectoplasm',      key: 'ectoplasms' },
  { type: 'eyes',      icon: '👁️', label: 'Eye',            key: 'eyes'       },
  { type: 'brains',    icon: '🧠', label: 'Brain',          key: 'brains'     },
  // Per-enemy signature trophies — one unique drop per enemy (see ENEMY_DROPS).
  { type: 'dryad_blooms',       icon: '🌷', label: 'Dryad Bloom',        key: 'dryad_blooms'       },
  { type: 'gnoll_fangs',        icon: '🦷', label: 'Gnoll Fang',         key: 'gnoll_fangs'        },
  { type: 'hound_fangs',        icon: '🦷', label: 'Hellhound Fang',     key: 'hound_fangs'        },
  { type: 'salamander_hides',   icon: '🦎', label: 'Salamander Hide',    key: 'salamander_hides'   },
  { type: 'kuotoa_gills',       icon: '🐠', label: 'Kuo-toa Gill',       key: 'kuotoa_gills'       },
  { type: 'shark_tooths',       icon: '🦈', label: 'Shark Tooth',        key: 'shark_tooths'       },
  { type: 'hag_hairs',          icon: '🧶', label: 'Sea Hag Hair',       key: 'hag_hairs'          },
  { type: 'frost_fangs',        icon: '❄️', label: 'Frost Fang',         key: 'frost_fangs'        },
  { type: 'rimes',              icon: '🧊', label: 'Rime Crystal',       key: 'rimes'              },
  { type: 'acid_glands',        icon: '🧪', label: 'Acid Gland',         key: 'acid_glands'        },
  { type: 'displacer_hides',    icon: '🐆', label: 'Displacer Hide',     key: 'displacer_hides'    },
  { type: 'bulette_plates',     icon: '🛡️', label: 'Bulette Plate',      key: 'bulette_plates'     },
  { type: 'earth_hearts',       icon: '🟤', label: 'Earthen Heart',      key: 'earth_hearts'       },
  { type: 'granites',           icon: '🗿', label: 'Granite Slab',       key: 'granites'           },
  { type: 'harpy_plumes',       icon: '🪶', label: 'Harpy Plume',        key: 'harpy_plumes'       },
  { type: 'griffon_feathers',   icon: '🦅', label: 'Griffon Feather',    key: 'griffon_feathers'   },
  { type: 'manticore_spikes',   icon: '🗡️', label: 'Manticore Spike',    key: 'manticore_spikes'   },
  { type: 'zephyrs',            icon: '🌀', label: 'Zephyr Wisp',        key: 'zephyrs'            },
  { type: 'wyvern_scales',      icon: '🐲', label: 'Wyvern Scale',       key: 'wyvern_scales'      },
  { type: 'roc_plumes',         icon: '🪶', label: 'Roc Plume',          key: 'roc_plumes'         },
  { type: 'wyrmling_scales',    icon: '🐉', label: 'Wyrmling Scale',     key: 'wyrmling_scales'    },
  { type: 'behir_scales',       icon: '🐍', label: 'Behir Scale',        key: 'behir_scales'       },
  { type: 'bluedragon_scales',  icon: '🐉', label: 'Blue Dragon Scale',  key: 'bluedragon_scales'  },
  { type: 'stormgiant_bolts',   icon: '🌩️', label: 'Tempest Bolt',       key: 'stormgiant_bolts'   },
  { type: 'pegasus_feathers',   icon: '🪽', label: 'Pegasus Feather',    key: 'pegasus_feathers'   },
  { type: 'couatl_scales',      icon: '🌈', label: 'Couatl Scale',       key: 'couatl_scales'      },
  { type: 'kirin_horns',        icon: '🦌', label: 'Ki-rin Horn',        key: 'kirin_horns'        },
  { type: 'planetar_halos',     icon: '😇', label: 'Planetar Halo',      key: 'planetar_halos'     },
  { type: 'wraith_shrouds',     icon: '🧣', label: 'Wraith Shroud',      key: 'wraith_shrouds'     },
  { type: 'vampire_fangs',      icon: '🧛', label: 'Vampire Fang',       key: 'vampire_fangs'      },
  { type: 'phylacterys',        icon: '🔮', label: 'Phylactery',         key: 'phylacterys'        },
  { type: 'crawler_venoms',     icon: '🐛', label: 'Carrion Bile',       key: 'crawler_venoms'     },
  { type: 'troll_hides',        icon: '🟢', label: 'Troll Hide',         key: 'troll_hides'        },
  { type: 'otyugh_tentacles',   icon: '🦑', label: 'Otyugh Tentacle',    key: 'otyugh_tentacles'   },
  { type: 'treant_heartwoods',  icon: '🪵', label: 'Heartwood',          key: 'treant_heartwoods'  },
  { type: 'greendragon_scales', icon: '🐉', label: 'Green Dragon Scale', key: 'greendragon_scales' },
  { type: 'worm_stingers',      icon: '🪱', label: 'Worm Stinger',       key: 'worm_stingers'      },
  { type: 'horror_plates',      icon: '🛡️', label: 'Animus Plate',       key: 'horror_plates'      },
  { type: 'gith_blades',        icon: '⚔️', label: 'Githyanki Blade',    key: 'gith_blades'        },
  { type: 'eyestalks',          icon: '👁️', label: 'Eyestalk',           key: 'eyestalks'          },
  { type: 'rakshasa_claws',     icon: '🐾', label: 'Rakshasa Claw',      key: 'rakshasa_claws'     },
  { type: 'winterberries', icon: '🫐', label: 'Winter Berry', key: 'winterberries' },
  { type: 'frostpetals',   icon: '💮', label: 'Frost Petal',  key: 'frostpetals'   },
  { type: 'seashells',     icon: '🐚', label: 'Seashell',     key: 'seashells'     },
  { type: 'corals',        icon: '🪸', label: 'Coral',        key: 'corals'        },
  { type: 'sage',          icon: '🌿', label: 'Sage',         key: 'sage'          },
  { type: 'moss',          icon: '🌱', label: 'Moss',         key: 'moss'          },
  { type: 'crystals',      icon: '🔮', label: 'Crystal',      key: 'crystals'      },
  { type: 'skypetals',     icon: '🌸', label: 'Sky Petal',    key: 'skypetals'     },
  { type: 'windseeds',     icon: '🌾', label: 'Wind Seed',    key: 'windseeds'     },
  { type: 'thistledown',   icon: '💨', label: 'Thistle Down', key: 'thistledown'   },
  { type: 'voltpetals',    icon: '🌼', label: 'Volt Petal',   key: 'voltpetals'    },
  { type: 'sparkseeds',    icon: '🌾', label: 'Spark Seed',   key: 'sparkseeds'    },
  { type: 'fulgurites',    icon: '🔷', label: 'Fulgurite',    key: 'fulgurites'    },
  { type: 'witherwood',    icon: '🪵', label: 'Witherwood',   key: 'witherwood'    },
  { type: 'graveblooms',   icon: '🥀', label: 'Grave Bloom',  key: 'graveblooms'   },
  { type: 'manapetals',    icon: '🪻', label: 'Mana Petal',   key: 'manapetals'    },
  { type: 'heartfronds',   icon: '🍃', label: 'Heart Frond',  key: 'heartfronds'   },
  { type: 'glowcaps',      icon: '🍄', label: 'Glow Cap',     key: 'glowcaps'      },
  { type: 'fiddleheads',   icon: '🌿', label: 'Fiddlehead',   key: 'fiddleheads'   },
  { type: 'aloe',          icon: '🪴', label: 'Aloe',         key: 'aloe'          },
  { type: 'frostferns',    icon: '❄️', label: 'Frost Fern',   key: 'frostferns'    },
  { type: 'sunseeds',      icon: '🌟', label: 'Sun Seed',     key: 'sunseeds'      },
  { type: 'prisms',        icon: '🔆', label: 'Prism Shard',  key: 'prisms'        },
  { type: 'reedpith',      icon: '🌾', label: 'Reed Pith',    key: 'reedpith'      },
];

// Ledger grouping. The drops ledger (ledger.js) renders ~45 pickups under these
// buckets in this order instead of one flat list. DROP_CAT_OF maps a drop type to
// its bucket; anything unlisted falls through to 'material' (the elemental /
// crafting bits — embers, shards, cores, stones, sparks, pearls, motes, …).
const DROP_CATEGORIES = [
  { id: 'currency', label: 'Currency'       },
  { id: 'monster',  label: 'Monster Parts'  },
  { id: 'herbal',   label: 'Herbs & Plants' },
  { id: 'material', label: 'Materials'      },
];
const DROP_CAT_OF = {
  rupees: 'currency',
  herbals: 'herbal', winterberries: 'herbal', frostpetals: 'herbal', sage: 'herbal',
  moss: 'herbal', skypetals: 'herbal', windseeds: 'herbal', thistledown: 'herbal',
  voltpetals: 'herbal', sparkseeds: 'herbal', manapetals: 'herbal', heartfronds: 'herbal',
  glowcaps: 'herbal', witherwood: 'herbal', graveblooms: 'herbal',
  fiddleheads: 'herbal', aloe: 'herbal', frostferns: 'herbal', sunseeds: 'herbal', reedpith: 'herbal',
  fangs: 'monster', fingers: 'monster', bones: 'monster', wings: 'monster', organs: 'monster',
  feathers: 'monster', venoms: 'monster', fins: 'monster', pelts: 'monster', tusks: 'monster',
  scales: 'monster', horns: 'monster', ectoplasms: 'monster', eyes: 'monster', brains: 'monster',
  silks: 'monster',
  // Per-enemy signature trophies (see ENEMY_DROPS). Biological spoils (fangs,
  // hides, scales, feathers, organs…) bucket under Monster Parts; the mineral /
  // elemental / crafted ones (Rime Crystal, Earthen Heart, Granite, Zephyr Wisp,
  // Tempest Bolt, Halo, Phylactery, Heartwood, Animus Plate, Gith Blade, Dryad
  // Bloom) fall through to Materials like the embers / shards / cores above.
  gnoll_fangs: 'monster', hound_fangs: 'monster', salamander_hides: 'monster',
  kuotoa_gills: 'monster', shark_tooths: 'monster', hag_hairs: 'monster', frost_fangs: 'monster',
  acid_glands: 'monster', displacer_hides: 'monster', bulette_plates: 'monster',
  harpy_plumes: 'monster', griffon_feathers: 'monster', manticore_spikes: 'monster',
  wyvern_scales: 'monster', roc_plumes: 'monster', wyrmling_scales: 'monster', behir_scales: 'monster',
  bluedragon_scales: 'monster', pegasus_feathers: 'monster', couatl_scales: 'monster',
  kirin_horns: 'monster', wraith_shrouds: 'monster', vampire_fangs: 'monster',
  crawler_venoms: 'monster', troll_hides: 'monster', otyugh_tentacles: 'monster',
  greendragon_scales: 'monster', worm_stingers: 'monster',
  eyestalks: 'monster', rakshasa_claws: 'monster',
};
function dropCatOf(type) { return DROP_CAT_OF[type] || 'material'; }

// Each ring is a function returning live items so values track player state
// without us having to rebuild on every change.
const RADIAL_RINGS = [
  // ── Swords: base sword + each owned elemental sword ──────────────────────────
  { name: 'swords', radius: RADIAL_RADIUS, getItems: () => {
      const lv = player.swordLevel || 1;
      const items = [
        { type: 'sword', icon: '⚔', label: 'Sword',
          val: () => 'Lv' + (player.swordLevel || 1),
          dmg: () => `${lv}-${lv + 2}`,
          action: () => { player.weapon = 'sword'; player.activeSwordElement = null; },
          isActive: () => player.weapon === 'sword' && !player.activeSwordElement }
      ];
      for (const id of (player.swordElements || [])) {
        const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[id] : null;
        if (!elem) continue;
        items.push({
          type: 'sword_' + id,
          icon: elem.icon,
          iconImg: elem.iconImg, iconPrefix: '',
          label: elem.label + ' Sword',
          val: () => 'Lv' + (player.swordLevel || 1),
          dmg: () => `${lv}-${lv + 2}+${elem.icon}1-4`,
          action: () => { player.weapon = 'sword'; player.activeSwordElement = id; },
          isActive: () => player.weapon === 'sword' && player.activeSwordElement === id
        });
      }
      return items;
    }},
  // ── Arrows: a single Plain Arrow entry (the bow's default ammo) + one slot per
  // elemental arrow. There's no separate "Bow" slot — firing plain arrows IS the
  // bow, so the always-present Plain Arrow stands in for it; bow level shows in the
  // damage badge. Each elemental arrow uses just its element symbol as its icon
  // (matching the swords ring) rather than a busy bow + element pair. ────────────
  { name: 'arrows', radius: RADIAL_RADIUS, getItems: () => {
      const bowDmg = (player.bowLevel || 1) * 2 + 1;
      const items = [
        { type: 'bow_plain', icon: '➳', label: 'Plain Arrow',
          val: () => 'x' + ((player.arrows && player.arrows.plain) || 0),
          dmg: () => String(bowDmg),
          action: () => { player.weapon = 'bow'; player.activeArrowElement = null; },
          isActive: () => player.weapon === 'bow' && !player.activeArrowElement }
      ];
      const arrows = player.arrows || {};
      for (const id of Object.keys(arrows)) {
        if (id === 'plain') continue;
        const count = arrows[id] || 0;
        if (count <= 0) continue;
        const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[id] : null;
        if (!elem) continue;
        items.push({
          type: 'bow_' + id,
          icon: elem.icon,
          iconImg: elem.iconImg, iconPrefix: '',
          label: elem.label + ' Arrow',
          val: () => 'x' + (player.arrows[id] || 0),
          dmg: () => `${bowDmg}+${elem.icon}1-4`,
          action: () => { player.weapon = 'bow'; player.activeArrowElement = id; },
          isActive: () => player.weapon === 'bow' && player.activeArrowElement === id
        });
      }
      return items;
    }},
  // ── Consumables: every consumable except arrows (Bomb + Health Potion) ───────
  { name: 'consumables', radius: RADIAL_RADIUS, getItems: () => {
      const items = [
        { type: 'bomb', icon: '💣', label: 'Bomb',
          val: () => '∞',
          dmg: () => String(7 + (player.swordLevel || 1)),
          consumable: true,
          action: () => { player.weapon = 'bomb'; placePlayerBomb(); },
          isActive: () => player.weapon === 'bomb' }
      ];
      if ((player.potions || 0) > 0) {
        items.push({ type: 'potion', icon: '🧪', label: 'Health Potion',
          val: () => 'x' + (player.potions || 0),
          consumable: true,
          action: () => usePotion() });
      }
      if ((player.medPotions || 0) > 0) {
        items.push({ type: 'medpotion', icon: '🍶', label: 'Medium Potion',
          val: () => 'x' + (player.medPotions || 0),
          consumable: true,
          action: () => useMedPotion() });
      }
      return items;
    }},
  // ── Armor: base armor pad + each owned elemental armor ──────────────────────
  // The base entry just summarizes flat armor; the elemental entries are
  // equippable — picking one halves incoming damage of that element.
  { name: 'armor', radius: RADIAL_RADIUS, getItems: () => {
      const items = [];
      if (player.armor && player.armor > 0) {
        items.push({ type: 'armor', icon: '🛡', label: 'Armor',
          val: () => '+' + (player.armor || 0),
          action: () => { player.activeArmorElement = null; },
          isActive: () => !player.activeArmorElement });
      } else {
        // Always offer an "unequip" slot so the player can drop their
        // elemental armor even without any flat armor points.
        items.push({ type: 'armor', icon: '🛡', label: 'No Armor',
          val: () => '—',
          action: () => { player.activeArmorElement = null; },
          isActive: () => !player.activeArmorElement });
      }
      for (const id of (player.armorElements || [])) {
        const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[id] : null;
        if (!elem) continue;
        items.push({
          type: 'armor_' + id,
          icon: '🛡' + elem.icon,
          iconImg: elem.iconImg, iconPrefix: '🛡',
          label: elem.label + ' Armor',
          val: () => '−50% ' + elem.icon,
          action: () => { player.activeArmorElement = id; },
          isActive: () => player.activeArmorElement === id
        });
      }
      return items;
    }},
  // ── Menu: non-actionable launchers. Unlike gear these don't equip — each opens
  // its own panel and fires on Enter/click ONLY (navigating past one must not
  // trigger it), so they're flagged `launcher` and skipped by radialAutoPick.
  // Drop a settings or character launcher in here later with no other changes. ──
  { name: 'menu', radius: RADIAL_RADIUS, getItems: () => {
      const kinds = PASSIVE_DROPS.reduce(
        (n, d) => n + ((player[d.key] || 0) > 0 ? 1 : 0), 0);
      return [
        { type: 'drops', icon: '🎒', label: 'Drops', launcher: true,
          val: () => kinds ? 'x' + kinds : '—',
          action: () => { if (typeof openDropLedger === 'function') openDropLedger(); } },
      ];
    }},
];

// ─── Current ring helpers ──────────────────────────────────────────────────────
function radialCurrentRing()  { return RADIAL_RINGS[radialRingIndex]; }
function radialCurrentItems() { return radialCurrentRing().getItems(); }
function radialCurrentName()  { return radialCurrentRing().name; }

// ─── Selection memory ──────────────────────────────────────────────────────────
// Index into `items` of the ring's saved selection type, or 0 if absent.
function indexForSelectionName(items, name) {
  const idx = items.findIndex(it => it.type === ringSelectionType[name]);
  return idx >= 0 ? idx : 0;
}
// Remember the highlighted item for its ring, and bind the C quick-use key when
// it's a consumable (so C keeps firing whatever consumable was last selected).
function rememberSelection(name, item) {
  if (!item) return;
  ringSelectionType[name] = item.type;
  if (item.consumable) inventorySelectionType = item.type;
}

// Find an item by type across all rings (used by the C key / HUD [C] slot).
function radialFindItem(type) {
  for (const ring of RADIAL_RINGS) {
    const it = ring.getItems().find(i => i.type === type);
    if (it) return it;
  }
  return null;
}

function toggleRadialMenu() {
  if (radialMenuOpen) { closeRadialMenu(); return; }
  radialMenuOpen = true;
  radialMenuOpenTime = Date.now();
  // Reopen on the last-used ring; if it's since emptied, fall back to the first
  // ring that still has items so we never open on an empty ring.
  if (RADIAL_RINGS[radialRingIndex].getItems().length === 0) {
    for (let i = 0; i < RADIAL_RINGS.length; i++) {
      if (RADIAL_RINGS[i].getItems().length > 0) { radialRingIndex = i; break; }
    }
  }
  const items = RADIAL_RINGS[radialRingIndex].getItems();
  radialItemIndex = indexForSelectionName(items, RADIAL_RINGS[radialRingIndex].name);
  radialSpinToSelected(true);
  if (typeof clearAllKeys === 'function') clearAllKeys();
}

function closeRadialMenu() {
  if (!radialMenuOpen) return;
  radialMenuOpen = false;
  if (typeof clearAllKeys === 'function') clearAllKeys();
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────
// Cycle to the next/previous non-empty ring (▲ = -1, ▼ = +1).
function radialNavRing(delta) {
  if (!radialMenuOpen) return;
  const N = RADIAL_RINGS.length;
  let idx = radialRingIndex;
  for (let i = 0; i < N; i++) {
    idx = ((idx + delta) % N + N) % N;
    if (RADIAL_RINGS[idx].getItems().length > 0) break;
  }
  radialRingIndex = idx;
  const items = RADIAL_RINGS[idx].getItems();
  radialItemIndex = indexForSelectionName(items, RADIAL_RINGS[idx].name);
  radialSpinToSelected(true);   // snap — switching rings shouldn't spin
  radialMenuOpenTime = Date.now();   // replay emerge animation for the new ring
  radialAutoPick();
}

function radialNavItem(delta) {
  if (!radialMenuOpen) return;
  const items = radialCurrentItems();
  const N = items.length;
  if (N === 0) return;
  radialItemIndex = ((radialItemIndex + delta) % N + N) % N;
  radialSpinToSelected(false);   // spin the new selection up to the top
  rememberSelection(radialCurrentName(), items[radialItemIndex]);
  radialAutoPick();
}

// Auto-equip the highlighted item so navigating it "picks" it without Enter.
// Consumables (potions) and world-affecting items (bombs) are excluded — they'd
// be used up just by scrolling past — so they stay merely selected and are fired
// only on an explicit Enter/click or the C key.
function radialAutoPick() {
  const item = radialCurrentItems()[radialItemIndex];
  if (item && item.action && !item.consumable && !item.launcher) {
    item.action();
    updateHUD();
  }
}

function radialActivateSelected() {
  if (!radialMenuOpen) return;
  const item = radialCurrentItems()[radialItemIndex];
  if (item && item.action) {
    item.action();
    updateHUD();
  }
}

// Called by the C key in the game loop. Returns ms of cooldown so the gameplay
// timer can throttle hold-to-spam (matches the old bomb behaviour).
function useSelectedInventoryItem() {
  // Resolve the C-bound consumable; fall back to Bomb so the key is never dead.
  let item = radialFindItem(inventorySelectionType);
  if (!item || !item.consumable) item = radialFindItem('bomb');
  if (!item) return 0;
  if (item.type === 'potion') {
    const before = player.potions;
    usePotion();
    return (before > player.potions) ? 600 : 0;
  }
  if (item.type === 'medpotion') {
    const before = player.medPotions;
    useMedPotion();
    return (before > player.medPotions) ? 600 : 0;
  }
  if (item.type === 'bomb') {
    player.weapon = 'bomb';
    placePlayerBomb();
    return 1200;
  }
  return 0;
}

// Smooth emerge: 0 → 1 over 250 ms with a cubic ease-out.
function radialEase() {
  const t = Math.min(1, (Date.now() - radialMenuOpenTime) / 250);
  return 1 - Math.pow(1 - t, 3);
}

// Aim the spin so the currently-selected item rotates up to the top. Picks the
// rotation nearest the current angle so the ring always takes the short way
// round (and wraps smoothly from the last item back to the first). `snap` jumps
// there instantly — used on open / ring change so only item nav actually spins.
function radialSpinToSelected(snap) {
  const N = Math.max(1, radialCurrentItems().length);
  const step = (2 * Math.PI) / N;
  let target = -radialItemIndex * step;
  target += Math.round((radialSpinAngle - target) / (2 * Math.PI)) * (2 * Math.PI);
  radialSpinTarget = target;
  if (snap) radialSpinAngle = target;
}

// Compute slot positions for the active ring only.
function radialSlots() {
  if (!radialMenuOpen) return [];
  const ease = radialEase();
  const pcx = (player.renderX - camC + 0.5) * TILE_PX;
  const pcy = (player.renderY - camR + 0.5) * TILE_PX;
  const ring = radialCurrentRing();
  const items = ring.getItems();
  const r = ring.radius * ease;
  const N = items.length;
  const slots = [];
  for (let i = 0; i < N; i++) {
    const angle = -Math.PI / 2 + (i / N) * Math.PI * 2 + radialSpinAngle;
    slots.push({
      x: pcx + Math.cos(angle) * r,
      y: pcy + Math.sin(angle) * r,
      radius: 28 * ease,
      item: items[i],
      ring: ring.name,
      index: i,
      selected: i === radialItemIndex
    });
  }
  return slots;
}

function radialHoveredSlot() {
  if (!radialMenuOpen) return null;
  for (const slot of radialSlots()) {
    const dx = radialMouse.x - slot.x, dy = radialMouse.y - slot.y;
    if (dx * dx + dy * dy <= slot.radius * slot.radius) return slot;
  }
  return null;
}

// Mouse listeners — track position and resolve clicks to slot actions.
function radialOnMouseMove(e) {
  if (!radialMenuOpen) return;
  const rect = canvas.getBoundingClientRect();
  radialMouse.x = e.clientX - rect.left;
  radialMouse.y = e.clientY - rect.top;
}

function radialOnClick(e) {
  if (!radialMenuOpen) return;
  const rect = canvas.getBoundingClientRect();
  radialMouse.x = e.clientX - rect.left;
  radialMouse.y = e.clientY - rect.top;
  const slot = radialHoveredSlot();
  if (slot) {
    radialItemIndex = slot.index;   // sync keyboard selection to mouse
    radialSpinToSelected(false);    // spin the clicked item up to the selector
    rememberSelection(radialCurrentName(), slot.item);
    if (slot.item.action) { slot.item.action(); updateHUD(); }
  } else {
    closeRadialMenu();
  }
}

canvas.addEventListener('mousemove', radialOnMouseMove);
canvas.addEventListener('click',     radialOnClick);

// ─── Inline-image chip text ─────────────────────────────────────────────────
// Stat chips (the val / dmg badges under each slot) embed an element's symbol,
// e.g. "⚔1-3+🪨1-4" or "−50% 🪨". For Earth that symbol is a custom image, so
// these helpers substitute the rock image for the 🪨 emoji. Elements without an
// iconImg fall back to plain centred text. ctx.font / fillStyle / textBaseline
// are assumed already set by the caller.
function radialChipUsesImg(text, img) {
  return !!(img && img.complete && img.naturalWidth > 0 && text.indexOf('🪨') >= 0);
}
function radialChipFontPx(ctx) {
  const m = /(\d+)px/.exec(ctx.font);
  return m ? +m[1] : 12;
}
function radialChipWidth(ctx, text, img) {
  if (!radialChipUsesImg(text, img)) return ctx.measureText(text).width;
  const parts = text.split('🪨');
  let w = (parts.length - 1) * radialChipFontPx(ctx);   // one image per 🪨
  for (const p of parts) w += ctx.measureText(p).width;
  return w;
}
function radialDrawChip(ctx, text, cx, cy, img) {
  if (!radialChipUsesImg(text, img)) { ctx.fillText(text, cx, cy); return; }
  const fontPx = radialChipFontPx(ctx);
  const parts = text.split('🪨');
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - radialChipWidth(ctx, text, img) / 2;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) { ctx.fillText(parts[i], x, cy); x += ctx.measureText(parts[i]).width; }
    if (i < parts.length - 1) { ctx.drawImage(img, x, cy - fontPx / 2, fontPx, fontPx); x += fontPx; }
  }
  ctx.textAlign = prevAlign;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function drawRadialMenu() {
  if (!radialMenuOpen) return;
  const ease = radialEase();
  const pcx = (player.renderX - camC + 0.5) * TILE_PX;
  const pcy = (player.renderY - camR + 0.5) * TILE_PX;
  const ring = radialCurrentRing();

  // Ease the live rotation toward its target so the ring visibly spins the
  // selected item up to the top rather than the highlight jumping between slots.
  radialSpinAngle += (radialSpinTarget - radialSpinAngle) * 0.25;
  if (Math.abs(radialSpinTarget - radialSpinAngle) < 0.0005) radialSpinAngle = radialSpinTarget;

  ctx.save();

  // Dim the world
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * ease})`;
  ctx.fillRect(0, 0, PW, PH);

  // Single dashed guide for the active ring
  ctx.strokeStyle = `rgba(255, 220, 120, ${0.35 * ease})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(pcx, pcy, ring.radius * ease, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const hovered = radialHoveredSlot();
  const slots = radialSlots();

  for (const slot of slots) {
    const isHover    = hovered === slot;
    const isSelected = slot.selected;
    // Each weapon item declares its own "active" predicate so we can distinguish
    // base-sword vs Fire-sword, bow vs arrow type, equipped bomb, etc.
    const activeWeapon = typeof slot.item.isActive === 'function'
      ? slot.item.isActive()
      : false;

    // Selection / hover glow
    if (isSelected || isHover) {
      const g = ctx.createRadialGradient(slot.x, slot.y, 0, slot.x, slot.y, slot.radius * 2.4);
      g.addColorStop(0, 'rgba(255, 220, 120, 0.65)');
      g.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(slot.x - slot.radius * 2.4, slot.y - slot.radius * 2.4,
                   slot.radius * 4.8, slot.radius * 4.8);
    }

    // Slot disk
    ctx.fillStyle = activeWeapon ? '#3a5a2a'
                   : isSelected   ? '#2a4a2a'
                   : isHover      ? '#1c321c'
                                  : '#0e1a0e';
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);
    ctx.fill();
    // Border
    ctx.strokeStyle = activeWeapon ? '#a0ff66'
                     : isSelected   ? '#ffd070'
                     : isHover      ? '#cca050'
                                    : '#4a6a4a';
    ctx.lineWidth = (isSelected || activeWeapon) ? 3 : 2;
    ctx.stroke();

    // Icon
    ctx.fillStyle = '#fff';
    const iconSz = Math.round(slot.radius * 1.05);
    ctx.font = `${iconSz}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const img = slot.item.iconImg;
    if (img && img.complete && img.naturalWidth > 0) {
      // Custom image symbol (Earth's stone). Optional emoji prefix (🏹/🛡) sits
      // to the left, with the image to its right; otherwise the image is centred.
      const prefix = slot.item.iconPrefix || '';
      if (prefix) {
        ctx.fillText(prefix, slot.x - iconSz * 0.34, slot.y);
        const s = iconSz * 0.9;
        ctx.drawImage(img, slot.x + iconSz * 0.04, slot.y - s / 2, s, s);
      } else {
        ctx.drawImage(img, slot.x - iconSz / 2, slot.y - iconSz / 2, iconSz, iconSz);
      }
    } else {
      ctx.fillText(slot.item.icon, slot.x, slot.y);
    }

    // Value + damage sub-text show only for the selected (top) item, so the
    // rest of the ring stays uncluttered icons.
    const v = isSelected ? slot.item.val() : null;
    if (v) {
      ctx.font = 'bold 12px monospace';
      const w = Math.ceil(radialChipWidth(ctx, v, slot.item.iconImg)) + 10;
      const bx = slot.x, by = slot.y + slot.radius + 12;
      ctx.fillStyle = '#0a1a0a';
      ctx.fillRect(bx - w / 2, by - 8, w, 16);
      ctx.strokeStyle = '#4a6a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - w / 2, by - 8, w, 16);
      ctx.fillStyle = '#ffcc44';
      radialDrawChip(ctx, v, bx, by, slot.item.iconImg);
    }
    // Damage badge (only for the selected item, and only if it deals damage)
    if (isSelected && typeof slot.item.dmg === 'function') {
      const d = slot.item.dmg();
      if (d) {
        ctx.font = 'bold 11px monospace';
        const label = '⚔' + d;
        const w = Math.ceil(radialChipWidth(ctx, label, slot.item.iconImg)) + 10;
        const bx = slot.x, by = slot.y + slot.radius + 30;
        ctx.fillStyle = '#2a0a0a';
        ctx.fillRect(bx - w / 2, by - 8, w, 16);
        ctx.strokeStyle = '#6a2a2a';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - w / 2, by - 8, w, 16);
        ctx.fillStyle = '#ff7a7a';
        radialDrawChip(ctx, label, bx, by, slot.item.iconImg);
      }
    }
  }

  // Fixed selector caret — a small marker pinned at the top that the ring spins
  // its selected item up into, signalling where the "selection" actually sits.
  if (ease > 0.2) {
    const tipY = pcy - ring.radius * ease - 28 * ease - 4;
    ctx.fillStyle = `rgba(255, 220, 120, ${0.9 * ease})`;
    ctx.beginPath();
    ctx.moveTo(pcx, tipY + 9);
    ctx.lineTo(pcx - 7, tipY);
    ctx.lineTo(pcx + 7, tipY);
    ctx.closePath();
    ctx.fill();
  }

  // ── Center: ring name + chevrons + selected-item label ────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Up chevron
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255,220,120,0.85)';
  ctx.fillText('▲', pcx, pcy - 32);

  // Ring name (e.g. "SWORDS")
  ctx.font = 'bold 13px monospace';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(ring.name.toUpperCase(), pcx, pcy - 14);
  ctx.fillStyle = '#ffd070';
  ctx.fillText(ring.name.toUpperCase(), pcx, pcy - 14);

  // Ring index (1/5)
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`${radialRingIndex + 1}/${RADIAL_RINGS.length}`, pcx, pcy);

  // Selected item label
  const selItem = radialCurrentItems()[radialItemIndex];
  if (selItem) {
    ctx.font = 'bold 12px monospace';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(selItem.label, pcx, pcy + 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(selItem.label, pcx, pcy + 16);
  }

  // Down chevron
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255,220,120,0.85)';
  ctx.fillText('▼', pcx, pcy + 34);

  // Bottom-of-screen hint
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('▲▼ ring   ◀▶ item   Enter use   V/Esc close', PW / 2, PH - 24);

  ctx.restore();
}
