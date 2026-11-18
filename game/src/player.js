// Rafa Reyes, the player: jogs and sprints on foot relative to the camera, aims and fires or
// throws punches, steals any car with F (dragging the driver out), drives with WASD and the
// handbrake, bails out of moving cars, and takes damage through body armour.
import * as THREE from 'three';
import { Humanoid, randomLook } from './humanoid.js';
import { isLand, onRoad, BEACH } from './map.js';
import { Actor } from './actors.js';
import { PedestrianBrain } from './pedestrians.js';

export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', damage: 18, range: 1.9, rate: 0.42, melee: true },
  pistol: { id: 'pistol', name: 'Kestrel .45', damage: 36, range: 150, rate: 0.22, clip: 12, spread: 0.008 },
  smg: { id: 'smg', name: 'Vandal SMG', damage: 20, range: 120, rate: 0.085, clip: 32, spread: 0.022, auto: true },
};

export class Player {
  constructor(game) {
    this.game = game;
    this.body = new Humanoid(randomLook('player'));
    this.position = new THREE.Vector3(PLAYER_START.x, 0.16, PLAYER_START.z);
    this.heading = Math.PI;
    this.velocity = new THREE.Vector3();
    this.health = 100;
    this.armor = 0;
    this.vehicle = null;
    this.weapons = { fists: { ammo: Infinity, clip: Infinity } };
    this.current = 'fists';
    this.aiming = false;
    this.fireT = 0;
    this.reloadT = 0;
    this.stamina = 1;
    this.dead = false;
    this.curSpeed = 0;
    this.hurtT = 0;
    game.scene.add(this.body.root);
  }

  get weapon() { return WEAPONS[this.current]; }
  get ammoState() { return this.weapons[this.current]; }
  get chestPos() { return new THREE.Vector3(this.position.x, this.position.y + 1.3, this.position.z); }

  giveWeapon(id, ammo) {
    if (!this.weapons[id]) this.weapons[id] = { ammo: 0, clip: 0 };
    const w = this.weapons[id];
    w.ammo += ammo;
    if (w.clip === 0) {
      const take = Math.min(WEAPONS[id].clip, w.ammo);
      w.clip = take;
      w.ammo -= take;
    }
    if (this.current === 'fists') this.current = id;
  }

  cycleWeapon(step = 1) {
    const ids = Object.keys(WEAPONS).filter((k) => this.weapons[k]);
    const i = ids.indexOf(this.current);
    this.current = ids[(i + step + ids.length) % ids.length];
    if (this.game.audio) this.game.audio.click();
  }

