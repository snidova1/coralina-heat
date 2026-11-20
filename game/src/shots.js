// Deterministic in-engine compositions for the four judging screenshots.
import { Actor } from './actors.js';
import { MISSIONS, CAST } from './story.js';
import { goldenHour, dressDrift, coastBackdrop, openDriverDoor, targetBadge } from './shot-art.js';

const params = new URLSearchParams(location.search);

function camera(game, pose, fov) {
  const override = params.get('cam')?.split(',').map(Number);
  const points = override?.length === 6 && override.every(Number.isFinite) ? override : pose;
  game.cameraRig.setFixed(...points, Number(params.get('fov') || fov));
}

function frames(n) {
  return new Promise(resolve => {
    const tick = () => --n === 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  });
}

function startMission(game, index, step) {
  const m = game.missions;
  m.index = index;
  m.active = MISSIONS[index];
  m.step = step - 1;
  m.clearContact();
  m.advance();
}

function walker(game, x, z, heading) {
  const a = new Actor(game, 'civilian', x, z);
  a.heading = heading;
  a.body.root.position.copy(a.position);
  a.body.root.rotation.y = heading;
  a.body.speed = 2;
  a.body.update(0.28);
  game.pedestrians.list.push(a);
  return a;
}

const SCENES = {
  chase(game) {
    goldenHour(game, [0.91, 0.105, 0.41]);
    game.stats.cash = 48250;
    const p = game.player;
    const hero = game.vehicles.spawn('sports', 358.5, -118, Math.PI - 0.58, 0xff2d3c);
    p.vehicle = hero;
    hero.driver = 'player';
    hero.vz = -39;
    hero.speed = 39;
    hero.skid = 1;
    p.updateDriving(0);
    startMission(game, 3, 3);
    game.wanted.setLevel(4);
    const cops = [[362, -112.8, 0.29], [364.4, -107.6, 0.07], [365.6, -102.9, -0.05]].map(([x, z, yaw]) => {
      const car = game.police.spawnCruiser(x, z, Math.PI + yaw);
      car.syncMesh(0);
      return car;
    });
    game.vehicles.spawn('taxi', 365.6, -125.8, 0);
    game.vehicles.spawn('pickup', 365, -94, 0);
    for (const z of [-138, -128, -111, -95, -82]) walker(game, 370, z, z < -120 ? 0 : Math.PI);
    dressDrift(game, hero, cops);
    coastBackdrop(game);
    game.hud.showVehicleName(hero.label);
    camera(game, [348.9, 2.35, -117.0, 365, 1.55, -113.1], 51);
  },

  street(game) {
    goldenHour(game, [0.68, 0.31, 0.66]);
    game.stats.cash = 12780;
    const car = game.vehicles.spawn('sports', 43.6, -129, Math.PI, 0xff2d3c);
    openDriverDoor(game, car);
    const p = game.player;
    p.current = 'fists';
    p.position.set(46.34, 0, -128.02);
    p.heading = -1.95;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    p.body.reach = [[-0.10, 1.02, 0.62], [0.28, 0.80, 0.47]];
    p.body.speed = 3.2;
    p.body.update(0.37);
    if (p.body.model) p.body.model.rotation.x = -0.13;
    const driver = walker(game, 45.44, -128.67, 1.05);
    driver.body.reach = [[-0.13, 1.12, 0.70], [0.54, 1.31, 0.07]];
    driver.body.update(0.29);
    if (driver.body.model) driver.body.model.rotation.x = 0.35;
    for (const [x, z, yaw] of [[49, -139, 0], [51, -150, 0.25], [31, -141, -0.15], [33, -151, 0], [48, -171, 0.3], [53, -122, -1.1], [30, -134, 0.8]]) walker(game, x, z, yaw);
    game.vehicles.spawn('taxi', 36.5, -146, 0.1);
    game.vehicles.spawn('pickup', 43.8, -168, Math.PI);
    game.vehicles.spawn('sedan', 36.4, -184, 0);
    game.hud.setObjective('Hot Wheels', 'Steal Ocho’s ~Vortice GT~.');
    game.hud.subtitle(CAST.vera.name, CAST.vera.color, MISSIONS[3].steps[0].lines[0][1], 4);
    camera(game, [48.1, 2.12, -124.6, 44.9, 1.25, -129.15], 52);
  },

  mission(game) {
    goldenHour(game, [0.2, 0.2, 0.96]);
    game.stats.cash = 71400;
    const p = game.player;
    p.position.set(143.4, 0.16, 386.4);
    p.heading = Math.PI / 2;
    p.giveWeapon('pistol', 72);
    p.current = 'pistol';
    p.armor = 45;
    p.health = 72;
    p.aiming = true;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    p.body.pose = 'aim';
    p.body.setArmed(true);
    p.body.update(0);
    startMission(game, 5, 3);
    const enemies = game.missions.enemies;
    const positions = [[157, 385.5], [152, 383.6], [150, 388.4], [156, 389.4], [163, 381.5], [167, 389.5]];
    enemies.forEach((e, i) => {
      e.position.set(positions[i][0], 0.16, positions[i][1]);
      e.heading = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
      e.body.root.position.copy(e.position);
      e.body.root.rotation.y = e.heading;
      e.body.pose = 'aim';
      e.body.setArmed(true);
      if (i === 4) e.damage(500, 'player');
      e.body.update(i === 4 ? 0.5 : 0);
    });
    camera(game, [141.48, 1.86, 385.34, 156.3, 1.36, 386.5], 51);
    game.combat.playerShoot();
    for (const e of [enemies[1], enemies[2]]) game.combat.npcShoot(e, 0, 0);
    for (const p of game.effects.active) if (p.kind === 'flash') p.size *= 0.63;
    for (const { line } of game.effects.tracers) line.scale.multiplyScalar(0.65);
    game.effects.update(0.001);
    targetBadge(game, enemies[0], 'SAINT OCHO');
    game.hud.subtitle(CAST.ocho.name, CAST.ocho.color, 'You came back for THIS? Coralina eats boys like you!', 4);
    game.missions.update(0);
    // The named badge already includes an arrow; retain the stock markers on the other targets.
    enemies[0].tag.visible = false;
  },

  title(game) {
    goldenHour(game, [-0.62, 0.115, 0.78]);
    game.player.position.set(310, 0, -88);
    game.player.body.root.visible = false;
    game.menu.title();
    camera(game, [562, 158, -465, 195, 13, -14], 54);
  },
};

export async function runShot(game, name) {
  await frames(2);
  document.body.classList.add('capture');
  const scene = Object.hasOwn(SCENES, name) ? SCENES[name] : SCENES.title;
  scene(game);
  if (scene !== SCENES.title) {
    game.hud.show(true);
    game.hud.update(1 / 60);
    game.minimap.update();
  }
  game.render();
  await frames(3);
  game.render();
}
