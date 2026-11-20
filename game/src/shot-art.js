// Capture-only scenic details; none of these alter the live simulation.
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { SEA_LEVEL } from './map.js';

export function goldenHour(game, direction) {
  const d = game.day;
  d.setHour(18.2);
  d.frozen = true;
  d.uniforms.topColor.value.set(0x538cc8);
  d.uniforms.horizonColor.value.set(0xf5d9aa);
  d.uniforms.sunColor.value.set(0xffdeb0);
  d.uniforms.sunDir.value.set(...direction).normalize();
  d.sunDirection = d.uniforms.sunDir.value.clone();
  d.sun.color.set(0xffe1af);
  d.sun.intensity = 2.8;
  d.hemi.color.set(0xbad9fa);
  d.hemi.groundColor.set(0xc8b498);
  d.hemi.intensity = 1.45;
  game.scene.fog.color.set(0xc3cfd3);
  game.scene.fog.density = 0.00088;
  d.bakeEnvironment();
}

export function dressDrift(game, hero, cruisers) {
  const { x, z } = hero.position;
  const rubberMaterial = new THREE.MeshBasicMaterial({ color: 0x131721, transparent: true, opacity: 0.62, depthWrite: false });
  for (let i = 0; i < 17; i++) {
    for (const side of [-1, 1]) {
      const t = i / 16;
      const tx = x - 0.7 - t * t * 2 + side * 0.82;
      const tz = z + 1.3 + t * 6.5;
      const rubber = new THREE.Mesh(new THREE.PlaneGeometry(0.20 - 0.1 * t, 0.41), rubberMaterial);
      rubber.rotation.set(-Math.PI / 2, 0, -Math.atan(t * 4 / 6.5));
      rubber.position.set(tx, 0.027, tz);
      game.scene.add(rubber);
      if (i % 2 === 0) {
        const p = game.effects.emit('tire', tx, 0.28 + t * 0.56, tz, 0, 0, 0, 0.65 + t * 1.45);
        p.age = p.life * (0.16 + t * 0.36);
      }
    }
  }
  game.effects.update(0.001);
  for (const car of cruisers) {
    if (car.extras.spill) car.extras.spill.visible = false;
    for (const { lamp, glow, side } of car.extras.strobes) {
      const color = side < 0 ? 0xff1737 : 0x246cff;
      lamp.material.emissiveIntensity = 5;
      glow.visible = true;
      glow.scale.setScalar(1.35);
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8.5), new THREE.MeshBasicMaterial({
        map: glowTexture(), color, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(side * 1.55, 0.073, 0.5);
      car.root.add(spill);
      const light = new THREE.PointLight(color, 6, 4.2, 2);
      light.position.copy(lamp.position);
      car.body.add(light);
    }
  }
}

export function coastBackdrop(game) {
  // Distant island across the bay, kept in silhouette so it doesn't compete with the chase.
  const box = new THREE.BoxGeometry(1, 1, 1);
  const blocks = [
    [700, -236, 28, 150, 2.5], [698, -290, 17, 13, 20], [703, -277, 16, 11, 27],
    [701, -263, 12, 9, 40], [700, -263, 8, 7, 44], [699, -248, 18, 18, 32],
    [703, -228, 16, 13, 23], [697, -214, 12, 10, 36], [702, -199, 18, 16, 17],
    [699, -179, 15, 12, 15], [696, -168, 19, 10, 9],
  ];
  const skyline = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }), blocks.length);
  const transform = new THREE.Object3D();
  blocks.forEach(([x, z, w, l, h], i) => {
    transform.position.set(x, SEA_LEVEL + h / 2 - 0.4, z);
    transform.scale.set(w, h, l);
    transform.updateMatrix();
    skyline.setMatrixAt(i, transform.matrix);
    skyline.setColorAt(i, new THREE.Color([0x5b777e, 0x69888e, 0x79969a][i % 3]));
  });
  game.scene.add(skyline);
}

export function openDriverDoor(game, car) {
  const hinge = new THREE.Group();
  hinge.position.set(-0.85, 0, 0.77);
  hinge.rotation.y = 1.24;
  car.body.add(hinge);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xc92329, metalness: 0.43, roughness: 0.28, clearcoat: 1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x151b22, roughness: 0.65 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x868f97, metalness: 0.6, roughness: 0.34 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x426b82, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, metalness: 0.34, roughness: 0.09, clearcoat: 1 });

  // Profiles are drawn in door-local (length, height), then extruded across its thickness.
  function panel(points, thickness, material, x = 0, bevel = 0) {
    const shape = new THREE.Shape();
    points.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.x = x;
    mesh.castShadow = material !== glass;
    hinge.add(mesh);
  }
  const outline = [[-0.03, 0.39], [-1.26, 0.39], [-1.36, 0.54], [-1.31, 0.86], [-0.06, 0.84]];
  panel(outline, 0.067, paint, 0, 0.028);
  panel([[-0.12, 0.54], [-1.16, 0.48], [-1.28, 0.61], [-1.25, 0.80], [-0.12, 0.77]], 0.04, trim, 0.045, 0.021);
  panel([[-0.23, 0.675], [-1.15, 0.70], [-1.15, 0.75], [-0.17, 0.735]], 0.027, satin, 0.079, 0.012);
  panel([[-0.055, 0.81], [-0.53, 1.19], [-1.15, 1.22], [-1.31, 0.84]], 0.01, glass);
  const rail = (z, y, ez, ey) => {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.04, Math.hypot(ez - z, ey - y) + 0.025, 0.043), trim);
    piece.position.set(0, (y + ey) / 2, (z + ez) / 2);
    piece.rotation.x = Math.atan2(ez - z, ey - y);
    hinge.add(piece);
  };
  rail(-0.055, 0.81, -0.53, 1.19);
  rail(-0.53, 1.19, -1.15, 1.22);
  rail(-1.15, 1.22, -1.31, 0.84);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.075, 0.14), paint);
  mirror.position.set(-0.095, 0.91, -0.19);
  hinge.add(mirror);

  // Open a cavity in only this instance's baked shell, leaving the rocker and roof intact.
  game.renderer.localClippingEnabled = true;
  car.root.updateMatrixWorld(true);
  const cut = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.61),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.42),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.18),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.78),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), -0.56),
  ].map(p => p.applyMatrix4(car.body.matrixWorld));
  car.shell.material = car.shell.material.clone();
  car.shell.material.clippingPlanes = cut;
  car.shell.material.clipIntersection = true;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.52, 0.15), trim);
  seat.position.set(-0.38, 0.73, -0.41);
  seat.rotation.x = -0.16;
  car.body.add(seat);
}

export function targetBadge(game, actor, label) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#161823';
  ctx.fillStyle = '#ffe28a';
  ctx.strokeText(label, 192, 49);
  ctx.fillText(label, 192, 49);
  ctx.beginPath();
  ctx.moveTo(173, 66); ctx.lineTo(211, 66); ctx.lineTo(192, 89); ctx.closePath();
  ctx.stroke(); ctx.fill();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  badge.scale.set(3.3, 0.825, 1);
  badge.position.copy(actor.position).add(new THREE.Vector3(0, 2.32, 0));
  game.scene.add(badge);
}
