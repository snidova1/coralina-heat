// The radar: a round minimap that turns with the camera, drawn from a pre-rendered map of the
// island (water, beach, blocks, streets, the canal and the bridge) with blips for police, gang
// members, mission contacts and objectives, pickups, and a north marker.
import { LINES, ROAD_HALF, ISLAND, BEACH, CANAL, BRIDGE, BOULEVARD_X, PLACES } from './map.js';
import { streetRoute } from './city-atlas.js';
import { SERVICES } from './side-jobs.js';

const X0 = -1060;
const Z0 = -470;
const W = 1600;
const H = 1000;

function buildMapImage(city) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const d = c.getContext('2d');
  const X = (x) => x - X0;
  const Z = (z) => z - Z0;
  d.fillStyle = '#17384a';
  d.fillRect(0, 0, W, H);
  d.fillStyle = '#4b4b53';
  d.fillRect(X(ISLAND.minX), Z(ISLAND.minZ), BEACH.x0 - ISLAND.minX, ISLAND.maxZ - ISLAND.minZ);
  d.fillStyle = '#967f68';
  d.fillRect(X(BEACH.x0), Z(ISLAND.minZ), BEACH.x1 - BEACH.x0 - 8, ISLAND.maxZ - ISLAND.minZ);
  // the canal
  d.fillStyle = '#17384a';
  d.fillRect(X(ISLAND.minX - 5), Z(CANAL.zMin), BEACH.x1 + 20 - ISLAND.minX, CANAL.zMax - CANAL.zMin);
  // buildings
  d.fillStyle = '#353e49';
  for (const b of city.colliders) {
    if (b.tag !== 'building') continue;
    d.fillRect(X(b.x0), Z(b.z0), b.x1 - b.x0, b.z1 - b.z0);
  }
  // park
  const pk = PLACES.park;
  d.fillStyle = '#4f7f45';
  d.fillRect(X(LINES[pk.block[0]] + 11), Z(LINES[pk.block[1]] + 11), 58, 58);
  // streets
  d.fillStyle = '#aaa7a2';
  const lo = LINES[0] - ROAD_HALF;
  const len = LINES[LINES.length - 1] - LINES[0] + ROAD_HALF * 2;
  for (const L of LINES) {
    d.fillRect(X(L - ROAD_HALF), Z(lo), ROAD_HALF * 2, len);
    d.fillRect(X(lo), Z(L - ROAD_HALF), len, ROAD_HALF * 2);
  }
  d.fillRect(X(BRIDGE.x0), Z(BRIDGE.z - BRIDGE.half), BRIDGE.x1 - BRIDGE.x0, BRIDGE.half * 2);
  d.fillStyle = '#e8c86a';
  d.fillRect(X(BOULEVARD_X - 2), Z(lo), 4, len);
  // marina piers
  d.fillStyle = '#9b7b55';
  for (let x = 60; x <= 320; x += 52) d.fillRect(X(x - 1.5), Z(ISLAND.maxZ), 3, 76);
  d.fillRect(X(40), Z(ISLAND.maxZ), 290, 6);
  return c;
}

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = buildMapImage(game.city);
    this.originX = X0;
    this.originZ = Z0;
    this.zoom = 0.9;
  }

  update() {
    const g = this.game;
    const ctx = this.ctx;
    const S = this.canvas.width;
    const R = S / 2 - 6;
    const cx = S / 2;
    const cy = S / 2;
    const p = g.player;
    const yaw = g.cameraRig.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = -fz;
    const rz = fx;
    const targetZoom = p.vehicle ? 0.42 + Math.max(0, 0.25 - Math.abs(p.vehicle.speed) / 120) : 0.85;
    this.zoom += (targetZoom - this.zoom) * 0.05;
    const s = this.zoom;
    const px = p.position.x;
    const pz = p.position.z;
    const toScreen = (x, z) => {
      const ox = x - px;
      const oz = z - pz;
      return [cx + (rx * ox + rz * oz) * s, cy + (-fx * ox - fz * oz) * s];
    };
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.setTransform(rx * s, -fx * s, rz * s, -fz * s, cx + (rx * (X0 - px) + rz * (Z0 - pz)) * s, cy + (-fx * (X0 - px) - fz * (Z0 - pz)) * s);
    ctx.drawImage(this.image, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // wanted: the radar flashes red and blue
    if (g.wanted.level > 0) {
      ctx.fillStyle = Math.floor(g.time * 4) % 2 ? 'rgba(255,40,60,0.16)' : 'rgba(40,90,255,0.16)';
      ctx.fillRect(0, 0, S, S);
      if (g.wanted.searching) {
        const [x,z] = toScreen(g.wanted.lastKnown.x, g.wanted.lastKnown.z);
        ctx.beginPath(); ctx.arc(x,z,(45+g.wanted.level*12)*s,0,Math.PI*2);
        ctx.fillStyle = 'rgba(255,120,93,.19)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,184,147,.8)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    // GPS line toward the target
    const custom = g.atlas?.point;
    const target = g.sideJobs?.target || custom || g.missions?.targetPoint;
    const blips = [];
    if (g.missions) blips.push(...g.missions.blips());
    if (g.police) {
      for (const v of g.police.cars) blips.push({ x: v.position.x, z: v.position.z, kind: 'police' });
      for (const a of g.police.officers) if (a.alive) blips.push({ x: a.position.x, z: a.position.z, kind: 'police', small: true });
      if (g.police.heli) blips.push({ x: g.police.heli.pos.x, z: g.police.heli.pos.z, kind: 'heli' });
    }
    if (g.pickups) for (const k of g.pickups.list) if (!k.taken) blips.push({ x: k.x, z: k.z, kind: k.kind, small: true });
    blips.push({ x: PLACES.safehouse.x, z: PLACES.safehouse.z, kind: 'home' });
    if (g.sideJobs) for (const s of SERVICES) if (s.id !== 'garage') blips.push({ ...s, kind: 'service' });
    if (g.sideJobs?.target) blips.push({ ...g.sideJobs.target, kind: 'objective' });
    else if (custom) blips.push({ ...custom, kind: 'pin' });
    ctx.restore();
    if (target) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = custom === target ? '#ffabd0' : '#ffcf77';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const points = p.vehicle || custom === target ? streetRoute(p.position,target) : [target];
      for (const t of points) ctx.lineTo(...toScreen(t.x,t.z));
      ctx.stroke();
      ctx.restore();
    }
    for (const b of blips) {
      let [bx, by] = toScreen(b.x, b.z);
      const dx = bx - cx;
      const dy = by - cy;
      const d = Math.hypot(dx, dy);
      const edge = b.kind === 'objective' || b.kind === 'contact' || b.kind === 'home' || b.kind === 'vehicle' || b.kind === 'pin';
      if (d > R - 8) {
        if (!edge) continue;
        bx = cx + (dx / d) * (R - 8);
        by = cy + (dy / d) * (R - 8);
      }
      this.drawBlip(ctx, bx, by, b);
    }
    // the player arrow
    const hx = Math.sin(p.heading);
    const hz = Math.cos(p.heading);
    const ang = Math.atan2(rx * hx + rz * hz, fx * hx + fz * hz);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(9, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.fillStyle = '#ffb02e';
    ctx.strokeStyle = '#2a1400';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#fff3c0';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(2.5, 2);
    ctx.lineTo(0, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // rim and north
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(8,10,18,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = g.wanted.level > 0 ? (Math.floor(g.time * 4) % 2 ? '#ff3b5c' : '#3b7bff') : '#ff9d5c';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
    ctx.stroke();
    const nAng = Math.atan2(rx * 0 + rz * -1, fx * 0 + fz * -1);
    const nx = cx + Math.sin(nAng) * R;
    const ny = cy - Math.cos(nAng) * R;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(nx, ny, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + 1);
  }

  drawBlip(ctx, x, y, b) {
    const t = this.game.time;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    switch (b.kind) {
      case 'pin':
      case 'service':
        ctx.fillStyle = b.color || '#ffabd0';
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(6,0); ctx.lineTo(0,7); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'police': {
        const r = b.small ? 4 : 6;
        ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ff3050' : '#3070ff';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'heli':
        ctx.fillStyle = '#3070ff';
        ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14);
        break;
      case 'enemy':
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'objective':
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'vehicle':
        ctx.fillStyle = '#4fc3ff';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 'contact':
      case 'home': {
        ctx.fillStyle = b.kind === 'home' ? '#ff7ab8' : '#ffd23f';
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.font = 'bold 11px "Arial Black", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.kind === 'home' ? 'H' : b.label || '!', 0, 1);
        break;
      }
      case 'cash':
        ctx.fillStyle = '#5fe07a';
        ctx.font = 'bold 13px "Arial Black", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeText('$', 0, 0); ctx.fillText('$', 0, 0);
        break;
      default:
        ctx.fillStyle = b.kind === 'health' ? '#ff5f6d' : b.kind === 'armor' ? '#5fb0ff' : '#e0e0e0';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}
