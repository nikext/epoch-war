import { RigBuilder, shade, type Part } from '../kit/builder';
import * as G from './gear';
import { C } from './gear';
import { humanoid, type Decor, type Look } from './humanoid';
import type { AttackStyle, ModelTemplate } from './rig';
import { finish, type Team } from './team';

/**
 * The foot soldiers of every age. Mounted units live in beasts.ts, machines in
 * machines.ts.
 */

const METAL = G.tex.METAL;
const HALF_PI = Math.PI / 2;

interface SoldierMeta {
  style: AttackStyle;
  hand?: 'near' | 'far';
  height?: number;
  /** Weapon tilt for swing weapons (see gear.ts). */
  tilt?: number;
  /** Muzzle joint in the weapon's frame, for flashes and tracers. */
  muzzle?: [number, number];
  /** Off-hand grip on a two-handed weapon, in the weapon's frame. */
  grip?: [number, number];
  off?: 'shield' | 'fencer';
  /** Extra joints: capes, plumes, ammunition (runs after the body is built). */
  rig?: (r: RigBuilder) => void;
}

function soldier(look: Look, decor: Decor, meta: SoldierMeta): ModelTemplate {
  const rig = new RigBuilder();
  const opts = meta.tilt !== undefined ? { weaponTilt: meta.tilt } : {};
  humanoid(rig, look, decor, opts);
  meta.rig?.(rig);
  const hand = meta.hand ?? 'near';
  if (meta.muzzle) rig.joint('muzzle', hand === 'near' ? 'weaponN' : 'weaponF', meta.muzzle[0], meta.muzzle[1], 0);
  return finish(rig, {
    kind: 'humanoid',
    style: meta.style,
    hand,
    height: meta.height ?? 2.15,
    strideLength: 1.45,
    ...(meta.grip ? { grip: meta.grip } : {}),
    ...(meta.off ? { off: meta.off } : {}),
  });
}

/** A hanging flap (loincloth, kilt panel, coat tail) that swings on the march. */
function flap(r: RigBuilder, parent: string, color: string, x: number, y: number, w: number, h: number, d = 0.04, trim?: string): void {
  const f = G.sway(r, 'D', parent, x, y, 0);
  f.part.block(d, h, w, color, { y: -h / 2, taper: [1, 1.08], bevel: 0.012 });
  if (trim) f.part.block(d + 0.01, 0.04, w, trim, { y: -h + 0.03, bevel: 0.008 });
}

// ─── Stone Age ──────────────────────────────────────────────────────────────

export function clubber(t: Team): ModelTemplate {
  return soldier(
    { skin: '#c68a5a', shirt: C.fur, pants: C.furDark, boots: C.leatherDark, sleeves: null, bulk: 1.12, beard: '#3b2a1e' },
    {
      head: (p) => {
        G.wildHair(p, '#3b2a1e');
        p.block(0.03, 0.12, 0.05, t.main, { x: 0.17, y: 0.24, z: 0.17, e: 0.2 });
        p.block(0.03, 0.04, 0.12, t.main, { x: 0.19, y: 0.33, z: 0.08, e: 0.2 });
        p.cone(0.03, 0.18, C.bone, { x: -0.05, y: 0.5, rz: 0.4, seg: 5 });
      },
      torso: (p) => {
        // A fur wrap over one shoulder, a bone necklace, a team sash.
        p.block(0.36, 0.26, 0.52, C.furDark, { y: 0.5, rx: 0.3, bevel: 0.05 });
        for (let i = 0; i < 4; i++) p.cone(0.05, 0.12, shade(C.furDark, 0.1 * (i % 2)), { x: -0.05 + (i % 2) * 0.1, y: 0.38, z: -0.2 + i * 0.08, rz: Math.PI, seg: 4 });
        G.sash(p, t.main, 1.12);
        for (let i = 0; i < 5; i++) p.cone(0.028, 0.09, C.bone, { x: 0.175, y: 0.52 - Math.sin((i / 4) * Math.PI) * 0.07, z: -0.12 + i * 0.06, rz: -1.57, seg: 5 });
      },
      hips: (p) => {
        p.block(0.34, 0.26, 0.5, C.fur, { y: -0.12, taper: [1, 0.95], bevel: 0.04 });
        p.block(0.35, 0.05, 0.51, C.rope, { y: 0.02, bevel: 0.01 });
      },
      fore: (p) => p.cyl(0.08, 0.08, 0.1, C.leather, { y: -0.16, seg: 6 }),
      shin: (p) => p.block(0.2, 0.16, 0.2, C.fur, { y: -0.2, bevel: 0.04 }),
      weaponN: G.club,
    },
    {
      style: 'swing',
      tilt: 0.9,
      rig: (r) => {
        flap(r, 'hips', C.furDark, 0.16, -0.02, 0.24, 0.3, 0.04, t.main);
        flap(r, 'hips', C.fur, -0.16, -0.02, 0.3, 0.28);
      },
    },
  );
}

