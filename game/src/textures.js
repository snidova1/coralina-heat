// Procedural textures drawn on canvases at load time: building facades (with lit-window maps for
// the evening), asphalt, pavement, sand, the ocean's ripple normals, glows and neon signs.
// No image files: every pixel of Coralina Bay is painted here.
import * as THREE from 'three';
import { makeStream } from './rng.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c, { repeat = true, color = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function noise(ctx, w, h, amount, rnd, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** A facade style: `map` is the daylight look, `lit` the windows that glow after sunset. */
export function facadeTextures(style) {
  if (cache.has('facade-' + style)) return cache.get('facade-' + style);
  const S = 512;
  const day = canvas(S, S);
  const lit = canvas(S, S);
  const d = day.getContext('2d');
  const l = lit.getContext('2d');
  const rnd = makeStream([...style].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) >>> 0);
  l.fillStyle = '#000';
  l.fillRect(0, 0, S, S);
  const cols = 4;
  const rows = 4;
  const cw = S / cols;
  const rh = S / rows;
  const warm = ['#ffd59a', '#ffe7b8', '#ffc27a', '#fff1d0', '#9fd8ff'];
  if (style === 'glass') {
    const g = d.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#3d6f86');
    g.addColorStop(0.5, '#6aa6bd');
    g.addColorStop(1, '#2f5a73');
    d.fillStyle = g;
    d.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shade = 0.75 + rnd() * 0.5;
        d.fillStyle = `rgba(${Math.floor(120 * shade)},${Math.floor(190 * shade)},${Math.floor(215 * shade)},0.55)`;
        d.fillRect(c * cw + 3, r * rh + 4, cw - 6, rh - 8);
        if (rnd() < 0.35) {
          l.fillStyle = warm[Math.floor(rnd() * warm.length)];
          l.fillRect(c * cw + 3, r * rh + 4, cw - 6, rh - 8);
        }
      }
    }
    d.fillStyle = '#1b2a33';
    for (let r = 0; r <= rows; r++) d.fillRect(0, r * rh - 4, S, 8);
    for (let c = 0; c <= cols; c++) d.fillRect(c * cw - 2, 0, 4, S);
  } else if (style === 'office') {
    d.fillStyle = '#d9d2c4';
    d.fillRect(0, 0, S, S);
    noise(d, S, S, 4000, rnd);
    for (let r = 0; r < rows; r++) {
      d.fillStyle = '#2c4656';
      d.fillRect(0, r * rh + rh * 0.3, S, rh * 0.5);
      d.fillStyle = 'rgba(160,210,230,0.35)';
      d.fillRect(0, r * rh + rh * 0.3, S, rh * 0.12);
      for (let c = 0; c < cols * 2; c++) {
        d.fillStyle = '#18242c';
        d.fillRect(c * (S / 8), r * rh + rh * 0.3, 3, rh * 0.5);
        if (rnd() < 0.4) {
          l.fillStyle = warm[Math.floor(rnd() * warm.length)];
          l.fillRect(c * (S / 8) + 3, r * rh + rh * 0.3, S / 8 - 3, rh * 0.5);
        }
      }
    }
  } else if (style === 'stucco' || style === 'motel') {
    d.fillStyle = '#f4efe6';
    d.fillRect(0, 0, S, S);
    noise(d, S, S, 6000, rnd, 0.06);
    for (let r = 0; r < rows; r++) {
      d.fillStyle = 'rgba(0,0,0,0.08)';
      d.fillRect(0, r * rh + rh - 10, S, 6);
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = r * rh;
        if (style === 'motel') {
          // a door and a window per room, a walkway rail along each floor
          d.fillStyle = '#3a5f73';
          d.fillRect(x + 14, y + rh * 0.3, cw * 0.28, rh * 0.62);
          d.fillStyle = '#ffffff';
          d.fillRect(x + 14 + cw * 0.11, y + rh * 0.55, 8, 8);
          d.fillStyle = '#1d3340';
          d.fillRect(x + cw * 0.5, y + rh * 0.35, cw * 0.4, rh * 0.32);
          d.fillStyle = 'rgba(255,255,255,0.9)';
          d.fillRect(x + cw * 0.5 - 3, y + rh * 0.35 - 3, cw * 0.4 + 6, 4);
          d.fillStyle = '#e8f6ff';
          d.fillRect(x + cw * 0.52, y + rh * 0.37, cw * 0.14, rh * 0.1);
          if (rnd() < 0.55) {
            l.fillStyle = warm[Math.floor(rnd() * 4)];
            l.fillRect(x + cw * 0.5, y + rh * 0.35, cw * 0.4, rh * 0.32);
          }
        } else {
          d.fillStyle = '#ffffff';
          d.fillRect(x + cw * 0.22 - 5, y + rh * 0.25 - 5, cw * 0.56 + 10, rh * 0.5 + 10);
          const g = d.createLinearGradient(0, y + rh * 0.25, 0, y + rh * 0.75);
          g.addColorStop(0, '#5e8fa8');
          g.addColorStop(1, '#22394a');
          d.fillStyle = g;
          d.fillRect(x + cw * 0.22, y + rh * 0.25, cw * 0.56, rh * 0.5);
          d.fillStyle = '#ffffff';
          d.fillRect(x + cw * 0.5 - 2, y + rh * 0.25, 4, rh * 0.5);
          if (rnd() < 0.5) {
            // striped awning or shutters for that Bay look
            d.fillStyle = rnd() < 0.5 ? '#2fa7a0' : '#e36d5b';
            d.fillRect(x + cw * 0.18, y + rh * 0.18, cw * 0.64, 10);
          }
          if (rnd() < 0.45) {
            l.fillStyle = warm[Math.floor(rnd() * 4)];
            l.fillRect(x + cw * 0.22, y + rh * 0.25, cw * 0.56, rh * 0.5);
          }
        }
      }
    }
  } else if (style.startsWith('shop')) {
    // three storefronts per tile: sign band, striped awning, lit shop window and a door
    const names = ['CAFÉ SOL', 'BODEGA', 'SURF SHOP', 'PIZZA', 'TATTOO', 'LAUNDRY', 'CUBANITO', 'PAWN', 'NAILS', 'LIQUOR', 'TACOS', 'GYM'];
    const awnings = [['#e63946', '#fff'], ['#2a9d8f', '#fff'], ['#ffb703', '#fff'], ['#3a86ff', '#fff'], ['#ff5fa2', '#fff'], ['#222', '#ffd23f']];
    d.fillStyle = '#e8e0d2';
    d.fillRect(0, 0, S, S);
    const sw = S / 3;
    for (let k = 0; k < 3; k++) {
      const x = k * sw;
      const [a1, a2] = awnings[Math.floor(rnd() * awnings.length)];
      d.fillStyle = '#1d2230';
      d.fillRect(x + 6, 20, sw - 12, 70);
      d.font = 'bold 44px "Arial Black", Impact, sans-serif';
      d.textAlign = 'center';
      d.textBaseline = 'middle';
      const name = names[Math.floor(rnd() * names.length)];
      const signCol = ['#ffd23f', '#7ff6ff', '#ff7ab8', '#ffffff'][Math.floor(rnd() * 4)];
      d.fillStyle = signCol;
      d.fillText(name, x + sw / 2, 56, sw - 30);
      l.fillStyle = signCol;
      l.font = d.font;
      l.textAlign = 'center';
      l.textBaseline = 'middle';
      l.fillText(name, x + sw / 2, 56, sw - 30);
      for (let s = 0; s < 8; s++) {
        d.fillStyle = s % 2 ? a1 : a2;
        d.fillRect(x + 6 + (s * (sw - 12)) / 8, 96, (sw - 12) / 8 + 1, 60);
      }
      d.fillStyle = 'rgba(0,0,0,0.25)';
      d.fillRect(x + 6, 150, sw - 12, 8);
      const g = d.createLinearGradient(0, 165, 0, S);
      g.addColorStop(0, '#4c6f86');
      g.addColorStop(1, '#1b2b38');
      d.fillStyle = g;
      d.fillRect(x + 12, 170, sw * 0.58, S - 200);
      d.fillStyle = '#ffe2a8';
      d.globalAlpha = 0.35;
      d.fillRect(x + 18, 250, sw * 0.5, S - 290);
      d.globalAlpha = 1;
      l.fillStyle = '#ffd59a';
      l.fillRect(x + 12, 170, sw * 0.58, S - 200);
      d.fillStyle = '#2b2b2b';
      d.fillRect(x + sw * 0.66, 190, sw * 0.26, S - 190);
      d.fillStyle = '#a8c8d8';
      d.fillRect(x + sw * 0.69, 210, sw * 0.2, 120);
      d.fillStyle = '#9a9184';
      d.fillRect(x, S - 30, sw, 30);
    }
  } else if (style === 'warehouse') {
    d.fillStyle = '#b8b3a8';
    d.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 8) {
      d.fillStyle = x % 16 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
      d.fillRect(x, 0, 4, S);
    }
    noise(d, S, S, 5000, rnd, 0.1);
    d.fillStyle = 'rgba(120,60,30,0.25)';
    for (let i = 0; i < 30; i++) d.fillRect(rnd() * S, rnd() * S, 3, 20 + rnd() * 60);
  }
  const result = { map: finish(day), lit: finish(lit) };
  cache.set('facade-' + style, result);
  return result;
}

