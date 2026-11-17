// The Coralina Bay Police Department: cruisers that pursue along the street grid and ram at close
// range, officers who jump out to arrest or shoot, roadblocks at three stars, the Air-9 helicopter
// with its searchlight at four, and the arrest itself.
import * as THREE from 'three';
import { LINES, ROAD_HALF } from './map.js';
import { lanePoint, exitsFrom, validNode, DIRS, nodeIndexOf } from './roads.js';
import { driveToward, TrafficDriver } from './traffic.js';
import { Actor } from './actors.js';
import { ShooterBrain } from './enemies.js';
import { glowTexture } from './textures.js';
import { rand, pick, randInt } from './rng.js';

const CARS_FOR_LEVEL = [0, 1, 2, 4, 5, 6];

export class PoliceDriver {
  constructor(game, vehicle) {
    this.game = game;
    this.vehicle = vehicle;
    this.kind = 'police';
    const n = nodeIndexOf(vehicle.position.x, vehicle.position.z);
    this.ti = Math.max(0, Math.min(LINES.length - 1, n.i));
    this.tj = Math.max(0, Math.min(LINES.length - 1, n.j));
    this.dir = DIRS[0];
    this.stuckT = 0;
    this.reverseT = 0;
    this.deployed = false;
    this.parked = false;
  }

  release() { this.vehicle.siren = false; }

  update(dt) {
    const v = this.vehicle;
    const g = this.game;
    v.siren = g.wanted.level > 0 || this.parked;
    if (this.parked) {
      v.controls.throttle = 0;
      v.controls.handbrake = true;
      return;
    }
    const p = g.player;
    const tx = p.position.x;
    const tz = p.position.z;
    const dist = Math.hypot(tx - v.position.x, tz - v.position.z);
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.controls.throttle = -1;
      v.controls.steer = this.reverseSteer;
      v.controls.handbrake = false;
      return;
    }
    if (Math.abs(v.speed) < 1.2 && v.controls.throttle > 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 1.6) {
        this.stuckT = 0;
        this.reverseT = 1.3;
        this.reverseSteer = rand() < 0.5 ? 1 : -1;
      }
    } else this.stuckT = 0;
    // on foot nearby: pull up and send the officers out
    if (!p.vehicle && dist < 22) {
      driveToward(v, tx, tz, dist < 12 ? 0 : 8, dt);
      if (Math.abs(v.speed) < 2 && !this.deployed) {
        this.deployed = true;
        g.police.deployOfficers(v);
      }
      return;
    }
    const see = dist < 55 && g.city.hasLineOfSight(v.position.x, 1.2, v.position.z, tx, 1.2, tz);
    if (see) {
      // close pursuit: aim a little ahead of the player and ram
      const lead = Math.min(1.2, dist / 25);
      driveToward(v, tx + p.velocity.x * lead, tz + p.velocity.z * lead, 60, dt);
      return;
    }
    // otherwise follow the grid toward the player's last known position
    const goal = g.wanted.lastKnown;
    const nx = LINES[this.ti];
    const nz = LINES[this.tj];
    const along = (v.position.x - nx) * this.dir.dx + (v.position.z - nz) * this.dir.dz;
    const toNode = Math.hypot(nx - v.position.x, nz - v.position.z);
    if (toNode < 9 || along > 0) {
      let best = null;
      let bd = Infinity;
      for (const d of exitsFrom(this.ti, this.tj, null)) {
        const ni = this.ti + d.dx;
        const nj = this.tj + d.dz;
        const dd = Math.hypot(LINES[ni] - goal.x, LINES[nj] - goal.z) + (d.dx === -this.dir.dx && d.dz === -this.dir.dz ? 60 : 0);
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best && validNode(this.ti + best.dx, this.tj + best.dz)) {
        this.dir = best;
        this.ti += best.dx;
        this.tj += best.dz;
      }
    }
    const t = lanePoint(this.ti, this.tj, this.dir, -ROAD_HALF, 2);
    driveToward(v, t.x, t.z, 34, dt);
  }
}

