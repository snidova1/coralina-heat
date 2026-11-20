// Hold Tab to inspect the loadout. Pointer motion, wheel or 1–3 select; release equips.
import { WEAPONS } from './player.js';

const SLOTS = Object.keys(WEAPONS);
const TAU = Math.PI * 2;

export class WeaponWheel {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.root = document.createElement('div');
    this.root.className = 'weapon-wheel';
    this.root.hidden = true;
    this.root.innerHTML = `<div class="wheel-core"><b>LOADOUT</b><span></span></div>${SLOTS.map((id,i) => `<div class="wheel-slot" data-weapon="${id}" style="--i:${i}"><b>${i+1} · ${WEAPONS[id].name}</b><span></span></div>`).join('')}`;
    document.body.append(this.root);
    this.slots = [...this.root.querySelectorAll('.wheel-slot')];
  }

  close(commit = false) {
    const p = this.game.player;
    if (commit && this.active && p.weapons[this.selected] && p.current !== this.selected) {
      p.current = this.selected;
      p.reloadT = 0;
      this.game.audio.click();
    }
    this.root.hidden = true;
    this.active = false;
  }

  update() {
    const { player:p, input, mode } = this.game;
    if (mode !== 'play' || p.dead || p.vehicle || !input.locked) { this.close(); return; }
    if (!input.isDown('Tab')) { if (this.active) this.close(true); return; }
    if (!this.active) {
      this.active = true;
      this.root.hidden = false;
      this.selected = p.current;
      this.x = this.y = 0;
    }
    const m = input.mouse;
    this.x += m.dx; this.y += m.dy;
    const dist = Math.hypot(this.x, this.y);
    if (dist > 95) { this.x *= 95/dist; this.y *= 95/dist; }
    let id;
    if (dist > 12 && (m.dx || m.dy)) {
      const a = (Math.atan2(this.x,-this.y)+TAU)%TAU;
      id = SLOTS[Math.round(a/TAU*SLOTS.length)%SLOTS.length];
    }
    if (m.wheel) {
      const live = SLOTS.filter(w => p.weapons[w]);
      id = live[(live.indexOf(this.selected)+Math.sign(m.wheel)+live.length)%live.length];
    }
    SLOTS.forEach((w,i) => { if (input.wasPressed(`Digit${i+1}`)) id = w; });
    if (p.weapons[id]) this.selected = id;
    this.root.querySelector('.wheel-core span').textContent = 'Release Tab to equip';
    for (const slot of this.slots) {
      const w = slot.dataset.weapon, ammo = p.weapons[w];
      slot.classList.toggle('selected', w === this.selected);
      slot.classList.toggle('locked', !ammo);
      slot.lastElementChild.textContent = !ammo ? 'NOT OWNED' : w === 'fists' ? 'UNARMED' : `${ammo.clip} / ${ammo.ammo}`;
    }
  }
}
