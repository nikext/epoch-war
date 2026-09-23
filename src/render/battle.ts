import * as THREE from 'three';
import { AGES } from '../sim/data/ages';
import type { GameEvent, SideState, Unit } from '../sim/entities';
import type { SideId } from '../sim/types';
import { aimY, dirOf, unitZ, wallX, type World } from '../sim/world';
import { Part } from './kit/builder';
import { staticMaterial } from './kit/materials';
import { buildBase, seatX, SLOT_POS, type BaseModel } from './models/bases';
import { unitTemplate } from './models';
import { ModelInstance } from './models/rig';
import { TEAMS } from './models/team';
import { TurretInstance, turretTemplate } from './models/turrets';
import { HealthBars } from './effects/bars';
import { Effects } from './effects/fx';
import { ProjectileViews } from './effects/projectiles';
import type { Renderer } from './renderer';

/**
 * Binds the simulation to the scene: one view per unit, per base and per
 * turret, plus every effect triggered by simulation events.
 */

const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

const MACHINE_KINDS = new Set(['vehicle', 'walker', 'flyer', 'hover', 'swarm', 'crewed']);
const ROBOTS = new Set(['android', 'railgunner', 'roboHound']);
const BLADES = new Set(['manAtArms', 'duelist', 'cuirassier', 'knight', 'pikeman', 'hoplite', 'roboHound']);

class UnitView {
  inst: ModelInstance;
  deadT = -1;
  private flip: number;
  private readonly seed = Math.random();
  private readonly born: number;
  private lastX: number;
  private tint = 0;
  private readonly tintColor = new THREE.Color();
  private buffGlow = 0;

  constructor(
    public unit: Unit,
    private readonly scene: THREE.Object3D,
    now: number,
  ) {
    this.inst = new ModelInstance(unitTemplate(unit.def.model, unit.side));
    this.flip = dirOf(unit.side);
    this.born = now;
    this.lastX = unit.x;
    this.scene.add(this.inst.root);
    this.place(1, 0);
    if (unit.def.age >= 6) {
      this.inst.material.userData.uniforms.uDissolveColor.value.set(TEAMS[unit.side].glow);
    }
  }

  get isMachine(): boolean {
    return MACHINE_KINDS.has(this.inst.meta.kind) || ROBOTS.has(this.unit.def.model);
  }

  rebuild(now: number): void {
    this.scene.remove(this.inst.root);
    this.inst = new ModelInstance(unitTemplate(this.unit.def.model, this.unit.side));
    this.scene.add(this.inst.root);
    this.flip = dirOf(this.unit.side);
    this.tint = 1;
    this.tintColor.set('#c77dff');
    void now;
  }

  flashTint(color: THREE.ColorRepresentation, amount: number): void {
    this.tintColor.set(color);
    this.tint = Math.max(this.tint, amount);
  }

  private place(alpha: number, _dt: number): void {
    const u = this.unit;
    const x = this.deadT >= 0 ? this.lastX : u.prevX + (u.x - u.prevX) * alpha;
    if (this.deadT < 0) this.lastX = x;
    const hover = u.def.layer === 'air' ? u.y : 0;
    this.inst.root.position.set(x, hover, unitZ(u));
  }

