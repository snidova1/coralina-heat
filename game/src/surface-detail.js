// World-space material layers. Unlike decals, these stay continuous across road and beach seams.
import { BEACH, SEA_LEVEL } from './map.js';

const FIELD = /* glsl */ `
varying vec3 vSurface;
float fleck(vec2 p) {
  vec3 q = fract(p.xyx * vec3(.1031, .1030, .0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float field(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(fleck(i), fleck(i+vec2(1,0)), f.x),
             mix(fleck(i+vec2(0,1)), fleck(i+vec2(1,1)), f.x), f.y);
}
float stoneGrain(vec2 p, float freq) {
  return (fleck(floor(p*freq))-.5) * (1.0-smoothstep(.25,1.1,length(fwidth(p))*freq));
}
`;

function coat(material, name, declarations, paint, finish, uniforms = {}) {
  material.customProgramCacheKey = () => name;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vSurface;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vSurface = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = FIELD + declarations + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + paint)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + finish);
  };
}

export function weatherAsphalt(material) {
  coat(material, 'aged asphalt', '', /* glsl */ `
    vec2 p = vSurface.xz;
    vec2 axis = abs(mod(p + 40.0, 80.0) - 40.0);
    float across = min(axis.x, axis.y);
    float along = axis.x < axis.y ? p.y : p.x;
    float track = abs(across-2.25)-.60;
    float tire = exp(-5.0 * track * track);
    float grit = stoneGrain(p, 49.0);
    float stain = field(p*.25)*.67 + field(p*1.5)*.33;
    float joint = abs(fract((along+field(p*.66)*.45)/8.0)-.5)*8.0;
    float split = (1.0-smoothstep(.012,.048,joint)) * smoothstep(.26,.55,field(p*.17));
    float wetPatch = smoothstep(.71,.82,field(p*vec2(.8,.36))) * smoothstep(.52,.73,field(p*.29));
    diffuseColor.rgb *= (.92 + .27*stain + .50*grit - .16*tire - .30*split - .26*wetPatch);
  `, 'roughnessFactor = mix(roughnessFactor, .24, wetPatch);');
}

export function dressBeachSand(material, clock) {
  coat(material, 'tide-stained sand', 'uniform float coastTime;\n', /* glsl */ `
    vec2 p = vSurface.xz;
    float beach = step(${BEACH.x0.toFixed(1)},p.x);
    float grain = stoneGrain(p,57.0);
    float rake = sin(p.x*17.0 + p.y*4.2 + field(p*.42)*5.8);
    rake *= 1.0-smoothstep(.25,1.3,length(fwidth(p))*17.0);
    float tide = vSurface.y - ${SEA_LEVEL.toFixed(2)};
    tide += .10*sin(p.y*.23) + .058*sin(p.y*.84+coastTime*1.6);
    float damp = beach * (1.0-smoothstep(.018,.44,tide));
    float path = sin(p.y*.035)*1.6 + ${BEACH.x0.toFixed(1)};
    float walkRow = abs(mod(p.y, .79)-.395);
    float walkX = abs(p.x-path-5.1-.12*sign(sin(p.y*3.98)));
    float steps = (1.0-smoothstep(.6,1.0,length(vec2(walkX/.097,walkRow/.15)))) * smoothstep(.28,.47,field(p*.17));
    diffuseColor.rgb *= .74 + field(p*.44)*.23 + grain*.43 + rake*.053 - steps*.22;
    diffuseColor.rgb *= mix(vec3(1),vec3(.49,.40,.34),damp*.86);
  `, 'roughnessFactor = mix(roughnessFactor,.27,damp*.65);', { coastTime: clock });
}
