// Life on the sand below Ocean Drive: boardwalk beach accesses with rope rails, striped towels between
// the umbrellas, volleyball courts, kayaks and boards at the waterline, sandcastles, dune grass along
// the promenade and a thatched beach bar strung with bulbs. All of it is static and merged by material.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { surfaceTexture, neonSignTexture } from './textures.js';
import { CANAL, ISLAND } from './map.js';
import { makeStream } from './rng.js';

const TOWELS = [[0xff4f6d, 0xfff4e0], [0x2ec4b6, 0xffffff], [0xffd23f, 0x3a86ff], [0x9d7bff, 0xfdf0ff], [0xff9f1c, 0x06d6a0], [0xef476f, 0x1f2b5a]];
const HULLS = [0xff5a3c, 0xffd23f, 0x2ec4b6, 0xff9f1c, 0x3a86ff];
const ACCESSES = [-342, -272, -202, -132, -62, 108, 178, 248, 318];

export function buildBeachLife(city) {
  const scene = city.scene;
  const rnd = makeStream(3301);
  const ground = (x) => city.beachHeight(x);
  const sand = (z) => z > ISLAND.minZ + 6 && z < ISLAND.maxZ - 4 && !(z > CANAL.zMin - 8 && z < CANAL.zMax + 8);
  const props = new GeometryBucket(true), planks = new GeometryBucket(), bulbs = new GeometryBucket(true);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3();
  const C = (hex) => new THREE.Color(hex);
  const put = (geo, x, y, z, col, yaw = 0, pitch = 0, roll = 0, s = [1, 1, 1], bucket = props) => {
    rotation.setFromEuler(euler.set(pitch, yaw, roll, 'YXZ'));
    matrix.compose(new THREE.Vector3(x, y, z), rotation, scale.set(...s));
    bucket.addGeometry(geo, matrix, col);
  };
  const G = {
    post: new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6),
    rope: new THREE.BoxGeometry(0.035, 0.035, 1),
    pole: new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8),
    net: new THREE.BoxGeometry(9.4, 0.9, 0.02),
    tape: new THREE.BoxGeometry(9.4, 0.07, 0.04),
    line: new THREE.BoxGeometry(1, 0.02, 0.06),
    ball: new THREE.SphereGeometry(0.11, 10, 8),
    hull: new THREE.CapsuleGeometry(0.33, 2.9, 4, 10),
    board: new THREE.CapsuleGeometry(0.26, 1.7, 4, 10),
    blade: new THREE.ConeGeometry(0.05, 0.85, 3),
    keep: new THREE.BoxGeometry(1.1, 0.34, 1.1),
    tower: new THREE.ConeGeometry(0.2, 0.55, 6),
    bamboo: new THREE.CylinderGeometry(0.1, 0.11, 3.3, 7),
    thatch: new THREE.ConeGeometry(4.4, 1.9, 4),
    counter: new THREE.BoxGeometry(3.6, 1.05, 0.62),
    stool: new THREE.CylinderGeometry(0.2, 0.16, 0.75, 8),
    bulb: new THREE.SphereGeometry(0.07, 6, 4),
  };

  // Boardwalk beach accesses: planked paths stepping down the slope, posts and rope either side.
  for (const z of ACCESSES) {
    for (let x = 378.4; x < 419; x += 0.5) {
      const ya = ground(x) + 0.12, yb = ground(x + 0.5) + 0.12;
      planks.quad([x, ya, z + 0.9], [x + 0.5, yb, z + 0.9], [x + 0.5, yb, z - 0.9], [x, ya, z - 0.9], [z / 2 + 0.45, x / 2], [z / 2 + 0.45, x / 2 + 0.25], [z / 2 - 0.45, x / 2 + 0.25], [z / 2 - 0.45, x / 2]);
      for (const side of [-1, 1]) {
        const zs = z + side * 0.9;
        planks.quad([x, ya - 0.16, zs], [x + 0.5, yb - 0.16, zs], [x + 0.5, yb, zs], [x, ya, zs], [0, 0], [0.25, 0], [0.25, 0.08], [0, 0.08]);
      }
    }
    for (let x = 379; x < 419; x += 3) {
      for (const side of [-1, 1]) {
        put(G.post, x, ground(x) + 0.5, z + side * 1.02, C(0x6b5038));
        const nx = Math.min(x + 3, 418.9);
        const drop = ground(nx) - ground(x);
        put(G.rope, (x + nx) / 2, ground(x) + 0.86 + drop / 2, z + side * 1.02, C(0xc9ad80), Math.PI / 2, -Math.atan2(drop, nx - x), 0, [1, 1, Math.hypot(nx - x, drop)]);
      }
    }
  }

  // Towels between the umbrella columns, a few with a board stuck upright in the sand beside them.
  for (let z = ISLAND.minZ + 12; z < ISLAND.maxZ - 6; z += 6.1) {
    for (const column of [390.6, 407.4]) {
      if (!sand(z) || rnd() < 0.3) continue;
      const x = column + (rnd() - 0.5) * 2.6, tz = z + (rnd() - 0.5) * 2.4, yaw = (rnd() - 0.5) * 0.7;
      if (ACCESSES.some((a) => Math.abs(a - tz) < 2.6)) continue;
      const [a, b] = TOWELS[Math.floor(rnd() * TOWELS.length)];
      for (let k = 0; k < 6; k++) {
        const stripe = new THREE.PlaneGeometry(0.98, 0.32).rotateX(-Math.PI / 2).translate(0, 0, -0.8 + k * 0.32);
        put(stripe, x, ground(x) + 0.03, tz, C(k % 2 ? a : b), yaw);
        stripe.dispose();
      }
      if (rnd() < 0.22) put(G.board, x + 1.0, ground(x) + 0.75, tz - 0.4, C(HULLS[Math.floor(rnd() * HULLS.length)]), yaw, 0.18, 0, [1, 1, 0.22]);
    }
  }

  // Volleyball courts: posts, net with its white tape, rope boundary and a ball in play.
  for (const z0 of [-318, -158, 222]) {
    for (const x of [400, 410]) put(G.pole, x, ground(x) + 1.3, z0, C(0xeeeeee));
    put(G.net, 405, ground(405) + 1.95, z0, C(0x24272c));
    put(G.tape, 405, ground(405) + 2.42, z0, C(0xf4f4f0));
    for (const [cx, cz, len, yaw] of [[401, z0, 16, Math.PI / 2], [409, z0, 16, Math.PI / 2], [405, z0 - 8, 8, 0], [405, z0 + 8, 8, 0]]) {
      put(G.line, cx, ground(cx) + 0.012, cz, C(0x2fa7e0), yaw, 0, 0, [len, 1, 1]);
    }
    put(G.ball, 403.2, ground(403) + 0.11, z0 + 3.4, C(0xffe066));
  }

  // Kayaks and boards drawn up at the waterline, sandcastles where the sand is still damp.
  for (let z = ISLAND.minZ + 20; z < ISLAND.maxZ - 10; z += 23) {
    if (!sand(z)) continue;
    const x = 424 + rnd() * 4;
    if (rnd() < 0.55) {
      const yaw = Math.PI / 2 + (rnd() - 0.5) * 0.8;
      put(G.hull, x, ground(x) + 0.17, z, C(HULLS[Math.floor(rnd() * HULLS.length)]), yaw, Math.PI / 2, 0, [1, 1, 0.5]);
      if (rnd() < 0.6) put(G.hull, x + 0.4, ground(x) + 0.17, z + 1.1, C(HULLS[Math.floor(rnd() * HULLS.length)]), yaw + 0.1, Math.PI / 2, 0, [1, 1, 0.5]);
    } else {
      const castle = C(0xd6b98a);
      const y = ground(x);
      put(G.keep, x, y + 0.17, z, castle, rnd());
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) put(G.tower, x + dx, y + 0.5, z + dz, castle);
      put(G.tower, x, y + 0.68, z, castle, 0, 0, 0, [1.5, 1.6, 1.5]);
    }
  }

  // Dune grass in clumps along the sand side of the promenade deck, clear of the beach accesses.
  for (let z = ISLAND.minZ + 8; z < ISLAND.maxZ - 6; z += 2.2 + rnd() * 2) {
    if (!sand(z) || ACCESSES.some((a) => Math.abs(a - z) < 2.4)) continue;
    const cx = 379.6 + rnd() * 2.2;
    for (let k = 0; k < 7; k++) {
      const shade = C(0x7d8a4a).lerp(C(0xc2ad6a), rnd());
      put(G.blade, cx + (rnd() - 0.5) * 0.7, ground(cx) + 0.38, z + (rnd() - 0.5) * 0.7, shade, rnd() * 6.28, (rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7, [1, 0.7 + rnd() * 0.6, 1]);
    }
  }

  // The Palapa: a thatched beach bar with a counter, stools and strings of bulbs out to two poles.
  const bx = 387, bz = -238, by = ground(bx);
  for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) put(G.bamboo, bx + dx, by + 1.65, bz + dz, C(0xb08a55));
  put(G.thatch, bx, by + 4.2, bz, C(0xb39a62), Math.PI / 4);
  put(G.counter, bx + 1.6, by + 0.53, bz, C(0x7a4f32), Math.PI / 2);
  put(G.counter, bx, by + 0.53, bz - 1.6, C(0x7a4f32));
  for (let k = -1; k <= 1; k++) {
    put(G.stool, bx + 2.5, by + 0.38, bz + k * 1.1, C(0x2ec4b6));
    put(G.stool, bx + k * 1.1, by + 0.38, bz - 2.5, C(0xff5f8f));
  }
  for (const [px, pz] of [[bx + 8, bz - 6], [bx + 8, bz + 6]]) {
    put(G.bamboo, px, ground(px) + 1.65, pz, C(0xb08a55));
    const from = new THREE.Vector3(bx + 2, by + 3.3, bz + Math.sign(pz - bz) * 2), to = new THREE.Vector3(px, ground(px) + 3.2, pz);
    for (let t = 0.05; t < 1; t += 0.075) {
      const p = from.clone().lerp(to, t);
      put(G.bulb, p.x, p.y - Math.sin(t * Math.PI) * 0.7, p.z, C(t * 13 % 2 < 1 ? 0xffd48a : 0xff9ad0), 0, 0, 0, [1, 1, 1], bulbs);
    }
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), new THREE.MeshBasicMaterial({ map: neonSignTexture('PALAPA', '#ffb13b', 'BEACH BAR', '#5ff2ff'), toneMapped: false, side: THREE.DoubleSide }));
  sign.position.set(bx + 3.05, by + 3.05, bz);
  sign.rotation.y = Math.PI / 2;
  scene.add(sign);

  for (const g of Object.values(G)) g.dispose();
  const mesh = new THREE.Mesh(props.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }));
  const deck = new THREE.Mesh(planks.build(), new THREE.MeshStandardMaterial({ map: surfaceTexture('wood'), color: 0xd9c2a4, roughness: 0.9, side: THREE.DoubleSide }));
  const lights = new THREE.Mesh(bulbs.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  mesh.castShadow = mesh.receiveShadow = deck.receiveShadow = deck.castShadow = true;
  scene.add(mesh, deck, lights);
}
