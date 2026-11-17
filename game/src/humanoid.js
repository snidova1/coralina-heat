// Stylised low-poly people built from shaped geometry (a lathed torso, capsule limbs, a sculpted
// head with hair), jointed at hips, knees, shoulders and elbows, with walk, run, aim, punch,
// cower and fall poses. Everyone in Coralina Bay, the player included, is one of these.
import * as THREE from 'three';
import { rand, pick } from './rng.js';

const matCache = new Map();
function mat(color, rough = 0.75, metal = 0) {
  const key = color + ':' + rough + ':' + metal;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(key);
}

const G = {};
function geos() {
  if (G.torso) return G;
  const prof = [[0.0, 0], [0.135, 0], [0.15, 0.08], [0.14, 0.2], [0.155, 0.33], [0.195, 0.47], [0.2, 0.53], [0.14, 0.59], [0.06, 0.62]].map(([r, y]) => new THREE.Vector2(r, y));
  G.torso = new THREE.LatheGeometry(prof, 12).scale(1, 1, 0.62);
  const skirt = [[0.0, 0], [0.24, -0.02], [0.17, 0.2], [0.14, 0.24]].map(([r, y]) => new THREE.Vector2(r, y));
  G.skirt = new THREE.LatheGeometry(skirt, 12).scale(1, 1, 0.75).translate(0, -0.28, 0);
  G.pelvis = new THREE.SphereGeometry(0.16, 12, 8).scale(1, 0.62, 0.72);
  G.neck = new THREE.CylinderGeometry(0.048, 0.055, 0.12, 8);
  G.head = new THREE.SphereGeometry(0.115, 14, 12).scale(0.9, 1.08, 1);
  G.jaw = new THREE.SphereGeometry(0.085, 10, 8).scale(1, 0.8, 1.05).translate(0, -0.06, 0.02);
  G.nose = new THREE.ConeGeometry(0.018, 0.05, 5).rotateX(Math.PI / 2).translate(0, -0.01, 0.115);
  G.eye = new THREE.SphereGeometry(0.014, 6, 5);
  G.hairShort = new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.95, 1.05, 1.05).translate(0, 0.012, -0.008);
  G.hairLong = new THREE.CapsuleGeometry(0.12, 0.16, 4, 10).scale(1, 1, 0.9).translate(0, -0.05, -0.04);
  G.cap = new THREE.CylinderGeometry(0.125, 0.128, 0.07, 14).translate(0, 0.08, 0);
  G.brim = new THREE.CylinderGeometry(0.0, 0.11, 0.015, 14, 1, false, -Math.PI / 2, Math.PI).translate(0, 0.05, 0.1);
  G.upperArm = new THREE.CapsuleGeometry(0.052, 0.2, 4, 8).translate(0, -0.13, 0);
  G.foreArm = new THREE.CapsuleGeometry(0.045, 0.2, 4, 8).translate(0, -0.12, 0);
  G.hand = new THREE.SphereGeometry(0.05, 8, 6).scale(0.8, 1.1, 0.6).translate(0, -0.27, 0);
  G.thigh = new THREE.CapsuleGeometry(0.078, 0.3, 4, 8).translate(0, -0.2, 0);
  G.shin = new THREE.CapsuleGeometry(0.062, 0.3, 4, 8).translate(0, -0.2, 0);
  G.foot = new THREE.CapsuleGeometry(0.048, 0.14, 4, 8).rotateX(Math.PI / 2).translate(0, -0.42, 0.05);
  G.vest = new THREE.CylinderGeometry(0.19, 0.17, 0.34, 10).scale(1, 1, 0.7).translate(0, 0.33, 0);
  G.gunBody = new THREE.BoxGeometry(0.035, 0.05, 0.2);
  G.gunGrip = new THREE.BoxGeometry(0.03, 0.1, 0.045).rotateX(0.25);
  G.belt = new THREE.CylinderGeometry(0.155, 0.155, 0.05, 12).scale(1, 1, 0.66).translate(0, 0.02, 0);
  return G;
}

const SKIN = [0xf1c7a3, 0xd9a07a, 0xb57a52, 0x8a5536, 0x5e3a24, 0xe8b590];
const HAIR = [0x1d1410, 0x3a2416, 0x6b4423, 0xc89a5a, 0x111111, 0x8a8a8a, 0xb0472b];
const SHIRTS = [0xff6f61, 0x2ec4b6, 0xffd166, 0xf7f7f2, 0x7b68ee, 0xff9f1c, 0x48a9f0, 0xef476f, 0x06d6a0, 0xf3a6c8, 0x264653];
const PANTS = [0x2b3a55, 0x3c3c3c, 0xd8c8a8, 0xeeeeee, 0x4a6a8a, 0x6b4f3a, 0x1f1f1f];

