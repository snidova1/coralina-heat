// Road wear is tied to world metres; junctions, lane ruts and repairs don't repeat with the aggregate map.
// Asphalt carries tyre tracks, oil drips, patched cuts, cracks and gutter puddles that mirror the sky;
// lane paint chips and fades; every pavement edge gets a jointed granite kerb and a concrete gutter pan.
import * as THREE from 'three';
import { GeometryBucket } from './geometry.js';
import { LINES, onRoad } from './map.js';
import { makeStream } from './rng.js';

const NOISE = `
  float chip(vec2 x) { return fract(52.9829189*fract(dot(x,vec2(.06711056,.00583715)))); }
  float aggregate(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(chip(i),chip(i+vec2(1,0)),f.x),mix(chip(i+vec2(0,1)),chip(i+1.0),f.x),f.y);
  }
`;

function worldPoint(shader, name) {
  shader.vertexShader = `varying vec2 ${name};\n` + shader.vertexShader.replace('#include <worldpos_vertex>',
    `#include <worldpos_vertex>\n${name} = (modelMatrix * vec4(transformed,1.0)).xz;`);
  shader.fragmentShader = `varying vec2 ${name};\n` + NOISE + shader.fragmentShader;
}

export function shadeAsphalt(material, scene) {
  const sky = { value: new THREE.Color(0x8a6a7a) };
  material.onBeforeCompile = shader => {
    // puddles mirror the sky at a glance: the fog carries the day cycle's horizon colour
    if (scene.fog) sky.value = scene.fog.color;
    shader.uniforms.puddleSky = sky;
    worldPoint(shader, 'asphaltPoint');
    shader.fragmentShader = 'uniform vec3 puddleSky;\n' + shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      vec2 p=asphaltPoint;
      vec2 axis=abs(mod(p+400.0,80.0)-40.0);
      float across=min(axis.x,axis.y);
      float along=axis.x<axis.y?p.y:p.x;
      float away=smoothstep(7.0,16.0,max(axis.x,axis.y));
      float blur=smoothstep(.012,.09,length(fwidth(p)));
      float ruts=(1.0-smoothstep(.13,.80,abs(abs(across-3.25)-.82)))*away;
      float drip=(1.0-smoothstep(.12,.42,abs(across-3.3)))*smoothstep(.42,.78,aggregate(vec2(along*.42,across*3.0)))*away;
      float water=aggregate(p*vec2(.31,.48))*.73+aggregate(p*.95)*.27;
      float damp=smoothstep(.68,.92,water)*.76;
      float edge=smoothstep(5.2,6.6,across)*away;
      float pool=aggregate(vec2(along*.21,across*.9)+7.3)*.8+aggregate(p*1.7)*.2;
      float puddle=smoothstep(.54,.66,pool)*(edge+ruts*.7);
      puddle=max(puddle,smoothstep(.8,.88,water)*.95);
      float grain=aggregate(p*76.0)*.67+aggregate(p*12.0)*.33;
      grain=mix(grain,.50,blur);
      float split=abs(fract(along*.196+aggregate(p*1.6)*.027)-.5);
      float seam=(1.0-smoothstep(.0015,.007+fwidth(along)*.06,split))*smoothstep(.44,.66,aggregate(p*.17));
      float cell=floor(along/11.0);
      float pick=chip(vec2(cell*7.1,floor(p.x/80.0+.5)+floor(p.y/80.0+.5)*3.0));
      float u=fract(along/11.0), a0=1.0+chip(vec2(cell,3.0))*2.5;
      float patchMask=step(.62,pick)*step(.12,u)*step(u,.12+.35+pick*.4)*step(a0,across)*step(across,a0+2.2+pick*1.8)*away;
      float crackField=abs(aggregate(p*.55+vec2(3.1,1.7))-.5)+abs(aggregate(p*2.3)-.5)*.35;
      float crack=(1.0-smoothstep(.006,.022+length(fwidth(p))*.05,crackField))*smoothstep(.5,.7,aggregate(p*.11))*(1.0-blur);
      vec3 tar=diffuseColor.rgb;
      diffuseColor.rgb *= (.89+grain*.31)*(1.0-.36*ruts-.43*seam-.24*damp-.3*drip-.22*edge-.5*crack);
      diffuseColor.rgb = mix(diffuseColor.rgb, tar*.62*(.94+grain*.12), patchMask);
      diffuseColor.rgb *= 1.0-.55*puddle;
      roughnessFactor = mix(mix(.91,.17,damp),.03,puddle);
      roughnessFactor = mix(roughnessFactor,.78,patchMask*(1.0-puddle));
    `).replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      float glance = pow(1.0 - abs(dot(upView, normalize(vViewPosition))), 3.0);
      totalEmissiveRadiance += mix(puddleSky, vec3(.5,.48,.56), .4) * .75 * glance * puddle;
    `);
  };
}

