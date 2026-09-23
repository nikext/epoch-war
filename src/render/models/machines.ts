import { Part, RigBuilder, shade, type ColorLike } from '../kit/builder';
import * as G from './gear';
import { C } from './gear';
import { humanoid } from './humanoid';
import type { ModelTemplate } from './rig';
import { finish, type Team } from './team';

const HALF_PI = Math.PI / 2;
const METAL = G.tex.METAL;

function wheel(p: Part, r: number, rim: ColorLike, spokes: ColorLike, width = 0.08, n = 8): void {
  p.torus(r, width * 0.6, rim, { rs: 5, ts: 16 });
  for (let i = 0; i < n; i++) p.box(0.05, r * 1.9, 0.04, spokes, { rz: (i / n) * Math.PI });
  p.cyl(r * 0.18, r * 0.18, width * 1.8, rim, { rx: HALF_PI, ...METAL });
}

function roadWheel(p: Part, r: number, color: ColorLike): void {
  p.cyl(r, r, 0.14, color, { rx: HALF_PI, seg: 10 });
  p.cyl(r * 0.45, r * 0.45, 0.16, shade(color, 0.25), { rx: HALF_PI, seg: 8, ...METAL });
}

// ─── Gunpowder: field cannon and its gunner ─────────────────────────────────

export function fieldCannon(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const hull = rig.joint('hull', null);
  hull.box(1.7, 0.14, 0.2, C.wood, { x: -0.55, y: 0.42, rz: 0.3 });
  hull.box(0.95, 0.34, 0.07, C.wood, { x: 0.1, y: 0.68, z: 0.2 });
  hull.box(0.95, 0.34, 0.07, C.wood, { x: 0.1, y: 0.68, z: -0.2 });
  hull.cyl(0.06, 0.06, 1.0, C.iron, { x: 0.1, y: 0.55, rx: HALF_PI, ...METAL });
  hull.box(0.3, 0.1, 0.36, t.main, { x: -0.3, y: 0.75 });
  for (const [i, z] of [[0, 0.45], [1, -0.45]] as const) {
    const w = rig.joint(`wheel${i}`, 'hull', 0.1, 0.55, z);
    wheel(w, 0.52, C.woodDark, C.wood);
  }
  const barrel = rig.joint('barrel', 'hull', 0.15, 0.9, 0);
  barrel.cyl(0.12, 0.17, 1.55, C.bronze, { x: 0.45, rz: -HALF_PI, seg: 10, ...METAL });
  barrel.torus(0.14, 0.03, C.bronze, { x: 1.2, ry: HALF_PI, ...METAL });
  barrel.torus(0.17, 0.03, C.bronze, { x: -0.2, ry: HALF_PI, ...METAL });
  barrel.sphere(0.1, C.bronze, { x: -0.38, ...METAL });
  rig.joint('muzzle', 'barrel', 1.25, 0, 0);

  humanoid(
    rig,
    { skin: '#e2ab85', shirt: t.main, pants: '#ebe5d6', boots: C.black, sleeves: t.main },
    {
      head: (p) => G.tricorn(p, C.gold),
      torso: (p) => p.box(0.34, 0.07, 0.5, '#f4f1ea', { y: 0.35, rx: 0.7 }),
      weaponN: (p) => {
        p.cyl(0.025, 0.025, 1.4, C.wood, { y: 0.1 });
        p.sphere(0.05, '#ffb347', { y: 0.82, e: 3 });
      },
    },
    { prefix: 'r', x: -1.25, z: 0.25 },
  );
  return finish(rig, { kind: 'crewed', style: 'cast', height: 2.3, strideLength: 3.3, recoil: 0.45 });
}

// ─── Industrial: landship and biplane ───────────────────────────────────────

