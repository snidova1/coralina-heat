// Low, amber path lights make the Ocean Drive dune walk readable after sunset.
import * as THREE from 'three';
import { BEACH, CANAL } from './map.js';
import { GeometryBucket } from './geometry.js';
import { glowTexture, surfaceTexture } from './textures.js';

export function buildBeachWalk(city) {
  const deck = new GeometryBucket(), trim = new GeometryBucket(true), lamps = new GeometryBucket();
  const timber = new THREE.Color(0x806249), bronze = new THREE.Color(0x414244);
  const glowMaterial = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffab61,
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glowGeo = new THREE.PlaneGeometry(3.8, 4.6).rotateX(-Math.PI / 2);
  const pools = [];
  const xAt = z => BEACH.x0 + 18.4 + Math.sin(z * .031) * 1.55;
  const p = (z, offset, lift) => {
    const x = xAt(z) + offset;
    return [x, city.beachHeight(x) + lift, z];
  };
  for (const [from, to] of [[-385, CANAL.zMin - 3], [CANAL.zMax + 3, 385]]) {
    for (let z = from; z < to; z += 2) {
      const end = Math.min(z + 2, to);
      const strip = (bucket, a, b, lift, color) => bucket.quad(p(end, a, lift), p(end, b, lift),
        p(z, b, lift), p(z, a, lift), [0, -end / 6.4], [1, -end / 6.4], [1, -z / 6.4], [0, -z / 6.4], color);
      strip(deck, -1.18, 1.18, .055);
      strip(trim, -1.28, -1.12, .084, timber);
      strip(trim, 1.12, 1.28, .084, timber);
    }
    for (let z = from + 4; z < to - 4; z += 6.5) {
      // Keep the brighter seaward fixtures on one edge so they trace the curving path.
      const x = xAt(z) + 1.38, y = city.beachHeight(x);
      trim.box(x, y + .31, z, .17, .62, .21, 1, bronze);
      trim.box(x, y + .71, z, .29, .065, .31, 1, bronze);
      lamps.box(x, y + .63, z, .25, .10, .27);
      pools.push([xAt(z) + .30, city.beachHeight(xAt(z)) + .105, z]);
    }
  }
  const glow = new THREE.InstancedMesh(glowGeo, glowMaterial, pools.length);
  const matrix = new THREE.Matrix4();
  pools.forEach(([x, y, z], i) => glow.setMatrixAt(i, matrix.makeTranslation(x, y, z)));
  city.scene.add(glow);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x746451, emissive: 0xffc183, emissiveIntensity: 0, roughness: .58 });
  for (const [bucket, mat] of [[deck, new THREE.MeshStandardMaterial({ map: surfaceTexture('wood'), roughness: .86 })],
    [trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84 })], [lamps, lampMat]]) {
    const mesh = new THREE.Mesh(bucket.build(), mat);
    mesh.receiveShadow = true;
    city.scene.add(mesh);
  }
  return { setNight(amount) {
    lampMat.emissiveIntensity = amount * 4.0;
    glowMaterial.opacity = amount * .70;
  } };
}
