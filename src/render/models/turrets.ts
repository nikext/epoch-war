import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Part, RigBuilder, shade, type ColorLike } from '../kit/builder';
import { staticMaterial } from '../kit/materials';
import { C } from './gear';
import * as G from './gear';
import { TEAMS, type Team } from './team';

/**
 * Turret models. Joints: pivot (pitches toward the target), barrel (recoils),
 * muzzle (flash point), plus arm / spin / orb for the machines that throw,
 * rotate or pulse instead of simply recoiling. Any turret may also carry
 * joints the instance animates by name:
 *
 * - `cog…`    turns as the gun elevates and kicks when it fires
 * - `crank…`  winds while a thrower reloads
 * - `radar…`  sweeps round and round
 * - `ammo…`   is loaded, and gone for a moment after each shot
 * - `flame…`  flickers
 * - `limbN` / `limbF` flex back while loaded and snap forward on release
 * - `coil…`   pulse front to back after a shot
 * - `wing…`   flap (the hen)
 * - `tip`     tips forward to pour (the cauldron)
 * - `….swayF…` flutter (every turret flies a pennant in its team colour)
 */

const HALF_PI = Math.PI / 2;
const METAL = { m: 0.8, r: 0.35 } as const;

export type TurretAnim = 'aim' | 'catapult' | 'spin' | 'pulse' | 'hen';

export interface TurretTemplate {
  object: THREE.Group;
  anim: TurretAnim;
  /** How far the barrel kicks back when firing. */
  kick: number;
  /** The model's rearmost x at rest, for seating it against the wall. */
  back: number;
  /** How far the pivot may pitch (radians about z) and stay inside TURRET_BAND. */
  pitch: [number, number];
  /** How far a thrower's arm may swing forward (radians) and stay inside TURRET_BAND. */
  swing: number;
}

/**
 * The room each turret has, relative to its ledge. Ledges stack 1.8 m apart
 * and alternate front and back (SLOT_POS), so a turret must stay between its
 * own ledge and the next one up — including every pose it animates through —
 * or it crowds the turrets above and below. Above `high` it must also keep to
 * the middle of its ledge (|z| ≤ `highZ`), clear of the next ledge's edge.
 * Checked for every turret, pose and wall by tools/turret-fit.ts (npm test).
 */
export const TURRET_BAND = { top: 1.6, bottom: -0.2, high: 1.35, highZ: 0.38 } as const;

const _v = new THREE.Vector3();

/**
 * Whether every vertex of a (posed) template sits inside TURRET_BAND, less a
 * margin for the flourishes played on top of the aim (flexing limbs, flags).
 */
function inBand(object: THREE.Object3D, margin = 0.06): boolean {
  object.updateMatrixWorld(true);
  let ok = true;
  object.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!ok || !m.isSkinnedMesh) return;
    m.skeleton.update();
    const n = m.geometry.attributes.position!.count;
    for (let i = 0; i < n && ok; i++) {
      m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
      if (_v.y > TURRET_BAND.top - margin || _v.y < TURRET_BAND.bottom + margin) ok = false;
      else if (_v.y > TURRET_BAND.high - margin && Math.abs(_v.z) > TURRET_BAND.highZ - margin * 0.5) ok = false;
    }
  });
  return ok;
}

/** How far a joint may turn from its rest angle about z (within ±span) before the model leaves the band. */
function turnLimit(object: THREE.Object3D, joint: THREE.Object3D, span: number, dir: 1 | -1, also?: () => void, undo?: () => void): number {
  const rest = joint.rotation.z;
  let ok = 0;
  for (let a = 0.05; a <= span + 1e-6; a += 0.05) {
    joint.rotation.z = rest + dir * a;
    let fits = inBand(object);
    if (fits && also) {
      also();
      fits = inBand(object);
      undo?.();
    }
    if (!fits) break;
    ok = a;
  }
  joint.rotation.z = rest;
  return ok;
}

function T(build: (r: RigBuilder, t: Team) => void, anim: TurretAnim = 'aim', kick = 0.25): (t: Team) => TurretTemplate {
  return (t) => {
    const r = new RigBuilder('turret');
    build(r, t);
    if (!r.has('muzzle')) r.joint('muzzle', r.has('barrel') ? 'barrel' : null, 1, 0.8, 0);
    const object = r.build(staticMaterial, true, { occlude: 0.14 });

    // Fit the aim and the throw to the band, so no pose crowds the neighbours.
    const pivot = object.getObjectByName('pivot');
    const barrel = object.getObjectByName('barrel');
    const arm = object.getObjectByName('arm');
    const rest = pivot?.rotation.z ?? 0;
    let pitch: [number, number] = [rest, rest];
    if (pivot && anim !== 'catapult' && anim !== 'pulse') {
      const span = anim === 'aim' && rest !== 0 ? 0.36 : 1.2;
      const x0 = barrel?.position.x ?? 0;
      const kickBack = barrel ? (): void => void (barrel.position.x = x0 - kick) : undefined;
      const kickUndo = barrel ? (): void => void (barrel.position.x = x0) : undefined;
      pitch = [rest - turnLimit(object, pivot, span, -1, kickBack, kickUndo), rest + turnLimit(object, pivot, span, 1, kickBack, kickUndo)];
    }
    const swing = arm ? turnLimit(object, arm, 1.8, -1) : 0;
    object.updateMatrixWorld(true);
    return { object, anim, kick, back: new THREE.Box3().setFromObject(object).min.x, pitch, swing };
  };
}

/**
 * A pole at the back of the turret flying a two-piece pennant. The pole keeps
 * to the middle of the ledge and never tops TURRET_BAND.high, so a pennant
 * can't crowd the ledge above.
 */
function flag(r: RigBuilder, t: Team, x: number, y: number, z: number, height = 0.9, parent = 'base'): void {
  const pole = `${parent}Pole`;
  const h = Math.max(0.35, Math.min(height, TURRET_BAND.high - 0.05 - y));
  const zz = Math.max(-0.3, Math.min(0.3, z));
  const p = r.joint(pole, parent, x, y, zz);
  p.cyl(0.02, 0.025, h, C.woodDark, { y: h / 2, seg: 5 });
  p.sphere(0.035, C.gold, { y: h + 0.02, ...METAL });
  G.pennant(r, pole, t.main, -0.02, h, 0.45, 0.2);
}

function sandbags(p: Part, cx: number, cy: number, r: number, from: number, to: number, n: number, color = '#a39570'): void {
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * (i + (row ? 0.5 : 0))) / n;
      p.block(0.36, 0.17, 0.2, shade(color, ((i + row) % 3) * 0.04 - 0.04), {
        x: cx + Math.cos(a) * r,
        y: cy + 0.085 + row * 0.16,
        z: Math.sin(a) * r,
        ry: -a + HALF_PI,
        bevel: 0.06,
      });
    }
  }
}

function cog(r: RigBuilder, name: string, parent: string, x: number, y: number, z: number, radius: number, color: ColorLike = C.iron): void {
  const c = r.joint(name, parent, x, y, z);
  c.cyl(radius, radius, 0.05, color, { rx: HALF_PI, seg: 10, ...METAL });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.block(0.05, 0.05, 0.05, color, { x: Math.cos(a) * radius, y: Math.sin(a) * radius, rz: a, ...METAL });
  }
  c.cyl(radius * 0.3, radius * 0.3, 0.07, shade(color, -0.3), { rx: HALF_PI, seg: 6, ...METAL });
}

// ─── Stone ──────────────────────────────────────────────────────────────────

