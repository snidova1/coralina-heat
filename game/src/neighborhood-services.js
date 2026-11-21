// Real local services: motel saves, equipment purchases, repairs and a timed seafront courier job.
import * as THREE from 'three';
import { PLACES, BOULEVARD_X } from './map.js';

const STOPS = [
  { ...PLACES.safehouse, icon: 'H', key: 'motel', action: 'Save and rest', price: 0 },
  { x: 49.2, z: -151, name: 'Crescent Outfitters', icon: '+', key: 'outfit', action: 'Pistol ammo + body armor', price: 190 },
  { x: 49.2, z: -157, name: 'Crescent Counter', icon: '+', key: 'smg', action: 'Vandal SMG + 96 rounds', price: 940 },
  { x: 270.5, z: -38, name: 'Palmetto Motor Works', icon: 'R', key: 'repair', action: 'Repair vehicle', price: 160 },
  { x: 369.6, z: -186, name: 'Baywave Dispatch', icon: 'B', key: 'courier', action: 'Start coastal delivery', price: 0 },
];
const DELIVERY = [
  {x:BOULEVARD_X,z:-123}, {x:BOULEVARD_X,z:-48}, {x:BOULEVARD_X,z:35}, {x:BOULEVARD_X,z:110}, {x:BOULEVARD_X,z:205},
];

export class NeighborhoodServices {
  constructor(game) {
    this.game = game;
    this.sites = STOPS.map(site => ({ ...site }));
    this.promptKey = '';
    this.cooldown = 0;
    for (const [index,s] of this.sites.entries()) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.85,1.00,36), new THREE.MeshBasicMaterial({color:0xffbe73,transparent:true,opacity:.64,depthWrite:false}));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x,index === 3 ? .175 : .181,s.z);
      ring.visible = Boolean(game.input);
      game.scene.add(ring);
      s.ring = ring;
    }
  }

  run(site) {
    const g = this.game, p = g.player;
    if (g.wanted.level) return g.hud.toast('Lose your wanted level first.');
    if (g.stats.cash < site.price) return g.hud.toast(`You need $${site.price}.`);
    if (site.key === 'motel') {
      if (g.missions.active || this.delivery) return g.hud.toast('Finish the active job before checking in.');
      if (p.vehicle) return g.hud.toast('Get out of your car to check in.');
      p.health = 100;
      g.save.save();
      return;
    }
    if (site.key === 'repair') {
      if (!p.vehicle || p.vehicle.wrecked || Math.abs(p.vehicle.speed) > 2) return g.hud.toast('Come to a full stop in a working vehicle.');
      if (p.vehicle.health > 99) return g.hud.toast('Your car is already in good shape.');
      p.vehicle.health = 100;
      p.vehicle.burnTimer = -1;
    } else if (site.key === 'courier') {
      if (!p.vehicle || g.missions.active || this.delivery) return g.hud.toast('Bring a car and finish any active job first.');
      if (this.cooldown > 0) return g.hud.toast('Dispatch is waiting on the next package.');
      this.delivery = { index: 0, time: 42 };
      this.placeDeliveryMarker();
      return;
    } else if (p.vehicle) return g.hud.toast('Come to the counter on foot.');
    else if (site.key === 'outfit') { p.giveWeapon('pistol',48); p.armor = 100; }
    else if (site.key === 'smg') p.giveWeapon('smg',96);
    g.addCash(-site.price);
    g.hud.toast(site.key === 'repair' ? 'Vehicle repaired.' : 'Equipment stocked.');
  }

  placeDeliveryMarker() {
    const {x,z} = this.target;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(3.2,4.1,56), new THREE.MeshBasicMaterial({color:0x8affdf,side:THREE.DoubleSide,transparent:true,opacity:.81,depthWrite:false}));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x,.08,z);
    this.game.scene.add(mesh);
    this.marker = mesh;
  }

  removeDeliveryMarker() {
    if (!this.marker) return;
    this.marker.removeFromParent();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
    this.marker = null;
  }

  get target() { return this.delivery ? DELIVERY[this.delivery.index] : null; }

  reset() {
    this.removeDeliveryMarker();
    this.delivery = null;
    this.cooldown = 0;
    this.promptKey = '';
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.cooldown = Math.max(0,this.cooldown - dt);
    const near = this.sites.filter(s => Math.hypot(s.x-p.position.x,s.z-p.position.z) < (p.vehicle ? 6.5 : 4.0)).sort((a,b) => Math.hypot(a.x-p.position.x,a.z-p.position.z)-Math.hypot(b.x-p.position.x,b.z-p.position.z))[0];
    if (near?.key !== this.promptKey) {
      this.promptKey = near?.key;
      if (near) g.hud.hint(`~X~ ${near.action}${near.price ? ` · $${near.price}` : ''}`, 4);
    }
    if (near && g.input.wasPressed('KeyX')) this.run(near);
    if (!this.delivery) return;
    const job = this.delivery;
    job.time -= dt;
    const to = this.target;
    if (job.time <= 0 || p.dead || g.respawnT > 0 || g.missions.active) return this.finish(false);
    if (p.vehicle && Math.hypot(p.position.x-to.x,p.position.z-to.z) < 6.2) {
      this.removeDeliveryMarker();
      if (++job.index === DELIVERY.length) return this.finish(true);
      this.placeDeliveryMarker();
      g.audio.click();
    }
    g.hud.setObjective('Baywave Express', `Make the drop · ${job.index}/${DELIVERY.length} · ~${Math.ceil(job.time)}s~`);
  }

  finish(success) {
    const g = this.game;
    this.removeDeliveryMarker();
    this.delivery = null;
    this.cooldown = 20;
    if (success) g.addCash(750);
    g.hud.toast(success ? 'Delivery paid: $750' : 'Delivery cancelled.');
    if (!g.missions.active) g.missions.prepareNext();
  }
}