export function slinger(t: Team): ModelTemplate {
  return soldier(
    { skin: '#b97e52', hair: '#2a1d14', shirt: '#9b6b3e', pants: C.furDark, boots: C.leatherDark, sleeves: null, bulk: 0.95 },
    {
      head: (p) => G.headband(p, t.main),
      torso: (p) => {
        p.block(0.34, 0.36, 0.49, '#b88452', { y: 0.38, bevel: 0.04 });
        p.block(0.35, 0.05, 0.5, shade('#b88452', -0.3), { y: 0.2, bevel: 0.01 });
        for (let i = 0; i < 6; i++) p.sphere(0.022, i % 2 ? t.light : '#e8d9b0', { x: 0.17, y: 0.53 - Math.sin((i / 5) * Math.PI) * 0.06, z: -0.12 + i * 0.048 });
        G.bandolier(p, C.leatherDark, 0.95);
      },
      hips: (p) => {
        p.block(0.32, 0.22, 0.46, C.furDark, { y: -0.1, bevel: 0.03 });
        // A bag of sling stones.
        p.block(0.16, 0.18, 0.12, C.leather, { x: -0.02, y: -0.06, z: 0.27, bevel: 0.04 });
        p.ico(0.04, C.stone, { x: 0.0, y: 0.04, z: 0.27 });
      },
      arm: (p, near) => near && p.block(0.17, 0.06, 0.17, t.main, { y: -0.1, bevel: 0.015 }),
      shin: (p) => {
        for (let i = 0; i < 3; i++) p.block(0.18, 0.03, 0.18, C.rope, { y: -0.05 - i * 0.06, rz: 0.1, bevel: 0.008 });
      },
      weaponN: G.sling,
    },
    { style: 'throw', rig: (r) => G.plume(r, 'head', t.light, -0.15, 0.4, 0.7) },
  );
}

export function spearHunter(t: Team): ModelTemplate {
  return soldier(
    { skin: '#c08a5c', shirt: C.furGrey, pants: '#5c4430', boots: C.leatherDark, sleeves: null },
    {
      head: (p) => {
        // A wolf's head worn as a hood.
        p.dome(0.25, C.furGrey, { y: 0.26, x: -0.04, ws: 10 });
        p.block(0.24, 0.12, 0.18, '#6d665c', { x: 0.2, y: 0.42, taper: [0.7, 0.8], bevel: 0.03 });
        p.block(0.06, 0.05, 0.06, '#2a2622', { x: 0.33, y: 0.42 });
        for (const z of [0.1, -0.1]) {
          p.cone(0.07, 0.15, C.furGrey, { x: -0.02, y: 0.52, z, seg: 4 });
          p.block(0.03, 0.03, 0.03, '#d8c060', { x: 0.24, y: 0.46, z: z * 0.8, e: 0.5 });
        }
        p.block(0.05, 0.03, 0.14, C.bone, { x: 0.3, y: 0.37 });
        p.block(0.03, 0.1, 0.05, t.main, { x: 0.17, y: 0.24, z: 0.17 });
      },
      torso: (p) => {
        p.block(0.37, 0.3, 0.53, C.furGrey, { y: 0.52, bevel: 0.05 });
        for (let i = 0; i < 5; i++) p.cone(0.035, 0.1, C.bone, { x: 0.18, y: 0.44 - Math.sin((i / 4) * Math.PI) * 0.08, z: -0.12 + i * 0.06, rz: -HALF_PI, seg: 4 });
        p.block(0.04, 0.35, 0.08, t.main, { x: 0.17, y: 0.25, z: 0.12 });
        // A spare spear across the back.
        p.cyl(0.02, 0.02, 1.3, C.woodLight, { x: -0.22, y: 0.4, rz: 0.5, seg: 5 });
        p.cone(0.04, 0.16, C.flint, { x: -0.54, y: 0.97, rz: 0.5, seg: 4 });
      },
      hips: (p) => p.block(0.32, 0.2, 0.46, '#5c4430', { y: -0.1, bevel: 0.03 }),
      fore: (p) => p.cyl(0.075, 0.075, 0.12, C.furGrey, { y: -0.15, seg: 6 }),
      shin: (p) => p.block(0.19, 0.2, 0.19, C.furGrey, { y: -0.19, bevel: 0.04 }),
      weaponN: (p) => G.throwingSpear(p),
    },
    {
      style: 'throw',
      rig: (r) => {
        G.cape(r, 'torso', C.furGrey, 0.7, undefined, 0.5);
      },
    },
  );
}

// ─── Ancient Age ────────────────────────────────────────────────────────────

export function hoplite(t: Team): ModelTemplate {
  return soldier(
    { skin: '#d19a6c', shirt: C.bronze, pants: C.linen, boots: C.leather, sleeves: null, noFace: true },
    {
      head: (p) => G.corinthianHelmet(p, t.main),
      torso: (p) => {
        // A muscled bronze cuirass.
        p.block(0.36, 0.52, 0.5, C.bronze, { y: 0.32, taper: [1.04, 1.1], bevel: 0.05, ...METAL });
        p.block(0.05, 0.06, 0.18, shade(C.bronze, -0.25), { x: 0.18, y: 0.44, z: 0.1, bevel: 0.015, ...METAL });
        p.block(0.05, 0.06, 0.18, shade(C.bronze, -0.25), { x: 0.18, y: 0.44, z: -0.1, bevel: 0.015, ...METAL });
        for (let i = 0; i < 3; i++) p.block(0.04, 0.03, 0.26, shade(C.bronze, -0.3), { x: 0.185, y: 0.12 + i * 0.08, ...METAL });
        p.block(0.38, 0.05, 0.52, shade(C.bronze, -0.2), { y: 0.06, bevel: 0.015, ...METAL });
      },
      hips: (p) => {
        // Pteruges: a skirt of leather strips in the team colour.
        for (let i = 0; i < 7; i++) p.block(0.06, 0.26, 0.07, i % 2 ? t.main : t.dark, { x: 0.15, y: -0.12, z: -0.2 + i * 0.066, bevel: 0.01 });
        for (let i = 0; i < 6; i++) p.block(0.07, 0.26, 0.06, i % 2 ? t.main : t.dark, { x: 0.1 - i * 0.05, y: -0.12, z: 0.21, bevel: 0.01 });
        p.block(0.34, 0.2, 0.46, C.linen, { y: -0.1, bevel: 0.03 });
      },
      shin: (p) => {
        p.block(0.2, 0.28, 0.19, C.bronze, { x: 0.015, y: -0.13, taper: [1.1, 1.1], bevel: 0.04, ...METAL });
        p.sphere(0.07, C.bronze, { x: 0.06, y: -0.01, s: [1, 0.8, 1], ...METAL });
      },
      fore: (p, near) => near && G.roundShield(p, true, t.main, C.bronze, t.light),
      weaponF: (p) => G.spear(p, 2.3, C.bronze, 0.8),
    },
    {
      style: 'thrust',
      hand: 'far',
      height: 2.35,
      off: 'shield',
      rig: (r) => G.cape(r, 'torso', t.dark, 0.95, t.main),
    },
  );
}

