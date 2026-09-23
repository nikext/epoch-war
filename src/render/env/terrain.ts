import * as THREE from 'three';
import { LANE } from '../../sim/config';
import { fbm2, noise2, smoothstep } from './noise';
import type { Theme } from './themes';
import { createModelMaterial } from '../kit/materials';

/**
 * The battlefield: a floating diorama slab with a dirt road down the middle,
 * rolling hills behind, a cliff face in front, and distant ridges fading into
 * fog. Vertex colours paint each half in its side's age, and when a side
 * evolves the new palette sweeps outward from its wall.
 */

export const GROUND_X0 = -85;
export const GROUND_X1 = LANE + 85;
export const GROUND_Z0 = -70;
/** The front edge (toward the camera), where the cliff drops away. */
export const GROUND_Z1 = 15;

const ROAD_HALF = 2.9;

export function groundHeight(x: number, z: number): number {
  const off = smoothstep(ROAD_HALF + 0.6, ROAD_HALF + 5, Math.abs(z));
  let h = 0;
  if (z < 0) {
    const back = Math.max(0, -z - 7);
    h += off * (fbm2(x * 0.045, z * 0.05) * 1.1 + Math.min(back, 38) * 0.085 * (0.45 + fbm2(x * 0.025 + 7, z * 0.03)));
  } else {
    h += off * (fbm2(x * 0.07 + 3, z * 0.09) * 0.6 - 0.1);
  }
  // Base courtyards stay level.
  const nearBase = Math.min(Math.abs(x - -8), Math.abs(x - (LANE + 8)));
  h *= smoothstep(6, 16, nearBase) * 0.8 + 0.2;
  // A gentle dip for the road itself.
  h -= (1 - smoothstep(0, ROAD_HALF, Math.abs(z))) * 0.04;
  return h;
}

interface Palette {
  grassA: THREE.Color;
  grassB: THREE.Color;
  dirt: THREE.Color;
  road: THREE.Color;
  roadEdge: THREE.Color;
  cliffTop: THREE.Color;
  cliffMid: THREE.Color;
  cliffLow: THREE.Color;
  hills: THREE.Color[];
  laneGlow: number;
}

function palette(t: Theme): Palette {
  const g = t.ground;
  return {
    grassA: new THREE.Color(g.grassA),
    grassB: new THREE.Color(g.grassB),
    dirt: new THREE.Color(g.dirt),
    road: new THREE.Color(g.road),
    roadEdge: new THREE.Color(g.roadEdge),
    cliffTop: new THREE.Color(g.cliffTop),
    cliffMid: new THREE.Color(g.cliffMid),
    cliffLow: new THREE.Color(g.cliffLow),
    hills: t.hills.map((h) => new THREE.Color(h)),
    laneGlow: t.laneGlow,
  };
}

/** A side's palette, possibly mid-transition from an old age to a new one. */
interface SideLook {
  from: Palette;
  to: Palette;
  /** Seconds since the transition began; the new palette sweeps outward. */
  t: number;
}

const SWEEP_TIME = 2.6;

export class Terrain {
  readonly group = new THREE.Group();
  private readonly ground: THREE.Mesh;
  private readonly cliff: THREE.Mesh;
  private readonly ridges: THREE.Mesh[] = [];
  /** Glowing lane edges, one pair per half, lit in the Age of Intelligence. */
  private readonly laneStrips: THREE.Mesh[] = [];
  private readonly sides: [SideLook, SideLook];
  private dirty = true;
  /** Per-vertex cached noise so recolouring is cheap. */
  private readonly groundNoise: Float32Array;

