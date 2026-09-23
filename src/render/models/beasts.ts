import { RigBuilder, shade, type ColorLike } from '../kit/builder';
import * as G from './gear';
import { C } from './gear';
import { humanoid, type Decor, type Look } from './humanoid';
import type { ModelTemplate } from './rig';
import { finish, type Team } from './team';

/**
 * Mounts and their riders. The beast owns joints mount / mNeck / mHead /
 * mLeg{F,B}{N,F} / mTail; the rider is a humanoid with prefix "r" seated on
 * the mount, so both animate together.
 */

const HALF_PI = Math.PI / 2;

function rider(rig: RigBuilder, look: Look, decor: Decor, x: number, saddleY: number, tilt?: number): void {
  humanoid(rig, look, decor, { prefix: 'r', parent: 'mount', x, y: saddleY - 0.78, seated: true, ...(tilt !== undefined ? { weaponTilt: tilt } : {}) });
}

// ─── Triceratops ────────────────────────────────────────────────────────────

export function trikeRider(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const hide = '#6f7f55';
  const belly = '#b8a97c';
  const m = rig.joint('mount', null);
  m.sphere(1, hide, { y: 1.28, s: [1.3, 0.74, 0.66], ws: 12, hs: 8 });
  m.sphere(1, belly, { y: 1.08, x: 0.05, s: [1.1, 0.5, 0.56], ws: 10, hs: 6 });
  for (let i = 0; i < 6; i++) m.box(0.22, 0.08, 0.3, shade(hide, -0.25), { x: -0.7 + i * 0.28, y: 1.98 - Math.abs(i - 2.5) * 0.04, z: 0.02 });
  m.sphere(0.62, C.fur, { x: 0.05, y: 1.72, s: [1, 0.45, 1.12] });
  m.box(0.22, 0.05, 1.28, t.main, { x: 0.05, y: 1.96, rx: 0 });
  m.box(0.08, 0.5, 0.05, t.main, { x: 0.05, y: 1.7, z: 0.68 });

  rig.joint('mNeck', 'mount', 1.1, 1.38, 0).sphere(0.42, hide, { s: [1.1, 0.9, 0.9] });
  const h = rig.joint('mHead', 'mNeck', 0.3, 0, 0);
  h.sphere(0.45, hide, { x: 0.3, y: -0.05, s: [1.35, 0.85, 0.78] });
  h.cone(0.2, 0.42, '#3f3a33', { x: 0.88, y: -0.16, rz: -HALF_PI - 0.25 });
  h.cyl(0.78, 0.78, 0.09, '#8e6f4f', { x: -0.1, y: 0.3, rz: HALF_PI - 0.55, seg: 12 });
  h.torus(0.62, 0.06, t.main, { x: -0.08, y: 0.3, ry: HALF_PI, rx: 0.55, ts: 16 });
  for (let i = 0; i < 7; i++) {
    const a = -1.3 + (i / 6) * 2.6;
    h.cone(0.06, 0.18, C.bone, { x: -0.18 - Math.cos(a) * 0.1, y: 0.3 + Math.cos(a) * 0.72, z: Math.sin(a) * 0.72, rz: HALF_PI - 0.55 - Math.cos(a) * 1.2 });
  }
  h.cone(0.075, 0.7, C.bone, { x: 0.5, y: 0.35, z: 0.2, rz: -1.05 });
  h.cone(0.075, 0.7, C.bone, { x: 0.5, y: 0.35, z: -0.2, rz: -1.05 });
  h.cone(0.07, 0.28, C.bone, { x: 0.78, y: 0.14, rz: -0.55 });
  h.box(0.08, 0.07, 0.05, '#1d1a18', { x: 0.42, y: 0.1, z: 0.27 });

  const legs: [string, number, number][] = [['mLegFN', 0.7, 0.44], ['mLegFF', 0.7, -0.44], ['mLegBN', -0.62, 0.46], ['mLegBF', -0.62, -0.46]];
  for (const [name, x, z] of legs) {
    const l = rig.joint(name, 'mount', x, 1.02, z);
    l.cyl(0.19, 0.16, 0.95, shade(hide, -0.1), { y: -0.47 });
    l.cyl(0.21, 0.23, 0.12, shade(hide, -0.3), { y: -0.97 });
  }
  rig.joint('mTail', 'mount', -1.2, 1.3, 0).cone(0.32, 1.3, hide, { x: -0.6, rz: HALF_PI, s: [1, 1, 0.8] });

  rider(
    rig,
    { skin: '#c68a5a', shirt: C.fur, pants: C.furDark, boots: C.leatherDark, sleeves: null, beard: '#3b2a1e' },
    {
      head: (p) => {
        G.wildHair(p, '#3b2a1e');
        G.feather(p, t.main);
      },
      torso: (p) => G.sash(p, t.main),
      weaponN: (p) => G.spear(p, 2.2, C.flint, 0.7),
    },
    0.05,
    2.02,
  );
  return finish(rig, { kind: 'rider', style: 'thrust', height: 3.4, strideLength: 2.6 });
}

