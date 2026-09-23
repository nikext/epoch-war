import type { AgeDef, AttackSpec, SpecialDef, TurretDef, TurretRole, UnitClass, UnitDef } from '../types';

/**
 * The seven ages. Age of War 1 had five (Stone → Future) with three units
 * each; Age of War 2 had seven, four units each, with the heavy unit locked
 * behind a building. This keeps AoW2's shape — four units, the heavy one
 * researched — and bends the timeline toward today: the last three ages add a
 * flying unit, and the war ends in the Age of Intelligence.
 *
 * Numbers are generated from per-class archetypes scaled by GROWTH per age, so
 * a unit is always ~1.6× the one it replaces in HP, damage and price — a unit
 * one age ahead is ~2.5× as strong for 1.6× the gold. Per-unit multipliers
 * give each one its character.
 */

export const GROWTH = 1.6;
const g = (age: number): number => Math.pow(GROWTH, age);

interface Archetype {
  cost: number;
  hp: number;
  damage: number;
  interval: number;
  windup: number;
  range: number;
  speed: number;
  size: number;
  trainTime: number;
  pop: number;
  hitsAir: boolean;
}

const ARCHETYPES: Record<UnitClass, Archetype> = {
  infantry: { cost: 15, hp: 70, damage: 14, interval: 1.0, windup: 0.42, range: 0.7, speed: 3.0, size: 0.9, trainTime: 1.2, pop: 1, hitsAir: false },
  ranged: { cost: 25, hp: 45, damage: 10, interval: 1.4, windup: 0.55, range: 13, speed: 2.8, size: 0.9, trainTime: 1.6, pop: 1, hitsAir: true },
  antiArmor: { cost: 40, hp: 60, damage: 14, interval: 1.7, windup: 0.6, range: 8, speed: 2.8, size: 0.9, trainTime: 2.0, pop: 1, hitsAir: false },
  support: { cost: 45, hp: 55, damage: 7, interval: 1.6, windup: 0.6, range: 9, speed: 2.8, size: 0.9, trainTime: 2.0, pop: 1, hitsAir: true },
  armor: { cost: 100, hp: 290, damage: 30, interval: 1.4, windup: 0.55, range: 1.0, speed: 3.3, size: 2.2, trainTime: 3.5, pop: 2, hitsAir: false },
  air: { cost: 120, hp: 130, damage: 18, interval: 1.3, windup: 0.4, range: 11, speed: 3.6, size: 2.4, trainTime: 3.2, pop: 2, hitsAir: true },
  apex: { cost: 540, hp: 2000, damage: 110, interval: 1.6, windup: 0.8, range: 14, speed: 1.9, size: 5.5, trainTime: 12, pop: 5, hitsAir: true },
};

interface UnitSpec {
  id: string;
  name: string;
  cls: UnitClass;
  model: string;
  desc: string;
  attack: AttackSpec;
  muzzle: number;
  /** Multipliers on the archetype. */
  hp?: number;
  damage?: number;
  cost?: number;
  speed?: number;
  interval?: number;
  /** Absolute overrides. */
  range?: number;
  size?: number;
  windup?: number;
  trainTime?: number;
  pop?: number;
  hitsAir?: boolean;
  layer?: 'ground' | 'air';
  altitude?: number;
  bonus?: UnitDef['bonus'];
  vsBase?: number;
  heal?: number;
  unlockCost?: number;
  unlockName?: string;
}

