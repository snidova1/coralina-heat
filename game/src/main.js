// Coralina Heat: boots the renderer and every system, wires the game events (deaths, arrests,
// cash, districts), runs the main loop for the title screen, play and pause, and hands the
// ?shot= screenshot scenes to shots.js.
import * as THREE from 'three';
import { preloadAssets, assetReport } from './assets.js';
import { seedRandom, rand } from './rng.js';
import { Input } from './input.js';
import { Roads } from './roads.js';
import { City } from './city.js';
import { DayCycle } from './daycycle.js';
import { Effects } from './effects.js';
import { Vehicles } from './vehicles.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Wanted } from './wanted.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Pickups } from './pickups.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { AudioEngine } from './audio.js';
import { SaveSystem } from './save.js';
import { Menu } from './menu.js';
import { runShot } from './shots.js';
import { NeighborhoodServices } from './neighborhood-services.js';
import { BayMap } from './bay-map.js';
import { WeaponWheel } from './weapon-wheel.js';
import { BurnerPhone } from './burner-phone.js';
import { goldenHour, TITLE_COAST } from './shot-art.js';
import { districtAt, PLACES } from './map.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
seedRandom(Number(params.get('seed') || 1));

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(shotName ? 1 : Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
await preloadAssets(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 4200);

const game = {
  THREE, scene, camera, renderer, assetReport, time: 0, mode: 'loading', godMode: false,
  stats: { cash: 0, missionsDone: 0, kills: 0, distance: 0, carsStolen: 0, busted: 0, wasted: 0 },
};
window.coralina = game;

game.save = new SaveSystem(game);
game.settings = game.save.loadSettings();
game.roads = new Roads(scene);
game.city = new City(scene);
game.day = new DayCycle(game);
game.effects = new Effects(game);
game.vehicles = new Vehicles(game);
game.player = new Player(game);
game.cameraRig = new CameraRig(game);
game.traffic = new Traffic(game);
game.pedestrians = new Pedestrians(game);
game.wanted = new Wanted(game);
game.police = new Police(game);
game.combat = new Combat(game);
game.missions = new Missions(game);
game.pickups = new Pickups(game);
game.hud = new Hud(game, document.getElementById('hud'));
game.minimap = new Minimap(game, game.hud.radarCanvas);
game.audio = new AudioEngine(game);
game.menu = new Menu(game, document.getElementById('menu'));
game.input = shotName ? null : new Input(canvas);
game.services = new NeighborhoodServices(game);
game.chart = new BayMap(game);
game.weaponWheel = new WeaponWheel(game);
game.phone = new BurnerPhone(game);
const grade = document.createElement('div');
grade.className = 'grade';
document.body.appendChild(grade);

game.allActors = function* allActors() {
  yield* game.pedestrians.list;
  yield* game.police.officers;
  yield* game.missions.enemies;
};

game.addCash = (n) => {
  game.stats.cash = Math.max(0, game.stats.cash + n);
  if (n > 0 && game.audio) game.audio.jingle('cash');
};

game.onActorKilled = (actor, source) => {
  if (source !== 'player') return;
  game.stats.kills += 1;
  if (actor.kind === 'civilian') game.wanted.report('killcivilian', actor.position.x, actor.position.z);
  if (actor.kind === 'cop') game.wanted.report('killcop', actor.position.x, actor.position.z);
  if (actor.kind === 'thug' || actor.kind === 'boss' || rand() < 0.3) {
    game.pickups.add('cash', actor.position.x + 0.6, actor.position.z, actor.kind === 'boss' ? 2500 : 40 + Math.floor(rand() * 120), true);
  }
};

game.onCarHit = (a, b) => {
  const mine = a.driver === 'player' ? a : b.driver === 'player' ? b : null;
  const other = mine === a ? b : a;
  if (mine && other.type === 'police' && other.driver && other.driver !== 'player') game.wanted.report('ramcop', mine.position.x, mine.position.z);
};

game.onPlayerDied = () => {
  game.stats.wasted += 1;
  game.hud.banner('FLATLINED', 'Hospital bill: $500', '#ff3b4f', 4.5);
  if (game.missions.active) game.missions.fail('You went down.');
  game.respawnT = 4.5;
  game.respawnAt = PLACES.hospital;
  game.addCash(-500);
};

game.onBusted = () => {
  if (game.player.dead || game.respawnT > 0) return;
  game.stats.busted += 1;
  game.hud.banner('CUFFED', 'Bail posted: $1,000', '#4f8bff', 4.5);
  if (game.missions.active) game.missions.fail('You got arrested.');
  game.player.body.pose = 'surrender';
  game.respawnT = 4;
  game.respawnAt = PLACES.precinct;
  game.addCash(-1000);
};

game.onWantedCleared = () => {
  game.hud.toast('You lost the cops.');
};

game.applySettings = () => {
  const s = game.settings;
  if (game.input) game.input.sensitivity = s.sensitivity;
  game.audio.setVolume(s.master, s.music);
  game.day.sun.castShadow = s.shadows;
  scene.fog.density = 0.00105 / s.drawDistance;
  camera.far = 2600 * s.drawDistance + 1200;
  camera.updateProjectionMatrix();
};

game.startGame = (cont) => {
  const p = game.player;
  game.missions.cleanup(false);
  game.missions.active = null;
  game.services.reset();
  game.chart.waypoint = null;
  game.respawnT = 0;
  p.respawn(352, -150);
  p.armor = 0;
  p.weapons = { fists: { ammo: Infinity, clip: Infinity } };
  p.current = 'fists';
  p.reloadT = p.fireT = 0;
  game.day.frozen = false;
  game.day.uniforms.sunset.value = 0;
  game.renderer.toneMappingExposure = 1.05;
  game.applySettings();
  game.police.clearAll();
  game.wanted.setLevel(0);
  game.day.setHour(17.6);
  if (cont && game.save.load()) {
    game.hud.toast('Welcome back to Coralina Bay.');
  } else {
    for (const key of Object.keys(game.stats)) game.stats[key] = 0;
    game.stats.cash = 250;
    p.position.set(352, 0.16, -150);
    game.missions.index = 0;
    game.hud.hint('~WASD~ move · ~Mouse~ look · ~F~ steal a car · ~Esc~ pause. Walk into the yellow marker to start a job.', 9);
  }
  game.missions.prepareNext();
  game.mode = 'play';
  game.menu.hide();
  game.hud.show(true);
  game.cameraRig.mode = 'foot';
  game.cameraRig.yaw = Math.PI / 2 + 0.3;
  if (game.input) game.input.lockPointer();
  game.showDistrictFor = 0;
};

game.pause = () => {
  if (game.mode !== 'play') return;
  game.mode = 'paused';
  game.weaponWheel.cancel();
  if (document.pointerLockElement) document.exitPointerLock();
  game.menu.pause();
  if (game.audio.ctx) game.audio.ctx.suspend();
};

game.resume = () => {
  game.mode = 'play';
  game.menu.hide();
  if (game.audio.ctx) game.audio.ctx.resume();
  if (game.input) game.input.lockPointer();
};

game.toTitle = () => {
  if (game.player.vehicle) game.player.exitVehicle();
  game.mode = 'title';
  game.hud.show(false);
  game.cameraRig.mode = 'cinematic';
  game.cameraRig.cine.t = 0;
  goldenHour(game, [-0.44, 0.08, 0.89]);
  game.day.hemi.intensity = 1.54;
  game.cameraRig.cine.centre.set(374, 0, -255);
  game.cameraRig.cine.pose = TITLE_COAST;
  game.menu.title();
  if (game.audio.ctx) game.audio.ctx.resume();
};

/** One step of the simulation: everything that moves. */
game.step = (dt) => {
  game.time += dt;
  const p = game.player;
  p.update(dt);
  game.traffic.update(dt);
  game.police.update(dt);
  game.vehicles.update(dt);
  game.pedestrians.update(dt);
  game.missions.update(dt);
  game.services.update(dt);
  if (game.chart.waypoint && p.position.distanceToSquared(game.chart.markerPosition.set(game.chart.waypoint.x, p.position.y, game.chart.waypoint.z)) < 36) game.chart.waypoint = null;
  game.pickups.update(dt);
  game.wanted.update(dt);
  game.effects.update(dt);
  game.city.update(dt, game.time);
  if (p.vehicle) game.stats.distance += Math.abs(p.vehicle.speed) * dt;
  if (game.respawnT > 0) {
    game.respawnT -= dt;
    if (game.respawnT <= 0) {
      game.police.clearAll();
      game.wanted.setLevel(0);
      p.respawn(game.respawnAt.x, game.respawnAt.z);
      game.missions.prepareNext();
    }
  }
  const district = districtAt(p.position.x, p.position.z);
  if (district !== game.districtName) {
    game.districtName = district;
    if (game.mode === 'play') game.hud.showDistrict(district);
  }
};

game.render = (dt = 0) => {
  const focus = game.player.vehicle ? game.player.vehicle.position : game.player.position;
  game.day.update(game.mode === 'play' ? dt : 0, game.cameraRig.mode === 'cinematic' ? game.cameraRig.cine.centre : focus);
  renderer.render(scene, camera);
};

function onResize() {
  if (shotName) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

if (game.input) {
  canvas.addEventListener('click', () => { if (game.mode === 'play') game.input.lockPointer(); });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game.mode === 'play') game.pause();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && game.mode === 'paused') game.resume();
    else if (e.code === 'KeyM' && !e.repeat && game.mode === 'play') { game.pause(); game.menu.chart(); }
    else if (e.code === 'KeyC' && !e.repeat && game.mode === 'play') { game.pause(); game.menu.phone(); }
    else if ((e.code === 'Escape' || e.code === 'KeyP') && game.mode === 'play') game.pause();
  });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.mode === 'play') {
    game.step(dt);
    game.cameraRig.update(dt);
    game.audio.update();
    game.hud.update(dt);
    game.minimap.update();
  } else if (game.mode === 'title') {
    // the bay keeps living behind the title screen
    game.player.position.set(game.cameraRig.cine.centre.x, 0, game.cameraRig.cine.centre.z);
    game.player.body.root.visible = false;
    game.time += dt;
    game.traffic.update(dt);
    game.vehicles.update(dt);
    game.pedestrians.update(dt);
    game.effects.update(dt);
    game.city.update(dt, game.time);
    game.cameraRig.update(dt);
    game.audio.update();
  }
  game.render(dt);
  if (game.input) game.input.endFrame();
  requestAnimationFrame(frame);
}

game.applySettings();
document.getElementById('loading').classList.add('hidden');
if (shotName) {
  game.mode = 'shot';
  runShot(game, shotName).then(() => { window.__shotReady = true; });
} else {
  game.toTitle();
  requestAnimationFrame(frame);
}
