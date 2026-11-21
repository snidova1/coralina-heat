// Capture-only crowds: the passers-by and traffic a busy evening would put round each screenshot,
// built from the same cars and civilians the live city spawns, frozen mid-stride or mid-lane.
import * as THREE from 'three';
import { Actor } from './actors.js';
import { poseable, stride, idle, cower, pointAt } from './poses.js';
import { PedestrianBrain } from './pedestrians.js';
import { rand } from './rng.js';

const GAITS = { idle: 0, point: 0, cower: 0, walk: 1.45, stroll: 1.05, run: 5.8 };

/** Cars as [type, x, z, heading, colour?]; lamps follow the dusk like any live car. */
export function stageTraffic(game, cars) {
  return cars.map(([type, x, z, heading, color]) => {
    const car = game.vehicles.spawn(type, x, z, heading, color);
    car.speed = 0;
    car.syncMesh(0);
    return car;
  });
}

/**
 * People as [x, z, heading, gait?, target?]: walk, stroll and run hold a clip mid-stride; idle stands
 * with the weight on one leg; cower crouches; point aims an arm at `target` ([x, y, z] in the world).
 */
export function stageCrowd(game, people) {
  return people.map(([x, z, heading, gait = 'walk', target]) => {
    const a = new Actor(game, 'civilian', x, z);
    a.brain = new PedestrianBrain(a, [[x, z]], false);
    a.heading = heading;
    a.curSpeed = GAITS[gait] ?? 0;
    a.sync(0);
    if (!poseable(a.body)) {
      if (gait === 'cower') a.body.pose = 'cower';
      a.body.update(0.3 + rand() * 0.9);
    } else if (gait === 'idle') idle(a.body);
    else if (gait === 'cower') cower(a.body);
    else if (gait === 'point') pointAt(a.body, new THREE.Vector3(...target), 'relaxed');
    else stride(a.body, gait === 'run' ? 'run' : 'walk');
    game.pedestrians.list.push(a);
    return a;
  });
}
