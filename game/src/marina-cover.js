// Kingfish fish-market gear: real waist-high cover, with slats, insulated lids and warning paint.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';

export function buildMarinaCover(city) {
  const b = new GeometryBucket(true);
  const colors = new Map();
  const box = (x,y,z,w,h,d,n) => {
    if (!colors.has(n)) colors.set(n, new THREE.Color(n));
    b.box(x,y,z,w,h,d,2,colors.get(n));
  };
  for (const [x,z,w,d,h,color] of [
    [146.9,383.8,2.4,1.18,1.01,0x315c5c], [151.1,390.3,1.75,1.1,.84,0x6e4236],
    [158.9,384.3,2.3,1.25,1.06,0x59614d], [170,390,2,1.1,.86,0x315c5c],
    [176,385.1,2.25,1.23,1,0x6e4236], [195,390.3,2.3,1.1,.87,0x536750],
    [212,385.2,2.3,1.2,.92,0x705640], [235,390.6,2.3,1.1,1.04,0x315c5c],
  ]) {
    box(x,.17+h*.49,z,w,h*.91,d,color);
    box(x,.17+h,z,w+.10,.11,d+.09,0xa0a19a);
    for (let j=1;j<=4;j++) box(x,.18+h*j/5,z,w+.034,.038,d+.037,0x343c3a);
    for (const s of [-1,1]) {
      box(x+s*(w/2-.14),.17+h/2,z,.13,h,d+.051,0x9d937b);
      box(x,.26,z+s*(d/2),w,.12,.08,0x282f31);
      box(x,.17+h*.71,z+s*(d/2),.28,.11,.04,0xc7ae6d);
    }
    city.addCollider(x-w*.5,z-d*.5,x+w*.5,z+d*.5,.17+h,'cover');
  }
  const mesh = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .79 }));
  mesh.castShadow = mesh.receiveShadow = true;
  city.scene.add(mesh);
}
