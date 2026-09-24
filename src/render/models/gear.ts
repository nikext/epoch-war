import * as THREE from 'three';
import { Part, RigBuilder, shade, type ColorLike } from '../kit/builder';

/**
 * Weapons, shields and headgear. Each item is drawn in the frame it is held
 * in (see humanoid.ts):
 *
 * - swing weapons point down the arm (−y) from the grip at the origin; the
 *   hand joint is tilted so they read as held forward
 * - thrust weapons, guns, crossbows and launchers point along +x
 * - thrown spears point along −x (they are carried trailing, and come
 *   forward over the head during the throw)
 * - bows stand vertical in the x/y plane, grip at the origin
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
  brass: '#c9a24a',
  webbing: '#5d5a45',
} as const;

const METAL = { m: 0.85, r: 0.35 } as const;
const HALF_PI = Math.PI / 2;

// ─── Secondary motion ───────────────────────────────────────────────────────

/**
 * A joint the animator swings on its own (see rig.ts): 'D' hangs and trails
 * behind on the march (capes, tassels, tails), 'U' stands up and trails
 * (plumes, antennae), 'F' flutters about its pole (flags, pennants).
 * Chain them — sway(sway(…)) — for cloth that folds.
 */
export function sway(rig: RigBuilder, kind: 'D' | 'U' | 'F', parent: string, x = 0, y = 0, z = 0): { part: Part; name: string } {
  let i = 0;
  while (rig.has(`${parent}.sway${kind}${i}`)) i++;
  const name = `${parent}.sway${kind}${i}`;
  return { part: rig.joint(name, parent, x, y, z), name };
}

/** A two-piece cape hanging from the shoulders, that trails and billows. */
export function cape(rig: RigBuilder, torso: string, color: ColorLike, length = 0.9, trim?: ColorLike, width = 0.46): void {
  const top = sway(rig, 'D', torso, -0.19, 0.58, 0);
  const h1 = length * 0.45;
  top.part.block(0.05, h1, width, color, { y: -h1 / 2, bevel: 0.015 });
  top.part.block(0.1, 0.07, width + 0.04, shade(color, -0.2), { x: 0.02, y: -0.01, bevel: 0.02 });
  const low = sway(rig, 'D', top.name, 0, -h1, 0);
  const h2 = length - h1;
  low.part.block(0.045, h2, width * 1.06, color, { y: -h2 / 2, taper: [1, 0.94], bevel: 0.015 });
  if (trim) low.part.block(0.05, 0.05, width * 1.08, trim, { y: -h2 + 0.03, bevel: 0.01 });
}

/** A plume or crest that stands up from a helmet and trails in the wind. */
export function plume(rig: RigBuilder, head: string, color: ColorLike, x: number, y: number, size = 1, z = 0): void {
  const s = sway(rig, 'U', head, x, y, z);
  s.part.capsule(0.06 * size, 0.22 * size, color, { x: -0.05 * size, y: 0.14 * size, rz: 0.45, seg: 6 });
  s.part.capsule(0.05 * size, 0.18 * size, shade(color, 0.12), { x: -0.14 * size, y: 0.22 * size, rz: 0.9, seg: 6 });
}

/** A small pennant on a pole or lance, flying back along −x from (x, y). */
export function pennant(rig: RigBuilder, parent: string, color: ColorLike, x: number, y: number, len = 0.5, drop = 0.22, z = 0): void {
  const a = sway(rig, 'F', parent, x, y, z);
  a.part.extrude([[0, 0], [-len * 0.55, -0.01], [-len * 0.55, -drop], [0, -drop]], 0.015, color);
  const b = sway(rig, 'F', a.name, -len * 0.55, 0, 0);
  b.part.extrude([[0, -0.01], [-len * 0.45, -drop * 0.5], [0, -drop]], 0.015, shade(color, -0.1));
}

// ─── Melee (−y from grip) ───────────────────────────────────────────────────

export function club(p: Part): void {
  p.cyl(0.035, 0.045, 0.62, C.wood, { y: -0.22, seg: 6 });
  for (let i = 0; i < 3; i++) p.cyl(0.05, 0.05, 0.03, C.leather, { y: 0.02 - i * 0.05, seg: 6 });
  p.ico(0.13, C.woodDark, { y: -0.56, s: [1, 1.3, 1] });
  p.ico(0.07, shade(C.woodDark, 0.1), { y: -0.46, x: -0.06, z: 0.05 });
  p.cone(0.035, 0.12, C.bone, { y: -0.56, z: 0.13, rx: HALF_PI });
  p.cone(0.035, 0.12, C.bone, { y: -0.6, x: 0.13, rz: -HALF_PI });
  p.cone(0.03, 0.1, C.bone, { y: -0.68, x: -0.1, rz: HALF_PI + 0.4 });
}

export function sword(p: Part, length = 0.78, blade: ColorLike = C.steel, guard: ColorLike = C.iron): void {
  p.cyl(0.028, 0.032, 0.2, C.leatherDark, { y: 0.04, seg: 6 });
  p.ico(0.048, guard, { y: 0.17, ...METAL });
  p.block(0.09, 0.05, 0.34, guard, { y: -0.08, bevel: 0.015, ...METAL });
  p.block(0.08, length, 0.025, blade, { y: -0.1 - length / 2, taper: [1.12, 1], bevel: 0.008, ...METAL });
  p.box(0.022, length * 0.8, 0.028, shade(blade, -0.3), { y: -0.14 - length * 0.4, ...METAL });
  p.cone(0.04, 0.14, blade, { y: -0.17 - length, rz: Math.PI, s: [1, 1, 0.33], ...METAL });
}

export function sabre(p: Part): void {
  p.cyl(0.028, 0.03, 0.18, C.leatherDark, { y: 0.04, seg: 6 });
  p.torus(0.085, 0.014, C.gold, { y: -0.02, x: 0.05, arc: Math.PI, ...METAL });
  p.block(0.06, 0.05, 0.14, C.gold, { y: -0.06, bevel: 0.01, ...METAL });
  for (let i = 0; i < 6; i++) {
    p.block(0.065 - i * 0.004, 0.16, 0.02, C.steel, { y: -0.14 - i * 0.14, x: i * i * 0.007, rz: i * 0.055, bevel: 0.005, ...METAL });
  }
}

