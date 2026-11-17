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
    for (const [z, off] of [[-32, 3.0], [-24, -0.2], [-14, 3.6]]) {
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
      if (game.police.heli) game.police.heli.pos.set(car.position.x - 9, 17, car.position.z + 34);
    });
    car.controls.handbrake = false;
    const c = car.position;
    camOverride(game, [c.x + 5.5, 2.3, c.z - 9.5, c.x - 1.8, 1.9, c.z + 9], 60);
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
    for (const [x, z, tx, tz] of [[48.6, -112, 48.6, -40], [50.5, -126, 50.5, -30], [31, -104, 31, -180], [31.5, -88, 31.5, -170], [47.2, -140, 47.2, -40], [58, -129.4, 120, -129.4], [70, -130.6, 20, -130.6], [32, -140, 32, -40]]) {
      walker(game, x, z, tx, tz, 1.2 + (x % 3) * 0.15);
    }
    const north = { dx: 0, dz: -1 };
    const south = { dx: 0, dz: 1 };
    for (const [along, dir, type] of [[-30, north, 'taxi'], [-60, north, 'sedan'], [-18, south, 'pickup'], [-48, south, 'sports'], [-70, north, 'sedan']]) {
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
    p.body.speed = 4.6;
    game.missions.talkT = 0;
    game.missions.talkLine = 0;
    game.hud.subtitle(CAST.vera.name, CAST.vera.color, 'Mr. Reyes. Ocho drives a Vortice GT he hasn\'t paid for. I\'d like it to be ~mine~.', 4);
    game.hud.setObjective('Hot Wheels', 'Meet ~Vera Lux~ at the foot of ~Lux Tower~.');
    game.cameraRig.update(DT);
    if (params.get('cam')) camOverride(game, [], 62);
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
    p.position.set(184, 0.16, 381);
    p.giveWeapon('smg', 160);
    p.current = 'smg';
    p.armor = 45;
    p.health = 72;
    startMission(game, 5, 3);
    const enemies = game.missions.enemies;
    for (const e of enemies) e.brain.alert = true;
    game.hud.show(true);
    game.cameraRig.mode = 'foot';
    game.cameraRig.yaw = -Math.PI / 2 - 0.08;
    game.cameraRig.pitch = 0.05;
    p.aiming = true;
    await simulate(game, 1.6, () => {
      p.heading = game.cameraRig.yaw;
      for (const e of enemies) if (e.brain) e.brain.fireT = 5;
    });
    // one goes down, the rest return fire as the player squeezes the trigger
    enemies[2].damage(500, 'player');
    for (let k = 0; k < 40; k++) game.step(DT);
    p.aiming = true;
    p.body.pose = 'aim';
    p.body.setArmed(true);
    p.heading = game.cameraRig.yaw;
    game.cameraRig.update(DT);
    game.cameraRig.update(DT);
    game.cameraRig.update(DT);
    game.camera.fov = 46;
    game.camera.updateProjectionMatrix();
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
    camOverride(game, [470, 60, 40, 40, 30, -160], 55);
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