export function landship(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const steel = '#6d6644';
  const hull = rig.joint('hull', null);
  const profile: [number, number][] = [[-2.1, 0.15], [1.2, 0.15], [2.25, 1.0], [1.75, 1.95], [-1.6, 1.95], [-2.2, 1.2]];
  for (const z of [0.78, -0.78]) {
    hull.extrude(profile, 0.42, '#4f4a33', { z });
    hull.extrude(profile.map(([x, y]) => [x * 0.9, 0.2 + (y - 0.2) * 0.85] as [number, number]), 0.44, steel, { z, x: 0.02 });
  }
  hull.box(3.1, 1.25, 1.2, steel, { x: -0.1, y: 1.15 });
  hull.box(1.0, 0.5, 0.9, shade(steel, 0.1), { x: 0.3, y: 2.0 });
  hull.cyl(0.08, 0.1, 0.9, C.black, { x: -1.1, y: 2.3 });
  for (const z of [1.02, -1.02]) {
    hull.box(1.0, 0.7, 0.3, shade(steel, 0.05), { x: 0.2, y: 1.05, z });
    hull.cyl(0.24, 0.24, 0.05, t.main, { x: 0.2, y: 1.05, z: z + Math.sign(z) * 0.16, rx: HALF_PI, seg: 12 });
    hull.cyl(0.12, 0.12, 0.06, '#f2eee4', { x: 0.2, y: 1.05, z: z + Math.sign(z) * 0.17, rx: HALF_PI, seg: 12 });
  }
  hull.box(2.6, 0.12, 0.05, t.main, { x: -0.2, y: 1.72, z: 1.0 });
  for (let i = 0; i < 6; i++) {
    const w = rig.joint(`wheel${i}`, 'hull', -1.5 + i * 0.55, 0.42, 1.0);
    roadWheel(w, 0.22, '#3a3726');
  }
  const barrel = rig.joint('barrel', 'hull', 0.55, 1.1, 1.18);
  barrel.cyl(0.07, 0.08, 0.9, C.gunmetal, { x: 0.4, rz: -HALF_PI, ...METAL });
  rig.joint('muzzle', 'barrel', 0.9, 0, 0);
  return finish(rig, { kind: 'vehicle', style: 'gun', height: 2.9, strideLength: 3, recoil: 0.35 });
}

export function biplane(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const body = rig.joint('body', null);
  body.cyl(0.3, 0.13, 2.5, t.main, { x: -0.3, rz: HALF_PI, seg: 8 });
  body.cyl(0.33, 0.3, 0.4, '#8d8f93', { x: 0.95, rz: HALF_PI, seg: 8, ...METAL });
  body.box(0.85, 0.07, 3.4, '#e9e1c8', { x: 0.25, y: 0.62 });
  body.box(0.8, 0.07, 3.0, '#e9e1c8', { x: 0.3, y: -0.22 });
  for (const z of [1.3, -1.3, 0.45, -0.45]) body.cyl(0.02, 0.02, 0.84, C.woodDark, { x: 0.3, y: 0.2, z });
  for (const z of [1.2, -1.2]) {
    body.cyl(0.3, 0.3, 0.02, t.main, { x: 0.25, y: 0.66, z, seg: 14 });
    body.cyl(0.18, 0.18, 0.025, '#f1ece0', { x: 0.25, y: 0.665, z, seg: 14 });
    body.cyl(0.08, 0.08, 0.03, t.dark, { x: 0.25, y: 0.67, z, seg: 10 });
  }
  body.box(0.5, 0.05, 1.2, '#e9e1c8', { x: -1.45, y: 0.05 });
  body.box(0.45, 0.55, 0.05, t.main, { x: -1.5, y: 0.3 });
  body.sphere(0.16, '#d9a57f', { x: 0.1, y: 0.35 });
  body.dome(0.17, C.leather, { x: 0.1, y: 0.38 });
  body.box(0.05, 0.05, 0.22, '#9fe', { x: 0.24, y: 0.4, e: 0.6 });
  body.box(0.08, 0.03, 0.4, t.light, { x: -0.05, y: 0.33, rz: 0.3 });
  body.cyl(0.03, 0.03, 0.6, C.black, { x: 0.65, y: 0.34, z: 0.12, rz: HALF_PI, ...METAL });
  body.cyl(0.03, 0.03, 0.6, C.black, { x: 0.65, y: 0.34, z: -0.12, rz: HALF_PI, ...METAL });
  body.cyl(0.03, 0.03, 0.45, C.black, { x: 0.4, y: -0.45, z: 0.35, rz: 0.3 });
  body.cyl(0.03, 0.03, 0.45, C.black, { x: 0.4, y: -0.45, z: -0.35, rz: 0.3 });
  body.cyl(0.14, 0.14, 0.06, C.black, { x: 0.45, y: -0.66, z: 0.36, rx: HALF_PI });
  body.cyl(0.14, 0.14, 0.06, C.black, { x: 0.45, y: -0.66, z: -0.36, rx: HALF_PI });
  const prop = rig.joint('prop', 'body', 1.18, 0, 0);
  prop.box(0.05, 1.5, 0.12, C.woodDark);
  prop.cone(0.1, 0.18, '#8d8f93', { x: 0.08, rz: -HALF_PI, ...METAL });
  rig.joint('muzzle', 'body', 0.98, 0.34, 0.12);
  return finish(rig, { kind: 'flyer', style: 'gun', height: 1.3, strideLength: 3, bob: 0.3 });
}

