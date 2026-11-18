// Particles and flashes: muzzle flashes with a real light, bullet tracers, impact sparks, blood,
// tyre smoke, engine smoke and fire, explosions, cash sparkles and the mission marker beams.
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { rand } from './rng.js';

const KINDS = {
  spark: { tex: 'soft', color: 0xffa040, add: true, life: 0.3, size: 0.14, grow: 0, gravity: -14 },
  blood: { tex: 'smoke', color: 0x8a0d12, add: false, life: 0.5, size: 0.35, grow: 0.6, gravity: -6 },
  dust: { tex: 'smoke', color: 0xcbb89a, add: false, life: 0.7, size: 0.5, grow: 1.4, gravity: 0.4 },
  tire: { tex: 'smoke', color: 0xe8e4de, add: false, life: 1.6, size: 1.2, grow: 2.2, gravity: 0.6 },
  dark: { tex: 'smoke', color: 0x3a3836, add: false, life: 1.8, size: 0.9, grow: 1.6, gravity: 2.2 },
  fire: { tex: 'soft', color: 0xff7a2a, add: true, life: 0.6, size: 1.1, grow: 0.8, gravity: 3.5 },
  flash: { tex: 'star', color: 0xffc46a, add: true, life: 0.06, size: 0.42, grow: 1.5, gravity: 0 },
  boom: { tex: 'soft', color: 0xffa040, add: true, life: 0.9, size: 3, grow: 5, gravity: 2 },
  cash: { tex: 'soft', color: 0x7dff9a, add: true, life: 0.7, size: 0.3, grow: 0, gravity: 3 },
};

