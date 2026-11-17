// Streets of Coralina Bay: asphalt, lane paint, crosswalks, raised pavements, street lamps and
// the lane graph that traffic, police and pedestrians follow.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { surfaceTexture } from './textures.js';
import { LINES, LINE_MIN, LINE_MAX, STEP, ROAD_HALF, WALK, BRIDGE, CANAL, BOULEVARD_X, BEACH } from './map.js';

const ROAD_Y = 0.02;
const PAINT_Y = 0.045;
const CURB_Y = 0.16;

export class Roads {
  constructor(scene) {
    this.scene = scene;
    this.lampHeads = null;
    this.build();
  }

  build() {
    const asphalt = new GeometryBucket();
    const paintW = new GeometryBucket();
    const paintY = new GeometryBucket();
    const pavement = new GeometryBucket();
    const ext = LINE_MAX + ROAD_HALF;
    const lo = LINE_MIN - ROAD_HALF;
    for (const L of LINES) {
      asphalt.flat(L - ROAD_HALF, lo, L + ROAD_HALF, ext, ROAD_Y, 16);
      asphalt.flat(lo, L - ROAD_HALF, ext, L + ROAD_HALF, ROAD_Y + 0.001, 16);
    }
    asphalt.flat(BRIDGE.x0, BRIDGE.z - ROAD_HALF, lo, BRIDGE.z + ROAD_HALF, ROAD_Y, 16);

    // lane paint: a double yellow centre line and white edge lines, broken at junctions
    for (const L of LINES) {
      for (let k = 0; k < LINES.length - 1; k++) {
        const a = LINES[k] + ROAD_HALF + 3;
        const b = LINES[k + 1] - ROAD_HALF - 3;
        paintY.flat(L - 0.35, a, L - 0.2, b, PAINT_Y, 1);
        paintY.flat(L + 0.2, a, L + 0.35, b, PAINT_Y, 1);
        paintY.flat(a, L - 0.35, b, L - 0.2, PAINT_Y, 1);
        paintY.flat(a, L + 0.2, b, L + 0.35, PAINT_Y, 1);
        for (const s of [-1, 1]) {
          paintW.flat(L + s * 6.3 - 0.12, a, L + s * 6.3 + 0.12, b, PAINT_Y, 1);
          paintW.flat(a, L + s * 6.3 - 0.12, b, L + s * 6.3 + 0.12, PAINT_Y, 1);
        }
      }
    }
    // the bridge to the mainland
    paintY.flat(BRIDGE.x0, BRIDGE.z - 0.35, LINE_MIN - 10, BRIDGE.z - 0.2, PAINT_Y, 1);
    paintY.flat(BRIDGE.x0, BRIDGE.z + 0.2, LINE_MIN - 10, BRIDGE.z + 0.35, PAINT_Y, 1);
    // zebra crossings on every approach to a junction
    for (const X of LINES) {
      for (const Z of LINES) {
        for (const dir of [-1, 1]) {
          for (let s = -6; s <= 6; s += 1.6) {
            const zz = Z + dir * (ROAD_HALF + 1.6);
            paintW.flat(X + s - 0.45, zz - 1.4, X + s + 0.45, zz + 1.4, PAINT_Y, 1);
            const xx = X + dir * (ROAD_HALF + 1.6);
            paintW.flat(xx - 1.4, Z + s - 0.45, xx + 1.4, Z + s + 0.45, PAINT_Y, 1);
          }
        }
      }
    }

    // raised pavement slabs filling every block (buildings stand on them)
    for (let i = 0; i < LINES.length - 1; i++) {
      for (let j = 0; j < LINES.length - 1; j++) {
        const x0 = LINES[i] + ROAD_HALF;
        const x1 = LINES[i + 1] - ROAD_HALF;
        const z0 = LINES[j] + ROAD_HALF;
        const z1 = LINES[j + 1] - ROAD_HALF;
        if (z0 < CANAL.zMin && z1 > CANAL.zMax) {
          this.slab(pavement, x0, z0, x1, CANAL.zMin);
          this.slab(pavement, x0, CANAL.zMax, x1, z1);
        } else {
          this.slab(pavement, x0, z0, x1, z1);
        }
      }
    }
    // the outer ring of pavement round the grid, and Ocean Drive's beach promenade
    this.slab(pavement, LINE_MIN - ROAD_HALF - 30, LINE_MIN - ROAD_HALF - 30, LINE_MIN - ROAD_HALF, LINE_MAX + ROAD_HALF + 25, true);
    this.slab(pavement, LINE_MIN - ROAD_HALF, LINE_MIN - ROAD_HALF - 30, BOULEVARD_X - ROAD_HALF, LINE_MIN - ROAD_HALF, false);
    this.slab(pavement, LINE_MIN - ROAD_HALF, LINE_MAX + ROAD_HALF, BOULEVARD_X - ROAD_HALF, LINE_MAX + ROAD_HALF + 25, false);
    this.slab(pavement, BOULEVARD_X + ROAD_HALF, LINE_MIN - ROAD_HALF - 30, BEACH.x0, CANAL.zMin, false);
    this.slab(pavement, BOULEVARD_X + ROAD_HALF, CANAL.zMax, BEACH.x0, LINE_MAX + ROAD_HALF + 25, false);

    const asphaltMat = new THREE.MeshStandardMaterial({ map: surfaceTexture('asphalt'), roughness: 0.82, color: 0xb9b6b8 });
    const road = new THREE.Mesh(asphalt.build(), asphaltMat);
    road.receiveShadow = true;
    const white = new THREE.Mesh(paintW.build(), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }));
    const yellow = new THREE.Mesh(paintY.build(), new THREE.MeshStandardMaterial({ color: 0xf2b630, roughness: 0.6 }));
    white.receiveShadow = yellow.receiveShadow = true;
    const pave = new THREE.Mesh(pavement.build(), new THREE.MeshStandardMaterial({ map: surfaceTexture('pavement'), roughness: 0.9 }));
    pave.receiveShadow = true;
    this.scene.add(road, white, yellow, pave);
    this.buildLamps();
  }

  /** A pavement slab with a curb edge; skipped where the canal cuts through. */
  slab(bucket, x0, z0, x1, z1, splitCanal = true) {
    if (splitCanal && z0 < CANAL.zMin && z1 > CANAL.zMax) {
      this.slab(bucket, x0, z0, x1, CANAL.zMin, false);
      this.slab(bucket, x0, CANAL.zMax, x1, z1, false);
      return;
    }
    bucket.flat(x0, z0, x1, z1, CURB_Y, 4);
    bucket.boxSides((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, -0.5, CURB_Y, 4, 4);
  }

  /** Street lamps along every street, one instanced mesh for the poles and one for the heads. */
  buildLamps() {
    const spots = [];
    for (const L of LINES) {
      for (let k = 0; k < LINES.length - 1; k++) {
        for (const t of [0.3, 0.7]) {
          const a = LINES[k] + (LINES[k + 1] - LINES[k]) * t;
          spots.push([L + ROAD_HALF + 1, a, -Math.PI / 2]);
          spots.push([a, L - ROAD_HALF - 1, 0]);
        }
      }
    }
    for (let x = BRIDGE.x0 + 30; x < LINE_MIN - 20; x += 50) {
      spots.push([x, BRIDGE.z + ROAD_HALF + 0.5, Math.PI]);
      spots.push([x, BRIDGE.z - ROAD_HALF - 0.5, 0]);
    }
    const pole = new GeometryBucket();
    const m = new THREE.Matrix4();
    pole.addGeometry(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 6).translate(0, 3.75, 0), m);
    pole.addGeometry(new THREE.BoxGeometry(0.12, 0.12, 2.4).translate(0, 7.4, 1.1), m);
    const poleGeo = pole.build();
    const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.9).translate(0, 7.3, 2.3);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2d3338, metalness: 0.6, roughness: 0.4 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc070, emissiveIntensity: 0.2 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const heads = new THREE.InstancedMesh(headGeo, this.lampMat, spots.length);
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    spots.forEach((sp, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp[2]);
      m.compose(p.set(sp[0], CURB_Y, sp[1]), q, s);
      poles.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
    });
    poles.castShadow = true;
    this.scene.add(poles, heads);
    this.lampSpots = spots;
  }

  setNight(amount) {
    this.lampMat.emissiveIntensity = 0.2 + amount * 3;
  }
}