// ─── Modern: battle tank and gunship ────────────────────────────────────────

export function battleTank(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const armor = '#998f70';
  const dark = '#5d5745';
  const hull = rig.joint('hull', null);
  hull.extrude([[-2.2, 0.55], [2.1, 0.55], [2.35, 0.95], [1.9, 1.2], [-2.15, 1.2]], 1.7, armor, {});
  for (const z of [0.95, -0.95]) {
    hull.box(4.4, 0.72, 0.5, '#2e2c26', { y: 0.46, z });
    hull.box(4.5, 0.12, 0.62, dark, { y: 0.9, z });
  }
  hull.box(1.4, 0.05, 0.05, t.main, { x: -0.8, y: 1.0, z: 1.27, e: 0.25 });
  for (let i = 0; i < 7; i++) {
    const w = rig.joint(`wheel${i}`, 'hull', -1.75 + i * 0.58, 0.4, 1.2);
    roadWheel(w, 0.25, '#44423a');
  }
  const turret = rig.joint('turret', 'hull', -0.2, 1.2, 0);
  turret.extrude([[-1.3, 0], [-1.35, 0.5], [0.55, 0.62], [1.2, 0.34], [1.1, 0]], 1.6, armor, {});
  turret.box(0.9, 0.1, 1.6, dark, { x: -0.7, y: 0.55 });
  turret.cyl(0.18, 0.2, 0.2, dark, { x: -0.3, y: 0.7, z: 0.4 });
  turret.cyl(0.02, 0.02, 1.5, C.black, { x: -1.0, y: 1.3, z: -0.5, rz: 0.15 });
  turret.box(0.8, 0.12, 0.05, t.main, { x: 0.0, y: 0.35, z: 0.81, e: 0.3 });
  turret.box(0.26, 0.2, 0.3, C.black, { x: 0.35, y: 0.72, z: -0.4 });
  turret.box(0.08, 0.08, 0.05, t.glow, { x: 0.48, y: 0.72, z: -0.4, e: 2 });
  const barrel = rig.joint('barrel', 'turret', 1.0, 0.32, 0);
  barrel.cyl(0.1, 0.11, 2.9, dark, { x: 1.45, rz: -HALF_PI, seg: 10, ...METAL });
  barrel.cyl(0.15, 0.15, 0.5, dark, { x: 1.4, rz: -HALF_PI, seg: 10, ...METAL });
  barrel.cyl(0.13, 0.13, 0.22, C.black, { x: 2.85, rz: -HALF_PI, seg: 10, ...METAL });
  rig.joint('muzzle', 'barrel', 2.95, 0, 0);
  return finish(rig, { kind: 'vehicle', style: 'gun', height: 3.2, strideLength: 3, recoil: 0.5 });
}

