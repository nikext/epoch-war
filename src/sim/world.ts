import { AGES, unitDef, turretDef } from './data/ages';
import { DOCTRINES, baseMods, doctrine } from './data/doctrines';
import { classMultiplier } from './combat';
import {
  BASE_DAMAGE_XP,
  FILE_Z,
  HOLD_LINE,
  KILL_GOLD,
  KILL_XP,
  LANE,
  LOSS_XP,
  PROJECT_COST,
  PROJECT_SETBACK,
  PROJECT_TIME,
  QUEUE_MAX,
  RANK_BONUS,
  RANK_VALOR,
  SPACING,
  SPAWN_OFFSET,
  START_GOLD,
  TURRET_REFUND,
  TURRET_SLOTS,
  UPGRADE_LEVELS,
  UPGRADE_STEP,
} from './config';
import { Rng } from './rng';
import type { AttackSpec, SideId, Stance, UnitClass, UnitDef, UpgradeTrack } from './types';
import type { GameEvent, Projectile, SideState, Unit } from './entities';

export type CommandResult = 'ok' | 'gold' | 'queue' | 'pop' | 'locked' | 'age' | 'slot' | 'cooldown' | 'xp' | 'max' | 'draft' | 'invalid';

/** Mount heights of the four turret slots on a wall, lowest first. */
export const TURRET_HEIGHTS = [3.6, 5.4, 7.2, 9.0];
/** How far behind its wall face a turret sits. */
export const TURRET_SETBACK = 1.4;

export const dirOf = (side: SideId): 1 | -1 => (side === 0 ? 1 : -1);
export const wallX = (side: SideId): number => (side === 0 ? 0 : LANE);
export const other = (side: SideId): SideId => (side === 0 ? 1 : 0);

/** Distance a unit has advanced from its own wall. */
export function progressOf(u: Unit): number {
  return u.side === 0 ? u.x : LANE - u.x;
}

export function laneX(side: SideId, progress: number): number {
  return side === 0 ? progress : LANE - progress;
}

/** Stable lateral offset of a unit within the column (shared with the renderer). */
export function unitZ(u: Unit): number {
  const base = FILE_Z[u.file % FILE_Z.length]!;
  if (u.def.layer === 'air') return base * 1.6 - 1.5;
  const s = u.def.size;
  return base * (s > 3 ? 0.3 : s > 2 ? 0.55 : 1);
}

/** Height of a unit's centre of mass, for aiming. */
export function aimY(u: Unit): number {
  return u.def.layer === 'air' ? u.y + 0.4 : u.y + Math.max(0.7, u.def.muzzle * 0.75);
}

/** Front-liners walk through their own ranged troops to reach the front. */
function isFrontLiner(def: UnitDef): boolean {
  return def.cls === 'infantry' || def.cls === 'armor' || def.cls === 'apex' || def.range < 5;
}

interface Strike {
  at: number;
  run: () => void;
}

/** Everything that decides how hard an attack lands, independent of who fired it. */
interface Shot {
  side: SideId;
  unit: Unit | null;
  turretSlot: number;
  cls: UnitClass | null;
  bonus: Partial<Record<UnitClass, number>> | undefined;
  damage: number;
  vsBase: number;
  sx: number;
  sy: number;
  /** Progress of the shooter's front edge in its own frame, and its reach. */
  front: number;
  reach: number;
  hitsAir: boolean;
  hitsGround: boolean;
}

export interface WorldOptions {
  seed: number;
  ai: [boolean, boolean];
  power?: [number, number];
  income?: [number, number];
}

export class World {
  time = 0;
  readonly rng: Rng;
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  readonly sides: [SideState, SideState];
  events: GameEvent[] = [];
  winner: SideId | null = null;
  private nextId = 1;
  private strikes: Strike[] = [];
  private fileCounter = [0, 0];

  constructor(options: WorldOptions) {
    this.rng = new Rng(options.seed);
    const power = options.power ?? [1, 1];
    const income = options.income ?? [1, 1];
    this.sides = [
      this.makeSide(0, options.ai[0], power[0], income[0]),
      this.makeSide(1, options.ai[1], power[1], income[1]),
    ];
  }