const rockSling = T((r, t) => {
  // A forked tree lashed to a stump, with a hide band.
  const b = r.joint('base', null);
  b.cyl(0.42, 0.5, 0.3, C.woodDark, { y: 0.15, seg: 9 });
  b.cyl(0.4, 0.4, 0.02, C.woodLight, { y: 0.31, seg: 9 });
  for (let i = 0; i < 4; i++) b.cyl(0.05, 0.03, 0.35, C.wood, { x: Math.cos(i * 1.7) * 0.45, y: 0.08, z: Math.sin(i * 1.7) * 0.45, rz: Math.cos(i * 1.7) * 1.2, rx: -Math.sin(i * 1.7) * 1.2, seg: 5 });
  for (let i = 0; i < 4; i++) b.ico(0.1 + (i % 2) * 0.03, C.stone, { x: -0.2 + i * 0.12, y: 0.4, z: -0.3 + (i % 2) * 0.1 });
  const pv = r.joint('pivot', 'base', 0, 0.3, 0);
  pv.cyl(0.08, 0.11, 0.85, C.wood, { y: 0.42, rz: -0.2, seg: 7 });
  pv.cyl(0.05, 0.07, 0.45, C.wood, { x: 0.18, y: 0.95, z: 0.13, rx: -0.45, seg: 6 });
  pv.cyl(0.05, 0.07, 0.45, C.wood, { x: 0.18, y: 0.95, z: -0.13, rx: 0.45, seg: 6 });
  for (let i = 0; i < 3; i++) pv.cyl(0.1, 0.1, 0.035, C.rope, { x: 0.1, y: 0.62 + i * 0.05, rz: -0.2, seg: 7 });
  pv.block(0.12, 0.12, 0.14, t.main, { x: 0.06, y: 0.5, bevel: 0.03 });
  const bar = r.joint('barrel', 'pivot', 0.22, 1.12, 0);
  bar.tube([[0, 0, 0.23], [-0.3, -0.08, 0.07], [-0.33, -0.08, 0], [-0.3, -0.08, -0.07], [0, 0, -0.23]], 0.02, C.leather, { seg: 10 });
  bar.block(0.12, 0.09, 0.16, C.leather, { x: -0.31, y: -0.08, bevel: 0.03 });
  const ammo = r.joint('ammo', 'barrel', -0.31, -0.01, 0);
  ammo.ico(0.1, C.stone);
  r.joint('muzzle', 'barrel', 0.1, 0, 0);
  flag(r, t, -0.35, 0.3, -0.25, 0.8);
}, 'aim', 0.25);

const eggLauncher = T((r, t) => {
  // An enraged hen on a nest of sticks.
  const b = r.joint('base', null);
  b.cyl(0.65, 0.55, 0.35, C.woodLight, { y: 0.18, seg: 12 });
  b.torus(0.6, 0.08, '#c7a574', { y: 0.36, rx: HALF_PI, ts: 16 });
  for (let i = 0; i < 14; i++) b.cyl(0.025, 0.025, 0.55, i % 2 ? C.wood : C.woodLight, { x: Math.cos(i) * 0.6, y: 0.32, z: Math.sin(i) * 0.6, rz: Math.cos(i * 1.3) * 0.9, rx: Math.sin(i * 1.3) * 0.9, seg: 4 });
  for (let i = 0; i < 3; i++) b.sphere(0.1, '#f4efe6', { x: -0.25 + i * 0.2, y: 0.42, z: 0.3 - i * 0.05, s: [1, 1.25, 1] });
  const pv = r.joint('pivot', 'base', 0, 0.36, 0);
  pv.sphere(0.45, '#f4efe6', { y: 0.35, s: [1.2, 1, 0.95], ws: 12, hs: 8 });
  pv.cone(0.25, 0.5, '#f4efe6', { x: -0.55, y: 0.55, rz: 0.9, seg: 7 });
  for (let i = 0; i < 3; i++) pv.cone(0.08, 0.3, i === 1 ? t.main : '#ece4d4', { x: -0.62, y: 0.7 + i * 0.04, z: -0.08 + i * 0.08, rz: 0.6 + i * 0.1, seg: 5 });
  pv.block(0.3, 0.1, 0.1, t.main, { y: 0.1, x: -0.1, s: [1, 1, 8] });
  for (const z of [0.12, -0.12]) pv.cyl(0.02, 0.02, 0.3, '#f0b429', { x: 0.05, y: -0.08, z, seg: 4 });
  for (const [name, z] of [['wingN', 0.42], ['wingF', -0.42]] as const) {
    const w = r.joint(name, 'pivot', 0.05, 0.45, z);
    w.sphere(0.32, '#ece4d4', { x: -0.15, y: -0.05, s: [1.1, 0.7, 0.25], ws: 8, hs: 6 });
    w.block(0.3, 0.05, 0.05, shade('#ece4d4', -0.12), { x: -0.25, y: -0.18, z: z > 0 ? 0.06 : -0.06 });
  }
  const bar = r.joint('barrel', 'pivot', 0.4, 0.75, 0);
  bar.sphere(0.25, '#f4efe6', { ws: 10, hs: 8 });
  bar.cone(0.1, 0.25, '#f0b429', { x: 0.28, rz: -HALF_PI, seg: 6 });
  bar.block(0.16, 0.2, 0.05, '#d23b2b', { y: 0.25, bevel: 0.015 });
  bar.block(0.08, 0.14, 0.04, '#d23b2b', { x: 0.2, y: -0.14 });
  for (const z of [0.17, -0.17]) {
    bar.block(0.06, 0.06, 0.05, '#111', { x: 0.14, y: 0.08, z });
    bar.block(0.12, 0.03, 0.05, '#111', { x: 0.14, y: 0.14, z, rz: -0.45 });
  }
  r.joint('muzzle', 'barrel', 0.4, 0, 0);
  flag(r, t, -0.5, 0.35, 0.3, 0.7);
}, 'hen', 0.12);

const boulderCatapult = T((r, t) => {
  // A torsion catapult: a rope-sprung arm that slams into a padded crossbar.
  const b = r.joint('base', null);
  b.block(1.8, 0.22, 0.84, C.wood, { y: 0.38, bevel: 0.05 });
  for (const z of [0.36, -0.36]) {
    b.block(0.18, 0.78, 0.13, C.woodDark, { x: 0.25, y: 0.82, z, rz: 0.2, bevel: 0.03 });
    b.block(0.13, 0.62, 0.11, C.woodDark, { x: -0.12, y: 0.7, z, rz: -0.55, bevel: 0.03 });
    for (const x of [-0.6, 0.6]) {
      b.cyl(0.27, 0.27, 0.12, C.woodDark, { x, y: 0.27, z: z * 1.25, rx: HALF_PI, seg: 10 });
      b.cyl(0.07, 0.07, 0.14, C.wood, { x, y: 0.27, z: z * 1.25, rx: HALF_PI, seg: 6 });
    }
  }
  b.block(0.2, 0.18, 0.84, t.main, { x: 0.33, y: 1.15, bevel: 0.04 });
  b.block(0.1, 0.16, 0.6, C.leather, { x: 0.22, y: 1.15, bevel: 0.04 });
  b.cyl(0.13, 0.13, 0.68, C.rope, { x: 0.25, y: 0.58, rx: HALF_PI, seg: 8 });
  for (let i = 0; i < 3; i++) b.ico(0.14, C.stone, { x: -0.55 + i * 0.2, y: 0.6, z: 0.2 - (i % 2) * 0.12 });
  r.joint('pivot', 'base', 0, 0, 0);
  const crank = r.joint('crank', 'base', -0.72, 0.62, 0);
  crank.cyl(0.07, 0.07, 0.92, C.woodLight, { rx: HALF_PI, seg: 6 });
  for (const z of [0.43, -0.43]) for (let i = 0; i < 4; i++) crank.block(0.3, 0.04, 0.04, C.wood, { z, rz: (i / 4) * Math.PI });
  const arm = r.joint('arm', 'pivot', 0.25, 0.58, 0);
  arm.block(1.0, 0.12, 0.12, C.wood, { x: -0.45, taper: [1, 0.8], bevel: 0.03 });
  for (let i = 0; i < 2; i++) arm.cyl(0.085, 0.085, 0.04, C.rope, { x: -0.2 - i * 0.35, rz: HALF_PI, seg: 6 });
  arm.cyl(0.2, 0.16, 0.16, C.woodDark, { x: -0.88, y: 0.08, seg: 9 });
  const ammo = r.joint('ammo', 'arm', -0.88, 0.2, 0);
  ammo.ico(0.16, C.stone);
  r.joint('muzzle', 'arm', -0.88, 0.24, 0);
  r.group('arm').rotation.z = 0.2;
  flag(r, t, -0.8, 0.49, -0.3, 0.8);
}, 'catapult');