export function archer(t: Team): ModelTemplate {
  return soldier(
    { skin: '#b57a4c', shirt: C.linen, pants: C.linen, boots: C.leather, sleeves: null, eye: '#111' },
    {
      head: (p) => G.nemes(p, t.main),
      torso: (p) => {
        G.collar(p, C.gold);
        G.sash(p, t.main);
        G.quiver(p, C.leather, t.light);
      },
      hips: (p) => {
        // Shendyt: a pleated kilt with a front panel.
        p.block(0.36, 0.3, 0.48, C.linen, { y: -0.13, taper: [1, 0.95], bevel: 0.03 });
        for (let i = 0; i < 4; i++) p.box(0.37, 0.28, 0.01, shade(C.linen, -0.12), { y: -0.13, z: -0.18 + i * 0.12 });
        p.block(0.1, 0.32, 0.06, t.main, { x: 0.16, y: -0.12, taper: [0.8, 1], bevel: 0.01 });
        p.block(0.37, 0.05, 0.49, C.gold, { y: 0.03, bevel: 0.01, ...METAL });
      },
      fore: (p) => p.cyl(0.075, 0.07, 0.12, C.gold, { y: -0.17, seg: 8, ...METAL }),
      shin: (p) => p.block(0.17, 0.04, 0.17, C.leather, { y: -0.2, bevel: 0.01 }),
    },
    {
      style: 'bow',
      hand: 'near',
      rig: (r) => G.drawnBow(r, 'weaponF', '', '#3d2a1a', 0.62, t.light),
    },
  );
}

export function sunPriest(t: Team): ModelTemplate {
  return soldier(
    { skin: '#b8804f', shirt: '#f3ecd9', pants: '#f3ecd9', boots: '#c9a36a', sleeves: '#f3ecd9' },
    {
      head: (p) => {
        p.cyl(0.13, 0.19, 0.3, C.linen, { y: 0.5, seg: 10 });
        p.cyl(0.14, 0.14, 0.04, C.gold, { y: 0.4, seg: 10, ...METAL });
        p.cyl(0.1, 0.13, 0.04, C.gold, { y: 0.64, seg: 10, ...METAL });
        p.sphere(0.055, t.glow, { x: 0.13, y: 0.55, e: 1.4 });
      },
      torso: (p) => {
        G.collar(p, C.gold);
        p.block(0.37, 0.1, 0.5, t.main, { y: 0.05, bevel: 0.02 });
        p.block(0.08, 0.5, 0.1, t.main, { x: 0.17, y: -0.05, bevel: 0.015 });
        p.cyl(0.07, 0.07, 0.02, C.gold, { x: 0.18, y: 0.35, rz: HALF_PI, seg: 10, ...METAL });
      },
      hips: (p) => {
        p.cyl(0.26, 0.38, 0.72, '#f3ecd9', { y: -0.35, seg: 10 });
        p.cyl(0.385, 0.385, 0.05, C.gold, { y: -0.68, seg: 10, ...METAL });
      },
      fore: (p) => p.cyl(0.09, 0.1, 0.1, C.gold, { y: -0.18, seg: 8, ...METAL }),
      weaponN: (p) => G.sunStaff(p, '#ffcf5a'),
    },
    {
      style: 'cast',
      height: 2.4,
      muzzle: [0, 1.14],
      rig: (r) => flap(r, 'hips', t.main, 0.2, -0.05, 0.12, 0.62, 0.03, C.gold),
    },
  );
}

// ─── Medieval Age ───────────────────────────────────────────────────────────

