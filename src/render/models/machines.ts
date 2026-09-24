import { Part, RigBuilder, shade, type ColorLike } from '../kit/builder';
import * as G from './gear';
import { C } from './gear';
import { humanoid } from './humanoid';
import type { ModelTemplate } from './rig';
import { finish, type Team } from './team';

const HALF_PI = Math.PI / 2;
const METAL = G.tex.METAL;

function wheel(p: Part, r: number, rim: ColorLike, spokes: ColorLike, width = 0.08, n = 8): void {
  p.torus(r, width * 0.6, rim, { rs: 5, ts: 18 });
  p.torus(r * 1.02, width * 0.35, C.iron, { rs: 4, ts: 18, ...METAL });
  for (let i = 0; i < n; i++) p.block(0.05, r * 1.9, 0.04, spokes, { rz: (i / n) * Math.PI, bevel: 0.01 });
  p.cyl(r * 0.2, r * 0.2, width * 1.8, rim, { rx: HALF_PI, seg: 8, ...METAL });
  p.cyl(r * 0.1, r * 0.1, width * 2.4, C.iron, { rx: HALF_PI, seg: 6, ...METAL });
}

function roadWheel(p: Part, r: number, color: ColorLike): void {
  p.cyl(r, r, 0.14, color, { rx: HALF_PI, seg: 12 });
  p.cyl(r * 0.8, r * 0.8, 0.16, shade(color, -0.2), { rx: HALF_PI, seg: 12 });
  p.cyl(r * 0.42, r * 0.42, 0.18, shade(color, 0.25), { rx: HALF_PI, seg: 8, ...METAL });
  for (let i = 0; i < 4; i++) p.box(0.04, r * 1.5, 0.02, shade(color, 0.1), { z: 0.08, rz: (i / 4) * Math.PI });
}

/**
 * Track plates that run around a loop (clockwise, as seen from the near
 * side): one joint per plate, carrying the plate on both sides of the hull.
 * The vehicle animator moves them along the loop as the vehicle drives.
 */
function treads(rig: RigBuilder, loop: [number, number][], count: number, z: number, width: number, color: ColorLike): void {
  let perimeter = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i]!;
    const [x1, y1] = loop[(i + 1) % loop.length]!;
    perimeter += Math.hypot(x1 - x0, y1 - y0);
  }
  // Plates just overlap, so the belt reads as continuous around the bends.
  const len = (perimeter / count) * 1.08;
  for (let i = 0; i < count; i++) {
    const tr = rig.joint(`tread${i}`, 'hull', 0, 0, 0);
    for (const s of [1, -1]) {
      tr.block(len, 0.06, width, color, { y: 0.03, z: s * z, bevel: 0.012, m: 0.5, r: 0.55 });
      tr.block(len * 0.3, 0.035, width * 0.9, shade(color, -0.3), { y: 0.07, z: s * z, bevel: 0.008, m: 0.5, r: 0.55 });
    }
  }
}

// ─── Gunpowder: field cannon and its gunner ─────────────────────────────────

export function fieldCannon(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const hull = rig.joint('hull', null);
  // Carriage: cheeks, trail and spade, an axle and an ammunition box.
  hull.block(1.8, 0.16, 0.22, C.wood, { x: -0.6, y: 0.42, rz: 0.3, bevel: 0.03 });
  hull.block(0.2, 0.24, 0.3, C.woodDark, { x: -1.42, y: 0.1, rz: 0.3, bevel: 0.03 });
  hull.block(0.1, 0.06, 0.34, C.iron, { x: -1.5, y: 0.04, ...METAL });
  for (const z of [0.2, -0.2]) {
    hull.extrude([[-0.5, 0], [0.5, 0], [0.45, 0.28], [0.1, 0.38], [-0.5, 0.2]], 0.07, C.wood, { x: 0.1, y: 0.52, z, bevel: 0.01 });
    for (let i = 0; i < 3; i++) hull.sphere(0.02, C.iron, { x: -0.25 + i * 0.3, y: 0.64, z: z * 1.25, ...METAL });
  }
  hull.cyl(0.06, 0.06, 1.0, C.iron, { x: 0.1, y: 0.55, rx: HALF_PI, seg: 8, ...METAL });
  hull.block(0.3, 0.1, 0.36, t.main, { x: -0.3, y: 0.78, bevel: 0.02 });
  hull.block(0.4, 0.26, 0.3, C.woodDark, { x: -0.95, y: 0.72, rz: 0.3, bevel: 0.03 });
  for (let i = 0; i < 3; i++) hull.sphere(0.07, C.gunmetal, { x: -1.05 + i * 0.1, y: 0.9 + i * 0.03, z: 0.05 * (i - 1), ...METAL });
  for (const [i, z] of [[0, 0.45], [1, -0.45]] as const) {
    const w = rig.joint(`wheel${i}`, 'hull', 0.1, 0.55, z);
    wheel(w, 0.52, C.woodDark, C.wood);
  }
  const barrel = rig.joint('barrel', 'hull', 0.15, 0.9, 0);
  barrel.cyl(0.12, 0.17, 1.55, C.bronze, { x: 0.45, rz: -HALF_PI, seg: 12, ...METAL });
  barrel.torus(0.14, 0.03, C.bronze, { x: 1.2, ry: HALF_PI, ...METAL });
  barrel.torus(0.155, 0.03, C.bronze, { x: 0.6, ry: HALF_PI, ...METAL });
  barrel.torus(0.17, 0.035, C.bronze, { x: -0.2, ry: HALF_PI, ...METAL });
  barrel.cyl(0.03, 0.03, 0.36, C.bronze, { x: 0.1, y: 0.16, rx: HALF_PI, seg: 6, ...METAL });
  barrel.sphere(0.1, C.bronze, { x: -0.38, ...METAL });
  barrel.sphere(0.05, C.bronze, { x: -0.5, ...METAL });
  barrel.cyl(0.08, 0.08, 0.02, '#1a1612', { x: 1.235, rz: -HALF_PI, seg: 10 });
  rig.joint('muzzle', 'barrel', 1.25, 0, 0);

  humanoid(
    rig,
    { skin: '#e2ab85', shirt: t.main, pants: '#ebe5d6', boots: C.black, sleeves: t.main, hair: '#6b4a2b', belt: C.black },
    {
      head: (p) => G.tricorn(p, C.gold),
      torso: (p) => {
        p.block(0.34, 0.07, 0.5, '#f4f1ea', { y: 0.35, rx: 0.7, bevel: 0.015 });
        p.block(0.05, 0.55, 0.14, shade(t.main, -0.35), { x: 0.16, y: 0.3 });
        for (let i = 0; i < 4; i++) p.sphere(0.02, C.gold, { x: 0.18, y: 0.14 + i * 0.1, z: 0.09, ...METAL });
      },
      shin: (p) => p.block(0.18, 0.3, 0.18, C.black, { y: -0.14, bevel: 0.03 }),
      weaponN: (p) => {
        p.cyl(0.025, 0.025, 1.4, C.wood, { y: 0.1, seg: 6 });
        p.torus(0.04, 0.012, C.iron, { y: 0.78, rx: HALF_PI, ...METAL });
        p.sphere(0.05, '#ffb347', { y: 0.82, e: 3 });
      },
    },
    { prefix: 'r', x: -1.25, z: 0.25 },
  );
  return finish(rig, { kind: 'crewed', style: 'cast', height: 2.3, strideLength: 3.3, recoil: 0.45 });
}

