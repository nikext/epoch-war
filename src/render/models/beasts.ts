import { RigBuilder, shade, type ColorLike } from '../kit/builder';
import * as G from './gear';
import { C } from './gear';
import { humanoid, type Decor, type Look } from './humanoid';
import type { ModelTemplate } from './rig';
import { finish, type Team } from './team';

/**
 * Mounts and their riders. The beast owns joints mount / mNeck / mHead /
 * mLeg{F,B}{N,F} (and mKnee… where the legs bend) / mTail; the rider is a
 * humanoid with prefix "r" seated on the mount, so both animate together.
 */

const HALF_PI = Math.PI / 2;
const METAL = G.tex.METAL;

function rider(rig: RigBuilder, look: Look, decor: Decor, x: number, saddleY: number, tilt?: number): void {
  humanoid(rig, look, decor, { prefix: 'r', parent: 'mount', x, y: saddleY - 0.78, seated: true, ...(tilt !== undefined ? { weaponTilt: tilt } : {}) });
}

// ─── Triceratops ────────────────────────────────────────────────────────────

export function trikeRider(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const hide = '#6f7f55';
  const belly = '#b8a97c';
  const plate = shade(hide, -0.25);
  const m = rig.joint('mount', null);
  m.sphere(1, hide, { y: 1.28, s: [1.3, 0.74, 0.66], ws: 14, hs: 9 });
  m.sphere(1, belly, { y: 1.06, x: 0.05, s: [1.1, 0.5, 0.56], ws: 12, hs: 7 });
  // Bony scutes down the spine and flanks.
  for (let i = 0; i < 7; i++) m.block(0.2, 0.1, 0.26, plate, { x: -0.8 + i * 0.26, y: 1.98 - Math.abs(i - 3) * 0.05, rz: 0.1 * (i - 3), bevel: 0.03 });
  for (let i = 0; i < 6; i++) {
    for (const z of [0.5, -0.5]) m.ico(0.07, plate, { x: -0.7 + i * 0.28, y: 1.5 + Math.sin(i) * 0.08, z: z * (1 - Math.abs(i - 2.5) * 0.06) });
  }
  // A saddle on a team blanket draped over the back, with a rope girth.
  m.block(1.0, 0.05, 0.66, t.main, { x: 0.05, y: 2.05, bevel: 0.02 });
  for (const s of [1, -1]) {
    m.block(1.0, 0.64, 0.05, t.main, { x: 0.05, y: 1.77, z: s * 0.5, rx: -s * 0.57, bevel: 0.015 });
    m.block(1.02, 0.07, 0.07, t.light, { x: 0.05, y: 1.5, z: s * 0.67, rx: -s * 0.57, bevel: 0.015 });
  }
  m.block(0.7, 0.2, 0.62, C.fur, { x: 0.05, y: 2.02, taper: [0.9, 0.9], bevel: 0.06 });
  m.block(0.12, 0.26, 0.64, C.furDark, { x: 0.36, y: 2.08, bevel: 0.04 });
  m.torus(0.68, 0.03, C.rope, { x: 0.05, y: 1.32, ry: HALF_PI, s: [1, 1.05, 1], ts: 20 });

  rig.joint('mNeck', 'mount', 1.1, 1.38, 0).sphere(0.42, hide, { s: [1.1, 0.9, 0.9], ws: 10, hs: 7 });
  const h = rig.joint('mHead', 'mNeck', 0.3, 0, 0);
  h.sphere(0.45, hide, { x: 0.3, y: -0.05, s: [1.35, 0.85, 0.78], ws: 12, hs: 8 });
  h.block(0.4, 0.2, 0.34, shade(hide, -0.1), { x: 0.62, y: -0.2, taper: [0.8, 0.7], bevel: 0.06 });
  h.cone(0.2, 0.42, '#3f3a33', { x: 0.88, y: -0.18, rz: -HALF_PI - 0.25 });
  // The frill: a shield of bone, rimmed with spikes, painted with the team.
  h.cyl(0.78, 0.74, 0.1, '#8e6f4f', { x: -0.1, y: 0.3, rz: HALF_PI - 0.55, seg: 14 });
  h.cyl(0.5, 0.5, 0.11, shade('#8e6f4f', -0.2), { x: -0.1, y: 0.3, rz: HALF_PI - 0.55, seg: 12 });
  h.torus(0.62, 0.06, t.main, { x: -0.08, y: 0.3, ry: HALF_PI, rx: 0.55, ts: 18 });
  for (let i = 0; i < 9; i++) {
    const a = -1.4 + (i / 8) * 2.8;
    h.cone(0.06, 0.2, C.bone, { x: -0.18 - Math.cos(a) * 0.1, y: 0.3 + Math.cos(a) * 0.74, z: Math.sin(a) * 0.74, rz: HALF_PI - 0.55 - Math.cos(a) * 1.2, seg: 5 });
  }
  h.cone(0.075, 0.74, C.bone, { x: 0.5, y: 0.35, z: 0.2, rz: -1.05, seg: 7 });
  h.cone(0.075, 0.74, C.bone, { x: 0.5, y: 0.35, z: -0.2, rz: -1.05, seg: 7 });
  h.cone(0.07, 0.3, C.bone, { x: 0.78, y: 0.14, rz: -0.55, seg: 6 });
  h.block(0.09, 0.08, 0.05, '#1d1a18', { x: 0.42, y: 0.1, z: 0.27, bevel: 0.015 });
  h.block(0.12, 0.03, 0.06, shade(hide, -0.4), { x: 0.44, y: 0.16, z: 0.26, rz: 0.2 });

  const legs: [string, string, number, number, number][] = [
    ['mLegFN', 'mKneeFN', 0.7, 0.44, 1],
    ['mLegFF', 'mKneeFF', 0.7, -0.44, 1],
    ['mLegBN', 'mKneeBN', -0.62, 0.46, -1],
    ['mLegBF', 'mKneeBF', -0.62, -0.46, -1],
  ];
  for (const [leg, knee, x, z, dir] of legs) {
    const l = rig.joint(leg, 'mount', x, 1.1, z);
    l.sphere(0.24, hide, { y: -0.08, ws: 8, hs: 6 });
    l.cyl(0.2, 0.17, 0.5, shade(hide, -0.05), { y: -0.28, seg: 8 });
    const k = rig.joint(knee, leg, 0.02 * dir, -0.52, 0);
    k.sphere(0.16, shade(hide, -0.1), { ws: 8, hs: 6 });
    k.cyl(0.16, 0.18, 0.46, shade(hide, -0.12), { y: -0.24, seg: 8 });
    k.cyl(0.21, 0.23, 0.1, shade(hide, -0.3), { y: -0.52, seg: 8 });
    for (let i = 0; i < 3; i++) k.cone(0.045, 0.1, '#3f3a33', { x: 0.2, y: -0.53, z: -0.1 + i * 0.1, rz: -HALF_PI, seg: 4 });
  }
  const tail = rig.joint('mTail', 'mount', -1.2, 1.3, 0);
  tail.cone(0.32, 1.3, hide, { x: -0.6, rz: HALF_PI, s: [1, 1, 0.8], seg: 10 });
  for (let i = 0; i < 3; i++) tail.block(0.12, 0.08, 0.14, plate, { x: -0.2 - i * 0.3, y: 0.28 - i * 0.07, bevel: 0.02 });

  rider(
    rig,
    { skin: '#c68a5a', shirt: C.fur, pants: C.furDark, boots: C.leatherDark, sleeves: null, beard: '#3b2a1e' },
    {
      head: (p) => {
        G.wildHair(p, '#3b2a1e');
        p.block(0.03, 0.12, 0.05, t.main, { x: 0.17, y: 0.24, z: 0.17 });
      },
      torso: (p) => {
        G.sash(p, t.main);
        p.block(0.36, 0.22, 0.52, C.furDark, { y: 0.52, rx: 0.3, bevel: 0.05 });
      },
      weaponN: (p) => G.spear(p, 2.2, C.flint, 0.7),
    },
    0.05,
    2.02,
  );
  G.plume(rig, 'rhead', t.main, -0.15, 0.45, 0.7);
  return finish(rig, { kind: 'rider', style: 'thrust', height: 3.4, strideLength: 2.6 });
}