export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.pool = [];
    this.active = [];
    this.materials = {};
    for (const [k, def] of Object.entries(KINDS)) {
      this.materials[k] = new THREE.SpriteMaterial({
        map: glowTexture(def.tex), color: def.color, transparent: true, depthWrite: false,
        blending: def.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !def.add,
      });
    }
    // one pooled light for muzzle flashes and explosions
    this.flashLight = new THREE.PointLight(0xffc070, 0, 14, 2);
    this.scene.add(this.flashLight);
    this.flashT = 0;
    this.tracers = [];
    this.markers = [];
  }

  emit(kind, x, y, z, vx = 0, vy = 0, vz = 0, scale = 1) {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(this.materials[kind]);
      this.scene.add(s);
    }
    const def = KINDS[kind];
    s.material = this.materials[kind].clone();
    s.visible = true;
    s.position.set(x, y, z);
    s.material.rotation = rand() * 6.28;
    const p = { s, def, kind, vx, vy, vz, age: 0, life: def.life * (0.7 + rand() * 0.6), size: def.size * scale };
    s.scale.setScalar(p.size);
    this.active.push(p);
    if (this.active.length > 700) this.kill(0);
    return p;
  }

  kill(i) {
    const p = this.active[i];
    p.s.visible = false;
    p.s.material.dispose();
    this.pool.push(p.s);
    this.active.splice(i, 1);
  }

  muzzleFlash(pos, dir, scale = 1) {
    this.emit('flash', pos.x, pos.y, pos.z, 0, 0, 0, scale);
    this.emit('flash', pos.x + dir.x * 0.18, pos.y + dir.y * 0.18, pos.z + dir.z * 0.18, 0, 0, 0, 0.55);
    for (let i = 0; i < 3; i++) this.emit('spark', pos.x, pos.y, pos.z, dir.x * 8 + (rand() - 0.5) * 3, dir.y * 8 + rand() * 2, dir.z * 8 + (rand() - 0.5) * 3, 0.25);
    this.lightAt(pos, 0xffc070, 30, 0.07);
  }

  lightAt(pos, color, intensity, time) {
    this.flashLight.position.copy(pos);
    this.flashLight.color.set(color);
    this.flashLight.intensity = intensity;
    this.flashT = time;
  }

  /** A short glowing streak travelling down the bullet's path. */
  tracer(from, to) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.5) return;
    dir.normalize();
    const len = Math.min(3, dist * 0.4);
    const mid = from.clone().addScaledVector(dir, Math.min(dist - len / 2, dist * 0.45 + len / 2));
    if (!this.tracerGeo) {
      this.tracerGeo = new THREE.CylinderGeometry(0.012, 0.006, 1, 6, 1, true);
      this.tracerGlowGeo = new THREE.CylinderGeometry(0.055, 0.018, 1, 8, 1, true);
    }
    const core = new THREE.Mesh(this.tracerGeo, new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glow = new THREE.Mesh(this.tracerGlowGeo, new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const line = new THREE.Group();
    line.add(core, glow);
    line.position.copy(mid);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    line.scale.set(1, len, 1);
    this.scene.add(line);
    this.tracers.push({ line, t: 0.09, mats: [core.material, glow.material] });
  }

  sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) this.emit('spark', x, y, z, (rand() - 0.5) * 9, rand() * 6, (rand() - 0.5) * 9);
  }

  impact(x, y, z, hitFlesh) {
    if (hitFlesh) for (let i = 0; i < 6; i++) this.emit('blood', x, y, z, (rand() - 0.5) * 3, rand() * 2, (rand() - 0.5) * 3);
    else {
      this.sparks(x, y, z, 5);
      this.emit('dust', x, y, z, 0, 0.5, 0);
    }
  }

  tireSmoke(x, z) {
    this.emit('tire', x + (rand() - 0.5), 0.4, z + (rand() - 0.5), (rand() - 0.5), 0.4, (rand() - 0.5));
  }

  smoke(x, y, z, kind = 'dark') {
    if (kind === 'fire') {
      this.emit('fire', x + (rand() - 0.5) * 0.6, y, z + (rand() - 0.5) * 0.6, 0, 1.5, 0);
      this.emit('dark', x, y + 0.6, z, (rand() - 0.5), 2, (rand() - 0.5));
    } else this.emit('dark', x, y, z, (rand() - 0.5) * 0.5, 1.5, (rand() - 0.5) * 0.5, 0.8);
  }

  explosion(x, y, z) {
    for (let i = 0; i < 26; i++) this.emit('boom', x + (rand() - 0.5) * 2, y + rand() * 1.5, z + (rand() - 0.5) * 2, (rand() - 0.5) * 10, rand() * 9, (rand() - 0.5) * 10, 0.6 + rand() * 0.6);
    for (let i = 0; i < 18; i++) this.emit('dark', x, y + 1, z, (rand() - 0.5) * 6, 3 + rand() * 4, (rand() - 0.5) * 6, 2);
    this.sparks(x, y, z, 30);
    this.lightAt(new THREE.Vector3(x, y + 2, z), 0xff8030, 400, 0.5);
    if (this.game.cameraRig) this.game.cameraRig.shake(0.8);
  }

  cashBurst(x, y, z) {
    for (let i = 0; i < 14; i++) this.emit('cash', x, y, z, (rand() - 0.5) * 4, rand() * 4, (rand() - 0.5) * 4);
  }

  /** A tall glowing beam with a floating chevron, marking where the story wants you. */
  addMarker(x, z, color = 0xffd23f) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 30, 20, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    beam.position.y = 15;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.2, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.3, 4), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    chevron.rotation.x = Math.PI;
    chevron.position.y = 3.2;
    group.add(beam, ring, chevron);
    group.position.set(x, 0, z);
    this.scene.add(group);
    const m = { group, chevron, beam };
    this.markers.push(m);
    return m;
  }

  removeMarker(m) {
    if (!m) return;
    this.scene.remove(m.group);
    this.markers = this.markers.filter((x) => x !== m);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      if (p.age >= p.life) { this.kill(i); continue; }
      const t = p.age / p.life;
      p.vy += p.def.gravity * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y = Math.max(0.05, p.s.position.y + p.vy * dt);
      p.s.position.z += p.vz * dt;
      p.vx *= 1 - dt * 1.5;
      p.vz *= 1 - dt * 1.5;
      p.s.scale.setScalar(p.size * (1 + p.def.grow * t));
      p.s.material.opacity = (1 - t) * (p.kind === 'tire' ? 0.55 : p.kind === 'dark' ? 0.7 : 1);
      if (p.kind === 'boom') p.s.material.color.setHSL(0.08 - t * 0.08, 1, 0.6 - t * 0.45);
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flashLight.intensity = 0;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t -= dt;
      tr.mats[0].opacity = Math.max(0, tr.t / 0.09);
      tr.mats[1].opacity = Math.max(0, tr.t / 0.09) * 0.45;
      if (tr.t <= 0) {
        this.scene.remove(tr.line);
        for (const m of tr.mats) m.dispose();
        this.tracers.splice(i, 1);
      }
    }
    const time = this.game.time;
    for (const m of this.markers) {
      m.chevron.position.y = 3.2 + Math.sin(time * 3) * 0.35;
      m.chevron.rotation.y = time * 2;
      m.beam.material.opacity = 0.18 + Math.sin(time * 4) * 0.05;
    }
  }
}
