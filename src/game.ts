import * as THREE from 'three';
import { AGES, unitDef } from './sim/data/ages';
import { DIFFICULTIES, LANE, TICK_DT } from './sim/config';
import { AIController } from './sim/ai';
import type { GameEvent, Unit } from './sim/entities';
import type { CommandResult } from './sim/world';
import { World, dirOf, wallX } from './sim/world';
import type { Difficulty, SideId, UpgradeTrack } from './sim/types';
import { Renderer, qualityPreset } from './render/renderer';
import { BattleView } from './render/battle';
import { Portraits } from './render/portraits';
import { AudioEngine, type Sfx } from './audio/audio';
import { Input, type Action } from './input';
import { Hud } from './ui/hud';
import { Menus, type Settings } from './ui/menus';
import { unitTemplate } from './render/models';

type Mode = 'menu' | 'play' | 'over';

const ERRORS: Partial<Record<CommandResult, string>> = {
  gold: 'Not enough gold',
  pop: 'Army at its population cap — evolve to raise it',
  queue: 'Training queue is full',
  locked: 'Build the unlock first',
  cooldown: 'Special is recharging',
  xp: 'Not enough experience to evolve yet',
  max: 'Already at the maximum',
  draft: 'Choose a doctrine first',
};

export function boot(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  const game = new Game(canvas, params);
  void game.start();
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
}