export function axe(p: Part): void {
  p.cyl(0.035, 0.04, 0.9, C.wood, { y: -0.35, seg: 6 });
  p.extrude([[0, 0.12], [0.26, 0.2], [0.3, -0.12], [0, -0.06]], 0.035, C.steel, { y: -0.72, x: 0.03, bevel: 0.01, ...METAL });
}

// ─── Thrust (+x) ────────────────────────────────────────────────────────────

/** A spear: shaft, bound leaf blade and a butt spike. */
export function spear(p: Part, length = 2.0, tip: ColorLike = C.bronze, back = 0.6): void {
  p.cyl(0.026, 0.03, length, C.wood, { x: length / 2 - back, rz: HALF_PI, seg: 6 });
  const tx = length - back;
  p.hull([[tx - 0.04, 0, 0.018], [tx - 0.04, 0, -0.018], [tx + 0.08, 0.06, 0], [tx + 0.08, -0.06, 0], [tx + 0.34, 0, 0]], tip, METAL);
  p.cyl(0.036, 0.03, 0.08, C.rope, { x: tx - 0.07, rz: HALF_PI, seg: 6 });
  p.cone(0.032, 0.14, tip, { x: -back - 0.05, rz: HALF_PI, ...METAL });
}

export function lance(p: Part): void {
  p.cone(0.09, 2.6, C.woodLight, { x: 1.2, rz: -HALF_PI, seg: 8 });
  for (let i = 0; i < 4; i++) p.cyl(0.075 - i * 0.012, 0.075 - i * 0.012, 0.05, C.wood, { x: 0.4 + i * 0.45, rz: HALF_PI, seg: 8 });
  p.cone(0.18, 0.28, C.steel, { x: 0.05, rz: -HALF_PI, seg: 10, ...METAL });
  p.cyl(0.05, 0.06, 0.3, C.leatherDark, { x: -0.22, rz: HALF_PI, seg: 6 });
  p.cone(0.035, 0.12, C.steel, { x: 2.55, rz: -HALF_PI, ...METAL });
}

export function rapier(p: Part): void {
  p.cyl(0.025, 0.028, 0.16, C.leatherDark, { x: -0.06, rz: HALF_PI, seg: 6 });
  p.ico(0.035, C.gold, { x: -0.16, ...METAL });
  p.dome(0.09, C.gold, { x: 0.04, rz: -HALF_PI, ...METAL });
  p.block(0.03, 0.03, 0.28, C.gold, { x: 0.05, bevel: 0.01, ...METAL });
  p.torus(0.07, 0.01, C.gold, { x: 0.0, y: 0.02, rz: 0.4, arc: Math.PI, ...METAL });
  p.block(0.95, 0.02, 0.016, C.steel, { x: 0.55, taper: [1, 1], bevel: 0.005, ...METAL });
}

export function bayonetRifle(p: Part, wood: ColorLike = C.wood): void {
  p.block(1.15, 0.07, 0.055, wood, { x: 0.25, bevel: 0.015 });
  p.block(0.32, 0.13, 0.05, wood, { x: -0.4, y: -0.035, rz: 0.12, taper: [1, 0.9], bevel: 0.015 });
  p.cyl(0.018, 0.018, 0.7, C.gunmetal, { x: 0.55, y: 0.045, rz: HALF_PI, seg: 6, ...METAL });
  for (const x of [0.35, 0.72]) p.block(0.03, 0.09, 0.065, C.gunmetal, { x, y: 0.01, bevel: 0.008, ...METAL });
  p.block(0.12, 0.05, 0.05, C.gunmetal, { x: 0.02, y: 0.06, bevel: 0.01, ...METAL });
  p.cyl(0.012, 0.012, 0.07, C.gunmetal, { x: 0.02, y: 0.08, z: 0.04, rx: HALF_PI, ...METAL });
  p.tube([[-0.45, -0.05, 0.03], [0.1, -0.12, 0.035], [0.6, -0.03, 0.03]], 0.012, C.leather, { seg: 6 });
  p.block(0.4, 0.035, 0.012, C.steel, { x: 1.05, y: 0.02, taper: [0.3, 1], ...METAL });
}

// ─── Throwing ───────────────────────────────────────────────────────────────

export function throwingSpear(p: Part, tip: ColorLike = C.flint): void {
  p.cyl(0.024, 0.026, 1.6, C.woodLight, { x: -0.3, rz: HALF_PI, seg: 6 });
  p.hull([[-1.08, 0, 0.02], [-1.08, 0, -0.02], [-1.16, 0.055, 0], [-1.16, -0.055, 0], [-1.36, 0, 0]], tip, { r: 0.5 });
  p.cyl(0.034, 0.034, 0.07, C.rope, { x: -1.06, rz: HALF_PI, seg: 6 });
  p.extrude([[0, 0], [0.14, 0.05], [0.14, -0.05]], 0.01, C.bone, { x: 0.38 });
}

export function sling(p: Part): void {
  p.tube([[0, 0, 0], [0.04, -0.14, 0.02], [0.02, -0.3, 0], [0, -0.38, 0]], 0.012, C.rope);
  p.sphere(0.07, C.leather, { y: -0.4 });
  p.ico(0.06, C.stone, { y: -0.4, z: 0.03 });
}

// ─── Bows ───────────────────────────────────────────────────────────────────

/**
 * A bow whose string is two joints meeting at the nock, plus a nocked arrow,
 * so the archer's draw bends it for real (see rig.ts, style 'bow'). The grip
 * sits in the hand; the limbs curve back to tips at x = −depth.
 */
