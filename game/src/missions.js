// The mission runner: puts each job's contact on the street with a marker, plays its steps in order
// (talk, steal a car, drive somewhere against the clock, clear out a crew, lose the cops), keeps the
// objective line and blips current, pays out on success and resets on failure.
import * as THREE from 'three';
import { MISSIONS, CAST } from './story.js';
import { Actor } from './actors.js';
import { ShooterBrain } from './enemies.js';
import { randomLook } from './humanoid.js';

const CONTACT_LOOKS = {
  paloma: { skin: 0xd9a07a, hair: 0x2a1a12, shirt: 0xff5fa2, pants: 0xf4efe6, shoes: 0xffffff, longHair: true, skirt: true, build: 0.95, height: 0.96 },
  tito: { skin: 0x8a5536, hair: 0x111111, shirt: 0xffd166, pants: 0x3c3c3c, shoes: 0x222222, cap: true, capColor: 0x1e2a78, build: 1.15, height: 0.98 },
  vera: { skin: 0xf1c7a3, hair: 0xc89a5a, shirt: 0x7b2cbf, pants: 0x111111, shoes: 0x111111, longHair: true, skirt: true, build: 0.92, height: 1.02 },
  crane: { skin: 0xe8b590, hair: 0x8a8a8a, shirt: 0x6b4f3a, pants: 0x4a3a2a, shoes: 0x222222, build: 1.1, height: 1.04, vest: false },
};

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.active = null;
    this.step = -1;
    this.contact = null;
    this.startMarker = null;
    this.marker = null;
    this.enemies = [];
    this.vehicle = null;
    this.timer = 0;
    this.talkT = 0;
    this.talkLine = 0;
  }

  get current() { return MISSIONS[this.index]; }
  get finishedAll() { return this.index >= MISSIONS.length; }
  get stepDef() { return this.active ? this.active.steps[this.step] : null; }

  /** Place the next job's contact and start marker. */
  prepareNext() {
    this.clearContact();
    if (this.finishedAll) return;
    const m = this.current;
    const g = this.game;
    const lookBase = CONTACT_LOOKS[m.giver] || {};
    const look = Object.assign(randomLook('civilian'), lookBase, { cap: !!lookBase.cap, longHair: !!lookBase.longHair, skirt: !!lookBase.skirt, shorts: false });
    this.contact = new Actor(g, 'contact', m.start.x + 1.5, m.start.z, look);
    this.contact.health = 9999;
    this.startMarker = g.effects.addMarker(m.start.x, m.start.z, 0xffd23f);
    if (g.hud) g.hud.setObjective(null, `Meet ~${CAST[m.giver].full}~ for "${m.title}" (yellow ${CAST[m.giver].name[0]} on the radar).`);
  }

  clearContact() {
    if (this.contact) { this.contact.dispose(); this.contact = null; }
    if (this.startMarker) { this.game.effects.removeMarker(this.startMarker); this.startMarker = null; }
  }

  begin() {
    const g = this.game;
    this.active = this.current;
    if (this.startMarker) { g.effects.removeMarker(this.startMarker); this.startMarker = null; }
    this.step = -1;
    if (g.hud) g.hud.missionTitle(this.active.title);
    if (g.audio) g.audio.jingle('start');
    this.advance();
  }

  advance() {
    const g = this.game;
    if (this.marker) { g.effects.removeMarker(this.marker); this.marker = null; }
    this.step += 1;
    const s = this.stepDef;
    if (!s) { this.complete(); return; }
    this.timer = s.timer || 0;
    const hud = g.hud;
    switch (s.type) {
      case 'talk':
        this.talkLine = 0;
        this.talkT = 0;
        this.sayLine();
        break;
      case 'enterVehicle':
        if (s.spawn) {
          this.vehicle = g.vehicles.spawn(s.spawn.type, s.spawn.x, s.spawn.z, s.spawn.heading, s.spawn.color);
          this.marker = g.effects.addMarker(s.spawn.x, s.spawn.z, 0x4fc3ff);
        }
        hud.setObjective(this.active.title, s.text);
        break;
      case 'goto':
        this.marker = g.effects.addMarker(s.x, s.z, 0xffd23f);
        hud.setObjective(this.active.title, s.text);
        break;
      case 'eliminate':
        this.enemies = s.spawn.map(([x, z, kind]) => {
          const a = new Actor(g, kind === 'boss' ? 'boss' : 'thug', x, z);
          a.brain = new ShooterBrain(a, { mode: 'thug', accuracy: kind === 'boss' ? 0.5 : 0.32, damage: kind === 'boss' ? 10 : 7, rate: kind === 'boss' ? 0.35 : 0.85, range: 22, guard: { x, z }, alertRange: 34 });
          a.heading = Math.PI;
          const tag = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4), new THREE.MeshBasicMaterial({ color: kind === 'boss' ? 0xffd23f : 0xff3b3b, toneMapped: false }));
          tag.rotation.x = Math.PI;
          tag.position.y = 2.35;
          a.body.root.add(tag);
          a.tag = tag;
          return a;
        });
        hud.setObjective(this.active.title, `${s.text} (0/${this.enemies.length})`);
        break;
      case 'wanted':
        g.wanted.setLevel(s.level);
        this.advance();
        break;
      case 'evade':
        hud.setObjective(this.active.title, s.text);
        break;
      case 'giveWeapon':
        g.player.giveWeapon(s.weapon, s.ammo);
        hud.toast(`Picked up the ${s.weapon === 'smg' ? 'Vandal SMG' : 'Kestrel .45'}`);
        this.advance();
        break;
      default:
        this.advance();
    }
  }

  sayLine() {
    const s = this.stepDef;
    const [who, text] = s.lines[this.talkLine];
    const c = CAST[who];
    this.game.hud.subtitle(c.name, c.color, text, 3.6);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (this.contact) {
      this.contact.faceToward(p.position.x, p.position.z, dt);
      this.contact.update(dt);
    }
    for (const e of this.enemies) {
      e.update(dt);
      if (e.tag) { e.tag.visible = e.alive; e.tag.rotation.y += dt * 3; }
    }
    if (!this.active) {
      if (this.finishedAll || p.dead) return;
      if (!this.contact) this.prepareNext();
      const m = this.current;
      if (Math.hypot(p.position.x - m.start.x, p.position.z - m.start.z) < 4 && g.wanted.level === 0 && !p.vehicle) this.begin();
      return;
    }
    const s = this.stepDef;
    if (!s) return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { this.fail('Too slow.'); return; }
    }
    if (this.vehicle && this.vehicle.wrecked) { this.fail('The car was wrecked.'); return; }
    switch (s.type) {
      case 'talk':
        this.talkT += dt;
        if (this.talkT > 3.6) {
          this.talkT = 0;
          this.talkLine += 1;
          if (this.talkLine >= s.lines.length) {
            if (this.step === 0) this.clearContact();
            this.advance();
          } else this.sayLine();
        }
        break;
      case 'enterVehicle':
        if (p.vehicle && (!this.vehicle || p.vehicle === this.vehicle)) this.advance();
        break;
      case 'goto': {
        if (s.vehicle && !p.vehicle) {
          g.hud.setObjective(this.active.title, 'Get back in a ~vehicle~.');
          break;
        }
        g.hud.setObjective(this.active.title, s.text);
        const d = Math.hypot(p.position.x - s.x, p.position.z - s.z);
        if (d < s.r) this.advance();
        break;
      }
      case 'eliminate': {
        const left = this.enemies.filter((e) => e.alive).length;
        g.hud.setObjective(this.active.title, `${s.text} (${this.enemies.length - left}/${this.enemies.length})`);
        if (left === 0) {
          this.advance();
        }
        break;
      }
      case 'evade':
        if (g.wanted.level === 0) this.advance();
        break;
      default:
        break;
    }
  }

  complete() {
    const g = this.game;
    const m = this.active;
    g.addCash(m.reward);
    g.stats.missionsDone = Math.max(g.stats.missionsDone, this.index + 1);
    g.hud.banner('JOB DONE', `+$${m.reward.toLocaleString('en-US')}`, '#ffd23f');
    if (g.audio) g.audio.jingle('pass');
    this.cleanup(true);
    this.index += 1;
    this.active = null;
    if (g.save) g.save.autosave();
    if (this.finishedAll) g.hud.setObjective('Coralina Bay', 'Story complete. The bay is yours. Explore, earn, cause trouble.');
  }

  fail(reason) {
    const g = this.game;
    g.hud.banner('JOB BLOWN', reason, '#ff4f5f');
    if (g.audio) g.audio.jingle('fail');
    this.cleanup(false);
    this.active = null;
  }

  cleanup(keepVehicle) {
    const g = this.game;
    if (this.marker) { g.effects.removeMarker(this.marker); this.marker = null; }
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    if (this.vehicle && !keepVehicle && g.player.vehicle !== this.vehicle) g.vehicles.remove(this.vehicle);
    this.vehicle = null;
    this.timer = 0;
    this.clearContact();
  }

  /** Radar blips for the minimap. */
  blips() {
    const out = [];
    if (!this.active && !this.finishedAll) {
      const m = this.current;
      out.push({ x: m.start.x, z: m.start.z, kind: 'contact', label: CAST[m.giver].name[0] });
    }
    const s = this.stepDef;
    if (s && s.type === 'goto') out.push({ x: s.x, z: s.z, kind: 'objective' });
    if (s && s.type === 'enterVehicle' && this.vehicle) out.push({ x: this.vehicle.position.x, z: this.vehicle.position.z, kind: 'vehicle' });
    for (const e of this.enemies) if (e.alive) out.push({ x: e.position.x, z: e.position.z, kind: 'enemy' });
    return out;
  }

  get targetPoint() {
    const s = this.stepDef;
    if (s && s.type === 'goto') return { x: s.x, z: s.z };
    if (!this.active && !this.finishedAll) return this.current.start;
    return null;
  }
}
