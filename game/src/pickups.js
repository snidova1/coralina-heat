// Pickups: spinning cash bundles, health hearts, armour vests and ammo boxes round the bay, and the
// cash dropped by downed gangsters; they respawn after a while so exploring keeps paying.
import * as THREE from 'three';
import { PICKUPS } from './story.js';

const COLORS = { cash: 0x45d16a, health: 0xff4f6d, armor: 0x4f9bff, ammo: 0xffc93c };

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
    for (const d of PICKUPS) this.add(d.kind, d.x, d.z, d.amount);
  }

  add(kind, x, z, amount = 0, temporary = false) {
    const g = this.game;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[kind], emissive: COLORS[kind], emissiveIntensity: 0.6, roughness: 0.4 });
    let mesh;
    if (kind === 'cash') {
      mesh = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.35), mat);
        b.position.y = k * 0.13;
        b.rotation.y = k * 0.2;
        mesh.add(b);
      }
    } else if (kind === 'health') {
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), mat), new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat));
    } else if (kind === 'armor') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.6, 8).scale(1, 1, 0.6), mat);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), mat);
    }
    mesh.position.y = 1;
    group.add(mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 24), new THREE.MeshBasicMaterial({ color: COLORS[kind], transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    group.add(ring);
    group.position.set(x, 0, z);
    g.scene.add(group);
    const item = { kind, x, z, amount, group, mesh, taken: false, respawn: 0, temporary };
    this.list.push(item);
    return item;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i];
      if (k.taken) {
        k.respawn -= dt;
        if (k.respawn <= 0) { k.taken = false; k.group.visible = true; }
        continue;
      }
      k.mesh.rotation.y += dt * 2;
      k.mesh.position.y = 1 + Math.sin(g.time * 3 + i) * 0.15;
      if (Math.hypot(p.position.x - k.x, p.position.z - k.z) < (p.vehicle ? 3 : 1.6) && !p.dead) this.collect(k, i);
    }
  }

  collect(k, i) {
    const g = this.game;
    const p = g.player;
    if (k.kind === 'health' && p.health >= 100) return;
    if (k.kind === 'armor' && p.armor >= 100) return;
    if (k.kind === 'cash') g.addCash(k.amount);
    if (k.kind === 'health') p.health = 100;
    if (k.kind === 'armor') p.armor = 100;
    if (k.kind === 'ammo') {
      for (const id of Object.keys(p.weapons)) if (id !== 'fists') p.weapons[id].ammo += id === 'smg' ? 64 : 24;
      if (!p.weapons.pistol) p.giveWeapon('pistol', 36);
    }
    g.effects.cashBurst(k.x, 1, k.z);
    if (g.audio) g.audio.pickup();
    if (g.hud) g.hud.toast(k.kind === 'cash' ? `Found ~$${k.amount}~` : k.kind === 'ammo' ? 'Ammo restocked' : k.kind === 'armor' ? 'Body armour' : 'Health restored', 2);
    if (k.temporary) {
      g.scene.remove(k.group);
      this.list.splice(i, 1);
    } else {
      k.taken = true;
      k.respawn = 120;
      k.group.visible = false;
    }
  }
}