export function drawnBow(rig: RigBuilder, weapon: string, prefix: string, color: ColorLike = C.woodDark, size = 0.62, fletch: ColorLike = C.linen): void {
  const p = rig.part(weapon);
  const depth = 0.16;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = -1 + (i / 10) * 2;
    pts.push([-depth * t * t + 0.02 * Math.abs(t * t * t), t * size, 0]);
  }
  p.tube(pts, 0.026, color, { seg: 18 });
  p.block(0.07, 0.16, 0.06, C.leather, { bevel: 0.015 });
  for (const s of [1, -1]) p.cone(0.03, 0.06, C.bone, { x: -depth + 0.02, y: s * (size + 0.03), rz: s > 0 ? 0 : Math.PI });

  const top = rig.joint(`${prefix}bowT`, weapon, -depth + 0.02, size, 0);
  top.cyl(0.006, 0.006, size, C.linen, { y: -size / 2, seg: 4 });
  const bottom = rig.joint(`${prefix}bowB`, weapon, -depth + 0.02, -size, 0);
  bottom.cyl(0.006, 0.006, size, C.linen, { y: size / 2, seg: 4 });
  const arrow = rig.joint(`${prefix}bowArrow`, weapon, -depth + 0.02, 0, 0.02);
  arrow.cyl(0.011, 0.011, 0.78, C.woodLight, { x: 0.37, rz: HALF_PI, seg: 5 });
  arrow.cone(0.028, 0.09, C.iron, { x: 0.8, rz: -HALF_PI, seg: 4, ...METAL });
  arrow.extrude([[0, 0], [0.14, 0.035], [0.16, 0]], 0.008, fletch, { x: 0.02 });
  arrow.extrude([[0, 0], [0.14, -0.035], [0.16, 0]], 0.008, fletch, { x: 0.02 });
}

export function crossbow(p: Part): void {
  p.block(0.74, 0.08, 0.07, C.wood, { x: 0.12, bevel: 0.015 });
  p.block(0.24, 0.13, 0.065, C.woodDark, { x: -0.24, y: -0.05, rz: 0.1, bevel: 0.02 });
  p.block(0.06, 0.05, 0.74, C.iron, { x: 0.44, taper: [1, 0.9], bevel: 0.01, ...METAL });
  p.torus(0.06, 0.012, C.iron, { x: 0.53, ry: HALF_PI, arc: Math.PI, rz: -HALF_PI, ...METAL });
  p.tube([[0.44, 0, 0.37], [0.16, 0.03, 0], [0.44, 0, -0.37]], 0.006, C.linen, { seg: 2 });
  p.block(0.03, 0.08, 0.02, C.iron, { x: -0.04, y: -0.07, ...METAL });
  p.cyl(0.03, 0.03, 0.09, C.iron, { x: 0.05, y: 0.02, z: 0.06, rx: HALF_PI, seg: 6, ...METAL });
}

/** A crossbow bolt, as a separate 'ammo' joint that vanishes when loosed. */
export function crossbowBolt(p: Part): void {
  p.cyl(0.012, 0.012, 0.38, C.woodLight, { x: 0.15, rz: HALF_PI, seg: 5 });
  p.cone(0.025, 0.07, C.iron, { x: 0.37, rz: -HALF_PI, seg: 4, ...METAL });
}

// ─── Guns (+x) ──────────────────────────────────────────────────────────────

export function musket(p: Part): void {
  p.block(0.95, 0.075, 0.06, C.wood, { x: 0.2, bevel: 0.015 });
  p.block(0.36, 0.14, 0.055, C.wood, { x: -0.41, y: -0.035, rz: 0.1, taper: [1, 0.9], bevel: 0.02 });
  p.cyl(0.02, 0.023, 1.05, C.iron, { x: 0.55, y: 0.05, rz: HALF_PI, seg: 6, ...METAL });
  for (const x of [0.4, 0.75]) p.cyl(0.03, 0.03, 0.03, C.brass, { x, y: 0.035, rz: HALF_PI, seg: 6, ...METAL });
  p.block(0.1, 0.06, 0.03, C.gold, { x: -0.05, y: 0.06, z: 0.02, bevel: 0.01, ...METAL });
  p.block(0.03, 0.07, 0.02, C.iron, { x: -0.1, y: 0.1, z: 0.02, rz: -0.5, ...METAL });
  p.cyl(0.008, 0.008, 0.8, C.woodDark, { x: 0.45, y: -0.01, z: 0.035, rz: HALF_PI, seg: 4 });
  p.tube([[-0.42, -0.07, 0.03], [0.05, -0.14, 0.035], [0.55, -0.02, 0.03]], 0.012, C.leather, { seg: 6 });
  p.block(0.42, 0.025, 0.012, C.steel, { x: 1.25, y: 0.03, taper: [0.3, 1], ...METAL });
}

export function boltRifle(p: Part): void {
  p.block(0.9, 0.07, 0.055, C.wood, { x: 0.18, bevel: 0.015 });
  p.block(0.3, 0.12, 0.05, C.wood, { x: -0.36, y: -0.03, rz: 0.1, bevel: 0.015 });
  p.cyl(0.018, 0.018, 0.55, C.gunmetal, { x: 0.55, y: 0.04, rz: HALF_PI, seg: 6, ...METAL });
}

export function lewisGun(p: Part): void {
  p.cyl(0.075, 0.075, 0.8, C.gunmetal, { x: 0.38, rz: HALF_PI, seg: 10, ...METAL });
  for (let i = 0; i < 6; i++) p.cyl(0.085, 0.085, 0.025, shade(C.gunmetal, -0.2), { x: 0.1 + i * 0.12, rz: HALF_PI, seg: 10, ...METAL });
  p.cyl(0.05, 0.075, 0.1, C.gunmetal, { x: 0.83, rz: -HALF_PI, seg: 10, ...METAL });
  p.cyl(0.022, 0.022, 0.14, C.black, { x: 0.93, rz: HALF_PI, seg: 6, ...METAL });
  p.cyl(0.18, 0.18, 0.06, C.black, { x: 0.02, y: 0.13, seg: 14, ...METAL });
  p.cyl(0.05, 0.05, 0.07, C.gunmetal, { x: 0.02, y: 0.17, seg: 8, ...METAL });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.box(0.14, 0.066, 0.01, shade(C.black, 0.15), { x: 0.02 + Math.cos(a) * 0.09, y: 0.13, z: Math.sin(a) * 0.09, ry: -a });
  }
  p.block(0.38, 0.1, 0.06, C.wood, { x: -0.26, y: -0.04, taper: [1, 0.9], bevel: 0.02 });
  p.block(0.08, 0.15, 0.05, C.wood, { x: 0.02, y: -0.1, rz: -0.15, bevel: 0.015 });
  p.cyl(0.012, 0.012, 0.36, C.black, { x: 0.72, y: -0.16, z: 0.06, rz: 0.4, seg: 4 });
  p.cyl(0.012, 0.012, 0.36, C.black, { x: 0.72, y: -0.16, z: -0.06, rz: 0.4, seg: 4 });
}

