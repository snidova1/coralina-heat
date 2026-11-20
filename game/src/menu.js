// Menus: the title screen over a slow aerial orbit of the bay (New Game, Continue, Settings,
// Controls), the pause menu (Resume, Save, Settings, Controls, Stats, Quit to Title) and the
// settings panel (volume, music, mouse sensitivity, invert, shadows, draw distance).
import { MISSIONS } from './story.js';

const CONTROLS = [
  ['W A S D', 'Move / drive'], ['Mouse', 'Look and aim'], ['Left click', 'Punch / fire'], ['Right click', 'Aim'],
  ['Shift', 'Sprint'], ['F', 'Steal / enter / exit car'], ['Space', 'Handbrake'], ['Hold Tab', 'Weapon wheel (mouse, wheel or 1–3)'], ['Q · 1–3', 'Quick switch'],
  ['R', 'Reload'], ['H', 'Horn'], ['E', 'Next radio station'], ['G', 'Siren (police car)'], ['M', 'City atlas'], ['B', 'Use nearby shop, garage or dispatch'], ['Esc', 'Pause'],
];

export class Menu {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.screen = null;
  }

  title() {
    const g = this.game;
    const canContinue = g.mode !== 'shot' && g.save.hasSave();
    this.screen = 'title';
    this.root.className = 'menu title';
    this.root.innerHTML = `
      <div class="title-art">
        <div class="logo"><span class="l1">CORALINA</span><span class="l2">HEAT</span></div>
        <div class="tagline">Coralina Bay · Every sunset has a price</div>
      </div>
      <nav class="menu-list">
        <button data-act="new" class="primary">New Game</button>
        <button data-act="continue" ${canContinue ? '' : 'disabled'}>Continue</button>
        <button data-act="settings">Settings</button>
        <button data-act="controls">Controls</button>
      </nav>
      <div class="menu-foot">${MISSIONS.length} story jobs · 5-star police · Bay Dispatch contracts<br><small>OCEAN DRIVE / KINGFISH MARINA</small></div>
      <div class="menu-panel"></div>`;
    this.bind();
  }

  pause() {
    const g = this.game;
    this.screen = 'pause';
    const s = g.stats;
    this.root.className = 'menu pause';
    this.root.innerHTML = `
      <div class="pause-head"><b>PAUSED</b><span>${g.districtName || 'Coralina Bay'} · ${formatHour(g.day.hour)}</span></div>
      <nav class="menu-list">
        <button data-act="resume" class="primary">Resume</button>
        <button data-act="save">Save Game</button>
        <button data-act="settings">Settings</button>
        <button data-act="controls">Controls</button>
        <button data-act="quit">Quit to Title</button>
      </nav>
      <div class="stats">
        <div><b>$${s.cash.toLocaleString('en-US')}</b><span>Cash</span></div>
        <div><b>${g.missions.index}/${MISSIONS.length}</b><span>Jobs done</span></div>
        <div><b>${s.kills}</b><span>Takedowns</span></div>
        <div><b>${(s.distance / 1000).toFixed(1)} km</b><span>Driven</span></div>
        <div><b>${s.carsStolen}</b><span>Cars stolen</span></div>
        <div><b>${s.busted}/${s.wasted}</b><span>Cuffed / Flatlined</span></div>
      </div>
      <div class="menu-panel"></div>`;
    this.bind();
  }

  hide() {
    this.screen = null;
    this.root.className = 'menu hidden';
    this.root.innerHTML = '';
  }

  bind() {
    for (const b of this.root.querySelectorAll('button[data-act]')) {
      b.addEventListener('click', () => this.act(b.dataset.act));
      b.addEventListener('mouseenter', () => this.game.audio && this.game.audio.ui());
    }
  }

  act(a) {
    const g = this.game;
    if (g.audio) { g.audio.init(); g.audio.ui(); }
    switch (a) {
      case 'new': g.startGame(false); break;
      case 'continue': g.startGame(true); break;
      case 'resume': g.resume(); break;
      case 'save': g.save.save(); this.pause(); break;
      case 'quit': g.toTitle(); break;
      case 'settings': this.settings(); break;
      case 'controls': this.controls(); break;
      default: break;
    }
  }

  panel(html) {
    const p = this.root.querySelector('.menu-panel');
    p.innerHTML = html;
    p.classList.add('on');
    // Both title and pause panels share the compact layout and scroll container.
    if (matchMedia('(max-width: 900px), (max-height: 600px)').matches) p.scrollIntoView({ block: 'nearest' });
    return p;
  }

  controls() {
    this.panel(`<h3>Controls</h3><table>${CONTROLS.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>`);
  }

  settings() {
    const g = this.game;
    const s = g.settings;
    const p = this.panel(`<h3>Settings</h3>
      <label>Master volume <input type="range" min="0" max="1" step="0.05" name="master" value="${s.master}"></label>
      <label>Music volume <input type="range" min="0" max="1" step="0.05" name="music" value="${s.music}"></label>
      <label>Mouse sensitivity <input type="range" min="0.3" max="2.5" step="0.1" name="sensitivity" value="${s.sensitivity}"></label>
      <label>Draw distance <input type="range" min="0.5" max="1.5" step="0.1" name="drawDistance" value="${s.drawDistance}"></label>
      <label class="check"><input type="checkbox" name="shadows" ${s.shadows ? 'checked' : ''}> Shadows</label>
      <label class="check"><input type="checkbox" name="invertY" ${s.invertY ? 'checked' : ''}> Invert mouse Y</label>`);
    for (const input of p.querySelectorAll('input')) {
      input.addEventListener('input', () => {
        s[input.name] = input.type === 'checkbox' ? input.checked : parseFloat(input.value);
        g.applySettings();
        g.save.saveSettings(s);
      });
    }
  }
}

export function formatHour(h) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
