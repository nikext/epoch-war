import * as THREE from 'three';
import { Part, shade, type ColorLike } from '../kit/builder';

/**
 * Weapons, shields and headgear. Each item is drawn in the frame it is held
 * in (see humanoid.ts):
 *
 * - swing weapons point down the arm (−y) from the grip at the origin; the
 *   hand joint is tilted so they read as held forward
 * - thrust weapons, guns, crossbows and launchers point along +x
 * - thrown spears point along −x (they are carried trailing, and come
 *   forward over the head during the throw)
 * - bows stand vertical in the x/y plane
 * - staves stand along +y
 *
 * Head items are centred on the skull at (0, 0.22, 0), radius ~0.21.
 */

export const C = {
  wood: '#7b5434',
  woodDark: '#553a24',
  woodLight: '#a57a4e',
  leather: '#6a4a2f',
  leatherDark: '#4a3322',
  bone: '#d8cdb0',
  stone: '#8e8b85',
  flint: '#5f6167',
  bronze: '#c48f3f',
  gold: '#f0c24f',
  steel: '#b8c0c9',
  iron: '#727a84',
  gunmetal: '#3a3f45',
  black: '#24272c',
  linen: '#ece5d2',
  khaki: '#857b56',
  olive: '#5c6a3c',
  coyote: '#8c7757',
  carbon: '#2d3137',
  white: '#e9edf0',
  rope: '#b69a6a',
  fur: '#8a5b35',
  furDark: '#5f3e24',
  furGrey: '#7d766c',
} as const;

const METAL = { m: 0.85, r: 0.35 } as const;
const HALF_PI = Math.PI / 2;

// ─── Melee (−y from grip) ───────────────────────────────────────────────────

export function club(p: Part): void {
  p.cyl(0.035, 0.05, 0.62, C.wood, { y: -0.22 });
  p.ico(0.13, C.woodDark, { y: -0.56, s: [1, 1.25, 1] });
  p.cone(0.035, 0.1, C.bone, { y: -0.56, z: 0.12, rx: HALF_PI });
  p.cone(0.035, 0.1, C.bone, { y: -0.6, x: 0.12, rz: -HALF_PI });
}

export function sword(p: Part, length = 0.78, blade: ColorLike = C.steel, guard: ColorLike = C.iron): void {
  p.cyl(0.03, 0.03, 0.2, C.leatherDark, { y: 0.04 });
  p.sphere(0.045, guard, { y: 0.16, ...METAL });
  p.box(0.08, 0.05, 0.3, guard, { y: -0.08, ...METAL });
  p.box(0.075, length, 0.025, blade, { y: -0.1 - length / 2, ...METAL });
  p.cone(0.038, 0.12, blade, { y: -0.16 - length, rz: Math.PI, s: [1, 1, 0.33], ...METAL });
}

export function sabre(p: Part): void {
  p.cyl(0.028, 0.028, 0.18, C.leatherDark, { y: 0.04 });
  p.torus(0.08, 0.012, C.gold, { y: -0.02, x: 0.05, arc: Math.PI, ...METAL });
  for (let i = 0; i < 5; i++) {
    p.box(0.06, 0.18, 0.02, C.steel, { y: -0.14 - i * 0.16, x: i * i * 0.008, rz: i * 0.05, ...METAL });
  }
}

export function axe(p: Part): void {
  p.cyl(0.035, 0.04, 0.9, C.wood, { y: -0.35 });
  p.extrude([[0, 0.12], [0.26, 0.2], [0.3, -0.12], [0, -0.06]], 0.035, C.steel, { y: -0.72, x: 0.03, ...METAL });
}

// ─── Thrust (+x) ────────────────────────────────────────────────────────────

export function spear(p: Part, length = 2.0, tip: ColorLike = C.bronze, back = 0.6): void {
  p.cyl(0.028, 0.028, length, C.wood, { x: length / 2 - back, rz: HALF_PI });
  p.cone(0.055, 0.28, tip, { x: length - back + 0.12, rz: -HALF_PI, ...METAL });
  p.cone(0.03, 0.12, tip, { x: -back - 0.04, rz: HALF_PI, ...METAL });
}

export function lance(p: Part, pennant: ColorLike): void {
  p.cone(0.09, 2.6, C.woodLight, { x: 1.2, rz: -HALF_PI, seg: 8 });
  p.cone(0.16, 0.25, C.steel, { x: -0.05, rz: -HALF_PI, ...METAL });
  p.extrude([[0, 0], [0.45, -0.1], [0, -0.22]], 0.015, pennant, { x: 1.9, y: 0.08 });
}