  update(alpha: number, dt: number, t: number): boolean {
    const u = this.unit;
    this.place(alpha, dt);
    if (this.deadT >= 0) this.deadT += Math.max(0, dt);

    const desired = dirOf(u.side) * (u.state === 'retreat' && this.deadT < 0 ? -1 : 1);
    this.flip += (desired - this.flip) * Math.min(1, dt * 10);
    const flipScale = Math.abs(this.flip) < 0.08 ? Math.sign(this.flip || 1) * 0.08 : this.flip;
    const pop = Math.min(1, (t - this.born) / 0.3);
    const s = 0.75 + 0.25 * (1 - Math.pow(1 - pop, 3));
    this.inst.root.scale.set(flipScale * s, s, s);

    let aim = 0;
    const target = u.target;
    if (target && target.alive && this.deadT < 0) {
      const dy = aimY(target) - (u.y + u.def.muzzle);
      const dx = Math.max(1, Math.abs(target.x - u.x));
      aim = Math.max(-0.7, Math.min(0.9, Math.atan2(dy, dx)));
    }
    this.inst.animate({
      t,
      dt,
      stride: u.stride,
      moving: this.deadT < 0 && (u.state === 'walk' || u.state === 'retreat'),
      attackT: this.deadT < 0 ? u.attackTime : 99,
      windup: u.def.windup,
      interval: u.def.interval,
      deadT: this.deadT,
      stunned: u.stun > 0 && this.deadT < 0,
      aim,
      seed: this.seed,
    });

    const uni = this.inst.material.userData.uniforms;
    uni.uFlash.value = this.deadT < 0 && u.hitAge < 0.1 ? (1 - u.hitAge / 0.1) * Math.min(0.55, 0.12 + u.hitFrac * 2.5) : 0;
    if (u.stun > 0 && this.deadT < 0) this.flashTint('#6fd3ff', 0.45);
    this.buffGlow += ((u.buff > 0 && this.deadT < 0 ? 1 : 0) - this.buffGlow) * Math.min(1, dt * 5);
    if (this.buffGlow > 0.01) {
      uni.uFlash.value = Math.max(uni.uFlash.value, this.buffGlow * (0.12 + Math.sin(t * 6) * 0.05));
      uni.uFlashColor.value.set('#ffcf5a');
    } else {
      uni.uFlashColor.value.set('#fff2d8');
    }
    this.tint = Math.max(0, this.tint - dt * 1.2);
    uni.uTint.value.copy(this.tintColor);
    uni.uTintAmount.value = Math.min(0.6, this.tint);
    if (this.deadT >= 0) {
      if (this.isMachine) {
        uni.uTint.value.set('#1a1512');
        uni.uTintAmount.value = Math.min(0.75, this.deadT * 2);
      }
      const start = this.inst.meta.kind === 'flyer' ? 1.0 : 0.9;
      uni.uDissolve.value = Math.max(0, Math.min(1, (this.deadT - start) / 1.0));
      return this.deadT < start + 1.05;
    }
    const spawnDissolve = u.def.age >= 6 ? Math.max(0, 1 - (t - this.born) / 0.5) : 0;
    uni.uDissolve.value = spawnDissolve;
    return true;
  }

  worldMuzzle(out: THREE.Vector3): THREE.Vector3 | null {
    this.inst.root.updateMatrixWorld(true);
    return this.inst.jointWorld('muzzle', out);
  }

  dispose(): void {
    this.scene.remove(this.inst.root);
    this.inst.material.dispose();
  }
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

class BaseView {
  readonly group = new THREE.Group();
  age = -1;
  private model: BaseModel | null = null;
  private outgoing: { model: BaseModel; t: number } | null = null;
  private rise = 1;
  readonly turrets: (TurretInstance | null)[] = [null, null, null, null];
  private turretIds: (string | null)[] = [null, null, null, null];
  private smokeClock = 0;
  /** How far each ledge has popped into view (0..1). */
  private readonly ledgeShown = [0, 0, 0, 0];
  /** Click targets over each ledge (player side only). */
  readonly hits: THREE.Mesh[] = [];
  /** Floating "+" markers over owned, empty ledges (player side only). */
  private readonly markers: THREE.Group[] = [];
  markersOn = false;
  hoverSlot = -1;