// ---------- the lane graph ----------

/** Junction nodes sit where two streets cross; a car on a lane drives from one node to the next. */
export function nodeAt(i, j) {
  return { i, j, x: LINES[i], z: LINES[j] };
}

export function nodeIndexOf(x, z) {
  return { i: Math.round((x - LINE_MIN) / STEP), j: Math.round((z - LINE_MIN) / STEP) };
}

export const DIRS = [
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
];

export function validNode(i, j) {
  return i >= 0 && j >= 0 && i < LINES.length && j < LINES.length;
}

/** The point on the right-hand lane of a street, `along` metres past node (i,j) heading `dir`. */
export function lanePoint(i, j, dir, along, laneOffset = 3.4) {
  const x = LINES[i] + dir.dx * along - dir.dz * laneOffset;
  const z = LINES[j] + dir.dz * along + dir.dx * laneOffset;
  return { x, z };
}

/** The directions a car may leave a junction by, never straight back the way it came. */
export function exitsFrom(i, j, arriving) {
  const out = [];
  for (const d of DIRS) {
    if (arriving && d.dx === -arriving.dx && d.dz === -arriving.dz) continue;
    if (validNode(i + d.dx, j + d.dz)) out.push(d);
  }
  return out;
}

export const PAVEMENT_OFFSET = ROAD_HALF + WALK / 2;
