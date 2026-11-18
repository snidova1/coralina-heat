// Cars of Coralina Bay: the Vortice GT sports car, the Solace sedan, the Bayline Cab, the Mule
// pickup and the CBPD Interceptor with its light bar. Each body is extruded from a side profile,
// painted with clear-coat, and driven by one arcade model: throttle, brakes, drift and grip,
// crashes against buildings and other cars, damage, smoke, fire and explosions.
import * as THREE from 'three';
import { cloneModel, contactShadow } from './assets.js';
import { decalTexture, glowTexture } from './textures.js';
import { isLand, BEACH } from './map.js';
import { pick, rand } from './rng.js';

export const VEHICLE_TYPES = {
  sports: {
    label: 'Vortice GT', len: 4.5, wid: 1.96, wheelR: 0.36, wheelbase: 2.7, maxSpeed: 66, accel: 27, brake: 40, grip: 7.5, steer: 0.55, mass: 1.1,
    colors: [0xff2d3c, 0xffa400, 0x00b8d4, 0xf4f4f4, 0x8c2bff, 0x161616],
    body: [[-2.25, 0.32], [2.2, 0.3], [2.3, 0.48], [2.05, 0.68], [0.9, 0.84], [-1.5, 0.95], [-2.22, 0.92], [-2.3, 0.62]],
    cabin: [[0.95, 0.83], [-0.15, 1.2], [-0.95, 1.22], [-1.9, 0.93]],
  },
  sedan: {
    label: 'Solace LX', len: 4.6, wid: 1.9, wheelR: 0.37, wheelbase: 2.75, maxSpeed: 46, accel: 15, brake: 32, grip: 6.2, steer: 0.6, mass: 1.2,
    colors: [0xf4f1ea, 0x8fb8de, 0xe7c8a0, 0x7a8f6a, 0xb03a2e, 0x3c4a5a, 0xf7d7e0, 0x6fd3c4],
    body: [[-2.3, 0.33], [2.28, 0.33], [2.34, 0.72], [1.25, 0.93], [-1.85, 0.97], [-2.32, 0.94], [-2.38, 0.6]],
    cabin: [[1.3, 0.92], [0.45, 1.42], [-1.0, 1.45], [-1.85, 0.96]],
  },
  taxi: {
    label: 'Bayline Cab', len: 4.6, wid: 1.9, wheelR: 0.37, wheelbase: 2.75, maxSpeed: 48, accel: 16, brake: 32, grip: 6.2, steer: 0.6, mass: 1.2,
    colors: [0xffc414],
    body: [[-2.3, 0.33], [2.28, 0.33], [2.34, 0.72], [1.25, 0.93], [-1.85, 0.97], [-2.32, 0.94], [-2.38, 0.6]],
    cabin: [[1.3, 0.92], [0.45, 1.42], [-1.0, 1.45], [-1.85, 0.96]],
  },
  pickup: {
    label: 'Mule 2500', len: 5.3, wid: 2.05, wheelR: 0.45, wheelbase: 3.2, maxSpeed: 44, accel: 16, brake: 30, grip: 5.6, steer: 0.55, mass: 1.6,
    colors: [0x2f5d8a, 0x9a2b2b, 0xd9d4c7, 0x3d5a3d, 0x222222],
    body: [[-2.65, 0.5], [2.6, 0.5], [2.68, 1.02], [1.55, 1.16], [-2.65, 1.2]],
    cabin: [[1.5, 1.14], [0.85, 1.8], [-0.35, 1.82], [-0.45, 1.16]],
  },
  police: {
    label: 'CBPD Interceptor', len: 4.7, wid: 1.95, wheelR: 0.38, wheelbase: 2.8, maxSpeed: 60, accel: 23, brake: 40, grip: 7, steer: 0.58, mass: 1.35,
    colors: [0xf4f6f8],
    body: [[-2.35, 0.33], [2.32, 0.33], [2.38, 0.72], [1.3, 0.93], [-1.9, 0.97], [-2.36, 0.94], [-2.42, 0.6]],
    cabin: [[1.32, 0.92], [0.45, 1.42], [-1.0, 1.45], [-1.9, 0.96]],
  },
};