// ─── War elephant ───────────────────────────────────────────────────────────

export function warElephant(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const skin = '#8d8a86';
  const m = rig.joint('mount', null);
  m.sphere(1, skin, { y: 2.2, s: [1.55, 1.05, 0.95], ws: 14, hs: 9 });
  m.sphere(0.9, shade(skin, -0.06), { x: -1.0, y: 2.05, s: [0.8, 0.95, 0.9], ws: 10, hs: 7 });
  // Caparison with gold trim and hanging tassels.
  m.block(1.9, 0.95, 2.02, t.main, { x: -0.1, y: 2.45, bevel: 0.06 });
  m.block(1.92, 0.1, 2.04, C.gold, { x: -0.1, y: 1.98, bevel: 0.02, ...METAL });
  m.block(0.62, 0.62, 0.06, t.light, { x: -0.1, y: 2.45, z: 1.03, bevel: 0.02 });
  m.cyl(0.18, 0.18, 0.04, C.gold, { x: -0.1, y: 2.45, z: 1.07, rx: HALF_PI, seg: 12, ...METAL });
  for (let i = 0; i < 6; i++) {
    m.cone(0.05, 0.16, C.gold, { x: -0.95 + i * 0.34, y: 1.86, z: 1.02, rz: Math.PI, seg: 5, ...METAL });
  }
  // Howdah: a railed wooden tower under a team canopy.
  m.block(1.2, 0.5, 1.1, C.wood, { x: -0.25, y: 3.28, bevel: 0.04 });
  for (let i = 0; i < 5; i++) m.block(0.04, 0.44, 1.12, C.woodDark, { x: -0.8 + i * 0.27, y: 3.3 });
  m.block(1.26, 0.08, 1.16, C.gold, { x: -0.25, y: 3.55, bevel: 0.02, ...METAL });
  for (const [dx, dz] of [[-0.8, 0.5], [0.3, 0.5], [-0.8, -0.5], [0.3, -0.5]]) m.cyl(0.035, 0.035, 0.9, C.woodDark, { x: dx!, y: 3.95, z: dz!, seg: 6 });
  m.cone(0.95, 0.5, t.dark, { x: -0.25, y: 4.55, seg: 4, ry: Math.PI / 4 });
  m.block(1.32, 0.12, 1.32, t.main, { x: -0.25, y: 4.32, bevel: 0.02 });
  m.cyl(0.025, 0.025, 1.0, C.woodDark, { x: -0.25, y: 5.2, seg: 5 });
  m.sphere(0.06, C.gold, { x: -0.25, y: 5.72, ...METAL });
  G.pennant(rig, 'mount', t.main, -0.27, 5.65, 0.7, 0.3);

  rig.joint('mNeck', 'mount', 1.35, 2.55, 0).sphere(0.6, skin, { s: [1, 1, 0.9], ws: 10, hs: 7 });
  const h = rig.joint('mHead', 'mNeck', 0.25, 0, 0);
  h.sphere(0.72, skin, { x: 0.35, y: 0.05, s: [1, 1.08, 0.88], ws: 12, hs: 9 });
  h.sphere(0.3, shade(skin, 0.05), { x: 0.6, y: 0.4, z: 0.2, ws: 8, hs: 6 });
  h.sphere(0.3, shade(skin, 0.05), { x: 0.6, y: 0.4, z: -0.2, ws: 8, hs: 6 });
  // Painted forehead plate.
  h.block(0.3, 0.5, 0.5, t.main, { x: 0.78, y: 0.2, taper: [1, 0.8], bevel: 0.04 });
  h.block(0.32, 0.08, 0.52, C.gold, { x: 0.78, y: 0.42, bevel: 0.02, ...METAL });
  h.cone(0.09, 0.95, C.bone, { x: 1.05, y: -0.55, z: 0.28, rz: -2.2, seg: 7 });
  h.cone(0.09, 0.95, C.bone, { x: 1.05, y: -0.55, z: -0.28, rz: -2.2, seg: 7 });
  h.cyl(0.1, 0.1, 0.06, C.gold, { x: 0.92, y: -0.35, z: 0.28, rz: -2.2 + HALF_PI, seg: 8, ...METAL });
  h.cyl(0.1, 0.1, 0.06, C.gold, { x: 0.92, y: -0.35, z: -0.28, rz: -2.2 + HALF_PI, seg: 8, ...METAL });
  h.block(0.09, 0.08, 0.05, '#1d1a18', { x: 0.75, y: 0.22, z: 0.52, bevel: 0.015 });
  h.block(0.5, 0.12, 1.3, t.main, { x: 0.35, y: 0.62, bevel: 0.03 });
  // Ears flap; the trunk swings in three joints.
  for (const z of [0.62, -0.62]) {
    const ear = G.sway(rig, 'F', 'mHead', 0.1, 0.1, z);
    ear.part.sphere(0.62, shade(skin, -0.08), { x: -0.3, s: [0.75, 1.05, 0.2], ws: 10, hs: 7 });
    ear.part.block(0.3, 0.36, 0.03, t.main, { x: -0.3, z: z > 0 ? 0.13 : -0.13, bevel: 0.01 });
  }
  let trunk = 'mHead';
  const seg: [number, number, number][] = [[0.95, -0.15, 0.17], [0.05, -0.55, 0.14], [0.02, -0.5, 0.11]];
  for (const [x, y, r] of seg) {
    const s = G.sway(rig, 'D', trunk, trunk === 'mHead' ? x : 0, trunk === 'mHead' ? y : y, 0);
    s.part.cyl(r * 0.85, r, 0.58, skin, { y: -0.27, seg: 8 });
    for (let i = 0; i < 3; i++) s.part.cyl(r * 0.95, r * 0.95, 0.025, shade(skin, -0.15), { y: -0.1 - i * 0.16, seg: 8 });
    trunk = s.name;
  }

  const legs: [string, number, number][] = [['mLegFN', 0.85, 0.52], ['mLegFF', 0.85, -0.52], ['mLegBN', -0.85, 0.52], ['mLegBF', -0.85, -0.52]];
  for (const [name, x, z] of legs) {
    const l = rig.joint(name, 'mount', x, 1.55, z);
    l.cyl(0.33, 0.3, 1.5, skin, { y: -0.75, seg: 10 });
    l.cyl(0.34, 0.34, 0.08, C.gold, { y: -1.1, seg: 10, ...METAL });
    l.cyl(0.34, 0.36, 0.1, shade(skin, -0.2), { y: -1.46, seg: 10 });
    for (let i = 0; i < 3; i++) l.block(0.1, 0.08, 0.1, C.bone, { x: 0.3, y: -1.48, z: -0.15 + i * 0.15, bevel: 0.02 });
  }
  const tail = rig.joint('mTail', 'mount', -1.5, 2.3, 0);
  tail.cyl(0.04, 0.05, 0.9, skin, { x: -0.1, y: -0.4, rz: -0.25, seg: 6 });
  tail.cone(0.07, 0.2, '#3a3632', { x: -0.22, y: -0.9, rz: Math.PI - 0.25, seg: 6 });

  rider(
    rig,
    { skin: '#b57a4c', shirt: C.linen, pants: C.linen, boots: C.leather, sleeves: null, hair: '#1f1a17' },
    {
      head: (p) => G.headband(p, t.main),
      torso: (p) => {
        G.sash(p, t.main);
        G.collar(p, C.gold);
      },
      weaponN: (p) => G.spear(p, 1.2, C.bronze, 0.4),
    },
    1.05,
    3.1,
  );
  return finish(rig, { kind: 'rider', style: 'thrust', height: 5.6, strideLength: 3.3 });
}

