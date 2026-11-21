// Hold Tab, aim at a slot with the mouse (or scroll), and release to equip it.
import { WEAPONS } from './player.js';
import { ICONS } from './hud.js';

export class WeaponWheel {
  constructor(game) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.className = 'weapon-wheel';
    this.root.hidden = true;
    document.body.append(this.root);
    this.open = false;
    this.x = this.y = 0;
  }

  cancel() {
    this.root.hidden = true;
    this.open = false;
  }

  update(input) {
    const p = this.game.player;
    if (p.vehicle || p.dead) { this.cancel(); return false; }
    if (!input.isDown('Tab')) {
      if (!this.open) return false;
      p.equip(this.ids[this.slot]);
      input.mouse.leftPressed = false;
      this.cancel();
      return true;
    }
    const entering = !this.open;
    if (entering) {
      this.ids = Object.keys(WEAPONS);
      this.slot = Math.max(0, this.ids.indexOf(p.current));
      this.open = true;
      this.root.hidden = false;
      this.x = this.y = 0;
    }
    this.x += input.mouse.dx;
    this.y += input.mouse.dy;
    let chosen = this.slot;
    const length = Math.hypot(this.x, this.y);
    if (length > 16) {
      this.x *= Math.min(1, 70 / length);
      this.y *= Math.min(1, 70 / length);
      const angle = Math.atan2(this.x, -this.y);
      chosen = (Math.round(angle * 3 / (2 * Math.PI)) + 3) % 3;
    }
    if (input.mouse.wheel) {
      chosen = (this.slot + Math.sign(input.mouse.wheel) + 3) % 3;
      this.x = this.y = 0;
    }
    if (!entering && chosen === this.slot) return true;
    this.slot = chosen;
    const item = this.ids[chosen];
    this.root.innerHTML = `<div class="wheel-core"><small>LOADOUT</small><b>${WEAPONS[item].name}</b><span>${p.weapons[item] ? 'RELEASE TAB' : 'NOT OWNED'}</span></div>` + this.ids.map((id,i) =>
      `<div class="wheel-slot ${i === chosen ? 'selected' : ''} ${p.weapons[id] ? '' : 'locked'}" style="--slot:${i * 120}deg">${ICONS[id]}<span>${p.weapons[id] && id !== 'fists' ? p.weapons[id].clip + ' / ' + p.weapons[id].ammo : WEAPONS[id].name}</span></div>`).join('');
    return true;
  }
}