// ─── War elephant ───────────────────────────────────────────────────────────

export function warElephant(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  const skin = '#8d8a86';
  const m = rig.joint('mount', null);
  m.sphere(1, skin, { y: 2.2, s: [1.55, 1.05, 0.95], ws: 12, hs: 8 });
  // Caparison with gold trim.
  m.box(1.9, 0.95, 2.02, t.main, { x: -0.1, y: 2.45 });
  m.box(1.92, 0.1, 2.04, C.gold, { x: -0.1, y: 1.98, ...G.tex.METAL });
  m.box(0.6, 0.6, 0.06, t.light, { x: -0.1, y: 2.45, z: 1.03 });
  // Howdah.
  m.box(1.2, 0.5, 1.1, C.wood, { x: -0.25, y: 3.28 });
  m.box(1.26, 0.08, 1.16, C.gold, { x: -0.25, y: 3.55, ...G.tex.METAL });
  for (const [dx, dz] of [[-0.8, 0.5], [0.3, 0.5], [-0.8, -0.5], [0.3, -0.5]]) m.cyl(0.035, 0.035, 0.9, C.woodDark, { x: dx!, y: 3.95, z: dz! });
  m.cone(0.95, 0.5, t.dark, { x: -0.25, y: 4.55, seg: 4, ry: Math.PI / 4 });
  m.cyl(0.025, 0.025, 1.0, C.woodDark, { x: -0.25, y: 5.2 });
  m.box(0.5, 0.3, 0.02, t.main, { x: 0.0, y: 5.5 });

  rig.joint('mNeck', 'mount', 1.35, 2.55, 0).sphere(0.6, skin, { s: [1, 1, 0.9] });
  const h = rig.joint('mHead', 'mNeck', 0.25, 0, 0);
  h.sphere(0.72, skin, { x: 0.35, y: 0.05, s: [1, 1.08, 0.88], ws: 10, hs: 8 });
  h.sphere(0.62, shade(skin, -0.08), { x: 0.02, y: 0.1, z: 0.62, s: [0.75, 1.05, 0.22] });
  h.sphere(0.62, shade(skin, -0.08), { x: 0.02, y: 0.1, z: -0.62, s: [0.75, 1.05, 0.22] });
  h.box(0.3, 0.35, 0.02, t.main, { x: 0.02, y: 0.1, z: 0.76 });
  h.tube([[0.95, -0.15, 0], [1.2, -0.7, 0], [1.25, -1.3, 0], [1.45, -1.7, 0]], 0.15, skin, { seg: 10 });
  h.cone(0.08, 0.9, C.bone, { x: 1.05, y: -0.55, z: 0.28, rz: -2.2 });
  h.cone(0.08, 0.9, C.bone, { x: 1.05, y: -0.55, z: -0.28, rz: -2.2 });
  h.box(0.08, 0.07, 0.05, '#1d1a18', { x: 0.75, y: 0.22, z: 0.52 });
  h.box(0.5, 0.12, 1.3, t.main, { x: 0.35, y: 0.62 });

  const legs: [string, number, number][] = [['mLegFN', 0.85, 0.52], ['mLegFF', 0.85, -0.52], ['mLegBN', -0.85, 0.52], ['mLegBF', -0.85, -0.52]];
  for (const [name, x, z] of legs) {
    const l = rig.joint(name, 'mount', x, 1.55, z);
    l.cyl(0.32, 0.3, 1.5, skin, { y: -0.75, seg: 10 });
    for (let i = 0; i < 3; i++) l.box(0.1, 0.08, 0.1, C.bone, { x: 0.28, y: -1.48, z: -0.15 + i * 0.15 });
  }
  rig.joint('mTail', 'mount', -1.5, 2.3, 0).cyl(0.04, 0.05, 0.9, skin, { x: -0.1, y: -0.4, rz: -0.25 });

  rider(
    rig,
    { skin: '#b57a4c', shirt: C.linen, pants: C.linen, boots: C.leather, sleeves: null, hair: '#1f1a17' },
    { head: (p) => G.headband(p, t.main), torso: (p) => G.sash(p, t.main), weaponN: (p) => G.spear(p, 1.2, C.bronze, 0.4) },
    1.05,
    3.1,
  );
  return finish(rig, { kind: 'rider', style: 'thrust', height: 5.6, strideLength: 3.3 });
}

// ─── Horses ─────────────────────────────────────────────────────────────────

