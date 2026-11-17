// Seeded random numbers: every random choice in Coralina Bay comes from here, so a seed always
// builds the same city and a screenshot scene always plays out the same way.
let state = 1;

export function seedRandom(seed) {
  state = (seed >>> 0) || 1;
}

export function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(a, b) {
  return a + (b - a) * rand();
}

export function randInt(a, b) {
  return Math.floor(a + (b - a + 1) * rand());
}

export function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

export function chance(p) {
  return rand() < p;
}

/** A separate stream for city layout, so gameplay randomness never shifts the map. */
export function makeStream(seed) {
  let s = (seed >>> 0) || 7;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
