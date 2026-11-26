// The world of SKY LEGENDS: an archipelago at sunset.
// One job: answer "how high is the ground here", place the runway, the rings
// and the clouds, and hand the renderer the terrain grid it draws.

import { WORLD, ISLANDS, RUNWAY } from './config.js';
import { fbm, ridged, clamp, lerp } from './random.js';

const SEED = WORLD.seed;

// Height of the land at (x, z). Below or at 0 is ocean.
export function terrainHeight(x, z) {
  let h = -26; // ocean floor
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < isl.r) {
      const t = 1 - d / isl.r;
      const fall = t * t * (3 - 2 * t);
      const crest = 0.55 + 0.45 * ridged(x * 0.0016, z * 0.0016, SEED + 7);
      const detail = 1 + 0.35 * fbm(x * 0.006, z * 0.006, SEED + 21);
      h = Math.max(h, isl.peak * fall * crest * detail);
    }
  }
  // Gentle rolling detail on land only.
  if (h > 0) h += 6 * fbm(x * 0.008, z * 0.008, SEED + 33);
  return Math.max(h, -26);
}

// Flatten the ground under the runway so the strip sits on a level field.
export function groundHeight(x, z) {
  const h = terrainHeight(x, z);
  // Flat plateau over the whole strip, blending to raw terrain over 90 m
  // outside the strip edges — so the runway is level edge to edge.
  const ox = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.length / 2);
  const oz = Math.max(0, Math.abs(z - RUNWAY.z) - RUNWAY.width / 2);
  const dOut = Math.max(ox, oz);
  const m = clamp(1 - dOut / 90, 0, 1);
  const s = m * m * (3 - 2 * m);
  return lerp(h, RUNWAY.height, s);
}

export function isWater(x, z) { return groundHeight(x, z) <= WORLD.oceanLevel + 0.4; }

// Is (x, z) on the runway strip (with a small margin)?
export function onRunway(x, z, margin = 0) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY.length / 2 + margin &&
    Math.abs(z - RUNWAY.z) <= RUNWAY.width / 2 + margin;
}

// Precomputed terrain grid the renderer draws. One entry per vertex:
// { x, z, y, land } — land is false for water vertices.
export function buildTerrainGrid() {
  const n = WORLD.gridHalf * 2 + 1;
  const cell = WORLD.cell;
  const verts = new Float32Array(n * n * 4); // x, y, z, land(0/1)
  let i = 0;
  for (let gz = -WORLD.gridHalf; gz <= WORLD.gridHalf; gz++) {
    for (let gx = -WORLD.gridHalf; gx <= WORLD.gridHalf; gx++) {
      const x = gx * cell, z = gz * cell;
      const h = groundHeight(x, z);
      // The ocean is drawn as its surface (y = 0), not the seabed, so the
      // horizon meets the shore cleanly and the sea reads as water.
      const y = h > WORLD.oceanLevel + 0.4 ? h : 0;
      verts[i++] = x; verts[i++] = y; verts[i++] = z;
      verts[i++] = y > WORLD.oceanLevel + 0.4 ? 1 : 0;
    }
  }
  return { verts, n, cell };
}

// Rings for a mission: 3D centres, radii and the direction each ring faces
// (the direction the aircraft should be flying when it passes through).
export function buildRings(mission) {
  const pts = mission.rings;
  return pts.map((p, idx) => {
    // A ring faces the direction the aircraft flies in to reach it: from the
    // previous ring (or the mission start for the first ring) toward this
    // one, so it always reads as a circle on approach, never edge-on.
    const prev = idx === 0 ? mission.start : pts[idx - 1];
    let fx = p.x - prev.x, fz = p.z - prev.z;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    return { x: p.x, y: p.y, z: p.z, fx, fz, radius: 26, index: idx, passed: false };
  });
}

// Clouds: soft billboard clusters scattered over the map at 380–680 m.
export function buildClouds() {
  const rngState = { s: WORLD.seed + 99 };
  const rnd = () => {
    rngState.s = (rngState.s * 1664525 + 1013904223) >>> 0;
    return rngState.s / 4294967296;
  };
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    const puffs = [];
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      puffs.push({ dx: (rnd() - 0.5) * 130, dy: (rnd() - 0.5) * 16, dz: (rnd() - 0.5) * 60, r: 26 + rnd() * 42 });
    }
    clouds.push({
      x: (rnd() - 0.5) * 4000, y: 380 + rnd() * 300, z: (rnd() - 0.5) * 4000,
      puffs, tint: rnd(),
    });
  }
  return clouds;
}

// Sun position: low in the west, so the sunset paints the whole scene.
export const SUN = { azimuthDeg: 262, elevationDeg: 16 };
export function sunDirection() {
  const az = (SUN.azimuthDeg * Math.PI) / 180;
  const el = (SUN.elevationDeg * Math.PI) / 180;
  return {
    x: Math.sin(az) * Math.cos(el),
    y: Math.sin(el),
    z: -Math.cos(az) * Math.cos(el),
  };
}