// ─── Industrial: landship and biplane ───────────────────────────────────────

const LANDSHIP_LOOP: [number, number][] = [[-1.6, 2.0], [1.78, 2.0], [2.32, 1.0], [1.22, 0.08], [-2.12, 0.08], [-2.26, 1.2]];

export function landship(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const steel = '#6d6644';
  const hull = rig.joint('hull', null);
  const profile: [number, number][] = [[-2.1, 0.15], [1.2, 0.15], [2.25, 1.0], [1.75, 1.95], [-1.6, 1.95], [-2.2, 1.2]];
  for (const z of [0.78, -0.78]) {
    hull.extrude(profile, 0.4, '#3d3926', { z });
    hull.extrude(profile.map(([x, y]) => [x * 0.88, 0.25 + (y - 0.25) * 0.8] as [number, number]), 0.46, steel, { z, x: 0.02, bevel: 0.02 });
    for (let i = 0; i < 9; i++) hull.sphere(0.03, shade(steel, -0.3), { x: -1.6 + i * 0.4, y: 1.62, z: z + Math.sign(z) * 0.24, ...METAL });
  }
  hull.block(3.1, 1.25, 1.2, steel, { x: -0.1, y: 1.15, bevel: 0.05 });
  hull.block(1.0, 0.5, 0.9, shade(steel, 0.1), { x: 0.3, y: 2.0, bevel: 0.05 });
  for (let i = 0; i < 3; i++) hull.block(0.12, 0.04, 0.5, '#1a1a14', { x: 0.55, y: 2.1 - i * 0.1, z: 0.46 });
  hull.cyl(0.08, 0.1, 0.9, C.black, { x: -1.1, y: 2.3, seg: 8 });
  hull.cyl(0.12, 0.08, 0.1, C.black, { x: -1.1, y: 2.78, seg: 8 });
  for (const z of [1.02, -1.02]) {
    // Sponsons with the team roundel.
    hull.block(1.0, 0.7, 0.3, shade(steel, 0.05), { x: 0.2, y: 1.05, z, taper: [0.9, 1], bevel: 0.05 });
    hull.cyl(0.24, 0.24, 0.05, t.main, { x: 0.2, y: 1.05, z: z + Math.sign(z) * 0.16, rx: HALF_PI, seg: 14 });
    hull.cyl(0.12, 0.12, 0.06, '#f2eee4', { x: 0.2, y: 1.05, z: z + Math.sign(z) * 0.17, rx: HALF_PI, seg: 12 });
  }
  hull.block(2.6, 0.12, 0.05, t.main, { x: -0.2, y: 1.72, z: 1.0 });
  // Unditching beam and chains on the roof.
  hull.block(0.2, 0.2, 2.0, C.woodDark, { x: -1.3, y: 2.08, bevel: 0.04 });
  for (const z of [0.6, -0.6]) hull.tube([[-1.3, 2.1, z], [-0.9, 2.05, z], [-0.6, 2.0, z]], 0.02, C.iron, { seg: 4 });
  for (let i = 0; i < 6; i++) {
    const w = rig.joint(`wheel${i}`, 'hull', -1.5 + i * 0.55, 0.42, 1.0);
    roadWheel(w, 0.22, '#3a3726');
  }
  treads(rig, LANDSHIP_LOOP, 44, 0.78, 0.46, '#4a4530');
  const barrel = rig.joint('barrel', 'hull', 0.55, 1.1, 1.18);
  barrel.cyl(0.07, 0.08, 0.9, C.gunmetal, { x: 0.4, rz: -HALF_PI, seg: 8, ...METAL });
  barrel.cyl(0.1, 0.1, 0.12, C.gunmetal, { x: 0.02, rz: -HALF_PI, seg: 8, ...METAL });
  rig.joint('muzzle', 'barrel', 0.9, 0, 0);
  return finish(rig, { kind: 'vehicle', style: 'gun', height: 2.9, strideLength: 3, recoil: 0.35, tread: LANDSHIP_LOOP });
}