export function randomLook(kind = 'civilian') {
  const look = {
    skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick([0x222222, 0xffffff, 0x8a5a3a, 0xd04040]),
    build: 0.9 + rand() * 0.22, height: 0.94 + rand() * 0.12, longHair: rand() < 0.4, shorts: rand() < 0.35, skirt: rand() < 0.15, cap: rand() < 0.15, capColor: pick(SHIRTS), vest: false,
  };
  if (kind === 'cop') Object.assign(look, { shirt: 0x24365e, pants: 0x1c2741, shoes: 0x111111, cap: true, capColor: 0x1c2741, shorts: false, skirt: false, longHair: false, vest: true, vestColor: 0x2a2f36 });
  if (kind === 'thug') Object.assign(look, { shirt: pick([0x14b8a6, 0x0f766e, 0x111111]), pants: pick([0x1f1f1f, 0x2b3a55]), cap: rand() < 0.6, capColor: 0xd7263d, shorts: false, skirt: false, longHair: false, build: 1.08 });
  if (kind === 'player') Object.assign(look, { skin: 0xc98b62, hair: 0x1a120c, shirt: 0xf6f1e4, pants: 0x3a4a63, shoes: 0x6b3d24, longHair: false, shorts: false, skirt: false, cap: false, build: 1.05, height: 1.02, vest: false, vestColor: 0x34404c });
  if (kind === 'boss') Object.assign(look, { shirt: 0xf2f2f2, pants: 0xf2f2f2, shoes: 0xf2f2f2, cap: false, build: 1.18, height: 1.05, shorts: false, skirt: false, hair: 0x111111 });
  return look;
}

