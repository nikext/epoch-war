/**
 * Doctrines — the twist on Age of War's evolve button. Each time a side evolves
 * it drafts one of three random doctrines, roguelite style, so no two wars
 * build the same army. The enemy drafts too, and you can see what it took.
 */

export interface Mods {
  unitDamage: number;
  unitHp: number;
  infantryDamage: number;
  heavyHp: number;
  speed: number;
  /** Multiplier on the reach of ranged units and turrets. */
  range: number;
  /** Multiplier on training speed (higher is faster). */
  trainSpeed: number;
  killGold: number;
  income: number;
  xp: number;
  turretRate: number;
  turretCost: number;
  slotCost: number;
  /** Multiplier on special cooldowns (lower is faster). */
  specialCd: number;
  /** Fraction of a fallen unit's price refunded. */
  salvage: number;
  baseHp: number;
  /** Wall regeneration, fraction of max HP per second. */
  baseRegen: number;
  /** Unit regeneration, fraction of max HP per second. */
  regen: number;
  startRank: number;
  /** Seconds between free infantry, 0 when off. */
  conscript: number;
  /** Multiplier on damage dealt to air units. */
  antiAir: number;
}

export function baseMods(): Mods {
  return {
    unitDamage: 1,
    unitHp: 1,
    infantryDamage: 1,
    heavyHp: 1,
    speed: 1,
    range: 1,
    trainSpeed: 1,
    killGold: 1,
    income: 1,
    xp: 1,
    turretRate: 1,
    turretCost: 1,
    slotCost: 1,
    specialCd: 1,
    salvage: 0,
    baseHp: 1,
    baseRegen: 0,
    regen: 0,
    startRank: 0,
    conscript: 0,
    antiAir: 1,
  };
}

export type DoctrineIcon =
  | 'coin'
  | 'wall'
  | 'clock'
  | 'star'
  | 'gear'
  | 'scope'
  | 'boot'
  | 'flag'
  | 'recycle'
  | 'bolt'
  | 'shield'
  | 'book'
  | 'bank'
  | 'heart'
  | 'fist'
  | 'radar'
  | 'hammer'
  | 'chest';

export interface Doctrine {
  id: string;
  name: string;
  icon: DoctrineIcon;
  desc: string;
  /** Earliest age at which this doctrine can be drafted (the age being entered). */
  minAge?: number;
  apply?: (m: Mods) => void;
  /** One-off effect applied the moment it is drafted, e.g. a gold windfall. */
  windfall?: number;
}

export const DOCTRINES: Doctrine[] = [
  { id: 'plunder', name: 'Plunder', icon: 'coin', desc: '+25% gold from every kill.', apply: (m) => (m.killGold += 0.25) },
  { id: 'fortify', name: 'Fortify', icon: 'wall', desc: 'Your wall gains +30% max HP and slowly repairs itself.',
    apply: (m) => { m.baseHp += 0.3; m.baseRegen += 0.004; } },
  { id: 'drill', name: 'Drill Sergeants', icon: 'clock', desc: 'Train units 35% faster.', apply: (m) => (m.trainSpeed += 0.35) },
  { id: 'veterans', name: 'Veteran Corps', icon: 'star', desc: 'New units arrive already promoted one rank.', apply: (m) => (m.startRank += 1) },
  { id: 'overclock', name: 'Overclocked Turrets', icon: 'gear', desc: 'Turrets fire 25% faster.', apply: (m) => (m.turretRate += 0.25) },
  { id: 'long-barrels', name: 'Long Barrels', icon: 'scope', desc: 'Ranged units and turrets reach 15% further.', apply: (m) => (m.range += 0.15) },
  { id: 'forced-march', name: 'Forced March', icon: 'boot', desc: 'All units move 20% faster.', apply: (m) => (m.speed += 0.2) },
  { id: 'conscription', name: 'Conscription', icon: 'flag', desc: 'A free infantry unit joins every 20 seconds.', apply: (m) => (m.conscript = 20) },
  { id: 'salvage', name: 'Salvage Crews', icon: 'recycle', desc: 'Recover 30% of the price of every unit you lose.', apply: (m) => (m.salvage += 0.3) },
  { id: 'blitz', name: 'Blitz Doctrine', icon: 'bolt', desc: 'Your special recharges 35% faster.', apply: (m) => (m.specialCd *= 0.65) },
  { id: 'iron-hide', name: 'Iron Hide', icon: 'shield', desc: 'Heavy units get +30% HP.', apply: (m) => (m.heavyHp += 0.3) },
  { id: 'scholars', name: 'Scholars', icon: 'book', desc: '+25% experience from everything.', apply: (m) => (m.xp += 0.25) },
  { id: 'war-bonds', name: 'War Bonds', icon: 'bank', desc: 'Double your passive income.', apply: (m) => (m.income += 1) },
  { id: 'field-medics', name: 'Field Medics', icon: 'heart', desc: 'Units regenerate 1.5% of their HP every second.', apply: (m) => (m.regen += 0.015) },
  { id: 'shock-troops', name: 'Shock Troops', icon: 'fist', desc: 'Infantry deal 25% more damage.', apply: (m) => (m.infantryDamage += 0.25) },
  { id: 'sky-shield', name: 'Sky Shield', icon: 'radar', minAge: 4, desc: 'Everything you own deals +50% damage to aircraft.',
    apply: (m) => (m.antiAir += 0.5) },
  { id: 'engineers', name: 'Engineers', icon: 'hammer', desc: 'Turrets cost 25% less; turret slots cost half.',
    apply: (m) => { m.turretCost *= 0.75; m.slotCost *= 0.5; } },
  { id: 'war-chest', name: 'War Chest', icon: 'chest', desc: 'A windfall: gold worth ten of your infantry, right now.', windfall: 10 },
  { id: 'hardened', name: 'Hardened', icon: 'shield', desc: 'All units get +12% HP.', apply: (m) => (m.unitHp += 0.12) },
  { id: 'sharpened', name: 'Sharpened Steel', icon: 'fist', desc: 'All units deal +10% damage.', apply: (m) => (m.unitDamage += 0.1) },
];

export function doctrine(id: string): Doctrine {
  const d = DOCTRINES.find((x) => x.id === id);
  if (!d) throw new Error(`unknown doctrine ${id}`);
  return d;
}