function unit(age: number, spec: UnitSpec): UnitDef {
  const a = ARCHETYPES[spec.cls];
  const s = g(age);
  const def: UnitDef = {
    id: spec.id,
    name: spec.name,
    age,
    cls: spec.cls,
    layer: spec.layer ?? (spec.cls === 'air' ? 'air' : 'ground'),
    cost: Math.round((a.cost * s * (spec.cost ?? 1)) / 5) * 5 || Math.round(a.cost * s * (spec.cost ?? 1)),
    pop: spec.pop ?? a.pop,
    trainTime: spec.trainTime ?? a.trainTime,
    hp: Math.round(a.hp * s * (spec.hp ?? 1)),
    speed: a.speed * (spec.speed ?? 1),
    size: spec.size ?? a.size,
    range: spec.range ?? a.range,
    damage: Math.round(a.damage * s * (spec.damage ?? 1) * 10) / 10,
    interval: a.interval * (spec.interval ?? 1),
    windup: spec.windup ?? a.windup * (spec.interval ?? 1),
    attack: spec.attack,
    hitsAir: spec.hitsAir ?? a.hitsAir,
    model: spec.model,
    muzzle: spec.muzzle,
    desc: spec.desc,
  };
  if (spec.altitude !== undefined) def.altitude = spec.altitude;
  if (spec.bonus) def.bonus = spec.bonus;
  if (spec.vsBase !== undefined) def.vsBase = spec.vsBase;
  if (spec.heal !== undefined) def.heal = Math.round(spec.heal * s);
  if (spec.unlockCost !== undefined) def.unlockCost = spec.unlockCost;
  if (spec.unlockName !== undefined) def.unlockName = spec.unlockName;
  return def;
}

interface TurretArchetype {
  cost: number;
  damage: number;
  interval: number;
  range: number;
  minRange?: number;
  hitsAir: boolean;
  hitsGround: boolean;
  bonus?: TurretDef['bonus'];
}

const GROUND_WEAK = { infantry: 0.55, ranged: 0.55, antiArmor: 0.55, support: 0.55, armor: 0.45, apex: 0.4 } as const;

const TURRET_ARCHETYPES: Record<TurretRole, TurretArchetype> = {
  basic: { cost: 100, damage: 16, interval: 1.0, range: 22, hitsAir: true, hitsGround: true },
  rapid: { cost: 220, damage: 6.5, interval: 0.3, range: 20, hitsAir: true, hitsGround: true, bonus: { armor: 0.6, apex: 0.5, infantry: 1.1 } },
  heavy: { cost: 320, damage: 44, interval: 2.0, range: 26, hitsAir: false, hitsGround: true, bonus: { armor: 1.7, apex: 1.5 } },
  splash: { cost: 520, damage: 30, interval: 2.5, range: 28, minRange: 4, hitsAir: false, hitsGround: true },
  flak: { cost: 360, damage: 26, interval: 1.0, range: 30, hitsAir: true, hitsGround: true, bonus: { air: 2.2, ...GROUND_WEAK } },
  beam: { cost: 300, damage: 11, interval: 0.4, range: 24, hitsAir: true, hitsGround: true, bonus: { air: 1.2 } },
  chain: { cost: 560, damage: 30, interval: 1.7, range: 21, hitsAir: true, hitsGround: true },
  pierce: { cost: 620, damage: 64, interval: 2.8, range: 34, hitsAir: false, hitsGround: true, bonus: { armor: 1.4, apex: 1.4 } },
};

interface TurretSpec {
  id: string;
  name: string;
  role: TurretRole;
  model: string;
  desc: string;
  attack: AttackSpec;
  cost?: number;
  damage?: number;
  interval?: number;
  range?: number;
  minRange?: number;
  hitsAir?: boolean;
}

function turret(age: number, spec: TurretSpec): TurretDef {
  const a = TURRET_ARCHETYPES[spec.role];
  const s = g(age);
  const def: TurretDef = {
    id: spec.id,
    name: spec.name,
    age,
    role: spec.role,
    cost: Math.round((a.cost * s * (spec.cost ?? 1)) / 10) * 10,
    damage: Math.round(a.damage * s * (spec.damage ?? 1) * 10) / 10,
    interval: a.interval * (spec.interval ?? 1),
    range: spec.range ?? a.range,
    attack: spec.attack,
    hitsAir: spec.hitsAir ?? a.hitsAir,
    hitsGround: a.hitsGround,
    model: spec.model,
    desc: spec.desc,
  };
  const minRange = spec.minRange ?? a.minRange;
  if (minRange !== undefined) def.minRange = minRange;
  if (a.bonus) def.bonus = a.bonus;
  return def;
}

