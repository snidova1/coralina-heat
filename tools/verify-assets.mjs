// Real-browser assertions for the asset path, actor isolation, gameplay and procedural fallback.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('D:/Claude/alloy/node_modules/');
const puppeteer = require('puppeteer-core');
const cwd = fileURLToPath(new URL('..', import.meta.url));
const server = spawn(process.execPath, ['serve.ts', '--port', '8093'], { cwd, stdio: 'ignore' });
let browser;
try {
  await new Promise((r) => setTimeout(r, 800));
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const shot of ['chase', 'street', 'mission', 'title']) {
    await page.goto(`http://localhost:8093/?shot=${shot}&seed=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__shotReady === true', { timeout: 90000 });
    const state = await page.evaluate(() => {
      const g = window.coralina;
      const assets = {};
      g.scene.traverse((o) => { if (o.userData.asset) assets[o.userData.asset] = (assets[o.userData.asset] || 0) + (o.isInstancedMesh ? o.count : 1); });
      const bounds = (o) => {
        const b = new g.THREE.Box3().setFromObject(o);
        return { min: b.min.toArray(), max: b.max.toArray(), size: b.getSize(new g.THREE.Vector3()).toArray() };
      };
      return { loaded: g.assetReport.loaded.length, failed: g.assetReport.failed, assets, player: g.player.body.root.userData.asset, weapon: g.player.current, wanted: g.wanted.level, cars: g.vehicles.list.map((v) => ({ type: v.type, asset: v.root.userData.asset, bounds: bounds(v.body) })), groundY: g.player.position.y, playerBounds: bounds(g.player.body.model), render: g.renderer.info.render };
    });
    assert.equal(state.loaded, 17);
    assert.deepEqual(state.failed, []);
    assert.equal(state.player, 'ch_player');
    for (const name of ['prop_palm', 'prop_umbrella', 'prop_lifeguard', 'prop_foodtruck']) assert.ok(state.assets[name] > 0, name);
    assert.ok(state.cars.every((v) => v.asset), 'All vehicles use GLBs');
    assert.ok(state.cars.every((v) => v.bounds.min[1] >= -0.025), 'No car sinks below asphalt');
    if (shot === 'street' || shot === 'mission') assert.ok(Math.abs(state.playerBounds.min[1] - state.groundY) < 0.06, 'Feet contact ground');
    if (shot === 'chase') { assert.equal(state.wanted, 4); assert.ok(state.cars.filter((v) => v.type === 'police').length >= 3); }
    if (shot === 'mission') { assert.equal(state.weapon, 'pistol'); assert.ok(state.assets.ch_gang >= 6); }
    console.log(shot, JSON.stringify({ loaded: state.loaded, failed: state.failed, assets: state.assets, player: state.player, weapon: state.weapon, wanted: state.wanted, footGap: state.playerBounds.min[1] - state.groundY, calls: state.render.calls, triangles: state.render.triangles }));
  }
  await page.goto('http://localhost:8093/', { waitUntil: 'load' });
  await page.waitForFunction('window.coralina?.mode === "title"', { timeout: 90000 });
  const mechanics = await page.evaluate(async () => {
    const g = window.coralina;
    const { Actor } = await import('/src/actors.js');
    g.startGame(false);
    g.mode = 'paused';
    const a = new Actor(g, 'cop', 350, -200);
    const b = new Actor(g, 'thug', 350, -205);
    const independent = a.body.mixer !== b.body.mixer && a.body.bones.RightArm !== b.body.bones.RightArm;
    const p = g.player;
    p.position.set(363, 0.02, -160);
    const car = g.vehicles.spawn('sports', 363, -160, Math.PI);
    p.tryEnterVehicle();
    const entered = p.vehicle === car;
    car.controls.throttle = 1;
    for (let i = 0; i < 60; i++) car.update(1 / 60);
    const drove = Math.abs(car.speed) > 10;
    p.exitVehicle();
    const exited = !p.vehicle;
    p.giveWeapon('pistol', 36);
    p.current = 'pistol';
    p.weapons.pistol.clip = 0;
    p.reload();
    p.finishReload();
    const reloaded = p.ammoState.clip === 12;
    p.body.pose = 'aim'; p.body.setArmed(true); p.body.update(1 / 60);
    g.combat.playerShoot();
    const fired = g.effects.tracers.length > 0;
    g.wanted.setLevel(4);
    g.police.update(0.1);
    const helicopter = !!g.police.heli;
    a.damage(1000, 'player'); a.sync(0.5);
    const killed = !a.alive && a.body.pose === 'dead';
    p.takeDamage(1000); p.respawn(351, -150);
    const respawned = !p.dead && p.health === 100;
    g.save.save();
    const saved = g.save.hasSave();
    a.dispose(); b.dispose();
    g.police.clearAll(); g.wanted.setLevel(0);
    g.mode = 'play'; g.menu.hide();
    return { independent, entered, drove, exited, reloaded, fired, helicopter, killed, respawned, saved };
  });
  for (const [key, value] of Object.entries(mechanics)) assert.equal(value, true, key);
  console.log('mechanics', JSON.stringify(mechanics));
  const performanceResult = await page.evaluate(() => new Promise((resolve) => {
    let n = 0; const start = performance.now();
    const tick = () => {
      n++;
      if (performance.now() - start >= 4000) resolve({ fps: n * 1000 / (performance.now() - start), calls: window.coralina.renderer.info.render.calls, triangles: window.coralina.renderer.info.render.triangles });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  console.log('performance', JSON.stringify(performanceResult));
  assert.deepEqual(errors, []);
  const fallback = await browser.newPage();
  await fallback.setRequestInterception(true);
  fallback.on('request', (r) => r.url().includes('/assets/') ? r.abort() : r.continue());
  fallback.on('pageerror', (error) => errors.push(error.message));
  await fallback.goto('http://localhost:8093/?shot=mission&seed=1', { waitUntil: 'load' });
  await fallback.waitForFunction('window.__shotReady === true', { timeout: 90000 });
  const fallbackState = await fallback.evaluate(() => ({ failed: window.coralina.assetReport.failed.length, procedural: !window.coralina.player.body.mixer }));
  assert.equal(fallbackState.failed, 17);
  assert.equal(fallbackState.procedural, true);
  assert.deepEqual(errors, []);
  console.log('fallback', JSON.stringify(fallbackState));
  console.log('PASS: all asset scenes, mechanics, isolated skeletons and offline fallbacks');
} finally {
  if (browser) await browser.close();
  server.kill();
}