export class Game {
  readonly renderer: Renderer;
  private world!: World;
  private ais: AIController[] = [];
  private battle!: BattleView;
  private readonly portraits = new Portraits();
  private readonly audio = new AudioEngine();
  private readonly input: Input;
  private readonly hud: Hud;
  private readonly menus: Menus;
  private mode: Mode = 'menu';
  private paused = false;
  private speed = 1;
  private acc = 0;
  private difficulty: Difficulty = 'veteran';
  private aiming = false;
  private readonly aimMarker: THREE.Group;
  private last = 0;
  private time = 0;
  private overTimer = -1;
  private overInfo: { winner: SideId; reason: 'wall' | 'singularity' } | null = null;
  private draftDelay = -1;
  private wallAlert = 0;
  private settings: Settings;
  private readonly tmp = new THREE.Vector3();
  private attractAge = 0;
  /** Frame-time samples for the automatic quality fallback. */
  private perf = { frames: 0, time: 0, checks: 0 };
  /** First-war tips, shown at these game times. */
  private tips: { at: number; text: string }[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly params: URLSearchParams,
  ) {
    const ui = document.getElementById('ui')!;
    this.menus = new Menus(ui, this.portraits, {
      play: (d) => this.newWar(d),
      resume: () => this.setPaused(false),
      quit: () => this.toMenu(),
      restart: () => this.newWar(this.difficulty),
      chooseDoctrine: (id) => this.chooseDoctrine(id),
      settingsChanged: (s) => this.applySettings(s),
      click: () => this.sfx('click'),
    });
    this.settings = this.menus.current;
    const quality = (params.get('quality') as Settings['quality'] | null) ?? this.settings.quality;
    this.renderer = new Renderer(canvas, qualityPreset(quality));
    this.input = new Input(canvas, this.renderer.rig);
    this.hud = new Hud(ui, this.portraits, {
      train: (i) => this.train(i),
      unlock: (id) => this.unlock(id),
      cancel: (i) => {
        if (this.world.cancel(0, i) === 'ok') this.sfx('sell');
      },
      special: () => this.special(),
      evolve: () => this.evolve(),
      stance: () => this.toggleStance(),
      buySlot: () => this.result(this.world.buySlot(0), 'build'),
      buyTurret: (slot, id) => this.result(this.world.buyTurret(0, slot, id), 'build'),
      sellTurret: (slot) => this.result(this.world.sellTurret(0, slot), 'sell'),
      upgrade: (track: UpgradeTrack) => this.result(this.world.upgrade(0, track), 'unlock'),
      project: () => this.project(),
      pause: () => this.setPaused(!this.paused),
      speed: () => this.toggleSpeed(),
      mute: () => this.toggleMute(),
      jump: (x) => this.renderer.rig.jump(x),
      hover: () => {},
    });
    this.input.onAction = (a) => this.action(a);
    this.input.onClick = (x) => this.click(x);
    this.input.onRightClick = () => this.cancelAim();
    this.input.edgeScroll = this.settings.edgeScroll;

    // Aiming marker: an elongated zone along the lane.
    this.aimMarker = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.965, 1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    );
    this.aimMarker.add(disc, ring);
    this.aimMarker.position.y = 0.12;
    this.aimMarker.visible = false;
    this.renderer.scene.add(this.aimMarker);

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'play' && !this.paused) this.setPaused(true);
    });
    const unlock = (): void => {
      this.audio.unlock();
      this.audio.applyVolumes();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.applySettings(this.settings);
  }

  async start(): Promise<void> {
    this.resize();
    // Warm up: build the Stone Age models and portraits before the curtain lifts.
    await new Promise((r) => setTimeout(r, 30));
    for (const u of AGES[0]!.units) {
      unitTemplate(u.model, 0);
      unitTemplate(u.model, 1);
      this.portraits.unit(u, 0);
    }
    for (const t of AGES[0]!.turrets) this.portraits.turret(t, 0);

    this.newAttract();
    const dev = import.meta.env.DEV;
    const play = dev ? (this.params.get('play') as Difficulty | null) : null;
    if (play && DIFFICULTIES[play]) this.newWar(play);
    else if (!(dev && this.params.has('attract'))) this.menus.showMain();
    if (dev) this.applyDevFlags();

    this.renderer.render(0.016, 0);
    this.menus.loaded();
    this.last = -1;
    requestAnimationFrame((t) => this.frame(t));
  }

  private applyDevFlags(): void {
    const p = this.params;
    const age = p.get('age');
    if (age !== null) {
      const a = Number(age);
      for (const s of this.world.sides) {
        this.world.debugSetAge(s.id, a);
        s.gold = 500000;
        for (const u of AGES[a]!.units) if (u.unlockCost) s.unlocked.add(u.id);
        if (p.has('turrets')) {
          while (this.world.buySlot(s.id) === 'ok') {
            /* all four ledges */
          }
          AGES[a]!.turrets.forEach((t, i) => this.world.buyTurret(s.id, i, t.id));
          this.world.buyTurret(s.id, 3, AGES[a]!.turrets[0]!.id);
        }
        // `&set=trebuchet,flakCannon,…`: any four turrets, from any age, lowest ledge first.
        const set = p.get('set');
        if (set) {
          while (this.world.buySlot(s.id) === 'ok') {
            /* all four ledges */
          }
          set.split(',').slice(0, 4).forEach((name, slot) => {
            const def = AGES.flatMap((x) => x.turrets).find((d) => d.id === name || d.model === name);
            if (!def) return;
            if (s.turrets[slot]) this.world.sellTurret(s.id, slot);
            s.gold = 500000;
            this.world.debugSetAge(s.id, def.age);
            this.world.buyTurret(s.id, slot, def.id);
          });
          this.world.debugSetAge(s.id, a);
        }
        s.gold = 50000;
      }
      this.battle.attach(this.world);
      this.renderer.setPlayerAge(a, true);
      this.audio.setMusicAge(a);
      this.hud.hideBanner();
    }
    if (p.has('autopilot') && this.mode === 'play') {
      this.ais.push(new AIController(this.world, 0, DIFFICULTIES.veteran, 99));
    }
    this.fastForward(Number(p.get('warmup') ?? 0));
    if (p.has('cam')) this.renderer.rig.jump(Number(p.get('cam')));
    if (p.has('dist')) this.renderer.rig.targetDistance = Number(p.get('dist'));
    if (p.has('speed')) this.speed = Number(p.get('speed'));
    if (p.has('nohud')) this.hud.show(false);
    this.renderer.rig.snap();
    if (p.has('draft') && this.mode === 'play') {
      this.world.sides[0].draft = ['plunder', 'drill', 'veterans'];
      this.openDraft();
    }
  }

  // ─── Wars ─────────────────────────────────────────────────────────────────

  private freshWorld(ai: [boolean, boolean], seed: number, enemy: Difficulty, player?: Difficulty): World {
    const e = DIFFICULTIES[enemy];
    const p = player ? DIFFICULTIES[player] : null;
    return new World({ seed, ai, power: [p?.power ?? 1, e.power], income: [p?.income ?? 1, e.income] });
  }

  private resetScene(world: World): void {
    this.battle?.dispose();
    this.world = world;
    this.battle = new BattleView(this.renderer, {
      onGold: (side, amount, pos) => {
        if (side !== 0 || this.mode !== 'play') return;
        const s = this.project3(pos);
        if (s) this.hud.floater(s.x, s.y, `+${Math.round(amount)}`);
        this.sfx('coin', { x: pos.x, vol: 0.35 });
      },
      onRank: (unit, pos) => {
        if (unit.side !== 0 || this.mode !== 'play') return;
        const s = this.project3(pos);
        if (s) this.hud.floater(s.x, s.y, `RANK ${unit.rank}`, 'rank');
        this.sfx('rankUp', { x: pos.x, vol: 0.6 });
      },
    });
    this.battle.attach(world);
    this.renderer.setPlayerAge(world.sides[0].age, true);
    this.acc = 0;
    this.resize();
  }

  private newAttract(): void {
    const seed = (Math.random() * 1e9) | 0;
    const world = this.freshWorld([true, true], seed, 'veteran', 'veteran');
    // Start the backdrop war a few ages in so the menu shows off.
    this.attractAge = [0, 1, 2, 3, 4, 5, 6][Math.floor(Math.random() * 7)]!;
    this.resetScene(world);
    if (this.attractAge > 0) {
      for (const s of world.sides) world.debugSetAge(s.id, this.attractAge);
      this.battle.attach(world);
      this.renderer.setPlayerAge(this.attractAge, true);
    }
    this.ais = [new AIController(world, 0, DIFFICULTIES.veteran, seed + 1), new AIController(world, 1, DIFFICULTIES.veteran, seed + 2)];
    // Fast-forward a little so there's a battle to watch.
    this.fastForward(40);
    const rig = this.renderer.rig;
    rig.jump(LANE / 2);
    rig.targetDistance = 42;
    rig.targetLift = 3;
    rig.snap();
    this.audio.setMusicAge(this.attractAge);
    this.hud.show(false);
  }

  newWar(d: Difficulty): void {
    this.difficulty = d;
    const seed = (Math.random() * 1e9) | 0;
    const world = this.freshWorld([false, true], seed, d);
    this.resetScene(world);
    this.battle.setMarkers(true);
    this.ais = [new AIController(world, 1, DIFFICULTIES[d], seed + 7)];
    this.mode = 'play';
    this.paused = false;
    this.speed = 1;
    this.overTimer = -1;
    this.overInfo = null;
    this.draftDelay = -1;
    this.cancelAim();
    this.menus.hideAll();
    this.hud.reset(world);
    this.hud.show(true);
    // Open on the enemy's wall and glide home.
    const rig = this.renderer.rig;
    rig.targetLift = 0;
    rig.jump(LANE - 18);
    rig.targetDistance = 40;
    rig.snap();
    rig.jump(14);
    rig.targetDistance = 34;
    this.audio.setMusicAge(0);
    this.hud.banner(DIFFICULTIES[d].name, 'The Stone Age', 'The first spark', AGES[0]!.accent);
    this.tips = [];
    let seen = false;
    try {
      seen = localStorage.getItem('epochwar.tips') === '1';
      localStorage.setItem('epochwar.tips', '1');
    } catch {
      // No storage: show the tips every time.
    }
    if (!seen) {
      this.tips = [
        { at: 2, text: 'Train units with the cards below (keys 1–4). They march on the enemy wall on their own.' },
        { at: 16, text: 'Kills earn gold and experience. When the XP bar fills, press E to evolve to the next age.' },
        { at: 30, text: 'Your tower has a free ledge: click “+ Build turret” in the Turrets panel, press T, or click the glowing + on your tower.' },
        { at: 60, text: 'Press Space for your special. Aimed specials wait for you to click the battlefield.' },
        { at: 90, text: 'Hover any card for its counters. Heavy units need a one-time building — click the locked card.' },
      ];
    }
    this.prefetch(1);
  }

  /** Build the next age's models and portraits a little at a time, so evolving never hitches. */
  private prefetch(age: number): void {
    const def = AGES[age];
    if (!def) return;
    const jobs: (() => void)[] = [];
    for (const u of def.units) {
      jobs.push(() => unitTemplate(u.model, 0));
      jobs.push(() => unitTemplate(u.model, 1));
      jobs.push(() => this.portraits.unit(u, 0));
    }
    for (const t of def.turrets) jobs.push(() => this.portraits.turret(t, 0));
    const run = (): void => {
      const job = jobs.shift();
      if (!job) return;
      job();
      setTimeout(run, 120);
    };
    setTimeout(run, 1500);
  }

  private toMenu(): void {
    this.mode = 'menu';
    this.paused = false;
    this.cancelAim();
    this.menus.showMain();
    this.newAttract();
  }

  // ─── Loop ─────────────────────────────────────────────────────────────────

  private frame(now: number): void {
    if (this.last < 0) this.last = now;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    const rig = this.renderer.rig;

    if (this.mode === 'menu') {
      this.acc += dt * 1.1;
      this.stepSim();
      this.attractCamera(dt);
      if (this.world.winner !== null || this.world.time > 14 * 60) this.newAttract();
    } else {
      this.input.update(dt);
      if (!this.paused) {
        const slow = this.mode === 'over' ? 0.35 : 1;
        this.acc += dt * this.speed * slow;
        this.stepSim();
      }
      // A war decided without its event reaching us (e.g. a fast-forward) still ends.
      if (this.mode === 'play' && this.world.winner !== null && !this.overInfo) {
        this.onGameOver(this.world.winner, this.world.sides[this.world.winner].project >= 150 ? 'singularity' : 'wall');
      }
      if (this.mode === 'over') {
        this.overTimer -= dt;
        if (this.overTimer <= 0 && this.overInfo) {
          const info = this.overInfo;
          this.overInfo = null;
          this.paused = true;
          this.hud.show(false);
          this.menus.showResult(this.world, info.winner, info.reason, this.difficulty);
        }
      }
      while (this.tips.length && this.mode === 'play' && this.world.time >= this.tips[0]!.at) {
        this.hud.toast(this.tips.shift()!.text, 'info');
      }
      if (this.draftDelay > 0) {
        this.draftDelay -= dt;
        if (this.draftDelay <= 0) this.openDraft();
      }
    }

    const alpha = Math.min(1, this.acc / TICK_DT);
    this.battle.update(this.world, alpha, dt, TICK_DT);

    if (this.mode !== 'menu') {
      this.hud.update(this.world, {
        camX: rig.focusX,
        halfWidth: rig.visibleHalfWidth(),
        speed: this.speed,
        paused: this.paused,
        aiming: this.aiming,
        muted: this.audio.muted,
      });
      this.updateAim();
    }

    this.watchPerformance(dt);
    this.audio.setListener(rig.focusX, rig.visibleHalfWidth());
    this.audio.setMusicIntensity(Math.min(1, this.world.units.length / 18));
    this.audio.update();
    this.renderer.render(dt, this.time);
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Run the simulation ahead without drawing, then rebuild the scene to match. */
  private fastForward(seconds: number): void {
    if (seconds <= 0) return;
    for (let t = 0; t < seconds; t += TICK_DT) {
      for (const ai of this.ais) ai.update(TICK_DT);
      this.world.step(TICK_DT);
      for (const e of this.world.events) {
        if (e.t === 'evolve' && e.side === 0) this.audio.setMusicAge(e.age);
      }
      this.world.events = [];
      for (const ai of this.ais) ai.intel.length = 0;
    }
    this.battle.resync(this.world);
    this.renderer.setPlayerAge(this.world.sides[0].age, true);
  }

  private stepSim(): void {
    let steps = 0;
    while (this.acc >= TICK_DT && steps < 8) {
      for (const ai of this.ais) ai.update(TICK_DT);
      this.world.step(TICK_DT);
      this.consume(this.mode === 'menu');
      this.acc -= TICK_DT;
      steps++;
    }
    if (steps >= 8) this.acc = 0;
  }

  private attractCamera(dt: number): void {
    const units = this.world.units;
    let front0 = 10;
    let front1 = LANE - 10;
    for (const u of units) {
      if (u.side === 0) front0 = Math.max(front0, u.x);
      else front1 = Math.min(front1, u.x);
    }
    const clash = (front0 + front1) / 2;
    const rig = this.renderer.rig;
    rig.jump(rig.targetX + (clash + Math.sin(this.time * 0.07) * 8 - rig.targetX) * Math.min(1, dt * 0.4));
    rig.targetDistance = 40 + Math.sin(this.time * 0.05) * 6;
  }

  /** Feed this tick's events to the scene, the sound and the HUD. */
  private consume(silent: boolean): void {
    const events = this.world.events;
    if (events.length === 0) return;
    this.world.events = [];
    this.battle.handle(this.world, events);
    if (!silent) {
      for (const e of events) this.react(e);
    } else if (this.mode === 'menu') {
      for (const e of events) {
        if (e.t === 'evolve' && e.side === 0) {
          this.renderer.setPlayerAge(e.age);
          this.audio.setMusicAge(e.age);
        }
      }
    }
    if (this.mode === 'play') {
      for (const ai of this.ais) {
        while (ai.intel.length) this.hud.toast(ai.intel.shift()!, 'enemy');
      }
    }
  }

  private sfx(name: Sfx, o: { x?: number; vol?: number; pitch?: number } = {}): void {
    this.audio.play(name, o);
  }

  private react(e: GameEvent): void {
    switch (e.t) {
      case 'spawn':
        if (e.unit.side === 1 && e.unit.def.cls === 'apex') {
          this.sfx('alarm');
          this.hud.banner('Warning', 'OMEGA Model', 'The enemy has fielded a superintelligence', '#ff5040');
        }
        break;
      case 'attackStart':
        if (e.unit.def.attack.kind === 'melee') this.sfx('swing', { x: e.unit.x, vol: 0.5 });
        break;
      case 'fire':
        this.fireSound(e);
        break;
      case 'impact': {
        const k = e.p.kind;
        if (k === 'meteor') this.sfx('bigExplosion', { x: e.p.ex, vol: 0.8 });
        else if (k === 'shell' || k === 'bomb' || k === 'rocket' || k === 'missile' || k === 'drone' || k === 'grenade') this.sfx('explosion', { x: e.p.ex, vol: 0.7 });
        else if (k === 'flak') this.sfx('explosion', { x: e.p.ex, vol: 0.4, pitch: 1.5 });
        else if (k === 'boulder' || k === 'cannonball') this.sfx('hitBlunt', { x: e.p.ex, vol: 0.8, pitch: 0.7 });
        else if (k === 'oil') this.sfx('splash', { x: e.p.ex });
        break;
      }
      case 'death': {
        const machine = ['vehicle', 'walker', 'flyer', 'hover', 'crewed', 'swarm'].includes(unitTemplate(e.unit.def.model, e.unit.side).meta.kind);
        if (machine) this.sfx(e.unit.def.size > 3 ? 'bigExplosion' : 'explosion', { x: e.unit.x, vol: 0.8 });
        else this.sfx('deathSoft', { x: e.unit.x, vol: 0.5 });
        break;
      }
      case 'baseHit':
        this.sfx('baseHit', { x: e.x, vol: 0.5 });
        if (e.side === 0 && this.time - this.wallAlert > 25) {
          this.wallAlert = this.time;
          this.hud.toast('Your wall is under attack!', 'info');
        }
        break;
      case 'evolve':
        this.onEvolve(e.side, e.age);
        break;
      case 'special':
        this.onSpecial(e.side, e.id, e.x);
        break;
      case 'lightning':
        this.sfx('thunder', { x: e.x });
        break;
      case 'convert':
        if (e.from === 0) this.hud.toast(`Your ${e.unit.def.name} was hacked by the enemy!`, 'enemy');
        break;
      case 'turret':
        if (e.side === 0) this.sfx(e.action === 'build' ? 'build' : 'sell');
        break;
      case 'unlock':
        if (e.side === 0) {
          const u = unitDef(e.unitId);
          this.sfx('unlock');
          this.hud.toast(`${u.unlockName} built — ${u.name} unlocked.`, 'good');
        } else if (DIFFICULTIES[this.difficulty].adaptive) {
          this.hud.toast(`The enemy built the ${unitDef(e.unitId).unlockName}.`, 'enemy');
        }
        break;
      case 'project':
        if (e.action === 'start') {
          this.sfx(e.side === 0 ? 'projectStart' : 'alarm');
          this.hud.banner(e.side === 0 ? 'Transcendence begins' : 'Warning', e.side === 0 ? 'Singularity Project' : 'Enemy Singularity', e.side === 0 ? 'Hold your wall for 150 seconds' : 'Break their wall before it completes', '#b77bff');
        }
        break;
      case 'gameOver':
        this.onGameOver(e.winner, e.reason);
        break;
      default:
        break;
    }
  }

  private fireSound(e: Extract<GameEvent, { t: 'fire' }>): void {
    const x = e.unit ? e.unit.x : wallX(e.side) - dirOf(e.side);
    const v = e.unit ? 0.7 : 0.8;
    switch (e.kind) {
      case 'melee': {
        const blade = /manAtArms|duelist|cuirassier|knight|pikeman|hoplite|trench/.test(e.unit?.def.model ?? '');
        this.sfx(blade ? 'hitBlade' : 'hitBlunt', { x, vol: 0.6 });
        break;
      }
      case 'hitscan':
        this.sfx(e.projectile === 'musketball' ? 'musket' : 'rifle', { x, vol: v * (e.projectile === 'musketball' ? 0.8 : 0.55) });
        break;
      case 'beam':
        this.sfx('laser', { x, vol: v * 0.6, pitch: e.unit?.def.cls === 'apex' ? 0.6 : 1 });
        break;
      case 'pierce':
        this.sfx('rail', { x, vol: v });
        break;
      case 'chain':
        this.sfx('zap', { x, vol: v * 0.7 });
        break;
      case 'flame':
        this.sfx('flame', { x, vol: v * 0.7 });
        break;
      case 'heal':
        this.sfx('heal', { x, vol: 0.4 });
        break;
      case 'projectile':
        switch (e.projectile) {
          case 'arrow':
          case 'bolt':
            this.sfx('bow', { x, vol: v * 0.6, pitch: e.projectile === 'bolt' ? 0.8 : 1 });
            break;
          case 'cannonball':
          case 'shell':
            this.sfx('cannon', { x, vol: v * 0.8 });
            break;
          case 'rocket':
          case 'missile':
            this.sfx('rocket', { x, vol: v * 0.7 });
            break;
          case 'plasma':
          case 'fireball':
          case 'sunbolt':
            this.sfx('plasma', { x, vol: v * 0.5, pitch: e.projectile === 'plasma' ? 1 : 0.6 });
            break;
          case 'egg':
            this.sfx('hen', { x, vol: 0.5 });
            break;
          case 'flak':
            this.sfx('cannon', { x, vol: 0.4, pitch: 1.6 });
            break;
          default:
            this.sfx('throw', { x, vol: v * 0.6 });
        }
        break;
    }
  }

  private onEvolve(side: SideId, age: number): void {
    const def = AGES[age]!;
    this.prefetch(age + 1);
    if (side === 0) {
      this.sfx('evolve');
      this.hud.banner('You have entered', def.name, def.tagline, def.accent);
      this.audio.setMusicAge(age);
      if (this.world.sides[0].draft) this.draftDelay = 2.4;
    } else {
      this.sfx('enemyEvolve');
      this.hud.toast(`The enemy has entered the ${def.name}!`, 'enemy');
    }
  }

  private onSpecial(side: SideId, id: string, x: number): void {
    const map: Partial<Record<string, Sfx>> = { meteor: 'meteorRumble', arrows: 'arrowsWhoosh', rally: 'rally', bomber: 'bomber', drones: 'drones', override: 'override' };
    const s = map[id];
    if (s) this.sfx(s, { x, vol: 0.9 });
    if (id === 'override') this.sfx('emp', { x });
    if (side === 1) this.hud.toast(`Enemy special: ${AGES[this.world.sides[1].age]!.special.name}!`, 'enemy');
  }

  private onGameOver(winner: SideId, reason: 'wall' | 'singularity'): void {
    this.mode = 'over';
    this.overTimer = 3;
    this.overInfo = { winner, reason };
    this.cancelAim();
    this.sfx(winner === 0 ? 'victory' : 'defeat');
    this.sfx('bigExplosion', { x: wallX(winner === 0 ? 1 : 0) });
    this.renderer.rig.jump(wallX(winner === 0 ? 1 : 0) + (winner === 0 ? -8 : 8));
  }

  // ─── Commands ─────────────────────────────────────────────────────────────

  private result(r: CommandResult, ok?: Sfx): boolean {
    if (r === 'ok') {
      if (ok) this.sfx(ok);
      return true;
    }
    this.sfx('error');
    const msg = ERRORS[r];
    if (msg) this.hud.toast(msg, 'info');
    return false;
  }

  private get playing(): boolean {
    return this.mode === 'play' && !this.paused;
  }

  private train(i: number): void {
    if (!this.playing) return;
    const def = AGES[this.world.sides[0].age]!.units[i];
    if (!def) return;
    const s = this.world.sides[0];
    if (def.unlockCost && !s.unlocked.has(def.id)) {
      this.unlock(def.id);
      return;
    }
    if (this.result(this.world.train(0, def.id), 'train')) this.hud.pulseCard(i);
  }

  private unlock(id: string): void {
    if (!this.playing) return;
    this.result(this.world.unlock(0, id));
  }

  private special(): void {
    if (!this.playing) return;
    const s = this.world.sides[0];
    const sp = AGES[s.age]!.special;
    if (s.specialCd > 0) {
      this.result('cooldown');
      return;
    }
    if (sp.aimed) {
      if (this.aiming) this.cancelAim();
      else {
        this.aiming = true;
        this.canvas.classList.add('aiming');
        this.hud.aimHint(true);
        this.sfx('click');
      }
    } else {
      this.result(this.world.castSpecial(0));
    }
  }

  private click(x: number): void {
    if (!this.playing) return;
    if (!this.aiming) {
      this.clickLedge();
      return;
    }
    const r = this.world.castSpecial(0, x);
    this.cancelAim();
    this.result(r);
  }

  /** Clicking a ledge on your tower opens its turret menu, or buys it if it's the next one. */
  private clickLedge(): void {
    const ray = this.input.ray();
    const slot = ray ? this.battle.pickSlot(ray) : null;
    if (slot === null) return;
    const s = this.world.sides[0];
    if (slot < s.slots) {
      this.hud.togglePopover('turret', slot);
      this.sfx('click');
    } else if (slot === s.slots) {
      this.result(this.world.buySlot(0), 'build');
    } else {
      this.hud.toast('Add the ledges below this one first.', 'info');
    }
  }

  /** T: open the turret menu on the lowest empty ledge. */
  private turretMenu(): void {
    if (!this.playing) return;
    const s = this.world.sides[0];
    const empty = s.turrets.slice(0, s.slots).findIndex((t) => t === null);
    if (empty >= 0) {
      this.hud.togglePopover('turret', empty);
      this.sfx('click');
      return;
    }
    const price = this.world.slotPrice(0);
    this.sfx('error');
    this.hud.toast(
      price === null
        ? 'All four ledges have turrets. Click one to sell it and make room.'
        : `Every ledge is armed. Add a ledge in the Turrets panel (${price} gold).`,
      'info',
    );
  }

  private cancelAim(): void {
    this.aiming = false;
    this.aimMarker.visible = false;
    this.canvas.classList.remove('aiming');
    this.hud?.aimHint(false);
  }

  private updateAim(): void {
    if (!this.aiming) {
      this.aimMarker.visible = false;
      // Hovering a ledge on your tower: show it's clickable.
      const ray = this.playing ? this.input.ray() : null;
      const slot = ray ? this.battle.pickSlot(ray) : null;
      this.battle.hoverSlot = slot ?? -1;
      this.canvas.style.cursor = slot !== null && slot <= this.world.sides[0].slots ? 'pointer' : '';
      return;
    }
    this.canvas.style.cursor = '';
    const x = this.input.laneX();
    if (x === null) {
      this.aimMarker.visible = false;
      return;
    }
    const sp = AGES[this.world.sides[0].age]!.special;
    const r = Math.max(4, sp.radius);
    this.aimMarker.visible = true;
    this.aimMarker.position.x = Math.max(4, Math.min(LANE - 4, x));
    this.aimMarker.scale.set(r, 1, 3.4);
    const color = new THREE.Color(AGES[this.world.sides[0].age]!.accent);
    for (const child of this.aimMarker.children) ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(color).multiplyScalar(1.6);
  }

  private evolve(): void {
    if (!this.playing) return;
    this.result(this.world.evolve(0));
  }

  private openDraft(): void {
    if (!this.world.sides[0].draft || this.mode !== 'play') return;
    this.draftDelay = -1;
    this.paused = true;
    this.hud.hideBanner();
    this.sfx('draft');
    this.menus.showDraft(this.world, 0);
  }

  private chooseDoctrine(id: string): void {
    if (this.world.chooseDoctrine(0, id) === 'ok') {
      this.menus.hideAll();
      this.paused = false;
      this.sfx('unlock');
    }
  }

  private toggleStance(): void {
    if (!this.playing) return;
    const s = this.world.sides[0];
    this.world.setStance(0, s.stance === 'hold' ? 'advance' : 'hold');
    this.sfx('click');
  }

  private project(): void {
    if (!this.playing) return;
    this.result(this.world.startProject(0));
  }

  private setPaused(p: boolean): void {
    if (this.mode !== 'play') return;
    if (this.world.sides[0].draft && !p && this.menus.isOpen('draft')) return;
    this.paused = p;
    if (p) {
      this.cancelAim();
      this.menus.showPause();
    } else {
      this.menus.hideAll();
    }
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
  }

  private toggleMute(): void {
    this.audio.muted = !this.audio.muted;
    this.audio.applyVolumes();
  }

  private action(a: Action): void {
    if (this.mode === 'menu' || this.mode === 'over') return;
    if (this.menus.isOpen('draft')) {
      const n = ['train1', 'train2', 'train3'].indexOf(a);
      if (n >= 0) this.menus.draftKey(this.world, n);
      return;
    }
    switch (a) {
      case 'train1':
      case 'train2':
      case 'train3':
      case 'train4':
      case 'train5':
      case 'train6':
        this.train(Number(a.slice(5)) - 1);
        break;
      case 'special':
        this.special();
        break;
      case 'evolve':
        this.evolve();
        break;
      case 'stance':
        this.toggleStance();
        break;
      case 'armory':
        if (this.playing) this.hud.togglePopover('armory');
        break;
      case 'turret':
        this.turretMenu();
        break;
      case 'project':
        this.project();
        break;
      case 'pause':
        this.setPaused(!this.paused);
        break;
      case 'cancel':
        if (this.aiming) this.cancelAim();
        else if (this.hud.popoverOpen) this.hud.closePopover();
        else this.setPaused(!this.paused);
        break;
      case 'speed':
        this.toggleSpeed();
        break;
      case 'mute':
        this.toggleMute();
        break;
    }
  }

  // ─── Misc ─────────────────────────────────────────────────────────────────

  private applySettings(s: Settings): void {
    this.settings = s;
    this.audio.volumes = { master: s.master, sfx: s.sfx, music: s.music };
    this.audio.applyVolumes();
    this.input.edgeScroll = s.edgeScroll;
    const q = qualityPreset(s.quality);
    if (this.renderer && this.lastQuality !== s.quality) {
      if (this.lastQuality !== null) this.renderer.setQuality(q);
      this.lastQuality = s.quality;
    }
  }

  private lastQuality: Settings['quality'] | null = null;

  /** Drop to a lighter preset if the first seconds run slowly, unless the player chose a quality. */
  private watchPerformance(dt: number): void {
    if (!this.settings.qualityAuto || this.perf.checks >= 2 || this.params.has('quality')) return;
    this.perf.frames++;
    this.perf.time += dt;
    if (this.perf.time < 4) return;
    const fps = this.perf.frames / this.perf.time;
    this.perf.frames = 0;
    this.perf.time = 0;
    this.perf.checks++;
    if (fps >= 38) {
      this.perf.checks = 2;
      return;
    }
    const next = this.settings.quality === 'high' ? 'medium' : this.settings.quality === 'medium' ? 'low' : null;
    if (next) this.menus.autoQuality(next);
  }

  private resize(): void {
    this.renderer.resize();
    this.battle?.fx.setViewport(this.canvas.clientHeight * Math.min(2, window.devicePixelRatio || 1), this.renderer.rig.camera.fov);
  }

  private project3(p: THREE.Vector3): { x: number; y: number } | null {
    const v = this.tmp.copy(p).project(this.renderer.rig.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight };
  }

  /** For dev tooling: units on the field. */
  debugUnits(): Unit[] {
    return this.world.units;
  }
}