function special(age: number, spec: Omit<SpecialDef, 'age'>): SpecialDef {
  return { ...spec, age };
}

const melee: AttackSpec = { kind: 'melee' };

// ─── Age 0 · Stone ──────────────────────────────────────────────────────────

const STONE: AgeDef = {
  index: 0,
  id: 'stone',
  name: 'Stone Age',
  tagline: 'The first spark',
  xpToNext: 2000,
  baseHp: 900,
  popCap: 10,
  income: 2.2,
  slotCosts: [150, 450, 1100],
  upgradeCost: 90,
  accent: '#f0a04b',
  units: [
    unit(0, { id: 'clubber', name: 'Clubber', cls: 'infantry', model: 'clubber', muzzle: 1.2, attack: melee,
      desc: 'Solves every problem with a heavier stick.' }),
    unit(0, { id: 'slinger', name: 'Slinger', cls: 'ranged', model: 'slinger', muzzle: 1.6,
      attack: { kind: 'projectile', projectile: 'rock', speed: 24, arc: 0.18 },
      desc: 'Hurls river stones from behind the front line.' }),
    unit(0, { id: 'spear-hunter', name: 'Spear Hunter', cls: 'antiArmor', model: 'spearHunter', muzzle: 1.6,
      attack: { kind: 'projectile', projectile: 'spear', speed: 22, arc: 0.14 },
      desc: 'Brought down mammoths. A tamed dinosaur is no different.' }),
    unit(0, { id: 'trike-rider', name: 'Trike Rider', cls: 'armor', model: 'trikeRider', muzzle: 1.4, attack: melee,
      unlockCost: 300, unlockName: 'Beast Pen', size: 2.6,
      desc: 'A triceratops, a saddle and one very brave rider.' }),
  ],
  turrets: [
    turret(0, { id: 'rock-sling', name: 'Rock Sling', role: 'basic', model: 'rockSling',
      attack: { kind: 'projectile', projectile: 'rock', speed: 26, arc: 0.2 },
      desc: 'A bent tree and a lot of rocks.' }),
    turret(0, { id: 'egg-launcher', name: 'Egg Launcher', role: 'rapid', model: 'eggLauncher',
      attack: { kind: 'projectile', projectile: 'egg', speed: 26, arc: 0.18 },
      desc: 'An enraged hen, as tradition demands. Rapid fire.' }),
    turret(0, { id: 'boulder-catapult', name: 'Boulder Catapult', role: 'splash', model: 'boulderCatapult',
      attack: { kind: 'projectile', projectile: 'boulder', speed: 16, arc: 0.45, splash: 3.2 },
      desc: 'Lobs boulders into crowds. Cannot hit what is under the wall.' }),
  ],
  special: special(0, { id: 'meteor', name: 'Meteor Shower', cooldown: 45, aimed: true, radius: 14, damage: 30,
    desc: 'Rocks rain from the sky for five seconds over the chosen ground.' }),
};

// ─── Age 1 · Ancient ────────────────────────────────────────────────────────