  constructor(initial: Theme) {
    const p = palette(initial);
    this.sides = [
      { from: p, to: p, t: SWEEP_TIME },
      { from: p, to: p, t: SWEEP_TIME },
    ];

    const material = createModelMaterial();
    material.flatShading = true;

    // Ground slab.
    const w = GROUND_X1 - GROUND_X0;
    const d = GROUND_Z1 - GROUND_Z0;
    const geo = new THREE.PlaneGeometry(w, d, Math.round(w / 1.4), Math.round(d / 1.2));
    geo.rotateX(-Math.PI / 2);
    geo.translate((GROUND_X0 + GROUND_X1) / 2, 0, (GROUND_Z0 + GROUND_Z1) / 2);
    const pos = geo.attributes.position!;
    this.groundNoise = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (noise2(i * 0.37, 1.3) - 0.5) * 0.5;
      const z = pos.getZ(i);
      pos.setX(i, x);
      pos.setY(i, groundHeight(x, z));
      this.groundNoise[i * 2] = fbm2(x * 0.12, z * 0.12, 3);
      this.groundNoise[i * 2 + 1] = noise2(x * 0.9, z * 0.9);
    }
    geo.computeVertexNormals();
    addSurface(geo, 0, 0.95, 0);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    this.ground = new THREE.Mesh(geo, material);
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // Cliff face along the front edge.
    const cliffGeo = new THREE.PlaneGeometry(w, 9, Math.round(w / 1.5), 6);
    cliffGeo.translate((GROUND_X0 + GROUND_X1) / 2, -4.5, 0);
    const cp = cliffGeo.attributes.position!;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      const y = cp.getY(i);
      const top = groundHeight(x, GROUND_Z1);
      const yy = y > -0.01 ? top : y + (noise2(x * 0.5, y * 0.7) - 0.5) * 0.7;
      cp.setY(i, yy);
      cp.setZ(i, GROUND_Z1 + (y > -0.01 ? 0 : (noise2(x * 0.3, y * 0.4) - 0.5) * 1.6 - y * 0.12));
    }
    cliffGeo.computeVertexNormals();
    addSurface(cliffGeo, 0, 0.95, 0);
    cliffGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cp.count * 3), 3));
    this.cliff = new THREE.Mesh(cliffGeo, material);
    this.group.add(this.cliff);

    // Neon lane edges (hidden until a half reaches the final age).
    for (const side of [0, 1] as const) {
      const x0 = side === 0 ? GROUND_X0 + 60 : LANE / 2;
      const x1 = side === 0 ? LANE / 2 : GROUND_X1 - 60;
      const strip = new THREE.Group() as unknown as THREE.Mesh;
      for (const z of [-ROAD_HALF + 0.1, ROAD_HALF - 0.1]) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(x1 - x0, 0.03, 0.12),
          new THREE.MeshBasicMaterial({ color: new THREE.Color('#3fd0ff').multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0 }),
        );
        m.position.set((x0 + x1) / 2, 0.03, z);
        (strip as unknown as THREE.Group).add(m);
      }
      this.laneStrips.push(strip);
      this.group.add(strip);
    }

    // Distant ridges.
    const ridgeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (let layer = 0; layer < 3; layer++) {
      const z = -85 - layer * 45;
      const rw = 520 + layer * 200;
      const segs = 70 + layer * 20;
      const rg = new THREE.PlaneGeometry(rw, 60, segs, 1);
      rg.translate(LANE / 2, 30, z);
      const rp = rg.attributes.position!;
      for (let i = 0; i < rp.count; i++) {
        const x = rp.getX(i);
        if (rp.getY(i) > 1) {
          const peak = 10 + layer * 9 + fbm2(x * (0.02 - layer * 0.004) + layer * 11, layer) * (24 + layer * 18);
          rp.setY(i, peak - (layer === 0 ? 4 : 0));
        } else {
          rp.setY(i, -12);
        }
      }
      rg.computeVertexNormals();
      rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rp.count * 3), 3));
      const mesh = new THREE.Mesh(rg, ridgeMat);
      this.ridges.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Begin sweeping a side's half of the land into a new age's palette. */
  setSideTheme(side: 0 | 1, theme: Theme, instant = false): void {
    const s = this.sides[side];
    s.from = instant ? palette(theme) : s.to;
    s.to = palette(theme);
    s.t = instant ? SWEEP_TIME : 0;
    this.dirty = true;
  }

  update(dt: number): void {
    let animating = false;
    for (const s of this.sides) {
      if (s.t < SWEEP_TIME) {
        s.t += dt;
        animating = true;
      }
    }
    if (animating || this.dirty) {
      this.recolor();
      this.dirty = false;
    }
    this.laneStrips.forEach((strip, side) => {
      const s = this.sides[side]!;
      const target = s.to.laneGlow * (s.t >= SWEEP_TIME ? 1 : s.t / SWEEP_TIME);
      for (const child of strip.children) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 2);
        child.visible = mat.opacity > 0.01;
      }
    });
  }

  /** How far the new palette has spread for a side, as a blend weight at x. */
  private reveal(side: 0 | 1, x: number): number {
    const s = this.sides[side];
    if (s.t >= SWEEP_TIME) return 1;
    const f = s.t / SWEEP_TIME;
    const dist = side === 0 ? x - GROUND_X0 : GROUND_X1 - x;
    const span = GROUND_X1 - GROUND_X0;
    const front = f * f * span * 0.75;
    return 1 - smoothstep(front - 6, front + 6, dist);
  }

  private sidePalette(side: 0 | 1, x: number, key: keyof Omit<Palette, 'hills' | 'laneGlow'>, out: THREE.Color): THREE.Color {
    const s = this.sides[side];
    const r = this.reveal(side, x);
    return out.copy(s.from[key]).lerp(s.to[key], r);
  }

  private colorAt(key: keyof Omit<Palette, 'hills' | 'laneGlow'>, x: number, out: THREE.Color): THREE.Color {
    const w = smoothstep(LANE * 0.36, LANE * 0.64, x);
    this.sidePalette(0, x, key, out);
    if (w > 0) out.lerp(this.sidePalette(1, x, key, tmpB), w);
    return out;
  }

  private recolor(): void {
    const geo = this.ground.geometry;
    const pos = geo.attributes.position!;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const surf = geo.attributes.surf as THREE.BufferAttribute;
    const c = new THREE.Color();
    const g2 = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = this.groundNoise[i * 2]!;
      const fine = this.groundNoise[i * 2 + 1]!;
      const az = Math.abs(z) + (n - 0.5) * 0.9;
      let emissive = 0;
      if (az < ROAD_HALF) {
        this.colorAt('road', x, c);
        c.multiplyScalar(0.92 + fine * 0.12);
        const glow = this.laneGlowAt(x);
        if (glow > 0 && Math.abs(Math.abs(z) - ROAD_HALF + 0.35) < 0.12) {
          this.colorAt('roadEdge', x, c);
          emissive = 1.6 * glow;
        }
      } else if (az < ROAD_HALF + 0.7) {
        this.colorAt('roadEdge', x, c);
        const glow = this.laneGlowAt(x);
        if (glow > 0) this.colorAt('grassB', x, c);
      } else {
        this.colorAt('grassA', x, c);
        this.colorAt('grassB', x, g2);
        c.lerp(g2, smoothstep(0.35, 0.65, n));
        if (n < 0.28) c.lerp(this.colorAt('dirt', x, g2), (0.28 - n) * 1.6);
        c.multiplyScalar(0.9 + fine * 0.14 + Math.min(0.12, y * 0.012));
      }
      col.setXYZ(i, c.r, c.g, c.b);
      surf.setX(i, emissive);
    }
    col.needsUpdate = true;
    surf.needsUpdate = true;

    const cg = this.cliff.geometry;
    const cp = cg.attributes.position!;
    const cc = cg.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      const y = cp.getY(i);
      if (y > -1.2) this.colorAt('cliffTop', x, c);
      else if (y > -4.5) this.colorAt('cliffMid', x, c);
      else this.colorAt('cliffLow', x, c);
      c.multiplyScalar(0.85 + noise2(x * 0.7, y * 1.3) * 0.3);
      cc.setXYZ(i, c.r, c.g, c.b);
    }
    cc.needsUpdate = true;

    this.ridges.forEach((ridge, layer) => {
      const rp = ridge.geometry.attributes.position!;
      const rc = ridge.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < rp.count; i++) {
        const x = rp.getX(i);
        const w = smoothstep(LANE * 0.2, LANE * 0.8, x);
        const a = this.sides[0].to.hills[layer]!;
        const b = this.sides[1].to.hills[layer]!;
        c.copy(a).lerp(b, w);
        if (rp.getY(i) < 0) c.multiplyScalar(0.8);
        rc.setXYZ(i, c.r, c.g, c.b);
      }
      rc.needsUpdate = true;
    });
  }

  private laneGlowAt(x: number): number {
    const w = smoothstep(LANE * 0.36, LANE * 0.64, x);
    const a = this.sides[0].to.laneGlow * this.reveal(0, x);
    const b = this.sides[1].to.laneGlow * this.reveal(1, x);
    return a * (1 - w) + b * w;
  }
}

const tmpB = new THREE.Color();

function addSurface(geo: THREE.BufferGeometry, e: number, r: number, m: number): void {
  const n = geo.attributes.position!.count;
  const surf = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    surf[i * 3] = e;
    surf[i * 3 + 1] = r;
    surf[i * 3 + 2] = m;
  }
  geo.setAttribute('surf', new THREE.BufferAttribute(surf, 3));
}
