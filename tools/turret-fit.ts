/**
 * Turret fit check: every turret, on every ledge of every wall, through every
 * pose it animates (aim sweep, firing, reloading, pennants in the wind), must
 * stay inside its TURRET_BAND and clear of the other ledges and of the
 * turrets on the ledges above and below it — whatever mix of turrets is
 * built (old-age turrets outlive their wall, so any turret meets any wall).
 *
 *   npm test   (runs after the rules checks)
 */
import * as THREE from 'three';
import { buildBase, seatX, SLOT_POS } from '../src/render/models/bases';
import { TEAMS } from '../src/render/models/team';
import { TURRET_BAND, TurretInstance, turretTemplate } from '../src/render/models/turrets';
import { AGES } from '../src/sim/data/ages';

const VOXEL = 0.08;
const key = (x: number, y: number, z: number): number =>
  ((Math.floor(x / VOXEL) + 2048) * 4096 + (Math.floor(y / VOXEL) + 2048)) * 4096 + (Math.floor(z / VOXEL) + 2048);

const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const p = new THREE.Vector3();

/** Points spread over a triangle, no further apart than a voxel. */
function sampleTriangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: (q: THREE.Vector3) => void): void {
  const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / (VOXEL * 0.7)));
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n - i; j++) {
      const u = i / n;
      const w = j / n;
      out(p.set(0, 0, 0).addScaledVector(a, 1 - u - w).addScaledVector(b, u).addScaledVector(c, w));
    }
  }
}

interface Swept {
  /** Local-space surface voxels (keys) at the turret's own origin, as [x, y, z] triples. */
  points: Float32Array;
  box: THREE.Box3;
  band: string[];
}

/** Sweep a turret through its animation and collect its surface, in its own frame. */
function sweep(model: string, interval: number): Swept {
  const inst = new TurretInstance(turretTemplate(model, 0));
  const seen = new Set<number>();
  const pts: number[] = [];
  const box = new THREE.Box3();
  let top = -Infinity;
  let bottom = Infinity;
  let wide = 0;
  const add = (q: THREE.Vector3): void => {
    box.expandByPoint(q);
    top = Math.max(top, q.y);
    bottom = Math.min(bottom, q.y);
    if (q.y > TURRET_BAND.high) wide = Math.max(wide, Math.abs(q.z));
    const k = key(q.x, q.y, q.z);
    if (seen.has(k)) return;
    seen.add(k);
    pts.push(q.x, q.y, q.z);
  };
  let t = 0;
  for (const aim of [-1.2, -0.6, 0, 0.6, 1.2]) {
    for (let k = 0; k < 4; k++) inst.animate(aim, 99, (t += 0.1), 1, interval);
    for (const fireAge of [0, 0.05, 0.1, 0.2, 0.35, 0.6, 1.0, 1.6, 99]) {
      for (const dt of [0.02, 0.4]) {
        inst.animate(aim, fireAge, (t += dt), 0.02, interval);
        inst.root.updateMatrixWorld(true);
        inst.root.traverse((o) => {
          const m = o as THREE.SkinnedMesh;
          if (!m.isSkinnedMesh) return;
          m.skeleton.update();
          const idx = m.geometry.index!;
          for (let i = 0; i < idx.count; i += 3) {
            m.getVertexPosition(idx.getX(i), v0).applyMatrix4(m.matrixWorld);
            m.getVertexPosition(idx.getX(i + 1), v1).applyMatrix4(m.matrixWorld);
            m.getVertexPosition(idx.getX(i + 2), v2).applyMatrix4(m.matrixWorld);
            sampleTriangle(v0, v1, v2, add);
          }
        });
      }
    }
  }
  inst.dispose();
  const band: string[] = [];
  if (top > TURRET_BAND.top + 1e-3) band.push(`rises to ${top.toFixed(2)} m (band top ${TURRET_BAND.top})`);
  if (bottom < TURRET_BAND.bottom - 1e-3) band.push(`dips to ${bottom.toFixed(2)} m (band bottom ${TURRET_BAND.bottom})`);
  if (wide > TURRET_BAND.highZ + 1e-3) band.push(`reaches |z| ${wide.toFixed(2)} above ${TURRET_BAND.high} m (limit ${TURRET_BAND.highZ})`);
  return { points: new Float32Array(pts), box, band };
}