const ANCIENT: AgeDef = {
  index: 1,
  id: 'ancient',
  name: 'Ancient Age',
  tagline: 'Bronze, marble and myth',
  xpToNext: 4000,
  baseHp: 1550,
  popCap: 12,
  income: 3.5,
  slotCosts: [240, 720, 1760],
  upgradeCost: 145,
  accent: '#e3c05a',
  units: [
    unit(1, { id: 'hoplite', name: 'Hoplite', cls: 'infantry', model: 'hoplite', muzzle: 1.3, attack: melee,
      hp: 1.15, damage: 0.95, desc: 'Bronze shield, long spear, no intention of stepping back.' }),
    unit(1, { id: 'archer', name: 'Archer', cls: 'ranged', model: 'archer', muzzle: 1.6,
      attack: { kind: 'projectile', projectile: 'arrow', speed: 34, arc: 0.2 }, range: 15,
      desc: 'Composite bow, steady hands, a quiver that never seems to empty.' }),
    unit(1, { id: 'sun-priest', name: 'Sun Priest', cls: 'support', model: 'sunPriest', muzzle: 1.8,
      attack: { kind: 'heal', fallback: { kind: 'projectile', projectile: 'sunbolt', speed: 20, arc: 0.05 } },
      heal: 20, desc: 'Mends the wounded. When no one bleeds, calls down the sun.' }),
    unit(1, { id: 'war-elephant', name: 'War Elephant', cls: 'armor', model: 'warElephant', muzzle: 2.8, attack: melee,
      hp: 1.3, speed: 0.8, size: 3.2, range: 1.3, unlockCost: 500, unlockName: 'Elephant Stables',
      desc: 'Six tonnes of grumpy. Crushes anything that stands in front of it.' }),
  ],
  turrets: [
    turret(1, { id: 'bow-nest', name: 'Bow Nest', role: 'basic', model: 'bowNest',
      attack: { kind: 'projectile', projectile: 'arrow', speed: 36, arc: 0.2 },
      desc: 'A sheltered archer post on the walls.' }),
    turret(1, { id: 'scorpion', name: 'Scorpion', role: 'heavy', model: 'scorpion',
      attack: { kind: 'projectile', projectile: 'javelin', speed: 42, arc: 0.06 },
      desc: 'A torsion bolt-thrower that punches through armour.' }),
    turret(1, { id: 'greek-fire', name: 'Greek Fire', role: 'splash', model: 'greekFire',
      attack: { kind: 'projectile', projectile: 'firepot', speed: 18, arc: 0.4, splash: 3.4 },
      desc: 'Throws pots of fire that water will not put out.' }),
  ],
  special: special(1, { id: 'zeus', name: 'Wrath of Zeus', cooldown: 50, aimed: false, radius: 0, damage: 150,
    desc: 'Seven thunderbolts strike the mightiest enemies on the field.' }),
};

// ─── Age 2 · Medieval ───────────────────────────────────────────────────────

const MEDIEVAL: AgeDef = {
  index: 2,
  id: 'medieval',
  name: 'Medieval Age',
  tagline: 'Steel, stone and banners',
  xpToNext: 9200,
  baseHp: 2650,
  popCap: 14,
  income: 5.6,
  slotCosts: [380, 1150, 2800],
  upgradeCost: 230,
  accent: '#86aee8',
  units: [
    unit(2, { id: 'man-at-arms', name: 'Man-at-Arms', cls: 'infantry', model: 'manAtArms', muzzle: 1.3, attack: melee,
      hp: 1.1, desc: 'Mail, a kite shield and a sword that has seen things.' }),
    unit(2, { id: 'crossbowman', name: 'Crossbowman', cls: 'ranged', model: 'crossbowman', muzzle: 1.4,
      attack: { kind: 'projectile', projectile: 'bolt', speed: 44, arc: 0.06 }, damage: 1.3, interval: 1.25, range: 14,
      desc: 'Slow to reload, but a bolt goes through almost anything.' }),
    unit(2, { id: 'pikeman', name: 'Pikeman', cls: 'antiArmor', model: 'pikeman', muzzle: 1.6, attack: melee,
      range: 2.6, hp: 1.3, damage: 1.2, interval: 0.8,
      desc: 'A five-metre pike. Strikes from the second rank; cavalry hates him.' }),
    unit(2, { id: 'knight', name: 'Knight', cls: 'armor', model: 'knight', muzzle: 1.9, attack: melee,
      speed: 1.1, size: 2.6, unlockCost: 800, unlockName: 'Tiltyard',
      desc: 'Full plate on a barded warhorse. The tank of its day.' }),
  ],
  turrets: [
    turret(2, { id: 'arbalest', name: 'Arbalest', role: 'basic', model: 'arbalest',
      attack: { kind: 'projectile', projectile: 'bolt', speed: 46, arc: 0.06 },
      desc: 'A wall-mounted crossbow the size of a cart.' }),
    turret(2, { id: 'boiling-oil', name: 'Boiling Oil', role: 'heavy', model: 'boilingOil',
      attack: { kind: 'projectile', projectile: 'oil', speed: 10, arc: 0.3, splash: 3.2 }, range: 8, damage: 1.25,
      hitsAir: false, desc: 'A classic. Only reaches the foot of the wall, but nothing survives it.' }),
    turret(2, { id: 'trebuchet', name: 'Trebuchet', role: 'splash', model: 'trebuchet',
      attack: { kind: 'projectile', projectile: 'boulder', speed: 17, arc: 0.5, splash: 3.6 }, range: 32,
      desc: 'Counterweight siege engine. Longest reach of its age.' }),
  ],
  special: special(2, { id: 'arrows', name: 'Arrow Storm', cooldown: 50, aimed: true, radius: 18, damage: 40,
    desc: 'A thousand archers darken the sky over the chosen ground.' }),
};

