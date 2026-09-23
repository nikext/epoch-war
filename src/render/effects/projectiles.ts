import * as THREE from 'three';
import type { Projectile } from '../../sim/entities';
import type { ProjectileKind } from '../../sim/types';
import { Part } from '../kit/builder';
import { staticMaterial } from '../kit/materials';
import { C } from '../models/gear';
import { TEAMS } from '../models/team';
import type { Effects } from './fx';

/**
 * Meshes for projectiles in flight. Each sim projectile gets a pooled mesh;
 * position follows the sim's arc (interpolated between ticks), orientation
 * follows the velocity, and some kinds leave trails.
 */

const HALF_PI = Math.PI / 2;

function build(kind: ProjectileKind, side: 0 | 1): THREE.BufferGeometry {
  const p = new Part();
  const team = TEAMS[side];
  switch (kind) {
    case 'rock':
      p.ico(0.13, C.stone);
      break;
    case 'boulder':
      p.ico(0.42, '#7d776d', { detail: 0 });
      break;
    case 'spear':
      p.cyl(0.03, 0.03, 1.5, C.woodLight, { rz: HALF_PI });
      p.cone(0.05, 0.22, C.flint, { x: 0.8, rz: -HALF_PI });
      break;
    case 'arrow':
      p.cyl(0.015, 0.015, 0.85, C.woodLight, { rz: HALF_PI });
      p.cone(0.035, 0.12, C.iron, { x: 0.46, rz: -HALF_PI });
      p.box(0.14, 0.08, 0.01, '#f3efe6', { x: -0.38 });
      p.box(0.14, 0.01, 0.08, '#f3efe6', { x: -0.38 });
      break;
    case 'bolt':
      p.cyl(0.025, 0.025, 0.6, C.wood, { rz: HALF_PI });
      p.cone(0.045, 0.14, C.steel, { x: 0.36, rz: -HALF_PI });
      break;
    case 'javelin':
      p.cyl(0.035, 0.035, 1.8, C.woodLight, { rz: HALF_PI });
      p.cone(0.07, 0.3, C.bronze, { x: 1.0, rz: -HALF_PI });
      break;
    case 'fireball':
    case 'firepot':
      if (kind === 'firepot') p.sphere(0.18, '#9a5a32');
      p.sphere(kind === 'firepot' ? 0.14 : 0.22, '#ff8a2a', { e: 4, y: kind === 'firepot' ? 0.12 : 0 });
      break;
    case 'sunbolt':
      p.sphere(0.2, '#ffd65a', { e: 5 });
      break;
    case 'cannonball':
      p.sphere(0.17, '#2a2d31', { m: 0.8, r: 0.35 });
      break;
    case 'shell':
    case 'flak':
      p.capsule(0.09, 0.28, '#4a4f55', { rz: HALF_PI, m: 0.7, r: 0.4 });
      break;
    case 'grenade':
      p.sphere(0.08, C.olive);
      break;
    case 'rocket':
    case 'missile':
      p.cyl(0.07, 0.07, 0.7, kind === 'missile' ? '#d7d9dc' : '#59613f', { rz: HALF_PI });
      p.cone(0.07, 0.2, kind === 'missile' ? '#c0392b' : '#3a3f45', { x: 0.45, rz: -HALF_PI });
      for (let i = 0; i < 4; i++) p.box(0.14, 0.2, 0.015, '#3a3f45', { x: -0.3, rx: (i * Math.PI) / 2 });
      p.sphere(0.07, '#ffd08a', { x: -0.38, e: 5 });
      break;
    case 'plasma':
      p.sphere(0.16, team.glow, { e: 5, s: [2.2, 1, 1] });
      p.sphere(0.09, '#ffffff', { e: 6, s: [2, 1, 1] });
      break;
    case 'egg':
      p.sphere(0.14, '#f4efe6', { s: [1.3, 1, 1] });
      break;
    case 'oil':
      p.sphere(0.3, '#5a3312', { e: 0.6, s: [1.3, 0.8, 1] });
      break;
    case 'meteor':
      p.ico(0.75, '#4a3a30', { detail: 0 });
      p.ico(0.6, '#ff6a2a', { e: 3, detail: 0, s: [1.15, 1.15, 1.15] });
      break;
    case 'bomb':
      p.capsule(0.16, 0.5, '#3c4032', { rz: HALF_PI });
      for (let i = 0; i < 4; i++) p.box(0.2, 0.25, 0.02, '#2c3026', { x: -0.4, rx: (i * Math.PI) / 2 });
      break;
    case 'drone':
      p.box(0.3, 0.08, 0.3, '#2a2e34');
      for (let i = 0; i < 4; i++) p.cyl(0.09, 0.09, 0.02, '#15171a', { x: i % 2 ? 0.2 : -0.2, z: i < 2 ? 0.2 : -0.2, y: 0.06 });
      p.sphere(0.04, '#ff3a3a', { e: 5, x: 0.16 });
      break;
    default:
      p.sphere(0.1, '#ffffff', { e: 2 });
  }
  return p.build();
}

const geoCache = new Map<string, THREE.BufferGeometry>();

function geometry(kind: ProjectileKind, side: 0 | 1): THREE.BufferGeometry {
  const key = `${kind}:${side}`;
  let g = geoCache.get(key);
  if (!g) {
    g = build(kind, side);
    geoCache.set(key, g);
  }
  return g;
}