export function biplane(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const body = rig.joint('body', null);
  const wing = '#e9e1c8';
  body.cyl(0.3, 0.13, 2.5, t.main, { x: -0.3, rz: HALF_PI, seg: 10 });
  for (let i = 0; i < 4; i++) body.cyl(0.3 - i * 0.04, 0.3 - i * 0.04, 0.02, t.dark, { x: 0.4 - i * 0.5, rz: HALF_PI, seg: 10 });
  body.cyl(0.33, 0.3, 0.4, '#8d8f93', { x: 0.95, rz: HALF_PI, seg: 10, ...METAL });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    body.block(0.3, 0.06, 0.08, '#6d6f73', { x: 0.95, y: Math.cos(a) * 0.3, z: Math.sin(a) * 0.3, rx: a, bevel: 0.01, ...METAL });
  }
  body.block(0.85, 0.07, 3.4, wing, { x: 0.25, y: 0.62, bevel: 0.03 });
  body.block(0.8, 0.07, 3.0, wing, { x: 0.3, y: -0.22, bevel: 0.03 });
  for (let i = 0; i < 6; i++) body.box(0.84, 0.075, 0.02, shade(wing, -0.1), { x: 0.25, y: 0.62, z: -1.5 + i * 0.6 });
  for (const z of [1.3, -1.3, 0.45, -0.45]) body.block(0.05, 0.84, 0.04, C.woodDark, { x: 0.3, y: 0.2, z, bevel: 0.01 });
  for (const z of [1.3, -1.3]) {
    body.tube([[0.1, 0.6, z], [0.3, 0.2, z * 0.7], [0.5, -0.2, z * 0.36]], 0.008, C.steel, { seg: 2 });
    body.tube([[0.5, 0.6, z], [0.3, 0.2, z * 0.7], [0.1, -0.2, z * 0.36]], 0.008, C.steel, { seg: 2 });
  }
  for (const z of [1.2, -1.2]) {
    body.cyl(0.3, 0.3, 0.02, t.main, { x: 0.25, y: 0.665, z, seg: 16 });
    body.cyl(0.18, 0.18, 0.025, '#f1ece0', { x: 0.25, y: 0.67, z, seg: 16 });
    body.cyl(0.08, 0.08, 0.03, t.dark, { x: 0.25, y: 0.675, z, seg: 12 });
  }
  body.block(0.5, 0.05, 1.2, wing, { x: -1.45, y: 0.05, bevel: 0.02 });
  body.extrude([[0, 0], [0.4, 0], [0.1, 0.6], [-0.15, 0.55]], 0.05, t.main, { x: -1.6, y: 0.05 });
  for (let i = 0; i < 3; i++) body.box(0.1, 0.1, 0.055, i % 2 ? '#f1ece0' : t.dark, { x: -1.45 + i * 0.08, y: 0.25 });
  // The pilot: leather helmet, goggles, a scarf that streams behind.
  body.cyl(0.24, 0.24, 0.1, C.leatherDark, { x: 0.1, y: 0.24, seg: 12 });
  body.sphere(0.16, '#d9a57f', { x: 0.1, y: 0.35 });
  body.dome(0.17, C.leather, { x: 0.1, y: 0.38 });
  body.block(0.05, 0.05, 0.22, '#9fe', { x: 0.24, y: 0.4, e: 0.6 });
  body.block(0.15, 0.1, 0.34, C.leather, { x: 0.1, y: 0.2, bevel: 0.03 });
  body.block(0.08, 0.03, 0.4, t.light, { x: -0.05, y: 0.33, rz: 0.3 });
  body.block(0.04, 0.1, 0.3, '#bcd9e8', { x: 0.36, y: 0.38, rz: -0.4, e: 0.15, m: 0.3, r: 0.1 });
  const scarf = G.sway(rig, 'F', 'body', 0.02, 0.3, 0.1);
  scarf.part.block(0.5, 0.06, 0.02, '#f4efe6', { x: -0.25, rz: 0.1 });
  // Twin guns on the cowling, wheels on struts.
  for (const z of [0.12, -0.12]) {
    body.cyl(0.035, 0.035, 0.6, C.black, { x: 0.65, y: 0.34, z, rz: HALF_PI, seg: 6, ...METAL });
    for (let i = 0; i < 4; i++) body.cyl(0.045, 0.045, 0.02, C.gunmetal, { x: 0.5 + i * 0.07, y: 0.34, z, rz: HALF_PI, seg: 6, ...METAL });
  }
  for (const z of [0.35, -0.35]) {
    body.cyl(0.03, 0.03, 0.45, C.black, { x: 0.4, y: -0.45, z, rz: 0.3, seg: 5 });
    body.cyl(0.15, 0.15, 0.06, C.black, { x: 0.45, y: -0.66, z: z * 1.03, rx: HALF_PI, seg: 12 });
    body.cyl(0.06, 0.06, 0.07, C.steel, { x: 0.45, y: -0.66, z: z * 1.03, rx: HALF_PI, seg: 8, ...METAL });
  }
  const prop = rig.joint('prop', 'body', 1.18, 0, 0);
  prop.block(0.05, 1.5, 0.12, C.woodDark, { bevel: 0.015, taper: [1, 0.7] });
  prop.block(0.052, 0.14, 0.13, C.brass, { y: 0.68, ...METAL });
  prop.block(0.052, 0.14, 0.13, C.brass, { y: -0.68, ...METAL });
  prop.cone(0.1, 0.18, '#8d8f93', { x: 0.08, rz: -HALF_PI, ...METAL });
  rig.joint('muzzle', 'body', 0.98, 0.34, 0.12);
  return finish(rig, { kind: 'flyer', style: 'gun', height: 1.3, strideLength: 3, bob: 0.3 });
}

