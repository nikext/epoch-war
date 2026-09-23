import * as THREE from 'three';
import { LANE } from '../sim/config';

/**
 * The battlefield camera: a 3/4 side view that slides along the lane and
 * zooms, like Age of War's horizontal scroll but with depth. Everything is
 * smoothed; shake decays on its own.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  focusX = 6;
  targetX = 6;
  distance = 40;
  targetDistance = 40;
  /** Extra height above the default framing (used by menus for a high angle). */
  lift = 0;
  targetLift = 0;
  private shakeAmount = 0;
  private readonly lookAt = new THREE.Vector3();
  minX = -14;
  maxX = LANE + 14;
  minDistance = 22;
  maxDistance = 78;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.5, 900);
  }

  pan(dx: number): void {
    this.targetX = Math.min(this.maxX, Math.max(this.minX, this.targetX + dx));
  }

  jump(x: number): void {
    this.targetX = Math.min(this.maxX, Math.max(this.minX, x));
  }

  zoom(factor: number): void {
    this.targetDistance = Math.min(this.maxDistance, Math.max(this.minDistance, this.targetDistance * factor));
  }

  shake(amount: number): void {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  }

  snap(): void {
    this.focusX = this.targetX;
    this.distance = this.targetDistance;
    this.lift = this.targetLift;
  }

  update(dt: number, time: number): void {
    const k = 1 - Math.exp(-dt * 7);
    this.focusX += (this.targetX - this.focusX) * k;
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * 6));
    this.lift += (this.targetLift - this.lift) * (1 - Math.exp(-dt * 2));
    this.shakeAmount *= Math.exp(-dt * 5);

    const d = this.distance;
    const height = 2.6 + d * 0.26 + this.lift;
    const sx = (Math.sin(time * 53) + Math.sin(time * 31)) * 0.5 * this.shakeAmount * 0.35;
    const sy = (Math.sin(time * 47) + Math.sin(time * 29)) * 0.5 * this.shakeAmount * 0.35;
    this.camera.position.set(this.focusX + sx, height + sy, d);
    this.lookAt.set(this.focusX + sx * 0.5, 2.0 + d * 0.075 + this.lift * 0.3, -1);
    this.camera.lookAt(this.lookAt);
  }

  /** Half the width of the lane visible at z = 0, for minimap framing and edge scrolling. */
  visibleHalfWidth(): number {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const dist = Math.hypot(this.distance, this.camera.position.y);
    return Math.tan(vFov / 2) * dist * this.camera.aspect;
  }
}