export function rapier(p: Part): void {
  p.cyl(0.025, 0.025, 0.16, C.leatherDark, { x: -0.06, rz: HALF_PI });
  p.dome(0.09, C.gold, { x: 0.04, rz: -HALF_PI, ...METAL });
  p.box(0.95, 0.018, 0.018, C.steel, { x: 0.55, ...METAL });
  p.torus(0.05, 0.01, C.gold, { x: 0.02, ry: HALF_PI, ...METAL });
}

export function bayonetRifle(p: Part, wood: ColorLike = C.wood): void {
  p.box(1.15, 0.07, 0.055, wood, { x: 0.25 });
  p.box(0.3, 0.12, 0.05, wood, { x: -0.4, y: -0.03, rz: 0.12 });
  p.cyl(0.018, 0.018, 0.7, C.gunmetal, { x: 0.55, y: 0.04, rz: HALF_PI, ...METAL });
  p.box(0.38, 0.03, 0.015, C.steel, { x: 1.05, y: 0.02, ...METAL });
}

// ─── Throwing ───────────────────────────────────────────────────────────────

export function throwingSpear(p: Part, tip: ColorLike = C.flint): void {
  p.cyl(0.025, 0.025, 1.6, C.woodLight, { x: -0.3, rz: HALF_PI });
  p.cone(0.05, 0.22, tip, { x: -1.2, rz: HALF_PI });
  p.box(0.12, 0.04, 0.04, C.rope, { x: -1.05 });
}

export function sling(p: Part): void {
  p.tube([[0, 0, 0], [0.04, -0.14, 0.02], [0.02, -0.3, 0], [0, -0.38, 0]], 0.012, C.rope);
  p.sphere(0.07, C.leather, { y: -0.4 });
  p.ico(0.06, C.stone, { y: -0.4, z: 0.03 });
}

export function grenade(p: Part): void {
  p.sphere(0.06, C.olive, { y: -0.04 });
}

// ─── Bows ───────────────────────────────────────────────────────────────────

export function bow(p: Part, color: ColorLike = C.woodDark, size = 0.62): void {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = -1 + (i / 8) * 2;
    pts.push([0.16 * (1 - t * t) + 0.02 * t * t * t, t * size, 0]);
  }
  p.tube(pts, 0.028, color, { seg: 16 });
  p.tube([[0.02, size, 0], [-0.02, 0, 0], [0.02, -size, 0]], 0.006, C.linen, { seg: 2 });
  p.box(0.06, 0.12, 0.05, C.leather, { x: 0.16 });
}

export function crossbow(p: Part): void {
  p.box(0.72, 0.08, 0.07, C.wood, { x: 0.12 });
  p.box(0.2, 0.12, 0.07, C.woodDark, { x: -0.22, y: -0.05 });
  p.box(0.06, 0.05, 0.72, C.iron, { x: 0.44, ...METAL });
  p.tube([[0.44, 0, 0.36], [0.18, 0.02, 0], [0.44, 0, -0.36]], 0.006, C.linen, { seg: 2 });
  p.box(0.3, 0.025, 0.025, C.steel, { x: 0.28, y: 0.05, ...METAL });
}

// ─── Guns (+x) ──────────────────────────────────────────────────────────────

export function musket(p: Part): void {
  p.box(0.95, 0.075, 0.06, C.wood, { x: 0.2 });
  p.box(0.34, 0.13, 0.055, C.wood, { x: -0.4, y: -0.035, rz: 0.1 });
  p.cyl(0.02, 0.022, 1.05, C.iron, { x: 0.55, y: 0.05, rz: HALF_PI, ...METAL });
  p.box(0.08, 0.06, 0.03, C.gold, { x: -0.05, y: 0.06, ...METAL });
  p.box(0.42, 0.025, 0.015, C.steel, { x: 1.25, y: 0.03, ...METAL });
}

export function boltRifle(p: Part): void {
  p.box(0.9, 0.07, 0.055, C.wood, { x: 0.18 });
  p.box(0.3, 0.12, 0.05, C.wood, { x: -0.36, y: -0.03, rz: 0.1 });
  p.cyl(0.018, 0.018, 0.55, C.gunmetal, { x: 0.55, y: 0.04, rz: HALF_PI, ...METAL });
}

