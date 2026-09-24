import * as THREE from 'three';
import { Part, shade, type ColorLike } from '../kit/builder';
import { staticMaterial } from '../kit/materials';
import { TURRET_HEIGHTS } from '../../sim/world';
import { C } from './gear';
import type { Team } from './team';

/**
 * The seven fortresses. Every base has the same bones — a gate tower at the
 * lane with four turret ledges stacked up its face (like Age of War's tower),
 * and the age's architecture spread out behind it — so turrets and units
 * line up in every age. Built facing +x for the player; mirrored for the enemy.
 */

const HALF_PI = Math.PI / 2;
const METAL = { m: 0.8, r: 0.35 } as const;

/** Where each turret sits on the tower (local space, facing +x). */
export const SLOT_POS: THREE.Vector3[] = TURRET_HEIGHTS.map((h, i) => new THREE.Vector3(-0.3, h, i % 2 === 0 ? 0.75 : -0.75));

/** How deep a turret's back may sink into the wall behind it. */
const SEAT_TUCK = 0.3;
/** The furthest out a turret sits, so big machines stay on their ledge. */
const SEAT_MAX = 0.45;

/**
 * Where a turret sits along its ledge (local x): pushed out until its back
 * (`back`, the model's rearmost x) rests against this wall's face, never deeper
 * than SLOT_POS. Turrets outlive the wall they were bought on, so every age
 * seats them against its own face.
 */
export function seatX(base: BaseModel, slot: number, back: number): number {
  return Math.min(SEAT_MAX, Math.max(SLOT_POS[slot]!.x, base.faces[slot]! - SEAT_TUCK - back));
}

export interface BaseModel {
  root: THREE.Group;
  animate(t: number): void;
  /** Where smoke and fire go when the wall is burning (local space). */
  damagePoints: THREE.Vector3[];
  /** One mesh per turret ledge, so ledges only appear once they are bought. */
  ledges: THREE.Mesh[];
  /** How far out (x) the tower's face stands behind each ledge. */
  faces: number[];
}

/** Open frames and deep hollows count as this far back. */
const FACE_FLOOR = -1;

/** Average x of the tower's face over the space a turret takes up on each ledge. */
function measureFaces(body: THREE.Mesh): number[] {
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3(-1, 0, 0);
  body.updateMatrixWorld(true);
  return SLOT_POS.map((s) => {
    let sum = 0;
    let n = 0;
    for (const dy of [0.3, 0.9]) {
      for (const dz of [-0.4, 0, 0.4]) {
        ray.set(from.set(6, s.y + dy, s.z + dz), dir);
        const hit = ray.intersectObject(body, false)[0];
        sum += Math.max(FACE_FLOOR, hit ? hit.point.x : FACE_FLOOR);
        n++;
      }
    }
    return sum / n;
  });
}

interface Anim {
  obj: THREE.Object3D;
  fn: (o: THREE.Object3D, t: number) => void;
}

class BaseBuilder {
  readonly root = new THREE.Group();
  readonly body = new Part();
  private readonly anims: Anim[] = [];
  readonly damage: THREE.Vector3[] = [];
  readonly ledges: THREE.Mesh[] = [];

