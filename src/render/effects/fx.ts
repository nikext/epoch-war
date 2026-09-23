import * as THREE from 'three';
import { ParticleSystem } from './particles';

/**
 * Every transient visual: particle presets, tracers and beams, lightning,
 * shockwave rings, scorch decals and a small pool of flash lights. The
 * battle view calls these from simulation events.
 */

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const V = new THREE.Vector3();

interface Beam {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  width: number;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  size: number;
}

interface Decal {
  mesh: THREE.Mesh;
  life: number;
}

interface Flash {
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  intensity: number;
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  readonly group = new THREE.Group();
  readonly add = new ParticleSystem(5000, true);
  readonly soft = new ParticleSystem(3500, false);
  private readonly beams: Beam[] = [];
  private readonly rings: Ring[] = [];
  private readonly decals: Decal[] = [];
  private readonly flashes: Flash[] = [];
  private readonly beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateZ(Math.PI / 2).translate(0.5, 0, 0);
  private readonly ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  private readonly decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly decalMat: THREE.MeshBasicMaterial;
  /** Camera shake requests, drained by the battle view. */
  shake = 0;

  constructor() {
    this.group.add(this.add.points, this.soft.points);
    this.decalMat = new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(20,14,10,0.85)', 'rgba(20,14,10,0)'),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffaa55, 0, 18, 1.6);
      light.visible = true;
      this.group.add(light);
      this.flashes.push({ light, life: 0, maxLife: 1, intensity: 0 });
    }
  }

  setViewport(height: number, fov: number): void {
    this.add.setScale(height, fov);
    this.soft.setScale(height, fov);
  }

  // ─── Primitives ───────────────────────────────────────────────────────────

  beam(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, width: number, life: number, opacity = 1): void {
    let b = this.beams.find((x) => x.life <= 0);
    if (!b) {
      const mesh = new THREE.Mesh(
        this.beamGeo,
        new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      b = { mesh, life: 0, maxLife: 1, width };
      this.beams.push(b);
    }
    const len = from.distanceTo(to);
    b.mesh.position.copy(from);
    b.mesh.scale.set(len, width, width);
    V.subVectors(to, from).normalize();
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), V);
    const mat = b.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(color).multiplyScalar(2.2);
    mat.opacity = opacity;
    b.mesh.visible = true;
    b.life = b.maxLife = life;
    b.width = width;
  }

  /** A jagged bolt from a to b built from beam segments. */
  lightning(a: THREE.Vector3, b: THREE.Vector3, color: THREE.ColorRepresentation, width = 0.12, life = 0.25, jag = 0.8): void {
    const segs = Math.max(4, Math.round(a.distanceTo(b) / 1.6));
    let prev = a.clone();
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      if (i < segs) p.add(new THREE.Vector3(rand(-jag, jag), rand(-jag, jag) * 0.5, rand(-jag, jag) * 0.5));
      this.beam(prev, p, color, width, life);
      this.beam(prev, p, '#ffffff', width * 0.35, life * 0.8);
      if (Math.random() < 0.25 && i < segs) {
        const fork = p.clone().add(new THREE.Vector3(rand(-1.5, 1.5), rand(-1.5, 0), rand(-1, 1)));
        this.beam(p, fork, color, width * 0.5, life * 0.7);
      }
      prev = p;
    }
  }

  ring(at: THREE.Vector3, color: THREE.ColorRepresentation, size: number, life: number, vertical = false): void {
    let r = this.rings.find((x) => x.life <= 0);
    if (!r) {
      const mesh = new THREE.Mesh(
        this.ringGeo,
        new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      );
      mesh.renderOrder = 4;
      this.group.add(mesh);
      r = { mesh, life: 0, maxLife: 1, size };
      this.rings.push(r);
    }
    r.mesh.position.copy(at);
    r.mesh.rotation.set(vertical ? 0 : -Math.PI / 2, vertical ? Math.PI / 2 : 0, 0);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2);
    r.mesh.visible = true;
    r.life = r.maxLife = life;
    r.size = size;
  }

  decal(x: number, z: number, y: number, size: number): void {
    let d = this.decals.find((x) => x.life <= 0);
    if (!d) {
      if (this.decals.length >= 40) d = this.decals.reduce((a, b) => (a.life < b.life ? a : b));
      else {
        const mesh = new THREE.Mesh(this.decalGeo, this.decalMat.clone());
        mesh.renderOrder = 1;
        this.group.add(mesh);
        d = { mesh, life: 0 };
        this.decals.push(d);
      }
    }
    d.mesh.position.set(x, y + 0.04, z);
    d.mesh.rotation.y = Math.random() * Math.PI;
    d.mesh.scale.set(size, 1, size * rand(0.7, 1));
    d.mesh.visible = true;
    d.life = 16;
  }

  light(at: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, life: number): void {
    const f = this.flashes.reduce((a, b) => (a.life < b.life ? a : b));
    f.light.position.copy(at);
    f.light.color.set(color);
    f.life = f.maxLife = life;
    f.intensity = intensity;
  }

  // ─── Presets ──────────────────────────────────────────────────────────────

  dust(p: THREE.Vector3, n: number, color = '#b59a74', spread = 0.6, size = 1.1): void {
    for (let i = 0; i < n; i++) {
      this.soft.emit({
        x: p.x + rand(-spread, spread), y: p.y + rand(0, 0.3), z: p.z + rand(-spread, spread),
        vx: rand(-1.2, 1.2), vy: rand(0.4, 1.6), vz: rand(-1.2, 1.2),
        life: rand(0.5, 1.0), size: size * rand(0.5, 0.9), size1: size * rand(1.3, 2.0),
        color, color1: color, alpha: 0.38, alpha1: 0, drag: 2.2, gravity: -0.3,
      });
    }
  }

  smoke(p: THREE.Vector3, n: number, color = '#6d6a66', size = 1.4, rise = 1.2): void {
    for (let i = 0; i < n; i++) {
      this.soft.emit({
        x: p.x + rand(-0.4, 0.4), y: p.y + rand(-0.2, 0.3), z: p.z + rand(-0.4, 0.4),
        vx: rand(-0.6, 0.6), vy: rise * rand(0.6, 1.4), vz: rand(-0.6, 0.6),
        life: rand(1.2, 2.4), size: size * rand(0.5, 0.9), size1: size * rand(2, 3),
        color, color1: '#9a958e', alpha: 0.55, alpha1: 0, drag: 1.2,
      });
    }
  }

  fire(p: THREE.Vector3, n: number, size = 1, color = '#ff8a2a'): void {
    for (let i = 0; i < n; i++) {
      this.add.emit({
        x: p.x + rand(-0.3, 0.3) * size, y: p.y + rand(0, 0.3), z: p.z + rand(-0.3, 0.3) * size,
        vx: rand(-1, 1) * size, vy: rand(0.5, 2.5) * size, vz: rand(-1, 1) * size,
        life: rand(0.25, 0.6), size: size * rand(0.7, 1.3), size1: size * 0.2,
        color: '#ffe08a', color1: color, alpha: 0.9, alpha1: 0, drag: 2, gravity: -2, intensity: 2.4,
      });
    }
  }

  sparks(p: THREE.Vector3, n: number, color: THREE.ColorRepresentation = '#ffd27a', speed = 6, size = 0.18): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = rand(-0.2, 1.2);
      this.add.emit({
        x: p.x, y: p.y, z: p.z,
        vx: Math.cos(a) * Math.cos(e) * speed * rand(0.4, 1), vy: Math.sin(e) * speed * rand(0.4, 1), vz: Math.sin(a) * Math.cos(e) * speed * rand(0.4, 1),
        life: rand(0.2, 0.5), size, size1: size * 0.3, color, color1: color, alpha: 1, alpha1: 0, gravity: 12, drag: 1.5, intensity: 3,
      });
    }
  }

  glow(p: THREE.Vector3, color: THREE.ColorRepresentation, size: number, life: number, intensity = 3): void {
    this.add.emit({ x: p.x, y: p.y, z: p.z, life, size, size1: size * 1.3, color, alpha: 1, alpha1: 0, intensity });
  }

  muzzle(p: THREE.Vector3, dir: number, color: THREE.ColorRepresentation = '#ffc86a', size = 0.9, smoke = 0): void {
    this.glow(p, color, size, 0.07, 4);
    for (let i = 0; i < 3; i++) {
      this.add.emit({
        x: p.x, y: p.y, z: p.z, vx: dir * rand(4, 9), vy: rand(-1, 1), vz: rand(-1, 1),
        life: 0.08, size: size * 0.5, size1: 0.05, color, alpha: 1, alpha1: 0, intensity: 3,
      });
    }
    for (let i = 0; i < smoke; i++) {
      this.soft.emit({
        x: p.x + dir * 0.3, y: p.y, z: p.z, vx: dir * rand(0.8, 2.2), vy: rand(0.2, 0.8), vz: rand(-0.4, 0.4),
        life: rand(0.8, 1.6), size: 0.5, size1: 1.8, color: '#e9e4dc', color1: '#bdb7ae', alpha: 0.6, alpha1: 0, drag: 1.5,
      });
    }
  }

  hit(p: THREE.Vector3, kind: 'blunt' | 'blade' | 'bullet' | 'energy' | 'fire', color?: THREE.ColorRepresentation): void {
    switch (kind) {
      case 'blunt':
        this.dust(p, 1, '#c9b28a', 0.2, 0.45);
        this.sparks(p, 3, '#ffe9b0', 3, 0.12);
        break;
      case 'blade':
        this.sparks(p, 6, '#fff3d0', 5, 0.12);
        break;
      case 'bullet':
        this.sparks(p, 4, '#ffd27a', 5, 0.1);
        this.dust(p, 1, '#9d9180', 0.1, 0.35);
        break;
      case 'energy':
        this.glow(p, color ?? '#7ef', 0.9, 0.15, 3);
        this.sparks(p, 6, color ?? '#7ef', 5, 0.12);
        break;
      case 'fire':
        this.fire(p, 5, 0.6);
        break;
    }
  }

  explosion(p: THREE.Vector3, scale = 1, color = '#ff8a2a', ground = true): void {
    this.glow(p, '#fff1c4', 3.5 * scale, 0.12, 4);
    this.fire(p, Math.round(18 * scale), 1.1 * scale, color);
    this.sparks(p, Math.round(14 * scale), '#ffcf7a', 9 * scale, 0.16);
    this.smoke(new THREE.Vector3(p.x, p.y + 0.4, p.z), Math.round(8 * scale), '#4a4540', 1.6 * scale, 1.6);
    if (ground) {
      this.dust(p, Math.round(6 * scale), '#8f7a5c', 0.8 * scale, 1.2 * scale);
      this.ring(new THREE.Vector3(p.x, p.y + 0.15, p.z), '#ffb35a', 2.5 * scale, 0.35);
      this.decal(p.x, p.z, p.y, 2.4 * scale);
    }
    this.light(new THREE.Vector3(p.x, p.y + 1.2, p.z), color, 60 * scale, 0.3);
    this.shake = Math.max(this.shake, 0.25 * scale);
  }

  heal(p: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      this.add.emit({
        x: p.x + rand(-0.4, 0.4), y: p.y + rand(-0.3, 0.6), z: p.z + rand(-0.4, 0.4), vy: rand(0.8, 1.6),
        life: rand(0.6, 1.0), size: 0.28, size1: 0.1, color: '#9dff8a', color1: '#e6ffd8', alpha: 1, alpha1: 0, intensity: 2.5,
      });
    }
  }

  glitch(p: THREE.Vector3, color: THREE.ColorRepresentation): void {
    for (let i = 0; i < 16; i++) {
      this.add.emit({
        x: p.x + rand(-0.8, 0.8), y: p.y + rand(-0.5, 1.5), z: p.z + rand(-0.6, 0.6), vx: rand(-2, 2), vy: rand(-0.5, 1.5),
        life: rand(0.3, 0.8), size: rand(0.15, 0.35), size1: 0.05, color, color1: '#ffffff', alpha: 1, alpha1: 0, intensity: 3,
      });
    }
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.add.update(dt);
    this.soft.update(dt);
    for (const b of this.beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = Math.max(0, b.life / b.maxLife);
      b.mesh.scale.y = b.mesh.scale.z = b.width * (0.4 + 0.6 * k);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = k;
      if (b.life <= 0) b.mesh.visible = false;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - Math.max(0, r.life / r.maxLife);
      r.mesh.scale.setScalar(0.3 + r.size * t);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, d.life / 3);
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const f of this.flashes) {
      if (f.life > 0) {
        f.life -= dt;
        f.light.intensity = f.intensity * Math.max(0, f.life / f.maxLife);
      } else {
        f.light.intensity = 0;
      }
    }
  }

  clear(): void {
    this.add.clear();
    this.soft.clear();
    for (const b of this.beams) {
      b.life = 0;
      b.mesh.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    for (const d of this.decals) {
      d.life = 0;
      d.mesh.visible = false;
    }
  }
}
