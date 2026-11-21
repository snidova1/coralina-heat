// Rafa's burner: story status and one-touch directions to the next job or any city service.
import { CAST } from './story.js';

export class BurnerPhone {
  constructor(game) { this.game = game; }

  open(panel) {
    const g = this.game;
    const job = g.missions.current;
    const target = g.services.target || g.missions.targetPoint;
    const routes = [
      ...(target ? [{ ...target, icon: '◆', name: g.services.target ? 'Baywave Dispatch' : CAST[job.giver].full, action: g.services.target ? 'Current delivery' : job.title }] : []),
      ...g.services.sites,
    ];
    panel.classList.add('phone-panel');
    panel.innerHTML = `<div class="burner-phone"><header><small>CORALINA MOBILE</small><b>Contacts</b><span>${g.wanted.level ? 'Dispatch monitoring active' : 'Bay network · connected'}</span></header><section></section></div>`;
    const log = panel.querySelector('section');
    for (const site of routes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<i>${site.icon}</i><span><b>${site.name}</b><small>${site.action}</small></span><em>›</em>`;
      button.addEventListener('click', () => {
        g.chart.waypoint = { x: site.x, z: site.z };
        g.audio.click();
        g.resume();
        g.hud.toast(`Route set: ${site.name}`);
      });
      log.append(button);
    }
  }
}
