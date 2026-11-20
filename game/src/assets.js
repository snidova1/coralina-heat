// Original Coralina asset integration. GPU geometry/textures are shared; skeletons and mixers are not.
import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';
import { clone } from 'SkeletonUtils';

const models = new Map();
const textures = new Map();
const names = ['ch_player', 'ch_cop', 'ch_gang', 'ch_woman', 'ch_biz', 'car_sport', 'car_police', 'car_taxi', 'car_pickup', 'prop_palm', 'prop_lifeguard', 'prop_foodtruck', 'prop_umbrella'];
const images = ['tex_facade_deco', 'tex_facade_glass', 'tex_asphalt', 'tex_sidewalk'];
export const assetReport = { loaded: [], failed: [] };

export async function preloadAssets(renderer) {
  const loader = new GLTFLoader();
  const imageLoader = new THREE.TextureLoader();
  const bar = document.querySelector('#loading progress');
  const label = document.querySelector('#loading span');
  let done = 0;
  await Promise.all([...names, ...images].map(async (name) => {
    try {
      if (name.startsWith('tex_')) {
        const t = await imageLoader.loadAsync(`./assets/${name}.jpg`);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        textures.set(name, t);
      } else {
        const gltf = await loader.loadAsync(`./assets/${name}.glb`);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = o.receiveShadow = true;
          for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
            if (m.map) m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
        });
        models.set(name, gltf);
      }
      assetReport.loaded.push(name);
    } catch (error) {
      assetReport.failed.push(name);
      console.warn(`Using procedural fallback for ${name}:`, error.message);
    }
    done++;
    if (bar) bar.value = done / (names.length + images.length);
    if (label) label.textContent = `Preparing Coralina Bay · ${Math.round(done / 17 * 100)}%`;
  }));
}

export function assetTexture(name) { return textures.get(name); }
export function hasModel(name) { return models.has(name); }

// Ground and centre a model after its axis correction; use actual bounds rather than exporter units.
export function cloneModel(name, size, axis = 'y', yaw = 0) {
  const source = models.get(name);
  if (!source) return null;
  const root = new THREE.Group();
  const mesh = source.scene.clone(true);
  mesh.rotation.y = yaw;
  root.add(mesh);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const extent = box.getSize(new THREE.Vector3());
  const scale = size / extent[axis];
  mesh.scale.multiplyScalar(scale);
  mesh.position.set(-(box.min.x + box.max.x) * scale / 2, -box.min.y * scale, -(box.min.z + box.max.z) * scale / 2);
  root.updateMatrixWorld(true);
  root.userData.asset = name;
  return root;
}

