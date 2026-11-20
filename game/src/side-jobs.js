// Optional work, supply stops and the Flamingo garage. These loops remain available after the story.
import { PLACES } from './map.js';
import { VEHICLE_TYPES } from './vehicles.js';

export const SERVICES = [
  { id: 'garage', name: 'Flamingo Rest', detail: 'Garage & safehouse', x: 351, z: -160, color: '#ffa8b9' },
  { id: 'supply', name: 'Marisol Supply', detail: 'Armour, sidearms & ammunition', x: 49, z: -116, color: '#75e2c2' },
  { id: 'courier', name: 'Bay Dispatch', detail: 'Timed delivery contracts', x: 369, z: -152, color: '#ffce85' },
];
const ROUTES = [
  { name: 'Morning Edition', stops: [[360,-40],[360,120],[360,245],[280,360],[195,360]], seconds: 86, pay: 930 },
  { name: 'Canal Express', stops: [[360,-40],[202,-40],[200,120],[116,120],[40,202]], seconds: 84, pay: 1040 },
  { name: 'The Westbound', stops: [[280,-120],[120,-120],[-40,-120],[-120,-200],[-275,-200]], seconds: 80, pay: 1120 },
];
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const money = n => '$' + n.toLocaleString('en-US');

export class SideJobs {
  constructor(game) {
    this.game = game;
    this.plan = null;
    this.parked = null;
    this.best = {};
    this.next = 0;
    this.kiosks = SERVICES.map(p => game.effects.addMarker(p.x,p.z,Number('0x'+p.color.slice(1))));
    for (const m of this.kiosks) { m.beam.visible = false; m.group.scale.setScalar(.66); }
    this.panel = document.createElement('section');
    this.panel.className = 'service-panel';
    this.panel.hidden = true;
    document.body.appendChild(this.panel);
  }

  pack() { return { parked: this.parked, best: this.best, next: this.next }; }
  restore(data) {
    this.stop();
    this.parked = data?.parked && Object.hasOwn(VEHICLE_TYPES, data.parked.type) ? data.parked : null;
    this.best = data?.best || {};
    this.next = Number.isInteger(data?.next) ? (data.next % ROUTES.length + ROUTES.length) % ROUTES.length : 0;
  }

  get target() {
    const stop = this.plan?.route.stops[this.plan.leg];
    return stop ? { x: stop[0], z: stop[1] } : null;
  }

  open(service) {
    const g = this.game;
    if (g.mode !== 'play') return;
    g.mode = 'service';
    g.input?.unlockPointer();
    this.panel.hidden = false;
    const items = service.id === 'supply' ? [
      ['pistol','Kestrel .45 + 36 rounds',175],['smg','Vandal SMG + 96 rounds',600],
      ['armor','Body armour',225], ['ammo','Refill equipped weapon',80],
    ] : service.id === 'garage' ? [['save','Save at Flamingo Rest',0],
      [g.player.vehicle ? 'park' : 'retrieve', g.player.vehicle ? 'Store current car & save' : 'Retrieve stored car',0],
    ] : [['deliver', `Accept ${ROUTES[this.next].name} · ${money(ROUTES[this.next].pay)}`,0]];
    this.panel.innerHTML = `<header>Coralina Bay / Local services</header><h2>${service.name}</h2><p>${service.detail}</p><output>${money(g.stats.cash)} available</output>`;
    for (const [id,label,price] of [...items,['close','Back to the street',0]]) {
      const b = document.createElement('button');
      b.textContent = label + (price ? ` — ${money(price)}` : '');
      b.addEventListener('click', () => this.choose(id, price));
      this.panel.appendChild(b);
    }
    this.panel.querySelector('button').focus();
  }

  close() {
    this.panel.hidden = true;
    if (this.game.mode === 'service') this.game.resume();
  }

