import { Part, RigBuilder, shade, type ColorLike } from '../kit/builder';

/**
 * The shared humanoid body: chunky, big-headed, readable at a distance. Every
 * soldier from the clubber to the android is this skeleton in different
 * clothes. Joints (prefix + name): body, hips, legN, legF (thighs), shinN,
 * shinF, torso, head, armN, armF (upper arms), foreN, foreF (forearms),
 * handN, handF, weaponN, weaponF.
 *
 * Coordinates: facing +x, up +y, the near side (+z) faces the camera.
 * Hips sit at 0.8 m, knees at 0.4 m, shoulders at 1.38 m; the head's centre
 * is ~1.7 m.
 */

/** Arm geometry the animator needs for reaching (see rig.ts). */
export const ARM = { upper: 0.28, fore: 0.28, shoulder: 0.5 } as const;

export interface Look {
  skin?: ColorLike;
  hair?: ColorLike | null;
  beard?: ColorLike | null;
  shirt: ColorLike;
  pants: ColorLike;
  boots: ColorLike;
  /** Arm colour; null for bare arms. Defaults to the shirt. */
  sleeves?: ColorLike | null;
  gloves?: ColorLike | null;
  belt?: ColorLike | null;
  scale?: number;
  /** Width multiplier for stocky or slim builds. */
  bulk?: number;
  /** Robots: metal joints, no face, glowing optics. */
  robot?: boolean;
  eye?: ColorLike;
  /** Glowing eyes (robots, the possessed). */
  eyeGlow?: number;
  /** Hide the default face (helmets with visors draw their own). */
  noFace?: boolean;
}

export interface Decor {
  head?: (p: Part) => void;
  torso?: (p: Part) => void;
  hips?: (p: Part) => void;
  /** Thigh frame: hip joint at the origin, knee at y −0.38. */
  leg?: (p: Part, near: boolean) => void;
  /** Shin frame: knee at the origin, sole at y −0.4. */
  shin?: (p: Part, near: boolean) => void;
  /** Upper-arm frame: shoulder at the origin, elbow at y −0.28. */
  arm?: (p: Part, near: boolean) => void;
  /** Forearm frame: elbow at the origin, hand at y −0.28. Shields go here. */
  fore?: (p: Part, near: boolean) => void;
  /** Items in the near / far hand, in the hand joint's frame (see gear.ts). */
  weaponN?: (p: Part) => void;
  weaponF?: (p: Part) => void;
}

export interface HumanoidOptions {
  prefix?: string;
  parent?: string | null;
  x?: number;
  y?: number;
  z?: number;
  /** Legs astride a mount. */
  seated?: boolean;
  /** Initial weapon-joint tilt (radians about z) for melee weapons. */
  weaponTilt?: number;
}

const ROBOT_METAL = { m: 0.5, r: 0.4 } as const;