// ─── Modern: battle tank and gunship ────────────────────────────────────────

const TANK_LOOP: [number, number][] = [
  [-2.05, 0.8], [2.0, 0.8], [2.3, 0.68], [2.42, 0.45], [2.25, 0.22], [1.9, 0.1],
  [-1.9, 0.1], [-2.25, 0.22], [-2.42, 0.45], [-2.3, 0.68],
];

export function battleTank(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const armor = '#998f70';
  const dark = '#5d5745';
  const hull = rig.joint('hull', null);
  hull.extrude([[-2.2, 0.55], [2.1, 0.55], [2.35, 0.95], [1.9, 1.2], [-2.15, 1.2]], 1.7, armor, { bevel: 0.03 });
  for (const z of [0.95, -0.95]) {
    hull.block(4.3, 0.62, 0.42, '#2e2c26', { y: 0.46, z });
    // Side skirts with reactive armour tiles.
    hull.block(4.5, 0.12, 0.62, dark, { y: 0.92, z, bevel: 0.02 });
    hull.block(3.6, 0.36, 0.06, armor, { x: 0.2, y: 0.72, z: z + Math.sign(z) * 0.3, bevel: 0.015 });
    for (let i = 0; i < 6; i++) hull.block(0.52, 0.28, 0.06, shade(armor, -0.08), { x: -1.2 + i * 0.6, y: 0.72, z: z + Math.sign(z) * 0.34, bevel: 0.02 });
  }
  hull.block(1.4, 0.05, 0.05, t.main, { x: -0.8, y: 1.0, z: 1.27, e: 0.25 });
  for (const z of [0.55, -0.55]) {
    hull.block(0.14, 0.1, 0.24, '#e8e2c8', { x: 2.2, y: 1.0, z, bevel: 0.02, e: 0.4 });
    hull.block(0.3, 0.14, 0.4, dark, { x: -2.18, y: 1.1, z, bevel: 0.03 });
  }
  for (let i = 0; i < 4; i++) hull.block(0.3, 0.04, 1.2, shade(armor, -0.2), { x: -1.9 + i * 0.12, y: 1.21 });
  for (let i = 0; i < 7; i++) {
    const w = rig.joint(`wheel${i}`, 'hull', -1.75 + i * 0.58, 0.4, 1.15);
    roadWheel(w, 0.25, '#44423a');
  }
  for (const x of [2.1, -2.1]) {
    const w = rig.joint(`wheel${x > 0 ? 7 : 8}`, 'hull', x, 0.45, 1.15);
    w.cyl(0.22, 0.22, 0.16, '#3a382f', { rx: HALF_PI, seg: 10 });
    for (let i = 0; i < 6; i++) w.block(0.08, 0.08, 0.17, '#2e2c26', { x: Math.cos((i / 6) * Math.PI * 2) * 0.23, y: Math.sin((i / 6) * Math.PI * 2) * 0.23 });
  }
  treads(rig, TANK_LOOP, 44, 0.95, 0.5, '#34322b');

  const turret = rig.joint('turret', 'hull', -0.2, 1.2, 0);
  turret.extrude([[-1.3, 0], [-1.35, 0.5], [0.55, 0.62], [1.2, 0.34], [1.1, 0]], 1.6, armor, { bevel: 0.03 });
  turret.block(0.9, 0.1, 1.6, dark, { x: -0.7, y: 0.56, bevel: 0.02 });
  // Bustle rack with stowed kit.
  turret.block(0.5, 0.3, 1.5, '#3a3830', { x: -1.55, y: 0.35, bevel: 0.03 });
  for (let i = 0; i < 3; i++) turret.block(0.35, 0.22, 0.4, i === 1 ? '#6a6450' : '#57614a', { x: -1.55, y: 0.6, z: -0.5 + i * 0.5, bevel: 0.05 });
  // Commander's hatch and machine gun, sight box, smoke dischargers.
  turret.cyl(0.24, 0.26, 0.2, dark, { x: -0.3, y: 0.72, z: 0.4, seg: 10 });
  turret.cyl(0.22, 0.22, 0.05, armor, { x: -0.3, y: 0.84, z: 0.4, seg: 10 });
  turret.cyl(0.025, 0.025, 0.7, C.black, { x: -0.05, y: 0.95, z: 0.4, rz: HALF_PI, seg: 5, ...METAL });
  turret.block(0.16, 0.12, 0.08, C.black, { x: -0.3, y: 0.95, z: 0.4, bevel: 0.02 });
  turret.block(0.28, 0.22, 0.32, C.black, { x: 0.35, y: 0.74, z: -0.4, bevel: 0.03 });
  turret.block(0.06, 0.1, 0.22, t.glow, { x: 0.5, y: 0.74, z: -0.4, e: 2 });
  for (const z of [0.72, -0.72]) for (let i = 0; i < 3; i++) turret.cyl(0.05, 0.05, 0.2, dark, { x: 0.55 - i * 0.12, y: 0.4, z, rz: -0.9, seg: 6 });
  turret.block(0.8, 0.12, 0.05, t.main, { x: 0.0, y: 0.35, z: 0.81, e: 0.3 });
  const whip = G.sway(rig, 'U', 'turret', -1.0, 0.62, -0.5);
  whip.part.cyl(0.015, 0.02, 1.5, C.black, { y: 0.75, seg: 4 });
  whip.part.sphere(0.03, C.black, { y: 1.5 });
  const barrel = rig.joint('barrel', 'turret', 1.0, 0.32, 0);
  barrel.cyl(0.1, 0.11, 2.9, dark, { x: 1.45, rz: -HALF_PI, seg: 12, ...METAL });
  barrel.cyl(0.16, 0.16, 0.5, dark, { x: 1.4, rz: -HALF_PI, seg: 12, ...METAL });
  barrel.cyl(0.2, 0.2, 0.3, armor, { x: 0.1, rz: -HALF_PI, seg: 10 });
  barrel.cyl(0.13, 0.13, 0.22, C.black, { x: 2.85, rz: -HALF_PI, seg: 12, ...METAL });
  rig.joint('muzzle', 'barrel', 2.95, 0, 0);
  return finish(rig, { kind: 'vehicle', style: 'gun', height: 3.2, strideLength: 3, recoil: 0.5, tread: TANK_LOOP });
}

