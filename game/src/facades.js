// A bay-sized material library: regular structural bays, recessed panes, interior light and sky reflection.
import * as THREE from 'three';
import { makeStream } from './rng.js';

const atlases = new Map();

export function facadeAtlas(style) {
  if (atlases.has(style)) return atlases.get(style);
  const tower = style === 'glass';
  const masonry = style === 'office';
  const motel = style === 'motel';
  const size = 512, cell = 128;
  const rnd = makeStream(449 + [...style].reduce((sum, ch) => sum + ch.charCodeAt(0), 0));
  const channel = (color, background) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return { ctx, tex };
  };
  const day = channel(true, tower ? '#4d6471' : masonry ? '#b4a998' : '#d8c8b4');
  const relief = channel(false, '#acacac');
  const gloss = channel(false, '#eeeeee');
  const light = channel(true, '#000');
  const d = day.ctx, b = relief.ctx, g = gloss.ctx, l = light.ctx;
  const fill = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  for (let i = 0; i < 8400; i++) {
    const x = rnd() * size, y = rnd() * size;
    fill(d, i % 2 ? '#fff1cf16' : '#2f25211a', x, y, 1 + rnd() * 3, 1 + rnd() * 2);
    fill(b, i % 2 ? '#c5c5c559' : '#8e8e8e59', x, y, 2, 2);
  }
  for (let row = 0; row < 4; row++) {
    const y = row * cell;
    fill(d, tower ? '#223640' : '#827a6e', 0, y, size, tower ? 8 : 4);
    fill(d, tower ? '#81969c' : '#e3d5bf', 0, y + 8, size, 4);
    fill(b, '#efefef', 0, y + 7, size, 4);
    for (let col = 0; col < 4; col++) {
      const x = col * cell;
      const inset = tower ? 4 : masonry ? 13 : 24;
      const top = y + (tower ? 14 : 24);
      const height = tower ? 98 : masonry ? 76 : 69;
      const left = x + inset, width = cell - inset * 2;
      fill(d, '#222f35', left - 3, top - 3, width + 6, height + 6);
      fill(b, '#202020', left - 1, top - 1, width + 2, height + 2);
      fill(g, '#333333', left, top, width, height);
      const glass = d.createLinearGradient(left, top, left + width * 0.22, top + height);
      glass.addColorStop(0, tower ? '#6b8999' : '#587b8a');
      glass.addColorStop(0.33, tower ? '#405f72' : '#3f6170');
      glass.addColorStop(0.57, '#526675');
      glass.addColorStop(0.71, '#324653');
      glass.addColorStop(1, '#203440');
      fill(d, glass, left, top, width, height);
      if (rnd() < 0.42) {
        const blind = 12 + rnd() * 36;
        fill(d, '#ded0aa40', left + 2, top + 1, width - 4, blind);
        for (let j = 3; j < blind; j += 4) fill(d, '#14293c48', left + 2, top + j, width - 4, 1);
      }
      if (rnd() < (tower ? 0.24 : 0.34)) {
        const lamp = l.createRadialGradient(left + width * 0.6, top + 12, 2, left + width * 0.55, top + 22, height * 0.8);
        lamp.addColorStop(0, '#d7a471');
        lamp.addColorStop(0.45, '#98674e');
        lamp.addColorStop(1, '#332417');
        fill(l, lamp, left + 2, top + 4, width - 4, height - 8);
        fill(l, '#140d08', left + width * 0.2, top + height * 0.78, width * 0.6, height * 0.16);
      }
      for (const c of [d, l]) fill(c, c === d ? '#24343b' : '#100b09', x + cell / 2 - 2, top, 4, height);
      fill(g, '#cccccc', x + cell / 2 - 2, top, 4, height);
      fill(d, '#b8bdab', left - 4, top + height + 2, width + 8, 3);
      fill(b, '#eeeeee', left - 4, top + height + 1, width + 8, 5);
      if (motel) {
        fill(d, '#4c3e39', x + 3, y + 47, 16, 75);
        fill(d, '#c7ad83', x + 13, y + 87, 3, 3);
      }
    }
  }
  const result = { map: day.tex, bump: relief.tex, rough: gloss.tex, lit: light.tex };
  atlases.set(style, result);
  return result;
}

export function facadeWall(bucket, x, z, width, depth, bottom, top, style) {
  const glass = style === 'glass';
  const bays = style.startsWith('shop') ? 3 : 4;
  const span = glass ? 3.2 : style === 'motel' ? 4.0 : 3.65;
  const rise = style.startsWith('shop') ? top - bottom : glass ? 3.45 : 3.55;
  const floors = Math.max(1, Math.round((top - bottom) / rise));
  const xa = x - width / 2, xb = x + width / 2;
  const za = z - depth / 2, zb = z + depth / 2;
  const faces = [[xb, zb, xb, za, depth], [xb, za, xa, za, width], [xa, za, xa, zb, depth], [xa, zb, xb, zb, width]];
  const period = style.startsWith('shop') ? 1 : 4;
  faces.forEach(([x0, z0, x1, z1, length], side) => {
    const u = ((Math.floor(x + z) + side) & 3) / bays;
    const v = period === 1 ? 0 : ((Math.floor(z) + side) & 3) / period;
    bucket.wall(x0, z0, x1, z1, bottom, top, u, u + Math.max(1, Math.round(length / (period === 1 ? 5.4 : span))) / bays, v, v + floors / period);
  });
}
