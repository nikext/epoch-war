// Dev: open the turret popover on an empty ledge at several window sizes and report where it lands.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const root = process.env.HOME + '/.cache/ms-playwright';
const dir = readdirSync(root).find((d) => d.startsWith('chromium_headless_shell'));
const browser = await chromium.launch({ executablePath: `${root}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sizes = (process.argv[2] ?? '1920x1080,1440x810,1366x768').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5180/?play=recruit&quality=low', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const slot = page.locator('.slot:not(.locked)').first();
  const label = await slot.innerText();
  await slot.click();
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const p = document.querySelector('.popover');
    const r = p.getBoundingClientRect();
    const opts = [...p.querySelectorAll('.opt')].map((o) => o.textContent.trim().slice(0, 30));
    return { shown: p.classList.contains('show'), display: getComputedStyle(p).display, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], opts, zoom: document.querySelector('.hud').style.zoom, vw: innerWidth, vh: innerHeight };
  });
  console.log(`${w}x${h}`, JSON.stringify({ label, ...info }), errors.join('; ') || '');
  await page.screenshot({ path: `shots/turret-ui-${w}.png` });
  await page.close();
}
await browser.close();
