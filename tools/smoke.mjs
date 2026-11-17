// Plays the real game headless for a while: title -> New Game -> walk, steal a car, drive, shoot,
// pause and resume; prints any page errors and the state it ends in.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('D:/Claude/alloy/node_modules/');
const puppeteer = require('puppeteer-core');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'smoke.jpg');
const server = spawn(process.execPath, ['serve.ts', '--port', '8092'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8092/', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 3000));
  await page.click('button[data-act="new"]');
  const key = async (k, ms) => { await page.keyboard.down(k); await new Promise((r) => setTimeout(r, ms)); await page.keyboard.up(k); };
  await new Promise((r) => setTimeout(r, 1500));
  // force play mode in case pointer lock pauses it in headless
  const play = () => page.evaluate(() => { if (window.coralina.mode !== 'play') window.coralina.resume(); });
  await play();
  await key('KeyW', 1500); await play();
  // walk to the nearest car and steal it
  await page.evaluate(() => {
    const g = window.coralina; const v = g.vehicles.list[0];
    if (v) g.player.position.set(v.position.x + 2, 0.16, v.position.z);
  });
  await key('KeyF', 100); await play();
  await key('KeyW', 3000); await play();
  await key('KeyD', 600); await play();
  await key('Space', 500); await play();
  await key('KeyF', 100); await play();
  await page.evaluate(() => window.coralina.player.giveWeapon('pistol', 30));
  for (let i = 0; i < 4; i++) { await page.mouse.click(640, 360); await play(); }
  await key('KeyR', 100);
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => window.coralina.wanted.setLevel(4));
  await new Promise((r) => setTimeout(r, 6000));
  await play();
  const state = await page.evaluate(() => {
    const g = window.coralina;
    return { mode: g.mode, hp: g.player.health, inCar: !!g.player.vehicle, wanted: g.wanted.level, cars: g.vehicles.list.length, peds: g.pedestrians.list.length, cops: g.police.cars.length, heli: !!g.police.heli, fps: 0, mission: g.missions.index, active: !!g.missions.active };
  });
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  state.fps = fps;
  console.log(JSON.stringify(state));
  await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
} finally {
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no errors');
  await browser.close();
  server.kill();
}