export function lewisGun(p: Part): void {
  p.cyl(0.07, 0.07, 0.85, C.gunmetal, { x: 0.35, rz: HALF_PI, ...METAL });
  p.cyl(0.025, 0.025, 0.25, C.black, { x: 0.88, rz: HALF_PI, ...METAL });
  p.cyl(0.17, 0.17, 0.06, C.black, { x: 0.05, y: 0.12, ...METAL });
  p.box(0.36, 0.1, 0.06, C.wood, { x: -0.25, y: -0.04 });
  p.box(0.08, 0.14, 0.05, C.wood, { x: 0.02, y: -0.1 });
}

export function flamethrower(p: Part, glow: ColorLike = '#ff9b3a'): void {
  p.cyl(0.035, 0.035, 0.9, C.iron, { x: 0.3, rz: HALF_PI, ...METAL });
  p.cyl(0.055, 0.04, 0.18, C.black, { x: 0.8, rz: HALF_PI, ...METAL });
  p.box(0.12, 0.16, 0.06, C.iron, { x: -0.05, y: -0.08, ...METAL });
  p.sphere(0.04, glow, { x: 0.9, e: 3 });
}

export function carbine(p: Part, accent: ColorLike = C.black): void {
  p.box(0.42, 0.11, 0.06, C.black, { x: 0.12, m: 0.4, r: 0.5 });
  p.box(0.34, 0.07, 0.07, accent, { x: 0.46, m: 0.3, r: 0.55 });
  p.cyl(0.018, 0.018, 0.3, C.black, { x: 0.76, rz: HALF_PI, ...METAL });
  p.box(0.24, 0.1, 0.05, C.black, { x: -0.24, y: -0.02, rz: 0.08 });
  p.box(0.07, 0.16, 0.05, C.black, { x: 0.18, y: -0.12, rz: -0.2 });
  p.box(0.14, 0.07, 0.07, C.gunmetal, { x: 0.1, y: 0.1, ...METAL });
  p.box(0.02, 0.04, 0.04, '#7cf', { x: 0.18, y: 0.1, e: 0.8 });
}

export function sniperRifle(p: Part): void {
  p.box(0.8, 0.09, 0.06, '#4b513d', { x: 0.15 });
  p.cyl(0.02, 0.02, 0.75, C.black, { x: 0.9, rz: HALF_PI, ...METAL });
  p.cyl(0.045, 0.04, 0.38, C.black, { x: 0.12, y: 0.12, rz: HALF_PI, ...METAL });
  p.cyl(0.042, 0.042, 0.01, '#9ef', { x: 0.31, y: 0.12, rz: HALF_PI, e: 1.2 });
  p.box(0.3, 0.13, 0.05, '#4b513d', { x: -0.36, y: -0.03 });
  p.box(0.02, 0.28, 0.02, C.black, { x: 0.75, y: -0.12, rz: 0.4 });
}

export function launcherTube(p: Part, accent: ColorLike): void {
  p.cyl(0.085, 0.085, 1.25, '#55613f', { x: 0.2, rz: HALF_PI });
  p.cyl(0.1, 0.085, 0.14, C.black, { x: 0.85, rz: HALF_PI });
  p.box(0.18, 0.14, 0.12, C.black, { x: 0.05, y: 0.12 });
  p.box(0.05, 0.05, 0.05, accent, { x: 0.05, y: 0.21, e: 1.5 });
  p.box(0.06, 0.16, 0.05, C.black, { x: 0.1, y: -0.12 });
}

export function plasmaRifle(p: Part, glow: ColorLike): void {
  p.box(0.62, 0.13, 0.08, C.white, { x: 0.2, m: 0.2, r: 0.3 });
  p.box(0.42, 0.06, 0.1, C.carbon, { x: 0.28, y: -0.07, m: 0.5, r: 0.35 });
  p.cyl(0.04, 0.05, 0.3, C.carbon, { x: 0.62, rz: HALF_PI, m: 0.6, r: 0.3 });
  for (let i = 0; i < 3; i++) p.torus(0.055, 0.014, glow, { x: 0.52 + i * 0.08, ry: HALF_PI, e: 3 });
  p.box(0.3, 0.025, 0.09, glow, { x: 0.15, y: 0.07, e: 2 });
  p.box(0.2, 0.12, 0.06, C.white, { x: -0.22, y: -0.02 });
}

