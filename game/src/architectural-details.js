// Silhouette-scale fixtures: striped canvas awnings, stacked Ocean Drive balconies, the structural
// relief that breaks every facade into piers, fins and floor bands, rooftop plant, and the neon tubes
// that outline each Ocean Drive motel's parapet, deco band and fin.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { makeStream } from './rng.js';

const WHITE = new THREE.Color(0xffffff);

/** A soft falloff across a neon tube: bright on the tube's axis (v = 0.5), clear at the edges. */
function lineGlow() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const d = c.getContext('2d');
  const g = d.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.58, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  d.fillStyle = g;
  d.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ArchitecturalDetails {
  constructor() {
    this.fabric = new GeometryBucket(true);
    this.structure = new GeometryBucket(true);
    this.metal = new GeometryBucket(true);
    this.tubes = new GeometryBucket(true);
    this.halos = new GeometryBucket(true);
    this.rnd = makeStream(5113);
    this.palettes = [[0x566d69,0xd4bb8c],[0x9f4335,0xeacb99],[0x304f60,0xe7d8bd],[0x38756f,0xd1dfb8]].map(list => list.map(c => new THREE.Color(c)));
    this.cream = new THREE.Color(0xc9b3a0);
    this.steel = new THREE.Color(0x40505c);
    this.glaze = new THREE.Color(0x436765);
    this.bronze = new THREE.Color(0x2a3036);
    this.mullion = new THREE.Color(0x76838d);
    this.spandrel = new THREE.Color(0x8796a0);
    this.stone = new THREE.Color(0xc9b69c);
    this.plant = [0xb9b8b2, 0x9ea3a6, 0xcfcac0].map(c => new THREE.Color(c));
  }

  storefront(x, z, w, d, variant) {
    for (const [cx,cz,dx,dz,nx,nz,span] of [[x+w/2,z,0,-1,1,0,d],[x,z-d/2,-1,0,0,-1,w],[x-w/2,z,0,1,-1,0,d],[x,z+d/2,1,0,0,1,w]]) {
      const count = Math.max(1, Math.round(span / 5.4));
      const step = span / count;
      const p = (s,y,n) => [cx+dx*s+nx*n,y,cz+dz*s+nz*n];
      const uv = [0,0];
      for (let i = 0; i < count; i++) {
        const a = -span*.5 + i*step + .42, size = step - .84;
        if (size < 1) continue;
        const colors = this.palettes[(variant + i) % 4];
        for (let k = 0; k < 8; k++) {
          const l = a + k*size/8, r = l + size/8;
          this.fabric.quad(p(l,3.25,1.02),p(r,3.25,1.02),p(r,3.70,.01),p(l,3.70,.01),uv,uv,uv,uv,colors[k%2]);
          this.fabric.quad(p(l,3.10,1.02),p(r,3.10,1.02),p(r,3.25,1.02),p(l,3.25,1.02),uv,uv,uv,uv,colors[k%2]);
        }
      }
    }
  }

  balconies(east, z, width, height) {
    for (let y = 4.9; y < height - 1.4; y += 3.55) {
      for (let u = z-width*.5+3; u < z+width*.5-2; u += 5.1) {
        if (Math.abs(z-u) < 2.1) continue;
        const b = this.structure;
        b.box(east+.49,y,u,.99,.22,3.75,1,this.cream);
        b.box(east+.94,y+.48,u,.048,.79,3.61,1,this.glaze);
        b.box(east+.95,y+.9,u,.095,.075,3.78,1,this.steel);
        for (const t of [-1.78,0,1.78]) b.box(east+.96,y+.47,u+t,.074,.87,.074,1,this.steel);
      }
    }
  }

  /**
   * Relief over a facade drawn by facadeWall: the same bay and storey grid, so piers land between
   * window bays and bands on the slab lines. Glass towers get dark mullion fins, offices stone
   * pilasters and cornices, stucco walk-ups and motels deco eyebrows over every window row.
   */
  relief(x, z, width, depth, bottom, top, style, tint) {
    if (style.startsWith('shop') || style === 'warehouse' || top - bottom < 2.5) return;
    const glass = style === 'glass', office = style === 'office';
    const span = glass ? 3.2 : style === 'motel' ? 4.0 : 3.65;
    const floors = Math.max(1, Math.round((top - bottom) / (glass ? 3.45 : 3.55)));
    const storey = (top - bottom) / floors;
    const wall = new THREE.Color(tint).lerp(WHITE, 0.5);
    const pier = glass ? this.mullion : office ? this.stone.clone().multiplyScalar(0.9) : wall.clone().offsetHSL(0, 0.12, -0.13);
    const band = glass ? this.spandrel : office ? this.stone : WHITE.clone().lerp(wall, 0.25);
    const bucket = glass ? this.metal : this.structure;
    const pw = glass ? 0.15 : office ? 0.42 : 0.3, pd = glass ? 0.55 : office ? 0.26 : 0.16;
    const xa = x - width / 2, xb = x + width / 2, za = z - depth / 2, zb = z + depth / 2;
    const h = top - bottom, cy = (top + bottom) / 2;
    for (const [x0, z0, x1, z1] of [[xb, zb, xb, za], [xb, za, xa, za], [xa, za, xa, zb], [xa, zb, xb, zb]]) {
      const length = Math.hypot(x1 - x0, z1 - z0);
      const tx = (x1 - x0) / length, tz = (z1 - z0) / length, nx = -tz, nz = tx;
      const along = Math.abs(tx) > 0.5;
      const put = (b, s, out, y, a, n, hh, col) => b.box(x0 + tx * s + nx * out, y, z0 + tz * s + nz * out, along ? a : n, hh, along ? n : a, 2, col);
      // a corner pier wrapping the corner, then piers or fins between the bays
      put(bucket, 0, 0, cy, pd * 2 + pw, pd * 2 + pw, h, pier);
      const bays = Math.max(1, Math.round(length / span));
      const every = !glass && !office && bays > 3 ? 2 : 1;
      for (let k = every; k < bays; k += every) put(bucket, (k * length) / bays, pd / 2, cy, pw, pd, h, pier);
      for (let f = 0; f < floors; f++) {
        const y = bottom + f * storey;
        if (glass) {
          if (f % 3 === 2) put(this.structure, length / 2, 0.09, y + storey, length, 0.18, 0.28, band);
        } else if (office) {
          if (f) put(this.structure, length / 2, 0.15, y, length + 0.2, 0.3, 0.32, band);
          put(this.structure, length / 2, 0.08, y + storey * 0.22, length, 0.16, 0.1, band);
        } else {
          put(this.structure, length / 2, 0.3, y + storey * 0.85, length - 0.3, 0.6, 0.12, band);
          if (f) put(this.structure, length / 2, 0.06, y + 0.02, length, 0.12, 0.2, pier);
        }
      }
    }
  }

  /** Rooftop plant: condenser units with fan grilles, a stair bulkhead and the odd satellite dish. */
  rooftop(x, z, w, d, h) {
    const r = this.rnd;
    const n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const ux = x + (r() - 0.5) * w * 0.7, uz = z + (r() - 0.5) * d * 0.7;
      const col = this.plant[k % 3];
      this.metal.box(ux, h + 0.55, uz, 1.3, 1.1, 1.0, 2, col);
      this.metal.box(ux, h + 1.13, uz, 0.95, 0.06, 0.7, 2, this.bronze);
    }
    if (r() < 0.5) {
      const sx = x + (r() - 0.5) * w * 0.5, sz = z + (r() - 0.5) * d * 0.5;
      this.metal.box(sx, h + 0.9, sz, 0.08, 1.8, 0.08, 2, this.steel);
      const dish = new THREE.CylinderGeometry(0.62, 0.08, 0.3, 12).rotateX(-1.1);
      this.metal.addGeometry(dish, new THREE.Matrix4().makeTranslation(sx, h + 1.9, sz), this.plant[2]);
      dish.dispose();
    }
    if (w * d > 160) this.structure.box(x - w * 0.22, h + 1.3, z + d * 0.2, 3, 2.6, 2.6, 2, this.stone);
  }

  /** Neon outlines for a beach-facing motel: parapet edge, both edges of the deco band and the fin. */
  neonTrim(east, z, width, height, color) {
    const tint = new THREE.Color(color);
    const halo = (x, y0, y1, z0, z1) => {
      const vertical = y1 - y0 > z1 - z0;
      const uv = vertical ? [[0, 1], [0, 0], [1, 0], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
      this.halos.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], uv[0], uv[1], uv[2], uv[3], tint);
    };
    const run = (x, y, z0, z1) => {
      this.tubes.box(x, y, (z0 + z1) / 2, 0.14, 0.14, z1 - z0, 2, tint);
      halo(x + 0.08, y - 0.8, y + 0.8, z0, z1);
    };
    const rise = (x, y0, y1, zc) => {
      this.tubes.box(x, (y0 + y1) / 2, zc, 0.14, y1 - y0, 0.14, 2, tint);
      halo(x + 0.08, y0, y1, zc - 0.8, zc + 0.8);
    };
    run(east + 0.05, height + 1.03, z - width / 2 + 0.2, z + width / 2 - 0.2);
    run(east + 0.65, height + 0.08, z - width / 2 + 2, z + width / 2 - 2);
    run(east + 0.65, height + 2.32, z - width / 2 + 2, z + width / 2 - 2);
    for (const side of [-1, 1]) rise(east + 0.65, height * 0.1, height * 0.9, z + side * 0.62);
  }

  mount(scene) {
    const make = (bucket, side, roughness = .8, metalness = 0) => {
      const mesh = new THREE.Mesh(bucket.build(), new THREE.MeshStandardMaterial({vertexColors:true,roughness,metalness,side}));
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    };
    make(this.fabric, THREE.DoubleSide);
    make(this.structure, THREE.FrontSide);
    make(this.metal, THREE.FrontSide, .48, .42);
    const tubes = new THREE.Mesh(this.tubes.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    const halos = new THREE.Mesh(this.halos.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, map: lineGlow(), transparent: true, opacity: 0.72, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    }));
    scene.add(tubes, halos);
  }
}