export function surfaceTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const S = 256;
  const c = canvas(S, S);
  const d = c.getContext('2d');
  const rnd = makeStream(kind.length * 31 + 5);
  if (kind === 'asphalt') {
    d.fillStyle = '#3b3d42';
    d.fillRect(0, 0, S, S);
    noise(d, S, S, 9000, rnd, 0.12);
    d.strokeStyle = 'rgba(20,20,22,0.5)';
    for (let i = 0; i < 6; i++) {
      d.beginPath();
      let x = rnd() * S;
      let y = rnd() * S;
      d.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; d.lineTo(x, y); }
      d.stroke();
    }
  } else if (kind === 'pavement') {
    d.fillStyle = '#c9c0b0';
    d.fillRect(0, 0, S, S);
    noise(d, S, S, 6000, rnd, 0.08);
    d.fillStyle = 'rgba(80,70,60,0.25)';
    for (let i = 0; i <= 4; i++) { d.fillRect(i * 64 - 1, 0, 2, S); d.fillRect(0, i * 64 - 1, S, 2); }
  } else if (kind === 'sand') {
    d.fillStyle = '#e9d3a5';
    d.fillRect(0, 0, S, S);
    noise(d, S, S, 12000, rnd, 0.1);
  } else if (kind === 'grass') {
    d.fillStyle = '#6f9a45';
    d.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      d.fillStyle = `rgba(${40 + rnd() * 60},${90 + rnd() * 70},${30 + rnd() * 30},0.35)`;
      d.fillRect(rnd() * S, rnd() * S, 1, 3);
    }
  } else if (kind === 'wood') {
    d.fillStyle = '#8a6646';
    d.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) {
      d.fillStyle = 'rgba(40,25,10,0.5)';
      d.fillRect(0, y, S, 2);
    }
    noise(d, S, S, 5000, rnd, 0.1);
  } else if (kind === 'stone') {
    d.fillStyle = '#a99c88';
    d.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) {
      for (let x = (y / 32) % 2 ? 0 : 32; x < S; x += 64) {
        d.strokeStyle = 'rgba(60,50,40,0.45)';
        d.strokeRect(x, y, 64, 32);
      }
    }
    noise(d, S, S, 6000, rnd, 0.1);
  }
  const t = finish(c);
  cache.set(kind, t);
  return t;
}