export function gunship(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const olive = '#4f5842';
  const body = rig.joint('body', null);
  body.capsule(0.42, 1.6, olive, { rz: HALF_PI, s: [1, 1, 0.75] });
  body.cyl(0.26, 0.1, 2.6, olive, { x: -2.1, y: 0.15, rz: HALF_PI });
  body.box(0.5, 0.8, 0.06, t.main, { x: -3.3, y: 0.5, rz: 0.3 });
  body.box(0.55, 0.05, 0.9, olive, { x: -3.2, y: 0.2 });
  body.sphere(0.4, '#9fd7ff', { x: 0.75, y: 0.25, s: [1.1, 0.7, 0.7], e: 0.25, r: 0.1, m: 0.3 });
  body.box(0.5, 0.35, 0.5, olive, { x: 0.1, y: 0.4 });
  body.box(0.8, 0.06, 2.2, olive, { x: -0.1, y: -0.12 });
  for (const z of [1.0, -1.0]) {
    body.cyl(0.13, 0.13, 0.8, '#2b2f25', { x: -0.05, y: -0.3, z, rz: HALF_PI, seg: 8 });
    body.cyl(0.13, 0.13, 0.02, t.main, { x: 0.36, y: -0.3, z, rz: HALF_PI, e: 0.4 });
  }
  body.cyl(0.05, 0.05, 0.6, C.black, { x: 1.2, y: -0.38, rz: HALF_PI, ...METAL });
  body.box(1.2, 0.08, 0.05, t.main, { x: -1.3, y: 0.28, z: 0.25, e: 0.3 });
  body.box(0.05, 0.3, 0.8, C.black, { x: 0.6, y: -0.55 });
  const rotor = rig.joint('rotor', 'body', 0.1, 0.72, 0);
  rotor.cyl(0.06, 0.06, 0.3, C.black, { y: -0.1 });
  for (let i = 0; i < 4; i++) rotor.box(3.4, 0.03, 0.2, '#2b2f25', { ry: (i * Math.PI) / 2 + 0.3, x: 0 });
  const tail = rig.joint('tailRotor', 'body', -3.35, 0.45, 0.1);
  tail.box(0.06, 0.9, 0.1, '#2b2f25');
  tail.box(0.9, 0.06, 0.1, '#2b2f25');
  rig.joint('muzzle', 'body', 0.4, -0.3, 1.0);
  return finish(rig, { kind: 'flyer', style: 'gun', height: 1.5, strideLength: 3, bob: 0.35 });
}

// ─── Age of Intelligence ────────────────────────────────────────────────────

export function roboHound(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const shell = '#e3e6ea';
  const frame = '#30343a';
  const m = rig.joint('mount', null);
  m.box(1.05, 0.28, 0.42, shell, { y: 0.8, m: 0.25, r: 0.35 });
  m.box(0.9, 0.08, 0.44, frame, { y: 0.64, m: 0.6, r: 0.4 });
  m.box(0.7, 0.04, 0.02, t.glow, { y: 0.82, z: 0.215, e: 3 });
  m.box(0.7, 0.04, 0.02, t.glow, { y: 0.82, z: -0.215, e: 3 });
  m.box(0.3, 0.06, 0.3, frame, { x: -0.3, y: 0.97 });
  m.cyl(0.015, 0.015, 0.5, frame, { x: -0.42, y: 1.2, rz: 0.3 });
  m.sphere(0.03, t.glow, { x: -0.49, y: 1.44, e: 3 });
  rig.joint('mNeck', 'mount', 0.55, 0.88, 0).box(0.14, 0.12, 0.2, frame);
  const h = rig.joint('mHead', 'mNeck', 0.12, 0.02, 0);
  h.box(0.36, 0.2, 0.28, shell, { x: 0.12, m: 0.25, r: 0.35 });
  h.box(0.05, 0.07, 0.26, t.glow, { x: 0.3, y: 0.03, e: 3.5 });
  h.box(0.2, 0.05, 0.22, frame, { x: 0.22, y: -0.12 });
  for (let i = 0; i < 3; i++) h.cone(0.03, 0.1, C.steel, { x: 0.32, y: -0.16, z: -0.07 + i * 0.07, rz: Math.PI, ...METAL });
  const legs: [string, string, number, number, number][] = [
    ['mLegFN', 'mKneeFN', 0.42, 0.25, 1],
    ['mLegFF', 'mKneeFF', 0.42, -0.25, 1],
    ['mLegBN', 'mKneeBN', -0.42, 0.25, -1],
    ['mLegBF', 'mKneeBF', -0.42, -0.25, -1],
  ];
  for (const [leg, knee, x, z, dir] of legs) {
    const l = rig.joint(leg, 'mount', x, 0.72, z);
    l.sphere(0.08, frame, { m: 0.6, r: 0.4 });
    l.box(0.1, 0.4, 0.1, shell, { y: -0.18, m: 0.25, r: 0.35 });
    rig.group(leg).rotation.z = 0.45 * dir;
    const k = rig.joint(knee, leg, 0, -0.38, 0);
    k.sphere(0.06, frame, { m: 0.6, r: 0.4 });
    k.box(0.07, 0.4, 0.07, frame, { y: -0.2, m: 0.5, r: 0.4 });
    k.sphere(0.07, '#15171a', { y: -0.42 });
    rig.group(knee).rotation.z = -0.9 * dir;
  }
  return finish(rig, { kind: 'beast', style: 'swing', height: 1.6, strideLength: 1.5 });
}

