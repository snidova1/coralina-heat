// The camera rig: an orbiting shoulder camera on foot (tight over the right shoulder when aiming),
// a lagging chase camera behind cars that pulls back and widens with speed, camera shake, wall
// avoidance, and a slow cinematic orbit for the title screen.
import * as THREE from 'three';

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.yaw = Math.PI;
    this.pitch = 0.18;
    this.dist = 5;
    this.trauma = 0;
    this.lookIdle = 10;
    this.mode = 'foot';
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.cine = { t: 0, centre: new THREE.Vector3(395, 0, -226) };
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  /** Feed mouse motion (pointer-locked) into yaw and pitch. */
  look(dx, dy) {
    this.yaw -= dx * 0.0024;
    this.pitch = Math.max(-0.45, Math.min(1.1, this.pitch + dy * 0.002));
    if (Math.abs(dx) + Math.abs(dy) > 0.5) this.lookIdle = 0;
  }

  update(dt) {
    const g = this.game;
    const cam = this.camera;
    this.lookIdle += dt;
    if (this.mode === 'cinematic') {
      this.cine.t += dt * 0.035;
      const a = this.cine.t;
      cam.position.set(460 + Math.sin(a) * 10, 15.6 + (1-Math.cos(a)) * 6, -346 + Math.sin(a) * 24);
      cam.lookAt(this.cine.centre.x, 8.6, this.cine.centre.z);
      cam.fov = 54;
      cam.updateProjectionMatrix();
      return;
    }
    if (this.mode === 'fixed') return;
    const p = g.player;
    const v = p.vehicle;
    let fovTarget = 62;
    if (v) {
      const sp = Math.abs(v.speed);
      // swing round behind the car unless the player is looking about
      const behind = v.speed < -2 ? v.heading + Math.PI : v.heading;
      if (this.lookIdle > 1.2) {
        let d = behind - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += d * Math.min(1, dt * (2 + sp * 0.05));
        this.pitch += (0.2 - this.pitch) * Math.min(1, dt * 2);
      }
      this.target.set(v.position.x, v.position.y + 1.5, v.position.z);
      const want = 7.2 + Math.min(sp, 50) * 0.07 + (v.type === 'pickup' ? 1 : 0);
      this.dist += (want - this.dist) * Math.min(1, dt * 3);
      fovTarget = 62 + Math.min(sp, 60) * 0.28;
    } else {
      const aiming = p.aiming;
      this.target.set(p.position.x, p.position.y + 1.55, p.position.z);
      const want = aiming ? 2.4 : 4.6;
      this.dist += (want - this.dist) * Math.min(1, dt * 8);
      if (aiming) {
        // over the right shoulder
        const rx = -Math.cos(this.yaw);
        const rz = Math.sin(this.yaw);
        this.target.x += rx * 0.95;
        this.target.z += rz * 0.95;
        this.target.y += 0.1;
        fovTarget = 52;
      }
    }
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    let dist = this.dist;
    // pull in if a building is in the way
    const hit = g.city.raycast(this.target.x, this.target.y, this.target.z, -dir.x, -dir.y, -dir.z, dist + 0.5);
    if (hit < dist + 0.5) dist = Math.max(1.2, hit - 0.5);
    this.pos.copy(this.target).addScaledVector(dir, -dist);
    this.pos.y = Math.max(this.pos.y, (v ? v.position.y : p.position.y) + 0.5);
    cam.position.copy(this.pos);
    cam.lookAt(this.target.x + dir.x * 10, this.target.y + dir.y * 10 + (v ? 0 : 0.1), this.target.z + dir.z * 10);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const t = g.time * 40;
      cam.rotation.z += Math.sin(t * 1.3) * 0.03 * s;
      cam.position.x += Math.sin(t) * 0.25 * s;
      cam.position.y += Math.cos(t * 1.7) * 0.2 * s;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
    }
    cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();
  }

  /** The direction the crosshair points, for aiming. */
  aimRay() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin: this.camera.position.clone(), dir };
  }

  /** Place the camera exactly (screenshot scenes). */
  setFixed(px, py, pz, tx, ty, tz, fov = 60) {
    this.mode = 'fixed';
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(tx, ty, tz);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}