// ─── Ancient ────────────────────────────────────────────────────────────────

const bowNest = T((r, t) => {
  // A sandstone parapet, and a bow on a swivel.
  const b = r.joint('base', null);
  b.block(1.3, 0.7, 1.3, '#d9c28e', { y: 0.35, bevel: 0.05 });
  for (let i = 0; i < 3; i++) b.box(1.32, 0.02, 1.32, shade('#d9c28e', -0.15), { y: 0.13 + i * 0.19 });
  b.block(1.4, 0.15, 1.4, C.bronze, { y: 0.75, bevel: 0.03, ...METAL });
  for (const z of [0.55, -0.55]) b.block(0.25, 0.28, 0.25, '#d9c28e', { x: 0.55, y: 0.94, z, bevel: 0.04 });
  b.block(0.1, 0.45, 1.2, t.main, { x: 0.66, y: 0.36, bevel: 0.02 });
  b.cyl(0.07, 0.06, 0.45, C.leather, { x: -0.42, y: 1.02, z: 0.28, rz: 0.2, seg: 7 });
  for (let i = 0; i < 4; i++) b.cyl(0.008, 0.008, 0.18, C.linen, { x: -0.46 + i * 0.02, y: 1.28, z: 0.28, rz: 0.2, seg: 4 });
  const pv = r.joint('pivot', 'base', 0.1, 1.05, 0);
  pv.block(0.22, 0.22, 0.22, C.woodDark, { bevel: 0.04 });
  pv.cyl(0.05, 0.05, 0.3, C.bronze, { y: -0.2, seg: 6, ...METAL });
  const bar = r.joint('barrel', 'pivot', 0.2, 0, 0);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const s = -1 + (i / 10) * 2;
    pts.push([0.2 * (1 - s * s), 0, s * 0.62]);
  }
  bar.tube(pts, 0.035, '#3d2a1a', { seg: 14 });
  bar.tube([[0, 0, 0.61], [-0.05, 0, 0], [0, 0, -0.61]], 0.007, C.linen, { seg: 2 });
  const ammo = r.joint('ammo', 'barrel', 0, 0, 0);
  ammo.block(0.9, 0.04, 0.04, C.woodLight, { x: 0.1 });
  ammo.cone(0.05, 0.12, C.bronze, { x: 0.6, rz: -HALF_PI, ...METAL });
  ammo.extrude([[0, 0], [0.12, 0.05], [0.14, 0]], 0.01, t.light, { x: -0.35 });
  flag(r, t, -0.5, 0.92, -0.5, 0.9);
}, 'aim', 0.1);

const scorpion = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.08, 0.12, 1.0, C.wood, { y: 0.5, seg: 7 });
  for (let i = 0; i < 3; i++) b.block(0.08, 0.8, 0.08, C.wood, { x: Math.cos(i * 2.1) * 0.35, y: 0.3, z: Math.sin(i * 2.1) * 0.35, rz: Math.cos(i * 2.1) * 0.5, rx: -Math.sin(i * 2.1) * 0.5, bevel: 0.02 });
  b.cyl(0.14, 0.14, 0.06, C.bronze, { y: 1.0, seg: 8, ...METAL });
  for (let i = 0; i < 3; i++) b.block(0.9, 0.05, 0.05, C.woodLight, { x: -0.1, y: 0.25, z: -0.25 + i * 0.25, rz: 0.05 });
  const pv = r.joint('pivot', 'base', 0, 1.05, 0);
  pv.block(1.4, 0.14, 0.2, C.wood, { x: 0.1, bevel: 0.03 });
  pv.block(0.3, 0.38, 0.52, C.woodDark, { x: 0.45, bevel: 0.04 });
  for (const z of [0.18, -0.18]) pv.cyl(0.08, 0.08, 0.36, C.rope, { x: 0.45, z, seg: 8 });
  pv.block(0.34, 0.08, 0.56, C.bronze, { x: 0.45, y: 0.2, bevel: 0.02, ...METAL });
  pv.block(0.06, 0.2, 0.06, t.main, { x: -0.4, y: 0.15 });
  cog(r, 'cogWinch', 'pivot', -0.45, -0.02, 0.14, 0.12, C.woodLight);
  for (const [name, z] of [['limbN', 0.26], ['limbF', -0.26]] as const) {
    const l = r.joint(name, 'pivot', 0.45, 0, z);
    l.block(0.1, 0.07, 0.62, C.woodDark, { x: -0.06, z: Math.sign(z) * 0.3, ry: -Math.sign(z) * 0.3, bevel: 0.02 });
    l.block(0.06, 0.06, 0.08, C.bronze, { x: -0.18, z: Math.sign(z) * 0.58, ...METAL });
  }
  pv.tube([[0.27, 0, 0.84], [-0.2, 0.02, 0], [0.27, 0, -0.84]], 0.008, C.linen, { seg: 2 });
  const bar = r.joint('barrel', 'pivot', 0, 0.1, 0);
  bar.cyl(0.028, 0.028, 1.4, C.woodLight, { x: 0.3, rz: HALF_PI, seg: 6 });
  bar.cone(0.06, 0.22, C.bronze, { x: 1.06, rz: -HALF_PI, seg: 6, ...METAL });
  bar.extrude([[0, 0], [0.16, 0.06], [0.18, 0]], 0.01, t.light, { x: -0.38 });
  r.joint('muzzle', 'barrel', 1.1, 0, 0);
  flag(r, t, -0.3, 0.1, -0.4, 1.3);
}, 'aim', 0.4);

const greekFire = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.0, 0.5, 1.0, '#cdb68a', { y: 0.25, bevel: 0.04 });
  b.lathe([[0.01, 0], [0.4, 0.1], [0.5, 0.45], [0.3, 0.8], [0.15, 0.9]], C.bronze, { y: 0.5, seg: 12, ...METAL });
  for (let i = 0; i < 3; i++) b.torus(0.47 - i * 0.07, 0.02, C.gold, { y: 0.8 + i * 0.18, rx: HALF_PI, ts: 16, ...METAL });
  b.cyl(0.52, 0.52, 0.12, t.main, { y: 0.9, seg: 12 });
  // A bellows that pumps the fire forward.
  const bel = r.joint('crankBellows', 'base', -0.52, 0.72, 0);
  bel.extrude([[0, 0], [-0.45, 0.14], [-0.45, -0.14]], 0.3, C.leather, { bevel: 0.02 });
  bel.block(0.5, 0.04, 0.32, C.woodDark, { x: -0.25, y: 0.12, rz: -0.25 });
  const flame = r.joint('flameStove', 'base', 0, 0.55, 0.55);
  flame.cone(0.14, 0.3, '#ff8a2a', { y: 0.12, e: 2.5, seg: 6 });
  flame.cone(0.08, 0.2, '#ffe08a', { y: 0.1, e: 3, seg: 5 });
  const pv = r.joint('pivot', 'base', 0.1, 1.2, 0);
  pv.sphere(0.18, C.bronze, METAL);
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.cyl(0.08, 0.12, 1.1, C.bronze, { x: 0.55, rz: -HALF_PI, seg: 10, ...METAL });
  bar.hull([[1.0, 0.1, 0.1], [1.0, 0.1, -0.1], [1.0, -0.1, 0.1], [1.0, -0.1, -0.1], [1.2, 0.16, 0.14], [1.2, 0.16, -0.14], [1.2, -0.06, 0.14], [1.2, -0.06, -0.14]], C.gold, METAL);
  bar.torus(0.12, 0.03, C.gold, { x: 0.6, ry: HALF_PI, ...METAL });
  bar.sphere(0.07, '#ff7a2a', { x: 1.18, e: 3 });
  r.joint('muzzle', 'barrel', 1.2, 0, 0);
  flag(r, t, -0.4, 0.5, -0.4, 1.0);
}, 'aim', 0.2);

// ─── Medieval ───────────────────────────────────────────────────────────────