export function wardenMech(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const plate = '#56606b';
  const frame = '#2a2e34';
  rig.joint('body', null);
  const torso = rig.joint('torso', 'body', 0, 3.0, 0);
  torso.extrude([[-0.9, -0.3], [0.8, -0.35], [1.1, 0.25], [0.7, 0.85], [-0.8, 0.9]], 1.5, plate, { m: 0.5, r: 0.35 });
  torso.box(0.6, 0.35, 1.2, frame, { x: -0.1, y: -0.45 });
  torso.box(0.3, 0.22, 0.9, '#8ad8ff', { x: 0.95, y: 0.4, e: 0.35, r: 0.1, m: 0.2 });
  torso.cyl(0.18, 0.18, 0.06, t.glow, { x: 1.0, y: 0.05, rz: HALF_PI, e: 3.5 });
  torso.box(1.2, 0.12, 0.04, t.main, { x: -0.05, y: 0.55, z: 0.76, e: 0.4 });
  torso.box(0.7, 0.6, 0.5, frame, { x: -0.9, y: 0.35 });
  for (let i = 0; i < 3; i++) torso.box(0.06, 0.4, 0.4, t.glow, { x: -1.27, y: 0.35, z: -0.14 + i * 0.14, e: 1.5 });
  const guns = rig.joint('guns', 'torso', 0.1, 0.55, 0);
  for (const z of [0.95, -0.95]) {
    guns.box(0.8, 0.45, 0.4, plate, { z, m: 0.5, r: 0.35 });
    guns.cyl(0.11, 0.13, 1.4, frame, { x: 0.9, z, rz: -HALF_PI, ...METAL });
    guns.cyl(0.08, 0.08, 0.1, t.glow, { x: 1.62, z, rz: -HALF_PI, e: 4 });
  }
  rig.joint('muzzle', 'guns', 1.65, 0, 0.95);
  for (const [near, z] of [[true, 0.55], [false, -0.55]] as const) {
    const leg = rig.joint(near ? 'legN' : 'legF', 'body', 0, 2.75, z);
    leg.sphere(0.3, frame, { m: 0.6, r: 0.4 });
    leg.box(0.45, 1.3, 0.4, plate, { x: 0.05, y: -0.65, m: 0.5, r: 0.35 });
    leg.box(0.05, 0.9, 0.05, t.main, { x: 0.29, y: -0.65, z: near ? 0.2 : -0.2, e: 0.3 });
    rig.group(near ? 'legN' : 'legF').rotation.z = 0.35;
    const knee = rig.joint(near ? 'kneeN' : 'kneeF', near ? 'legN' : 'legF', 0.05, -1.3, 0);
    knee.sphere(0.25, frame, { m: 0.6, r: 0.4 });
    knee.box(0.35, 1.35, 0.32, frame, { y: -0.65, m: 0.6, r: 0.4 });
    knee.cyl(0.08, 0.08, 1.1, C.steel, { x: -0.2, y: -0.6, ...METAL });
    rig.group(near ? 'kneeN' : 'kneeF').rotation.z = -0.75;
    const foot = rig.joint(near ? 'footN' : 'footF', near ? 'kneeN' : 'kneeF', 0, -1.35, 0);
    foot.box(1.0, 0.22, 0.55, plate, { x: 0.2, y: -0.1, m: 0.5, r: 0.35 });
    foot.box(0.3, 0.2, 0.5, frame, { x: -0.35, y: -0.1 });
    rig.group(near ? 'footN' : 'footF').rotation.z = 0.4;
  }
  return finish(rig, { kind: 'walker', style: 'gun', height: 4.9, strideLength: 3.4 });
}

