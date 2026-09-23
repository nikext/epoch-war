import * as THREE from 'three';
import type { CameraRig } from './render/camera';

/**
 * Mouse and keyboard. The game asks it for held keys each frame and gets
 * callbacks for discrete actions; it also turns the cursor into a lane
 * position for aiming specials.
 */

export type Action =
  | 'train1' | 'train2' | 'train3' | 'train4' | 'train5' | 'train6'
  | 'special' | 'evolve' | 'stance' | 'pause' | 'cancel' | 'speed' | 'armory' | 'project' | 'mute' | 'turret';

const KEYMAP: Record<string, Action> = {
  Digit1: 'train1', Digit2: 'train2', Digit3: 'train3', Digit4: 'train4', Digit5: 'train5', Digit6: 'train6',
  Numpad1: 'train1', Numpad2: 'train2', Numpad3: 'train3', Numpad4: 'train4', Numpad5: 'train5', Numpad6: 'train6',
  Space: 'special', KeyQ: 'special', KeyE: 'evolve', KeyV: 'evolve', KeyH: 'stance', KeyP: 'pause', Escape: 'cancel',
  KeyF: 'speed', KeyU: 'armory', KeyX: 'project', KeyM: 'mute', KeyT: 'turret',
};

export class Input {
  private readonly held = new Set<string>();
  private dragging = false;
  private dragX = 0;
  private dragMoved = 0;
  /** Normalised device coords of the cursor, or null when outside. */
  readonly ndc = new THREE.Vector2();
  hasPointer = false;
  edgeScroll = true;
  onAction: (a: Action) => void = () => {};
  onClick: (laneX: number) => void = () => {};
  onRightClick: () => void = () => {};
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rig: CameraRig,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.held.add(e.code);
      const action = KEYMAP[e.code];
      if (action && !e.repeat) {
        e.preventDefault();
        this.onAction(action);
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.rig.zoom(0.88);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.rig.zoom(1.14);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.rig.zoom(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2 || e.button === 0) {
        this.dragging = true;
        this.dragX = e.clientX;
        this.dragMoved = 0;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      this.updatePointer(e);
      if (!this.dragging) return;
      const dx = e.clientX - this.dragX;
      this.dragX = e.clientX;
      this.dragMoved += Math.abs(dx);
      if (this.dragMoved > 6) {
        const worldPerPixel = (this.rig.visibleHalfWidth() * 2) / Math.max(1, canvas.clientWidth);
        this.rig.pan(-dx * worldPerPixel);
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      const wasDrag = this.dragMoved > 6;
      this.dragging = false;
      if (wasDrag) return;
      if (e.button === 0) {
        const x = this.laneX();
        if (x !== null) this.onClick(x);
      } else if (e.button === 2) {
        this.onRightClick();
      }
    });
    canvas.addEventListener('pointerleave', () => {
      this.hasPointer = false;
    });
  }

  private updatePointer(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.hasPointer = true;
  }

  /** A ray from the camera through the cursor, for picking things in the scene. */
  ray(): THREE.Raycaster | null {
    if (!this.hasPointer) return null;
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
    return this.raycaster;
  }

  /** Lane x under the cursor (ray onto the ground plane). */
  laneX(): number | null {
    if (!this.hasPointer) return null;
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
    const p = this.raycaster.ray.intersectPlane(this.plane, this.hit);
    return p ? p.x : null;
  }

  /** Continuous camera movement from held keys and screen edges. */
  update(dt: number): void {
    let dir = 0;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) dir -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) dir += 1;
    if (this.edgeScroll && this.hasPointer && !this.dragging) {
      if (this.ndc.x < -0.965) dir -= 1;
      else if (this.ndc.x > 0.965) dir += 1;
    }
    if (dir !== 0) this.rig.pan(dir * dt * (20 + this.rig.distance * 0.6));
  }
}
