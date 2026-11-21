// Low stone planters double as cover on the Kingfish promenade.
import * as THREE from 'three';
import { cloneModel, contactShadow } from './assets.js';
import { GeometryBucket } from './geometry.js';
import { makeStream } from './rng.js';

export function buildMarinaCover(city) {
  const ground = .16;
  const stone = new GeometryBucket(true), leaves = new GeometryBucket(true);
  const matrix = new THREE.Matrix4();
  const color = n => new THREE.Color(n);
  const rnd = makeStream(402);
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [x, z, rx, rz, tall] of [
    [146.7, 383.7, 1.24, .66, false], [157.8, 383.5, 1.32, .68, true],
    [162.4, 390.8, 1.29, .70, false], [178.2, 383.9, 1.32, .71, true],
    [196, 390.5, 1.28, .72, true], [212, 384.9, 1.2, .65, false], [235, 390.5, 1.26, .72, true],
  ]) {
    const at = (a, y, scale) => [x + rx * Math.cos(a) * scale, ground + y, z + rz * Math.sin(a) * scale];
    // Tapered cast concrete with a raised lip, an inner wall and recessed soil.
    const rings = [[0, .79], [.08, .88], [.55, 1], [.62, 1.045], [.73, 1.045], [.76, 1], [.76, .86], [.57, .86]];
    for (let j = 0; j < 32; j++) {
      const a = j * Math.PI / 16, b = (j + 1) * Math.PI / 16;
      const point = (t, k) => at(t, ...rings[k]);
      for (let k = 0; k < rings.length - 1; k++) {
        const tint = color(k === 2 ? 0x9d8d79 : k >= 3 ? 0xc6b79e : 0xab9981).offsetHSL(0, 0, (rnd() - .5) * .045);
        stone.quad(point(b, k), point(a, k), point(a, k + 1), point(b, k + 1), ...uv, tint);
      }
      const center = [x, ground + .57, z];
      stone.quad(point(b, 7), point(a, 7), center, center, ...uv, color(0x483429));
    }
    const palm = tall && cloneModel('prop_palm', 3.6);
    if (palm) {
      palm.position.set(x, ground + .58, z);
      palm.rotation.y = rnd() * Math.PI * 2;
      city.scene.add(palm);
    }
    const shade = contactShadow(rx * 2.75, rz * 2.9);
    shade.position.set(x, ground + .013, z);
    city.scene.add(shade);
    for (let i = 0; i < 48; i++) {
      const a = rnd() * Math.PI * 2;
      const [px, py, pz] = at(a, .56, .15 + rnd() * .57);
      const dx = Math.cos(a), dz = Math.sin(a), reach = .24 + rnd() * .22, height = .14 + rnd() * .29;
      const tip = [px + dx * reach, py + height * .50, pz + dz * reach];
      const mid = side => [px + dx * reach * .44 + dz * .043 * side, py + height, pz + dz * reach * .44 - dx * .043 * side];
      const tint = color(i % 4 ? 0x577a3c : 0x909c54).offsetHSL(0, 0, (rnd() - .5) * .15);
      leaves.quad([px + dz * .02, py, pz - dx * .02], [px - dz * .02, py, pz + dx * .02], mid(-1), mid(1), ...uv, tint);
      leaves.quad(mid(1), mid(-1), tip, tip, ...uv, tint);
    }
    city.addCollider(x - rx, z - rz, x + rx, z + rz, ground + .76, 'cover');
  }
  const post = new THREE.CylinderGeometry(.079, .108, .94, 12);
  const stripe = new THREE.CylinderGeometry(.087, .088, .095, 12);
  for (const x of [145, 150, 155, 160, 166, 173, 180, 187, 194]) {
    const z = 391.65;
    stone.box(x, ground + .036, z, .27, .073, .27, 1, color(0x62615a));
    stone.addGeometry(post, matrix.makeTranslation(x, ground + .47, z), color(0x334c51));
    stone.addGeometry(stripe, matrix.makeTranslation(x, ground + .80, z), color(0xd8ad54));
    city.addCollider(x - .11, z - .11, x + .11, z + .11, ground + .94, 'bollard');
  }
  post.dispose(); stripe.dispose();
  for (const [bucket, side] of [[stone, THREE.FrontSide], [leaves, THREE.DoubleSide]]) {
    const mesh = new THREE.Mesh(bucket.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side }));
    mesh.castShadow = mesh.receiveShadow = true;
    city.scene.add(mesh);
  }
}
