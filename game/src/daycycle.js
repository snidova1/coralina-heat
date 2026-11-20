// Time of day over Coralina Bay: the gradient sky dome with its sun and painted clouds, the sun and
// sky lights, fog, exposure, the reflection environment, and how lit the city is after dark.
import * as THREE from 'three';

const KEYS = [
  { h: 0, top: 0x0a1030, hor: 0x1c2450, sun: 0x8090c0, sunI: 0.15, hemi: 0.25, fog: 0x161c38, night: 1 },
  { h: 5.5, top: 0x1d2a5c, hor: 0xd88a7a, sun: 0xffa070, sunI: 0.5, hemi: 0.4, fog: 0x8a6a78, night: 0.7 },
  { h: 7.5, top: 0x3d7fd0, hor: 0xffd2a8, sun: 0xffe0b8, sunI: 2.2, hemi: 0.75, fog: 0xd8c4b0, night: 0.1 },
  { h: 12, top: 0x2f78d8, hor: 0xbfe0f4, sun: 0xfff6e8, sunI: 3.0, hemi: 0.9, fog: 0xbcd6e6, night: 0 },
  { h: 16.5, top: 0x2a6ad8, hor: 0xffd29a, sun: 0xffdca8, sunI: 3.4, hemi: 0.55, fog: 0xead0a4, night: 0 },
  { h: 18.4, top: 0x315d95, hor: 0xffbd85, sun: 0xffc18a, sunI: 3.0, hemi: 0.7, fog: 0xe8bc98, night: 0.25 },
  { h: 19.6, top: 0x24275e, hor: 0xe8607a, sun: 0xff7050, sunI: 0.9, hemi: 0.4, fog: 0x9a5a78, night: 0.7 },
  { h: 21, top: 0x0c1236, hor: 0x2a2a5a, sun: 0x8090c0, sunI: 0.2, hemi: 0.28, fog: 0x1e2244, night: 1 },
  { h: 24, top: 0x0a1030, hor: 0x1c2450, sun: 0x8090c0, sunI: 0.15, hemi: 0.25, fog: 0x161c38, night: 1 },
];

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float night;
uniform float sunset;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
vec3 sunsetSky(vec3 d, float sd) {
  float h = max(d.y, 0.0);
  vec3 col = mix(horizonColor, vec3(0.48, 0.044, 0.19), smoothstep(0.0, 0.35, h));
  col = mix(col, topColor, smoothstep(0.10, 0.62, h));
  col *= 0.72 + 0.28 * pow(sd, 4.0);
  vec2 p = d.xz / (h + 0.22);
  float bands = fbm(p * 3.5 + vec2(2.1, 8.2)) + 0.055 * sin(h * 55.0 + p.x);
  float detail = fbm(p * 9.0 + vec2(8.4, 1.5));
  float body = smoothstep(0.47, 0.66, bands + 0.14 * detail);
  float rim = smoothstep(0.43, 0.54, bands + 0.14 * detail) * (1.0 - body);
  float cloud = smoothstep(0.01, 0.08, h);
  vec3 lit = mix(vec3(0.46, 0.087, 0.24), vec3(1.13, 0.32, 0.095), pow(sd, 22.0));
  col = mix(col, lit, rim * cloud * 0.71);
  col = mix(col, vec3(0.11, 0.026, 0.15) + lit * 0.16, body * cloud * 0.86);
  col += sunColor * (0.20 * pow(sd, 36.0) + 0.84 * pow(sd, 590.0));
  col += vec3(3.5, 2.1, 0.8) * smoothstep(0.99979, 0.99988, sd);
  return col * mix(0.43, 1.0, smoothstep(-0.12, 0.0, d.y));
}
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.55));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * pow(sd, 6.0) * 0.55;
  col += sunColor * pow(sd, 64.0) * 0.8;
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9994, 0.9997, sd) * 3.0;
  // streaky evening clouds lit from the sun side
  vec2 cp = d.xz / max(d.y + 0.12, 0.05);
  float c = fbm(cp * vec2(0.45, 1.6) + vec2(3.0, 1.0));
  c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.25, d.y) * (1.0 - smoothstep(0.55, 0.9, d.y));
  vec3 cloudCol = mix(horizonColor * 1.15, sunColor * 1.3, pow(sd, 3.0)) + vec3(0.08);
  col = mix(col, cloudCol, c * 0.75);
  // stars after dark
  float st = step(0.9985, hash(floor(d.xz / max(d.y, 0.1) * 300.0))) * night * smoothstep(0.1, 0.4, d.y);
  col += vec3(st);
  if (d.y < 0.0) col = mix(horizonColor, horizonColor * 0.6, clamp(-d.y * 4.0, 0.0, 1.0));
  if (sunset > 0.5) col = sunsetSky(d, sd);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class DayCycle {
  constructor(game) {
    this.game = game;
    this.hour = 18.3;
    this.speed = 1 / 60; // game hours per real second
    this.frozen = false;
    const scene = game.scene;
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      night: { value: 0 },
      sunset: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -65; sc.right = 65; sc.top = 65; sc.bottom = -65; sc.near = 10; sc.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0xb08a60, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xf0a878, 0.0011);

    // the reflection environment is the sky alone, re-baked as the hour changes
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(game.renderer);
    this.envTarget = null;
    this.lastEnvHour = -10;
    this.tmp = new THREE.Color();
    this.apply();
  }

  setHour(h) {
    this.hour = ((h % 24) + 24) % 24;
    this.apply();
  }

  sample(key) {
    const h = this.hour;
    let a = KEYS[0];
    let b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const t = (h - a.h) / Math.max(0.001, b.h - a.h);
    if (typeof a[key] === 'number' && key !== 'top' && key !== 'hor' && key !== 'sun' && key !== 'fog') return a[key] + (b[key] - a[key]) * t;
    return new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), t);
  }

  get nightAmount() { return this.sample('night'); }

  apply() {
    const u = this.uniforms;
    u.topColor.value.copy(this.sample('top'));
    u.horizonColor.value.copy(this.sample('hor'));
    u.sunColor.value.copy(this.sample('sun'));
    u.night.value = this.nightAmount;
    // the sun rises in the east (+x) and sets over the mainland in the west (-x), a little south
    const ang = ((this.hour - 6.5) / 13) * Math.PI;
    const elev = Math.sin(ang);
    const dir = new THREE.Vector3(Math.cos(ang), Math.max(elev, -0.3) * 0.95, 0.35).normalize();
    u.sunDir.value.copy(dir);
    const lightDir = dir.y < 0.05 ? new THREE.Vector3(-dir.x, 0.6, -dir.z).normalize() : dir;
    this.sunDirection = lightDir;
    this.sun.color.copy(this.sample('sun'));
    this.sun.intensity = this.sample('sunI');
    this.hemi.intensity = this.sample('hemi');
    this.hemi.color.copy(u.horizonColor.value).lerp(u.topColor.value, 0.45).lerp(new THREE.Color(0xffffff), 0.35);
    this.hemi.groundColor.set(0xa07850).lerp(u.horizonColor.value, 0.3);
    const fog = this.sample('fog');
    this.game.scene.fog.color.copy(fog);
    const night = this.nightAmount;
    if (this.game.city) this.game.city.setNight(night);
    if (this.game.roads) this.game.roads.setNight(night);
    if (Math.abs(this.hour - this.lastEnvHour) > 0.35) this.bakeEnvironment();
  }

  bakeEnvironment() {
    this.lastEnvHour = this.hour;
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.02);
    this.game.scene.environment = this.envTarget.texture;
    this.game.scene.environmentIntensity = 0.35 + (1 - this.nightAmount) * 0.3;
  }

  /** Keep the sky centred on the camera and the shadow box over what the camera sees. */
  update(dt, focus) {
    if (!this.frozen) {
      this.hour = (this.hour + dt * this.speed) % 24;
      this.applyTimer = (this.applyTimer || 0) + dt;
      if (this.applyTimer > 0.5) { this.applyTimer = 0; this.apply(); }
    }
    this.sky.position.copy(this.game.camera.position);
    const d = this.sunDirection;
    this.sun.target.position.copy(focus);
    this.sun.position.set(focus.x + d.x * 400, focus.y + d.y * 400, focus.z + d.z * 400);
    // snap the shadow box to texels so shadows do not shimmer as the camera moves
    this.sun.target.updateMatrixWorld();
  }
}