  constructor(
    readonly side: SideId,
    private readonly fx: Effects,
  ) {
    this.group.position.x = wallX(side);
    if (side === 1) this.group.scale.x = -1;
    if (side === 0) {
      const hitGeo = new THREE.BoxGeometry(2.6, 1.9, 2.4);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const ringGeo = new THREE.RingGeometry(0.4, 0.5, 40);
      const barGeo = new THREE.PlaneGeometry(0.46, 0.1);
      const discGeo = new THREE.CircleGeometry(0.4, 40);
      SLOT_POS.forEach((pos, slot) => {
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.set(pos.x + 0.3, pos.y + 0.55, pos.z);
        hit.userData.slot = slot;
        this.hits.push(hit);
        this.group.add(hit);

        const glow = (): THREE.MeshBasicMaterial =>
          new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf5a').multiplyScalar(1.8), transparent: true, depthWrite: false, toneMapped: false });
        const marker = new THREE.Group();
        const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x0b0f16, transparent: true, opacity: 0.55, depthWrite: false }));
        const ring = new THREE.Mesh(ringGeo, glow());
        const h = new THREE.Mesh(barGeo, glow());
        const v = new THREE.Mesh(barGeo, glow());
        v.rotation.z = Math.PI / 2;
        h.position.z = v.position.z = ring.position.z = 0.01;
        marker.add(disc, ring, h, v);
        marker.position.set(pos.x + 1.1, pos.y + 1.0, pos.z + 1.2);
        marker.renderOrder = 12;
        marker.visible = false;
        this.markers.push(marker);
        this.group.add(marker);
      });
    }
  }

  setAge(age: number, instant: boolean): void {
    if (age === this.age) return;
    this.age = age;
    if (this.model) {
      if (instant) {
        this.group.remove(this.model.root);
        disposeTree(this.model.root);
      } else {
        if (this.outgoing) {
          this.group.remove(this.outgoing.model.root);
          disposeTree(this.outgoing.model.root);
        }
        this.outgoing = { model: this.model, t: 0 };
      }
    }
    this.model = buildBase(age, TEAMS[this.side]);
    this.group.add(this.model.root);
    this.model.ledges.forEach((l, i) => {
      const shown = this.ledgeShown[i]!;
      l.visible = shown > 0;
      l.scale.setScalar(Math.max(0.001, shown));
    });
    this.rise = instant ? 1 : 0;
    if (instant) {
      this.turrets.forEach((inst, i) => {
        if (inst) inst.root.position.x = this.seat(i, inst);
      });
    } else {
      for (let i = 0; i < 8; i++) this.fx.dust(V1.set(wallX(this.side) - dirOf(this.side) * rand(0, 14), 0.3, rand(-6, 5)), 4, '#b8a888', 1.5, 2.2);
    }
  }

  syncTurrets(s: SideState): void {
    for (let i = 0; i < 4; i++) {
      const t = s.turrets[i];
      const id = t ? t.def.id : null;
      if (id === this.turretIds[i]) continue;
      const old = this.turrets[i];
      if (old) this.group.remove(old.root);
      this.turrets[i] = null;
      this.turretIds[i] = id;
      if (t) {
        const inst = new TurretInstance(turretTemplate(t.def.model, this.side));
        inst.root.position.copy(SLOT_POS[i]!);
        inst.root.position.x = this.seat(i, inst);
        this.group.add(inst.root);
        this.turrets[i] = inst;
      }
    }
  }

  /** Where a turret sits on its ledge against the current wall (local x). */
  private seat(slot: number, inst: TurretInstance): number {
    return this.model ? seatX(this.model, slot, inst.template.back) : SLOT_POS[slot]!.x;
  }

  slotWorld(slot: number, out: THREE.Vector3): THREE.Vector3 {
    const p = SLOT_POS[slot]!;
    const x = this.turrets[slot]?.root.position.x ?? p.x;
    return out.set(wallX(this.side) + (this.side === 0 ? x : -x), p.y + 0.9, p.z);
  }

  muzzleWorld(slot: number, out: THREE.Vector3): THREE.Vector3 | null {
    const t = this.turrets[slot];
    if (!t?.muzzle) return null;
    this.group.updateMatrixWorld(true);
    return t.muzzle.getWorldPosition(out);
  }

  dispose(): void {
    if (this.model) disposeTree(this.model.root);
    if (this.outgoing) disposeTree(this.outgoing.model.root);
  }

  update(s: SideState, t: number, dt: number): void {
    // Ledges appear only once bought, with a little pop.
    for (let i = 0; i < 4; i++) {
      const owned = i < s.slots;
      const cur = this.ledgeShown[i]!;
      const next = owned ? Math.min(1, cur + dt / 0.35) : 0;
      this.ledgeShown[i] = next;
      const ledge = this.model?.ledges[i];
      if (ledge) {
        ledge.visible = next > 0;
        const x = next;
        const k = x >= 1 ? 1 : 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
        ledge.scale.setScalar(Math.max(0.001, k));
      }
      const marker = this.markers[i];
      if (marker) {
        const show = this.markersOn && owned && !s.turrets[i];
        marker.visible = show;
        if (show) {
          const hover = this.hoverSlot === i;
          const pulse = 1 + Math.sin(t * 4 + i) * 0.08 + (hover ? 0.3 : 0);
          marker.scale.setScalar(pulse);
          marker.position.y = SLOT_POS[i]!.y + 1.0 + Math.sin(t * 2 + i) * 0.12;
        }
      }
    }
    if (this.model) {
      this.model.animate(t);
      if (this.rise < 1) {
        this.rise = Math.min(1, this.rise + dt / 1.4);
        const e = 1 - Math.pow(1 - this.rise, 3);
        this.model.root.position.y = -14 * (1 - e);
      }
    }
    if (this.outgoing) {
      this.outgoing.t += dt;
      this.outgoing.model.root.position.y = -this.outgoing.t * this.outgoing.t * 12;
      if (this.outgoing.t > 1.2) {
        this.group.remove(this.outgoing.model.root);
        disposeTree(this.outgoing.model.root);
        this.outgoing = null;
      }
    }
    for (let i = 0; i < 4; i++) {
      const inst = this.turrets[i];
      const tur = s.turrets[i];
      if (!inst || !tur) continue;
      // Slide onto the new wall's ledge after an age-up.
      const seat = this.seat(i, inst);
      inst.root.position.x += (seat - inst.root.position.x) * Math.min(1, dt * 4);
      const pos = this.slotWorld(i, V1);
      const aim = Math.atan2(tur.aimY - pos.y, Math.max(1, Math.abs(tur.aimX - pos.x)));
      inst.animate(Math.max(-1.2, Math.min(1.2, aim)), tur.fireAge, t, dt);
    }
    // A burning wall.
    const hp = s.baseHp / s.baseMaxHp;
    this.smokeClock -= dt;
    if (hp < 0.65 && this.smokeClock <= 0 && this.model) {
      this.smokeClock = 0.12 + hp * 0.3;
      for (const p of this.model.damagePoints) {
        if (Math.random() > 0.5) continue;
        V2.set(wallX(this.side) + (this.side === 0 ? p.x : -p.x), p.y, p.z);
        this.fx.smoke(V2, 1, '#3d3934', 1.4, 1.8);
        if (hp < 0.35) this.fx.fire(V2, 2, 0.8);
      }
    }
  }
}

