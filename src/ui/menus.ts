import { AGES } from '../sim/data/ages';
import { doctrine } from '../sim/data/doctrines';
import { DIFFICULTIES, PROJECT_TIME } from '../sim/config';
import type { Difficulty, SideId } from '../sim/types';
import type { World } from '../sim/world';
import type { Portraits } from '../render/portraits';
import type { QualityLevel } from '../render/renderer';
import { icon } from './icons';

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  quality: QualityLevel;
  /** Until the player picks a quality, the game may lower it on slow machines. */
  qualityAuto: boolean;
  edgeScroll: boolean;
}

export interface MenuActions {
  play(d: Difficulty): void;
  resume(): void;
  quit(): void;
  restart(): void;
  chooseDoctrine(id: string): void;
  settingsChanged(s: Settings): void;
  click(): void;
}

const DIFF_COLORS: Record<Difficulty, string> = {
  recruit: '#7ee08a',
  veteran: '#56c2e6',
  general: '#f0a04b',
  impossible: '#ff5a4a',
};

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmt = (n: number): string => Math.floor(n).toLocaleString('en-US');

function store<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode); settings just won't persist.
  }
}

export function loadSettings(): Settings {
  return store<Settings>('epochwar.settings', { master: 0.8, sfx: 0.8, music: 0.45, quality: 'high', qualityAuto: true, edgeScroll: true });
}

type Records = Partial<Record<Difficulty, { wins: number; best: number }>>;

export class Menus {
  private readonly root: HTMLElement;
  private readonly screens = new Map<string, HTMLElement>();
  private settings: Settings;
  private back: () => void = () => {};
  private records: Records;

