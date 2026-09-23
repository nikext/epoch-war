import * as THREE from 'three';

/**
 * A pooled CPU particle system drawn as one THREE.Points. Two instances are
 * used: additive (fire, sparks, glows) and alpha-blended (smoke, dust).
 */

export interface Emit {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  size1?: number;
  color: THREE.Color | string | number;
  color1?: THREE.Color | string | number;
  alpha?: number;
  alpha1?: number;
  gravity?: number;
  drag?: number;
  /** HDR multiplier on the colour, so hot things bloom. */
  intensity?: number;
}

const vertex = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
varying vec4 vColor;
uniform float uSoft;
uniform float uLight;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = smoothstep(0.5, uSoft, r);
  if (a <= 0.001) discard;
  gl_FragColor = vec4(vColor.rgb * uLight, vColor.a * a);
}
`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly col: Float32Array;
  private readonly col0: Float32Array;
  private readonly col1: Float32Array;
  private readonly size: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly phys: Float32Array;
  private cursor = 0;
  private alive = 0;
  private readonly uniforms = { uScale: { value: 400 }, uSoft: { value: 0.1 }, uLight: { value: 1 } };
  private readonly tmp = new THREE.Color();
  private readonly tmp1 = new THREE.Color();

  constructor(max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.col0 = new Float32Array(max * 4);
    this.col1 = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.phys = new Float32Array(max * 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms.uSoft.value = additive ? 0.0 : 0.22;
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
  }

  /** How lit unlit particles (smoke, dust) should look in the current scene. */
  setLight(k: number): void {
    this.uniforms.uLight.value = k;
  }

  setScale(viewportHeight: number, fovDeg: number): void {
    this.uniforms.uScale.value = viewportHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(e: Emit): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    if (this.life[i]! <= 0) this.alive++;
    const p = i * 3;
    this.pos[p] = e.x;
    this.pos[p + 1] = e.y;
    this.pos[p + 2] = e.z;
    this.vel[p] = e.vx ?? 0;
    this.vel[p + 1] = e.vy ?? 0;
    this.vel[p + 2] = e.vz ?? 0;
    const k = e.intensity ?? 1;
    const c0 = this.tmp.set(e.color as THREE.ColorRepresentation).multiplyScalar(k);
    const c1 = this.tmp1.set((e.color1 ?? e.color) as THREE.ColorRepresentation).multiplyScalar(k);
    const c = i * 4;
    this.col0[c] = c0.r;
    this.col0[c + 1] = c0.g;
    this.col0[c + 2] = c0.b;
    this.col0[c + 3] = e.alpha ?? 1;
    this.col1[c] = c1.r;
    this.col1[c + 1] = c1.g;
    this.col1[c + 2] = c1.b;
    this.col1[c + 3] = e.alpha1 ?? 0;
    this.size0[i] = e.size;
    this.size1[i] = e.size1 ?? e.size;
    this.life[i] = e.life;
    this.maxLife[i] = e.life;
    this.phys[i * 2] = e.gravity ?? 0;
    this.phys[i * 2 + 1] = e.drag ?? 0;
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      const l = (this.life[i] = this.life[i]! - dt);
      const c = i * 4;
      if (l <= 0) {
        this.col[c + 3] = 0;
        this.size[i] = 0;
        continue;
      }
      alive++;
      const p = i * 3;
      const drag = Math.max(0, 1 - this.phys[i * 2 + 1]! * dt);
      this.vel[p] = this.vel[p]! * drag;
      this.vel[p + 1] = this.vel[p + 1]! * drag - this.phys[i * 2]! * dt;
      this.vel[p + 2] = this.vel[p + 2]! * drag;
      this.pos[p] = this.pos[p]! + this.vel[p]! * dt;
      this.pos[p + 1] = this.pos[p + 1]! + this.vel[p + 1]! * dt;
      this.pos[p + 2] = this.pos[p + 2]! + this.vel[p + 2]! * dt;
      const t = 1 - l / this.maxLife[i]!;
      this.col[c] = this.col0[c]! + (this.col1[c]! - this.col0[c]!) * t;
      this.col[c + 1] = this.col0[c + 1]! + (this.col1[c + 1]! - this.col0[c + 1]!) * t;
      this.col[c + 2] = this.col0[c + 2]! + (this.col1[c + 2]! - this.col0[c + 2]!) * t;
      this.col[c + 3] = this.col0[c + 3]! + (this.col1[c + 3]! - this.col0[c + 3]!) * t;
      this.size[i] = this.size0[i]! + (this.size1[i]! - this.size0[i]!) * t;
    }
    this.alive = alive;
    const geo = this.points.geometry;
    geo.attributes.position!.needsUpdate = true;
    geo.attributes.aColor!.needsUpdate = true;
    geo.attributes.aSize!.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.size.fill(0);
    this.alive = 0;
  }
}