export function railgun(p: Part, glow: ColorLike): void {
  p.box(0.5, 0.2, 0.14, C.carbon, { x: 0.05, m: 0.5, r: 0.35 });
  p.box(1.35, 0.05, 0.04, C.steel, { x: 0.75, y: 0.06, ...METAL });
  p.box(1.35, 0.05, 0.04, C.steel, { x: 0.75, y: -0.06, ...METAL });
  for (let i = 0; i < 5; i++) p.box(0.05, 0.19, 0.12, glow, { x: 0.25 + i * 0.25, e: 2.2 });
  p.box(0.24, 0.16, 0.08, C.carbon, { x: -0.3, y: -0.04 });
}

// ─── Staves (+y) ────────────────────────────────────────────────────────────

export function sunStaff(p: Part, glow: ColorLike = C.gold): void {
  p.cyl(0.028, 0.028, 1.7, C.woodDark, { y: 0.2 });
  p.torus(0.16, 0.025, C.gold, { y: 1.14, ...METAL });
  p.cyl(0.12, 0.12, 0.035, glow, { y: 1.14, rx: HALF_PI, e: 1.6 });
  p.cone(0.05, 0.12, C.gold, { y: 1.34, ...METAL });
}

// ─── Shields (arm frame; face toward +z on the near arm) ────────────────────

export function roundShield(p: Part, near: boolean, face: ColorLike, rim: ColorLike = C.bronze, emblem?: ColorLike): void {
  const z = near ? 0.14 : -0.14;
  p.cyl(0.42, 0.42, 0.06, face, { x: 0.06, y: -0.32, z, rx: HALF_PI, seg: 14 });
  p.torus(0.41, 0.035, rim, { x: 0.06, y: -0.32, z: z + (near ? 0.01 : -0.01), rs: 5, ts: 16, ...METAL });
  if (emblem) p.cyl(0.13, 0.13, 0.02, emblem, { x: 0.06, y: -0.32, z: z + (near ? 0.04 : -0.04), rx: HALF_PI, seg: 10 });
}

export function kiteShield(p: Part, near: boolean, face: ColorLike, stripe: ColorLike): void {
  const z = near ? 0.14 : -0.14;
  const outline: [number, number][] = [[0, 0.36], [0.22, 0.28], [0.2, -0.05], [0, -0.48], [-0.2, -0.05], [-0.22, 0.28]];
  p.extrude(outline, 0.06, face, { x: 0.06, y: -0.28, z, bevel: 0.01 });
  p.box(0.08, 0.8, 0.02, stripe, { x: 0.06, y: -0.32, z: z + (near ? 0.04 : -0.04) });
  p.box(0.4, 0.08, 0.02, stripe, { x: 0.06, y: -0.12, z: z + (near ? 0.04 : -0.04) });
}

export function heaterShield(p: Part, near: boolean, face: ColorLike, charge: ColorLike): void {
  const z = near ? 0.14 : -0.14;
  const outline: [number, number][] = [[-0.22, 0.24], [0.22, 0.24], [0.2, -0.05], [0, -0.3], [-0.2, -0.05]];
  p.extrude(outline, 0.05, face, { x: 0.06, y: -0.3, z, bevel: 0.01 });
  p.extrude([[-0.1, 0.12], [0.1, 0.12], [0.08, -0.02], [0, -0.14], [-0.08, -0.02]], 0.02, charge, {
    x: 0.06, y: -0.3, z: z + (near ? 0.04 : -0.04),
  });
}

// ─── Headgear (head frame) ──────────────────────────────────────────────────

export function corinthianHelmet(p: Part, crest: ColorLike): void {
  p.dome(0.24, C.bronze, { y: 0.22, s: [1, 1.1, 1], ...METAL });
  p.box(0.12, 0.26, 0.46, C.bronze, { x: 0.12, y: 0.12, ...METAL });
  p.box(0.3, 0.2, 0.46, C.bronze, { x: -0.05, y: 0.1, ...METAL });
  p.box(0.06, 0.05, 0.47, '#1b1612', { x: 0.17, y: 0.25 });
  p.box(0.52, 0.2, 0.08, crest, { x: -0.05, y: 0.55 });
  p.box(0.12, 0.28, 0.06, crest, { x: -0.3, y: 0.42 });
  p.box(0.3, 0.05, 0.1, C.bronze, { x: -0.05, y: 0.46, ...METAL });
}

export function kettleHelm(p: Part): void {
  p.dome(0.24, C.steel, { y: 0.26, s: [1, 0.95, 1], ...METAL });
  p.cyl(0.36, 0.36, 0.025, C.steel, { y: 0.26, seg: 12, ...METAL });
}

