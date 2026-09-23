import { Part, shade } from '../kit/builder';
import { C } from '../models/gear';

/**
 * Scenery props per age. Each prop is a merged Part, drawn with instancing.
 * `band` says where it may be scattered: near the lane, deep in the
 * background, or on the far skyline.
 */

export type Band = 'near' | 'mid' | 'far' | 'front';

export interface PropDef {
  build: (p: Part) => void;
  weight: number;
  band: Band;
  scale: [number, number];
  /** Random yaw? Buildings keep facing the camera. */
  spin?: boolean;
  shadow?: boolean;
}

const HALF_PI = Math.PI / 2;

// ─── Nature ─────────────────────────────────────────────────────────────────

function pine(p: Part, leaf = '#3f6e3a', trunk = C.woodDark): void {
  p.cyl(0.14, 0.2, 1.4, trunk, { y: 0.7, seg: 6 });
  for (let i = 0; i < 4; i++) p.cone(1.25 - i * 0.24, 1.5, shade(leaf, i * 0.05), { y: 1.5 + i * 0.85, seg: 7 });
}

function roundTree(p: Part, leaf = '#5b8f3e', trunk = C.wood): void {
  p.cyl(0.18, 0.26, 2.0, trunk, { y: 1.0, seg: 6 });
  p.cyl(0.07, 0.1, 0.9, trunk, { y: 2.0, x: 0.35, rz: -0.7, seg: 5 });
  p.ico(1.4, leaf, { y: 3.1, s: [1.1, 0.9, 1] });
  p.ico(0.95, shade(leaf, 0.08), { y: 3.5, x: 0.7, z: 0.3 });
  p.ico(0.9, shade(leaf, -0.08), { y: 2.8, x: -0.8, z: -0.2 });
}

function oliveTree(p: Part): void {
  p.cyl(0.14, 0.24, 1.3, '#6d5a45', { y: 0.65, rz: 0.15, seg: 6 });
  p.cyl(0.1, 0.14, 0.9, '#6d5a45', { y: 1.4, x: 0.25, rz: -0.5, seg: 5 });
  p.ico(1.0, '#8a9a5b', { y: 2.2, x: 0.3, s: [1.3, 0.7, 1.1] });
  p.ico(0.7, '#7c8d52', { y: 2.4, x: -0.5, s: [1.2, 0.7, 1] });
}

function cypress(p: Part): void {
  p.cyl(0.1, 0.14, 0.6, C.woodDark, { y: 0.3 });
  p.sphere(0.55, '#2f5a33', { y: 2.4, s: [1, 3.6, 1], ws: 7, hs: 6 });
}

function deadTree(p: Part): void {
  p.cyl(0.12, 0.24, 3.2, '#4a3f33', { y: 1.6, rz: 0.08, seg: 6 });
  p.cyl(0.05, 0.09, 1.3, '#4a3f33', { y: 2.4, x: 0.45, rz: -0.9, seg: 5 });
  p.cyl(0.04, 0.08, 1.0, '#4a3f33', { y: 2.9, x: -0.35, rz: 0.8, seg: 5 });
}

function stump(p: Part): void {
  p.cyl(0.35, 0.45, 0.5, '#4a3f33', { y: 0.25, seg: 7 });
  p.cyl(0.3, 0.3, 0.02, '#8a7556', { y: 0.51, seg: 7 });
}

function rock(p: Part, color = '#8a857d'): void {
  p.ico(0.9, color, { y: 0.3, s: [1.3, 0.75, 1] });
  p.ico(0.5, shade(color, 0.08), { y: 0.25, x: 0.9, z: 0.3 });
}

function bush(p: Part, leaf = '#4f8a3a'): void {
  p.ico(0.6, leaf, { y: 0.35, s: [1.2, 0.8, 1] });
  p.ico(0.45, shade(leaf, 0.1), { y: 0.35, x: 0.55, z: 0.1 });
  p.ico(0.4, shade(leaf, -0.1), { y: 0.3, x: -0.5, z: -0.1 });
}

function grassTuft(p: Part, color = '#6f9a45'): void {
  for (let i = 0; i < 5; i++) p.cone(0.06, 0.55 + (i % 3) * 0.15, shade(color, (i % 2) * 0.1), { x: (i - 2) * 0.09, y: 0.28, z: (i % 2) * 0.08, rz: (i - 2) * 0.18, seg: 3 });
}