// ─── Age 3 · Gunpowder ──────────────────────────────────────────────────────

const GUNPOWDER: AgeDef = {
  index: 3,
  id: 'gunpowder',
  name: 'Gunpowder Age',
  tagline: 'Powder, sail and empire',
  xpToNext: 18000,
  baseHp: 4500,
  popCap: 16,
  income: 9,
  slotCosts: [610, 1840, 4500],
  upgradeCost: 370,
  accent: '#e0674c',
  units: [
    unit(3, { id: 'duelist', name: 'Duelist', cls: 'infantry', model: 'duelist', muzzle: 1.3, attack: melee,
      damage: 0.72, interval: 0.7, speed: 1.08, desc: 'Rapier, flourish, riposte. Quick on his feet.' }),
    unit(3, { id: 'musketeer', name: 'Musketeer', cls: 'ranged', model: 'musketeer', muzzle: 1.45,
      attack: { kind: 'hitscan', projectile: 'musketball' }, damage: 1.6, interval: 1.6, range: 15,
      desc: 'One loud, smoky, devastating shot every few seconds.' }),
    unit(3, { id: 'field-cannon', name: 'Field Cannon', cls: 'antiArmor', model: 'fieldCannon', muzzle: 0.9,
      attack: { kind: 'projectile', projectile: 'cannonball', speed: 30, arc: 0.12, splash: 1.8 },
      range: 18, size: 2.0, speed: 0.75, damage: 1.2, interval: 1.35, vsBase: 1.6, cost: 1.2,
      desc: 'A bronze six-pounder and its gunner. Levels walls and horsemen alike.' }),
    unit(3, { id: 'cuirassier', name: 'Cuirassier', cls: 'armor', model: 'cuirassier', muzzle: 1.9, attack: melee,
      speed: 1.2, size: 2.6, unlockCost: 1300, unlockName: 'Cavalry School',
      desc: 'Breastplate, heavy sabre, a charge you can feel through the ground.' }),
  ],
  turrets: [
    turret(3, { id: 'swivel-gun', name: 'Swivel Gun', role: 'rapid', model: 'swivelGun',
      attack: { kind: 'hitscan', projectile: 'musketball' }, interval: 1.6, damage: 1.6,
      desc: 'A small breech-loading gun that sprays grapeshot.' }),
    turret(3, { id: 'long-cannon', name: 'Long Cannon', role: 'heavy', model: 'longCannon',
      attack: { kind: 'projectile', projectile: 'cannonball', speed: 40, arc: 0.08, splash: 1.2 },
      desc: 'A naval long gun, dragged up onto the ramparts.' }),
    turret(3, { id: 'mortar', name: 'Mortar', role: 'splash', model: 'mortar',
      attack: { kind: 'projectile', projectile: 'shell', speed: 17, arc: 0.6, splash: 3.8 },
      desc: 'High-arcing explosive shells. Devastating on crowds.' }),
  ],
  special: special(3, { id: 'rally', name: 'Rally the Colours', cooldown: 55, aimed: false, radius: 0, damage: 0,
    desc: 'Drums and banners: every soldier heals half their wounds and fights 30% harder for 10 seconds.' }),
};

