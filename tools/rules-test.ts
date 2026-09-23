/**
 * Rule checks for the simulation — the behaviours the game depends on.
 * Run with `npm test`. Each case builds a world by hand, steps it, asserts.
 */
import { AGES, unitDef } from '../src/sim/data/ages';
import { HOLD_LINE, LANE, PROJECT_COST, PROJECT_TIME, QUEUE_MAX, TICK_DT } from '../src/sim/config';
import type { Unit } from '../src/sim/entities';
import { World, progressOf } from '../src/sim/world';
import type { SideId } from '../src/sim/types';

let failures = 0;
let checks = 0;

function check(name: string, fn: () => void): void {
  checks++;
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}\n       ${(error as Error).message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function world(): World {
  const w = new World({ seed: 7, ai: [false, false] });
  for (const s of w.sides) s.gold = 1e6;
  return w;
}

function place(w: World, side: SideId, id: string, progress: number): Unit {
  const u = w.spawn(side, unitDef(id));
  u.x = side === 0 ? progress : LANE - progress;
  u.prevX = u.x;
  return u;
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += TICK_DT) {
    w.step(TICK_DT);
    w.events.length = 0;
  }
}

check('opposing melee units stop at each other and fight', () => {
  const w = world();
  const a = place(w, 0, 'clubber', 40);
  const b = place(w, 1, 'clubber', 40);
  run(w, 8);
  assert(a.x < b.x, `clubbers passed through each other (${a.x.toFixed(2)} vs ${b.x.toFixed(2)})`);
  assert(!a.alive || !b.alive || a.hp < a.maxHp, 'no damage was dealt');
});

check('ranged units stop at range and shoot over their own front line', () => {
  const w = world();
  place(w, 0, 'clubber', 30);
  const slinger = place(w, 0, 'slinger', 25);
  const enemy = place(w, 1, 'trike-rider', 60);
  enemy.hp = enemy.maxHp = 1e6;
  enemy.stun = 1e9;
  run(w, 10);
  const gap = LANE - progressOf(enemy) - progressOf(slinger);
  assert(gap < 16 && gap > 3, `slinger should hold ~13 m back, gap was ${gap.toFixed(1)}`);
  assert(enemy.hp < enemy.maxHp, 'the slinger never hit');
});

check('a column of ranged units all get in range, not just the one in front', () => {
  // At the enemy wall…
  let w = world();
  w.sides[1].baseHp = w.sides[1].baseMaxHp = 1e9;
  let column = [0, 1, 2].map((k) => place(w, 0, 'slinger', 60 - k * 3));
  run(w, 30);
  for (const u of column) assert(u.state === 'attack', `slinger at ${progressOf(u).toFixed(1)} is ${u.state}, not shooting the wall`);
  // …and behind a front line locked in a fight.
  w = world();
  const front = place(w, 0, 'clubber', 40);
  const foe = place(w, 1, 'clubber', 40);
  for (const u of [front, foe]) u.hp = u.maxHp = 1e9;
  foe.stun = 1e9;
  column = [0, 1, 2, 3].map((k) => place(w, 0, 'slinger', 36 - k * 2));
  run(w, 20);
  for (const u of column) assert(u.state === 'attack', `slinger at ${progressOf(u).toFixed(1)} is ${u.state}, not in the fight`);
});

check('melee cannot hit aircraft but ranged units can', () => {
  const w = world();
  for (const s of w.sides) w.debugSetAge(s.id, 4);
  const plane = place(w, 1, 'biplane', 50);
  plane.hp = plane.maxHp = 1e6;
  plane.stun = 1e9;
  const raider = place(w, 0, 'trench-raider', 49);
  raider.stun = 1e9;
  run(w, 3);
  assert(plane.hp === plane.maxHp, 'a trench raider hurt a biplane');
  const gunner = place(w, 0, 'machine-gunner', 42);
  gunner.hp = gunner.maxHp = 1e6;
  run(w, 3);
  assert(plane.hp < plane.maxHp, 'the machine gunner never hit the biplane');
});

check('kills pay gold and XP to the killer and a little XP to the loser', () => {
  const w = world();
  w.sides[0].gold = 0;
  w.sides[0].xp = 0;
  w.sides[1].xp = 0;
  const victim = place(w, 1, 'clubber', 50);
  w.damageUnit(victim, 1e6, 0, null);
  assert(w.sides[0].gold > victim.def.cost, `killer earned ${w.sides[0].gold}`);
  assert(w.sides[0].xp > 0 && w.sides[1].xp > 0, 'both sides should gain XP');
  assert(w.sides[0].xp > w.sides[1].xp, 'the killer should gain more XP');
});

check('evolving needs XP, raises the wall and opens a doctrine draft', () => {
  const w = world();
  const s = w.sides[0];
  assert(w.evolve(0) === 'xp', 'evolved without XP');
  s.xp = AGES[0]!.xpToNext!;
  const before = s.baseMaxHp;
  assert(w.evolve(0) === 'ok', 'could not evolve with enough XP');
  assert(s.age === 1 && s.baseMaxHp > before, 'wall did not grow');
  assert(s.draft !== null && s.draft.length === 3, 'no draft of three doctrines');
  s.xp = 1e9;
  assert(w.evolve(0) === 'draft', 'evolved again before picking a doctrine');
  const pick = s.draft![0]!;
  assert(w.chooseDoctrine(0, pick) === 'ok' && s.doctrines.includes(pick), 'doctrine not applied');
});

