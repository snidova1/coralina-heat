// Armed hostiles on foot: Tiburones gangsters guarding their turf and police officers who arrest
// at one star and open fire from two. They close in, hold a firing distance, strafe and shoot.
import { rand, chance } from './rng.js';

export class ShooterBrain {
  constructor(actor, opts = {}) {
    this.a = actor;
    this.range = opts.range ?? 20;
    this.accuracy = opts.accuracy ?? 0.35;
    this.damage = opts.damage ?? 7;
    this.rate = opts.rate ?? 0.9;
    this.mode = opts.mode ?? 'thug';
    this.alert = opts.alert ?? false;
    this.alertRange = opts.alertRange ?? 32;
    this.guard = opts.guard ?? null;
    this.fireT = rand() * this.rate;
    this.strafe = chance(0.5) ? 1 : -1;
    this.strafeT = 1 + rand() * 2;
    actor.hostile = true;
    actor.body.setArmed(true);
  }

  onHurt() {
    this.alert = true;
  }

  update(dt) {
    const a = this.a;
    const g = a.game;
    const p = g.player;
    if (p.dead) {
      a.body.pose = 'move';
      a.move(0, 0, 0, dt);
      return;
    }
    const tx = p.position.x;
    const tz = p.position.z;
    const dx = tx - a.position.x;
    const dz = tz - a.position.z;
    const dist = Math.hypot(dx, dz);
    if (!this.alert) {
      if (dist < this.alertRange) this.alert = true;
      else {
        a.body.pose = 'move';
        if (this.guard) {
          const gx = this.guard.x - a.position.x;
          const gz = this.guard.z - a.position.z;
          a.move(gx, gz, Math.hypot(gx, gz) > 2 ? 1.4 : 0, dt);
        } else a.move(0, 0, 0, dt);
        return;
      }
    }
    // police at one star try to make an arrest instead of shooting
    const arresting = this.mode === 'cop' && g.wanted && g.wanted.level <= 1 && !p.vehicle;
    if (this.mode === 'cop' && g.wanted && g.wanted.level === 0) {
      a.body.pose = 'move';
      a.body.setArmed(false);
      a.move(0, 0, 0, dt);
      return;
    }
    a.body.setArmed(!arresting);
    const see = dist < 70 && g.city.hasLineOfSight(a.position.x, 1.5, a.position.z, tx, 1.5, tz);
    if (arresting) {
      a.body.pose = dist < 4 ? 'move' : 'move';
      a.move(dx, dz, dist > 1.6 ? 5.4 : 0, dt);
      if (dist < 2.2 && g.police) g.police.arrestPressure(dt);
      return;
    }
    if (!see || dist > this.range) {
      a.body.pose = 'move';
      a.move(dx, dz, 5.2, dt);
      return;
    }
    // in range with a clear shot: aim, strafe and fire
    a.body.pose = 'aim';
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = 1.2 + rand() * 2;
      this.strafe *= -1;
    }
    const sx = -dz / (dist || 1);
    const sz = dx / (dist || 1);
    const keep = dist < this.range * 0.4 ? -1 : 0;
    a.move(sx * this.strafe + (dx / dist) * keep, sz * this.strafe + (dz / dist) * keep, 1.6, dt);
    a.heading = Math.atan2(dx, dz);
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = this.rate * (0.7 + rand() * 0.6);
      g.combat.npcShoot(a, this.accuracy, this.damage);
    }
  }
}