export class Humanoid {
  constructor(look = randomLook()) {
    const g = geos();
    this.look = look;
    this.root = new THREE.Group();
    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.root.add(this.hips);
    const skin = mat(look.skin, 0.6);
    const shirt = mat(look.shirt, 0.8);
    const pants = mat(look.pants, 0.85);
    const shoes = mat(look.shoes, 0.5);
    const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    add(this.hips, g.pelvis, pants);
    this.chest = new THREE.Group();
    this.chest.position.y = 0.02;
    this.hips.add(this.chest);
    const torso = add(this.chest, g.torso, shirt);
    torso.scale.set(look.build, 1, look.build);
    add(this.chest, g.belt, mat(0x2a2018, 0.6));
    if (look.vest) add(this.chest, g.vest, mat(look.vestColor || 0x2a2f36, 0.7)).scale.set(look.build * 1.02, 1, look.build * 1.05);
    if (look.skirt) add(this.hips, g.skirt, pants);
    add(this.chest, g.neck, skin, 0, 0.65, 0);
    this.head = new THREE.Group();
    this.head.position.y = 0.79;
    this.chest.add(this.head);
    add(this.head, g.head, skin);
    add(this.head, g.jaw, skin);
    add(this.head, g.nose, skin);
    const eyeMat = mat(0x111111, 0.3);
    add(this.head, g.eye, eyeMat, -0.04, 0.015, 0.1);
    add(this.head, g.eye, eyeMat, 0.04, 0.015, 0.1);
    add(this.head, g.hairShort, mat(look.hair, 0.9));
    if (look.longHair) add(this.head, g.hairLong, mat(look.hair, 0.9));
    if (look.cap) {
      add(this.head, g.cap, mat(look.capColor, 0.7));
      add(this.head, g.brim, mat(look.capColor, 0.7));
    }
    const sw = 0.2 * look.build;
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * sw, 0.52, 0);
      this.chest.add(shoulder);
      add(shoulder, g.upperArm, shirt);
      const elbow = new THREE.Group();
      elbow.position.y = -0.27;
      shoulder.add(elbow);
      add(elbow, g.foreArm, skin);
      add(elbow, g.hand, skin);
      shoulder.rotation.z = s * 0.08;
      return { shoulder, elbow };
    });
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.09, -0.02, 0);
      this.hips.add(hip);
      add(hip, g.thigh, pants);
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      hip.add(knee);
      add(knee, g.shin, look.shorts || look.skirt ? skin : pants);
      add(knee, g.foot, shoes);
      return { hip, knee };
    });
    // a pistol carried in the right hand, shown when armed
    this.gun = new THREE.Group();
    const gm = mat(0x1d1f22, 0.35, 0.7);
    add(this.gun, g.gunBody, gm, 0, 0.02, 0.06);
    add(this.gun, g.gunGrip, gm, 0, -0.04, -0.01);
    this.gun.position.set(0, -0.3, 0.03);
    this.gun.scale.setScalar(1.35);
    this.arms[1].elbow.add(this.gun);
    this.gun.visible = false;
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.02, 0.18);
    this.gun.add(this.muzzle);
    this.root.scale.setScalar(look.height);

    this.speed = 0;
    this.phase = rand() * 6.28;
    this.pose = 'move';
    this.punchT = 0;
    this.deadT = 0;
    this.recoil = 0;
  }

  setArmed(on) { this.gun.visible = on; }

  punch() { this.punchT = 0.35; }

  fireRecoil() { this.recoil = 1; }

  /** Advance the animation; speed is ground speed in m/s. */
  update(dt) {
    const [L, R] = this.legs;
    const [AL, AR] = this.arms;
    if (this.pose === 'dead') {
      this.deadT = Math.min(1, this.deadT + dt * 2.4);
      const t = 1 - Math.pow(1 - this.deadT, 3);
      this.hips.rotation.x = -t * 1.45;
      this.hips.position.y = 0.95 - t * 0.78;
      L.hip.rotation.x = -t * 0.2;
      R.hip.rotation.x = -t * 0.5;
      AL.shoulder.rotation.x = -t * 2.6;
      AR.shoulder.rotation.x = -t * 1.8;
      AL.shoulder.rotation.z = -0.6 * t;
      AR.shoulder.rotation.z = 0.6 * t;
      return;
    }
    const amp = Math.min(1, this.speed / 5.5);
    this.phase += dt * (2.2 + this.speed * 1.55);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const run = Math.max(0, (this.speed - 3) / 4);
    L.hip.rotation.x = -s * (0.25 + 0.45 * amp) * Math.min(1, this.speed * 2);
    R.hip.rotation.x = s * (0.25 + 0.45 * amp) * Math.min(1, this.speed * 2);
    L.knee.rotation.x = Math.max(0, c) * (0.3 + run * 0.9) * Math.min(1, this.speed);
    R.knee.rotation.x = Math.max(0, -c) * (0.3 + run * 0.9) * Math.min(1, this.speed);
    this.hips.position.y = 0.95 + Math.abs(s) * 0.035 * amp - run * 0.04;
    this.hips.rotation.x = run * 0.12;
    this.chest.rotation.y = s * 0.08 * amp;
    const swing = (0.15 + 0.5 * amp) * Math.min(1, this.speed * 2 + 0.05);
    AL.shoulder.rotation.x = s * swing;
    AR.shoulder.rotation.x = -s * swing;
    AL.elbow.rotation.x = -0.2 - run * 1.1;
    AR.elbow.rotation.x = -0.2 - run * 1.1;
    AL.shoulder.rotation.z = -0.08;
    AR.shoulder.rotation.z = 0.08;
    this.head.rotation.x = 0;
    if (this.speed < 0.1) {
      // idle breathing
      this.chest.rotation.x = Math.sin(this.phase * 0.5) * 0.015;
    }
    if (this.pose === 'aim') {
      this.recoil = Math.max(0, this.recoil - dt * 8);
      AR.shoulder.rotation.x = -Math.PI / 2 + this.aimPitch - this.recoil * 0.35;
      AR.shoulder.rotation.z = 0.05;
      AR.elbow.rotation.x = 0;
      AL.shoulder.rotation.x = -Math.PI / 2 + 0.25 + this.aimPitch;
      AL.shoulder.rotation.z = -0.55;
      AL.elbow.rotation.x = -0.35;
      this.chest.rotation.y = -0.15;
    } else if (this.pose === 'cower') {
      AL.shoulder.rotation.x = AR.shoulder.rotation.x = -2.4;
      AL.elbow.rotation.x = AR.elbow.rotation.x = -1.6;
      this.hips.position.y = 0.6;
      L.hip.rotation.x = R.hip.rotation.x = -1.3;
      L.knee.rotation.x = R.knee.rotation.x = 2.2;
    } else if (this.pose === 'surrender') {
      AL.shoulder.rotation.x = AR.shoulder.rotation.x = Math.PI;
      AL.elbow.rotation.x = AR.elbow.rotation.x = -0.4;
    }
    if (this.punchT > 0) {
      this.punchT -= dt;
      const t = 1 - Math.abs(this.punchT / 0.35 - 0.5) * 2;
      AR.shoulder.rotation.x = -1.5 * t - 0.2;
      AR.elbow.rotation.x = -1.6 * (1 - t);
      this.chest.rotation.y = -0.5 * t;
      AL.shoulder.rotation.x = -1.2;
      AL.elbow.rotation.x = -1.8;
    }
  }

  kill() {
    this.pose = 'dead';
    this.deadT = 0;
  }

  muzzlePosition(target) {
    this.root.updateMatrixWorld(true);
    return this.muzzle.getWorldPosition(target);
  }
}

Humanoid.prototype.aimPitch = 0;
