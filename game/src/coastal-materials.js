// Continuous world-space shore materials. Waves and foam use the same tidal line as the sand.
import * as THREE from 'three';
import { BEACH, ISLAND, SEA_LEVEL } from './map.js';

const tideline = BEACH.x0 + (BEACH.x1 + 40 - BEACH.x0) * Math.sqrt((0.12 - SEA_LEVEL) / 3.4);
const field = `
  varying vec3 coastPoint;
  float coastHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float coastNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(coastHash(i), coastHash(i+vec2(1,0)), f.x),
               mix(coastHash(i+vec2(0,1)), coastHash(i+1.0), f.x), f.y);
  }
`;

function worldField(shader) {
  shader.vertexShader = 'varying vec3 coastPoint;\n' + shader.vertexShader.replace('#include <worldpos_vertex>',
    '#include <worldpos_vertex>\ncoastPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = field + shader.fragmentShader;
}

export function shadeSand(material) {
  material.onBeforeCompile = shader => {
    worldField(shader);
    shader.uniforms.coastLine = { value: tideline };
    shader.fragmentShader = 'uniform float coastLine;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 p = coastPoint.xz;
      float drift = coastNoise(p*.12)*.65 + coastNoise(p*.65)*.35;
      float ripple = sin(p.x*12.0 + 1.4*sin(p.y*1.4) + drift*5.8);
      ripple *= 1.0-smoothstep(.05,.85,length(fwidth(p)));
      float wet = smoothstep(coastLine - 7.0, coastLine - .5, p.x + (drift-.5)*4.0);
      diffuseColor.rgb *= mix(vec3(.81,.66,.51), vec3(.36,.25,.21), wet);
      diffuseColor.rgb *= .85 + .28*drift + .10*ripple;
    `);
  };
}

export function shadeWater(material, scene) {
  const clock = { value: 0 };
  const sun = { value: new THREE.Vector3(-.5, .14, .86) };
  const amber = { value: new THREE.Color(0xffa572) };
  material.userData.setCoastSky = sky => { sun.value = sky.sunDir.value; amber.value = sky.sunColor.value; };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { coastClock: clock, coastSun: sun, coastAmber: amber, coastLine: { value: tideline }, coastBounds: { value: new THREE.Vector2(ISLAND.minZ, ISLAND.maxZ) }, coastFog: { value: scene.fog.color } });
    worldField(shader);
    shader.fragmentShader = `uniform float coastClock, coastLine;
      uniform vec2 coastBounds;
      uniform vec3 coastSun, coastAmber, coastFog;
    ` + shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 eye = normalize(cameraPosition - coastPoint);
      vec2 p = coastPoint.xz;
      float t = coastClock;
      float broad = coastNoise(p*vec2(.16,.23)+vec2(t*.23,0.0));
      float chop = coastNoise(p*vec2(1.8,.74)-vec2(t*.51,t*.12));
      vec2 n = vec2(sin(.74*p.x + p.y*.30 + t*1.8), cos(.63*p.x - p.y*1.24 - t*1.3));
      n += .42*vec2(cos(p.x*2.68 + p.y*.84), sin(p.x*2.45 - p.y*1.65 + t));
      n += vec2(broad-.5,chop-.5)*1.32;
      vec3 refl = reflect(-eye, normalize(vec3(.072*n.x,1.0,.052*n.y)));
      float fresnel = pow(1.0-max(eye.y,0.0),4.3);
      float sd = max(dot(refl,coastSun),0.0);
      float shine = .37*pow(sd,92.0) + 1.8*pow(sd,900.0)*(.25+chop);
      float depth = p.x - coastLine;
      float along = smoothstep(coastBounds.x,coastBounds.x+27.0,p.y)*(1.0-smoothstep(coastBounds.y-25.0,coastBounds.y,p.y));
      along *= 1.0-(smoothstep(10.0,24.0,p.y)*(1.0-smoothstep(56.0,72.0,p.y)));
      float shallows = along * smoothstep(-.8,.3,depth)*(1.0-smoothstep(2.0,28.0,depth));
      vec3 ocean = mix(vec3(.012,.067,.087),vec3(.045,.18,.163),shallows);
      ocean *= .76+.43*broad+.13*chop;
      vec3 sky = mix(coastFog*.53,vec3(.10,.095,.166),.48);
      ocean = mix(ocean,sky,fresnel*.76);
      ocean += coastAmber * shine * (.28+.72*fresnel);
      float wave = depth + sin(p.y*.198)*.85 + (broad-.5)*1.8;
      float width = max(.17, fwidth(wave));
      float lip = 1.0-smoothstep(.17,.35+width,abs(wave - 1.2 - sin(t*.92)*.95));
      float broken = 1.0-smoothstep(.13,.44+width,abs(wave - 5.7 + sin(p.y*.18+t)*1.9));
      float foam = along*(lip*(.53+.47*chop)+broken*smoothstep(.37,.73,broad)*.62);
      outgoingLight = mix(ocean + outgoingLight*.20, vec3(.68,.77,.69), foam*.76*(1.0-smoothstep(.8,2.6,width)));
      #include <opaque_fragment>
    `);
  };
  return clock;
}