export function manAtArms(t: Team): ModelTemplate {
  return soldier(
    { skin: '#e0ae86', shirt: C.iron, pants: '#4d4d52', boots: C.leatherDark, sleeves: C.iron, gloves: C.leatherDark, bulk: 1.05, belt: C.leatherDark },
    {
      head: (p) => G.nasalHelm(p),
      torso: (p) => {
        G.tabard(p, t.main, t.light, 1.05);
        p.block(0.2, 0.18, 0.6, C.iron, { y: 0.52, bevel: 0.04, m: 0.6, r: 0.55 });
      },
      hips: (p) => {
        // Mail skirt below the tabard; a scabbard at the hip.
        p.block(0.34, 0.22, 0.47, C.iron, { y: -0.18, taper: [1, 0.95], bevel: 0.03, m: 0.6, r: 0.55 });
        p.block(0.05, 0.1, 0.5, t.main, { x: 0.15, y: -0.3, bevel: 0.01 });
        p.block(0.7, 0.07, 0.05, C.leatherDark, { x: -0.3, y: -0.2, z: -0.26, rz: 0.55, bevel: 0.015 });
      },
      fore: (p, near) => {
        if (near) G.kiteShield(p, true, t.main, t.light);
        p.block(0.14, 0.08, 0.14, C.leatherDark, { y: -0.2, bevel: 0.02 });
      },
      shin: (p) => p.block(0.18, 0.08, 0.18, C.iron, { y: 0.0, bevel: 0.02, ...METAL }),
      weaponF: (p) => G.sword(p, 0.82),
    },
    { style: 'swing', hand: 'far', tilt: 0.9, off: 'shield' },
  );
}

export function crossbowman(t: Team): ModelTemplate {
  return soldier(
    { skin: '#dba37c', shirt: '#b59b6e', pants: '#5d4a36', boots: '#3f3128', sleeves: '#a88d61', beard: '#6b4a2b', belt: C.leather },
    {
      head: (p) => G.kettleHelm(p),
      torso: (p) => {
        // A quilted gambeson under a short team tabard.
        for (let i = 0; i < 4; i++) p.block(0.34, 0.03, 0.49, shade('#b59b6e', -0.2), { y: 0.1 + i * 0.13 });
        p.block(0.35, 0.56, 0.28, t.main, { y: 0.3, z: 0.1, bevel: 0.02 });
        p.block(0.36, 0.05, 0.3, t.dark, { y: 0.04, z: 0.1, bevel: 0.01 });
        p.block(0.2, 0.08, 0.52, '#a88d61', { y: 0.56, bevel: 0.03 });
      },
      hips: (p) => {
        // A bolt quiver on the hip.
        p.cyl(0.075, 0.065, 0.4, C.leather, { x: -0.2, y: -0.05, z: -0.26, rz: 0.2, seg: 8 });
        for (let i = 0; i < 3; i++) p.cyl(0.01, 0.01, 0.12, C.linen, { x: -0.24 + i * 0.02, y: 0.18, z: -0.26 + (i - 1) * 0.02, rz: 0.2, seg: 4 });
        p.block(0.3, 0.2, 0.44, '#8c7651', { y: -0.1, bevel: 0.03 });
        G.pouches(p, C.leather, 1, 0.02);
      },
      shin: (p) => p.block(0.19, 0.12, 0.19, '#3f3128', { y: -0.18, bevel: 0.03 }),
      weaponN: G.crossbow,
    },
    {
      style: 'gun',
      muzzle: [0.5, 0.04],
      grip: [0.26, -0.02],
      rig: (r) => G.crossbowBolt(r.joint('ammo', 'weaponN', 0.2, 0.05, 0)),
    },
  );
}

export function pikeman(t: Team): ModelTemplate {
  return soldier(
    { skin: '#d9a57f', shirt: t.main, pants: t.dark, boots: C.black, sleeves: t.light, bulk: 1.05, beard: '#6b4a2b' },
    {
      head: (p) => G.morion(p, t.light),
      torso: (p) => {
        // A steel breastplate with a ridge; slashed sleeves show the team colours.
        p.block(0.38, 0.46, 0.53, C.steel, { y: 0.34, taper: [1.04, 1.06], bevel: 0.05, ...METAL });
        p.block(0.04, 0.4, 0.05, shade(C.steel, -0.25), { x: 0.2, y: 0.34, bevel: 0.01, ...METAL });
        p.block(0.39, 0.05, 0.54, shade(C.steel, -0.2), { y: 0.13, bevel: 0.015, ...METAL });
        for (let i = 0; i < 4; i++) p.sphere(0.018, C.gold, { x: 0.19, y: 0.5, z: -0.18 + i * 0.12, ...METAL });
      },
      hips: (p) => {
        // Tassets over the thighs.
        for (const z of [0.13, -0.13]) p.block(0.34, 0.16, 0.2, C.steel, { x: 0.02, y: -0.14, z, taper: [1, 0.9], bevel: 0.03, ...METAL });
      },
      arm: (p) => {
        for (let i = 0; i < 3; i++) p.block(0.03, 0.2, 0.05, t.dark, { x: 0.075, y: -0.14, z: -0.04 + i * 0.04 });
      },
      leg: (p) => {
        p.block(0.22, 0.08, 0.21, t.light, { y: -0.3, bevel: 0.02 });
        for (let i = 0; i < 2; i++) p.block(0.03, 0.26, 0.05, t.light, { x: 0.1, y: -0.16, z: -0.03 + i * 0.06 });
      },
      weaponN: (p) => G.spear(p, 3.9, C.steel, 1.3),
    },
    { style: 'thrust', height: 2.35, grip: [-0.5, 0], rig: (r) => G.plume(r, 'head', t.light, -0.16, 0.5, 0.8) },
  );
}

// ─── Gunpowder Age ──────────────────────────────────────────────────────────

