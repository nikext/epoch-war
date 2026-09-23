import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Low-poly modelling kit. Every model in the game is assembled here from
 * primitives: each piece carries its colour and its surface (emissive
 * strength, roughness, metalness) as vertex attributes, and a Part merges its
 * pieces into one geometry — so a whole rigid body part is one draw call with
 * one shared material.
 */

export type ColorLike = number | string | THREE.Color;

export interface Xform {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Uniform scale or per-axis scale. */
  s?: number | [number, number, number];
}

export interface Surface {
  /** Emissive strength: 0 = none, 1 = glows its own colour, >1 blooms. */
  e?: number;
  /** Roughness 0..1 (default 0.8). */
  r?: number;
  /** Metalness 0..1 (default 0). */
  m?: number;
}

export type Opts = Xform & Surface;

const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function toColor(c: ColorLike, target = new THREE.Color()): THREE.Color {
  if (c instanceof THREE.Color) return target.copy(c);
  return target.set(c);
}

/** Mix two colours (sRGB-ish perceptual is not needed at this scale). */
export function mix(a: ColorLike, b: ColorLike, t: number): THREE.Color {
  return toColor(a).lerp(toColor(b), t);
}

export function shade(c: ColorLike, amount: number): THREE.Color {
  const col = toColor(c);
  return amount >= 0 ? col.lerp(new THREE.Color(1, 1, 1), amount) : col.multiplyScalar(1 + amount);
}

function transformOf(o: Xform): THREE.Matrix4 {
  tmpPos.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  tmpEuler.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  tmpQuat.setFromEuler(tmpEuler);
  const s = o.s ?? 1;
  if (typeof s === 'number') tmpScale.set(s, s, s);
  else tmpScale.set(s[0], s[1], s[2]);
  return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
}

export class Part {
  private pieces: THREE.BufferGeometry[] = [];

  get empty(): boolean {
    return this.pieces.length === 0;
  }

  add(geometry: THREE.BufferGeometry, color: ColorLike, o: Opts = {}): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.applyMatrix4(transformOf(o));
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position!.count;
    const col = toColor(color, tmpColor);
    const colors = new Float32Array(n * 3);
    const surf = new Float32Array(n * 3);
    const e = o.e ?? 0;
    const r = o.r ?? 0.8;
    const m = o.m ?? 0;
    for (let i = 0; i < n; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      surf[i * 3] = e;
      surf[i * 3 + 1] = r;
      surf[i * 3 + 2] = m;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('surf', new THREE.BufferAttribute(surf, 3));
    this.pieces.push(g);
    return this;
  }

  box(w: number, h: number, d: number, color: ColorLike, o: Opts = {}): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, o);
  }

  /** Cylinder along y. */
  cyl(rTop: number, rBottom: number, h: number, color: ColorLike, o: Opts & { seg?: number; open?: boolean } = {}): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, o.seg ?? 8, 1, o.open ?? false), color, o);
  }

  sphere(r: number, color: ColorLike, o: Opts & { ws?: number; hs?: number } = {}): this {
    return this.add(new THREE.SphereGeometry(r, o.ws ?? 8, o.hs ?? 6), color, o);
  }

  /** Hemisphere (dome) opening downward. */
  dome(r: number, color: ColorLike, o: Opts & { ws?: number; hs?: number } = {}): this {
    return this.add(new THREE.SphereGeometry(r, o.ws ?? 10, o.hs ?? 5, 0, Math.PI * 2, 0, Math.PI / 2), color, o);
  }

  cone(r: number, h: number, color: ColorLike, o: Opts & { seg?: number } = {}): this {
    return this.add(new THREE.ConeGeometry(r, h, o.seg ?? 8), color, o);
  }

  /** Faceted rock-like blob. */
  ico(r: number, color: ColorLike, o: Opts & { detail?: number } = {}): this {
    return this.add(new THREE.IcosahedronGeometry(r, o.detail ?? 0), color, o);
  }

  torus(r: number, tube: number, color: ColorLike, o: Opts & { rs?: number; ts?: number; arc?: number } = {}): this {
    return this.add(new THREE.TorusGeometry(r, tube, o.rs ?? 6, o.ts ?? 14, o.arc ?? Math.PI * 2), color, o);
  }

  capsule(r: number, len: number, color: ColorLike, o: Opts & { seg?: number } = {}): this {
    return this.add(new THREE.CapsuleGeometry(r, len, 3, o.seg ?? 8), color, o);
  }

  /** Revolve a profile of [radius, y] points around y. */
  lathe(points: [number, number][], color: ColorLike, o: Opts & { seg?: number } = {}): this {
    const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
    return this.add(new THREE.LatheGeometry(pts, o.seg ?? 10), color, o);
  }

  /** Extrude a 2D outline (in the x/y plane) by `depth` along z, centred on z = 0. */
  extrude(outline: [number, number][], depth: number, color: ColorLike, o: Opts & { bevel?: number } = {}): this {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const bevel = o.bevel ?? 0;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 1,
      curveSegments: 6,
    });
    g.translate(0, 0, -depth / 2);
    return this.add(g, color, o);
  }

  /** A tube along a polyline of points, for ropes, cables and bows. */
  tube(points: [number, number, number][], radius: number, color: ColorLike, o: Opts & { seg?: number } = {}): this {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return this.add(new THREE.TubeGeometry(curve, o.seg ?? 8, radius, 5, false), color, o);
  }

  /** Merge another part's pieces into this one (with an optional transform). */
  merge(other: Part, o: Xform = {}): this {
    const m = transformOf(o).clone();
    for (const piece of other.pieces) {
      const g = piece.clone();
      g.applyMatrix4(m);
      this.pieces.push(g);
    }
    return this;
  }

  build(): THREE.BufferGeometry {
    if (this.pieces.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.pieces, false);
    if (!merged) throw new Error('Part.build: incompatible pieces');
    for (const p of this.pieces) p.dispose();
    this.pieces = [];
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}

/**
 * A skeleton of named joints, each with its own Part. Used for every animated
 * model: humanoids, mounts, vehicles. build() produces a template Object3D
 * whose joints are findable by name after cloning.
 */
export class RigBuilder {
  readonly root = new THREE.Group();
  private readonly joints = new Map<string, { group: THREE.Group; part: Part }>();

  constructor(name = 'rig') {
    this.root.name = name;
  }

  joint(name: string, parent: string | null, x = 0, y = 0, z = 0): Part {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    const parentGroup = parent ? this.joints.get(parent)?.group : this.root;
    if (!parentGroup) throw new Error(`RigBuilder: unknown parent ${parent}`);
    parentGroup.add(group);
    const part = new Part();
    this.joints.set(name, { group, part });
    return part;
  }

  part(name: string): Part {
    const j = this.joints.get(name);
    if (!j) throw new Error(`RigBuilder: unknown joint ${name}`);
    return j.part;
  }

  has(name: string): boolean {
    return this.joints.has(name);
  }

  group(name: string): THREE.Group {
    const j = this.joints.get(name);
    if (!j) throw new Error(`RigBuilder: unknown joint ${name}`);
    return j.group;
  }

  build(material: THREE.Material, castShadow = true): THREE.Group {
    for (const [name, { group, part }] of this.joints) {
      if (part.empty) continue;
      const mesh = new THREE.Mesh(part.build(), material);
      mesh.name = `${name}:mesh`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      group.add(mesh);
    }
    return this.root;
  }
}