// ─── Horses ─────────────────────────────────────────────────────────────────

function horse(rig: RigBuilder, coat: ColorLike, mane: ColorLike): void {
  const m = rig.joint('mount', null);
  m.sphere(1, coat, { y: 1.48, s: [0.98, 0.5, 0.42], ws: 14, hs: 9 });
  m.sphere(0.47, coat, { x: 0.62, y: 1.52, s: [1, 1.05, 0.95], ws: 10, hs: 7 });
  m.sphere(0.49, coat, { x: -0.62, y: 1.54, s: [1, 1, 0.95], ws: 10, hs: 7 });

  const n = rig.joint('mNeck', 'mount', 0.78, 1.72, 0);
  n.block(0.36, 0.85, 0.3, coat, { x: 0.18, y: 0.3, rz: -0.55, taper: [0.75, 0.8], bevel: 0.08 });
  n.block(0.12, 0.8, 0.12, mane, { x: 0.02, y: 0.4, rz: -0.55, bevel: 0.03 });
  for (let i = 0; i < 4; i++) n.block(0.1, 0.16, 0.05, mane, { x: -0.03 + i * 0.1, y: 0.1 + i * 0.16, z: 0.08, rz: -0.2, bevel: 0.015 });
  const h = rig.joint('mHead', 'mNeck', 0.44, 0.62, 0);
  h.block(0.62, 0.28, 0.25, coat, { x: 0.2, y: -0.08, rz: -0.95, taper: [0.8, 0.8], bevel: 0.06 });
  h.block(0.26, 0.2, 0.21, shade(coat, -0.2), { x: 0.37, y: -0.34, rz: -0.95, bevel: 0.05 });
  h.block(0.03, 0.03, 0.05, '#141210', { x: 0.44, y: -0.4, z: 0.1 });
  h.cone(0.05, 0.16, coat, { x: -0.03, y: 0.19, z: 0.07, rz: 0.2, seg: 4 });
  h.cone(0.05, 0.16, coat, { x: -0.03, y: 0.19, z: -0.07, rz: 0.2, seg: 4 });
  h.block(0.07, 0.07, 0.05, '#141210', { x: 0.1, y: 0.02, z: 0.125, bevel: 0.015 });
  // Bridle.
  h.block(0.04, 0.3, 0.27, C.leatherDark, { x: 0.14, y: -0.12, rz: -0.2 });
  h.cyl(0.035, 0.035, 0.28, C.steel, { x: 0.38, y: -0.4, rx: HALF_PI, seg: 6, ...METAL });
  h.block(0.4, 0.035, 0.27, C.leatherDark, { x: 0.25, y: -0.26, rz: -0.95 });

  const legs: [string, string, number, number][] = [
    ['mLegFN', 'mKneeFN', 0.62, 0.17],
    ['mLegFF', 'mKneeFF', 0.62, -0.17],
    ['mLegBN', 'mKneeBN', -0.62, 0.17],
    ['mLegBF', 'mKneeBF', -0.62, -0.17],
  ];
  for (const [leg, knee, x, z] of legs) {
    const l = rig.joint(leg, 'mount', x, 1.3, z);
    l.block(0.22, 0.4, 0.16, coat, { y: -0.12, taper: [1.3, 1.1], bevel: 0.05 });
    l.cyl(0.08, 0.07, 0.4, coat, { y: -0.42, seg: 6 });
    const k = rig.joint(knee, leg, 0, -0.62, 0);
    k.sphere(0.075, coat, { ws: 6, hs: 5 });
    k.cyl(0.065, 0.06, 0.5, coat, { y: -0.26, seg: 6 });
    k.block(0.1, 0.08, 0.1, shade(coat, 0.3), { y: -0.5, bevel: 0.02 });
    k.block(0.16, 0.1, 0.14, '#2a241f', { x: 0.02, y: -0.6, taper: [0.8, 0.9], bevel: 0.03 });
  }
  const tail = rig.joint('mTail', 'mount', -0.98, 1.66, 0);
  tail.capsule(0.08, 0.35, mane, { x: -0.1, y: -0.12, rz: -0.9, seg: 6 });
  tail.capsule(0.09, 0.5, mane, { x: -0.28, y: -0.5, rz: -0.25, seg: 6 });
}

