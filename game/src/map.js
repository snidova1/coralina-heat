// The layout of Coralina Bay: a grid of streets on an island, the Venetia Canal cutting across it,
// Ocean Drive's beach on the east shore, Kingfish Marina in the south and the Sunspan Bridge
// running west to the mainland. Everything that asks "where is land, road or water" asks here.
export const STEP = 80;
export const LINE_MIN = -360;
export const LINE_MAX = 360;
export const ROAD_HALF = 7;
export const WALK = 4;
export const LINES = [];
for (let v = LINE_MIN; v <= LINE_MAX; v += STEP) LINES.push(v);

export const ISLAND = { minX: -400, maxX: 446, minZ: -400, maxZ: 392 };
export const BOULEVARD_X = 360;
export const BEACH = { x0: 373, x1: 446 };
export const CANAL = { zMin: 15, zMax: 65, level: -2.2 };
export const BRIDGE = { z: -200, x0: -1000, x1: -400, half: 8 };
export const SEA_LEVEL = -0.9;

export const DISTRICTS = [
  { name: 'Ocean Drive', test: (x, z) => x > 280 },
  { name: 'Kingfish Marina', test: (x, z) => z > 280 },
  { name: 'Venetia Canal', test: (x, z) => z > -10 && z < 90 },
  { name: 'Coral Heights', test: (x, z) => z < 0 && x > -220 && x < 140 },
  { name: 'Sunspan Bridge', test: (x) => x < -400 },
  { name: 'Little Havana Heights', test: (x, z) => x < -120 && z > 80 },
  { name: 'Palmetto Flats', test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'Coralina Bay';
}

export function nearestLine(v) {
  const i = Math.round((v - LINE_MIN) / STEP);
  return LINE_MIN + Math.max(0, Math.min(LINES.length - 1, i)) * STEP;
}

export function lineIndex(v) {
  return Math.round((v - LINE_MIN) / STEP);
}

export function onBridge(x, z) {
  return x >= BRIDGE.x0 && x <= BRIDGE.x1 + 2 && Math.abs(z - BRIDGE.z) < BRIDGE.half;
}

export function inCanal(x, z) {
  if (z <= CANAL.zMin || z >= CANAL.zMax) return false;
  return Math.abs(x - nearestLine(x)) > ROAD_HALF + 2 || x > LINE_MAX + 20 || x < LINE_MIN - 20;
}

/** Ground you can stand or drive on. */
export function isLand(x, z) {
  if (onBridge(x, z)) return true;
  if (x < ISLAND.minX || x > ISLAND.maxX || z < ISLAND.minZ || z > ISLAND.maxZ) return false;
  return !inCanal(x, z);
}

/** Inside the asphalt of a street (bridges included). */
export function onRoad(x, z) {
  if (onBridge(x, z)) return true;
  const ext = LINE_MAX + ROAD_HALF;
  if (x < LINE_MIN - ROAD_HALF || x > ext || z < LINE_MIN - ROAD_HALF || z > ext) return false;
  return Math.abs(x - nearestLine(x)) < ROAD_HALF || Math.abs(z - nearestLine(z)) < ROAD_HALF;
}

/** The block (between streets) that a point lies in, by index, or null on a street. */
export function blockAt(x, z) {
  const i = Math.floor((x - LINE_MIN) / STEP);
  const j = Math.floor((z - LINE_MIN) / STEP);
  if (i < 0 || j < 0 || i >= LINES.length - 1 || j >= LINES.length - 1) return null;
  return { i, j };
}

/** Named places the story and the respawn logic refer to. */
export const PLACES = {
  hospital: { x: -129, z: -160, block: [2, 2], name: 'St. Marisol Medical' },
  precinct: { x: 80, z: 89, block: [5, 5], name: 'CBPD Precinct 9' },
  safehouse: { x: 351, z: -160, block: [8, 2], name: 'Flamingo Rest Motel' },
  marina: { x: 200, z: 380, name: 'Kingfish Marina' },
  tower: { x: 0, z: -209, block: [4, 1], name: 'Lux Tower' },
  warehouse: { x: -240, z: 320, block: [1, 8], name: 'Tiburones Warehouse' },
  park: { x: 200, z: -40, block: [6, 3], name: 'Royal Palm Park' },
};
