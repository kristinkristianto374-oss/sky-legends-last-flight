// Seeded randomness for SKY LEGENDS: deterministic terrain, clouds and rings.
// One job: every "random" thing in the world comes from a seed, so a screenshot
// taken twice looks the same and a run can be replayed exactly.

// mulberry32: small, fast, deterministic PRNG.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1; // in [-1, 1]
}

function smooth(t) { return t * t * (3 - 2 * t); }

// Value noise in 2D, single octave.
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx), v = smooth(fz);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
}

// Fractal Brownian motion: 4 octaves of value noise.
export function fbm(x, z, seed) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 101);
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm; // roughly [-1, 1]
}

// Ridged noise for mountain crests: sharp peaks, flat valleys.
export function ridged(x, z, seed) {
  const n = fbm(x, z, seed);
  return 1 - Math.abs(n); // [0, 1], 1 = crest
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function degToRad(d) { return (d * Math.PI) / 180; }
export function radToDeg(r) { return (r * 180) / Math.PI; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
