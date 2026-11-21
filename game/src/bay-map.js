// District chart and custom waypoints use the same map projection as the radar.
import * as THREE from 'three';
import { MAP_BOUNDS } from './minimap.js';
import { LINES, BEACH, BRIDGE, nearestLine, isLand } from './map.js';

export function streetRoute(from, to) {
  const join = p => {
    const x = nearestLine(p.x), z = nearestLine(p.z);
    return Math.abs(p.x - x) < Math.abs(p.z - z) ? [{x,z:p.z},{x,z}] : [{x:p.x,z},{x,z}];
  };
  const enter = p => p.x < LINES[0] - 20 ? [{x: Math.max(BRIDGE.x0,p.x),z:BRIDGE.z},{x:LINES[0],z:BRIDGE.z}] : join(p);
  const a = enter(from), b = enter(to);
  const start = a[1], end = b[1];
  return [from,...a,{x:end.x,z:start.z},...b.reverse(),to];
}

export class BayMap {
  constructor(game) { this.game = game; this.waypoint = null; this.markerPosition = new THREE.Vector3(); }

  route(from, to) { return streetRoute(from, to); }

  show(container) {
    const { x: offsetX, z: offsetZ, w, h } = MAP_BOUNDS;
    const g = this.game;
    const sites = [...g.services.sites, { ...g.missions.targetPoint, name:'Story objective', icon:'◆' }].filter(site => Number.isFinite(site.x));
    container.innerHTML = '<h3>Coralina Bay / chart</h3><canvas class="bay-chart" width="800" height="500" aria-label="Click the chart to set a waypoint"></canvas><p>Click land to set a waypoint. <button type="button">Clear waypoint</button></p>';
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const project = p => [(p.x - offsetX) * canvas.width/w,(p.z - offsetZ) * canvas.height/h];
    const draw = () => {
      ctx.drawImage(g.minimap.image,0,0,canvas.width,canvas.height);
      const point = g.player.position;
      if (this.waypoint) {
        ctx.strokeStyle = '#efadff';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        streetRoute(point,this.waypoint).forEach((p,i) => i ? ctx.lineTo(...project(p)) : ctx.moveTo(...project(p)));
        ctx.stroke();
      }
      for (const [site, color] of [...sites.map(s => [s,'#ffe3a0']),[{...point,icon:'▲'},'#a2fff4'],...(this.waypoint ? [[{...this.waypoint,icon:'◇'},'#efadff']] : [])]) {
        const [x,y] = project(site);
        ctx.font = 'bold 16px Segoe UI';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#101922';
        ctx.fillStyle = color;
        ctx.strokeText(site.icon,x,y);
        ctx.fillText(site.icon,x,y);
      }
    };
    canvas.addEventListener('click', e => {
      const r = canvas.getBoundingClientRect();
      const x = offsetX + (e.clientX-r.left)*w/r.width;
      const z = offsetZ + (e.clientY-r.top)*h/r.height;
      if (!isLand(x,z) || x > BEACH.x1 - 10) return;
      this.waypoint = {x,z};
      draw();
    });
    container.querySelector('button').addEventListener('click', () => { this.waypoint = null; draw(); });
    draw();
  }
}