// ─── Age 4 · Industrial ─────────────────────────────────────────────────────

const INDUSTRIAL: AgeDef = {
  index: 4,
  id: 'industrial',
  name: 'Industrial Age',
  tagline: 'Steam, steel and trenches',
  xpToNext: 31000,
  baseHp: 7600,
  popCap: 18,
  income: 14.5,
  slotCosts: [980, 2950, 7200],
  upgradeCost: 590,
  accent: '#b9b86e',
  units: [
    unit(4, { id: 'trench-raider', name: 'Trench Raider', cls: 'infantry', model: 'trenchRaider', muzzle: 1.3, attack: melee,
      hp: 1.05, desc: 'Steel helmet, fixed bayonet, a trench shovel for emergencies.' }),
    unit(4, { id: 'machine-gunner', name: 'Machine Gunner', cls: 'ranged', model: 'machineGunner', muzzle: 1.1,
      attack: { kind: 'hitscan', projectile: 'bullet', burst: 4 }, interval: 0.8, damage: 0.7, range: 14,
      desc: 'Belt-fed and bipod-mounted. Shreds infantry, and biplanes too.' }),
    unit(4, { id: 'flametrooper', name: 'Flametrooper', cls: 'antiArmor', model: 'flametrooper', muzzle: 1.1,
      attack: { kind: 'flame', maxTargets: 3 }, range: 4.5, damage: 0.9, interval: 0.9, hp: 1.3,
      bonus: { infantry: 1.8, ranged: 1.8, support: 1.8 },
      desc: 'Clears trenches in a single breath. Burns through a crowd, and tanks too.' }),
    unit(4, { id: 'landship', name: 'Landship', cls: 'armor', model: 'landship', muzzle: 1.6,
      attack: { kind: 'projectile', projectile: 'shell', speed: 34, arc: 0.06, splash: 1.5 }, range: 10,
      hp: 1.2, speed: 0.72, size: 4.2, vsBase: 1.3, unlockCost: 2000, unlockName: 'Tank Works',
      desc: 'A rhomboid steel fortress on tracks. Slow, loud, unstoppable.' }),
    unit(4, { id: 'biplane', name: 'Biplane', cls: 'air', model: 'biplane', muzzle: 0, altitude: 8.5,
      attack: { kind: 'hitscan', projectile: 'bullet', burst: 3 }, range: 12,
      desc: 'Flies over the front line. Only guns, turrets and specials can reach it.' }),
  ],
  turrets: [
    turret(4, { id: 'maxim-nest', name: 'Maxim Nest', role: 'rapid', model: 'maximNest',
      attack: { kind: 'hitscan', projectile: 'bullet', burst: 1 }, desc: 'Water-cooled machine gun in a sandbag nest.' }),
    turret(4, { id: 'flak-cannon', name: 'Flak Cannon', role: 'flak', model: 'flakCannon',
      attack: { kind: 'projectile', projectile: 'flak', speed: 60, arc: 0, splash: 2.0 },
      desc: 'Anti-aircraft gun. Bursts shrapnel around anything that flies.' }),
    turret(4, { id: 'howitzer', name: 'Howitzer', role: 'splash', model: 'howitzer',
      attack: { kind: 'projectile', projectile: 'shell', speed: 22, arc: 0.45, splash: 4.2 }, range: 32,
      desc: 'Heavy artillery. Craters the ground where enemies gather.' }),
  ],
  special: special(4, { id: 'bomber', name: 'Bomber Run', cooldown: 60, aimed: true, radius: 22, damage: 130,
    desc: 'A heavy bomber crosses the field, dropping a line of bombs.' }),
};

// ─── Age 5 · Modern ─────────────────────────────────────────────────────────

