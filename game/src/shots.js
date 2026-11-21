// Deterministic in-engine compositions for the four judging screenshots.
import { Actor } from './actors.js';
import { Helicopter } from './police.js';
import { districtAt } from './map.js';
import { MISSIONS, CAST } from './story.js';
import { goldenHour, dressDrift, dressMarina, lightOceanDrive, coastBackdrop, openDriverDoor, targetBadge } from './shot-art.js';

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

function walker(game, x, z, heading, speed = 2) {
  const a = new Actor(game, 'civilian', x, z);
  a.heading = heading;
  a.body.root.position.copy(a.position);
  a.body.root.rotation.y = heading;
  a.body.speed = speed;
  a.body.update(0.28);
  game.pedestrians.list.push(a);
  return a;
}

const SCENES = {
  chase(game) {
    goldenHour(game, [0.94, 0.078, 0.34]);
    game.stats.cash = 48250;
    const p = game.player;
    const hero = game.vehicles.spawn('sports', 358.5, -118, Math.PI - 0.58, 0xff2d3c);
    p.vehicle = hero;
    hero.driver = 'player';
    hero.vz = -39;
    hero.speed = 39;
    hero.skid = 1;
    hero.body.rotation.z = 0.055;
    p.updateDriving(0);
    startMission(game, 3, 3);
    game.wanted.setLevel(4);
    const cops = [[362, -112.1, 0.29], [364.8, -106.5, 0.07], [366.0, -100.7, -0.05]].map(([x, z, yaw]) => {
      const car = game.police.spawnCruiser(x, z, Math.PI + yaw);
      car.syncMesh(0);
      return car;
    });
    game.vehicles.spawn('taxi', 365.6, -125.8, 0);
    game.vehicles.spawn('pickup', 365, -94, 0);
    for (const [x,z,yaw,speed] of [[370,-138,0,2],[369.5,-128,1.8,5.8],[371,-126,1.2,5.2],[370,-111,.88,5.2],[372,-97,3.14,2],[370,-84,2.8,2]]) walker(game, x, z, yaw, speed);
    const heli = game.police.heli = new Helicopter(game);
    heli.pos.set(414, 21.5, -91);
    heli.spot.angle = .074;
    heli.beam.material.opacity = .047;
    heli.update(0, true);
    // Keep the in-air searchlight; its grazing footprint was detached from the visible cone.
    heli.spot.intensity = 0;
    heli.rotor.rotation.y = .46;
    dressDrift(game, hero, cops);
    coastBackdrop(game);
    game.hud.showVehicleName(hero.label);
    camera(game, [349, 1.94, -118.2, 364.5, 1.91, -113.0], 53);
  },

  street(game) {
    goldenHour(game, [0.72, 0.24, 0.66], true);
    game.stats.cash = 12780;
    const car = game.vehicles.spawn('sports', 43.6, -129, Math.PI, 0xff2d3c);
    openDriverDoor(game, car);
    const p = game.player;
    p.current = 'fists';
    p.position.set(46.42, 0, -127.64);
    p.heading = -2.59;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    p.body.reach = [[-.08, 1.19, .67], [.19, .90, .33]];
    p.body.lean = .15;
    p.body.bank = -.13;
    p.body.speed = 3.2;
    p.body.update(0.37);
    const driver = walker(game, 46.00, -128.58, 0.47, 4.15);
    driver.body.reach = [[-.49, 1.52, .25], [.24, 1.47, .52]];
    driver.body.lean = -.32;
    driver.body.bank = .17;
    driver.body.update(0.26);
    for (const [x, z, yaw] of [[49, -139, 0], [51, -150, 0.25], [31, -141, -0.15], [33, -151, 0], [48, -171, 0.3], [53, -122, -1.1], [30, -134, 0.8]]) walker(game, x, z, yaw);
    game.vehicles.spawn('taxi', 36.5, -146, 0.1);
    game.vehicles.spawn('pickup', 43.8, -168, Math.PI);
    game.vehicles.spawn('sedan', 36.4, -184, 0);
    game.hud.setObjective('Hot Wheels', 'Steal Ocho’s ~Vortice GT~.');
    game.hud.subtitle(CAST.vera.name, CAST.vera.color, 'That’s the Vortice. Don’t let it get away.', 4);
    camera(game, [49.35, 1.86, -125.34, 44.51, 1.29, -129.95], 49);
  },

  mission(game) {
    goldenHour(game, [0.79, 0.10, 0.60]);
    game.day.hemi.color.set(0xdbd9c8);
    dressMarina(game);
    game.vehicles.spawn('pickup', 152.4, 380.8, -Math.PI / 2, 0x385b64);
    game.stats.cash = 71400;
    const p = game.player;
    p.position.set(143.75, 0.16, 386.37);
    p.heading = Math.PI / 2;
    p.giveWeapon('pistol', 72);
    p.current = 'pistol';
    p.armor = 45;
    p.health = 72;
    p.aiming = true;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    p.body.pose = 'aim';
    p.body.lean = .13;
    p.body.setArmed(true);
    p.body.update(0);
    startMission(game, 5, 3);
    const enemies = game.missions.enemies;
    const positions = [[155.4, 385.85], [153.3, 382.9], [149.2, 388.40], [156.8, 389.2], [163, 381.5], [164.5, 385.2]];
    enemies.forEach((e, i) => {
      e.position.set(positions[i][0], 0.16, positions[i][1]);
      e.heading = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
      e.body.root.position.copy(e.position);
      e.body.root.rotation.y = e.heading;
      e.body.pose = 'aim';
      e.body.lean = i === 1 ? .22 : .07;
      e.body.bank = i === 2 ? .21 : 0;
      if (i === 3 || i === 5) { e.body.pose = 'move'; e.body.speed = 5.6; e.body.root.rotation.y += i === 3 ? -1.02 : .78; }
      e.body.setArmed(true);
      e.tag.scale.setScalar(.72);
      if (i === 4) e.damage(500, 'player');
      e.body.update(i === 4 ? 0.5 : i === 3 || i === 5 ? .27 : 0);
    });
    camera(game, [141.82, 1.99, 385.48, 155.0, 1.50, 386.17], 47);
    game.combat.playerShoot();
    for (const e of [enemies[1], enemies[2]]) game.combat.npcShoot(e, 0, 0);
    game.effects.lightAt(p.body.muzzlePosition(new game.THREE.Vector3()), 0xffc070, 7, .05);
    game.effects.updateCasings(.078);
    for (const p of game.effects.active) if (p.kind === 'flash') p.size *= p.s.position.x < 147 ? 1.1 : .68;
    for (const { line } of game.effects.tracers) line.scale.multiplyScalar(0.65);
    game.effects.update(0.001);
    targetBadge(game, enemies[0], 'SAINT OCHO');
    game.hud.subtitle(CAST.ocho.name, CAST.ocho.color, 'You came back for THIS? Coralina eats boys like you!', 4);
    game.missions.update(0);
    game.player.ammoState.clip--;
    // The named badge already includes an arrow; retain the stock markers on the other targets.
    enemies[0].tag.visible = false;
  },

  title(game) {
    goldenHour(game, [-0.44, 0.08, 0.89], true);
    game.city.beachWalk.setNight(.89);
    lightOceanDrive(game);
    game.player.position.set(368, 0, -236);
    game.player.body.root.visible = false;
    for (const item of game.pickups.list) item.group.visible = false;
    game.menu.title();
    camera(game, [460, 15.6, -346, 394, 8.6, -225], 54);
  },
};

export async function runShot(game, name) {
  await frames(2);
  document.body.classList.add('capture');
  const scene = Object.hasOwn(SCENES, name) ? SCENES[name] : SCENES.title;
  scene(game);
  if (scene !== SCENES.title) {
    game.districtName = districtAt(game.player.position.x, game.player.position.z);
    game.hud.show(true);
    game.hud.update(1 / 60);
    game.minimap.update();
  }
  game.render();
  await frames(3);
  game.render();
}
