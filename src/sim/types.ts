/**
 * Shared vocabulary of the simulation. Nothing in here knows about three.js —
 * the sim runs headless in tools/ for balance runs, and the renderer only reads
 * it.
 */

export type SideId = 0 | 1;

/**
 * What a unit is, for the counter table in combat.ts. Age of War 2 split its
 * troops into infantry / support / anti-armor / armor; this keeps that and adds
 * a flying layer (from the Industrial Age on) and the single apex unit.
 */
export type UnitClass = 'infantry' | 'ranged' | 'antiArmor' | 'support' | 'armor' | 'air' | 'apex';

export type Layer = 'ground' | 'air';

/** Visual + behavioural kind of a projectile. The renderer keys models off it. */
export type ProjectileKind =
  | 'rock'
  | 'spear'
  | 'arrow'
  | 'bolt'
  | 'javelin'
  | 'fireball'
  | 'sunbolt'
  | 'bullet'
  | 'musketball'
  | 'cannonball'
  | 'shell'
  | 'grenade'
  | 'rocket'
  | 'missile'
  | 'laser'
  | 'plasma'
  | 'rail'
  | 'egg'
  | 'boulder'
  | 'oil'
  | 'meteor'
  | 'bomb'
  | 'drone'
  | 'firepot'
  | 'flak';

/**
 * How an attack lands.
 * - melee:      damage at the windup moment, to the target in reach
 * - projectile: spawns a projectile that flies to the target (optionally splashing)
 * - hitscan:    instant damage; the renderer draws a tracer / muzzle flash
 * - beam:       instant damage; the renderer draws a sustained beam
 * - flame:      short cone — hits up to `maxTargets` enemies in reach
 * - chain:      hits the target, then arcs to nearby enemies with falloff
 * - pierce:     hits every enemy on the line out to full range
 * - heal:       heals the most wounded ally in reach (falls back to `fallback`)
 */
export type AttackKind = 'melee' | 'projectile' | 'hitscan' | 'beam' | 'flame' | 'chain' | 'pierce' | 'heal';

export interface AttackSpec {
  kind: AttackKind;
  projectile?: ProjectileKind;
  /** Projectile speed in m/s. */
  speed?: number;
  /** Arc height as a fraction of the flight distance (0 = straight line). */
  arc?: number;
  /** Splash radius in metres (0 = single target). */
  splash?: number;
  /** For flame / chain: how many enemies one attack can touch. */
  maxTargets?: number;
  /** Rounds per attack, purely for the tracer/muzzle visuals of hitscan bursts. */
  burst?: number;
  /** A heal attack's backup plan when nobody needs healing. */
  fallback?: AttackSpec;
}

export interface UnitDef {
  id: string;
  name: string;
  age: number;
  cls: UnitClass;
  layer: Layer;
  cost: number;
  /** Population slots taken while alive. */
  pop: number;
  trainTime: number;
  hp: number;
  /** Metres per second. */
  speed: number;
  /** Footprint along the lane, metres. Used for spacing and reach. */
  size: number;
  /** Reach, measured from this unit's front edge to the target's near edge. */
  range: number;
  damage: number;
  /** Seconds between attacks. */
  interval: number;
  /** Seconds from the start of an attack to the moment it lands / fires. */
  windup: number;
  attack: AttackSpec;
  hitsAir: boolean;
  /** Extra multipliers on top of the class table, keyed by defender class. */
  bonus?: Partial<Record<UnitClass, number>>;
  /** Multiplier against bases. Siege weapons are good at knocking walls down. */
  vsBase?: number;
  /** Healing per pulse, for support units. */
  heal?: number;
  /** One-time research needed before the unit can be trained (AoW2's huts and armories). */
  unlockCost?: number;
  unlockName?: string;
  /** Model key for the renderer. */
  model: string;
  /** Muzzle / hand height in metres, where projectiles start. */
  muzzle: number;
  /** Flying altitude for air units. */
  altitude?: number;
  desc: string;
  hotkey?: string;
}

export type TurretRole = 'basic' | 'rapid' | 'heavy' | 'splash' | 'flak' | 'beam' | 'chain' | 'pierce';

export interface TurretDef {
  id: string;
  name: string;
  age: number;
  role: TurretRole;
  cost: number;
  damage: number;
  interval: number;
  range: number;
  /** Turrets cannot hit what is right under the wall if they lob shells. */
  minRange?: number;
  attack: AttackSpec;
  hitsAir: boolean;
  hitsGround: boolean;
  bonus?: Partial<Record<UnitClass, number>>;
  model: string;
  desc: string;
}

export type SpecialId = 'meteor' | 'zeus' | 'arrows' | 'rally' | 'bomber' | 'drones' | 'override';

export interface SpecialDef {
  id: SpecialId;
  name: string;
  age: number;
  cooldown: number;
  /** Whether the player picks a spot on the battlefield. */
  aimed: boolean;
  /** Half-width of the aimed zone, metres. */
  radius: number;
  damage: number;
  desc: string;
}

export interface AgeDef {
  index: number;
  id: string;
  name: string;
  tagline: string;
  /** XP needed to evolve out of this age (null in the final age). */
  xpToNext: number | null;
  baseHp: number;
  popCap: number;
  /** Passive income, gold per second. */
  income: number;
  /** One-off cost of each extra turret slot bought in this age. */
  slotCosts: [number, number, number];
  /** Cost of one armory upgrade level, before the level multiplier. */
  upgradeCost: number;
  units: UnitDef[];
  turrets: TurretDef[];
  special: SpecialDef;
  /** Accent colour for the HUD while this age is current. */
  accent: string;
}

export type Stance = 'advance' | 'hold';

export type Difficulty = 'recruit' | 'veteran' | 'general' | 'impossible';

export type UpgradeTrack = 'weapons' | 'armor' | 'economy';
