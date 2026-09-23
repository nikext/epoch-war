import { RigBuilder, shade } from '../kit/builder';
import * as G from './gear';
import { C } from './gear';
import { humanoid, type Decor, type Look } from './humanoid';
import type { AttackStyle, ModelTemplate } from './rig';
import { finish, type Team } from './team';

/**
 * The foot soldiers of every age. Mounted units live in beasts.ts, machines in
 * machines.ts.
 */

interface SoldierMeta {
  style: AttackStyle;
  hand?: 'near' | 'far';
  height?: number;
  /** Weapon tilt for swing weapons (see gear.ts). */
  tilt?: number;
  /** Muzzle joint in the weapon's frame, for flashes and tracers. */
  muzzle?: [number, number];
}

function soldier(look: Look, decor: Decor, meta: SoldierMeta): ModelTemplate {
  const rig = new RigBuilder();
  const opts = meta.tilt !== undefined ? { weaponTilt: meta.tilt } : {};
  humanoid(rig, look, decor, opts);
  const hand = meta.hand ?? 'near';
  if (meta.muzzle) rig.joint('muzzle', hand === 'near' ? 'weaponN' : 'weaponF', meta.muzzle[0], meta.muzzle[1], 0);
  return finish(rig, { kind: 'humanoid', style: meta.style, hand, height: meta.height ?? 2.15, strideLength: 1.45 });
}

// ─── Stone Age ──────────────────────────────────────────────────────────────

export function clubber(t: Team): ModelTemplate {
  return soldier(
    { skin: '#c68a5a', shirt: C.fur, pants: C.furDark, boots: C.leatherDark, sleeves: null, bulk: 1.12, beard: '#3b2a1e' },
    {
      head: (p) => {
        G.wildHair(p, '#3b2a1e');
        p.box(0.03, 0.12, 0.05, t.main, { x: 0.16, y: 0.24, z: 0.19, e: 0.2 });
        p.cone(0.03, 0.16, C.bone, { x: -0.05, y: 0.5, rz: 0.4 });
      },
      torso: (p) => {
        p.box(0.34, 0.2, 0.5, C.furDark, { y: 0.52, rx: 0.3 });
        G.sash(p, t.main, 1.12);
        for (let i = 0; i < 3; i++) p.cone(0.03, 0.08, C.bone, { x: 0.17, y: 0.5 - i * 0.05, z: -0.06 + i * 0.06, rz: -1.57 });
      },
      hips: (p) => p.box(0.34, 0.26, 0.5, C.fur, { y: -0.12 }),
      weaponN: G.club,
    },
    { style: 'swing', tilt: 0.9 },
  );
}

export function slinger(t: Team): ModelTemplate {
  return soldier(
    { skin: '#b97e52', hair: '#2a1d14', shirt: '#9b6b3e', pants: C.furDark, boots: C.leatherDark, sleeves: null, bulk: 0.95 },
    {
      head: (p) => {
        G.headband(p, t.main);
        G.feather(p, t.light);
      },
      torso: (p) => {
        p.box(0.33, 0.35, 0.49, '#b88452', { y: 0.38 });
        p.box(0.2, 0.2, 0.12, C.leather, { x: -0.05, y: 0.02, z: 0.28 });
      },
      hips: (p) => p.box(0.32, 0.22, 0.46, C.furDark, { y: -0.1 }),
      arm: (p, near) => near && p.box(0.17, 0.06, 0.17, t.main, { y: -0.12 }),
      weaponN: G.sling,
    },
    { style: 'throw' },
  );
}