function flowers(p: Part, color: string): void {
  grassTuft(p, '#6f9a45');
  for (let i = 0; i < 3; i++) p.sphere(0.06, color, { x: -0.1 + i * 0.1, y: 0.62, z: i * 0.05 - 0.05, e: 0.1 });
}

// ─── Stone Age ──────────────────────────────────────────────────────────────

function menhir(p: Part): void {
  p.box(0.8, 3.0, 0.6, '#8d8a84', { y: 1.4, rz: 0.05 });
  p.box(0.7, 2.4, 0.55, '#7d7a74', { y: 1.1, x: 1.4, rz: -0.08 });
  p.box(2.4, 0.5, 0.65, '#86837d', { y: 3.05, x: 0.7 });
}

function bones(p: Part): void {
  p.sphere(0.25, C.bone, { y: 0.2, s: [1.2, 0.9, 1] });
  p.box(0.08, 0.08, 0.5, C.bone, { y: 0.05, x: 0.5, ry: 0.4 });
  for (let i = 0; i < 4; i++) p.torus(0.5, 0.05, C.bone, { x: -0.3 - i * 0.3, y: 0.02, ry: HALF_PI, arc: Math.PI, ts: 8 });
}

function volcano(p: Part): void {
  p.cone(14, 16, '#5a4a44', { y: 8, seg: 9 });
  p.cone(4.5, 3, '#3b302c', { y: 16.5, seg: 9 });
  p.cyl(2.2, 2.2, 0.4, '#ff6a2a', { y: 17.8, e: 3, seg: 9 });
}

// ─── Ancient ────────────────────────────────────────────────────────────────

function column(p: Part, broken = false): void {
  p.box(1.1, 0.3, 1.1, '#e3dccb', { y: 0.15 });
  const h = broken ? 2.0 : 4.0;
  p.cyl(0.36, 0.4, h, '#ece6d6', { y: 0.3 + h / 2, seg: 10 });
  if (!broken) p.box(1.0, 0.3, 1.0, '#e3dccb', { y: 4.45 });
  else p.ico(0.45, '#ece6d6', { y: 0.35, x: 1.3, s: [1.6, 0.7, 0.8] });
}

function amphorae(p: Part): void {
  for (let i = 0; i < 3; i++) {
    p.lathe([[0.01, 0], [0.18, 0.1], [0.26, 0.4], [0.16, 0.75], [0.08, 0.85], [0.1, 0.95]], '#b0643a', { x: i * 0.45, z: (i % 2) * 0.3, seg: 8 });
  }
}

function pyramid(p: Part): void {
  p.cone(16, 13, '#d7bd84', { y: 6.5, seg: 4, ry: Math.PI / 4 });
  p.cone(3, 2.4, '#f2d28a', { y: 12, seg: 4, ry: Math.PI / 4, e: 0.2 });
}

function obelisk(p: Part): void {
  p.box(1.4, 0.5, 1.4, '#cdb68a', { y: 0.25 });
  p.cyl(0.35, 0.55, 6, '#d8c294', { y: 3.5, seg: 4, ry: Math.PI / 4 });
  p.cone(0.5, 0.8, C.gold, { y: 6.9, seg: 4, ry: Math.PI / 4, m: 0.8, r: 0.3 });
}

function temple(p: Part): void {
  p.box(9, 0.8, 5, '#e3dccb', { y: 0.4 });
  for (let i = 0; i < 6; i++) p.cyl(0.32, 0.35, 3.6, '#efe9da', { x: -3.6 + i * 1.45, y: 2.6, z: 2.0, seg: 8 });
  p.box(8.2, 3.6, 3.2, '#e6dfcf', { y: 2.6, z: -0.3 });
  p.box(9.2, 0.6, 5.2, '#e3dccb', { y: 4.7 });
  p.extrude([[-4.6, 0], [4.6, 0], [0, 1.6]], 5.2, '#e9e2d2', { y: 5.0 });
}

// ─── Medieval / Gunpowder ───────────────────────────────────────────────────

function hayBale(p: Part): void {
  p.cyl(0.55, 0.55, 1.0, '#d9b45a', { y: 0.55, rx: HALF_PI, seg: 10 });
  p.cyl(0.56, 0.56, 0.1, '#b8923f', { y: 0.55, rx: HALF_PI, seg: 10 });
}

