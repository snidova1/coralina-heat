// Combat: the player's punches and gunfire (aimed down the camera's crosshair, hitting heads,
// bodies, cars and walls), gunfire from police and gangsters, explosions, and the crimes that
// all of it reports to the wanted level.
import * as THREE from 'three';
import { rand } from './rng.js';

const tmp = new THREE.Vector3();

/** Distance along a ray to a sphere, or Infinity. */
function raySphere(o, d, c, r) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : Infinity;
}

export class Combat {
  constructor(game) {
    this.game = game;
  }

  /** Everything a bullet can hit along a ray: the nearest actor part, vehicle or wall. */
  traceShot(origin, dir, range, ignore) {
    const g = this.game;
    let best = { t: city(g).raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range), kind: 'wall' };
    for (const a of g.allActors()) {
      if (!a.alive || a === ignore) continue;
      const dx = a.position.x - origin.x;
      const dz = a.position.z - origin.z;
      if (dx * dx + dz * dz > range * range) continue;
      const h = a.body.look.height;
      const head = raySphere(origin, dir, tmp.set(a.position.x, a.position.y + 1.62 * h, a.position.z), 0.17);
      if (head < best.t) best = { t: head, kind: 'actor', actor: a, head: true };
      for (const y of [1.25, 0.95, 0.55]) {
        const tb = raySphere(origin, dir, tmp.set(a.position.x, a.position.y + y * h, a.position.z), y > 1 ? 0.3 : 0.26);
        if (tb < best.t) best = { t: tb, kind: 'actor', actor: a, head: false };
      }
    }
    for (const v of g.vehicles.list) {
      if (v === ignore) continue;
      for (const c of v.circles()) {
        const tv = raySphere(origin, dir, tmp.set(c.x, v.position.y + 0.8, c.z), 1.15);
        if (tv < best.t) best = { t: tv, kind: 'vehicle', vehicle: v };
      }
    }
    if (best.t > range) best = { t: range, kind: 'none' };
    best.point = origin.clone().addScaledVector(dir, best.t);
    return best;
  }

  playerShoot() {
    const g = this.game;
    const p = g.player;
    const w = p.weapon;
    const aim = g.cameraRig.aimRay();
    aim.dir.x += (rand() - 0.5) * w.spread;
    aim.dir.y += (rand() - 0.5) * w.spread;
    aim.dir.z += (rand() - 0.5) * w.spread;
    aim.dir.normalize();
    const muzzle = p.body.muzzlePosition(new THREE.Vector3());
    // Aim down the reticle, then test the actual muzzle path so nearby cover blocks the shot.
    const offset = Math.max(0, p.chestPos.sub(aim.origin).dot(aim.dir) - 0.15);
    const target = this.traceShot(aim.origin.clone().addScaledVector(aim.dir, offset), aim.dir, w.range, p.vehicle);
    const trajectory = target.point.clone().sub(muzzle).normalize();
    const hit = this.traceShot(muzzle, trajectory, w.range, p.vehicle);
    g.effects.muzzleFlash(muzzle, trajectory, 1.2);
    g.effects.tracer(muzzle, hit.point);
    if (g.audio) g.audio.gunshot(w.id === 'smg' ? 0.7 : 1);
    g.cameraRig.shake(0.08);
    this.applyHit(hit, w.damage, 'player');
    if (g.pedestrians) g.pedestrians.panic(p.position.x, p.position.z, 45);
    if (g.traffic) g.traffic.scare(p.position.x, p.position.z, 50);
    if (g.wanted) g.wanted.report('shots', p.position.x, p.position.z);
  }

  applyHit(hit, damage, source) {
    const g = this.game;
    if (hit.kind === 'actor') {
      const a = hit.actor;
      g.effects.impact(hit.point.x, hit.point.y, hit.point.z, true);
      a.damage(hit.head ? damage * 3 : damage, source === 'player' ? 'player' : source, 'bullet');
      if (source === 'player' && g.wanted) g.wanted.report(a.kind === 'cop' ? 'shootcop' : 'assault', a.position.x, a.position.z);
      if (source === 'player' && g.hud) g.hud.hitMarker(hit.head);
    } else if (hit.kind === 'vehicle') {
      g.effects.impact(hit.point.x, hit.point.y, hit.point.z, false);
      hit.vehicle.damage(damage * 0.25);
    } else if (hit.kind === 'wall') {
      g.effects.impact(hit.point.x, hit.point.y, hit.point.z, false);
    }
  }

  playerPunch() {
    const g = this.game;
    const p = g.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    if (g.audio) g.audio.swing();
    for (const a of g.allActors()) {
      if (!a.alive) continue;
      const dx = a.position.x - p.position.x;
      const dz = a.position.z - p.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.9 || (dx * fx + dz * fz) / (d || 1) < 0.5) continue;
      a.damage(p.weapon.damage, 'player', 'punch');
      a.knock.set(fx * 4, fz * 4);
      g.effects.impact(a.position.x, 1.4, a.position.z, true);
      if (g.audio) g.audio.punch();
      if (g.wanted) g.wanted.report(a.kind === 'cop' ? 'hitcop' : 'assault', a.position.x, a.position.z);
      return;
    }
  }

  /** An NPC fires at a target: a hit roll weighted by accuracy, distance and the player's speed. */
  npcShoot(shooter, accuracy, damage) {
    const g = this.game;
    const p = g.player;
    if (p.dead) return;
    const muzzle = shooter.body.muzzlePosition(new THREE.Vector3());
    const target = p.vehicle ? p.vehicle.position.clone().setY(1) : p.chestPos;
    const dist = muzzle.distanceTo(target);
    const moving = p.vehicle ? Math.abs(p.vehicle.speed) / 30 : p.curSpeed / 12;
    const chance = accuracy * Math.max(0.15, 1 - dist / 60) * (1 - Math.min(0.6, moving));
    const dir = target.clone().sub(muzzle).normalize();
    g.effects.muzzleFlash(muzzle, dir);
    if (g.audio) g.audio.gunshot(0.6, muzzle);
    shooter.body.fireRecoil();
    if (!g.city.hasLineOfSight(muzzle.x, muzzle.y, muzzle.z, target.x, target.y, target.z)) {
      g.effects.tracer(muzzle, muzzle.clone().addScaledVector(dir, dist * 0.8));
      return;
    }
    if (rand() < chance) {
      g.effects.tracer(muzzle, target);
      if (p.vehicle) p.vehicle.damage(damage * 0.4);
      else {
        p.takeDamage(damage, 'bullet');
        g.effects.impact(target.x, target.y, target.z, true);
      }
    } else {
      const miss = target.clone().add(new THREE.Vector3((rand() - 0.5) * 4, 0, (rand() - 0.5) * 4));
      miss.y = 0.05 + rand() * 0.6;
      g.effects.tracer(muzzle, miss);
      g.effects.sparks(miss.x, miss.y, miss.z, 4);
    }
  }

  explosionDamage(pos, radius, source) {
    const g = this.game;
    for (const a of g.allActors()) {
      const d = a.position.distanceTo(pos);
      if (d < radius) {
        a.damage(160 * (1 - d / radius), source && source.driver === 'player' ? 'player' : null, 'explosion');
        a.knock.set((a.position.x - pos.x) * 3, (a.position.z - pos.z) * 3);
      }
    }
    for (const v of g.vehicles.list) {
      if (v === source) continue;
      const d = v.position.distanceTo(pos);
      if (d < radius) v.damage(60 * (1 - d / radius));
    }
    const p = g.player;
    if (!p.vehicle) {
      const d = p.position.distanceTo(pos);
      if (d < radius) p.takeDamage(70 * (1 - d / radius), 'explosion');
    }
    if (g.pedestrians) g.pedestrians.panic(pos.x, pos.z, 60);
  }
}

function city(g) { return g.city; }
