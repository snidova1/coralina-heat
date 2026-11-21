// Geometry buckets: the city is thousands of walls, roofs and props, so each material gets one
// bucket that collects them with world-space UVs and becomes a single merged mesh (few draw calls).
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpN = new THREE.Vector3();

export class GeometryBucket {
  constructor(withColor = false) {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.color = withColor ? [] : null;
  }

  vertex(p, n, u, v, col) {
    this.pos.push(p[0], p[1], p[2]);
    this.norm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    if (this.color) this.color.push(col ? col.r : 1, col ? col.g : 1, col ? col.b : 1);
  }

  /** A quad a,b,c,d counter-clockwise as seen from its front, with its own UVs. */
  quad(a, b, c, d, uva, uvb, uvc, uvd, col) {
    tmpA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    tmpB.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    tmpN.crossVectors(tmpA, tmpB).normalize();
    this.vertex(a, tmpN, uva[0], uva[1], col);
    this.vertex(b, tmpN, uvb[0], uvb[1], col);
    this.vertex(c, tmpN, uvc[0], uvc[1], col);
    this.vertex(a, tmpN, uva[0], uva[1], col);
    this.vertex(c, tmpN, uvc[0], uvc[1], col);
    this.vertex(d, tmpN, uvd[0], uvd[1], col);
  }

  /** A vertical wall from (x0,z0) to (x1,z1), left to right as seen from outside. */
  wall(x0, z0, x1, z1, y0, y1, u0, u1, v0, v1, col) {
    this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [u0, v0], [u1, v0], [u1, v1], [u0, v1], col);
  }

  /** The four walls of a block footprint, the texture wrapping continuously round the corners. */
  boxSides(cx, cz, w, d, y0, y1, tileW, tileH, col, vOffset = 0, uOffset = 0) {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const v0 = vOffset;
    const v1 = vOffset + (y1 - y0) / tileH;
    let u = uOffset;
    const faces = [
      [x1, z1, x1, z0, d],
      [x1, z0, x0, z0, w],
      [x0, z0, x0, z1, d],
      [x0, z1, x1, z1, w],
    ];
    for (const f of faces) {
      const du = Math.max(1, Math.round(f[4] / tileW));
      this.wall(f[0], f[1], f[2], f[3], y0, y1, u, u + du, v0, v1, col);
      u += du;
    }
  }

  /** A horizontal rectangle facing up (or down), UVs in world metres divided by `scale`. */
  flat(x0, z0, x1, z1, y, scale = 1, down = false, col) {
    const a = [x0, y, z1];
    const b = [x1, y, z1];
    const c = [x1, y, z0];
    const d = [x0, y, z0];
    const uv = (p) => [p[0] / scale, -p[2] / scale];
    if (down) this.quad(d, c, b, a, uv(d), uv(c), uv(b), uv(a), col);
    else this.quad(a, b, c, d, uv(a), uv(b), uv(c), uv(d), col);
  }

  /** A closed box (no bottom), UVs in world metres divided by `scale`. */
  box(cx, cy, cz, w, h, d, scale = 4, col) {
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    this.boxSides(cx, cz, w, d, y0, y1, scale, scale, col, y0 / scale);
    this.flat(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y1, scale, false, col);
  }

  /** Any three.js geometry, placed by a matrix. */
  addGeometry(geo, matrix, col) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    const vn = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      vn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.vertex([v.x, v.y, v.z], vn, t ? t.getX(i) : 0, t ? t.getY(i) : 0, col);
    }
    if (g !== geo) g.dispose();
  }

  get empty() { return this.pos.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.color) g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Merge many geometries (already positioned) into one, keeping per-vertex colours. */
export function mergeColored(parts) {
  const bucket = new GeometryBucket(true);
  for (const { geo, matrix, color } of parts) bucket.addGeometry(geo, matrix || new THREE.Matrix4(), color);
  return bucket.build();
}

export { UP };