const paintCache = new Map();
function paint(color) {
  if (!paintCache.has(color)) {
    paintCache.set(color, new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }));
  }
  return paintCache.get(color);
}
const M = {};
function mats() {
  if (M.glass) return M;
  M.glass = new THREE.MeshStandardMaterial({ color: 0x0d1620, metalness: 0.9, roughness: 0.05 });
  M.tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  M.rim = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.9, roughness: 0.25 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.15 });
  M.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.5 });
  M.tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 });
  M.red = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1030, emissiveIntensity: 3, toneMapped: false });
  M.blue = new THREE.MeshStandardMaterial({ color: 0x000040, emissive: 0x1050ff, emissiveIntensity: 3, toneMapped: false });
  M.burnt = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1 });
  M.doorDecal = new THREE.MeshStandardMaterial({ map: decalTexture('BAY POLICE', '#f4f6f8', '#14244a', 512, 128, 'italic 900 70px "Arial Black", Impact, sans-serif'), roughness: 0.4, transparent: false });
  M.taxiSign = new THREE.MeshStandardMaterial({ map: decalTexture('BAYLINE', '#ffe14a', '#111111', 256, 64, 'bold 44px "Arial Black", sans-serif'), emissive: 0xffd040, emissiveIntensity: 0.4 });
  M.checker = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.4 });
  return M;
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const d = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { d.fillStyle = (i + j) % 2 ? '#111' : '#ffc414'; d.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const geoCache = new Map();
function profileGeometry(points, depth, bevel) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function buildModel(typeName, color) {
  const T = VEHICLE_TYPES[typeName];
  const assetName = { sports: 'car_sport', sedan: 'car_taxi', taxi: 'car_taxi', pickup: 'car_pickup', police: 'car_police' }[typeName];
  const asset = cloneModel(assetName, T.len, 'z', typeName === 'pickup' ? 0 : Math.PI / 2);
  if (asset) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const contact = contactShadow(T.wid * 1.25, T.len * 1.1);
    contact.position.y = 0.055;
    root.add(contact);
    body.add(asset);
    asset.position.y = 0.025;
    let shell;
    asset.traverse((o) => { if (o.isMesh && !shell) shell = o; });
    const extras = { strobes: [] };
    if (typeName === 'police') {
      const height = new THREE.Box3().setFromObject(asset).max.y;
      for (const side of [-1, 1]) {
        const material = new THREE.MeshStandardMaterial({ color: side < 0 ? 0xff2040 : 0x2266ff, emissive: side < 0 ? 0xff2040 : 0x2266ff, emissiveIntensity: 4, toneMapped: false });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), material);
        lamp.position.set(side * 0.4, height - 0.035, -0.1);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: material.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        glow.position.copy(lamp.position);
        glow.scale.setScalar(2.7);
        body.add(lamp, glow);
        extras.strobes.push({ lamp, glow, side });
      }
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x2266ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      spill.rotation.x = -Math.PI / 2;
      spill.position.y = 0.065;
      root.add(spill);
      extras.spill = spill;
    }
    root.userData.asset = assetName;
    return { root, body, shell, wheels: [], extras, beams: [], paintMat: shell.material };
  }
  const m = mats();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const key = typeName;
  if (!geoCache.has(key)) {
    geoCache.set(key, {
      body: profileGeometry(T.body, T.wid - 0.18, 0.09),
      cabin: profileGeometry(T.cabin.concat([[T.cabin[T.cabin.length - 1][0], T.cabin[0][1] - 0.02]]), T.wid * 0.74, 0.07),
      wheel: new THREE.CylinderGeometry(T.wheelR, T.wheelR, 0.27, 16).rotateZ(Math.PI / 2),
      rim: new THREE.CylinderGeometry(T.wheelR * 0.62, T.wheelR * 0.62, 0.29, 10).rotateZ(Math.PI / 2),
    });
  }
  const G = geoCache.get(key);
  const paintMat = paint(color);
  const shell = new THREE.Mesh(G.body, paintMat);
  shell.castShadow = true;
  body.add(shell);
  const cabin = new THREE.Mesh(G.cabin, m.glass);
  cabin.castShadow = true;
  body.add(cabin);
  // the roof skin over the glasshouse, in body colour
  const roofPts = T.cabin;
  const roofLen = Math.abs(roofPts[1][0] - roofPts[2][0]) + 0.3;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(T.wid * 0.7, 0.06, roofLen), paintMat);
  roof.position.set(0, Math.max(roofPts[1][1], roofPts[2][1]) + 0.05, (roofPts[1][0] + roofPts[2][0]) / 2);
  body.add(roof);
  const half = T.len / 2;
  const front = T.body[2][0];
  const lampY = T.body[2][1] + 0.05;
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), m.head);
    hl.position.set(s * (T.wid / 2 - 0.35), lampY, front - 0.02);
    body.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.08), m.tail);
    tl.position.set(s * (T.wid / 2 - 0.32), T.body[T.body.length - 2][1] - 0.15, -half - 0.1);
    body.add(tl);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), paintMat);
    mirror.position.set(s * (T.wid / 2), T.cabin[0][1] + 0.08, T.cabin[0][0] - 0.25);
    body.add(mirror);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(T.wid * 0.5, 0.12, 0.05), m.dark);
  grille.position.set(0, lampY - 0.15, front + 0.02);
  body.add(grille);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(T.wid - 0.1, 0.14, 0.12), typeName === 'pickup' ? m.chrome : m.dark);
  bumper.position.set(0, T.body[0][1] + 0.05, -half - 0.05);
  body.add(bumper);
  const wheels = [];
  const ax = T.wheelbase / 2;
  for (const [wx, wz, front] of [[-1, ax, true], [1, ax, true], [-1, -ax, false], [1, -ax, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx * (T.wid / 2 - 0.16), T.wheelR, wz);
    const spin = new THREE.Group();
    pivot.add(spin);
    const tire = new THREE.Mesh(G.wheel, m.tire);
    tire.castShadow = true;
    spin.add(tire);
    const rim = new THREE.Mesh(G.rim, m.rim);
    spin.add(rim);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, T.wheelR * 1.1, 0.08), m.dark);
    spin.add(spoke);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  const extras = { strobes: [], lightbar: null };
  if (typeName === 'police') {
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), m.doorDecal);
      door.position.set(s * (T.wid / 2 - 0.0), 0.62, 0.1);
      door.rotation.y = s * Math.PI / 2;
      body.add(door);
    }
    const hood = new THREE.Mesh(new THREE.BoxGeometry(T.wid * 0.86, 0.05, 1.1), paint(0x101318));
    hood.position.set(0, 0.96, 1.75);
    hood.rotation.x = 0.08;
    body.add(hood);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(T.wid * 0.86, 0.05, 0.6), paint(0x101318));
    trunk.position.set(0, 0.99, -2.05);
    body.add(trunk);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(T.wid + 0.02, 0.26, T.len * 0.92), paint(0x101318));
    skirt.position.set(0, 0.47, 0);
    body.add(skirt);
    // red and blue light spilling onto the road round the cruiser
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(9, 11), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff2040, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.y = 0.07;
    root.add(spill);
    extras.spill = spill;
    const barY = Math.max(T.cabin[1][1], T.cabin[2][1]) + 0.14;
    const barZ = (T.cabin[1][0] + T.cabin[2][0]) / 2 + 0.2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.3), m.dark);
    base.position.set(0, barY - 0.06, barZ);
    body.add(base);
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.26), s < 0 ? m.red : m.blue);
      lamp.position.set(s * 0.32, barY + 0.02, barZ);
      body.add(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: s < 0 ? 0xff2040 : 0x2a6aff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      glow.position.set(s * 0.45, barY + 0.1, barZ);
      glow.scale.setScalar(4.6);
      body.add(glow);
      extras.strobes.push({ glow, lamp, side: s });
    }
    const push = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.12), m.dark);
    push.position.set(0, 0.55, half + 0.08);
    body.add(push);
  }
  if (typeName === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 0.3), m.taxiSign);
    sign.position.set(0, Math.max(T.cabin[1][1], T.cabin[2][1]) + 0.18, (T.cabin[1][0] + T.cabin[2][0]) / 2);
    body.add(sign);
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.14), m.checker);
      strip.position.set(s * (T.wid / 2 - 0.0), 0.72, 0);
      strip.rotation.y = s * Math.PI / 2;
      body.add(strip);
    }
  }
  if (typeName === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(T.wid - 0.4, 0.5, 2.0), m.dark);
    bed.position.set(0, 1.0, -1.45);
    body.add(bed);
  }
  if (typeName === 'sports') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(T.wid * 0.9, 0.05, 0.32), m.dark);
    wing.position.set(0, 1.12, -half + 0.2);
    body.add(wing);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.15), m.dark);
      post.position.set(s * 0.6, 1.0, -half + 0.22);
      body.add(post);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 2.0), paint(0x111111));
      stripe.position.set(s * 0.18, 0.86, 1.3);
      stripe.rotation.x = -0.1;
      body.add(stripe);
    }
  }
  // headlight cones for dusk and night
  const beams = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0c8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
    g.position.set(s * (T.wid / 2 - 0.35), lampY, front + 0.2);
    g.scale.setScalar(1.1);
    body.add(g);
    beams.push(g);
  }
  return { root, body, wheels, extras, beams, shell, paintMat };
}