  update(dt) {
    const g = this.game;
    const input = g.input;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.dead) {
      this.body.update(dt);
      return;
    }
    if (input && g.mode === 'play') {
      g.cameraRig.look(input.mouse.dx, input.mouse.dy);
      if (input.mouse.wheel) this.cycleWeapon(input.mouse.wheel > 0 ? 1 : -1);
      if (input.wasPressed('KeyQ')) this.cycleWeapon(1);
      if (input.wasPressed('Digit1')) this.current = 'fists';
      if (input.wasPressed('Digit2') && this.weapons.pistol) this.current = 'pistol';
      if (input.wasPressed('Digit3') && this.weapons.smg) this.current = 'smg';
      if (input.wasPressed('KeyF')) {
        if (this.vehicle) this.exitVehicle();
        else this.tryEnterVehicle();
      }
    }
    if (this.vehicle) this.updateDriving(dt);
    else this.updateOnFoot(dt);
    if (this.fireT > 0) this.fireT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    // slow regeneration up to half health
    if (this.health < 50 && this.hurtT <= 0) this.health = Math.min(50, this.health + dt * 1.5);
  }

  updateOnFoot(dt) {
    const g = this.game;
    const input = g.input;
    const play = input && g.mode === 'play';
    let mx = 0;
    let mz = 0;
    if (play) {
      if (input.isDown('KeyW')) mz += 1;
      if (input.isDown('KeyS')) mz -= 1;
      if (input.isDown('KeyA')) mx += 1;
      if (input.isDown('KeyD')) mx -= 1;
    }
    const yaw = g.cameraRig.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // right of the camera is (-fz, fx); A moves left
    let dx = fx * mz - -fz * mx;
    let dz = fz * mz - fx * mx;
    const len = Math.hypot(dx, dz);
    this.aiming = play && (input.mouse.right || (this.current !== 'fists' && input.mouse.left));
    const sprint = play && input.isDown('ShiftLeft') && this.stamina > 0.05 && !this.aiming;
    let speed = 0;
    if (len > 0) {
      dx /= len;
      dz /= len;
      speed = this.aiming ? 2.6 : sprint ? 7.6 : 5;
    }
    this.stamina = Math.max(0, Math.min(1, this.stamina + (sprint && len > 0 ? -dt * 0.18 : dt * 0.25)));
    this.curSpeed += (speed - this.curSpeed) * Math.min(1, dt * 9);
    if (len > 0) {
      const nx = this.position.x + dx * this.curSpeed * dt;
      const nz = this.position.z + dz * this.curSpeed * dt;
      if (isLand(nx, nz)) { this.position.x = nx; this.position.z = nz; }
    }
    if (this.aiming) this.turnTo(yaw, dt, 18);
    else if (len > 0) this.turnTo(Math.atan2(dx, dz), dt, 10);
    const r = g.city.collideCircle(this.position.x, this.position.z, 0.4, 1);
    this.position.x = r.x;
    this.position.z = r.z;
    // shove past cars rather than walking through them
    for (const v of g.vehicles.list) {
      for (const c of v.circles()) {
        const ddx = this.position.x - c.x;
        const ddz = this.position.z - c.z;
        const d = Math.hypot(ddx, ddz);
        const min = v.radius + 0.4;
        if (d < min && d > 1e-4) {
          this.position.x = c.x + (ddx / d) * min;
          this.position.z = c.z + (ddz / d) * min;
          const sp = Math.hypot(v.vx, v.vz);
          if (sp > 6 && v.driver !== 'player') this.takeDamage(sp * 2.2, 'car');
        }
      }
    }
    let y = onRoad(this.position.x, this.position.z) ? 0.02 : 0.16;
    if (this.position.x > BEACH.x0) y = g.city.beachHeight(this.position.x);
    this.position.y = y;
    // weapons
    this.body.setArmed(this.current !== 'fists');
    this.body.pose = this.aiming && this.current !== 'fists' ? 'aim' : 'move';
    this.body.aimPitch = -g.cameraRig.pitch * 0.8 + 0.12;
    if (play && this.reloadT <= 0) {
      const w = this.weapon;
      const pressed = w.auto ? input.mouse.left : input.mouse.leftPressed;
      if (pressed && this.fireT <= 0) {
        if (w.melee) {
          this.fireT = w.rate;
          this.body.punch();
          g.combat.playerPunch();
        } else if (this.ammoState.clip > 0) {
          this.fireT = w.rate;
          this.ammoState.clip -= 1;
          this.body.fireRecoil();
          g.combat.playerShoot();
        } else this.reload();
      }
      if (input.wasPressed('KeyR')) this.reload();
    }
    this.body.speed = this.curSpeed;
    this.body.update(dt);
    this.body.root.visible = true;
    this.body.root.position.copy(this.position);
    this.body.root.rotation.y = this.heading;
    this.velocity.set(dx * this.curSpeed, 0, dz * this.curSpeed);
  }

  reload() {
    const s = this.ammoState;
    const w = this.weapon;
    if (w.melee || s.ammo <= 0 || s.clip >= w.clip || this.reloadT > 0) return;
    this.reloadT = 1.1;
    if (this.game.audio) this.game.audio.reload();
  }

  finishReload() {
    const s = this.ammoState;
    const need = this.weapon.clip - s.clip;
    const take = Math.min(need, s.ammo);
    s.clip += take;
    s.ammo -= take;
  }

  turnTo(target, dt, rate) {
    let d = target - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * rate);
  }

  updateDriving(dt) {
    const g = this.game;
    const v = this.vehicle;
    const input = g.input;
    const c = v.controls;
    if (input && g.mode === 'play') {
      c.throttle = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
      c.steer = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
      c.handbrake = input.isDown('Space');
      if (input.wasPressed('KeyH') && g.audio) g.audio.horn(v.position, true);
      if (input.wasPressed('KeyG') && v.type === 'police') v.siren = !v.siren;
      if (input.wasPressed('KeyE') && g.audio) g.audio.nextStation();
    }
    this.position.copy(v.position);
    this.heading = v.heading;
    this.velocity.set(v.vx, 0, v.vz);
    this.body.root.visible = false;
    this.aiming = false;
    if (v.wrecked || v.burnTimer >= 0 && v.burnTimer < 1.2) this.exitVehicle(true);
  }

  tryEnterVehicle() {
    const g = this.game;
    const v = g.vehicles.nearest(this.position.x, this.position.z, 4.5, (o) => !o.wrecked);
    if (!v) return;
    const jacked = v.driver && v.driver !== 'player';
    if (jacked) {
      const wasCop = v.type === 'police' || (v.driver.kind === 'police');
      if (v.driver.release) v.driver.release();
      const f = v.forward;
      const ex = v.position.x - f.z * 2.2;
      const ez = v.position.z + f.x * 2.2;
      if (g.pedestrians) {
        const a = new Actor(g, wasCop ? 'cop' : 'civilian', ex, ez);
        a.brain = new PedestrianBrain(a, [[ex, ez]], false);
        a.brain.scare(this.position.x, this.position.z, 12);
        g.pedestrians.list.push(a);
        a.body.pose = 'move';
      }
      if (g.wanted) g.wanted.report(wasCop ? 'copcar' : 'carjack', this.position.x, this.position.z);
      if (g.hud) g.hud.toast(wasCop ? 'You jacked a police cruiser!' : `Jacked a ${v.label}`);
    }
    if (g.traffic) g.traffic.cars = g.traffic.cars.filter((o) => o !== v);
    if (g.police) g.police.release(v);
    v.driver = 'player';
    v.siren = v.type === 'police' ? v.siren : false;
    v.controls.throttle = 0;
    this.vehicle = v;
    if (g.audio) { g.audio.door(); g.audio.startEngine(v); }
    if (g.hud) g.hud.showVehicleName(v.label);
    g.cameraRig.yaw = v.heading;
  }

  exitVehicle(force = false) {
    const g = this.game;
    const v = this.vehicle;
    if (!v) return;
    const sp = Math.abs(v.speed);
    const f = v.forward;
    let ex = v.position.x + f.z * 2.3;
    let ez = v.position.z - f.x * 2.3;
    if (!isLand(ex, ez)) { ex = v.position.x - f.z * 2.3; ez = v.position.z + f.x * 2.3; }
    this.position.set(ex, 0.16, ez);
    if (sp > 9 || force) this.takeDamage(Math.min(30, sp * 0.8), 'bail');
    v.driver = null;
    v.controls.throttle = 0;
    v.controls.steer = 0;
    v.controls.handbrake = !force && sp < 9;
    this.vehicle = null;
    this.curSpeed = 0;
    if (g.audio) { g.audio.door(); g.audio.stopEngine(); }
  }

  takeDamage(amount, how = 'bullet') {
    if (this.dead || this.game.godMode) return;
    this.hurtT = 4;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.66);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    if (this.game.hud) this.game.hud.flashDamage();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      if (this.vehicle) this.exitVehicle();
      this.body.kill();
      if (this.game.onPlayerDied) this.game.onPlayerDied(how);
    }
  }

  respawn(x, z) {
    this.dead = false;
    this.health = 100;
    this.armor = 0;
    this.body.pose = 'move';
    this.body.deadT = 0;
    this.body.hips.rotation.x = 0;
    this.position.set(x, 0.16, z);
    this.body.update(0);
  }
}

export const PLAYER_START = { x: 351, z: -150 };