/** Saddle, girth and stirrups. */
function saddle(rig: RigBuilder, leather: ColorLike, cloth: ColorLike, trim: ColorLike): void {
  const m = rig.part('mount');
  m.block(0.82, 0.05, 0.9, cloth, { y: 1.93, bevel: 0.02 });
  m.block(0.84, 0.04, 0.92, trim, { y: 1.9, bevel: 0.01 });
  m.block(0.6, 0.14, 0.62, leather, { y: 2.0, taper: [0.9, 0.9], bevel: 0.05 });
  m.block(0.12, 0.2, 0.5, leather, { x: 0.28, y: 2.06, bevel: 0.04 });
  m.block(0.12, 0.16, 0.56, leather, { x: -0.28, y: 2.04, bevel: 0.04 });
  m.torus(0.46, 0.03, C.leatherDark, { y: 1.52, ry: HALF_PI, s: [1, 1.08, 0.95], ts: 18 });
  for (const z of [0.44, -0.44]) {
    m.cyl(0.012, 0.012, 0.5, C.leatherDark, { x: 0.05, y: 1.7, z, seg: 4 });
    m.torus(0.06, 0.015, C.steel, { x: 0.05, y: 1.42, z, ts: 8, ...METAL });
  }
}

/** A caparison's skirt, in front and behind, that sways with the gallop. */
function caparisonSkirt(rig: RigBuilder, color: ColorLike, trim: ColorLike): void {
  for (const [x, w] of [[0.62, 0.98], [-0.62, 0.98]] as const) {
    const f = G.sway(rig, 'D', 'mount', x, 1.38, 0);
    f.part.block(0.4, 0.42, w, color, { y: -0.2, taper: [1, 1.04], bevel: 0.02 });
    f.part.block(0.41, 0.05, w + 0.02, trim, { y: -0.4, bevel: 0.01 });
  }
}

