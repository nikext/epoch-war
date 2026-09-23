/**
 * The look of each age. The sky and light follow the player's age — the
 * world visibly moves from a Stone Age dawn to a neon night in the Age of
 * Intelligence — while each half of the battlefield wears its own side's age.
 */

export type AmbientKind = 'embers' | 'dust' | 'leaves' | 'pollen' | 'ash' | 'fireflies' | 'motes';

export interface Theme {
  sky: {
    top: string;
    horizon: string;
    bottom: string;
    sunDir: [number, number, number];
    sunColor: string;
    sunSize: number;
    stars: number;
    aurora: number;
    clouds: number;
    cloudColor: string;
  };
  sun: { color: string; intensity: number };
  hemi: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
  ground: {
    grassA: string;
    grassB: string;
    dirt: string;
    road: string;
    roadEdge: string;
    cliffTop: string;
    cliffMid: string;
    cliffLow: string;
  };
  hills: [string, string, string];
  exposure: number;
  bloom: number;
  env: number;
  ambient: { kind: AmbientKind; color: string; count: number };
  /** Emissive lane markings (only the Age of Intelligence). */
  laneGlow: number;
  /** Brightness of smoke and dust in this light. */
  smokeLight: number;
}

export const THEMES: Theme[] = [
  // 0 · Stone — warm dawn over a green, untouched valley.
  {
    sky: {
      top: '#4d7cc6', horizon: '#f7b98a', bottom: '#f0d2a8', sunDir: [0.55, 0.22, -0.8], sunColor: '#ffd9a8', sunSize: 1.3,
      stars: 0, aurora: 0, clouds: 0.55, cloudColor: '#ffe6d0',
    },
    sun: { color: '#ffd8aa', intensity: 2.9 },
    hemi: { sky: '#bcd4ff', ground: '#6a5a3a', intensity: 0.75 },
    fog: { color: '#e8c7a4', density: 0.0026 },
    ground: {
      grassA: '#7fa85a', grassB: '#5f8f44', dirt: '#8b6d48', road: '#a88b60', roadEdge: '#8a7048',
      cliffTop: '#6b5238', cliffMid: '#8a6a47', cliffLow: '#5d4631',
    },
    hills: ['#7ea070', '#6b8c78', '#8aa0b4'],
    exposure: 1.0,
    bloom: 0.45,
    env: 0.30,
    ambient: { kind: 'embers', color: '#ffb266', count: 60 },
    laneGlow: 0,
    smokeLight: 1.0,
  },
  // 1 · Ancient — bright Mediterranean noon, dry grass and sand.
  {
    sky: {
      top: '#2d7de2', horizon: '#c7e6ff', bottom: '#e8f2fa', sunDir: [0.3, 0.75, -0.55], sunColor: '#fff6de', sunSize: 1.0,
      stars: 0, aurora: 0, clouds: 0.35, cloudColor: '#ffffff',
    },
    sun: { color: '#fff3dc', intensity: 2.7 },
    hemi: { sky: '#cfe6ff', ground: '#9b8250', intensity: 0.79 },
    fog: { color: '#d8ebfb', density: 0.0021 },
    ground: {
      grassA: '#b7b261', grassB: '#9aa04c', dirt: '#c7a672', road: '#dcc28f', roadEdge: '#c4a473',
      cliffTop: '#b08c5c', cliffMid: '#cfae7c', cliffLow: '#9c7b52',
    },
    hills: ['#b8ad7a', '#a4a88f', '#a7bccf'],
    exposure: 0.88,
    bloom: 0.4,
    env: 0.39,
    ambient: { kind: 'dust', color: '#fff2cc', count: 50 },
    laneGlow: 0,
    smokeLight: 1.05,
  },
  // 2 · Medieval — lush green hills under a soft sky.
  {
    sky: {
      top: '#5b87c2', horizon: '#dfe7ee', bottom: '#e9eef2', sunDir: [0.5, 0.55, -0.65], sunColor: '#fff1d8', sunSize: 1.0,
      stars: 0, aurora: 0, clouds: 0.75, cloudColor: '#f4f6f8',
    },
    sun: { color: '#fff0da', intensity: 2.8 },
    hemi: { sky: '#d2e0f0', ground: '#4d5b34', intensity: 0.75 },
    fog: { color: '#cfdbe3', density: 0.0025 },
    ground: {
      grassA: '#5fa047', grassB: '#46863a', dirt: '#6f5a40', road: '#8f7757', roadEdge: '#76603f',
      cliffTop: '#5a4632', cliffMid: '#7b6247', cliffLow: '#4c3b2b',
    },
    hills: ['#4f8a4b', '#5b7d66', '#8ea3b6'],
    exposure: 1.0,
    bloom: 0.4,
    env: 0.33,
    ambient: { kind: 'leaves', color: '#c9a44a', count: 40 },
    laneGlow: 0,
    smokeLight: 0.95,
  },
  // 3 · Gunpowder — golden late afternoon.
  {
    sky: {
      top: '#476fb0', horizon: '#ffd39a', bottom: '#f6dfb8', sunDir: [0.7, 0.28, -0.6], sunColor: '#ffcf8a', sunSize: 1.4,
      stars: 0, aurora: 0, clouds: 0.5, cloudColor: '#ffe3c0',
    },
    sun: { color: '#ffd092', intensity: 3.0 },
    hemi: { sky: '#bcd0f0', ground: '#6b5a36', intensity: 0.71 },
    fog: { color: '#f0d0a4', density: 0.0025 },
    ground: {
      grassA: '#8ea74f', grassB: '#728d40', dirt: '#8d7148', road: '#a88d61', roadEdge: '#8e734c',
      cliffTop: '#6e5537', cliffMid: '#93744c', cliffLow: '#5a4430',
    },
    hills: ['#8b9a5a', '#7d8a72', '#a8a8b8'],
    exposure: 1.0,
    bloom: 0.45,
    env: 0.33,
    ambient: { kind: 'pollen', color: '#fff0b0', count: 45 },
    laneGlow: 0,
    smokeLight: 0.95,
  },
  // 4 · Industrial — smog, mud and a sepia sun.
  {
    sky: {
      top: '#65696e', horizon: '#cbb593', bottom: '#b9a88b', sunDir: [0.4, 0.4, -0.8], sunColor: '#ffe0b0', sunSize: 1.8,
      stars: 0, aurora: 0, clouds: 0.95, cloudColor: '#a59d91',
    },
    sun: { color: '#ffe2bb', intensity: 2.3 },
    hemi: { sky: '#b3aea4', ground: '#4a3e2e', intensity: 0.83 },
    fog: { color: '#a89c86', density: 0.0037 },
    ground: {
      grassA: '#6f7248', grassB: '#595c3c', dirt: '#5a4934', road: '#6b5840', roadEdge: '#4f412f',
      cliffTop: '#4c3d2d', cliffMid: '#6a5540', cliffLow: '#3e3226',
    },
    hills: ['#6e6a58', '#78746a', '#9b968c'],
    exposure: 1.0,
    bloom: 0.5,
    env: 0.28,
    ambient: { kind: 'ash', color: '#d8d2c8', count: 90 },
    laneGlow: 0,
    smokeLight: 0.8,
  },
  // 5 · Modern — blue hour, city lights coming on.
  {
    sky: {
      top: '#1d3264', horizon: '#f39162', bottom: '#b86d6a', sunDir: [0.75, 0.1, -0.65], sunColor: '#ffab72', sunSize: 1.6,
      stars: 0.25, aurora: 0, clouds: 0.4, cloudColor: '#e59a86',
    },
    sun: { color: '#ffb582', intensity: 2.4 },
    hemi: { sky: '#8aa0d8', ground: '#3a3530', intensity: 0.79 },
    fog: { color: '#8f7f9c', density: 0.0028 },
    ground: {
      grassA: '#5c7c4a', grassB: '#4a6a3c', dirt: '#5f5647', road: '#44474d', roadEdge: '#9a9a8c',
      cliffTop: '#4a4238', cliffMid: '#645a4c', cliffLow: '#3a332b',
    },
    hills: ['#4f5c5c', '#5b5f74', '#7a7494'],
    exposure: 1.0,
    bloom: 0.6,
    env: 0.36,
    ambient: { kind: 'fireflies', color: '#ffe6a0', count: 40 },
    laneGlow: 0,
    smokeLight: 0.62,
  },
  // 6 · Intelligence — a neon night; the land itself is circuitry.
  {
    sky: {
      top: '#05051a', horizon: '#3b1f72', bottom: '#1a1236', sunDir: [0.4, 0.35, -0.85], sunColor: '#c9bcff', sunSize: 1.1,
      stars: 1, aurora: 1, clouds: 0.2, cloudColor: '#3b2d6b',
    },
    sun: { color: '#b9b0ff', intensity: 1.25 },
    hemi: { sky: '#6a5bd6', ground: '#1a1030', intensity: 0.62 },
    fog: { color: '#1f1740', density: 0.0030 },
    ground: {
      grassA: '#2c3a58', grassB: '#232f4a', dirt: '#262b3d', road: '#171b27', roadEdge: '#3fd0ff',
      cliffTop: '#1e2233', cliffMid: '#2b3146', cliffLow: '#151827',
    },
    hills: ['#27305a', '#2f2c64', '#3d3478'],
    exposure: 0.95,
    bloom: 0.5,
    env: 0.44,
    ambient: { kind: 'motes', color: '#8f7bff', count: 110 },
    laneGlow: 1,
    smokeLight: 0.32,
  },
];
