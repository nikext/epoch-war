// Dev: a long AI-vs-AI war rendered in the browser; reports errors and scene stats as it goes.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const root = process.env.HOME + '/.cache/ms-playwright';
const dir = readdirSync(root).find((d) => d.startsWith('chromium_headless_shell'));
const browser = await chromium.launch({ executablePath: `${root}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5180/?play=veteran&autopilot&quality=low&speed=3', { waitUntil: 'load' });
await page.waitForTimeout(2000);
for (let i = 0; i < 12; i++) {
  // Jump the war ahead a couple of minutes at a time, then let it render.
  const s = await page.evaluate(() => {
    const g = window.__game;
    g.fastForward(110);
    const w = g.world;
    return { t: Math.round(w.time), ages: w.sides.map((x) => x.age), units: w.units.length, views: g.battle.viewCount, winner: w.winner, mode: g.mode, project: w.sides.map((x) => Math.round(x.project)) };
  });
  await page.waitForTimeout(2500);
  console.log(JSON.stringify(s));
  if (s.winner !== null) break;
}
await page.waitForTimeout(4000);
await page.screenshot({ path: 'shots/soak-end.png' });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