export function spearHunter(t: Team): ModelTemplate {
  return soldier(
    { skin: '#c08a5c', shirt: C.furGrey, pants: '#5c4430', boots: C.leatherDark, sleeves: null },
    {
      head: (p) => {
        p.dome(0.25, C.furGrey, { y: 0.26, x: -0.04 });
        p.cone(0.07, 0.14, C.furGrey, { x: -0.04, y: 0.5, z: 0.11 });
        p.cone(0.07, 0.14, C.furGrey, { x: -0.04, y: 0.5, z: -0.11 });
        p.box(0.2, 0.1, 0.16, '#6d665c', { x: 0.2, y: 0.42 });
        G.feather(p, t.main, -0.22, 0.42);
      },
      torso: (p) => {
        p.box(0.36, 0.3, 0.52, C.furGrey, { y: 0.52 });
        for (let i = 0; i < 5; i++) p.ico(0.03, C.bone, { x: 0.17, y: 0.44 - Math.sin((i / 4) * Math.PI) * 0.08, z: -0.12 + i * 0.06 });
        p.box(0.04, 0.35, 0.08, t.main, { x: 0.17, y: 0.25, z: 0.12 });
        p.cyl(0.02, 0.02, 1.3, C.woodLight, { x: -0.22, y: 0.4, rz: 0.5 });
        p.cone(0.04, 0.16, C.flint, { x: -0.54, y: 0.97, rz: 0.5 });
      },
      weaponN: (p) => G.throwingSpear(p),
    },
    { style: 'throw' },
  );
}

// ─── Ancient Age ────────────────────────────────────────────────────────────

export function hoplite(t: Team): ModelTemplate {
  return soldier(
    { skin: '#d19a6c', shirt: C.bronze, pants: C.linen, boots: C.leather, sleeves: null, noFace: true },
    {
      head: (p) => G.corinthianHelmet(p, t.main),
      torso: (p) => {
        p.box(0.34, 0.5, 0.5, C.bronze, { y: 0.32, ...G.tex.METAL });
        p.box(0.05, 0.05, 0.3, shade(C.bronze, -0.3), { x: 0.17, y: 0.24 });
        p.box(0.05, 0.05, 0.3, shade(C.bronze, -0.3), { x: 0.17, y: 0.14 });
        G.cape(p, t.dark, 0.95);
      },
      hips: (p) => {
        for (let i = 0; i < 6; i++) p.box(0.06, 0.24, 0.08, t.main, { x: 0.13 - i * 0.05, y: -0.12, z: 0.2 });
        p.box(0.34, 0.2, 0.46, C.linen, { y: -0.1 });
      },
      leg: (p) => p.box(0.21, 0.3, 0.2, C.bronze, { x: 0.02, y: -0.5, ...G.tex.METAL }),
      arm: (p, near) => near && G.roundShield(p, true, t.main, C.bronze, t.light),
      weaponF: (p) => G.spear(p, 2.3, C.bronze, 0.8),
    },
    { style: 'thrust', hand: 'far', height: 2.35 },
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
        G.quiver(p);
      },
      hips: (p) => {
        p.box(0.36, 0.3, 0.48, C.linen, { y: -0.13 });
        p.box(0.1, 0.3, 0.06, t.main, { x: 0.15, y: -0.12 });
      },
      weaponF: (p) => G.bow(p, '#3d2a1a', 0.62),
    },
    { style: 'bow', hand: 'near' },
  );
}

export function sunPriest(t: Team): ModelTemplate {
  return soldier(
    { skin: '#b8804f', shirt: '#f3ecd9', pants: '#f3ecd9', boots: '#c9a36a', sleeves: '#f3ecd9' },
    {
      head: (p) => {
        p.cyl(0.13, 0.19, 0.3, C.linen, { y: 0.5, seg: 10 });
        p.cyl(0.14, 0.14, 0.04, C.gold, { y: 0.4, seg: 10, ...G.tex.METAL });
        p.sphere(0.05, t.glow, { x: 0.13, y: 0.55, e: 1.4 });
      },
      torso: (p) => {
        G.collar(p, C.gold);
        p.box(0.36, 0.1, 0.5, t.main, { y: 0.05 });
        p.box(0.08, 0.5, 0.1, t.main, { x: 0.17, y: -0.05 });
      },
      hips: (p) => p.cyl(0.26, 0.36, 0.7, '#f3ecd9', { y: -0.34, seg: 10 }),
      weaponN: (p) => G.sunStaff(p, '#ffcf5a'),
    },
    { style: 'cast', height: 2.4, muzzle: [0, 1.14] },
  );
}

// ─── Medieval Age ───────────────────────────────────────────────────────────

export function manAtArms(t: Team): ModelTemplate {
  return soldier(
    { skin: '#e0ae86', shirt: C.iron, pants: '#4d4d52', boots: C.leatherDark, sleeves: C.iron, gloves: C.leatherDark, bulk: 1.05 },
    {
      head: (p) => G.nasalHelm(p),
      torso: (p) => G.tabard(p, t.main, t.light, 1.05),
      arm: (p, near) => near && G.kiteShield(p, true, t.main, t.light),
      weaponF: (p) => G.sword(p, 0.82),
    },
    { style: 'swing', hand: 'far', tilt: 0.9 },
  );
}

