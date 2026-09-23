/**
 * Headless AI-vs-AI matches, for balance: how long wars last, when each age is
 * reached, who wins. Run with `npm run bench [games] [difficulty]`.
 */
import { AGES } from '../src/sim/data/ages';
import { DIFFICULTIES, TICK_DT } from '../src/sim/config';
import { AIController } from '../src/sim/ai';
import { World } from '../src/sim/world';
import type { Difficulty } from '../src/sim/types';

const games = Number(process.argv[2] ?? 6);
const diffA = (process.argv[3] ?? 'veteran') as Difficulty;
const diffB = (process.argv[4] ?? diffA) as Difficulty;
const LIMIT = 60 * 60; // an hour of game time

const fmt = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const results: { winner: number | null; time: number; ages: number[][]; kills: number[]; maxUnits: number }[] = [];
const start = performance.now();
let ticks = 0;
for (let g = 0; g < games; g++) {
  const a = DIFFICULTIES[diffA];
  const b = DIFFICULTIES[diffB];
  const world = new World({ seed: 1000 + g, ai: [true, true], power: [a.power, b.power], income: [a.income, b.income] });
  const ais = [new AIController(world, 0, a, 50 + g), new AIController(world, 1, b, 90 + g)];
  let maxUnits = 0;
  while (world.winner === null && world.time < LIMIT) {
    for (const ai of ais) ai.update(TICK_DT);
    world.step(TICK_DT);
    world.events.length = 0;
    maxUnits = Math.max(maxUnits, world.units.length);
    ticks++;
  }
  results.push({
    winner: world.winner,
    time: world.time,
    ages: world.sides.map((s) => s.stats.ageTimes),
    kills: world.sides.map((s) => s.stats.kills),
    maxUnits,
  });
  const r = results[results.length - 1]!;
  console.log(
    `game ${g}: ${r.winner === null ? 'draw ' : `side ${r.winner}`} in ${fmt(r.time)}  ` +
      `ages A=[${r.ages[0]!.map(fmt).join(' ')}] B=[${r.ages[1]!.map(fmt).join(' ')}]  kills ${r.kills.join('/')}  peak units ${r.maxUnits}`,
  );
}
const elapsed = performance.now() - start;
console.log(`\n${games} games, ${(ticks / 30 / 60).toFixed(0)} game-minutes in ${(elapsed / 1000).toFixed(1)}s (${((elapsed / ticks) * 1000).toFixed(1)} µs/tick)`);
const reach = AGES.map((_, i) => results.flatMap((r) => r.ages.map((a) => a[i])).filter((t): t is number => t !== undefined));
console.log('age reached (median time, share of sides):');
reach.forEach((times, i) => {
  times.sort((x, y) => x - y);
  const median = times[times.length >> 1];
  console.log(`  ${AGES[i]!.name.padEnd(20)} ${median === undefined ? '  —  ' : fmt(median)}  ${((times.length / (games * 2)) * 100).toFixed(0)}%`);
});
const wins = [0, 0];
for (const r of results) if (r.winner !== null) wins[r.winner]!++;
console.log(`wins: A ${wins[0]}  B ${wins[1]}  draws ${games - wins[0]! - wins[1]!}`);
