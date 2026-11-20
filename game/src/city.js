// Coralina Bay itself: the island's land and seawalls, Ocean Drive's beach and art-deco motels, the
// glass towers of Coral Heights, pastel walk-ups, the Venetia Canal and its bridges, Kingfish Marina,
// the Sunspan Bridge, palms, neon, billboards and the ocean. It also owns building collision.
import * as THREE from 'three';
import { instanceProps, hasModel } from './assets.js';
import { GeometryBucket } from './geometry.js';
import { facadeTextures, surfaceTexture, waterNormals, neonSignTexture, decalTexture, glowTexture } from './textures.js';
import { makeStream } from './rng.js';
import { dressBeachSand } from './surface-detail.js';
import { Architecture } from './architecture.js';
import {
  LINES, LINE_MIN, LINE_MAX, ROAD_HALF, ISLAND, BEACH, CANAL, BRIDGE, BOULEVARD_X, SEA_LEVEL, PLACES,
} from './map.js';

const PASTELS = [0xffd3dc, 0xc4eee2, 0xfff0bf, 0xd3e4ff, 0xffdcc2, 0xf6f3ee, 0xe7d4ff];
const MOTEL_SIGNS = [
  ['FLAMINGO REST', '#ff4fa0', 'VACANCY', '#5ff2ff'],
  ['SEA BREEZE INN', '#5ff2ff', 'POOL · TV', '#ffd34f'],
  ['HOTEL DEL SOL', '#ffb13b', 'NO VACANCY', '#ff4f6a'],
  ['LA PERLA', '#9d7bff', 'OCEAN VIEW', '#5ff2ff'],
  ['MOONGLOW', '#5fffa8', 'VACANCY', '#ff4fa0'],
  ['CORAL CABANA', '#ff7a4f', 'COCKTAILS', '#5ff2ff'],
  ['NEPTUNO', '#4fa8ff', 'SUITES', '#ffd34f'],
  ['THE AQUAMARINE', '#5ff2ff', 'VACANCY', '#ff4fa0'],
];
const BILLBOARDS = [
  ['SUNFIRE COLA', '#ff5a3c', '#fff6e0'],
  ['BAYWAVE 98.4 FM', '#1e2a78', '#7ff6ff'],
  ['FLY CORAL AIR', '#ffffff', '#ff5f8f'],
  ['VORTICE GT · BORN FAST', '#111111', '#ffcf3f'],
  ['LUX TOWER · LIVE ABOVE', '#2b1840', '#ffb0e0'],
];

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rnd = makeStream(2027);
    this.colliders = [];
    this.grid = new Map();
    this.facadeMaterials = [];
    this.buckets = new Map();
    this.roofBucket = new GeometryBucket();
    this.trimBucket = new GeometryBucket();
    this.palms = [];
    this.signs = [];
    this.boats = [];
    this.coastClock = { value: 0 };
    this.architecture = new Architecture(scene);
    this.buildLand();
    this.buildWater();
    this.buildBlocks();
    this.buildCanalBridges();
    this.buildBeach();
    this.buildMarina();
    this.buildSunspanBridge();
    this.buildMainland();
    this.buildStreetFurniture();
    this.flushBuildings();
    this.architecture.flush();
    this.buildPalms();
    this.buildAssetPlazas();
  }

  // ---------- land, beach and water ----------

  buildLand() {
    const top = new GeometryBucket();
    const walls = new GeometryBucket();
    const pieces = [
      [ISLAND.minX, ISLAND.minZ, BEACH.x0, CANAL.zMin],
      [ISLAND.minX, CANAL.zMax, BEACH.x0, ISLAND.maxZ],
    ];
    for (const [x0, z0, x1, z1] of pieces) {
      top.flat(x0, z0, x1, z1, 0, 6);
      walls.boxSides((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, -7, 0, 6, 6);
    }
    const sand = new THREE.MeshStandardMaterial({ map: surfaceTexture('sand'), roughness: 0.93 });
    dressBeachSand(sand, this.coastClock);
    const stone = new THREE.MeshStandardMaterial({ map: surfaceTexture('stone'), roughness: 0.95 });
    const a = new THREE.Mesh(top.build(), sand);
    const b = new THREE.Mesh(walls.build(), stone);
    a.receiveShadow = b.receiveShadow = true;
    this.scene.add(a, b);
    this.sandMat = sand;
    this.stoneMat = stone;
  }

  buildWater() {
    const normals = waterNormals();
    normals.repeat.set(1300, 1300);
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x0f6a82, roughness: 0.05, metalness: 0.2, normalMap: normals, normalScale: new THREE.Vector2(0.2, 0.2),
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), this.waterMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = SEA_LEVEL;
    ocean.receiveShadow = true;
    this.scene.add(ocean);
    this.ocean = ocean;
  }

  buildBeach() {
    // sand sloping from the promenade down under the surf
    const bucket = new GeometryBucket();
    for (const [z0, z1] of [[ISLAND.minZ - 30, CANAL.zMin], [CANAL.zMax, ISLAND.maxZ + 40]]) {
      const steps = 48;
      for (let s = 0; s < steps; s++) {
        const xa = BEACH.x0 + ((BEACH.x1 + 40 - BEACH.x0) * s) / steps;
        const xb = BEACH.x0 + ((BEACH.x1 + 40 - BEACH.x0) * (s + 1)) / steps;
        const ya = this.beachHeight(xa);
        const yb = this.beachHeight(xb);
        bucket.quad([xa, ya, z1], [xb, yb, z1], [xb, yb, z0], [xa, ya, z0], [xa / 6, -z1 / 6], [xb / 6, -z1 / 6], [xb / 6, -z0 / 6], [xa / 6, -z0 / 6]);
      }
    }
    const beach = new THREE.Mesh(bucket.build(), this.sandMat);
    beach.receiveShadow = true;
    this.scene.add(beach);
    // lifeguard towers, umbrellas and loungers
    if (hasModel('prop_umbrella') && hasModel('prop_lifeguard')) {
      const umbrellas = [];
      for (let z = -380; z < 390; z += 17) {
        if (z > 5 && z < 75) continue;
        for (const x of [382, 399, 416]) umbrellas.push([x, this.beachHeight(x), z + this.rnd() * 4, 0.85 + this.rnd() * 0.25, this.rnd() * Math.PI * 2]);
      }
      instanceProps(this.scene, 'prop_umbrella', umbrellas, 2.6);
      instanceProps(this.scene, 'prop_lifeguard', [-300, -110, 160, 300].map((z) => [390, this.beachHeight(390), z, 1, -Math.PI / 2]), 5.8);
      return;
    }
    const umbrellaColors = [0xff5f6d, 0x2fb8ac, 0xffc93c, 0x5b8cff, 0xffffff];
    const ub = new GeometryBucket(true);
    const m = new THREE.Matrix4();
    const cone = new THREE.ConeGeometry(1.6, 0.6, 8);
    const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5);
    const lounger = new THREE.BoxGeometry(0.7, 0.25, 1.9);
    for (let z = ISLAND.minZ + 10; z < ISLAND.maxZ; z += 9) {
      if (z > CANAL.zMin - 6 && z < CANAL.zMax + 6) continue;
      const x = BEACH.x0 + 18 + this.rnd() * 22;
      const y = this.beachHeight(x);
      const col = new THREE.Color(umbrellaColors[Math.floor(this.rnd() * umbrellaColors.length)]);
      ub.addGeometry(cone, m.makeTranslation(x, y + 2.5, z), col);
      ub.addGeometry(pole, m.makeTranslation(x, y + 1.2, z), new THREE.Color(0xeeeeee));
      ub.addGeometry(lounger, m.makeTranslation(x + 1.2, y + 0.2, z + 0.4), new THREE.Color(0xf4f0e6));
    }
    for (const z of [-300, -110, 160, 300]) {
      const x = BEACH.x0 + 30;
      const y = this.beachHeight(x);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ub.addGeometry(new THREE.CylinderGeometry(0.1, 0.1, 3), m.makeTranslation(x + dx * 1.1, y + 1.5, z + dz * 1.1), new THREE.Color(0xf2f2f2));
      }
      ub.addGeometry(new THREE.BoxGeometry(3, 2.2, 3), m.makeTranslation(x, y + 4.1, z), new THREE.Color(0x35c4c9));
      ub.addGeometry(new THREE.ConeGeometry(2.4, 1.2, 4).rotateY(Math.PI / 4), m.makeTranslation(x, y + 5.8, z), new THREE.Color(0xff4f6d));
    }
    const props = new THREE.Mesh(ub.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    props.castShadow = true;
    this.scene.add(props);
  }

  beachHeight(x) {
    const t = Math.max(0, Math.min(1, (x - BEACH.x0) / (BEACH.x1 + 40 - BEACH.x0)));
    return 0.12 - t * t * 3.4;
  }

  // ---------- buildings ----------

  facadeBucket(style, tint) {
    const key = style + ':' + tint;
    if (!this.buckets.has(key)) this.buckets.set(key, { style, tint, bucket: new GeometryBucket() });
    return this.buckets.get(key).bucket;
  }

  addCollider(x0, z0, x1, z1, h, tag = 'building') {
    const c = { x0, z0, x1, z1, h, tag };
    this.colliders.push(c);
    const ci0 = Math.floor(x0 / 40);
    const ci1 = Math.floor(x1 / 40);
    const cj0 = Math.floor(z0 / 40);
    const cj1 = Math.floor(z1 / 40);
    for (let i = ci0; i <= ci1; i++) {
      for (let j = cj0; j <= cj1; j++) {
        const k = i * 4096 + j;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(c);
      }
    }
    return c;
  }

  /** A building: facade walls in its style's bucket, a roof with parapet and rooftop clutter, a collider. */
  addBuilding(x, z, w, d, h, style, tint, opts = {}) {
    const tile = style === 'glass' ? [12, 14] : style === 'warehouse' ? [16, 14] : [14, 14];
    const b = this.facadeBucket(style, tint);
    if (opts.shops && h > 7) {
      const seed = this.rnd();
      this.facadeBucket('shop' + Math.floor(seed * 12), 0xffffff).boxSides(x, z, w, d, 0.1, 4.6, 24, 4.5);
      this.trimBucket.box(x, 4.75, z, w + 0.5, 0.3, d + 0.5, 2);
      b.boxSides(x, z, w, d, 4.6, h, tile[0], tile[1], undefined, 4.6 / tile[1]);
    } else b.boxSides(x, z, w, d, 0.1, h, tile[0], tile[1]);
    this.roofBucket.flat(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h, 6);
    if (!opts.noParapet) {
      const p = 0.35;
      this.trimBucket.box(x, h + 0.5, z - d / 2 + p / 2, w, 1, p, 2);
      this.trimBucket.box(x, h + 0.5, z + d / 2 - p / 2, w, 1, p, 2);
      this.trimBucket.box(x - w / 2 + p / 2, h + 0.5, z, p, 1, d, 2);
      this.trimBucket.box(x + w / 2 - p / 2, h + 0.5, z, p, 1, d, 2);
    }
    if (!opts.bare) {
      const n = 1 + Math.floor(this.rnd() * 3);
      for (let k = 0; k < n; k++) {
        const ax = x + (this.rnd() - 0.5) * w * 0.6;
        const az = z + (this.rnd() - 0.5) * d * 0.6;
        this.roofBucket.box(ax, h + 0.9, az, 2 + this.rnd() * 3, 1.8, 2 + this.rnd() * 3, 2);
      }
    }
    this.architecture.dress(x, z, w, d, h, style, tint, opts.shops);
    if (opts.collide !== false) this.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h);
  }

  /** A downtown tower: a podium, setback tiers and a crown. */
  addTower(x, z, w, d, h, tint) {
    const style = this.rnd() < 0.65 ? 'glass' : 'office';
    this.addBuilding(x, z, w + 6, d + 6, 9, 'office', 0xf0e8dc, { bare: true, shops: true });
    let y = 9;
    let tw = w;
    let td = d;
    const tiers = h > 90 ? 3 : 2;
    for (let t = 0; t < tiers; t++) {
      const th = (h - 9) / tiers;
      const b = this.facadeBucket(style, tint);
      b.boxSides(x, z, tw, td, y, y + th, style === 'glass' ? 12 : 14, 14, undefined, y / 14);
      this.roofBucket.flat(x - tw / 2, z - td / 2, x + tw / 2, z + td / 2, y + th, 6);
      this.trimBucket.box(x, y + th + 0.4, z, tw + 0.6, 0.8, td + 0.6, 2);
      y += th;
      tw *= 0.8;
      td *= 0.8;
    }
    // crown: a mast or a lit cap
    if (this.rnd() < 0.5) this.trimBucket.box(x, y + 6, z, 0.6, 12, 0.6, 2);
    else this.trimBucket.box(x, y + 2, z, tw * 0.7, 4, td * 0.7, 2);
  }

  buildBlocks() {
    for (let i = 0; i < LINES.length - 1; i++) {
      for (let j = 0; j < LINES.length - 1; j++) {
        const x0 = LINES[i] + ROAD_HALF + 4.5;
        const x1 = LINES[i + 1] - ROAD_HALF - 4.5;
        const z0 = LINES[j] + ROAD_HALF + 4.5;
        const z1 = LINES[j + 1] - ROAD_HALF - 4.5;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const W = x1 - x0;
        const D = z1 - z0;
        const special = this.specialBlock(i, j);
        if (special) {
          special.call(this, cx, cz, W, D, x0, z0, x1, z1);
          continue;
        }
        if (j === 4) continue; // the canal row
        if (i === LINES.length - 2) this.oceanDriveBlock(cx, cz, W, D, x0, z0, x1, z1);
        else if (i >= 2 && i <= 5 && j <= 3) this.downtownBlock(cx, cz, W, D, i, j);
        else if (j === 8 && i >= 3) this.dockBlock(cx, cz, W, D);
        else this.residentialBlock(cx, cz, W, D, x0, z0, x1, z1);
      }
    }
  }

  specialBlock(i, j) {
    const is = (p) => p.block && p.block[0] === i && p.block[1] === j;
    if (is(PLACES.tower)) return this.luxTowerBlock;
    if (is(PLACES.hospital)) return this.hospitalBlock;
    if (is(PLACES.precinct)) return this.precinctBlock;
    if (is(PLACES.warehouse)) return this.warehouseYardBlock;
    if (is(PLACES.park)) return this.parkBlock;
    return null;
  }

  downtownBlock(cx, cz, W, D, i, j) {
    const centre = 1 - Math.min(1, Math.hypot(i - 3.5, j - 1.2) / 3.2);
    const tints = [0xffffff, 0xcfe8ff, 0xffe6d0, 0xd8fff2];
    if (this.rnd() < 0.5) {
      const h = 50 + centre * 110 + this.rnd() * 30;
      this.addTower(cx, cz, W * 0.62, D * 0.62, h, tints[Math.floor(this.rnd() * tints.length)]);
    } else {
      for (const s of [-1, 1]) {
        const h = 36 + centre * 80 + this.rnd() * 30;
        this.addTower(cx + (s * W) / 4, cz, W * 0.36, D * 0.6, h, tints[Math.floor(this.rnd() * tints.length)]);
      }
    }
    if (this.rnd() < 0.6) this.addBillboard(cx, cz + D / 2 - 2, 0);
  }

  luxTowerBlock(cx, cz, W, D) {
    this.addBuilding(cx, cz, W, D, 10, 'office', 0xf3ece2, { bare: true });
    let y = 10;
    let w = W * 0.55;
    for (const th of [70, 60, 40]) {
      this.facadeBucket('glass', 0xffd9f0).boxSides(cx, cz, w, w, y, y + th, 12, 14, undefined, y / 14);
      this.trimBucket.box(cx, y + th + 0.5, cz, w + 1, 1, w + 1, 2);
      y += th;
      w *= 0.78;
    }
    this.trimBucket.box(cx, y + 14, cz, 0.8, 28, 0.8, 2);
    this.addSign(cx, 14, cz + D / 2 + 0.3, 0, 'LUX TOWER', '#ff8ad8', '', 16, 4);
  }

  hospitalBlock(cx, cz, W, D) {
    this.addBuilding(cx, cz, W * 0.8, D * 0.7, 26, 'office', 0xffffff);
    this.addBuilding(cx + W * 0.25, cz - D * 0.1, W * 0.35, D * 0.4, 40, 'office', 0xe8f4ff);
    this.addSign(cx + W * 0.4 + 0.3, 30, cz, Math.PI / 2, 'ST. MARISOL', '#ff4f5f', 'MEDICAL CENTER', 14, 7, '#ffffff');
  }

  precinctBlock(cx, cz, W, D) {
    this.addBuilding(cx, cz + 6, W * 0.8, D * 0.55, 14, 'stucco', 0xdfe9f5);
    this.addSign(cx, 10, cz + 6 - D * 0.275 - 0.3, Math.PI, 'CBPD', '#4f8bff', 'PRECINCT 9', 10, 5, '#ffffff');
  }

  warehouseYardBlock(cx, cz, W, D) {
    // two long sheds round an open yard: the Tiburones' turf
    this.addBuilding(cx - W * 0.3, cz, W * 0.32, D * 0.9, 11, 'warehouse', 0xc7d0d6, { noParapet: true });
    this.addBuilding(cx + W * 0.15, cz - D * 0.35, W * 0.6, D * 0.25, 9, 'warehouse', 0xd8c7b0, { noParapet: true });
    for (let k = 0; k < 6; k++) {
      const x = cx + W * 0.1 + (this.rnd() - 0.5) * W * 0.5;
      const z = cz + D * 0.1 + (this.rnd() - 0.5) * D * 0.4;
      this.trimBucket.box(x, 1.3, z, 2.4, 2.6, 6, 2);
      this.addCollider(x - 1.2, z - 3, x + 1.2, z + 3, 2.6, 'crate');
    }
    this.addSign(cx - W * 0.3 + W * 0.16 + 0.3, 8, cz, Math.PI / 2, 'TIBURON FREIGHT', '#47f0c2', '', 14, 3.5);
  }

  parkBlock(cx, cz, W, D) {
    const g = new GeometryBucket();
    g.flat(cx - W / 2, cz - D / 2, cx + W / 2, cz + D / 2, 0.2, 8);
    const grass = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ map: surfaceTexture('grass'), roughness: 1 }));
    grass.receiveShadow = true;
    this.scene.add(grass);
    this.trimBucket.box(cx, 0.6, cz, 10, 0.8, 10, 2);
    this.trimBucket.box(cx, 1.6, cz, 1.2, 3, 1.2, 2);
    for (let k = 0; k < 14; k++) this.palms.push([cx + (this.rnd() - 0.5) * W * 0.9, cz + (this.rnd() - 0.5) * D * 0.9, 0.9 + this.rnd() * 0.5]);
  }

  oceanDriveBlock(cx, cz, W, D, x0, z0, x1, z1) {
    // art-deco motels facing the beach, each with a neon sign over the boulevard
    const lots = 2;
    for (let k = 0; k < lots; k++) {
      const lz = z0 + (D / lots) * (k + 0.5);
      const depth = 20 + this.rnd() * 10;
      const h = 8 + Math.floor(this.rnd() * 4) * 3.5;
      const bx = x1 - depth / 2;
      const tint = PASTELS[Math.floor(this.rnd() * PASTELS.length)];
      const motel = this.rnd() < 0.5;
      this.addBuilding(bx, lz, depth, D / lots - 4, h, motel ? 'motel' : 'stucco', tint, { shops: !motel });
      // deco fins and a coloured band
      this.trimBucket.box(x1 + 0.3, h * 0.5, lz, 0.6, h * 0.9, 1.2, 2);
      this.trimBucket.box(x1 + 0.2, h + 1.2, lz, 0.8, 2.4, D / lots - 8, 2);
      const s = MOTEL_SIGNS[(this.signs.length * 3 + Math.floor(this.rnd() * 8)) % MOTEL_SIGNS.length];
      const isFlamingo = Math.abs(lz - PLACES.safehouse.z) < 20;
      const sign = isFlamingo ? MOTEL_SIGNS[0] : s;
      this.addSign(x1 + 1.2, h - 1.5, lz + 7, Math.PI / 2, sign[0], sign[1], sign[2], 9, 4.5, sign[3]);
      // a pool behind
      if (this.rnd() < 0.6) this.addPool(x0 + 8, lz);
    }
  }

  addPool(x, z) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x3fd7f0, roughness: 0.05, metalness: 0.1, emissive: 0x0a5a70, emissiveIntensity: 0.3 }));
    g.position.set(x, 0.22, z);
    this.scene.add(g);
    this.trimBucket.box(x, 0.2, z, 9, 0.12, 13, 2);
  }

  dockBlock(cx, cz, W, D) {
    for (const s of [-1, 1]) {
      this.addBuilding(cx + (s * W) / 4, cz, W * 0.44, D * 0.7, 8 + this.rnd() * 6, 'warehouse', [0xd7d2c8, 0xbfd3dc, 0xe0c8b4][Math.floor(this.rnd() * 3)], { noParapet: true });
    }
  }

  residentialBlock(cx, cz, W, D, x0, z0, x1, z1) {
    const n = this.rnd() < 0.4 ? 1 : 2;
    const size = W / n;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const lx = x0 + size * (a + 0.5);
        const lz = z0 + size * (b + 0.5);
        const h = n === 1 ? 14 + this.rnd() * 22 : 7 + Math.floor(this.rnd() * 4) * 3.5;
        const w = size * (0.6 + this.rnd() * 0.25);
        const d = size * (0.6 + this.rnd() * 0.25);
        const tint = PASTELS[Math.floor(this.rnd() * PASTELS.length)];
        this.addBuilding(lx, lz, w, d, h, 'stucco', tint, { shops: this.rnd() < 0.75 });
        if (this.rnd() < 0.5) this.palms.push([lx + w / 2 + 2, lz + d / 2 + 2, 0.8 + this.rnd() * 0.4]);
      }
    }
    if (this.rnd() < 0.25) this.addBillboard(cx, cz, Math.PI / 2 * Math.floor(this.rnd() * 4), 18);
  }

  flushBuildings() {
    for (const { style, tint, bucket } of this.buckets.values()) {
      const tex = facadeTextures(style);
      const glass = style === 'glass';
      if (style.startsWith('shop')) {
        const shop = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.lit, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
        this.facadeMaterials.push(shop);
        const sm = new THREE.Mesh(bucket.build(), shop);
        sm.receiveShadow = true;
        this.scene.add(sm);
        continue;
      }
      const mat = new THREE.MeshStandardMaterial({
        map: tex.map, color: new THREE.Color(tint).lerp(new THREE.Color(0xffffff), 0.65), emissiveMap: tex.lit, emissive: tex.lit ? 0xffffff : 0x000000, emissiveIntensity: 0.05,
        roughness: glass ? 0.12 : 0.85, metalness: glass ? 0.55 : 0,
      });
      this.facadeMaterials.push(mat);
      const mesh = new THREE.Mesh(bucket.build(), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    const roof = new THREE.Mesh(this.roofBucket.build(), new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.95 }));
    const trim = new THREE.Mesh(this.trimBucket.build(), new THREE.MeshStandardMaterial({ color: 0xf4efe8, roughness: 0.7 }));
    roof.castShadow = roof.receiveShadow = trim.castShadow = trim.receiveShadow = true;
    this.scene.add(roof, trim);
  }

  // ---------- street furniture ----------

  /** Benches, bins, hydrants, news boxes and planted trees along every pavement. */
  buildStreetFurniture() {
    const b = new GeometryBucket(true);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const C = (h) => new THREE.Color(h);
    const G = {
      seat: new THREE.BoxGeometry(1.8, 0.08, 0.5).translate(0, 0.48, 0),
      back: new THREE.BoxGeometry(1.8, 0.45, 0.06).translate(0, 0.78, 0.24),
      leg: new THREE.BoxGeometry(0.08, 0.48, 0.45).translate(0, 0.24, 0),
      bin: new THREE.CylinderGeometry(0.28, 0.24, 0.9, 10).translate(0, 0.45, 0),
      hydrant: new THREE.CylinderGeometry(0.14, 0.17, 0.7, 8).translate(0, 0.35, 0),
      hydrantTop: new THREE.SphereGeometry(0.15, 8, 6).translate(0, 0.72, 0),
      news: new THREE.BoxGeometry(0.5, 1.0, 0.45).translate(0, 0.5, 0),
      planter: new THREE.BoxGeometry(1.0, 0.45, 1.0).translate(0, 0.22, 0),
      trunk: new THREE.CylinderGeometry(0.09, 0.12, 2.4, 6).translate(0, 1.6, 0),
      crown: new THREE.IcosahedronGeometry(1.05, 1).translate(0, 3.3, 0),
    };
    const place = (geo, x, z, rot, col) => {
      q.setFromAxisAngle(up, rot);
      m.compose(new THREE.Vector3(x, 0.16, z), q, one);
      b.addGeometry(geo, m, col);
    };
    const item = (x, z, rot, downtown) => {
      const r = this.rnd();
      if (downtown && r < 0.4) {
        place(G.planter, x, z, rot, C(0x8d8a86));
        place(G.trunk, x, z, rot, C(0x6b4f35));
        place(G.crown, x, z, rot, C(0x4f8a3a).offsetHSL(0, 0, (this.rnd() - 0.5) * 0.1));
      } else if (r < 0.62) {
        place(G.seat, x, z, rot, C(0x8a5a3a));
        place(G.back, x, z, rot, C(0x8a5a3a));
        place(G.leg.clone().translate(-0.75, 0, 0), x, z, rot, C(0x2a2a2a));
        place(G.leg.clone().translate(0.75, 0, 0), x, z, rot, C(0x2a2a2a));
      } else if (r < 0.78) place(G.bin, x, z, rot, C(0x2f5d4a));
      else if (r < 0.9) place(G.news, x, z, rot, C(this.rnd() < 0.5 ? 0x2f6fd0 : 0xd8322e));
      else {
        place(G.hydrant, x, z, rot, C(0xd8322e));
        place(G.hydrantTop, x, z, rot, C(0xd8322e));
      }
    };
    const off = ROAD_HALF + 3.4;
    for (let i = 0; i < LINES.length - 1; i++) {
      for (let j = 0; j < LINES.length - 1; j++) {
        if (j === 4) continue;
        const x0 = LINES[i] + off;
        const x1 = LINES[i + 1] - off;
        const z0 = LINES[j] + off;
        const z1 = LINES[j + 1] - off;
        const downtown = i >= 2 && i <= 5 && j <= 3;
        for (let t = 16; t < 64; t += 9 + this.rnd() * 6) {
          // each item faces the street it sits beside
          item(LINES[i] + t, z0, 0, downtown);
          item(LINES[i] + t, z1, Math.PI, downtown);
          item(x0, LINES[j] + t, Math.PI / 2, downtown);
          item(x1, LINES[j] + t, -Math.PI / 2, downtown);
        }
      }
    }
    const mesh = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ---------- signs ----------

  addSign(x, y, z, rotY, text, color, sub, w, h, subColor) {
    const tex = neonSignTexture(text, color, sub, subColor);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plane.position.set(x, y, z);
    plane.rotation.y = rotY;
    this.scene.add(plane);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(x + Math.sin(rotY) * 0.8, y, z + Math.cos(rotY) * 0.8);
    glow.scale.set(w * 1.6, h * 2.2, 1);
    this.scene.add(glow);
    this.signs.push({ plane, glow, mat, flicker: this.rnd() < 0.2 });
  }

  addBillboard(x, z, rotY, y = null) {
    const b = BILLBOARDS[Math.floor(this.rnd() * BILLBOARDS.length)];
    const tex = decalTexture(b[0], b[1], b[2], 512, 160);
    const top = y ?? 24;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    board.position.set(x, top, z);
    board.rotation.y = rotY;
    this.scene.add(board);
    this.trimBucket.box(x, top / 2, z, 0.5, top, 0.5, 2);
  }

  // ---------- canal bridges, marina, the Sunspan, the mainland ----------

  buildCanalBridges() {
    const b = new GeometryBucket();
    for (const L of LINES) {
      b.box(L, -0.5, (CANAL.zMin + CANAL.zMax) / 2, ROAD_HALF * 2 + 4, 1.1, CANAL.zMax - CANAL.zMin + 2, 3);
      for (const s of [-1, 1]) {
        b.box(L + s * (ROAD_HALF + 1.6), 0.7, (CANAL.zMin + CANAL.zMax) / 2, 0.5, 1.1, CANAL.zMax - CANAL.zMin, 3);
        for (let z = CANAL.zMin; z <= CANAL.zMax; z += 10) b.box(L + s * (ROAD_HALF + 1.6), 0.9, z, 0.8, 1.6, 0.8, 3);
      }
    }
    const mesh = new THREE.Mesh(b.build(), this.stoneMat);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    // canal promenade palms
    for (let x = LINE_MIN - 30; x < LINE_MAX; x += 16) {
      if (Math.abs(x - Math.round(x / 80) * 80) < 12) continue;
      this.palms.push([x, CANAL.zMin - 2.5, 0.8 + this.rnd() * 0.3]);
      this.palms.push([x + 8, CANAL.zMax + 2.5, 0.8 + this.rnd() * 0.3]);
    }
  }

  buildMarina() {
    const wood = new GeometryBucket();
    wood.box(185, -0.1, ISLAND.maxZ + 3, 290, 0.6, 6, 3);
    for (let x = 60; x <= 320; x += 52) wood.box(x, -0.1, ISLAND.maxZ + 40, 3, 0.6, 76, 3);
    const deck = new THREE.Mesh(wood.build(), new THREE.MeshStandardMaterial({ map: surfaceTexture('wood'), roughness: 0.9 }));
    deck.receiveShadow = deck.castShadow = true;
    this.scene.add(deck);
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.4, -4);
    hullShape.lineTo(1.4, -4);
    hullShape.lineTo(1.6, 2);
    hullShape.quadraticCurveTo(1.2, 4.5, 0, 5.5);
    hullShape.quadraticCurveTo(-1.2, 4.5, -1.6, 2);
    hullShape.closePath();
    const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 1.6, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 2 });
    hull.rotateX(Math.PI / 2);
    hull.translate(0, 1.2, 0);
    const white = new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.35 });
    const trims = [0x1f6fb2, 0xff5d5d, 0x1fb2a0, 0x222222];
    for (let x = 60; x < 320; x += 52) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const boat = new THREE.Group();
          const scale = 0.9 + this.rnd() * 0.9;
          const h = new THREE.Mesh(hull, white);
          h.castShadow = true;
          boat.add(h);
          const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.2), new THREE.MeshStandardMaterial({ color: trims[Math.floor(this.rnd() * 4)], roughness: 0.3 }));
          cabin.position.set(0, 1.8, -0.5);
          boat.add(cabin);
          if (this.rnd() < 0.5) {
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 12), white);
            mast.position.set(0, 7, 0.8);
            boat.add(mast);
          }
          boat.scale.setScalar(scale);
          boat.position.set(x + side * (5 + scale * 1.5), SEA_LEVEL - 0.9, ISLAND.maxZ + 14 + k * 22);
          boat.rotation.y = side > 0 ? 0 : Math.PI;
          this.scene.add(boat);
          this.boats.push({ obj: boat, phase: this.rnd() * 6, base: boat.position.y });
        }
      }
    }
    // the lighthouse at the end of the breakwater
    const lh = new GeometryBucket(true);
    const m = new THREE.Matrix4();
    for (let k = 0; k < 6; k++) {
      lh.addGeometry(new THREE.CylinderGeometry(2.4 - k * 0.2, 2.6 - k * 0.2, 4, 12), m.makeTranslation(0, 2 + k * 4, 0), new THREE.Color(k % 2 ? 0xffffff : 0xe2443b));
    }
    lh.addGeometry(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10), m.makeTranslation(0, 25, 0), new THREE.Color(0xfff2b0));
    lh.addGeometry(new THREE.ConeGeometry(2.2, 2, 10), m.makeTranslation(0, 27.2, 0), new THREE.Color(0x333333));
    const house = new THREE.Mesh(lh.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    house.position.set(420, -0.5, ISLAND.maxZ + 70);
    house.castShadow = true;
    this.scene.add(house);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 80), this.stoneMat);
    wall.position.set(420, -0.5, ISLAND.maxZ + 32);
    this.scene.add(wall);
  }

  buildSunspanBridge() {
    const b = new GeometryBucket();
    const len = BRIDGE.x1 - BRIDGE.x0;
    const midX = (BRIDGE.x0 + BRIDGE.x1) / 2;
    b.box(midX, -0.6, BRIDGE.z, len, 1.2, BRIDGE.half * 2 + 2, 4);
    for (const s of [-1, 1]) b.box(midX, 0.6, BRIDGE.z + s * (BRIDGE.half + 0.6), len, 1.2, 0.5, 4);
    for (let x = BRIDGE.x0 + 20; x < BRIDGE.x1; x += 60) b.box(x, -8, BRIDGE.z, 4, 15, 10, 4);
    const towers = [-560, -840];
    for (const tx of towers) {
      for (const s of [-1, 1]) b.box(tx, 35, BRIDGE.z + s * 10, 3.2, 90, 3.2, 4);
      for (const y of [28, 55, 78]) b.box(tx, y, BRIDGE.z, 2.4, 2.4, 22, 4);
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 });
    const bridge = new THREE.Mesh(b.build(), mat);
    bridge.castShadow = bridge.receiveShadow = true;
    this.scene.add(bridge);
    // main cables and hangers
    const cables = new GeometryBucket();
    const sag = (x) => {
      if (x > towers[0]) return 80 - ((x - towers[0]) / (BRIDGE.x1 - towers[0])) * 76;
      if (x < towers[1]) return 80 - ((towers[1] - x) / (towers[1] - BRIDGE.x0)) * 76;
      const t = (x - towers[1]) / (towers[0] - towers[1]);
      return 80 - Math.sin(t * Math.PI) * 68;
    };
    for (const s of [-1, 1]) {
      const pts = [];
      for (let x = BRIDGE.x0; x <= BRIDGE.x1; x += 10) pts.push(new THREE.Vector3(x, sag(x), BRIDGE.z + s * 10));
      cables.addGeometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.45, 5), new THREE.Matrix4());
      for (let x = BRIDGE.x0 + 10; x < BRIDGE.x1; x += 10) {
        const h = sag(x);
        cables.addGeometry(new THREE.CylinderGeometry(0.08, 0.08, h), new THREE.Matrix4().makeTranslation(x, h / 2, BRIDGE.z + s * 10));
      }
    }
    const cm = new THREE.Mesh(cables.build(), mat);
    cm.castShadow = true;
    this.scene.add(cm);
  }

  buildMainland() {
    // hazy hills round the horizon so the bay has somewhere to sit
    const g = new GeometryBucket(true);
    const m = new THREE.Matrix4();
    const rnd = makeStream(77);
    for (let k = 0; k < 26; k++) {
      const a = -Math.PI * 0.95 + k * 0.105 + rnd() * 0.05;
      const r = 1700 + rnd() * 500;
      const h = 60 + rnd() * 160;
      const geo = new THREE.ConeGeometry(220 + rnd() * 200, h, 7, 1);
      const col = new THREE.Color().setHSL(0.3 + rnd() * 0.08, 0.25, 0.32 + rnd() * 0.08);
      g.addGeometry(geo, m.makeTranslation(Math.cos(a) * r - 300, h / 2 - 8, Math.sin(a) * r), col);
    }
    const hills = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    this.scene.add(hills);
  }

  // ---------- palms ----------

  buildPalms() {
    for (let z = LINE_MIN - 30; z < ISLAND.maxZ; z += 15) {
      if (z > CANAL.zMin - 2 && z < CANAL.zMax + 2) continue;
      // Leave a clear promenade access opposite the lifeguard station.
      if (z < -120 || z > -85) this.palms.push([BOULEVARD_X + ROAD_HALF + 3, z, 1 + this.rnd() * 0.35]);
      if (this.rnd() < 0.7) this.palms.push([BEACH.x0 + 4 + this.rnd() * 30, z + this.rnd() * 8, 0.9 + this.rnd() * 0.4]);
      this.palms.push([BOULEVARD_X - ROAD_HALF - 2.5, z + 7, 0.95 + this.rnd() * 0.3]);
    }
    for (let x = LINE_MIN; x < LINE_MAX; x += 22) {
      this.palms.push([x + 11, LINE_MAX + ROAD_HALF + 3, 0.9 + this.rnd() * 0.3]);
    }
    if (instanceProps(this.scene, 'prop_palm', this.palms.map((p) => [p[0], p[0] > BEACH.x0 ? this.beachHeight(p[0]) : 0.16, p[1], p[2], this.rnd() * Math.PI * 2]), 9)) {
      for (const p of this.palms) this.addCollider(p[0] - 0.22, p[1] - 0.22, p[0] + 0.22, p[1] + 0.22, 8, 'palm');
      return;
    }
    const variants = [0, 1, 2].map((v) => palmGeometry(makeStream(400 + v)));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    const groups = [[], [], []];
    this.palms.forEach((p, k) => groups[k % 3].push(p));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    groups.forEach((list, v) => {
      const im = new THREE.InstancedMesh(variants[v], mat, list.length);
      list.forEach((p, k) => {
        const y = p[0] > BEACH.x0 ? this.beachHeight(p[0]) : 0.15;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rnd() * Math.PI * 2);
        m.compose(new THREE.Vector3(p[0], y, p[1]), q, new THREE.Vector3(p[2], p[2], p[2]));
        im.setMatrixAt(k, m);
        this.addCollider(p[0] - 0.35, p[1] - 0.35, p[0] + 0.35, p[1] + 0.35, 10, 'palm');
      });
      im.castShadow = true;
      this.scene.add(im);
    });
  }

  buildAssetPlazas() {
    const locations = [[52, -128, Math.PI / 2], [203, -9, Math.PI / 2], [370, -185, 0], [-49, -210, Math.PI], [370, 235, Math.PI]];
    instanceProps(this.scene, 'prop_foodtruck', locations.map(([x, z, a]) => [x, 0.16, z, 1, a]), 5.3, 'z');
    if (hasModel('prop_foodtruck')) for (const [x, z, a] of locations) {
      const w = Math.abs(Math.sin(a)) > 0.5 ? 2.6 : 1.4;
      const d = w > 2 ? 1.4 : 2.6;
      this.addCollider(x - w, z - d, x + w, z + d, 3, 'foodtruck');
    }
  }

  // ---------- per-frame and queries ----------

  update(dt, time) {
    this.coastClock.value = time;
    this.waterMat.normalMap.offset.set(time * 0.004, time * 0.0025);
    for (const b of this.boats) b.obj.position.y = b.base + Math.sin(time * 1.2 + b.phase) * 0.12;
    for (const s of this.signs) {
      if (!s.flicker) continue;
      const on = Math.sin(time * 23 + s.plane.position.x) > -0.85 || Math.sin(time * 3.1) > 0;
      s.mat.color.setScalar(on ? 1 : 0.35);
      s.glow.material.opacity = on ? 0.35 : 0.08;
    }
  }

  setNight(amount) {
    for (const m of this.facadeMaterials) m.emissiveIntensity = 0.04 + amount * 1.1;
    for (const s of this.signs) s.glow.material.opacity = 0.25 + amount * 0.45;
  }

  nearby(x, z, r) {
    const out = new Set();
    for (let i = Math.floor((x - r) / 40); i <= Math.floor((x + r) / 40); i++) {
      for (let j = Math.floor((z - r) / 40); j <= Math.floor((z + r) / 40); j++) {
        const list = this.grid.get(i * 4096 + j);
        if (list) for (const c of list) out.add(c);
      }
    }
    return out;
  }

  /** Push a circle out of every building it overlaps; returns the corrected point and the push normal. */
  collideCircle(x, z, r, maxHeight = 1) {
    let hit = false;
    let nx = 0;
    let nz = 0;
    for (const c of this.nearby(x, z, r)) {
      if (c.h < maxHeight * 0.3 && c.tag === 'crate' && maxHeight > 3) continue;
      const px = Math.max(c.x0, Math.min(x, c.x1));
      const pz = Math.max(c.z0, Math.min(z, c.z1));
      let dx = x - px;
      let dz = z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 < 1e-6) {
        // centre inside the box: leave by the nearest side
        const opts = [[x - c.x0, -1, 0], [c.x1 - x, 1, 0], [z - c.z0, 0, -1], [c.z1 - z, 0, 1]].sort((a, b) => a[0] - b[0]);
        dx = opts[0][1];
        dz = opts[0][2];
        x += dx * (opts[0][0] + r);
        z += dz * (opts[0][0] + r);
      } else {
        const d = Math.sqrt(d2);
        dx /= d;
        dz /= d;
        x = px + dx * r;
        z = pz + dz * r;
      }
      nx += dx;
      nz += dz;
    }
    const len = Math.hypot(nx, nz) || 1;
    return { x, z, hit, nx: nx / len, nz: nz / len };
  }

  /** Distance along a 3D ray to the first building face, or Infinity. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = Infinity;
    const seen = new Set();
    for (let t = 0; t <= maxDist; t += 30) {
      const px = ox + dx * t;
      const pz = oz + dz * t;
      for (const c of this.nearby(px, pz, 30)) {
        if (seen.has(c)) continue;
        seen.add(c);
        const hitT = rayBox(ox, oy, oz, dx, dy, dz, c);
        if (hitT < best) best = hitT;
      }
      if (best < t) break;
    }
    return best <= maxDist ? best : Infinity;
  }

  hasLineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len) === Infinity;
  }
}

function rayBox(ox, oy, oz, dx, dy, dz, c) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [[ox, dx, c.x0, c.x1], [oy, dy, 0, c.h], [oz, dz, c.z0, c.z1]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

/** A palm: a leaning ringed trunk, a crown of arching fronds and a few coconuts, in vertex colours. */
function palmGeometry(rnd) {
  const parts = new GeometryBucket(true);
  const lean = 0.6 + rnd() * 1.4;
  const height = 8 + rnd() * 3;
  const pts = [];
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    pts.push(new THREE.Vector3(lean * t * t, height * t, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.TubeGeometry(curve, 12, 0.24, 7);
  const bark = new THREE.Color(0x8a6a4a);
  parts.addGeometry(trunk, new THREE.Matrix4(), bark);
  const top = pts[6];
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + rnd() * 0.3;
    const len = 3.6 + rnd() * 1.4;
    const lift = 0.6 + rnd() * 0.5;
    const col = new THREE.Color().setHSL(0.26 + rnd() * 0.05, 0.55, 0.26 + rnd() * 0.08);
    const geo = frondGeometry(len, lift);
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(top.x, top.y, top.z);
    parts.addGeometry(geo, m, col);
  }
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2;
    parts.addGeometry(new THREE.SphereGeometry(0.2, 6, 5), new THREE.Matrix4().makeTranslation(top.x + Math.cos(a) * 0.3, top.y - 0.35, top.z + Math.sin(a) * 0.3), new THREE.Color(0x5a4a2a));
  }
  return parts.build();
}

function frondGeometry(len, lift) {
  const seg = 7;
  const pos = [];
  const centre = [];
  const left = [];
  const right = [];
  for (let k = 0; k <= seg; k++) {
    const t = k / seg;
    const x = t * len;
    const y = lift * Math.sin(t * Math.PI * 0.6) - t * t * 2.2;
    const w = 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
    centre.push([x, y, 0]);
    left.push([x, y - w * 0.35, -w]);
    right.push([x, y - w * 0.35, w]);
  }
  for (let k = 0; k < seg; k++) {
    pos.push(...centre[k], ...left[k], ...left[k + 1]);
    pos.push(...centre[k], ...left[k + 1], ...centre[k + 1]);
    pos.push(...centre[k], ...centre[k + 1], ...right[k + 1]);
    pos.push(...centre[k], ...right[k + 1], ...right[k]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.computeVertexNormals();
  return g;
}