/** Surface voxels of a static mesh, in its parent's frame. */
function meshVoxels(mesh: THREE.Mesh): Set<number> {
  const out = new Set<number>();
  const pos = mesh.geometry.attributes.position!;
  const idx = mesh.geometry.index;
  const count = idx ? idx.count : pos.count;
  const at = (i: number, v: THREE.Vector3): THREE.Vector3 => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(mesh.matrix);
  for (let i = 0; i < count; i += 3) sampleTriangle(at(i, v0), at(i + 1, v1), at(i + 2, v2), (q) => out.add(key(q.x, q.y, q.z)));
  return out;
}

const models = AGES.flatMap((a) => a.turrets.map((d) => ({ model: d.model, interval: d.interval })));
const swept = new Map(models.map((m) => [m.model, sweep(m.model, m.interval)]));

const problems: string[] = [];
for (const [model, s] of swept) for (const b of s.band) problems.push(`${model}: ${b}`);

for (let age = 0; age < AGES.length; age++) {
  const base = buildBase(age, TEAMS[0]);
  base.root.updateMatrixWorld(true);
  const ledges = base.ledges.map((l) => meshVoxels(l));
  // Every turret's voxels on every slot of this wall.
  interface Placed {
    set: Set<number>;
    list: number[];
    ys: number[];
    minY: number;
    maxY: number;
  }
  const placed = new Map<string, Placed[]>();
  for (const [model, s] of swept) {
    const back = turretTemplate(model, 0).back;
    const perSlot = SLOT_POS.map((slot, i): Placed => {
      const x = seatX(base, i, back);
      const set = new Set<number>();
      const list: number[] = [];
      const ys: number[] = [];
      let minY = Infinity;
      let maxY = -Infinity;
      for (let k = 0; k < s.points.length; k += 3) {
        const y = s.points[k + 1]! + slot.y;
        const kk = key(s.points[k]! + x, y, s.points[k + 2]! + slot.z);
        if (set.has(kk)) continue;
        set.add(kk);
        list.push(kk);
        ys.push(y);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      return { set, list, ys, minY, maxY };
    });
    placed.set(model, perSlot);
    // Against the other ledges.
    perSlot.forEach((pl, i) => {
      ledges.forEach((ledge, j) => {
        if (i === j) return;
        if (pl.list.some((k) => ledge.has(k))) problems.push(`${model} on ledge ${i} of the age-${age} wall hits ledge ${j}`);
      });
    });
  }
  // Against each other, on neighbouring ledges.
  const names = [...placed.keys()];
  for (let i = 0; i < 3; i++) {
    for (const lower of names) {
      for (const upper of names) {
        for (const gap of [1, 2]) {
          if (i + gap > 3) continue;
          const a = placed.get(lower)![i]!;
          const b = placed.get(upper)![i + gap]!;
          if (a.maxY < b.minY - VOXEL) continue;
          const floor = b.minY - VOXEL;
          for (let k = 0; k < a.list.length; k++) {
            if (a.ys[k]! >= floor && b.set.has(a.list[k]!)) {
              problems.push(`${lower} on ledge ${i} and ${upper} on ledge ${i + gap} collide on the age-${age} wall`);
              break;
            }
          }
        }
      }
    }
  }
}

const tall = [...swept].map(([m, s]) => `${m} ${s.box.max.y.toFixed(2)}`).join(', ');
if (problems.length) {
  const unique = [...new Set(problems)];
  console.log(`FAIL turret fit: ${unique.length} problem(s)`);
  for (const pr of unique.slice(0, 60)) console.log(`  ${pr}`);
  if (unique.length > 60) console.log(`  … and ${unique.length - 60} more`);
  process.exit(1);
}
console.log(`ok   turret fit: ${swept.size} turrets × 7 walls × 4 ledges, every pose inside the band (tallest swept: ${tall})`);
