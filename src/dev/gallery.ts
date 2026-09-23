import * as THREE from 'three';
import { AGES } from '../sim/data/ages';
import { Renderer, qualityPreset } from '../render/renderer';
import { ModelInstance } from '../render/models/rig';
import { unitTemplate } from '../render/models';

/**
 * Dev-only model gallery (`?gallery=<age>`): every unit of an age, both
 * teams, cycling walk → attack → idle so models and animations can be
 * checked without a battle. `&die` plays the death animation instead.
 */
export function runGallery(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  const age = Number(params.get('gallery') || 0);
  const r = new Renderer(canvas, qualityPreset('high'));
  r.setPlayerAge(age, true);
  r.setSideAge(0, age, true);
  r.setSideAge(1, age, true);
  r.resize();
  window.addEventListener('resize', () => r.resize());

  const units = AGES[age]!.units;
  const views: { inst: ModelInstance; def: (typeof units)[number]; side: 0 | 1 }[] = [];
  const spacing = Number(params.get('spacing') || 5.5);
  units.forEach((def, i) => {
    for (const side of [0, 1] as const) {
      const inst = new ModelInstance(unitTemplate(def.model, side));
      const x = 30 + i * spacing + (side === 1 ? 2.2 : 0);
      inst.root.position.set(x, def.layer === 'air' ? 5 : 0, side === 0 ? 1.4 : -1.6);
      if (side === 1) inst.root.scale.x = -1;
      r.scene.add(inst.root);
      views.push({ inst, def, side });
    }
  });

  const focus = 30 + ((units.length - 1) * spacing) / 2 + 1;
  r.rig.jump(Number(params.get('x') || focus));
  r.rig.targetDistance = Number(params.get('dist') || 24 + units.length * 2.5);
  r.rig.snap();

  const phase = params.get('phase');
  const die = params.has('die');
  let last = performance.now();
  const start = last;
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    const cycle = t % 7;
    const mode = phase ?? (cycle < 2.5 ? 'walk' : cycle < 6 ? 'attack' : 'idle');
    for (const v of views) {
      const d = v.def;
      const attackT = mode === 'attack' ? t % d.interval : 99;
      v.inst.animate({
        t,
        dt,
        stride: mode === 'walk' ? t * d.speed : 0,
        moving: mode === 'walk',
        attackT,
        windup: d.windup,
        interval: d.interval,
        deadT: die ? t % 3 : -1,
        stunned: false,
        aim: 0,
        seed: (v.side * 7 + d.cost) % 1,
      });
    }
    r.render(dt, t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  (window as unknown as { __ready: boolean }).__ready = true;
  void THREE;
}