const arbalest = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.1, 0.15, 0.9, C.woodDark, { y: 0.45, seg: 7 });
  b.block(0.8, 0.12, 0.8, C.wood, { y: 0.06, bevel: 0.03 });
  for (let i = 0; i < 4; i++) b.block(0.08, 0.3, 0.08, C.woodDark, { x: Math.cos(i * HALF_PI) * 0.25, y: 0.2, z: Math.sin(i * HALF_PI) * 0.25, rz: Math.cos(i * HALF_PI) * 0.6, rx: -Math.sin(i * HALF_PI) * 0.6 });
  // A pavise shield stands beside it.
  b.block(0.08, 1.0, 0.7, t.main, { x: 0.5, y: 0.5, z: 0.1, rz: -0.15, bevel: 0.03 });
  b.block(0.09, 0.14, 0.72, t.light, { x: 0.52, y: 0.55, z: 0.1, rz: -0.15 });
  const pv = r.joint('pivot', 'base', 0, 0.95, 0);
  pv.block(1.5, 0.16, 0.22, C.wood, { x: 0.15, bevel: 0.03 });
  pv.block(0.3, 0.3, 0.02, t.main, { x: -0.4, y: 0.15, z: 0.12 });
  cog(r, 'cogWindlass', 'pivot', -0.5, 0, 0.14, 0.1);
  for (const [name, z] of [['limbN', 0.06], ['limbF', -0.06]] as const) {
    const l = r.joint(name, 'pivot', 0.75, 0, z);
    l.block(0.12, 0.12, 0.56, C.iron, { z: Math.sign(z) * 0.28, taper: [1, 0.8], bevel: 0.02, ...METAL });
  }
  pv.tube([[0.72, 0, 0.58], [0.1, 0.05, 0], [0.72, 0, -0.58]], 0.012, C.linen, { seg: 2 });
  const bar = r.joint('barrel', 'pivot', 0, 0.12, 0);
  bar.block(0.9, 0.04, 0.04, C.woodLight, { x: 0.4 });
  bar.cone(0.05, 0.14, C.steel, { x: 0.9, rz: -HALF_PI, ...METAL });
  r.joint('muzzle', 'barrel', 0.95, 0, 0);
  flag(r, t, -0.35, 0.12, -0.35, 1.1);
}, 'aim', 0.3);

const boilingOil = T((r, t) => {
  // A cauldron slung over a fire from a gallows frame, tipped to pour.
  const b = r.joint('base', null);
  for (const z of [0.36, -0.36]) b.block(0.14, 1.26, 0.14, C.woodDark, { y: 0.63, z, bevel: 0.03 });
  b.block(0.12, 0.12, 0.84, C.woodDark, { y: 1.28, bevel: 0.03 });
  for (const z of [0.36, -0.36]) b.block(0.5, 0.1, 0.1, C.woodDark, { x: -0.15, y: 0.9, z, rz: 0.9 });
  b.cyl(0.25, 0.3, 0.2, '#3a2a20', { y: 0.1, seg: 8 });
  for (let i = 0; i < 5; i++) b.cyl(0.04, 0.04, 0.4, C.wood, { x: Math.cos(i * 1.3) * 0.15, y: 0.25, z: Math.sin(i * 1.3) * 0.15, rz: Math.cos(i * 1.3) * 0.8, rx: Math.sin(i * 1.3) * 0.8, seg: 4 });
  const flame = r.joint('flameFire', 'base', 0, 0.3, 0);
  flame.cone(0.22, 0.4, '#ff8a2a', { y: 0.05, e: 2.5, seg: 6 });
  flame.cone(0.12, 0.28, '#ffe08a', { y: 0.0, e: 3, seg: 5 });
  b.block(0.08, 0.28, 0.26, t.main, { x: -0.2, y: 1.05, z: 0.36, bevel: 0.02 });
  b.tube([[0, 1.28, 0.2], [0, 1.18, 0.2], [0, 1.08, 0.24]], 0.015, C.iron, { seg: 3 });
  r.joint('pivot', 'base', 0, 1.12, 0);
  const tip = r.joint('tip', 'pivot', 0, 0, 0);
  tip.lathe([[0.01, -0.46], [0.36, -0.42], [0.43, -0.1], [0.44, 0.08]], C.iron, { seg: 12, ...METAL });
  tip.torus(0.44, 0.03, shade(C.iron, -0.2), { y: 0.08, rx: HALF_PI, ts: 18, ...METAL });
  tip.cyl(0.41, 0.41, 0.04, '#2a1a0a', { y: 0.04, seg: 12, e: 0.2 });
  tip.block(0.22, 0.07, 0.18, C.iron, { x: 0.5, y: 0.06, bevel: 0.02, ...METAL });
  r.joint('barrel', 'tip', 0, 0, 0);
  r.joint('muzzle', 'tip', 0.55, 0, 0);
  flag(r, t, -0.35, 0.2, 0.2, 1.0);
}, 'aim', 0);

const trebuchet = T((r, t) => {
  // A counterweight engine, squat enough for its ledge: A-frames, a winch,
  // a throwing arm with a boxed counterweight, and a sling for the stone.
  const b = r.joint('base', null);
  b.block(1.9, 0.18, 0.84, C.wood, { y: 0.09, bevel: 0.04 });
  for (const z of [0.34, -0.34]) {
    b.block(0.14, 0.86, 0.14, C.woodDark, { x: 0.24, y: 0.45, z, rz: 0.32, bevel: 0.03 });
    b.block(0.14, 0.86, 0.14, C.woodDark, { x: -0.24, y: 0.45, z, rz: -0.32, bevel: 0.03 });
    b.block(0.7, 0.08, 0.08, C.wood, { y: 0.4, z, bevel: 0.02 });
    b.block(0.12, 0.62, 0.1, C.woodDark, { x: 0.62, y: 0.35, z, rz: -0.7, bevel: 0.02 });
  }
  b.cyl(0.06, 0.06, 0.84, C.iron, { y: 0.82, rx: HALF_PI, seg: 8, ...METAL });
  b.block(0.1, 0.4, 0.6, t.main, { x: 0.85, y: 0.34, bevel: 0.02 });
  const crank = r.joint('crank', 'base', -0.72, 0.36, 0);
  crank.cyl(0.1, 0.1, 0.84, C.woodLight, { rx: HALF_PI, seg: 8 });
  for (const z of [0.4, -0.4]) for (let i = 0; i < 4; i++) crank.block(0.38, 0.045, 0.045, C.wood, { z, rz: (i / 4) * Math.PI });
  r.joint('pivot', 'base', 0, 0, 0);
  const arm = r.joint('arm', 'pivot', 0, 0.82, 0);
  arm.block(1.12, 0.11, 0.11, C.wood, { x: -0.26, taper: [1, 0.8], bevel: 0.03 });
  arm.block(0.09, 0.26, 0.09, C.iron, { x: 0.24, y: -0.1, ...METAL });
  arm.block(0.34, 0.3, 0.34, '#6a6258', { x: 0.24, y: -0.3, bevel: 0.05 });
  for (let i = 0; i < 2; i++) arm.box(0.36, 0.03, 0.36, C.iron, { x: 0.24, y: -0.38 + i * 0.17 });
  arm.tube([[-0.8, 0, 0], [-0.85, -0.14, 0], [-0.78, -0.27, 0]], 0.012, C.rope, { seg: 3 });
  arm.block(0.14, 0.07, 0.14, C.leather, { x: -0.78, y: -0.29, bevel: 0.03 });
  const ammo = r.joint('ammo', 'arm', -0.78, -0.29, 0);
  ammo.ico(0.13, C.stone);
  r.joint('muzzle', 'arm', -0.78, -0.27, 0);
  r.group('arm').rotation.z = 0.2;
  flag(r, t, 0.72, 0.18, 0.3, 1.0);
}, 'catapult');

// ─── Gunpowder ──────────────────────────────────────────────────────────────