export function flamethrower(p: Part, glow: ColorLike = '#ff9b3a'): void {
  p.cyl(0.035, 0.035, 0.9, C.iron, { x: 0.3, rz: HALF_PI, seg: 8, ...METAL });
  p.cyl(0.055, 0.04, 0.18, C.black, { x: 0.8, rz: HALF_PI, seg: 8, ...METAL });
  p.cyl(0.05, 0.05, 0.22, '#6b6f5e', { x: 0.45, y: -0.07, rz: HALF_PI, seg: 8, m: 0.5, r: 0.5 });
  p.block(0.12, 0.17, 0.06, C.iron, { x: -0.05, y: -0.08, rz: -0.1, bevel: 0.015, ...METAL });
  p.block(0.1, 0.14, 0.05, C.iron, { x: 0.42, y: -0.1, rz: -0.2, bevel: 0.015, ...METAL });
  p.block(0.06, 0.04, 0.05, C.brass, { x: 0.25, y: 0.04, ...METAL });
  p.sphere(0.04, glow, { x: 0.9, e: 3 });
  p.sphere(0.02, '#ffe7a0', { x: 0.84, y: -0.05, e: 4 });
}

export function carbine(p: Part, accent: ColorLike = C.black): void {
  p.block(0.44, 0.11, 0.06, C.black, { x: 0.12, bevel: 0.015, m: 0.4, r: 0.5 });
  p.block(0.36, 0.08, 0.075, accent, { x: 0.47, bevel: 0.015, m: 0.3, r: 0.55 });
  for (let i = 0; i < 4; i++) p.box(0.04, 0.015, 0.08, shade(accent, -0.25), { x: 0.34 + i * 0.08, y: 0.045 });
  p.cyl(0.018, 0.018, 0.28, C.black, { x: 0.77, rz: HALF_PI, seg: 6, ...METAL });
  p.cyl(0.028, 0.028, 0.08, C.black, { x: 0.88, rz: HALF_PI, seg: 6, ...METAL });
  p.block(0.26, 0.1, 0.05, C.black, { x: -0.25, y: -0.02, rz: 0.08, taper: [1, 0.9], bevel: 0.02 });
  p.block(0.08, 0.2, 0.05, C.black, { x: 0.2, y: -0.14, rz: -0.25, bevel: 0.015 });
  p.block(0.06, 0.13, 0.045, C.black, { x: -0.02, y: -0.1, rz: -0.3, bevel: 0.015 });
  p.block(0.16, 0.08, 0.075, C.gunmetal, { x: 0.1, y: 0.1, bevel: 0.02, ...METAL });
  p.block(0.02, 0.05, 0.05, '#7cf', { x: 0.19, y: 0.1, e: 0.9 });
  p.block(0.07, 0.04, 0.04, C.gunmetal, { x: 0.46, y: -0.06, bevel: 0.01, ...METAL });
}

export function sniperRifle(p: Part): void {
  p.block(0.82, 0.09, 0.06, '#4b513d', { x: 0.15, bevel: 0.02 });
  p.cyl(0.021, 0.021, 0.75, C.black, { x: 0.9, rz: HALF_PI, seg: 6, ...METAL });
  p.block(0.1, 0.05, 0.05, C.black, { x: 1.3, bevel: 0.01, ...METAL });
  p.cyl(0.045, 0.04, 0.4, C.black, { x: 0.12, y: 0.13, rz: HALF_PI, seg: 8, ...METAL });
  p.cyl(0.052, 0.052, 0.07, C.black, { x: 0.33, y: 0.13, rz: HALF_PI, seg: 8, ...METAL });
  p.cyl(0.046, 0.046, 0.01, '#9ef', { x: 0.37, y: 0.13, rz: HALF_PI, e: 1.2 });
  for (const x of [0.02, 0.22]) p.block(0.03, 0.05, 0.04, C.black, { x, y: 0.08, ...METAL });
  p.cyl(0.012, 0.012, 0.08, C.black, { x: -0.02, y: 0.05, z: 0.05, rx: HALF_PI, seg: 4, ...METAL });
  p.sphere(0.02, C.black, { x: -0.02, y: 0.05, z: 0.09, ...METAL });
  p.block(0.34, 0.14, 0.05, '#4b513d', { x: -0.37, y: -0.03, taper: [1, 0.85], bevel: 0.02 });
  p.block(0.1, 0.05, 0.055, '#3a3f30', { x: -0.3, y: 0.05, bevel: 0.015 });
  p.cyl(0.01, 0.012, 0.3, C.black, { x: 0.72, y: -0.13, z: 0.05, rz: 0.45, seg: 4 });
  p.cyl(0.01, 0.012, 0.3, C.black, { x: 0.72, y: -0.13, z: -0.05, rz: 0.45, seg: 4 });
}

/** A shoulder-fired launcher: the tube rides above the grip, so it sits on the shoulder. */
export function launcherTube(p: Part, accent: ColorLike): void {
  const y = 0.14;
  p.cyl(0.085, 0.085, 1.25, '#55613f', { x: 0.2, y, rz: HALF_PI, seg: 10 });
  for (const x of [-0.25, 0.6]) p.cyl(0.095, 0.095, 0.08, '#44503a', { x, y, rz: HALF_PI, seg: 10 });
  p.cyl(0.11, 0.085, 0.14, C.black, { x: 0.85, y, rz: HALF_PI, seg: 10 });
  p.cyl(0.085, 0.11, 0.12, C.black, { x: -0.44, y, rz: HALF_PI, seg: 10 });
  p.block(0.2, 0.15, 0.13, C.black, { x: 0.05, y: y + 0.13, bevel: 0.02 });
  p.block(0.05, 0.05, 0.05, accent, { x: 0.13, y: y + 0.17, e: 1.5 });
  p.block(0.07, 0.17, 0.05, C.black, { x: 0.0, y: 0.0, rz: -0.15, bevel: 0.015 });
  p.block(0.06, 0.13, 0.05, C.black, { x: 0.3, y: 0.02, bevel: 0.015 });
}