interface Flying {
  p: Projectile;
  mesh: THREE.Mesh;
  /** Visual offset at launch (muzzle vs. sim origin), fading over the flight. */
  offset: THREE.Vector3;
  prev: THREE.Vector3;
  trailClock: number;
}

const SPIN: Partial<Record<ProjectileKind, number>> = { rock: 12, boulder: 4, egg: 9, cannonball: 0, meteor: 3, oil: 6 };
const ALIGN: Partial<Record<ProjectileKind, boolean>> = {
  spear: true, arrow: true, bolt: true, javelin: true, shell: true, flak: true, rocket: true, missile: true, plasma: true, bomb: true,
};

export class ProjectileViews {
  readonly group = new THREE.Group();
  private readonly flying = new Map<number, Flying>();
  private readonly pool = new Map<string, THREE.Mesh[]>();
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly xAxis = new THREE.Vector3(1, 0, 0);

  constructor(private readonly fx: Effects) {}

  add(p: Projectile, muzzle?: THREE.Vector3): void {
    const key = `${p.kind}:${p.side}`;
    const free = this.pool.get(key)?.pop();
    const mesh = free ?? new THREE.Mesh(geometry(p.kind, p.side), staticMaterial);
    mesh.castShadow = p.kind === 'boulder' || p.kind === 'meteor' || p.kind === 'bomb';
    mesh.visible = true;
    mesh.userData.key = key;
    this.group.add(mesh);
    const start = this.position(p, 0, new THREE.Vector3());
    const offset = muzzle ? muzzle.clone().sub(start) : new THREE.Vector3();
    this.flying.set(p.id, { p, mesh, offset, prev: start.clone().add(offset), trailClock: 0 });
    this.place(this.flying.get(p.id)!, 0, 0);
  }

  /** Point the most recent projectile at a real muzzle, when the fire event arrives. */
  setMuzzle(id: number, muzzle: THREE.Vector3): void {
    const f = this.flying.get(id);
    if (!f) return;
    const start = this.position(f.p, 0, this.tmp);
    f.offset.copy(muzzle).sub(start);
  }

  remove(id: number): THREE.Vector3 | null {
    const f = this.flying.get(id);
    if (!f) return null;
    this.flying.delete(id);
    this.group.remove(f.mesh);
    const key = f.mesh.userData.key as string;
    if (!this.pool.has(key)) this.pool.set(key, []);
    this.pool.get(key)!.push(f.mesh);
    return f.mesh.position.clone();
  }

  private position(p: Projectile, t: number, out: THREE.Vector3): THREE.Vector3 {
    const s = Math.min(1, Math.max(0, t / p.dur));
    out.set(p.sx + (p.ex - p.sx) * s, p.sy + (p.ey - p.sy) * s + p.arc * 4 * s * (1 - s), p.sz + (p.ez - p.sz) * s);
    return out;
  }

  private place(f: Flying, extra: number, dt: number): void {
    const t = Math.min(f.p.dur, f.p.t + extra);
    const pos = this.position(f.p, t, this.tmp);
    const s = Math.min(1, t / f.p.dur);
    pos.addScaledVector(f.offset, 1 - s);
    this.dir.subVectors(pos, f.prev);
    if (ALIGN[f.p.kind] && this.dir.lengthSq() > 1e-6) {
      f.mesh.quaternion.setFromUnitVectors(this.xAxis, this.dir.normalize());
    } else if (SPIN[f.p.kind]) {
      f.mesh.rotation.x += (SPIN[f.p.kind] ?? 0) * dt;
      f.mesh.rotation.z += (SPIN[f.p.kind] ?? 0) * dt * 0.7;
    }
    if (f.p.kind === 'drone') f.mesh.rotation.z = Math.sin(t * 20) * 0.1;
    f.mesh.position.copy(pos);
    f.prev.copy(pos);
  }

  update(extra: number, dt: number): void {
    for (const f of this.flying.values()) {
      this.place(f, extra, dt);
      f.trailClock -= dt;
      if (f.trailClock > 0) continue;
      const p = f.mesh.position;
      switch (f.p.kind) {
        case 'fireball':
        case 'firepot':
          this.fx.fire(p, 1, 0.45);
          f.trailClock = 0.03;
          break;
        case 'sunbolt':
          this.fx.glow(p, '#ffd65a', 0.6, 0.25, 2.5);
          f.trailClock = 0.03;
          break;
        case 'meteor':
          this.fx.fire(p, 3, 1.2);
          this.fx.smoke(p, 1, '#3a3230', 1.5, 0.3);
          f.trailClock = 0.02;
          break;
        case 'rocket':
        case 'missile':
          this.fx.smoke(p, 1, '#cfcac2', 0.5, 0.2);
          this.fx.glow(p, '#ffc070', 0.4, 0.08, 3);
          f.trailClock = 0.025;
          break;
        case 'plasma':
          this.fx.glow(p, TEAMS[f.p.side].glow, 0.5, 0.18, 3);
          f.trailClock = 0.02;
          break;
        case 'shell':
        case 'cannonball':
          this.fx.smoke(p, 1, '#d8d2c8', 0.3, 0.1);
          f.trailClock = 0.06;
          break;
        case 'drone':
          this.fx.glow(p, '#ff5040', 0.25, 0.06, 3);
          f.trailClock = 0.05;
          break;
        default:
          f.trailClock = 1;
      }
    }
  }

  clear(): void {
    for (const id of [...this.flying.keys()]) this.remove(id);
  }
}