export function swarm(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const body = rig.joint('body', null);
  body.ico(0.2, t.glow, { e: 3 });
  body.torus(0.35, 0.02, t.glow, { rx: HALF_PI, e: 2 });
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996;
    const r = 0.5 + ((i * 7) % 11) / 11;
    const d = rig.joint(`d${i}`, 'body', Math.cos(a) * r * 1.1, Math.sin(i * 1.7) * 0.55, Math.sin(a) * r * 0.8);
    d.ico(0.1, '#2a2f36', { m: 0.6, r: 0.35, s: [1.3, 0.6, 1.3] });
    d.box(0.02, 0.02, 0.3, '#1b1e22', { rx: 0 });
    d.box(0.3, 0.02, 0.02, '#1b1e22');
    d.sphere(0.04, t.glow, { y: 0.05, e: 4 });
  }
  return finish(rig, { kind: 'swarm', style: 'gun', height: 1.3, strideLength: 3 });
}

export function omega(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const hull = '#1e2229';
  const plate = '#343b45';
  const body = rig.joint('body', null);
  body.cyl(2.3, 2.3, 0.04, t.glow, { y: 0.05, seg: 24, e: 0.6 });
  body.torus(2.3, 0.05, t.glow, { y: 0.07, rx: HALF_PI, ts: 32, e: 2 });
  const core = rig.joint('core', 'body', 0, 3.6, 0);
  core.ico(1.55, hull, { detail: 1, m: 0.7, r: 0.3 });
  core.ico(1.35, plate, { detail: 0, m: 0.6, r: 0.35, s: [1.12, 1.02, 1.12] });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    core.box(0.05, 1.6, 0.05, t.glow, { x: Math.cos(a) * 1.5, z: Math.sin(a) * 1.5, rz: Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35, e: 3 });
  }
  core.cone(0.5, 1.2, plate, { y: 1.75, m: 0.6, r: 0.35, seg: 6 });
  core.cone(0.5, 1.2, plate, { y: -1.75, rz: Math.PI, m: 0.6, r: 0.35, seg: 6 });
  core.sphere(0.12, t.glow, { y: 2.4, e: 4 });
  const eye = rig.joint('eye', 'core', 1.35, 0.05, 0);
  eye.cyl(0.62, 0.7, 0.3, hull, { rz: HALF_PI, seg: 16, m: 0.7, r: 0.3 });
  eye.sphere(0.5, t.glow, { x: 0.1, e: 4, s: [0.6, 1, 1] });
  eye.sphere(0.2, '#ffffff', { x: 0.3, e: 6 });
  eye.torus(0.62, 0.05, t.glow, { x: 0.18, ry: HALF_PI, e: 2.5, ts: 20 });
  rig.joint('muzzle', 'eye', 0.45, 0, 0);
  for (let i = 0; i < 3; i++) {
    const r = rig.joint(`ring${i}`, 'core', 0, 0, 0);
    r.torus(2.1 + i * 0.45, 0.045 + i * 0.01, i === 1 ? '#e8ecf2' : t.glow, { ts: 40, rs: 4, e: i === 1 ? 0.3 : 2.2, m: 0.6 });
    rig.group(`ring${i}`).rotation.set(0.4 + i * 0.7, i * 0.9, 0.3 * i);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const s = rig.joint(`shard${i}`, 'body', Math.cos(a) * 3.1, 3.6 + Math.sin(i * 2.1) * 1.1, Math.sin(a) * 2.2);
    s.cone(0.22, 0.6, '#cfd8e6', { y: 0.3, seg: 4, m: 0.3, r: 0.2, e: 0.2 });
    s.cone(0.22, 0.6, '#cfd8e6', { y: -0.3, rz: Math.PI, seg: 4, m: 0.3, r: 0.2, e: 0.2 });
    s.sphere(0.06, t.glow, { e: 4 });
  }
  for (const [name, z] of [['clawN', 2.0], ['clawF', -2.0]] as const) {
    const c = rig.joint(name, 'body', 0.6, 2.0, z);
    c.box(0.5, 0.5, 0.5, plate, { m: 0.6, r: 0.35 });
    c.sphere(0.12, t.glow, { x: 0.26, e: 3 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      c.box(0.7, 0.1, 0.1, hull, { x: 0.5, y: Math.cos(a) * 0.2, z: Math.sin(a) * 0.2, rz: -0.2 * Math.cos(a), m: 0.6 });
    }
  }
  return finish(rig, { kind: 'hover', style: 'gun', height: 6.8, strideLength: 4, bob: 0.35 });
}