let nextId = 1;

export class Vehicle {
  constructor(game, type, x, z, heading, color) {
    this.game = game;
    this.id = nextId++;
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.color = color ?? pick(this.spec.colors);
    const model = buildModel(type, this.color);
    Object.assign(this, model);
    this.position = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.lateral = 0;
    this.steer = 0;
    this.yawRate = 0;
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.health = 100;
    this.driver = null; // 'player', or an AI brain object
    this.siren = false;
    this.burnTimer = -1;
    this.wrecked = false;
    this.radius = this.spec.wid * 0.55;
    this.lightsOn = false;
    this.skid = 0;
    this.roll = 0;
    this.pitch = 0;
    this.hornT = 0;
    game.scene.add(this.root);
    this.syncMesh(0);
  }

  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  get label() { return this.spec.label; }

  circles() {
    const f = this.forward;
    const off = this.spec.len * 0.27;
    return [
      { x: this.position.x + f.x * off, z: this.position.z + f.z * off },
      { x: this.position.x - f.x * off, z: this.position.z - f.z * off },
    ];
  }

  update(dt) {
    const T = this.spec;
    const c = this.wrecked ? { throttle: 0, steer: 0, handbrake: true } : this.controls;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = -fz;
    const rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vs = this.vx * rx + this.vz * rz;
    const dmg = this.health < 30 ? 0.75 : 1;
    if (c.throttle > 0) {
      if (vf < -0.5) vf = Math.min(0, vf + T.brake * dt);
      else vf += T.accel * c.throttle * dmg * Math.max(0, 1 - vf / T.maxSpeed) * dt * (vf < 8 ? 1.25 : 1);
    } else if (c.throttle < 0) {
      if (vf > 0.5) vf = Math.max(0, vf - T.brake * -c.throttle * dt);
      else vf = Math.max(-13, vf + T.accel * 0.55 * c.throttle * dt);
    }
    vf -= vf * 0.09 * dt + Math.sign(vf) * Math.min(Math.abs(vf), 0.8 * dt);
    if (c.handbrake) vf -= vf * 1.1 * dt;
    const steerTarget = c.steer * T.steer / (1 + Math.abs(vf) / 30);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    let yaw = (-vf / T.wheelbase) * Math.tan(this.steer);
    if (c.handbrake && Math.abs(vf) > 5) yaw *= 1.55;
    this.yawRate = yaw;
    this.heading += yaw * dt;
    const grip = c.handbrake ? 1.4 : T.grip;
    vs *= Math.exp(-grip * dt);
    this.skid = Math.abs(vs) > 3.5 || (c.handbrake && Math.abs(vf) > 8) ? 1 : 0;
    const nfx = Math.sin(this.heading);
    const nfz = Math.cos(this.heading);
    this.vx = nfx * vf + -nfz * vs;
    this.vz = nfz * vf + nfx * vs;
    this.speed = vf;
    this.lateral = vs;
    const px = this.position.x;
    const pz = this.position.z;
    this.position.x += this.vx * dt;
    this.position.z += this.vz * dt;
    this.collideWorld(px, pz);
    this.roll += ((vs * 0.012 + yaw * vf * 0.004) - this.roll) * Math.min(1, dt * 6);
    this.pitch += ((-(c.throttle > 0 ? 0.02 : c.throttle < 0 && vf > 1 ? -0.035 : 0)) - this.pitch) * Math.min(1, dt * 5);
    if (this.burnTimer >= 0 && !this.wrecked) {
      this.burnTimer -= dt;
      if (this.burnTimer < 0) this.explode();
    }
    this.syncMesh(dt);
  }