function fence(p: Part): void {
  for (let i = 0; i < 4; i++) p.box(0.14, 1.1, 0.14, C.wood, { x: i * 1.2, y: 0.55 });
  p.box(3.8, 0.1, 0.08, C.woodLight, { x: 1.8, y: 0.8 });
  p.box(3.8, 0.1, 0.08, C.woodLight, { x: 1.8, y: 0.4 });
}

function cottage(p: Part, wall = '#e6dcc3', roof = '#8a4a32'): void {
  p.box(3.2, 2.2, 2.6, wall, { y: 1.1 });
  p.box(3.25, 0.25, 2.65, C.woodDark, { y: 2.2 });
  p.extrude([[-1.9, 0], [1.9, 0], [0, 1.7]], 2.9, roof, { y: 2.2, ry: HALF_PI, s: [1, 1, 1.3] });
  p.box(0.7, 1.2, 0.1, C.woodDark, { y: 0.6, z: 1.31 });
  p.box(0.5, 0.5, 0.1, '#ffd98a', { x: 0.95, y: 1.4, z: 1.31, e: 0.3 });
  p.box(0.4, 1.2, 0.4, '#8d8a84', { x: -1.0, y: 3.4 });
}

function windmill(p: Part): void {
  p.cyl(1.2, 1.7, 6, '#ddd4bd', { y: 3, seg: 8 });
  p.cone(1.5, 1.8, '#7b3f2c', { y: 6.9, seg: 8 });
  p.cyl(0.15, 0.15, 0.8, C.woodDark, { y: 6.2, z: 1.5, rx: HALF_PI });
  for (let i = 0; i < 4; i++) p.box(0.5, 4.2, 0.08, '#efe8d8', { y: 6.2, z: 1.9, rz: (i * Math.PI) / 2 + 0.3, x: 0 });
}

function castleFar(p: Part): void {
  const stone = '#9c968a';
  p.box(14, 6, 5, stone, { y: 3 });
  for (let i = 0; i < 4; i++) p.cyl(1.8, 2, 10, shade(stone, 0.05), { x: -7 + i * 4.7, y: 5, seg: 8 });
  for (let i = 0; i < 4; i++) p.cone(2.2, 3.5, '#5a4f6e', { x: -7 + i * 4.7, y: 11.7, seg: 8 });
  p.cyl(2.4, 2.6, 15, stone, { x: 1.6, y: 7.5, z: -2, seg: 8 });
  p.cone(3, 4.5, '#5a4f6e', { x: 1.6, y: 17.2, z: -2, seg: 8 });
}

function tent(p: Part, cloth = '#e9dfc6'): void {
  p.cone(1.6, 2.2, cloth, { y: 1.1, seg: 6 });
  p.cyl(0.04, 0.04, 2.8, C.woodDark, { y: 1.4 });
  p.box(0.3, 0.2, 0.02, '#c23b32', { y: 2.7, x: 0.15 });
}

function barrels(p: Part): void {
  for (let i = 0; i < 3; i++) {
    p.cyl(0.32, 0.32, 0.8, C.wood, { x: i * 0.7, y: 0.4, z: (i % 2) * 0.3, seg: 8 });
    p.torus(0.33, 0.03, C.iron, { x: i * 0.7, y: 0.6, z: (i % 2) * 0.3, rx: HALF_PI, ts: 10 });
  }
}

function cannonballs(p: Part): void {
  const r = 0.18;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) p.sphere(r, '#2a2d31', { x: j * r * 2 + i * r, y: r + i * r * 1.6, m: 0.8, r: 0.35 });
}

// ─── Industrial ─────────────────────────────────────────────────────────────

function sandbags(p: Part): void {
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5 - row; i++) p.capsule(0.2, 0.5, '#a39570', { x: i * 0.75 + row * 0.37, y: 0.2 + row * 0.33, rz: HALF_PI, s: [1, 1, 0.8] });
  }
}

function barbedWire(p: Part): void {
  for (let i = 0; i < 3; i++) {
    p.box(0.08, 1.1, 0.08, '#4a3f33', { x: i * 1.6, y: 0.55, rz: 0.4 });
    p.box(0.08, 1.1, 0.08, '#4a3f33', { x: i * 1.6, y: 0.55, rz: -0.4 });
  }
  for (let i = 0; i < 6; i++) p.torus(0.35, 0.015, '#8a8a8a', { x: i * 0.55, y: 0.5, ry: HALF_PI, ts: 8, m: 0.7 });
}

