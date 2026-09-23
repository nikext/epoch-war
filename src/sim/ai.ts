import { AGES, unitDef } from './data/ages';
import { doctrine } from './data/doctrines';
import { classMultiplier, CLASS_INFO } from './combat';
import type { DifficultyDef } from './config';
import { LANE, PROJECT_COST } from './config';
import { Rng } from './rng';
import type { SideId, TurretDef, UnitClass, UnitDef } from './types';
import type { Unit } from './entities';
import { other, progressOf, type World } from './world';

/**
 * The opponent. It plays through the same commands as the player — train,
 * build, evolve, cast — and on the higher difficulties it reads the player's
 * army and counter-builds, which is this remake's nod to the age it ends in.
 * What it has learned is surfaced as "intel" lines in the HUD.
 */
function underThreat(threat: number, myValue: number): boolean {
  return threat > myValue * 0.8;
}

export class AIController {
  private clock = 0;
  private nextThink = 0;
  private readonly rng: Rng;
  private evolveAt = -1;
  /** Gold the AI is holding back for something big (an unlock, the apex). */
  private reserve = 0;
  private lastCounter: UnitClass | null = null;
  private warned = false;
  /** Messages for the HUD, newest last. The game drains it. */
  readonly intel: string[] = [];
  /** A standing preference, so two AIs on the same difficulty play differently. */
  private readonly personality: { aggression: number; turtle: number; tech: number };