function bomberGeometry(side: SideId): THREE.BufferGeometry {
  const p = new Part();
  const t = TEAMS[side];
  p.cyl(0.55, 0.3, 6.5, '#6b6f58', { rz: Math.PI / 2 });
  p.sphere(0.55, '#9fd0e8', { x: 3.2, s: [1, 0.8, 0.8], e: 0.2 });
  p.box(1.4, 0.12, 9.5, '#5d614c', { x: 0.3 });
  for (const z of [-3, -1.6, 1.6, 3]) {
    p.cyl(0.26, 0.26, 1.0, '#3d4034', { x: 0.9, y: -0.1, z, rz: Math.PI / 2 });
  }
  p.box(0.9, 0.08, 3.4, '#5d614c', { x: -3.1, y: 0.2 });
  p.box(0.8, 1.3, 0.1, t.main, { x: -3.2, y: 0.8 });
  p.cyl(0.5, 0.5, 0.05, t.main, { x: 0.3, y: 0.07, z: 3.4 });
  p.cyl(0.5, 0.5, 0.05, t.main, { x: 0.3, y: 0.07, z: -3.4 });
  return p.build();
}

interface Bomber {
  mesh: THREE.Mesh;
  side: SideId;
  x0: number;
  x1: number;
  t: number;
  delay: number;
  duration: number;
}

export interface BattleCallbacks {
  onGold?: (side: SideId, amount: number, pos: THREE.Vector3) => void;
  onRank?: (unit: Unit, pos: THREE.Vector3) => void;
}

export class BattleView {
  readonly fx = new Effects();
  readonly projectiles: ProjectileViews;
  readonly bars = new HealthBars();
  private readonly units = new Map<number, UnitView>();
  private readonly dying: UnitView[] = [];
  readonly bases: [BaseView, BaseView];
  private readonly root = new THREE.Group();
  private readonly bombers: Bomber[] = [];
  private lastProjectile = -1;
  private time = 0;
  private readonly barColor = [new THREE.Color(TEAMS[0].main).multiplyScalar(1.1), new THREE.Color(TEAMS[1].main).multiplyScalar(1.1)];

  constructor(
    private readonly renderer: Renderer,
    private readonly callbacks: BattleCallbacks = {},
  ) {
    this.projectiles = new ProjectileViews(this.fx);
    this.bases = [new BaseView(0, this.fx), new BaseView(1, this.fx)];
    this.root.add(this.fx.group, this.projectiles.group, this.bars.mesh, this.bases[0].group, this.bases[1].group);
    renderer.scene.add(this.root);
  }

  dispose(): void {
    for (const v of this.units.values()) v.dispose();
    for (const v of this.dying) v.dispose();
    this.units.clear();
    this.dying.length = 0;
    this.projectiles.clear();
    this.fx.clear();
    for (const b of this.bombers) {
      this.root.remove(b.mesh);
      b.mesh.geometry.dispose();
    }
    this.bombers.length = 0;
    for (const b of this.bases) b.dispose();
    this.renderer.scene.remove(this.root);
  }

  /** Rebuild every view from the world's current state (after a fast-forward). */
  resync(world: World): void {
    for (const v of this.units.values()) v.dispose();
    for (const v of this.dying) v.dispose();
    this.units.clear();
    this.dying.length = 0;
    this.projectiles.clear();
    this.fx.clear();
    for (const u of world.units) {
      if (u.alive) this.units.set(u.id, new UnitView(u, this.root, this.time - 1));
    }
    this.attach(world);
  }