export function gunship(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const olive = '#4f5842';
  const body = rig.joint('body', null);
  body.capsule(0.42, 1.6, olive, { rz: HALF_PI, s: [1, 1, 0.75], seg: 10 });
  body.cyl(0.26, 0.1, 2.6, olive, { x: -2.1, y: 0.15, rz: HALF_PI, seg: 8 });
  body.extrude([[0, 0], [0.45, 0], [0.2, 0.8], [-0.1, 0.8]], 0.06, t.main, { x: -3.45, y: 0.2 });
  body.block(0.55, 0.05, 0.9, olive, { x: -3.2, y: 0.2, bevel: 0.015 });
  // Stepped tandem canopy.
  body.sphere(0.4, '#9fd7ff', { x: 0.75, y: 0.25, s: [1.1, 0.7, 0.7], e: 0.25, r: 0.1, m: 0.3 });
  body.sphere(0.36, '#9fd7ff', { x: 0.15, y: 0.42, s: [1.2, 0.7, 0.72], e: 0.2, r: 0.1, m: 0.3 });
  body.block(0.04, 0.4, 0.5, olive, { x: 0.45, y: 0.42 });
  body.block(0.6, 0.35, 0.55, olive, { x: -0.45, y: 0.45, bevel: 0.06 });
  body.block(0.8, 0.2, 0.7, shade(olive, -0.1), { x: -0.5, y: 0.6, bevel: 0.05 });
  for (const z of [0.36, -0.36]) body.cyl(0.14, 0.12, 0.5, '#2b2f25', { x: -0.6, y: 0.55, z, rz: HALF_PI, seg: 8 });
  // Stub wings with rocket pods and missiles.
  body.block(0.8, 0.07, 2.2, olive, { x: -0.1, y: -0.12, bevel: 0.02 });
  for (const z of [1.0, -1.0]) {
    body.cyl(0.14, 0.14, 0.8, '#2b2f25', { x: -0.05, y: -0.32, z, rz: HALF_PI, seg: 10 });
    body.cyl(0.12, 0.12, 0.02, t.main, { x: 0.36, y: -0.32, z, rz: HALF_PI, e: 0.4, seg: 10 });
    for (let i = 0; i < 6; i++) body.cyl(0.025, 0.025, 0.02, '#111', { x: 0.37, y: -0.32 + Math.sin(i) * 0.07, z: z + Math.cos(i) * 0.07, rz: HALF_PI, seg: 5 });
    body.cyl(0.05, 0.05, 0.7, '#e2e0d6', { x: -0.05, y: -0.3, z: z * 0.68, rz: HALF_PI, seg: 6 });
    body.cone(0.05, 0.12, '#e2e0d6', { x: 0.36, y: -0.3, z: z * 0.68, rz: -HALF_PI, seg: 6 });
  }
  body.block(1.2, 0.08, 0.05, t.main, { x: -1.3, y: 0.28, z: 0.25, e: 0.3 });
  // Landing skids.
  for (const z of [0.4, -0.4]) {
    body.cyl(0.03, 0.03, 1.5, C.black, { x: -0.1, y: -0.62, z, rz: HALF_PI, seg: 5 });
    body.cyl(0.025, 0.025, 0.3, C.black, { x: 0.3, y: -0.48, z, rz: 0.2, seg: 5 });
    body.cyl(0.025, 0.025, 0.3, C.black, { x: -0.5, y: -0.48, z, rz: -0.2, seg: 5 });
  }
  // A chin gun that tracks the target.
  const chin = rig.joint('chin', 'body', 1.0, -0.36, 0);
  chin.sphere(0.14, '#2b2f25', { ws: 8, hs: 6 });
  chin.cyl(0.035, 0.035, 0.6, C.black, { x: 0.35, rz: HALF_PI, seg: 6, ...METAL });
  chin.cyl(0.05, 0.05, 0.1, C.black, { x: 0.12, rz: HALF_PI, seg: 6, ...METAL });
  const rotor = rig.joint('rotor', 'body', 0.1, 0.8, 0);
  rotor.cyl(0.06, 0.06, 0.3, C.black, { y: -0.1, seg: 6 });
  rotor.cyl(0.14, 0.14, 0.1, '#2b2f25', { y: 0.02, seg: 8 });
  for (let i = 0; i < 4; i++) rotor.block(3.4, 0.03, 0.2, '#2b2f25', { ry: (i * Math.PI) / 2 + 0.3, x: 0, taper: [1, 0.8] });
  const tail = rig.joint('tailRotor', 'body', -3.35, 0.45, 0.1);
  tail.block(0.06, 0.9, 0.1, '#2b2f25', { taper: [1, 0.7] });
  tail.block(0.9, 0.06, 0.1, '#2b2f25', { taper: [1, 0.7] });
  rig.joint('muzzle', 'chin', 0.62, 0, 0);
  return finish(rig, { kind: 'flyer', style: 'gun', height: 1.5, strideLength: 3, bob: 0.35 });
}