  choose(id, price) {
    const g = this.game, p = g.player;
    const say = msg => { this.panel.querySelector('output').textContent = msg; };
    if (id === 'close') { this.close(); return; }
    if (g.wanted.level) { say('Lose the police before using this service.'); return; }
    if (g.stats.cash < price) { say('Not enough cash.'); return; }
    if (id === 'save') {
      if (g.missions.active || this.plan) { say('Finish your current job before saving here.'); return; }
      say(g.save.save() ? 'Game saved.' : 'Save failed.'); return;
    }
    if (id === 'park') {
      if (g.missions.active || this.plan) { say('Finish your job before storing its vehicle.'); return; }
      if (!p.vehicle || p.vehicle.wrecked || p.vehicle.burnTimer >= 0 || Math.abs(p.vehicle.speed) > 1) return;
      const v = p.vehicle;
      this.parked = { type: v.type, color: v.paintMat?.color?.getHex() ?? 0xe04438 };
      p.exitVehicle();
      p.position.set(PLACES.safehouse.x, .16, PLACES.safehouse.z);
      g.vehicles.remove(v);
      g.save.save();
      this.close(); return;
    }
    if (id === 'retrieve') {
      if (!this.parked) { say('The garage is empty.'); return; }
      if (g.vehicles.nearest(355,-162,4)) { say('The pullout is blocked.'); return; }
      const v = g.vehicles.spawn(this.parked.type,355,-162,Math.PI,this.parked.color);
      v.controls.handbrake = true;
      this.parked = null;
      this.close(); return;
    }
    if (id === 'deliver') {
      if (!p.vehicle || !this.begin(p.vehicle)) { say('Bring a driveable car and finish any active story job first.'); return; }
      this.close(); return;
    }
    if (id === 'armor') {
      if (p.armor >= 100) { say('Armour already full.'); return; }
      p.armor = 100;
    } else if (id === 'ammo') {
      if (p.current === 'fists') { say('Equip a firearm to buy ammunition for it.'); return; }
      p.giveWeapon(p.current, p.current === 'smg' ? 96 : 36);
    } else if (id === 'pistol' || id === 'smg') p.giveWeapon(id, id === 'smg' ? 96 : 36);
    else return;
    g.addCash(-price);
    say(`Purchased · ${money(g.stats.cash)} remaining`);
  }

  begin(vehicle) {
    if (this.plan || this.game.missions.active || this.game.wanted.level || vehicle.wrecked) return false;
    const route = ROUTES[this.next];
    this.plan = { route, leg: 0, remaining: route.seconds, vehicle, marker: null };
    this.placeCheckpoint();
    return true;
  }

  placeCheckpoint() {
    const p = this.plan;
    if (p.marker) this.game.effects.removeMarker(p.marker);
    const t = this.target;
    p.marker = this.game.effects.addMarker(t.x,t.z,0xffce85);
    p.marker.beam.visible = false;
  }

  stop(message) {
    if (!this.plan) return;
    if (this.plan.marker) this.game.effects.removeMarker(this.plan.marker);
    this.plan = null;
    this.game.missions.prepareNext();
    if (message) this.game.hud.toast(message);
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.plan) {
      g.hud.interact('');
      const job = this.plan;
      job.remaining -= dt;
      if (job.remaining <= 0 || p.dead || job.vehicle.wrecked || g.wanted.level) { this.stop('Dispatch cancelled. Try another run at Ocean Drive.'); return; }
      if (p.vehicle === job.vehicle && distance(p.position,this.target) < 8) {
        if (++job.leg === job.route.stops.length) {
          const seconds = job.route.seconds - job.remaining;
          this.best[job.route.name] = Math.min(seconds,this.best[job.route.name] ?? Infinity);
          this.next = (this.next+1)%ROUTES.length;
          g.addCash(job.route.pay + Math.floor(job.remaining)*7);
          this.stop('Delivery cleared. Time bonus paid.');
          g.save.autosave();
          return;
        }
        this.placeCheckpoint();
        g.audio.ui();
      }
      g.hud.setObjective(job.route.name, `${p.vehicle === job.vehicle ? 'Drive through the next checkpoint' : 'Return to the delivery vehicle'} · ~${job.leg+1}/${job.route.stops.length}~`);
      return;
    }
    const place = SERVICES.find(s => distance(s,p.position) < (p.vehicle ? 11 : 3.5) && (!p.vehicle || s.id !== 'supply') && (!p.vehicle || Math.abs(p.vehicle.speed) < 1));
    if (!place || p.dead) {
      const v = !p.dead && !p.vehicle && g.vehicles.nearest(p.position.x,p.position.z,4.5,o => !o.wrecked);
      g.hud.interact(v ? `${v.driver ? 'Take' : 'Enter'} the ${v.label}` : '', 'F');
      return;
    }
    g.hud.interact(place.name);
    if (g.input.wasPressed('KeyB')) this.open(place);
  }
}
