// Screenshot scenes behind ?shot=<name>&seed=1. Each sets up a real moment of play with the game's
// own systems (a police chase on Ocean Drive, a walk through Coral Heights, the marina shootout,
// the title screen), runs the simulation forward on a fixed clock so the same seed always gives
// the same frame, and renders it with the live HUD.
import { lanePoint } from './roads.js';
import { driveToward } from './traffic.js';
import { Actor } from './actors.js';
import { PedestrianBrain } from './pedestrians.js';
import { ShooterBrain } from './enemies.js';
import { MISSIONS, CAST } from './story.js';

const DT = 1 / 60;
const params = new URLSearchParams(location.search);

function camOverride(game, fallback, fov) {
  const c = (params.get('cam') || fallback.join(',')).split(',').map(Number);
  game.cameraRig.setFixed(c[0], c[1], c[2], c[3], c[4], c[5], Number(params.get('fov') || fov));
}

function frames(n) {
  return new Promise((resolve) => {
    let k = 0;
    const tick = () => (++k >= n ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}

async function simulate(game, seconds, perStep) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    if (perStep) perStep(i, n);
    game.step(DT);
    if (i % 30 === 0) await frames(1);
  }
}

function startMission(game, index, step) {
  const m = game.missions;
  m.index = index;
  m.active = MISSIONS[index];
  m.step = step - 1;
  m.clearContact();
  m.advance();
}

function walker(game, x, z, tx, tz, speed = 1.3) {
  const a = new Actor(game, 'civilian', x, z);
  a.brain = new PedestrianBrain(a, [[x, z], [tx, tz]], false);
  a.brain.speed = speed;
  a.brain.idx = 1;
  a.heading = Math.atan2(tx - x, tz - z);
  game.pedestrians.list.push(a);
  return a;
}

const SCENES = {
  /** The cover: a Vortice GT fleeing three CBPD cruisers up Ocean Drive at golden hour. */
  async chase(game) {
    game.day.setHour(Number(params.get('h') || 18.1));
    game.day.frozen = true;
    game.stats.cash = 48250;
    const p = game.player;
    const north = { dx: 0, dz: -1 };
    const lane = (z, off = 3.4) => lanePoint(9, 0, north, -(z - -360), off);
    const lp = lane(-40);
    const car = game.vehicles.spawn('sports', lp.x, lp.z, Math.PI, 0xff2d3c);
    car.vx = 0; car.vz = -38;
    p.vehicle = car;
    car.driver = 'player';
    p.position.copy(car.position);
    const cops = [];
    for (const [z, off] of [[-30, -0.6], [-24, 3.5], [-17, -1.6]]) {
      const pt = lane(z, off);
      const c = game.police.spawnCruiser(pt.x, pt.z, Math.PI);
      c.vx = 0; c.vz = -37;
      cops.push(c);
    }
    // traffic heading both ways
    for (const [z, off, type, vz] of [[-120, 3.4, 'taxi', -12], [-170, 3.4, 'pickup', -11], [-150, -3.4, 'sedan', 13], [-200, -3.4, 'sedan', 12], [-230, -3.4, 'taxi', 12]]) {
      const pt = lane(z, off);
      const v = game.traffic.spawnAt(9, 0, vz < 0 ? north : { dx: 0, dz: 1 }, 0, type);
      v.position.set(pt.x, 0, pt.z);
      v.heading = vz < 0 ? Math.PI : 0;
      v.vx = 0; v.vz = vz;
      v.driver.ti = 9;
      v.driver.tj = vz < 0 ? Math.floor((pt.z + 360) / 80 - 1e-6) : Math.ceil((pt.z + 360) / 80 + 1e-6);
      v.driver.dir = vz < 0 ? north : { dx: 0, dz: 1 };
    }
    for (let k = 0; k < 9; k++) walker(game, 369 + (k % 3), -170 + k * 17, 369 + (k % 3), -300 + (k % 2) * 400, 1.2 + (k % 3) * 0.2);
    for (let k = 0; k < 5; k++) walker(game, 350.6, -150 + k * 22, 350.6, -300, 1.3);
    startMission(game, 3, 3);
    game.wanted.setLevel(4);
    game.hud.show(true);
    game.cameraRig.mode = 'fixed';
    await simulate(game, 0.8, () => {
      driveToward(car, 362.6, car.position.z - 40, 34, DT);
      car.controls.throttle = 1;
      car.controls.steer = -0.18;
      if (game.police.heli) game.police.heli.pos.set(car.position.x - 7, 19, car.position.z + 30);
    });
    car.controls.handbrake = false;
    car.skid = 1;
    for (let k = 0; k < 5; k++) game.effects.tireSmoke(car.position.x + 0.6, car.position.z + 2 + k * 0.35);
    const c = car.position;
    cops.forEach((v, i) => {
      v.position.set(c.x + [-3.8, 0.1, -4.5][i], 0, c.z + [10, 19, 29][i]);
      v.heading = Math.PI + [0.06, -0.08, 0.04][i];
      v.syncMesh(0);
    });
    for (const [x, z, type] of [[355.3, c.z + 23, 'taxi'], [356.1, c.z + 48, 'pickup']]) {
      const v = game.vehicles.spawn(type, x, z, 0);
      v.vz = 13;
      v.syncMesh(0);
    }
    camOverride(game, [c.x + 6.5, 2.6, c.z - 11, c.x - 2.2, 2.1, c.z + 16], 60);
    game.hud.showVehicleName('Vortice GT');
    game.hud.update(DT);
    game.minimap.update();
    game.render();
    await frames(3);
    game.render();
  },

  /** On foot in Coral Heights: towers, traffic, pedestrians, a phone call from Vera Lux. */
  async street(game) {
    game.day.setHour(Number(params.get('h') || 17.3));
    game.day.frozen = true;
    game.stats.cash = 12780;
    const p = game.player;
    p.position.set(47.6, 0.16, -96);
    p.heading = Math.PI;
    p.current = 'fists';
    for (const [x, z, tx, tz] of [[48.6, -121, 48.6, -200], [50.5, -126, 50.5, -200], [31, -104, 31, -180], [31.5, -88, 31.5, -170], [47.2, -140, 47.2, -200], [58, -129.4, 120, -129.4], [70, -130.6, 20, -130.6], [32, -140, 32, -40], [46.4, -112, 46.4, -200], [51.2, -108, 51.2, -200], [49.5, -118, 49.5, -200], [33, -118, 33, -30], [30.6, -126, 30.6, -200], [52, -134, 52, -30], [36, -129.2, 70, -129.2], [62, -130.8, 0, -130.8], [48, -150, 48, -40], [51.5, -160, 51.5, -40]]) {
      walker(game, x, z, tx, tz, 1.2 + (x % 3) * 0.15);
    }
    const north = { dx: 0, dz: -1 };
    const south = { dx: 0, dz: 1 };
    for (const [along, dir, type] of [[-26, north, 'taxi'], [-52, north, 'sedan'], [-16, south, 'pickup'], [-42, south, 'sports'], [-68, north, 'police'], [-62, south, 'sedan'], [-12, north, 'sedan']]) {
      game.traffic.spawnAt(5, dir === north ? 3 : 2, dir, along, type);
    }
    startMission(game, 3, 0);
    game.missions.update(0);
    game.hud.show(true);
    game.cameraRig.mode = 'foot';
    game.cameraRig.yaw = Math.PI - 0.1;
    game.cameraRig.pitch = 0.12;
    await simulate(game, 2.0, () => {
      p.curSpeed = 4.6;
      const nz = p.position.z - 4.6 * DT;
      p.position.z = nz;
    });
    p.body.speed = 1.65;
    p.body.update(0.12);
    game.missions.talkT = 0;
    game.missions.talkLine = 0;
    game.hud.subtitle(CAST.vera.name, CAST.vera.color, 'Mr. Reyes. Ocho drives a Vortice GT he hasn\'t paid for. I\'d like it to be ~mine~.', 4);
    game.hud.setObjective('Hot Wheels', 'Meet ~Vera Lux~ at the foot of ~Lux Tower~.');
    game.cameraRig.update(DT);
    camOverride(game, [50.6, 2.1, p.position.z + 4.5, 44, 2.4, p.position.z - 24], 60);
    game.hud.update(DT);
    game.minimap.update();
    game.render();
    await frames(3);
    game.render();
  },

  /** The finale shootout at Kingfish Marina: SMG fire, Tiburones shooting back, Saint Ocho. */
  async mission(game) {
    game.day.setHour(Number(params.get('h') || 18.25));
    game.day.frozen = true;
    game.stats.cash = 71400;
    const p = game.player;
    p.position.set(370, 0.16, -84);
    p.giveWeapon('pistol', 72);
    p.current = 'pistol';
    p.armor = 45;
    p.health = 72;
    startMission(game, 5, 3);
    const enemies = game.missions.enemies;
    const positions = [[369.1, -102], [372, -110], [370, -121], [378, -107], [375.5, -125], [371, -133]];
    enemies.forEach((e, i) => {
      e.position.set(positions[i][0], 0.16, positions[i][1]);
      e.brain.guard = { x: e.position.x, z: e.position.z };
      e.brain.alert = true;
      e.brain.range = 45;
      e.brain.strafe = 0;
    });
    game.hud.show(true);
    game.cameraRig.mode = 'foot';
    game.cameraRig.yaw = Math.PI;
    game.cameraRig.pitch = 0.05;
    p.aiming = true;
    await simulate(game, 0.6, () => {
      p.heading = game.cameraRig.yaw;
      for (const e of enemies) if (e.brain) e.brain.fireT = 5;
    });
    // one goes down, the rest return fire as the player squeezes the trigger
    enemies[2].damage(500, 'player');
    for (let k = 0; k < 20; k++) game.step(DT);
    p.aiming = true;
    p.body.pose = 'aim';
    p.body.setArmed(true);
    p.heading = game.cameraRig.yaw;
    game.cameraRig.update(DT);
    game.cameraRig.update(DT);
    game.cameraRig.update(DT);
    game.camera.fov = 46;
    game.camera.updateProjectionMatrix();
    camOverride(game, [371.8, 2.15, -78.5, 371, 1.45, -108], 54);
    game.effects.addMarker(370, -141, 0xffd23f);
    p.body.aimPitch = 0.08;
    p.body.update(0);
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    game.combat.playerShoot();
    for (const e of enemies.filter((x) => x.alive).slice(0, 3)) {
      e.body.pose = 'aim';
      e.heading = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
      e.body.root.rotation.y = e.heading;
      e.body.update(0);
      game.combat.npcShoot(e, 0, 0);
    }
    game.effects.update(0.001);
    game.hud.subtitle(CAST.ocho.name, CAST.ocho.color, 'You came back for THIS? Coralina eats boys like you!', 4);
    game.missions.update(0);
    game.hud.update(DT);
    game.hud.el.crosshair.classList.add('on');
    game.minimap.update();
    if (params.get('cam')) camOverride(game, [], 52);
    game.render();
    await frames(2);
    game.render();
  },

  /** The title screen over a sunset aerial view of the bay. */
  async title(game) {
    game.day.setHour(Number(params.get('h') || 18.45));
    game.day.frozen = true;
    game.player.position.set(200, 0, -100);
    game.player.body.root.visible = false;
    await simulate(game, 1.5);
    game.menu.title();
    camOverride(game, [500, 98, -200, 110, 10, 5], 57);
    game.render();
    await frames(3);
    game.render();
  },
};

export async function runShot(game, name) {
  const scene = SCENES[name] || SCENES.title;
  await frames(2);
  await scene(game);
}