  collideWorld(px, pz) {
    const city = this.game.city;
    const f = this.forward;
    const off = this.spec.len * 0.27;
    let impact = 0;
    for (const s of [1, -1]) {
      const cx = this.position.x + f.x * off * s;
      const cz = this.position.z + f.z * off * s;
      const r = city.collideCircle(cx, cz, this.radius, 3);
      if (r.hit) {
        this.position.x += r.x - cx;
        this.position.z += r.z - cz;
        const vn = this.vx * r.nx + this.vz * r.nz;
        if (vn < 0) {
          this.vx -= vn * r.nx * 1.35;
          this.vz -= vn * r.nz * 1.35;
          impact = Math.max(impact, -vn);
        }
      }
    }
    if (!isLand(this.position.x + f.x * 2, this.position.z + f.z * 2) || !isLand(this.position.x, this.position.z)) {
      this.position.x = px;
      this.position.z = pz;
      impact = Math.max(impact, Math.hypot(this.vx, this.vz));
      this.vx *= -0.3;
      this.vz *= -0.3;
    }
    if (impact > 4) this.onImpact(impact, this.position.x + f.x * 2, this.position.z + f.z * 2);
  }

  onImpact(impact, x, z) {
    this.damage(impact * 0.9);
    const g = this.game;
    if (g.effects) g.effects.sparks(x, 0.6, z, Math.min(20, impact));
    if (g.audio && this.driver === 'player') g.audio.crash(Math.min(1, impact / 25));
    if (g.cameraRig && this.driver === 'player') g.cameraRig.shake(Math.min(0.6, impact / 40));
  }