function crater(p: Part): void {
  p.torus(1.3, 0.35, '#4a3d2e', { y: 0, rx: HALF_PI, rs: 4, ts: 10, s: [1, 1, 0.6] });
  p.cyl(1.2, 1.0, 0.05, '#2e271f', { y: -0.05, seg: 10 });
}

function chimney(p: Part): void {
  p.box(8, 6, 6, '#7a4a3a', { y: 3 });
  p.box(8.2, 0.4, 6.2, '#5a3a2e', { y: 6.1 });
  for (let i = 0; i < 3; i++) p.cyl(0.6, 0.8, 16, '#8a5040', { x: -2.6 + i * 2.6, y: 8 + i, seg: 8 });
  for (let i = 0; i < 3; i++) p.cyl(0.7, 0.7, 0.4, '#3a2a24', { x: -2.6 + i * 2.6, y: 16 + i, seg: 8 });
  for (let i = 0; i < 6; i++) p.box(0.6, 0.8, 0.05, '#ffcf7a', { x: -3 + i * 1.2, y: 3.5, z: 3.01, e: 0.6 });
}

function telegraphPole(p: Part): void {
  p.cyl(0.1, 0.13, 6, C.woodDark, { y: 3, seg: 6 });
  p.box(1.4, 0.1, 0.1, C.woodDark, { y: 5.6 });
  for (let i = 0; i < 3; i++) p.cyl(0.05, 0.05, 0.12, '#cfd6d9', { x: -0.5 + i * 0.5, y: 5.72 });
}

// ─── Modern ─────────────────────────────────────────────────────────────────

function jersey(p: Part): void {
  p.extrude([[-0.35, 0], [0.35, 0], [0.12, 0.3], [0.1, 0.8], [-0.1, 0.8], [-0.12, 0.3]], 1.8, '#b9b6ad', { ry: HALF_PI });
  p.box(0.02, 0.1, 1.2, '#e8c040', { y: 0.6, x: 0.105, e: 0.3 });
}

function container(p: Part, col: string): void {
  p.box(6, 2.5, 2.4, col, { y: 1.25 });
  for (let i = 0; i < 12; i++) p.box(0.08, 2.3, 2.45, shade(col, -0.15), { x: -2.8 + i * 0.5, y: 1.25 });
}

function streetLamp(p: Part): void {
  p.cyl(0.08, 0.12, 5, '#3a3f45', { y: 2.5, m: 0.6, r: 0.4 });
  p.box(1.0, 0.1, 0.12, '#3a3f45', { y: 5.0, x: 0.45 });
  p.box(0.45, 0.12, 0.3, '#fff2c4', { y: 4.9, x: 0.85, e: 3.5 });
}

function antenna(p: Part): void {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    p.cyl(0.05, 0.05, 12, '#b9bec5', { x: Math.cos(a) * 0.5, y: 6, z: Math.sin(a) * 0.5, m: 0.6 });
  }
  for (let i = 0; i < 6; i++) p.torus(0.5, 0.03, '#b9bec5', { y: 1 + i * 2, rx: HALF_PI, ts: 4, m: 0.6 });
  p.sphere(0.15, '#ff3030', { y: 12.2, e: 4 });
  p.cyl(0.7, 0.7, 0.12, '#dfe3e8', { y: 9, z: 0.6, rx: 1.2 });
}

function skyscraper(p: Part, lit: string, glass: string, h: number): void {
  p.box(6, h, 6, glass, { y: h / 2, m: 0.5, r: 0.25 });
  const floors = Math.floor(h / 1.6);
  for (let f = 1; f < floors; f++) {
    for (let i = 0; i < 4; i++) {
      if ((f * 7 + i * 3) % 5 < 2) continue;
      p.box(0.9, 0.55, 0.05, lit, { x: -2.1 + i * 1.4, y: f * 1.6, z: 3.03, e: 0.45 });
    }
  }
  p.box(6.2, 0.4, 6.2, shade(glass, -0.2), { y: h });
  p.cyl(0.05, 0.05, 4, '#aab', { y: h + 2 });
  p.sphere(0.14, '#ff3a3a', { y: h + 4.05, e: 4 });
}

function cityBlock(p: Part): void {
  skyscraper(p, '#ffd88a', '#3a4658', 22);
  p.merge(buildPart((q) => skyscraper(q, '#9fd8ff', '#2e3a4c', 30)), { x: 7.5, z: -3 });
  p.merge(buildPart((q) => skyscraper(q, '#ffe0a0', '#45505e', 15)), { x: -7, z: -1 });
}