export function knight(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  horse(rig, '#d9d5cc', '#6b6158');
  const m = rig.part('mount');
  // Caparison: the heraldic cloth over the warhorse.
  m.block(2.05, 0.72, 0.94, t.main, { y: 1.44, bevel: 0.08 });
  m.block(2.07, 0.08, 0.96, t.light, { y: 1.8, bevel: 0.02 });
  for (let i = 0; i < 4; i++) m.block(0.26, 0.26, 0.02, t.light, { x: -0.75 + i * 0.5, y: 1.48 + (i % 2) * 0.16, z: 0.48 });
  saddle(rig, C.leatherDark, t.main, t.light);
  caparisonSkirt(rig, t.main, t.light);
  // A steel chanfron down the face, a crinet over the neck.
  rig.part('mHead').block(0.52, 0.22, 0.29, C.steel, { x: 0.12, y: 0.04, rz: -0.95, bevel: 0.04, ...METAL });
  rig.part('mHead').cone(0.04, 0.2, C.steel, { x: -0.02, y: 0.22, rz: 0.5, ...METAL });
  rig.part('mNeck').block(0.38, 0.72, 0.34, t.main, { x: 0.18, y: 0.25, rz: -0.55, bevel: 0.05 });

  rider(
    rig,
    { skin: '#e0ae86', shirt: C.steel, pants: C.steel, boots: C.steel, sleeves: C.steel, gloves: C.iron, noFace: true },
    {
      head: (p) => G.greatHelm(p, t.light),
      torso: (p) => {
        p.block(0.36, 0.62, 0.5, t.main, { y: 0.26, bevel: 0.04 });
        p.block(0.05, 0.22, 0.2, C.gold, { x: 0.02, y: 0.36, z: 0.25, ...METAL });
        p.block(0.32, 0.22, 0.64, C.steel, { y: 0.55, bevel: 0.06, ...METAL });
        p.block(0.37, 0.05, 0.52, C.gold, { y: 0.0, bevel: 0.01, ...METAL });
      },
      arm: (p) => p.sphere(0.13, C.steel, { y: 0.02, s: [1.1, 0.9, 1.1], ...METAL }),
      fore: (p, near) => {
        if (!near) G.heaterShield(p, false, t.main, C.gold);
        p.cyl(0.085, 0.1, 0.1, C.steel, { y: -0.2, seg: 8, ...METAL });
      },
      shin: (p) => p.sphere(0.1, C.steel, { x: 0.05, s: [1, 0.8, 1], ...METAL }),
      weaponN: (p) => G.lance(p),
    },
    0,
    2.05,
  );
  G.pennant(rig, 'rweaponN', t.main, 2.1, 0.08, 0.55, 0.22);
  return finish(rig, { kind: 'rider', style: 'thrust', height: 3.5, strideLength: 2.9, off: 'shield' });
}

