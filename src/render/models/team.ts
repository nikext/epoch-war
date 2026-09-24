import { RigBuilder } from '../kit/builder';
import { staticMaterial } from '../kit/materials';
import type { ModelMeta, ModelTemplate } from './rig';

/** Faction colours. Blue is always the player; red is always the enemy. */
export interface Team {
  id: 0 | 1;
  main: string;
  dark: string;
  light: string;
  /** Emissive accent: visors, lights, energy weapons. */
  glow: string;
}

export const TEAMS: [Team, Team] = [
  { id: 0, main: '#2f72da', dark: '#1c3f7c', light: '#9cc8ff', glow: '#48c8ff' },
  { id: 1, main: '#d63b33', dark: '#7c1d1b', light: '#ffa08c', glow: '#ff5040' },
];

/** Things that fly carry no ground shadow in their colours. */
const AIRBORNE = new Set(['flyer', 'swarm', 'hover']);

export function finish(rig: RigBuilder, meta: Partial<ModelMeta> & Pick<ModelMeta, 'kind' | 'style'>): ModelTemplate {
  const grounded = !AIRBORNE.has(meta.kind);
  return {
    object: rig.build(staticMaterial, true, grounded ? { ground: 0.3, groundHeight: 0.9 } : {}),
    meta: { hand: 'near', height: 2.1, strideLength: 1.5, ...meta },
  };
}
