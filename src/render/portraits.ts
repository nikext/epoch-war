import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { TurretDef, UnitDef } from '../sim/types';
import { unitTemplate } from './models';
import { ModelInstance } from './models/rig';
import { TurretInstance, turretTemplate } from './models/turrets';

/**
 * Renders unit and turret portraits for the HUD from the real 3D models, on
 * a small offscreen canvas, and caches them as data URLs.
 */
export class Portraits {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  private readonly cache = new Map<string, string>();
  private readonly size = 160;

  private ensure(): THREE.WebGLRenderer {
    if (this.renderer) return this.renderer;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = this.size;
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(this.size, this.size, false);
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3228, 1.6));
    const key = new THREE.DirectionalLight(0xfff2dd, 3.2);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.6);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);
    this.renderer = r;
    return r;
  }

  private shoot(object: THREE.Object3D, zoom = 1): string {
    const r = this.ensure();
    this.scene.add(object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x * 0.9, size.y, size.z * 0.7) / zoom;
    const dist = span / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * 1.15;
    this.camera.position.set(center.x + dist * 0.35, center.y + span * 0.12, center.z + dist);
    this.camera.lookAt(center);
    r.render(this.scene, this.camera);
    const url = (r.domElement as HTMLCanvasElement).toDataURL('image/png');
    this.scene.remove(object);
    return url;
  }

  unit(def: UnitDef, side: 0 | 1 = 0): string {
    const key = `u:${def.id}:${side}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const inst = new ModelInstance(unitTemplate(def.model, side));
    inst.animate({ t: 0.4, dt: 1, stride: 0, moving: false, attackT: 99, windup: def.windup, interval: def.interval, deadT: -1, stunned: false, aim: 0, seed: 0.3 });
    const url = this.shoot(inst.root, def.cls === 'apex' ? 1.1 : 1.15);
    inst.material.dispose();
    this.cache.set(key, url);
    return url;
  }

  turret(def: TurretDef, side: 0 | 1 = 0): string {
    const key = `t:${def.id}:${side}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const inst = new TurretInstance(turretTemplate(def.model, side));
    inst.animate(0.15, 99, 0, 1);
    const url = this.shoot(inst.root, 1.1);
    this.cache.set(key, url);
    return url;
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
