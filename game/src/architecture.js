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
        // Corrugated siding takes real shadow from the structural ribs.
        for (let u = -span/2+.15; u < span/2; u += 3.2) put(u, h*.5, .07, .11, h-.36, .16, 0x777f79);
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
