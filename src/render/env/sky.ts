import * as THREE from 'three';
import type { Theme } from './themes';

/**
 * Procedural sky dome: a three-band gradient, a sun with a soft halo, drifting
 * fbm clouds, and — for the Age of Intelligence — stars and an aurora. All
 * parameters are uniforms so the sky can crossfade between ages.
 */

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const fragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uStars;
uniform float uAurora;
uniform float uClouds;
uniform vec3 uCloudColor;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = y > 0.0
    ? mix(uHorizon, uTop, pow(clamp(y, 0.0, 1.0), 0.55))
    : mix(uHorizon, uBottom, pow(clamp(-y * 3.0, 0.0, 1.0), 0.7));

  // Sun disc and halo.
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sd, 900.0 / uSunSize) * 3.0;
  col += uSunColor * pow(sd, 18.0) * 0.35;
  col += uSunColor * pow(sd, 3.0) * 0.12;

  // Stars.
  if (uStars > 0.0 && y > 0.0) {
    vec2 sp = d.xz / (y + 0.35) * 180.0;
    float s = hash(floor(sp));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
    float star = step(0.9955, s) * smoothstep(0.35, 0.05, length(fract(sp) - 0.5)) * tw;
    col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.0, 0.25, y);
  }

  // Aurora curtains.
  if (uAurora > 0.0 && y > 0.02) {
    float band = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float wave = sin(d.x * (3.0 + fi) + uTime * (0.15 + fi * 0.05) + fi * 1.7) * 0.08;
      float h = 0.28 + fi * 0.09 + wave + fbm(vec2(d.x * 4.0 + uTime * 0.05, fi)) * 0.08;
      band += smoothstep(0.09, 0.0, abs(y - h)) * (0.6 - fi * 0.15) * fbm(vec2(d.x * 12.0 + fi * 3.0, uTime * 0.2));
    }
    vec3 auroraCol = mix(vec3(0.2, 1.0, 0.75), vec3(0.65, 0.3, 1.0), smoothstep(-0.4, 0.6, d.x));
    col += auroraCol * band * uAurora * 1.3;
  }

  // Clouds on a virtual plane.
  if (uClouds > 0.0 && y > 0.0) {
    vec2 cp = d.xz / (y + 0.08) * 0.9 + vec2(uTime * 0.006, 0.0);
    float c = fbm(cp * 1.4);
    float cov = smoothstep(1.0 - uClouds * 0.62, 1.05 - uClouds * 0.3, c);
    float lit = 0.75 + 0.35 * pow(sd, 4.0);
    col = mix(col, uCloudColor * lit, cov * smoothstep(0.0, 0.18, y) * 0.85);
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0.5, 0.4, -0.7) },
    uSunColor: { value: new THREE.Color() },
    uSunSize: { value: 1 },
    uStars: { value: 0 },
    uAurora: { value: 0 },
    uClouds: { value: 0.5 },
    uCloudColor: { value: new THREE.Color() },
    uTime: { value: 0 },
  };

  constructor() {
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), material);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  /** Blend between two themes' skies (t = 0 → a, 1 → b). */
  apply(a: Theme, b: Theme, t: number): void {
    const u = this.uniforms;
    const lerp = (x: number, y: number): number => x + (y - x) * t;
    u.uTop.value.set(a.sky.top).lerp(new THREE.Color(b.sky.top), t);
    u.uHorizon.value.set(a.sky.horizon).lerp(new THREE.Color(b.sky.horizon), t);
    u.uBottom.value.set(a.sky.bottom).lerp(new THREE.Color(b.sky.bottom), t);
    u.uSunColor.value.set(a.sky.sunColor).lerp(new THREE.Color(b.sky.sunColor), t);
    u.uCloudColor.value.set(a.sky.cloudColor).lerp(new THREE.Color(b.sky.cloudColor), t);
    u.uSunDir.value.fromArray(a.sky.sunDir).lerp(new THREE.Vector3().fromArray(b.sky.sunDir), t).normalize();
    u.uSunSize.value = lerp(a.sky.sunSize, b.sky.sunSize);
    u.uStars.value = lerp(a.sky.stars, b.sky.stars);
    u.uAurora.value = lerp(a.sky.aurora, b.sky.aurora);
    u.uClouds.value = lerp(a.sky.clouds, b.sky.clouds);
  }

  update(time: number, camera: THREE.Camera): void {
    this.uniforms.uTime.value = time;
    this.mesh.position.copy(camera.position);
  }

  get sunDir(): THREE.Vector3 {
    return this.uniforms.uSunDir.value;
  }
}
