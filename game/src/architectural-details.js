// Silhouette-scale fixtures: striped canvas awnings and stacked Ocean Drive balconies.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';

export class ArchitecturalDetails {
  constructor() {
    this.fabric = new GeometryBucket(true);
    this.structure = new GeometryBucket(true);
    this.palettes = [[0x566d69,0xd4bb8c],[0x9f4335,0xeacb99],[0x304f60,0xe7d8bd],[0x38756f,0xd1dfb8]].map(list => list.map(c => new THREE.Color(c)));
    this.cream = new THREE.Color(0xc9b3a0);
    this.steel = new THREE.Color(0x40505c);
    this.glaze = new THREE.Color(0x436765);
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

  mount(scene) {
    const make = (bucket, side) => {
      const mesh = new THREE.Mesh(bucket.build(), new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side}));
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    };
    make(this.fabric, THREE.DoubleSide);
    make(this.structure, THREE.FrontSide);
  }
}
