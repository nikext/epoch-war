import type { Difficulty } from './types';

/**
 * Battlefield geometry and pacing. Lane coordinates run along x: the player's
 * wall stands at x = 0 facing +x, the enemy's at x = LANE facing −x.
 */
export const LANE = 100;

/** Simulation rate. The renderer interpolates between ticks. */
export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;

/** Where freshly trained units appear, measured from their own wall. */
export const SPAWN_OFFSET = 1.2;

/** Units on "hold" stop this far out from their own wall — inside turret cover. */
export const HOLD_LINE = 24;

/**
 * Troops walk in a loose column rather than single file: each unit gets a
 * stable lateral offset (metres, across the lane) from this list.
 */
export const FILE_Z = [0, 0.95, -0.95, 0.5, -0.5, 1.35, -1.35];

/** How much allies may overlap along the lane, given they walk in different files. */
export const SPACING = 0.72;

/** Queue length, as in Age of War 1. */
export const QUEUE_MAX = 5;

export const TURRET_SLOTS = 4;

/** Fraction of a turret's price returned on sale. */
export const TURRET_REFUND = 0.5;

export const START_GOLD = 220;

/** Gold for a kill, as a multiple of the victim's price (AoW1 paid cost + 30%). */
export const KILL_GOLD = 1.3;

/** XP for a kill, as a multiple of the victim's price. */
export const KILL_XP = 1.4;

/** XP for losing a unit: a small catch-up so a side being pushed back still evolves. */
export const LOSS_XP = 0.5;

/** XP per point of damage dealt to the enemy wall. */
export const BASE_DAMAGE_XP = 0.5;

/** Veterancy: rank thresholds in "valor" (sum of victim cost / own cost). */
export const RANK_VALOR = [1.6, 4, 8];
/** Per-rank bonus to damage and max HP. */
export const RANK_BONUS = 0.12;

/** Armory: levels per track, and the bonus each level gives. Level n costs the age's base price × n^1.5. */
export const UPGRADE_LEVELS = 8;
export const UPGRADE_STEP = { weapons: 0.06, armor: 0.06, economy: 0.1 } as const;

/**
 * The Singularity Project — the final age's win condition. A wonder in the
 * Civilization sense: pay for it, then survive the countdown. Every point of
 * damage the wall takes sets the countdown back, so the answer to an enemy
 * project is to storm its wall.
 */
export const PROJECT_COST = 60000;
export const PROJECT_TIME = 150;
/** Seconds of progress lost per 1% of wall HP lost. */
export const PROJECT_SETBACK = 2.25;

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  blurb: string;
  /** Enemy unit HP and damage multiplier (AoW1: Harder ×1.3, Impossible ×2). */
  power: number;
  /** Enemy income multiplier (passive and kill gold). */
  income: number;
  /** Seconds between enemy decisions. */
  think: number;
  /** Whether the enemy reads your army and counter-builds. */
  adaptive: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  recruit: {
    id: 'recruit',
    name: 'Recruit',
    blurb: 'A gentle opponent. Learn the ages.',
    power: 0.8,
    income: 0.85,
    think: 1.6,
    adaptive: false,
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    blurb: 'A fair fight. The enemy plays by your rules.',
    power: 1,
    income: 1,
    think: 1.0,
    adaptive: true,
  },
  general: {
    id: 'general',
    name: 'General',
    blurb: 'Tougher troops, sharper tactics. It counters what you build.',
    power: 1.25,
    income: 1.1,
    think: 0.6,
    adaptive: true,
  },
  impossible: {
    id: 'impossible',
    name: 'Impossible',
    blurb: 'Age of War veterans only. Enemy troops have double strength.',
    power: 1.6,
    income: 1.25,
    think: 0.4,
    adaptive: true,
  },
};
