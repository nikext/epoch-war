import { DIFFICULTIES, TICK_DT } from '../../src/sim/config';
import { AIController } from '../../src/sim/ai';
import { World } from '../../src/sim/world';
const seed = Number(process.argv[2] ?? 1003);
const every = Number(process.argv[3] ?? 60);
const until = Number(process.argv[4] ?? 1800);
const d = DIFFICULTIES.veteran;
const world = new World({ seed, ai: [true, true], power: [1, 1], income: [1, 1] });
const ais = [new AIController(world, 0, d, 50 + seed - 1000), new AIController(world, 1, d, 90 + seed - 1000)];
let next = every;
while (world.winner === null && world.time < until) {
  for (const ai of ais) ai.update(TICK_DT);
  world.step(TICK_DT);
  world.events.length = 0;
  if (world.time >= next) {
    next += every;
    const line = world.sides.map((s) => {
      const units = world.units.filter((u) => u.side === s.id);
      const comp: Record<string, number> = {};
      for (const u of units) comp[u.def.id] = (comp[u.def.id] ?? 0) + 1;
      const front = units.reduce((m, u) => Math.max(m, s.id === 0 ? u.x : 100 - u.x), 0);
      return `S${s.id} age${s.age} gold ${s.gold.toFixed(0)} base ${s.baseHp.toFixed(0)}/${s.baseMaxHp.toFixed(0)} front ${front.toFixed(0)} ${s.stance} tur[${s.turrets.map((t) => t?.def.id ?? '-').join(',')}] up ${JSON.stringify(s.upgrades)} unl[${[...s.unlocked].join(',')}] ${JSON.stringify(comp)}`;
    });
    console.log(`${(world.time / 60).toFixed(1)}m\n  ${line.join('\n  ')}`);
  }
}
console.log('winner', world.winner, (world.time / 60).toFixed(1));
