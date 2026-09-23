// Dev: cast a side-0 special mid-battle and photograph it.
//   node tools/dev/special.mjs <age> <out.png> [delayMs]
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const [age = '0', out = 'shots/special.png', delay = '900'] = process.argv.slice(2);
const root = process.env.HOME + '/.cache/ms-playwright';
const dir = readdirSync(root).find((d) => d.startsWith('chromium_headless_shell'));
const browser = await chromium.launch({ executablePath: `${root}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:5180/?attract&nohud&age=${age}&warmup=45&dist=32`, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const x = await page.evaluate(() => {
  const g = window.__game;
  const w = g.world;
  const foes = w.units.filter((u) => u.side === 1);
  const x = foes.length ? foes.reduce((m, u) => Math.min(m, u.x), 999) + 6 : 60;
  w.sides[0].specialCd = 0;
  w.castSpecial(0, x);
  g.renderer.rig.jump(x);
  return x;
});
await page.waitForTimeout(Number(delay));
await page.screenshot({ path: out });
console.log('saved', out, 'at x', x.toFixed(1));
await browser.close();