/** A launcher's loaded warhead, as a separate 'ammo' joint at the muzzle. */
export function rocketWarhead(p: Part): void {
  p.cone(0.075, 0.26, '#6d7454', { x: 0.13, rz: -HALF_PI, seg: 8 });
  p.cyl(0.075, 0.075, 0.08, '#4d523c', { x: -0.04, rz: HALF_PI, seg: 8 });
}

export function plasmaRifle(p: Part, glow: ColorLike): void {
  p.block(0.62, 0.13, 0.08, C.white, { x: 0.2, bevel: 0.03, m: 0.2, r: 0.3 });
  p.block(0.42, 0.06, 0.1, C.carbon, { x: 0.28, y: -0.07, bevel: 0.015, m: 0.5, r: 0.35 });
  p.cyl(0.04, 0.05, 0.3, C.carbon, { x: 0.62, rz: HALF_PI, seg: 8, m: 0.6, r: 0.3 });
  for (let i = 0; i < 3; i++) p.torus(0.055, 0.014, glow, { x: 0.52 + i * 0.08, ry: HALF_PI, e: 3 });
  p.box(0.3, 0.025, 0.09, glow, { x: 0.15, y: 0.07, e: 2 });
  p.block(0.22, 0.12, 0.06, C.white, { x: -0.22, y: -0.02, taper: [1, 0.9], bevel: 0.02 });
  p.block(0.07, 0.15, 0.05, C.carbon, { x: 0.05, y: -0.12, rz: -0.25, bevel: 0.015 });
  p.block(0.1, 0.06, 0.06, C.carbon, { x: 0.12, y: 0.1, bevel: 0.015 });
}

export function railgun(p: Part, glow: ColorLike): void {
  p.block(0.52, 0.2, 0.14, C.carbon, { x: 0.05, bevel: 0.03, m: 0.5, r: 0.35 });
  p.block(1.35, 0.05, 0.05, C.steel, { x: 0.75, y: 0.065, bevel: 0.01, ...METAL });
  p.block(1.35, 0.05, 0.05, C.steel, { x: 0.75, y: -0.065, bevel: 0.01, ...METAL });
  for (let i = 0; i < 5; i++) p.block(0.06, 0.2, 0.12, glow, { x: 0.25 + i * 0.25, e: 2.2, bevel: 0.01 });
  p.block(0.26, 0.16, 0.08, C.carbon, { x: -0.31, y: -0.04, bevel: 0.02 });
  p.block(0.08, 0.16, 0.06, C.carbon, { x: 0.1, y: -0.15, rz: -0.2, bevel: 0.015 });
  p.cyl(0.02, 0.02, 0.4, C.black, { x: -0.1, y: -0.02, z: -0.09, rz: HALF_PI, seg: 5 });
}

// ─── Staves (+y) ────────────────────────────────────────────────────────────

