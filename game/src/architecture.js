// Street-front architecture in shared batches: canvas glass behind actual mullions, ledges and canopies.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { makeStream } from './rng.js';

const CREAM = 0xe6d7bc;
const PAINTS = [0x295d63, 0x9b3e47, 0x426779, 0x926938, 0x3b474f, 0xa05744, 0x387260];

export class Architecture {
  constructor(scene) {
    this.scene = scene;
    this.tiles = new Map();
  }

  put(bucket, face, u, y, projection, width, height, depth, color) {
    const x = face.x + (face.nx ? projection * face.nx : u);
    const z = face.z + (face.nx ? u : projection * face.nz);
    bucket.box(x, y, z, face.nx ? depth : width, height, face.nx ? width : depth, 2, new THREE.Color(color));
  }

  dress(x, z, w, d, h, style, tint, shops) {
    const tile = `${Math.floor(x / 160)}:${Math.floor(z / 160)}`;
    if (!this.tiles.has(tile)) this.tiles.set(tile, [new GeometryBucket(true), new GeometryBucket(true)]);
    const [solid, fittings] = this.tiles.get(tile);
    const r = makeStream(Math.floor((x + 1100) * 1333 + (z + 900) * 133777));
    const faces = [
      { x: x + w/2, z, nx: 1, nz: 0, len: d }, { x: x - w/2, z, nx: -1, nz: 0, len: d },
      { x, z: z + d/2, nx: 0, nz: 1, len: w }, { x, z: z - d/2, nx: 0, nz: -1, len: w },
    ];
    const color = PAINTS[Math.floor(r() * PAINTS.length)];
    for (const face of faces) {
      const span = face.len;
      const put = (u, y, p, a, b, c, tint) => this.put(solid, face, u, y, p, a, b, c, tint);
      const rail = (u, y, p, a, b, c) => this.put(fittings, face, u, y, p, a, b, c, 0x31434a);
      if (style === 'warehouse') {
        const bays = Math.max(1, Math.round(span / 7.8));
        const pitch = span / bays;
        put(0, .65, .06, span, 1.1, .19, 0x737676);
        put(0, h - .14, .16, span + .20, .26, .38, 0x43525a);
        for (let i = 0; i < bays; i++) {
          const u = (i + .5 - bays / 2) * pitch;
          const w = Math.min(pitch * .76, 4.3);
          put(u - pitch / 2 + .10, h / 2, .12, .17, h - .25, .24, 0x677174);
          if (face.nz && i % 2 === 0) {
            put(u, 1.84, .16, w + .35, 3.5, .21, 0x414b4e);
            for (let slat = 0; slat < 16; slat++) {
              put(u, .29 + slat * .195, .29, w, .182, .11, slat % 4 === 0 ? 0x708080 : 0x637272);
            }
            put(u, 3.69, .53, w + .78, .16, 1.14, 0x3b5155);
            put(u, 3.62, .99, w + .78, .12, .16, 0x637779);
            put(u, 3.53, .65, w * .66, .046, .09, 0xd3b885);
            put(u, .22, .40, w + .30, .20, .52, 0x85817b);
            for (const s of [-1, 1]) put(u + s * (w * .5 + .08), 1.79, .33, .105, 3.34, .12, 0x485f62);
            for (const s of [-1, 1]) put(u + s * (w / 2 + .31), .65, .37, .13, .98, .21, 0xba8a42);
          } else {
            put(u, 1.23, .14, Math.min(w, 1.03), 2.19, .20, 0x4c6064);
            put(u + .28, 1.16, .25, .13, .047, .067, 0xc0a883);
          }
          put(u, h * .70, .13, w, .93, .24, 0x405961);
          put(u, h * .70 + .27, .26, w - .12, .26, .02, 0x628088);
          for (let j = -1; j <= 1; j++) rail(u + j * w / 4, h * .70, .26, .061, .95, .08);
          rail(u, h * .70 - .05, .27, w, .046, .06);
        }
        continue;
      }
      put(0, .47, .035, span, .69, .14, color);
      put(0, h-.18, .13, span+.5, .25, .38, CREAM);
      const bands = Math.max(1, Math.round(span/8));
      const bay = span/bands;
      if (shops && h > 7) {
        put(0, 4.52, .25, span+.3, .21, .42, color);
        for (let i = 0; i < bands; i++) {
          const u = (i+.5-bands*.5)*bay;
          const c = r() < .60 ? color : PAINTS[Math.floor(r()*PAINTS.length)];
          const a = bay*.87;
          put(u-bay*.5, 2.43, .16, .24, 4.25, .25, CREAM);
          if (r() < .32) {
            put(u, 3.22, .65, a, .18, 1.34, c);
            put(u, 3.16, 1.31, a, .28, .11, c);
          } else {
            for (let k = 0; k < 10; k++) {
              const su = u + (k-4.5)*a/10;
              const tint = k%2 ? c : CREAM;
              put(su, 3.18, .59, a/10+.004, .14, 1.18, tint);
              put(su, 3.03, 1.23, a/10+.004, .25, .09, tint);
            }
          }
        }
      }
      if (style !== 'stucco' && style !== 'motel') continue;
      const floor = shops ? 4.6 : .1;
      for (let y = floor + 3.5; y < h-.95; y += 3.5) {
        const motel = style === 'motel';
        put(0, y, .16, span+.32, .18, .38, tint);
        for (let i = 0; i < bands; i++) {
          if (!motel && (i%2 || r() < .35)) continue;
          const u = (i+.5-bands*.5)*bay;
          const bw = bay * (motel ? .91 : .55);
          put(u, y-.03, .54, bw, .20, .99, CREAM);
          rail(u, y+1.01, 1.02, bw, .07, .08);
          rail(u, y+.51, 1.02, bw, .045, .067);
          for (let j = 0, n = Math.ceil(bw/.49); j <= n; j++) rail(u+bw*(j/n-.5), y+.52, 1.02, .042, .98, .042);
          for (const k of [-1,1]) rail(u+k*(bw*.5), y+1.01, .56, .065, .07, .94);
        }
      }
    }
    const cx = x + (r()-.5)*w*.45, cz = z + (r()-.5)*d*.45;
    const A = new THREE.Color(0x72777a), B = new THREE.Color(0x55595e);
    solid.box(cx, h+.41, cz, 1.8, .82, 1.16, 2, A);
    solid.box(cx, h+.87, cz, 1.93, .11, 1.23, 2, B);
    for (let j = 0; j < 6; j++) fittings.box(cx+(j-2.5)*.262,h+.48,cz+.581,.138,.39,.045,2,B);
  }

  flush() {
    const materials = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .49, metalness: .21 })];
    for (const buckets of this.tiles.values()) {
      buckets.forEach((bucket, i) => {
        if (bucket.empty) return;
        const mesh = new THREE.Mesh(bucket.build(), materials[i]);
        mesh.castShadow = i === 0;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
      });
    }
    this.tiles.clear();
  }
}