  constructor(
    private readonly world: World,
    readonly side: SideId,
    private readonly difficulty: DifficultyDef,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.personality = {
      aggression: this.rng.range(0.3, 1),
      turtle: this.rng.range(0, 0.7),
      tech: this.rng.range(0.2, 1),
    };
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.clock < this.nextThink) return;
    this.nextThink = this.clock + this.difficulty.think * this.rng.range(0.75, 1.25);
    if (this.world.winner !== null) return;
    this.think();
  }

  private think(): void {
    const w = this.world;
    const s = w.sides[this.side];

    if (s.draft) w.chooseDoctrine(this.side, this.pickDoctrine(s.draft));

    if (w.canEvolve(this.side)) {
      if (this.evolveAt < 0) this.evolveAt = this.clock + (this.difficulty.id === 'recruit' ? this.rng.range(6, 25) : this.rng.range(0, 3));
      if (this.clock >= this.evolveAt) {
        w.evolve(this.side);
        this.evolveAt = -1;
        this.reserve = 0;
        if (s.draft) w.chooseDoctrine(this.side, this.pickDoctrine(s.draft));
      }
    }

    const mine = w.units.filter((u) => u.alive && u.side === this.side);
    const foes = w.units.filter((u) => u.alive && u.side !== this.side);
    const value = (list: Unit[]): number => list.reduce((sum, u) => sum + u.def.cost * (u.hp / u.maxHp), 0);
    const myValue = value(mine);
    const foeValue = value(foes);
    // How far the deepest enemy has pushed toward our wall, in our frame.
    const deepest = foes.reduce((m, u) => Math.max(m, LANE - progressOf(u)), -Infinity);
    const incoming = foes.filter((u) => LANE - progressOf(u) < 40);
    const threat = value(incoming);
    const scale = AGES[s.age]!.units[0]!.cost;

    // The enemy racing for the Singularity changes everything: storm the wall.
    const enemyProject = w.sides[other(this.side)].project >= 0;
    if (enemyProject && this.difficulty.adaptive && !this.warned) {
      this.warned = true;
      this.say('Enemy AI detected your Singularity Project. It is throwing everything at your wall.');
    }

    this.useSpecial(foes, myValue, threat, scale, enemyProject);
    if (enemyProject) w.setStance(this.side, 'advance');
    else this.chooseStance(myValue, foeValue, deepest);

    if (s.project < 0 && AGES[s.age]!.xpToNext === null && this.difficulty.id !== 'recruit') {
      const stable = !underThreat(threat, myValue) && myValue >= foeValue * 0.7;
      if (s.gold >= PROJECT_COST && (stable || s.gold > PROJECT_COST * 1.5)) {
        if (w.startProject(this.side) === 'ok') this.say('The enemy has begun its Singularity Project. Stop it before the countdown ends!');
        this.reserve = 0;
      } else {
        // Bank toward the project only while the army holds; a crisis spends it.
        this.reserve = stable && s.gold > PROJECT_COST * 0.3 ? Math.min(s.gold, PROJECT_COST) * 0.6 : 0;
      }
    }

    // Spending, most urgent first.
    const underSiege = threat > 0 && LANE - deepest < 18 && myValue < threat;
    if (underSiege) this.buildTurret(foes, true);

    this.considerUnlocks();
    this.trainUnits(mine, foes);
    if (!underSiege) this.buildTurret(foes, false);
    this.considerUpgrades();
  }

  private pickDoctrine(draft: string[]): string {
    const weights: Record<string, number> = {
      plunder: 1.2, fortify: 0.8 + this.personality.turtle, drill: 1, veterans: 1.1, overclock: 0.7 + this.personality.turtle,
      'long-barrels': 1, 'forced-march': 0.6 + this.personality.aggression, conscription: 1.1, salvage: 0.9, blitz: 0.9,
      'iron-hide': 1, scholars: 0.7 + this.personality.tech, 'war-bonds': 1.2, 'field-medics': 1, 'shock-troops': 0.9,
      'sky-shield': 0.8, engineers: 0.5 + this.personality.turtle, 'war-chest': 0.9, hardened: 1.1, sharpened: 1.1,
    };
    let best = draft[0]!;
    let bestScore = -1;
    for (const id of draft) {
      const score = (weights[id] ?? 1) * this.rng.range(0.7, 1.3);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    if (this.difficulty.adaptive) this.say(`Enemy adopted the ${doctrine(best).name} doctrine.`);
    return best;
  }

  private useSpecial(foes: Unit[], myValue: number, threat: number, scale: number, desperate: boolean): void {
    const w = this.world;
    const s = w.sides[this.side];
    if (s.specialCd > 0 || foes.length === 0) return;
    const sp = AGES[s.age]!.special;
    // Recruits fire their specials late and at random.
    if (this.difficulty.id === 'recruit' && !this.rng.chance(0.15)) return;

    if (sp.id === 'rally') {
      const engaged = w.units.filter((u) => u.alive && u.side === this.side && u.state === 'attack');
      const hurt = engaged.reduce((sum, u) => sum + (u.maxHp - u.hp), 0);
      if (engaged.length >= 4 && hurt > engaged.reduce((sum, u) => sum + u.maxHp, 0) * 0.3) w.castSpecial(this.side);
      return;
    }

    const aim = w.defaultAim(this.side);
    const radius = Math.max(sp.radius, 10);
    const cluster = foes.filter((u) => Math.abs(u.x - aim) <= radius).reduce((sum, u) => sum + u.def.cost, 0);
    const worth = scale * (this.difficulty.id === 'impossible' ? 6 : 9) * (desperate ? 0.4 : 1);
    if (cluster >= worth || threat > myValue * 1.5 + scale * 4) w.castSpecial(this.side, aim);
  }

  private chooseStance(myValue: number, foeValue: number, deepest: number): void {
    const w = this.world;
    if (this.difficulty.id === 'recruit') {
      w.setStance(this.side, 'advance');
      return;
    }
    const s = w.sides[this.side];
    const pushing = myValue > foeValue * (0.9 + this.personality.turtle * 0.6);
    const pinned = LANE - deepest < 30;
    const next = pushing || pinned || myValue === 0 ? 'advance' : 'hold';
    if (next !== s.stance) w.setStance(this.side, next);
  }

  private considerUnlocks(): void {
    const w = this.world;
    const s = w.sides[this.side];
    for (const def of AGES[s.age]!.units) {
      if (!def.unlockCost || s.unlocked.has(def.id)) continue;
      const isApex = def.cls === 'apex';
      // The apex is the end-game goal: save for it once the regular army is in place.
      const want = isApex ? def.unlockCost + def.cost * 0.3 : def.unlockCost + def.cost * (0.5 + this.personality.aggression);
      if (s.gold >= want) {
        w.unlock(this.side, def.id);
        this.reserve = 0;
        if (this.difficulty.adaptive && isApex) this.say('Enemy is assembling a compute cluster. Something big is coming.');
      } else if (this.reserve === 0 && this.rng.chance(0.2 * this.personality.tech)) {
        this.reserve = def.unlockCost * 0.7;
      }
    }
  }

  private trainUnits(mine: Unit[], foes: Unit[]): void {
    const w = this.world;
    const s = w.sides[this.side];
    const age = AGES[s.age]!;
    const options = age.units.filter((u) => !u.unlockCost || s.unlocked.has(u.id));
    if (options.length === 0) return;

    for (let attempts = 0; attempts < 3; attempts++) {
      if (s.queue.length >= 3) return;
      const spendable = s.gold - this.reserve;
      const pick = this.chooseUnit(options, mine, foes, spendable);
      if (!pick) return;
      if (w.train(this.side, pick.id) !== 'ok') return;
    }
  }

  /** Scores each trainable unit against what the enemy fields and what we already have. */
  private chooseUnit(options: UnitDef[], mine: Unit[], foes: Unit[], spendable: number): UnitDef | null {
    const s = this.world.sides[this.side];
    const queued = s.queue.map(unitDef);
    const ours = mine.map((u) => u.def).concat(queued);
    const front = ours.filter((d) => d.cls === 'infantry' || d.cls === 'armor' || d.cls === 'apex').length;
    const back = ours.length - front;

    // Enemy composition, weighted by value on the field.
    const share: Partial<Record<UnitClass, number>> = {};
    let total = 0;
    for (const f of foes) {
      share[f.def.cls] = (share[f.def.cls] ?? 0) + f.def.cost;
      total += f.def.cost;
    }

    let best: UnitDef | null = null;
    let bestScore = -Infinity;
    for (const def of options) {
      if (def.cost > spendable) continue;
      let score = 1;
      if (this.difficulty.adaptive && total > 0) {
        let counter = 0;
        for (const [cls, v] of Object.entries(share) as [UnitClass, number][]) {
          counter += (v / total) * classMultiplier(def.cls, cls) * (def.bonus?.[cls] ?? 1);
        }
        const airShare = (share.air ?? 0) / total;
        if (airShare > 0.15 && !def.hitsAir) counter *= 1 - airShare * 0.8;
        score *= counter;
      }
      const isFront = def.cls === 'infantry' || def.cls === 'armor' || def.cls === 'apex';
      if (isFront && front <= back * 0.6) score *= 1.8;
      if (!isFront && back < front * 0.5) score *= 1.4;
      if (front === 0 && !isFront) score *= 0.3;
      if (def.cls === 'armor') score *= 0.7 + (spendable / (def.cost * 3)) * 0.5;
      if (def.cls === 'apex') score *= spendable > def.cost * 1.3 ? 4 : 0.1;
      if (def.cls === 'support') score *= mine.some((u) => u.hp < u.maxHp * 0.7) ? 1.3 : 0.6;
      score *= this.rng.range(0.75, 1.25);
      if (score > bestScore) {
        bestScore = score;
        best = def;
      }
    }

    if (best && this.difficulty.adaptive && total > 0) {
      const dominant = (Object.entries(share) as [UnitClass, number][]).sort((a, b) => b[1] - a[1])[0];
      if (dominant && dominant[1] / total > 0.45 && dominant[0] !== this.lastCounter && classMultiplier(best.cls, dominant[0]) > 1.2) {
        this.lastCounter = dominant[0];
        this.say(`Enemy AI is adapting: ${best.name}s to counter your ${CLASS_INFO[dominant[0]].label.toLowerCase()}.`);
      }
    }
    return best;
  }

  private buildTurret(foes: Unit[], urgent: boolean): void {
    const w = this.world;
    const s = w.sides[this.side];
    const age = AGES[s.age]!;
    const wanted = Math.min(4, 1 + Math.floor((s.age + 1) * (0.35 + this.personality.turtle * 0.4)));

    // Replace a turret two ages out of date when rich.
    const cheapest = age.turrets.reduce((m, t) => Math.min(m, w.turretPrice(this.side, t.id)), Infinity);
    for (let i = 0; i < s.slots; i++) {
      const t = s.turrets[i];
      if (t && t.def.age <= s.age - 2 && s.gold > cheapest * 2.5) {
        w.sellTurret(this.side, i);
        break;
      }
    }

    const empty = s.turrets.slice(0, s.slots).findIndex((t) => t === null);
    const built = s.turrets.filter((t) => t !== null).length;
    const budget = urgent ? s.gold : s.gold - this.reserve - age.units[1]!.cost * 3;

    if (empty >= 0 && (urgent || built < wanted)) {
      const choice = this.chooseTurret(age.turrets, foes, budget);
      if (choice) w.buyTurret(this.side, empty, choice.id);
      return;
    }
    if (empty < 0 && built < wanted) {
      const price = w.slotPrice(this.side);
      if (price !== null && budget > price * 1.5) w.buySlot(this.side);
    }
  }

  private chooseTurret(turrets: TurretDef[], foes: Unit[], budget: number): TurretDef | null {
    const w = this.world;
    const air = foes.some((u) => u.def.layer === 'air');
    const armor = foes.filter((u) => u.def.cls === 'armor' || u.def.cls === 'apex').length;
    let best: TurretDef | null = null;
    let bestScore = -Infinity;
    for (const t of turrets) {
      const price = w.turretPrice(this.side, t.id);
      if (price > budget) continue;
      let score = price;
      if (air && t.hitsAir) score *= 1.8;
      if (armor > 1 && (t.role === 'heavy' || t.role === 'pierce')) score *= 1.5;
      score *= this.rng.range(0.8, 1.2);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  private considerUpgrades(): void {
    const w = this.world;
    const s = w.sides[this.side];
    const heavy = AGES[s.age]!.units[3]!;
    if (s.gold - this.reserve < heavy.cost * 2.5) return;
    const tracks = (['weapons', 'armor', 'economy'] as const)
      .map((track) => ({ track, price: w.upgradePrice(this.side, track) }))
      .filter((o): o is { track: 'weapons' | 'armor' | 'economy'; price: number } => o.price !== null)
      .sort((a, b) => a.price - b.price);
    const first = tracks[0];
    if (first && s.gold - this.reserve > first.price * 2) w.upgrade(this.side, first.track);
  }

  private say(message: string): void {
    // Only the side facing a human talks; the attract-mode AIs keep quiet.
    if (this.world.sides[other(this.side)].isAI) return;
    this.intel.push(message);
    if (this.intel.length > 12) this.intel.shift();
  }
}