export function duelist(t: Team): ModelTemplate {
  return soldier(
    { skin: '#e5b28c', hair: '#5a3a22', shirt: t.main, pants: '#2d2a33', boots: '#3a2718', sleeves: t.light, gloves: '#e6dcc7', bulk: 0.95, beard: '#5a3a22', belt: C.leatherDark },
    {
      head: (p) => G.cavalierHat(p, '#f1ede3'),
      torso: (p) => {
        // Ruff collar, a slashed doublet, a baldric.
        p.cyl(0.19, 0.25, 0.08, '#f5f2ea', { y: 0.58, seg: 12 });
        p.torus(0.22, 0.03, '#f5f2ea', { y: 0.58, rx: HALF_PI, ts: 14, rs: 4 });
        for (let i = 0; i < 4; i++) p.block(0.02, 0.36, 0.04, t.light, { x: 0.17, y: 0.32, z: -0.15 + i * 0.1 });
        p.block(0.06, 0.5, 0.49, shade(t.main, -0.3), { x: 0.14, y: 0.3, bevel: 0.015 });
        for (let i = 0; i < 5; i++) p.sphere(0.016, C.gold, { x: 0.18, y: 0.12 + i * 0.09, ...METAL });
        G.bandolier(p, C.leatherDark, 0.95);
      },
      hips: (p) => {
        // Puffed breeches.
        for (const z of [0.12, -0.12]) p.sphere(0.16, t.dark, { y: -0.12, z, s: [1, 0.8, 0.9] });
      },
      fore: (p) => p.cyl(0.085, 0.07, 0.1, '#e6dcc7', { y: -0.19, seg: 8 }),
      shin: (p) => {
        // Bucket-top boots.
        p.cyl(0.13, 0.1, 0.2, '#3a2718', { y: -0.06, seg: 8 });
        p.block(0.19, 0.22, 0.18, '#3a2718', { y: -0.18, bevel: 0.03 });
      },
      weaponN: G.rapier,
    },
    {
      style: 'thrust',
      off: 'fencer',
      rig: (r) => {
        G.cape(r, 'torso', t.dark, 0.8, t.light, 0.42);
        G.plume(r, 'head', '#f1ede3', -0.15, 0.5, 0.9, 0.14);
      },
    },
  );
}

export function musketeer(t: Team): ModelTemplate {
  return soldier(
    { skin: '#e2ab85', shirt: t.main, pants: '#ebe5d6', boots: C.black, sleeves: t.main, gloves: '#e2ab85', hair: '#6b4a2b' },
    {
      head: (p) => {
        G.tricorn(p, C.gold);
        p.block(0.1, 0.18, 0.3, '#f0ede5', { x: -0.2, y: 0.18, bevel: 0.03 });
        p.cyl(0.03, 0.03, 0.06, C.black, { x: -0.25, y: 0.12, rz: HALF_PI, seg: 6 });
      },
      torso: (p) => {
        // White crossbelts over a coat with facings and brass buttons.
        p.block(0.34, 0.07, 0.52, '#f4f1ea', { y: 0.35, rx: 0.7, bevel: 0.015 });
        p.block(0.34, 0.07, 0.52, '#f4f1ea', { y: 0.35, rx: -0.7, bevel: 0.015 });
        p.block(0.05, 0.55, 0.14, shade(t.main, -0.35), { x: 0.16, y: 0.3, bevel: 0.01 });
        p.block(0.06, 0.2, 0.16, t.light, { x: 0.16, y: 0.46, bevel: 0.015 });
        for (let i = 0; i < 4; i++) p.sphere(0.022, C.gold, { x: 0.18, y: 0.14 + i * 0.1, z: 0.09, ...METAL });
        p.block(0.2, 0.08, 0.2, C.gold, { y: 0.58, z: 0.26, bevel: 0.02, ...METAL });
        p.cyl(0.05, 0.05, 0.03, '#f4f1ea', { x: 0.18, y: 0.35, rz: HALF_PI, seg: 8 });
      },
      hips: (p) => {
        // A cartridge box.
        p.block(0.2, 0.15, 0.13, C.black, { x: -0.06, y: -0.02, z: -0.27, bevel: 0.03 });
        p.block(0.08, 0.06, 0.02, C.gold, { x: -0.06, y: -0.02, z: -0.34, ...METAL });
      },
      fore: (p) => p.block(0.15, 0.08, 0.15, t.light, { y: -0.18, bevel: 0.02 }),
      shin: (p) => {
        // Black gaiters with buttons.
        p.block(0.18, 0.3, 0.18, C.black, { y: -0.14, bevel: 0.03 });
        for (let i = 0; i < 3; i++) p.sphere(0.012, '#555', { x: 0.02, y: -0.05 - i * 0.08, z: 0.09 });
      },
      weaponN: G.musket,
    },
    {
      style: 'gun',
      muzzle: [1.05, 0.05],
      grip: [0.34, 0],
      rig: (r) => {
        flap(r, 'hips', t.main, -0.14, 0.02, 0.2, 0.42, 0.05, t.light);
        const turn = G.sway(r, 'D', 'hips', -0.1, 0.02, 0.22);
        turn.part.block(0.16, 0.36, 0.05, t.light, { y: -0.18, bevel: 0.01 });
      },
    },
  );
}

// ─── Industrial Age ─────────────────────────────────────────────────────────

const WWI = { skin: '#dcab86', shirt: '#7b7352', pants: '#6d6547', boots: '#4a3a28', sleeves: '#7b7352' };
const WEB = '#8a7d55';