// ─── Age of Intelligence ────────────────────────────────────────────────────

export function roboHound(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const shell = '#e3e6ea';
  const frame = '#30343a';
  const m = rig.joint('mount', null);
  m.block(1.05, 0.3, 0.42, shell, { y: 0.8, bevel: 0.06, m: 0.25, r: 0.35 });
  m.block(0.9, 0.1, 0.44, frame, { y: 0.63, bevel: 0.02, m: 0.6, r: 0.4 });
  for (const z of [0.215, -0.215]) {
    m.block(0.7, 0.04, 0.02, t.glow, { y: 0.82, z, e: 3 });
    m.block(0.2, 0.14, 0.03, frame, { x: 0.35, y: 0.78, z: z * 1.02, bevel: 0.01 });
    m.block(0.2, 0.14, 0.03, frame, { x: -0.35, y: 0.78, z: z * 1.02, bevel: 0.01 });
  }
  m.block(0.3, 0.07, 0.3, frame, { x: -0.3, y: 0.98, bevel: 0.02 });
  m.block(0.2, 0.08, 0.26, shell, { x: 0.2, y: 0.98, bevel: 0.02, m: 0.25, r: 0.35 });
  m.block(0.08, 0.03, 0.2, t.glow, { x: 0.2, y: 1.03, e: 2 });
  const antenna = G.sway(rig, 'U', 'mount', -0.42, 1.0, 0.08);
  antenna.part.cyl(0.012, 0.015, 0.5, frame, { y: 0.25, seg: 4 });
  antenna.part.sphere(0.03, t.glow, { y: 0.5, e: 3 });
  rig.joint('mNeck', 'mount', 0.55, 0.88, 0).block(0.16, 0.14, 0.2, frame, { bevel: 0.03 });
  const h = rig.joint('mHead', 'mNeck', 0.12, 0.02, 0);
  h.block(0.38, 0.22, 0.28, shell, { x: 0.12, taper: [0.85, 0.9], bevel: 0.05, m: 0.25, r: 0.35 });
  h.block(0.05, 0.07, 0.26, t.glow, { x: 0.31, y: 0.03, e: 3.5 });
  h.block(0.22, 0.06, 0.22, frame, { x: 0.22, y: -0.12, bevel: 0.015 });
  for (const z of [0.1, -0.1]) h.block(0.08, 0.1, 0.03, frame, { x: -0.02, y: 0.14, z, rz: 0.4 });
  for (let i = 0; i < 3; i++) h.cone(0.03, 0.1, C.steel, { x: 0.32, y: -0.17, z: -0.07 + i * 0.07, rz: Math.PI, ...METAL });
  const legs: [string, string, number, number, number][] = [
    ['mLegFN', 'mKneeFN', 0.42, 0.25, 1],
    ['mLegFF', 'mKneeFF', 0.42, -0.25, 1],
    ['mLegBN', 'mKneeBN', -0.42, 0.25, -1],
    ['mLegBF', 'mKneeBF', -0.42, -0.25, -1],
  ];
  for (const [leg, knee, x, z, dir] of legs) {
    const l = rig.joint(leg, 'mount', x, 0.72, z);
    l.sphere(0.085, frame, { m: 0.6, r: 0.4 });
    l.block(0.12, 0.4, 0.11, shell, { y: -0.18, taper: 1.2, bevel: 0.03, m: 0.25, r: 0.35 });
    l.block(0.02, 0.2, 0.04, t.glow, { x: 0.065 * dir, y: -0.2, e: 2 });
    rig.group(leg).rotation.z = 0.45 * dir;
    const k = rig.joint(knee, leg, 0, -0.38, 0);
    k.sphere(0.065, frame, { m: 0.6, r: 0.4 });
    k.block(0.07, 0.4, 0.07, frame, { y: -0.2, bevel: 0.015, m: 0.5, r: 0.4 });
    k.cyl(0.015, 0.015, 0.3, C.steel, { x: -0.05 * dir, y: -0.18, seg: 4, ...METAL });
    k.block(0.12, 0.05, 0.1, '#15171a', { x: 0.02, y: -0.42, bevel: 0.015 });
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
  torso.extrude([[-0.9, -0.3], [0.8, -0.35], [1.1, 0.25], [0.7, 0.85], [-0.8, 0.9]], 1.5, plate, { bevel: 0.05, m: 0.5, r: 0.35 });
  torso.block(0.6, 0.35, 1.2, frame, { x: -0.1, y: -0.45, bevel: 0.05 });
  torso.block(0.3, 0.22, 0.9, '#8ad8ff', { x: 0.95, y: 0.4, e: 0.35, r: 0.1, m: 0.2, bevel: 0.03 });
  torso.block(0.06, 0.26, 0.94, frame, { x: 1.02, y: 0.4 });
  torso.cyl(0.18, 0.18, 0.06, t.glow, { x: 1.0, y: 0.05, rz: HALF_PI, e: 3.5, seg: 12 });
  torso.torus(0.2, 0.03, frame, { x: 1.02, y: 0.05, ry: HALF_PI, ...METAL });
  torso.block(1.2, 0.12, 0.04, t.main, { x: -0.05, y: 0.55, z: 0.78, e: 0.4 });
  for (let i = 0; i < 4; i++) torso.block(0.25, 0.25, 0.04, shade(plate, -0.12), { x: -0.55 + i * 0.3, y: 0.1, z: 0.77, bevel: 0.02 });
  torso.block(0.7, 0.6, 0.5, frame, { x: -0.9, y: 0.35, bevel: 0.05 });
  for (let i = 0; i < 3; i++) torso.block(0.06, 0.4, 0.4, t.glow, { x: -1.27, y: 0.35, z: -0.14 + i * 0.14, e: 1.5 });
  // A missile pod on the back.
  torso.block(0.7, 0.4, 0.6, plate, { x: -0.5, y: 1.05, bevel: 0.05, m: 0.5, r: 0.35 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) torso.cyl(0.07, 0.07, 0.03, '#111', { x: -0.14, y: 0.95 + r * 0.18, z: -0.18 + c * 0.18, rz: HALF_PI, seg: 8 });
  const antenna = G.sway(rig, 'U', 'torso', -0.7, 1.25, 0.2);
  antenna.part.cyl(0.02, 0.025, 1.1, frame, { y: 0.55, seg: 4 });
  antenna.part.sphere(0.05, t.glow, { y: 1.1, e: 3 });
  const guns = rig.joint('guns', 'torso', 0.1, 0.55, 0);
  for (const z of [0.95, -0.95]) {
    guns.block(0.85, 0.48, 0.42, plate, { z, bevel: 0.06, m: 0.5, r: 0.35 });
    guns.block(0.5, 0.06, 0.44, t.main, { x: -0.1, y: 0.2, z, e: 0.3 });
    for (const dy of [0.09, -0.09]) guns.cyl(0.07, 0.08, 1.4, frame, { x: 0.9, y: dy, z, rz: -HALF_PI, seg: 8, ...METAL });
    guns.cyl(0.15, 0.15, 0.2, frame, { x: 0.4, z, rz: -HALF_PI, seg: 10, ...METAL });
    guns.cyl(0.06, 0.06, 0.08, t.glow, { x: 1.62, y: 0.09, z, rz: -HALF_PI, e: 4 });
    guns.cyl(0.06, 0.06, 0.08, t.glow, { x: 1.62, y: -0.09, z, rz: -HALF_PI, e: 4 });
  }
  rig.joint('muzzle', 'guns', 1.65, 0, 0.95);
  for (const [near, z] of [[true, 0.55], [false, -0.55]] as const) {
    const leg = rig.joint(near ? 'legN' : 'legF', 'body', 0, 2.75, z);
    leg.sphere(0.3, frame, { m: 0.6, r: 0.4 });
    leg.block(0.48, 1.3, 0.42, plate, { x: 0.05, y: -0.65, taper: [1, 1.15], bevel: 0.06, m: 0.5, r: 0.35 });
    leg.block(0.05, 0.9, 0.05, t.main, { x: 0.3, y: -0.65, z: near ? 0.2 : -0.2, e: 0.3 });
    leg.cyl(0.05, 0.05, 1.0, C.steel, { x: -0.28, y: -0.65, seg: 6, ...METAL });
    rig.group(near ? 'legN' : 'legF').rotation.z = 0.35;
    const knee = rig.joint(near ? 'kneeN' : 'kneeF', near ? 'legN' : 'legF', 0.05, -1.3, 0);
    knee.sphere(0.26, frame, { m: 0.6, r: 0.4 });
    knee.block(0.38, 1.35, 0.34, frame, { y: -0.65, taper: [1, 1.1], bevel: 0.05, m: 0.6, r: 0.4 });
    knee.block(0.3, 0.9, 0.36, plate, { x: 0.12, y: -0.6, bevel: 0.05, m: 0.5, r: 0.35 });
    knee.cyl(0.08, 0.08, 1.1, C.steel, { x: -0.22, y: -0.6, seg: 6, ...METAL });
    rig.group(near ? 'kneeN' : 'kneeF').rotation.z = -0.75;
    const foot = rig.joint(near ? 'footN' : 'footF', near ? 'kneeN' : 'kneeF', 0, -1.35, 0);
    foot.block(1.0, 0.24, 0.58, plate, { x: 0.2, y: -0.1, taper: [0.85, 0.9], bevel: 0.06, m: 0.5, r: 0.35 });
    foot.block(0.3, 0.2, 0.5, frame, { x: -0.35, y: -0.1, bevel: 0.04 });
    for (const dz of [0.2, -0.2]) foot.block(0.25, 0.12, 0.14, frame, { x: 0.72, y: -0.16, z: dz, bevel: 0.03 });
    rig.group(near ? 'footN' : 'footF').rotation.z = 0.4;
  }
  return finish(rig, { kind: 'walker', style: 'gun', height: 4.9, strideLength: 3.4 });
}

export function swarm(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const body = rig.joint('body', null);
  body.ico(0.2, t.glow, { e: 3, detail: 1 });
  body.torus(0.35, 0.02, t.glow, { rx: HALF_PI, e: 2 });
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996;
    const r = 0.5 + ((i * 7) % 11) / 11;
    const d = rig.joint(`d${i}`, 'body', Math.cos(a) * r * 1.1, Math.sin(i * 1.7) * 0.55, Math.sin(a) * r * 0.8);
    d.block(0.14, 0.05, 0.14, '#2a2f36', { bevel: 0.02, m: 0.6, r: 0.35 });
    for (let k = 0; k < 4; k++) {
      const ka = (k / 4) * Math.PI * 2 + Math.PI / 4;
      d.box(0.14, 0.015, 0.02, '#1b1e22', { x: Math.cos(ka) * 0.07, z: Math.sin(ka) * 0.07, ry: -ka });
      d.cyl(0.045, 0.045, 0.01, '#50565f', { x: Math.cos(ka) * 0.13, y: 0.02, z: Math.sin(ka) * 0.13, seg: 6 });
    }
    d.sphere(0.035, t.glow, { y: 0.04, e: 4 });
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
  body.torus(1.6, 0.03, t.glow, { y: 0.07, rx: HALF_PI, ts: 28, e: 1.5 });
  const core = rig.joint('core', 'body', 0, 3.6, 0);
  core.ico(1.55, hull, { detail: 1, m: 0.7, r: 0.3 });
  core.ico(1.35, plate, { detail: 0, m: 0.6, r: 0.35, s: [1.12, 1.02, 1.12] });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    core.box(0.05, 1.6, 0.05, t.glow, { x: Math.cos(a) * 1.5, z: Math.sin(a) * 1.5, rz: Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35, e: 3 });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    core.block(0.5, 0.3, 0.12, plate, { x: Math.cos(a) * 1.45, y: -0.9, z: Math.sin(a) * 1.45, ry: -a + HALF_PI, bevel: 0.03, m: 0.6, r: 0.35 });
  }
  core.cone(0.5, 1.2, plate, { y: 1.75, m: 0.6, r: 0.35, seg: 6 });
  core.cone(0.5, 1.2, plate, { y: -1.75, rz: Math.PI, m: 0.6, r: 0.35, seg: 6 });
  core.sphere(0.12, t.glow, { y: 2.4, e: 4 });
  const eye = rig.joint('eye', 'core', 1.35, 0.05, 0);
  eye.cyl(0.62, 0.7, 0.3, hull, { rz: HALF_PI, seg: 16, m: 0.7, r: 0.3 });
  eye.sphere(0.5, t.glow, { x: 0.1, e: 4, s: [0.6, 1, 1] });
  eye.sphere(0.2, '#ffffff', { x: 0.3, e: 6 });
  eye.torus(0.62, 0.05, t.glow, { x: 0.18, ry: HALF_PI, e: 2.5, ts: 20 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    eye.block(0.12, 0.2, 0.08, plate, { x: 0.12, y: Math.cos(a) * 0.72, z: Math.sin(a) * 0.72, rx: a, bevel: 0.02, m: 0.6 });
  }
  rig.joint('muzzle', 'eye', 0.45, 0, 0);
  for (let i = 0; i < 3; i++) {
    const r = rig.joint(`ring${i}`, 'core', 0, 0, 0);
    r.torus(2.1 + i * 0.45, 0.045 + i * 0.01, i === 1 ? '#e8ecf2' : t.glow, { ts: 40, rs: 4, e: i === 1 ? 0.3 : 2.2, m: 0.6 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + i;
      r.block(0.16, 0.16, 0.16, plate, { x: Math.cos(a) * (2.1 + i * 0.45), y: Math.sin(a) * (2.1 + i * 0.45), bevel: 0.03, m: 0.6 });
    }
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
    c.block(0.5, 0.5, 0.5, plate, { bevel: 0.08, m: 0.6, r: 0.35 });
    c.sphere(0.12, t.glow, { x: 0.26, e: 3 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      c.block(0.7, 0.1, 0.1, hull, { x: 0.5, y: Math.cos(a) * 0.2, z: Math.sin(a) * 0.2, rz: -0.2 * Math.cos(a), bevel: 0.02, m: 0.6 });
      c.cone(0.06, 0.2, t.glow, { x: 0.92, y: Math.cos(a) * 0.14, z: Math.sin(a) * 0.14, rz: -HALF_PI, e: 2 });
    }
  }
  return finish(rig, { kind: 'hover', style: 'gun', height: 6.8, strideLength: 4, bob: 0.35 });
}
