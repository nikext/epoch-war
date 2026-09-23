import * as THREE from 'three';
import { createModelMaterial, type ModelMaterial } from '../kit/materials';

/**
 * Procedural animation. Every animated model is a tree of named joints; an
 * animator reads the unit's state (walking, attacking, dying…) and poses
 * those joints every frame. Models are built facing +x with their "near" side
 * (+z) toward the camera; the enemy side is mirrored with scale.x = −1, so
 * weapons are always on the side you can see.
 */

export type AnimKind = 'humanoid' | 'rider' | 'beast' | 'vehicle' | 'flyer' | 'walker' | 'crewed' | 'swarm' | 'hover';

/** How a humanoid (or a rider) attacks. */
export type AttackStyle = 'swing' | 'thrust' | 'throw' | 'bow' | 'gun' | 'heavy' | 'cast' | 'shoulder';

export interface AnimInput {
  /** Render clock, seconds. */
  t: number;
  dt: number;
  /** Metres walked, drives the gait. */
  stride: number;
  moving: boolean;
  /** Seconds since the current attack started (large when idle). */
  attackT: number;
  windup: number;
  interval: number;
  /** Seconds since death, or −1 while alive. */
  deadT: number;
  stunned: boolean;
  /** Pitch toward the target, radians, positive is up. */
  aim: number;
  /** A per-unit constant in [0, 1) for idle variation. */
  seed: number;
}

export interface ModelMeta {
  kind: AnimKind;
  style: AttackStyle;
  /** Hand holding the main weapon. */
  hand: 'near' | 'far';
  /** Health-bar height above the model's origin. */
  height: number;
  /** Metres per full gait cycle. */
  strideLength: number;
  /** For vehicles/crewed: seconds of barrel recoil. */
  recoil?: number;
  /** For flyers / hover: bob amplitude. */
  bob?: number;
}

export interface ModelTemplate {
  object: THREE.Group;
  meta: ModelMeta;
}

export class ModelInstance {
  readonly root: THREE.Group;
  readonly material: ModelMaterial;
  readonly meta: ModelMeta;
  private readonly j: Map<string, THREE.Object3D> = new Map();
  /** Rest rotations/positions of joints, captured at build time. */
  private readonly rest = new Map<THREE.Object3D, { rot: THREE.Euler; pos: THREE.Vector3 }>();
  private move = 0;
  private attackBlend = 0;

