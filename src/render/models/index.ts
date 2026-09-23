import type { ModelTemplate } from './rig';
import { TEAMS, type Team } from './team';
import * as S from './soldiers';
import * as B from './beasts';
import * as M from './machines';

/** Unit model keys (UnitDef.model) → builders. */
const UNIT_MODELS: Record<string, (t: Team) => ModelTemplate> = {
  clubber: S.clubber,
  slinger: S.slinger,
  spearHunter: S.spearHunter,
  trikeRider: B.trikeRider,
  hoplite: S.hoplite,
  archer: S.archer,
  sunPriest: S.sunPriest,
  warElephant: B.warElephant,
  manAtArms: S.manAtArms,
  crossbowman: S.crossbowman,
  pikeman: S.pikeman,
  knight: B.knight,
  duelist: S.duelist,
  musketeer: S.musketeer,
  fieldCannon: M.fieldCannon,
  cuirassier: B.cuirassier,
  trenchRaider: S.trenchRaider,
  machineGunner: S.machineGunner,
  flametrooper: S.flametrooper,
  landship: M.landship,
  biplane: M.biplane,
  assaultTrooper: S.assaultTrooper,
  marksman: S.marksman,
  rocketTrooper: S.rocketTrooper,
  battleTank: M.battleTank,
  gunship: M.gunship,
  roboHound: M.roboHound,
  android: S.android,
  railgunner: S.railgunner,
  wardenMech: M.wardenMech,
  swarm: M.swarm,
  omega: M.omega,
};

const cache = new Map<string, ModelTemplate>();

/** The template for a unit model in a team's colours, built once and cached. */
export function unitTemplate(model: string, side: 0 | 1): ModelTemplate {
  const key = `${model}:${side}`;
  let t = cache.get(key);
  if (!t) {
    const build = UNIT_MODELS[model];
    if (!build) throw new Error(`no model for ${model}`);
    t = build(TEAMS[side]);
    cache.set(key, t);
  }
  return t;
}

export function hasUnitModel(model: string): boolean {
  return model in UNIT_MODELS;
}
