// Browser regression for city navigation and the optional career economy. Run from repo root.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire('D:/Claude/alloy/node_modules/');
const puppeteer = require('puppeteer-core');
const server = spawn(process.execPath, ['serve.ts', '--port', '8094'], { stdio: 'ignore' });
let browser;
try {
  await new Promise(r => setTimeout(r, 800));
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const waitMode = value => page.waitForFunction(v => window.coralina?.mode === v, { timeout: 45000 }, value);
  const button = s => page.click(`::-p-text(${s})`);
  const place = (x,z) => page.evaluate((x,z) => coralina.player.position.set(x,.16,z), x,z);
  const use = async name => {
    await page.waitForFunction(n => document.querySelector('.hud-interact span').textContent === n, {}, name);
    await page.keyboard.press('KeyB');
    await waitMode('service');
  };
  await page.goto('http://localhost:8094/', { waitUntil: 'load' });
  await waitMode('title');
  await page.click('[data-act="new"]');
  await waitMode('play');
  await page.waitForFunction('coralina.input.locked');
  await page.keyboard.press('KeyP');
  await waitMode('paused');
  await page.waitForFunction('!document.pointerLockElement');
  await page.click('[data-act="resume"]');
  await waitMode('play');
  await page.waitForFunction('coralina.input.locked');
  await page.keyboard.press('KeyM');
  await waitMode('atlas');
  await button('Marisol Supply');
  assert.equal(await page.$eval('.city-atlas output', e => e.textContent), 'Tracking: Marisol Supply');
  await button('Back to the street');
  await waitMode('play');
  await place(49,-116);
  await use('Marisol Supply');
  await button('Kestrel .45');
  assert.deepEqual(await page.evaluate(() => [coralina.stats.cash, coralina.player.current, coralina.player.ammoState.clip]), [75,'pistol',12]);
  await button('Body armour');
  assert.equal(await page.$eval('.service-panel output', e => e.textContent), 'Not enough cash.');
  await button('Back to the street');
  await waitMode('play');
  await page.waitForFunction('coralina.input.locked');
  await page.keyboard.down('Tab');
  await page.waitForFunction('coralina.wheel.active');
  await page.keyboard.press('Digit1');
  await page.waitForFunction('coralina.wheel.selected === "fists"');
  await page.keyboard.up('Tab');
  await page.waitForFunction('!coralina.wheel.active && coralina.player.current === "fists"');
  console.log('PASS: Atlas waypoint, supply purchase and insufficient funds');

  await page.evaluate(() => {
    const g = coralina;
    const v = g.vehicles.spawn('sports', 361,-152,0,0xe04438);
    v.driver = 'player'; g.player.vehicle = v; g.player.updateDriving(0);
  });
  await use('Bay Dispatch');
  await button('Morning Edition');
  await waitMode('play');
  const pay = await page.evaluate(() => {
    const g = coralina, j = g.sideJobs, p = g.player;
    const route = j.plan.route, before = g.stats.cash;
    // Exercise ordered checkpoint progression without waiting for a full drive.
    for (const [x,z] of route.stops) { p.vehicle.position.set(x,.02,z); p.position.set(x,.02,z); j.update(.3); }
    if (j.plan || !j.best[route.name]) throw new Error('Incomplete delivery');
    const v = p.vehicle;
    v.position.set(351,.02,-160); v.vx = v.vz = v.speed = 0;
    p.updateDriving(0);
    return g.stats.cash - before;
  });
  assert.ok(pay > 930);
  await use('Flamingo Rest');
  await button('Store current car');
  await waitMode('play');
  assert.equal(await page.evaluate(() => coralina.sideJobs.parked.type), 'sports');
  await page.reload({ waitUntil: 'load' });
  await waitMode('title');
  await page.click('[data-act="continue"]');
  await waitMode('play');
  assert.equal(await page.evaluate(() => coralina.sideJobs.parked.type), 'sports');
  assert.equal(await page.evaluate(() => coralina.sideJobs.next), 1);
  await use('Flamingo Rest');
  await button('Retrieve stored car');
  await waitMode('play');
  assert.equal(await page.evaluate(() => coralina.sideJobs.parked), null);
  assert.ok(await page.evaluate(() => !!coralina.vehicles.nearest(355,-162,3,v => v.type === 'sports')));
  assert.deepEqual(errors, []);
  console.log('PASS: Dispatch checkpoint payout, garage storage, save reload and retrieval; no Chrome errors');
} finally {
  await browser?.close();
  server.kill();
}
