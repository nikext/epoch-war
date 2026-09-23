import * as THREE from 'three';

/**
 * Health bars for every unit in one instanced draw: camera-facing quads built
 * in the vertex shader, filled by a per-instance fraction, tinted by team,
 * with gold pips for veterancy.
 */

const vertex = /* glsl */ `
attribute float aFill;
attribute float aWidth;
attribute float aRank;
attribute float aAlpha;
attribute vec3 aColor;
varying vec2 vUv;
varying float vFill;
varying float vRank;
varying float vAlpha;
varying vec3 vColor;
varying float vWidth;
void main() {
  vUv = uv;
  vFill = aFill;
  vRank = aRank;
  vAlpha = aAlpha;
  vColor = aColor;
  vWidth = aWidth;
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  center.xy += position.xy * vec2(aWidth, 0.26);
  gl_Position = projectionMatrix * center;
}
`;

const fragment = /* glsl */ `
varying vec2 vUv;
varying float vFill;
varying float vRank;
varying float vAlpha;
varying vec3 vColor;
varying float vWidth;
void main() {
  // Bottom 55% is the bar, the top strip holds rank pips.
  float barTop = 0.55;
  if (vUv.y > barTop) {
    if (vRank < 0.5) discard;
    float pipW = 0.16 / vWidth;
    float idx = floor(vUv.x / (pipW * 1.6));
    vec2 local = vec2(mod(vUv.x, pipW * 1.6) / pipW, (vUv.y - barTop - 0.08) / (1.0 - barTop - 0.08));
    if (idx >= vRank || local.x > 1.0 || local.y < 0.0) discard;
    gl_FragColor = vec4(vec3(1.0, 0.8, 0.25) * 1.6, vAlpha);
    return;
  }
  vec2 uv = vec2(vUv.x, vUv.y / barTop);
  float bx = 0.02 / max(0.3, vWidth * 0.5);
  float by = 0.18;
  bool border = uv.x < bx || uv.x > 1.0 - bx || uv.y < by || uv.y > 1.0 - by;
  vec3 col;
  if (border) col = vec3(0.04, 0.05, 0.07);
  else if (uv.x < vFill) col = vColor * (0.85 + 0.35 * uv.y);
  else col = vec3(0.12, 0.13, 0.16);
  gl_FragColor = vec4(col, vAlpha);
}
`;

export class HealthBars {
  readonly mesh: THREE.InstancedMesh;
  private readonly fill: THREE.InstancedBufferAttribute;
  private readonly width: THREE.InstancedBufferAttribute;
  private readonly rank: THREE.InstancedBufferAttribute;
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly color: THREE.InstancedBufferAttribute;
  private count = 0;
  private readonly m = new THREE.Matrix4();

  constructor(private readonly max = 160) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.25, 0);
    this.fill = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.width = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.rank = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    geo.setAttribute('aFill', this.fill);
    geo.setAttribute('aWidth', this.width);
    geo.setAttribute('aRank', this.rank);
    geo.setAttribute('aAlpha', this.alpha);
    geo.setAttribute('aColor', this.color);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;
  }

  begin(): void {
    this.count = 0;
  }

  push(pos: THREE.Vector3, width: number, fill: number, color: THREE.Color, rank: number, alpha: number): void {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.m.makeTranslation(pos.x, pos.y, pos.z);
    this.mesh.setMatrixAt(i, this.m);
    this.fill.setX(i, fill);
    this.width.setX(i, width);
    this.rank.setX(i, rank);
    this.alpha.setX(i, alpha);
    this.color.setXYZ(i, color.r, color.g, color.b);
  }

  end(): void {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fill.needsUpdate = true;
    this.width.needsUpdate = true;
    this.rank.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.color.needsUpdate = true;
  }
}
