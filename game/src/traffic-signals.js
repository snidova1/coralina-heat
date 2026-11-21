// Traffic signals: a mast-arm pole on two corners of every junction, yellow heads with black backplates
// and visors over each approach. North-south runs on green while east-west waits on red; one merged
// assembly is instanced round the grid, its lit lenses glowing through the dusk.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { glowTexture } from './textures.js';
import { LINES, ROAD_HALF, CANAL } from './map.js';

const CURB = 0.16;
const LENS = [[0.33, 0xff2a22], [0, 0xffb42a], [-0.33, 0x34ff8a]];

/** One signal head facing +z (rotated by `yaw`), lit on lamp index `on`. */
function head(body, lit, glow, x, y, z, yaw, on) {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const place = (geo, col, bucket = body) => { bucket.addGeometry(geo, m, col); geo.dispose(); };
  place(new THREE.BoxGeometry(0.38, 1.05, 0.26), new THREE.Color(0xd8a41c));
  place(new THREE.BoxGeometry(0.64, 1.3, 0.03).translate(0, 0, -0.15), new THREE.Color(0x15171a));
  LENS.forEach(([dy, color], i) => {
    const tint = new THREE.Color(color);
    place(new THREE.BoxGeometry(0.3, 0.025, 0.2).translate(0, dy + 0.15, 0.22), new THREE.Color(0x15171a));
    if (i === on) {
      place(new THREE.CircleGeometry(0.115, 12).translate(0, dy, 0.135), tint, lit);
      place(new THREE.PlaneGeometry(1.1, 1.1).translate(0, dy, 0.16), tint, glow);
    } else place(new THREE.CircleGeometry(0.115, 12).translate(0, dy, 0.133), tint.multiplyScalar(0.12));
  });
}

/** The assembly for the north-east corner; the south-west corner is the same turned half round. */
function assembly() {
  const body = new GeometryBucket(true), lit = new GeometryBucket(true), glow = new GeometryBucket(true);
  const steel = new THREE.Color(0x2f3439);
  const add = (geo, x, y, z) => { body.addGeometry(geo, new THREE.Matrix4().makeTranslation(x, y, z), steel); geo.dispose(); };
  add(new THREE.CylinderGeometry(0.1, 0.14, 6.5, 8), 0, 3.25, 0);
  add(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8), 0, 0.25, 0);
  add(new THREE.BoxGeometry(6.4, 0.13, 0.13), -3.2, 6.1, 0);
  add(new THREE.BoxGeometry(2.2, 0.08, 0.08).rotateZ(-0.42), -1.0, 5.65, 0);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), -2.3, 5.83, 0);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), -4.9, 5.83, 0);
  for (const x of [-2.3, -4.9]) {
    head(body, lit, glow, x, 5.05, 0.16, 0, 2);
    head(body, lit, glow, x, 5.05, -0.16, Math.PI, 2);
  }
  head(body, lit, glow, 0.3, 3.3, 0, Math.PI / 2, 0);
  return [body.build(), lit.build(), glow.build()];
}

export function addTrafficSignals(scene) {
  const spots = [];
  const corner = ROAD_HALF + 1.05;
  for (const x of LINES) {
    for (const z of LINES) {
      if (z > CANAL.zMin - 10 && z < CANAL.zMax + 10) continue;
      spots.push([x + corner, z + corner, 0], [x - corner, z - corner, Math.PI]);
    }
  }
  const [bodyGeo, litGeo, glowGeo] = assembly();
  const materials = [
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }),
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    new THREE.MeshBasicMaterial({ vertexColors: true, map: glowTexture(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  ];
  const meshes = [bodyGeo, litGeo, glowGeo].map((geo, i) => new THREE.InstancedMesh(geo, materials[i], spots.length));
  const m = new THREE.Matrix4();
  spots.forEach(([x, z, yaw], i) => {
    m.makeRotationY(yaw).setPosition(x, CURB, z);
    for (const mesh of meshes) mesh.setMatrixAt(i, m);
  });
  meshes[0].castShadow = true;
  for (const mesh of meshes) {
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  return { meshes, spots };
}