  /** Match the scene to a world (e.g. after loading or starting a new war). */
  attach(world: World): void {
    for (const s of world.sides) {
      this.bases[s.id].setAge(s.age, true);
      this.bases[s.id].syncTurrets(s);
      this.renderer.setSideAge(s.id, s.age, true);
    }
  }

  handle(world: World, events: GameEvent[]): void {
    for (const e of events) this.event(world, e);
  }

  private viewOf(u: Unit | null | undefined): UnitView | undefined {
    return u ? this.units.get(u.id) : undefined;
  }

  private unitPos(u: Unit, out: THREE.Vector3): THREE.Vector3 {
    return out.set(u.x, aimY(u), unitZ(u));
  }

  private event(world: World, e: GameEvent): void {
    const fx = this.fx;
    switch (e.t) {
      case 'spawn': {
        const v = new UnitView(e.unit, this.root, this.time);
        this.units.set(e.unit.id, v);
        const p = V1.set(e.unit.x, 0.2, unitZ(e.unit));
        if (e.unit.def.age >= 6) fx.glitch(p.setY(1), TEAMS[e.unit.side].glow);
        else fx.dust(p, 2, '#b5a07c', 0.4, 0.7);
        break;
      }
      case 'projectile': {
        const src = this.viewOf(e.p.source);
        const muzzle = src?.worldMuzzle(V1) ?? undefined;
        this.projectiles.add(e.p, muzzle ?? undefined);
        this.lastProjectile = e.p.id;
        break;
      }
      case 'fire':
        this.fire(world, e);
        break;
      case 'impact': {
        const pos = this.projectiles.remove(e.p.id) ?? V1.set(e.p.ex, e.p.ey, e.p.ez);
        this.impact(e.p.kind, pos.clone(), e.p.splash, e.p.side);
        break;
      }
      case 'heal': {
        const v = this.viewOf(e.unit);
        if (v) fx.heal(this.unitPos(e.unit, V1));
        break;
      }
      case 'death': {
        const v = this.viewOf(e.unit);
        if (!v) break;
        this.units.delete(e.unit.id);
        v.deadT = 0;
        this.dying.push(v);
        const p = this.unitPos(e.unit, V1);
        if (v.isMachine) {
          const size = Math.min(2.2, 0.6 + e.unit.def.size * 0.35);
          fx.explosion(p, size, e.unit.def.age >= 6 ? TEAMS[e.unit.side].glow : '#ff8a2a', e.unit.def.layer !== 'air');
        } else {
          fx.dust(V2.set(p.x, 0.3, p.z), 3, '#a89478', 0.5, 0.9);
        }
        break;
      }
      case 'baseHit': {
        const p = V1.set(e.x + (e.side === 0 ? -0.3 : 0.3), Math.max(0.5, e.y), rand(-2.5, 2.5));
        if (Math.random() < 0.5) fx.dust(p, 2, '#a89a86', 0.4, 0.9);
        fx.sparks(p, 3, '#ffe3a0', 4, 0.12);
        break;
      }
      case 'gold':
        this.callbacks.onGold?.(e.side, e.amount, V1.set(e.x, e.y, 0).clone());
        break;
      case 'evolve': {
        this.bases[e.side].setAge(e.age, false);
        this.renderer.setSideAge(e.side, e.age, false);
        if (!world.sides[e.side].isAI || world.sides.every((s) => s.isAI)) {
          if (e.side === 0) this.renderer.setPlayerAge(e.age);
        }
        const x = wallX(e.side) - dirOf(e.side) * 4;
        fx.ring(V1.set(x, 0.3, 0), AGES[e.age]!.accent, 30, 1.6);
        fx.ring(V1.set(x, 6, 0), AGES[e.age]!.accent, 18, 1.2, true);
        for (let i = 0; i < 40; i++) fx.glow(V1.set(x + rand(-6, 6), rand(0, 12), rand(-5, 5)), AGES[e.age]!.accent, rand(0.3, 0.8), rand(0.5, 1.4), 2.5);
        fx.shake = Math.max(fx.shake, 0.4);
        break;
      }
      case 'special':
        this.special(world, e.side, e.id, e.x);
        break;
      case 'lightning': {
        const top = V1.set(e.x + rand(-6, 6), 34, rand(-4, 2));
        const bottom = V2.set(e.x, e.target ? aimY(e.target) : 0.2, e.target ? unitZ(e.target) : 0);
        fx.lightning(top.clone(), bottom.clone(), '#bfe4ff', 0.2, 0.35, 1.6);
        fx.glow(bottom, '#dff2ff', 3, 0.2, 4);
        fx.sparks(bottom, 14, '#dff2ff', 8, 0.15);
        fx.light(bottom, '#bfe4ff', 80, 0.25);
        fx.decal(bottom.x, bottom.z, 0, 2);
        fx.shake = Math.max(fx.shake, 0.3);
        this.renderer.flashScreen('#cfe8ff', 0.25);
        break;
      }
      case 'convert': {
        const v = this.viewOf(e.unit);
        if (v) {
          v.rebuild(this.time);
          fx.glitch(this.unitPos(e.unit, V1), '#c77dff');
          fx.ring(V1.set(e.unit.x, 0.2, unitZ(e.unit)), '#c77dff', 3, 0.5);
        }
        break;
      }
      case 'stun': {
        const v = this.viewOf(e.unit);
        if (v) fx.sparks(this.unitPos(e.unit, V1), 8, '#7fdcff', 4, 0.12);
        break;
      }
      case 'rankUp': {
        const v = this.viewOf(e.unit);
        if (v) {
          const p = this.unitPos(e.unit, V1);
          p.y += e.unit.def.layer === 'air' ? 1 : v.inst.meta.height * 0.6;
          for (let i = 0; i < 12; i++) fx.glow(V2.set(p.x + rand(-0.5, 0.5), p.y + rand(0, 1), p.z + rand(-0.3, 0.3)), '#ffcf5a', 0.3, rand(0.5, 1), 2.5);
          this.callbacks.onRank?.(e.unit, p.clone());
        }
        break;
      }
      case 'turret': {
        this.bases[e.side].syncTurrets(world.sides[e.side]);
        const p = this.bases[e.side].slotWorld(e.slot, V1);
        fx.dust(p, 6, '#b8a888', 0.6, 1);
        if (e.action === 'build') fx.sparks(p, 10, '#ffe3a0', 4, 0.12);
        break;
      }
      case 'bomber': {
        const mesh = new THREE.Mesh(bomberGeometry(e.side), staticMaterial);
        mesh.castShadow = true;
        if (e.side === 1) mesh.scale.x = -1;
        this.root.add(mesh);
        this.bombers.push({ mesh, side: e.side, x0: e.x0, x1: e.x1, t: 0, delay: e.delay, duration: e.duration });
        break;
      }
      case 'gameOver': {
        const loser = e.winner === 0 ? 1 : 0;
        const x = wallX(loser as SideId);
        for (let i = 0; i < 6; i++) fx.explosion(V1.set(x - dirOf(loser as SideId) * rand(0, 10), rand(1, 9), rand(-4, 3)), 2.2);
        this.renderer.flashScreen('#fff0d0', 0.35);
        break;
      }
      default:
        break;
    }
  }

