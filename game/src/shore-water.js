// The bay shares the live sky's sun. A shallow jade shelf and breaking wave trains follow the shore.
import { BEACH, CANAL, ISLAND, SEA_LEVEL } from './map.js';

const shoreX = BEACH.x0 + (BEACH.x1 + 40 - BEACH.x0) * Math.sqrt((0.12 - SEA_LEVEL) / 3.4);

export function waterLighting(material, sky, clock) {
  material.customProgramCacheKey = () => 'coralina tide and glitter';
  material.onBeforeCompile = shader => {
    shader.uniforms.coastSun = sky.sunDir;
    shader.uniforms.coastTint = sky.horizonColor;
    shader.uniforms.coastGlow = sky.sunColor;
    shader.uniforms.coastNight = sky.night;
    shader.uniforms.coastTime = clock;
    shader.vertexShader = 'varying vec3 vBay;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vBay = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = /* glsl */ `
      varying vec3 vBay;
      uniform vec3 coastSun, coastTint, coastGlow;
      uniform float coastTime, coastNight;
      float lace(vec2 p) {
        return sin(p.x*6.13+p.y*2.71) * .46 + cos(p.y*8.21-p.x*1.26) * .26
          + sin(p.x*17.3+p.y*13.4) * .19 + sin(p.x*27.2-p.y*19.1) * .09;
      }
    ` + shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      vec3 eye = normalize(cameraPosition-vBay);
      vec2 p = vBay.xz;
      float t = coastTime;
      float crest = p.x - ${shoreX.toFixed(3)} + .61*sin(p.y*.17) + .34*cos(p.y*.52);
      float coast = step(${ISLAND.minZ - 29}.0,p.y) * (1.0-step(${ISLAND.maxZ + 39}.0,p.y))
        * (1.0-step(${CANAL.zMin}.0,p.y)*(1.0-step(${CANAL.zMax}.0,p.y)));
      float shelf = coast * (1.0-smoothstep(0.0,28.0,abs(crest)));
      vec2 ripple = vec2(sin(p.x*.77+p.y*1.38-t*.9),cos(p.x*1.47-p.y*.82+t*.73));
      ripple += .53*vec2(cos(p.y*3.28+p.x*.42+t*.45),sin(p.x*2.45+p.y*1.65-t*.8));
      vec3 reflected = reflect(-eye, normalize(vec3(ripple.x*.064,1.0,ripple.y*.051)));
      float alongSun = max(dot(reflected,coastSun),0.0);
      float sparkle = pow(alongSun,1260.0) * (1.0-smoothstep(.5,3.0,length(fwidth(p))));
      float fresnel = pow(1.0-clamp(eye.y,0.0,1.0),4.0);
      float band = cos(crest*2.6 + t*1.29 + .4*sin(p.y*1.27));
      float lacing = lace(p + vec2(t*.11,0));
      float wash = smoothstep(.79,.996,band + lacing*.12) * smoothstep(.0,.65,lacing+.42);
      wash *= 1.0-smoothstep(.65,2.5,length(fwidth(p)));
      float swash = (1.0-smoothstep(.08,.62,abs(crest+.24*sin(t*1.5)))) * (.50+.54*lacing);
      float day = 1.0-coastNight*.82;
      outgoingLight = mix(outgoingLight,vec3(.045,.24,.208)*day, shelf*.78);
      outgoingLight = mix(outgoingLight,coastTint*.31+vec3(.017,.038,.067),fresnel*(.82-shelf*.28));
      outgoingLight += coastGlow*(pow(alongSun,77.0)*.29 + pow(alongSun,370.0)*.21 + sparkle*1.48)*day;
      outgoingLight = mix(outgoingLight,vec3(.68,.76,.70)*day,max(wash*shelf*shelf*.63,swash*coast*.81));
      #include <opaque_fragment>
    `);
  };
  material.needsUpdate = true;
}