// One draw per source primitive, partitioned into neighbourhood cells for useful frustum culling.
export function instanceProps(scene, name, placements, size, axis = 'y', yaw = 0) {
  const template = cloneModel(name, size, axis, yaw);
  if (!template) return false;
  const cells = new Map();
  for (const p of placements) {
    const key = `${Math.floor(p[0] / 100)},${Math.floor(p[2] / 100)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(p);
  }
  const transform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  template.traverse((o) => {
    if (!o.isMesh) return;
    for (const list of cells.values()) {
      const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
      list.forEach((p, i) => {
        transform.position.set(p[0], p[1], p[2]);
        transform.rotation.set(0, p[4] || 0, 0);
        transform.scale.setScalar(p[3] || 1);
        transform.updateMatrix();
        matrix.multiplyMatrices(transform.matrix, o.matrixWorld);
        im.setMatrixAt(i, matrix);
      });
      im.castShadow = im.receiveShadow = true;
      im.userData.asset = name;
      im.computeBoundingSphere();
      scene.add(im);
    }
  });
  return true;
}

const yAxis = new THREE.Vector3(0, 1, 0);
let contactMaterial;
const contactGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function contactShadow(width, length) {
  if (!contactMaterial) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(8,12,20,0.48)');
    gradient.addColorStop(0.5, 'rgba(8,12,20,0.28)');
    gradient.addColorStop(1, 'rgba(8,12,20,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    contactMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  }
  const shadow = new THREE.Mesh(contactGeometry, contactMaterial);
  shadow.scale.set(width, 1, length);
  shadow.position.y = 0.012;
  return shadow;
}
export function createCharacter(look) {
  const kind = look.kind || 'civilian';
  const name = kind === 'player' ? 'ch_player' : kind === 'cop' ? 'ch_cop' : kind === 'thug' || kind === 'boss' ? 'ch_gang' : look.longHair || look.skirt ? 'ch_woman' : 'ch_biz';
  const source = models.get(name);
  if (!source) return null;
  const root = new THREE.Group();
  root.userData.asset = name;
  const model = clone(source.scene);
  root.add(model);
  root.add(contactShadow(0.85, 0.65));
  root.scale.setScalar(look.height);
  const ownedMaterials = [];
  if (kind === 'civilian' || kind === 'contact') model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color.offsetHSL((look.shirt % 101) / 101 * 0.3 - 0.15, -0.06, 0.025);
    ownedMaterials.push(o.material);
  });
  const mixer = new THREE.AnimationMixer(model);
  const walk = source.animations.find((a) => a.name.toLowerCase() === 'walk');
  const run = source.animations.find((a) => a.name.toLowerCase() === 'run') || walk;
  // A held relaxed walk frame provides idle without ever exposing the A-pose rest skeleton.
  const idleTracks = walk.tracks.map((track) => {
    const value = new Float32Array(track.getValueSize());
    track.createInterpolant().evaluate(0.08).forEach((v, i) => { value[i] = v; });
    return new track.constructor(track.name, [0], value);
  });
  const idle = new THREE.AnimationClip('idle', 1, idleTracks);
  const actions = { idle: mixer.clipAction(idle), walk: mixer.clipAction(walk), run: mixer.clipAction(run) };
  let active = actions.idle;
  active.play();
  mixer.update(0);
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const gun = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x171e25, metalness: 0.8, roughness: 0.28 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.23), steel);
  slide.position.z = 0.08;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.055), steel);
  grip.position.y = -0.055;
  gun.add(slide, grip);
  gun.visible = false;
  root.add(gun);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.005, 0.21);
  gun.add(muzzle);
  const from = new THREE.Vector3();
  const target = new THREE.Vector3();
  const parentQ = new THREE.Quaternion();
  const aimBone = (bone, localTarget) => {
    if (!bone) return;
    root.updateMatrixWorld(true);
    bone.getWorldPosition(from);
    target.copy(localTarget);
    root.localToWorld(target);
    target.sub(from).normalize();
    bone.parent.getWorldQuaternion(parentQ).invert();
    bone.quaternion.setFromUnitVectors(yAxis, target.applyQuaternion(parentQ));
  };
  const body = {
    root, model, mixer, look, gun, muzzle, bones, speed: 0, pose: 'move', aimPitch: 0, deadT: 0, recoil: 0,
    hips: bones.Hips || model,
    setArmed(on) { gun.visible = on; },
    punch() { this.punchT = 0.35; },
    fireRecoil() { this.recoil = 1; },
    kill() { this.pose = 'dead'; this.deadT = 0; },
    muzzlePosition(out) { root.updateMatrixWorld(true); return muzzle.getWorldPosition(out); },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model); ownedMaterials.forEach((m) => m.dispose()); },
    update(dt) {
      const next = this.speed > 4 ? actions.run : this.speed > 0.2 ? actions.walk : actions.idle;
      if (next !== active) { next.reset().play(); active.crossFadeTo(next, 0.22, false); active = next; }
      if (active === actions.walk) active.timeScale = Math.max(0.6, this.speed / 1.65);
      if (active === actions.run) active.timeScale = Math.max(0.75, this.speed / 5.5);
      mixer.update(dt);
      this.recoil = Math.max(0, this.recoil - dt * 8);
      model.rotation.x = 0;
      // The supplied walk/run clips place the sole ~3 cm above the bind-pose floor.
      model.position.y = -0.03;
      if (this.pose === 'dead') {
        this.deadT = Math.min(1, this.deadT + dt * 2.4);
        model.rotation.x = -this.deadT * Math.PI / 2;
        model.position.y = this.deadT * 0.2;
        return;
      }
      if (this.reach) {
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 'Right' : 'Left';
          const hand = new THREE.Vector3(...this.reach[i]);
          const elbow = hand.clone().multiplyScalar(0.55);
          elbow.x += i === 0 ? -0.13 : 0.13;
          elbow.y += 0.57;
          aimBone(bones[`${side}Arm`], elbow);
          aimBone(bones[`${side}ForeArm`], hand);
        }
      } else if (this.pose === 'aim' || this.punchT > 0) {
        const lift = -this.aimPitch * 0.6 + this.recoil * 0.035;
        aimBone(bones.RightArm, new THREE.Vector3(-0.19, 1.28 + lift, 0.36));
        aimBone(bones.RightForeArm, new THREE.Vector3(-0.07, 1.34 + lift, 0.65));
        aimBone(bones.LeftArm, new THREE.Vector3(0.22, 1.22 + lift, 0.3));
        aimBone(bones.LeftForeArm, new THREE.Vector3(-0.02, 1.32 + lift, 0.62));
        if (this.punchT > 0) this.punchT -= dt;
      } else if (this.pose === 'surrender' || this.pose === 'cower') {
        aimBone(bones.RightArm, new THREE.Vector3(-0.35, 1.9, 0));
        aimBone(bones.LeftArm, new THREE.Vector3(0.35, 1.9, 0));
      }
      root.updateMatrixWorld(true);
      if (bones.RightHand) {
        bones.RightHand.getWorldPosition(target);
        gun.position.copy(root.worldToLocal(target));
      }
      gun.rotation.set(this.pose === 'aim' ? this.aimPitch : 1.1, 0, 0);
    },
  };
  body.update(0);
  return body;
}