/** WWI webbing: belt pouches, braces, entrenching tool. */
function webbing(p: Part, bulk: number): void {
  p.block(0.36, 0.06, 0.52 * bulk, WEB, { y: 0.44, rx: 0.8, bevel: 0.012 });
  p.block(0.36, 0.06, 0.52 * bulk, WEB, { y: 0.44, rx: -0.8, bevel: 0.012 });
  for (const z of [0.15, -0.15]) p.block(0.1, 0.14, 0.16, WEB, { x: 0.17, y: 0.08, z: z * bulk, bevel: 0.02 });
  p.block(0.22, 0.34, 0.36, '#6a6448', { x: -0.26, y: 0.34, bevel: 0.05 });
  p.block(0.24, 0.1, 0.38, WEB, { x: -0.27, y: 0.52, bevel: 0.03 });
}

export function trenchRaider(t: Team): ModelTemplate {
  return soldier(
    { ...WWI, bulk: 1.05, belt: C.leather },
    {
      head: (p) => G.brodieHelmet(p, '#5e6441'),
      torso: (p) => {
        p.block(0.36, 0.62, 0.5, '#766e4d', { y: 0.28, bevel: 0.04 });
        for (let i = 0; i < 4; i++) p.sphere(0.016, C.brass, { x: 0.19, y: 0.12 + i * 0.12, ...METAL });
        for (const z of [0.12, -0.12]) p.block(0.04, 0.1, 0.12, shade('#766e4d', -0.15), { x: 0.19, y: 0.46, z, bevel: 0.01 });
        webbing(p, 1.05);
      },
      hips: (p) => {
        p.block(0.14, 0.4, 0.5, '#766e4d', { x: -0.1, y: -0.22, bevel: 0.02 });
        // Stick grenades in the belt.
        for (const z of [0.2, 0.28]) {
          p.cyl(0.018, 0.018, 0.28, C.woodLight, { x: 0.06, y: -0.02, z, rz: 0.15, seg: 5 });
          p.cyl(0.045, 0.045, 0.1, '#4b5037', { x: 0.08, y: 0.13, z, rz: 0.15, seg: 8 });
        }
      },
      arm: (p, near) => near && p.block(0.17, 0.1, 0.17, t.main, { y: -0.12, e: 0.15, bevel: 0.02 }),
      shin: (p) => {
        // Puttees.
        for (let i = 0; i < 4; i++) p.block(0.18, 0.05, 0.18, '#8c8260', { y: -0.04 - i * 0.055, rz: 0.08, bevel: 0.012 });
      },
      weaponN: (p) => G.bayonetRifle(p),
    },
    { style: 'thrust', grip: [-0.3, -0.02] },
  );
}

export function machineGunner(t: Team): ModelTemplate {
  return soldier(
    { ...WWI, bulk: 1.1, belt: C.leather, beard: null },
    {
      head: (p) => G.brodieHelmet(p, '#5e6441'),
      torso: (p) => {
        p.block(0.36, 0.62, 0.52, '#766e4d', { y: 0.28, bevel: 0.04 });
        webbing(p, 1.1);
        // Ammunition pans on the chest.
        for (const z of [0.12, -0.12]) p.cyl(0.1, 0.1, 0.04, C.black, { x: 0.2, y: 0.3, z, rz: HALF_PI, seg: 10, ...METAL });
      },
      arm: (p, near) => near && p.block(0.17, 0.1, 0.17, t.main, { y: -0.12, e: 0.15, bevel: 0.02 }),
      shin: (p) => {
        for (let i = 0; i < 4; i++) p.block(0.18, 0.05, 0.18, '#8c8260', { y: -0.04 - i * 0.055, rz: 0.08, bevel: 0.012 });
      },
      weaponN: G.lewisGun,
    },
    { style: 'heavy', muzzle: [1.0, 0], grip: [0.26, 0.0] },
  );
}

export function flametrooper(t: Team): ModelTemplate {
  return soldier(
    { skin: '#dcab86', shirt: '#4f4a3c', pants: '#45412f', boots: '#2e271d', sleeves: '#4f4a3c', gloves: C.black, bulk: 1.12, noFace: true, belt: C.black },
    {
      head: (p) => G.gasMask(p, '#4a503a'),
      torso: (p) => {
        // Twin fuel tanks and a pressure bottle, strapped to a frame.
        p.block(0.36, 0.6, 0.52, '#57513f', { y: 0.29, bevel: 0.04 });
        for (const z of [0.13, -0.13]) {
          p.cyl(0.115, 0.115, 0.64, '#6b6f5e', { x: -0.3, y: 0.3, z, seg: 10, m: 0.5, r: 0.5 });
          p.dome(0.115, '#6b6f5e', { x: -0.3, y: 0.62, z, ws: 10, m: 0.5, r: 0.5 });
          p.cyl(0.12, 0.12, 0.04, t.main, { x: -0.3, y: 0.42, z, seg: 10 });
        }
        p.cyl(0.06, 0.06, 0.5, '#8a8f7a', { x: -0.44, y: 0.3, seg: 8, m: 0.6, r: 0.4 });
        p.cyl(0.03, 0.03, 0.06, C.brass, { x: -0.3, y: 0.72, z: 0.13, seg: 6, ...METAL });
        p.tube([[-0.3, 0.0, 0.15], [-0.1, -0.2, 0.3], [0.2, -0.1, 0.35]], 0.03, C.black, { seg: 8 });
        for (const z of [0.15, -0.15]) p.block(0.36, 0.06, 0.06, C.black, { y: 0.44, z: z * 1.12, rx: 0, bevel: 0.01 });
      },
      arm: (p, near) => near && p.block(0.17, 0.1, 0.17, t.main, { y: -0.12, e: 0.15, bevel: 0.02 }),
      fore: (p) => p.block(0.15, 0.1, 0.15, C.black, { y: -0.18, bevel: 0.02 }),
      shin: (p) => p.block(0.18, 0.14, 0.18, '#2e271d', { y: -0.2, bevel: 0.03 }),
      weaponN: (p) => G.flamethrower(p),
    },
    { style: 'heavy', muzzle: [0.92, 0], grip: [0.26, -0.06] },
  );
}