export function crossbowman(t: Team): ModelTemplate {
  return soldier(
    { skin: '#dba37c', shirt: '#b59b6e', pants: '#5d4a36', boots: '#3f3128', sleeves: '#a88d61', beard: '#6b4a2b' },
    {
      head: (p) => G.kettleHelm(p),
      torso: (p) => {
        p.box(0.35, 0.56, 0.3, t.main, { y: 0.3, z: 0.1 });
        for (let i = 0; i < 3; i++) p.box(0.34, 0.03, 0.49, shade('#b59b6e', -0.2), { y: 0.12 + i * 0.16 });
      },
      hips: (p) => p.cyl(0.07, 0.06, 0.4, C.leather, { x: -0.2, y: -0.05, z: -0.25, rz: 0.2 }),
      weaponN: G.crossbow,
    },
    { style: 'gun', muzzle: [0.5, 0.04] },
  );
}

export function pikeman(t: Team): ModelTemplate {
  return soldier(
    { skin: '#d9a57f', shirt: t.main, pants: t.dark, boots: C.black, sleeves: t.light, bulk: 1.05 },
    {
      head: (p) => G.morion(p, t.light),
      torso: (p) => {
        p.box(0.36, 0.44, 0.52, C.steel, { y: 0.34, ...G.tex.METAL });
        p.box(0.04, 0.36, 0.04, shade(C.steel, -0.25), { x: 0.19, y: 0.34 });
      },
      leg: (p) => p.box(0.21, 0.08, 0.2, t.light, { y: -0.3 }),
      weaponN: (p) => G.spear(p, 3.9, C.steel, 1.3),
    },
    { style: 'thrust', height: 2.35 },
  );
}

// ─── Gunpowder Age ──────────────────────────────────────────────────────────

export function duelist(t: Team): ModelTemplate {
  return soldier(
    { skin: '#e5b28c', hair: '#5a3a22', shirt: t.main, pants: '#2d2a33', boots: '#3a2718', sleeves: t.light, gloves: '#e6dcc7', bulk: 0.95 },
    {
      head: (p) => G.cavalierHat(p, '#f1ede3'),
      torso: (p) => {
        p.cyl(0.18, 0.24, 0.07, '#f5f2ea', { y: 0.57, seg: 10 });
        p.box(0.06, 0.5, 0.49, shade(t.main, -0.3), { x: 0.14, y: 0.3 });
        G.cape(p, t.dark, 0.8);
      },
      leg: (p) => p.box(0.23, 0.3, 0.22, '#3a2718', { x: 0.02, y: -0.5 }),
      weaponN: G.rapier,
    },
    { style: 'thrust' },
  );
}

export function musketeer(t: Team): ModelTemplate {
  return soldier(
    { skin: '#e2ab85', shirt: t.main, pants: '#ebe5d6', boots: C.black, sleeves: t.main, gloves: '#e2ab85' },
    {
      head: (p) => {
        G.tricorn(p, C.gold);
        p.box(0.1, 0.18, 0.3, '#f0ede5', { x: -0.2, y: 0.18 });
      },
      torso: (p) => {
        p.box(0.34, 0.07, 0.5, '#f4f1ea', { y: 0.35, rx: 0.7 });
        p.box(0.34, 0.07, 0.5, '#f4f1ea', { y: 0.35, rx: -0.7 });
        p.box(0.05, 0.55, 0.12, shade(t.main, -0.35), { x: 0.16, y: 0.3 });
        for (let i = 0; i < 4; i++) p.sphere(0.02, C.gold, { x: 0.17, y: 0.14 + i * 0.12, z: 0.08, ...G.tex.METAL });
      },
      hips: (p) => {
        p.box(0.12, 0.42, 0.46, t.main, { x: -0.14, y: -0.2 });
        p.box(0.2, 0.14, 0.12, C.black, { x: -0.05, y: -0.02, z: -0.26 });
      },
      leg: (p) => p.box(0.22, 0.34, 0.21, C.black, { y: -0.52 }),
      weaponN: G.musket,
    },
    { style: 'gun', muzzle: [1.05, 0.05] },
  );
}