const MODERN: AgeDef = {
  index: 5,
  id: 'modern',
  name: 'Modern Age',
  tagline: 'Satellites, stealth and silicon',
  xpToNext: 62000,
  baseHp: 12800,
  popCap: 20,
  income: 23,
  slotCosts: [1570, 4720, 11500],
  upgradeCost: 950,
  accent: '#56c2e6',
  units: [
    unit(5, { id: 'assault-trooper', name: 'Assault Trooper', cls: 'infantry', model: 'assaultTrooper', muzzle: 1.35,
      attack: { kind: 'hitscan', projectile: 'bullet', burst: 3 }, range: 4, hp: 1.05,
      desc: 'Plate carrier, night vision, carbine. Fights at close quarters.' }),
    unit(5, { id: 'marksman', name: 'Marksman', cls: 'ranged', model: 'marksman', muzzle: 1.4,
      attack: { kind: 'hitscan', projectile: 'bullet', burst: 1 }, range: 20, damage: 1.9, interval: 1.7,
      desc: 'Long rifle, longer patience. Picks off targets far behind the line.' }),
    unit(5, { id: 'rocket-trooper', name: 'Rocket Trooper', cls: 'antiArmor', model: 'rocketTrooper', muzzle: 1.5,
      attack: { kind: 'projectile', projectile: 'rocket', speed: 30, arc: 0.03, splash: 1.3 }, range: 13, hitsAir: true,
      damage: 1.15, desc: 'Shoulder-fired missiles. Kills tanks and helicopters.' }),
    unit(5, { id: 'battle-tank', name: 'Battle Tank', cls: 'armor', model: 'battleTank', muzzle: 1.9,
      attack: { kind: 'projectile', projectile: 'shell', speed: 50, arc: 0.02, splash: 1.6 }, range: 12,
      hp: 1.25, speed: 0.9, size: 4.4, vsBase: 1.3, unlockCost: 3300, unlockName: 'Armor Division',
      desc: 'Composite armour and a 120 mm gun that fires on the move.' }),
    unit(5, { id: 'gunship', name: 'Gunship', cls: 'air', model: 'gunship', muzzle: 0, altitude: 9,
      attack: { kind: 'projectile', projectile: 'missile', speed: 36, arc: 0.02, splash: 1.4 }, range: 13,
      desc: 'Attack helicopter. Hovers above the fray and fires guided missiles.' }),
  ],
  turrets: [
    turret(5, { id: 'ciws', name: 'CIWS Gatling', role: 'rapid', model: 'ciws',
      attack: { kind: 'hitscan', projectile: 'bullet', burst: 1 }, interval: 0.6, damage: 0.6,
      desc: 'Radar-guided rotary cannon. Shreds infantry and aircraft.' }),
    turret(5, { id: 'missile-battery', name: 'Missile Battery', role: 'heavy', model: 'missileBattery',
      attack: { kind: 'projectile', projectile: 'missile', speed: 34, arc: 0.1, splash: 1.4 }, hitsAir: true,
      desc: 'Fire-and-forget missiles that seek armour — or aircraft.' }),
    turret(5, { id: 'artillery', name: 'Rocket Artillery', role: 'splash', model: 'artillery',
      attack: { kind: 'projectile', projectile: 'rocket', speed: 26, arc: 0.4, splash: 4.4 }, range: 34,
      desc: 'Saturates an area with rockets.' }),
  ],
  special: special(5, { id: 'drones', name: 'Drone Swarm', cooldown: 60, aimed: false, radius: 0, damage: 240,
    desc: 'Ten FPV kamikaze drones hunt down the most valuable enemies.' }),
};

// ─── Age 6 · Intelligence ───────────────────────────────────────────────────