  constructor(
    container: HTMLElement,
    private readonly portraits: Portraits,
    private readonly actions: MenuActions,
  ) {
    this.root = container;
    this.settings = loadSettings();
    this.records = store<Records>('epochwar.records', {});
    for (const name of ['loading', 'main', 'difficulty', 'howto', 'settings', 'pause', 'draft', 'result']) {
      const s = document.createElement('div');
      s.className = name === 'loading' ? 'loading' : 'screen';
      s.dataset.screen = name;
      this.root.appendChild(s);
      this.screens.set(name, s);
    }
    this.screens.get('loading')!.innerHTML = `<div class="l"><b>EPOCH WAR</b><span>Forging seven ages…</span><div class="bar"><div></div></div></div>`;
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.actions.click();
    });
  }

  get current(): Settings {
    return this.settings;
  }

  loaded(): void {
    this.screens.get('loading')!.classList.add('done');
  }

  hideAll(): void {
    for (const [name, s] of this.screens) if (name !== 'loading') s.classList.remove('show', 'dim', 'soft');
  }

  private show(name: string, html: string, style: 'dim' | 'soft'): HTMLElement {
    this.hideAll();
    const s = this.screens.get(name)!;
    s.innerHTML = html;
    s.classList.add('show', style);
    return s;
  }

  isOpen(name: string): boolean {
    return this.screens.get(name)!.classList.contains('show');
  }

  // ─── Main ─────────────────────────────────────────────────────────────────

  showMain(): void {
    const strip = AGES.map((a) => `<i style="background:${a.accent}"></i>`).join('');
    const s = this.show(
      'main',
      `<div class="menu">
        <h1 class="logo">EPOCH<br>WAR<small>From the first club to the last algorithm</small></h1>
        <div class="ages-strip">${strip}</div>
        <button class="mbtn primary" data-go="new">${icon('sword')} New war <small>7 ages · 32 units</small></button>
        <button class="mbtn" data-go="howto">${icon('book')} How to play</button>
        <button class="mbtn" data-go="settings">${icon('gear')} Settings</button>
        <div class="foot">A 3D reimagining of the Flash classics <i>Age of War</i> 1 &amp; 2 — evolve from the Stone Age to the Age of Intelligence, draft doctrines, fight in the air, and race for the Singularity.</div>
      </div>`,
      'soft',
    );
    s.querySelector('[data-go="new"]')!.addEventListener('click', () => this.showDifficulty());
    s.querySelector('[data-go="howto"]')!.addEventListener('click', () => this.showHowTo(() => this.showMain()));
    s.querySelector('[data-go="settings"]')!.addEventListener('click', () => this.showSettings(() => this.showMain()));
  }

  showDifficulty(): void {
    const cards = (Object.keys(DIFFICULTIES) as Difficulty[])
      .map((d) => {
        const def = DIFFICULTIES[d];
        const rec = this.records[d];
        const mult = def.power === 1 ? 'Standard enemy' : `Enemy troops ×${def.power}`;
        return `<button class="diff" data-d="${d}" style="--dcolor:${DIFF_COLORS[d]}">
          <span class="dn">${def.name}</span>
          <span class="db">${def.blurb}</span>
          <span class="dm">${mult} · ${def.adaptive ? 'adaptive AI' : 'predictable AI'}</span>
          ${rec ? `<span class="best">${rec.wins} win${rec.wins === 1 ? '' : 's'} · best ${clock(rec.best)}</span>` : '<span class="best" style="color:var(--faint)">Not yet conquered</span>'}
        </button>`;
      })
      .join('');
    const s = this.show(
      'difficulty',
      `<div class="sheet glass">
        <div class="sheet-head"><div><h2>Choose your opponent</h2><p class="lead">You command the blue wall on the left. The enemy starts in the Stone Age, just like you.</p></div>
        <button class="iconbtn" data-back>${icon('back')} Back</button></div>
        <div class="diff-grid">${cards}</div>
      </div>`,
      'dim',
    );
    s.querySelector('[data-back]')!.addEventListener('click', () => this.showMain());
    s.querySelectorAll<HTMLElement>('[data-d]').forEach((b) => b.addEventListener('click', () => this.actions.play(b.dataset.d as Difficulty)));
  }

  showHowTo(back: () => void): void {
    this.back = back;
    const s = this.show(
      'howto',
      `<div class="sheet glass">
        <div class="sheet-head"><div><h2>How to play</h2><p class="lead">Destroy the enemy wall before it destroys yours.</p></div>
        <button class="iconbtn" data-back>${icon('back')} Back</button></div>
        <div class="howto">
          <div><h3>Train</h3><p>Spend gold on units. They march down the lane and fight whatever they meet. Kills earn gold and experience. Each age's heavy unit needs a one-time building (click its locked card).</p></div>
          <div><h3>Counters</h3><p>Infantry beats ranged, heavies trample infantry, anti-armour melts heavies. From the Industrial Age aircraft fly over the melee — only ranged units, anti-air and turrets can hit them.</p></div>
          <div><h3>Evolve</h3><p>Fill the experience bar and press <kbd>E</kbd> to advance an age: new units, turrets, a special and a tougher wall. Each evolution lets you draft one of three <b>doctrines</b>.</p></div>
          <div><h3>Defend</h3><p>Your tower starts with one free ledge: click <b>+ Build turret</b> in the Turrets panel (or press <kbd>T</kbd>, or click the glowing + on your tower) to mount a turret. Add up to three more ledges. Old turrets keep working, but sell and replace them in time.</p></div>
          <div><h3>Specials</h3><p>Every age has a special on a cooldown — meteors, thunderbolts, bombers, drone swarms, and finally <b>Override</b>, which hacks enemy units to your side.</p></div>
          <div><h3>Veterans &amp; stance</h3><p>Units that survive kills rank up (gold pips over their health bar). Switch to <b>Hold the line</b> to pull your army back under your turrets while you build a push.</p></div>
          <div><h3>The adaptive enemy</h3><p>On Veteran and above, the enemy reads your army and counter-builds. Watch the intel feed on the right.</p></div>
          <div><h3>The Singularity</h3><p>In the Age of Intelligence you can pour ${fmt(60000)} gold into the Singularity Project. Survive ${PROJECT_TIME} seconds and you win — damage to your wall sets it back.</p></div>
        </div>
        <h3 style="margin:22px 0 10px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)">Controls</h3>
        <div class="keys">
          <kbd>1</kbd><span>–<kbd>6</kbd> train units · right-click a card to cancel</span>
          <kbd>Space</kbd><span>special (then click to aim) · <kbd>T</kbd> turrets · <kbd>E</kbd> evolve · <kbd>H</kbd> stance · <kbd>U</kbd> armory · <kbd>X</kbd> Singularity</span>
          <kbd>A</kbd><span><kbd>D</kbd> / arrows / screen edges / drag scroll · mouse wheel zooms · click the minimap to jump</span>
          <kbd>P</kbd><span>pause · <kbd>F</kbd> game speed · <kbd>M</kbd> mute</span>
        </div>
      </div>`,
      'dim',
    );
    s.querySelector('[data-back]')!.addEventListener('click', () => this.back());
  }

  showSettings(back: () => void): void {
    this.back = back;
    const st = this.settings;
    const slider = (key: 'master' | 'sfx' | 'music', label: string): string =>
      `<label class="setting"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${st[key]}" data-k="${key}"><output>${Math.round(st[key] * 100)}%</output></label>`;
    const s = this.show(
      'settings',
      `<div class="sheet glass" style="width:min(640px,92vw)">
        <div class="sheet-head"><div><h2>Settings</h2><p class="lead">Saved in this browser.</p></div>
        <button class="iconbtn" data-back>${icon('back')} Back</button></div>
        <div class="settings">
          ${slider('master', 'Master volume')}
          ${slider('sfx', 'Effects')}
          ${slider('music', 'Music')}
          <div class="setting"><span>Graphics</span><div class="seg" data-q>
            ${(['low', 'medium', 'high'] as QualityLevel[]).map((q) => `<button data-v="${q}" class="${st.quality === q ? 'on' : ''}">${q[0]!.toUpperCase()}${q.slice(1)}</button>`).join('')}
          </div><span></span></div>
          <label class="setting"><span>Edge scrolling</span><input type="checkbox" data-edge ${st.edgeScroll ? 'checked' : ''} style="justify-self:start;width:18px;height:18px;accent-color:var(--accent)"><span></span></label>
        </div>
      </div>`,
      'dim',
    );
    s.querySelector('[data-back]')!.addEventListener('click', () => this.back());
    s.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) =>
      input.addEventListener('input', () => {
        const k = input.dataset.k as 'master' | 'sfx' | 'music';
        this.settings[k] = Number(input.value);
        input.nextElementSibling!.textContent = `${Math.round(this.settings[k] * 100)}%`;
        this.commit();
      }),
    );
    s.querySelectorAll<HTMLButtonElement>('[data-q] button').forEach((b) =>
      b.addEventListener('click', () => {
        this.settings.quality = b.dataset.v as QualityLevel;
        this.settings.qualityAuto = false;
        s.querySelectorAll('[data-q] button').forEach((x) => x.classList.toggle('on', x === b));
        this.commit();
      }),
    );
    s.querySelector<HTMLInputElement>('[data-edge]')!.addEventListener('change', (e) => {
      this.settings.edgeScroll = (e.target as HTMLInputElement).checked;
      this.commit();
    });
  }

  /** Persist a quality the game chose on its own (still marked automatic). */
  autoQuality(q: QualityLevel): void {
    this.settings.quality = q;
    this.commit();
  }

  private commit(): void {
    save('epochwar.settings', this.settings);
    this.actions.settingsChanged(this.settings);
  }

  // ─── In game ──────────────────────────────────────────────────────────────

  showPause(): void {
    const s = this.show(
      'pause',
      `<div class="menu" style="margin:0;width:min(380px,90vw)">
        <h1 class="logo" style="font-size:54px">PAUSED</h1>
        <div style="height:14px"></div>
        <button class="mbtn primary" data-go="resume">${icon('play')} Resume</button>
        <button class="mbtn" data-go="howto">${icon('book')} How to play</button>
        <button class="mbtn" data-go="settings">${icon('gear')} Settings</button>
        <button class="mbtn" data-go="restart">${icon('recycle')} Restart war</button>
        <button class="mbtn" data-go="quit">${icon('flag')} Surrender &amp; quit</button>
      </div>`,
      'dim',
    );
    s.querySelector('[data-go="resume"]')!.addEventListener('click', () => this.actions.resume());
    s.querySelector('[data-go="howto"]')!.addEventListener('click', () => this.showHowTo(() => this.showPause()));
    s.querySelector('[data-go="settings"]')!.addEventListener('click', () => this.showSettings(() => this.showPause()));
    s.querySelector('[data-go="restart"]')!.addEventListener('click', () => this.actions.restart());
    s.querySelector('[data-go="quit"]')!.addEventListener('click', () => this.actions.quit());
  }

  showDraft(world: World, side: SideId): void {
    const s0 = world.sides[side];
    const age = AGES[s0.age]!;
    const draft = s0.draft ?? [];
    const units = age.units
      .map((u) => `<figure><img src="${this.portraits.unit(u, 0)}" alt=""><figcaption>${u.name}</figcaption></figure>`)
      .join('');
    const docs = draft
      .map((id, i) => {
        const d = doctrine(id);
        return `<button class="doc" data-id="${id}"><div class="dicon">${icon(d.icon)}</div><div class="dname">${d.name}</div><div class="ddesc">${d.desc}</div><div class="dkey">Press ${i + 1}</div></button>`;
      })
      .join('');
    const s = this.show(
      'draft',
      `<div class="draft">
        <div class="over">Your people have entered</div>
        <h2>${age.name}</h2>
        <div class="tag">${age.tagline}</div>
        <div class="newunits">${units}</div>
        <div class="choose">Draft a doctrine</div>
        <div class="doc-grid">${docs}</div>
      </div>`,
      'dim',
    );
    s.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => this.actions.chooseDoctrine(b.dataset.id!)));
  }

  /** Doctrine choice by number key while the draft is open. */
  draftKey(world: World, n: number): void {
    const id = world.sides[0].draft?.[n];
    if (id) this.actions.chooseDoctrine(id);
  }

  showResult(world: World, winner: SideId, reason: 'wall' | 'singularity' | 'surrender', difficulty: Difficulty): void {
    const won = winner === 0;
    const me = world.sides[0];
    const foe = world.sides[1];
    if (won) {
      const rec = this.records[difficulty] ?? { wins: 0, best: Infinity };
      rec.wins++;
      rec.best = Math.min(rec.best, world.time);
      this.records[difficulty] = rec;
      save('epochwar.records', this.records);
    }
    const why =
      reason === 'singularity'
        ? won
          ? 'Your Singularity Project came online. The war ended in a single thought.'
          : 'The enemy transcended. Nothing you built can compete with what it has become.'
        : reason === 'surrender'
          ? 'You laid down your arms.'
          : won
            ? `The enemy wall fell in the ${AGES[foe.age]!.name}.`
            : `Your wall fell in the ${AGES[me.age]!.name}.`;
    const timeline = AGES.map((a, i) => {
      const t = me.stats.ageTimes[i];
      return `<div><i style="background:${t !== undefined ? a.accent : 'rgba(255,255,255,0.08)'}"></i>${t !== undefined ? clock(t) : '—'}</div>`;
    }).join('');
    const stat = (v: string, l: string): string => `<div class="stat"><div class="sv">${v}</div><div class="sl">${l}</div></div>`;
    const s = this.show(
      'result',
      `<div class="result glass ${won ? 'win' : 'lose'}">
        <div class="big">${won ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="reason">${why}</div>
        <div class="xp-line" style="margin-bottom:6px"><span>Your ages</span><span>${DIFFICULTIES[difficulty].name}</span></div>
        <div class="timeline">${timeline}</div>
        <div class="result-stats">
          ${stat(clock(world.time), 'Duration')}
          ${stat(fmt(me.stats.kills), 'Enemies slain')}
          ${stat(fmt(me.stats.trained), 'Units trained')}
          ${stat(fmt(me.stats.goldEarned), 'Gold plundered')}
          ${stat(fmt(me.stats.specialsCast), 'Specials cast')}
          ${stat(`${me.stats.lost} / ${foe.stats.lost}`, 'Losses (you / enemy)')}
        </div>
        <div class="row-btns">
          <button class="mbtn primary" data-go="again">${icon('recycle')} Play again</button>
          <button class="mbtn" data-go="menu">${icon('back')} Main menu</button>
        </div>
      </div>`,
      'dim',
    );
    s.querySelector('[data-go="again"]')!.addEventListener('click', () => this.actions.restart());
    s.querySelector('[data-go="menu"]')!.addEventListener('click', () => this.actions.quit());
  }
}
