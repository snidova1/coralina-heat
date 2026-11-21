// Public waterfront fixtures, shared between the live city and the camera presets.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { surfaceTexture, glowTexture } from './textures.js';
import { BEACH, CANAL, ISLAND } from './map.js';
import { makeStream } from './rng.js';

export function buildWaterfront(city) {
  const scene = city.scene;
  const deck = new GeometryBucket(), fittings = new GeometryBucket(true), brass = new GeometryBucket();
  const transform = new THREE.Matrix4();
  const rnd = makeStream(77);
  const color = n => new THREE.Color(n);
  const dark = color(0x34424a), top = color(0xbab7a8), clay = color(0xa95e46), soil = color(0x473d2f);
  const cylinder = (r1, r2, h, sides, x, y, z, tint) => {
    const g = new THREE.CylinderGeometry(r1, r2, h, sides);
    fittings.addGeometry(g, transform.makeTranslation(x, y, z), tint);
    g.dispose();
  };
  const lamps = [];
  for (const [from, to] of [[ISLAND.minZ + 2, CANAL.zMin - 6], [CANAL.zMax + 6, ISLAND.maxZ - 6]]) {
    for (let z = from; z < to; z += .44) {
      const lift = city.beachHeight(375);
      deck.box(375.6, lift + .11 + rnd()*.017, z, 5.3, .12, .428, 3);
    }
    for (let z = from + 4; z < to; z += 8) {
      fittings.box(378.1, .27, z, .34, .55, .34, 1, dark);
      brass.box(378.1, .54, z, .30, .075, .30);
      if (Math.abs(z + 260) < 115 || Math.abs(z + 110) < 40) lamps.push([378.1, .6, z]);
      if (Math.round((z - from) / 8) % 3 === 0) {
        fittings.box(376.9, .47, z, .62, .12, 2.3, 1, clay);
        fittings.box(377.15, .75, z, .13, .46, 2.3, 1, clay);
        for (const side of [-1, 1]) fittings.box(376.9, .25, z + side*.81, .42, .35, .14, 1, dark);
      }
    }
  }
  // Raised planters leave center and waterfront lanes clear. Their masonry stops bullets, not the foliage.
  for (const [x, z, w, d] of [[145.1,384.03,2.8,1.72],[152.8,390.1,3.05,1.82],[163,383.7,2.9,1.65],[184,389.7,3.3,1.85],[209,383.7,2.9,1.7],[235,390,3.0,1.85]]) {
    fittings.box(x,.48,z,w,.65,d,1,clay);
    fittings.box(x,.20,z,w+.08,.15,d+.09,1,dark);
    for (const s of [-1, 1]) {
      fittings.box(x,.80,z+s*d*.5,w+.19,.17,.19,1,top);
      fittings.box(x+s*w*.5,.80,z,.19,.17,d,1,top);
    }
    fittings.flat(x-w*.49,z-d*.49,x+w*.49,z+d*.49,.79,1,false,soil);
    for (let k = 0; k < 14; k++) {
      const px = x+(rnd()-.5)*w*.88, pz = z+(rnd()-.5)*d*.81;
      cylinder(.07,.18,.12+rnd()*.27,5,px,.87,pz,color(k%3===0 ? 0xcd6951 : k%2 ? 0x59824c : 0x3e6349));
    }
    city.palms.push([x, z, .52 + rnd()*.19, .74]);
    city.addCollider(x-w/2,z-d/2,x+w/2,z+d/2,.88,'planter');
  }
  for (let x = 141; x <= 231; x += 4.6) {
    cylinder(.10,.14,.8,10,x,.54,391.48,dark);
    brass.box(x,.93,391.48,.20,.055,.20);
    if (Math.round((x-141)/4.6)%4 === 0) lamps.push([x,1.04,391.48]);
  }
  const add = (bucket, mat) => {
    const m = new THREE.Mesh(bucket.build(), mat);
    m.receiveShadow = true;
    scene.add(m);
  };
  add(deck, new THREE.MeshStandardMaterial({ map: surfaceTexture('wood'), color: 0xcba888, roughness: .87 }));
  add(fittings, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .77 }));
  add(brass, new THREE.MeshStandardMaterial({ color: 0xffd1a2, emissive: 0xffac69, emissiveIntensity: 1.65 }));
  const material = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffac62, transparent: true, opacity: .49, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x,y,z] of lamps) {
    const s = new THREE.Sprite(material);
    s.position.set(x,y,z);
    s.scale.set(.85,.68,1);
    scene.add(s);
  }
}