// ─── Industrial Age ─────────────────────────────────────────────────────────

const WWI = { skin: '#dcab86', shirt: '#7b7352', pants: '#6d6547', boots: '#4a3a28', sleeves: '#7b7352' };

export function trenchRaider(t: Team): ModelTemplate {
  return soldier(
    { ...WWI, bulk: 1.05, belt: C.leather },
    {
      head: (p) => G.brodieHelmet(p, '#5e6441'),
      torso: (p) => {
        p.box(0.36, 0.62, 0.5, '#766e4d', { y: 0.28 });
        p.box(0.34, 0.06, 0.5, C.leather, { y: 0.4, rx: 0.8 });
        p.box(0.2, 0.08, 0.35, t.main, { x: 0.05, y: 0.56 });
      },
      hips: (p) => p.box(0.14, 0.4, 0.5, '#766e4d', { x: -0.1, y: -0.22 }),
      arm: (p, near) => near && p.box(0.17, 0.1, 0.17, t.main, { y: -0.14, e: 0.15 }),
      leg: (p) => p.box(0.22, 0.28, 0.21, '#8c8260', { y: -0.5 }),
      weaponN: (p) => G.bayonetRifle(p),
    },
    { style: 'thrust' },
  );
}

export function machineGunner(t: Team): ModelTemplate {
  return soldier(
    { ...WWI, bulk: 1.1, belt: C.leather, beard: null },
    {
      head: (p) => G.brodieHelmet(p, '#5e6441'),
      torso: (p) => {
        p.box(0.36, 0.62, 0.52, '#766e4d', { y: 0.28 });
        p.box(0.2, 0.3, 0.36, '#5d5a45', { x: -0.24, y: 0.3 });
        p.box(0.34, 0.07, 0.52, '#c9a24a', { y: 0.36, rx: 0.8, m: 0.6, r: 0.4 });
      },
      arm: (p, near) => near && p.box(0.17, 0.1, 0.17, t.main, { y: -0.14, e: 0.15 }),
      leg: (p) => p.box(0.22, 0.28, 0.21, '#8c8260', { y: -0.5 }),
      weaponN: G.lewisGun,
    },
    { style: 'heavy', muzzle: [1.0, 0] },
  );
}

export function flametrooper(t: Team): ModelTemplate {
  return soldier(
    { skin: '#dcab86', shirt: '#4f4a3c', pants: '#45412f', boots: '#2e271d', sleeves: '#4f4a3c', gloves: C.black, bulk: 1.12, noFace: true },
    {
      head: (p) => G.gasMask(p, '#4a503a'),
      torso: (p) => {
        p.cyl(0.11, 0.11, 0.62, '#6b6f5e', { x: -0.28, y: 0.3, z: 0.12, m: 0.5, r: 0.5 });
        p.cyl(0.11, 0.11, 0.62, '#6b6f5e', { x: -0.28, y: 0.3, z: -0.12, m: 0.5, r: 0.5 });
        p.box(0.08, 0.1, 0.3, t.main, { x: -0.4, y: 0.4 });
        p.tube([[-0.3, 0.0, 0.15], [-0.1, -0.2, 0.3], [0.2, -0.1, 0.35]], 0.03, C.black);
      },
      arm: (p, near) => near && p.box(0.17, 0.1, 0.17, t.main, { y: -0.14, e: 0.15 }),
      weaponN: (p) => G.flamethrower(p),
    },
    { style: 'heavy', muzzle: [0.92, 0] },
  );
}

// ─── Modern Age ─────────────────────────────────────────────────────────────

const MODERN = { skin: '#d8a27c', shirt: '#7f7a5d', pants: '#6f6b52', boots: '#4d4131', sleeves: '#7f7a5d', gloves: C.black };

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
        p.box(0.16, 0.24, 0.3, '#6c604a', { x: -0.26, y: 0.34 });
        p.box(0.42, 0.06, 0.54, t.main, { y: 0.5 });
      },
      arm: (p, near) => near && p.box(0.05, 0.1, 0.12, t.main, { x: 0.02, y: -0.1, z: 0.07, e: 0.4 }),
      leg: (p) => p.box(0.22, 0.12, 0.22, C.black, { x: 0.02, y: -0.38 }),
      weaponN: (p) => G.carbine(p, '#5b5446'),
    },
    { style: 'gun', muzzle: [0.9, 0] },
  );
}