  private makeSide(id: SideId, isAI: boolean, power: number, incomeMult: number): SideState {
    const age = AGES[0]!;
    return {
      id,
      isAI,
      age: 0,
      gold: START_GOLD,
      xp: 0,
      baseHp: age.baseHp,
      baseMaxHp: age.baseHp,
      slots: 1,
      turrets: new Array(TURRET_SLOTS).fill(null),
      queue: [],
      trainProgress: 0,
      unlocked: new Set(),
      specialCd: 12,
      stance: 'advance',
      upgrades: { weapons: 0, armor: 0, economy: 0 },
      doctrines: [],
      mods: baseMods(),
      draft: null,
      power,
      incomeMult,
      conscriptTimer: 0,
      project: -1,
      stats: { trained: 0, kills: 0, lost: 0, goldEarned: 0, damageDealt: 0, specialsCast: 0, ageTimes: [0] },
    };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  popUsed(side: SideId): number {
    let pop = 0;
    for (const u of this.units) if (u.alive && u.side === side) pop += u.def.pop;
    return pop;
  }

  popQueued(side: SideId): number {
    let pop = 0;
    for (const id of this.sides[side].queue) pop += unitDef(id).pop;
    return pop;
  }

  popCap(side: SideId): number {
    return AGES[this.sides[side].age]!.popCap;
  }

  econ(s: SideState): number {
    return (1 + s.upgrades.economy * UPGRADE_STEP.economy) * s.incomeMult;
  }

  turretPrice(side: SideId, id: string): number {
    return Math.round(turretDef(id).cost * this.sides[side].mods.turretCost);
  }

  slotPrice(side: SideId): number | null {
    const s = this.sides[side];
    if (s.slots >= TURRET_SLOTS) return null;
    return Math.round(AGES[s.age]!.slotCosts[s.slots - 1]! * s.mods.slotCost);
  }

  upgradePrice(side: SideId, track: UpgradeTrack): number | null {
    const s = this.sides[side];
    const level = s.upgrades[track];
    if (level >= UPGRADE_LEVELS) return null;
    return Math.round(AGES[s.age]!.upgradeCost * Math.pow(level + 1, 1.5));
  }

  canEvolve(side: SideId): boolean {
    const s = this.sides[side];
    const next = AGES[s.age]!.xpToNext;
    return next !== null && s.xp >= next && s.draft === null;
  }

  hpMult(s: SideState, def: UnitDef): number {
    let m = (1 + s.upgrades.armor * UPGRADE_STEP.armor) * s.mods.unitHp * s.power;
    if (def.cls === 'armor' || def.cls === 'apex') m *= s.mods.heavyHp;
    return m;
  }

  damageMult(u: Unit): number {
    const s = this.sides[u.side];
    let m = (1 + s.upgrades.weapons * UPGRADE_STEP.weapons) * s.mods.unitDamage * s.power * (1 + u.rank * RANK_BONUS);
    if (u.def.cls === 'infantry') m *= s.mods.infantryDamage;
    if (u.buff > 0) m *= 1.3;
    return m;
  }

  reach(u: Unit): number {
    const r = u.def.range;
    return r >= 3 ? r * this.sides[u.side].mods.range : r;
  }

  // ─── Commands (shared by the player and the AI) ───────────────────────────

  train(side: SideId, id: string): CommandResult {
    const s = this.sides[side];
    const def = unitDef(id);
    if (def.age !== s.age) return 'age';
    if (def.unlockCost && !s.unlocked.has(id)) return 'locked';
    if (s.queue.length >= QUEUE_MAX) return 'queue';
    if (this.popUsed(side) + this.popQueued(side) + def.pop > this.popCap(side)) return 'pop';
    if (s.gold < def.cost) return 'gold';
    s.gold -= def.cost;
    s.queue.push(id);
    return 'ok';
  }

  cancel(side: SideId, index: number): CommandResult {
    const s = this.sides[side];
    const id = s.queue[index];
    if (id === undefined) return 'invalid';
    s.queue.splice(index, 1);
    s.gold += unitDef(id).cost;
    if (index === 0) s.trainProgress = 0;
    return 'ok';
  }

  unlock(side: SideId, id: string): CommandResult {
    const s = this.sides[side];
    const def = unitDef(id);
    if (!def.unlockCost || s.unlocked.has(id)) return 'invalid';
    if (def.age !== s.age) return 'age';
    if (s.gold < def.unlockCost) return 'gold';
    s.gold -= def.unlockCost;
    s.unlocked.add(id);
    this.events.push({ t: 'unlock', side, unitId: id });
    return 'ok';
  }

  buySlot(side: SideId): CommandResult {
    const s = this.sides[side];
    const price = this.slotPrice(side);
    if (price === null) return 'max';
    if (s.gold < price) return 'gold';
    s.gold -= price;
    s.slots++;
    this.events.push({ t: 'slot', side, slot: s.slots - 1 });
    return 'ok';
  }

  buyTurret(side: SideId, slot: number, id: string): CommandResult {
    const s = this.sides[side];
    const def = turretDef(id);
    if (def.age !== s.age) return 'age';
    if (slot < 0 || slot >= s.slots) return 'slot';
    if (s.turrets[slot]) return 'slot';
    const price = this.turretPrice(side, id);
    if (s.gold < price) return 'gold';
    s.gold -= price;
    s.turrets[slot] = { def, slot, cooldown: 0.5, paid: price, aimX: laneX(side, 20), aimY: 0, fireAge: 99 };
    this.events.push({ t: 'turret', side, slot, action: 'build' });
    return 'ok';
  }

  sellTurret(side: SideId, slot: number): CommandResult {
    const s = this.sides[side];
    const t = s.turrets[slot];
    if (!t) return 'invalid';
    s.gold += Math.round(t.paid * TURRET_REFUND);
    s.turrets[slot] = null;
    this.events.push({ t: 'turret', side, slot, action: 'sell' });
    return 'ok';
  }

  upgrade(side: SideId, track: UpgradeTrack): CommandResult {
    const s = this.sides[side];
    const price = this.upgradePrice(side, track);
    if (price === null) return 'max';
    if (s.gold < price) return 'gold';
    s.gold -= price;
    if (track === 'armor') {
      const before = 1 + s.upgrades.armor * UPGRADE_STEP.armor;
      const after = before + UPGRADE_STEP.armor;
      for (const u of this.units) {
        if (u.alive && u.side === side) {
          u.maxHp *= after / before;
          u.hp *= after / before;
        }
      }
    }
    s.upgrades[track]++;
    this.events.push({ t: 'upgrade', side, track, level: s.upgrades[track] });
    return 'ok';
  }

  /** Begin the Singularity Project (final age only). */
  startProject(side: SideId): CommandResult {
    const s = this.sides[side];
    if (AGES[s.age]!.xpToNext !== null) return 'age';
    if (s.project >= 0) return 'invalid';
    if (s.gold < PROJECT_COST) return 'gold';
    s.gold -= PROJECT_COST;
    s.project = 0;
    this.events.push({ t: 'project', side, action: 'start' });
    return 'ok';
  }

  /** Dev/test helper: jump a side straight to an age (no draft, full wall). */
  debugSetAge(side: SideId, age: number): void {
    const s = this.sides[side];
    while (s.stats.ageTimes.length <= age) s.stats.ageTimes.push(this.time);
    s.age = age;
    s.draft = null;
    this.refreshBaseMax(s);
    s.baseHp = s.baseMaxHp;
  }

  setStance(side: SideId, stance: Stance): void {
    this.sides[side].stance = stance;
  }

  evolve(side: SideId): CommandResult {
    const s = this.sides[side];
    const next = AGES[s.age]!.xpToNext;
    if (next === null) return 'max';
    if (s.draft) return 'draft';
    if (s.xp < next) return 'xp';
    s.xp -= next;
    s.age++;
    s.stats.ageTimes.push(this.time);
    this.refreshBaseMax(s);
    s.specialCd = Math.min(s.specialCd, 15);
    s.draft = this.draftDoctrines(s);
    this.events.push({ t: 'evolve', side, age: s.age });
    return 'ok';
  }

  chooseDoctrine(side: SideId, id: string): CommandResult {
    const s = this.sides[side];
    if (!s.draft || !s.draft.includes(id)) return 'invalid';
    s.draft = null;
    s.doctrines.push(id);
    const d = doctrine(id);
    if (d.windfall) s.gold += d.windfall * AGES[s.age]!.units[0]!.cost;
    this.recomputeMods(s);
    this.events.push({ t: 'doctrine', side, id });
    return 'ok';
  }

  private draftDoctrines(s: SideState): string[] {
    const pool = DOCTRINES.filter((d) => !s.doctrines.includes(d.id) && (d.minAge ?? 0) <= s.age).map((d) => d.id);
    return this.rng.shuffle(pool).slice(0, 3);
  }

  private recomputeMods(s: SideState): void {
    const m = baseMods();
    for (const id of s.doctrines) doctrine(id).apply?.(m);
    s.mods = m;
    this.refreshBaseMax(s);
  }

  /** Raise the wall's max HP to its age and doctrines, keeping the damage it has taken. */
  private refreshBaseMax(s: SideState): void {
    const max = AGES[s.age]!.baseHp * s.mods.baseHp;
    s.baseHp = Math.max(1, s.baseHp + (max - s.baseMaxHp));
    s.baseMaxHp = max;
  }

  castSpecial(side: SideId, x?: number): CommandResult {
    const s = this.sides[side];
    if (s.specialCd > 0) return 'cooldown';
    const sp = AGES[s.age]!.special;
    const aim = Math.min(LANE - 4, Math.max(4, x ?? this.defaultAim(side)));
    s.specialCd = sp.cooldown * s.mods.specialCd;
    s.stats.specialsCast++;
    this.events.push({ t: 'special', side, id: sp.id, x: aim });
    const dir = dirOf(side);
    const dmg = sp.damage * s.power;
    const foe = other(side);

    switch (sp.id) {
      case 'meteor': {
        for (let i = 0; i < 12; i++) {
          const mx = aim + this.rng.range(-sp.radius, sp.radius);
          this.schedule(0.2 + i * 0.4 + this.rng.range(0, 0.2), () => {
            this.addProjectile({
              side, kind: 'meteor', sx: mx - dir * 16, sy: 38, ex: mx, ey: 0, speed: 30, arc: 0, damage: dmg,
              splash: 3.2, target: null, targetBase: false, source: null, anyLayer: true,
            });
          });
        }
        break;
      }
      case 'zeus': {
        const targets = this.units
          .filter((u) => u.alive && u.side === foe)
          .sort((a, b) => b.hp - a.hp)
          .slice(0, 7);
        targets.forEach((target, i) => {
          this.schedule(0.35 + i * 0.28, () => {
            const bolt = target.alive && target.side === foe ? target : null;
            this.events.push({ t: 'lightning', side, x: target.x, y: target.y, target: bolt });
            if (bolt) this.damageUnit(bolt, dmg * (bolt.def.cls === 'armor' ? 1.25 : 1), side, null);
          });
        });
        break;
      }
      case 'arrows': {
        const n = 40;
        for (let i = 0; i < n; i++) {
          const ax = aim + this.rng.range(-sp.radius, sp.radius);
          this.schedule(0.3 + (i / n) * 3 + this.rng.range(0, 0.1), () => {
            this.addProjectile({
              side, kind: 'arrow', sx: ax - dir * 22, sy: 24, ex: ax, ey: 0.3, speed: 34, arc: 0, damage: dmg,
              splash: 1.3, target: null, targetBase: false, source: null, anyLayer: true,
            });
          });
        }
        break;
      }
      case 'rally': {
        for (const u of this.units) {
          if (!u.alive || u.side !== side) continue;
          const amount = Math.min(u.maxHp - u.hp, u.maxHp * 0.5);
          u.hp += amount;
          u.buff = 10;
          if (amount > 0) this.events.push({ t: 'heal', unit: u, amount });
        }
        break;
      }
      case 'bomber': {
        const x0 = aim - dir * sp.radius;
        const x1 = aim + dir * sp.radius;
        const delay = 1.0;
        const duration = 2.6;
        this.events.push({ t: 'bomber', side, x0, x1, delay, duration });
        const bombs = 14;
        for (let i = 0; i < bombs; i++) {
          const f = i / (bombs - 1);
          const bx = x0 + (x1 - x0) * f;
          this.schedule(delay + duration * f, () => {
            this.addProjectile({
              side, kind: 'bomb', sx: bx, sy: 15, ex: bx + dir * 2.5, ey: 0, speed: 19, arc: 0, damage: dmg,
              splash: 3.4, target: null, targetBase: false, source: null, anyLayer: false,
            });
          });
        }
        break;
      }
      case 'drones': {
        const foes = this.units.filter((u) => u.alive && u.side === foe);
        const priority = (u: Unit): number =>
          u.def.cost * (u.def.cls === 'armor' || u.def.cls === 'apex' ? 3 : u.def.cls === 'air' ? 2 : 1);
        foes.sort((a, b) => priority(b) - priority(a));
        for (let i = 0; i < 10; i++) {
          this.schedule(0.2 + i * 0.16, () => {
            const live = foes.filter((u) => u.alive && u.side === foe);
            const target = live[i % Math.max(1, live.length)];
            const origin = wallX(side) - dir * 2;
            this.events.push({ t: 'drone', side });
            this.addProjectile({
              side, kind: 'drone', sx: origin, sy: 10, ex: target ? target.x : laneX(side, 60), ey: target ? aimY(target) : 0,
              speed: 30, arc: 0.22, damage: dmg, splash: 1.4, target: target ?? null, targetBase: false,
              source: null, anyLayer: true,
            });
          });
        }
        break;
      }
      case 'override': {
        const inZone = this.units
          .filter((u) => u.alive && u.side === foe && Math.abs(u.x - aim) <= sp.radius)
          .sort((a, b) => b.def.cost - a.def.cost);
        let hacked = 0;
        for (const u of inZone) {
          if (hacked < 4 && u.def.cls !== 'apex') {
            hacked++;
            this.schedule(0.5 + hacked * 0.15, () => this.convert(u, side));
          } else {
            u.stun = 3.5;
            this.events.push({ t: 'stun', unit: u });
          }
        }
        break;
      }
    }
    return 'ok';
  }

  /** Where a special does the most good: the densest enemy cluster. */
  defaultAim(side: SideId): number {
    const foes = this.units.filter((u) => u.alive && u.side !== side);
    if (foes.length === 0) return laneX(side, LANE * 0.6);
    let best = foes[0]!.x;
    let bestValue = -1;
    for (const f of foes) {
      let value = 0;
      for (const g of foes) if (Math.abs(g.x - f.x) < 12) value += g.def.cost;
      if (value > bestValue) {
        bestValue = value;
        best = f.x;
      }
    }
    return best;
  }

  private convert(u: Unit, to: SideId): void {
    if (!u.alive || u.side === to) return;
    const from = u.side;
    u.side = to;
    u.converted = true;
    u.windupLeft = -1;
    u.attackTarget = null;
    u.target = null;
    u.cooldown = 0.6;
    u.stun = 0;
    this.events.push({ t: 'convert', unit: u, from });
  }

  // ─── Simulation ───────────────────────────────────────────────────────────

  /** Advance one tick. After the war is decided the armies keep fighting (for the camera), but nothing more is decided. */
  step(dt: number): void {
    this.time += dt;
    for (const u of this.units) u.prevX = u.x;
    for (const s of this.sides) this.stepSide(s, dt);
    this.runStrikes();
    this.stepUnits(dt);
    this.stepTurrets(dt);
    this.stepProjectiles(dt);
    if (this.units.some((u) => !u.alive)) this.units = this.units.filter((u) => u.alive);
    if (this.projectiles.some((p) => p.done)) this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  private schedule(delay: number, run: () => void): void {
    this.strikes.push({ at: this.time + delay, run });
  }

  private runStrikes(): void {
    if (this.strikes.length === 0) return;
    const due = this.strikes.filter((s) => s.at <= this.time);
    if (due.length === 0) return;
    this.strikes = this.strikes.filter((s) => s.at > this.time);
    for (const s of due) {
      if (this.winner !== null) return;
      s.run();
    }
  }

  private stepSide(s: SideState, dt: number): void {
    if (this.winner !== null) return;
    const age = AGES[s.age]!;
    s.gold += age.income * s.mods.income * this.econ(s) * dt;
    if (s.specialCd > 0) s.specialCd = Math.max(0, s.specialCd - dt);
    if (s.mods.baseRegen > 0) s.baseHp = Math.min(s.baseMaxHp, s.baseHp + s.baseMaxHp * s.mods.baseRegen * dt);
    if (s.project >= 0) {
      s.project += dt;
      if (s.project >= PROJECT_TIME && this.winner === null) {
        s.project = PROJECT_TIME;
        this.winner = s.id;
        this.events.push({ t: 'gameOver', winner: s.id, reason: 'singularity' });
        return;
      }
    }

    if (s.queue.length > 0) {
      const def = unitDef(s.queue[0]!);
      s.trainProgress = Math.min(1, s.trainProgress + (dt * s.mods.trainSpeed) / def.trainTime);
      if (s.trainProgress >= 1 && this.spawnClear(s.id, def)) {
        s.queue.shift();
        s.trainProgress = 0;
        this.spawn(s.id, def);
      }
    }

    if (s.mods.conscript > 0) {
      s.conscriptTimer += dt;
      if (s.conscriptTimer >= s.mods.conscript) {
        const def = age.units[0]!;
        if (this.popUsed(s.id) + def.pop <= age.popCap && this.spawnClear(s.id, def)) {
          s.conscriptTimer = 0;
          this.spawn(s.id, def);
        }
      }
    }
  }

  /** A new unit steps out of the gate only once the one before it has made room. */
  private spawnClear(side: SideId, def: UnitDef): boolean {
    for (const u of this.units) {
      if (!u.alive || u.side !== side || u.def.layer !== def.layer) continue;
      const back = progressOf(u) - u.def.size / 2;
      if (back < SPAWN_OFFSET - 0.3 * Math.min(def.size, u.def.size)) return false;
    }
    return true;
  }

  spawn(side: SideId, def: UnitDef): Unit {
    const s = this.sides[side];
    const hp = def.hp * this.hpMult(s, def);
    const u: Unit = {
      id: this.nextId++,
      side,
      def,
      x: laneX(side, SPAWN_OFFSET - def.size / 2),
      prevX: 0,
      y: def.altitude ?? 0,
      hp,
      maxHp: hp,
      state: 'walk',
      attackTime: 99,
      cooldown: 0.3,
      windupLeft: -1,
      attackTarget: null,
      attackBase: false,
      target: null,
      stun: 0,
      valor: 0,
      rank: 0,
      kills: 0,
      bornAt: this.time,
      buff: 0,
      stride: 0,
      hitAge: 99,
      hitFrac: 0,
      converted: false,
      alive: true,
      file: this.fileCounter[side]!++,
    };
    u.prevX = u.x;
    for (let r = 0; r < s.mods.startRank; r++) this.promote(u, false);
    this.units.push(u);
    s.stats.trained++;
    this.events.push({ t: 'spawn', unit: u });
    return u;
  }

  private promote(u: Unit, announce: boolean): void {
    if (u.rank >= RANK_VALOR.length) return;
    const before = 1 + u.rank * RANK_BONUS;
    u.rank++;
    const after = 1 + u.rank * RANK_BONUS;
    u.maxHp *= after / before;
    u.hp *= after / before;
    if (announce) this.events.push({ t: 'rankUp', unit: u });
  }

  private stepUnits(dt: number): void {
    const bySide: [Unit[], Unit[]] = [[], []];
    for (const u of this.units) if (u.alive) bySide[u.side].push(u);
    bySide[0].sort((a, b) => progressOf(b) - progressOf(a));
    bySide[1].sort((a, b) => progressOf(b) - progressOf(a));

    for (const side of [0, 1] as const) {
      const mine = bySide[side];
      const foes = bySide[other(side)];
      const s = this.sides[side];

      for (let i = 0; i < mine.length; i++) {
        const u = mine[i]!;
        if (!u.alive || u.side !== side) continue;
        u.hitAge += dt;
        u.attackTime += dt;
        if (u.buff > 0) u.buff -= dt;
        if (s.mods.regen > 0 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.mods.regen * dt);

        if (u.stun > 0) {
          u.stun -= dt;
          u.state = 'idle';
          continue;
        }

        u.cooldown -= dt;
        if (u.windupLeft >= 0) {
          u.windupLeft -= dt;
          if (u.windupLeft < 0) this.resolveAttack(u, foes);
          if (!u.alive || u.side !== side) continue;
        }

        const target = this.findTarget(u, foes);
        const healTarget = u.def.attack.kind === 'heal' ? this.findHealTarget(u, mine) : null;
        u.target = target && target !== 'base' ? target : null;

        if (target || healTarget) {
          if (u.cooldown <= 0 && u.windupLeft < 0) {
            u.attackTarget = healTarget ?? (target === 'base' ? null : target);
            u.attackBase = !healTarget && target === 'base';
            u.windupLeft = u.def.windup;
            u.attackTime = 0;
            u.cooldown = u.def.interval;
            this.events.push({ t: 'attackStart', unit: u });
          }
        }

        if (target) {
          u.state = 'attack';
          continue;
        }
        this.move(u, mine, i, foes, dt);
      }
    }
  }

  private move(u: Unit, mine: Unit[], index: number, foes: Unit[], dt: number): void {
    const s = this.sides[u.side];
    const p = progressOf(u);
    const size = u.def.size;
    let limit = LANE - size / 2 - 0.05;

    for (const e of foes) {
      if (!e.alive || e.def.layer !== u.def.layer) continue;
      const pe = LANE - progressOf(e);
      if (pe + e.def.size / 2 < p - size / 2 - 0.5) continue;
      limit = Math.min(limit, pe - (e.def.size + size) / 2 - 0.05);
    }

    const front = isFrontLiner(u.def);
    for (let j = index - 1; j >= 0; j--) {
      const a = mine[j]!;
      if (!a.alive || a.side !== u.side || a.def.layer !== u.def.layer) continue;
      if (front && !isFrontLiner(a.def)) continue;
      limit = Math.min(limit, progressOf(a) - ((a.def.size + size) / 2) * SPACING);
      break;
    }

    const speed = u.def.speed * s.mods.speed * (u.buff > 0 ? 1.1 : 1);
    if (s.stance === 'hold') {
      const hold = HOLD_LINE - (front ? 0 : 3) - size / 2;
      if (p > hold + 0.4) {
        const np = Math.max(hold, p - speed * 0.85 * dt);
        this.setProgress(u, np);
        u.stride += p - np;
        u.state = 'retreat';
        return;
      }
      limit = Math.min(limit, hold);
    }

    const np = Math.max(p, Math.min(p + speed * dt, limit));
    if (np > p + 1e-4) {
      u.stride += np - p;
      this.setProgress(u, np);
      u.state = 'walk';
    } else {
      u.state = 'idle';
    }
  }

  private setProgress(u: Unit, p: number): void {
    u.x = laneX(u.side, p);
  }

  /** Nearest enemy the unit can hit right now, the enemy wall, or null. */
  private findTarget(u: Unit, foes: Unit[]): Unit | 'base' | null {
    const range = this.reach(u);
    const p = progressOf(u);
    let best: Unit | null = null;
    let bestGap = Infinity;
    for (const e of foes) {
      if (!e.alive || e.side === u.side) continue;
      if (e.def.layer === 'air' && !u.def.hitsAir) continue;
      const gap = LANE - progressOf(e) - p - (u.def.size + e.def.size) / 2;
      if (gap < -(u.def.size + e.def.size) / 2 - 0.5) continue;
      if (gap <= range && gap < bestGap) {
        best = e;
        bestGap = gap;
      }
    }
    if (best) return best;
    return LANE - p - u.def.size / 2 <= range ? 'base' : null;
  }

  private findHealTarget(u: Unit, mine: Unit[]): Unit | null {
    const range = this.reach(u);
    let best: Unit | null = null;
    let worst = 0.92;
    for (const a of mine) {
      if (!a.alive || a === u || a.side !== u.side) continue;
      if (Math.abs(a.x - u.x) > range + (a.def.size + u.def.size) / 2) continue;
      const f = a.hp / a.maxHp;
      if (f < worst) {
        worst = f;
        best = a;
      }
    }
    return best;
  }

  private resolveAttack(u: Unit, foes: Unit[]): void {
    let spec: AttackSpec = u.def.attack;
    const target = u.attackTarget;

    if (spec.kind === 'heal') {
      if (target && target.alive && target.side === u.side) {
        const amount = Math.min(target.maxHp - target.hp, (u.def.heal ?? 0) * (1 + u.rank * RANK_BONUS) * this.sides[u.side].power);
        target.hp += amount;
        this.events.push({ t: 'heal', unit: target, amount });
        this.events.push({
          t: 'fire', side: u.side, unit: u, turretSlot: -1, kind: 'heal', projectile: undefined,
          sx: u.x, sy: u.y + u.def.muzzle, ex: target.x, ey: aimY(target), target, burst: 1,
        });
        return;
      }
      spec = spec.fallback!;
    }

    if (!u.attackBase) {
      if (!target || !target.alive || target.side === u.side) return;
      const gap = LANE - progressOf(target) - progressOf(u) - (u.def.size + target.def.size) / 2;
      if (gap > this.reach(u) + 1.5) return;
    }

    const dir = dirOf(u.side);
    const shot: Shot = {
      side: u.side,
      unit: u,
      turretSlot: -1,
      cls: u.def.cls,
      bonus: u.def.bonus,
      damage: u.def.damage * this.damageMult(u),
      vsBase: u.def.vsBase ?? 1,
      sx: u.x + dir * u.def.size * 0.45,
      sy: u.y + u.def.muzzle,
      front: progressOf(u) + u.def.size / 2,
      reach: this.reach(u),
      hitsAir: u.def.hitsAir,
      hitsGround: true,
    };
    this.performAttack(shot, spec, u.attackBase ? null : target, u.attackBase, foes);
  }

  private multiplier(shot: Shot, t: Unit): number {
    let m = shot.cls ? classMultiplier(shot.cls, t.def.cls) : 1;
    m *= shot.bonus?.[t.def.cls] ?? 1;
    if (t.def.layer === 'air') m *= this.sides[shot.side].mods.antiAir;
    return m * this.rng.range(0.9, 1.1);
  }

  private performAttack(shot: Shot, spec: AttackSpec, target: Unit | null, base: boolean, foes: Unit[]): void {
    const foe = other(shot.side);
    const baseX = wallX(foe) + dirOf(foe) * -1.2;
    const baseY = 1.5 + this.rng.range(0, 2.5);
    const ex = target ? target.x : baseX;
    const ey = target ? aimY(target) : baseY;
    const fire = (extra?: Unit[]): void => {
      const ev: GameEvent = {
        t: 'fire', side: shot.side, unit: shot.unit, turretSlot: shot.turretSlot, kind: spec.kind,
        projectile: spec.projectile, sx: shot.sx, sy: shot.sy, ex, ey, target, burst: spec.burst ?? 1,
      };
      if (extra) ev.chain = extra;
      this.events.push(ev);
    };

    const hit = (t: Unit, scale: number): void => {
      this.damageUnit(t, shot.damage * scale * this.multiplier(shot, t), shot.side, shot.unit);
    };
    const hitBase = (scale: number): void => {
      this.damageBase(foe, shot.damage * scale * shot.vsBase, shot.side, baseX, baseY);
    };

    switch (spec.kind) {
      case 'melee':
      case 'hitscan':
      case 'beam':
        fire();
        if (target) hit(target, 1);
        else if (base) hitBase(1);
        return;

      case 'projectile':
        this.addProjectile({
          side: shot.side, kind: spec.projectile ?? 'rock', sx: shot.sx, sy: shot.sy, ex, ey, speed: spec.speed ?? 30,
          arc: spec.arc ?? 0, damage: shot.damage, splash: spec.splash ?? 0, target, targetBase: base, source: shot.unit,
          anyLayer: false, cls: shot.cls, bonus: shot.bonus, vsBase: shot.vsBase, hitsAir: shot.hitsAir,
        });
        fire();
        return;

      case 'flame': {
        const victims = this.sweep(shot, foes, false).slice(0, spec.maxTargets ?? 3);
        fire(victims);
        for (const v of victims) hit(v, 1);
        if (victims.length === 0 && base) hitBase(1);
        return;
      }

      case 'pierce': {
        const victims = this.sweep(shot, foes, shot.hitsAir);
        fire(victims);
        victims.forEach((v, k) => hit(v, Math.pow(0.85, k)));
        if (base) hitBase(0.8);
        return;
      }

      case 'chain': {
        const chain: Unit[] = [];
        if (target) {
          chain.push(target);
          let last = target;
          while (chain.length < (spec.maxTargets ?? 3)) {
            let next: Unit | null = null;
            let best = 7;
            for (const e of foes) {
              if (!e.alive || e.side === shot.side || chain.includes(e)) continue;
              if (e.def.layer === 'air' && !shot.hitsAir) continue;
              const d = Math.abs(e.x - last.x) + Math.abs(e.y - last.y) * 0.5;
              if (d < best) {
                best = d;
                next = e;
              }
            }
            if (!next) break;
            chain.push(next);
            last = next;
          }
        }
        fire(chain);
        chain.forEach((v, k) => hit(v, Math.pow(0.75, k)));
        if (!target && base) hitBase(1);
        return;
      }

      case 'heal':
        return;
    }
  }

  /** Enemies on the line in front of the shooter, nearest first. */
  private sweep(shot: Shot, foes: Unit[], air: boolean): Unit[] {
    const out: { u: Unit; gap: number }[] = [];
    for (const e of foes) {
      if (!e.alive || e.side === shot.side) continue;
      if (e.def.layer === 'air' ? !air : !shot.hitsGround) continue;
      const gap = LANE - progressOf(e) - e.def.size / 2 - shot.front;
      if (gap < -e.def.size - 1 || gap > shot.reach) continue;
      out.push({ u: e, gap });
    }
    out.sort((a, b) => a.gap - b.gap);
    return out.map((o) => o.u);
  }

  private stepTurrets(dt: number): void {
    for (const s of this.sides) {
      const foes = this.units.filter((u) => u.alive && u.side !== s.id);
      for (const t of s.turrets) {
        if (!t) continue;
        t.fireAge += dt;
        t.cooldown -= dt * s.mods.turretRate;
        const def = t.def;
        const range = def.range * s.mods.range;
        let best: Unit | null = null;
        let bestGap = Infinity;
        for (const e of foes) {
          if (e.def.layer === 'air' ? !def.hitsAir : !def.hitsGround) continue;
          const gap = (s.id === 0 ? e.x : LANE - e.x) - e.def.size / 2;
          if (gap > range || gap < (def.minRange ?? -99)) continue;
          if (gap < bestGap) {
            bestGap = gap;
            best = e;
          }
        }
        if (!best) continue;
        t.aimX = best.x;
        t.aimY = aimY(best);
        if (t.cooldown > 0) continue;
        t.cooldown = def.interval;
        t.fireAge = 0;
        const dir = dirOf(s.id);
        const shot: Shot = {
          side: s.id,
          unit: null,
          turretSlot: t.slot,
          cls: null,
          bonus: def.bonus,
          damage: def.damage,
          vsBase: 1,
          sx: wallX(s.id) - dir * (TURRET_SETBACK - 1.2),
          sy: TURRET_HEIGHTS[t.slot]! + 0.9,
          front: 0,
          reach: range,
          hitsAir: def.hitsAir,
          hitsGround: def.hitsGround,
        };
        this.performAttack(shot, def.attack, best, false, foes);
      }
    }
  }

  private addProjectile(o: {
    side: SideId;
    kind: Projectile['kind'];
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    speed: number;
    arc: number;
    damage: number;
    splash: number;
    target: Unit | null;
    targetBase: boolean;
    source: Unit | null;
    anyLayer: boolean;
    cls?: UnitClass | null;
    bonus?: Partial<Record<UnitClass, number>> | undefined;
    vsBase?: number;
    hitsAir?: boolean;
  }): void {
    const dist = Math.hypot(o.ex - o.sx, o.ey - o.sy);
    const p: Projectile = {
      id: this.nextId++,
      side: o.side,
      kind: o.kind,
      sx: o.sx,
      sy: o.sy,
      ex: o.ex,
      ey: o.ey,
      t: 0,
      dur: Math.max(0.12, dist / o.speed),
      arc: o.arc * dist,
      damage: o.damage,
      splash: o.splash,
      attackerCls: o.cls ?? null,
      bonus: o.bonus,
      vsBase: o.vsBase ?? 1,
      hitsGround: true,
      hitsAir: o.hitsAir ?? o.anyLayer,
      anyLayer: o.anyLayer,
      target: o.target,
      targetBase: o.targetBase,
      source: o.source,
      sz: o.source ? unitZ(o.source) : 0,
      ez: o.target ? unitZ(o.target) : 0,
      done: false,
    };
    this.projectiles.push(p);
    this.events.push({ t: 'projectile', p });
  }

  private stepProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.done) continue;
      if (p.target && p.target.alive && p.target.side !== p.side) {
        p.ex = p.target.x;
        p.ey = aimY(p.target);
        p.ez = unitZ(p.target);
      }
      p.t += dt;
      if (p.t >= p.dur) this.impact(p);
    }
  }

  private impact(p: Projectile): void {
    p.done = true;
    this.events.push({ t: 'impact', p });
    const foe = other(p.side);
    const shot: Shot = {
      side: p.side, unit: p.source, turretSlot: -1, cls: p.attackerCls, bonus: p.bonus, damage: p.damage, vsBase: p.vsBase,
      sx: p.sx, sy: p.sy, front: 0, reach: 0, hitsAir: p.hitsAir, hitsGround: p.hitsGround,
    };
    const source = p.source && p.source.alive && p.source.side === p.side ? p.source : null;

    if (p.splash > 0) {
      const airBurst = p.ey > 4;
      for (const e of this.units) {
        if (!e.alive || e.side === p.side) continue;
        const isAir = e.def.layer === 'air';
        if (!p.anyLayer) {
          if (isAir !== airBurst) continue;
          if (isAir && !p.hitsAir) continue;
        }
        if (Math.abs(e.x - p.ex) > p.splash + e.def.size / 2) continue;
        this.damageUnit(e, p.damage * this.multiplier(shot, e), p.side, source);
      }
      const wx = wallX(foe);
      if (!p.anyLayer && !airBurst && (p.targetBase || Math.abs(wx - p.ex) <= p.splash)) {
        this.damageBase(foe, p.damage * p.vsBase, p.side, p.ex, p.ey);
      }
      return;
    }

    if (p.target) {
      if (p.target.alive && p.target.side !== p.side) {
        this.damageUnit(p.target, p.damage * this.multiplier(shot, p.target), p.side, source);
      }
    } else if (p.targetBase) {
      this.damageBase(foe, p.damage * p.vsBase, p.side, p.ex, p.ey);
    }
  }

  damageUnit(t: Unit, amount: number, bySide: SideId, source: Unit | null): void {
    if (!t.alive || amount <= 0) return;
    t.hp -= amount;
    t.hitFrac = t.hitAge < 0.1 ? Math.max(t.hitFrac, amount / t.maxHp) : amount / t.maxHp;
    t.hitAge = 0;
    this.sides[bySide].stats.damageDealt += amount;
    this.events.push({ t: 'hit', unit: t, amount });
    if (t.hp <= 0) this.kill(t, bySide, source);
  }

  private kill(t: Unit, bySide: SideId, source: Unit | null): void {
    t.alive = false;
    t.hp = 0;
    const victim = this.sides[t.side];
    const killer = this.sides[bySide];
    const cost = t.def.cost;
    const gold = cost * KILL_GOLD * killer.mods.killGold * this.econ(killer);
    killer.gold += gold;
    killer.stats.goldEarned += gold;
    killer.stats.kills++;
    killer.xp += cost * KILL_XP * killer.mods.xp;
    victim.xp += cost * LOSS_XP * victim.mods.xp;
    victim.stats.lost++;
    if (victim.mods.salvage > 0) victim.gold += cost * victim.mods.salvage;
    if (source && source.alive) {
      source.kills++;
      source.valor += cost / source.def.cost;
      while (source.rank < RANK_VALOR.length && source.valor >= RANK_VALOR[source.rank]!) this.promote(source, true);
    }
    this.events.push({ t: 'death', unit: t, killerSide: bySide });
    this.events.push({ t: 'gold', side: bySide, amount: gold, x: t.x, y: aimY(t) + 1 });
  }

  private damageBase(side: SideId, amount: number, bySide: SideId, x: number, y: number): void {
    if (this.winner !== null) return;
    const s = this.sides[side];
    const attacker = this.sides[bySide];
    s.baseHp -= amount;
    attacker.xp += amount * BASE_DAMAGE_XP * attacker.mods.xp;
    attacker.stats.damageDealt += amount;
    this.events.push({ t: 'baseHit', side, amount, x, y });
    if (s.project > 0) {
      s.project = Math.max(0, s.project - (amount / s.baseMaxHp) * 100 * PROJECT_SETBACK);
    }
    if (s.baseHp <= 0 && this.winner === null) {
      s.baseHp = 0;
      this.winner = bySide;
      this.events.push({ t: 'gameOver', winner: bySide, reason: 'wall' });
    }
  }
}
