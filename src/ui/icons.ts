/** A small hand-drawn SVG icon set (24×24, stroke-based, currentColor). */

const P: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h3.8a1.8 1.8 0 010 3.6h-2.6a1.8 1.8 0 000 3.6H14.5"/>',
  xp: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  pop: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.3c2.3.1 4.2 1.5 4.8 4.2"/>',
  sword: '<path d="M14.5 4.5L20 4l-.5 5.5-9 9-2.5-.5-.5-2.5z"/><path d="M5 15l4 4M4 20l2.5-2.5"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.5l3.5 2"/>',
  scope: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r="1.2"/>',
  boot: '<path d="M7 3.5h5v8.5l6.5 2.5c1.2.5 1.8 1.4 1.8 2.6V19H4.5v-3.5L7 13z"/><path d="M4.5 19h15.8"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  fast: '<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z"/>',
  flag: '<path d="M5 21V4M5 4.5c4-2 7 2 11 0v8c-4 2-7-2-11 0"/>',
  hold: '<path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5"/>',
  evolve: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
  bolt: '<path d="M13.5 2.5L5.5 13.5h5.5l-1.5 8 8-11h-5.5z"/>',
  hammer: '<path d="M13 4l7 7-2.5 2.5-7-7z"/><path d="M11.5 8.5L3.5 16.5l3 3 8-8"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  sell: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  tower: '<path d="M7 21V9L5 7V3.5h3v2h2.5v-2h3v2H16v-2h3V7l-2 2v12z"/><path d="M10.5 21v-4h3v4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  wall: '<path d="M3 20V8h3V5h4v3h4V5h4v3h3v12z"/><path d="M3 14h18M9 8v6M15 8v6M6 14v6M12 14v6M18 14v6"/>',
  star: '<path d="M12 3.5l2.4 5 5.5.6-4.1 3.8 1.1 5.4L12 15.6l-4.9 2.7 1.1-5.4-4.1-3.8 5.5-.6z"/>',
  recycle: '<path d="M8 6.5l2.5-3 2.5 3M10.5 3.5V10M18.5 13l1.5 3.5-3.5 1M20 16.5l-5.5-3M5.5 13L4 16.5l3.5 1M4 16.5l5.5-3"/>',
  book: '<path d="M4 5.5c3-1.3 5.5-1 8 .8 2.5-1.8 5-2.1 8-.8v13c-3-1.3-5.5-1-8 .8-2.5-1.8-5-2.1-8-.8zM12 6.3v13"/>',
  bank: '<path d="M3 9.5L12 4l9 5.5M4.5 20h15M6 11v7M10 11v7M14 11v7M18 11v7"/>',
  fist: '<path d="M7 11V7.5a1.5 1.5 0 013 0V10m0-3a1.5 1.5 0 013 0v3m0-2a1.5 1.5 0 013 0v2.5m0-1a1.5 1.5 0 013 0V14c0 4-2.5 6.5-6 6.5S7 18 7 14.5z"/>',
  radar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/>',
  chest: '<rect x="3.5" y="8" width="17" height="11.5" rx="1.5"/><path d="M3.5 12.5h17M5 8c0-2.5 2-4 4-4h6c2 0 4 1.5 4 4M11 11h2v3h-2z"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  brain: '<path d="M9 4.5a3 3 0 00-3 3 3 3 0 00-2 5.2A3.2 3.2 0 007 17.5a3 3 0 005 1.5V5.5a3 3 0 00-3-1z"/><path d="M15 4.5a3 3 0 013 3 3 3 0 012 5.2 3.2 3.2 0 01-3 4.8 3 3 0 01-5 1.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.5"/>',
};

export type IconName = keyof typeof P | string;

export function icon(name: IconName, cls = ''): string {
  const body = P[name] ?? P.info!;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