export function marksman(t: Team): ModelTemplate {
  return soldier(
    { ...MODERN, shirt: '#66704a', sleeves: '#66704a', pants: '#5c6444' },
    {
      head: (p) => {
        G.boonieHat(p, '#6f7650');
        p.cyl(0.235, 0.235, 0.05, t.main, { y: 0.42, seg: 10 });
        p.box(0.1, 0.2, 0.4, '#5c6444', { x: -0.14, y: 0.14 });
      },
      torso: (p) => {
        for (let i = 0; i < 9; i++) {
          p.box(0.1, 0.22, 0.08, i % 2 ? '#4f5a37' : '#768052', { x: -0.12 + (i % 3) * 0.12, y: 0.52 - Math.floor(i / 3) * 0.18, z: -0.25 + (i % 3) * 0.02, rz: i * 0.4 });
        }
        p.box(0.05, 0.12, 0.12, t.main, { x: 0.17, y: 0.44, z: 0.1, e: 0.3 });
        p.box(0.36, 0.07, 0.5, t.main, { y: 0.58 });
      },
      weaponN: G.sniperRifle,
    },
    { style: 'gun', muzzle: [1.28, 0] },
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
        p.box(0.42, 0.06, 0.54, t.main, { y: 0.5 });
        p.box(0.28, 0.5, 0.4, '#5d5847', { x: -0.3, y: 0.3 });
        for (let i = 0; i < 2; i++) p.cone(0.07, 0.26, '#6d7454', { x: -0.3, y: 0.68, z: -0.1 + i * 0.2 });
      },
      weaponN: (p) => G.launcherTube(p, t.glow),
    },
    { style: 'shoulder', muzzle: [0.92, 0] },
  );
}

// ─── Age of Intelligence ────────────────────────────────────────────────────

export function android(t: Team): ModelTemplate {
  return soldier(
    { shirt: '#e6ebef', pants: '#3a3f46', boots: '#2b2f35', robot: true, eye: t.glow, eyeGlow: 3 },
    {
      head: (p) => {
        p.box(0.2, 0.05, 0.36, C.carbon, { x: -0.04, y: 0.39 });
        p.box(0.02, 0.1, 0.33, t.glow, { x: 0.185, y: 0.25, e: 3 });
      },
      torso: (p) => {
        p.box(0.08, 0.06, 0.4, t.glow, { x: 0.18, y: 0.42, e: 2.5 });
        p.box(0.2, 0.14, 0.62, '#d7dde2', { y: 0.52, m: 0.3, r: 0.35 });
        p.box(0.12, 0.3, 0.3, C.carbon, { x: -0.22, y: 0.35 });
        p.box(0.03, 0.2, 0.05, t.glow, { x: -0.29, y: 0.35, z: 0.1, e: 2 });
      },
      weaponN: (p) => G.plasmaRifle(p, t.glow),
    },
    { style: 'gun', muzzle: [0.8, 0] },
  );
}

export function railgunner(t: Team): ModelTemplate {
  return soldier(
    { shirt: '#5c636c', pants: '#2c3036', boots: '#1f2226', robot: true, eye: t.glow, eyeGlow: 3, bulk: 1.2, scale: 1.08 },
    {
      head: (p) => {
        p.box(0.1, 0.12, 0.4, C.carbon, { x: -0.05, y: 0.4 });
        p.box(0.03, 0.06, 0.3, t.glow, { x: 0.18, y: 0.24, e: 3 });
      },
      torso: (p) => {
        p.box(0.4, 0.3, 0.7, '#6a727c', { y: 0.46, m: 0.6, r: 0.3 });
        p.box(0.26, 0.5, 0.5, C.carbon, { x: -0.3, y: 0.34 });
        p.cyl(0.05, 0.05, 0.5, t.glow, { x: -0.44, y: 0.34, e: 2 });
      },
      weaponN: (p) => G.railgun(p, t.glow),
    },
    { style: 'heavy', muzzle: [1.45, 0], height: 2.4 },
  );
}