const INTELLIGENCE: AgeDef = {
  index: 6,
  id: 'intelligence',
  name: 'Age of Intelligence',
  tagline: 'The last invention',
  xpToNext: null,
  baseHp: 21500,
  popCap: 24,
  income: 37,
  slotCosts: [2520, 7550, 18400],
  upgradeCost: 1520,
  accent: '#b77bff',
  units: [
    unit(6, { id: 'robo-hound', name: 'Robo-Hound', cls: 'infantry', model: 'roboHound', muzzle: 0.7, attack: melee,
      speed: 1.45, hp: 0.95, size: 1.3, desc: 'Quadruped combat robot. Fast, relentless, never tires.' }),
    unit(6, { id: 'android', name: 'Android', cls: 'ranged', model: 'android', muzzle: 1.45,
      attack: { kind: 'projectile', projectile: 'plasma', speed: 42, arc: 0.02 }, range: 16, hp: 1.2,
      desc: 'Humanoid robot with a plasma rifle. Aims better than any human.' }),
    unit(6, { id: 'railgunner', name: 'Railgunner', cls: 'antiArmor', model: 'railgunner', muzzle: 1.4,
      attack: { kind: 'pierce', projectile: 'rail' }, range: 18, damage: 1.4, interval: 1.3,
      desc: 'Magnetic rail rifle. The slug passes through everything on the line.' }),
    unit(6, { id: 'warden-mech', name: 'Warden Mech', cls: 'armor', model: 'wardenMech', muzzle: 3.2,
      attack: { kind: 'beam', projectile: 'laser' }, range: 9, hp: 1.3, speed: 0.8, size: 3.6, hitsAir: true,
      unlockCost: 5500, unlockName: 'Mech Foundry',
      desc: 'Four-metre walking fortress with twin lasers. Hits air and ground.' }),
    unit(6, { id: 'swarm', name: 'Nano Swarm', cls: 'air', model: 'swarm', muzzle: 0, altitude: 6.5,
      attack: { kind: 'chain', maxTargets: 3 }, range: 7, size: 2.2,
      desc: 'A cloud of micro-drones that arcs lightning between its targets.' }),
    unit(6, { id: 'omega', name: 'OMEGA Model', cls: 'apex', model: 'omega', muzzle: 5.2,
      attack: { kind: 'beam', projectile: 'laser' }, range: 15, unlockCost: 14000, unlockName: 'Compute Cluster',
      desc: 'A superintelligence given a body. The war ends when it arrives.' }),
  ],
  turrets: [
    turret(6, { id: 'laser-turret', name: 'Laser Turret', role: 'beam', model: 'laserTurret',
      attack: { kind: 'beam', projectile: 'laser' }, desc: 'Continuous-wave laser. Hits air and ground with perfect accuracy.' }),
    turret(6, { id: 'railgun', name: 'Railgun', role: 'pierce', model: 'railgunTurret',
      attack: { kind: 'pierce', projectile: 'rail' }, desc: 'Hypervelocity slug. Pierces every enemy on the lane.' }),
    turret(6, { id: 'tesla-node', name: 'Tesla Node', role: 'chain', model: 'teslaNode',
      attack: { kind: 'chain', maxTargets: 4 }, desc: 'Arcs lightning from enemy to enemy.' }),
  ],
  special: special(6, { id: 'override', name: 'Override', cooldown: 70, aimed: true, radius: 16, damage: 0,
    desc: 'Hacks up to four enemy units in the zone to fight for you, and stuns the rest with an EMP.' }),
};

export const AGES: AgeDef[] = [STONE, ANCIENT, MEDIEVAL, GUNPOWDER, INDUSTRIAL, MODERN, INTELLIGENCE];

export const MAX_AGE = AGES.length - 1;

export const UNITS: Map<string, UnitDef> = new Map(AGES.flatMap((a) => a.units.map((u) => [u.id, u] as const)));
export const TURRETS: Map<string, TurretDef> = new Map(AGES.flatMap((a) => a.turrets.map((t) => [t.id, t] as const)));

export function unitDef(id: string): UnitDef {
  const def = UNITS.get(id);
  if (!def) throw new Error(`unknown unit ${id}`);
  return def;
}

export function turretDef(id: string): TurretDef {
  const def = TURRETS.get(id);
  if (!def) throw new Error(`unknown turret ${id}`);
  return def;
}

/** Scale of numbers in a given age (used by specials and the armory). */
export function ageScale(age: number): number {
  return g(age);
}