export function sunStaff(p: Part, glow: ColorLike = C.gold): void {
  p.cyl(0.026, 0.03, 1.7, C.woodDark, { y: 0.2, seg: 6 });
  for (let i = 0; i < 3; i++) p.cyl(0.035, 0.035, 0.03, C.gold, { y: 0.8 - i * 0.06, seg: 6, ...METAL });
  p.torus(0.16, 0.025, C.gold, { y: 1.14, ...METAL });
  p.cyl(0.12, 0.12, 0.035, glow, { y: 1.14, rx: HALF_PI, e: 1.6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.cone(0.025, 0.1, C.gold, { x: Math.cos(a) * 0.22, y: 1.14 + Math.sin(a) * 0.22, rz: a - HALF_PI, ...METAL });
  }
  p.cone(0.05, 0.12, C.gold, { y: 1.42, ...METAL });
}

// ─── Shields (forearm frame; face toward +z on the near arm) ───────────────

export function roundShield(p: Part, near: boolean, face: ColorLike, rim: ColorLike = C.bronze, emblem?: ColorLike): void {
  const z = near ? 0.14 : -0.14;
  const out = near ? 1 : -1;
  p.cyl(0.42, 0.4, 0.07, face, { x: 0.06, y: -0.1, z, rx: HALF_PI, seg: 14 });
  p.torus(0.41, 0.035, rim, { x: 0.06, y: -0.1, z: z + out * 0.02, rs: 5, ts: 16, ...METAL });
  p.sphere(0.07, rim, { x: 0.06, y: -0.1, z: z + out * 0.05, s: [1, 1, 0.6], ...METAL });
  if (emblem) p.cyl(0.16, 0.16, 0.02, emblem, { x: 0.06, y: -0.1, z: z + out * 0.04, rx: HALF_PI, seg: 10 });
}

export function kiteShield(p: Part, near: boolean, face: ColorLike, stripe: ColorLike): void {
  const z = near ? 0.14 : -0.14;
  const out = near ? 1 : -1;
  const outline: [number, number][] = [[0, 0.36], [0.22, 0.28], [0.2, -0.05], [0, -0.48], [-0.2, -0.05], [-0.22, 0.28]];
  p.extrude(outline, 0.06, face, { x: 0.06, y: -0.06, z, bevel: 0.015 });
  p.box(0.08, 0.8, 0.02, stripe, { x: 0.06, y: -0.1, z: z + out * 0.05 });
  p.box(0.4, 0.08, 0.02, stripe, { x: 0.06, y: 0.1, z: z + out * 0.05 });
  p.sphere(0.045, C.iron, { x: 0.06, y: 0.1, z: z + out * 0.06, s: [1, 1, 0.6], ...METAL });
}

export function heaterShield(p: Part, near: boolean, face: ColorLike, charge: ColorLike): void {
  const z = near ? 0.14 : -0.14;
  const out = near ? 1 : -1;
  const outline: [number, number][] = [[-0.22, 0.24], [0.22, 0.24], [0.2, -0.05], [0, -0.3], [-0.2, -0.05]];
  p.extrude(outline, 0.05, face, { x: 0.06, y: -0.1, z, bevel: 0.015 });
  p.extrude([[-0.1, 0.12], [0.1, 0.12], [0.08, -0.02], [0, -0.14], [-0.08, -0.02]], 0.02, charge, {
    x: 0.06, y: -0.1, z: z + out * 0.045,
  });
}

// ─── Headgear (head frame) ──────────────────────────────────────────────────

export function corinthianHelmet(p: Part, crest: ColorLike): void {
  p.dome(0.245, C.bronze, { y: 0.22, s: [1.02, 1.12, 1], ws: 12, ...METAL });
  p.block(0.14, 0.28, 0.44, C.bronze, { x: 0.12, y: 0.12, taper: [1, 1.05], bevel: 0.03, ...METAL });
  p.block(0.3, 0.22, 0.46, C.bronze, { x: -0.05, y: 0.1, bevel: 0.04, ...METAL });
  p.block(0.07, 0.05, 0.46, '#1b1612', { x: 0.175, y: 0.25 });
  p.block(0.07, 0.16, 0.05, C.bronze, { x: 0.2, y: 0.14, bevel: 0.01, ...METAL });
  p.block(0.07, 0.14, 0.03, '#1b1612', { x: 0.18, y: 0.07, z: 0.06 });
  p.block(0.07, 0.14, 0.03, '#1b1612', { x: 0.18, y: 0.07, z: -0.06 });
  p.block(0.5, 0.06, 0.12, shade(C.bronze, -0.25), { x: -0.05, y: 0.47, bevel: 0.015, ...METAL });
  p.block(0.56, 0.2, 0.09, crest, { x: -0.06, y: 0.58, taper: [0.85, 0.8], bevel: 0.03 });
  p.block(0.14, 0.34, 0.07, crest, { x: -0.32, y: 0.42, bevel: 0.02 });
}

export function kettleHelm(p: Part): void {
  p.dome(0.24, C.steel, { y: 0.26, s: [1, 0.95, 1], ws: 12, ...METAL });
  p.cyl(0.36, 0.34, 0.03, C.steel, { y: 0.26, seg: 14, ...METAL });
  p.torus(0.36, 0.015, shade(C.steel, -0.25), { y: 0.25, rx: HALF_PI, ts: 20, ...METAL });
  p.block(0.03, 0.05, 0.24, shade(C.steel, -0.2), { y: 0.48, ...METAL });
  p.tube([[0.02, 0.26, 0.2], [0.1, 0.05, 0.17], [0.13, 0.02, 0]], 0.01, C.leatherDark, { seg: 4 });
}

export function nasalHelm(p: Part): void {
  p.cone(0.25, 0.3, C.steel, { y: 0.43, seg: 10, ...METAL });
  p.cyl(0.245, 0.245, 0.14, C.steel, { y: 0.28, seg: 10, ...METAL });
  p.cyl(0.255, 0.255, 0.04, shade(C.steel, -0.2), { y: 0.22, seg: 10, ...METAL });
  p.block(0.04, 0.22, 0.05, C.steel, { x: 0.24, y: 0.17, bevel: 0.01, ...METAL });
  p.dome(0.27, C.iron, { y: 0.12, rz: Math.PI, s: [1, 0.75, 1.02], m: 0.6, r: 0.55 });
  p.cyl(0.26, 0.3, 0.12, C.iron, { y: 0.0, seg: 10, m: 0.6, r: 0.55 });
}

export function greatHelm(p: Part, plumeColor: ColorLike): void {
  p.cyl(0.24, 0.25, 0.42, C.steel, { y: 0.2, seg: 10, ...METAL });
  p.dome(0.24, C.steel, { y: 0.41, s: [1, 0.4, 1], ...METAL });
  p.block(0.05, 0.035, 0.42, '#101215', { x: 0.23, y: 0.27 });
  p.block(0.05, 0.24, 0.035, '#101215', { x: 0.235, y: 0.14 });
  p.block(0.05, 0.03, 0.44, C.gold, { x: 0.235, y: 0.33, ...METAL });
  for (let i = 0; i < 3; i++) p.sphere(0.012, '#101215', { x: 0.24, y: 0.08 - i * 0.04, z: 0.1 });
  p.cone(0.12, 0.35, plumeColor, { y: 0.62, x: -0.05, s: [1.3, 1, 0.7] });
}

export function morion(p: Part, plumeColor: ColorLike): void {
  p.dome(0.23, C.steel, { y: 0.28, ws: 12, ...METAL });
  p.extrude([[-0.4, 0], [-0.25, 0.08], [0.25, 0.08], [0.4, 0], [0.25, 0.03], [-0.25, 0.03]], 0.48, C.steel, { y: 0.25, ...METAL });
  p.extrude([[-0.22, 0], [0, 0.22], [0.22, 0]], 0.035, C.steel, { y: 0.44, bevel: 0.01, ...METAL });
  p.box(0.08, 0.2, 0.05, plumeColor, { x: -0.18, y: 0.55, rz: 0.3 });
}

export function cavalierHat(p: Part, plumeColor: ColorLike): void {
  p.cyl(0.4, 0.38, 0.03, C.black, { y: 0.35, rz: 0.12, seg: 16 });
  p.cyl(0.17, 0.2, 0.2, C.black, { y: 0.45, seg: 10 });
  p.cyl(0.205, 0.205, 0.04, C.gold, { y: 0.37, seg: 10, ...METAL });
  p.capsule(0.075, 0.42, plumeColor, { x: -0.12, y: 0.52, z: 0.14, rz: 1.1, e: 0.1 });
  p.capsule(0.05, 0.3, shade(plumeColor, -0.15), { x: -0.26, y: 0.46, z: 0.16, rz: 1.5 });
}

export function tricorn(p: Part, trim: ColorLike = C.gold): void {
  p.cone(0.36, 0.2, C.black, { y: 0.44, seg: 3, ry: Math.PI / 2 });
  p.cyl(0.19, 0.2, 0.12, C.black, { y: 0.4, seg: 10 });
  p.torus(0.3, 0.015, trim, { y: 0.36, rx: HALF_PI, ts: 3, ...METAL });
  p.cyl(0.05, 0.05, 0.02, '#f3efe6', { x: 0.2, y: 0.45, z: 0.16, rx: HALF_PI, rz: 0.4, seg: 8 });
}

export function cuirassierHelm(p: Part, crest: ColorLike): void {
  p.dome(0.24, C.steel, { y: 0.27, s: [1, 1.1, 1], ws: 12, ...METAL });
  p.block(0.36, 0.06, 0.07, C.gold, { y: 0.53, bevel: 0.015, ...METAL });
  p.block(0.46, 0.15, 0.06, crest, { x: -0.12, y: 0.57, rz: -0.3, bevel: 0.02 });
  p.block(0.18, 0.03, 0.42, C.black, { x: 0.18, y: 0.22, bevel: 0.01 });
  p.block(0.1, 0.18, 0.05, C.steel, { x: 0.02, y: 0.12, z: 0.21, bevel: 0.015, ...METAL });
  p.block(0.1, 0.18, 0.05, C.steel, { x: 0.02, y: 0.12, z: -0.21, bevel: 0.015, ...METAL });
}

export function brodieHelmet(p: Part, color: ColorLike = C.olive): void {
  p.cyl(0.36, 0.37, 0.03, color, { y: 0.34, seg: 14, m: 0.4, r: 0.6 });
  p.torus(0.365, 0.012, shade(color, -0.2), { y: 0.34, rx: HALF_PI, ts: 20, m: 0.4, r: 0.6 });
  p.dome(0.22, color, { y: 0.34, s: [1, 0.7, 1], ws: 12, m: 0.4, r: 0.6 });
  p.sphere(0.02, shade(color, -0.2), { y: 0.5 });
  p.tube([[0, 0.34, 0.2], [0.08, 0.12, 0.16], [0.14, 0.06, 0]], 0.01, C.leatherDark, { seg: 4 });
}

export function modernHelmet(p: Part, color: ColorLike, glow: ColorLike): void {
  p.dome(0.255, color, { y: 0.25, s: [1.05, 1, 1.02], ws: 12 });
  p.cyl(0.26, 0.25, 0.08, color, { y: 0.22, seg: 12 });
  p.block(0.24, 0.05, 0.05, C.black, { y: 0.28, z: 0.23 });
  p.block(0.24, 0.05, 0.05, C.black, { y: 0.28, z: -0.23 });
  p.block(0.08, 0.1, 0.1, C.black, { x: 0.22, y: 0.44, bevel: 0.015 });
  p.block(0.14, 0.07, 0.2, C.black, { x: 0.26, y: 0.37, rz: -0.6, bevel: 0.015 });
  p.cyl(0.03, 0.03, 0.07, glow, { x: 0.31, y: 0.33, z: 0.05, rz: HALF_PI, e: 2 });
  p.cyl(0.03, 0.03, 0.07, glow, { x: 0.31, y: 0.33, z: -0.05, rz: HALF_PI, e: 2 });
  p.block(0.1, 0.06, 0.08, C.black, { x: -0.23, y: 0.3, bevel: 0.015 });
  p.tube([[0.02, 0.2, 0.23], [0.1, 0.06, 0.18], [0.15, 0.02, 0]], 0.012, C.black, { seg: 4 });
}

export function gasMask(p: Part, helmetColor: ColorLike = C.olive): void {
  p.sphere(0.215, '#4c4f45', { y: 0.2, s: [1, 1.02, 0.95], ws: 10, hs: 7 });
  for (const z of [0.1, -0.1]) {
    p.cyl(0.06, 0.06, 0.03, C.iron, { x: 0.17, y: 0.26, z, rz: HALF_PI, seg: 10, ...METAL });
    p.cyl(0.05, 0.05, 0.035, '#b7d0c8', { x: 0.175, y: 0.26, z, rz: HALF_PI, seg: 10, e: 0.3 });
  }
  p.cyl(0.07, 0.08, 0.16, C.iron, { x: 0.22, y: 0.08, rz: 1.9, seg: 8, ...METAL });
  p.tube([[0.26, 0.04, 0], [0.2, -0.12, 0.08], [0.02, -0.25, 0.12]], 0.025, '#3a3d34', { seg: 6 });
  brodieHelmet(p, helmetColor);
}

export function boonieHat(p: Part, color: ColorLike): void {
  p.cyl(0.34, 0.36, 0.04, color, { y: 0.34, seg: 12 });
  p.cyl(0.2, 0.23, 0.14, color, { y: 0.42, seg: 12 });
  p.cyl(0.232, 0.232, 0.04, shade(color, -0.2), { y: 0.37, seg: 12 });
}

export function headband(p: Part, color: ColorLike): void {
  p.torus(0.212, 0.035, color, { y: 0.3, rx: HALF_PI, ts: 12 });
}

export function feather(p: Part, color: ColorLike, x = -0.15, y = 0.45): void {
  p.capsule(0.03, 0.22, color, { x, y, rz: 0.5 });
}

export function wildHair(p: Part, color: ColorLike): void {
  p.dome(0.235, color, { y: 0.25, x: -0.03, s: [1.05, 0.95, 1.05], ws: 10 });
  for (let i = 0; i < 6; i++) {
    const a = -1.1 + i * 0.44;
    p.cone(0.07, 0.22, color, { x: -0.1 + Math.sin(a) * 0.05, y: 0.44 + Math.cos(a) * 0.02, z: Math.sin(a) * 0.15, rz: 0.6 + a * 0.2, seg: 5 });
  }
  for (let i = 0; i < 3; i++) p.cone(0.06, 0.2, color, { x: -0.2, y: 0.2 - i * 0.08, z: -0.12 + i * 0.12, rz: 2.4, seg: 5 });
}

export function nemes(p: Part, stripe: ColorLike): void {
  p.dome(0.235, C.linen, { y: 0.24, s: [1, 1, 1.02], ws: 12 });
  p.block(0.12, 0.38, 0.08, stripe, { x: -0.02, y: 0.02, z: 0.22, bevel: 0.02 });
  p.block(0.12, 0.38, 0.08, stripe, { x: -0.02, y: 0.02, z: -0.22, bevel: 0.02 });
  p.block(0.22, 0.32, 0.3, C.linen, { x: -0.18, y: 0.06, taper: [1, 1.1], bevel: 0.03 });
  for (let i = 0; i < 3; i++) p.box(0.012, 0.3, 0.31, stripe, { x: -0.08 - i * 0.07, y: 0.06 });
  p.torus(0.22, 0.02, C.gold, { y: 0.3, rx: HALF_PI, ...METAL });
}

// ─── Kit (torso frame) ──────────────────────────────────────────────────────

export function quiver(p: Part, color: ColorLike = C.leather, fletch: ColorLike = C.linen): void {
  p.cyl(0.085, 0.07, 0.55, color, { x: -0.22, y: 0.36, rz: -0.35, seg: 8 });
  p.cyl(0.09, 0.09, 0.04, shade(color, -0.3), { x: -0.31, y: 0.61, rz: -0.35, seg: 8 });
  for (let i = 0; i < 5; i++) {
    p.cyl(0.008, 0.008, 0.2, C.woodLight, { x: -0.33 + i * 0.015, y: 0.7, z: -0.04 + i * 0.02, rz: -0.35, seg: 4 });
    p.box(0.05, 0.08, 0.006, fletch, { x: -0.37 + i * 0.015, y: 0.8, z: -0.04 + i * 0.02, rz: -0.35 });
  }
  p.tube([[0.17, 0.52, 0.2], [0.05, 0.25, 0.24], [-0.15, 0.02, 0.2]], 0.018, shade(color, -0.2), { seg: 6 });
}

export function sash(p: Part, color: ColorLike, bulk = 1): void {
  p.block(0.35, 0.1, 0.5 * bulk, color, { y: 0.34, rx: 0.55, bevel: 0.02 });
}

export function tabard(p: Part, color: ColorLike, emblem: ColorLike, bulk = 1): void {
  p.block(0.35, 0.72, 0.5 * bulk, color, { y: 0.22, taper: [1, 1.08], bevel: 0.02 });
  p.block(0.36, 0.05, 0.52 * bulk, shade(color, -0.3), { y: -0.12, bevel: 0.01 });
  p.box(0.05, 0.3, 0.06, emblem, { x: 0.02, y: 0.34, z: 0.25 * bulk });
  p.box(0.05, 0.06, 0.2, emblem, { x: 0.02, y: 0.4, z: 0.25 * bulk });
}

export function plateCarrier(p: Part, color: ColorLike, patch: ColorLike, bulk = 1): void {
  p.block(0.42, 0.44, 0.52 * bulk, color, { y: 0.32, bevel: 0.04 });
  for (let i = 0; i < 3; i++) p.block(0.09, 0.13, 0.12, shade(color, -0.2), { x: 0.21, y: 0.2, z: -0.13 + i * 0.13, bevel: 0.02 });
  for (let i = 0; i < 3; i++) p.box(0.1, 0.012, 0.13, shade(color, -0.35), { x: 0.21, y: 0.27, z: -0.13 + i * 0.13 });
  p.block(0.05, 0.08, 0.14, patch, { x: 0.22, y: 0.43, z: 0.1, e: 0.2 });
  p.block(0.44, 0.06, 0.12, shade(color, -0.15), { y: 0.56, z: 0.18 * bulk, bevel: 0.015 });
  p.block(0.44, 0.06, 0.12, shade(color, -0.15), { y: 0.56, z: -0.18 * bulk, bevel: 0.015 });
  p.block(0.07, 0.1, 0.06, C.black, { x: 0.22, y: 0.4, z: -0.15, bevel: 0.015 });
}

export function collar(p: Part, color: ColorLike = C.gold): void {
  p.cyl(0.3, 0.26, 0.06, color, { y: 0.56, seg: 12, ...METAL });
  p.cyl(0.27, 0.27, 0.04, shade(color, -0.2), { y: 0.52, seg: 12, ...METAL });
}

/** A strap across the chest, from one shoulder to the opposite hip. */
export function bandolier(p: Part, color: ColorLike, bulk = 1, pouches?: ColorLike): void {
  p.block(0.36, 0.06, 0.62 * bulk, color, { y: 0.3, rx: 0.8, bevel: 0.015 });
  if (pouches) for (let i = 0; i < 3; i++) p.block(0.06, 0.07, 0.06, pouches, { x: 0.18, y: 0.18 + i * 0.1, z: -0.12 + i * 0.1, bevel: 0.015 });
}

/** Pouches on the belt line. */
export function pouches(p: Part, color: ColorLike, n = 2, y = 0.08, bulk = 1): void {
  for (let i = 0; i < n; i++) {
    const z = (i % 2 ? -1 : 1) * (0.14 + Math.floor(i / 2) * 0.1) * bulk;
    p.block(0.12, 0.13, 0.08, color, { x: 0.1 - Math.floor(i / 2) * 0.12, y, z: z + Math.sign(z) * 0.1, bevel: 0.02 });
    p.block(0.13, 0.04, 0.09, shade(color, -0.2), { x: 0.1 - Math.floor(i / 2) * 0.12, y: y + 0.055, z: z + Math.sign(z) * 0.1, bevel: 0.01 });
  }
}

/** A canteen or water skin at the hip. */
export function canteen(p: Part, color: ColorLike, y = 0.0): void {
  p.cyl(0.08, 0.08, 0.16, color, { x: -0.14, y, z: -0.26, rx: HALF_PI, seg: 8 });
  p.cyl(0.025, 0.025, 0.04, C.black, { x: -0.14, y: y + 0.09, z: -0.26, seg: 6 });
}

export const tex = { METAL, HALF_PI };

export function teamStripe(p: Part, color: ColorLike, o: { x?: number; y?: number; z?: number; w?: number; h?: number; d?: number; e?: number }): void {
  p.box(o.w ?? 0.1, o.h ?? 0.1, o.d ?? 0.1, color, { x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, e: o.e ?? 0 });
}

export function vec(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}