// ─── Modern Age ─────────────────────────────────────────────────────────────

const MODERN = { skin: '#d8a27c', shirt: '#7f7a5d', pants: '#6f6b52', boots: '#4d4131', sleeves: '#7f7a5d', gloves: C.black, belt: '#5f5a44' };

function kneePads(p: Part): void {
  p.block(0.1, 0.13, 0.15, C.black, { x: 0.08, y: -0.02, bevel: 0.03 });
}

export function assaultTrooper(t: Team): ModelTemplate {
  return soldier(
    { ...MODERN, bulk: 1.08 },
    {
      head: (p) => {
        G.modernHelmet(p, '#7a6f54', '#7dff9a');
        G.headband(p, t.main);
      },
      torso: (p) => {
        G.plateCarrier(p, C.coyote, t.main, 1.08);
        // Assault pack and hydration tube.
        p.block(0.18, 0.36, 0.34, '#6c604a', { x: -0.27, y: 0.34, bevel: 0.05 });
        p.block(0.19, 0.12, 0.35, shade('#6c604a', -0.2), { x: -0.27, y: 0.46, bevel: 0.03 });
        p.tube([[-0.18, 0.55, 0.2], [0.05, 0.6, 0.24], [0.16, 0.5, 0.16]], 0.014, C.black, { seg: 6 });
        p.block(0.43, 0.06, 0.55, t.main, { y: 0.5, bevel: 0.015 });
      },
      hips: (p) => G.pouches(p, C.coyote, 2, 0.02, 1.08),
      arm: (p, near) => near && p.block(0.05, 0.1, 0.12, t.main, { x: 0.02, y: -0.08, z: 0.07, e: 0.4 }),
      leg: (p, near) => near && p.block(0.12, 0.2, 0.08, '#5f5a44', { y: -0.16, z: 0.11, bevel: 0.02 }),
      shin: kneePads,
      weaponN: (p) => G.carbine(p, '#5b5446'),
    },
    { style: 'gun', muzzle: [0.9, 0], grip: [0.32, -0.02] },
  );
}

export function marksman(t: Team): ModelTemplate {
  return soldier(
    { ...MODERN, shirt: '#66704a', sleeves: '#66704a', pants: '#5c6444', belt: '#4f5a37' },
    {
      head: (p) => {
        G.boonieHat(p, '#6f7650');
        p.cyl(0.235, 0.235, 0.05, t.main, { y: 0.42, seg: 12 });
        p.block(0.1, 0.2, 0.4, '#5c6444', { x: -0.14, y: 0.14, bevel: 0.03 });
        for (let i = 0; i < 5; i++) p.block(0.04, 0.16, 0.05, i % 2 ? '#4f5a37' : '#768052', { x: -0.1 + i * 0.05, y: 0.34, z: -0.2 + i * 0.1, rz: 0.3 * (i - 2) });
      },
      torso: (p) => {
        // A ghillie wrap of scrim strips.
        for (let i = 0; i < 12; i++) {
          p.block(0.1, 0.22, 0.08, i % 2 ? '#4f5a37' : '#768052', {
            x: -0.14 + (i % 3) * 0.12,
            y: 0.54 - Math.floor(i / 3) * 0.14,
            z: -0.25 + (i % 3) * 0.02 + (i % 2) * 0.48,
            rz: i * 0.4,
            bevel: 0.015,
          });
        }
        p.block(0.05, 0.12, 0.12, t.main, { x: 0.17, y: 0.44, z: 0.1, e: 0.3 });
        p.block(0.37, 0.07, 0.51, t.main, { y: 0.58, bevel: 0.015 });
        p.block(0.1, 0.14, 0.12, '#4f5a37', { x: 0.18, y: 0.24, z: -0.1, bevel: 0.02 });
      },
      hips: (p) => G.pouches(p, '#4f5a37', 1, 0.02),
      shin: kneePads,
      weaponN: G.sniperRifle,
    },
    { style: 'gun', muzzle: [1.28, 0], grip: [0.36, -0.03] },
  );
}

export function rocketTrooper(t: Team): ModelTemplate {
  return soldier(
    { ...MODERN, bulk: 1.08 },
    {
      head: (p) => {
        G.modernHelmet(p, '#7a6f54', '#7dff9a');
        G.headband(p, t.main);
      },
      torso: (p) => {
        G.plateCarrier(p, C.coyote, t.main, 1.08);
        p.block(0.43, 0.06, 0.55, t.main, { y: 0.5, bevel: 0.015 });
        // A rocket pack with two spare rounds.
        p.block(0.28, 0.5, 0.4, '#5d5847', { x: -0.3, y: 0.3, bevel: 0.05 });
        p.block(0.29, 0.06, 0.41, shade('#5d5847', -0.25), { x: -0.3, y: 0.42, bevel: 0.015 });
        for (let i = 0; i < 2; i++) {
          p.cone(0.07, 0.26, '#6d7454', { x: -0.3, y: 0.68, z: -0.1 + i * 0.2, seg: 8 });
          p.cyl(0.07, 0.07, 0.04, t.main, { x: -0.3, y: 0.56, z: -0.1 + i * 0.2, seg: 8 });
        }
      },
      hips: (p) => G.pouches(p, C.coyote, 2, 0.02, 1.08),
      shin: kneePads,
      weaponN: (p) => G.launcherTube(p, t.glow),
    },
    {
      style: 'shoulder',
      muzzle: [0.92, 0.14],
      grip: [0.3, 0.02],
      rig: (r) => {
        r.joint('ammo', 'weaponN', 0.85, 0.14, 0);
        G.rocketWarhead(r.part('ammo'));
      },
    },
  );
}

