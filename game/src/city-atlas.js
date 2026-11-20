// North-up street atlas. Destinations can be picked by mouse or from the keyboard-accessible legend.
import { BEACH, ISLAND, BRIDGE, nearestLine, isLand, onRoad } from './map.js';
import { SERVICES } from './side-jobs.js';

const WEST = ISLAND.minX - 22, NORTH = ISLAND.minZ - 20;
const SIZE_X = BEACH.x1 - WEST + 20, SIZE_Z = ISLAND.maxZ - NORTH + 36;

export function streetRoute(from, to) {
  if (!to) return [];
  if (from.x < ISLAND.minX && to.x < ISLAND.minX) return [to];
  const coast = { x: nearestLine(Math.min(from.x, ISLAND.maxX)), z: nearestLine(from.z) };
  const p = from.x < ISLAND.minX ? { x: nearestLine(ISLAND.minX), z: BRIDGE.z } : coast;
  const q = to.x < ISLAND.minX ? { x: nearestLine(ISLAND.minX), z: BRIDGE.z } : { x: nearestLine(to.x), z: nearestLine(to.z) };
  const start = from.x < ISLAND.minX ? [{ x: ISLAND.minX, z: BRIDGE.z }, p] :
    Math.abs(from.x-p.x) < Math.abs(from.z-p.z) ? [{ x: p.x, z: from.z }, p] : [{ x: from.x, z: p.z }, p];
  return [...start, { x: q.x, z: p.z }, q, to];
}

export class CityAtlas {
  constructor(game) {
    this.game = game;
    this.point = null;
    this.overlay = document.createElement('section');
    this.overlay.className = 'city-atlas';
    this.overlay.hidden = true;
    document.body.appendChild(this.overlay);
  }

  open() {
    const g = this.game;
    if (g.mode !== 'play') return;
    g.mode = 'atlas';
    document.exitPointerLock?.();
    this.overlay.hidden = false;
    this.overlay.innerHTML = `<div class="atlas-page"><header>Coralina Bay / Navigation</header><h2>City atlas</h2><canvas width="900" height="882" aria-label="North-up city map"></canvas></div><aside><h3>Set a waypoint</h3><p>Click a street or select a destination. The route is shown on your radar.</p><output aria-live="polite"></output></aside>`;
    this.canvas = this.overlay.querySelector('canvas');
    const sidebar = this.overlay.querySelector('aside');
    const button = (text, action) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', action);
      sidebar.append(b);
      return b;
    };
    for (const s of SERVICES) button(`${s.name} · ${s.detail}`, () => this.select(s,s.name));
    const mission = g.missions.targetPoint;
    if (mission) button('Track story job', () => this.select(mission,'Story job'));
    button('Clear waypoint', () => this.select(null));
    button('Back to the street', () => this.close()).focus();
    this.canvas.addEventListener('click', e => {
      const b = this.canvas.getBoundingClientRect();
      const x = WEST + (e.clientX-b.left)/b.width*SIZE_X;
      const z = NORTH + (e.clientY-b.top)/b.height*SIZE_Z;
      if (!isLand(x,z)) return;
      const nx = nearestLine(x), nz = nearestLine(z);
      const point = onRoad(x,z) ? {x,z} : Math.abs(nx-x) < Math.abs(nz-z) ? { x: nx, z } : { x, z: nz };
      this.select(point, 'Custom waypoint');
    });
    this.draw();
  }

  select(point,name='') { this.point = point; this.name = name; this.draw(); }
  close() { this.overlay.hidden = true; if (this.game.mode === 'atlas') this.game.resume(); }

  update() {
    if (!this.point) return;
    const { x,z } = this.game.player.position;
    if (Math.hypot(this.point.x-x,this.point.z-z) < 7) {
      this.point = null;
      this.game.hud.toast('Waypoint reached.');
    }
  }

  draw() {
    const g = this.game, c = this.canvas, d = c.getContext('2d');
    const { image, originX, originZ } = g.minimap;
    const sx = x => (x-WEST)*c.width/SIZE_X, sy = z => (z-NORTH)*c.height/SIZE_Z;
    d.drawImage(image,WEST-originX,NORTH-originZ,SIZE_X,SIZE_Z,0,0,c.width,c.height);
    for (const [text,x,z] of [['CORAL HEIGHTS',-130,-217],['OCEAN DRIVE',270,-255],['VENETIA CANAL',-140,43],['PALMETTO FLATS',30,208],['KINGFISH MARINA',132,363]]) {
      d.font = '700 15px Segoe UI, sans-serif';
      d.lineWidth = 4; d.strokeStyle = '#25262f'; d.fillStyle = '#f4e8d1';
      d.strokeText(text,sx(x),sy(z)); d.fillText(text,sx(x),sy(z));
    }
    const p = g.player.position;
    if (this.point) {
      d.beginPath(); d.moveTo(sx(p.x),sy(p.z));
      for (const q of streetRoute(p,this.point)) d.lineTo(sx(q.x),sy(q.z));
      d.strokeStyle = '#ff9fc6'; d.lineWidth = 5; d.lineJoin = 'round'; d.stroke();
    }
    const dot = (pos,color,r) => {
      d.beginPath(); d.arc(sx(pos.x),sy(pos.z),r,0,6.28318);
      d.fillStyle = color; d.fill(); d.strokeStyle = '#191b26'; d.lineWidth = 2.5; d.stroke();
    };
    for (const s of SERVICES) dot(s,s.color,7);
    dot(p,'#fff9e8',7);
    if (this.point) dot(this.point,'#ff9fc6',9);
    this.overlay.querySelector('output').textContent = this.point ? `Tracking: ${this.name}` : 'No custom waypoint';
  }
}
