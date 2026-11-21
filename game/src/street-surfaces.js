// Road wear is tied to world metres; junctions, lane ruts and repairs don't repeat with the aggregate map.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { LINES } from './map.js';
import { makeStream } from './rng.js';

export function shadeAsphalt(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 asphaltPoint;\n' + shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nasphaltPoint = (modelMatrix * vec4(transformed,1.0)).xz;');
    shader.fragmentShader = `varying vec2 asphaltPoint;
      float chip(vec2 x) { return fract(52.9829189*fract(dot(x,vec2(.06711056,.00583715)))); }
      float aggregate(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(chip(i),chip(i+vec2(1,0)),f.x),mix(chip(i+vec2(0,1)),chip(i+1.0),f.x),f.y);
      }
    ` + shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      vec2 p=asphaltPoint;
      vec2 axis=abs(mod(p+400.0,80.0)-40.0);
      float across=min(axis.x,axis.y);
      float along=axis.x<axis.y?p.y:p.x;
      float ruts=1.0-smoothstep(.13,.80,abs(abs(across-3.25)-.82));
      ruts *= smoothstep(7.0,16.0,max(axis.x,axis.y));
      float water=aggregate(p*vec2(.31,.48))*.73+aggregate(p*.95)*.27;
      float damp=smoothstep(.68,.92,water)*.76;
      float grain=aggregate(p*76.0)*.67+aggregate(p*12.0)*.33;
      grain=mix(grain,.50,smoothstep(.012,.09,length(fwidth(p))));
      float split=abs(fract(along*.196+aggregate(p*1.6)*.027)-.5);
      float seam=(1.0-smoothstep(.0015,.007+fwidth(along)*.06,split))*smoothstep(.44,.66,aggregate(p*.17));
      diffuseColor.rgb *= (.89+grain*.31)*(1.0-.25*ruts-.43*seam-.24*damp);
      roughnessFactor = mix(.91,.17,damp);
    `);
  };
}

export function addRoadHardware(scene) {
  const rnd = makeStream(687);
  const bucket = new GeometryBucket(true);
  const matrix = new THREE.Matrix4();
  const iron = new THREE.Color(0x35353b), edge = new THREE.Color(0x6c6356), recess = new THREE.Color(0x242328);
  const lid = new THREE.CylinderGeometry(.35,.36,.024,20);
  const collar = new THREE.CylinderGeometry(.414,.414,.013,20);
  for (const x of LINES) for (const z of LINES) {
    const px=x+(rnd()-.5)*9, pz=z+6+rnd()*4;
    bucket.addGeometry(collar,matrix.makeTranslation(px,.027,pz),edge);
    bucket.addGeometry(lid,matrix.makeTranslation(px,.035,pz),iron);
    for (let row=-3;row<=3;row++) {
      const half=Math.sqrt(.30*.30-(row*.078)**2);
      bucket.box(px,.043,pz+row*.078,half*2,.012,.018,1,edge);
    }
    for (const s of [-1,1]) {
      bucket.box(x+s*6.65,.032,z+18,.43,.02,.80,1,recess);
      for (let i=0;i<6;i++) bucket.box(x+s*6.65,.051,z+17.69+i*.124,.35,.018,.052,1,edge);
    }
  }
  lid.dispose(); collar.dispose();
  const hardware = new THREE.Mesh(bucket.build(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.28}));
  hardware.receiveShadow = true;
  scene.add(hardware);
}