check('doctrines change the numbers they promise', () => {
  const w = world();
  const s = w.sides[0];
  s.draft = ['fortify'];
  const before = s.baseMaxHp;
  w.chooseDoctrine(0, 'fortify');
  assert(Math.abs(s.baseMaxHp - before * 1.3) < 1, `fortify: ${before} → ${s.baseMaxHp}`);
  s.draft = ['war-chest'];
  const gold = s.gold;
  w.chooseDoctrine(0, 'war-chest');
  assert(s.gold > gold, 'war chest paid nothing');
});

check('population cap and queue length limit training; cancel refunds', () => {
  const w = world();
  const s = w.sides[0];
  for (let i = 0; i < QUEUE_MAX; i++) assert(w.train(0, 'clubber') === 'ok', 'could not queue');
  assert(w.train(0, 'clubber') === 'queue', 'queue did not cap');
  const gold = s.gold;
  w.cancel(0, 4);
  assert(s.gold === gold + unitDef('clubber').cost, 'cancel did not refund');
  for (let i = 0; i < AGES[0]!.popCap; i++) place(w, 0, 'clubber', 10 + i * 2);
  assert(w.train(0, 'slinger') === 'pop', 'population cap not enforced');
});

check('the heavy unit must be unlocked first', () => {
  const w = world();
  assert(w.train(0, 'trike-rider') === 'locked', 'trained a locked unit');
  assert(w.unlock(0, 'trike-rider') === 'ok', 'could not unlock');
  assert(w.train(0, 'trike-rider') === 'ok', 'could not train after unlocking');
});

check('turrets shoot enemies in range and splash turrets respect minimum range', () => {
  const w = world();
  w.buyTurret(0, 0, 'rock-sling');
  const far = place(w, 1, 'clubber', LANE - 15);
  far.hp = far.maxHp = 1e6;
  run(w, 3);
  assert(far.hp < far.maxHp, 'rock sling never fired');
  const w2 = world();
  w2.buySlot(0);
  w2.buyTurret(0, 0, 'boulder-catapult');
  const close = place(w2, 1, 'clubber', LANE - 1.5);
  close.hp = close.maxHp = 1e6;
  run(w2, 4);
  assert(close.hp === close.maxHp, 'catapult hit a unit under the wall');
});

check('holding the line pulls units back under the turrets', () => {
  const w = world();
  const u = place(w, 0, 'clubber', 60);
  w.setStance(0, 'hold');
  run(w, 20);
  assert(progressOf(u) <= HOLD_LINE + 0.5, `unit at ${progressOf(u).toFixed(1)} m, hold line ${HOLD_LINE}`);
});

check('front-liners walk through their own ranged units', () => {
  const w = world();
  const archer = place(w, 0, 'slinger', 20);
  archer.hp = archer.maxHp = 1e6;
  archer.stun = 1e9;
  const club = place(w, 0, 'clubber', 16);
  run(w, 6);
  assert(progressOf(club) > progressOf(archer), 'clubber got stuck behind the slinger');
});

check('specials: meteors hurt, rally heals, override converts', () => {
  const w = world();
  const target = place(w, 1, 'clubber', 50);
  target.hp = target.maxHp = 1e6;
  target.stun = 1e9;
  w.sides[0].specialCd = 0;
  assert(w.castSpecial(0, target.x) === 'ok', 'meteor did not cast');
  assert(w.castSpecial(0, target.x) === 'cooldown', 'no cooldown');
  run(w, 8);
  assert(target.hp < target.maxHp, 'no meteor hit');

  const w2 = world();
  w2.debugSetAge(0, 3);
  const hurt = place(w2, 0, 'duelist', 20);
  hurt.hp = hurt.maxHp * 0.2;
  w2.sides[0].specialCd = 0;
  w2.castSpecial(0);
  assert(hurt.hp > hurt.maxHp * 0.6 && hurt.buff > 0, 'rally did not heal and buff');

  const w3 = world();
  for (const s of w3.sides) w3.debugSetAge(s.id, 6);
  const mech = place(w3, 1, 'warden-mech', 45);
  const omega = place(w3, 1, 'omega', 50);
  w3.sides[0].specialCd = 0;
  w3.castSpecial(0, 52);
  run(w3, 1.5);
  assert(mech.side === 0 && mech.converted, 'the mech was not hacked');
  assert(omega.side === 1, 'the apex unit must be immune to Override');
});

check('the Singularity Project wins if it survives, and wall damage sets it back', () => {
  const w = world();
  for (const s of w.sides) w.debugSetAge(s.id, 6);
  w.sides[0].gold = PROJECT_COST;
  assert(w.startProject(0) === 'ok', 'could not start the project');
  run(w, 30);
  const before = w.sides[0].project;
  w.sides[0].baseHp -= 0;
  const hitter = place(w, 1, 'android', LANE - 10);
  hitter.hp = hitter.maxHp = 1e9;
  run(w, 5);
  assert(w.sides[0].project < before + 5, 'wall damage did not slow the project');
  const w2 = world();
  for (const s of w2.sides) w2.debugSetAge(s.id, 6);
  w2.sides[0].gold = PROJECT_COST;
  w2.startProject(0);
  run(w2, PROJECT_TIME + 1);
  assert(w2.winner === 0, 'the project did not win the war');
});

check('a destroyed wall ends the war', () => {
  const w = world();
  w.sides[1].baseHp = 1;
  const u = place(w, 0, 'clubber', LANE - 1);
  void u;
  run(w, 3);
  assert(w.winner === 0, 'no winner after the wall fell');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
