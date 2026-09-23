import * as THREE from 'three';
import { Part, RigBuilder } from '../kit/builder';
import { staticMaterial } from '../kit/materials';
import { C } from './gear';
import { TEAMS, type Team } from './team';

/**
 * Turret models. Joints: pivot (pitches toward the target), barrel (recoils),
 * muzzle (flash point), plus arm / spin / orb for the machines that throw,
 * rotate or pulse instead of simply recoiling.
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
}

function T(build: (r: RigBuilder, t: Team) => void, anim: TurretAnim = 'aim', kick = 0.25): (t: Team) => TurretTemplate {
  return (t) => {
    const r = new RigBuilder('turret');
    build(r, t);
    if (!r.has('muzzle')) r.joint('muzzle', r.has('barrel') ? 'barrel' : null, 1, 0.8, 0);
    const object = r.build(staticMaterial);
    return { object, anim, kick, back: new THREE.Box3().setFromObject(object).min.x };
  };
}

// ─── Stone ──────────────────────────────────────────────────────────────────

const rockSling = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.2, 0.3, 1.0, C.wood, { y: 0.15 });
  const pv = r.joint('pivot', 'base', 0, 0.3, 0);
  pv.cyl(0.08, 0.1, 1.2, C.wood, { y: 0.6, rz: -0.2 });
  pv.cyl(0.05, 0.06, 0.6, C.wood, { x: 0.2, y: 1.3, z: 0.2, rx: -0.5 });
  pv.cyl(0.05, 0.06, 0.6, C.wood, { x: 0.2, y: 1.3, z: -0.2, rx: 0.5 });
  pv.box(0.1, 0.1, 0.12, t.main, { x: 0.1, y: 0.9 });
  const bar = r.joint('barrel', 'pivot', 0.3, 1.45, 0);
  bar.tube([[0, 0, 0.42], [-0.35, -0.1, 0], [0, 0, -0.42]], 0.02, C.rope, { seg: 6 });
  bar.ico(0.12, C.stone, { x: -0.35, y: -0.1 });
  r.joint('muzzle', 'barrel', 0.1, 0, 0);
}, 'aim', 0.3);

const eggLauncher = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.65, 0.55, 0.35, C.woodLight, { y: 0.18, seg: 10 });
  for (let i = 0; i < 10; i++) b.cyl(0.03, 0.03, 0.5, C.wood, { x: Math.cos(i) * 0.6, y: 0.3, z: Math.sin(i) * 0.6, rz: Math.cos(i) * 0.5, rx: Math.sin(i) * 0.5 });
  const pv = r.joint('pivot', 'base', 0, 0.45, 0);
  pv.sphere(0.45, '#f4efe6', { y: 0.35, s: [1.2, 1, 0.95] });
  pv.cone(0.25, 0.5, '#f4efe6', { x: -0.55, y: 0.55, rz: 0.9 });
  pv.box(0.3, 0.1, 0.1, t.main, { y: 0.1, x: -0.1, s: [1, 1, 8] });
  const bar = r.joint('barrel', 'pivot', 0.4, 0.75, 0);
  bar.sphere(0.25, '#f4efe6');
  bar.cone(0.1, 0.25, '#f0b429', { x: 0.28, rz: -HALF_PI });
  bar.box(0.14, 0.18, 0.05, '#d23b2b', { y: 0.25 });
  bar.box(0.05, 0.05, 0.05, '#111', { x: 0.14, y: 0.08, z: 0.17 });
  bar.box(0.1, 0.03, 0.05, '#111', { x: 0.14, y: 0.14, z: 0.17, rz: -0.4 });
  r.joint('muzzle', 'barrel', 0.4, 0, 0);
}, 'hen', 0.12);

const boulderCatapult = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.8, 0.25, 1.0, C.wood, { y: 0.4 });
  for (const z of [0.45, -0.45]) {
    b.box(0.2, 1.2, 0.15, C.woodDark, { x: 0.2, y: 0.9, z, rz: 0.2 });
    b.cyl(0.3, 0.3, 0.12, C.woodDark, { x: -0.6, y: 0.3, z: z * 1.1, rx: HALF_PI });
    b.cyl(0.3, 0.3, 0.12, C.woodDark, { x: 0.6, y: 0.3, z: z * 1.1, rx: HALF_PI });
  }
  b.box(0.2, 0.2, 1.0, t.main, { x: 0.3, y: 1.45 });
  r.joint('pivot', 'base', 0, 0, 0);
  const arm = r.joint('arm', 'pivot', 0.3, 0.7, 0);
  arm.box(1.9, 0.14, 0.14, C.wood, { x: -0.9 });
  arm.cyl(0.25, 0.2, 0.2, C.woodDark, { x: -1.8, y: 0.1 });
  arm.ico(0.2, C.stone, { x: -1.8, y: 0.25 });
  r.joint('muzzle', 'arm', -1.8, 0.3, 0);
}, 'catapult');

// ─── Ancient ────────────────────────────────────────────────────────────────

const bowNest = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.3, 0.8, 1.3, '#d9c28e', { y: 0.4 });
  b.box(1.4, 0.15, 1.4, C.bronze, { y: 0.85, ...METAL });
  b.box(0.1, 0.5, 1.2, t.main, { x: 0.66, y: 0.4 });
  const pv = r.joint('pivot', 'base', 0.1, 1.2, 0);
  pv.box(0.2, 0.2, 0.2, C.woodDark);
  const bar = r.joint('barrel', 'pivot', 0.2, 0, 0);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const s = -1 + (i / 8) * 2;
    pts.push([0.22 * (1 - s * s), 0, s * 0.75]);
  }
  bar.tube(pts, 0.035, '#3d2a1a', { seg: 12 });
  bar.box(0.9, 0.05, 0.05, C.woodLight, { x: 0.1 });
  bar.cone(0.05, 0.12, C.bronze, { x: 0.6, rz: -HALF_PI });
}, 'aim', 0.1);

const scorpion = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.08, 0.12, 1.0, C.wood, { y: 0.5 });
  for (let i = 0; i < 3; i++) b.box(0.08, 0.8, 0.08, C.wood, { x: Math.cos(i * 2.1) * 0.35, y: 0.3, z: Math.sin(i * 2.1) * 0.35, rz: Math.cos(i * 2.1) * 0.5, rx: -Math.sin(i * 2.1) * 0.5 });
  const pv = r.joint('pivot', 'base', 0, 1.05, 0);
  pv.box(1.4, 0.14, 0.2, C.wood, { x: 0.1 });
  pv.box(0.3, 0.35, 0.5, C.woodDark, { x: 0.45 });
  pv.cyl(0.08, 0.08, 0.5, C.rope, { x: 0.45, rx: HALF_PI });
  pv.box(0.12, 0.08, 1.3, C.woodDark, { x: 0.5, z: 0, rx: 0, s: [1, 1, 1] });
  pv.box(0.06, 0.2, 0.06, t.main, { x: -0.4, y: 0.15 });
  const bar = r.joint('barrel', 'pivot', 0, 0.1, 0);
  bar.cyl(0.03, 0.03, 1.4, C.woodLight, { x: 0.3, rz: HALF_PI });
  bar.cone(0.06, 0.2, C.bronze, { x: 1.05, rz: -HALF_PI, ...METAL });
  r.joint('muzzle', 'barrel', 1.1, 0, 0);
}, 'aim', 0.4);

const greekFire = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.0, 0.5, 1.0, '#cdb68a', { y: 0.25 });
  b.lathe([[0.01, 0], [0.4, 0.1], [0.5, 0.45], [0.3, 0.8], [0.15, 0.9]], C.bronze, { y: 0.5, seg: 10, ...METAL });
  b.cyl(0.52, 0.52, 0.12, t.main, { y: 0.9, seg: 10 });
  const pv = r.joint('pivot', 'base', 0.1, 1.2, 0);
  pv.sphere(0.18, C.bronze, METAL);
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.cyl(0.08, 0.12, 1.1, C.bronze, { x: 0.55, rz: -HALF_PI, ...METAL });
  bar.torus(0.12, 0.03, C.gold, { x: 1.05, ry: HALF_PI, ...METAL });
  bar.sphere(0.07, '#ff7a2a', { x: 1.12, e: 3 });
  r.joint('muzzle', 'barrel', 1.15, 0, 0);
}, 'aim', 0.2);

// ─── Medieval ───────────────────────────────────────────────────────────────

const arbalest = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.1, 0.15, 1.0, C.woodDark, { y: 0.5 });
  b.box(0.8, 0.12, 0.8, C.wood, { y: 0.06 });
  const pv = r.joint('pivot', 'base', 0, 1.05, 0);
  pv.box(1.5, 0.16, 0.22, C.wood, { x: 0.15 });
  pv.box(0.12, 0.12, 1.5, C.iron, { x: 0.75, ...METAL });
  pv.tube([[0.75, 0, 0.74], [0.1, 0.05, 0], [0.75, 0, -0.74]], 0.012, C.linen, { seg: 2 });
  pv.box(0.3, 0.3, 0.02, t.main, { x: -0.4, y: 0.15, z: 0.12 });
  const bar = r.joint('barrel', 'pivot', 0, 0.12, 0);
  bar.box(0.9, 0.04, 0.04, C.woodLight, { x: 0.4 });
  bar.cone(0.05, 0.14, C.steel, { x: 0.9, rz: -HALF_PI, ...METAL });
  r.joint('muzzle', 'barrel', 0.95, 0, 0);
}, 'aim', 0.3);

const boilingOil = T((r, t) => {
  const b = r.joint('base', null);
  for (const z of [0.5, -0.5]) b.box(0.15, 1.4, 0.15, C.woodDark, { y: 0.7, z });
  b.box(0.12, 0.12, 1.2, C.woodDark, { y: 1.4 });
  b.cyl(0.25, 0.3, 0.2, '#3a2a20', { y: 0.1 });
  b.cone(0.22, 0.45, '#ff8a2a', { y: 0.35, e: 2.5, seg: 6 });
  b.box(0.08, 0.3, 0.3, t.main, { x: -0.2, y: 1.15, z: 0.5 });
  r.joint('pivot', 'base', 0, 1.25, 0);
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.lathe([[0.01, -0.5], [0.4, -0.45], [0.48, -0.1], [0.5, 0.1]], C.iron, { seg: 10, ...METAL });
  bar.cyl(0.46, 0.46, 0.04, '#2a1a0a', { y: 0.05, seg: 10, e: 0.2 });
  bar.box(0.25, 0.08, 0.2, C.iron, { x: 0.55, y: 0.08, ...METAL });
  r.joint('muzzle', 'barrel', 0.6, 0, 0);
}, 'aim', 0);

const trebuchet = T((r, t) => {
  const b = r.joint('base', null);
  b.box(2.2, 0.2, 1.3, C.wood, { y: 0.1 });
  for (const z of [0.5, -0.5]) {
    b.box(0.18, 2.4, 0.18, C.woodDark, { x: 0.4, y: 1.2, z, rz: 0.25 });
    b.box(0.18, 2.4, 0.18, C.woodDark, { x: -0.4, y: 1.2, z, rz: -0.25 });
  }
  b.cyl(0.08, 0.08, 1.2, C.iron, { y: 2.3, rx: HALF_PI, ...METAL });
  b.box(0.1, 0.5, 0.7, t.main, { x: 0.9, y: 0.45 });
  r.joint('pivot', 'base', 0, 0, 0);
  const arm = r.joint('arm', 'pivot', 0, 2.3, 0);
  arm.box(3.4, 0.14, 0.14, C.wood, { x: -0.6 });
  arm.box(0.7, 0.7, 0.7, '#6a6258', { x: 1.1, y: -0.5 });
  arm.tube([[-2.3, 0, 0], [-2.4, -0.4, 0], [-2.2, -0.7, 0]], 0.015, C.rope, { seg: 3 });
  arm.ico(0.22, C.stone, { x: -2.2, y: -0.75 });
  r.joint('muzzle', 'arm', -2.2, -0.7, 0);
}, 'catapult');

// ─── Gunpowder ──────────────────────────────────────────────────────────────

function cannonBarrel(p: Part, len: number, r0: number, r1: number, color: string): void {
  p.cyl(r0, r1, len, color, { x: len / 2 - 0.3, rz: -HALF_PI, seg: 10, ...METAL });
  p.torus(r0 * 1.2, 0.03, color, { x: len - 0.32, ry: HALF_PI, ...METAL });
  p.sphere(r1 * 0.6, color, { x: -0.35, ...METAL });
}

const swivelGun = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.1, 0.18, 1.0, C.wood, { y: 0.5 });
  b.box(0.1, 0.25, 0.25, t.main, { x: 0.15, y: 0.6 });
  const pv = r.joint('pivot', 'base', 0, 1.05, 0);
  pv.box(0.15, 0.3, 0.4, C.iron, { y: -0.05, ...METAL });
  const bar = r.joint('barrel', 'pivot', 0.1, 0.08, 0);
  cannonBarrel(bar, 1.0, 0.08, 0.12, '#3b3f44');
  bar.cyl(0.02, 0.02, 0.5, C.iron, { x: -0.55, rz: HALF_PI });
  r.joint('muzzle', 'barrel', 0.72, 0, 0);
}, 'aim', 0.15);

const longCannon = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.4, 0.35, 0.9, C.wood, { y: 0.45 });
  for (const z of [0.5, -0.5]) {
    b.cyl(0.32, 0.32, 0.1, C.woodDark, { x: 0.4, y: 0.32, z, rx: HALF_PI, seg: 10 });
    b.cyl(0.28, 0.28, 0.1, C.woodDark, { x: -0.5, y: 0.28, z, rx: HALF_PI, seg: 10 });
  }
  b.box(0.3, 0.1, 0.92, t.main, { x: -0.3, y: 0.65 });
  r.joint('pivot', 'base', 0.1, 0.85, 0);
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  cannonBarrel(bar, 2.0, 0.14, 0.22, '#2f3338');
  r.joint('muzzle', 'barrel', 1.72, 0, 0);
}, 'aim', 0.4);

const mortar = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.2, 0.45, 1.2, C.woodDark, { y: 0.22 });
  b.box(1.25, 0.1, 0.1, t.main, { y: 0.35, z: 0.6 });
  r.joint('pivot', 'base', 0, 0.6, 0);
  r.group('pivot').rotation.z = 0.9;
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.cyl(0.36, 0.3, 0.9, '#3a3d42', { x: 0.25, rz: -HALF_PI, seg: 12, ...METAL });
  bar.torus(0.36, 0.05, '#3a3d42', { x: 0.7, ry: HALF_PI, ...METAL });
  bar.cyl(0.3, 0.3, 0.02, '#111', { x: 0.71, rz: -HALF_PI, seg: 12 });
  r.joint('muzzle', 'barrel', 0.72, 0, 0);
}, 'aim', 0.2);

// ─── Industrial ─────────────────────────────────────────────────────────────

const maximNest = T((r, t) => {
  const b = r.joint('base', null);
  for (let i = 0; i < 7; i++) {
    const a = -1.4 + i * 0.47;
    b.capsule(0.17, 0.4, '#a39570', { x: Math.cos(a) * 0.7, y: 0.2, z: Math.sin(a) * 0.7, rz: HALF_PI, ry: -a + HALF_PI });
  }
  for (let i = 0; i < 3; i++) b.cyl(0.03, 0.03, 0.8, C.gunmetal, { x: Math.cos(i * 2.1) * 0.2, y: 0.35, z: Math.sin(i * 2.1) * 0.2, rz: Math.cos(i * 2.1) * 0.4, rx: -Math.sin(i * 2.1) * 0.4 });
  const pv = r.joint('pivot', 'base', 0, 0.8, 0);
  pv.box(0.5, 0.3, 0.3, C.gunmetal, { x: -0.1, ...METAL });
  pv.box(0.02, 0.35, 0.4, '#5a5f45', { x: 0.2, y: 0.1 });
  pv.box(0.06, 0.15, 0.2, t.main, { x: -0.1, y: 0.2 });
  const bar = r.joint('barrel', 'pivot', 0.1, 0, 0);
  bar.cyl(0.09, 0.09, 0.8, '#4a4f55', { x: 0.45, rz: -HALF_PI, seg: 10, ...METAL });
  bar.cyl(0.03, 0.03, 0.3, C.black, { x: 0.95, rz: -HALF_PI });
  r.joint('muzzle', 'barrel', 1.05, 0, 0);
}, 'aim', 0.06);

const flakCannon = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.8, 0.15, 0.3, C.olive, { y: 0.1 });
  b.box(0.3, 0.15, 1.8, C.olive, { y: 0.1 });
  b.cyl(0.35, 0.4, 0.5, '#58603e', { y: 0.4 });
  const pv = r.joint('pivot', 'base', 0, 0.8, 0);
  r.group('pivot').rotation.z = 0.7;
  pv.box(0.6, 0.5, 0.7, '#58603e', { m: 0.4, r: 0.5 });
  pv.box(0.05, 0.6, 0.9, '#6a7348', { x: 0.2, y: 0.2 });
  pv.box(0.06, 0.1, 0.7, t.main, { x: 0.23, y: 0.4 });
  const bar = r.joint('barrel', 'pivot', 0.2, 0.05, 0);
  bar.cyl(0.07, 0.09, 2.0, C.gunmetal, { x: 1.0, rz: -HALF_PI, ...METAL });
  bar.cyl(0.1, 0.1, 0.3, C.gunmetal, { x: 1.9, rz: -HALF_PI, ...METAL });
  r.joint('muzzle', 'barrel', 2.05, 0, 0);
}, 'aim', 0.35);

const howitzer = T((r, t) => {
  const b = r.joint('base', null);
  for (const z of [0.55, -0.55]) b.cyl(0.42, 0.42, 0.18, '#3a3a2e', { x: 0.1, y: 0.42, z, rx: HALF_PI, seg: 12 });
  b.box(1.8, 0.2, 0.3, '#58603e', { x: -0.6, y: 0.3, rz: 0.2 });
  b.box(0.1, 1.0, 1.4, '#6a7348', { x: 0.5, y: 0.9 });
  b.box(0.12, 0.2, 0.6, t.main, { x: 0.56, y: 1.1 });
  r.joint('pivot', 'base', 0.1, 0.95, 0);
  r.group('pivot').rotation.z = 0.35;
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.cyl(0.12, 0.16, 2.2, '#4a5038', { x: 0.9, rz: -HALF_PI, seg: 10, ...METAL });
  bar.box(0.8, 0.3, 0.35, '#58603e', { x: -0.1 });
  r.joint('muzzle', 'barrel', 2.0, 0, 0);
}, 'aim', 0.45);

// ─── Modern ─────────────────────────────────────────────────────────────────

const ciws = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.55, 0.6, 0.5, '#d5d8dc', { y: 0.25, seg: 12 });
  const pv = r.joint('pivot', 'base', 0, 0.9, 0);
  pv.box(0.7, 0.5, 0.7, '#c9ccd1', {});
  pv.cyl(0.35, 0.35, 0.8, '#eef0f2', { x: -0.1, y: 0.55, seg: 12 });
  pv.dome(0.35, '#eef0f2', { x: -0.1, y: 0.95, ws: 12 });
  pv.box(0.3, 0.12, 0.05, t.main, { x: -0.1, y: 0.5, z: 0.36, e: 0.4 });
  r.joint('barrel', 'pivot', 0.3, -0.05, 0);
  const spin = r.joint('spin', 'barrel', 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spin.cyl(0.025, 0.025, 1.1, C.gunmetal, { x: 0.6, y: Math.cos(a) * 0.09, z: Math.sin(a) * 0.09, rz: -HALF_PI, ...METAL });
  }
  spin.cyl(0.14, 0.14, 0.12, C.gunmetal, { x: 0.15, rz: -HALF_PI, ...METAL });
  r.joint('muzzle', 'barrel', 1.2, 0, 0);
}, 'spin', 0.03);

const missileBattery = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.1, 0.4, 1.1, '#6d7058', { y: 0.2 });
  const pv = r.joint('pivot', 'base', 0, 0.7, 0);
  r.group('pivot').rotation.z = 0.35;
  pv.box(1.3, 0.7, 0.9, '#7a7e63', { x: 0.2 });
  for (let i = 0; i < 4; i++) pv.cyl(0.13, 0.13, 0.05, i % 3 ? '#1b1d20' : '#c04030', { x: 0.86, y: -0.15 + (i % 2) * 0.32, z: -0.2 + Math.floor(i / 2) * 0.4, rz: -HALF_PI });
  pv.box(0.5, 0.12, 0.92, t.main, { x: -0.1, y: 0.3, e: 0.3 });
  const bar = r.joint('barrel', 'pivot', 0.2, 0, 0);
  bar.box(0.01, 0.01, 0.01, '#000');
  r.joint('muzzle', 'barrel', 0.8, 0.1, 0);
}, 'aim', 0.1);

const artillery = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.6, 0.4, 1.1, '#5d6146', { y: 0.2 });
  r.joint('pivot', 'base', -0.2, 0.6, 0);
  r.group('pivot').rotation.z = 0.55;
  const bar = r.joint('barrel', 'pivot', 0, 0, 0);
  bar.box(1.6, 0.7, 1.0, '#6c7052', { x: 0.6 });
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) bar.cyl(0.08, 0.08, 0.05, '#15171a', { x: 1.41, y: -0.22 + row * 0.22, z: -0.33 + col * 0.22, rz: -HALF_PI });
  bar.box(1.62, 0.1, 1.02, t.main, { x: 0.6, y: 0.3 });
  r.joint('muzzle', 'barrel', 1.45, 0, 0);
}, 'aim', 0.12);

// ─── Intelligence ───────────────────────────────────────────────────────────

const laserTurret = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.5, 0.65, 0.4, '#e4e8ee', { y: 0.2, seg: 8, m: 0.3, r: 0.3 });
  b.torus(0.58, 0.04, t.glow, { y: 0.4, rx: HALF_PI, e: 2.5 });
  const pv = r.joint('pivot', 'base', 0, 0.85, 0);
  pv.sphere(0.45, '#e4e8ee', { s: [1.2, 0.9, 1], m: 0.3, r: 0.25 });
  pv.box(0.5, 0.06, 0.9, '#23272f', { y: 0.1 });
  const bar = r.joint('barrel', 'pivot', 0.3, 0, 0);
  bar.cyl(0.14, 0.2, 0.7, '#23272f', { x: 0.35, rz: -HALF_PI, m: 0.6, r: 0.3 });
  bar.cyl(0.13, 0.13, 0.03, t.glow, { x: 0.71, rz: -HALF_PI, e: 4 });
  r.joint('muzzle', 'barrel', 0.74, 0, 0);
}, 'aim', 0.05);

const railgunTurret = T((r, t) => {
  const b = r.joint('base', null);
  b.box(1.0, 0.5, 1.0, '#23272f', { y: 0.25, m: 0.6, r: 0.3 });
  const pv = r.joint('pivot', 'base', 0, 0.9, 0);
  pv.box(0.8, 0.5, 0.7, '#e4e8ee', { m: 0.3, r: 0.3 });
  const bar = r.joint('barrel', 'pivot', 0.2, 0, 0);
  bar.box(2.4, 0.08, 0.1, '#b8c0c9', { x: 1.1, y: 0.12, ...METAL });
  bar.box(2.4, 0.08, 0.1, '#b8c0c9', { x: 1.1, y: -0.12, ...METAL });
  for (let i = 0; i < 6; i++) bar.box(0.07, 0.34, 0.2, t.glow, { x: 0.2 + i * 0.38, e: 2.2 });
  r.joint('muzzle', 'barrel', 2.35, 0, 0);
}, 'aim', 0.3);

const teslaNode = T((r, t) => {
  const b = r.joint('base', null);
  b.cyl(0.4, 0.6, 0.5, '#23272f', { y: 0.25, seg: 8, m: 0.6, r: 0.3 });
  b.cyl(0.12, 0.2, 1.4, '#b8c0c9', { y: 1.1, ...METAL });
  for (let i = 0; i < 4; i++) b.torus(0.3 - i * 0.04, 0.05, '#c98a3a', { y: 0.6 + i * 0.3, rx: HALF_PI, ...METAL });
  b.torus(0.62, 0.04, t.glow, { y: 0.5, rx: HALF_PI, e: 2 });
  r.joint('pivot', 'base', 0, 0, 0);
  const orb = r.joint('orb', 'pivot', 0, 2.0, 0);
  orb.ico(0.3, t.glow, { e: 3.5, detail: 1 });
  orb.torus(0.42, 0.03, '#ffffff', { rx: 1.1, e: 2 });
  r.joint('muzzle', 'orb', 0, 0, 0);
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
  private pitch = 0;
  private spinSpeed = 0;
  private spinAngle = 0;

  constructor(readonly template: TurretTemplate) {
    this.root = template.object.clone(true);
    this.pivot = this.root.getObjectByName('pivot');
    this.barrel = this.root.getObjectByName('barrel');
    this.arm = this.root.getObjectByName('arm');
    this.spin = this.root.getObjectByName('spin');
    this.orb = this.root.getObjectByName('orb');
    this.muzzle = this.root.getObjectByName('muzzle');
    this.restPitch = this.pivot?.rotation.z ?? 0;
    this.barrelX = this.barrel?.position.x ?? 0;
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  /** @param aim pitch toward the target (radians), @param fireAge seconds since the last shot. */
  animate(aim: number, fireAge: number, t: number, dt: number): void {
    const anim = this.template.anim;
    if (this.pivot && (anim === 'aim' || anim === 'spin' || anim === 'hen')) {
      const target = anim === 'aim' && this.restPitch !== 0 ? this.restPitch + aim * 0.3 : aim;
      this.pitch += (target - this.pitch) * Math.min(1, dt * 6);
      this.pivot.rotation.z = this.pitch;
    }
    const recoil = fireAge < 0.25 ? 1 - fireAge / 0.25 : 0;
    if (this.barrel) this.barrel.position.x = this.barrelX - recoil * this.template.kick;
    if (anim === 'hen' && this.barrel) {
      this.barrel.rotation.z = Math.sin(t * 9) * 0.08 + recoil * 0.5;
      if (this.pivot) this.pivot.position.y = 0.45 + Math.abs(Math.sin(t * 4)) * 0.05;
    }
    if (anim === 'catapult' && this.arm) {
      // Swing forward on release, then winch back down.
      const swing = fireAge < 0.2 ? fireAge / 0.2 : Math.max(0, 1 - (fireAge - 0.2) / 1.2);
      this.arm.rotation.z = 0.2 - swing * 1.8;
    }
    if (anim === 'spin' && this.spin) {
      this.spinSpeed += ((fireAge < 0.5 ? 40 : 0) - this.spinSpeed) * Math.min(1, dt * 3);
      this.spinAngle += this.spinSpeed * dt;
      this.spin.rotation.x = this.spinAngle;
    }
    if (anim === 'pulse' && this.orb) {
      const k = 1 + Math.sin(t * 4) * 0.08 + recoil * 0.5;
      this.orb.scale.setScalar(k);
      this.orb.rotation.y = t * 2;
    }
  }
}
