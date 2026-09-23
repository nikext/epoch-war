import * as THREE from 'three';
import { LANE } from '../../sim/config';
import { Part } from '../kit/builder';
import { staticMaterial } from '../kit/materials';
import { PROP_SETS, type Band, type PropDef } from './props';
import { groundHeight, GROUND_X0, GROUND_X1 } from './terrain';
import { scatter } from './noise';

/**
 * Scatters each side's age-specific props over its half of the land. When a
 * side evolves, the old props sink away and the new ones pop up in a wave
 * that travels outward from its wall, in step with the terrain recolour.
 */

const BAND_COUNTS: Record<Band, number> = { front: 70, near: 26, mid: 60, far: 9 };
const APPEAR_SPAN = 2.4;

interface Item {
  mesh: THREE.InstancedMesh;
  index: number;
  matrix: THREE.Matrix4;
  delay: number;
}

interface PropSet {
  group: THREE.Group;
  items: Item[];
  t: number;
  leaving: boolean;
  done: boolean;
}

const geometryCache = new Map<PropDef, THREE.BufferGeometry>();

function geometryOf(def: PropDef): THREE.BufferGeometry {
  let g = geometryCache.get(def);
  if (!g) {
    const p = new Part();
    def.build(p);
    g = p.build();
    geometryCache.set(def, g);
  }
  return g;
}

function bandZ(band: Band, r: () => number): number {
  switch (band) {
    case 'front':
      return 4.3 + r() * 9.5;
    case 'near':
      return r() < 0.65 ? -4.5 - r() * 5 : 4.8 + r() * 5;
    case 'mid':
      return -9 - r() * 34;
    case 'far':
      return -55 - r() * 13;
  }
}

function excluded(x: number, z: number): boolean {
  // Keep the bases' footprints clear.
  if (z > -12 && z < 7 && (x > -24 && x < 3)) return true;
  if (z > -12 && z < 7 && (x > LANE - 3 && x < LANE + 24)) return true;
  return false;
}

export class Scenery {
  readonly group = new THREE.Group();
  private readonly current: (PropSet | null)[] = [null, null];
  private readonly leaving: PropSet[] = [];

  setAge(side: 0 | 1, age: number, instant = false): void {
    const old = this.current[side];
    if (old) {
      old.leaving = true;
      old.t = 0;
      if (instant) this.dispose(old);
      else this.leaving.push(old);
    }
    const set = this.build(side, age);
    if (instant) set.t = 99;
    this.current[side] = set;
    this.group.add(set.group);
    this.apply(set);
  }

  private build(side: 0 | 1, age: number): PropSet {
    const defs = PROP_SETS[age]!;
    const r = scatter(1000 + side * 97 + age * 13);
    const group = new THREE.Group();
    const placements = new Map<PropDef, THREE.Matrix4[]>();
    const delays = new Map<PropDef, number[]>();
    const x0 = side === 0 ? GROUND_X0 + 4 : LANE / 2 - 4;
    const x1 = side === 0 ? LANE / 2 + 4 : GROUND_X1 - 4;
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();

    for (const band of ['front', 'near', 'mid', 'far'] as Band[]) {
      const pool = defs.filter((d) => d.band === band);
      if (pool.length === 0) continue;
      const total = pool.reduce((s, d) => s + d.weight, 0);
      const count = BAND_COUNTS[band];
      for (let i = 0; i < count; i++) {
        let pick = r() * total;
        let def = pool[0]!;
        for (const d of pool) {
          pick -= d.weight;
          if (pick <= 0) {
            def = d;
            break;
          }
        }
        let x = 0;
        let z = 0;
        let ok = false;
        for (let tries = 0; tries < 6 && !ok; tries++) {
          x = x0 + r() * (x1 - x0);
          z = bandZ(band, r);
          ok = !excluded(x, z);
        }
        if (!ok) continue;
        const s = def.scale[0] + r() * (def.scale[1] - def.scale[0]);
        e.set(0, def.spin ? r() * Math.PI * 2 : (r() - 0.5) * 0.4, 0);
        q.setFromEuler(e);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, groundHeight(x, z) - 0.05, z), q, new THREE.Vector3(s, s, s));
        if (!placements.has(def)) {
          placements.set(def, []);
          delays.set(def, []);
        }
        placements.get(def)!.push(m);
        const fromWall = side === 0 ? x - GROUND_X0 : GROUND_X1 - x;
        delays.get(def)!.push((fromWall / (GROUND_X1 - GROUND_X0)) * APPEAR_SPAN + r() * 0.2);
      }
    }

    const items: Item[] = [];
    for (const [def, mats] of placements) {
      const mesh = new THREE.InstancedMesh(geometryOf(def), staticMaterial, mats.length);
      mesh.castShadow = !!def.shadow;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      const ds = delays.get(def)!;
      mats.forEach((m, i) => items.push({ mesh, index: i, matrix: m, delay: ds[i]! }));
      group.add(mesh);
    }
    return { group, items, t: 0, leaving: false, done: false };
  }

  private apply(set: PropSet): void {
    const m = new THREE.Matrix4();
    const scale = new THREE.Matrix4();
    const touched = new Set<THREE.InstancedMesh>();
    let settled = true;
    for (const it of set.items) {
      const local = (set.t - it.delay) / 0.45;
      let k: number;
      if (set.leaving) {
        k = local <= 0 ? 1 : local >= 1 ? 0 : 1 - local;
      } else {
        k = local <= 0 ? 0 : local >= 1 ? 1 : easeOutBack(local);
      }
      if (local < 1) settled = false;
      const pos = new THREE.Vector3().setFromMatrixPosition(it.matrix);
      scale.makeScale(Math.max(0.0001, k), Math.max(0.0001, k), Math.max(0.0001, k));
      m.copy(it.matrix).setPosition(0, 0, 0).premultiply(scale).setPosition(pos);
      it.mesh.setMatrixAt(it.index, m);
      touched.add(it.mesh);
    }
    for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
    if (settled) set.done = true;
  }

  update(dt: number): void {
    for (const set of this.current) {
      if (set && !set.done) {
        set.t += dt;
        this.apply(set);
      }
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const set = this.leaving[i]!;
      set.t += dt;
      this.apply(set);
      if (set.done) {
        this.dispose(set);
        this.leaving.splice(i, 1);
      }
    }
  }

  private dispose(set: PropSet): void {
    this.group.remove(set.group);
    for (const child of set.group.children) (child as THREE.InstancedMesh).dispose();
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