function cannonBarrel(p: Part, len: number, r0: number, r1: number, color: string): void {
  p.cyl(r0, r1, len, color, { x: len / 2 - 0.3, rz: -HALF_PI, seg: 12, ...METAL });
  p.torus(r0 * 1.2, 0.03, color, { x: len - 0.32, ry: HALF_PI, ...METAL });
  p.torus(r1 * 1.05, 0.03, color, { x: 0.05, ry: HALF_PI, ...METAL });
  p.torus((r0 + r1) * 0.55, 0.025, color, { x: len * 0.45 - 0.3, ry: HALF_PI, ...METAL });
  p.cyl(r0 * 0.7, r0 * 0.7, 0.02, '#141210', { x: len - 0.3, rz: -HALF_PI, seg: 10 });
  p.sphere(r1 * 0.6, color, { x: -0.35, ...METAL });
  p.sphere(r1 * 0.3, color, { x: -0.35 - r1 * 0.6, ...METAL });
}

function powder(p: Part, x: number, y: number, z: number): void {
  p.cyl(0.14, 0.14, 0.3, C.wood, { x, y: y + 0.15, z, seg: 10 });
  for (const dy of [0.05, 0.25]) p.cyl(0.145, 0.145, 0.03, C.iron, { x, y: y + dy, z, seg: 10, ...METAL });
  for (let i = 0; i < 3; i++) p.sphere(0.07, C.gunmetal, { x: x + 0.25 + (i % 2) * 0.12, y: y + 0.07 + (i === 2 ? 0.1 : 0), z: z + (i === 2 ? 0.06 : i * 0.13 - 0.06), ...METAL });
}

const swivelGun = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.1, 0.18, 1.0, C.wood, { y: 0.5, seg: 7 });
  b.block(0.1, 0.25, 0.25, t.main, { x: 0.15, y: 0.6, bevel: 0.02 });
  b.block(0.7, 0.1, 0.7, C.woodDark, { y: 0.05, bevel: 0.03 });
  powder(b, -0.35, 0.1, 0.2);
  const pv = r.joint('pivot', 'base', 0, 1.05, 0);
  pv.block(0.15, 0.3, 0.4, C.iron, { y: -0.05, bevel: 0.03, ...METAL });
  for (const z of [0.18, -0.18]) pv.block(0.06, 0.2, 0.05, C.iron, { y: 0.14, z, bevel: 0.01, ...METAL });
  const bar = r.joint('barrel', 'pivot', 0.1, 0.08, 0);
  cannonBarrel(bar, 1.0, 0.08, 0.12, '#3b3f44');
  bar.cyl(0.02, 0.02, 0.5, C.iron, { x: -0.55, rz: HALF_PI, seg: 5 });
  bar.sphere(0.035, C.wood, { x: -0.8 });
  r.joint('muzzle', 'barrel', 0.72, 0, 0);
  flag(r, t, -0.35, 0.1, -0.25, 1.2);
}, 'aim', 0.15);

const longCannon = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.4, 0.35, 0.9, C.wood, { y: 0.45, bevel: 0.04 });
  for (const z of [0.5, -0.5]) {
    for (const [x, rad] of [[0.4, 0.32], [-0.5, 0.28]] as const) {
      b.cyl(rad, rad, 0.1, C.woodDark, { x, y: rad, z, rx: HALF_PI, seg: 12 });
      b.torus(rad, 0.025, C.iron, { x, y: rad, z: z * 1.05, ts: 14, ...METAL });
      b.cyl(0.07, 0.07, 0.14, C.iron, { x, y: rad, z, rx: HALF_PI, seg: 6, ...METAL });
    }
  }
  for (const z of [0.3, -0.3]) b.extrude([[-0.6, 0], [0.6, 0], [0.5, 0.25], [0.1, 0.4], [-0.6, 0.2]], 0.08, C.woodDark, { y: 0.6, z, bevel: 0.01 });
  b.block(0.3, 0.1, 0.92, t.main, { x: -0.3, y: 0.66 });
  b.cyl(0.02, 0.02, 1.3, C.woodLight, { x: 0, y: 0.72, z: 0.46, rz: HALF_PI, seg: 4 });
  b.cyl(0.07, 0.07, 0.14, '#4a3c2a', { x: 0.65, y: 0.72, z: 0.46, rz: HALF_PI, seg: 8 });
  powder(b, -0.45, 0.0, -0.62);
  r.joint('pivot', 'base', 0.1, 0.85, 0);
  cog(r, 'cogElevate', 'base', -0.4, 0.85, 0.35, 0.12);
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  cannonBarrel(bar, 2.0, 0.14, 0.22, '#2f3338');
  r.joint('muzzle', 'barrel', 1.72, 0, 0);
  flag(r, t, -0.6, 0.62, 0.3, 1.2);
}, 'aim', 0.4);

const mortar = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.2, 0.45, 1.2, C.woodDark, { y: 0.22, bevel: 0.04 });
  for (let i = 0; i < 3; i++) b.box(1.22, 0.03, 1.22, C.iron, { y: 0.08 + i * 0.15 });
  b.block(1.25, 0.1, 0.1, t.main, { y: 0.35, z: 0.6 });
  for (let i = 0; i < 4; i++) b.sphere(0.1, C.gunmetal, { x: -0.45 + (i % 2) * 0.2, y: 0.55, z: -0.4 + Math.floor(i / 2) * 0.2, ...METAL });
  r.joint('pivot', 'base', 0, 0.6, 0);
  r.group('pivot').rotation.z = 0.9;
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.cyl(0.36, 0.3, 0.9, '#3a3d42', { x: 0.25, rz: -HALF_PI, seg: 14, ...METAL });
  bar.torus(0.36, 0.05, '#3a3d42', { x: 0.7, ry: HALF_PI, ...METAL });
  bar.torus(0.33, 0.035, '#3a3d42', { x: 0.2, ry: HALF_PI, ...METAL });
  for (const z of [0.34, -0.34]) bar.cyl(0.08, 0.08, 0.12, '#3a3d42', { x: 0.1, z, rx: HALF_PI, seg: 8, ...METAL });
  bar.cyl(0.3, 0.3, 0.02, '#111', { x: 0.71, rz: -HALF_PI, seg: 14 });
  r.joint('muzzle', 'barrel', 0.72, 0, 0);
  flag(r, t, -0.5, 0.45, -0.5, 1.1);
}, 'aim', 0.2);

// ─── Industrial ─────────────────────────────────────────────────────────────

const maximNest = T((r, t) => {
  const b = r.joint('base', null);
  sandbags(b, 0.05, 0, 0.72, -1.5, 1.5, 7);
  for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.8, C.gunmetal, { x: Math.cos(i * 2.1) * 0.2, y: 0.35, z: Math.sin(i * 2.1) * 0.2, rz: Math.cos(i * 2.1) * 0.4, rx: -Math.sin(i * 2.1) * 0.4, seg: 5 });
  b.block(0.36, 0.2, 0.2, '#56603e', { x: -0.3, y: 0.1, z: -0.35, bevel: 0.03 });
  b.block(0.36, 0.2, 0.2, '#56603e', { x: -0.3, y: 0.3, z: -0.3, ry: 0.3, bevel: 0.03 });
  const pv = r.joint('pivot', 'base', 0, 0.8, 0);
  pv.block(0.5, 0.3, 0.3, C.gunmetal, { x: -0.1, bevel: 0.04, ...METAL });
  pv.block(0.04, 0.42, 0.5, '#5a5f45', { x: 0.22, y: 0.1, taper: [1, 0.8], bevel: 0.015 });
  pv.block(0.06, 0.15, 0.2, t.main, { x: -0.1, y: 0.2, bevel: 0.015 });
  for (const z of [0.1, -0.1]) pv.cyl(0.015, 0.015, 0.2, C.black, { x: -0.42, y: 0, z, rz: HALF_PI, seg: 4 });
  // The ammunition belt feeds in from a box.
  pv.tube([[-0.05, 0, 0.16], [-0.1, -0.2, 0.26], [-0.25, -0.5, 0.3]], 0.03, C.brass, { seg: 6, ...METAL });
  const bar = r.joint('barrel', 'pivot', 0.1, 0, 0);
  bar.cyl(0.1, 0.1, 0.8, '#4a4f55', { x: 0.45, rz: -HALF_PI, seg: 12, ...METAL });
  for (let i = 0; i < 4; i++) bar.cyl(0.105, 0.105, 0.02, shade('#4a4f55', -0.3), { x: 0.15 + i * 0.2, rz: -HALF_PI, seg: 12, ...METAL });
  bar.cyl(0.03, 0.03, 0.3, C.black, { x: 0.95, rz: -HALF_PI, seg: 6 });
  bar.cyl(0.05, 0.03, 0.08, C.black, { x: 1.08, rz: -HALF_PI, seg: 6 });
  r.joint('muzzle', 'barrel', 1.1, 0, 0);
  flag(r, t, -0.55, 0.3, 0.45, 1.0);
}, 'aim', 0.06);

