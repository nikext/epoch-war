import { AGES, turretDef, unitDef } from '../sim/data/ages';
import { doctrine } from '../sim/data/doctrines';
import { CLASS_INFO } from '../sim/combat';
import { LANE, PROJECT_COST, PROJECT_TIME, QUEUE_MAX, TURRET_REFUND, UPGRADE_LEVELS, UPGRADE_STEP } from '../sim/config';
import type { SideState } from '../sim/entities';
import type { TurretDef, UnitDef, UpgradeTrack } from '../sim/types';
import type { World } from '../sim/world';
import type { Portraits } from '../render/portraits';
import { icon, ROMAN } from './icons';

export interface HudActions {
  train(index: number): void;
  unlock(id: string): void;
  cancel(index: number): void;
  special(): void;
  evolve(): void;
  stance(): void;
  buySlot(): void;
  buyTurret(slot: number, id: string): void;
  sellTurret(slot: number): void;
  upgrade(track: UpgradeTrack): void;
  project(): void;
  pause(): void;
  speed(): void;
  mute(): void;
  jump(x: number): void;
  hover(): void;
}

export interface HudView {
  camX: number;
  halfWidth: number;
  speed: number;
  paused: boolean;
  aiming: boolean;
  muted: boolean;
}

const fmt = (n: number): string => (n >= 100000 ? `${Math.round(n / 1000)}k` : n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.floor(n).toLocaleString('en-US'));
const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const el = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T => root.querySelector(sel) as T;

const UPGRADE_INFO: Record<UpgradeTrack, { name: string; icon: string; desc: (lvl: number) => string }> = {
  weapons: { name: 'Weapons', icon: 'sword', desc: (l) => `All units deal +${Math.round(l * UPGRADE_STEP.weapons * 100)}% damage` },
  armor: { name: 'Armour', icon: 'shield', desc: (l) => `All units have +${Math.round(l * UPGRADE_STEP.armor * 100)}% HP` },
  economy: { name: 'Economy', icon: 'coin', desc: (l) => `+${Math.round(l * UPGRADE_STEP.economy * 100)}% income and kill gold` },
};

export class Hud {
  readonly root: HTMLElement;
  private age = -1;
  private units: UnitDef[] = [];
  private cards: HTMLButtonElement[] = [];
  private readonly minimap: HTMLCanvasElement;
  private readonly mm: CanvasRenderingContext2D;
  private readonly cache = new Map<string, string>();
  private tooltipFor: (() => string) | null = null;
  private tipAnchor: HTMLElement | null = null;
  private popover: 'turret' | 'armory' | null = null;
  private popoverSlot = -1;
  private world: World | null = null;
  private lastDoctrines = ['', ''];
  /** CSS zoom applied to the HUD so it fits any window; screen positions are divided by it. */
  private zoom = 1;

  constructor(
    container: HTMLElement,
    private readonly portraits: Portraits,
    private readonly actions: HudActions,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = this.template();
    container.appendChild(this.root);
    this.minimap = el<HTMLCanvasElement>(this.root, '.minimap canvas');
    this.mm = this.minimap.getContext('2d')!;
    this.bind();
    this.fit();
    window.addEventListener('resize', () => this.fit());
  }

  /** Scale the whole HUD to the window: 1 at 1600×900, smaller on laptops, a little larger on big screens. */
  private fit(): void {
    const z = Math.max(0.58, Math.min(1.25, Math.min(window.innerWidth / 1600, window.innerHeight / 900)));
    this.zoom = z;
    this.root.style.setProperty('zoom', String(z));
  }

