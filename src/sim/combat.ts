import type { UnitClass } from './types';

/**
 * The counter table: how hard each class hits each other class. Rows attack,
 * columns defend. Reads as rock-paper-scissors with a few rules of thumb:
 * infantry is cheap and bad at armour; anti-armour melts heavies and little
 * else; heavies trample the light troops; only ranged fire, anti-air and
 * turrets can touch the flying layer.
 */
const TABLE: Record<UnitClass, Record<UnitClass, number>> = {
  //          infantry ranged antiArmor support armor  air   apex
  infantry: { infantry: 1.0, ranged: 1.3, antiArmor: 1.2, support: 1.3, armor: 0.65, air: 0, apex: 0.55 },
  ranged: { infantry: 1.0, ranged: 1.0, antiArmor: 1.1, support: 1.1, armor: 0.6, air: 1.3, apex: 0.55 },
  antiArmor: { infantry: 0.75, ranged: 0.75, antiArmor: 0.8, support: 0.8, armor: 2.2, air: 1.25, apex: 1.7 },
  support: { infantry: 1.0, ranged: 1.0, antiArmor: 1.0, support: 1.0, armor: 0.7, air: 1.0, apex: 0.6 },
  armor: { infantry: 1.4, ranged: 1.4, antiArmor: 1.2, support: 1.4, armor: 1.0, air: 0.6, apex: 0.9 },
  air: { infantry: 1.2, ranged: 1.2, antiArmor: 1.1, support: 1.2, armor: 0.9, air: 1.0, apex: 0.7 },
  apex: { infantry: 1.3, ranged: 1.3, antiArmor: 1.3, support: 1.3, armor: 1.3, air: 1.3, apex: 1.0 },
};

export function classMultiplier(attacker: UnitClass, defender: UnitClass): number {
  return TABLE[attacker][defender];
}

/** Short human text for tooltips: who a class beats and who beats it. */
export const CLASS_INFO: Record<UnitClass, { label: string; strong: string; weak: string }> = {
  infantry: { label: 'Infantry', strong: 'ranged & support', weak: 'armour, heavy units' },
  ranged: { label: 'Ranged', strong: 'aircraft, from behind the line', weak: 'armour, being caught' },
  antiArmor: { label: 'Anti-armour', strong: 'heavy units & aircraft', weak: 'infantry' },
  support: { label: 'Support', strong: 'keeping allies alive', weak: 'infantry' },
  armor: { label: 'Heavy', strong: 'infantry & ranged', weak: 'anti-armour' },
  air: { label: 'Aircraft', strong: 'flies over the melee', weak: 'ranged, anti-air, turrets' },
  apex: { label: 'Apex', strong: 'everything', weak: 'anti-armour en masse' },
};
