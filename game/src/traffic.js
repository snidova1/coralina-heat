// Civilian traffic: cars that keep to the right-hand lane, pick a turn at every junction, brake for
// whatever is in front of them (honking at the player), and are spawned and retired round the player.
import { LINES, ROAD_HALF } from './map.js';
import { lanePoint, exitsFrom, validNode, DIRS } from './roads.js';
import { randomTrafficType } from './vehicles.js';
import { rand, pick, randInt } from './rng.js';

const CRUISE = 13;

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Steer a vehicle toward a point at a wanted speed: shared by traffic and police. */
export function driveToward(v, tx, tz, wantSpeed, dt) {
  const desired = Math.atan2(tx - v.position.x, tz - v.position.z);
  const diff = wrap(desired - v.heading);
  const reversing = v.speed < -0.5;
  v.controls.steer = Math.max(-1, Math.min(1, -diff * 2.2 * (reversing ? -1 : 1)));
  const sp = v.speed;
  if (wantSpeed <= 0.1) v.controls.throttle = sp > 0.3 ? -1 : 0;
  else if (sp < wantSpeed - 1) v.controls.throttle = Math.min(1, (wantSpeed - sp) / 6 + 0.3);
  else if (sp > wantSpeed + 3) v.controls.throttle = -0.6;
  else v.controls.throttle = 0.1;
  v.controls.handbrake = false;
  return diff;
}

export class TrafficDriver {
  constructor(game, vehicle, i, j, dir) {
    this.game = game;
    this.vehicle = vehicle;
    this.kind = 'traffic';
    this.ti = i;
    this.tj = j;
    this.dir = dir;
    this.next = null;
    this.blockedT = 0;
    this.cruise = CRUISE * (0.85 + rand() * 0.3);
    this.panic = 0;
  }

  update(dt) {
    const v = this.vehicle;
    const g = this.game;
    const nx = LINES[this.ti];
    const nz = LINES[this.tj];
    const d = this.dir;
    const along = (v.position.x - nx) * d.dx + (v.position.z - nz) * d.dz;
    if (!this.next && along > -30) this.next = pick(exitsFrom(this.ti, this.tj, d));
    let target;
    let want = this.cruise * (this.panic > 0 ? 1.6 : 1);
    if (along < -13 || !this.next) {
      target = lanePoint(this.ti, this.tj, d, Math.min(along + 11, -ROAD_HALF - 1));
    } else {
      const nd = this.next;
      target = lanePoint(this.ti, this.tj, nd, 9);
      if (nd !== d) want = Math.min(want, nd.dx === -d.dz && nd.dz === d.dx ? 6 : 8);
      const along2 = (v.position.x - nx) * nd.dx + (v.position.z - nz) * nd.dz;
      if (along2 > 3) {
        if (validNode(this.ti + nd.dx, this.tj + nd.dz)) {
          this.ti += nd.dx;
          this.tj += nd.dz;
          this.dir = nd;
        }
        this.next = null;
      }
    }
    // brake for anything ahead
    const hit = this.obstacleAhead();
    if (hit) {
      want = hit.dist < 7 ? 0 : Math.min(want, hit.dist - 6);
      if (hit.isPlayer && v.speed < 1) {
        this.blockedT += dt;
        if (this.blockedT > 1.2 && g.audio) { g.audio.horn(v.position); this.blockedT = -2; }
      }
    } else this.blockedT = 0;
    if (this.panic > 0) this.panic -= dt;
    driveToward(v, target.x, target.z, want, dt);
  }

  obstacleAhead() {
    const v = this.vehicle;
    const g = this.game;
    const f = v.forward;
    let best = null;
    const check = (x, z, isPlayer) => {
      const dx = x - v.position.x;
      const dz = z - v.position.z;
      const ahead = dx * f.x + dz * f.z;
      if (ahead < 1 || ahead > 18) return;
      const side = Math.abs(dx * -f.z + dz * f.x);
      if (side > 2.4) return;
      if (!best || ahead < best.dist) best = { dist: ahead, isPlayer };
    };
    for (const o of g.vehicles.list) if (o !== v) check(o.position.x, o.position.z, o.driver === 'player');
    if (g.player && !g.player.vehicle) check(g.player.position.x, g.player.position.z, true);
    for (const p of g.pedestrians ? g.pedestrians.list : []) if (p.alive && p.onRoad) check(p.position.x, p.position.z, false);
    return best;
  }
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.target = 26;
    this.radius = 230;
  }

  spawnAt(i, j, dir, along, type) {
    const p = lanePoint(i, j, dir, along);
    const heading = Math.atan2(dir.dx, dir.dz);
    const v = this.game.vehicles.spawn(type || randomTrafficType(), p.x, p.z, heading);
    v.vx = dir.dx * 10;
    v.vz = dir.dz * 10;
    v.driver = new TrafficDriver(this.game, v, i, j, dir);
    this.cars.push(v);
    return v;
  }

  /** Spawn a car somewhere on the grid between `minD` and `maxD` metres from (x,z). */
  spawnNear(x, z, minD, maxD, avoidView = true) {
    const cam = this.game.camera;
    for (let attempt = 0; attempt < 12; attempt++) {
      const i = randInt(0, LINES.length - 1);
      const j = randInt(0, LINES.length - 1);
      const dir = pick(DIRS);
      if (!validNode(i - dir.dx, j - dir.dz)) continue;
      const along = -20 - rand() * 40;
      const p = lanePoint(i, j, dir, along);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < minD || d > maxD) continue;
      if (avoidView && cam) {
        const dir3 = cam.getWorldDirection(this.tmpDir || (this.tmpDir = cam.up.clone()));
        const dx = p.x - cam.position.x;
        const dz = p.z - cam.position.z;
        const dot = (dx * dir3.x + dz * dir3.z) / (Math.hypot(dx, dz) || 1);
        if (dot > 0.5 && d < 160) continue;
      }
      if (this.game.vehicles.nearest(p.x, p.z, 14)) continue;
      return this.spawnAt(i, j, dir, along);
    }
    return null;
  }

  update(dt) {
    const g = this.game;
    const focus = g.player.position;
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const v = this.cars[k];
      if (v.driver === 'player' || !v.driver || v.driver.kind !== 'traffic') {
        this.cars.splice(k, 1);
        continue;
      }
      const d = Math.hypot(v.position.x - focus.x, v.position.z - focus.z);
      if (d > this.radius + 60) {
        g.vehicles.remove(v);
        this.cars.splice(k, 1);
        continue;
      }
      v.driver.update(dt);
    }
    this.spawnTimer = (this.spawnTimer || 0) - dt;
    if (this.cars.length < this.target && this.spawnTimer <= 0) {
      this.spawnTimer = 0.25;
      this.spawnNear(focus.x, focus.z, 70, this.radius);
    }
  }

  /** Everyone floors it after gunfire nearby. */
  scare(x, z, r = 50) {
    for (const v of this.cars) {
      if (Math.hypot(v.position.x - x, v.position.z - z) < r) v.driver.panic = 8;
    }
  }
}