  private template(): string {
    return `
      <div class="topbar">
        <div class="sidebox player glass interactive">
          <div class="age-badge" data-age-badge="0">I</div>
          <div class="info">
            <div class="label"><span>Your wall</span><span class="agename" data-agename="0"></span></div>
            <div class="hpbar"><div class="ghost"></div><div class="fill"></div><div class="txt"></div></div>
            <div class="doctrine-row" data-docs="0"></div>
          </div>
        </div>
        <div class="centerbox glass interactive">
          <div class="minimap" title="Click to move the camera"><canvas width="600" height="68"></canvas></div>
          <div class="center-row">
            <span class="clock">0:00</span>
            <span class="status"></span>
            <div class="btn-group">
              <button class="iconbtn" data-act="mute" title="Mute (M)">${icon('sound')}</button>
              <button class="iconbtn" data-act="speed" title="Game speed (F)">${icon('fast')}<span>1×</span></button>
              <button class="iconbtn" data-act="pause" title="Pause (P / Esc)">${icon('pause')}</button>
            </div>
          </div>
        </div>
        <div class="sidebox enemy glass interactive">
          <div class="age-badge" data-age-badge="1">I</div>
          <div class="info">
            <div class="label"><span>Enemy wall</span><span class="agename" data-agename="1"></span></div>
            <div class="hpbar"><div class="ghost"></div><div class="fill"></div><div class="txt"></div></div>
            <div class="doctrine-row" data-docs="1"></div>
          </div>
        </div>
      </div>

      <div class="resources glass">
        <div class="res-row">
          <div class="res gold">${icon('coin')}<b data-gold>0</b><small data-income></small></div>
          <div class="res pop" style="margin-left:auto" title="Army size / population cap">${icon('pop')}<b data-pop>0/0</b></div>
        </div>
        <div class="xp-line"><span>Experience</span><span data-xptext></span></div>
        <div class="xpbar"><div class="fill" data-xpfill></div></div>
      </div>

      <div class="project glass"><div class="title"></div><div class="bar"><div></div></div><div class="sub"></div></div>
      <div class="intel"></div>

      <div class="deck">
        <div class="panel glass interactive">
          <div class="panel-title"><span>Train</span><b data-agelabel></b></div>
          <div class="cards"></div>
          <div class="queue"></div>
        </div>
        <div class="panel glass interactive">
          <div class="panel-title"><span>Turrets</span><b>T</b></div>
          <div class="slots"></div>
        </div>
        <div class="panel glass interactive">
          <div class="panel-title"><span>Command</span></div>
          <div class="commands">
            <button class="bigbtn special" data-act="special"><div class="cd"></div><span class="t">${icon('bolt')} Special<span class="k">SPC</span></span><span class="v" data-special></span></button>
            <button class="bigbtn evolve" data-act="evolve"><span class="t">${icon('evolve')} Evolve<span class="k">E</span></span><span class="v" data-evolve></span><div class="ring"></div></button>
            <button class="bigbtn stance" data-act="stance"><span class="t">${icon('flag')} Stance<span class="k">H</span></span><span class="v" data-stance></span></button>
            <button class="bigbtn armory" data-act="armory"><span class="t">${icon('hammer')} Armory<span class="k">U</span></span><span class="v" data-armory></span></button>
            <button class="bigbtn project hidden" data-act="project"><span class="t">${icon('brain')} Singularity Project<span class="k">X</span></span><span class="v" data-project></span></button>
          </div>
        </div>
      </div>

      <div class="tooltip glass"></div>
      <div class="popover glass interactive"></div>
      <div class="floaters"></div>
      <div class="banner"><div class="over"></div><div class="title"></div><div class="tag"></div></div>
      <div class="aimhint glass">${icon('crosshair')} Click the battlefield to strike · right-click or Esc to cancel</div>
    `;
  }