const flakCannon = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.3, 0.14, 0.26, C.olive, { y: 0.1, bevel: 0.03 });
  b.block(0.26, 0.14, 1.3, C.olive, { y: 0.1, bevel: 0.03 });
  for (const [x, z] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) b.cyl(0.11, 0.13, 0.09, C.gunmetal, { x: x!, y: 0.05, z: z!, seg: 8, ...METAL });
  b.cyl(0.3, 0.35, 0.4, '#58603e', { y: 0.33, seg: 12 });
  b.block(0.36, 0.26, 0.26, '#4a5234', { x: -0.5, y: 0.3, z: 0.36, bevel: 0.03 });
  for (let i = 0; i < 4; i++) b.cyl(0.035, 0.035, 0.22, C.brass, { x: -0.6 + i * 0.065, y: 0.48, z: 0.36, seg: 6, ...METAL });
  const pv = r.joint('pivot', 'base', 0, 0.62, 0);
  r.group('pivot').rotation.z = 0.5;
  pv.block(0.52, 0.42, 0.6, '#58603e', { bevel: 0.05, m: 0.4, r: 0.5 });
  pv.block(0.05, 0.46, 0.72, '#6a7348', { x: 0.2, y: 0.16, taper: [1, 0.85], bevel: 0.02 });
  pv.block(0.06, 0.09, 0.56, t.main, { x: 0.23, y: 0.32 });
  pv.torus(0.1, 0.02, C.black, { x: 0.1, y: 0.36, z: -0.24, ry: HALF_PI, ...METAL });
  cog(r, 'cogTraverse', 'base', 0.1, 0.52, 0.31, 0.12);
  const bar = r.joint('barrel', 'pivot', 0.18, 0.04, 0);
  bar.cyl(0.06, 0.08, 1.45, C.gunmetal, { x: 0.72, rz: -HALF_PI, seg: 10, ...METAL });
  bar.cyl(0.09, 0.09, 0.24, C.gunmetal, { x: 1.36, rz: -HALF_PI, seg: 10, ...METAL });
  bar.cyl(0.11, 0.11, 0.42, '#4a5234', { x: 0.12, rz: -HALF_PI, seg: 10 });
  r.joint('muzzle', 'barrel', 1.48, 0, 0);
  flag(r, t, -0.6, 0.17, -0.2, 1.0);
}, 'aim', 0.3);

const howitzer = T((r, t) => {
  const b = r.joint('base', null);
  for (const z of [0.5, -0.5]) {
    b.cyl(0.38, 0.38, 0.16, '#3a3a2e', { x: 0.1, y: 0.38, z, rx: HALF_PI, seg: 14 });
    b.cyl(0.27, 0.27, 0.18, '#4a4a3c', { x: 0.1, y: 0.38, z, rx: HALF_PI, seg: 10 });
    for (let i = 0; i < 6; i++) b.block(0.055, 0.5, 0.04, '#3a3a2e', { x: 0.1, y: 0.38, z: z * 1.2, rz: (i / 6) * Math.PI });
  }
  b.block(1.7, 0.18, 0.28, '#58603e', { x: -0.55, y: 0.28, rz: 0.2, bevel: 0.04 });
  b.block(0.2, 0.28, 0.38, '#4a5234', { x: -1.3, y: 0.1, rz: 0.2, bevel: 0.03 });
  b.block(0.1, 0.8, 1.2, '#6a7348', { x: 0.5, y: 0.78, taper: [1, 0.85], bevel: 0.03 });
  b.block(0.12, 0.18, 0.52, t.main, { x: 0.56, y: 0.94, bevel: 0.02 });
  for (let i = 0; i < 3; i++) b.block(0.24, 0.38, 0.13, '#6b6f48', { x: -0.5, y: 0.19, z: -0.36 + i * 0.15, bevel: 0.03 });
  r.joint('pivot', 'base', 0.1, 0.82, 0);
  r.group('pivot').rotation.z = 0.28;
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.cyl(0.11, 0.15, 1.85, '#4a5038', { x: 0.72, rz: -HALF_PI, seg: 12, ...METAL });
  bar.cyl(0.15, 0.15, 0.11, '#3a3e2c', { x: 1.6, rz: -HALF_PI, seg: 12, ...METAL });
  bar.block(0.72, 0.28, 0.32, '#58603e', { x: -0.1, bevel: 0.04 });
  for (const z of [0.11, -0.11]) bar.cyl(0.055, 0.055, 0.8, C.gunmetal, { x: 0.28, y: -0.18, z, rz: -HALF_PI, seg: 8, ...METAL });
  r.joint('muzzle', 'barrel', 1.65, 0, 0);
  flag(r, t, -0.7, 0.36, 0.3, 1.2);
}, 'aim', 0.4);

// ─── Modern ─────────────────────────────────────────────────────────────────

const ciws = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.5, 0.56, 0.36, '#d5d8dc', { y: 0.18, seg: 14 });
  b.cyl(0.58, 0.58, 0.06, '#9aa0a8', { y: 0.02, seg: 14, ...METAL });
  const pv = r.joint('pivot', 'base', 0, 0.58, 0);
  pv.block(0.62, 0.4, 0.62, '#c9ccd1', { bevel: 0.06 });
  pv.cyl(0.3, 0.3, 0.45, '#eef0f2', { x: -0.1, y: 0.42, seg: 14 });
  pv.dome(0.3, '#eef0f2', { x: -0.1, y: 0.64, ws: 14 });
  pv.block(0.26, 0.1, 0.05, t.main, { x: -0.1, y: 0.4, z: 0.31, e: 0.4 });
  pv.block(0.26, 0.32, 0.34, '#b8bcc2', { x: -0.28, y: -0.04, z: 0.26, bevel: 0.04 });
  pv.block(0.1, 0.15, 0.1, '#2b2e33', { x: 0.08, y: 0.34, z: -0.26, bevel: 0.03 });
  pv.cyl(0.035, 0.035, 0.03, '#7cf', { x: 0.14, y: 0.34, z: -0.26, rz: HALF_PI, e: 1.5 });
  const radar = r.joint('radar', 'pivot', -0.1, 0.9, 0);
  radar.cyl(0.025, 0.025, 0.06, C.gunmetal, { y: -0.03, seg: 5 });
  radar.block(0.04, 0.08, 0.34, '#eef0f2', { y: 0.02, bevel: 0.015 });
  r.joint('barrel', 'pivot', 0.28, -0.04, 0);
  const spin = r.joint('spin', 'barrel', 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spin.cyl(0.022, 0.022, 0.95, C.gunmetal, { x: 0.52, y: Math.cos(a) * 0.08, z: Math.sin(a) * 0.08, rz: -HALF_PI, seg: 5, ...METAL });
  }
  spin.cyl(0.12, 0.12, 0.11, C.gunmetal, { x: 0.13, rz: -HALF_PI, seg: 10, ...METAL });
  spin.cyl(0.115, 0.115, 0.05, C.gunmetal, { x: 0.88, rz: -HALF_PI, seg: 10, ...METAL });
  r.joint('muzzle', 'barrel', 1.02, 0, 0);
  flag(r, t, -0.45, 0.36, -0.3, 0.9);
}, 'spin', 0.03);

