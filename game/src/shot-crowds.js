// Capture-only crowds: the passers-by and traffic a busy evening would put round each screenshot,
// built from the same cars and civilians the live city spawns, frozen mid-stride or mid-lane.
import { Actor } from './actors.js';
import { PedestrianBrain } from './pedestrians.js';
import { rand } from './rng.js';

const GAITS = { idle: 0, walk: 1.45, stroll: 1.05, run: 5.8 };

/** Cars as [type, x, z, heading, colour?]; lamps follow the dusk like any live car. */
export function stageTraffic(game, cars) {
  return cars.map(([type, x, z, heading, color]) => {
    const car = game.vehicles.spawn(type, x, z, heading, color);
    car.speed = 0;
    car.syncMesh(0);
    return car;
  });
}

/** People as [x, z, heading, gait?, look?]: walk, stroll, run, idle or cower, each at its own point in the stride. */
export function stageCrowd(game, people) {
  return people.map(([x, z, heading, gait = 'walk', look]) => {
    const a = new Actor(game, 'civilian', x, z, look);
    a.brain = new PedestrianBrain(a, [[x, z]], false);
    a.heading = heading;
    a.curSpeed = GAITS[gait] ?? 0;
    a.sync(0);
    if (gait === 'cower') a.body.pose = 'cower';
    a.body.update(0.3 + rand() * 0.9);
    game.pedestrians.list.push(a);
    return a;
  });
}
