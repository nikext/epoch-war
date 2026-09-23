/**
 * Screenshots of the running dev server, for checking the renderer headlessly.
 *
 *   node tools/shoot.mjs <url-path-and-query> [out.png] [waitMs] [width] [height]
 *
 * e.g. node tools/shoot.mjs "/?gallery=0" shots/stone.png 4000
 * Uses the Chromium headless shell that Playwright installs under ~/.cache.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const [path = '/', out = 'shots/shot.png', wait = '3000', width = '1600', height = '900'] = process.argv.slice(2);
const base = process.env.SHOOT_BASE ?? 'http://localhost:5180';

function findShell() {
  const root = join(homedir(), '.cache/ms-playwright');
  for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse()) {
    const exe = join(root, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (existsSync(exe)) return exe;
  }
  throw new Error('no chromium headless shell found');
}

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({
  executablePath: findShell(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(base + path, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
