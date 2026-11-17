// Pedestrians: locals strolling the pavements round their block, walking Ocean Drive's promenade,
// chatting, fleeing gunfire and dangerous driving, cowering, and remembering a crime to report.
import { Actor } from './actors.js';
import { LINES, CANAL, BOULEVARD_X, ISLAND } from './map.js';
import { rand, randInt, pick, chance } from './rng.js';

const OFF = 9.4;

/** The pavement loop round block (i,j), corner to corner. */
function blockLoop(i, j) {
  const x0 = LINES[i] + OFF;
  const x1 = LINES[i + 1] - OFF;
  const z0 = LINES[j] + OFF;
  const z1 = LINES[j + 1] - OFF;
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}

const PROMENADE = [[BOULEVARD_X + 10.5, ISLAND.minZ + 20], [BOULEVARD_X + 10.5, CANAL.zMin - 4]];
const PROMENADE_S = [[BOULEVARD_X + 10.5, CANAL.zMax + 4], [BOULEVARD_X + 10.5, ISLAND.maxZ - 10]];

export class PedestrianBrain {
  constructor(actor, path, loop = true) {
    this.a = actor;
    this.path = path;
    this.loop = loop;
    this.idx = 0;
    this.dirStep = chance(0.5) ? 1 : -1;
    this.speed = 1.1 + rand() * 0.6;
    this.fear = 0;
    this.fleeFrom = null;
    this.pauseT = 0;
    this.cower = false;
  }

  scare(x, z, amount = 6) {
    this.fear = Math.max(this.fear, amount);
    this.fleeFrom = { x, z };
    this.cower = chance(0.25);
  }

  onHurt(source) {
    if (source) this.scare(source.x ?? this.a.position.x, source.z ?? this.a.position.z, 10);
  }

  update(dt) {
    const a = this.a;
    if (this.fear > 0) {
      this.fear -= dt;
      if (this.cower && this.fear > 2) {
        a.body.pose = 'cower';
        a.move(0, 0, 0, dt);
        return;
      }
      a.body.pose = 'move';
      const dx = a.position.x - this.fleeFrom.x;
      const dz = a.position.z - this.fleeFrom.z;
      a.move(dx + (a.blocked ? dz : 0), dz - (a.blocked ? dx : 0), 5.8, dt);
      return;
    }
    a.body.pose = 'move';
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      a.move(0, 0, 0, dt);
      return;
    }
    const t = this.path[this.idx];
    const dx = t[0] - a.position.x;
    const dz = t[1] - a.position.z;
    if (Math.hypot(dx, dz) < 1.2) {
      if (this.loop) this.idx = (this.idx + this.dirStep + this.path.length) % this.path.length;
      else {
        if (this.idx + this.dirStep < 0 || this.idx + this.dirStep >= this.path.length) this.dirStep *= -1;
        this.idx += this.dirStep;
      }
      if (chance(0.25)) this.pauseT = 1 + rand() * 3;
      return;
    }
    a.move(dx, dz, this.speed, dt);
  }
}

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.target = 46;
    this.radius = 130;
  }

  spawnCivilian(x, z, path, loop) {
    const a = new Actor(this.game, 'civilian', x, z);
    a.brain = new PedestrianBrain(a, path, loop);
    a.heading = rand() * 6.28;
    this.list.push(a);
    return a;
  }

  /** A walker on a random pavement loop or the promenade, somewhere `minD`..`maxD` from (x,z). */
  spawnNear(x, z, minD, maxD) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if (chance(0.25)) {
        const path = chance(0.5) ? PROMENADE : PROMENADE_S;
        const pz = path[0][1] + rand() * (path[1][1] - path[0][1]);
        const px = path[0][0] + (rand() - 0.5) * 3;
        const d = Math.hypot(px - x, pz - z);
        if (d < minD || d > maxD) continue;
        return this.spawnCivilian(px, pz, [[px, path[0][1]], [px, path[1][1]]], false);
      }
      const i = randInt(0, LINES.length - 2);
      const j = randInt(0, LINES.length - 2);
      if (j === 4) continue;
      const loop = blockLoop(i, j);
      const k = randInt(0, 3);
      const a = loop[k];
      const b = loop[(k + 1) % 4];
      const t = rand();
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      const d = Math.hypot(px - x, pz - z);
      if (d < minD || d > maxD) continue;
      const ped = this.spawnCivilian(px, pz, loop, true);
      ped.brain.idx = (k + 1) % 4;
      ped.brain.dirStep = 1;
      return ped;
    }
    return null;
  }

  update(dt) {
    const g = this.game;
    const focus = g.player.position;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const p = this.list[k];
      const d = Math.hypot(p.position.x - focus.x, p.position.z - focus.z);
      if (d > this.radius + 40 || (!p.alive && p.deadTime > 25)) {
        p.dispose();
        this.list.splice(k, 1);
        continue;
      }
      p.update(dt);
    }
    this.spawnT = (this.spawnT || 0) - dt;
    if (this.list.length < this.target && this.spawnT <= 0) {
      this.spawnT = 0.15;
      this.spawnNear(focus.x, focus.z, 45, this.radius);
    }
  }

  /** Gunfire, explosions and crashes send everyone nearby running. */
  panic(x, z, r = 35) {
    for (const p of this.list) {
      if (!p.alive) continue;
      if (Math.hypot(p.position.x - x, p.position.z - z) < r) p.brain.scare(x, z, 6 + rand() * 4);
    }
  }

  /** Is any living civilian near enough to see a crime at (x,z)? */
  witnessNear(x, z, r = 30) {
    return this.list.some((p) => p.alive && Math.hypot(p.position.x - x, p.position.z - z) < r);
  }

  pickRandomAlive() {
    const alive = this.list.filter((p) => p.alive);
    return alive.length ? pick(alive) : null;
  }
}
