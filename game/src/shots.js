// Deterministic in-engine compositions for the four judging screenshots.
import { Actor } from './actors.js';
import { Helicopter } from './police.js';
import { randomLook } from './humanoid.js';
import { MISSIONS, CAST } from './story.js';
import { stageTraffic, stageCrowd } from './shot-crowds.js';
import { aim, kneelAim, hit, pointAt, boardCar } from './poses.js';
import { goldenHour, aimChaseSearchlight, dressDrift, dressMarina, lightOceanDrive, coastBackdrop, openDriverDoor, targetBadge, clearSignal, TITLE_COAST } from './shot-art.js';

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
    // Ocean Drive keeps living round the chase: cars pulled to the kerb, the evening crowd scattering.
    stageTraffic(game, [
      ['sedan', 356.6, -84, 0.02, 0x8fb8de], ['taxi', 365.7, -64, Math.PI + 0.05], ['pickup', 354.2, -57, 0],
      ['sedan', 363.4, -42, Math.PI, 0xf7d7e0], ['sports', 356.6, -29, 0, 0x00b8d4], ['taxi', 363.4, -14, Math.PI],
    ]);
    stageCrowd(game, [
      [369.2, -113, -2.5, 'run'], [370.5, -104, Math.PI], [371.4, -95.5, -1.5, 'idle'], [369.8, -88, 0.1],
      [372.1, -80, Math.PI, 'stroll'], [370.6, -71, 0], [381, -104, 2.8, 'stroll'], [382.2, -103.2, 2.9, 'stroll'],
      [386, -95, -0.4], [352.4, -108, Math.PI / 2, 'idle'], [351.6, -100, Math.PI], [352.6, -92, 0.05],
      [351.5, -80, Math.PI, 'run'], [350.9, -70, 0, 'stroll'], [352.6, -111.6, 2.3, 'cower'],
    ]);
    dressDrift(game, hero, cops);
    coastBackdrop(game);
    game.police.heli = new Helicopter(game);
    game.police.heli.pos.set(366, 16, -76);
    game.police.heli.update(0, true);
    // banking across the boulevard, flank to the camera so its livery and tail boom read
    game.police.heli.group.rotation.set(0.1, -2.2, -0.24, 'YXZ');
    aimChaseSearchlight(game.police.heli, 359.2, -112.5);
    game.police.heli.rotor.rotation.y = 0.66;
    game.hud.showVehicleName(hero.label);
    camera(game, [351.7, 2.0, -125.2, 364.0, 2.8, -104.5], 51);
  },

  street(game) {
    goldenHour(game, [0.72, 0.19, 0.66]);
    game.day.hemi.intensity = 1.44;
    game.stats.cash = 12780;
    const car = game.vehicles.spawn('sports', 43.6, -129, Math.PI, 0xff2d3c);
    const door = openDriverDoor(game, car);
    const p = game.player;
    p.current = 'fists';
    p.position.set(45.2, 0.02, -128.95);
    p.heading = -2.35;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    car.root.updateMatrixWorld(true);
    // one hand on the top of the open door, the other reaching for the wheel, leaning in to drop into the seat
    const V = game.THREE.Vector3;
    boardCar(p.body, door.localToWorld(new V(0.02, 1.2, -1.1)), new V(44.3, 1.0, -129.0));
    const veraLook = { ...randomLook(), skirt: true, authoredPalette: true, skin: 0xd9a07a, shirt: 0xd98270, pants: 0xd98270, print: false };
    const vera = new Actor(game, 'civilian', 46.0, -130.02, veraLook);
    vera.position.y = 0.02;
    vera.faceToward(p.position.x, p.position.z, 1);
    vera.sync();
    pointAt(vera.body, new V(43.3, 0.85, -129.4));
    stageCrowd(game, [
      [30.6, -137, Math.PI], [31.4, -144.5, 0, 'stroll'], [29.4, -149, -Math.PI / 2, 'idle'], [30.8, -156, Math.PI],
      [31.6, -163, 0.05], [30.2, -168.5, Math.PI, 'stroll'], [31.0, -176, 0], [30.4, -184, Math.PI],
      [22, -130.6, Math.PI / 2], [14, -131.4, -Math.PI / 2, 'stroll'], [25.2, -132.1, 0.4, 'idle'], [25.8, -131.0, -2.6, 'idle'],
      [48.6, -152, Math.PI], [49.2, -163, 0], [48.4, -178, Math.PI, 'stroll'],
    ]);
    stageTraffic(game, [
      ['taxi', 36.5, -146, 0.1], ['sedan', 43.4, -150, Math.PI, 0x6fd3c4], ['pickup', 43.8, -168, Math.PI],
      ['sedan', 36.4, -184, 0], ['sports', 36.6, -206, 0, 0xffa400], ['taxi', 43.4, -214, Math.PI],
    ]);
    clearSignal(game, 31.95, -128.05);
    game.hud.setObjective('Hot Wheels', 'Steal Ocho’s ~Vortice GT~.');
    game.hud.subtitle(CAST.vera.name, CAST.vera.color, 'That’s Ocho’s car. Get in before he knows it’s gone.', 4);
    camera(game, [48.3, 1.86, -126.0, 44.5, 1.2, -130.2], 54);
  },

  mission(game) {
    goldenHour(game, [0.79, 0.10, 0.60]);
    dressMarina(game);
    game.vehicles.spawn('pickup', 155.5, 380.8, 1.5, 0x264a49);
    game.stats.cash = 71400;
    const p = game.player;
    p.position.set(143.4, 0.16, 386.4);
    // bladed stance: torso turned off the line of fire so the arms and pistol read past his shoulder
    p.heading = Math.PI / 2 + 0.55;
    p.giveWeapon('pistol', 72);
    p.current = 'pistol';
    p.armor = 45;
    p.health = 72;
    p.aiming = true;
    p.body.root.position.copy(p.position);
    p.body.root.rotation.y = p.heading;
    aim(p.body, 0.02, new game.THREE.Vector3(156.9, 1.5, 385.7), 0.02);
    startMission(game, 5, 3);
    const enemies = game.missions.enemies;
    // Ocho and two gunmen fire from their feet, one takes a knee behind the planter, one is hit, one is down.
    const positions = [[156.9, 385.7], [151.9, 383.15], [165.3, 384.0], [155.6, 388.4], [163, 381.5], [167, 388.75]];
    enemies.forEach((e, i) => {
      e.position.set(positions[i][0], 0.16, positions[i][1]);
      e.heading = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
      e.body.root.position.copy(e.position);
      e.body.root.rotation.y = e.heading;
      e.body.setArmed(true);
      if (i === 4) {
        e.damage(500, 'player');
        e.body.update(0.5);
      } else if (i === 2) kneelAim(e.body, 0.04);
      else if (i === 3) {
        hit(e.body);
        const chest = e.chestPos;
        for (let k = 0; k < 7; k++) game.effects.emit('blood', chest.x, chest.y, chest.z, -0.6 + k * 0.2, 0.4 + (k % 3) * 0.3, 0.5 - k * 0.15);
      }
      else aim(e.body, 0.03);
    });
    camera(game, [141.01, 1.92, 385.34, 156.3, 1.56, 387.25], 49);
    game.combat.playerShoot();
    for (const e of [enemies[1], enemies[2]]) game.combat.npcShoot(e, 0, 0);
    for (const p of game.effects.active) if (p.kind === 'flash') p.size *= 0.63;
    for (const { line } of game.effects.tracers) line.scale.multiplyScalar(0.65);
    game.effects.update(0.001);
    // the evening crowd on the marina walk scatters from the gunfire
    stageCrowd(game, [
      [172, 383, Math.PI / 2 + 0.2, 'run'], [178, 389, Math.PI / 2 - 0.1, 'run'], [185, 385, Math.PI / 2, 'run'],
      [192, 381, Math.PI / 2 + 0.3, 'run'], [200, 388, Math.PI / 2], [168, 378.5, Math.PI + 0.4, 'run'],
      [175, 376, Math.PI, 'run'], [187, 374.5, Math.PI - 0.3, 'run'], [166, 391.2, 0.4, 'cower'],
      [162, 374, Math.PI + 0.3, 'run'], [170, 371, Math.PI, 'run'], [181, 379.5, Math.PI / 2, 'run'],
    ]);
    // the first CBPD unit noses onto the marina walk
    game.police.spawnCruiser(195, 377.6, -Math.PI / 2 + 0.3).syncMesh(0);
    game.wanted.setLevel(1);
    targetBadge(game, enemies[0], 'SAINT OCHO');
    game.hud.subtitle(CAST.ocho.name, CAST.ocho.color, 'You came back for THIS? Coralina eats boys like you!', 4);
    game.missions.update(0);
    // The named badge already includes an arrow; retain the stock markers on the other targets.
    enemies[0].tag.visible = false;
  },

  title(game) {
    goldenHour(game, [-0.44, 0.08, 0.89]);
    game.day.hemi.intensity = 1.54;
    // a higher fill angle than the disc, so the sand reads; the disc stays on the horizon
    game.day.sunDirection = new game.THREE.Vector3(-0.44, 0.2, 0.89).normalize();
    lightOceanDrive(game);
    stageCrowd(game, [
      [430.5, -328, 0.1], [429.6, -318, Math.PI, 'stroll'], [430.2, -306, 0.05, 'stroll'], [431.2, -304.8, 0.1, 'stroll'],
      [428.8, -290, Math.PI], [429.5, -276, 0, 'run'], [430, -262, Math.PI, 'stroll'], [436, -312, -1.2, 'idle'],
      [403.2, -322.6, 0, 'idle'], [406.8, -323, 0.1, 'idle'], [403.5, -313.2, Math.PI, 'idle'], [407.2, -313.8, Math.PI + 0.2, 'idle'],
      [414, -327, 1.2, 'idle'], [415.2, -326.2, -2.0, 'idle'], [412, -336, 0.3], [395, -301, Math.PI / 2], [392, -286, 2.5, 'stroll'],
      [386, -271, 0], [370.5, -300, 0], [371, -292, Math.PI], [369.8, -280, 0, 'stroll'], [370.6, -268, Math.PI], [370.2, -255, 0],
      [425, -330, 0.2, 'stroll'], [424.2, -329, 0.3, 'stroll'], [419, -323, 2.0, 'idle'], [420, -322.4, -1.4, 'idle'],
      [427, -316, Math.PI], [416, -336, 1.0], [408, -330, -0.5, 'idle'], [433, -322, Math.PI, 'run'],
    ]);
    stageTraffic(game, [
      ['taxi', 363.4, -300, Math.PI], ['sedan', 356.6, -288, 0, 0xf7d7e0], ['pickup', 363.4, -262, Math.PI],
      ['sedan', 356.6, -246, 0, 0x8fb8de], ['sports', 363.4, -228, Math.PI, 0xffa400], ['sedan', 356.6, -210, 0, 0xf4f1ea],
      ['police', 356.6, -322, 0], ['pickup', 404, -298, 0.1, 0xd9d4c7],
    ]);
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