export function nasalHelm(p: Part): void {
  p.dome(0.235, C.steel, { y: 0.26, s: [1, 1.15, 1], ...METAL });
  p.box(0.03, 0.2, 0.04, C.steel, { x: 0.22, y: 0.2, ...METAL });
  p.dome(0.26, C.iron, { y: 0.1, rz: Math.PI, s: [1, 0.7, 1], m: 0.6, r: 0.5 });
}

export function greatHelm(p: Part, plume: ColorLike): void {
  p.cyl(0.24, 0.24, 0.42, C.steel, { y: 0.2, seg: 10, ...METAL });
  p.dome(0.24, C.steel, { y: 0.41, s: [1, 0.4, 1], ...METAL });
  p.box(0.04, 0.03, 0.4, '#101215', { x: 0.23, y: 0.26 });
  p.box(0.04, 0.2, 0.03, '#101215', { x: 0.24, y: 0.14 });
  p.cone(0.12, 0.35, plume, { y: 0.62, x: -0.05, s: [1.3, 1, 0.7] });
}

export function morion(p: Part, plume: ColorLike): void {
  p.dome(0.23, C.steel, { y: 0.28, ...METAL });
  p.extrude([[-0.38, 0], [-0.25, 0.08], [0.25, 0.08], [0.38, 0], [0.25, 0.03], [-0.25, 0.03]], 0.48, C.steel, { y: 0.25, ...METAL });
  p.extrude([[-0.2, 0], [0, 0.2], [0.2, 0]], 0.03, C.steel, { y: 0.44, ...METAL });
  p.box(0.08, 0.2, 0.05, plume, { x: -0.18, y: 0.55, rz: 0.3 });
}

export function cavalierHat(p: Part, plume: ColorLike): void {
  p.cyl(0.38, 0.38, 0.03, C.black, { y: 0.35, rz: 0.12, seg: 14 });
  p.cyl(0.17, 0.2, 0.2, C.black, { y: 0.45, seg: 10 });
  p.capsule(0.07, 0.4, plume, { x: -0.12, y: 0.52, z: 0.12, rz: 1.1, e: 0.1 });
}

export function tricorn(p: Part, trim: ColorLike = C.gold): void {
  p.cone(0.36, 0.2, C.black, { y: 0.44, seg: 3, ry: Math.PI / 2 });
  p.cyl(0.19, 0.2, 0.12, C.black, { y: 0.4, seg: 10 });
  p.torus(0.3, 0.015, trim, { y: 0.36, rx: HALF_PI, ts: 3, ...METAL });
}

export function cuirassierHelm(p: Part, crest: ColorLike): void {
  p.dome(0.24, C.steel, { y: 0.27, s: [1, 1.1, 1], ...METAL });
  p.box(0.34, 0.06, 0.06, C.gold, { y: 0.52, ...METAL });
  p.box(0.45, 0.14, 0.05, crest, { x: -0.12, y: 0.56, rz: -0.3 });
  p.box(0.16, 0.03, 0.4, C.black, { x: 0.18, y: 0.22 });
}

export function brodieHelmet(p: Part, color: ColorLike = C.olive): void {
  p.cyl(0.36, 0.37, 0.03, color, { y: 0.34, seg: 12, m: 0.4, r: 0.6 });
  p.dome(0.22, color, { y: 0.34, s: [1, 0.7, 1], m: 0.4, r: 0.6 });
}

export function modernHelmet(p: Part, color: ColorLike, glow: ColorLike): void {
  p.dome(0.25, color, { y: 0.26, s: [1.05, 1, 1.02] });
  p.box(0.24, 0.05, 0.05, C.black, { y: 0.28, z: 0.22 });
  p.box(0.08, 0.1, 0.1, C.black, { x: 0.22, y: 0.44 });
  p.box(0.14, 0.07, 0.2, C.black, { x: 0.26, y: 0.36, rz: -0.6 });
  p.cyl(0.03, 0.03, 0.06, glow, { x: 0.3, y: 0.32, z: 0.05, rz: HALF_PI, e: 2 });
  p.cyl(0.03, 0.03, 0.06, glow, { x: 0.3, y: 0.32, z: -0.05, rz: HALF_PI, e: 2 });
}

