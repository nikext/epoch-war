// Dev: every way to buy a turret — panel clicks, the T key, and clicking the ledge on the 3D tower.
//   node tools/dev/turret-flow.mjs [firefox|chromium]
import { chromium, firefox } from 'playwright-core';
import { readdirSync } from 'node:fs';
const which = process.argv[2] ?? 'firefox';
const root = process.env.HOME + '/.cache/ms-playwright';
const shell = readdirSync(root).find((d) => d.startsWith('chromium_headless_shell'));
const browser = which === 'firefox'
  ? await firefox.launch()
  : await chromium.launch({ executablePath: `${root}/${shell}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5180/?play=recruit&quality=low', { waitUntil: 'load' });
await page.waitForTimeout(3000);
const st = () => page.evaluate(() => { const s = window.__game.world.sides[0]; return `slots=${s.slots} turrets=[${s.turrets.map((t) => t?.def.id ?? '-')}] popover=${document.querySelector('.popover').classList.contains('show')}`; });
const check = (label, ok) => console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}  ${''}`);

// Panel labels.
const labels = await page.locator('.slots .slot').allInnerTexts();
console.log('panel rows:', labels.map((l) => l.replace(/\s+/g, ' ').trim()).join(' | '));

// 1. Panel: "+ Build turret" opens the chooser.
await page.click('.slot.empty');
await page.waitForTimeout(300);
check('panel click opens turret chooser', (await st()).includes('popover=true'));
await page.screenshot({ path: `shots/turret-${which}-panel.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 2. The T key.
await page.keyboard.press('KeyT');
await page.waitForTimeout(300);
check('T opens turret chooser', (await st()).includes('popover=true'));
await page.locator('.popover .opt').first().click();
await page.waitForTimeout(300);
check('buying from chooser mounts a turret', (await st()).includes('rock-sling'));

// 3. Click the 3D ledge: buy the next ledge, then open its chooser.
await page.evaluate(() => { window.__game.world.sides[0].gold = 5000; window.__game.renderer.rig.jump(4); window.__game.renderer.rig.snap(); });
await page.waitForTimeout(1200);
const target = async (slot) => page.evaluate((slot) => {
  const g = window.__game;
  const hit = g.battle.bases[0].hits[slot];
  const p = hit.getWorldPosition(new hit.position.constructor()).project(g.renderer.rig.camera);
  return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
}, slot);
let t = await target(1);
await page.mouse.move(t.x, t.y);
await page.waitForTimeout(300);
const cursor = await page.evaluate(() => document.getElementById('scene').style.cursor);
check(`hovering a 3D ledge shows a pointer cursor (${cursor || 'none'})`, cursor === 'pointer');
await page.mouse.click(t.x, t.y);
await page.waitForTimeout(400);
check('clicking the next 3D ledge buys it', (await st()).includes('slots=2'));
await page.waitForTimeout(500);
await page.screenshot({ path: `shots/turret-${which}-3d.png` });
t = await target(1);
await page.mouse.click(t.x, t.y);
await page.waitForTimeout(400);
check('clicking an empty 3D ledge opens its chooser', (await st()).includes('popover=true'));
console.log(await st());
console.log(errors.join('\n') || 'no errors');
await browser.close();