  /** A turret ledge, kept separate from the body so it can be shown when bought. */
  ledge(slot: number, part: Part): void {
    const mesh = new THREE.Mesh(part.build(), staticMaterial);
    mesh.name = `ledge${slot}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.ledges[slot] = mesh;
  }

  /** A separately animated piece. */
  moving(build: (p: Part) => void, at: [number, number, number], fn: Anim['fn'], shadow = true): THREE.Mesh {
    const p = new Part();
    build(p);
    const mesh = new THREE.Mesh(p.build(), staticMaterial);
    mesh.position.set(...at);
    mesh.castShadow = shadow;
    this.root.add(mesh);
    this.anims.push({ obj: mesh, fn });
    return mesh;
  }

  flag(color: ColorLike, at: [number, number, number], w = 1.6, h = 1.0, pole: ColorLike = C.woodDark): void {
    this.body.cyl(0.05, 0.06, at[1] + h * 0.5, pole, { x: at[0], y: (at[1] + h * 0.5) / 2, z: at[2] });
    this.moving(
      (p) => {
        for (let i = 0; i < 4; i++) p.box(w / 4, h, 0.04, shade(color, i % 2 ? -0.06 : 0), { x: (w / 4) * (i + 0.5), rz: 0 });
      },
      [at[0], at[1], at[2]],
      (o, t) => {
        o.rotation.y = Math.sin(t * 2.3 + at[0]) * 0.25;
        o.rotation.z = Math.sin(t * 3.1 + at[2]) * 0.04;
      },
      false,
    );
  }

  banner(color: ColorLike, trim: ColorLike, at: [number, number, number], h = 3): void {
    this.moving(
      (p) => {
        p.box(0.05, h, 1.1, color, { y: -h / 2 });
        p.box(0.06, 0.12, 1.12, trim, { y: -0.1 });
        p.box(0.06, 0.5, 0.5, trim, { y: -h * 0.45, rx: Math.PI / 4 });
      },
      at,
      (o, t) => {
        o.rotation.z = Math.sin(t * 1.7 + at[2]) * 0.05;
      },
      false,
    );
  }

  fire(at: [number, number, number], size = 1): void {
    this.body.cyl(0.35 * size, 0.45 * size, 0.2 * size, '#3a2a20', { x: at[0], y: at[1] + 0.1 * size, z: at[2] });
    this.moving(
      (p) => {
        p.cone(0.28 * size, 0.8 * size, '#ff8a2a', { y: 0.4 * size, e: 2.6, seg: 6 });
        p.cone(0.16 * size, 0.55 * size, '#ffd65a', { y: 0.35 * size, x: 0.08 * size, e: 3.2, seg: 5 });
      },
      [at[0], at[1] + 0.15 * size, at[2]],
      (o, t) => {
        const k = 0.85 + Math.sin(t * 13 + at[0]) * 0.1 + Math.sin(t * 7.3) * 0.08;
        o.scale.set(1, k, 1);
        o.rotation.y = t * 1.5;
      },
      false,
    );
  }

  spinner(build: (p: Part) => void, at: [number, number, number], speed: number, axis: 'x' | 'y' | 'z' = 'y'): void {
    this.moving(build, at, (o, t) => {
      o.rotation[axis] = t * speed;
    });
  }

  finish(): BaseModel {
    const mesh = new THREE.Mesh(this.body.build(), staticMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    const anims = this.anims;
    return {
      root: this.root,
      animate: (t) => {
        for (const a of anims) a.fn(a.obj, t);
      },
      damagePoints: this.damage.length ? this.damage : [new THREE.Vector3(-2, 6, 0), new THREE.Vector3(-6, 4, -2), new THREE.Vector3(-1, 8.5, 1)],
      ledges: this.ledges,
      faces: measureFaces(mesh),
    };
  }
}

/** Ledges for the four turret slots, drawn in the age's style. */
function ledges(b: BaseBuilder, color: ColorLike, trim: ColorLike, kind: 'log' | 'stone' | 'steel' | 'glow'): void {
  SLOT_POS.forEach((s, slot) => {
    const p = new Part();
    const y = s.y - 0.15;
    if (kind === 'log') {
      for (let i = 0; i < 4; i++) p.cyl(0.13, 0.13, 2.2, color, { x: -0.9 + i * 0.3 + 0.6, y, z: s.z, rx: HALF_PI, seg: 6 });
      // The strut braces the outer end, clear of the ledges stacked beside this one.
      p.box(0.12, 0.8, 0.12, trim, { x: 0.6, y: y - 0.45, z: s.z + Math.sign(s.z) * 0.8, rz: 0.4 });
    } else if (kind === 'stone') {
      p.box(2.0, 0.3, 2.0, color, { x: 0.1, y, z: s.z });
      p.box(2.1, 0.12, 2.1, trim, { x: 0.1, y: y - 0.2, z: s.z });
      p.box(0.4, 0.6, 0.4, color, { x: 0.8, y: y - 0.55, z: s.z, rz: 0.6 });
    } else if (kind === 'steel') {
      p.box(2.0, 0.12, 2.0, color, { x: 0.1, y, z: s.z, ...METAL });
      p.box(0.06, 0.6, 2.0, trim, { x: 1.08, y: y + 0.35, z: s.z, ...METAL });
      p.box(1.0, 0.08, 0.08, trim, { x: 0.6, y: y - 0.4, z: s.z, rz: 0.7, ...METAL });
    } else {
      p.cyl(1.05, 0.9, 0.18, color, { x: 0.1, y, z: s.z, seg: 12, m: 0.6, r: 0.3 });
      p.torus(1.02, 0.04, trim, { x: 0.1, y: y + 0.05, z: s.z, rx: HALF_PI, ts: 20, e: 2.5 });
    }
    b.ledge(slot, p);
  });
}

// ─── 0 · Stone ──────────────────────────────────────────────────────────────

function stoneBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const rockA = '#8b857b';
  const rockB = '#7a7469';
  // The rock stack that forms the gate tower.
  const stack: [number, number, number, number][] = [
    [-1.6, 1.2, 2.2, 1.6], [-1.6, 1.2, -2.2, 1.6], [-1.8, 3.2, 1.8, 1.7], [-1.8, 3.4, -1.8, 1.6], [-1.6, 4.9, 0, 1.9],
    [-1.9, 6.6, 1.2, 1.6], [-1.9, 6.8, -1.2, 1.5], [-1.9, 8.4, 0, 1.6], [-2.4, 9.8, 0.3, 1.2],
  ];
  stack.forEach(([x, y, z, r], i) => p.ico(r, i % 2 ? rockA : rockB, { x, y, z, detail: 0, s: [1, 0.85, 1] }));
  p.box(0.3, 2.6, 2.4, '#1a1410', { x: -0.5, y: 1.3 });
  p.box(0.2, 2.2, 2.0, '#ff7a2a', { x: -1.2, y: 1.1, e: 0.8 });
  ledges(b, C.wood, C.woodDark, 'log');
  // Mound behind.
  p.ico(4.2, rockB, { x: -8, y: 1.2, z: -3, s: [1.3, 0.8, 1] });
  p.ico(3.2, rockA, { x: -12, y: 1, z: 1, s: [1.2, 0.7, 1] });
  // Teepees.
  for (const [x, z] of [[-6, 2.8], [-11, -6]] as const) {
    p.cone(1.6, 3.4, '#b99466', { x, y: 1.7, z, seg: 7 });
    p.cone(1.65, 0.6, t.main, { x, y: 1.2, z, seg: 7, s: [1, 0.5, 1] });
    for (let i = 0; i < 3; i++) p.cyl(0.04, 0.04, 1.2, C.woodDark, { x: x + (i - 1) * 0.2, y: 3.6, z, rz: (i - 1) * 0.3 });
  }
  // Totem pole.
  const tx = -3.8;
  const tz = 3.3;
  for (let i = 0; i < 4; i++) {
    p.box(0.8, 1.1, 0.8, i % 2 ? '#8a5a36' : '#a06a40', { x: tx, y: 0.55 + i * 1.1, z: tz });
    p.box(0.1, 0.18, 0.5, i % 2 ? t.main : '#f2e6c8', { x: tx + 0.42, y: 0.75 + i * 1.1, z: tz });
    p.box(0.12, 0.1, 0.12, '#1a1410', { x: tx + 0.42, y: 0.4 + i * 1.1, z: tz + 0.18 });
    p.box(0.12, 0.1, 0.12, '#1a1410', { x: tx + 0.42, y: 0.4 + i * 1.1, z: tz - 0.18 });
  }
  p.box(2.4, 0.3, 0.3, t.main, { x: tx, y: 4.6, z: tz });
  // Palisade.
  for (let i = 0; i < 14; i++) p.cone(0.16, 2.2, C.woodLight, { x: -1 - i * 1.1, y: 1.1, z: 5.2 + Math.sin(i) * 0.2, seg: 5 });
  for (let i = 0; i < 12; i++) p.cone(0.16, 2.4, C.wood, { x: -2 - i * 1.2, y: 1.2, z: -8.5, seg: 5 });
  // Mammoth skull.
  p.sphere(0.8, C.bone, { x: -5, y: 0.7, z: 4.6, s: [1.2, 0.9, 1] });
  p.cone(0.18, 2.2, C.bone, { x: -4.0, y: 1.2, z: 4.8, rz: -2.2 });
  b.fire([-4.8, 0, 0.6], 1.2);
  b.flag(t.main, [-2.6, 10.6, 0.2], 1.4, 0.9);
  b.damage.push(new THREE.Vector3(-1.8, 6, 0.8), new THREE.Vector3(-8, 4, -2), new THREE.Vector3(-1.9, 9, -0.5));
  return b.finish();
}

// ─── 1 · Ancient ────────────────────────────────────────────────────────────

function ancientBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const sand = '#d9c28e';
  const sandDark = '#c2a874';
  const marble = '#ece6d6';
  // Pylon gate tower (tapered).
  p.extrude([[-3.2, 0], [0.2, 0], [-0.3, 10], [-2.7, 10]], 6.2, sand, {});
  p.box(3.2, 0.5, 6.6, sandDark, { x: -1.5, y: 10.1 });
  p.box(0.3, 3.2, 2.6, '#2a2018', { x: 0.05, y: 1.6 });
  p.box(0.35, 0.4, 3.0, C.gold, { x: 0.05, y: 3.35, ...METAL });
  for (let i = 0; i < 5; i++) p.box(0.06, 0.25, 6.3, i % 2 ? t.main : '#2e6a8a', { x: 0.14 - i * 0.1, y: 5 + i * 1.1, rz: 0.05 });
  ledges(b, marble, sandDark, 'stone');
  // Temple behind: podium, columns, pediment with a team frieze.
  p.box(11, 1, 7, marble, { x: -9.5, y: 0.5, z: -2 });
  for (let i = 0; i < 6; i++) {
    p.cyl(0.36, 0.4, 5, marble, { x: -5.2 - i * 1.7, y: 3.5, z: 1.2, seg: 10 });
    p.cyl(0.36, 0.4, 5, marble, { x: -5.2 - i * 1.7, y: 3.5, z: -5.2, seg: 10 });
  }
  p.box(10, 5, 5, '#e2dac6', { x: -9.5, y: 3.5, z: -2 });
  p.box(11.2, 0.7, 7.2, marble, { x: -9.5, y: 6.35, z: -2 });
  p.box(11.2, 0.45, 0.1, t.main, { x: -9.5, y: 6.35, z: 1.62 });
  p.extrude([[-5.6, 0], [5.6, 0], [0, 2]], 7.2, marble, { x: -9.5, y: 6.7, z: -2 });
  p.box(0.1, 0.8, 1.0, C.gold, { x: -9.5, y: 7.3, z: 1.63, ...METAL });
  // Obelisks and braziers.
  for (const [x, z] of [[-3.8, 4], [-15.5, 3.5]] as const) {
    p.box(1, 0.4, 1, sandDark, { x, y: 0.2, z });
    p.cyl(0.25, 0.4, 5, sand, { x, y: 2.9, z, seg: 4, ry: Math.PI / 4 });
    p.cone(0.36, 0.6, C.gold, { x, y: 5.7, z, seg: 4, ry: Math.PI / 4, ...METAL });
  }
  p.cyl(0.5, 0.2, 1.1, C.bronze, { x: -2.2, y: 0.55, z: 3.8, ...METAL });
  b.fire([-2.2, 1.1, 3.8], 0.8);
  b.banner(t.main, C.gold, [0.22, 9.4, 2.2], 4.2);
  b.banner(t.main, C.gold, [0.22, 9.4, -2.2], 4.2);
  b.flag(t.main, [-1.5, 10.4, 0], 1.6, 1.0, C.gold);
  return b.finish();
}

// ─── 2 · Medieval ───────────────────────────────────────────────────────────

function crenellate(p: Part, x0: number, x1: number, y: number, z: number, color: ColorLike, alongZ = false): void {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 0.8));
  for (let i = 0; i < n; i += 2) {
    const u = x0 + ((x1 - x0) * (i + 0.5)) / n;
    if (alongZ) p.box(0.5, 0.6, 0.45, color, { x: z, y: y + 0.3, z: u });
    else p.box(0.45, 0.6, 0.5, color, { x: u, y: y + 0.3, z });
  }
}

function medievalBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const stone = '#a39d92';
  const stoneDark = '#8a8479';
  // Gatehouse tower.
  p.box(3.4, 10, 6.6, stone, { x: -1.7, y: 5 });
  crenellate(p, -3.3, 3.3, 10, -0.05, stoneDark, true);
  crenellate(p, -3.3, 3.3, 10, -3.35, stoneDark, true);
  p.box(0.3, 3.4, 2.8, '#1c1712', { x: 0.02, y: 1.7 });
  for (let i = 0; i < 5; i++) p.box(0.08, 3.2, 0.08, '#3a3b3e', { x: 0.2, y: 1.8, z: -1.1 + i * 0.55, ...METAL });
  for (let i = 0; i < 4; i++) p.box(0.08, 0.08, 2.6, '#3a3b3e', { x: 0.2, y: 0.6 + i * 0.8, ...METAL });
  p.extrude([[-1.6, 0], [1.6, 0], [1.6, 1.4], [0, 2.2], [-1.6, 1.4]], 0.4, stoneDark, { x: 0.05, y: 3.4, ry: HALF_PI });
  for (let i = 0; i < 6; i++) p.box(0.12, 0.8, 0.3, '#1c1712', { x: 0.02, y: 4.6 + (i % 3) * 1.8, z: i < 3 ? 2.3 : -2.3 });
  ledges(b, C.wood, C.woodDark, 'stone');
  // Curtain wall.
  p.box(12, 6, 1.6, stone, { x: -9, y: 3, z: -6 });
  crenellate(p, -15, -3, 6, -6, stoneDark);
  p.box(1.6, 6, 8, stone, { x: -15.2, y: 3, z: -2 });
  crenellate(p, -6, 2, 6, -15.2, stoneDark, true);
  // Keep with a team-coloured roof.
  p.cyl(2.6, 2.8, 12, stone, { x: -9.5, y: 6, z: -2.5, seg: 12 });
  p.cone(3.2, 4.2, t.main, { x: -9.5, y: 14.1, z: -2.5, seg: 12 });
  for (let i = 0; i < 4; i++) p.box(0.15, 0.9, 0.4, '#1c1712', { x: -9.5 + Math.cos(i) * 2.6, y: 8 + i, z: -2.5 + Math.sin(i) * 2.6, ry: -i });
  p.cyl(1.4, 1.5, 8, stoneDark, { x: -5, y: 4, z: 2.5, seg: 10 });
  p.cone(1.8, 2.8, t.dark, { x: -5, y: 9.4, z: 2.5, seg: 10 });
  b.banner(t.main, t.light, [0.22, 9.2, 2.0], 3.4);
  b.banner(t.main, t.light, [0.22, 9.2, -2.0], 3.4);
  b.flag(t.main, [-9.5, 16.2, -2.5], 2.2, 1.3);
  b.flag(t.light, [-1.7, 10.6, 3.0], 1.2, 0.8);
  b.fire([-2.5, 0, 3.8], 0.7);
  return b.finish();
}

// ─── 3 · Gunpowder ──────────────────────────────────────────────────────────

function gunpowderBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const brick = '#b0735a';
  const stone = '#c9bda3';
  // Bastion tower with sloped base.
  p.extrude([[-3.6, 0], [0.6, 0], [0.1, 2.2], [0.1, 10], [-3.2, 10], [-3.2, 2.2]], 6.6, stone, {});
  p.box(3.4, 7.8, 6.3, brick, { x: -1.55, y: 6.1 });
  p.box(3.6, 0.35, 6.9, stone, { x: -1.6, y: 10.1 });
  for (let i = 0; i < 4; i++) p.box(0.5, 0.6, 0.5, stone, { x: -0.1, y: 10.6, z: -2.6 + i * 1.75 });
  p.box(0.3, 3.2, 2.6, '#241b16', { x: 0.25, y: 1.6 });
  p.extrude([[-1.4, 0], [1.4, 0], [0, 0.9]], 0.4, stone, { x: 0.3, y: 3.2, ry: HALF_PI });
  ledges(b, stone, C.iron, 'stone');
  // Star-fort walls behind.
  p.extrude([[0, 0], [9, 0], [11, -4], [6, -7], [0, -6]], 3.2, stone, { x: -15, y: 1.6, rx: -HALF_PI, s: [1, 1, 1] });
  p.box(9, 3.6, 1.4, brick, { x: -9, y: 1.8, z: -6.2 });
  // Barracks with a red roof.
  p.box(7, 3.6, 4, '#e8dcc0', { x: -9.5, y: 1.8, z: -1.5 });
  p.extrude([[-3.8, 0], [3.8, 0], [0, 2]], 4.4, '#a44a2c', { x: -9.5, y: 3.6, z: -1.5 });
  for (let i = 0; i < 4; i++) p.box(0.7, 0.9, 0.1, '#3a4a5a', { x: -12 + i * 1.7, y: 2, z: 0.51 });
  // Powder barrels, cannonballs.
  for (let i = 0; i < 3; i++) p.cyl(0.35, 0.35, 0.85, C.wood, { x: -3.5 - i * 0.8, y: 0.42, z: 3.5, seg: 8 });
  for (let i = 0; i < 4; i++) p.sphere(0.22, '#2a2d31', { x: -6 + (i % 2) * 0.45, y: 0.22 + Math.floor(i / 2) * 0.35, z: 3.6, ...METAL });
  // Flagpole with a big flag.
  p.cyl(0.08, 0.1, 15, '#e8e4dc', { x: -9, y: 7.5, z: -5 });
  p.sphere(0.2, C.gold, { x: -9, y: 15.1, z: -5, ...METAL });
  b.flag(t.main, [-9, 13.4, -5], 3.4, 2.0, '#e8e4dc');
  b.banner(t.main, C.gold, [0.3, 9.4, 2.4], 3);
  b.banner(t.main, C.gold, [0.3, 9.4, -2.4], 3);
  return b.finish();
}

// ─── 4 · Industrial ─────────────────────────────────────────────────────────

function industrialBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const steel = '#6c7076';
  const brick = '#8a4d3a';
  const concrete = '#a09a8e';
  // Riveted steel gate tower.
  p.box(3.2, 3.4, 6.6, concrete, { x: -1.6, y: 1.7 });
  p.box(0.25, 2.9, 2.8, '#242628', { x: 0.02, y: 1.45 });
  for (let i = 0; i < 4; i++) p.box(0.12, 0.12, 2.8, '#c9a13a', { x: 0.16, y: 0.5 + i * 0.75, rx: i % 2 ? 0.5 : -0.5 });
  for (const z of [2.6, -2.6]) {
    p.box(0.35, 7, 0.35, steel, { x: -0.3, y: 6.9, z, ...METAL });
    p.box(0.35, 7, 0.35, steel, { x: -2.9, y: 6.9, z, ...METAL });
  }
  for (let i = 0; i < 4; i++) {
    p.box(3, 0.1, 0.1, steel, { x: -1.6, y: 4.2 + i * 1.8, z: 2.6, rz: 0.55, ...METAL });
    p.box(3, 0.1, 0.1, steel, { x: -1.6, y: 4.2 + i * 1.8, z: -2.6, rz: -0.55, ...METAL });
  }
  p.box(3.4, 1.4, 6.6, '#5d6167', { x: -1.6, y: 10.2, ...METAL });
  p.box(0.1, 0.5, 3.6, t.main, { x: 0.12, y: 10.2 });
  ledges(b, '#55595e', '#8a8f96', 'steel');
  // Factory: brick hall with a sawtooth roof and two stacks.
  p.box(10, 5, 7, brick, { x: -10, y: 2.5, z: -2.5 });
  for (let i = 0; i < 4; i++) p.extrude([[0, 0], [2.5, 0], [2.5, 1.5]], 7.2, '#4f5358', { x: -14.8 + i * 2.5, y: 5, z: -2.5 });
  for (let i = 0; i < 5; i++) p.box(1.2, 1.6, 0.1, '#ffd27a', { x: -13.8 + i * 2, y: 2.8, z: 1.02, e: 0.7 });
  p.box(3.2, 0.9, 0.1, t.main, { x: -10, y: 4.3, z: 1.03 });
  for (const [x, z] of [[-7.5, -5], [-12.5, -5.5]] as const) {
    p.cyl(0.7, 0.95, 14, brick, { x, y: 7, z, seg: 10 });
    p.cyl(0.8, 0.8, 0.5, '#2e2a28', { x, y: 14.1, z, seg: 10 });
  }
  // Water tank and bunker.
  p.cyl(1.6, 1.6, 2.4, '#74787e', { x: -4.5, y: 6.5, z: -6, seg: 12, ...METAL });
  for (let i = 0; i < 4; i++) p.box(0.15, 5.2, 0.15, steel, { x: -4.5 + (i % 2 ? 1.2 : -1.2), y: 2.6, z: -6 + (i < 2 ? 1.2 : -1.2) });
  for (let i = 0; i < 6; i++) p.capsule(0.22, 0.55, '#a39570', { x: -2.5 - i * 0.8, y: 0.25, z: 4, rz: HALF_PI });
  // Searchlight.
  p.cyl(0.4, 0.5, 0.6, '#3a3d41', { x: -1.6, y: 11.3, z: 1.8, ...METAL });
  p.cyl(0.36, 0.36, 0.05, '#fff5d0', { x: -1.2, y: 11.4, z: 1.8, rz: HALF_PI, e: 3 });
  b.flag(t.main, [-1.6, 12.2, -2.4], 1.8, 1.1, steel);
  b.damage.push(new THREE.Vector3(-7.5, 14.4, -5), new THREE.Vector3(-12.5, 14.4, -5.5));
  return b.finish();
}

// ─── 5 · Modern ─────────────────────────────────────────────────────────────

function modernBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const concrete = '#b4b1aa';
  const dark = '#5b5f66';
  // Concrete gate tower with blast doors.
  p.box(3.4, 10.4, 6.6, concrete, { x: -1.7, y: 5.2 });
  p.box(0.25, 3, 3, '#3d4046', { x: 0.03, y: 1.5, ...METAL });
  p.box(0.27, 0.12, 3.0, '#e8c040', { x: 0.04, y: 3.05, e: 0.4 });
  for (let i = 0; i < 5; i++) p.box(0.1, 0.35, 6.62, i % 2 ? dark : concrete, { x: 0.02, y: 4.5 + i * 1.3 });
  p.box(0.12, 1.2, 1.8, t.main, { x: 0.05, y: 9.4, z: 1.8, e: 0.2 });
  p.box(3.6, 0.3, 6.8, dark, { x: -1.7, y: 10.5 });
  for (let i = 0; i < 3; i++) p.box(0.2, 0.2, 0.2, '#ff3030', { x: 0.05, y: 10.2, z: -2.6 + i * 2.6, e: 3 });
  ledges(b, '#9c9993', '#e8c040', 'steel');
  // Compound blocks and T-walls.
  p.box(9, 4.5, 6, concrete, { x: -10.5, y: 2.25, z: -3 });
  for (let i = 0; i < 6; i++) p.box(1.1, 0.5, 0.1, '#9fd8ff', { x: -14 + i * 1.4, y: 3, z: 0.01, e: 1.0 });
  for (let i = 0; i < 8; i++) p.extrude([[-0.4, 0], [0.4, 0], [0.15, 0.4], [0.15, 3], [-0.15, 3], [-0.15, 0.4]], 1.4, '#c9c6be', { x: -3 - i * 1.5, y: 0, z: 4.6, ry: HALF_PI });
  // Radar dome, comms mast, dish.
  p.cyl(1.4, 1.6, 2, dark, { x: -8, y: 5.5, z: -4.5, seg: 10 });
  p.dome(1.8, '#eef0f2', { x: -8, y: 6.5, z: -4.5, ws: 12, hs: 6 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    p.cyl(0.06, 0.06, 16, '#c8ccd2', { x: -13 + Math.cos(a) * 0.5, y: 8, z: -5 + Math.sin(a) * 0.5, ...METAL });
  }
  for (let i = 0; i < 8; i++) p.torus(0.5, 0.03, '#c8ccd2', { x: -13, y: 1 + i * 2, z: -5, rx: HALF_PI, ts: 3, ...METAL });
  p.sphere(0.2, '#ff3030', { x: -13, y: 16.2, z: -5, e: 4 });
  b.spinner((q) => {
    q.cyl(1.2, 1.2, 0.1, '#e8eaee', { rx: 1.1, seg: 14 });
    q.cyl(0.05, 0.05, 1.0, dark, { y: 0.3, rx: 1.1 });
  }, [-12, 5.2, 0.5], 0.6);
  // Helipad.
  p.cyl(2.4, 2.4, 0.15, '#4a4d52', { x: -16, y: 4.6, z: -3, seg: 14 });
  p.box(0.3, 0.02, 1.8, '#f1f1f1', { x: -16.6, y: 4.7, z: -3 });
  p.box(0.3, 0.02, 1.8, '#f1f1f1', { x: -15.4, y: 4.7, z: -3 });
  p.box(1.2, 0.02, 0.3, '#f1f1f1', { x: -16, y: 4.7, z: -3 });
  b.flag(t.main, [-4, 12, 3.5], 2.2, 1.3, '#d8dce2');
  b.damage.push(new THREE.Vector3(-8, 7, -4.5));
  return b.finish();
}

// ─── 6 · Intelligence ───────────────────────────────────────────────────────

function intelligenceBase(t: Team): BaseModel {
  const b = new BaseBuilder();
  const p = b.body;
  const shell = '#e4e8ee';
  const graphite = '#23272f';
  // Monolithic gate spire with glowing seams.
  p.extrude([[-3.4, 0], [0.3, 0], [0, 10.5], [-3.0, 11.5]], 6.4, shell, { m: 0.25, r: 0.3 });
  p.box(0.3, 3.2, 2.8, graphite, { x: 0.12, y: 1.6, m: 0.6, r: 0.3 });
  p.box(0.32, 0.08, 2.9, t.glow, { x: 0.13, y: 3.25, e: 3 });
  for (let i = 0; i < 6; i++) p.box(0.06, 0.06, 6.42, t.glow, { x: 0.25 - i * 0.05, y: 4 + i * 1.2, e: 2.2 });
  p.box(0.06, 10.5, 0.06, t.glow, { x: 0.2, y: 5.25, z: 3.2, e: 2.2 });
  p.box(0.06, 10.5, 0.06, t.glow, { x: 0.2, y: 5.25, z: -3.2, e: 2.2 });
  ledges(b, graphite, t.glow, 'glow');
  // Data halls with light grids.
  p.box(10, 4, 6.5, graphite, { x: -10.5, y: 2, z: -3, m: 0.6, r: 0.3 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) p.box(0.9, 0.2, 0.05, (r + c) % 3 ? '#5ff0ff' : t.glow, { x: -14.6 + c * 1.2, y: 0.9 + r * 1.1, z: 0.28, e: 1.6 });
  // The core spire, its rings and a holographic emblem.
  p.cyl(0.9, 1.6, 16, shell, { x: -8, y: 8, z: -5, seg: 6, m: 0.25, r: 0.3 });
  p.box(0.1, 15, 0.1, t.glow, { x: -7.2, y: 8, z: -4.4, e: 2.5 });
  b.moving(
    (q) => q.ico(1.1, t.glow, { e: 3, detail: 1 }),
    [-8, 17, -5],
    (o, time) => {
      const k = 1 + Math.sin(time * 2.2) * 0.12;
      o.scale.setScalar(k);
      o.rotation.y = time * 0.8;
    },
    false,
  );
  for (let i = 0; i < 3; i++) {
    b.moving(
      (q) => q.torus(2.2 + i * 0.7, 0.07, i === 1 ? '#e4e8ee' : t.glow, { rx: HALF_PI, ts: 36, e: i === 1 ? 0.4 : 2.2, m: 0.5 }),
      [-8, 11 + i * 2, -5],
      (o, time) => {
        o.rotation.x = Math.sin(time * 0.5 + i) * 0.35;
        o.rotation.y = time * (0.4 + i * 0.25) * (i % 2 ? -1 : 1);
      },
      false,
    );
  }
  b.moving(
    (q) => {
      q.cyl(1.4, 1.4, 0.04, t.glow, { rx: HALF_PI, seg: 6, e: 1.2 });
      q.torus(1.5, 0.05, t.glow, { ts: 6, e: 3 });
      q.box(0.2, 1.4, 0.06, '#ffffff', { e: 2, z: 0.03 });
      q.box(1.4, 0.2, 0.06, '#ffffff', { e: 2, z: 0.03, rz: 0 });
    },
    [-4.5, 6.5, 3.2],
    (o, time) => {
      o.rotation.y = Math.sin(time * 0.6) * 0.5;
      o.position.y = 6.5 + Math.sin(time * 1.3) * 0.2;
    },
    false,
  );
  // Solar fins.
  for (let i = 0; i < 5; i++) p.box(1.4, 0.06, 2.4, '#1f3a6b', { x: -15 + i * 1.6, y: 4.3, z: -3, rx: -0.4, m: 0.6, r: 0.2 });
  b.damage.push(new THREE.Vector3(-8, 12, -5));
  return b.finish();
}

const BUILDERS = [stoneBase, ancientBase, medievalBase, gunpowderBase, industrialBase, modernBase, intelligenceBase];

export function buildBase(age: number, team: Team): BaseModel {
  return BUILDERS[age]!(team);
}
