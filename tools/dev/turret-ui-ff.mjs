// Dev: the turret popover in Firefox, at several window sizes.
import { firefox } from 'playwright-core';
const browser = await firefox.launch();
const sizes = (process.argv[2] ?? '1920x1080,1366x768').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5180/?play=recruit&quality=low', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const slot = page.locator('.slot:not(.locked)').first();
  const box = await slot.boundingBox();
  await slot.click();
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const p = document.querySelector('.popover');
    const r = p.getBoundingClientRect();
    const s = document.querySelector('.slots').getBoundingClientRect();
    return { shown: p.classList.contains('show'), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], slots: [Math.round(s.left), Math.round(s.top)], zoom: getComputedStyle(document.querySelector('.hud')).zoom, style: [p.style.left, p.style.bottom] };
  });
  console.log(`${w}x${h}`, 'slotBox', JSON.stringify(box), JSON.stringify(info), errors.join('; ') || '');
  await page.screenshot({ path: `shots/ff-turret-${w}.png` });
  await page.close();
}
await browser.close();