export function humanoid(rig: RigBuilder, look: Look, decor: Decor = {}, o: HumanoidOptions = {}): void {
  const p = o.prefix ?? '';
  const n = (s: string): string => `${p}${s}`;
  const bulk = look.bulk ?? 1;
  const skin = look.skin ?? '#d9a172';
  const robot = look.robot ?? false;
  const sleeves = look.sleeves === undefined ? look.shirt : look.sleeves;
  const gloves = look.gloves ?? (robot ? shade(look.shirt, -0.3) : skin);
  const servo = shade(look.pants, -0.35);
  const surf = robot ? ROBOT_METAL : {};

  rig.joint(n('body'), o.parent ?? null, o.x ?? 0, o.y ?? 0, o.z ?? 0);
  rig.group(n('body')).scale.setScalar(look.scale ?? 1);

  // Pelvis.
  const hips = rig.joint(n('hips'), n('body'), 0, 0.8, 0);
  hips.block(0.3, 0.22, 0.42 * bulk, look.pants, { y: -0.01, taper: [1, 1.06], ...surf });
  if (look.belt) {
    hips.block(0.33, 0.075, 0.46 * bulk, look.belt, { y: 0.08, r: 0.6, bevel: 0.015 });
    hips.block(0.03, 0.075, 0.08, '#c9b27a', { x: 0.165, y: 0.08, m: 0.8, r: 0.35, bevel: 0.01 });
  }
  decor.hips?.(hips);

  // Legs: thigh, knee, shin and boot.
  for (const near of [true, false]) {
    const s = near ? 'N' : 'F';
    const leg = rig.joint(n(`leg${s}`), n('hips'), 0, -0.02, (near ? 0.115 : -0.115) * bulk);
    if (robot) {
      leg.sphere(0.1, servo, { m: 0.6, r: 0.4 });
      leg.block(0.14, 0.32, 0.14, look.pants, { y: -0.2, taper: 1.18, ...surf });
    } else {
      leg.block(0.19, 0.42, 0.19, look.pants, { y: -0.18, taper: 1.12 });
    }
    decor.leg?.(leg, near);

    const shin = rig.joint(n(`shin${s}`), n(`leg${s}`), 0, -0.38, 0);
    if (robot) {
      shin.sphere(0.085, servo, { m: 0.6, r: 0.4 });
      shin.block(0.12, 0.26, 0.13, look.pants, { y: -0.15, taper: 1.2, ...surf });
      shin.cyl(0.02, 0.02, 0.24, '#9aa3ad', { x: -0.08, y: -0.14, m: 0.8, r: 0.3, seg: 5 });
    } else {
      shin.sphere(0.092, look.pants, { s: [1, 0.85, 1] });
      shin.block(0.165, 0.28, 0.165, look.pants, { y: -0.13, taper: 1.12 });
    }
    shin.block(0.18, 0.13, 0.18, look.boots, { y: -0.255, bevel: 0.03, ...surf });
    shin.block(0.3, 0.12, 0.19, look.boots, { x: 0.05, y: -0.33, taper: [0.9, 0.95], bevel: 0.035, ...surf });
    shin.block(0.31, 0.035, 0.2, shade(look.boots, -0.4), { x: 0.05, y: -0.383, bevel: 0.01 });
    decor.shin?.(shin, near);
  }

  // Torso: a chest broader than the waist.
  const torso = rig.joint(n('torso'), n('hips'), 0, 0.08, 0);
  if (robot) {
    torso.block(0.26, 0.28, 0.28 * bulk, servo, { y: 0.12, m: 0.7, r: 0.35 });
    for (let i = 0; i < 3; i++) torso.block(0.22, 0.045, 0.33 * bulk, shade(look.shirt, -0.25), { y: 0.03 + i * 0.075, m: 0.5, r: 0.4, bevel: 0.01 });
    torso.block(0.36, 0.36, 0.48 * bulk, look.shirt, { y: 0.4, taper: [0.92, 1.1], bevel: 0.05, m: 0.35, r: 0.4 });
  } else {
    torso.block(0.32, 0.6, 0.44 * bulk, look.shirt, { y: 0.29, taper: [1.06, 1.14], bevel: 0.05 });
  }
  decor.torso?.(torso);

  // Head.
  const head = rig.joint(n('head'), n('torso'), 0, 0.6, 0);
  head.cyl(0.075, 0.09, 0.14, robot ? '#3a3f46' : skin, { y: 0.02, m: robot ? 0.6 : 0, seg: 6 });
  if (robot) {
    head.block(0.34, 0.3, 0.32, look.shirt, { y: 0.22, taper: [0.9, 0.94], bevel: 0.06, m: 0.4, r: 0.35 });
    head.block(0.08, 0.1, 0.34, look.eye ?? '#6ff', { x: 0.14, y: 0.25, e: look.eyeGlow ?? 2.5, bevel: 0.01 });
    head.block(0.06, 0.1, 0.06, servo, { y: 0.22, z: 0.17, m: 0.6, r: 0.4 });
    head.block(0.06, 0.1, 0.06, servo, { y: 0.22, z: -0.17, m: 0.6, r: 0.4 });
  } else {
    head.sphere(0.21, skin, { y: 0.22, s: [1, 1.04, 0.94], ws: 10, hs: 7 });
    // Nose and ears give the profile the camera sees.
    head.hull(
      [[0.18, 0.26, 0], [0.265, 0.16, 0], [0.2, 0.14, 0.04], [0.2, 0.14, -0.04], [0.18, 0.22, 0.035], [0.18, 0.22, -0.035]],
      shade(skin, -0.05),
    );
    head.block(0.075, 0.11, 0.05, shade(skin, -0.1), { x: -0.02, y: 0.21, z: 0.195, bevel: 0.015 });
    head.block(0.075, 0.11, 0.05, shade(skin, -0.1), { x: -0.02, y: 0.21, z: -0.195, bevel: 0.015 });
    if (!look.noFace) {
      const brow = look.hair ?? look.beard ?? shade(skin, -0.5);
      for (const z of [0.155, -0.155]) {
        head.block(0.05, 0.065, 0.05, look.eye ?? '#1d1a18', { x: 0.14, y: 0.255, z, e: look.eyeGlow ?? 0, bevel: 0.012 });
        head.block(0.06, 0.025, 0.08, brow, { x: 0.16, y: 0.305, z: z * 0.95, rx: z > 0 ? 0.15 : -0.15, bevel: 0.008 });
      }
      head.block(0.02, 0.018, 0.09, shade(skin, -0.4), { x: 0.2, y: 0.1 });
    }
    if (look.hair) head.dome(0.225, look.hair, { y: 0.26, x: -0.02, s: [1.02, 0.9, 1], ws: 10 });
    if (look.beard) {
      head.block(0.14, 0.15, 0.3, look.beard, { x: 0.13, y: 0.1, taper: [1.2, 1.05], bevel: 0.04 });
      head.block(0.06, 0.03, 0.14, look.beard, { x: 0.21, y: 0.155, bevel: 0.01 });
    }
  }
  decor.head?.(head);

  // Arms: shoulder, upper arm, elbow, forearm, hand.
  for (const near of [true, false]) {
    const s = near ? 'N' : 'F';
    const armColor = sleeves ?? skin;
    const arm = rig.joint(n(`arm${s}`), n('torso'), 0, ARM.shoulder, (near ? 0.31 : -0.31) * bulk);
    if (robot) {
      arm.sphere(0.1, shade(look.shirt, -0.25), { m: 0.6, r: 0.4 });
      arm.block(0.12, 0.22, 0.12, armColor, { y: -0.15, taper: 1.15, ...surf });
    } else {
      arm.sphere(0.095, armColor, { y: -0.01, s: [1.05, 1, 1.05] });
      arm.block(0.145, 0.26, 0.145, armColor, { y: -0.14, taper: 1.1 });
    }
    decor.arm?.(arm, near);

    const fore = rig.joint(n(`fore${s}`), n(`arm${s}`), 0, -ARM.upper, 0);
    if (robot) {
      fore.sphere(0.08, servo, { m: 0.6, r: 0.4 });
      fore.block(0.11, 0.2, 0.11, armColor, { y: -0.11, taper: 1.18, ...surf });
    } else {
      fore.sphere(0.078, armColor);
      fore.block(0.13, 0.22, 0.13, armColor, { y: -0.1, taper: 1.12 });
    }
    fore.block(0.12, 0.13, 0.11, gloves, { y: -0.28, bevel: 0.03, ...(robot ? surf : {}) });
    fore.block(0.05, 0.085, 0.05, gloves, { x: 0.065, y: -0.255, z: near ? 0.025 : -0.025, rz: -0.35, bevel: 0.015 });
    decor.fore?.(fore, near);

    rig.joint(n(`hand${s}`), n(`fore${s}`), 0, -ARM.fore, 0);
    const weapon = rig.joint(n(`weapon${s}`), n(`hand${s}`), 0, 0, 0);
    (near ? decor.weaponN : decor.weaponF)?.(weapon);
  }
  if (o.weaponTilt !== undefined) {
    rig.group(n('weaponN')).rotation.z = o.weaponTilt;
    rig.group(n('weaponF')).rotation.z = o.weaponTilt;
  }

  if (o.seated) {
    // Thighs forward and out around the mount's barrel, shins hanging.
    rig.group(n('legN')).rotation.set(-0.55, 0, 1.15);
    rig.group(n('legF')).rotation.set(0.55, 0, 1.15);
    rig.group(n('shinN')).rotation.set(0, 0, -1.3);
    rig.group(n('shinF')).rotation.set(0, 0, -1.3);
  }
}