/** Lane paint wears where the wheels run and chips off in flakes. */
export function shadePaint(material) {
  material.onBeforeCompile = shader => {
    worldPoint(shader, 'paintPoint');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 q=paintPoint;
      float flake=aggregate(q*9.0)*.55+aggregate(q*31.0)*.45;
      float scuff=aggregate(q*vec2(1.3,1.3))*.6+aggregate(q*4.0)*.4;
      if (flake*.7+scuff*.5 > .93) discard;
      diffuseColor.rgb *= mix(1.0,.55,smoothstep(.45,.85,scuff))*(.9+flake*.15);
    `);
  };
}

function kerbTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const d = c.getContext('2d');
  const rnd = makeStream(941);
  d.fillStyle = '#cbc4b8';
  d.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 2600; i++) {
    d.fillStyle = rnd() < 0.5 ? 'rgba(255,250,240,0.16)' : 'rgba(40,34,30,0.13)';
    d.fillRect(rnd() * 256, rnd() * 32, 1 + rnd() * 2, 1);
  }
  for (let k = 0; k < 2; k++) {
    // two stones per texture, each with its own tone, worn arris and a dark joint
    d.fillStyle = `rgba(${k ? '70,60,50' : '255,245,230'},0.08)`;
    d.fillRect(k * 128, 0, 128, 32);
    d.fillStyle = '#5d564e';
    d.fillRect(k * 128, 0, 3, 32);
  }
  d.fillStyle = 'rgba(255,255,255,0.22)';
  d.fillRect(0, 0, 256, 3);
  d.fillStyle = 'rgba(30,25,20,0.25)';
  d.fillRect(0, 26, 256, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A jointed kerb along every pavement edge, and a concrete gutter pan wherever the edge meets a road. */
export function addKerbs(scene, slabs, roadY, curbY) {
  const kerb = new GeometryBucket(), gutter = new GeometryBucket();
  const band = 0.32, pan = 0.55, stone = 2;
  for (const [x0, z0, x1, z1] of slabs) {
    const edges = [[x0, z1, x1, z1, 0, 1], [x1, z1, x1, z0, 1, 0], [x1, z0, x0, z0, 0, -1], [x0, z0, x0, z1, -1, 0]];
    for (const [ax, az, bx, bz, nx, nz] of edges) {
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 1) continue;
      const u = length / stone;
      const inner = (x, z, k) => [x - nx * k, z - nz * k];
      const [ix, iz] = inner(ax, az, band), [jx, jz] = inner(bx, bz, band);
      kerb.quad([ax, curbY + 0.008, az], [bx, curbY + 0.008, bz], [jx, curbY + 0.008, jz], [ix, curbY + 0.008, iz], [0, 1], [u, 1], [u, 0.2], [0, 0.2]);
      const o = 0.012;
      kerb.quad([ax + nx * o, roadY - 0.01, az + nz * o], [bx + nx * o, roadY - 0.01, bz + nz * o], [bx + nx * o, curbY + 0.008, bz + nz * o], [ax + nx * o, curbY + 0.008, az + nz * o], [0, 0], [u, 0], [u, 0.2], [0, 0.2]);
      const mx = (ax + bx) / 2 + nx * 1.5, mz = (az + bz) / 2 + nz * 1.5;
      if (!onRoad(mx, mz)) continue;
      const ux = nx * pan, uz = nz * pan;
      gutter.quad([bx, roadY + 0.006, bz], [ax, roadY + 0.006, az], [ax + ux, roadY + 0.006, az + uz], [bx + ux, roadY + 0.006, bz + uz], [u * 2, 0.95], [0, 0.95], [0, 0.05], [u * 2, 0.05]);
    }
  }
  const map = kerbTexture();
  const kerbMesh = new THREE.Mesh(kerb.build(), new THREE.MeshStandardMaterial({ map, roughness: 0.82 }));
  const gutterMesh = new THREE.Mesh(gutter.build(), new THREE.MeshStandardMaterial({ map, color: 0x9c968f, roughness: 0.7 }));
  kerbMesh.receiveShadow = gutterMesh.receiveShadow = true;
  scene.add(kerbMesh, gutterMesh);
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