  damage(amount) {
    if (this.wrecked) return;
    this.health -= amount;
    if (this.health <= 0 && this.burnTimer < 0) this.burnTimer = 3.5;
  }

  explode() {
    this.wrecked = true;
    this.health = 0;
    this.siren = false;
    this.shell.material = mats().burnt;
    const g = this.game;
    if (g.effects) g.effects.explosion(this.position.x, 1, this.position.z);
    if (g.audio) g.audio.explosion(this.position);
    if (g.combat) g.combat.explosionDamage(this.position, 8, this);
    this.vx *= 0.2;
    this.vz *= 0.2;
  }

  syncMesh(dt) {
    let y = 0;
    if (this.position.x > BEACH.x0) y = this.game.city.beachHeight(this.position.x);
    this.position.y = y;
    this.root.position.copy(this.position);
    this.root.rotation.set(0, this.heading, 0);
    // Wheels are authored into the GLB: keep chassis lean subtle so they stay on the road.
    const pitch = this.root.userData.asset ? THREE.MathUtils.clamp(this.pitch, -0.008, 0.008) : this.pitch;
    const roll = this.root.userData.asset ? THREE.MathUtils.clamp(this.roll, -0.018, 0.018) : this.roll;
    this.body.rotation.set(pitch, 0, roll);
    this.body.position.y = this.root.userData.asset ? Math.abs(Math.sin(pitch)) * this.spec.len / 2 + Math.abs(Math.sin(roll)) * this.spec.wid / 2 : 0;
    for (const w of this.wheels) {
      w.spin.rotation.x += (this.speed / this.spec.wheelR) * dt;
      if (w.front) w.pivot.rotation.y = -this.steer;
    }
    const t = this.game.time;
    for (const s of this.extras.strobes) {
      const phase = Math.floor(t * 7) % 2 === (s.side < 0 ? 0 : 1);
      const on = this.siren && (phase || Math.floor(t * 21) % 3 === 0);
      s.glow.visible = on;
      s.lamp.material.emissiveIntensity = on ? 4 : 0.3;
    }
    if (this.extras.spill) {
      const red = Math.floor(t * 7) % 2 === 0;
      this.extras.spill.visible = this.siren;
      this.extras.spill.material.color.set(red ? 0xff2040 : 0x2a60ff);
    }
    const night = this.game.day ? this.game.day.nightAmount : 0;
    for (const b of this.beams) {
      b.visible = !this.wrecked && night > 0.15;
      b.material.opacity = 0.25 + night * 0.6;
    }
    // the burning wreck
    if ((this.burnTimer >= 0 || this.health < 30) && this.game.effects && dt > 0) {
      const f = this.forward;
      this.smokeT = (this.smokeT || 0) - dt;
      if (this.smokeT <= 0) {
        this.smokeT = this.burnTimer >= 0 || this.wrecked ? 0.05 : 0.15;
        this.game.effects.smoke(this.position.x + f.x * 1.6, 1.1, this.position.z + f.z * 1.6, this.burnTimer >= 0 ? 'fire' : 'dark');
      }
    }
    if (this.skid && this.game.effects && dt > 0 && Math.abs(this.speed) > 4) {
      this.skidT = (this.skidT || 0) - dt;
      if (this.skidT <= 0) {
        this.skidT = 0.04;
        const f = this.forward;
        this.game.effects.tireSmoke(this.position.x - f.x * 1.6, this.position.z - f.z * 1.6);
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.root);
    // Authored mesh geometry/materials and contact shadows belong to the shared asset cache.
    // Only the per-cruiser lighting overlays are owned by this instance.
    if (this.root.userData.asset) {
      for (const { lamp, glow } of this.extras.strobes) {
        lamp.geometry.dispose();
        lamp.material.dispose();
        glow.material.dispose();
      }
      if (this.extras.spill) {
        this.extras.spill.geometry.dispose();
        this.extras.spill.material.dispose();
      }
    }
  }
}

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(type, x, z, heading, color) {
    const v = new Vehicle(this.game, type, x, z, heading, color);
    this.list.push(v);
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    v.dispose();
  }

