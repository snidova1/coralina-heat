// An actor is a person in the world: a humanoid body with a position, heading, health and a brain.
// Pedestrians, police officers on foot and gang members are all actors; this file moves them,
// keeps them out of walls and water, and lets cars knock them down.
import * as THREE from 'three';
import { Humanoid, randomLook } from './humanoid.js';
import { isLand, onRoad, BEACH } from './map.js';

let nextId = 1;

export class Actor {
  constructor(game, kind, x, z, look) {
    this.game = game;
    this.id = nextId++;
    this.kind = kind; // 'civilian' | 'cop' | 'thug' | 'boss' | 'contact'
    this.body = new Humanoid(look || randomLook(kind === 'boss' ? 'boss' : kind));
    this.position = new THREE.Vector3(x, 0, z);
    this.heading = 0;
    this.health = kind === 'boss' ? 400 : kind === 'cop' ? 120 : kind === 'thug' ? 100 : 60;
    this.maxHealth = this.health;
    this.alive = true;
    this.curSpeed = 0;
    this.deadTime = 0;
    this.hostile = false;
    this.brain = null;
    this.onRoad = false;
    this.knock = new THREE.Vector2();
    game.scene.add(this.body.root);
    this.sync();
  }

  get headPos() { return new THREE.Vector3(this.position.x, this.position.y + 1.62 * this.body.look.height, this.position.z); }
  get chestPos() { return new THREE.Vector3(this.position.x, this.position.y + 1.25 * this.body.look.height, this.position.z); }

  /** Walk or run in direction (dx,dz) at `speed`, turning smoothly to face it. */
  move(dx, dz, speed, dt) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-4 || speed <= 0) {
      this.curSpeed += (0 - this.curSpeed) * Math.min(1, dt * 8);
      return;
    }
    dx /= len;
    dz /= len;
    this.turnTo(Math.atan2(dx, dz), dt, 8);
    this.curSpeed += (speed - this.curSpeed) * Math.min(1, dt * 6);
    const nx = this.position.x + dx * this.curSpeed * dt;
    const nz = this.position.z + dz * this.curSpeed * dt;
    if (isLand(nx, nz)) {
      this.position.x = nx;
      this.position.z = nz;
    } else this.blocked = true;
  }

  turnTo(target, dt, rate = 8) {
    let d = target - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * rate);
  }

  faceToward(x, z, dt) {
    this.turnTo(Math.atan2(x - this.position.x, z - this.position.z), dt, 10);
  }

  update(dt) {
    if (this.alive && this.brain) this.brain.update(dt);
    if (!this.alive) {
      this.deadTime += dt;
      this.curSpeed = 0;
    }
    // knockback from cars and blasts
    if (this.knock.lengthSq() > 0.01) {
      const nx = this.position.x + this.knock.x * dt;
      const nz = this.position.z + this.knock.y * dt;
      if (isLand(nx, nz)) { this.position.x = nx; this.position.z = nz; }
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
    }
    const r = this.game.city.collideCircle(this.position.x, this.position.z, 0.38, 1);
    this.blocked = this.blocked || r.hit;
    this.position.x = r.x;
    this.position.z = r.z;
    if (this.alive) this.checkCars();
    this.sync(dt);
    this.blocked = false;
  }

  checkCars() {
    for (const v of this.game.vehicles.list) {
      const sp = Math.hypot(v.vx, v.vz);
      if (sp < 3.5) continue;
      for (const c of v.circles()) {
        const dx = this.position.x - c.x;
        const dz = this.position.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d > v.radius + 0.45) continue;
        this.knock.set((dx / (d || 1)) * sp * 0.6 + v.vx * 0.6, (dz / (d || 1)) * sp * 0.6 + v.vz * 0.6);
        this.damage(sp * 4.5, v.driver === 'player' ? 'player' : null, 'car');
        if (this.game.audio) this.game.audio.thud(this.position);
        return;
      }
    }
  }

  damage(amount, source, how = 'bullet') {
    if (!this.alive) return;
    this.health -= amount;
    if (this.brain && this.brain.onHurt) this.brain.onHurt(source, how);
    if (this.health <= 0) this.die(source, how);
  }

  die(source, how) {
    this.alive = false;
    this.body.kill();
    this.body.setArmed(false);
    if (this.game.onActorKilled) this.game.onActorKilled(this, source, how);
  }

  sync(dt = 0) {
    this.onRoad = onRoad(this.position.x, this.position.z);
    let y = this.onRoad ? 0.02 : 0.16;
    if (this.position.x > BEACH.x0) y = this.game.city.beachHeight(this.position.x);
    if (this.position.x < -400) y = 0.02;
    this.position.y = y;
    this.body.speed = this.curSpeed;
    this.body.update(dt);
    this.body.root.position.copy(this.position);
    this.body.root.rotation.y = this.heading;
  }

  dispose() {
    this.game.scene.remove(this.body.root);
  }
}