export function gasMask(p: Part, helmetColor: ColorLike = C.olive): void {
  p.sphere(0.215, '#4c4f45', { y: 0.2, s: [1, 1.02, 0.95] });
  p.cyl(0.055, 0.055, 0.03, '#b7d0c8', { x: 0.17, y: 0.26, z: 0.1, rz: HALF_PI, e: 0.3 });
  p.cyl(0.055, 0.055, 0.03, '#b7d0c8', { x: 0.17, y: 0.26, z: -0.1, rz: HALF_PI, e: 0.3 });
  p.cyl(0.07, 0.08, 0.16, C.iron, { x: 0.22, y: 0.08, rz: 1.9, ...METAL });
  brodieHelmet(p, helmetColor);
}

export function boonieHat(p: Part, color: ColorLike): void {
  p.cyl(0.34, 0.36, 0.04, color, { y: 0.34, seg: 10 });
  p.cyl(0.2, 0.23, 0.14, color, { y: 0.42, seg: 10 });
}

export function headband(p: Part, color: ColorLike): void {
  p.torus(0.212, 0.035, color, { y: 0.3, rx: HALF_PI, ts: 12 });
}

export function feather(p: Part, color: ColorLike, x = -0.15, y = 0.45): void {
  p.capsule(0.03, 0.22, color, { x, y, rz: 0.5 });
}

export function wildHair(p: Part, color: ColorLike): void {
  p.dome(0.235, color, { y: 0.25, x: -0.03, s: [1.05, 0.95, 1.05] });
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    p.cone(0.07, 0.2, color, { x: -0.1 + Math.sin(a) * 0.05, y: 0.44 + Math.cos(a) * 0.02, z: Math.sin(a) * 0.14, rz: 0.6 + a * 0.2 });
  }
}

export function nemes(p: Part, stripe: ColorLike): void {
  p.dome(0.235, C.linen, { y: 0.24, s: [1, 1, 1.02] });
  p.box(0.12, 0.36, 0.08, stripe, { x: -0.02, y: 0.02, z: 0.22 });
  p.box(0.12, 0.36, 0.08, stripe, { x: -0.02, y: 0.02, z: -0.22 });
  p.box(0.2, 0.3, 0.3, C.linen, { x: -0.18, y: 0.06 });
  p.torus(0.22, 0.02, C.gold, { y: 0.3, rx: HALF_PI, ...METAL });
}

// ─── Kit (torso frame) ──────────────────────────────────────────────────────

export function quiver(p: Part, color: ColorLike = C.leather): void {
  p.cyl(0.08, 0.07, 0.55, color, { x: -0.22, y: 0.36, rz: -0.35 });
  for (let i = 0; i < 4; i++) p.cyl(0.008, 0.008, 0.2, C.linen, { x: -0.31 + i * 0.02, y: 0.66, z: -0.03 + i * 0.02, rz: -0.35 });
}

export function cape(p: Part, color: ColorLike, length = 0.9): void {
  p.box(0.06, length, 0.46, color, { x: -0.19, y: 0.58 - length / 2, rz: -0.05 });
}

export function sash(p: Part, color: ColorLike, bulk = 1): void {
  p.box(0.34, 0.1, 0.5 * bulk, color, { y: 0.34, rx: 0.55 });
}

export function tabard(p: Part, color: ColorLike, emblem: ColorLike, bulk = 1): void {
  p.box(0.35, 0.72, 0.5 * bulk, color, { y: 0.22 });
  p.box(0.05, 0.3, 0.06, emblem, { x: 0.02, y: 0.34, z: 0.25 * bulk });
  p.box(0.05, 0.06, 0.2, emblem, { x: 0.02, y: 0.4, z: 0.25 * bulk });
}

export function plateCarrier(p: Part, color: ColorLike, patch: ColorLike, bulk = 1): void {
  p.box(0.4, 0.42, 0.52 * bulk, color, { y: 0.32 });
  for (let i = 0; i < 3; i++) p.box(0.08, 0.12, 0.12, shade(color, -0.2), { x: 0.2, y: 0.2, z: -0.13 + i * 0.13 });
  p.box(0.05, 0.08, 0.14, patch, { x: 0.21, y: 0.42, z: 0.1, e: 0.2 });
}

export function collar(p: Part, color: ColorLike = C.gold): void {
  p.cyl(0.3, 0.26, 0.06, color, { y: 0.56, seg: 12, ...METAL });
}

export const tex = { METAL, HALF_PI };

export function teamStripe(p: Part, color: ColorLike, o: { x?: number; y?: number; z?: number; w?: number; h?: number; d?: number; e?: number }): void {
  p.box(o.w ?? 0.1, o.h ?? 0.1, o.d ?? 0.1, color, { x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, e: o.e ?? 0 });
}

export function vec(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}
