import { Part, RigBuilder, shade, type ColorLike } from '../kit/builder';

/**
 * The shared humanoid body: chunky, big-headed, readable at a distance. Every
 * soldier from the clubber to the android is this skeleton in different
 * clothes. Joints (prefix + name): body, hips, legN, legF, torso, head,
 * armN, armF, handN, handF, weaponN, weaponF.
 *
 * Coordinates: facing +x, up +y, the near side (+z) faces the camera.
 * Hips sit at 0.8 m; the head's centre is ~1.62 m.
 */

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
  leg?: (p: Part, near: boolean) => void;
  arm?: (p: Part, near: boolean) => void;
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

export function humanoid(rig: RigBuilder, look: Look, decor: Decor = {}, o: HumanoidOptions = {}): void {
  const p = o.prefix ?? '';
  const n = (s: string): string => `${p}${s}`;
  const bulk = look.bulk ?? 1;
  const skin = look.skin ?? '#d9a172';
  const robot = look.robot ?? false;
  const sleeves = look.sleeves === undefined ? look.shirt : look.sleeves;
  const gloves = look.gloves ?? (robot ? shade(look.shirt, -0.3) : skin);

  const body = rig.joint(n('body'), o.parent ?? null, o.x ?? 0, o.y ?? 0, o.z ?? 0);
  void body;
  rig.group(n('body')).scale.setScalar(look.scale ?? 1);

  // Pelvis.
  const hips = rig.joint(n('hips'), n('body'), 0, 0.8, 0);
  hips.box(0.3, 0.2, 0.44 * bulk, look.pants, { y: 0 });
  if (look.belt) hips.box(0.33, 0.07, 0.47 * bulk, look.belt, { y: 0.08, r: 0.6 });
  decor.hips?.(hips);

  // Legs.
  for (const near of [true, false]) {
    const leg = rig.joint(n(near ? 'legN' : 'legF'), n('hips'), 0, -0.02, (near ? 0.12 : -0.12) * bulk);
    if (robot) {
      leg.sphere(0.1, shade(look.pants, -0.3), { y: 0, m: 0.6, r: 0.4 });
      leg.box(0.15, 0.62, 0.15, look.pants, { y: -0.34, m: 0.5, r: 0.45 });
    } else {
      leg.box(0.2, 0.66, 0.19, look.pants, { y: -0.33 });
    }
    leg.box(0.3, 0.14, 0.21, look.boots, { x: 0.05, y: -0.71, r: 0.6 });
    decor.leg?.(leg, near);
  }

  // Torso.
  const torso = rig.joint(n('torso'), n('hips'), 0, 0.08, 0);
  if (robot) {
    torso.box(0.3, 0.3, 0.3 * bulk, shade(look.shirt, -0.35), { y: 0.12, m: 0.7, r: 0.35 });
    torso.box(0.36, 0.36, 0.5 * bulk, look.shirt, { y: 0.38, m: 0.35, r: 0.4 });
  } else {
    torso.box(0.32, 0.58, 0.48 * bulk, look.shirt, { y: 0.29 });
  }
  decor.torso?.(torso);

  // Head.
  const head = rig.joint(n('head'), n('torso'), 0, 0.6, 0);
  head.cyl(0.08, 0.09, 0.12, robot ? '#3a3f46' : skin, { y: 0.02, m: robot ? 0.6 : 0 });
  if (robot) {
    head.box(0.34, 0.3, 0.32, look.shirt, { y: 0.22, m: 0.4, r: 0.35 });
    head.box(0.08, 0.1, 0.34, look.eye ?? '#6ff', { x: 0.14, y: 0.25, e: look.eyeGlow ?? 2.5 });
  } else {
    head.sphere(0.21, skin, { y: 0.22, s: [1, 1.04, 0.94] });
    head.box(0.07, 0.08, 0.07, shade(skin, -0.08), { x: 0.2, y: 0.19 });
    if (!look.noFace) {
      head.box(0.05, 0.065, 0.05, look.eye ?? '#1d1a18', { x: 0.13, y: 0.26, z: 0.16, e: look.eyeGlow ?? 0 });
      head.box(0.05, 0.065, 0.05, look.eye ?? '#1d1a18', { x: 0.13, y: 0.26, z: -0.16, e: look.eyeGlow ?? 0 });
    }
    if (look.hair) head.dome(0.225, look.hair, { y: 0.26, x: -0.02, s: [1.02, 0.9, 1] });
    if (look.beard) head.box(0.14, 0.14, 0.3, look.beard, { x: 0.13, y: 0.1 });
  }
  decor.head?.(head);

  // Arms.
  for (const near of [true, false]) {
    const arm = rig.joint(n(near ? 'armN' : 'armF'), n('torso'), 0, 0.5, (near ? 0.31 : -0.31) * bulk);
    if (robot) {
      arm.sphere(0.1, shade(look.shirt, -0.25), { y: 0, m: 0.6, r: 0.4 });
      arm.box(0.13, 0.5, 0.13, sleeves ?? look.shirt, { y: -0.27, m: 0.5, r: 0.4 });
    } else {
      arm.box(0.15, 0.52, 0.15, sleeves ?? skin, { y: -0.25 });
    }
    arm.box(0.14, 0.13, 0.13, gloves, { y: -0.56 });
    decor.arm?.(arm, near);
    rig.joint(n(near ? 'handN' : 'handF'), n(near ? 'armN' : 'armF'), 0, -0.56, 0);
    const weapon = rig.joint(n(near ? 'weaponN' : 'weaponF'), n(near ? 'handN' : 'handF'), 0, 0, 0);
    (near ? decor.weaponN : decor.weaponF)?.(weapon);
  }
  if (o.weaponTilt !== undefined) {
    rig.group(n('weaponN')).rotation.z = o.weaponTilt;
    rig.group(n('weaponF')).rotation.z = o.weaponTilt;
  }

  if (o.seated) {
    rig.group(n('legN')).rotation.set(-0.55, 0, 0.45);
    rig.group(n('legF')).rotation.set(0.55, 0, 0.45);
  }
}
