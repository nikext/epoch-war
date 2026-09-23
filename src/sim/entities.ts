import type { AttackKind, ProjectileKind, SideId, SpecialId, Stance, TurretDef, UnitClass, UnitDef, UpgradeTrack } from './types';
import type { Mods } from './data/doctrines';

export interface Unit {
  id: number;
  side: SideId;
  def: UnitDef;
  /** Lane position of the unit's centre. */
  x: number;
  /** Position at the previous tick, for render interpolation. */
  prevX: number;
  /** Height of the unit's feet: 0 for ground troops, cruise altitude for aircraft. */
  y: number;
  hp: number;
  maxHp: number;
  state: 'walk' | 'idle' | 'attack' | 'retreat';
  /** Seconds since the current attack started (drives the swing animation). */
  attackTime: number;
  /** Seconds until another attack may start. */
  cooldown: number;
  /** Seconds until the attack in progress lands; < 0 when none is in progress. */
  windupLeft: number;
  attackTarget: Unit | null;
  attackBase: boolean;
  /** Last target, for facing the upper body while idle between attacks. */
  target: Unit | null;
  stun: number;
  valor: number;
  rank: number;
  kills: number;
  bornAt: number;
  /** Rally buff, seconds remaining. */
  buff: number;
  /** Distance walked, for the gait phase. */
  stride: number;
  /** Seconds since last hit, and how hard it was (fraction of max HP), for the renderer's flash. */
  hitAge: number;
  hitFrac: number;
  /** Whether the unit was hacked over from the other side. */
  converted: boolean;
  /** A friend queued behind can't reach anything; step forward (still fighting) to make room. */
  pushed: boolean;
  alive: boolean;
  /** Visual lane slot, stable for the unit's life. */
  file: number;
}

export interface Projectile {
  id: number;
  side: SideId;
  kind: ProjectileKind;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  /** Seconds in flight so far, and total flight time. */
  t: number;
  dur: number;
  /** Peak height of the arc above the straight line, metres. */
  arc: number;
  damage: number;
  splash: number;
  attackerCls: UnitClass | null;
  bonus: Partial<Record<UnitClass, number>> | undefined;
  vsBase: number;
  hitsGround: boolean;
  hitsAir: boolean;
  /** Specials from the sky hit whatever is under them, flying or not. */
  anyLayer: boolean;
  /** Homing target; the endpoint follows it while it lives. */
  target: Unit | null;
  targetBase: boolean;
  source: Unit | null;
  /** Visual lane offset where the projectile starts / ends. */
  sz: number;
  ez: number;
  done: boolean;
}

export interface Turret {
  def: TurretDef;
  slot: number;
  cooldown: number;
  /** Gold paid, for the refund on sale. */
  paid: number;
  /** Lane x of what it last aimed at, for the barrel to track. */
  aimX: number;
  aimY: number;
  /** Seconds since last shot. */
  fireAge: number;
}

export interface SideStats {
  trained: number;
  kills: number;
  lost: number;
  goldEarned: number;
  damageDealt: number;
  specialsCast: number;
  /** Game time at which each age was reached. */
  ageTimes: number[];
}

export interface SideState {
  id: SideId;
  isAI: boolean;
  age: number;
  gold: number;
  xp: number;
  baseHp: number;
  baseMaxHp: number;
  slots: number;
  turrets: (Turret | null)[];
  queue: string[];
  trainProgress: number;
  unlocked: Set<string>;
  specialCd: number;
  stance: Stance;
  upgrades: Record<UpgradeTrack, number>;
  doctrines: string[];
  mods: Mods;
  /** Doctrine choices waiting for a pick, or null. */
  draft: string[] | null;
  /** Difficulty multipliers (1 for the player). */
  power: number;
  incomeMult: number;
  conscriptTimer: number;
  /** Singularity Project progress in seconds, or -1 when not started. */
  project: number;
  stats: SideStats;
}

export type GameEvent =
  | { t: 'spawn'; unit: Unit }
  | { t: 'attackStart'; unit: Unit }
  | {
      t: 'fire';
      side: SideId;
      unit: Unit | null;
      turretSlot: number;
      kind: AttackKind;
      projectile: ProjectileKind | undefined;
      sx: number;
      sy: number;
      ex: number;
      ey: number;
      target: Unit | null;
      burst: number;
      /** For chain / pierce: every unit touched, in order. */
      chain?: Unit[];
    }
  | { t: 'projectile'; p: Projectile }
  | { t: 'impact'; p: Projectile }
  | { t: 'hit'; unit: Unit; amount: number }
  | { t: 'heal'; unit: Unit; amount: number }
  | { t: 'death'; unit: Unit; killerSide: SideId | null }
  | { t: 'baseHit'; side: SideId; amount: number; x: number; y: number }
  | { t: 'gold'; side: SideId; amount: number; x: number; y: number }
  | { t: 'evolve'; side: SideId; age: number }
  | { t: 'special'; side: SideId; id: SpecialId; x: number }
  | { t: 'lightning'; side: SideId; x: number; y: number; target: Unit | null }
  | { t: 'convert'; unit: Unit; from: SideId }
  | { t: 'stun'; unit: Unit }
  | { t: 'rankUp'; unit: Unit }
  | { t: 'turret'; side: SideId; slot: number; action: 'build' | 'sell' }
  | { t: 'slot'; side: SideId; slot: number }
  | { t: 'unlock'; side: SideId; unitId: string }
  | { t: 'upgrade'; side: SideId; track: UpgradeTrack; level: number }
  | { t: 'doctrine'; side: SideId; id: string }
  /** A bomber reaches x0 after `delay` seconds and x1 `duration` seconds later. */
  | { t: 'bomber'; side: SideId; x0: number; x1: number; delay: number; duration: number }
  | { t: 'drone'; side: SideId }
  | { t: 'project'; side: SideId; action: 'start' | 'setback' }
  | { t: 'gameOver'; winner: SideId; reason: 'wall' | 'singularity' };