export function cuirassier(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  horse(rig, '#6b4630', '#2b1d14');
  const m = rig.part('mount');
  m.block(0.8, 0.5, 0.9, t.main, { y: 1.72, bevel: 0.04 });
  m.block(0.82, 0.06, 0.92, C.gold, { y: 1.48, bevel: 0.015, ...METAL });
  m.block(0.3, 0.3, 0.02, C.gold, { x: -0.2, y: 1.7, z: 0.46, ...METAL });
  saddle(rig, C.black, t.main, C.gold);
  // A rolled cloak and a holster behind the saddle.
  m.cyl(0.1, 0.1, 0.8, t.dark, { x: -0.42, y: 2.08, rx: HALF_PI, seg: 8 });
  m.block(0.2, 0.3, 0.1, C.black, { x: 0.36, y: 1.86, z: 0.36, rz: 0.3, bevel: 0.03 });

  rider(
    rig,
    { skin: '#e2ab85', shirt: t.main, pants: '#ece6d8', boots: C.black, sleeves: t.main, gloves: '#ece6d8', beard: '#5a3a22' },
    {
      head: (p) => G.cuirassierHelm(p, t.dark),
      torso: (p) => {
        p.block(0.38, 0.48, 0.53, C.steel, { y: 0.32, taper: [1.04, 1.06], bevel: 0.05, ...METAL });
        p.block(0.04, 0.4, 0.05, shade(C.steel, -0.25), { x: 0.2, y: 0.32, ...METAL });
        p.block(0.35, 0.05, 0.51, C.gold, { y: 0.56, bevel: 0.01, ...METAL });
        for (const z of [0.2, -0.2]) p.block(0.3, 0.05, 0.05, C.gold, { y: 0.45, z, rx: 0.3, ...METAL });
        G.bandolier(p, '#f4f1ea');
      },
      fore: (p) => p.cyl(0.09, 0.075, 0.12, '#ece6d8', { y: -0.19, seg: 8 }),
      shin: (p) => {
        p.cyl(0.13, 0.1, 0.2, C.black, { y: -0.05, seg: 8 });
        p.block(0.2, 0.28, 0.19, C.black, { y: -0.17, bevel: 0.03 });
      },
      weaponN: G.sabre,
    },
    0,
    2.05,
    0.9,
  );
  G.plume(rig, 'rhead', t.dark, -0.2, 0.55, 0.9);
  return finish(rig, { kind: 'rider', style: 'swing', height: 3.5, strideLength: 2.9 });
}
