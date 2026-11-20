// Capture-only scenic details; none of these alter the live simulation.
import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { ISLAND, SEA_LEVEL } from './map.js';

export function goldenHour(game, direction) {
  const d = game.day;
  d.setHour(19.25);
  d.frozen = true;
  d.uniforms.sunset.value = 1;
  d.uniforms.topColor.value.set(0x652b8e);
  d.uniforms.horizonColor.value.set(0xf7864d);
  d.uniforms.sunColor.value.set(0xffa155);
  d.uniforms.sunDir.value.set(...direction).normalize();
  d.sunDirection = d.uniforms.sunDir.value.clone();
  d.sun.color.set(0xffbc83);
  d.sun.intensity = 3.1;
  d.hemi.color.set(0xaabfff);
  d.hemi.groundColor.set(0x948799);
  d.hemi.intensity = 0.98;
  game.renderer.toneMappingExposure = 0.92;
  game.scene.fog.color.set(0x89536e);
  game.scene.fog.density = 0.00039;
  d.bakeEnvironment();
  game.scene.environmentIntensity = 0.44;
  sunsetWater(game, d.uniforms);
}

function sunsetWater(game, sky) {
  const water = game.city.waterMat;
  water.color.set(0x145268);
  water.roughness = 0.22;
  water.onBeforeCompile = shader => {
    shader.uniforms.sunsetDirection = sky.sunDir;
    shader.uniforms.sunsetColor = sky.sunColor;
    shader.uniforms.horizonTint = sky.horizonColor;
    shader.vertexShader = 'varying vec3 vOceanPoint;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vOceanPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `);
    shader.fragmentShader = `
      varying vec3 vOceanPoint;
      uniform vec3 sunsetDirection, sunsetColor, horizonTint;
    ` + shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 eye = normalize(cameraPosition - vOceanPoint);
      vec2 p = vOceanPoint.xz;
      vec2 ripple = vec2(sin(p.x * 0.77 + p.y * 1.38), cos(p.x * 1.47 - p.y * 0.82));
      ripple += 0.46 * vec2(cos(p.y * 3.28), sin(p.x * 2.45 + p.y * 1.65));
      vec3 reflected = reflect(-eye, normalize(vec3(ripple.x * 0.043, 1.0, ripple.y * 0.043)));
      float alongSun = max(dot(reflected, sunsetDirection), 0.0);
      float glare = pow(alongSun, 110.0) * 0.26 + pow(alongSun, 1250.0) * 1.55;
      float grazing = pow(1.0 - clamp(eye.y, 0.0, 1.0), 5.0);
      outgoingLight = mix(outgoingLight, horizonTint * 0.36 + vec3(0.018, 0.037, 0.068), grazing * 0.82);
      outgoingLight += sunsetColor * glare * grazing;
      #include <opaque_fragment>
    `);
  };
  water.needsUpdate = true;
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
      if (i % 4 === 0) {
        const p = game.effects.emit('tire', tx, 0.28 + t * 0.56, tz, 0, 0, 0, 0.65 + t * 1.45);
        p.age = p.life * (0.56 + t * 0.28);
      }
    }
  }
  game.effects.update(0.001);
  const glowMap = glowTexture();
  // Short shutter streaks in the road plane; vehicle silhouettes stay sharp.
  for (let i = 0; i < 30; i++) {
    const roadX = 353.2 + (i * 13 % 31) * 0.42;
    const roadZ = z - 20 + (i * 17 % 41);
    const width = 0.07 + (i % 5) * 0.025;
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.3 + (i % 7) * 0.66), new THREE.MeshBasicMaterial({
      map: glowMap, color: i % 4 ? 0xf2a17c : 0x8eafff, transparent: true, opacity: 0.37,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(roadX, 0.039, roadZ);
    game.scene.add(streak);
  }
  for (const car of cruisers) {
    if (car.extras.spill) car.extras.spill.visible = false;
    for (const { lamp, glow, side } of car.extras.strobes) {
      const color = side < 0 ? 0xff1737 : 0x246cff;
      lamp.material.emissiveIntensity = 5;
      glow.visible = true;
      glow.scale.set(1.35, 0.82, 1);
      glow.material.opacity = 0.77;
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 7.6), new THREE.MeshBasicMaterial({
        map: glowMap, color, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(side * 1.55, 0.073, 0.5);
      car.root.add(spill);
      const light = new THREE.PointLight(color, 11, 5.5, 2);
      light.position.copy(lamp.position);
      car.body.add(light);
    }
  }
}

export function dressMarina(game) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x28506a, metalness: 0.54, roughness: 0.21 });
  const rail = new THREE.MeshStandardMaterial({ color: 0xacc0c7, metalness: 0.6, roughness: 0.42 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x503534, roughness: 0.93 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffba77, emissive: 0xff8f45, emissiveIntensity: 1.4 });
  const glassRoof = new THREE.MeshStandardMaterial({ color: 0xd7c4b5, roughness: 0.45 });
  const hullPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, side: THREE.DoubleSide });
  const box = (parent, material, x, y, z, w, h, l) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  };
  // Replace the stock background boats for this angle, where their slab sides are in close view.
  for (const { obj } of game.city.boats) obj.visible = false;
  const outline = [[-1.38, -3.8], [1.38, -3.8], [1.59, -1.1], [1.53, 1.8],
    [1.13, 3.22], [0, 4.73], [-1.13, 3.22], [-1.53, 1.8], [-1.59, -1.1]];
  for (const [x, z, yaw, scale, accent] of [
    [177, 408, 1.19, 1.27, 0x286175], [203, 423, -1.32, 1.28, 0xa23d50],
    [228, 434, 1.05, 1.53, 0x27476b], [270, 411, -1.35, 1.3, 0x376c65],
    [310, 444, 1.02, 1.55, 0x88425e],
  ]) {
    const yacht = new THREE.Group();
    yacht.position.set(x, SEA_LEVEL, z);
    yacht.rotation.y = yaw;
    yacht.scale.setScalar(scale);
    game.scene.add(yacht);
    const rings = [[-0.2, 0.75], [0.20, 0.91], [0.35, 0.95], [0.81, 1], [0.88, 0.97]];
    const positions = [], colors = [];
    const vertex = (ring, i, color) => {
      const [y, s] = rings[ring];
      const [px, pz] = outline[i];
      positions.push(px * s, y + Math.max(pz - 2.5, 0) * 0.13, pz * s);
      colors.push(color.r, color.g, color.b);
    };
    [accent, 0xd5b8a4, 0xbbc1cf, accent, 0xd0a784].forEach((tint, ring) => {
      const color = new THREE.Color(tint);
      for (let i = 0; i < outline.length; i++) {
        const j = (i + 1) % outline.length;
        if (ring < rings.length - 1) {
          vertex(ring, i, color); vertex(ring, j, color); vertex(ring + 1, j, color);
          vertex(ring, i, color); vertex(ring + 1, j, color); vertex(ring + 1, i, color);
        } else {
          positions.push(0, 0.88, 0); colors.push(color.r, color.g, color.b);
          vertex(ring, j, color); vertex(ring, i, color);
        }
      }
    });
    const hullGeo = new THREE.BufferGeometry();
    hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    hullGeo.computeVertexNormals();
    const hull = new THREE.Mesh(hullGeo, hullPaint);
    hull.castShadow = hull.receiveShadow = true;
    yacht.add(hull);
    const cabin = new THREE.Shape();
    cabin.moveTo(-2.42, 0.9); cabin.lineTo(1.32, 0.9); cabin.lineTo(0.54, 1.98);
    cabin.lineTo(-1.89, 1.98); cabin.closePath();
    const cabinGeo = new THREE.ExtrudeGeometry(cabin, { depth: 2.13, bevelEnabled: false });
    cabinGeo.translate(0, 0, -1.065);
    cabinGeo.rotateY(-Math.PI / 2);
    yacht.add(new THREE.Mesh(cabinGeo, glass));
    box(yacht, glassRoof, 0, 2.03, -0.74, 2.27, 0.16, 2.66);
    box(yacht, glassRoof, 0, 1.00, -0.53, 2.20, 0.24, 3.71);
    for (const side of [-1, 1]) {
      box(yacht, rail, side * 1.21, 1.32, 2.27, 0.05, 0.055, 1.85);
      for (const z of [1.38, 2.19, 3.14]) box(yacht, rail, side * 1.21, 1.17, z, 0.045, 0.34, 0.045);
      for (const z of [-1.75, -0.97, -0.18, 0.51]) box(yacht, glassRoof, side * 1.074, 1.54, z, 0.06, 0.90, 0.085);
      for (const z of [-2.6, -0.6, 1.4]) {
        const fender = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.34, 3, 8), timber);
        fender.position.set(side * 1.54, 0.61, z);
        yacht.add(fender);
      }
    }
    box(yacht, rail, 0, 2.62, -1.1, 0.061, 1.07, 0.061);
    box(yacht, lamp, 0, 3.18, -1.1, 0.18, 0.12, 0.18);
  }
  for (let x = 152; x <= 329; x += 8) {
    box(game.scene, timber, x, 0.36, ISLAND.maxZ + 5.7, 0.29, 2.18, 0.29);
    box(game.scene, x % 16 === 8 ? lamp : rail, x, 1.48, ISLAND.maxZ + 5.7, 0.36, 0.14, 0.36);
  }
  for (let x = 164; x <= 320; x += 52) {
    for (let z = ISLAND.maxZ + 10; z < ISLAND.maxZ + 77; z += 7) {
      for (const side of [-1, 1]) box(game.scene, timber, x + side * 1.27, 0.28, z, 0.26, 1.52, 0.26);
    }
  }
}

export function lightOceanDrive(game) {
  for (const { plane, glow } of game.city.signs) {
    const { x, y, z } = plane.position;
    if (x < 340 || z < -330 || z > -120) continue;
    const light = new THREE.PointLight(glow.material.color, 165, 29, 2);
    light.position.set(x + 3.5, y - 2, z);
    game.scene.add(light);
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