export class Police {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.officers = [];
    this.roadblocks = [];
    this.heli = null;
    this.spawnT = 0;
    this.roadblockT = 12;
    this.bustT = 0;
  }

  release(v) {
    this.cars = this.cars.filter((c) => c !== v);
  }

  spawnCruiser(x, z, heading) {
    const v = this.game.vehicles.spawn('police', x, z, heading);
    v.driver = new PoliceDriver(this.game, v);
    v.siren = true;
    this.cars.push(v);
    return v;
  }

  /** Bring a cruiser in from a junction out of sight, 110-190 m from the player. */
  spawnPursuer() {
    const p = this.game.player.position;
    for (let k = 0; k < 14; k++) {
      const i = randInt(0, LINES.length - 1);
      const j = randInt(0, LINES.length - 1);
      const d = Math.hypot(LINES[i] - p.x, LINES[j] - p.z);
      if (d < 110 || d > 190) continue;
      const dir = pick(DIRS);
      if (!validNode(i + dir.dx, j + dir.dz)) continue;
      const pt = lanePoint(i, j, dir, 12);
      if (this.game.vehicles.nearest(pt.x, pt.z, 10)) continue;
      const v = this.spawnCruiser(pt.x, pt.z, Math.atan2(dir.dx, dir.dz));
      v.driver.ti = i + dir.dx;
      v.driver.tj = j + dir.dz;
      v.driver.dir = dir;
      return v;
    }
    return null;
  }

  deployOfficers(v) {
    const f = v.forward;
    for (const s of [-1, 1]) {
      const a = new Actor(this.game, 'cop', v.position.x - f.z * 2 * s, v.position.z + f.x * 2 * s);
      a.brain = new ShooterBrain(a, { mode: 'cop', alert: true, accuracy: 0.45, damage: 6, rate: 0.8, range: 24 });
      this.officers.push(a);
    }
  }

  copNear(x, z, r) {
    for (const v of this.cars) if (!v.wrecked && Math.hypot(v.position.x - x, v.position.z - z) < r) return true;
    for (const a of this.officers) if (a.alive && Math.hypot(a.position.x - x, a.position.z - z) < r) return true;
    for (const v of this.game.vehicles.list) if (v.type === 'police' && !v.wrecked && v.driver && v.driver !== 'player' && Math.hypot(v.position.x - x, v.position.z - z) < r) return true;
    return false;
  }

  canSeePlayer() {
    const g = this.game;
    const p = g.player.position;
    if (this.heli && Math.hypot(this.heli.pos.x - p.x, this.heli.pos.z - p.z) < 60) return true;
    const units = this.cars.map((v) => v.position).concat(this.officers.filter((a) => a.alive).map((a) => a.position));
    for (const u of units) {
      const d = Math.hypot(u.x - p.x, u.z - p.z);
      if (d < 18) return true;
      if (d < 85 && g.city.hasLineOfSight(u.x, 1.4, u.z, p.x, 1.4, p.z)) return true;
    }
    return false;
  }

  arrestPressure(dt) {
    const p = this.game.player;
    if (p.vehicle || p.dead) return;
    this.bustT += dt * (p.curSpeed < 2 ? 1 : 0.3);
    if (this.bustT > 1.4 && this.game.onBusted) {
      this.bustT = 0;
      this.game.onBusted();
    }
  }

  update(dt) {
    const g = this.game;
    const level = g.wanted.level;
    this.bustT = Math.max(0, this.bustT - dt * 0.3);
    // keep the right number of cruisers hunting
    this.cars = this.cars.filter((v) => g.vehicles.list.includes(v) && v.driver && v.driver.kind === 'police');
    const want = CARS_FOR_LEVEL[level];
    const active = this.cars.filter((v) => !v.wrecked && !v.driver.parked);
    this.spawnT -= dt;
    if (active.length < want && this.spawnT <= 0) {
      this.spawnT = 2.5;
      this.spawnPursuer();
    }
    const p = g.player.position;
    for (const v of this.cars) {
      const d = Math.hypot(v.position.x - p.x, v.position.z - p.z);
      if (level === 0 && !v.driver.parked) {
        // stand down and rejoin traffic
        const n = nodeIndexOf(v.position.x, v.position.z);
        v.siren = false;
        v.driver = new TrafficDriver(g, v, Math.max(0, Math.min(9, n.i)), Math.max(0, Math.min(9, n.j)), pick(DIRS));
        if (g.traffic) g.traffic.cars.push(v);
        continue;
      }
      if (d > 320 || (v.wrecked && d > 120)) {
        g.vehicles.remove(v);
        continue;
      }
      if (!v.wrecked) v.driver.update(dt);
    }
    this.cars = this.cars.filter((v) => g.vehicles.list.includes(v) && v.driver && v.driver.kind === 'police');
    for (let k = this.officers.length - 1; k >= 0; k--) {
      const a = this.officers[k];
      a.update(dt);
      const d = Math.hypot(a.position.x - p.x, a.position.z - p.z);
      if (d > 200 || (!a.alive && a.deadTime > 30) || (level === 0 && d > 60)) {
        a.dispose();
        this.officers.splice(k, 1);
      }
    }
    // roadblocks from three stars
    this.roadblockT -= dt;
    if (level >= 3 && this.roadblockT <= 0 && g.player.vehicle) {
      this.roadblockT = 28;
      this.placeRoadblock();
    }
    for (let k = this.roadblocks.length - 1; k >= 0; k--) {
      const rb = this.roadblocks[k];
      if (Math.hypot(rb.x - p.x, rb.z - p.z) > 260 || level === 0) {
        for (const v of rb.cars) if (g.vehicles.list.includes(v)) g.vehicles.remove(v);
        this.roadblocks.splice(k, 1);
      }
    }
    // the helicopter from four stars
    if (level >= 4 && !this.heli) this.heli = new Helicopter(g);
    if (this.heli) {
      this.heli.update(dt, level >= 4);
      if (this.heli.gone) { this.heli.dispose(); this.heli = null; }
    }
  }

  /** Two cruisers parked across the street ahead of the player, officers behind them. */
  placeRoadblock() {
    const g = this.game;
    const p = g.player;
    const v = p.vehicle;
    const f = v.forward;
    const ax = Math.abs(f.x) > Math.abs(f.z);
    const dir = ax ? { dx: Math.sign(f.x), dz: 0 } : { dx: 0, dz: Math.sign(f.z) };
    const n = nodeIndexOf(p.position.x + dir.dx * 140, p.position.z + dir.dz * 140);
    if (!validNode(n.i, n.j)) return;
    const cx = LINES[n.i] - dir.dx * 16;
    const cz = LINES[n.j] - dir.dz * 16;
    const across = Math.atan2(dir.dz, -dir.dx);
    const cars = [];
    for (const s of [-1, 1]) {
      const x = cx + -dir.dz * 3.2 * s;
      const z = cz + dir.dx * 3.2 * s;
      if (g.vehicles.nearest(x, z, 4)) continue;
      const car = this.spawnCruiser(x, z, across + (s > 0 ? 0.3 : -0.3));
      car.driver.parked = true;
      car.siren = true;
      cars.push(car);
      const a = new Actor(g, 'cop', x - dir.dx * 3, z - dir.dz * 3);
      a.brain = new ShooterBrain(a, { mode: 'cop', alert: true, accuracy: 0.4, damage: 6, range: 30 });
      this.officers.push(a);
    }
    this.roadblocks.push({ x: cx, z: cz, cars });
    if (g.hud) g.hud.toast('Roadblock ahead!');
  }

  clearAll() {
    const g = this.game;
    for (const v of this.cars) g.vehicles.remove(v);
    this.cars = [];
    for (const a of this.officers) a.dispose();
    this.officers = [];
    this.roadblocks = [];
    if (this.heli) { this.heli.dispose(); this.heli = null; }
  }
}