/** Tileable ripple normals for the ocean and the canal, summed from whole-period sine waves. */
export function waterNormals() {
  if (cache.has('water')) return cache.get('water');
  const S = 256;
  const c = canvas(S, S);
  const d = c.getContext('2d');
  const img = d.createImageData(S, S);
  const waves = [];
  const rnd = makeStream(99);
  for (let i = 0; i < 14; i++) {
    waves.push({ kx: Math.floor(rnd() * 9) - 4, ky: Math.floor(rnd() * 9) - 4 || 1, a: 0.4 + rnd(), p: rnd() * 6.28 });
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const ph = ((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p;
        const cph = Math.cos(ph) * w.a;
        dx += cph * w.kx;
        dy += cph * w.ky;
      }
      const n = new THREE.Vector3(-dx * 0.05, -dy * 0.05, 1).normalize();
      const o = (y * S + x) * 4;
      img.data[o] = (n.x * 0.5 + 0.5) * 255;
      img.data[o + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[o + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  d.putImageData(img, 0, 0);
  const t = finish(c, { color: false });
  cache.set('water', t);
  return t;
}

/** A soft round glow for headlights, siren flashes, muzzle flashes and particles. */
export function glowTexture(kind = 'soft') {
  if (cache.has('glow-' + kind)) return cache.get('glow-' + kind);
  const S = 128;
  const c = canvas(S, S);
  const d = c.getContext('2d');
  if (kind === 'star') {
    d.translate(S / 2, S / 2);
    for (let i = 0; i < 6; i++) {
      d.rotate(Math.PI / 3);
      const g = d.createLinearGradient(0, 0, S / 2, 0);
      g.addColorStop(0, 'rgba(255,255,230,1)');
      g.addColorStop(1, 'rgba(255,180,60,0)');
      d.fillStyle = g;
      d.beginPath();
      d.moveTo(0, -6);
      d.lineTo(S / 2, 0);
      d.lineTo(0, 6);
      d.fill();
    }
    d.setTransform(1, 0, 0, 1, 0, 0);
  }
  const g = d.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  if (kind === 'smoke') {
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  d.fillStyle = g;
  d.fillRect(0, 0, S, S);
  const t = finish(c, { repeat: false });
  cache.set('glow-' + kind, t);
  return t;
}

/** A glowing neon sign: tube-lit text with a halo, drawn on a dark backing board. */
export function neonSignTexture(text, color, sub = '', subColor = '#ff5fa2') {
  const key = 'neon-' + text + color + sub;
  if (cache.has(key)) return cache.get(key);
  const W = 512;
  const H = sub ? 256 : 160;
  const c = canvas(W, H);
  const d = c.getContext('2d');
  d.fillStyle = '#0f1420';
  d.fillRect(0, 0, W, H);
  d.strokeStyle = color;
  d.lineWidth = 4;
  d.shadowColor = color;
  d.shadowBlur = 18;
  d.strokeRect(10, 10, W - 20, H - 20);
  d.textAlign = 'center';
  d.textBaseline = 'middle';
  d.font = 'italic 900 78px "Arial Black", Impact, sans-serif';
  for (let i = 0; i < 3; i++) {
    d.fillStyle = color;
    d.fillText(text, W / 2, sub ? 90 : H / 2, W - 50);
  }
  d.shadowBlur = 4;
  d.fillStyle = '#ffffff';
  d.globalAlpha = 0.65;
  d.fillText(text, W / 2, sub ? 90 : H / 2, W - 50);
  d.globalAlpha = 1;
  if (sub) {
    d.font = 'bold 50px "Trebuchet MS", sans-serif';
    d.shadowColor = subColor;
    d.shadowBlur = 16;
    d.fillStyle = subColor;
    d.fillText(sub, W / 2, 185, W - 60);
  }
  const t = finish(c, { repeat: false });
  cache.set(key, t);
  return t;
}

/** A painted billboard or door decal: flat colours and bold type. */
export function decalTexture(text, bg, fg, w = 512, h = 128, font = 'italic 900 64px "Arial Black", Impact, sans-serif') {
  const key = 'decal-' + text + bg + fg + w + h;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h);
  const d = c.getContext('2d');
  if (bg) {
    d.fillStyle = bg;
    d.fillRect(0, 0, w, h);
  }
  d.fillStyle = fg;
  d.font = font;
  d.textAlign = 'center';
  d.textBaseline = 'middle';
  d.fillText(text, w / 2, h / 2, w - 20);
  const t = finish(c, { repeat: false });
  cache.set(key, t);
  return t;
}