  private bind(): void {
    this.root.addEventListener('pointerdown', () => this.hideTip());
    this.root.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) return;
      const act = target.dataset.act!;
      switch (act) {
        case 'special':
          this.actions.special();
          break;
        case 'evolve':
          this.actions.evolve();
          break;
        case 'stance':
          this.actions.stance();
          break;
        case 'armory':
          this.togglePopover('armory');
          break;
        case 'project':
          this.actions.project();
          break;
        case 'pause':
          this.actions.pause();
          break;
        case 'speed':
          this.actions.speed();
          break;
        case 'mute':
          this.actions.mute();
          break;
        case 'close':
          this.closePopover();
          break;
        case 'upgrade':
          this.actions.upgrade(target.dataset.track as UpgradeTrack);
          break;
        case 'buyturret':
          this.actions.buyTurret(Number(target.dataset.slot), target.dataset.id!);
          this.closePopover();
          break;
        case 'sell':
          this.actions.sellTurret(Number(target.dataset.slot));
          this.closePopover();
          break;
      }
    });
    el(this.root, '.minimap').addEventListener('pointerdown', (e) => {
      const r = this.minimap.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      this.actions.jump(-16 + f * (LANE + 32));
    });
    // Tooltips follow the element under the pointer.
    this.root.addEventListener('pointerover', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (!t) return;
      this.showTip(t);
    });
    this.root.addEventListener('pointerout', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      const to = (e.relatedTarget as HTMLElement | null)?.closest('[data-tip]');
      if (t && t !== to) this.hideTip();
    });
  }

  show(visible: boolean): void {
    this.root.classList.toggle('visible', visible);
    if (!visible) {
      this.hideTip();
      this.closePopover();
    }
  }

  reset(world: World): void {
    this.world = world;
    this.age = -1;
    // A new war starts with no doctrines, which the cache above would read as "unchanged".
    this.lastDoctrines = ['', ''];
    this.root.querySelectorAll('.doctrine-row').forEach((row) => (row.innerHTML = ''));
    el(this.root, '.intel').innerHTML = '';
    el(this.root, '.floaters').innerHTML = '';
    this.closePopover();
  }

  // ─── Age-dependent content ────────────────────────────────────────────────

  private setAge(age: number): void {
    this.age = age;
    const def = AGES[age]!;
    document.documentElement.style.setProperty('--accent', def.accent);
    this.units = def.units;
    const cards = el(this.root, '.cards');
    cards.innerHTML = '';
    this.cards = def.units.map((u, i) => {
      const b = document.createElement('button');
      b.className = `card${u.cls === 'apex' ? ' apex' : ''}`;
      b.dataset.tip = `unit:${u.id}`;
      b.innerHTML = `
        <img alt="" src="${this.portraits.unit(u, 0)}">
        <span class="key">${i + 1}</span>
        <div class="foot"><div class="name">${u.name}</div><div class="cost">${icon('coin')}${fmt(u.cost)}</div></div>
        <div class="lock">${icon('lock')}<span>${u.unlockName ?? ''}</span><span class="price">${icon('coin')} ${fmt(u.unlockCost ?? 0)}</span></div>
        <div class="flash"></div>`;
      b.addEventListener('click', () => {
        const s = this.world?.sides[0];
        if (s && u.unlockCost && !s.unlocked.has(u.id)) this.actions.unlock(u.id);
        else this.actions.train(i);
      });
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const s = this.world?.sides[0];
        const idx = s ? s.queue.lastIndexOf(u.id) : -1;
        if (idx >= 0) this.actions.cancel(idx);
      });
      cards.appendChild(b);
      return b;
    });
    el(this.root, '[data-agelabel]').textContent = def.name;
    for (const t of def.turrets) this.portraits.turret(t, 0);
  }

  pulseCard(index: number): void {
    const c = this.cards[index];
    if (!c) return;
    c.classList.remove('pulse');
    void c.offsetWidth;
    c.classList.add('pulse');
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────

  private set(key: string, node: HTMLElement, value: string, html = false): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    if (html) node.innerHTML = value;
    else node.textContent = value;
  }

  update(world: World, view: HudView): void {
    this.world = world;
    const me = world.sides[0];
    const foe = world.sides[1];
    if (me.age !== this.age) this.setAge(me.age);

    // Walls.
    for (const s of [me, foe]) {
      const box = el(this.root, s.id === 0 ? '.sidebox.player' : '.sidebox.enemy');
      const f = Math.max(0, s.baseHp / s.baseMaxHp);
      el(box, '.hpbar .fill').style.transform = `scaleX(${f})`;
      el(box, '.hpbar .ghost').style.transform = `scaleX(${f})`;
      this.set(`hp${s.id}`, el(box, '.hpbar .txt'), `${fmt(s.baseHp)} / ${fmt(s.baseMaxHp)}`);
      const badge = el(box, '.age-badge');
      this.set(`badge${s.id}`, badge, ROMAN[s.age]!);
      badge.style.setProperty('--badge', AGES[s.age]!.accent);
      this.set(`agename${s.id}`, el(box, '.agename'), AGES[s.age]!.name);
      const docs = s.doctrines.join(',');
      if (docs !== this.lastDoctrines[s.id]) {
        this.lastDoctrines[s.id] = docs;
        el(box, '.doctrine-row').innerHTML = s.doctrines
          .map((id) => {
            const d = doctrine(id);
            return `<span class="doc-chip" data-tip="doc:${id}">${icon(d.icon)}</span>`;
          })
          .join('');
      }
    }

    // Clock and controls.
    this.set('clock', el(this.root, '.clock'), clock(world.time));
    this.set('status', el(this.root, '.status'), view.paused ? 'PAUSED' : view.aiming ? 'AIMING' : '');
    this.set('speed', el(this.root, '[data-act="speed"] span'), `${view.speed}×`);
    el(this.root, '[data-act="speed"]').classList.toggle('on', view.speed > 1);
    this.set('pausebtn', el(this.root, '[data-act="pause"]'), icon(view.paused ? 'play' : 'pause'), true);
    this.set('mutebtn', el(this.root, '[data-act="mute"]'), icon(view.muted ? 'mute' : 'sound'), true);

    // Resources.
    const age = AGES[me.age]!;
    this.set('gold', el(this.root, '[data-gold]'), fmt(me.gold));
    const income = age.income * me.mods.income * world.econ(me);
    this.set('income', el(this.root, '[data-income]'), `+${income.toFixed(income < 10 ? 1 : 0)}/s`);
    const pop = world.popUsed(0) + world.popQueued(0);
    this.set('pop', el(this.root, '[data-pop]'), `${pop}/${world.popCap(0)}`);
    const next = age.xpToNext;
    const xpFill = next ? Math.min(1, me.xp / next) : 1;
    el(this.root, '[data-xpfill]').style.transform = `scaleX(${xpFill})`;
    el(this.root, '.xpbar').classList.toggle('ready', next !== null && me.xp >= next);
    this.set('xptext', el(this.root, '[data-xptext]'), next ? `${fmt(me.xp)} / ${fmt(next)}` : `${fmt(me.xp)} · final age`);

    this.updateCards(world, me, pop);
    this.updateQueue(me);
    this.updateSlots(world, me);
    this.updateCommands(world, me, view);
    this.updateProject(world);
    this.drawMinimap(world, view);
    if (this.popover) this.renderPopover();
    if (this.tooltipFor) {
      if (!this.tipAnchor?.isConnected) this.hideTip();
      else el(this.root, '.tooltip').innerHTML = this.tooltipFor();
    }
  }

  private updateCards(world: World, me: SideState, pop: number): void {
    const cap = world.popCap(0);
    this.units.forEach((u, i) => {
      const c = this.cards[i];
      if (!c) return;
      const locked = !!u.unlockCost && !me.unlocked.has(u.id);
      c.classList.toggle('locked', locked);
      c.classList.toggle('poor', locked ? me.gold < (u.unlockCost ?? 0) : me.gold < u.cost);
      c.classList.toggle('capped', !locked && pop + u.pop > cap);
    });
  }

  private updateQueue(me: SideState): void {
    const q = el(this.root, '.queue');
    const key = me.queue.join(',');
    if (this.cache.get('queue') !== key) {
      this.cache.set('queue', key);
      let html = '';
      for (let i = 0; i < QUEUE_MAX; i++) {
        const id = me.queue[i];
        html += id
          ? `<div class="qslot filled" data-q="${i}" title="Right-click a card or click here to cancel"><img src="${this.portraits.unit(unitDef(id), 0)}" alt="">${i === 0 ? '<div class="prog"></div>' : ''}</div>`
          : '<div class="qslot"></div>';
      }
      html += `<span class="qlabel">${me.queue.length ? 'Training…' : 'Queue empty'}</span>`;
      q.innerHTML = html;
      q.querySelectorAll<HTMLElement>('[data-q]').forEach((n) => n.addEventListener('click', () => this.actions.cancel(Number(n.dataset.q))));
    }
    const prog = q.querySelector<HTMLElement>('.prog');
    if (prog) prog.style.transform = `scaleX(${me.trainProgress})`;
  }

  private updateSlots(world: World, me: SideState): void {
    const box = el(this.root, '.slots');
    const cheapest = Math.min(...AGES[me.age]!.turrets.map((t) => world.turretPrice(0, t.id)));
    const key = `${me.slots}|${me.turrets.map((t) => t?.def.id ?? '-').join(',')}|${me.age}|${world.slotPrice(0) ?? ''}|${this.popoverSlot}|${cheapest}`;
    if (this.cache.get('slots') !== key) {
      this.cache.set('slots', key);
      let html = '';
      for (let i = 3; i >= 0; i--) {
        const t = me.turrets[i];
        const sel = this.popover === 'turret' && this.popoverSlot === i ? ' selected' : '';
        if (i >= me.slots) {
          const price = i === me.slots ? world.slotPrice(0) : null;
          html += price !== null
            ? `<button class="slot add${sel}" data-slot="${i}" data-tip="slotbuy">${icon('plus')}<span class="sname">Add ledge</span><span class="sprice">${fmt(price)}</span></button>`
            : `<div class="slot locked">${icon('lock')}<span class="sname">Ledge ${i + 1}</span></div>`;
        } else if (!t) {
          html += `<button class="slot empty${sel}" data-slot="${i}" data-tip="slotempty">${icon('plus')}<span class="sname">Build turret</span><span class="sprice">${fmt(cheapest)}+</span></button>`;
        } else {
          const outdated = t.def.age < me.age ? ' outdated' : '';
          html += `<button class="slot${outdated}${sel}" data-slot="${i}" data-tip="turret:${t.def.id}"><img src="${this.portraits.turret(t.def, 0)}" alt=""><span class="sname">${t.def.name}</span></button>`;
        }
      }
      box.innerHTML = html;
      box.querySelectorAll<HTMLElement>('[data-slot]').forEach((n) =>
        n.addEventListener('click', () => {
          const slot = Number(n.dataset.slot);
          const s = this.world!.sides[0];
          if (slot >= s.slots) this.actions.buySlot();
          else this.togglePopover('turret', slot);
        }),
      );
    }
    const afford = me.gold >= cheapest;
    box.querySelectorAll('.slot.empty').forEach((n) => n.classList.toggle('afford', afford));
  }

  private updateCommands(world: World, me: SideState, view: HudView): void {
    const age = AGES[me.age]!;
    const sp = age.special;
    const special = el(this.root, '.bigbtn.special');
    const cd = me.specialCd / (sp.cooldown * me.mods.specialCd);
    special.style.setProperty('--p', `${Math.max(0, Math.min(1, cd))}turn`);
    special.classList.toggle('ready', me.specialCd <= 0);
    special.classList.toggle('aiming', view.aiming);
    special.dataset.tip = `special:${sp.id}`;
    this.set('special', el(special, '[data-special]'), me.specialCd > 0 ? `${sp.name} · ${Math.ceil(me.specialCd)}s` : sp.name);

    const evolve = el(this.root, '.bigbtn.evolve');
    const next = age.xpToNext;
    const ready = next !== null && me.xp >= next && !me.draft;
    evolve.classList.toggle('ready', ready);
    evolve.classList.toggle('disabled', next === null);
    evolve.dataset.tip = 'evolve';
    el(evolve, '.ring').style.transform = `scaleX(${next ? Math.min(1, me.xp / next) : 1})`;
    this.set('evolve', el(evolve, '[data-evolve]'), next === null ? 'Final age' : ready ? `${AGES[me.age + 1]!.name}!` : `${Math.floor(Math.min(1, me.xp / next) * 100)}% to ${AGES[me.age + 1]!.name.replace(' Age', '').replace('Age of ', '')}`);

    const stance = el(this.root, '.bigbtn.stance');
    stance.classList.toggle('hold', me.stance === 'hold');
    stance.dataset.tip = 'stance';
    this.set('stance', el(stance, '[data-stance]'), me.stance === 'hold' ? 'Hold the line' : 'Advance');

    const lv = me.upgrades.weapons + me.upgrades.armor + me.upgrades.economy;
    el(this.root, '.bigbtn.armory').dataset.tip = 'armory';
    this.set('armory', el(this.root, '[data-armory]'), `${lv} / ${UPGRADE_LEVELS * 3} upgrades`);

    const project = el(this.root, '.bigbtn.project');
    const final = age.xpToNext === null;
    project.classList.toggle('hidden', !final);
    project.dataset.tip = 'project';
    if (final) {
      this.set(
        'projectbtn',
        el(project, '[data-project]'),
        me.project >= 0 ? `Running · ${Math.ceil(PROJECT_TIME - me.project)}s left` : me.gold >= PROJECT_COST ? `Begin (${fmt(PROJECT_COST)} gold)` : `${fmt(PROJECT_COST)} gold needed`,
      );
      project.classList.toggle('disabled', me.project < 0 && me.gold < PROJECT_COST);
    }
    void world;
  }

  private updateProject(world: World): void {
    const box = el(this.root, '.project');
    const running = world.sides.filter((s) => s.project >= 0).sort((a, b) => b.project - a.project)[0];
    box.classList.toggle('active', !!running);
    if (!running) return;
    const mine = running.id === 0;
    box.classList.toggle('player', mine);
    box.classList.toggle('enemy', !mine);
    box.style.setProperty('--pglow', mine ? '#48c8ff' : '#ff5040');
    this.set('ptitle', el(box, '.title'), mine ? 'Your Singularity Project' : 'Enemy Singularity Project');
    el(box, '.bar div').style.transform = `scaleX(${running.project / PROJECT_TIME})`;
    this.set(
      'psub',
      el(box, '.sub'),
      mine
        ? `Transcendence in ${Math.ceil(PROJECT_TIME - running.project)}s — every hit on your wall sets it back`
        : `The enemy transcends in ${Math.ceil(PROJECT_TIME - running.project)}s — storm their wall to set it back`,
    );
  }

  private drawMinimap(world: World, view: HudView): void {
    const c = this.minimap;
    const g = this.mm;
    const w = c.width;
    const h = c.height;
    const x0 = -16;
    const span = LANE + 32;
    const sx = (x: number): number => ((x - x0) / span) * w;
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, `${AGES[world.sides[0].age]!.accent}33`);
    grad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    grad.addColorStop(1, `${AGES[world.sides[1].age]!.accent}33`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, h * 0.62, w, 2);
    // Walls.
    g.fillStyle = '#3f86f0';
    g.fillRect(sx(-3), h * 0.15, sx(0) - sx(-3), h * 0.7);
    g.fillStyle = '#e2463d';
    g.fillRect(sx(LANE), h * 0.15, sx(LANE + 3) - sx(LANE), h * 0.7);
    // Units.
    for (const u of world.units) {
      g.fillStyle = u.side === 0 ? '#8cc0ff' : '#ff9486';
      const r = 2 + u.def.pop * 1.3;
      const y = u.def.layer === 'air' ? h * 0.32 : h * 0.62;
      g.beginPath();
      g.arc(sx(u.x), y, r, 0, Math.PI * 2);
      g.fill();
    }
    // Camera window.
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 2;
    g.strokeRect(sx(view.camX - view.halfWidth), 2, sx(view.camX + view.halfWidth) - sx(view.camX - view.halfWidth), h - 4);
  }

  // ─── Tooltips ─────────────────────────────────────────────────────────────

  private showTip(target: HTMLElement): void {
    // The open chooser already explains the ledge; don't cover it with the row's tooltip.
    if (this.popover && target.closest('.slots')) return;
    const tip = target.dataset.tip!;
    this.tipAnchor = target;
    this.tooltipFor = () => this.tipHtml(tip);
    const node = el(this.root, '.tooltip');
    node.innerHTML = this.tooltipFor();
    const z = this.zoom;
    const r = target.getBoundingClientRect();
    const W = window.innerWidth / z;
    const H = window.innerHeight / z;
    const tw = 290;
    const left = Math.min(W - tw - 12, Math.max(12, (r.left + r.width / 2) / z - tw / 2));
    node.style.left = `${left}px`;
    const below = r.top < window.innerHeight / 2;
    node.style.top = below ? `${r.bottom / z + 10}px` : '';
    node.style.bottom = below ? '' : `${H - r.top / z + 10}px`;
    node.classList.add('show');
    this.actions.hover();
  }

  private hideTip(): void {
    this.tooltipFor = null;
    this.tipAnchor = null;
    el(this.root, '.tooltip').classList.remove('show');
  }

  private tipHtml(tip: string): string {
    const [kind, id] = tip.split(':') as [string, string | undefined];
    const w = this.world;
    const me = w?.sides[0];
    if (kind === 'unit' && id) {
      const u = unitDef(id);
      const info = CLASS_INFO[u.cls];
      const dps = u.damage / u.interval;
      const reach = u.range < 3 ? 'Melee' : `${Math.round(u.range)} m`;
      const locked = me && u.unlockCost && !me.unlocked.has(u.id);
      return `<h4>${u.name}</h4><div class="sub">${info.label}${u.layer === 'air' ? ' · flying' : ''}${u.hitsAir && u.layer !== 'air' ? ' · hits air' : ''}</div>
        <p>${u.desc}</p>
        <div class="stats">
          <span>${icon('heart')} HP <b>${fmt(u.hp)}</b></span>
          <span>${icon('sword')} DPS <b>${dps.toFixed(dps < 10 ? 1 : 0)}</b></span>
          <span>${icon('scope')} Reach <b>${reach}</b></span>
          <span>${icon('boot')} Speed <b>${u.speed.toFixed(1)} m/s</b></span>
          <span>${icon('pop')} Pop <b>${u.pop}</b></span>
          <span>${icon('clock')} Train <b>${u.trainTime}s</b></span>
        </div>
        <div class="vs"><span class="good">▲ Strong vs ${info.strong}</span><span class="bad">▼ Weak vs ${info.weak}</span></div>
        ${locked ? `<div class="vs"><span style="color:var(--gold)">Click to build the ${u.unlockName} (${fmt(u.unlockCost ?? 0)} gold) and unlock</span></div>` : '<div class="vs" style="color:var(--faint)">Click to train · right-click to cancel one</div>'}`;
    }
    if (kind === 'turret' && id) return this.turretTip(turretDef(id));
    if (kind === 'doc' && id) {
      const d = doctrine(id);
      return `<h4>${d.name}</h4><div class="sub">Doctrine</div><p>${d.desc}</p>`;
    }
    if (kind === 'special' && id && me) {
      const sp = AGES[me.age]!.special;
      return `<h4>${sp.name}</h4><div class="sub">Special · ${Math.round(sp.cooldown * me.mods.specialCd)}s cooldown${sp.aimed ? ' · aimed' : ''}</div><p>${sp.desc}</p>
        <div class="vs" style="color:var(--faint)">${sp.aimed ? 'Press SPACE, then click where it should land.' : 'Press SPACE to unleash.'}</div>`;
    }
    if (kind === 'evolve' && me) {
      const next = AGES[me.age + 1];
      if (!next) return `<h4>The final age</h4><p>There is nothing left to invent — except the Singularity Project.</p>`;
      return `<h4>Evolve to the ${next.name}</h4><div class="sub">${next.tagline}</div>
        <p>New units, turrets and a new special. Your wall grows stronger. You also pick one of three random doctrines.</p>
        <div class="stats"><span>${icon('xp')} XP <b>${fmt(me.xp)} / ${fmt(AGES[me.age]!.xpToNext ?? 0)}</b></span><span>${icon('wall')} Wall <b>${fmt(next.baseHp)}</b></span></div>
        <div class="vs" style="color:var(--faint)">XP comes from kills, damage to the enemy wall, and (a little) from your own losses.</div>`;
    }
    if (kind === 'stance') {
      return `<h4>Stance</h4><p><b>Advance</b>: troops march on the enemy wall.<br><b>Hold the line</b>: troops fall back to fight under your turrets while you build up for a push.</p>`;
    }
    if (kind === 'armory') {
      return `<h4>Armory</h4><p>Permanent upgrades that carry across ages: weapons, armour and economy. Prices rise with each level and with your age.</p>`;
    }
    if (kind === 'slotbuy' && w) {
      return `<h4>Add a ledge</h4><p>Builds another turret ledge on your tower (up to four), so you can mount another turret. Price: ${fmt(w.slotPrice(0) ?? 0)} gold.</p>`;
    }
    if (kind === 'slotempty' && me) {
      return `<h4>Build a turret</h4><p>Choose one of the ${AGES[me.age]!.name}'s three turrets for this ledge. Turrets fire on anything that comes within range of your wall.</p><div class="vs" style="color:var(--faint)">Shortcut: T, or click the glowing + on your tower.</div>`;
    }
    if (kind === 'project') {
      return `<h4>The Singularity Project</h4><div class="sub">Victory condition</div><p>Pour ${fmt(PROJECT_COST)} gold into a superintelligence. If it survives ${PROJECT_TIME} seconds, you win. Damage to your wall sets the countdown back — the enemy will throw everything at you. It can race you with its own.</p>`;
    }
    return '';
  }

  private turretTip(t: TurretDef): string {
    const reach = `${Math.round(t.range)} m${t.minRange ? ` (min ${t.minRange} m)` : ''}`;
    return `<h4>${t.name}</h4><div class="sub">Turret · ${AGES[t.age]!.name}</div><p>${t.desc}</p>
      <div class="stats">
        <span>${icon('sword')} Damage <b>${fmt(t.damage)}</b></span>
        <span>${icon('clock')} Rate <b>${(1 / t.interval).toFixed(1)}/s</b></span>
        <span>${icon('scope')} Reach <b>${reach}</b></span>
        <span>${icon('radar')} Air <b>${t.hitsAir ? 'yes' : 'no'}</b></span>
      </div>`;
  }

  // ─── Popovers ─────────────────────────────────────────────────────────────

  togglePopover(kind: 'turret' | 'armory', slot = -1): void {
    if (this.popover === kind && this.popoverSlot === slot) {
      this.closePopover();
      return;
    }
    this.popover = kind;
    this.popoverSlot = slot;
    this.renderPopover();
    const node = el(this.root, '.popover');
    node.classList.add('show');
    const anchor = kind === 'armory' ? el(this.root, '.bigbtn.armory') : el(this.root, '.slots');
    const z = this.zoom;
    const r = anchor.getBoundingClientRect();
    node.style.left = `${Math.min(window.innerWidth / z - 342, Math.max(12, (r.left + r.width / 2) / z - 165))}px`;
    node.style.bottom = `${(window.innerHeight - r.top) / z + 12}px`;
    this.cache.delete('slots');
  }

  closePopover(): void {
    this.hideTip();
    this.popover = null;
    this.popoverSlot = -1;
    el(this.root, '.popover').classList.remove('show');
    this.cache.delete('slots');
  }

  get popoverOpen(): boolean {
    return this.popover !== null;
  }

  private renderPopover(): void {
    const w = this.world;
    if (!w) return;
    const me = w.sides[0];
    const node = el(this.root, '.popover');
    let html = '';
    if (this.popover === 'armory') {
      html = `<h4>Armory <button class="iconbtn" data-act="close">${icon('close')}</button></h4>`;
      for (const track of ['weapons', 'armor', 'economy'] as UpgradeTrack[]) {
        const info = UPGRADE_INFO[track];
        const lvl = me.upgrades[track];
        const price = w.upgradePrice(0, track);
        const pips = Array.from({ length: UPGRADE_LEVELS }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        html += `<button class="opt${price === null ? ' disabled' : me.gold < price ? ' poor' : ''}" data-act="upgrade" data-track="${track}">
          ${icon(info.icon, 'big')}
          <div class="body"><div class="n"><span>${info.name}${lvl ? ` · level ${lvl}` : ''}</span><span class="p">${price === null ? 'MAX' : `${icon('coin')} ${fmt(price)}`}</span></div>
          <div class="d">${info.desc(lvl + (price === null ? 0 : 1))}</div><div class="pips">${pips}</div></div></button>`;
      }
    } else if (this.popover === 'turret') {
      const slot = this.popoverSlot;
      const t = me.turrets[slot];
      if (t) {
        html = `<h4>${t.def.name} <button class="iconbtn" data-act="close">${icon('close')}</button></h4>
          <div style="font-size:12.5px;color:#cfd5df;margin-bottom:10px">${t.def.desc}${t.def.age < me.age ? ' <span style="color:var(--bad)">Outdated — sell it and build a modern turret.</span>' : ''}</div>
          <button class="opt" data-act="sell" data-slot="${slot}">${icon('sell', 'big')}<div class="body"><div class="n"><span>Sell</span><span class="p">+${fmt(t.paid * TURRET_REFUND)}</span></div><div class="d">Refunds half of what you paid.</div></div></button>`;
      } else {
        html = `<h4>Ledge ${slot + 1} · ${AGES[me.age]!.name} turrets <button class="iconbtn" data-act="close">${icon('close')}</button></h4>`;
        for (const def of AGES[me.age]!.turrets) {
          const price = w.turretPrice(0, def.id);
          html += `<button class="opt${me.gold < price ? ' poor' : ''}" data-act="buyturret" data-slot="${slot}" data-id="${def.id}" data-tip="turret:${def.id}">
            <img src="${this.portraits.turret(def, 0)}" alt="">
            <div class="body"><div class="n"><span>${def.name}</span><span class="p">${icon('coin')} ${fmt(price)}</span></div><div class="d">${def.desc}</div></div></button>`;
        }
      }
    }
    if (this.cache.get('popover') !== html) {
      this.cache.set('popover', html);
      node.innerHTML = html;
    }
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  toast(message: string, kind: 'enemy' | 'good' | 'info' = 'enemy'): void {
    const box = el(this.root, '.intel');
    const t = document.createElement('div');
    t.className = `toast glass ${kind === 'good' ? 'good' : kind === 'info' ? 'info' : ''}`;
    t.innerHTML = `${icon(kind === 'enemy' ? 'eye' : kind === 'good' ? 'star' : 'info')}<span>${message}</span>`;
    box.appendChild(t);
    while (box.children.length > 5) box.firstElementChild!.remove();
    setTimeout(() => t.remove(), 6800);
  }

  banner(over: string, title: string, tag: string, color: string): void {
    const b = el(this.root, '.banner');
    el(b, '.over').textContent = over;
    el(b, '.title').textContent = title;
    el(b, '.tag').textContent = tag;
    b.style.setProperty('--bcolor', color);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  hideBanner(): void {
    el(this.root, '.banner').classList.remove('show');
  }

  aimHint(show: boolean): void {
    el(this.root, '.aimhint').classList.toggle('show', show);
  }

  floater(sx: number, sy: number, text: string, cls = ''): void {
    const x = sx / this.zoom;
    const y = sy / this.zoom;
    const box = el(this.root, '.floaters');
    if (box.children.length > 40) box.firstElementChild!.remove();
    const f = document.createElement('div');
    f.className = `floater ${cls}`;
    f.textContent = text;
    box.appendChild(f);
    const start = performance.now();
    const step = (now: number): void => {
      const t = (now - start) / 1100;
      if (t >= 1) {
        f.remove();
        return;
      }
      f.style.transform = `translate(${x}px, ${y - t * 46}px) translate(-50%, -50%) scale(${1 + (1 - t) * 0.15})`;
      f.style.opacity = String(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