// ─── Age of Intelligence ────────────────────────────────────────────────────

export function android(t: Team): ModelTemplate {
  return soldier(
    { shirt: '#e6ebef', pants: '#3a3f46', boots: '#2b2f35', robot: true, eye: t.glow, eyeGlow: 3 },
    {
      head: (p) => {
        p.block(0.22, 0.05, 0.36, C.carbon, { x: -0.04, y: 0.39, bevel: 0.015 });
        p.block(0.02, 0.1, 0.33, t.glow, { x: 0.185, y: 0.25, e: 3 });
        p.cyl(0.012, 0.012, 0.2, C.carbon, { x: -0.1, y: 0.48, z: 0.1, rz: 0.3, seg: 4 });
        p.sphere(0.022, t.glow, { x: -0.13, y: 0.58, z: 0.1, e: 3 });
      },
      torso: (p) => {
        p.block(0.08, 0.06, 0.4, t.glow, { x: 0.18, y: 0.42, e: 2.5 });
        p.block(0.22, 0.14, 0.62, '#d7dde2', { y: 0.52, bevel: 0.04, m: 0.3, r: 0.35 });
        for (const z of [0.12, -0.12]) p.block(0.03, 0.18, 0.08, '#c9d0d6', { x: 0.18, y: 0.28, z, bevel: 0.01, m: 0.3, r: 0.35 });
        // Power cell on the back.
        p.block(0.14, 0.32, 0.3, C.carbon, { x: -0.22, y: 0.35, bevel: 0.03 });
        p.block(0.03, 0.2, 0.05, t.glow, { x: -0.3, y: 0.35, z: 0.1, e: 2 });
        p.block(0.03, 0.2, 0.05, t.glow, { x: -0.3, y: 0.35, z: -0.1, e: 2 });
      },
      arm: (p) => p.block(0.15, 0.08, 0.15, '#d7dde2', { y: -0.02, bevel: 0.03, m: 0.3, r: 0.35 }),
      leg: (p) => p.block(0.17, 0.14, 0.17, '#d7dde2', { y: -0.12, bevel: 0.03, m: 0.3, r: 0.35 }),
      shin: (p) => p.block(0.03, 0.14, 0.05, t.glow, { x: 0.075, y: -0.12, e: 2 }),
      weaponN: (p) => G.plasmaRifle(p, t.glow),
    },
    { style: 'gun', muzzle: [0.8, 0], grip: [0.3, -0.06] },
  );
}

export function railgunner(t: Team): ModelTemplate {
  return soldier(
    { shirt: '#5c636c', pants: '#2c3036', boots: '#1f2226', robot: true, eye: t.glow, eyeGlow: 3, bulk: 1.2, scale: 1.08 },
    {
      head: (p) => {
        p.block(0.12, 0.13, 0.4, C.carbon, { x: -0.05, y: 0.4, bevel: 0.02 });
        p.block(0.03, 0.06, 0.3, t.glow, { x: 0.18, y: 0.24, e: 3 });
        p.block(0.12, 0.16, 0.06, C.carbon, { x: 0.06, y: 0.18, z: 0.18, bevel: 0.015 });
        p.block(0.12, 0.16, 0.06, C.carbon, { x: 0.06, y: 0.18, z: -0.18, bevel: 0.015 });
      },
      torso: (p) => {
        p.block(0.42, 0.3, 0.72, '#6a727c', { y: 0.46, bevel: 0.05, m: 0.6, r: 0.3 });
        p.block(0.04, 0.2, 0.3, shade('#6a727c', -0.3), { x: 0.21, y: 0.44, bevel: 0.01, m: 0.6, r: 0.3 });
        // Capacitor pack, with a feed cable to the gun.
        p.block(0.28, 0.52, 0.52, C.carbon, { x: -0.3, y: 0.34, bevel: 0.05 });
        for (let i = 0; i < 3; i++) p.cyl(0.05, 0.05, 0.5, i === 1 ? t.glow : '#4a525c', { x: -0.46, y: 0.34, z: -0.14 + i * 0.14, seg: 8, e: i === 1 ? 2 : 0, m: 0.6 });
        p.tube([[-0.3, 0.1, 0.28], [-0.05, -0.15, 0.4], [0.25, -0.2, 0.42]], 0.03, C.black, { seg: 8 });
      },
      arm: (p) => p.block(0.2, 0.14, 0.22, '#6a727c', { y: 0.0, bevel: 0.04, m: 0.6, r: 0.3 }),
      leg: (p) => p.block(0.19, 0.18, 0.19, '#6a727c', { y: -0.12, bevel: 0.03, m: 0.6, r: 0.3 }),
      shin: (p) => p.block(0.17, 0.18, 0.17, '#6a727c', { y: -0.12, bevel: 0.03, m: 0.6, r: 0.3 }),
      weaponN: (p) => G.railgun(p, t.glow),
    },
    { style: 'heavy', muzzle: [1.45, 0], height: 2.4, grip: [0.32, -0.08] },
  );
}