const missileBattery = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.1, 0.4, 1.1, '#6d7058', { y: 0.2, bevel: 0.05 });
  b.cyl(0.3, 0.35, 0.3, '#5d604a', { y: 0.5, seg: 10 });
  const radar = r.joint('radar', 'base', -0.4, 0.4, -0.4);
  radar.cyl(0.03, 0.03, 0.5, C.gunmetal, { y: 0.25, seg: 5 });
  radar.lathe([[0.01, 0], [0.18, 0.04], [0.25, 0.12]], '#c9ccd1', { y: 0.5, rz: HALF_PI, seg: 10 });
  const pv = r.joint('pivot', 'base', 0, 0.62, 0);
  r.group('pivot').rotation.z = 0.35;
  pv.block(1.3, 0.66, 0.78, '#7a7e63', { x: 0.2, bevel: 0.05 });
  pv.block(0.5, 0.12, 0.8, t.main, { x: -0.1, y: 0.28, e: 0.3 });
  pv.block(1.32, 0.05, 0.05, shade('#7a7e63', -0.25), { x: 0.2, z: 0.4 });
  for (let i = 0; i < 4; i++) pv.cyl(0.13, 0.13, 0.04, '#1b1d20', { x: 0.86, y: -0.15 + (i % 2) * 0.3, z: -0.18 + Math.floor(i / 2) * 0.36, rz: -HALF_PI, seg: 10 });
  // Loaded missiles: their noses show in the tubes until they fly.
  for (let i = 0; i < 4; i++) {
    const m = r.joint(`ammo${i}`, 'pivot', 0.86, -0.15 + (i % 2) * 0.3, -0.18 + Math.floor(i / 2) * 0.36);
    m.cone(0.1, 0.18, i % 3 ? '#e2e0d6' : '#c04030', { x: 0.08, rz: -HALF_PI, seg: 8 });
  }
  const bar = r.joint('barrel', 'pivot', 0.2, 0, 0);
  bar.box(0.01, 0.01, 0.01, '#000');
  r.joint('muzzle', 'barrel', 0.8, 0.1, 0);
  flag(r, t, -0.45, 0.4, 0.4, 0.9);
}, 'aim', 0.1);

const artillery = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.6, 0.36, 1.0, '#5d6146', { y: 0.18, bevel: 0.05 });
  for (const z of [0.45, -0.45]) b.block(1.62, 0.13, 0.13, '#3a3c2e', { y: 0.07, z, bevel: 0.03 });
  cog(r, 'cogLift', 'base', -0.3, 0.46, 0.45, 0.12);
  r.joint('pivot', 'base', -0.2, 0.5, 0);
  r.group('pivot').rotation.z = 0.45;
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.block(1.5, 0.62, 0.8, '#6c7052', { x: 0.55, bevel: 0.05 });
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) bar.cyl(0.075, 0.075, 0.05, '#15171a', { x: 1.31, y: -0.2 + row * 0.2, z: -0.28 + col * 0.187, rz: -HALF_PI, seg: 8 });
  const salvo = r.joint('ammo', 'barrel', 1.31, 0, 0);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) salvo.cone(0.06, 0.13, '#b8b49a', { x: 0.06, y: -0.2 + row * 0.2, z: -0.28 + col * 0.187, rz: -HALF_PI, seg: 6 });
  bar.block(1.52, 0.09, 0.82, t.main, { x: 0.55, y: 0.27 });
  bar.block(1.3, 0.05, 0.83, shade('#6c7052', -0.25), { x: 0.55, y: -0.1 });
  r.joint('muzzle', 'barrel', 1.35, 0, 0);
  flag(r, t, -0.7, 0.36, -0.3, 0.9);
}, 'aim', 0.12);

// ─── Intelligence ───────────────────────────────────────────────────────────

const laserTurret = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.5, 0.65, 0.4, '#e4e8ee', { y: 0.2, seg: 8, m: 0.3, r: 0.3 });
  for (let i = 0; i < 8; i++) b.block(0.1, 0.36, 0.06, '#23272f', { x: Math.cos((i / 8) * Math.PI * 2) * 0.6, y: 0.18, z: Math.sin((i / 8) * Math.PI * 2) * 0.6, ry: -(i / 8) * Math.PI * 2 });
  b.torus(0.58, 0.04, t.glow, { y: 0.4, rx: HALF_PI, e: 2.5 });
  const pv = r.joint('pivot', 'base', 0, 0.85, 0);
  pv.sphere(0.45, '#e4e8ee', { s: [1.2, 0.9, 1], ws: 12, hs: 8, m: 0.3, r: 0.25 });
  pv.block(0.5, 0.06, 0.9, '#23272f', { y: 0.1 });
  pv.block(0.3, 0.1, 0.2, '#23272f', { x: -0.2, y: 0.38, bevel: 0.03 });
  pv.block(0.04, 0.05, 0.16, t.glow, { x: -0.05, y: 0.38, e: 2 });
  const bar = r.joint('barrel', 'pivot', 0.3, 0, 0);
  bar.cyl(0.14, 0.2, 0.7, '#23272f', { x: 0.35, rz: -HALF_PI, seg: 10, m: 0.6, r: 0.3 });
  for (let i = 0; i < 3; i++) {
    const c = r.joint(`coil${i}`, 'barrel', 0.18 + i * 0.2, 0, 0);
    c.torus(0.19 - i * 0.015, 0.025, t.glow, { ry: HALF_PI, e: 3 });
  }
  bar.cyl(0.13, 0.13, 0.03, t.glow, { x: 0.71, rz: -HALF_PI, e: 4 });
  r.joint('muzzle', 'barrel', 0.74, 0, 0);
  flag(r, t, -0.45, 0.4, -0.35, 0.8);
}, 'aim', 0.05);

const railgunTurret = T((r, t) => {
  const b = r.joint('base', null);
  b.block(1.0, 0.5, 1.0, '#23272f', { y: 0.25, bevel: 0.06, m: 0.6, r: 0.3 });
  b.block(0.8, 0.05, 0.8, t.glow, { y: 0.52, e: 1.5 });
  const pv = r.joint('pivot', 'base', 0, 0.9, 0);
  pv.block(0.8, 0.5, 0.7, '#e4e8ee', { bevel: 0.06, m: 0.3, r: 0.3 });
  pv.block(0.5, 0.3, 0.72, '#23272f', { x: -0.2, y: 0.12, bevel: 0.03 });
  for (let i = 0; i < 3; i++) pv.cyl(0.05, 0.05, 0.3, i === 1 ? t.glow : '#4a525c', { x: -0.45, y: -0.1 + i * 0.1, z: 0.2, rz: HALF_PI, e: i === 1 ? 2 : 0, seg: 6 });
  const bar = r.joint('barrel', 'pivot', 0.2, 0, 0);
  bar.block(1.9, 0.07, 0.1, '#b8c0c9', { x: 0.85, y: 0.11, bevel: 0.02, ...METAL });
  bar.block(1.9, 0.07, 0.1, '#b8c0c9', { x: 0.85, y: -0.11, bevel: 0.02, ...METAL });
  for (let i = 0; i < 5; i++) {
    const c = r.joint(`coil${i}`, 'barrel', 0.2 + i * 0.36, 0, 0);
    c.block(0.08, 0.32, 0.22, t.glow, { e: 2.2, bevel: 0.02 });
  }
  r.joint('muzzle', 'barrel', 1.82, 0, 0);
  flag(r, t, -0.4, 0.5, -0.4, 0.9);
}, 'aim', 0.3);

const teslaNode = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.4, 0.58, 0.44, '#23272f', { y: 0.22, seg: 8, m: 0.6, r: 0.3 });
  for (let i = 0; i < 4; i++) b.block(0.14, 0.44, 0.14, '#3a3f48', { x: Math.cos(i * HALF_PI + 0.78) * 0.48, y: 0.22, z: Math.sin(i * HALF_PI + 0.78) * 0.48, bevel: 0.03 });
  b.cyl(0.1, 0.17, 0.7, '#b8c0c9', { y: 0.72, seg: 8, ...METAL });
  for (let i = 0; i < 4; i++) b.torus(0.25 - i * 0.03, 0.045, '#c98a3a', { y: 0.5 + i * 0.13, rx: HALF_PI, ...METAL });
  b.torus(0.6, 0.04, t.glow, { y: 0.45, rx: HALF_PI, e: 2 });
  r.joint('pivot', 'base', 0, 0, 0);
  const orb = r.joint('orb', 'pivot', 0, 1.12, 0);
  orb.ico(0.24, t.glow, { e: 3.5, detail: 1 });
  orb.torus(0.3, 0.025, '#ffffff', { rx: 1.1, e: 2 });
  const ring = r.joint('radarRing', 'pivot', 0, 1.12, 0);
  ring.torus(0.46, 0.022, '#b8c0c9', { rx: HALF_PI, ts: 20, ...METAL });
  for (let i = 0; i < 3; i++) ring.sphere(0.045, t.glow, { x: Math.cos((i / 3) * Math.PI * 2) * 0.46, z: Math.sin((i / 3) * Math.PI * 2) * 0.46, e: 3 });
  r.joint('muzzle', 'orb', 0, 0, 0);
  flag(r, t, -0.45, 0.44, -0.3, 0.8);
}, 'pulse');

