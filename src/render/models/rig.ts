import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createModelMaterial, type ModelMaterial } from '../kit/materials';
import { ARM } from './humanoid';

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
  /** Seconds since the unit was last hit (drives a flinch). */
  hitT?: number;
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
  /**
   * Where the off hand holds a two-handed weapon, in the weapon's frame
   * (foregrip, pike shaft, bowstring…). The off arm reaches for it.
   */
  grip?: [number, number];
  /** What the off arm does when it isn't gripping: guard with a shield, or a fencer's raised hand. */
  off?: 'shield' | 'fencer';
  /** Tracked vehicles: the loop (clockwise from the near side) their tread joints run around. */
  tread?: [number, number][];
}

export interface ModelTemplate {
  object: THREE.Group;
  meta: ModelMeta;
}

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Blend two keyframes component-wise. */
function mixK(a: readonly number[], b: readonly number[], t: number): number[] {
  return a.map((v, i) => v + (b[i]! - v) * t);
}

/**
 * Two-bone reach in an arm's swing plane: the (upper, fore) angles that put
 * the hand at (x, y) from the shoulder. The arm hangs along −y at zero and
 * positive angles swing it forward; the elbow bends the natural way.
 */
function reach(x: number, y: number): [number, number] {
  const l1 = ARM.upper;
  const l2 = ARM.fore;
  const d = clamp(Math.hypot(x, y), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const base = Math.atan2(x, -y);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const b = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  return [base - a, Math.PI - b];
}

/** Where the hand ends up for arm angles (u, f), from a shoulder at (sx, sy). */
function handAt(sx: number, sy: number, u: number, f: number): [number, number] {
  return [sx + ARM.upper * Math.sin(u) + ARM.fore * Math.sin(u + f), sy - ARM.upper * Math.cos(u) - ARM.fore * Math.cos(u + f)];
}

export class ModelInstance {
  readonly root: THREE.Group;
  readonly material: ModelMaterial;
  readonly meta: ModelMeta;
  private readonly j: Map<string, THREE.Object3D> = new Map();
  /** Rest transforms of joints, captured at build time. */
  private readonly rest = new Map<THREE.Object3D, { rot: THREE.Euler; pos: THREE.Vector3; scale: THREE.Vector3 }>();
  private readonly skins: THREE.SkinnedMesh[] = [];
  /** Joints with a life of their own: capes, plumes, flags (see gear.ts sway()). */
  private readonly sways: { o: THREE.Object3D; kind: string; depth: number; off: number }[] = [];
  private move = 0;
  private attackBlend = 0;

  constructor(template: ModelTemplate) {
    this.meta = template.meta;
    this.root = cloneSkinned(template.object) as THREE.Group;
    this.material = createModelMaterial();
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = this.material;
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) this.skins.push(o as THREE.SkinnedMesh);
      } else if (o.name) {
        this.j.set(o.name, o);
        this.rest.set(o, { rot: o.rotation.clone(), pos: o.position.clone(), scale: o.scale.clone() });
        const sway = /\.sway([DUF])\d+$/.exec(o.name);
        if (sway) {
          let h = 0;
          for (let i = 0; i < o.name.length; i++) h = (h * 31 + o.name.charCodeAt(i)) % 997;
          this.sways.push({ o, kind: sway[1]!, depth: o.name.split('.sway').length - 1, off: h / 997 });
        }
      }
    });
  }

  /** Free the per-instance material and bone textures (geometry is shared with the template). */
  dispose(): void {
    this.material.dispose();
    for (const s of this.skins) s.skeleton.dispose();
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
    o.scale.copy(r.scale);
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

    this.swayAll(a);
    if (a.deadT >= 0) this.death(a);
    if (a.stunned) {
      const body = this.j.get('body');
      if (body) body.position.x += Math.sin(a.t * 60) * 0.03;
    }
  }

  // ─── Humanoids ────────────────────────────────────────────────────────────

  private humanoid(a: AnimInput, p: string, seated: boolean): void {
    const J = (name: string): THREE.Object3D | undefined => this.reset(`${p}${name}`);
    const body = J('body');
    const hips = J('hips');
    const torso = J('torso');
    const head = J('head');
    const armN = J('armN');
    const armF = J('armF');
    const foreN = J('foreN');
    const foreF = J('foreF');
    const legN = J('legN');
    const legF = J('legF');
    const shinN = J('shinN');
    const shinF = J('shinF');
    const weaponN = J('weaponN');
    const weaponF = J('weaponF');
    if (!torso || !armN || !armF || !foreN || !foreF) return;

    const phase = (a.stride / this.meta.strideLength) * Math.PI * 2;
    const m = seated ? 0 : this.move;
    const sw = Math.sin(phase);
    const cw = Math.cos(phase);
    const at = a.attackT;
    const w = Math.max(0.05, a.windup);
    const style = this.meta.style;

    // Legs: thighs swing, and each knee folds while its foot travels forward.
    // Standing still, the feet settle into a braced stance.
    if (!seated && legN && legF && shinN && shinF) {
      const brace = (1 - m) * (0.35 + 0.65 * this.attackBlend);
      legN.rotation.z += sw * 0.55 * m + 0.2 * brace;
      legF.rotation.z -= sw * 0.55 * m + 0.16 * brace;
      shinN.rotation.z -= (Math.max(0, cw) * 1.0 + 0.1) * m + 0.2 * brace;
      shinF.rotation.z -= (Math.max(0, -cw) * 1.0 + 0.1) * m + 0.08 * brace;
      if (body) body.position.y -= 0.025 * brace;
    }
    if (body && !seated) body.position.y += Math.abs(cw) * 0.055 * m - 0.02 * m;
    if (hips && !seated) hips.rotation.y += sw * 0.1 * m;
    torso.rotation.y -= sw * 0.12 * m;

    // Breathing, a forward lean on the march, and an idle glance about.
    const breathe = Math.sin(a.t * 2.2 + a.seed * 10) * 0.02;
    torso.rotation.z += breathe * 0.5 - 0.07 * m;
    if (head) {
      head.rotation.z += Math.sin(a.t * 0.9 + a.seed * 7) * 0.05 * (1 - m) + cw * 0.025 * m;
      head.rotation.y += Math.sin(a.t * 0.5 + a.seed * 13) * 0.3 * (1 - m) * (1 - this.attackBlend);
    }

    // Flinch when hit.
    const hitT = a.hitT ?? 99;
    if (hitT < 0.3) {
      const k = Math.sin((hitT / 0.3) * Math.PI);
      torso.rotation.z += 0.14 * k;
      if (head) head.rotation.z += 0.2 * k;
    }

    const near = this.meta.hand === 'near';
    const armW = near ? armN : armF;
    const armO = near ? armF : armN;
    const foreW = near ? foreN : foreF;
    const foreO = near ? foreF : foreN;
    const weapon = near ? weaponN : weaponF;
    const offWeapon = near ? weaponF : weaponN;

    // Arms swing opposite the legs, elbows bending on the forward swing.
    const swingN = -sw * 0.5 * m;
    const swingW = near ? swingN : -swingN;
    const swingO = -swingW;
    const freeFore = (swing: number): number => 0.25 + Math.max(0, swing) * 0.7;

    let uW = swingW;
    let fW = freeFore(swingW);
    let uO = swingO;
    let fO = freeFore(swingO);
    let lean = 0;
    let twist = 0;
    let push = 0;
    /** Weapon-frame angle to hold: set for levelled weapons, null to leave it on the hand. */
    let hold: number | null = null;
    let reachGrip = !!this.meta.grip;

    const guard = (): void => {
      if (this.meta.off === 'shield') {
        uO = 0.35 + swingO * 0.2;
        fO = 1.25;
      } else if (this.meta.off === 'fencer') {
        uO = -0.55;
        fO = 1.75;
      }
    };

    switch (style) {
      case 'swing': {
        // Guard with the weapon up; wind up over the shoulder; strike through.
        const G = [0.45 + swingW * 0.25, 1.05, 0, 0];
        const Wd = [2.75, 1.35, -0.12, -0.3];
        const S = [0.2, 0.12, 0.22, 0.25];
        let k = G;
        if (at < w) k = mixK(G, Wd, ease(at / w));
        else if (at < w + 0.13) k = mixK(Wd, S, ease((at - w) / 0.13));
        else if (at < w + 0.55) k = mixK(S, G, ease((at - w - 0.13) / 0.42));
        [uW, fW, lean, twist] = k as [number, number, number, number];
        guard();
        if (!this.meta.off) {
          const wind = at < w ? ease(at / w) : 0;
          uO = lerp(0.2 + swingO * 0.6, 1.1, wind);
          fO = lerp(0.6, 0.3, wind);
        }
        break;
      }
      case 'thrust': {
        // Levelled at the chest; draw back, then drive it home.
        const R = [0.5 + swingW * 0.15, 1.05, 0, 0, 0];
        const B = [0.3, 1.45, -0.08, -0.15, -0.1];
        const X = [1.25, 0.2, 0.2, 0.2, 0.18];
        let k = R;
        if (at < w) k = mixK(R, B, ease(at / w));
        else if (at < w + 0.12) k = mixK(B, X, ease((at - w) / 0.12));
        else if (at < w + 0.5) k = mixK(X, R, ease((at - w - 0.12) / 0.38));
        [uW, fW, lean, twist, push] = k as [number, number, number, number, number];
        hold = a.aim * 0.5;
        guard();
        break;
      }
      case 'throw': {
        const R = [0.3 + swingW, 0.45, 0, 0];
        const Wd = [2.9, 1.5, -0.12, -0.35];
        const X = [1.2, 0.15, 0.22, 0.25];
        let k = R;
        if (at < w) k = mixK(R, Wd, ease(at / w));
        else if (at < w + 0.12) k = mixK(Wd, X, ease((at - w) / 0.12));
        else if (at < w + 0.5) k = mixK(X, R, ease((at - w - 0.12) / 0.38));
        [uW, fW, lean, twist] = k as [number, number, number, number];
        const wind = at < w ? ease(at / w) : at < w + 0.3 ? 1 - ease((at - w) / 0.3) : 0;
        uO = lerp(uO, 1.3, wind);
        fO = lerp(fO, 0.2, wind);
        // The thrown item leaves the hand for a beat after release.
        if (weapon && at >= w && at < w + Math.min(0.9, a.interval * 0.6)) weapon.scale.setScalar(1e-4);
        break;
      }
      case 'bow': {
        // Bow arm out at the target; the string hand draws to the chin.
        const up = this.attackBlend;
        const draw = at < w ? ease(at / w) : at < w + 0.08 ? 1 - (at - w) / 0.08 : 0;
        uO = lerp(0.3 + swingO * 0.5, 1.5 + a.aim * 0.6, up);
        fO = lerp(0.35, 0.05, up);
        const bowAngle = lerp(0.5, a.aim * 0.6, up);
        if (offWeapon) offWeapon.rotation.z += -(uO + fO) + bowAngle;
        const [hx, hy] = handAt(armO.position.x, armO.position.y, uO, fO);
        const d = draw * 0.4 * up;
        const pull = 0.14 + d;
        const [ru, rf] = reach(hx - Math.cos(bowAngle) * pull - armW.position.x, hy - Math.sin(bowAngle) * pull - armW.position.y);
        uW = lerp(uW, ru, up);
        fW = lerp(fW, rf, up);
        twist = -0.12 * up;
        reachGrip = false;
        // The string bends back to the drawing hand; the arrow rides on it.
        const top = J('bowT');
        const bottom = J('bowB');
        const arrow = J('bowArrow');
        if (top && bottom) {
          const size = top.position.y;
          const len = Math.hypot(d, size) / size;
          top.rotation.z = Math.atan2(-d, size);
          bottom.rotation.z = Math.atan2(d, size);
          top.scale.y = bottom.scale.y = len;
        }
        if (arrow) {
          arrow.position.x -= d;
          const loosed = at >= w && at < w + Math.min(0.9, a.interval * 0.6);
          if (up < 0.5 || loosed) arrow.scale.setScalar(1e-4);
        }
        break;
      }
      case 'gun':
      case 'shoulder':
      case 'heavy': {
        // Hand targets (from the shoulder) and weapon angles for a relaxed
        // carry and for firing; the off hand reaches for the grip.
        const aimK = this.attackBlend;
        const fire = at >= w ? Math.max(0, 1 - (at - w) / 0.18) : 0;
        let carry: [number, number, number];
        let fireAt: [number, number, number];
        if (style === 'heavy') {
          carry = [0.06, -0.42, -0.1];
          fireAt = [0.08, -0.4, a.aim * 0.8];
        } else if (style === 'shoulder') {
          carry = [0.1, 0.02, 0.1];
          fireAt = [0.1, 0.02, a.aim];
        } else {
          // Port arms on the march; stock to the shoulder to fire.
          carry = [0.1, -0.4, 0.75];
          fireAt = [0.12, -0.1, a.aim];
        }
        const bob = cw * 0.02 * m;
        const tx = lerp(carry[0], fireAt[0], aimK) - fire * 0.07;
        const ty = lerp(carry[1], fireAt[1], aimK) + bob;
        [uW, fW] = reach(tx, ty);
        hold = lerp(carry[2], fireAt[2], aimK) + fire * (style === 'heavy' ? 0.04 : 0.12);
        lean = -fire * 0.06;
        break;
      }
      case 'cast': {
        const R = [0.35 + swingW * 0.3, 0.55];
        const U = [2.2, 0.4];
        const F = [1.35, 0.1];
        let k = R;
        if (at < w) k = mixK(R, U, ease(at / w));
        else if (at < w + 0.3) k = mixK(U, F, ease((at - w) / 0.3));
        else if (at < w + 0.6) k = mixK(F, R, ease((at - w - 0.3) / 0.3));
        [uW, fW] = k as [number, number];
        if (weapon) weapon.rotation.z += -(uW + fW) * 0.85;
        const cast = at < w + 0.3 ? ease(Math.min(1, at / w)) : 0;
        uO = lerp(uO, 1.3, cast);
        fO = lerp(fO, 0.4, cast);
        break;
      }
    }

    // Ammunition shown in the weapon (a bolt, a warhead) is gone for a beat after each shot.
    const ammo = J('ammo');
    if (ammo && at >= w && at < w + Math.min(0.9, a.interval * 0.6)) ammo.scale.setScalar(1e-4);

    armW.rotation.z += uW;
    foreW.rotation.z += fW;
    armW.position.x += push;
    torso.rotation.z -= lean;
    torso.rotation.y += twist * (near ? 1 : -1);
    if (weapon && hold !== null) weapon.rotation.z += -(uW + fW) + hold;

    if (reachGrip && weapon) {
      // Carry the grip point through the weapon arm, then reach the off hand to it.
      const g = this.meta.grip!;
      const [hx, hy] = handAt(armW.position.x, armW.position.y, uW, fW);
      const wa = uW + fW + weapon.rotation.z;
      const gx = hx + g[0] * Math.cos(wa) - g[1] * Math.sin(wa);
      const gy = hy + g[0] * Math.sin(wa) + g[1] * Math.cos(wa);
      // A grip just out of reach draws the shoulder forward.
      let dx = gx - armO.position.x;
      const dy = gy - armO.position.y;
      const over = Math.hypot(dx, dy) - (ARM.upper + ARM.fore - 0.02);
      if (over > 0) {
        const k = Math.min(0.14, over) / Math.hypot(dx, dy);
        armO.position.x += dx * k;
        armO.position.y += dy * k;
        dx -= dx * k;
        [uO, fO] = reach(dx, dy - dy * k);
      } else {
        [uO, fO] = reach(dx, dy);
      }
    }
    armO.rotation.z += uO;
    foreO.rotation.z += fO;
  }

  /** Capes billow and trail on the march, plumes nod, pennants flutter. */
  private swayAll(a: AnimInput): void {
    const m = this.move;
    const hitT = a.hitT ?? 99;
    const hit = hitT < 0.3 ? Math.sin((hitT / 0.3) * Math.PI) : 0;
    for (const s of this.sways) {
      const o = s.o;
      const r = this.rest.get(o)!;
      o.rotation.copy(r.rot);
      const t = a.t * (0.9 + s.off * 0.3) + s.off * 20 + a.seed * 7;
      const deep = s.depth > 1 ? 0.75 : 1;
      if (s.kind === 'D') {
        o.rotation.z -= ((0.3 * m + 0.04) + Math.sin(t * 3) * (0.035 + 0.09 * m) + hit * 0.25) * deep;
        o.rotation.x += Math.sin(t * 2.1) * 0.05 * (0.4 + m);
      } else if (s.kind === 'U') {
        o.rotation.z += 0.3 * m + Math.sin(t * 3.4) * (0.05 + 0.08 * m) + hit * 0.2;
      } else {
        o.rotation.y += Math.sin(t * 5 + s.depth * 1.3) * (0.3 + 0.25 * m) * deep;
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
    for (let i = 0; i < 12; i++) {
      const wheel = this.reset(`wheel${i}`);
      if (!wheel) break;
      wheel.rotation.z = -a.stride * 2.2;
    }
    if (this.meta.tread) this.treads(this.meta.tread, a.stride);
    const w = Math.max(0.05, a.windup);
    const recoil = a.attackT >= w ? Math.max(0, 1 - (a.attackT - w) / (this.meta.recoil ?? 0.35)) : 0;
    if (turret) turret.rotation.z += a.aim * 0.5;
    if (barrel) {
      barrel.position.x -= recoil * 0.35;
      if (!turret) barrel.rotation.z += a.aim * 0.6;
    }
    if (hull) hull.rotation.z += recoil * 0.03;
  }

  /** Run the track plates around their loop: the bottom run stays put on the ground as the hull rolls over it. */
  private treads(loop: [number, number][], stride: number): void {
    let total = 0;
    const lens: number[] = [];
    for (let i = 0; i < loop.length; i++) {
      const [x0, y0] = loop[i]!;
      const [x1, y1] = loop[(i + 1) % loop.length]!;
      const l = Math.hypot(x1 - x0, y1 - y0);
      lens.push(l);
      total += l;
    }
    let count = 0;
    while (this.j.has(`tread${count}`)) count++;
    for (let k = 0; k < count; k++) {
      const o = this.j.get(`tread${k}`)!;
      let s = ((k / count) * total + stride) % total;
      if (s < 0) s += total;
      let i = 0;
      while (s > lens[i]! && i < lens.length - 1) s -= lens[i++]!;
      const [x0, y0] = loop[i]!;
      const [x1, y1] = loop[(i + 1) % loop.length]!;
      const f = s / lens[i]!;
      o.position.set(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0);
      o.rotation.set(0, 0, Math.atan2(y1 - y0, x1 - x0));
    }
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
    const chin = this.reset('chin');
    if (chin) chin.rotation.z = clamp(a.aim, -0.9, 0.3);
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
      // Most are knocked back; some pitch forward. Knees buckle and the arms fly up.
      // (A gun crew's joints carry the rider prefix.)
      const p = kind === 'crewed' ? 'r' : '';
      const dir = a.seed < 0.7 ? 1 : -1;
      const body = this.j.get(`${p}body`);
      if (body) {
        body.rotation.z = eased * 1.45 * dir;
        body.position.y += Math.sin(fall * Math.PI) * 0.25 - eased * 0.15;
        body.position.x -= eased * 0.35 * dir;
      }
      const buckle = Math.sin(fall * Math.PI) * 0.9 + eased * 0.25;
      for (const n of ['shinN', 'shinF']) {
        const shin = this.j.get(`${p}${n}`);
        if (shin) shin.rotation.z -= buckle;
      }
      for (const [n, k] of [['legN', 0.5], ['legF', 0.3]] as const) {
        const leg = this.j.get(`${p}${n}`);
        if (leg) leg.rotation.z += buckle * k;
      }
      for (const [n, k] of [['armN', 1.3], ['armF', 0.9]] as const) {
        const arm = this.j.get(`${p}${n}`);
        if (arm) arm.rotation.z += eased * k;
      }
      const head = this.j.get(`${p}head`);
      if (head) head.rotation.z += eased * 0.35 * dir;
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

