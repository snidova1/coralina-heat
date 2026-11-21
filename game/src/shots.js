// Deterministic in-engine compositions for the four judging screenshots.
import { Actor } from './actors.js';
import { Helicopter } from './police.js';
import { randomLook } from './humanoid.js';
import { MISSIONS, CAST } from './story.js';
import { goldenHour, dressDrift, dressMarina, lightOceanDrive, coastBackdrop, openDriverDoor, targetBadge, TITLE_COAST } from './shot-art.js';

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

function walker(game, x, z, heading, look) {
  const a = new Actor(game, 'civilian', x, z, look);
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
    goldenHour(game, [0.84, 0.108, 0.54]);
    game.day.hemi.intensity = 1.68;
    game.stats.cash = 48250;
    const p = game.player;
    const hero = game.vehicles.spawn('sports', 357.9, -118, Math.PI + 0.53, 0xff2d3c);
    p.vehicle = hero;
    hero.driver = 'player';
    hero.vz = -39;
    hero.speed = 39;
    hero.skid = 1;
    p.updateDriving(0);
    startMission(game, 3, 3);
    game.wanted.setLevel(4);
    const cops = [[361.4, -111.7, 0.13], [364.0, -104.8, 0.18], [364.4, -95.2, 0.04]].map(([x, z, yaw]) => {
      const car = game.police.spawnCruiser(x, z, Math.PI + yaw);
      car.syncMesh(0);
      return car;
    });
    game.vehicles.spawn('taxi', 365.6, -125.8, 0);
    game.vehicles.spawn('pickup', 365, -94, 0);
    for (const z of [-138, -128, -111, -95, -82]) walker(game, 370, z, z < -120 ? 0 : Math.PI);
    dressDrift(game, hero, cops);
    coastBackdrop(game);
    game.police.heli = new Helicopter(game);
    game.police.heli.pos.set(390, 13.1, -93.4);
    game.police.heli.update(0, true);
    game.police.heli.spot.intensity = 1750;
    game.police.heli.rotor.rotation.y = 0.66;
    game.hud.showVehicleName(hero.label);
    camera(game, [351.15, 1.64, -124.8, 364.8, 3.64, -108.2], 51);
  },

  street(game) {
    goldenHour(game, [0.72, 0.19, 0.66]);
    game.day.hemi.intensity = 1.44;
    game.stats.cash = 12780;
    const car = game.vehicles.spawn('sports', 43.6, -129, Math.PI, 0xff2d3c);
    openDriverDoor(game, car);
    const p = game.player;
    p.current = 'fists';
    p.position.set(46.29, 0.02, -128.05);
    p.heading = -1.14;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    p.body.reach = [[0.02, 1.26, 0.78], [0.22, 1.05, 0.72]];
    p.body.speed = 3.2;
    p.body.update(0.37);
    p.body.hips.rotation.x = 0.17;
    if (p.body.arms) {
      p.body.arms[0].shoulder.rotation.set(-1.45, 0, -0.47);
      p.body.arms[0].elbow.rotation.x = -0.3;
      p.body.arms[1].shoulder.rotation.set(-1.25, 0, 0.15);
      p.body.arms[1].elbow.rotation.x = -0.46;
    }
    if (p.body.model) p.body.model.rotation.x = 0.14;
    const driverLook = { ...randomLook(), skirt: true, resortBlue: true };
    const driver = walker(game, 45.37, -129.23, 0.95, driverLook);
    driver.body.reach = [[-0.48, 1.61, 0.37], [0.59, 1.50, 0.23]];
    driver.body.update(0.29);
    driver.body.hips.position.y -= 0.17;
    driver.body.hips.rotation.x = 0.38;
    if (driver.body.arms) {
      driver.body.arms[0].shoulder.rotation.set(-2.18, 0, -0.62);
      driver.body.arms[1].shoulder.rotation.set(-1.13, 0, 0.43);
      driver.body.arms[1].elbow.rotation.x = -0.57;
    }
    if (driver.body.model) driver.body.model.rotation.set(0.31, 0.12, -0.20);
    for (const [x, z, yaw] of [[49, -139, 0], [51, -150, 0.25], [31, -141, -0.15], [33, -151, 0], [48, -171, 0.3], [53, -122, -1.1], [30, -134, 0.8]]) walker(game, x, z, yaw);
    game.vehicles.spawn('taxi', 36.5, -146, 0.1);
    game.vehicles.spawn('pickup', 43.8, -168, Math.PI);
    game.vehicles.spawn('sedan', 36.4, -184, 0);
    game.hud.setObjective('Hot Wheels', 'Steal Ocho’s ~Vortice GT~.');
    game.hud.subtitle(CAST.vera.name, CAST.vera.color, 'That’s Ocho’s car. Get in before he knows it’s gone.', 4);
    camera(game, [49.2, 1.91, -125.38, 44.65, 1.29, -130.02], 54);
  },

  mission(game) {
    goldenHour(game, [0.79, 0.10, 0.60]);
    dressMarina(game);
    game.vehicles.spawn('pickup', 155.5, 380.8, 1.5, 0x264a49);
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
    const positions = [[156.9, 385.7], [151.9, 383.15], [150.7, 388.9], [155.6, 388.4], [163, 381.5], [167, 388.75]];
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
    camera(game, [141.01, 1.92, 385.34, 156.3, 1.56, 387.25], 49);
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
    goldenHour(game, [-0.44, 0.08, 0.89]);
    game.day.hemi.intensity = 1.54;
    lightOceanDrive(game);
    game.player.position.set(368, 0, -236);
    game.player.body.root.visible = false;
    game.menu.title();
    camera(game, TITLE_COAST, 51);
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