  nearest(x, z, maxDist, filter = () => true) {
    let best = null;
    let bd = maxDist;
    for (const v of this.list) {
      if (!filter(v)) continue;
      const d = Math.hypot(v.position.x - x, v.position.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  update(dt) {
    for (const v of this.list) v.update(dt);
    this.resolveCarCollisions();
  }

  resolveCarCollisions() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        const dx0 = b.position.x - a.position.x;
        const dz0 = b.position.z - a.position.z;
        if (dx0 * dx0 + dz0 * dz0 > 49) continue;
        for (const ca of a.circles()) {
          for (const cb of b.circles()) {
            const dx = cb.x - ca.x;
            const dz = cb.z - ca.z;
            const d = Math.hypot(dx, dz);
            const min = a.radius + b.radius;
            if (d >= min || d < 1e-4) continue;
            const nx = dx / d;
            const nz = dz / d;
            const pen = min - d;
            const ma = a.spec.mass;
            const mb = b.spec.mass;
            const wa = mb / (ma + mb);
            const wb = ma / (ma + mb);
            a.position.x -= nx * pen * wa;
            a.position.z -= nz * pen * wa;
            b.position.x += nx * pen * wb;
            b.position.z += nz * pen * wb;
            const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (rel < 0) {
              const imp = -rel * 1.3;
              a.vx -= nx * imp * wa;
              a.vz -= nz * imp * wa;
              b.vx += nx * imp * wb;
              b.vz += nz * imp * wb;
              if (imp > 5) {
                a.damage(imp * 0.5);
                b.damage(imp * 0.5);
                if (this.game.effects) this.game.effects.sparks((ca.x + cb.x) / 2, 0.7, (ca.z + cb.z) / 2, Math.min(16, imp));
                if (this.game.audio && (a.driver === 'player' || b.driver === 'player')) this.game.audio.crash(Math.min(1, imp / 25));
                if (this.game.onCarHit) this.game.onCarHit(a, b, imp);
              }
            }
          }
        }
      }
    }
  }
}

export function randomTrafficType() {
  const r = rand();
  if (r < 0.45) return 'sedan';
  if (r < 0.65) return 'taxi';
  if (r < 0.85) return 'pickup';
  return 'sports';
}