// ─── Age of Intelligence ────────────────────────────────────────────────────

function dataPylon(p: Part): void {
  p.box(0.9, 0.3, 0.9, '#2a3040', { y: 0.15 });
  p.cyl(0.18, 0.3, 4.5, '#1e2330', { y: 2.4, seg: 6, m: 0.6, r: 0.3 });
  p.box(0.06, 4.0, 0.06, '#5ff0ff', { y: 2.4, x: 0.24, e: 1.8 });
  p.ico(0.45, '#b77bff', { y: 5.1, e: 1.6 });
}

function holoTree(p: Part): void {
  p.cyl(0.08, 0.16, 2.6, '#2b3244', { y: 1.3, seg: 6, m: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.box(0.05, 1.3, 0.05, '#4fe3ff', { x: Math.cos(a) * 0.45, y: 2.9, z: Math.sin(a) * 0.45, rz: Math.cos(a) * 0.6, rx: Math.sin(a) * -0.6, e: 1.6 });
    p.sphere(0.1, '#c58bff', { x: Math.cos(a) * 0.85, y: 3.5, z: Math.sin(a) * 0.85, e: 1.8 });
  }
  p.ico(0.35, '#7ef', { y: 3.2, e: 1.6 });
}

function monolith(p: Part): void {
  p.box(1.2, 5, 0.5, '#15181f', { y: 2.5, m: 0.8, r: 0.2 });
  for (let i = 0; i < 6; i++) p.box(1.0, 0.05, 0.52, '#5ff0ff', { y: 0.8 + i * 0.7, e: 2 + (i % 2) });
}

function solarArray(p: Part): void {
  for (let i = 0; i < 3; i++) {
    p.box(1.6, 0.06, 1.0, '#1f3a6b', { x: i * 1.7, y: 1.0, rx: -0.5, m: 0.6, r: 0.2 });
    p.cyl(0.05, 0.05, 1.0, '#8a929c', { x: i * 1.7, y: 0.5 });
  }
}

function neonTower(p: Part, h: number, glow: string): void {
  p.box(4, h, 4, '#12141d', { y: h / 2, m: 0.7, r: 0.25 });
  for (let i = 0; i < 4; i++) p.box(0.1, h * 0.9, 0.1, glow, { x: i % 2 ? 2.02 : -2.02, y: h / 2, z: i < 2 ? 2.02 : -2.02, e: 1.2 });
  for (let f = 1; f < h / 3; f++) p.box(4.05, 0.08, 4.05, f % 3 ? '#1c2030' : glow, { y: f * 3, e: f % 3 ? 0 : 0.9 });
  p.torus(3, 0.1, glow, { y: h * 0.8, rx: HALF_PI, ts: 20, e: 1.6 });
  p.cone(0.8, 5, '#20243a', { y: h + 2.5, seg: 6 });
  p.sphere(0.25, glow, { y: h + 5, e: 5 });
}

function arcology(p: Part): void {
  neonTower(p, 34, '#5ff0ff');
  p.merge(buildPart((q) => neonTower(q, 24, '#c58bff')), { x: 8, z: -4 });
  p.merge(buildPart((q) => neonTower(q, 44, '#ff5fd0')), { x: -7, z: -6 });
}

function buildPart(fn: (p: Part) => void): Part {
  const p = new Part();
  fn(p);
  return p;
}

// ─── Sets ───────────────────────────────────────────────────────────────────

export const PROP_SETS: PropDef[][] = [
  // Stone
  [
    { build: (p) => pine(p, '#3d7040'), weight: 5, band: 'mid', scale: [1, 1.9], spin: true, shadow: true },
    { build: (p) => roundTree(p, '#5c9442'), weight: 3, band: 'mid', scale: [0.9, 1.5], spin: true, shadow: true },
    { build: (p) => rock(p), weight: 3, band: 'mid', scale: [0.6, 1.6], spin: true, shadow: true },
    { build: (p) => bush(p), weight: 4, band: 'near', scale: [0.7, 1.3], spin: true },
    { build: (p) => grassTuft(p), weight: 10, band: 'front', scale: [0.8, 1.4], spin: true },
    { build: (p) => flowers(p, '#ffd24a'), weight: 4, band: 'front', scale: [0.8, 1.2], spin: true },
    { build: menhir, weight: 0.6, band: 'mid', scale: [1, 1.3], shadow: true },
    { build: bones, weight: 1, band: 'near', scale: [0.8, 1.2], spin: true },
    { build: (p) => rock(p, '#7a766f'), weight: 2, band: 'front', scale: [0.4, 0.8], spin: true },
    { build: volcano, weight: 0.25, band: 'far', scale: [0.8, 1.2] },
    { build: (p) => pine(p, '#2e5a36'), weight: 5, band: 'far', scale: [2.2, 3.5], spin: true },
  ],
  // Ancient
  [
    { build: oliveTree, weight: 4, band: 'mid', scale: [1, 1.5], spin: true, shadow: true },
    { build: cypress, weight: 4, band: 'mid', scale: [0.9, 1.4], shadow: true },
    { build: (p) => column(p, false), weight: 1.2, band: 'mid', scale: [0.9, 1.1], shadow: true },
    { build: (p) => column(p, true), weight: 1.5, band: 'near', scale: [0.8, 1.1], spin: true, shadow: true },
    { build: (p) => rock(p, '#c8b38a'), weight: 3, band: 'mid', scale: [0.6, 1.4], spin: true, shadow: true },
    { build: amphorae, weight: 1.5, band: 'near', scale: [0.9, 1.2], spin: true },
    { build: (p) => grassTuft(p, '#a8a45a'), weight: 10, band: 'front', scale: [0.8, 1.3], spin: true },
    { build: (p) => bush(p, '#8a9a58'), weight: 3, band: 'near', scale: [0.6, 1.1], spin: true },
    { build: obelisk, weight: 0.5, band: 'mid', scale: [1, 1.3], shadow: true },
    { build: temple, weight: 0.4, band: 'far', scale: [1, 1.4] },
    { build: pyramid, weight: 0.5, band: 'far', scale: [1, 1.5] },
    { build: cypress, weight: 4, band: 'far', scale: [2, 3], spin: true },
  ],
  // Medieval
  [
    { build: (p) => roundTree(p, '#4e8a3a'), weight: 5, band: 'mid', scale: [1, 1.7], spin: true, shadow: true },
    { build: (p) => pine(p, '#355f38'), weight: 3, band: 'mid', scale: [1.1, 1.8], spin: true, shadow: true },
    { build: hayBale, weight: 2, band: 'near', scale: [0.9, 1.1], spin: true, shadow: true },
    { build: fence, weight: 2, band: 'near', scale: [1, 1], shadow: true },
    { build: (p) => rock(p), weight: 2, band: 'mid', scale: [0.5, 1.2], spin: true },
    { build: (p) => bush(p, '#467f36'), weight: 4, band: 'near', scale: [0.7, 1.3], spin: true },
    { build: (p) => grassTuft(p, '#5d9a42'), weight: 10, band: 'front', scale: [0.8, 1.4], spin: true },
    { build: (p) => flowers(p, '#e25b5b'), weight: 3, band: 'front', scale: [0.8, 1.2], spin: true },
    { build: (p) => cottage(p), weight: 0.5, band: 'mid', scale: [1, 1.2], shadow: true },
    { build: windmill, weight: 0.3, band: 'mid', scale: [1, 1.2], shadow: true },
    { build: castleFar, weight: 0.35, band: 'far', scale: [1, 1.3] },
    { build: (p) => roundTree(p, '#3f7336'), weight: 4, band: 'far', scale: [2, 3], spin: true },
  ],
  // Gunpowder
  [
    { build: (p) => roundTree(p, '#6b9a44'), weight: 4, band: 'mid', scale: [1, 1.6], spin: true, shadow: true },
    { build: (p) => tent(p), weight: 2, band: 'mid', scale: [1, 1.3], spin: true, shadow: true },
    { build: barrels, weight: 2, band: 'near', scale: [0.9, 1.1], spin: true, shadow: true },
    { build: cannonballs, weight: 1.2, band: 'near', scale: [1, 1.2], spin: true },
    { build: (p) => bush(p, '#6a8f3e'), weight: 3, band: 'near', scale: [0.7, 1.2], spin: true },
    { build: (p) => grassTuft(p, '#86a14a'), weight: 10, band: 'front', scale: [0.8, 1.4], spin: true },
    { build: windmill, weight: 0.35, band: 'mid', scale: [1, 1.2], shadow: true },
    { build: (p) => cottage(p, '#efe4c8', '#a44a2c'), weight: 0.5, band: 'mid', scale: [1, 1.3], shadow: true },
    { build: fence, weight: 1.5, band: 'near', scale: [1, 1], shadow: true },
    { build: castleFar, weight: 0.3, band: 'far', scale: [1.1, 1.4] },
    { build: (p) => roundTree(p, '#5d8a3e'), weight: 4, band: 'far', scale: [2, 3], spin: true },
  ],
  // Industrial
  [
    { build: deadTree, weight: 4, band: 'mid', scale: [0.9, 1.4], spin: true, shadow: true },
    { build: stump, weight: 3, band: 'near', scale: [0.8, 1.3], spin: true },
    { build: sandbags, weight: 2.5, band: 'near', scale: [0.9, 1.1], shadow: true },
    { build: barbedWire, weight: 2.5, band: 'near', scale: [1, 1] },
    { build: crater, weight: 3, band: 'near', scale: [0.8, 1.5], spin: true },
    { build: (p) => grassTuft(p, '#7a7a4a'), weight: 6, band: 'front', scale: [0.8, 1.3], spin: true },
    { build: telegraphPole, weight: 1.5, band: 'mid', scale: [1, 1.1], shadow: true },
    { build: (p) => rock(p, '#6e665a'), weight: 2, band: 'mid', scale: [0.5, 1.1], spin: true },
    { build: chimney, weight: 0.7, band: 'far', scale: [1, 1.4] },
    { build: deadTree, weight: 3, band: 'far', scale: [2, 3], spin: true },
  ],
  // Modern
  [
    { build: (p) => roundTree(p, '#4f7a42'), weight: 2.5, band: 'mid', scale: [0.9, 1.3], spin: true, shadow: true },
    { build: jersey, weight: 3, band: 'near', scale: [1, 1], shadow: true },
    { build: (p) => container(p, '#b5452f'), weight: 0.5, band: 'mid', scale: [1, 1], shadow: true },
    { build: (p) => container(p, '#2f6d8f'), weight: 0.4, band: 'mid', scale: [1, 1], shadow: true },
    { build: (p) => container(p, '#c9892e'), weight: 0.3, band: 'mid', scale: [1, 1], shadow: true },
    { build: streetLamp, weight: 2, band: 'near', scale: [1, 1.1], shadow: true },
    { build: antenna, weight: 0.6, band: 'mid', scale: [1, 1.3], shadow: true },
    { build: (p) => bush(p, '#4a6f3c'), weight: 3, band: 'near', scale: [0.6, 1.1], spin: true },
    { build: (p) => grassTuft(p, '#5f8047'), weight: 7, band: 'front', scale: [0.8, 1.3], spin: true },
    { build: cityBlock, weight: 1.2, band: 'far', scale: [0.8, 1.2] },
    { build: (p) => skyscraper(p, '#ffe2a0', '#394556', 26), weight: 1.2, band: 'far', scale: [0.7, 1.1] },
    { build: (p) => rock(p, '#55584f'), weight: 2, band: 'far', scale: [2, 4], spin: true },
  ],
  // Intelligence
  [
    { build: dataPylon, weight: 1.2, band: 'mid', scale: [0.9, 1.4], shadow: true },
    { build: holoTree, weight: 1.6, band: 'mid', scale: [0.9, 1.5], spin: true, shadow: true },
    { build: monolith, weight: 0.8, band: 'mid', scale: [0.9, 1.3], spin: true, shadow: true },
    { build: (p) => rock(p, '#2e3450'), weight: 3, band: 'mid', scale: [0.6, 1.6], spin: true, shadow: true },
    { build: (p) => grassTuft(p, '#3b4f7a'), weight: 3, band: 'mid', scale: [1, 1.6], spin: true },
    { build: solarArray, weight: 2, band: 'near', scale: [0.9, 1.1] },
    { build: (p) => rock(p, '#3a4058'), weight: 2, band: 'near', scale: [0.4, 0.9], spin: true },
    { build: (p) => grassTuft(p, '#3a5a8a'), weight: 6, band: 'front', scale: [0.8, 1.3], spin: true },
    { build: arcology, weight: 1, band: 'far', scale: [0.9, 1.3] },
    { build: (p) => neonTower(p, 30, '#5ff0ff'), weight: 1, band: 'far', scale: [0.7, 1.1] },
    { build: (p) => rock(p, '#2a3050'), weight: 2, band: 'far', scale: [2, 4], spin: true },
  ],
];