/** CBPD Air-9: hovers over the player with a sweeping searchlight. */
export class Helicopter {
  constructor(game) {
    this.game = game;
    const p = game.player.position;
    this.pos = new THREE.Vector3(p.x + 150, 70, p.z + 150);
    this.group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2433, metalness: 0.5, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.3, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b1620, metalness: 0.9, roughness: 0.05 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.4, 6, 12).rotateX(Math.PI / 2), white);
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 2.2, 6, 12).rotateX(Math.PI / 2).translate(0, -0.25, 0), dark);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10).scale(1, 0.9, 1.1).translate(0, 0.15, 1.6), glass);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 5, 8).rotateX(Math.PI / 2).translate(0, 0.4, -4), white);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.8).translate(0, 0.9, -6.3), dark);
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.35), dark);
    this.rotor.position.y = 1.5;
    const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 10), dark);
    this.rotor.add(rotor2);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.2), dark);
    this.tailRotor.position.set(0.25, 0.9, -6.3);
    const skidMat = dark;
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6).rotateX(Math.PI / 2), skidMat);
      skid.position.set(s * 0.9, -1.4, 0.2);
      this.group.add(skid);
    }
    this.group.add(body, belly, nose, tail, fin, this.rotor, this.tailRotor);
    // searchlight: a real spotlight plus a visible beam
    this.spot = new THREE.SpotLight(0xf4f8ff, 0, 160, 0.16, 0.5, 1);
    this.spot.position.set(0, -1.2, 1.4);
    this.group.add(this.spot);
    game.scene.add(this.spot.target);
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1, 20, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    game.scene.add(this.beam);
    this.strobe = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.strobe.position.set(0, -1.3, -1);
    this.strobe.scale.setScalar(2.5);
    this.group.add(this.strobe);
    game.scene.add(this.group);
    this.gone = false;
    this.leaving = false;
    this.sweep = 0;
  }

  update(dt, wanted) {
    const g = this.game;
    const p = g.player.position;
    const target = wanted ? new THREE.Vector3(p.x - 18, 34, p.z - 22) : new THREE.Vector3(p.x + 400, 90, p.z + 400);
    const d = target.clone().sub(this.pos);
    const sp = Math.min(d.length(), (wanted ? 34 : 45) * dt);
    if (d.length() > 0.01) this.pos.addScaledVector(d.normalize(), sp);
    if (!wanted && this.pos.distanceTo(p) > 380) this.gone = true;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.group.rotation.x = 0.12;
    this.rotor.rotation.y += dt * 30;
    this.tailRotor.rotation.x += dt * 40;
    this.sweep += dt;
    const aim = new THREE.Vector3(p.x + Math.sin(this.sweep * 1.3) * 3, 0, p.z + Math.cos(this.sweep) * 3);
    this.spot.target.position.copy(aim);
    this.spot.intensity = wanted ? 260 : 0;
    const from = this.pos.clone().add(new THREE.Vector3(0, -1.2, 0));
    const len = from.distanceTo(aim);
    this.beam.position.copy(from);
    this.beam.scale.set(1, len, 1);
    this.beam.lookAt(aim);
    this.beam.rotateX(-Math.PI / 2);
    this.beam.visible = wanted;
    this.strobe.visible = Math.floor(g.time * 3) % 2 === 0;
  }

  dispose() {
    const s = this.game.scene;
    s.remove(this.group, this.beam, this.spot.target);
  }
}
