// Served-surface QA at desktop, portrait and short landscape sizes.
// Usage: node tools/verify-surfaces.mjs <absolute evidence directory>
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('D:/Claude/alloy/node_modules/');
const puppeteer = require('puppeteer-core');
const root = fileURLToPath(new URL('..', import.meta.url));
assert.ok(process.argv[2], 'Pass an evidence directory outside the shipped game');
const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ['serve.ts', '--port', '8094'], { cwd: root, stdio: 'ignore' });
let browser;
const results = [];
try {
  await new Promise((r) => setTimeout(r, 800));
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  for (const [name, width, height, mobile] of [['desktop', 1280, 720, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true]]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const inspect = (selectors) => page.evaluate((selectors) => selectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).opacity !== '0')
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { selector, text: el.textContent.trim().slice(0, 100), x: r.x, y: r.y, width: r.width, height: r.height, fits: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
      })), selectors);
    const requireFit = (rows) => { assert.ok(rows.length); for (const row of rows) assert.ok(row.fits, `${name}: ${row.selector} outside viewport`); };
    const capture = (suffix) => page.screenshot({ path: `${out}/${name}-${suffix}.jpg`, type: 'jpeg', quality: 85 });
    const click = async (selector) => {
      if (mobile) await page.tap(selector);
      else await page.click(selector);
    };
    await page.goto('http://localhost:8094/', { waitUntil: 'load' });
    await page.waitForFunction('window.coralina?.mode === "title"', { timeout: 90000 });
    const title = await inspect(['.title-art', '.logo', '.tagline', '.menu-list button', '.menu-foot']);
    requireFit(title);
    await capture('title');
    await click('button[data-act="settings"]');
    const settings = await inspect(['.menu-panel', '.menu-panel label']);
    requireFit(settings);
    const before = await page.evaluate(() => window.coralina.settings.master);
    const slider = await page.$('.menu-panel input[name="master"]');
    const box = await slider.boundingBox();
    const sliderX = box.x + box.width * (before < 0.5 ? 0.8 : 0.2);
    // Actual pointer/touch interaction on the slider track, not an artificial input event.
    if (mobile) await page.touchscreen.tap(sliderX, box.y + box.height / 2);
    else await page.mouse.click(sliderX, box.y + box.height / 2);
    const after = await page.evaluate(() => window.coralina.settings.master);
    assert.notEqual(after, before, `${name}: volume slider did not change settings`);
    const shadowsBefore = await page.evaluate(() => window.coralina.settings.shadows);
    await click('.menu-panel input[name="shadows"]');
    const shadowsAfter = await page.evaluate(() => window.coralina.settings.shadows);
    assert.notEqual(shadowsAfter, shadowsBefore, `${name}: shadows checkbox not wired`);
    await capture('settings');
    await click('button[data-act="controls"]');
    const controls = await inspect(['.menu-panel']);
    if (mobile) assert.ok(controls.every((r) => r.x >= 0 && r.x + r.width <= width), `${name}: controls overflow horizontally`);
    else requireFit(controls);
    await page.$eval('.menu-panel', (el) => { el.scrollTop = el.scrollHeight; });
    const lastControl = await page.$('.menu-panel tr:last-child');
    await lastControl.scrollIntoView();
    const controlEnd = await inspect(['.menu-panel tr:last-child']);
    requireFit(controlEnd);
    await capture('controls');
    // Pause uses the same panel method but different DOM placement and positioning rules.
    await page.evaluate(() => { const g = window.coralina; g.mode = 'play'; g.pause(); });
    await click('button[data-act="settings"]');
    const pauseSettings = await inspect(['.pause .menu-panel', '.pause .menu-panel label']);
    requireFit(pauseSettings);
    await capture('pause-settings');
    await page.goto('http://localhost:8094/?shot=mission&seed=1', { waitUntil: 'load' });
    await page.waitForFunction('window.__shotReady === true', { timeout: 90000 });
    await new Promise((r) => setTimeout(r, 300));
    const hud = await inspect(['.hud-objective', '.hud-topright', '.hud-radar', '.hud-subtitle']);
    requireFit(hud);
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    for (let a = 0; a < hud.length; a++) for (let b = a + 1; b < hud.length; b++) assert.equal(overlaps(hud[a], hud[b]), false, `${name}: HUD elements overlap`);
    await capture('mission');
    assert.deepEqual(errors, []);
    const result = { name, width, height, title, settings, controls, controlEnd, pauseSettings, hud, volumeChanged: before !== after, shadowsChanged: shadowsBefore !== shadowsAfter, errors };
    results.push(result);
    writeFileSync(`${out}/observations.json`, JSON.stringify(results, null, 2));
    console.log(`${name} ${width}x${height}: PASS title, settings pointer/touch, controls scroll, pause settings, mission HUD; no clipping, HUD overlaps or page errors`);
    await page.close();
  }
  console.log(`Evidence: ${out}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