  constructor(template: ModelTemplate) {
    this.meta = template.meta;
    this.root = template.object.clone(true);
    this.material = createModelMaterial();
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = this.material;
      else if (o.name) {
        this.j.set(o.name, o);
        this.rest.set(o, { rot: o.rotation.clone(), pos: o.position.clone() });
      }
    });
  }

  joint(name: string): THREE.Object3D | undefined {
    return this.j.get(name);
  }

  /** World-space position of a joint (e.g. the muzzle). */
  jointWorld(name: string, target: THREE.Vector3): THREE.Vector3 | null {
    const o = this.j.get(name);
    if (!o) return null;
    return o.getWorldPosition(target);
  }

  private reset(name: string): THREE.Object3D | undefined {
    const o = this.j.get(name);
    if (!o) return undefined;
    const r = this.rest.get(o)!;
    o.rotation.copy(r.rot);
    o.position.copy(r.pos);
    return o;
  }

  animate(a: AnimInput): void {
    const k = Math.min(1, a.dt * 8);
    this.move += ((a.moving ? 1 : 0) - this.move) * k;
    const attacking = a.attackT < a.windup + 0.6;
    this.attackBlend += ((attacking ? 1 : 0) - this.attackBlend) * Math.min(1, a.dt * 10);

    switch (this.meta.kind) {
      case 'humanoid':
        this.humanoid(a, '', false);
        break;
      case 'rider':
        this.beast(a);
        this.humanoid(a, 'r', true);
        break;
      case 'beast':
        this.beast(a);
        break;
      case 'vehicle':
      case 'crewed':
        this.vehicle(a);
        if (this.meta.kind === 'crewed') this.humanoid(a, 'r', false);
        break;
      case 'walker':
        this.walker(a);
        break;
      case 'flyer':
        this.flyer(a);
        break;
      case 'swarm':
        this.swarm(a);
        break;
      case 'hover':
        this.hover(a);
        break;
    }

    if (a.deadT >= 0) this.death(a);
    if (a.stunned) {
      const body = this.j.get('body');
      if (body) body.position.x += Math.sin(a.t * 60) * 0.03;
    }
  }

  // ─── Humanoids ────────────────────────────────────────────────────────────

  private humanoid(a: AnimInput, p: string, seated: boolean): void {
    const body = this.reset(p ? `${p}body` : 'body');
    const hips = this.reset(`${p}hips`);
    const torso = this.reset(`${p}torso`);
    const head = this.reset(`${p}head`);
    const armN = this.reset(`${p}armN`);
    const armF = this.reset(`${p}armF`);
    const legN = this.reset(`${p}legN`);
    const legF = this.reset(`${p}legF`);
    const weaponN = this.reset(`${p}weaponN`);
    const weaponF = this.reset(`${p}weaponF`);
    if (!torso || !armN || !armF) return;

    const phase = (a.stride / this.meta.strideLength) * Math.PI * 2;
    const m = seated ? 0 : this.move;
    const swing = Math.sin(phase);

    // Legs and bob.
    if (!seated && legN && legF) {
      legN.rotation.z += swing * 0.62 * m;
      legF.rotation.z -= swing * 0.62 * m;
    }
    if (body && !seated) body.position.y += Math.abs(Math.cos(phase)) * 0.06 * m;
    if (hips && !seated) hips.rotation.y += swing * 0.08 * m;

    // Idle breathing, and a little life in the head.
    const breathe = Math.sin(a.t * 2.2 + a.seed * 10) * 0.02;
    torso.rotation.z += breathe * 0.5 - 0.06 * m;
    if (head) head.rotation.z += Math.sin(a.t * 0.9 + a.seed * 7) * 0.05 * (1 - m);

    const hand = this.meta.hand;
    const armW = hand === 'near' ? armN : armF;
    const armO = hand === 'near' ? armF : armN;
    const weapon = hand === 'near' ? weaponN : weaponF;
    const offWeapon = hand === 'near' ? weaponF : weaponN;

    // Arms swing opposite to legs when walking free-handed.
    const walkArm = swing * 0.45 * m;

    const at = a.attackT;
    const w = Math.max(0.05, a.windup);
    const ease = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

    switch (this.meta.style) {
      case 'swing': {
        // Guard: weapon forward and up. Wind up over the shoulder, strike down.
        let z = 0.55;
        let lean = 0;
        if (at < w) {
          z = 0.55 + (3.3 - 0.55) * ease(at / w);
          lean = -0.12 * ease(at / w);
        } else if (at < w + 0.13) {
          const u = ease((at - w) / 0.13);
          z = 3.3 + (0.15 - 3.3) * u;
          lean = -0.12 + 0.3 * u;
        } else if (at < w + 0.55) {
          const u = ease((at - w - 0.13) / 0.42);
          z = 0.15 + (0.55 - 0.15) * u;
          lean = 0.18 * (1 - u);
        } else {
          z = 0.55 + walkArm * 0.4;
        }
        armW.rotation.z += z;
        torso.rotation.z -= lean;
        armO.rotation.z += 0.7 - walkArm * 0.3;
        break;
      }
      case 'thrust': {
        // Weapon held level, driven forward from the shoulder.
        let push = 0;
        if (at < w) push = -0.22 * ease(at / w);
        else if (at < w + 0.12) push = -0.22 + 0.55 * ease((at - w) / 0.12);
        else if (at < w + 0.5) push = 0.33 * (1 - ease((at - w - 0.12) / 0.38));
        armW.rotation.z += 1.25;
        armW.position.x += push;
        armO.rotation.z += 1.1;
        armO.position.x += push * 0.6;
        torso.rotation.z -= push * 0.35;
        if (weapon) weapon.rotation.z += -1.25 + a.aim * 0.5;
        break;
      }
      case 'throw': {
        let z = 0.35 + walkArm;
        if (at < w) z = 0.35 + (3.1 - 0.35) * ease(at / w);
        else if (at < w + 0.12) z = 3.1 + (1.0 - 3.1) * ease((at - w) / 0.12);
        else if (at < w + 0.5) z = 1.0 + (0.35 - 1.0) * ease((at - w - 0.12) / 0.38);
        armW.rotation.z += z;
        armO.rotation.z += 0.9 - walkArm * 0.5;
        torso.rotation.z -= at < w ? -0.1 * ease(at / w) : at < w + 0.3 ? 0.18 : 0;
        // Hide the thrown item for a beat after release.
        if (weapon) weapon.visible = !(at >= w && at < w + Math.min(0.9, a.interval * 0.6));
        break;
      }
      case 'bow': {
        // Bow arm straight out; string hand draws back, snaps on release.
        const draw = at < w ? ease(at / w) : at < w + 0.08 ? 1 - (at - w) / 0.08 : 0;
        const ready = attacking(at, w) ? 1 : 0.35;
        armO.rotation.z += 0.5 + 1.05 * ready;
        armW.rotation.z += 0.5 + 1.0 * ready;
        armW.position.x -= draw * 0.28;
        if (offWeapon) offWeapon.rotation.z += -(0.5 + 1.05 * ready) + a.aim * 0.6;
        torso.rotation.z -= 0.05 * draw;
        break;
      }
      case 'gun':
      case 'shoulder':
      case 'heavy': {
        const raise = this.meta.style === 'heavy' ? 0.95 : this.meta.style === 'shoulder' ? 1.55 : 1.4;
        const fire = at >= w ? Math.max(0, 1 - (at - w) / 0.18) : 0;
        const hold = 0.55 + 0.45 * this.attackBlend;
        const zW = raise * hold + walkArm * 0.15 * (1 - this.attackBlend) - fire * 0.25;
        armW.rotation.z += zW;
        armO.rotation.z += (raise + 0.15) * hold - fire * 0.2;
        armW.position.x -= fire * 0.06;
        torso.rotation.z += fire * 0.08;
        if (weapon) weapon.rotation.z += -zW + a.aim * this.attackBlend;
        break;
      }
      case 'cast': {
        let z = 0.45 + walkArm * 0.5;
        if (at < w) z = 0.45 + 2.3 * ease(at / w);
        else if (at < w + 0.3) z = 2.75 - 1.4 * ease((at - w) / 0.3);
        else if (at < w + 0.6) z = 1.35 - 0.9 * ease((at - w - 0.3) / 0.3);
        armW.rotation.z += z;
        armO.rotation.z += 0.3 + (at < w + 0.3 ? 1.2 * ease(Math.min(1, at / w)) : 0) - walkArm * 0.5;
        if (weapon) weapon.rotation.z += -z * 0.85;
        break;
      }
    }
  }

  // ─── Mounts ───────────────────────────────────────────────────────────────

  private beast(a: AnimInput): void {
    const mount = this.reset('mount');
    const neck = this.reset('mNeck');
    const head = this.reset('mHead');
    const tail = this.reset('mTail');
    const legs = ['mLegFN', 'mLegFF', 'mLegBN', 'mLegBF'].map((n) => this.reset(n));
    const knees = ['mKneeFN', 'mKneeFF', 'mKneeBN', 'mKneeBF'].map((n) => this.reset(n));
    const phase = (a.stride / this.meta.strideLength) * Math.PI * 2;
    const m = this.move;
    const offsets = [0, Math.PI, Math.PI, 0];
    legs.forEach((leg, i) => {
      if (!leg) return;
      const s = Math.sin(phase + offsets[i]!);
      leg.rotation.z += s * 0.5 * m;
      const knee = knees[i];
      if (knee) knee.rotation.z += Math.max(0, -Math.cos(phase + offsets[i]!)) * (i < 2 ? -0.7 : 0.7) * m;
    });
    if (mount) mount.position.y += Math.abs(Math.sin(phase)) * 0.08 * m;
    if (mount) mount.rotation.z += Math.sin(phase * 2) * 0.02 * m;
    if (tail) tail.rotation.y += Math.sin(a.t * 3 + a.seed * 5) * 0.3;

    // Attack: lunge the head (horns, tusks, jaws) forward and down.
    const w = Math.max(0.05, a.windup);
    const at = a.attackT;
    let lunge = 0;
    if (at < w) lunge = -0.3 * (at / w);
    else if (at < w + 0.15) lunge = -0.3 + 0.9 * ((at - w) / 0.15);
    else if (at < w + 0.6) lunge = 0.6 * (1 - (at - w - 0.15) / 0.45);
    if (this.meta.kind === 'rider') lunge *= 0.5;
    if (head) head.rotation.z -= lunge * 0.5 + Math.sin(a.t * 1.3 + a.seed * 3) * 0.04 * (1 - m);
    if (neck) neck.rotation.z -= lunge * 0.35 - Math.sin(phase * 2) * 0.05 * m;
    if (mount) mount.position.x += Math.max(0, lunge) * 0.25;
  }

  // ─── Machines ─────────────────────────────────────────────────────────────

  private vehicle(a: AnimInput): void {
    const hull = this.reset('hull');
    const turret = this.reset('turret');
    const barrel = this.reset('barrel');
    const m = this.move;
    if (hull) {
      hull.position.y += Math.sin(a.t * 30 + a.seed * 10) * 0.012 * (0.4 + m);
      hull.rotation.z += Math.sin(a.stride * 1.3) * 0.012 * m;
    }
    for (let i = 0; i < 8; i++) {
      const wheel = this.reset(`wheel${i}`);
      if (wheel) wheel.rotation.z = -a.stride * 2.2;
    }
    const w = Math.max(0.05, a.windup);
    const recoil = a.attackT >= w ? Math.max(0, 1 - (a.attackT - w) / (this.meta.recoil ?? 0.35)) : 0;
    if (turret) turret.rotation.z += a.aim * 0.5;
    if (barrel) {
      barrel.position.x -= recoil * 0.35;
      if (!turret) barrel.rotation.z += a.aim * 0.6;
    }
    if (hull) hull.rotation.z += recoil * 0.03;
  }

  private walker(a: AnimInput): void {
    const body = this.reset('body');
    const torso = this.reset('torso');
    const phase = (a.stride / this.meta.strideLength) * Math.PI * 2;
    const m = this.move;
    const legs = [
      [this.reset('legN'), this.reset('kneeN'), this.reset('footN'), 0],
      [this.reset('legF'), this.reset('kneeF'), this.reset('footF'), Math.PI],
    ] as const;
    for (const [leg, knee, foot, off] of legs) {
      const s = Math.sin(phase + off);
      const lift = Math.max(0, Math.cos(phase + off));
      if (leg) leg.rotation.z += s * 0.45 * m + lift * 0.25 * m;
      if (knee) knee.rotation.z -= lift * 0.6 * m;
      if (foot) foot.rotation.z += lift * 0.35 * m - s * 0.2 * m;
    }
    if (body) body.position.y += (Math.abs(Math.sin(phase)) * 0.14 - 0.07) * m;
    if (torso) torso.rotation.y += Math.sin(phase) * 0.04 * m;
    const gun = this.reset('guns');
    const w = Math.max(0.05, a.windup);
    const recoil = a.attackT >= w ? Math.max(0, 1 - (a.attackT - w) / 0.3) : 0;
    if (gun) {
      gun.rotation.z += a.aim * 0.7;
      gun.position.x -= recoil * 0.15;
    }
    const armN = this.reset('armN');
    const armF = this.reset('armF');
    if (armN) armN.rotation.z += Math.sin(phase) * 0.2 * m;
    if (armF) armF.rotation.z -= Math.sin(phase) * 0.2 * m;
  }

  private flyer(a: AnimInput): void {
    const body = this.reset('body');
    const prop = this.reset('prop');
    const rotor = this.reset('rotor');
    const tailRotor = this.reset('tailRotor');
    if (body) {
      body.position.y += Math.sin(a.t * 1.7 + a.seed * 6) * (this.meta.bob ?? 0.25);
      body.rotation.z += Math.sin(a.t * 1.1 + a.seed * 4) * 0.04 - this.move * 0.06;
      body.rotation.x += Math.sin(a.t * 0.8 + a.seed * 9) * 0.05;
    }
    if (prop) prop.rotation.x = a.t * 40;
    if (rotor) rotor.rotation.y = a.t * 28;
    if (tailRotor) tailRotor.rotation.z = a.t * 45;
    const w = Math.max(0.05, a.windup);
    if (body && a.attackT < w + 0.3) body.rotation.z -= 0.08 * Math.sin(Math.min(1, a.attackT / (w + 0.3)) * Math.PI);
  }

  private swarm(a: AnimInput): void {
    for (let i = 0; i < 40; i++) {
      const d = this.j.get(`d${i}`);
      if (!d) break;
      const r = this.rest.get(d)!;
      const s = i * 1.618 + a.seed * 10;
      const attack = a.attackT < a.windup + 0.4 ? 1.6 : 1;
      d.position.set(
        r.pos.x + Math.sin(a.t * (1.3 + (i % 5) * 0.21) + s) * 0.45 * attack,
        r.pos.y + Math.sin(a.t * (2.1 + (i % 3) * 0.3) + s * 2) * 0.35,
        r.pos.z + Math.cos(a.t * (1.1 + (i % 4) * 0.25) + s) * 0.45 * attack,
      );
      d.rotation.y = a.t * 3 + s;
    }
  }

  private hover(a: AnimInput): void {
    const body = this.reset('body');
    if (body) {
      body.position.y += Math.sin(a.t * 1.2 + a.seed * 4) * (this.meta.bob ?? 0.3);
      body.rotation.z += Math.sin(a.t * 0.7) * 0.03 - this.move * 0.05;
    }
    for (let i = 0; i < 4; i++) {
      const ring = this.reset(`ring${i}`);
      if (ring) {
        ring.rotation.x += a.t * (0.6 + i * 0.35) * (i % 2 ? -1 : 1);
        ring.rotation.y += a.t * (0.4 + i * 0.2);
      }
      const shard = this.reset(`shard${i}`);
      if (shard) {
        const ang = a.t * 0.9 + (i * Math.PI) / 2;
        shard.position.x += Math.cos(ang) * 0.3;
        shard.position.z += Math.sin(ang) * 0.3;
        shard.position.y += Math.sin(a.t * 2 + i) * 0.2;
        shard.rotation.y = a.t * 2 + i;
      }
    }
    const eye = this.reset('eye');
    const w = Math.max(0.05, a.windup);
    if (eye) {
      const charge = a.attackT < w ? a.attackT / w : 0;
      eye.scale.setScalar(1 + charge * 0.35);
      eye.rotation.z += a.aim;
    }
    const clawN = this.reset('clawN');
    const clawF = this.reset('clawF');
    if (clawN) clawN.position.y += Math.sin(a.t * 1.5) * 0.25;
    if (clawF) clawF.position.y += Math.sin(a.t * 1.5 + 1.7) * 0.25;
  }

  // ─── Death ────────────────────────────────────────────────────────────────

  private death(a: AnimInput): void {
    const t = a.deadT;
    const kind = this.meta.kind;
    const fall = Math.min(1, t / 0.45);
    const eased = fall * fall * (3 - 2 * fall);
    if (kind === 'humanoid' || kind === 'crewed') {
      const body = this.j.get('body');
      if (body) {
        body.rotation.z = eased * 1.45;
        body.position.y += Math.sin(fall * Math.PI) * 0.25 - eased * 0.15;
        body.position.x -= eased * 0.35;
      }
    } else if (kind === 'rider' || kind === 'beast') {
      const mount = this.j.get('mount');
      if (mount) {
        mount.rotation.x = eased * 1.2;
        mount.position.y -= eased * 0.5;
      }
    } else if (kind === 'flyer' || kind === 'swarm') {
      const body = this.j.get('body');
      if (body) {
        body.position.y -= t * t * 9;
        body.rotation.z -= t * 1.6;
        body.rotation.x += t * 2;
      }
    } else if (kind === 'walker' || kind === 'hover') {
      const body = this.j.get('body');
      if (body) {
        body.rotation.z = eased * 0.5;
        body.position.y -= eased * 0.8;
      }
    }
  }
}

function attacking(at: number, w: number): boolean {
  return at < w + 0.5;
}