  private fire(world: World, e: Extract<GameEvent, { t: 'fire' }>): void {
    const fx = this.fx;
    const team = TEAMS[e.side];
    // Where the shot visually starts.
    let from: THREE.Vector3 | null = null;
    if (e.unit) from = this.viewOf(e.unit)?.worldMuzzle(new THREE.Vector3()) ?? null;
    else if (e.turretSlot >= 0) from = this.bases[e.side].muzzleWorld(e.turretSlot, new THREE.Vector3());
    const z0 = e.unit ? unitZ(e.unit) : 0;
    if (!from) from = new THREE.Vector3(e.sx, e.sy, z0);
    const to = e.target ? this.unitPos(e.target, new THREE.Vector3()) : new THREE.Vector3(e.ex, e.ey, rand(-1.5, 1.5));
    const dir = dirOf(e.side);

    switch (e.kind) {
      case 'melee': {
        if (!e.target) break;
        const model = e.unit?.def.model ?? '';
        fx.hit(to, BLADES.has(model) ? 'blade' : 'blunt');
        break;
      }
      case 'hitscan': {
        const heavy = e.projectile === 'musketball';
        const n = Math.max(1, e.burst);
        for (let i = 0; i < n; i++) {
          V2.copy(to).add(V1.set(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3)));
          fx.beam(from, V2, heavy ? '#ffe2a8' : '#ffd27a', heavy ? 0.035 : 0.022, 0.06 + i * 0.02, 0.9);
        }
        fx.muzzle(from, dir, '#ffc86a', heavy ? 1.2 : 0.7, heavy ? 6 : 1);
        fx.hit(to, 'bullet');
        break;
      }
      case 'beam': {
        const color = team.glow;
        fx.beam(from, to, color, e.unit?.def.cls === 'apex' ? 0.35 : 0.14, 0.22);
        fx.beam(from, to, '#ffffff', e.unit?.def.cls === 'apex' ? 0.12 : 0.05, 0.18);
        fx.glow(from, color, 1, 0.12, 4);
        fx.hit(to, 'energy', color);
        break;
      }
      case 'pierce': {
        const last = e.chain && e.chain.length ? e.chain[e.chain.length - 1]! : null;
        const end = last ? this.unitPos(last, new THREE.Vector3()) : to;
        end.x += dir * 6;
        fx.beam(from, end, team.glow, 0.2, 0.35);
        fx.beam(from, end, '#ffffff', 0.07, 0.3);
        fx.glow(from, team.glow, 1.5, 0.15, 4);
        for (const u of e.chain ?? []) fx.hit(this.unitPos(u, V1), 'energy', team.glow);
        fx.shake = Math.max(fx.shake, 0.08);
        break;
      }
      case 'chain': {
        let prev = from.clone();
        for (const u of e.chain ?? []) {
          const p = this.unitPos(u, new THREE.Vector3());
          fx.lightning(prev, p, team.glow, 0.08, 0.2, 0.5);
          fx.hit(p, 'energy', team.glow);
          prev = p;
        }
        break;
      }
      case 'flame': {
        const reach = Math.max(2, Math.abs(to.x - from.x) + 1);
        for (let i = 0; i < 26; i++) {
          const sp = rand(6, 11);
          fx.add.emit({
            x: from.x, y: from.y, z: from.z, vx: dir * sp, vy: rand(-0.6, 1.2), vz: rand(-0.7, 0.7),
            life: (reach / sp) * rand(0.8, 1.1), size: 0.25, size1: 1.3, color: '#ffe08a', color1: '#ff5a1a',
            alpha: 0.95, alpha1: 0, drag: 0.6, gravity: -2, intensity: 2.4,
          });
        }
        fx.smoke(to, 2, '#3a3430', 1, 1.2);
        break;
      }
      case 'heal': {
        fx.beam(from, to, '#b8ff9a', 0.05, 0.25, 0.6);
        fx.glow(from, '#fff0a0', 0.8, 0.3, 3);
        break;
      }
      case 'projectile': {
        if (this.lastProjectile >= 0) this.projectiles.setMuzzle(this.lastProjectile, from);
        switch (e.projectile) {
          case 'cannonball':
          case 'shell':
            fx.muzzle(from, dir, '#ffc86a', 1.6, 6);
            fx.shake = Math.max(fx.shake, 0.08);
            break;
          case 'rocket':
          case 'missile':
            fx.smoke(from, 3, '#d8d2c8', 0.8, 0.4);
            fx.glow(from, '#ffc070', 1, 0.1, 3);
            break;
          case 'flak':
            fx.muzzle(from, dir, '#ffc86a', 1.2, 3);
            break;
          case 'plasma':
            fx.glow(from, team.glow, 0.8, 0.1, 4);
            break;
          case 'fireball':
          case 'sunbolt':
            fx.glow(from, '#ffd65a', 1, 0.2, 3);
            break;
          default:
            break;
        }
        break;
      }
    }
    void world;
  }

  private impact(kind: string, p: THREE.Vector3, splash: number, side: SideId): void {
    const fx = this.fx;
    if (p.y < 0.2) p.y = 0.2;
    switch (kind) {
      case 'rock':
      case 'spear':
      case 'arrow':
      case 'bolt':
      case 'javelin':
        fx.hit(p, 'blunt');
        break;
      case 'egg':
        for (let i = 0; i < 8; i++) fx.soft.emit({ x: p.x, y: p.y, z: p.z, vx: rand(-2, 2), vy: rand(0, 3), vz: rand(-2, 2), life: 0.5, size: 0.25, size1: 0.1, color: i % 2 ? '#ffd23a' : '#f4efe6', alpha: 1, alpha1: 0, gravity: 9 });
        break;
      case 'boulder':
        fx.dust(p, 10, '#9d8c70', 1.2, 1.6);
        fx.sparks(p, 6, '#d8cbb0', 5, 0.18);
        fx.decal(p.x, p.z, 0, 2);
        fx.shake = Math.max(fx.shake, 0.12);
        break;
      case 'cannonball':
        fx.dust(p, 8, '#9d8c70', 0.8, 1.3);
        fx.sparks(p, 8, '#ffd27a', 6, 0.14);
        if (splash > 0) fx.decal(p.x, p.z, 0, 1.5);
        fx.shake = Math.max(fx.shake, 0.1);
        break;
      case 'fireball':
      case 'firepot':
        fx.fire(p, 14, 0.9);
        fx.glow(p, '#ffb050', 2, 0.15, 3);
        if (splash > 0) fx.decal(p.x, p.z, 0, splash);
        break;
      case 'sunbolt':
        fx.glow(p, '#ffe08a', 1.6, 0.2, 4);
        fx.sparks(p, 10, '#ffe08a', 5, 0.14);
        break;
      case 'oil':
        fx.fire(p, 20, 1.2, '#ff6a1a');
        fx.smoke(p, 4, '#5a5048', 1.4, 1.5);
        break;
      case 'plasma':
        fx.hit(p, 'energy', TEAMS[side].glow);
        break;
      case 'meteor':
        fx.explosion(p, 1.8, '#ff6a2a');
        this.renderer.flashScreen('#ffb070', 0.08);
        break;
      case 'flak':
        fx.explosion(p, 0.7, '#ffa040', false);
        fx.smoke(p, 3, '#2e2b28', 1.2, 0.3);
        break;
      default:
        fx.explosion(p, Math.max(0.6, Math.min(1.8, splash * 0.45)), '#ff8a2a', p.y < 3);
    }
  }

  private special(world: World, side: SideId, id: string, x: number): void {
    const fx = this.fx;
    switch (id) {
      case 'rally':
        for (const u of world.units) {
          if (!u.alive || u.side !== side) continue;
          const p = this.unitPos(u, V1);
          fx.ring(V2.set(p.x, 0.2, p.z), '#ffcf5a', 2.5, 0.8);
          for (let i = 0; i < 5; i++) fx.glow(V2.set(p.x + rand(-0.5, 0.5), p.y + rand(0, 1.5), p.z), '#ffcf5a', 0.35, rand(0.6, 1.2), 2.5);
        }
        break;
      case 'override':
        fx.ring(V1.set(x, 0.3, 0), '#c77dff', 34, 0.9);
        fx.ring(V1.set(x, 4, 0), '#7fdcff', 26, 0.7, true);
        fx.light(V1.set(x, 4, 0), '#c77dff', 90, 0.5);
        this.renderer.flashScreen('#b07dff', 0.18);
        break;
      case 'drones':
        break;
      case 'meteor':
        this.renderer.flashScreen('#ffb070', 0.06);
        break;
      default:
        break;
    }
  }

  update(world: World, alpha: number, dt: number, simDt: number): void {
    this.time += dt;
    const t = this.time;
    for (const v of this.units.values()) v.update(alpha, dt, t);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const v = this.dying[i]!;
      if (!v.update(alpha, dt, t)) {
        v.dispose();
        this.dying.splice(i, 1);
      }
    }
    for (const s of world.sides) this.bases[s.id].update(s, t, dt);
    this.projectiles.update(alpha * simDt, dt);

    for (let i = this.bombers.length - 1; i >= 0; i--) {
      const b = this.bombers[i]!;
      b.t += dt;
      const lead = 1.4;
      const f = (b.t - b.delay) / b.duration;
      const x = b.x0 + (b.x1 - b.x0) * f;
      b.mesh.position.set(x, 15 + Math.sin(b.t) * 0.3, -1.5);
      b.mesh.rotation.x = Math.sin(b.t * 1.3) * 0.05;
      if (b.t > b.delay + b.duration + lead) {
        this.root.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.bombers.splice(i, 1);
      }
    }

    // Health bars.
    this.bars.begin();
    for (const v of this.units.values()) {
      const u = v.unit;
      const top = v.inst.root.position;
      V1.set(top.x, top.y + v.inst.meta.height + 0.25, top.z);
      const width = Math.min(2.4, 0.9 + u.def.size * 0.22);
      const f = u.hp / u.maxHp;
      this.bars.push(V1, width, f, this.barColor[u.side]!, u.rank, f < 0.999 || u.rank > 0 ? 0.95 : 0.55);
    }
    this.bars.end();

    this.fx.soft.setLight(this.renderer.smokeLight);
    this.fx.update(dt);
    if (this.fx.shake > 0) {
      this.renderer.rig.shake(this.fx.shake);
      this.fx.shake = 0;
    }
  }

  /** Which of the player's ledges (if any) a ray hits. */
  pickSlot(ray: THREE.Raycaster): number | null {
    const base = this.bases[0];
    base.group.updateMatrixWorld(true);
    const hit = ray.intersectObjects(base.hits, false)[0];
    return hit ? (hit.object.userData.slot as number) : null;
  }

  /** Show the "+" markers over empty ledges (only while the player is at war). */
  setMarkers(on: boolean): void {
    this.bases[0].markersOn = on;
  }

  set hoverSlot(slot: number) {
    this.bases[0].hoverSlot = slot;
  }

  /** How many unit views exist (debug). */
  get viewCount(): number {
    return this.units.size + this.dying.length;
  }
}