const BUILDERS: Record<string, (t: Team) => TurretTemplate> = {
  rockSling, eggLauncher, boulderCatapult,
  bowNest, scorpion, greekFire,
  arbalest, boilingOil, trebuchet,
  swivelGun, longCannon, mortar,
  maximNest, flakCannon, howitzer,
  ciws, missileBattery, artillery,
  laserTurret, railgunTurret, teslaNode,
};

const cache = new Map<string, TurretTemplate>();

export function turretTemplate(model: string, side: 0 | 1): TurretTemplate {
  const key = `${model}:${side}`;
  let t = cache.get(key);
  if (!t) {
    const build = BUILDERS[model];
    if (!build) throw new Error(`no turret model ${model}`);
    t = build(TEAMS[side]);
    cache.set(key, t);
  }
  return t;
}

interface Named {
  o: THREE.Object3D;
  rot: THREE.Euler;
  kind: string;
  i: number;
}

/** A placed turret: clones the template and animates aim, recoil and flourishes. */
export class TurretInstance {
  readonly root: THREE.Group;
  private readonly pivot: THREE.Object3D | undefined;
  private readonly barrel: THREE.Object3D | undefined;
  private readonly arm: THREE.Object3D | undefined;
  private readonly spin: THREE.Object3D | undefined;
  private readonly orb: THREE.Object3D | undefined;
  readonly muzzle: THREE.Object3D | undefined;
  private readonly restPitch: number;
  private readonly barrelX: number;
  private readonly armRest: number;
  private readonly pivotY: number;
  /** Joints animated by their names (see the list at the top of this file). */
  private readonly extras: Named[] = [];
  private pitch = 0;
  private spinSpeed = 0;
  private spinAngle = 0;

  constructor(readonly template: TurretTemplate) {
    this.root = cloneSkinned(template.object) as THREE.Group;
    this.pivot = this.root.getObjectByName('pivot');
    this.barrel = this.root.getObjectByName('barrel');
    this.arm = this.root.getObjectByName('arm');
    this.spin = this.root.getObjectByName('spin');
    this.orb = this.root.getObjectByName('orb');
    this.muzzle = this.root.getObjectByName('muzzle');
    this.restPitch = this.pivot?.rotation.z ?? 0;
    this.pitch = this.restPitch;
    this.barrelX = this.barrel?.position.x ?? 0;
    this.armRest = this.arm?.rotation.z ?? 0;
    this.pivotY = this.pivot?.position.y ?? 0;
    let i = 0;
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        return;
      }
      const kind = /\.swayF\d+$/.test(o.name)
        ? 'flag'
        : (/^(cog|crank|radar|ammo|flame|limb|coil|wing|tip)/.exec(o.name)?.[1] ?? null);
      if (kind) this.extras.push({ o, rot: o.rotation.clone(), kind, i: i++ });
    });
  }

  /** Free the bone textures (geometry and material are shared). */
  dispose(): void {
    this.root.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.dispose();
    });
  }

  /**
   * @param aim pitch toward the target (radians)
   * @param fireAge seconds since the last shot
   * @param interval seconds between shots, for reload timing
   */
  animate(aim: number, fireAge: number, t: number, dt: number, interval = 1.2): void {
    const anim = this.template.anim;
    const prevPitch = this.pitch;
    if (this.pivot && (anim === 'aim' || anim === 'spin' || anim === 'hen')) {
      const [lo, hi] = this.template.pitch;
      const want = anim === 'aim' && this.restPitch !== 0 ? this.restPitch + aim * 0.3 : aim;
      const target = Math.max(lo, Math.min(hi, want));
      this.pitch += (target - this.pitch) * Math.min(1, dt * 6);
      this.pivot.rotation.z = this.pitch;
    }
    const recoil = fireAge < 0.25 ? 1 - fireAge / 0.25 : 0;
    if (this.barrel) this.barrel.position.x = this.barrelX - recoil * this.template.kick;
    if (anim === 'hen' && this.barrel) {
      this.barrel.rotation.z = Math.sin(t * 9) * 0.08 + recoil * 0.5;
      if (this.pivot) this.pivot.position.y = this.pivotY + Math.abs(Math.sin(t * 4)) * 0.04;
    }
    if (anim === 'catapult' && this.arm) {
      // Swing forward on release, then winch back down.
      const swing = fireAge < 0.2 ? fireAge / 0.2 : Math.max(0, 1 - (fireAge - 0.2) / 1.2);
      this.arm.rotation.z = this.armRest - swing * this.template.swing;
    }
    if (anim === 'spin' && this.spin) {
      this.spinSpeed += ((fireAge < 0.5 ? 40 : 0) - this.spinSpeed) * Math.min(1, dt * 3);
      this.spinAngle += this.spinSpeed * dt;
      this.spin.rotation.x = this.spinAngle;
    }
    if (anim === 'pulse' && this.orb) {
      const k = 1 + Math.sin(t * 4) * 0.06 + recoil * 0.25;
      this.orb.scale.setScalar(k);
      this.orb.rotation.y = t * 2;
    }

    // Reload: 0 just after a shot, 1 once loaded again.
    const reload = Math.min(1, fireAge / Math.max(0.3, Math.min(interval * 0.8, 1.6)));
    const turned = (this.pitch - prevPitch) * 6;
    for (const x of this.extras) {
      const o = x.o;
      switch (x.kind) {
        case 'flag':
          o.rotation.y = x.rot.y + Math.sin(t * 5 + x.i * 1.3) * 0.35;
          break;
        case 'cog':
          o.rotation.z += turned - recoil * dt * 8;
          break;
        case 'crank':
          if (fireAge > 0.2 && reload < 1) o.rotation.z -= dt * 7;
          break;
        case 'radar':
          o.rotation.y = x.rot.y + t * (o.name === 'radarRing' ? -1.5 : 2.2);
          break;
        case 'ammo': {
          // Gone when loosed; slides back in over the second half of the reload.
          const k = fireAge < 0.05 || reload >= 1 ? 1 : Math.max(1e-4, (reload - 0.5) * 2);
          o.scale.setScalar(k);
          break;
        }
        case 'flame': {
          const f = 1 + Math.sin(t * 17 + x.i) * 0.12 + Math.sin(t * 29 + x.i * 2) * 0.08;
          o.scale.set(f, f * (1 + recoil * 0.4), f);
          break;
        }
        case 'limb': {
          // Drawn back while loaded; flung forward on release.
          const near = o.name.endsWith('N') ? 1 : -1;
          const flex = recoil > 0 ? -0.2 * recoil : 0.1 * reload;
          o.rotation.y = x.rot.y - near * flex;
          break;
        }
        case 'coil': {
          const wave = Math.max(0, 1 - Math.abs(fireAge * 4 - ((x.i % 6) * 0.25)));
          o.scale.setScalar(1 + wave * 0.35 + Math.sin(t * 3 + x.i) * 0.04);
          break;
        }
        case 'wing': {
          const flap = recoil * 1.1 + Math.max(0, Math.sin(t * 13)) * 0.08;
          o.rotation.x = x.rot.x + (o.name === 'wingN' ? -flap : flap);
          break;
        }
        case 'tip':
          o.rotation.z = x.rot.z - Math.sin(Math.min(1, fireAge / 0.6) * Math.PI) * 0.7;
          break;
      }
    }
  }
}