function horse(rig: RigBuilder, coat: ColorLike, mane: ColorLike): void {
  const m = rig.joint('mount', null);
  m.sphere(1, coat, { y: 1.48, s: [0.98, 0.5, 0.42], ws: 12, hs: 8 });
  m.sphere(0.46, coat, { x: 0.62, y: 1.52, s: [1, 1.05, 0.95] });
  m.sphere(0.48, coat, { x: -0.62, y: 1.52, s: [1, 1, 0.95] });

  const n = rig.joint('mNeck', 'mount', 0.78, 1.72, 0);
  n.box(0.34, 0.85, 0.28, coat, { x: 0.18, y: 0.3, rz: -0.55 });
  n.box(0.1, 0.8, 0.12, mane, { x: 0.03, y: 0.38, rz: -0.55 });
  const h = rig.joint('mHead', 'mNeck', 0.44, 0.62, 0);
  h.box(0.62, 0.26, 0.24, coat, { x: 0.2, y: -0.08, rz: -0.95 });
  h.box(0.24, 0.2, 0.2, shade(coat, -0.2), { x: 0.36, y: -0.33, rz: -0.95 });
  h.cone(0.05, 0.14, coat, { x: -0.02, y: 0.18, z: 0.07 });
  h.cone(0.05, 0.14, coat, { x: -0.02, y: 0.18, z: -0.07 });
  h.box(0.06, 0.06, 0.05, '#141210', { x: 0.1, y: 0.02, z: 0.12 });

  const legs: [string, string, number, number][] = [
    ['mLegFN', 'mKneeFN', 0.62, 0.17],
    ['mLegFF', 'mKneeFF', 0.62, -0.17],
    ['mLegBN', 'mKneeBN', -0.62, 0.17],
    ['mLegBF', 'mKneeBF', -0.62, -0.17],
  ];
  for (const [leg, knee, x, z] of legs) {
    rig.joint(leg, 'mount', x, 1.3, z).cyl(0.12, 0.08, 0.66, coat, { y: -0.3 });
    const k = rig.joint(knee, leg, 0, -0.62, 0);
    k.cyl(0.07, 0.06, 0.58, coat, { y: -0.28 });
    k.box(0.14, 0.1, 0.13, '#2a241f', { x: 0.02, y: -0.6 });
  }
  rig.joint('mTail', 'mount', -0.98, 1.66, 0).capsule(0.08, 0.6, mane, { x: -0.18, y: -0.3, rz: -0.5 });
}

export function knight(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  horse(rig, '#d9d5cc', '#6b6158');
  const m = rig.part('mount');
  // Caparison: the heraldic cloth over the warhorse.
  m.box(2.05, 0.72, 0.94, t.main, { y: 1.38 });
  m.box(2.07, 0.08, 0.96, t.light, { y: 1.02 });
  for (let i = 0; i < 4; i++) m.box(0.26, 0.26, 0.02, t.light, { x: -0.75 + i * 0.5, y: 1.42 + (i % 2) * 0.2, z: 0.48 });
  m.box(0.6, 0.12, 0.7, C.leatherDark, { y: 1.98 });
  rig.part('mHead').box(0.5, 0.2, 0.28, C.steel, { x: 0.12, y: 0.02, rz: -0.95, ...G.tex.METAL });
  rig.part('mNeck').box(0.36, 0.7, 0.32, t.main, { x: 0.18, y: 0.25, rz: -0.55 });

  rider(
    rig,
    { skin: '#e0ae86', shirt: C.steel, pants: C.steel, boots: C.steel, sleeves: C.steel, gloves: C.iron, noFace: true },
    {
      head: (p) => G.greatHelm(p, t.light),
      torso: (p) => {
        p.box(0.35, 0.62, 0.5, t.main, { y: 0.26 });
        p.box(0.05, 0.22, 0.2, C.gold, { x: 0.02, y: 0.36, z: 0.25, ...G.tex.METAL });
        p.box(0.3, 0.2, 0.62, C.steel, { y: 0.55, ...G.tex.METAL });
      },
      arm: (p, near) => !near && G.heaterShield(p, false, t.main, C.gold),
      weaponN: (p) => G.lance(p, t.main),
    },
    0,
    2.05,
  );
  return finish(rig, { kind: 'rider', style: 'thrust', height: 3.5, strideLength: 2.9 });
}

export function cuirassier(t: Team): ModelTemplate {
  const rig = new RigBuilder();
  horse(rig, '#6b4630', '#2b1d14');
  const m = rig.part('mount');
  m.box(0.8, 0.5, 0.9, t.main, { y: 1.72 });
  m.box(0.82, 0.06, 0.92, C.gold, { y: 1.48, ...G.tex.METAL });
  m.box(0.6, 0.12, 0.7, C.black, { y: 1.98 });

  rider(
    rig,
    { skin: '#e2ab85', shirt: t.main, pants: '#ece6d8', boots: C.black, sleeves: t.main, gloves: '#ece6d8', beard: '#5a3a22' },
    {
      head: (p) => G.cuirassierHelm(p, t.dark),
      torso: (p) => {
        p.box(0.37, 0.48, 0.52, C.steel, { y: 0.32, ...G.tex.METAL });
        p.box(0.34, 0.05, 0.5, C.gold, { y: 0.56, ...G.tex.METAL });
      },
      leg: (p) => p.box(0.23, 0.42, 0.22, C.black, { y: -0.48 }),
      weaponN: G.sabre,
    },
    0,
    2.05,
    0.9,
  );
  return finish(rig, { kind: 'rider', style: 'swing', height: 3.5, strideLength: 2.9 });
}
